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
} from "firebase/firestore";
import { firestore } from "../../firebase";

// OPTIMIZATION 1: Cache for clinic mapping and user data
const clinicMappingCache = new Map();
const userDataCache = new Map();
let partnersCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// OPTIMIZATION 2: Simplified count fetcher with caching
export const fetchCounts = async (partnerName, clinicMapping, query) => {
  try {
    const countsObj = await getCountFromServer(query);
    const counts = countsObj.data().count;
    
    // For simple cases where partner filtering isn't needed, return direct count
    if (!partnerName) {
      return { count: counts };
    }

    // Only do detailed counting when necessary
    const snapshot = await getDocs(query);
    let count = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (partnerName) {
        const clinicInfo = clinicMapping.get(data.clinicId);
        if (clinicInfo && clinicInfo.partnerName === partnerName) {
          count += (data.emrNumbers && data.emrNumbers.length > 0) ? data.emrNumbers.length : 1;
        }
      } else {
        count += (data.emrNumbers && data.emrNumbers.length > 0) ? data.emrNumbers.length : 1;
      }
    });
    
    return { count };
  } catch (error) {
    console.error("Error in fetchCounts:", error);
    return { count: 0 };
  }
};

// OPTIMIZATION 3: Streamlined fetchTabData with better caching
export const fetchTabData = async (
  userId,
  userRole,
  tabName,
  filters = {},
  pagination = { page: 1, pageSize: 50, lastDoc: null },
  clinicMapping
) => {
  try {
    let casesQuery;
    const casesRef = collection(firestore, "cases");

    // OPTIMIZATION 4: Build query constraints more efficiently
    const queryConstraints = [];
    
    // Add role-based constraints
    switch (userRole) {
      case "doctor":
        queryConstraints.push(where("assignedDoctors.primary", "==", userId));
        break;
      case "pharmacist":
        queryConstraints.push(where("pharmacistId", "==", userId));
        break;
      case "clinic":
      case "nurse":
        queryConstraints.push(where("createdBy", "==", userId));
        break;
      // superAdmin, zonalHead, teamLeader, drManager, ro can see all
    }

    // Add tab-specific constraints
    switch (tabName) {
      case "doctor":
        queryConstraints.push(
          where("status", "==", 'pending'),
          where("doctorCompleted", "==", false),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"),
          orderBy("createdAt", "desc")
        );
        break;
      case "pharmacist":
        queryConstraints.push(
          where("status", "==", 'doctor_completed'),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"),
          orderBy("createdAt", "desc")
        );
        break;
      case "completed":
        queryConstraints.push(
          where("pharmacistCompleted", "==", true),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"),
          orderBy("createdAt", "desc")
        );
        break;
      case "incomplete":
        queryConstraints.push(
          where("isIncomplete", "==", true),
          orderBy("createdAt", "desc")
        );
        break;
      default:
        queryConstraints.push(orderBy("createdAt", "desc"));
        break;
    }

    // Add pagination
    const pageSize = Math.min(pagination.pageSize || 50, 200); // Cap at 100 for performance
    if (pagination.lastDoc && pagination.page > 1) {
      queryConstraints.push(startAfter(pagination.lastDoc));
    }
    queryConstraints.push(limit(pageSize));

    // Execute query
    const paginatedQuery = query(casesRef, ...queryConstraints);
    const querySnapshot = await getDocs(paginatedQuery);

    // OPTIMIZATION 5: Process results more efficiently
    const cases = [];
    const uniquePartners = new Set();
    const uniqueClinics = new Set();
    const uniqueDoctors = new Set();

    for (const docSnap of querySnapshot.docs) {
      const caseData = { ...docSnap.data(), id: docSnap.id };

      // Apply client-side filters efficiently
      if (shouldIncludeCase(caseData, filters, clinicMapping)) {
        // Collect unique values
        if (caseData.partnerName) uniquePartners.add(caseData.partnerName);
        if (caseData.clinicCode || caseData.clinicName) {
          uniqueClinics.add(caseData.clinicCode || caseData.clinicName);
        }
        if (caseData.assignedDoctors?.primaryName) {
          uniqueDoctors.add(caseData.assignedDoctors.primaryName);
        }

        // Process timestamps more efficiently
        const processedCase = {
          ...caseData,
          createdAt: caseData.createdAt?.toDate?.() || caseData.createdAt || new Date(),
          updatedAt: caseData.updatedAt?.toDate?.() || caseData.updatedAt || new Date(),
          startTime: caseData.startTime?.toDate?.() || caseData.createdAt?.toDate?.() || new Date(),
          endTime: caseData.pharmacistCompletedAt?.toDate?.() || null,
          doctorCompletedAt: caseData.doctorCompletedAt?.toDate?.() || null,
          pharmacistCompletedAt: caseData.pharmacistCompletedAt?.toDate?.() || null,
          pendingQueue: determinePendingQueue(caseData),
        };

        cases.push(processedCase);
      }
    }

    // OPTIMIZATION 6: Simplified enrichment - only when needed
    const enrichedCases = cases.length > 0 ? await enrichCasesWithUserData(cases, clinicMapping) : [];

    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

    return {
      cases: enrichedCases,
      uniquePartners: Array.from(uniquePartners),
      uniqueClinics: Array.from(uniqueClinics),
      uniqueDoctors: Array.from(uniqueDoctors),
      pagination: {
        page: pagination.page,
        pageSize,
        lastDoc: lastVisible,
        hasMore: querySnapshot.docs.length === pageSize,
      },
    };
  } catch (error) {
    console.error("Error fetching tab data:", error);
    return {
      cases: [],
      uniquePartners: [],
      uniqueClinics: [],
      uniqueDoctors: [],
      pagination: {
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 50,
        hasMore: false,
      },
    };
  }
};

// OPTIMIZATION 7: More efficient filter checking
const shouldIncludeCase = (caseData, filters, clinicMapping) => {
  if (!filters || Object.keys(filters).length === 0) return true;

  // Status filter
  if (filters.status) {
    const isIncomplete = caseData.isIncomplete || 
                        caseData.status === "doctor_incomplete" || 
                        caseData.status === "pharmacist_incomplete";
    
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

  // Partner filter - simplified
  if (filters.partner?.length > 0) {
    const clinicInfo = clinicMapping.get(caseData.clinicId);
    if (!clinicInfo || !filters.partner.includes(clinicInfo.partnerName)) {
      return false;
    }
  }

  // Other filters
  if (filters.clinic && (caseData.clinicCode || caseData.clinicName) !== filters.clinic) return false;
  if (filters.doctor && caseData.assignedDoctors?.primaryName !== filters.doctor) return false;

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    const caseDate = caseData.createdAt?.toDate?.() || caseData.createdAt;
    if (filters.dateFrom && caseDate < new Date(filters.dateFrom)) return false;
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (caseDate > toDate) return false;
    }
  }

  // Search filter - optimized
  if (filters.searchTerm?.trim()) {
    const searchTerm = filters.searchTerm.toLowerCase().trim();
    const searchFields = ['emrNumber', 'emrNumbers', 'caseNumber', 'id'];
    
    return searchFields.some(field => {
      const value = caseData[field];
      if (!value) return false;
      
      if (typeof value === 'string') return value.toLowerCase() === searchTerm;
      if (typeof value === 'number') return value.toString() === searchTerm;
      if (Array.isArray(value)) {
        return value.some(item => 
          typeof item === 'string' ? item.toLowerCase() === searchTerm : 
          typeof item === 'number' ? item.toString() === searchTerm : false
        );
      }
      return false;
    });
  }

  return true;
};

// OPTIMIZATION 8: Simplified pending queue determination
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

// OPTIMIZATION 9: Memoized case contribution calculation
export const calculateCaseContribution = (caseData, todayEpoch, tomorrowEpoch, partnerName, clinicMapping) => {
  const contribution = {
    totalCases: 0, pendingCases: 0, completedCases: 0, doctorPendingCases: 0,
    pharmacistPendingCases: 0, incompleteCases: 0, todayCases: 0,
    todayCompleted: 0, todayIncomplete: 0,
  };

  // Early return if partner doesn't match
  if (partnerName) {
    const clinicInfo = clinicMapping.get(caseData.clinicId);
    if (!clinicInfo || partnerName !== clinicInfo.partnerName) {
      return contribution;
    }
  }

  const len = (caseData.emrNumbers?.length > 0) ? caseData.emrNumbers.length : 1;
  contribution.totalCases = len;

  // Check if today
  const isToday = caseData.createdAt?.seconds && 
                  todayEpoch <= caseData.createdAt.seconds && 
                  caseData.createdAt.seconds < tomorrowEpoch;

  if (isToday) contribution.todayCases = len;

  // Determine case state
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

// OPTIMIZATION 10: Cached clinic mapping
export const getClinicMapping = async () => {
  const now = Date.now();
  
  // Return cached data if still valid
  if (clinicMappingCache.size > 0 && partnersCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return [clinicMappingCache, partnersCache];
  }

  try {
    const clinicDataMap = new Map();
    const uniquePartners = new Set();

    const clinicQuery = query(collection(firestore, "users"), where("role", "==", "nurse"));
    const snapshot = await getDocs(clinicQuery);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      clinicDataMap.set(doc.id, {
        clinicCode: data.clinicCode,
        name: data.name,
        partnerName: data.partnerName
      });
      if (data.partnerName) uniquePartners.add(data.partnerName);
    });

    // Update cache
    clinicMappingCache.clear();
    clinicDataMap.forEach((value, key) => clinicMappingCache.set(key, value));
    partnersCache = Array.from(uniquePartners);
    cacheTimestamp = now;

    return [clinicMappingCache, partnersCache];
  } catch (error) {
    console.error("Error fetching clinic mapping:", error);
    return [new Map(), []];
  }
};

// OPTIMIZATION 11: Highly optimized user data enrichment
const enrichCasesWithUserData = async (cases, clinicDataMap) => {
  if (!cases.length) return [];

  // Collect only essential user IDs
  const userIds = new Set();
  cases.forEach(caseItem => {
    if (caseItem.createdBy) userIds.add(caseItem.createdBy);
    if (caseItem.assignedDoctors?.primary) userIds.add(caseItem.assignedDoctors.primary);
    if (caseItem.pharmacistId) userIds.add(caseItem.pharmacistId);
  });

  // Batch fetch user data efficiently
  const userDataMap = new Map();
  const batchSize = 30; // Increased batch size
  const userIdsArray = Array.from(userIds);

  try {
    for (let i = 0; i < userIdsArray.length; i += batchSize) {
      const batch = userIdsArray.slice(i, i + batchSize);
      const promises = batch.map(userId => {
        // Check cache first
        if (userDataCache.has(userId)) {
          return Promise.resolve({ exists: () => true, data: () => userDataCache.get(userId) });
        }
        return getDoc(doc(firestore, "users", userId));
      });
      
      const snapshots = await Promise.all(promises);
      
      snapshots.forEach((snap, index) => {
        if (snap.exists()) {
          const userData = snap.data();
          const userId = batch[index];
          const userInfo = {
            name: userData.name,
            role: userData.role,
            partnerName: userData.partnerName || "N/A",
          };
          userDataMap.set(userId, userInfo);
          userDataCache.set(userId, userInfo); // Cache for future use
        }
      });
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
  }

  // Enrich cases with minimal processing
  return cases.map(caseItem => {
    const enriched = { ...caseItem };

    // Set basic time fields
    enriched.startTime = caseItem.createdAt;
    if (caseItem.pharmacistCompletedAt) enriched.endTime = caseItem.pharmacistCompletedAt;

    // Get clinic code
    if (caseItem.clinicId && clinicDataMap.has(caseItem.clinicId)) {
      enriched.clinicCode = clinicDataMap.get(caseItem.clinicId).clinicCode;
    }

    // Add user names
    if (caseItem.createdBy && userDataMap.has(caseItem.createdBy)) {
      enriched.createdByName = userDataMap.get(caseItem.createdBy).name;
    }

    if (caseItem.assignedDoctors?.primary && userDataMap.has(caseItem.assignedDoctors.primary)) {
      enriched.doctorName = userDataMap.get(caseItem.assignedDoctors.primary).name;
    } else if (caseItem.assignedDoctors?.primaryName) {
      enriched.doctorName = caseItem.assignedDoctors.primaryName;
    }

    if (caseItem.pharmacistId && userDataMap.has(caseItem.pharmacistId)) {
      enriched.pharmacistName = userDataMap.get(caseItem.pharmacistId).name;
    }

    // Get partner name
    if (!enriched.partnerName && caseItem.createdBy && userDataMap.has(caseItem.createdBy)) {
      enriched.partnerName = userDataMap.get(caseItem.createdBy).partnerName;
    }

    // Set status label
    if (caseItem.isIncomplete === true) {
      enriched.statusLabel = "Incomplete";
    } else if (caseItem.pharmacistCompleted) {
      enriched.statusLabel = "Completed";
    } else {
      enriched.statusLabel = "Pending";
    }

    return enriched;
  });
};

// OPTIMIZATION 12: Cache cleanup utility
export const clearCaches = () => {
  clinicMappingCache.clear();
  userDataCache.clear();
  partnersCache = null;
  cacheTimestamp = 0;
};
