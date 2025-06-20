import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList,
  AlertCircle,
  Phone,
  Video,
  User,
  FileText,
  ArrowLeft,
  Calendar,
  Clock,
  CheckIcon,
  Building,
  Pill,
  Stethoscope,
  Coffee,
  UserCheck,
  UserX,
  Users,
  X,
  ShieldAlert,
  LinkIcon,
  Info,
  
} from "lucide-react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  getDocs
} from "firebase/firestore";
import { firestore } from "../../firebase";
import { format } from "date-fns";
import PharmacistAvailabilityManager from "./PharmaManager";

const PharmacistCaseManagement = ({ currentUser }) => {
  const [activeCases, setActiveCases] = useState([]);
  const [completedCases, setCompletedCases] = useState([]);
  const [incompleteCases, setIncompleteCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentCase, setCurrentCase] = useState(null);
  const [activeTab, setActiveTab] = useState("availability");
  const [completingCase, setCompletingCase] = useState(false);
  const [pharmacistStatus, setPharmacistStatus] = useState({
    status: "available",
    lastUpdate: null,
    history: [],
  });
  // Add these state variables after the existing ones
  const [linkedCases, setLinkedCases] = useState({});
  const [viewLinkedCases, setViewLinkedCases] = useState({
    open: false,
    cases: [],
    batchTimestamp: null,
  });
  const [pendingReviewCases, setPendingReviewCases] = useState([]);
  const retryOperation = async (operation, maxRetries = 3) => {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.error(
          `Operation failed (attempt ${attempt + 1}/${maxRetries}):`,
          error
        );
        lastError = error;

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
      }
    }

    throw lastError;
  };
  useEffect(() => {
  // Auto-update pharmacist status based on case load
  const handleAutoStatusUpdate = async () => {
    try {
      // Only auto-update if status changes are needed
      if (activeCases.length >= 7 && pharmacistStatus.status === "available") {
        // Mark as busy when case load is high
        console.log("Auto-updating pharmacist status to busy - case count:", activeCases.length);
        await updatePharmacistStatus(
          "busy", 
          "Automatically marked as busy due to high case load"
        );
      } else if (activeCases.length < 7 && pharmacistStatus.status === "busy") {
        // Mark as available when case load decreases
        console.log("Auto-updating pharmacist status to available - case count:", activeCases.length);
        await updatePharmacistStatus(
          "available", 
          "Automatically marked as available due to reduced case load"
        );
      }
    } catch (err) {
      console.error("Error in pharmacist auto status update:", err);
    }
  };

  // Only run auto-update if we have valid data and avoid infinite loops
  if (activeCases.length !== undefined && pharmacistStatus.status && !loading) {
    handleAutoStatusUpdate();
  }
}, [activeCases.length, pharmacistStatus.status, loading]);

  const setPharmacistJoined = async (caseItem) => {
    //console.log(caseItem);
    try {
      const timestamp = new Date();
      const caseRef = doc(firestore, "cases", caseItem.id);

      const caseSnap = await getDoc(caseRef);
      if (!caseSnap.exists()) {
        throw new Error("Case not found");
      }
      const caseData = caseSnap.data();
      // Check if doctor has already joined
      if (caseData.pharmacistJoined) {
        console.warn("Pharmacist has already joined this case.");
        return;
      }

      const updateData = {
        pharmacistJoined: timestamp
      };

      if(caseData.batchCode){
          const casesQuery = query(
                    collection(firestore, "cases"),
                    where("batchCode", "==", caseData.batchCode)
          );
          const batchSnapshot = await getDocs(casesQuery);
          
          batchSnapshot.forEach(async (doc) => {
            const batchCaseRef = doc.ref;
            await retryOperation(() => updateDoc(batchCaseRef, updateData));
          });
      } else {
        await retryOperation(() => updateDoc(caseRef, updateData));
      }
    } catch {
      console.error("Error setting pharmacist joining time: ", err)
    }
  }

  useEffect(() => {
    const fetchPharmacistStatus = async () => {
      try {
        const docRef = doc(firestore, "users", currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setPharmacistStatus({
              status: userData.availabilityStatus || "available",
              lastUpdate: userData.lastStatusUpdate,
              history: userData.availabilityHistory || [],
            });
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error("Error fetching pharmacist status:", err);
      }
    };

    const fetchCases = async () => {
      try {
        // Query for ALL active cases assigned to this pharmacist (excluding incomplete cases)
        const allActiveCasesQuery = query(
          collection(firestore, "cases"),
          where("pharmacistId", "==", currentUser.uid),
          where("pharmacistCompleted", "==", false),
          where("isIncomplete", "!=", true) // Exclude incomplete cases from active
        );

        const allActiveCasesUnsubscribe = onSnapshot(
          allActiveCasesQuery,
          (querySnapshot) => {
            const casesData = [];
            const linkedCasesMap = {};

            querySnapshot.forEach((doc) => {
              const caseData = doc.data();

              // Process batch-created cases for linking
              if (caseData.batchCreated && caseData.batchTimestamp) {
                const batchKey = caseData.batchTimestamp.toString();

                if (!linkedCasesMap[batchKey]) {
                  linkedCasesMap[batchKey] = [];
                }

                linkedCasesMap[batchKey].push({
                  id: doc.id,
                  ...caseData,
                  createdAtFormatted: caseData.createdAt
                    ? format(caseData.createdAt.toDate(), "PPpp")
                    : "",
                  doctorCompletedAtFormatted: caseData.doctorCompletedAt
                    ? format(caseData.doctorCompletedAt.toDate(), "PPpp")
                    : "",
                });
              }

              casesData.push({
                id: doc.id,
                ...caseData,
                createdAtFormatted: caseData.createdAt
                  ? format(caseData.createdAt.toDate(), "PPpp")
                  : "",
                doctorCompletedAtFormatted: caseData.doctorCompletedAt
                  ? format(caseData.doctorCompletedAt.toDate(), "PPpp")
                  : "",
              });
            });

            setActiveCases(casesData);
            setLinkedCases(linkedCasesMap);

            // Automatically update status based on case count...
          }
        );
        const pendingReviewQuery = query(
          collection(firestore, "cases"),
          where("pharmacistId", "==", currentUser.uid),
          where("pharmacistCompleted", "==", false),
          where("isIncomplete", "!=", true) // Exclude incomplete cases
        );

        // Then in the snapshot handler, we can categorize them:
        const pendingReviewUnsubscribe = onSnapshot(
          pendingReviewQuery,
          (querySnapshot) => {
            const casesData = [];
            querySnapshot.forEach((doc) => {
              const caseData = doc.data();
              casesData.push({
                id: doc.id,
                ...caseData,
                createdAtFormatted: caseData.createdAt
                  ? format(caseData.createdAt.toDate(), "PPpp")
                  : "Not available",
                doctorCompletedAtFormatted: caseData.doctorCompletedAt
                  ? format(caseData.doctorCompletedAt.toDate(), "PPpp")
                  : "Not completed yet",
              });
            });

            // Sort cases by priority: doctor completed first, then by date
            casesData.sort((a, b) => {
              // First exclude incomplete cases from top position
              if (a.isIncomplete && !b.isIncomplete) return 1;
              if (!a.isIncomplete && b.isIncomplete) return -1;

              // Then prioritize cases where doctor has completed
              if (a.doctorCompleted && !b.doctorCompleted) return -1;
              if (!a.doctorCompleted && b.doctorCompleted) return 1;

              // If both have same doctor completion status, sort by date
              if (a.doctorCompleted && b.doctorCompleted) {
                // For doctor-completed cases, sort by doctor completion date (oldest first)
                const aDate = a.doctorCompletedAt?.toDate
                  ? a.doctorCompletedAt.toDate()
                  : new Date(0);
                const bDate = b.doctorCompletedAt?.toDate
                  ? b.doctorCompletedAt.toDate()
                  : new Date(0);
                return aDate - bDate;
              } else {
                // For pending cases, sort by creation date (oldest first)
                const aDate = a.createdAt?.toDate
                  ? a.createdAt.toDate()
                  : new Date(0);
                const bDate = b.createdAt?.toDate
                  ? b.createdAt.toDate()
                  : new Date(0);
                return aDate - bDate;
              }
            });

            setPendingReviewCases(casesData);
          }
        );
        // Query specifically for incomplete cases
        const incompleteCasesQuery = query(
          collection(firestore, "cases"),
          where("pharmacistId", "==", currentUser.uid),
          where("isIncomplete", "==", true)
        );

        const incompleteCasesUnsubscribe = onSnapshot(
          incompleteCasesQuery,
          (querySnapshot) => {
            const casesData = [];
            querySnapshot.forEach((doc) => {
              const caseData = doc.data();
              casesData.push({
                id: doc.id,
                ...caseData,
                createdAtFormatted: caseData.createdAt
                  ? format(caseData.createdAt.toDate(), "PPpp")
                  : "",
                doctorCompletedAtFormatted: caseData.doctorCompletedAt
                  ? format(caseData.doctorCompletedAt.toDate(), "PPpp")
                  : "",
              });
            });

            // Sort by doctor completion date (newest first)
            casesData.sort(
              (a, b) =>
                b.doctorCompletedAt?.toDate() - a.doctorCompletedAt?.toDate()
            );
            setIncompleteCases(casesData);
          }
        );

        // Query for completed cases (both doctor and pharmacist completed)
        const completedQuery = query(
          collection(firestore, "cases"),
          where("pharmacistId", "==", currentUser.uid),
          where("pharmacistCompleted", "==", true)
        );

        const completedUnsubscribe = onSnapshot(
          completedQuery,
          (querySnapshot) => {
            const casesData = [];
            querySnapshot.forEach((doc) => {
              const caseData = doc.data();
              casesData.push({
                id: doc.id,
                ...caseData,
                createdAtFormatted: caseData.createdAt
                  ? format(caseData.createdAt.toDate(), "PPpp")
                  : "",
                doctorCompletedAtFormatted: caseData.doctorCompletedAt
                  ? format(caseData.doctorCompletedAt.toDate(), "PPpp")
                  : "",
                pharmacistCompletedAtFormatted: caseData.pharmacistCompletedAt
                  ? format(caseData.pharmacistCompletedAt.toDate(), "PPpp")
                  : "",
              });
            });

            // Sort by pharmacist completion date (newest first)
            casesData.sort(
              (a, b) =>
                b.pharmacistCompletedAt?.toDate() -
                a.pharmacistCompletedAt?.toDate()
            );
            setCompletedCases(casesData);
            setLoading(false);
          }
        );

        return () => {
          allActiveCasesUnsubscribe();
          pendingReviewUnsubscribe();
          incompleteCasesUnsubscribe();
          completedUnsubscribe();
        };
      } catch (err) {
        console.error("Error fetching cases:", err);
        setError("Failed to load cases");
        setLoading(false);
      }
    };

    const unsubscribeStatus = fetchPharmacistStatus();
    const unsubscribeCases = fetchCases();

    return () => {
      if (typeof unsubscribeStatus === "function") unsubscribeStatus();
      if (typeof unsubscribeCases === "function") unsubscribeCases();
    };
  }, [currentUser.uid]);
  const handleStartReview = (caseItem) => {
    setCurrentCase(caseItem);
  };

  const handlePharmacistIncomplete = async (caseId) => {
    if (!caseId) return;

    try {
      setCompletingCase(true);

      // First get the current case data to check doctor completion
      const caseRef = doc(firestore, "cases", caseId);
      const caseSnap = await getDoc(caseRef);

      if (!caseSnap.exists()) {
        throw new Error("Case not found");
      }

      const caseData = caseSnap.data();

      // Enhanced check for doctor completion - check both the flag and the timestamp
      if (!caseData.doctorCompleted || !caseData.doctorCompletedAt) {
        setError(
          "This case cannot be marked incomplete until the doctor has completed their review."
        );
        setCompletingCase(false);
        return;
      }

      // Check for incomplete flag
      if (caseData.isIncomplete) {
        setError(
          "This case has been marked as incomplete by the doctor and cannot be marked incomplete by you."
        );
        setCompletingCase(false);
        return;
      }

      // Check if already completed
      if (caseData.pharmacistCompleted) {
        setError("This case has already been completed.");
        setCompletingCase(false);
        return;
      }

      const timestamp = new Date();
      const currentVersion = caseData.version || 0;

      try {
        await retryOperation(() =>
          updateDoc(caseRef, {
            pharmacistCompleted: true,
            inPharmacistPendingReview: false,
            status: "pharmacist_incomplete",
            pharmacistCompletedAt: timestamp,
            pharmacistCompletedBy: currentUser.uid,
            pharmacistCompletedByName: currentUser.displayName || "Pharmacist",
            version: currentVersion + 1,
            isIncomplete: true
          })
        );
      } catch (err) {
        console.error("Error updating case after retries:", err);
        setError(
          "Failed to update case after multiple attempts. Please try again."
        );
        setCompletingCase(false);
        return;
      }

      setCurrentCase(null);
      setCompletingCase(false);

      
    } catch (err) {
      console.error("Error completing case:", err);
      setError("Failed to complete case");
      setCompletingCase(false);
    }

  }

  const handleCompleteCase = async (caseId) => {
    if (!caseId) return;

    try {
      setCompletingCase(true);

      // First get the current case data to check doctor completion
      const caseRef = doc(firestore, "cases", caseId);
      const caseSnap = await getDoc(caseRef);

      if (!caseSnap.exists()) {
        throw new Error("Case not found");
      }

      const caseData = caseSnap.data();

      // Enhanced check for doctor completion - check both the flag and the timestamp
      if (!caseData.doctorCompleted || !caseData.doctorCompletedAt) {
        setError(
          "This case cannot be completed until the doctor has completed their review."
        );
        setCompletingCase(false);
        return;
      }

      // Check for incomplete flag
      if (caseData.isIncomplete) {
        setError(
          "This case has been marked as incomplete by the doctor and cannot be completed."
        );
        setCompletingCase(false);
        return;
      }

      // Check if already completed
      if (caseData.pharmacistCompleted) {
        setError("This case has already been completed.");
        setCompletingCase(false);
        return;
      }

      const timestamp = new Date();
      const currentVersion = caseData.version || 0;

      try {
        await retryOperation(() =>
          updateDoc(caseRef, {
            pharmacistCompleted: true,
            inPharmacistPendingReview: false,
            status: "completed",
            pharmacistCompletedAt: timestamp,
            pharmacistCompletedBy: currentUser.uid,
            pharmacistCompletedByName: currentUser.displayName || "Pharmacist",
            version: currentVersion + 1,
          })
        );
      } catch (err) {
        console.error("Error updating case after retries:", err);
        setError(
          "Failed to update case after multiple attempts. Please try again."
        );
        setCompletingCase(false);
        return;
      }

      setCurrentCase(null);
      setCompletingCase(false);

      // Status update logic remains the same
      if (activeCases.length < 7 && pharmacistStatus.status === "busy") {
        updatePharmacistStatus(
          "available",
          "Automatically marked as available due to reduced case load"
        );
      }
    } catch (err) {
      console.error("Error completing case:", err);
      setError("Failed to complete case");
      setCompletingCase(false);
    }
  };
  const updatePharmacistStatus = async (status, reason = "") => {
    try {
      const timestamp = new Date();
      const docRef = doc(firestore, "users", currentUser.uid);

      // Get current user data
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Pharmacist profile not found");
      }

      const userData = docSnap.data();
      const history = userData.availabilityHistory || [];

      // Add new status change to history
      const statusChange = {
        previousStatus: pharmacistStatus.status,
        newStatus: status,
        changedAt: timestamp,
        reason: reason,
      };

      // Only keep the last 50 status changes
      //const updatedHistory = [statusChange, ...history].slice(0, 50);
      const updatedHistory = [statusChange, ...history];

      await updateDoc(docRef, {
        availabilityStatus: status,
        lastStatusUpdate: timestamp,
        availabilityHistory: updatedHistory,
      });
    } catch (err) {
      console.error("Error updating status:", err);
      setError("Failed to update availability status");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            Pending
          </Badge>
        );
      case "doctor_completed":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            Doctor Completed
          </Badge>
        );
      case "doctor_incomplete":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            Doctor Marked Incomplete
          </Badge>
        );
      case "pharmacist_incomplete":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            Pharmacist Marked Incomplete
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Fully Completed
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getAvailabilityBadge = () => {
    switch (pharmacistStatus.status) {
      case "available":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
            Available
          </Badge>
        );
      case "busy":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Busy
          </Badge>
        );
      case "unavailable":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <UserX className="h-3.5 w-3.5 mr-1.5" />
            Unavailable
          </Badge>
        );
      case "on_break":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            <Coffee className="h-3.5 w-3.5 mr-1.5" />
            On Break
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  // Add these functions after handleCompleteCase

  // Handle opening the linked cases dialog
  const openLinkedCasesDialog = (batchTimestamp) => {
    if (linkedCases[batchTimestamp]) {
      setViewLinkedCases({
        open: true,
        cases: linkedCases[batchTimestamp],
        batchTimestamp,
      });
    }
  };

  // Function to determine if a case has linked cases in the same batch
  const hasLinkedCases = (caseItem) => {
    if (caseItem.batchCreated && caseItem.batchTimestamp) {
      const batchKey = caseItem.batchTimestamp.toString();
      return linkedCases[batchKey] && linkedCases[batchKey].length > 1;
    }
    return false;
  };

  // Function to get number of linked cases
  const getLinkedCasesCount = (caseItem) => {
    if (caseItem.batchCreated && caseItem.batchTimestamp) {
      const batchKey = caseItem.batchTimestamp.toString();
      return linkedCases[batchKey] ? linkedCases[batchKey].length : 0;
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="bg-green-100 p-2 rounded-full">
            <Pill className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Pharmacist Dashboard</h2>
            <div className="flex items-center mt-1">
              <span className="text-sm text-gray-500 mr-2">Status:</span>
              {getAvailabilityBadge()}
              <span className="text-sm text-gray-500 ml-4 mr-2">
                Active Cases:
              </span>
              <Badge
                className={
                  activeCases.length >= 7
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }
              >
                {activeCases.length}/7
              </Badge>
            </div>
          </div>
        </div>

        {currentCase && (
          <Button
            variant="outline"
            onClick={() => setCurrentCase(null)}
            className="flex items-center border-green-200 text-green-600 hover:bg-green-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {currentCase ? (
        <Card className="border border-gray-100 shadow-md">
          <CardHeader className="bg-green-50 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center text-xl">
                <User className="h-5 w-5 text-green-600 mr-2" />
                {Array.isArray(currentCase.patientNames) ? (
                  <>
                    {currentCase.patientNames[0]}
                    {currentCase.patientCount > 1 && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-xs bg-green-50 text-green-600"
                      >
                        +{currentCase.patientCount - 1} more
                      </Badge>
                    )}
                  </>
                ) : (
                  currentCase.patientName
                )}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Total Patients:{" "}
                {Array.isArray(currentCase.patientNames)
                  ? currentCase.patientCount
                  : 1}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className="text-sm bg-green-100 text-green-800 border-green-200">
                {currentCase.consultationType === "tele"
                  ? "Tele Consultation"
                  : "Audio Consultation"}
              </Badge>
              {currentCase.isIncomplete && (
                <Badge className="text-sm bg-red-100 text-red-800 border-red-200">
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Marked Incomplete by Doctor
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patient Information */}
              <div className="space-y-4">
                <h3 className="text-md font-medium flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-green-500" />
                  Patient Details
                </h3>

                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  {Array.isArray(currentCase.patientNames) ? (
                    <div className="mb-4 border-b pb-3 border-gray-200">
                      <h4 className="font-medium text-green-700 mb-2">
                        Patient Information ({currentCase.patientCount})
                      </h4>
                      <div className="max-h-60 overflow-y-auto space-y-3">
                        {currentCase.patientNames.map((name, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-3 rounded border border-gray-100"
                          >
                            <div className="flex items-start">
                              <span className="font-medium text-gray-600 w-28">
                                Patient #{idx + 1}:
                              </span>
                              <span className="text-gray-800">{name}</span>
                            </div>
                            <div className="flex items-start">
                              <span className="font-medium text-gray-600 w-28">
                                EMR:
                              </span>
                              <span className="text-gray-800">
                                {currentCase.emrNumbers[idx]}
                              </span>
                            </div>
                            <div className="flex items-start">
                              <span className="font-medium text-gray-600 w-28">
                                Complaint:
                              </span>
                              <span className="text-gray-800">
                                {currentCase.chiefComplaints[idx]}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start">
                      <span className="font-medium text-gray-600 w-28">
                        Chief Complaint:
                      </span>
                      <span className="text-gray-800">
                        {currentCase.chiefComplaint}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start">
                    <span className="font-medium text-gray-600 w-28">
                      Clinic:
                    </span>
                    <span className="text-gray-800">
                      {currentCase.clinicName}
                    </span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-medium text-gray-600 w-28">
                      Created:
                    </span>
                    <span className="text-gray-800">
                      {currentCase.createdAtFormatted}
                    </span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-medium text-gray-600 w-28">
                      Created By:
                    </span>
                    <span className="text-gray-800">
                      {currentCase.createdByName || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-medium text-gray-600 w-28">
                      Status:
                    </span>
                    <span>{getStatusBadge(currentCase.status)}</span>
                  </div>
                </div>

                <h3 className="text-md font-medium flex items-center pt-2">
                  <FileText className="h-4 w-4 mr-2 text-green-500" />
                  Additional Notes
                </h3>

                <div className="bg-gray-50 p-4 rounded-lg min-h-[120px] whitespace-pre-wrap">
                  {currentCase.notes ? (
                    <p className="text-gray-800">{currentCase.notes}</p>
                  ) : (
                    <p className="text-gray-500 italic">
                      No additional notes provided
                    </p>
                  )}
                </div>
              </div>

              {/* Consultation Details */}
              <div className="space-y-4">
                <h3 className="text-md font-medium flex items-center">
                  <Building className="h-4 w-4 mr-2 text-green-500" />
                  Healthcare Team
                </h3>

                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Stethoscope className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Doctor</p>
                      <p className="text-gray-800">
                        {currentCase.assignedDoctors?.primaryName ||
                          "Not Assigned"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Doctor who conducted consultation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <Pill className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Pharmacist</p>
                      <p className="text-gray-800">
                        {currentCase.pharmacistName ||
                          currentUser.displayName ||
                          "You"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned for final review
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="text-md font-medium flex items-center pt-2">
                  <Clock className="h-4 w-4 mr-2 text-green-500" />
                  Case Timeline
                </h3>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Case Created</p>
                      <p className="text-sm text-gray-500">
                        {currentCase.createdAtFormatted}
                      </p>
                    </div>
                  </div>

                  {currentCase.doctorCompletedAt && (
                    <div className="flex items-start space-x-3 mt-4">
                      <div
                        className={`p-2 rounded-full ${
                          currentCase.isIncomplete
                            ? "bg-red-100"
                            : "bg-blue-100"
                        }`}
                      >
                        {currentCase.isIncomplete ? (
                          <X
                            className={`h-4 w-4 ${
                              currentCase.isIncomplete
                                ? "text-red-600"
                                : "text-blue-600"
                            }`}
                          />
                        ) : (
                          <CheckIcon className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {currentCase.isIncomplete
                            ? "Doctor Marked Incomplete"
                            : "Doctor Completion"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {currentCase.doctorCompletedAtFormatted}
                        </p>
                        {currentCase.doctorCompletedByName && (
                          <p className="text-sm text-gray-500">
                            by {currentCase.doctorCompletedByName}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {currentCase.pharmacistCompletedAt && (
                    <div className="flex items-start space-x-3 mt-4">
                      <div className="bg-green-100 p-2 rounded-full">
                        <CheckIcon className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Pharmacist Completion</p>
                        <p className="text-sm text-gray-500">
                          {currentCase.pharmacistCompletedAtFormatted}
                        </p>
                        {currentCase.pharmacistCompletedByName && (
                          <p className="text-sm text-gray-500">
                            by {currentCase.pharmacistCompletedByName}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col space-y-3 pt-4">
                  {!currentCase.pharmacistCompleted && !currentCase.isIncomplete && currentCase.doctorCompleted && !completingCase && (
                      <Button
                        onClick={() => handlePharmacistIncomplete(currentCase.id)}
                        disabled={
                          completingCase || !currentCase.doctorCompleted
                        }
                        className="w-full bg-amber-600 hover:bg-amber-700 flex items-center justify-center"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Mark as Incomplete
                      </Button>
                    )
                  }
                  
                  {!currentCase.pharmacistCompleted &&
                    !currentCase.isIncomplete && (
                      <Button
                        onClick={() => handleCompleteCase(currentCase.id)}
                        disabled={
                          completingCase || !currentCase.doctorCompleted
                        }
                        className="w-full bg-green-600 hover:bg-green-700 flex items-center justify-center"
                      >
                        {completingCase ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckIcon className="h-4 w-4 mr-2" />
                            {currentCase.doctorCompleted
                              ? "Complete Pharmacist Review"
                              : "Waiting for Doctor Completion"}
                          </>
                        )}
                      </Button>
                    )
                  }

                  {currentCase.isIncomplete && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                      <p className="text-red-700 text-sm font-medium flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        This case was marked as incomplete by the doctor and
                        requires no further action.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          defaultValue={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2">
            <TabsTrigger
              value="availability"
              className={
                activeTab === "availability"
                  ? "bg-green-100 text-green-800"
                  : ""
              }
            >
              Availability
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className={
                activeTab === "active" ? "bg-green-100 text-green-800" : ""
              }
            >
              Pending Review ({pendingReviewCases.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="availability" className="mt-6">
            <PharmacistAvailabilityManager currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <Card className="border border-gray-100 shadow-md">
              <CardHeader className="bg-gray-50 pb-4">
                <CardTitle className="text-lg flex items-center">
                  <ClipboardList className="h-5 w-5 text-green-600 mr-2" />
                  Cases Pending Pharmacist Review
                </CardTitle>
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  Reminder: Remember to start recording when joining the case
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
                {pendingReviewCases.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="bg-green-50 p-4 rounded-full">
                        <Pill className="h-8 w-8 text-green-300" />
                      </div>
                      <p className="text-lg">No cases pending your review.</p>
                      <p className="text-sm text-gray-500">
                        Cases that doctors have completed will appear here for
                        your review.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="font-semibold">
                            Patients
                          </TableHead>
                          <TableHead className="font-semibold">EMRs</TableHead>
                          <TableHead className="font-semibold">
                            Complaints
                          </TableHead>
                          <TableHead className="font-semibold">
                            Contact Info
                          </TableHead>
                          <TableHead className="font-semibold">
                            Clinic
                          </TableHead>
                          <TableHead className="font-semibold">
                            Doctor
                          </TableHead>
                          <TableHead className="font-semibold">
                            Completed
                          </TableHead>
                          <TableHead className="font-semibold">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingReviewCases.map((caseItem) => (
                          <TableRow
                            key={caseItem.id}
                            className="hover:bg-gray-50"
                          >
                            <TableCell className="font-medium">
                              <div className="flex flex-col space-y-1">
                                {Array.isArray(caseItem.patientNames) ? (
                                  <>
                                    <div className="flex items-center">
                                      <User className="h-4 w-4 text-gray-400 mr-2" />
                                      {caseItem.patientNames[0]}
                                      {caseItem.patientCount > 1 && (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 text-xs"
                                        >
                                          +{caseItem.patientCount - 1} more
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center">
                                    <User className="h-4 w-4 text-gray-400 mr-2" />
                                    {caseItem.patientName}
                                    {hasLinkedCases(caseItem) && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 text-xs cursor-pointer hover:bg-green-50"
                                        onClick={() =>
                                          openLinkedCasesDialog(
                                            caseItem.batchTimestamp.toString()
                                          )
                                        }
                                      >
                                        <LinkIcon className="h-3 w-3 mr-1" />
                                        Batch ({getLinkedCasesCount(caseItem)})
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                {caseItem.batchCreated && (
                                  <div className="text-xs text-gray-500">
                                    Patient {caseItem.batchIndex + 1} of{" "}
                                    {caseItem.batchSize}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              {Array.isArray(caseItem.emrNumbers) ? (
                                <div className="flex flex-col space-y-1">
                                  <div>{caseItem.emrNumbers[0]}</div>
                                  {caseItem.emrNumbers.length > 1 && (
                                    <span className="text-xs text-gray-500">
                                      +{caseItem.emrNumbers.length - 1} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                caseItem.emrNumber
                              )}
                            </TableCell>

                            <TableCell className="max-w-[150px] truncate">
                              {Array.isArray(caseItem.chiefComplaints) ? (
                                <div className="flex flex-col space-y-1">
                                  <div className="truncate">
                                    {caseItem.chiefComplaints[0]}
                                  </div>
                                  {caseItem.chiefComplaints.length > 1 && (
                                    <span className="text-xs text-gray-500">
                                      +{caseItem.chiefComplaints.length - 1}{" "}
                                      more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                caseItem.chiefComplaint
                              )}
                            </TableCell>
                            <TableCell>
                              {caseItem.consultationType === "tele" ? (
                                <Button
                                  asChild
                                  className="w-full bg-blue-600 hover:bg-blue-700"
                                  onClick={() => {
                                    setPharmacistJoined(caseItem);
                                  }}
                                >
                                  <a
                                    href={caseItem.contactInfo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center"
                                  >
                                    <Video className="h-4 w-4 mr-2" /> Join
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  asChild
                                  className="w-full bg-blue-600 hover:bg-blue-700"
                                  onClick={() => {
                                    setPharmacistJoined(caseItem);
                                  }}
                                >
                                  <a
                                    href={`tel:${caseItem.contactInfo}`}
                                    className="flex items-center justify-center"
                                  >
                                    <Phone className="h-4 w-4 mr-2" /> Call Patient
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>{caseItem.clinicName}</TableCell>
                            <TableCell>
                              {caseItem.assignedDoctors?.primaryName ||
                                "Unknown"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-sm">
                                <Calendar className="h-3.5 w-3.5 text-gray-400 mr-1.5" />
                                {caseItem.doctorCompletedAt
                                  ? new Date(
                                      caseItem.doctorCompletedAt.toDate()
                                    ).toLocaleDateString()
                                  : "Not done yet"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleStartReview(caseItem)}
                                  className="flex items-center bg-green-600 hover:bg-green-700"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Review Case
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
      {/* Add this dialog right before the final closing div tag */}
      <Dialog
        open={viewLinkedCases.open}
        onOpenChange={(open) =>
          setViewLinkedCases({ ...viewLinkedCases, open })
        }
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <LinkIcon className="h-5 w-5 text-green-500 mr-2" />
              Batch Cases
            </DialogTitle>
            <DialogDescription>
              All patients created in the same batch
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border-t border-b border-gray-100 py-4">
            <div className="flex items-center mb-4 space-x-2">
              <Info className="h-4 w-4 text-green-500" />
              <p className="text-sm text-gray-600">
                These cases were created together in the same batch and share
                the same contact information.
              </p>
            </div>

            <div className="overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="font-semibold">Patient</TableHead>
                    <TableHead className="font-semibold">EMR</TableHead>
                    <TableHead className="font-semibold">Complaint</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewLinkedCases.cases.map((caseItem) => (
                    <TableRow key={caseItem.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          {caseItem.patientName}
                        </div>
                      </TableCell>
                      <TableCell>{caseItem.emrNumber}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {caseItem.chiefComplaint}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            caseItem.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : caseItem.status === "doctor_completed"
                              ? "bg-amber-100 text-amber-800"
                              : caseItem.status === "doctor_incomplete" || caseItem.status === "pharmacist_incomplete"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {getStatusBadge(caseItem.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => {
                              setViewLinkedCases({
                                open: false,
                                cases: [],
                                batchTimestamp: null,
                              });
                              handleStartReview(caseItem);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" /> View
                          </Button>
                          {caseItem.doctorCompleted &&
                            !caseItem.pharmacistCompleted &&
                            !caseItem.isIncomplete && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => {
                                  setViewLinkedCases({
                                    open: false,
                                    cases: [],
                                    batchTimestamp: null,
                                  });
                                  handleCompleteCase(caseItem.id);
                                }}
                              >
                                <CheckIcon className="h-4 w-4 mr-1" /> Complete
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setViewLinkedCases({
                  open: false,
                  cases: [],
                  batchTimestamp: null,
                })
              }
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PharmacistCaseManagement;
