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
  getDocs,
} from "firebase/firestore";
import { firestore } from "../../firebase";
import { format } from "date-fns";
import DoctorAvailabilityManager from "./DovAvailability";

const DoctorCaseManagement = ({ currentUser }) => {
  const [activeCases, setActiveCases] = useState([]);
  const [completedCases, setCompletedCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentCase, setCurrentCase] = useState(null);
  const [activeTab, setActiveTab] = useState("availability");
  const [completingCase, setCompletingCase] = useState(false);
  const [doctorStatus, setDoctorStatus] = useState({
    availabilityStatus: "available",
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
  const [isMarkingIncomplete, setIsMarkingIncomplete] = useState(false);
  const [pendingReviewCases, setPendingReviewCases] = useState([]);
  const [incompleteReason, setIncompleteReason] = useState("");
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
    // Auto-update doctor status based on case load
    const handleAutoStatusUpdate = async () => {
      try {
        // Only auto-update if status changes are needed
        if (activeCases.length >= 10 && doctorStatus.status === "available") {
          // Mark as busy when case load is high
          console.log(
            "Auto-updating status to busy - case count:",
            activeCases.length
          );
          await updateDoctorStatus(
            "busy",
            "Automatically marked as busy due to high case load"
          );
        } else if (activeCases.length < 10 && doctorStatus.status === "busy") {
          // Mark as available when case load decreases
          console.log(
            "Auto-updating status to available - case count:",
            activeCases.length
          );
          await updateDoctorStatus(
            "available",
            "Automatically marked as available due to reduced case load"
          );
        }
      } catch (err) {
        console.error("Error in auto status update:", err);
      }
    };

    // Only run auto-update if we have valid data and avoid infinite loops
    if (activeCases.length !== undefined && doctorStatus.status && !loading) {
      handleAutoStatusUpdate();
    }
  }, [activeCases.length, doctorStatus.status, loading]);

  useEffect(() => {
    const fetchDoctorStatus = async () => {
      try {
        const docRef = doc(firestore, "users", currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setDoctorStatus({
              status: userData.availabilityStatus || "available",
              lastUpdate: userData.lastStatusUpdate,
              history: userData.availabilityHistory || [],
            });
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error("Error fetching doctor status:", err);
      }
    };

    const fetchCases = async () => {
      try {
        // Query for active cases (pending) assigned to this doctor
        const activeQuery = query(
          collection(firestore, "cases"),
          where("assignedDoctors.primary", "==", currentUser.uid),
          where("doctorCompleted", "==", false)
        );

        // Query for completed cases (doctor completed but still waiting for pharmacist)
        // Exclude cases marked as incomplete
        const completedQuery = query(
          collection(firestore, "cases"),
          where("assignedDoctors.primary", "==", currentUser.uid),
          where("doctorCompleted", "==", true),
          where("pharmacistCompleted", "==", false),
          where("status", "==", "doctor_completed") // Only show properly completed cases
        );

        // In the activeQuery onSnapshot handler, replace the existing code with:
        const unsubscribeActive = onSnapshot(activeQuery, (querySnapshot) => {
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
                createdAtFormatted:
                  caseData.createdAt &&
                  typeof caseData.createdAt.toDate === "function"
                    ? format(caseData.createdAt.toDate(), "PPpp")
                    : "Not available",
                doctorCompletedAtFormatted: caseData.doctorCompletedAt
                  ? format(caseData.doctorCompletedAt.toDate(), "PPpp")
                  : null,
              });
            }

            casesData.push({
              id: doc.id,
              ...caseData,
              createdAtFormatted:
                caseData.createdAt &&
                typeof caseData.createdAt.toDate === "function"
                  ? format(caseData.createdAt.toDate(), "PPpp")
                  : "Not available",
            });
          });

          // Sort by creation date (oldest first so doctors see oldest cases first)
          casesData.sort(
            (a, b) => a.createdAt?.toDate() - b.createdAt?.toDate()
          );
          
          setActiveCases(casesData);
          setLinkedCases(linkedCasesMap);

          // Automatically update status to busy if case load is high...
        });
        // Add these functions before the return statement

        const unsubscribeCompleted = onSnapshot(
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
              });
            });

            // Sort by doctor completion date (newest first)
            casesData.sort(
              (a, b) =>
                b.doctorCompletedAt?.toDate() - a.doctorCompletedAt?.toDate()
            );
            setCompletedCases(casesData);
            // Use these same cases for the pendingReviewCases state
            setPendingReviewCases(casesData);
            setLoading(false);
          }
        );

        return () => {
          unsubscribeActive();
          unsubscribeCompleted();
        };
      } catch (err) {
        console.error("Error fetching cases:", err);
        setError("Failed to load cases");
        setLoading(false);
      }
    };

    const unsubscribeStatus = fetchDoctorStatus();
    const unsubscribeCases = fetchCases();

    return () => {
      if (typeof unsubscribeStatus === "function") unsubscribeStatus();
      if (typeof unsubscribeCases === "function") unsubscribeCases();
    };
  }, [currentUser.uid]);

  const handleStartConsultation = (caseItem) => {
    setCurrentCase(caseItem);
  };
  const handleStartReview = (caseItem) => {
    setCurrentCase(caseItem);
  };

  const doctorJoined = async (caseItem) => {
    try {
      const timestamp = new Date();
      const caseRef = doc(firestore, "cases", caseItem.id);

      const caseSnap = await getDoc(caseRef);

      if (!caseSnap.exists()) {
        throw new Error("Case not found");
      }
      const caseData = caseSnap.data();
      // Check if doctor has already joined
      if (caseData.doctorJoined) {
        console.warn("Doctor has already joined this case.");
        return;
      }

      const updateData = {
        doctorJoined: timestamp,
      };

      if (caseData.batchCode) {
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
      console.error("Error setting doctor joining time: ", err);
    }
  };

  const handleCompleteCase = async (caseId, isIncomplete = false) => {
    if (!caseId) return;
    if (isIncomplete && !incompleteReason) {
      setIsMarkingIncomplete(true);
      return;
    }

    try {
      setCompletingCase(true);
      const timestamp = new Date();
      const caseRef = doc(firestore, "cases", caseId);

      // Get the current case data
      const caseSnap = await getDoc(caseRef);
      if (!caseSnap.exists()) {
        throw new Error("Case not found");
      }

      const caseData = caseSnap.data();
      const currentVersion = caseData.version || 0;

      // Check if a pharmacist is assigned when marking as complete
      if (!isIncomplete && !caseData.pharmacistId) {
        setError(
          "Cannot complete this case as no pharmacist has been assigned yet."
        );
        setCompletingCase(false);
        setIsMarkingIncomplete(false);
        return;
      }

      // Update based on whether the case is marked as complete or incomplete
      if (isIncomplete) {
        // Mark as incomplete - this is the key part
        const updateData = {
          doctorCompleted: true,
          doctorCompletedAt: timestamp,
          doctorCompletedBy: currentUser.uid,
          doctorCompletedByName: currentUser.displayName || "Doctor",
          status: "doctor_incomplete",
          isIncomplete: true,
          incompleteReason: incompleteReason,
          // Remove from pharmacist pending review if marked incomplete
          inPharmacistPendingReview: false,
          version: currentVersion + 1,
        };

        try {
          await retryOperation(() => updateDoc(caseRef, updateData));
        } catch (err) {
          console.error("Error updating case after retries:", err);
          setError(
            "Failed to update case after multiple attempts. Please try again."
          );
          setCompletingCase(false);
          setIsMarkingIncomplete(false);
          return;
        }

        // Get the pharmacist ID to update their status if needed
        if (caseData.pharmacistId) {
          const pharmacistRef = doc(firestore, "users", caseData.pharmacistId);
          const pharmSnapshot = await getDoc(pharmacistRef);

          if (pharmSnapshot.exists()) {
            // Check if pharmacist's status needs to be updated by recounting their active cases
            const activeCasesQuery = query(
              collection(firestore, "cases"),
              where("pharmacistId", "==", caseData.pharmacistId),
              where("pharmacistCompleted", "==", false),
              where("isIncomplete", "!=", true) // Exclude incomplete cases
            );

            const activeCasesSnapshot = await getDocs(activeCasesQuery);
            const activeCount = activeCasesSnapshot.size;

            const pharmacistData = pharmSnapshot.data();
            // If pharmacist is busy but now has fewer than 10 active cases, update status
            if (
              pharmacistData.availabilityStatus === "busy" &&
              activeCount < 10
            ) {
              await updateDoc(pharmacistRef, {
                availabilityStatus: "available",
                lastStatusUpdate: timestamp,
                autoStatusChange: true,
              });
            }
          }
        }
      } else {
        // Check if already completed by doctor
        if (caseData.doctorCompleted) {
          setError("This case has already been completed by a doctor.");
          setCompletingCase(false);
          setIsMarkingIncomplete(false);
          return;
        }

        // Mark as complete
        const updateData = {
          doctorCompleted: true,
          doctorCompletedAt: timestamp,
          doctorCompletedBy: currentUser.uid,
          doctorCompletedByName: currentUser.displayName || "Doctor",
          status: "doctor_completed",
          isIncomplete: false,
          // This case should appear in pharmacist pending review
          inPharmacistPendingReview: true,
          version: currentVersion + 1,
        };

        try {
          await retryOperation(() => updateDoc(caseRef, updateData));
        } catch (err) {
          console.error("Error updating case after retries:", err);
          setError(
            "Failed to update case after multiple attempts. Please try again."
          );
          setCompletingCase(false);
          setIsMarkingIncomplete(false);
          return;
        }
      }

      setCurrentCase(null);
      setCompletingCase(false);
      setIsMarkingIncomplete(false);
      setIncompleteReason(""); // Reset reason

      
    } catch (err) {
      console.error("Error completing case:", err);
      setError("Failed to complete case");
      setCompletingCase(false);
      setIsMarkingIncomplete(false);
    }
  };

  const updateDoctorStatus = async (status, reason = "") => {
    try {
      const timestamp = new Date();
      const docRef = doc(firestore, "users", currentUser.uid);

      // Get current user data
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Doctor profile not found");
      }

      const userData = docSnap.data();
      const history = userData.availabilityHistory || [];

      // Add new status change to history
      const statusChange = {
        previousStatus: doctorStatus.status,
        newStatus: status,
        changedAt: timestamp,
        reason: reason,
      };

      // Removing Below:
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
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Doctor Completed
          </Badge>
        );
      case "doctor_incomplete":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            Marked Incomplete by Doctor
          </Badge>
        );
      case "pharmacist_incomplete":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            Marked Incomplete by Pharmacist
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            Fully Completed
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getAvailabilityBadge = () => {
    switch (doctorStatus.status) {
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
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
          <div className="bg-blue-100 p-2 rounded-full">
            <Stethoscope className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Doctor Dashboard</h2>
            <div className="flex items-center mt-1">
              <span className="text-sm text-gray-500 mr-2">Status:</span>
              {getAvailabilityBadge()}
              <span className="text-sm text-gray-500 ml-4 mr-2">
                Active Cases:
              </span>
              <Badge
                className={
                  activeCases.length >= 10
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }
              >
                {activeCases.length}/10
              </Badge>
            </div>
          </div>
        </div>

        {currentCase && (
          <Button
            variant="outline"
            onClick={() => setCurrentCase(null)}
            className="flex items-center border-blue-200 text-blue-600 hover:bg-blue-50"
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
          <CardHeader className="bg-blue-50 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center text-xl">
                <User className="h-5 w-5 text-blue-600 mr-2" />
                {Array.isArray(currentCase.patientNames) ? (
                  <>
                    {currentCase.patientNames[0]}
                    {currentCase.patientCount > 1 && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-xs bg-blue-50 text-blue-600"
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
            <Badge className="text-sm bg-blue-100 text-blue-800 border-blue-200">
              {currentCase.consultationType === "tele"
                ? "Tele Consultation"
                : "Audio Consultation"}
            </Badge>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patient Information */}
              <div className="space-y-4">
                <h3 className="text-md font-medium flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-blue-500" />
                  Patient Details
                </h3>

                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  {Array.isArray(currentCase.patientNames) ? (
                    <div className="mb-4 border-b pb-3 border-gray-200">
                      <h4 className="font-medium text-blue-700 mb-2">
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
                  <FileText className="h-4 w-4 mr-2 text-blue-500" />
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
                  <Building className="h-4 w-4 mr-2 text-blue-500" />
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
                          currentUser.displayName ||
                          "You"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Primary Assigned Doctor
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
                        {currentCase.pharmacistName || "Not assigned"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Will review after doctor completion
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="text-md font-medium flex items-center pt-2">
                  <Clock className="h-4 w-4 mr-2 text-blue-500" />
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
                            : "bg-green-100"
                        }`}
                      >
                        {currentCase.isIncomplete ? (
                          <X className="h-4 w-4 text-red-600" />
                        ) : (
                          <CheckIcon className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {currentCase.isIncomplete
                            ? "Marked as Incomplete"
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
                </div>

                <div className="flex flex-col space-y-3 pt-4">
                  {currentCase.consultationType === "tele" ? (
                    <Button
                      asChild
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        doctorJoined(currentCase);
                      }}
                    >
                      <a
                        href={currentCase.contactInfo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center"
                      >
                        <Video className="h-4 w-4 mr-2" /> Join Google Meet
                        Session
                      </a>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <a
                        href={`tel:${currentCase.contactInfo}`}
                        className="flex items-center justify-center"
                      >
                        <Phone className="h-4 w-4 mr-2" /> Call Patient
                      </a>
                    </Button>
                  )}

                  {!currentCase.doctorCompleted && (
                    <>
                      <Button
                        onClick={() =>
                          handleCompleteCase(currentCase.id, false)
                        }
                        disabled={completingCase}
                        className="w-full bg-green-600 hover:bg-green-700 flex items-center justify-center"
                      >
                        {completingCase && !isMarkingIncomplete ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckIcon className="h-4 w-4 mr-2" /> Mark
                            Consultation as Complete
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => setIsMarkingIncomplete(true)}
                        disabled={completingCase}
                        className="w-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
                      >
                        <X className="h-4 w-4 mr-2" /> Mark as Incomplete
                      </Button>
                    </>
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
          <TabsList className="grid grid-cols-3">
            <TabsTrigger
              value="availability"
              className={
                activeTab === "availability" ? "bg-blue-100 text-blue-800" : ""
              }
            >
              Availability Management
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className={
                activeTab === "active" ? "bg-blue-100 text-blue-800" : ""
              }
            >
              Active Cases ({activeCases.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className={
                activeTab === "completed" ? "bg-green-100 text-green-800" : ""
              }
            >
              Pending Pharmacy ({completedCases.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="availability" className="mt-6">
            <DoctorAvailabilityManager currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <Card className="border border-gray-100 shadow-md">
              <CardHeader className="bg-gray-50 pb-4">
                <CardTitle className="text-lg flex items-center">
                  <ClipboardList className="h-5 w-5 text-blue-600 mr-2" />
                  Active Cases
                </CardTitle>
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  Reminder: Remember to start recording when joining the case
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
                {activeCases.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="bg-blue-50 p-4 rounded-full">
                        <Stethoscope className="h-8 w-8 text-blue-300" />
                      </div>
                      <p className="text-lg">
                        No active cases assigned to you currently.
                      </p>
                      <p className="text-sm text-gray-500">
                        New cases will appear here when they are assigned to
                        you.
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
                            Clinic
                          </TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold">
                            Created
                          </TableHead>
                          <TableHead className="font-semibold">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeCases.map((caseItem) => (
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
                                        className="ml-2 text-xs cursor-pointer hover:bg-blue-50"
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
                              {caseItem.clinicCode ?? caseItem.clinicName}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  caseItem.consultationType === "tele"
                                    ? "default"
                                    : "outline"
                                }
                                className={
                                  caseItem.consultationType === "tele"
                                    ? "bg-indigo-100 text-indigo-800 hover:bg-indigo-100"
                                    : ""
                                }
                              >
                                {caseItem.consultationType === "tele"
                                  ? "Tele"
                                  : "Audio"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-sm">
                                <Calendar className="h-3.5 w-3.5 text-gray-400 mr-1.5" />
                                {new Date(
                                  caseItem.createdAt?.toDate()
                                ).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleStartConsultation(caseItem)
                                  }
                                  className="flex items-center bg-blue-600 hover:bg-blue-700"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Case
                                </Button>

                                {caseItem.consultationType === "tele" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      doctorJoined(caseItem);
                                    }}
                                    className="flex items-center text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                    asChild
                                  >
                                    <a
                                      href={caseItem.contactInfo}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Video className="h-4 w-4 mr-1" /> Join
                                    </a>
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      doctorJoined(caseItem);
                                    }}
                                    className="flex items-center text-blue-600 border-blue-200 hover:bg-blue-50"
                                    asChild
                                  >
                                    <a href={`tel:${caseItem.contactInfo}`}>
                                      <Phone className="h-4 w-4 mr-1" /> Call
                                    </a>
                                  </Button>
                                )}
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

          <TabsContent value="completed" className="mt-6">
            <Card className="border border-gray-100 shadow-md">
              <CardHeader className="bg-gray-50 pb-4">
                <CardTitle className="text-lg flex items-center">
                  <Pill className="h-5 w-5 text-green-600 mr-2" />
                  Awaiting Pharmacist Review
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                {completedCases.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="bg-green-50 p-4 rounded-full">
                        <CheckIcon className="h-8 w-8 text-green-300" />
                      </div>
                      <p className="text-lg">
                        No cases awaiting pharmacist review.
                      </p>
                      <p className="text-sm text-gray-500">
                        Cases you complete will show here until the pharmacist
                        reviews them.
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
                            Clinic
                          </TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold">
                            Created
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

                            <TableCell>{caseItem.contactInfo}</TableCell>
                            <TableCell>{caseItem.clinicName}</TableCell>
                            <TableCell>
                              {caseItem.assignedDoctors?.primaryName ||
                                "Unknown"}
                            </TableCell>
                            <TableCell>
                              {caseItem.doctorCompleted ? (
                                <div className="flex items-center text-sm">
                                  <CheckIcon className="h-3.5 w-3.5 text-green-500 mr-1.5" />
                                  Doc Completed
                                  <div className="text-xs text-gray-500 ml-1">
                                    {new Date(
                                      caseItem.doctorCompletedAt.toDate()
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center text-sm">
                                  <Clock className="h-3.5 w-3.5 text-amber-500 mr-1.5" />
                                  Awaiting Doctor
                                </div>
                              )}
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
      {isMarkingIncomplete && currentCase && (
        <Dialog
          open={isMarkingIncomplete}
          onOpenChange={setIsMarkingIncomplete}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <X className="h-5 w-5 text-red-500 mr-2" />
                Mark Case as Incomplete
              </DialogTitle>
              <DialogDescription>
                Please provide a reason why this case is being marked as
                incomplete.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-2">
              <label htmlFor="incompleteReason" className="text-sm font-medium">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="incompleteReason"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Please explain why this case is being marked as incomplete..."
                value={incompleteReason}
                onChange={(e) => setIncompleteReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setIsMarkingIncomplete(false);
                  setIncompleteReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (incompleteReason.trim()) {
                    handleCompleteCase(currentCase.id, true);
                  }
                }}
                disabled={!incompleteReason.trim()}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                <X className="h-4 w-4 mr-2" />
                Mark as Incomplete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Add this dialog at the end, right before the final closing div tag */}
      <Dialog
        open={viewLinkedCases.open}
        onOpenChange={(open) =>
          setViewLinkedCases({ ...viewLinkedCases, open })
        }
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <LinkIcon className="h-5 w-5 text-blue-500 mr-2" />
              Batch Cases
            </DialogTitle>
            <DialogDescription>
              All patients created in the same batch
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border-t border-b border-gray-100 py-4">
            <div className="flex items-center mb-4 space-x-2">
              <Info className="h-4 w-4 text-blue-500" />
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
                              ? "bg-blue-100 text-blue-800"
                              : caseItem.status === "doctor_incomplete" ||
                                caseItem.status === "pharmacist_incomplete"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {getStatusLabel(caseItem.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => {
                              setViewLinkedCases({
                                open: false,
                                cases: [],
                                batchTimestamp: null,
                              });
                              handleStartConsultation(caseItem);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" /> View
                          </Button>
                          {!caseItem.doctorCompleted && (
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
                                handleCompleteCase(caseItem.id, false);
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

export default DoctorCaseManagement;
