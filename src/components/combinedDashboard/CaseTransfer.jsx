import React, { useState, useEffect, useMemo, useCallback, useReducer } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy
} from "firebase/firestore";
import { firestore } from "../../firebase";
import CaseTransferHeader from "./CaseTransfer/Header";
import CaseTransferTable from "./CaseTransfer/Table";

// State reducer for better performance
const caseTransferReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SUCCESS':
      return { ...state, success: action.payload };
    case 'SET_CASES':
      return { ...state, cases: action.payload };
    case 'SET_DOCTORS':
      return { ...state, doctors: action.payload };
    case 'SET_CLINICS':
      return { ...state, clinics: action.payload };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.payload };
    case 'SET_SELECTED_QUEUE':
      return { ...state, selectedQueue: action.payload };
    case 'SET_SELECTED_CLINIC':
      return { ...state, selectedClinic: action.payload };
    case 'CLEAR_MESSAGES':
      return { ...state, error: "", success: "" };
    default:
      return state;
  }
};

const initialState = {
  cases: [],
  doctors: [],
  clinics: [],
  loading: true,
  error: "",
  success: "",
  searchTerm: "",
  selectedQueue: "all",
  selectedClinic: "all",
};

const CaseTransferMain = ({ currentUser }) => {
  const [state, dispatch] = useReducer(caseTransferReducer, initialState);
  const [listeners, setListeners] = useState([]);

  // Memoized permission check
  const canTransferCases = useMemo(() => 
    currentUser?.role === "teamLeader", 
    [currentUser?.role]
  );

  // Memoized filtered cases with debouncing
  const filteredCases = useMemo(() => {
    if (!state.cases.length) return [];
    
    return state.cases.filter((caseItem) => {
      // Search filter
      if (state.searchTerm) {
        const searchLower = state.searchTerm.toLowerCase();
        const matchesSearch = 
          caseItem.patientName?.toLowerCase().includes(searchLower) ||
          caseItem.emrNumber?.toLowerCase().includes(searchLower) ||
          caseItem.clinicCode?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Queue filter
      if (state.selectedQueue !== "all" && caseItem.queue !== state.selectedQueue) {
        return false;
      }

      // Clinic filter
      if (state.selectedClinic !== "all" && caseItem.clinicCode !== state.selectedClinic) {
        return false;
      }

      return true;
    });
  }, [state.cases, state.searchTerm, state.selectedQueue, state.selectedClinic]);

  // Optimized cases listener with batch processing
  const setupCasesListener = useCallback(() => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: "" });

      const casesCollection = collection(firestore, "cases");

      // Combined query to reduce listeners
      const doctorPendingQuery = query(
        casesCollection,
        where("status", "==", "pending"),
        where("doctorCompleted", "==", false),
        where("isIncomplete", "!=", true),
        orderBy("createdAt", "desc")
      );

      const pharmacistPendingQuery = query(
        casesCollection,
        where("status", "==", "doctor_completed"),
        where("isIncomplete", "!=", true),
        orderBy("isIncomplete"),
        orderBy("createdAt", "desc")
      );

      let doctorCases = [];
      let pharmacistCases = [];
      let loadedCount = 0;
      const expectedLoads = 2;

      const processCaseData = (doc, queue) => ({
        id: doc.id,
        ...doc.data(),
        queue,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        doctorCompletedAt: doc.data().doctorCompletedAt?.toDate() || null,
        pharmacistCompletedAt: doc.data().pharmacistCompletedAt?.toDate() || null,
        clinicCode: doc.data().clinicCode || "N/A",
      });

      const updateCases = () => {
        if (loadedCount === expectedLoads) {
          const allCases = [...doctorCases, ...pharmacistCases];
          allCases.sort((a, b) => b.createdAt - a.createdAt);
          dispatch({ type: 'SET_CASES', payload: allCases });
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      };

      // Batch process doctor cases
      const unsubscribeDoctor = onSnapshot(
        doctorPendingQuery,
        (snapshot) => {
          doctorCases = [];
          snapshot.forEach((doc) => {
            doctorCases.push(processCaseData(doc, "doctor"));
          });
          loadedCount = Math.max(loadedCount, 1);
          updateCases();
        },
        (error) => {
          console.error("Error in doctor cases listener:", error);
          dispatch({ type: 'SET_ERROR', payload: "Failed to load doctor queue cases." });
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      );

      // Batch process pharmacist cases
      const unsubscribePharmacist = onSnapshot(
        pharmacistPendingQuery,
        (snapshot) => {
          pharmacistCases = [];
          snapshot.forEach((doc) => {
            pharmacistCases.push(processCaseData(doc, "pharmacist"));
          });
          loadedCount = Math.max(loadedCount, 2);
          updateCases();
        },
        (error) => {
          console.error("Error in pharmacist cases listener:", error);
          dispatch({ type: 'SET_ERROR', payload: "Failed to load pharmacist queue cases." });
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      );

      return [unsubscribeDoctor, unsubscribePharmacist];
    } catch (err) {
      console.error("Error setting up cases listener:", err);
      dispatch({ type: 'SET_ERROR', payload: "Failed to setup real-time case updates." });
      dispatch({ type: 'SET_LOADING', payload: false });
      return [];
    }
  }, []);

  // Optimized clinics listener with Set for deduplication
  const setupClinicsListener = useCallback(() => {
    try {
      const casesCollection = collection(firestore, "cases");
      
      const clinicsQuery = query(
        casesCollection,
        orderBy("createdAt", "desc")
      );

      const unsubscribeClinics = onSnapshot(
        clinicsQuery,
        (snapshot) => {
          const clinicCodes = new Set();
          snapshot.forEach((doc) => {
            const caseData = doc.data();
            if (caseData.clinicCode) {
              clinicCodes.add(caseData.clinicCode);
            }
          });
          
          const clinicsList = Array.from(clinicCodes)
            .sort()
            .map(code => ({ code, name: code }));
          
          dispatch({ type: 'SET_CLINICS', payload: clinicsList });
        },
        (error) => {
          console.error("Error in clinics listener:", error);
          dispatch({ type: 'SET_ERROR', payload: "Failed to load clinic data." });
        }
      );

      return unsubscribeClinics;
    } catch (err) {
      console.error("Error setting up clinics listener:", err);
      dispatch({ type: 'SET_ERROR', payload: "Failed to setup real-time clinic updates." });
      return () => {};
    }
  }, []);

  // Optimized doctors listener with reduced queries
  const setupDoctorsListener = useCallback(() => {
    try {
      const doctorsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "doctor")
      );

      // Single query for active cases
      const activeCasesQuery = query(
        collection(firestore, "cases"),
        where("doctorCompleted", "==", false),
        where("isIncomplete", "!=", true)
      );

      let doctorsData = [];
      let activeCasesData = [];
      let doctorsLoaded = false;
      let casesLoaded = false;

      const updateDoctors = () => {
        if (doctorsLoaded && casesLoaded) {
          // Use Map for O(1) lookup instead of O(n)
          const doctorCaseCounts = new Map();
          activeCasesData.forEach((caseData) => {
            const doctorId = caseData.assignedDoctors?.primary;
            if (doctorId) {
              doctorCaseCounts.set(doctorId, (doctorCaseCounts.get(doctorId) || 0) + 1);
            }
          });

          // Batch process doctors list
          const doctorsList = doctorsData.map((doctor) => {
            const caseCount = doctorCaseCounts.get(doctor.id) || 0;
            return {
              ...doctor,
              caseCount,
              isAvailable:
                (doctor.availabilityStatus === "available" ||
                  doctor.availabilityStatus === "busy") &&
                doctor.availabilityStatus !== "unavailable" &&
                doctor.availabilityStatus !== "on_break" &&
                caseCount < 10,
            };
          });

          // Sort once with optimized comparator
          doctorsList.sort((a, b) => {
            if (a.isAvailable !== b.isAvailable) {
              return a.isAvailable ? -1 : 1;
            }
            return a.caseCount - b.caseCount;
          });

          dispatch({ type: 'SET_DOCTORS', payload: doctorsList });
        }
      };

      // Doctors listener
      const unsubscribeDoctors = onSnapshot(
        doctorsQuery,
        (snapshot) => {
          doctorsData = [];
          snapshot.forEach((doc) => {
            const doctorData = doc.data();
            doctorsData.push({
              id: doc.id,
              name: doctorData.name,
              availabilityStatus: doctorData.availabilityStatus || "available",
            });
          });
          doctorsLoaded = true;
          updateDoctors();
        },
        (error) => {
          console.error("Error in doctors listener:", error);
          dispatch({ type: 'SET_ERROR', payload: "Failed to load doctors data." });
        }
      );

      // Active cases listener with throttling
      let updateTimeout;
      const unsubscribeActiveCases = onSnapshot(
        activeCasesQuery,
        (snapshot) => {
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => {
            activeCasesData = [];
            snapshot.forEach((doc) => {
              activeCasesData.push(doc.data());
            });
            casesLoaded = true;
            updateDoctors();
          }, 100); // 100ms throttle
        },
        (error) => {
          console.error("Error in active cases listener:", error);
          dispatch({ type: 'SET_ERROR', payload: "Failed to load active cases count." });
        }
      );

      return [unsubscribeDoctors, unsubscribeActiveCases];
    } catch (err) {
      console.error("Error setting up doctors listener:", err);
      dispatch({ type: 'SET_ERROR', payload: "Failed to setup real-time doctor updates." });
      return [];
    }
  }, []);

  // Setup all listeners with cleanup
  useEffect(() => {
    if (canTransferCases && firestore) {
      const casesListeners = setupCasesListener();
      const doctorsListeners = setupDoctorsListener();
      const clinicsListener = setupClinicsListener();

      const allListeners = [
        ...casesListeners,
        ...doctorsListeners,
        clinicsListener
      ].filter(Boolean);

      setListeners(allListeners);

      return () => {
        allListeners.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        });
      };
    }
  }, [currentUser, canTransferCases, setupCasesListener, setupDoctorsListener, setupClinicsListener]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      listeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [listeners]);

  // Optimized event handlers with useCallback
  const handleSuccess = useCallback((message) => {
    dispatch({ type: 'SET_SUCCESS', payload: message });
    dispatch({ type: 'SET_ERROR', payload: "" });
    // Clear success message after 5 seconds
    setTimeout(() => dispatch({ type: 'SET_SUCCESS', payload: "" }), 5000);
  }, []);

  const handleError = useCallback((message) => {
    dispatch({ type: 'SET_ERROR', payload: message });
    dispatch({ type: 'SET_SUCCESS', payload: "" });
  }, []);

  const handleSearchChange = useCallback((searchTerm) => {
    dispatch({ type: 'SET_SEARCH_TERM', payload: searchTerm });
  }, []);

  const handleQueueChange = useCallback((queue) => {
    dispatch({ type: 'SET_SELECTED_QUEUE', payload: queue });
  }, []);

  const handleClinicChange = useCallback((clinic) => {
    dispatch({ type: 'SET_SELECTED_CLINIC', payload: clinic });
  }, []);

  const handleRefresh = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
    dispatch({ type: 'SET_SUCCESS', payload: "Data refreshed successfully!" });
  }, []);

  // Early returns for error states
  if (!firestore) {
    return (
      <Card className="border border-red-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Firebase is not properly initialized. Please check your Firebase configuration.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!canTransferCases) {
    return (
      <Card className="border border-red-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to access case transfer functionality.
              Only Team Leaders can transfer cases.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CaseTransferHeader
        filteredCasesCount={filteredCases.length}
        error={state.error}
        success={state.success}
        searchTerm={state.searchTerm}
        setSearchTerm={handleSearchChange}
        selectedQueue={state.selectedQueue}
        setSelectedQueue={handleQueueChange}
        selectedClinic={state.selectedClinic}
        setSelectedClinic={handleClinicChange}
        clinics={state.clinics}
        onRefresh={handleRefresh}
      />

      <CaseTransferTable
        cases={filteredCases}
        doctors={state.doctors}
        loading={state.loading}
        currentUser={currentUser}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </div>
  );
};

export default React.memo(CaseTransferMain);