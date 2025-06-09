// CaseTransferMain.js - Optimized version
import React, { useState, useEffect, useMemo, useCallback, useReducer, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit
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
  
  // Refs for debouncing and caching
  const updateTimeoutRef = useRef(null);
  const casesMapRef = useRef(new Map());
  const doctorsMapRef = useRef(new Map());
  
  // Memoized permission check
  const canTransferCases = useMemo(() => 
    currentUser?.role === "teamLeader", 
    [currentUser?.role]
  );

  // Memoized filtered cases with optimized filtering
  const filteredCases = useMemo(() => {
    if (!state.cases.length) return [];
    
    return state.cases.filter((caseItem) => {
      // Quick exit for exact matches
      if (state.selectedQueue !== "all" && caseItem.queue !== state.selectedQueue) {
        return false;
      }
      
      if (state.selectedClinic !== "all" && caseItem.clinicCode !== state.selectedClinic) {
        return false;
      }

      // Search filter - optimized
      if (state.searchTerm) {
        const searchLower = state.searchTerm.toLowerCase();
        const patientName = caseItem.patientName?.toLowerCase() || '';
        const emrNumber = caseItem.emrNumber?.toLowerCase() || '';
        const clinicCode = caseItem.clinicCode?.toLowerCase() || '';
        
        if (!patientName.includes(searchLower) && 
            !emrNumber.includes(searchLower) && 
            !clinicCode.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [state.cases, state.searchTerm, state.selectedQueue, state.selectedClinic]);

  // Optimized cases listener with reduced database calls
  const setupCasesListener = useCallback(() => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: "" });

      const casesCollection = collection(firestore, "cases");
      
      // Single optimized query for pending cases
      const pendingCasesQuery = query(
        casesCollection,
        where("status", "in", ["pending", "doctor_completed"]),
        where("isIncomplete", "!=", true),
        orderBy("isIncomplete"),
        orderBy("createdAt", "desc"),
        limit(500) // Limit to prevent excessive data loading
      );

      const processCaseData = (doc) => {
        const data = doc.data();
        const queue = data.status === "pending" && !data.doctorCompleted ? "doctor" : "pharmacist";
        
        return {
          id: doc.id,
          ...data,
          queue,
          createdAt: data.createdAt?.toDate() || new Date(),
          doctorCompletedAt: data.doctorCompletedAt?.toDate() || null,
          pharmacistCompletedAt: data.pharmacistCompletedAt?.toDate() || null,
          clinicCode: data.clinicCode || "N/A",
        };
      };

      const unsubscribeCases = onSnapshot(
        pendingCasesQuery,
        (snapshot) => {
          const newCasesMap = new Map();
          const allCases = [];
          
          snapshot.forEach((doc) => {
            const caseData = processCaseData(doc);
            newCasesMap.set(doc.id, caseData);
            allCases.push(caseData);
          });
          
          // Cache the cases map
          casesMapRef.current = newCasesMap;
          
          // Sort once
          allCases.sort((a, b) => b.createdAt - a.createdAt);
          
          dispatch({ type: 'SET_CASES', payload: allCases });
          dispatch({ type: 'SET_LOADING', payload: false });
        },
        (error) => {
          console.error("Error in cases listener:", error);
          dispatch({ type: 'SET_ERROR', payload: "Failed to load cases." });
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      );

      return [unsubscribeCases];
    } catch (err) {
      console.error("Error setting up cases listener:", err);
      dispatch({ type: 'SET_ERROR', payload: "Failed to setup real-time case updates." });
      dispatch({ type: 'SET_LOADING', payload: false });
      return [];
    }
  }, []);

  // Optimized clinics listener using existing cases data
  const setupClinicsListener = useCallback(() => {
    // Extract clinics from already loaded cases instead of separate query
    const updateClinics = () => {
      const clinicCodes = new Set();
      state.cases.forEach(caseItem => {
        if (caseItem.clinicCode && caseItem.clinicCode !== "N/A") {
          clinicCodes.add(caseItem.clinicCode);
        }
      });
      
      const clinicsList = Array.from(clinicCodes)
        .sort()
        .map(code => ({ code, name: code }));
      
      dispatch({ type: 'SET_CLINICS', payload: clinicsList });
    };

    // Update clinics whenever cases change
    updateClinics();
    
    return () => {}; // No cleanup needed for this approach
  }, [state.cases]);

  // Heavily optimized doctors listener
  const setupDoctorsListener = useCallback(() => {
    try {
      const doctorsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "doctor"),
        limit(100) // Reasonable limit for doctors
      );

      const unsubscribeDoctors = onSnapshot(
        doctorsQuery,
        (snapshot) => {
          const doctorsData = [];
          const newDoctorsMap = new Map();
          
          snapshot.forEach((doc) => {
            const doctorData = doc.data();
            const doctor = {
              id: doc.id,
              name: doctorData.name,
              availabilityStatus: doctorData.availabilityStatus || "available",
            };
            doctorsData.push(doctor);
            newDoctorsMap.set(doc.id, doctor);
          });
          
          // Calculate case counts from cached cases data
          const doctorCaseCounts = new Map();
          casesMapRef.current.forEach((caseData) => {
            const doctorId = caseData.assignedDoctors?.primary;
            if (doctorId && caseData.queue === "doctor") {
              doctorCaseCounts.set(doctorId, (doctorCaseCounts.get(doctorId) || 0) + 1);
            }
          });

          // Process doctors list with optimized availability check
          const doctorsList = doctorsData.map((doctor) => {
            const caseCount = doctorCaseCounts.get(doctor.id) || 0;
            const isAvailable = 
              doctor.availabilityStatus === "available" ||
              doctor.availabilityStatus === "busy";
            
            return {
              ...doctor,
              caseCount,
              isAvailable: isAvailable && caseCount < 10,
            };
          });

          // Single sort operation
          doctorsList.sort((a, b) => {
            if (a.isAvailable !== b.isAvailable) {
              return a.isAvailable ? -1 : 1;
            }
            return a.caseCount - b.caseCount;
          });

          doctorsMapRef.current = newDoctorsMap;
          dispatch({ type: 'SET_DOCTORS', payload: doctorsList });
        },
        (error) => {
          console.error("Error in doctors listener:", error);
          dispatch({ type: 'SET_ERROR', payload: "Failed to load doctors data." });
        }
      );

      return [unsubscribeDoctors];
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

      const allListeners = [
        ...casesListeners,
        ...doctorsListeners
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
  }, [currentUser, canTransferCases, setupCasesListener, setupDoctorsListener]);

  // Update clinics when cases change
  useEffect(() => {
    setupClinicsListener();
  }, [setupClinicsListener]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
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
    // Clear success message after 3 seconds (reduced from 5)
    setTimeout(() => dispatch({ type: 'SET_SUCCESS', payload: "" }), 3000);
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