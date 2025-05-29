import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  ClipboardList,
  User,
  Stethoscope,
  Pill,
  Phone,
  Video,
  ListFilter,
  FileText,
  Info,
  Loader2,
  UserCheck,
  UserX,
  Users,
  Coffee,
  CalendarIcon,
  RefreshCw,
} from "lucide-react";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  runTransaction,
  writeBatch,
  onSnapshot, // Added for real-time monitoring
} from "firebase/firestore";
import { firestore } from "../../firebase";
import DoctorStatusIndicator from "./DocStatus";
import PharmacistStatusIndicator from "./PharmasistAvailable";

const NurseCaseForm = ({ currentUser, onCreateCase }) => {
  const [formData, setFormData] = useState({
    patients: [{ patientName: "", emrNumber: "", chiefComplaint: "" }],
    consultationType: "tele",
    contactInfo: "",
    notes: "",
  });
  
  const addPatient = () => {
    setFormData((prev) => ({
      ...prev,
      patients: [
        ...prev.patients,
        { patientName: "", emrNumber: "", chiefComplaint: "" },
      ],
    }));
  };

  const removePatient = (index) => {
    if (formData.patients.length === 1) return; // Always keep at least one patient
    setFormData((prev) => ({
      ...prev,
      patients: prev.patients.filter((_, i) => i !== index),
    }));
  };

  const updatePatient = (index, field, value) => {
    setFormData((prev) => {
      const updatedPatients = [...prev.patients];
      updatedPatients[index] = { ...updatedPatients[index], [field]: value };
      return { ...prev, patients: updatedPatients };
    });

    // Clear EMR error when changing EMR number
    if (field === "emrNumber") {
      setError("");
    }
  };

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [assignedDoctor, setAssignedDoctor] = useState(null);
  const [assignedPharmacist, setAssignedPharmacist] = useState(null);
  const [doctorSearchAttempted, setDoctorSearchAttempted] = useState(false);
  const [pharmacistSearchAttempted, setPharmacistSearchAttempted] = useState(false);
  const [doctorsData, setDoctorsData] = useState([]);
  const [pharmacistsData, setPharmacistsData] = useState([]);
  const [doctorFallbackAssignment, setDoctorFallbackAssignment] = useState(true);
  const [pharmaFallbackAssignment, setPharmaFallbackAssignment] = useState(true);
  
  // NEW: State for real-time monitoring
  const [isReassigning, setIsReassigning] = useState(false);
  const [doctorStatusListener, setDoctorStatusListener] = useState(null);
  const [pharmacistStatusListener, setPharmacistStatusListener] = useState(null);
  const [nurseHierarchyData, setNurseHierarchyData] = useState(null);

  // NEW: Function to check if a doctor is available
  const isDoctorAvailable = (doctor) => {
    if (!doctor) return false;
    const isUnavailable = 
      doctor.availabilityStatus === "unavailable" || 
      doctor.availabilityStatus === "on_break";
    const isAtCapacity = (doctor.caseCount || 0) >= 10;
    return !isUnavailable && !isAtCapacity;
  };
  

  // NEW: Function to check if a pharmacist is available
  const isPharmacistAvailable = (pharmacist) => {
    if (!pharmacist) return false;
    const isUnavailable = 
      pharmacist.availabilityStatus === "unavailable" || 
      pharmacist.availabilityStatus === "on_break";
    const isAtCapacity = (pharmacist.caseCount || 0) >= 10;
    return !isUnavailable && !isAtCapacity;
  };

  // NEW: Function to automatically reassign doctor when current one becomes unavailable
  const handleDoctorUnavailable = async () => {
    if (isReassigning) return; // Prevent multiple simultaneous reassignments
    
    setIsReassigning(true);
    console.log("Doctor became unavailable, attempting reassignment...");
    
    try {
      // Find new available doctor using the same logic
      await findAvailableDoctorFast(nurseHierarchyData);
      
      if (!assignedDoctor) {
        setError("Your assigned doctor became unavailable and no replacement could be found. Please try again later.");
      }
    } catch (err) {
      console.error("Error during doctor reassignment:", err);
      setError("Failed to reassign doctor. Please refresh and try again.");
    } finally {
      setIsReassigning(false);
    }
  };

  // NEW: Function to automatically reassign pharmacist when current one becomes unavailable
  const handlePharmacistUnavailable = async () => {
    if (isReassigning) return;
    
    setIsReassigning(true);
    console.log("Pharmacist became unavailable, attempting reassignment...");
    
    try {
      await findAvailablePharmacistFast(nurseHierarchyData);
      
      if (!assignedPharmacist) {
        setError("Your assigned pharmacist became unavailable and no replacement could be found. Please try again later.");
      }
    } catch (err) {
      console.error("Error during pharmacist reassignment:", err);
      setError("Failed to reassign pharmacist. Please refresh and try again.");
    } finally {
      setIsReassigning(false);
    }
  };

  // NEW: Set up real-time listener for assigned doctor's status
  // Alternative: Update the existing status listeners to also fetch case counts
const setupDoctorStatusListener = (doctorId) => {
  if (doctorStatusListener) {
    doctorStatusListener();
  }

  if (!doctorId) return;

  const doctorRef = doc(firestore, "users", doctorId);
  const unsubscribe = onSnapshot(doctorRef, async (docSnap) => {
    if (docSnap.exists()) {
      const doctorData = docSnap.data();
      
      // Get real-time case count
      const activeCasesQuery = query(
        collection(firestore, "cases"),
        where("assignedDoctors.primary", "==", doctorId),
        where("doctorCompleted", "==", false),
        where("isIncomplete", "!=", true)
      );
      
      const casesSnapshot = await getDocs(activeCasesQuery);
      const currentCaseCount = casesSnapshot.docs.length;
      
      const updatedDoctor = {
        id: docSnap.id,
        name: doctorData.name,
        availabilityStatus: doctorData.availabilityStatus || "available",
        caseCount: currentCaseCount, // Use real-time count
      };

      // Update the assigned doctor's current status
      if (assignedDoctor && assignedDoctor.id === doctorId) {
        setAssignedDoctor(prev => ({
          ...prev,
          availabilityStatus: updatedDoctor.availabilityStatus,
          caseCount: updatedDoctor.caseCount,
        }));

        // Check if doctor became unavailable
        if (!isDoctorAvailable(updatedDoctor)) {
          console.log(`Doctor ${doctorData.name} became unavailable`);
          handleDoctorUnavailable();
        }
      }

      // Update in the doctors list as well
      setDoctorsData(prev => prev.map(doc => 
        doc.id === doctorId 
          ? { ...doc, ...updatedDoctor }
          : doc
      ));
    }
  }, (error) => {
    console.error("Error listening to doctor status:", error);
  });

  setDoctorStatusListener(() => unsubscribe);
};

  // Updated setupPharmacistStatusListener with real-time case counts
const setupPharmacistStatusListener = (pharmacistId) => {
  if (pharmacistStatusListener) {
    pharmacistStatusListener();
  }

  if (!pharmacistId) return;

  const pharmacistRef = doc(firestore, "users", pharmacistId);
  const unsubscribe = onSnapshot(pharmacistRef, async (docSnap) => {
    if (docSnap.exists()) {
      const pharmacistData = docSnap.data();
      
      // Get real-time case count
      const activeCasesQuery = query(
        collection(firestore, "cases"),
        where("pharmacistId", "==", pharmacistId),
        where("pharmacistCompleted", "==", false),
        where("isIncomplete", "!=", true)
      );
      
      const casesSnapshot = await getDocs(activeCasesQuery);
      const currentCaseCount = casesSnapshot.docs.length;
      
      const updatedPharmacist = {
        id: docSnap.id,
        name: pharmacistData.name,
        availabilityStatus: pharmacistData.availabilityStatus || "available",
        caseCount: currentCaseCount, // Use real-time count
      };

      // Update the assigned pharmacist's current status
      if (assignedPharmacist && assignedPharmacist.id === pharmacistId) {
        setAssignedPharmacist(prev => ({
          ...prev,
          availabilityStatus: updatedPharmacist.availabilityStatus,
          caseCount: updatedPharmacist.caseCount,
        }));

        // Check if pharmacist became unavailable
        if (!isPharmacistAvailable(updatedPharmacist)) {
          console.log(`Pharmacist ${pharmacistData.name} became unavailable`);
          handlePharmacistUnavailable();
        }
      }

      // Update in the pharmacists list as well
      setPharmacistsData(prev => prev.map(pharm => 
        pharm.id === pharmacistId 
          ? { ...pharm, ...updatedPharmacist }
          : pharm
      ));
    }
  }, (error) => {
    console.error("Error listening to pharmacist status:", error);
  });

  setPharmacistStatusListener(() => unsubscribe);
};

  useEffect(() => {
    const fetchProfessionals = async () => {
      try {
        // Get nurse's data
        const nurseRef = doc(firestore, "users", currentUser.uid);
        const nurseSnapshot = await getDoc(nurseRef);

        if (!nurseSnapshot.exists()) return;

        const nurseData = nurseSnapshot.data();
        setNurseHierarchyData(nurseData); // Store for reassignment logic

        // Check if the nurse has direct pharmacist assignments (created by RO)
        if (nurseData.assignedPharmacists) {
          // This nurse was created by an RO with a pharmacist hierarchy
          await fetchAllPharmacists(nurseData);
          await findAvailablePharmacistFast(nurseData);
        } else if (nurseData.reportingTo) {
          // This nurse was created by a pharmacist directly
          // Get the creating pharmacist's info
          const pharmacistRef = doc(firestore, "users", nurseData.reportingTo);
          const pharmacistSnap = await getDoc(pharmacistRef);

          if (pharmacistSnap.exists()) {
            const pharmacistData = pharmacistSnap.data();
            setAssignedPharmacist({
              id: pharmacistSnap.id,
              name: pharmacistData.name,
              type: "primary",
              availabilityStatus: pharmacistData.availabilityStatus || "available",
              caseCount: 0,
            });
          }
        }

        // Continue with doctor fetching (existing code)
        if (nurseData.assignedDoctors) {
          // Get all doctors
          await fetchAllDoctors(nurseData);
        } else if (nurseData.reportingTo) {
          // Get creating pharmacist to check doctor hierarchy
          const pharmacistRef = doc(firestore, "users", nurseData.reportingTo);
          const pharmacistSnap = await getDoc(pharmacistRef);

          if (pharmacistSnap.exists()) {
            const pharmacistData = pharmacistSnap.data();
            await fetchAllDoctors(pharmacistData);
            await findAvailableDoctorFast(pharmacistData);
          }
        }
      } catch (err) {
        console.error("Error fetching assigned professionals:", err);
      }
    };

    fetchProfessionals();
  }, [currentUser.uid]);

  // NEW: Set up listeners when professionals are assigned
  useEffect(() => {
    if (assignedDoctor && assignedDoctor.id) {
      setupDoctorStatusListener(assignedDoctor.id);
    }
    return () => {
      if (doctorStatusListener) {
        doctorStatusListener();
      }
    };
  }, [assignedDoctor?.id]);

  useEffect(() => {
    if (assignedPharmacist && assignedPharmacist.id) {
      setupPharmacistStatusListener(assignedPharmacist.id);
    }
    return () => {
      if (pharmacistStatusListener) {
        pharmacistStatusListener();
      }
    };
  }, [assignedPharmacist?.id]);

  // Cleanup listeners on component unmount
  useEffect(() => {
    return () => {
      if (doctorStatusListener) {
        doctorStatusListener();
      }
      if (pharmacistStatusListener) {
        pharmacistStatusListener();
      }
    };
  }, []);

  const fetchAllDoctors = async (userData) => {
    try {
      const assignedDoctors = userData.assignedDoctors || {};

      // Get all doctors in one query
      const allDoctorsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "doctor")
      );
      const allDoctorsSnapshot = await getDocs(allDoctorsQuery);
      const doctors = [];

      allDoctorsSnapshot.docs.forEach((docSnap) => {
        const doctorData = docSnap.data();
        doctors.push({
          id: docSnap.id,
          name: doctorData.name,
          availabilityStatus: doctorData.availabilityStatus || "available",
          caseCount: doctorData.caseCount || 0, // Added case count
          isHierarchy:
            docSnap.id === assignedDoctors.primary
              ? "primary"
              : docSnap.id === assignedDoctors.secondary
              ? "secondary"
              : docSnap.id === assignedDoctors.tertiary
              ? "tertiary"
              : null,
        });
      });

      setDoctorsData(doctors);

      // Now find the best available doctor
      await findAvailableDoctorFast(userData);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  };

  // Modified fetchAllPharmacists to include case counts
  const fetchAllPharmacists = async (nurseData) => {
    try {
      const assignedPharmacists = nurseData.assignedPharmacists || {};

      // Get all pharmacists in one query
      const allPharmacistsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "pharmacist")
      );
      const allPharmacistsSnapshot = await getDocs(allPharmacistsQuery);

      // Create a map of pharmacists
      const pharmacistsMap = {};
      allPharmacistsSnapshot.docs.forEach((docSnap) => {
        const pharmacistData = docSnap.data();
        pharmacistsMap[docSnap.id] = {
          id: docSnap.id,
          name: pharmacistData.name,
          availabilityStatus: pharmacistData.availabilityStatus || "available",
          isHierarchy:
            docSnap.id === assignedPharmacists.primary
              ? "primary"
              : docSnap.id === assignedPharmacists.secondary
              ? "secondary"
              : docSnap.id === assignedPharmacists.tertiary
              ? "tertiary"
              : null,
          caseCount: 0, // Initialize case count to 0
        };
      });

      // Get active cases to count pharmacist workload - EXCLUDE INCOMPLETE CASES
      const activeCasesQuery = query(
        collection(firestore, "cases"),
        where("pharmacistCompleted", "==", false),
        where("isIncomplete", "!=", true) // This filters out incomplete cases
      );

      const activeCasesSnapshot = await getDocs(activeCasesQuery);

      // Count cases per pharmacist
      activeCasesSnapshot.docs.forEach((doc) => {
        const caseData = doc.data();
        if (caseData.pharmacistId) {
          const pharmacistId = caseData.pharmacistId;
          if (pharmacistsMap[pharmacistId]) {
            pharmacistsMap[pharmacistId].caseCount =
              (pharmacistsMap[pharmacistId].caseCount || 0) + 1;
          }
        }
      });

      // Now convert the map to an array for state
      setPharmacistsData(Object.values(pharmacistsMap));
    } catch (err) {
      console.error("Error fetching pharmacists:", err);
    }
  };

  // Modified function to support unlimited hierarchy depth
  const findAvailableDoctorFast = async (userData) => {
    setDoctorSearchAttempted(true);
    try {
      // IMPROVED: Support for extended hierarchy (beyond tertiary)
      let doctorHierarchy = [];
      let assignToAnyDoctor = userData.assignToAnyDoctor || false;

      setDoctorFallbackAssignment(assignToAnyDoctor);

      // Check if we're dealing with a nurse (has assignedDoctors object) or pharmacist (has doctorHierarchy array)
      if (
        userData.assignedDoctors &&
        Object.keys(userData.assignedDoctors).length > 0
      ) {
        const assignedDoctors = userData.assignedDoctors;

        // Extract explicitly named hierarchy levels
        if (assignedDoctors.primary)
          doctorHierarchy.push(assignedDoctors.primary);
        if (assignedDoctors.secondary)
          doctorHierarchy.push(assignedDoctors.secondary);
        if (assignedDoctors.tertiary)
          doctorHierarchy.push(assignedDoctors.tertiary);

        // NEW: Handle numbered levels beyond tertiary (if they exist)
        for (let i = 4; ; i++) {
          const levelKey = getHierarchyLevelName(i);
          if (assignedDoctors[levelKey]) {
            doctorHierarchy.push(assignedDoctors[levelKey]);
          } else {
            break; // No more levels found
          }
        }

        // Check if assignToAnyDoctor is in the nested structure
        if (assignedDoctors.assignToAnyDoctor !== undefined) {
          assignToAnyDoctor = assignedDoctors.assignToAnyDoctor;
        }

        // LOG THE HIERARCHY
        console.log("Doctor Hierarchy Config:", {
          hierarchyArray: doctorHierarchy,
          hierarchyNames: doctorHierarchy.map(
            (id, i) => `${getHierarchyLevelName(i + 1)}: ${id}`
          ),
          assignToAnyDoctor,
        });
      } else if (
        userData.doctorHierarchy &&
        Array.isArray(userData.doctorHierarchy)
      ) {
        // Use the array directly - already supports unlimited depth
        doctorHierarchy = userData.doctorHierarchy;

        // LOG THE HIERARCHY
        console.log("Doctor Hierarchy Array:", {
          hierarchyArray: doctorHierarchy,
          hierarchyNames: doctorHierarchy.map(
            (id, i) => `${getHierarchyLevelName(i + 1)}: ${id}`
          ),
          assignToAnyDoctor,
        });
      } else {
        console.error("No doctor assignments found in data");
        setError("No doctors configured. Please contact support.");
        return;
      }

      // Validate we have at least one doctor
      if (doctorHierarchy.length === 0) {
        console.error("No doctors assigned in the hierarchy");
        setError(
          "No doctors configured in your hierarchy. Please contact support."
        );
        return;
      }

      // Get all doctors
      const allDoctorsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "doctor")
      );

      const allDoctorsSnapshot = await getDocs(allDoctorsQuery);

      // Build doctors map
      const doctorsMap = {};
      allDoctorsSnapshot.docs.forEach((doc) => {
        const doctorData = doc.data();
        doctorsMap[doc.id] = {
          id: doc.id,
          name: doctorData.name || "Doctor",
          availabilityStatus: doctorData.availabilityStatus || "available",
          caseCount: doctorData.caseCount || 0, // Added case count
        };
      });

      // Get active cases to count doctor workload
      const activeCasesQuery = query(
        collection(firestore, "cases"),
        where("doctorCompleted", "==", false)
      );

      const activeCasesSnapshot = await getDocs(activeCasesQuery);

      // Count cases per doctor
      activeCasesSnapshot.docs.forEach((doc) => {
        const caseData = doc.data();
        if (caseData.assignedDoctors?.primary) {
          const doctorId = caseData.assignedDoctors.primary;
          if (doctorsMap[doctorId]) {
            doctorsMap[doctorId].caseCount =
              (doctorsMap[doctorId].caseCount || 0) + 1;
          }
        }
      });

      // Ensure there's at least one available doctor
      const anyAvailable = Object.values(doctorsMap).some(
        (doctor) => isDoctorAvailable(doctor)
      );

      if (!anyAvailable) {
        console.error("No available doctors found in the system");
        setError(
          "All doctors are currently unavailable or at capacity. Please try again later."
        );
        return;
      }

      // Store doctors data for UI
      setDoctorsData(Object.values(doctorsMap));

      // Function to assign a doctor
      const assignDoctor = (id, hierarchyLevel) => {
        const doctor = doctorsMap[id];
        if (!doctor) return false;

        // Create a user-friendly level name
        let typeName = getHierarchyLevelName(hierarchyLevel + 1);

        setAssignedDoctor({
          id: id,
          name: doctor.name,
          type: typeName,
          availabilityStatus: doctor.availabilityStatus,
          caseCount: doctor.caseCount || 0,
        });
        return true;
      };

      // IMPROVED PRIORITY LOGIC: Try each doctor in the hierarchy order
      for (let i = 0; i < doctorHierarchy.length; i++) {
        const doctorId = doctorHierarchy[i];
        const doctor = doctorsMap[doctorId];
        if (doctor && isDoctorAvailable(doctor)) {
          return assignDoctor(doctorId, i);
        }
      }

      // If assignToAnyDoctor is enabled, try any other doctor
      if (assignToAnyDoctor) {
        const availableFallbackDoctors = Object.values(doctorsMap)
          .filter((doctor) => {
            // Skip hierarchy doctors (already checked)
            if (doctorHierarchy.includes(doctor.id)) {
              return false;
            }

            // Check availability
            return isDoctorAvailable(doctor);
          })
          .sort((a, b) => (a.caseCount || 0) - (b.caseCount || 0));

        if (availableFallbackDoctors.length > 0) {
          const bestDoctor = availableFallbackDoctors[0];
          console.log(`Assigning to fallback doctor ${bestDoctor.name}`);
          return assignDoctor(bestDoctor.id, doctorHierarchy.length);
        }
      }

      // No available doctors
      console.log("No available doctors found");
      setError(
        "No available doctors found. All doctors are unavailable or at capacity."
      );
    } catch (err) {
      console.error("Error finding doctor:", err);
      setError("Failed to find available doctor. Please try again.");
    }
  };

  // Helper function to get human-readable hierarchy level name
  const getHierarchyLevelName = (level) => {
    switch (level) {
      case 1:
        return "primary";
      case 2:
        return "secondary";
      case 3:
        return "tertiary";
      case 4:
        return "quaternary";
      case 5:
        return "quinary";
      default:
        return `level-${level}`;
    }
  };

  // Similarly update the pharmacist function to support extended hierarchy
  const findAvailablePharmacistFast = async (userData) => {
    setPharmacistSearchAttempted(true);
    try {
      // IMPROVED: Support for extended hierarchy (beyond tertiary)
      let pharmacistHierarchy = [];
      let assignToAnyPharmacist =
        userData.assignToAnyPharmacist ||
        userData.assignedPharmacists?.assignToAnyPharmacist ||
        false;

      setPharmaFallbackAssignment(assignToAnyPharmacist);

      // For nurses with assigned pharmacists from RO
      if (
        userData.assignedPharmacists &&
        Object.keys(userData.assignedPharmacists).length > 0
      ) {
        const assignedPharmacists = userData.assignedPharmacists;

        // Extract explicitly named hierarchy levels
        if (assignedPharmacists.primary)
          pharmacistHierarchy.push(assignedPharmacists.primary);
        if (assignedPharmacists.secondary)
          pharmacistHierarchy.push(assignedPharmacists.secondary);
        if (assignedPharmacists.tertiary)
          pharmacistHierarchy.push(assignedPharmacists.tertiary);

        // NEW: Handle numbered levels beyond tertiary (if they exist)
        for (let i = 4; ; i++) {
          const levelKey = getHierarchyLevelName(i);
          if (assignedPharmacists[levelKey]) {
            pharmacistHierarchy.push(assignedPharmacists[levelKey]);
          } else {
            break; // No more levels found
          }
        }

        // LOG THE HIERARCHY
        console.log("Pharmacist Hierarchy Config:", {
          hierarchyArray: pharmacistHierarchy,
          hierarchyNames: pharmacistHierarchy.map(
            (id, i) => `${getHierarchyLevelName(i + 1)}: ${id}`
          ),
          assignToAnyPharmacist,
        });
      } else if (
        userData.pharmacistHierarchy &&
        Array.isArray(userData.pharmacistHierarchy)
      ) {
        // Use the array directly
        pharmacistHierarchy = userData.pharmacistHierarchy;

        // LOG THE HIERARCHY
        console.log("Pharmacist Hierarchy Array:", {
          hierarchyArray: pharmacistHierarchy,
          hierarchyNames: pharmacistHierarchy.map(
            (id, i) => `${getHierarchyLevelName(i + 1)}: ${id}`
          ),
          assignToAnyPharmacist,
        });
      }

      // Validate we have at least one pharmacist
      if (pharmacistHierarchy.length === 0) {
        console.error("No pharmacists assigned in the hierarchy");
        return;
      }

      // Get all pharmacists
      const allPharmacistsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "pharmacist")
      );

      const allPharmacistsSnapshot = await getDocs(allPharmacistsQuery);
      const pharmacistsMap = {};

      allPharmacistsSnapshot.docs.forEach((doc) => {
        const pharmacistData = doc.data();
        pharmacistsMap[doc.id] = {
          id: doc.id,
          name: pharmacistData.name || "Pharmacist",
          availabilityStatus: pharmacistData.availabilityStatus || "available",
          caseCount: pharmacistData.caseCount || 0, // Added case count
        };
      });

      // Get active cases to count pharmacist workload - EXCLUDE INCOMPLETE CASES
      const activeCasesQuery = query(
        collection(firestore, "cases"),
        where("pharmacistCompleted", "==", false),
        where("isIncomplete", "!=", true)
      );

      const activeCasesSnapshot = await getDocs(activeCasesQuery);

      // Count cases per pharmacist
      activeCasesSnapshot.docs.forEach((doc) => {
        const caseData = doc.data();
        if (caseData.pharmacistId) {
          const pharmacistId = caseData.pharmacistId;
          if (pharmacistsMap[pharmacistId]) {
            pharmacistsMap[pharmacistId].caseCount =
              (pharmacistsMap[pharmacistId].caseCount || 0) + 1;
          }
        }
      });

      // Ensure there's at least one available pharmacist
      const anyAvailable = Object.values(pharmacistsMap).some(
        (pharmacist) => isPharmacistAvailable(pharmacist)
      );

      if (!anyAvailable) {
        console.error("No available pharmacists found in the system");
        setError(
          "All pharmacists are currently unavailable or at capacity. Please try again later."
        );
        return;
      }

      // Set pharmacist data for UI
      setPharmacistsData(Object.values(pharmacistsMap));

      // Function to assign a pharmacist
      const assignPharmacist = (id, hierarchyLevel) => {
        const pharmacist = pharmacistsMap[id];
        if (!pharmacist) return false;

        // Create a user-friendly level name
        let typeName = getHierarchyLevelName(hierarchyLevel + 1);

        setAssignedPharmacist({
          id: id,
          name: pharmacist.name,
          type: typeName,
          availabilityStatus: pharmacist.availabilityStatus,
          caseCount: pharmacist.caseCount || 0,
        });
        return true;
      };

      // IMPROVED: Try each pharmacist in the hierarchy order
      for (let i = 0; i < pharmacistHierarchy.length; i++) {
        const pharmacistId = pharmacistHierarchy[i];
        const pharmacist = pharmacistsMap[pharmacistId];
        if (pharmacist && isPharmacistAvailable(pharmacist)) {
          return assignPharmacist(pharmacistId, i);
        }
      }

      // If assignToAnyPharmacist is enabled, try any other pharmacist
      if (assignToAnyPharmacist) {
        const availableFallbackPharmacists = Object.values(pharmacistsMap)
          .filter((pharmacist) => {
            // Skip hierarchy pharmacists (already checked)
            if (pharmacistHierarchy.includes(pharmacist.id)) {
              return false;
            }

            // Check availability
            return isPharmacistAvailable(pharmacist);
          })
          .sort((a, b) => (a.caseCount || 0) - (b.caseCount || 0));

        if (availableFallbackPharmacists.length > 0) {
          const bestPharmacist = availableFallbackPharmacists[0];
          console.log(
            `Assigning to fallback pharmacist ${bestPharmacist.name}`
          );
          return assignPharmacist(
            bestPharmacist.id,
            pharmacistHierarchy.length
          );
        }
      }

      // No available pharmacists
      console.log("No available pharmacists found");
      setError(
        "No available pharmacists found. All pharmacists are unavailable or at capacity."
      );
    } catch (err) {
      console.error("Error finding pharmacist:", err);
      setError("Failed to find available pharmacist. Please try again.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Handle non-patient fields
    if (
      name !== "patientName" &&
      name !== "emrNumber" &&
      name !== "chiefComplaint"
    ) {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validateContactInfo = () => {
    if (formData.consultationType === "tele") {
      return formData.contactInfo.includes("meet.google.com");
    } else {
      return /^\d{10}$/.test(formData.contactInfo);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate patients data
    for (let i = 0; i < formData.patients.length; i++) {
      const patient = formData.patients[i];
      if (!patient.patientName.trim()) {
        setError(`Patient #${i + 1} name is required`);
        return;
      }
      if (!patient.emrNumber.trim()) {
        setError(`Patient #${i + 1} EMR number is required`);
        return;
      }
      if (!patient.chiefComplaint.trim()) {
        setError(`Patient #${i + 1} chief complaint is required`);
        return;
      }
    }

    // Continue with other validations
    if (!formData.contactInfo.trim()) {
      setError(
        formData.consultationType === "tele"
          ? "Google Meet link is required"
          : "Phone number is required"
      );
      return;
    }
    if (!validateContactInfo()) {
      setError(
        formData.consultationType === "tele"
          ? "Please enter a valid Google Meet link (should contain 'meet.google.com')"
          : "Please enter a valid 10-digit phone number"
      );
      return;
    }
    if (!assignedDoctor) {
      setError("No doctor assigned. Please try again or contact support.");
      return;
    }
    if (!assignedPharmacist) {
      setError("No pharmacist assigned. Please contact support.");
      return;
    }

    // NEW: Final availability check before submitting
    if (!isDoctorAvailable(assignedDoctor)) {
      setError("Assigned doctor is no longer available. Please wait for reassignment or refresh the page.");
      return;
    }
    if (!isPharmacistAvailable(assignedPharmacist)) {
      setError("Assigned pharmacist is no longer available. Please wait for reassignment or refresh the page.");
      return;
    }

    setLoading(true);

    try {
      // Get nurse's data
      const nurseRef = doc(firestore, "users", currentUser.uid);
      const nurseSnapshot = await getDoc(nurseRef);

      if (!nurseSnapshot.exists()) {
        throw new Error("Nurse data not found");
      }

      const nurseData = nurseSnapshot.data();

      // Get timestamp for all cases
      const timestamp = serverTimestamp();
      
      // Create a batch for writing multiple cases
      const batch = writeBatch(firestore);
      
      // Create separate case for each patient
      const createdCaseIds = [];

      const batchCode = `batch_${Date.now()}`
      
      for (let i = 0; i < formData.patients.length; i++) {
        const patient = formData.patients[i];
        
        // Create new case ID with timestamp and patient index
        const caseId = `case_${Date.now()}_${i}`;
        createdCaseIds.push(caseId);
        // Create case document
        const caseRef = doc(firestore, "cases", caseId);
        
        // Create case data object
        const newCase = {
          id: caseId,
          patientName: patient.patientName,
          emrNumber: patient.emrNumber,
          chiefComplaint: patient.chiefComplaint,
          consultationType: formData.consultationType,
          contactInfo: formData.contactInfo,
          notes: formData.notes,
          status: "pending",
          createdAt: timestamp,
          createdBy: currentUser.uid,
          createdByName: currentUser.displayName || nurseData.name,
          clinicId: currentUser.uid,
          clinicName: nurseData.name,
          clinicCode: nurseData.clinicCode,
          partnerName: nurseData.partnerName,
          assignedDoctors: {
            primary: assignedDoctor.id,
            primaryName: assignedDoctor.name,
            primaryType: assignedDoctor.type,
            primaryStatus: assignedDoctor.availabilityStatus,
          },
          pharmacistId: assignedPharmacist.id,
          pharmacistName: assignedPharmacist.name,
          pharmacistType: assignedPharmacist.type || "primary",
          pharmacistStatus: assignedPharmacist.availabilityStatus,
          doctorCompleted: false,
          pharmacistCompleted: false,
          doctorCompletedAt: null,
          pharmacistCompletedAt: null,
          isIncomplete: false,
          inPharmacistPendingReview: false,
          // Track that this case is part of a group (for reference)
          batchCreated: true,
          batchTimestamp: timestamp,
          batchSize: formData.patients.length,
          batchIndex: i,
          batchCode: batchCode
        };
        
        // Add to batch
        batch.set(caseRef, newCase);
      }
      
      // Update doctor status if they'll be at capacity
      if (assignedDoctor) {
        const doctorRef = doc(firestore, "users", assignedDoctor.id);
        const doctorSnapshot = await getDoc(doctorRef);
        
        if (doctorSnapshot.exists()) {
          const doctorData = doctorSnapshot.data();
          const currentCaseCount = doctorData.caseCount || 0;
          const newCaseCount = currentCaseCount + formData.patients.length;
          
          //deprecating busy
          ///*
          if (newCaseCount >= 10 && doctorData.availabilityStatus === "available") {
            batch.update(doctorRef, {
              availabilityStatus: "busy",
              lastStatusUpdate: timestamp,
              autoStatusChange: true,
            });
          }
          /**/
        }
      }

      // Update pharmacist status if they'll be at capacity
      if (assignedPharmacist) {
        const pharmRef = doc(firestore, "users", assignedPharmacist.id);
        const pharmSnapshot = await getDoc(pharmRef);
        
        if (pharmSnapshot.exists()) {
          const pharmacistData = pharmSnapshot.data();
          const currentCaseCount = pharmacistData.caseCount || 0;
          const newCaseCount = currentCaseCount + formData.patients.length;
          
          //deprecating busy
          ///*
          if (newCaseCount >= 10 && pharmacistData.availabilityStatus === "available") {
            batch.update(pharmRef, {
              availabilityStatus: "busy",
              lastStatusUpdate: timestamp,
              autoStatusChange: true,
            });
          }
          /**/ 
        }
      }
      
      // Commit the batch
      await batch.commit();

      // Reset form after successful creation
      setFormData({
        patients: [{ patientName: "", emrNumber: "", chiefComplaint: "" }],
        consultationType: "tele",
        contactInfo: "",
        notes: "",
      });

      // Return the first case ID (or we could return all IDs if needed)
      onCreateCase({ id: createdCaseIds[0], allIds: createdCaseIds });
    } catch (err) {
      console.error("Error creating cases:", err);
      setError(err.message || "Failed to create cases");
    } finally {
      setLoading(false);
    }
  };

  // Function to get status icon for a professional
  const getStatusIcon = (status) => {
    switch (status) {
      case "available":
        return <UserCheck className="h-4 w-4 text-green-600" />;
      case "busy":
        return <Users className="h-4 w-4 text-red-600" />;
      case "unavailable":
        return <UserX className="h-4 w-4 text-gray-600" />;
      case "on_break":
        return <Coffee className="h-4 w-4 text-amber-600" />;
      default:
        return <UserCheck className="h-4 w-4 text-blue-600" />;
    }
  };

  // NEW: Manual refresh function for edge cases
  const handleRefreshAssignments = async () => {
    setIsReassigning(true);
    setError("");
    
    try {
      if (nurseHierarchyData) {
        await findAvailableDoctorFast(nurseHierarchyData);
        await findAvailablePharmacistFast(nurseHierarchyData);
      }
    } catch (err) {
      console.error("Error refreshing assignments:", err);
      setError("Failed to refresh assignments. Please try again.");
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <Card className="border border-gray-100 shadow-md">
      <CardHeader className="bg-gray-50 pb-4">
        <CardTitle className="text-xl flex items-center justify-between">
          <div className="flex items-center">
            <ClipboardList className="h-5 w-5 text-blue-600 mr-2" />
            Create New Case
          </div>
          {/* NEW: Refresh button for manual reassignment */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshAssignments}
            disabled={isReassigning}
            className="flex items-center text-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isReassigning ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* NEW: Reassignment notification */}
        {isReassigning && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
            <AlertDescription className="text-amber-800">
              Reassigning healthcare professionals due to availability changes...
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-md font-medium flex items-center">
              <User className="h-4 w-4 mr-2 text-blue-500" />
              Patient Information
              <span className="ml-2 text-sm text-gray-500">
                ({formData.patients.length} patient
                {formData.patients.length > 1 ? "s" : ""})
              </span>
            </h3>

            {formData.patients.map((patient, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 rounded-md"
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold">
                    Patient #{index + 1}
                  </h4>
                  {formData.patients.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => removePatient(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`patientName-${index}`} className="text-sm">
                      Patient Name
                    </Label>
                    <Input
                      id={`patientName-${index}`}
                      value={patient.patientName}
                      onChange={(e) =>
                        updatePatient(index, "patientName", e.target.value)
                      }
                      className="focus:border-blue-300 focus:ring-blue-500"
                      placeholder="Enter patient's full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`emrNumber-${index}`} className="text-sm">
                      EMR Number (must be unique)
                    </Label>
                    <Input
                      id={`emrNumber-${index}`}
                      value={patient.emrNumber}
                      onChange={(e) =>
                        updatePatient(index, "emrNumber", e.target.value)
                      }
                      className="focus:border-blue-300 focus:ring-blue-500"
                      placeholder="Enter patient's EMR number"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`chiefComplaint-${index}`}
                      className="text-sm"
                    >
                      Chief Complaint
                    </Label>
                    <Input
                      id={`chiefComplaint-${index}`}
                      value={patient.chiefComplaint}
                      onChange={(e) =>
                        updatePatient(index, "chiefComplaint", e.target.value)
                      }
                      className="focus:border-blue-300 focus:ring-blue-500"
                      placeholder="Enter chief complaint"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="mt-2 border-blue-200 text-blue-600 hover:bg-blue-50"
              onClick={addPatient}
            >
              <User className="h-4 w-4 mr-2" />
              Add Another Patient
            </Button>
          </div>
          <Separator />

          <div className="space-y-4">
            <h3 className="text-md font-medium flex items-center">
              <ListFilter className="h-4 w-4 mr-2 text-blue-500" />
              Case Details
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Consultation Type</Label>
                <RadioGroup
                  defaultValue="tele"
                  className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-6"
                  value={formData.consultationType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      consultationType: value,
                    }))
                  }
                >
                  <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50">
                    <RadioGroupItem
                      value="tele"
                      id="tele"
                      className="text-blue-600"
                    />
                    <Label
                      htmlFor="tele"
                      className="flex items-center cursor-pointer"
                    >
                      <Video className="h-4 w-4 mr-2 text-blue-500" />
                      Tele Consultation
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50">
                    <RadioGroupItem
                      value="audio"
                      id="audio"
                      className="text-blue-600"
                    />
                    <Label
                      htmlFor="audio"
                      className="flex items-center cursor-pointer"
                    >
                      <Phone className="h-4 w-4 mr-2 text-blue-500" />
                      Audio Consultation
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contactInfo"
                  className="text-sm flex items-center"
                >
                  {formData.consultationType === "tele" ? (
                    <>
                      <Video className="h-4 w-4 mr-2 text-blue-500" />
                      Google Meet Link
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4 mr-2 text-blue-500" />
                      Patient Phone Number
                    </>
                  )}
                </Label>
                <Input
                  id="contactInfo"
                  name="contactInfo"
                  type={formData.consultationType === "tele" ? "url" : "tel"}
                  value={formData.contactInfo}
                  onChange={handleChange}
                  className="focus:border-blue-300 focus:ring-blue-500"
                  required
                  placeholder={
                    formData.consultationType === "tele"
                      ? "https://meet.google.com/..."
                      : "10-digit phone number"
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.consultationType === "tele"
                    ? "Must contain 'meet.google.com'"
                    : "Must be 10 digits"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-blue-500" />
                  Additional Notes
                </Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-300 focus:outline-none"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Enter any additional information about the case"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-md font-medium flex items-center">
              <Info className="h-4 w-4 mr-2 text-blue-500" />
              Assigned Healthcare Professionals
              {/* NEW: Real-time status indicator */}
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                Live Status
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Stethoscope className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Assigned Doctor
                    </p>
                    {assignedDoctor ? (
                      <div className="space-y-1">
                        <p className="font-medium text-blue-700">
                          {assignedDoctor.name}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                            {assignedDoctor.type}
                          </span>
                          {assignedDoctor.availabilityStatus && (
                            <DoctorStatusIndicator
                              status={assignedDoctor.availabilityStatus}
                              caseCount={assignedDoctor.caseCount}
                            />
                          )}
                          {/* NEW: Indicator if doctor is unavailable */}
                          {!isDoctorAvailable(assignedDoctor) && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full animate-pulse">
                              Reassigning...
                            </span>
                          )}
                        </div>
                      </div>
                    ) : doctorSearchAttempted ? (
                      <div className="text-amber-600 flex items-center space-x-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>No available doctor found</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Finding available doctor...</span>
                      </div>
                    )}
                  </div>
                </div>

                {doctorsData.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      All Doctors
                    </p>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                      {doctorsData.map((doctor) => (
                        (doctor.isHierarchy || doctorFallbackAssignment) && (<div
                          key={doctor.id}
                          className="flex items-center justify-between bg-white p-2 rounded text-sm border border-gray-100"
                        >
                          <div className="flex items-center">
                            {getStatusIcon(doctor.availabilityStatus)}
                            <span className="ml-2">{doctor.name}</span>
                            {doctor.isHierarchy && (
                              <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                                {doctor.isHierarchy}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              (doctor.caseCount || 0) >= 10
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {doctor.caseCount || 0}/10
                          </span>
                        </div>
                      )
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Pill className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Assigned Pharmacist
                    </p>
                    {assignedPharmacist ? (
                      <div className="space-y-1">
                        <p className="font-medium text-green-700">
                          {assignedPharmacist.name}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                            {assignedPharmacist.type}
                          </span>
                          {assignedPharmacist.availabilityStatus && (
                            <PharmacistStatusIndicator
                              status={assignedPharmacist.availabilityStatus}
                              caseCount={assignedPharmacist.caseCount}
                            />
                          )}
                          {/* NEW: Indicator if pharmacist is unavailable */}
                          {!isPharmacistAvailable(assignedPharmacist) && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full animate-pulse">
                              Reassigning...
                            </span>
                          )}
                        </div>
                      </div>
                    ) : pharmacistSearchAttempted ? (
                      <div className="text-amber-600 flex items-center space-x-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>No available pharmacist found</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Finding available pharmacist...</span>
                      </div>
                    )}
                  </div>
                </div>

                {pharmacistsData.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      All Pharmacists
                    </p>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                      {pharmacistsData.map((pharmacist) => (
                        (pharmacist.isHierarchy || pharmaFallbackAssignment) && (<div
                          key={pharmacist.id}
                          className="flex items-center justify-between bg-white p-2 rounded text-sm border border-gray-100"
                        >
                          <div className="flex items-center">
                            {getStatusIcon(pharmacist.availabilityStatus)}
                            <span className="ml-2">{pharmacist.name}</span>
                            {pharmacist.isHierarchy && (
                              <span className="ml-2 text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">
                                {pharmacist.isHierarchy}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              (pharmacist.caseCount || 0) >= 10
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {pharmacist.caseCount || 0}/10
                          </span>
                        </div>
                      )))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              disabled={
                loading || 
                validating || 
                !assignedDoctor || 
                !assignedPharmacist ||
                isReassigning ||
                !isDoctorAvailable(assignedDoctor) ||
                !isPharmacistAvailable(assignedPharmacist)
              }
              className="bg-blue-600 hover:bg-blue-700 flex items-center"
            >
              {loading || validating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {validating ? "Validating EMR..." : "Creating..."}
                </>
              ) : isReassigning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Reassigning...
                </>
              ) : (
                <>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Create {formData.patients.length > 1 ? `${formData.patients.length} Cases` : "Case"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default NurseCaseForm;