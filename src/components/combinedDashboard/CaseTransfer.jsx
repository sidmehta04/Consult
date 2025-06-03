import React, { useState, useEffect } from "react";
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

const CaseTransferMain = ({ currentUser }) => {
  const [cases, setCases] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQueue, setSelectedQueue] = useState("all");
  const [selectedClinic, setSelectedClinic] = useState("all");
  const [clinics, setClinics] = useState([]);

  // Check if user has permission to transfer cases
  const canTransferCases = currentUser?.role === "teamLeader";

  useEffect(() => {
    if (canTransferCases && firestore) {
      const unsubscribeCases = setupCasesListener();
      const unsubscribeDoctors = setupDoctorsListener();
      const unsubscribeClinics = setupClinicsListener();

      return () => {
        unsubscribeCases?.();
        unsubscribeDoctors?.();
        unsubscribeClinics?.();
      };
    }
  }, [currentUser, canTransferCases]);

  const setupCasesListener = () => {
    try {
      setLoading(true);
      setError("");

      const casesCollection = collection(firestore, "cases");

      // Real-time listener for doctor pending cases
      const doctorPendingQuery = query(
        casesCollection,
        where("status", "==", "pending"),
        where("doctorCompleted", "==", false),
        where("isIncomplete", "!=", true),
        orderBy("createdAt", "desc")
      );

      // Real-time listener for pharmacist pending cases
      const pharmacistPendingQuery = query(
        casesCollection,
        where("status", "==", "doctor_completed"),
        where("isIncomplete", "!=", true),
        orderBy("isIncomplete"),
        orderBy("createdAt", "desc")
      );

      let doctorCases = [];
      let pharmacistCases = [];
      let doctorLoaded = false;
      let pharmacistLoaded = false;

      const updateCases = () => {
        if (doctorLoaded && pharmacistLoaded) {
          const allCases = [...doctorCases, ...pharmacistCases];
          allCases.sort((a, b) => b.createdAt - a.createdAt);
          setCases(allCases);
          setLoading(false);
        }
      };

      // Doctor cases listener
      const unsubscribeDoctor = onSnapshot(
        doctorPendingQuery,
        (snapshot) => {
          doctorCases = [];
          snapshot.forEach((doc) => {
            const caseData = doc.data();
            doctorCases.push({
              id: doc.id,
              ...caseData,
              queue: "doctor",
              createdAt: caseData.createdAt?.toDate() || new Date(),
              doctorCompletedAt: caseData.doctorCompletedAt?.toDate() || null,
              pharmacistCompletedAt: caseData.pharmacistCompletedAt?.toDate() || null,
              clinicCode: caseData.clinicCode || "N/A",
            });
          });
          doctorLoaded = true;
          updateCases();
        },
        (error) => {
          console.error("Error in doctor cases listener:", error);
          setError("Failed to load doctor queue cases.");
          setLoading(false);
        }
      );

      // Pharmacist cases listener
      const unsubscribePharmacist = onSnapshot(
        pharmacistPendingQuery,
        (snapshot) => {
          pharmacistCases = [];
          snapshot.forEach((doc) => {
            const caseData = doc.data();
            pharmacistCases.push({
              id: doc.id,
              ...caseData,
              queue: "pharmacist",
              createdAt: caseData.createdAt?.toDate() || new Date(),
              doctorCompletedAt: caseData.doctorCompletedAt?.toDate() || null,
              pharmacistCompletedAt: caseData.pharmacistCompletedAt?.toDate() || null,
            });
          });
          pharmacistLoaded = true;
          updateCases();
        },
        (error) => {
          console.error("Error in pharmacist cases listener:", error);
          setError("Failed to load pharmacist queue cases.");
          setLoading(false);
        }
      );

      // Return cleanup function
      return () => {
        unsubscribeDoctor();
        unsubscribePharmacist();
      };
    } catch (err) {
      console.error("Error setting up cases listener:", err);
      setError("Failed to setup real-time case updates.");
      setLoading(false);
      return () => {};
    }
  };

  const setupClinicsListener = () => {
    try {
      // Real-time listener for clinics from cases
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
          
          const clinicsList = Array.from(clinicCodes).sort().map(code => ({
            code,
            name: code // You can enhance this to get clinic names from a separate collection
          }));
          
          setClinics(clinicsList);
        },
        (error) => {
          console.error("Error in clinics listener:", error);
          setError("Failed to load clinic data.");
        }
      );

      return unsubscribeClinics;
    } catch (err) {
      console.error("Error setting up clinics listener:", err);
      setError("Failed to setup real-time clinic updates.");
      return () => {};
    }
}

  const setupDoctorsListener = () => {
    try {
      // Real-time listener for doctors
      const doctorsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "doctor")
      );

      // Real-time listener for active cases to get case counts
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
          // Calculate case counts
          const doctorCaseCounts = {};
          activeCasesData.forEach((caseData) => {
            const doctorId = caseData.assignedDoctors?.primary;
            if (doctorId) {
              doctorCaseCounts[doctorId] = (doctorCaseCounts[doctorId] || 0) + 1;
            }
          });

          // Create doctors list with case counts
          const doctorsList = doctorsData.map((doctor) => ({
            ...doctor,
            caseCount: doctorCaseCounts[doctor.id] || 0,
            isAvailable:
              (doctor.availabilityStatus === "available" ||
                doctor.availabilityStatus === "busy") &&
              doctor.availabilityStatus !== "unavailable" &&
              doctor.availabilityStatus !== "on_break" &&
              (doctorCaseCounts[doctor.id] || 0) < 10,
          }));

          // Sort by availability and case count
          doctorsList.sort((a, b) => {
            if (a.isAvailable && !b.isAvailable) return -1;
            if (!a.isAvailable && b.isAvailable) return 1;
            return a.caseCount - b.caseCount;
          });

          setDoctors(doctorsList);
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
          setError("Failed to load doctors data.");
        }
      );

      // Active cases listener for counting
      const unsubscribeActiveCases = onSnapshot(
        activeCasesQuery,
        (snapshot) => {
          activeCasesData = [];
          snapshot.forEach((doc) => {
            activeCasesData.push(doc.data());
          });
          casesLoaded = true;
          updateDoctors();
        },
        (error) => {
          console.error("Error in active cases listener:", error);
          setError("Failed to load active cases count.");
        }
      );

      // Return cleanup function
      return () => {
        unsubscribeDoctors();
        unsubscribeActiveCases();
      };
    } catch (err) {
      console.error("Error setting up doctors listener:", err);
      setError("Failed to setup real-time doctor updates.");
      return () => {};
    }
  };

  const filteredCases = cases.filter((caseItem) => {
    // Filter by search term
    if (
      searchTerm &&
      !caseItem.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !caseItem.emrNumber?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !caseItem.clinicCode?.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    // Filter by queue
    if (selectedQueue !== "all" && caseItem.queue !== selectedQueue) {
      return false;
    }

    // Filter by clinic
    if (selectedClinic !== "all" && caseItem.clinicCode !== selectedClinic) {
      return false;
    }

    return true;
  });

  const handleSuccess = (message) => {
    setSuccess(message);
    setError("");
    // Clear success message after 5 seconds
    setTimeout(() => setSuccess(""), 5000);
  };

  const handleError = (message) => {
    setError(message);
    setSuccess("");
  };

  // Add a check for firestore initialization
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
        error={error}
        success={success}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedQueue={selectedQueue}
        setSelectedQueue={setSelectedQueue}
        selectedClinic={selectedClinic}
        setSelectedClinic={setSelectedClinic}
        clinics={clinics}
        onRefresh={() => {
          // Refresh will happen automatically via listeners
          setError("");
          setSuccess("Data refreshed successfully!");
        }}
      />

      <CaseTransferTable
        cases={filteredCases}
        doctors={doctors}
        loading={loading}
        currentUser={currentUser}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </div>
  );
};



export default CaseTransferMain;