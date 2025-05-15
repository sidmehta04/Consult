import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestore } from "../../firebase";

export const fetchCounts = async (query) => {
  const snapshot = await getDocs(query);
  var count = 0;
  snapshot.forEach((doc) => {
    if (doc.data().emrNumbers && doc.data().emrNumbers.length > 0) {
      count += doc.data().emrNumbers.length;
    } else {
      count += 1;
    }
  });
  return {count: count};
}

export const getCount = () => {
  
}

// Fetch user hierarchy based on reporting relationships
export const fetchUserHierarchy = async (userId, userRole) => {
  try {
    const userIds = new Set([userId]); // Include the manager's own ID
    const processedIds = new Set();

    // First, find all users directly reporting to this manager
    // This uses the "reportingTo" field instead of "createdBy"
    const directReportsQuery = query(
      collection(firestore, "users"),
      where("reportingTo", "==", userId)
    );

    const directReportsSnapshot = await getDocs(directReportsQuery);

    // Add direct reports to the set
    directReportsSnapshot.forEach((doc) => {
      userIds.add(doc.id);
    });

    // For team leaders and drManagers, we need to handle special hierarchies
    if (userRole === "drManager") {
      // For drManagers, find all doctors reporting to them
      const doctorQuery = query(
        collection(firestore, "users"),
        where("reportingTo", "==", userId),
        where("role", "==", "doctor")
      );

      const doctorSnapshot = await getDocs(doctorQuery);
      const doctorIds = [];

      doctorSnapshot.forEach((doc) => {
        doctorIds.push(doc.id);
        userIds.add(doc.id);
      });

      // For each doctor, get their assigned clinics
      for (const doctorId of doctorIds) {
        const doctorRef = doc(firestore, "users", doctorId);
        const doctorSnap = await getDoc(doctorRef);

        if (doctorSnap.exists() && doctorSnap.data().assignedClinics) {
          // Add clinic IDs to the userIds set
          Object.keys(doctorSnap.data().assignedClinics).forEach((clinicId) => {
            if (doctorSnap.data().assignedClinics[clinicId] === true) {
              userIds.add(clinicId);
            }
          });
        }
      }
    } else if (userRole === "teamLeader") {
      // For teamLeaders, find ROs reporting to them
      const roQuery = query(
        collection(firestore, "users"),
        where("reportingTo", "==", userId),
        where("role", "==", "ro")
      );

      const roSnapshot = await getDocs(roQuery);
      const roIds = [];

      roSnapshot.forEach((doc) => {
        roIds.push(doc.id);
        userIds.add(doc.id);
      });

      // For each RO, find their pharmacists
      for (const roId of roIds) {
        const pharmacistQuery = query(
          collection(firestore, "users"),
          where("reportingTo", "==", roId),
          where("role", "==", "pharmacist")
        );

        const pharmacistSnapshot = await getDocs(pharmacistQuery);
        const pharmacistIds = [];

        pharmacistSnapshot.forEach((doc) => {
          pharmacistIds.push(doc.id);
          userIds.add(doc.id);
        });

        // For each pharmacist, find their clinics (nurses)
        for (const pharmacistId of pharmacistIds) {
          const clinicQuery = query(
            collection(firestore, "users"),
            where("reportingTo", "==", pharmacistId),
            where("role", "==", "nurse")
          );

          const clinicSnapshot = await getDocs(clinicQuery);
          clinicSnapshot.forEach((doc) => {
            userIds.add(doc.id);
          });
        }
      }
    } else if (userRole === "ro") {
      // For ROs, find pharmacists reporting to them
      const pharmacistQuery = query(
        collection(firestore, "users"),
        where("reportingTo", "==", userId),
        where("role", "==", "pharmacist")
      );

      const pharmacistSnapshot = await getDocs(pharmacistQuery);
      const pharmacistIds = [];

      pharmacistSnapshot.forEach((doc) => {
        pharmacistIds.push(doc.id);
        userIds.add(doc.id);
      });

      // For each pharmacist, find their clinics
      for (const pharmacistId of pharmacistIds) {
        const clinicQuery = query(
          collection(firestore, "users"),
          where("reportingTo", "==", pharmacistId),
          where("role", "==", "nurse")
        );

        const clinicSnapshot = await getDocs(clinicQuery);
        clinicSnapshot.forEach((doc) => {
          userIds.add(doc.id);
        });
      }
    }


    return {
      
      userIds: userIds,

      hierarchyDepth:
        userRole === "teamLeader" ? 3 : userRole === "drManager" ? 2 : 1,
    };

  } catch (error) {
    console.error("Error fetching user hierarchy:", error);
    // Return just the user's own ID as fallback
    return {
      userIds: new Set([userId]),
      hierarchyDepth: 0,
    };
  }
};

export const fetchSummaryData = async (userId, userRole) => {
  try {
    // For quick summary, we'll just fetch counts instead of full data
    const summaryData = {
      totalCases: 0,
      pendingCases: 0,
      completedCases: 0,
      doctorPendingCases: 0,
      pharmacistPendingCases: 0,
      incompleteCases: 0,
    };

    // Use batch/parallel queries instead of sequential ones
    const queries = [];
    const casesRef = collection(firestore, "cases");

    if (userRole === "doctor") {
      // For doctors, we only need one query
      const doctorCasesQuery = query(
        casesRef,
        where("assignedDoctors.primary", "==", userId),
        limit(100) // Reduced from 1000 to 100 for faster response
      );

      queries.push(fetchCounts(doctorCasesQuery));
    } else {
      // For other roles, use parallel queries with smaller limits
      queries.push(
        fetchCounts(
          query(casesRef, orderBy("createdAt", "desc"), limit(100))
        )
      );

      queries.push(
        fetchCounts(
          query(casesRef, where("pharmacistCompleted", "==", true), limit(100))
        )
      );

      queries.push(
        fetchCounts(
          query(casesRef, where("isIncomplete", "==", true), limit(100))
        )
      );

      queries.push(
        fetchCounts(
          query(casesRef, where("doctorCompleted", "==", false), limit(100))
        )
      );

      queries.push(
        fetchCounts(
          query(
            casesRef,
            where("doctorCompleted", "==", true),
            where("pharmacistCompleted", "==", false),
            limit(100)
          )
        )
      );
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries);

    if (userRole === "doctor") {
      // For doctors, estimate from the single query result
      summaryData.totalCases = results[0].count;

      // Use better estimation factors based on your actual data patterns
      summaryData.pendingCases = Math.round(summaryData.totalCases * 0.3);
      summaryData.completedCases = Math.round(summaryData.totalCases * 0.6);
      summaryData.doctorPendingCases = Math.round(
        summaryData.totalCases * 0.15
      );
      summaryData.pharmacistPendingCases = Math.round(
        summaryData.totalCases * 0.15
      );
      summaryData.incompleteCases = Math.round(summaryData.totalCases * 0.1);
    } else {
      // For other roles, use the actual parallel query results
      summaryData.totalCases = results[0].count;
      summaryData.completedCases = results[1].count;
      summaryData.incompleteCases = results[2].count;
      summaryData.doctorPendingCases = results[3].count;
      summaryData.pharmacistPendingCases = results[4].count;
      summaryData.pendingCases =
        summaryData.doctorPendingCases + summaryData.pharmacistPendingCases;
    }

    return {
      summaryData,
      cases: [],
      uniquePartners: [],
      uniqueClinics: [],
    };
  } catch (error) {
    console.error("Error fetching summary data:", error);
    return {
      summaryData: {
        totalCases: 0,
        pendingCases: 0,
        completedCases: 0,
        doctorPendingCases: 0,
        pharmacistPendingCases: 0,
        incompleteCases: 0,
      },
      cases: [],
      uniquePartners: [],
      uniqueClinics: [],
    };
  }
};

// Add this function to your datafetcher.js file

// Add this function to your datafetcher.js file

// Add this function to your datafetcher.js file

export const fetchTodaySummaryData = async (userId, userRole) => {
  try {
    // Set up today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // For quick summary, we'll fetch docs instead of using count aggregation
    const summaryData = {
      totalCases: 0,
      pendingCases: 0,
      completedCases: 0,
      doctorPendingCases: 0,
      pharmacistPendingCases: 0,
      incompleteCases: 0,
    };

    const casesRef = collection(firestore, "cases");
    let todayCases = [];

    // For hierarchy roles, use hierarchy-based filtering like the regular dashboard
    if (["teamLeader", "drManager", "ro"].includes(userRole)) {
      // Get all users in the hierarchy
      const hierarchyData = await fetchUserHierarchy(userId, userRole);
      const userIds = Array.from(hierarchyData.userIds);
      
      // First, just get today's cases for all users in the hierarchy
      const batchPromises = [];
      
      for (const uid of userIds) {
        const todayQuery = query(
          casesRef,
          where("createdBy", "==", uid),
          where("createdAt", ">=", today),
          where("createdAt", "<", tomorrow),
          limit(1000) // High limit to get all cases for the day
        );
        
        batchPromises.push(getDocs(todayQuery));
      }
      
      // Wait for all queries
      const queryResults = await Promise.all(batchPromises);
      
      // Process the results
      queryResults.forEach(snapshot => {
        snapshot.forEach(doc => {
          todayCases.push(doc.data());
        });
      });
    } else if (userRole === "doctor") {
      // For doctors, only show cases assigned to them
      const todayQuery = query(
        casesRef,
        where("assignedDoctors.primary", "==", userId),
        where("createdAt", ">=", today),
        where("createdAt", "<", tomorrow),
        limit(1000)
      );
      
      const snapshot = await getDocs(todayQuery);
      snapshot.forEach(doc => {
        todayCases.push(doc.data());
      });
    } else if (userRole === "pharmacist") {
      // For pharmacists, only show cases assigned to them
      const todayQuery = query(
        casesRef,
        where("pharmacistId", "==", userId),
        where("createdAt", ">=", today),
        where("createdAt", "<", tomorrow),
        limit(1000)
      );
      
      const snapshot = await getDocs(todayQuery);
      snapshot.forEach(doc => {
        todayCases.push(doc.data());
      });
    } else if (["clinic", "nurse"].includes(userRole)) {
      // For clinics/nurses, only show cases they created
      const todayQuery = query(
        casesRef,
        where("createdBy", "==", userId),
        where("createdAt", ">=", today),
        where("createdAt", "<", tomorrow),
        limit(1000)
      );
      
      const snapshot = await getDocs(todayQuery);
      snapshot.forEach(doc => {
        todayCases.push(doc.data());
      });
    } else if (["superAdmin", "zonalHead"].includes(userRole)) {
      // For admins, show all cases
      const todayQuery = query(
        casesRef,
        where("createdAt", ">=", today),
        where("createdAt", "<", tomorrow),
        limit(1000)
      );
      
      const snapshot = await getDocs(todayQuery);
      snapshot.forEach(doc => {
        todayCases.push(doc.data());
      });
    } else {
      // Default fallback - only show user's own cases
      const todayQuery = query(
        casesRef,
        where("createdBy", "==", userId),
        where("createdAt", ">=", today),
        where("createdAt", "<", tomorrow),
        limit(1000)
      );
      
      const snapshot = await getDocs(todayQuery);
      snapshot.forEach(doc => {
        todayCases.push(doc.data());
      });
    }
    
    // Calculate counts from fetched documents
    summaryData.totalCases = todayCases.length;
    
    // Count by status
    todayCases.forEach(caseData => {
      if(caseData.emrNumbers && caseData.emrNumbers.length > 0){
        //console.log("caseData.emrNumbers", caseData.emrNumbers, caseData.emrNumbers.length);
        if (caseData.isIncomplete || caseData.status === "doctor_incomplete") {
          summaryData.incompleteCases+= caseData.emrNumbers.length;
        } else if (caseData.doctorCompleted && caseData.pharmacistCompleted) {
          summaryData.completedCases+= caseData.emrNumbers.length;
        } else if (!caseData.doctorCompleted) {
          summaryData.doctorPendingCases+= caseData.emrNumbers.length;
        } else if (!caseData.pharmacistCompleted) {
          summaryData.pharmacistPendingCases+= caseData.emrNumbers.length;
        }
      } else {
        if (caseData.isIncomplete || caseData.status === "doctor_incomplete") {
          summaryData.incompleteCases++;
        } else if (caseData.doctorCompleted && caseData.pharmacistCompleted) {
          summaryData.completedCases++;
        } else if (!caseData.doctorCompleted) {
          summaryData.doctorPendingCases++;
        } else if (!caseData.pharmacistCompleted) {
          summaryData.pharmacistPendingCases++;
        }
      }
    });
    
    // Calculate total pending
    summaryData.pendingCases = 
      summaryData.doctorPendingCases + summaryData.pharmacistPendingCases;

    return {
      summaryData,
      cases: todayCases,
      uniquePartners: [],
      uniqueClinics: [],
    };
  } catch (error) {
    console.error("Error fetching today's summary data:", error);
    return {
      summaryData: {
        totalCases: 0,
        pendingCases: 0,
        completedCases: 0,
        doctorPendingCases: 0,
        pharmacistPendingCases: 0,
        incompleteCases: 0,
      },
      cases: [],
      uniquePartners: [],
      uniqueClinics: [],
    };
  }
};
export const fetchTabData = async (
  userId,
  userRole,
  tabName,
  filters = {},
  pagination = { page: 1, pageSize: 50, lastDoc: null } // Increased pageSize
) => {
  try {
    let casesQuery;
    const casesRef = collection(firestore, "cases");

    // First, build hierarchy-based access control
    // Each role can only see specific cases
    let hierarchyConstraints = [];

    switch (userRole) {
      case "superAdmin":
      case "zonalHead":
        // Can see all cases - no constraints needed
        break;

      case "teamLeader":
      case "drManager":
      case "ro":
        // For these roles, we'll use the fetchUserHierarchy function
        // to get all users in their hierarchy, and then fetch cases
        // for each of those users
        const hierarchyData = await fetchUserHierarchy(userId, userRole);
        const userIds = Array.from(hierarchyData.userIds);

        // Use the special function for fetching cases from multiple users
        return await fetchCasesForMultipleUsers(
          userIds,
          tabName,
          filters,
          pagination
        );

      case "doctor":
        // Doctors can only see cases assigned to them
        hierarchyConstraints.push(
          where("assignedDoctors.primary", "==", userId)
        );
        break;

      case "pharmacist":
        // Pharmacists can only see cases assigned to them
        hierarchyConstraints.push(where("pharmacistId", "==", userId));
        break;

      case "clinic":
      case "nurse":
        // Clinics/nurses can only see cases they created
        hierarchyConstraints.push(where("createdBy", "==", userId));
        break;

      default:
        // Default to showing only user's own cases for safety
        hierarchyConstraints.push(where("createdBy", "==", userId));
    }

    // Next, build tab-specific query constraints
    let tabConstraints = [];

    switch (tabName) {
      case "doctor":
        tabConstraints = [
          where("doctorCompleted", "==", false),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"), // Required for the previous where clause
          orderBy("createdAt", "desc"),
        ];
        break;

      case "pharmacist":
        tabConstraints = [
          where("doctorCompleted", "==", true),
          where("pharmacistCompleted", "==", false),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"), // Required for the previous where clause
          orderBy("createdAt", "desc"),
        ];
        break;

      case "completed":
        tabConstraints = [
          where("pharmacistCompleted", "==", true),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"), // Required for the previous where clause
          orderBy("createdAt", "desc"),
        ];
        break;

      case "incomplete":
        tabConstraints = [
          where("isIncomplete", "==", true),
          orderBy("createdAt", "desc"),
        ];
        break;

      case "all":
      default:
        tabConstraints = [orderBy("createdAt", "desc")];
        break;
    }

    // Add pagination support using startAfter
    let paginatedQuery;
    const pageSize = pagination.pageSize || 50; // Increased from 20 to 50

    // Create combined query with both hierarchy and tab constraints
    if (hierarchyConstraints.length === 0) {
      // For pagination
      if (pagination.lastDoc && pagination.page > 1) {
        paginatedQuery = query(
          casesRef,
          ...tabConstraints,
          startAfter(pagination.lastDoc),
          limit(pageSize)
        );
      } else {
        paginatedQuery = query(casesRef, ...tabConstraints, limit(pageSize));
      }
    } else {
      // For roles with hierarchy constraints
      if (pagination.lastDoc && pagination.page > 1) {
        paginatedQuery = query(
          casesRef,
          ...hierarchyConstraints,
          ...tabConstraints,
          startAfter(pagination.lastDoc),
          limit(pageSize)
        );
      } else {
        paginatedQuery = query(
          casesRef,
          ...hierarchyConstraints,
          ...tabConstraints,
          limit(pageSize)
        );
      }
    }

    // Execute the query for roles other than teamLeader, drManager, ro
    const querySnapshot = await getDocs(paginatedQuery);

    // Process results
    const cases = [];
    const processedCaseIds = new Set();
    const uniquePartners = new Set();
    const uniqueClinics = new Set();

    querySnapshot.forEach((doc) => {
      const caseId = doc.id;

      // Skip if already processed
      if (processedCaseIds.has(caseId)) return;
      processedCaseIds.add(caseId);

      const caseData = { ...doc.data(), id: caseId };

      // Special handling for incomplete tab
      if (tabName === "incomplete") {
        // If we're on the incomplete tab, make sure we only include actual incomplete cases
        if (!caseData.isIncomplete && caseData.status !== "doctor_incomplete") {
          return; // Skip this case if it's not truly incomplete
        }
      }

      // Apply filters if specified, but don't automatically filter by date
      // unless explicitly requested in the filters
      if (shouldIncludeCase(caseData, filters)) {
        // Add clinic and partner to unique sets
        if (caseData.partnerName) uniquePartners.add(caseData.partnerName);
        if (caseData.clinicCode || caseData.clinicName) {
          uniqueClinics.add(caseData.clinicCode || caseData.clinicName);
        }

        // Process case data
        cases.push({
          id: caseId,
          ...caseData,
          createdAt: caseData.createdAt?.toDate() || new Date(),
          updatedAt: caseData.updatedAt?.toDate() || new Date(),
          startTime: caseData.startTime?.toDate() || null,
          endTime: caseData.endTime?.toDate() || null,
          doctorCompletedAt: caseData.doctorCompletedAt?.toDate() || null,
          pharmacistCompletedAt:
            caseData.pharmacistCompletedAt?.toDate() || null,
          pendingQueue: determinePendingQueue(caseData),
        });
      }
    });

    // Enrich cases with user data
    const enrichedCases = await enrichCasesWithUserData(cases);

    // Get the last visible document for pagination
    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

    return {
      cases: enrichedCases,
      uniquePartners: Array.from(uniquePartners),
      uniqueClinics: Array.from(uniqueClinics),
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
      pagination: {
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 50, // Increased from 20 to 50
        hasMore: false,
      },
    };
  }
};

// Modified helper function to not automatically filter by date
const shouldIncludeCase = (caseData, filters) => {
  // If no filters, include all cases
  if (!filters || Object.keys(filters).length === 0) return true;

  // Status filter
  if (filters.status) {
    if (
      filters.status === "completed" &&
      (!caseData.doctorCompleted ||
        !caseData.pharmacistCompleted ||
        caseData.isIncomplete)
    )
      return false;
    if (
      filters.status === "pending" &&
      ((caseData.doctorCompleted && caseData.pharmacistCompleted) ||
        caseData.isIncomplete)
    )
      return false;
    if (
      filters.status === "incomplete" &&
      !caseData.isIncomplete &&
      caseData.status !== "doctor_incomplete"
    )
      return false;
  }

  // Partner filter
  if (filters.partner && caseData.partnerName !== filters.partner) {
    return false;
  }

  // Clinic filter
  if (filters.clinic) {
    const clinicCode = caseData.clinicCode || caseData.clinicName;
    if (clinicCode !== filters.clinic) return false;
  }

  // Date range filter - only apply if explicitly provided
  if (filters.dateFrom || filters.dateTo) {
    const caseDate = caseData.createdAt?.toDate
      ? caseData.createdAt.toDate()
      : caseData.createdAt instanceof Date
      ? caseData.createdAt
      : new Date();

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      if (caseDate < fromDate) return false;
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of the day
      if (caseDate > toDate) return false;
    }
  }

  // EMR number search - improved handling

  // TODO: over here handle array
  if (filters.searchTerm && filters.searchTerm.trim() !== "") {
    const searchTerm = filters.searchTerm.toLowerCase().trim();

    if (searchTerm.length > 0) {
      // Check all possible EMR-related fields
      const possibleEmrFields = [
        "emrNumber",
        "emrNumbers",
        "EMRNumber",
        "emr_number",
        "caseNumber",
        "id",
      ];

      // Exact matching - check all fields
      const matchFound = possibleEmrFields.some((fieldName) => {
        // Skip undefined fields
        if (!caseData[fieldName]) return false;

        // Handle string fields (most common)
        if (typeof caseData[fieldName] === "string") {
          return caseData[fieldName].toLowerCase() === searchTerm;
        }

        // Handle number fields
        if (typeof caseData[fieldName] === "number") {
          return caseData[fieldName].toString() === searchTerm;
        }

        // Handle array fields
        if (Array.isArray(caseData[fieldName])) {
          //console.log("searching in array", caseData[fieldName]);
          return caseData[fieldName].some((item) => {
            if (typeof item === "string") {
              //console.log("item", item, searchTerm, typeof(searchTerm));
              return item.toLowerCase() === searchTerm;
            } else if (typeof item === "number") {
              return item.toString() === searchTerm;
            }
            return false; // Skip non-string/number items
          })
        }

        return false;
      });

      // Only include if we found a match
      return matchFound;
    }
  }

  // If we got here, all filters passed
  return true;
};
// Fixed function to load cases for all users in hierarchy without date restriction
async function fetchCasesForMultipleUsers(
  userIds,
  tabName,
  filters = {},
  pagination = { page: 1, pageSize: 50, lastDoc: null }
) {
  const cases = [];
  const processedCaseIds = new Set();
  const uniquePartners = new Set();
  const uniqueClinics = new Set();
  const maxCasesToFetch = pagination.pageSize || 50; // Increased from 20 to 50

  // Convert userIds from Set to Array if needed
  const userIdsArray = Array.isArray(userIds) ? userIds : Array.from(userIds);

  // Process ALL users in the hierarchy instead of just a slice
  // This ensures we get cases from all users under the manager

  // Create batch queries for all users at once
  const queryPromises = [];

  for (const userId of userIdsArray) {
    const casesRef = collection(firestore, "cases");
    let userQuery;

    // For each user, check cases where they are the creator
    switch (tabName) {
      case "doctor":
        userQuery = query(
          casesRef,
          where("createdBy", "==", userId),
          where("doctorCompleted", "==", false),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"),
          orderBy("createdAt", "desc"),
          limit(maxCasesToFetch)
        );
        break;

      case "pharmacist":
        userQuery = query(
          casesRef,
          where("createdBy", "==", userId),
          where("doctorCompleted", "==", true),
          where("pharmacistCompleted", "==", false),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"),
          orderBy("createdAt", "desc"),
          limit(maxCasesToFetch)
        );
        break;

      case "completed":
        userQuery = query(
          casesRef,
          where("createdBy", "==", userId),
          where("pharmacistCompleted", "==", true),
          where("isIncomplete", "!=", true),
          orderBy("isIncomplete"),
          orderBy("createdAt", "desc"),
          limit(maxCasesToFetch)
        );
        break;

      case "incomplete":
        userQuery = query(
          casesRef,
          where("createdBy", "==", userId),
          where("isIncomplete", "==", true),
          orderBy("createdAt", "desc"),
          limit(maxCasesToFetch)
        );
        break;

      case "all":
      default:
        userQuery = query(
          casesRef,
          where("createdBy", "==", userId),
          orderBy("createdAt", "desc"),
          limit(maxCasesToFetch)
        );
        break;
    }

    // Add to promises array
    queryPromises.push(getDocs(userQuery));
  }

  // Execute all queries in parallel
  const queryResults = await Promise.all(queryPromises);

  // Process all results
  queryResults.forEach((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      const caseId = doc.id;

      // Skip if already processed to avoid duplicates
      if (processedCaseIds.has(caseId)) return;
      processedCaseIds.add(caseId);

      const caseData = doc.data();

      // IMPORTANT: Remove today-only filtering to show ALL cases
      // Only apply date filtering if explicitly provided in filters
      const shouldIncludeByDate =
        filters.dateFrom || filters.dateTo
          ? isWithinDateRange(
              caseData.createdAt?.toDate() || new Date(),
              filters.dateFrom,
              filters.dateTo
            )
          : true;

      if (!shouldIncludeByDate) return;

      // Apply filters if specified
      if (shouldIncludeCase(caseData, filters)) {
        // Add clinic and partner to unique sets
        if (caseData.partnerName) uniquePartners.add(caseData.partnerName);
        if (caseData.clinicCode || caseData.clinicName) {
          uniqueClinics.add(caseData.clinicCode || caseData.clinicName);
        }

        // Process case data
        cases.push({
          id: caseId,
          ...caseData,
          createdAt: caseData.createdAt?.toDate() || new Date(),
          updatedAt: caseData.updatedAt?.toDate() || new Date(),
          startTime: caseData.startTime?.toDate() || null,
          endTime: caseData.endTime?.toDate() || null,
          doctorCompletedAt: caseData.doctorCompletedAt?.toDate() || null,
          pharmacistCompletedAt:
            caseData.pharmacistCompletedAt?.toDate() || null,
          pendingQueue: determinePendingQueue(caseData),
        });
      }
    });
  });

  // Sort combined results by date (newest first)
  cases.sort((a, b) => b.createdAt - a.createdAt);

  // Take only the requested page size
  const paginatedCases = cases.slice(0, maxCasesToFetch);

  // Enrich cases with user data
  const enrichedCases = await enrichCasesWithUserData(paginatedCases);

  return {
    cases: enrichedCases,
    uniquePartners: Array.from(uniquePartners),
    uniqueClinics: Array.from(uniqueClinics),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore: cases.length > maxCasesToFetch,
      // Store the last doc info for efficient pagination
      lastDoc:
        paginatedCases.length > 0
          ? paginatedCases[paginatedCases.length - 1].createdAt
          : null,
    },
  };
}

// Helper function to check if a date is within a specified range
function isWithinDateRange(date, fromDate, toDate) {
  if (!fromDate && !toDate) return true;

  if (fromDate) {
    const from = new Date(fromDate);
    if (date < from) return false;
  }

  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999); // End of the day
    if (date > to) return false;
  }

  return true;
}
// Helper to determine which queue a case is pending in
const determinePendingQueue = (caseData) => {
  if (caseData.isIncomplete || caseData.status === "doctor_incomplete") {
    return "incomplete";
  } else if (caseData.doctorCompleted && caseData.pharmacistCompleted) {
    return "completed";
  } else if (!caseData.doctorCompleted) {
    return "doctor";
  } else {
    return "pharmacist";
  }
};

const enrichCasesWithUserData = async (cases) => {
  // If we have no cases, return empty array
  if (!cases.length) return [];

  // Create a set of essential ids for faster lookups
  const essentialUserIds = new Set();
  const clinicIds = new Set();

  // Only add essential user IDs to reduce total users to be fetched
  cases.forEach((caseItem) => {
    // Only add primary ids that are most likely needed
    if (caseItem.doctorId) essentialUserIds.add(caseItem.doctorId);
    if (caseItem.pharmacistId) essentialUserIds.add(caseItem.pharmacistId);
    if (caseItem.createdBy) essentialUserIds.add(caseItem.createdBy);
    if (caseItem.clinicId) clinicIds.add(caseItem.clinicId);

    // Only check assignedDoctors.primary for efficiency
    if (caseItem.assignedDoctors?.primary) {
      essentialUserIds.add(caseItem.assignedDoctors.primary);
    }
  });

  // Create a map to store user data
  const userDataMap = new Map();

  // Batch fetch user data with fewer, larger batches
  const batchSize = 20; // Increased from 10 to 20
  const userIdsArray = Array.from(essentialUserIds);

  // Use a single batch operation when possible
  if (userIdsArray.length <= 20) {
    // For small sets, use a single batch
    const promises = userIdsArray.map((userId) =>
      getDoc(doc(firestore, "users", userId))
    );
    const snapshots = await Promise.all(promises);

    snapshots.forEach((snap, index) => {
      if (snap.exists()) {
        const userData = snap.data();
        userDataMap.set(userIdsArray[index], {
          name: userData.name,
          role: userData.role,
          partnerName: userData.partnerName || "N/A",
        });
      }
    });
  } else {
    // For larger sets, use multiple batches
    for (let i = 0; i < userIdsArray.length; i += batchSize) {
      const batch = userIdsArray.slice(i, i + batchSize);
      const promises = batch.map((userId) =>
        getDoc(doc(firestore, "users", userId))
      );
      const snapshots = await Promise.all(promises);

      snapshots.forEach((snap, index) => {
        if (snap.exists()) {
          const userData = snap.data();
          userDataMap.set(batch[index], {
            name: userData.name,
            role: userData.role,
            partnerName: userData.partnerName || "N/A",
          });
        }
      });
    }
  }

  // Similarly optimize clinic data fetching
  const clinicDataMap = new Map();
  const clinicIdsArray = Array.from(clinicIds);

  if (clinicIdsArray.length <= 20) {
    const promises = clinicIdsArray.map((clinicId) =>
      getDoc(doc(firestore, "users", clinicId))
    );
    const snapshots = await Promise.all(promises);

    snapshots.forEach((snap, index) => {
      if (snap.exists()) {
        const clinicData = snap.data();
        clinicDataMap.set(clinicIdsArray[index], {
          name: clinicData.name,
          clinicCode: clinicData.clinicCode || "Unknown",
          partnerName: clinicData.partnerName || "N/A",
        });
      }
    });
  } else {
    for (let i = 0; i < clinicIdsArray.length; i += batchSize) {
      const batch = clinicIdsArray.slice(i, i + batchSize);
      const promises = batch.map((clinicId) =>
        getDoc(doc(firestore, "users", clinicId))
      );
      const snapshots = await Promise.all(promises);

      snapshots.forEach((snap, index) => {
        if (snap.exists()) {
          const clinicData = snap.data();
          clinicDataMap.set(batch[index], {
            name: clinicData.name,
            clinicCode: clinicData.clinicCode || "Unknown",
            partnerName: clinicData.partnerName || "N/A",
          });
        }
      });
    }
  }

  // Add user data to each case
  return cases.map((caseItem) => {
    const enrichedCase = { ...caseItem };

    // Set start time as createdAt
    enrichedCase.startTime = caseItem.createdAt;

    // Set end time as pharmacistCompletedAt if available
    if (caseItem.pharmacistCompletedAt) {
      enrichedCase.endTime = caseItem.pharmacistCompletedAt;
    }

    // Get clinic code from clinicId
    if (caseItem.clinicId && clinicDataMap.has(caseItem.clinicId)) {
      enrichedCase.clinicCode = clinicDataMap.get(caseItem.clinicId).clinicCode;
    }

    if (caseItem.createdBy && userDataMap.has(caseItem.createdBy)) {
      enrichedCase.createdByName = userDataMap.get(caseItem.createdBy).name;
    }

    if (caseItem.assignedTo && userDataMap.has(caseItem.assignedTo)) {
      enrichedCase.assignedToName = userDataMap.get(caseItem.assignedTo).name;
    }

    // Get doctor name from assignedDoctors if available
    if (
      caseItem.assignedDoctors &&
      caseItem.assignedDoctors.primary &&
      userDataMap.has(caseItem.assignedDoctors.primary)
    ) {
      enrichedCase.doctorName = userDataMap.get(
        caseItem.assignedDoctors.primary
      ).name;
    } else if (caseItem.assignedDoctors?.primaryName) {
      enrichedCase.doctorName = caseItem.assignedDoctors.primaryName;
    }

    if (caseItem.pharmacistId && userDataMap.has(caseItem.pharmacistId)) {
      enrichedCase.pharmacistName = userDataMap.get(caseItem.pharmacistId).name;
    }

    // Get partner name either from case directly or from creator
    if (
      !enrichedCase.partnerName &&
      caseItem.createdBy &&
      userDataMap.has(caseItem.createdBy)
    ) {
      enrichedCase.partnerName = userDataMap.get(
        caseItem.createdBy
      ).partnerName;
    }

    // Update case status based on completion
    if (caseItem.isIncomplete === true) {
      enrichedCase.statusLabel = "Incomplete";
    } else if (caseItem.pharmacistCompleted) {
      enrichedCase.statusLabel = "Completed";
    } else {
      enrichedCase.statusLabel = "Pending";
    }

    return enrichedCase;
  });
};
