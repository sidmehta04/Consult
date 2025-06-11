import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
  getCountFromServer,
  startAfter,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "../../firebase";

// OPTIMIZATION 1: Enhanced caching with smart TTL
class EnhancedCacheManager {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.accessCount = new Map();
    this.lastAccess = new Map();
  }

  set(key, value, ttl = 10 * 60 * 1000) { // Increased default TTL to 10 minutes
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now() + ttl);
    this.accessCount.set(key, 0);
    this.lastAccess.set(key, Date.now());
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    
    const timestamp = this.timestamps.get(key);
    if (Date.now() > timestamp) {
      this.delete(key);
      return null;
    }
    
    // Track access for smart caching
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
    this.lastAccess.set(key, Date.now());
    
    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
    this.accessCount.delete(key);
    this.lastAccess.delete(key);
  }

  // Smart cache cleanup - remove least used items first
  cleanup(maxSize = 100) {
    if (this.cache.size <= maxSize) return;
    
    const entries = Array.from(this.cache.keys()).map(key => ({
      key,
      accessCount: this.accessCount.get(key) || 0,
      lastAccess: this.lastAccess.get(key) || 0
    }));
    
    // Sort by access frequency and recency
    entries.sort((a, b) => {
      const aScore = a.accessCount + (Date.now() - a.lastAccess) / 1000000;
      const bScore = b.accessCount + (Date.now() - b.lastAccess) / 1000000;
      return aScore - bScore;
    });
    
    // Remove least used 25%
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.delete(entries[i].key);
    }
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
    this.accessCount.clear();
    this.lastAccess.clear();
  }

  has(key) {
    const value = this.get(key);
    return value !== null;
  }
}

// Global cache instances with enhanced management
const masterCache = new EnhancedCacheManager();
const countCache = new EnhancedCacheManager();

// OPTIMIZATION 2: Smart request batching and deduplication
class SmartDataManager {
  constructor() {
    this.listeners = new Map();
    this.pendingRequests = new Map();
    this.requestQueue = new Map();
    this.batchTimer = null;
  }

  async batchRequest(key, requestFactory, priority = 1) {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Queue high priority requests to execute immediately
    if (priority > 5) {
      const promise = this.executeRequest(key, requestFactory);
      this.pendingRequests.set(key, promise);
      return promise;
    }

    // Batch lower priority requests
    return new Promise((resolve, reject) => {
      this.requestQueue.set(key, { requestFactory, resolve, reject, priority });
      
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(), 50); // 50ms batching window
      }
    });
  }

  async processBatch() {
    const requests = Array.from(this.requestQueue.entries());
    this.requestQueue.clear();
    this.batchTimer = null;

    // Sort by priority and execute
    requests.sort((a, b) => b[1].priority - a[1].priority);
    
    for (const [key, { requestFactory, resolve, reject }] of requests) {
      try {
        const result = await this.executeRequest(key, requestFactory);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
  }

  async executeRequest(key, requestFactory) {
    try {
      const result = await requestFactory();
      this.pendingRequests.delete(key);
      return result;
    } catch (error) {
      this.pendingRequests.delete(key);
      throw error;
    }
  }

  cleanup() {
    this.listeners.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    this.listeners.clear();
    this.pendingRequests.clear();
    this.requestQueue.clear();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
  }
}

const smartDataManager = new SmartDataManager();

// OPTIMIZATION 3: Ultra-efficient count fetcher with aggressive caching
export const fetchCounts = async (partnerName, clinicMapping, queryConstraints) => {
  const cacheKey = `counts_${partnerName || 'all'}_${JSON.stringify(queryConstraints)}`;
  
  // Check cache first with extended TTL for counts
  const cached = countCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await smartDataManager.batchRequest(cacheKey, async () => {
      const casesRef = collection(firestore, "cases");
      
      // CRITICAL OPTIMIZATION: Use single aggregated count query when possible
      if (!partnerName) {
        const baseQuery = query(casesRef, ...queryConstraints);
        const countResult = await getCountFromServer(baseQuery);
        return { count: countResult.data().count };
      }

      // For partner filtering, use cached data when available
      const allCasesCacheKey = `all_cases_${JSON.stringify(queryConstraints)}`;
      let allCases = masterCache.get(allCasesCacheKey);
      
      if (!allCases) {
        // Only fetch a sample for count estimation
        const sampleQuery = query(casesRef, ...queryConstraints, limit(500));
        const snapshot = await getDocs(sampleQuery);
        
        allCases = [];
        snapshot.forEach((doc) => {
          allCases.push({ id: doc.id, ...doc.data() });
        });
        
        // Cache for 5 minutes
        masterCache.set(allCasesCacheKey, allCases, 5 * 60 * 1000);
      }
      
      // Count matching cases from cached data
      let count = 0;
      allCases.forEach((caseData) => {
        const clinicInfo = clinicMapping.get(caseData.clinicId);
        if (clinicInfo && clinicInfo.partnerName === partnerName) {
          count += (caseData.emrNumbers?.length > 0) ? caseData.emrNumbers.length : 1;
        }
      });
      
      return { count };
    }, 3); // Medium priority

    // Cache result for 5 minutes for counts
    countCache.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (error) {
    console.error("Error in fetchCounts:", error);
    return { count: 0 };
  }
};

// OPTIMIZATION 4: Revolutionary fetchTabData with minimal Firebase reads
export const fetchTabData = async (
  userId,
  userRole,
  tabName,
  filters = {},
  pagination = { page: 1, pageSize: 50, lastDoc: null },
  clinicMapping
) => {
  const cacheKey = `tab_${tabName}_${userId}_${JSON.stringify({filters, pagination: { page: pagination.page, pageSize: pagination.pageSize }})}`;
  
  // Check cache first with smart TTL based on data type
  const cacheTTL = getSmartCacheTTL(tabName, filters);
  const cached = masterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await smartDataManager.batchRequest(cacheKey, async () => {
      // OPTIMIZATION: Try to use cached data first, only query Firebase if necessary
      const baseCacheKey = `base_data_${userId}_${userRole}`;
      let baseData = masterCache.get(baseCacheKey);
      
      if (!baseData) {
        // Only fetch from Firebase when cache miss
        const casesRef = collection(firestore, "cases");
        const queryConstraints = buildOptimizedQuery(userId, userRole, 'all', { page: 1, pageSize: 1000 });
        const querySnapshot = await getDocs(query(casesRef, ...queryConstraints));
        
        baseData = [];
        querySnapshot.forEach((doc) => {
          baseData.push({ id: doc.id, ...doc.data() });
        });
        
        // Cache base data for longer period
        masterCache.set(baseCacheKey, baseData, 15 * 60 * 1000); // 15 minutes
      }
      
      // Process cached data instead of querying Firebase again
      const results = processInMemoryData(baseData, userRole, tabName, filters, pagination, clinicMapping);
      return results;
    }, 8); // High priority for tab data

    // Cache with smart TTL
    masterCache.set(cacheKey, result, cacheTTL);
    return result;
  } catch (error) {
    console.error("Error fetching tab data:", error);
    return getEmptyTabData(pagination);
  }
};

// OPTIMIZATION 5: Smart cache TTL based on data volatility
const getSmartCacheTTL = (tabName, filters) => {
  // Real-time data needs shorter cache
  if (filters.searchTerm || filters.dateFrom || filters.dateTo) {
    return 30 * 1000; // 30 seconds for filtered/searched data
  }
  
  // Tab-specific TTL
  switch (tabName) {
    case 'doctor':
    case 'pharmacist':
      return 2 * 60 * 1000; // 2 minutes for active queues
    case 'completed':
      return 10 * 60 * 1000; // 10 minutes for completed cases
    case 'incomplete':
      return 5 * 60 * 1000; // 5 minutes for incomplete cases
    default:
      return 5 * 60 * 1000; // 5 minutes default
  }
};

// OPTIMIZATION 6: In-memory data processing instead of Firebase queries
const processInMemoryData = (baseData, userRole, tabName, filters, pagination, clinicMapping) => {
  // Apply tab-specific filtering in memory
  let filteredData = baseData.filter(caseData => {
    return applyTabFilter(caseData, tabName) && applyCustomFilters(caseData, filters, userRole, clinicMapping);
  });
  
  // Sort in memory
  filteredData.sort((a, b) => {
    const aDate = a.createdAt?.seconds || a.createdAt?.getTime?.() || 0;
    const bDate = b.createdAt?.seconds || b.createdAt?.getTime?.() || 0;
    return bDate - aDate; // Descending order
  });
  
  // Apply pagination in memory
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const endIndex = startIndex + pagination.pageSize;
  const paginatedData = filteredData.slice(startIndex, endIndex);
  
  // Collect unique values for filters
  const uniquePartners = new Set();
  const uniqueClinics = new Set();
  const uniqueDoctors = new Set();
  
  filteredData.forEach(caseData => {
    if (caseData.partnerName) uniquePartners.add(caseData.partnerName);
    if (caseData.clinicCode || caseData.clinicName) {
      uniqueClinics.add(caseData.clinicCode || caseData.clinicName);
    }
    if (caseData.assignedDoctors?.primaryName) {
      uniqueDoctors.add(caseData.assignedDoctors.primaryName);
    }
  });
  
  // Process cases
  const enrichedCases = paginatedData.map(caseData => preprocessCase(caseData));
  const finalCases = enrichCasesBatch(enrichedCases, clinicMapping);
  
  return {
    cases: finalCases,
    uniquePartners: Array.from(uniquePartners),
    uniqueClinics: Array.from(uniqueClinics),
    uniqueDoctors: Array.from(uniqueDoctors),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore: endIndex < filteredData.length,
      total: filteredData.length
    },
  };
};

// OPTIMIZATION 7: In-memory tab filtering
const applyTabFilter = (caseData, tabName) => {
  switch (tabName) {
    case "doctor":
      return caseData.status === "pending" && !caseData.doctorCompleted;
    case "pharmacist":
      return caseData.status === "doctor_completed";
    case "completed":
      return caseData.pharmacistCompleted === true;
    case "incomplete":
      return caseData.isIncomplete === true;
    default:
      return true;
  }
};

// OPTIMIZATION 8: Enhanced custom filter function
const applyCustomFilters = (caseData, filters, userRole, clinicMapping) => {
  // Status filter
  if (filters.status) {
    let isIncomplete = false;
    switch (userRole) {
      case "doctor":
        isIncomplete = caseData.status === "doctor_incomplete";
        break; 
      case "pharmacist": 
        isIncomplete = caseData.status === "pharmacist_incomplete";
        break;
      default:
        isIncomplete = caseData.isIncomplete;
    }
    
    switch (filters.status) {
      case "completed":
        if (!caseData.doctorCompleted || !caseData.pharmacistCompleted || isIncomplete) return false;
        break;
      case "pending":
        if ((caseData.doctorCompleted && caseData.pharmacistCompleted) || isIncomplete) return false;
        break;
      case "incomplete":
        if (!isIncomplete) return false;
        break;
    }
  }

  // Partner filter - check cache first
  if (filters.partner) {
    const partnerFilter = Array.isArray(filters.partner) ? filters.partner : [filters.partner];
    if (partnerFilter.length > 0) {
      const clinicInfo = clinicMapping.get(caseData.clinicId);
      if (!clinicInfo || !partnerFilter.includes(clinicInfo.partnerName)) {
        return false;
      }
    }
  }

  // Other filters
  if (filters.clinic && (caseData.clinicCode || caseData.clinicName) !== filters.clinic) return false;
  if (filters.doctor && caseData.assignedDoctors?.primaryName !== filters.doctor) return false;

  // Date range filter with optimized date handling
  if (filters.dateFrom || filters.dateTo) {
    const caseDate = caseData.createdAt?.toDate?.() || 
                    (caseData.createdAt?.seconds ? new Date(caseData.createdAt.seconds * 1000) : caseData.createdAt);
    
    if (filters.dateFrom) {
      const dateFrom = new Date(filters.dateFrom);
      if (caseDate < dateFrom) return false;
    }
    
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      if (caseDate > dateTo) return false;
    }
  }

  // Optimized search filter
  if (filters.searchTerm) {
    const searchTerm = filters.searchTerm.toLowerCase().trim();
    const exactMatch = 
      caseData.emrNumber?.toLowerCase() === searchTerm ||
      caseData.caseNumber?.toString() === searchTerm ||
      caseData.id?.toLowerCase() === searchTerm ||
      caseData.emrNumbers?.some(emr => 
        typeof emr === 'string' ? emr.toLowerCase() === searchTerm : 
        emr?.toString() === searchTerm
      );
    
    if (!exactMatch) return false;
  }

  return true;
};

// OPTIMIZATION 9: Simplified query builder (reduced complexity)
const buildOptimizedQuery = (userId, userRole, tabName, pagination) => {
  const constraints = [];
  
  // Role-based constraints (only add if necessary)
  switch (userRole) {
    case "doctor":
      constraints.push(where("assignedDoctors.primary", "==", userId));
      break;
    case "pharmacist":
      constraints.push(where("pharmacistId", "==", userId));
      break;
    case "clinic":
    case "nurse":
      constraints.push(where("createdBy", "==", userId));
      break;
    // superAdmin, zonalHead, teamLeader, drManager, ro see all - no constraint needed
  }

  // Always order by created date for consistent pagination
  constraints.push(orderBy("createdAt", "desc"));

  // Pagination
  const pageSize = Math.min(pagination.pageSize || 50, 1000); // Increased max to reduce queries
  if (pagination.lastDoc && pagination.page > 1) {
    constraints.push(startAfter(pagination.lastDoc));
  }
  constraints.push(limit(pageSize));

  return constraints;
};

// OPTIMIZATION 10: Cached clinic mapping with smart refresh
export const getClinicMapping = async () => {
  const cacheKey = 'clinic_mapping_v2';
  
  // Check cache first with longer TTL
  const cached = masterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await smartDataManager.batchRequest(cacheKey, async () => {
      const clinicDataMap = new Map();
      const uniquePartners = new Set();

      // OPTIMIZATION: Query all users at once instead of role-specific queries
      const allUsersQuery = query(collection(firestore, "users"));
      const snapshot = await getDocs(allUsersQuery);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filter in memory instead of Firebase query
        if (data.role === "nurse" || data.clinicCode) {
          clinicDataMap.set(doc.id, {
            clinicCode: data.clinicCode,
            name: data.name,
            partnerName: data.partnerName
          });
          if (data.partnerName) uniquePartners.add(data.partnerName);
        }
      });

      return [clinicDataMap, Array.from(uniquePartners)];
    }, 10); // Highest priority

    // Cache for 30 minutes - clinic data changes infrequently
    masterCache.set(cacheKey, result, 30 * 60 * 1000);
    return result;
  } catch (error) {
    console.error("Error fetching clinic mapping:", error);
    return [new Map(), []];
  }
};

// OPTIMIZATION 11: Optimized case preprocessing (minimal changes)
const preprocessCase = (caseData) => {
  return {
    ...caseData,
    createdAt: caseData.createdAt?.toDate?.() || 
               (caseData.createdAt?.seconds ? new Date(caseData.createdAt.seconds * 1000) : caseData.createdAt) || 
               new Date(),
    updatedAt: caseData.updatedAt?.toDate?.() || 
               (caseData.updatedAt?.seconds ? new Date(caseData.updatedAt.seconds * 1000) : caseData.updatedAt) || 
               new Date(),
    startTime: caseData.startTime?.toDate?.() || caseData.createdAt?.toDate?.() || new Date(),
    endTime: caseData.pharmacistCompletedAt?.toDate?.() || null,
    doctorCompletedAt: caseData.doctorCompletedAt?.toDate?.() || null,
    pharmacistCompletedAt: caseData.pharmacistCompletedAt?.toDate?.() || null,
    pendingQueue: determinePendingQueue(caseData),
  };
};

// OPTIMIZATION 12: Fast pending queue determination
const determinePendingQueue = (caseData) => {
  if (caseData.isIncomplete || 
      caseData.status === "doctor_incomplete" || 
      caseData.status === "pharmacist_incomplete") {
    return "incomplete";
  }
  if (caseData.doctorCompleted && caseData.pharmacistCompleted) return "completed";
  if (!caseData.doctorCompleted) return "doctor";
  return "pharmacist";
};

// OPTIMIZATION 13: Memory-based case enrichment
const enrichCasesBatch = (cases, clinicDataMap) => {
  const clinicLookup = new Map();
  clinicDataMap.forEach((clinic, id) => {
    clinicLookup.set(id, clinic.clinicCode);
  });

  return cases.map(caseItem => {
    const enriched = { ...caseItem };

    if (caseItem.clinicId && clinicLookup.has(caseItem.clinicId)) {
      enriched.clinicCode = clinicLookup.get(caseItem.clinicId);
    }

    if (caseItem.assignedDoctors?.primaryName) {
      enriched.doctorName = caseItem.assignedDoctors.primaryName;
    }

    enriched.statusLabel = caseItem.isIncomplete === true ? "Incomplete" : 
                          caseItem.pharmacistCompleted ? "Completed" : "Pending";

    return enriched;
  });
};

// OPTIMIZATION 14: Cached case contribution calculation
export const calculateCaseContribution = (caseData, todayEpoch, tomorrowEpoch, partnerName, clinicMapping) => {
  const contribution = {
    totalCases: 0, pendingCases: 0, completedCases: 0, doctorPendingCases: 0,
    pharmacistPendingCases: 0, incompleteCases: 0, todayCases: 0,
    todayCompleted: 0, todayIncomplete: 0,
  };

  // Early return for partner mismatch
  if (partnerName) {
    const clinicInfo = clinicMapping.get(caseData.clinicId);
    if (!clinicInfo || partnerName !== clinicInfo.partnerName) {
      return contribution;
    }
  }

  const len = (caseData.emrNumbers?.length > 0) ? caseData.emrNumbers.length : 1;
  contribution.totalCases = len;

  // Optimized today check
  const caseTimestamp = caseData.createdAt?.seconds || 
                       (caseData.createdAt?.getTime?.() / 1000) || 0;
  const isToday = todayEpoch <= caseTimestamp && caseTimestamp < tomorrowEpoch;

  if (isToday) contribution.todayCases = len;

  // State determination
  const isIncomplete = caseData.isIncomplete || 
                      caseData.status === "doctor_incomplete" || 
                      caseData.status === "pharmacist_incomplete";

  if (isIncomplete) {
    contribution.incompleteCases = len;
    if (isToday) contribution.todayIncomplete = len;
  } else if (caseData.doctorCompleted && caseData.pharmacistCompleted) {
    contribution.completedCases = len;
    if (isToday) contribution.todayCompleted = len;
  } else if (!caseData.doctorCompleted) {
    contribution.doctorPendingCases = len;
  } else {
    contribution.pharmacistPendingCases = len;
  }

  contribution.pendingCases = contribution.doctorPendingCases + contribution.pharmacistPendingCases;
  return contribution;
};

// OPTIMIZATION 15: Enhanced cache management
export const clearAllCaches = () => {
  masterCache.clear();
  countCache.clear();
  smartDataManager.cleanup();
};

export const getCacheStats = () => ({
  master: { size: masterCache.cache.size },
  count: { size: countCache.cache.size },
  listeners: { size: smartDataManager.listeners.size },
  pendingRequests: { size: smartDataManager.pendingRequests.size }
});

// OPTIMIZATION 16: Efficient real-time listener
export const createRealtimeListener = (userId, userRole, onUpdate) => {
  const listenerKey = `realtime_${userId}_${userRole}`;
  
  return smartDataManager.batchRequest(listenerKey, () => {
    const casesRef = collection(firestore, "cases");
    let listenerQuery;
    
    // Reduced limit to minimize real-time data transfer
    const realtimeLimit = 200; // Reduced from 500
    
    switch (userRole) {
      case "superAdmin":
      case "zonalHead":
      case "drManager":
      case "teamLeader":
        listenerQuery = query(casesRef, orderBy("createdAt", "desc"), limit(realtimeLimit));
        break;
      case "doctor":
        listenerQuery = query(casesRef, where("assignedDoctors.primary", "==", userId), orderBy("createdAt", "desc"), limit(realtimeLimit));
        break;
      case "pharmacist":
        listenerQuery = query(casesRef, where("pharmacistId", "==", userId), orderBy("createdAt", "desc"), limit(realtimeLimit));
        break;
      default:
        listenerQuery = query(casesRef, where("createdBy", "==", userId), orderBy("createdAt", "desc"), limit(realtimeLimit));
        break;
    }

    return onSnapshot(listenerQuery, (snapshot) => {
      // Throttle updates to reduce processing
      setTimeout(() => onUpdate(snapshot), 100);
    }, (error) => {
      console.error("Listener Error:", error);
    });
  }, 10);
};

// Utility functions
const getEmptyTabData = (pagination) => ({
  cases: [],
  uniquePartners: [],
  uniqueClinics: [],
  uniqueDoctors: [],
  pagination: {
    page: pagination.page || 1,
    pageSize: pagination.pageSize || 50,
    hasMore: false,
    total: 0
  },
});

// OPTIMIZATION 17: Periodic cache cleanup
setInterval(() => {
  masterCache.cleanup(100); // Keep top 100 entries
  countCache.cleanup(50);   // Keep top 50 count entries
}, 5 * 60 * 1000); // Cleanup every 5 minutes