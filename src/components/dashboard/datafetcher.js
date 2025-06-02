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
} from "firebase/firestore";
import { firestore } from "../../firebase";

export const fetchCounts = async (partnerName, clinicMapping, query) => {
  const snapshot = await getDocs(query);
  const counts = await getCountFromServer(query)
  var count = 0;
  snapshot.forEach((doc) => {
    if (partnerName) {
      const clinicInfo = clinicMapping.get(doc.data().clinicId);
      if (clinicInfo && clinicInfo.partnerName === partnerName){
        if (doc.data().emrNumbers && doc.data().emrNumbers.length > 0) {
          count += doc.data().emrNumbers.length;
        } else {
          count += 1;
        }
      }
    } else {
      if (doc.data().emrNumbers && doc.data().emrNumbers.length > 0) {
        count += doc.data().emrNumbers.length;
      } else {
        count += 1;
      }
    }
  });
  return {count: count};
}


export const fetchTabData = async (
  userId,
  userRole,
  tabName,
  filters = {},
  pagination = { page: 1, pageSize: 50, lastDoc: null }, // Increased pageSize
  clinicMapping
) => {
  //console.log(clinicMapping)
  try {
    let casesQuery;
    const casesRef = collection(firestore, "cases");

    // First, build hierarchy-based access control
    // Each role can only see specific cases
    let hierarchyConstraints = [];

    switch (userRole) {
      case "superAdmin":
      case "zonalHead":
      case "teamLeader":
      case "drManager":
      case "ro":
        // Can see all cases - no constraints needed
        break;

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
          where("status", "==", 'pending'),
          where("doctorCompleted", "==", false),
          where("isIncomplete", "!=", true),
          orderBy("createdAt", "desc"),          
        ];
        break;

      case "pharmacist":
        tabConstraints = [
          where("status", "==", 'doctor_completed'),
       
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
    const uniqueDoctors = new Set();

    console.log(filters)
    querySnapshot.forEach((doc) => {
      const caseId = doc.id;

      // Skip if already processed
      if (processedCaseIds.has(caseId)) return;
      processedCaseIds.add(caseId);

      const caseData = { ...doc.data(), id: caseId };

      // Special handling for incomplete tab
      if (tabName === "incomplete") {
        // If we're on the incomplete tab, make sure we only include actual incomplete cases
        if (!caseData.isIncomplete && caseData.status !== "doctor_incomplete" && caseData.status !== "pharmacist_incomplete") {
          return; // Skip this case if it's not truly incomplete
        }
      }

      // Apply filters if specified, but don't automatically filter by date
      // unless explicitly requested in the filters
      if (shouldIncludeCase(caseData, filters, clinicMapping)) {
        // Add clinic and partner to unique sets
        if (caseData.partnerName) uniquePartners.add(caseData.partnerName);
        if (caseData.clinicCode || caseData.clinicName) {
          uniqueClinics.add(caseData.clinicCode || caseData.clinicName);
        }
        if (caseData.assignedDoctors.primaryName) uniqueDoctors.add(caseData.assignedDoctors.primaryName);

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
    const enrichedCases = await enrichCasesWithUserData(cases, clinicMapping);
    //const enrichedCases = cases;

    // Get the last visible document for pagination
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
        pageSize: pagination.pageSize || 50, // Increased from 20 to 50
        hasMore: false,
      },
    };
  }
};

// Modified helper function to not automatically filter by date
const shouldIncludeCase = (caseData, filters, clinicMapping) => {
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
      caseData.status !== "doctor_incomplete" &&
      caseData.status !== "pharmacist_incomplete"
    )
      return false;
  }

  // Partner filter
  if (filters.partner && !filters.partner.includes(clinicMapping.get(caseData.clinicId).partnerName)) {
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

const determinePendingQueue = (caseData) => {
  if (caseData.isIncomplete || caseData.status === "doctor_incomplete" || caseData.status === "pharmacist_incomplete") {
    return "incomplete";
  } else if (caseData.doctorCompleted && caseData.pharmacistCompleted) {
    return "completed";
  } else if (!caseData.doctorCompleted) {
    return "doctor";
  } else {
    return "pharmacist";
  }
};

// Memoized helper to calculate contribution of a single case
export const calculateCaseContribution = (caseData, todayEpoch, tomorrowEpoch, partnerName, clinicMapping) => {
  const contribution = {
    totalCases: 0, pendingCases: 0, completedCases: 0, doctorPendingCases: 0,
    pharmacistPendingCases: 0, incompleteCases: 0, todayCases: 0,
    todayCompleted: 0, todayIncomplete: 0,
  };

  if (partnerName !== clinicMapping.get(caseData.clinicId).partnerName){
    return contribution
  }


  const len = (caseData.emrNumbers && caseData.emrNumbers.length > 0) ? caseData.emrNumbers.length : 1;
  contribution.totalCases = len;

  let isToday = false;
  if (caseData.completedAt && typeof caseData.completedAt.seconds === 'number') {
    const tstamp = caseData.completedAt.seconds;
    isToday = todayEpoch <= tstamp && tstamp < tomorrowEpoch;
  }

  if (isToday) contribution.todayCases = (contribution.todayCases || 0) + len;

  if (caseData.isIncomplete || caseData.status === "doctor_incomplete" || caseData.status === "pharmacist_incomplete") {
    contribution.incompleteCases = (contribution.incompleteCases || 0) + len;
    if (isToday) contribution.todayIncomplete = (contribution.todayIncomplete || 0) + len;
  } else if (caseData.doctorCompleted && caseData.pharmacistCompleted) {
    contribution.completedCases = (contribution.completedCases || 0) + len;
    if (isToday) contribution.todayCompleted = (contribution.todayCompleted || 0) + len;
  } else if (!caseData.doctorCompleted) {
    contribution.doctorPendingCases = (contribution.doctorPendingCases || 0) + len;
  } else if (!caseData.pharmacistCompleted) {
    contribution.pharmacistPendingCases = (contribution.pharmacistPendingCases || 0) + len;
  }
  // Derived pending cases
  contribution.pendingCases = (contribution.doctorPendingCases || 0) + (contribution.pharmacistPendingCases || 0);
  return contribution;
};

export const getClinicMapping = async () => {//at start, get mapping of all clinics
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
    })

    uniquePartners.add(data.partnerName)
  });
  
  return [clinicDataMap, Array.from(uniquePartners)];
}


const enrichCasesWithUserData = async (cases, clinicDataMap) => { //BIG POTENTIAL FOR OPTIMIZATION HERE???
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
      //console.log(clinicDataMap)
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
