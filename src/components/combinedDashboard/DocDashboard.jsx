import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useReducer,
} from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

import { firestore } from "../../firebase";

import { fetchData } from "./fetchData";
import {
  fetchRealtimeData,
  enrichDoctorsWithShiftData,
  enrichDoctorsWithCaseData,
  enrichPharmacistsWithShiftData,
  enrichPharmacistsWithCaseData,
} from "./fetchDetails";

// Import components
import DoctorDetailView from "./DocDetail";
import DashboardHeader from "./Header";
import DashboardSummary from "./DashboardSummary";
import DoctorTable from "./Table";
import DoctorCardsGrid from "./Card";
import StatusFilter from "./StatusFilter";


// State reducer for better state management
const dashboardReducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_REFRESHING":
      return { ...state, isRefreshing: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "SET_DOCTORS":
      return {
        ...state,
        doctors: action.payload,
        isLoading: false,
        error: null,
      };
    case "SET_PHARMACISTS":
      return {
        ...state,
        pharmacists: action.payload,
        isLoading: false,
        error: null,
      };
    case "SET_REALTIME_DATA":
      return { ...state, realtimeData: action.payload };
    case "SET_CASES_DATA":
      return { ...state, casesData: action.payload };
    case "SET_FILTERED_DATA":
      return { ...state, filteredData: action.payload };
    case "SET_PARTNER_NAMES":
      return { ...state, partnerNames: action.payload };
    case "SET_SELECTED_DOCTOR":
      return { ...state, selectedDoctor: action.payload };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload };
    case "SET_DOCTOR_PHARMACIST":
      return { ...state, doctorPharmacist: action.payload };
    case "SET_SELECTED_PARTNER":
      return { ...state, selectedPartner: action.payload };
    case "SET_REFRESH_INTERVAL":
      return { ...state, refreshInterval: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
};

const initialState = {
  doctors: [],
  pharmacists: [],
  isLoading: true,
  isRefreshing: false,
  error: null,
  refreshInterval: 30000, // Increased from 15s to 30s for better performance
  realtimeData: {},
  selectedDoctor: null,
  viewMode: "table",
  doctorPharmacist: "doctor",
  partnerNames: [],
  selectedPartner: null,
  casesData: [],
  filteredData: [],
};

const CombinedDashboard = ({ currentUser }) => {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const [realtimeListeners, setRealtimeListeners] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Memoized values
  const canTransferCases = useMemo(
    () =>
      currentUser?.role &&
      ["superAdmin", "teamLeader", "drManager"].includes(currentUser.role),
    [currentUser?.role]
  );

  const baseData = useMemo(() => {
    return state.doctorPharmacist === "doctor"
      ? state.doctors
      : state.pharmacists;
  }, [state.doctorPharmacist, state.doctors, state.pharmacists]);

  const currentData = useMemo(() => {
    // Use filtered data if available, otherwise use base data
    return state.filteredData.length > 0 ? state.filteredData : baseData;
  }, [baseData, state.filteredData]);

  const hasPermission = useMemo(
    () =>
      currentUser?.role &&
      ["zonalHead", "teamLeader", "drManager", "superAdmin"].includes(
        currentUser.role
      ),
    [currentUser?.role]
  );

  // Handle filtered data change from StatusFilter
  const handleFilteredDataChange = useCallback((filteredData) => {
    dispatch({ type: "SET_FILTERED_DATA", payload: filteredData });
  }, []);

  // Fetch today's cases data
  const fetchTodayCases = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const casesQuery = query(
        collection(firestore, "cases"),
        where("createdAt", ">=", Timestamp.fromDate(today)),
        where("createdAt", "<", Timestamp.fromDate(tomorrow))
      );

      const snapshot = await getDocs(casesQuery);
      const casesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      dispatch({ type: "SET_CASES_DATA", payload: casesData });
    } catch (err) {
      console.error("Error fetching cases data:", err);
    }
  }, []);

  // Optimized availability status update with batching
  const updateAvailabilityStatus = useCallback(async () => {
    try {
      if (baseData.length === 0) return;

      const userIds = baseData.map((item) => item.id);

      // Batch requests to avoid overwhelming Firestore
      const batchSize = 10;
      const updatedData = [...baseData];

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const snapshots = await Promise.all(
          batch.map((id) => getDoc(doc(firestore, "users", id)))
        );

        snapshots.forEach((snapshot, batchIndex) => {
          const actualIndex = i + batchIndex;
          if (snapshot.exists()) {
            const userData = snapshot.data();
            updatedData[actualIndex] = {
              ...updatedData[actualIndex],
              availabilityStatus: userData.availabilityStatus,
              availabilityHistory: userData.availabilityHistory,
            };
          }
        });
      }

      // Update state based on current type
      if (state.doctorPharmacist === "doctor") {
        dispatch({ type: "SET_DOCTORS", payload: updatedData });
      } else {
        dispatch({ type: "SET_PHARMACISTS", payload: updatedData });
      }
    } catch (err) {
      console.error("Error fetching availability data:", err);
    }
  }, [baseData, state.doctorPharmacist]);

  // Optimized data loading function
  const loadDoctorData = useCallback(
    async (doctorPharmacist) => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });
        dispatch({ type: "CLEAR_ERROR" });

        const fetchedData = await fetchData(currentUser.uid, doctorPharmacist);
        const displayData = fetchedData.docList;

        dispatch({
          type: "SET_PARTNER_NAMES",
          payload: fetchedData.partnerNames,
        });

        if (displayData.length === 0) {
          console.log(
            `No ${doctorPharmacist}s found in hierarchy. Check role relationships.`
          );
          if (doctorPharmacist === "doctor") {
            dispatch({ type: "SET_DOCTORS", payload: [] });
          } else {
            dispatch({ type: "SET_PHARMACISTS", payload: [] });
          }
          return;
        }

        if (doctorPharmacist === "doctor") {
          const rtData = await fetchRealtimeData();
          dispatch({ type: "SET_REALTIME_DATA", payload: rtData });

          const enrichedWithShifts = enrichDoctorsWithShiftData(
            displayData,
            rtData
          );
          const fullyEnrichedDoctors = await enrichDoctorsWithCaseData(
            enrichedWithShifts
          );
          dispatch({ type: "SET_DOCTORS", payload: fullyEnrichedDoctors });
        } else if (doctorPharmacist === "pharmacist") {
          const enrichedWithShifts =
            enrichPharmacistsWithShiftData(displayData);
          const fullyEnrichedPharmacists = await enrichPharmacistsWithCaseData(
            enrichedWithShifts
          );
          dispatch({
            type: "SET_PHARMACISTS",
            payload: fullyEnrichedPharmacists,
          });
        }
      } catch (err) {
        console.error(`Error loading ${doctorPharmacist} dashboard:`, err);
        dispatch({
          type: "SET_ERROR",
          payload: `Failed to load ${doctorPharmacist} data. Please try again later.`,
        });
      }
    },
    [currentUser?.uid]
  );

  // Optimized refresh handler
  const handleRefresh = useCallback(async () => {
    if (baseData.length > 0) {
      try {
        dispatch({ type: "SET_REFRESHING", payload: true });

        await updateAvailabilityStatus();

        if (state.doctorPharmacist === "doctor") {
          const updatedDoctors = await enrichDoctorsWithCaseData(state.doctors);
          dispatch({ type: "SET_DOCTORS", payload: updatedDoctors });
        } else {
          const updatedPharmacists = await enrichPharmacistsWithCaseData(
            state.pharmacists
          );
          dispatch({ type: "SET_PHARMACISTS", payload: updatedPharmacists });
        }

        // Refresh cases data as well
        await fetchTodayCases();
      } catch (err) {
        console.error(`Error refreshing ${state.doctorPharmacist} data:`, err);
        dispatch({
          type: "SET_ERROR",
          payload: `Failed to refresh ${state.doctorPharmacist} data.`,
        });
      } finally {
        dispatch({ type: "SET_REFRESHING", payload: false });
      }
    } else {
      // If no data loaded yet, try complete refresh
      await loadDoctorData(state.doctorPharmacist);
    }
  }, [
    baseData.length,
    state.doctorPharmacist,
    state.doctors,
    state.pharmacists,
    updateAvailabilityStatus,
    loadDoctorData,
    fetchTodayCases,
  ]);

  // Effect for initial data loading and doctor/pharmacist switching
  useEffect(() => {
    if (baseData.length === 0 && state.viewMode !== "cases") {
      loadDoctorData(state.doctorPharmacist);
    }
  }, [
    state.doctorPharmacist,
    baseData.length,
    loadDoctorData,
    state.viewMode,
  ]);

  // Effect for fetching cases data
  useEffect(() => {
    if (hasPermission) {
      fetchTodayCases();
    }
  }, [hasPermission, fetchTodayCases]);

  // Effect for permission checking
  useEffect(() => {
    if (!currentUser || !currentUser.uid || !currentUser.role) {
      dispatch({
        type: "SET_ERROR",
        payload: "User information not available",
      });
      return;
    }

    if (!hasPermission) {
      dispatch({
        type: "SET_ERROR",
        payload: "You don't have permission to access this dashboard",
      });
      return;
    }

    // Clear any existing error if user has permission
    if (state.error && hasPermission) {
      dispatch({ type: "CLEAR_ERROR" });
    }
  }, [currentUser, hasPermission, state.error]);

  // Effect for real-time listeners setup
  useEffect(() => {
    if (
      !hasPermission ||
      baseData.length === 0 ||
      state.viewMode === "cases"
    )
      return;

    // Clean up existing listeners
    realtimeListeners.forEach((unsubscribe) => unsubscribe());

    // Set up new listeners for real-time status updates
    const newListeners = baseData.map((item) => {
      const userRef = doc(firestore, "users", item.id);
      return onSnapshot(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data();

            // Update the specific item in state
            const updatedData = baseData.map((dataItem) =>
              dataItem.id === item.id
                ? {
                    ...dataItem,
                    availabilityStatus: userData.availabilityStatus,
                    availabilityHistory: userData.availabilityHistory,
                  }
                : dataItem
            );

            if (state.doctorPharmacist === "doctor") {
              dispatch({ type: "SET_DOCTORS", payload: updatedData });
            } else {
              dispatch({ type: "SET_PHARMACISTS", payload: updatedData });
            }
          }
        },
        (error) => {
          console.error("Real-time listener error:", error);
        }
      );
    });

    setRealtimeListeners(newListeners);

    return () => {
      newListeners.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    hasPermission,
    baseData.length,
    state.doctorPharmacist,
    state.viewMode,
  ]);

  // Effect for periodic refresh (reduced frequency)
  useEffect(() => {
    if (
      !hasPermission ||
      baseData.length === 0 ||
      state.viewMode === "cases"
    ) {
      return;
    }

    const interval = setInterval(() => {
      if (!state.isLoading && !state.isRefreshing) {
        handleRefresh();
      }
    }, state.refreshInterval);

    return () => clearInterval(interval);
  }, [
    hasPermission,
    baseData.length,
    state.viewMode,
    state.refreshInterval,
    state.isLoading,
    state.isRefreshing,
    handleRefresh,
  ]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      realtimeListeners.forEach((unsubscribe) => unsubscribe());
    };
  }, [realtimeListeners]);

  // Optimized event handlers
  const viewDoctorDetails = useCallback((doctor) => {
    dispatch({ type: "SET_SELECTED_DOCTOR", payload: doctor });
  }, []);

  const handlePartnerChange = useCallback((partner) => {
    dispatch({ type: "SET_SELECTED_PARTNER", payload: partner });
  }, []);

  // Optimized view mode change with transition handling
  const handleViewModeChange = useCallback(
    (newViewMode) => {
      if (newViewMode === state.viewMode) return;

      // Handle case transfer with transition state
      if (newViewMode === "cases") {
        setIsTransitioning(true);

        // Use requestAnimationFrame for smooth transition
        requestAnimationFrame(() => {
          setTimeout(() => {
            dispatch({ type: "SET_VIEW_MODE", payload: newViewMode });
            setIsTransitioning(false);
          }, 50); // Minimal delay to show loading state
        });
      } else {
        // Immediate transition for other views
        dispatch({ type: "SET_VIEW_MODE", payload: newViewMode });

        // Load data if switching back from cases view
        if (state.viewMode === "cases" && baseData.length === 0) {
          loadDoctorData(state.doctorPharmacist);
        }
      }
    },
    [state.viewMode, baseData.length, state.doctorPharmacist, loadDoctorData]
  );

  const handleDoctorPharmacistChange = useCallback(
    (newType) => {
      if (newType !== state.doctorPharmacist) {
        dispatch({ type: "SET_DOCTOR_PHARMACIST", payload: newType });
        // Clear filtered data when switching between doctor/pharmacist
        dispatch({ type: "SET_FILTERED_DATA", payload: [] });
      }
    },
    [state.doctorPharmacist]
  );

  const handleRefreshIntervalChange = useCallback(
    (newInterval) => {
      if (newInterval !== state.refreshInterval) {
        dispatch({ type: "SET_REFRESH_INTERVAL", payload: newInterval });
      }
    },
    [state.refreshInterval]
  );

  const handleCloseDetails = useCallback(() => {
    dispatch({ type: "SET_SELECTED_DOCTOR", payload: null });
  }, []);


  // Loading state
  if (state.isLoading && state.viewMode !== "cases") {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div
        className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
        role="alert"
      >
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{state.error}</span>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with control buttons */}
      <DashboardHeader
        viewMode={state.viewMode}
        setViewMode={handleViewModeChange}
        doctorPharmacist={state.doctorPharmacist}
        setDoctorPharmacist={handleDoctorPharmacistChange}
        refreshInterval={state.refreshInterval}
        setRefreshInterval={handleRefreshIntervalChange}
        onRefresh={handleRefresh}
        isRefreshing={state.isRefreshing}
        isTransitioning={isTransitioning}
      />

      {/* Dashboard Content */}
      <>
          {/* Summary Cards */}
          <DashboardSummary
            doctorPharmacist={state.doctorPharmacist}
            doctors={baseData}
            isRefreshing={state.isRefreshing}
            casesData={state.casesData}
          />

          {/* Status Filter Component */}
          <StatusFilter
            doctors={baseData}
            doctorPharmacist={state.doctorPharmacist}
            onFilteredDataChange={handleFilteredDataChange}
            casesData={state.casesData}
          />

          {/* Main Content */}
          {baseData.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-center">
              <p className="text-yellow-700 font-medium mb-2">
                No {state.doctorPharmacist}s found in your hierarchy
              </p>
              <p className="text-yellow-600 text-sm mb-3">
                This might happen if there are no {state.doctorPharmacist}s
                reporting to you or assigned to clinics in your hierarchy.
              </p>
              <button
                onClick={handleRefresh}
                disabled={state.isRefreshing}
                className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
              >
                {state.isRefreshing ? "Refreshing..." : "Refresh Now"}
              </button>
            </div>
          ) : /* Table or Card View based on mode */
          state.viewMode === "table" ? (
            <DoctorTable
              doctorPharmacist={state.doctorPharmacist}
              doctors={currentData} // This now uses filtered data
              onViewDoctorDetails={viewDoctorDetails}
              partnerNames={state.partnerNames}
              isRefreshing={state.isRefreshing}
            />
          ) : state.viewMode === "cards" ? (
            <DoctorCardsGrid
              doctors={currentData} // This now uses filtered data
              onViewDoctorDetails={viewDoctorDetails}
              isRefreshing={state.isRefreshing}
            />
          ) : null}
        </>

      {/* Doctor Detail Modal */}
      {state.selectedDoctor && (
        <DoctorDetailView
          doctorPharmacist={state.doctorPharmacist}
          doctor={state.selectedDoctor}
          onClose={handleCloseDetails}
        />
      )}

      {/* Debug Information (remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-gray-100 p-2 rounded text-xs text-gray-600">
          <strong>Debug:</strong> Role: {currentUser?.role} | View:{" "}
          {state.viewMode} | Type: {state.doctorPharmacist} | Can Transfer:{" "}
          {canTransferCases ? "Yes" : "No"} | Base Data Count: {baseData.length} |
          Filtered Data Count: {currentData.length} |
          Refreshing: {state.isRefreshing ? "Yes" : "No"} | Transitioning:{" "}
          {isTransitioning ? "Yes" : "No"}
        </div>
      )}
    </div>
  );
};

export default React.memo(CombinedDashboard);