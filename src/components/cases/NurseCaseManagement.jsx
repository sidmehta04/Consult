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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  AlertCircle,
  Check,
  Phone,
  Video,
  User,
  Stethoscope,
  Pill,
  Calendar,
  Clock,
  X,
  Edit,
  LinkIcon,
  Info,
  UserPen
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { firestore } from "../../firebase";
import NurseCaseForm from "./NurseCaseForm";
import { format } from "date-fns";

const NurseCaseManagement = ({ currentUser }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [linkedCases, setLinkedCases] = useState({});

  const [confirmComplete, setConfirmComplete] = useState({
    open: false,
    caseId: null,
    type: null,
    caseData: null,
    isIncomplete: false,
    reason: "",
  });

  const [editCase, setEditCase] = useState({
    open: false,
    caseData: null,
  });

  const [viewLinkedCases, setViewLinkedCases] = useState({
    open: false,
    cases: [],
    batchTimestamp: null
  });

  const openEditDialog = (caseData) => {
    setEditCase({
      open: true,
      caseData: caseData,
    });
  };

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
    const fetchCases = async () => {
      try {
        const q = query(
          collection(firestore, "cases"),
          where("clinicId", "==", currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
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
                createdAtDate: caseData.createdAt
                  ? format(caseData.createdAt.toDate(), "PP")
                  : "",
                createdAtTime: caseData.createdAt
                  ? format(caseData.createdAt.toDate(), "p")
                  : "",
                doctorCompletedAtFormatted: caseData.doctorCompletedAt
                  ? format(caseData.doctorCompletedAt.toDate(), "PPpp")
                  : null,
                pharmacistCompletedAtFormatted: caseData.pharmacistCompletedAt
                  ? format(caseData.pharmacistCompletedAt.toDate(), "PPpp")
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
              createdAtDate: caseData.createdAt
                ? format(caseData.createdAt.toDate(), "PP")
                : "",
              createdAtTime: caseData.createdAt
                ? format(caseData.createdAt.toDate(), "p")
                : "",
              doctorCompletedAtFormatted: caseData.doctorCompletedAt
                ? format(caseData.doctorCompletedAt.toDate(), "PPpp")
                : null,
              pharmacistCompletedAtFormatted: caseData.pharmacistCompletedAt
                ? format(caseData.pharmacistCompletedAt.toDate(), "PPpp")
                : null,
            });
          });

          // Sort by creation date (newest first)
          casesData.sort(
            (a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()
          );
          
          // Update state with all cases and the linked cases map
          setCases(casesData);
          setLinkedCases(linkedCasesMap);
          setLoading(false);
        });

        return () => {
          if (typeof unsubscribe === "function") {
            unsubscribe();
          }
        };
      } catch (err) {
        console.error("Error fetching cases:", err);
        setError("Failed to load cases");
        setLoading(false);
      }
    };

    fetchCases();
  }, [currentUser.uid]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const caseData = editCase.caseData;
      
      const formData = {
        patientName: e.target.patientName.value,
        emrNumber: e.target.emrNumber.value,
        chiefComplaint: e.target.chiefComplaint.value,
        contactInfo: e.target.contactInfo.value,
        notes: e.target.notes.value,
      };

      const caseRef = doc(firestore, "cases", caseData.id);
      await updateDoc(caseRef, {
        ...formData,
        lastEdited: serverTimestamp(),
        lastEditedBy: currentUser.uid,
        lastEditedByName: currentUser.displayName || "Nurse",
      });

      setEditCase({ open: false, caseData: null });
      // Success notification could be added here
    } catch (err) {
      console.error("Error updating case:", err);
      setError("Failed to update case");
    } finally {
      setLoading(false);
    }
  };

  const handlePharmacistIncomplete = async (caseId) => {
    if (!caseId) return;

    try {

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
        return;
      }

      // Check for incomplete flag
      if (caseData.isIncomplete) {
        setError(
          "This case has been marked as incomplete by the doctor and cannot be marked incomplete by you."
        );
        return;
      }

      // Check if already completed
      if (caseData.pharmacistCompleted) {
        setError("This case has already been completed.");
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
        return;
      }

      setCurrentCase(null);

      // Status update logic remains the same
      if (activeCases.length < 10 && pharmacistStatus.status === "busy") {
        updatePharmacistStatus(
          "available",
          "Automatically marked as available due to reduced case load"
        );
      }
    } catch (err) {
      console.error("Error completing case:", err);
      setError("Failed to mark case as incomplete");
    }

  }

  const handleComplete = async () => {
    try {
      const { caseId, type, isIncomplete, reason } = confirmComplete;

      // Validate that a reason is provided when marking as incomplete
      if (isIncomplete && !reason.trim()) {
        setError("Please provide a reason for marking the case as incomplete.");
        return;
      }

      const caseRef = doc(firestore, "cases", caseId);
      const timestamp = new Date();

      // Get the current case data to verify workflow state
      const caseSnap = await getDoc(caseRef);
      if (!caseSnap.exists()) {
        throw new Error("Case not found");
      }

      const caseData = caseSnap.data();

      if (type === "doctor") {
        const updateData = {
          doctorCompleted: true,
          status: isIncomplete ? "doctor_incomplete" : "doctor_completed",
          doctorCompletedAt: timestamp,
          doctorCompletedBy: currentUser.uid,
          doctorCompletedByName: currentUser.displayName || "Nurse",
          // Always set inPharmacistPendingReview based on complete/incomplete status
          inPharmacistPendingReview: !isIncomplete,
          version: (caseData.version || 0) + 1,
        };

        // Only add isIncomplete and incompleteReason if it's true
        if (isIncomplete) {
          updateData.isIncomplete = true;
          updateData.incompleteReason = reason; // Add the reason
        }

        try {
          await retryOperation(() => updateDoc(caseRef, updateData));
        } catch (err) {
          console.error("Error updating case after retries:", err);
          setError(
            "Failed to update case after multiple attempts. Please try again."
          );
          throw err; // Rethrow to be caught by the outer try/catch
        }
      } else if (type === "pharmacist") {
        // Extra validation: Cannot complete pharmacist part if doctor hasn't completed
        if (!caseData.doctorCompleted || !caseData.doctorCompletedAt) {
          setError(
            "The doctor must complete this case before the pharmacist can be marked as complete."
          );
          setConfirmComplete({
            open: false,
            caseId: null,
            type: null,
            caseData: null,
            isIncomplete: false,
            reason: "",
          });
          return;
        }

        // Cannot complete if case is marked as incomplete by doctor
        if (caseData.isIncomplete) {
          setError(
            "This case has been marked as incomplete by the doctor and cannot be completed."
          );
          setConfirmComplete({
            open: false,
            caseId: null,
            type: null,
            caseData: null,
            isIncomplete: false,
            reason: "",
          });
          return;
        }

        // Cannot complete if already completed
        if (caseData.pharmacistCompleted) {
          setError("This case has already been completed by a pharmacist.");
          setConfirmComplete({
            open: false,
            caseId: null,
            type: null,
            caseData: null,
            isIncomplete: false,
            reason: "",
          });
          return;
        }

        const updateData = {
          pharmacistCompleted: true,
          status: isIncomplete ? "incomplete" : "completed",
          pharmacistCompletedAt: timestamp,
          pharmacistCompletedBy: currentUser.uid,
          pharmacistCompletedByName: currentUser.displayName || "Nurse",
          version: (caseData.version || 0) + 1,
        };

        // Only add isIncomplete and incompleteReason if it's true
        if (isIncomplete) {
          updateData.isIncomplete = true;
          updateData.incompleteReason = reason; // Add the reason
        }

        try {
          await retryOperation(() => updateDoc(caseRef, updateData));
        } catch (err) {
          console.error("Error updating case after retries:", err);
          setError(
            "Failed to update case after multiple attempts. Please try again."
          );
          throw err; // Rethrow to be caught by the outer try/catch
        }
      }

      setConfirmComplete({
        open: false,
        caseId: null,
        type: null,
        caseData: null,
        isIncomplete: false,
        reason: "",
      });
    } catch (err) {
      console.error("Error completing case:", err);
      setError("Failed to complete case");
      setConfirmComplete({
        open: false,
        caseId: null,
        type: null,
        caseData: null,
        isIncomplete: false,
        reason: "",
      });
    }
  };

  // Add a function to open the dialog for incomplete cases
  const openIncompleteDialog = (caseId, type, caseData) => {
    setConfirmComplete({
      open: true,
      caseId,
      type,
      caseData,
      isIncomplete: true,
      reason: "", // Initialize with empty reason
    });
  };

  const handleNewCaseCreated = () => {
    setShowForm(false);
  };

  const openConfirmDialog = (caseId, type, caseData) => {
    setConfirmComplete({
      open: true,
      caseId,
      type,
      caseData,
      isIncomplete: false,
      reason: "",
    });
  };

  // Handle opening the linked cases dialog
  const openLinkedCasesDialog = (batchTimestamp) => {
    if (linkedCases[batchTimestamp]) {
      setViewLinkedCases({
        open: true,
        cases: linkedCases[batchTimestamp],
        batchTimestamp
      });
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "doctor_completed":
        return "secondary";
      case "doctor_incomplete":
      case "pharmacist_incomplete":
      case "incomplete":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "doctor_completed":
        return "Doctor Completed";
      case "doctor_incomplete":
        return "Doctor Incomplete";
      case "pharmacist_incomplete":
        return "Pharmacist Incomplete"
      case "incomplete":
        return "Incomplete";
      default:
        return "Pending";
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <ClipboardList className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Case Management</h2>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? "View Cases" : "Create New Case"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showForm ? (
        <NurseCaseForm
          currentUser={currentUser}
          onCreateCase={handleNewCaseCreated}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
          {cases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="flex flex-col items-center space-y-4">
                <ClipboardList className="h-12 w-12 text-gray-300" />
                <p className="text-lg">
                  No cases found. Create your first case to get started.
                </p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="mt-2 bg-blue-600 hover:bg-blue-700"
                >
                  Create New Case
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="font-semibold">Patient</TableHead>
                    <TableHead className="font-semibold">EMR</TableHead>
                    <TableHead className="font-semibold">Complaint</TableHead>
                    <TableHead className="font-semibold">Assigned To</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((caseItem) => (
                    <TableRow key={caseItem.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center">
                            <User className="h-4 w-4 text-gray-400 mr-2" />
                            {caseItem.patientName}
                            {hasLinkedCases(caseItem) && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-xs cursor-pointer hover:bg-blue-50"
                                onClick={() => openLinkedCasesDialog(caseItem.batchTimestamp.toString())}
                              >
                                <LinkIcon className="h-3 w-3 mr-1" />
                                Batch ({getLinkedCasesCount(caseItem)})
                              </Badge>
                            )}
                          </div>
                          {caseItem.batchCreated && (
                            <div className="text-xs text-gray-500">
                              Patient {caseItem.batchIndex + 1} of {caseItem.batchSize}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{caseItem.emrNumber}</TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {caseItem.chiefComplaint}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Stethoscope className="h-3.5 w-3.5 text-blue-500 mr-1.5" />
                            {caseItem.assignedDoctors?.primaryName ||
                              "No doctor assigned"}
                            {caseItem.assignedDoctors?.primaryType && (
                              <span className="ml-1 text-xs bg-blue-50 text-blue-700 px-1 rounded">
                                ({caseItem.assignedDoctors.primaryType})
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              onClick={() => {}}
                              type="button"
                            >
                              <UserPen className="!h-3.5 !w-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center text-sm">
                            <Pill className="h-3.5 w-3.5 text-green-500 mr-1.5" />
                            {caseItem.pharmacistName ||
                              "No pharmacist assigned"}
                            <Button
                              variant="ghost"
                              onClick={() => {}}
                              type="button"
                            >
                              <UserPen className="!h-3.5 !w-3.5" />
                            </Button>
                          </div>
                        </div>
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
                        {caseItem.consultationType === "audio" && (
                          <div className="mt-1 text-sm text-gray-600">
                            {caseItem.contactInfo}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{caseItem.createdAtDate}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{caseItem.createdAtTime}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge
                            variant={getStatusBadgeVariant(caseItem.status)}
                            className={
                              caseItem.status === "completed"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : caseItem.status === "doctor_completed"
                                ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                : ""
                            }
                          >
                            {getStatusLabel(caseItem.status)}
                          </Badge>

                          <div className="space-y-1">
                            {caseItem.doctorCompletedAtFormatted && (
                              <div className="flex items-center text-xs text-gray-500">
                                <Check className="h-3 w-3 mr-1 text-blue-500" />
                                <span>
                                  Doc:{" "}
                                  {format(
                                    new Date(
                                      caseItem.doctorCompletedAt.toDate()
                                    ),
                                    "p"
                                  )}
                                </span>
                              </div>
                            )}
                            {caseItem.pharmacistCompletedAtFormatted && (
                              <div className="flex items-center text-xs text-gray-500">
                                <Check className="h-3 w-3 mr-1 text-green-500" />
                                <span>
                                  Pharm:{" "}
                                  {format(
                                    new Date(
                                      caseItem.pharmacistCompletedAt.toDate()
                                    ),
                                    "p"
                                  )}
                                </span>
                              </div>
                            )}
                            {caseItem.doctorCompletedByName && (
                              <div className="flex items-center text-xs text-gray-500">
                                <User className="h-3 w-3 mr-1 text-gray-400" />
                                <span>
                                  By: {caseItem.doctorCompletedByName}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center text-gray-600 border-gray-200 hover:bg-gray-50"
                            onClick={() => openEditDialog(caseItem)}
                          >
                            <Edit className="h-4 w-4 mr-1" /> Edit Case
                          </Button>
                          {caseItem.consultationType === "tele" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                              asChild
                            >
                              <a
                                href={caseItem.contactInfo}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Video className="h-4 w-4 mr-1" /> Join Video
                              </a>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center text-blue-600 border-blue-200 hover:bg-blue-50"
                              asChild
                            >
                              <a href={`tel:${caseItem.contactInfo}`}>
                                <Phone className="h-4 w-4 mr-1" /> Call Patient
                              </a>
                            </Button>
                          )}

                          {!caseItem.doctorCompleted && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() =>
                                  openConfirmDialog(
                                    caseItem.id,
                                    "doctor",
                                    caseItem
                                  )
                                }
                              >
                                <Check className="h-4 w-4 mr-1" /> Mark Doctor
                                Done
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() =>
                                  openIncompleteDialog(
                                    caseItem.id,
                                    "doctor",
                                    caseItem
                                  )
                                }
                              >
                                <X className="h-4 w-4 mr-1" /> Mark as
                                Incomplete
                              </Button>
                            </>
                          )}

                          {/* Only show the pharmacist complete option if doctor is complete AND not marked incomplete */}
                          {caseItem.doctorCompleted &&
                            !caseItem.pharmacistCompleted &&
                            !caseItem.isIncomplete && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() =>
                                    handlePharmacistIncomplete(caseItem.id)
                                  }
                                >
                                  <X className="h-4 w-4 mr-1" /> Mark Pharm
                                  Incomplete
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center text-green-600 border-green-200 hover:bg-green-50"
                                  onClick={() =>
                                    openConfirmDialog(
                                      caseItem.id,
                                      "pharmacist",
                                      caseItem
                                    )
                                  }
                                >
                                  <Check className="h-4 w-4 mr-1" /> Mark Pharm
                                  Done
                                </Button>
                              </>
                            )}

                          {!caseItem.doctorCompleted &&
                            !caseItem.pharmacistCompleted && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center text-gray-400 border-gray-200 cursor-not-allowed opacity-50"
                                disabled={true}
                                title="Doctor must complete before pharmacist"
                              >
                                <Check className="h-4 w-4 mr-1" /> Mark Pharm
                                Done
                              </Button>
                            )}

                          {caseItem.isIncomplete && (
                            <div className="mt-1 text-xs text-red-600 flex items-center">
                              <X className="h-3.5 w-3.5 mr-1" />
                              Marked incomplete - <br/> No further action needed
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Completion Confirmation Dialog */}
      <Dialog
        open={confirmComplete.open}
        onOpenChange={(open) =>
          setConfirmComplete({ ...confirmComplete, open })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {confirmComplete.isIncomplete ? (
                <X className="h-5 w-5 text-red-500 mr-2" />
              ) : (
                <Check className="h-5 w-5 text-green-500 mr-2" />
              )}
              {confirmComplete.isIncomplete
                ? "Mark as Incomplete"
                : "Confirm Completion"}{" "}
              - {confirmComplete.type === "doctor" ? "Doctor" : "Pharmacist"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this case as{" "}
              {confirmComplete.isIncomplete ? "incomplete" : "completed"} for
              the {confirmComplete.type}?
            </DialogDescription>
          </DialogHeader>

          {confirmComplete.caseData && (
            <div className="space-y-3 py-3 border-y border-gray-100">
              {/* Patient information */}
              <div className="flex items-center">
                <User className="h-4 w-4 text-gray-400 mr-2" />
                <span className="font-medium">Patient:</span>{" "}
                <span className="ml-2">
                  {confirmComplete.caseData.patientName}
                </span>
              </div>
              <div className="flex items-center">
                <ClipboardList className="h-4 w-4 text-gray-400 mr-2" />
                <span className="font-medium">EMR:</span>{" "}
                <span className="ml-2">
                  {confirmComplete.caseData.emrNumber}
                </span>
              </div>
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                <span className="font-medium">Complaint:</span>{" "}
                <span className="ml-2">
                  {confirmComplete.caseData.chiefComplaint}
                </span>
              </div>
              
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                <span className="font-medium">Created At:</span>{" "}
                <span className="ml-2">
                  {confirmComplete.caseData.createdAtFormatted}
                </span>
              </div>
              {confirmComplete.type === "pharmacist" &&
                confirmComplete.caseData.doctorCompletedAtFormatted && (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="font-medium">Doctor Completed:</span>{" "}
                    <span className="ml-2">
                      {confirmComplete.caseData.doctorCompletedAtFormatted}
                    </span>
                  </div>
                )}
              {confirmComplete.isIncomplete && (
                <div className="py-3 border-t border-gray-100 mb-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="incompleteReason"
                      className="text-sm font-medium"
                    >
                      Reason for marking as incomplete{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="incompleteReason"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Please explain why this case is being marked as incomplete..."
                      value={confirmComplete.reason}
                      onChange={(e) =>
                        setConfirmComplete({
                          ...confirmComplete,
                          reason: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>
              )}

              {confirmComplete.caseData.assignedDoctors?.primaryName && (
                <div className="flex items-center">
                  <Stethoscope className="h-4 w-4 text-blue-500 mr-2" />
                  <span className="font-medium">Assigned Doctor:</span>{" "}
                  <span className="ml-2">
                    {confirmComplete.caseData.assignedDoctors.primaryName}
                    {confirmComplete.caseData.assignedDoctors.primaryType && (
                      <span className="ml-1 text-xs bg-blue-50 text-blue-700 px-1 rounded">
                        ({confirmComplete.caseData.assignedDoctors.primaryType})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {confirmComplete.caseData.pharmacistName && (
                <div className="flex items-center">
                  <Pill className="h-4 w-4 text-green-500 mr-2" />
                  <span className="font-medium">Assigned Pharmacist:</span>{" "}
                  <span className="ml-2">
                    {confirmComplete.caseData.pharmacistName}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmComplete({
                  open: false,
                  caseId: null,
                  type: null,
                  caseData: null,
                  isIncomplete: false,
                  reason: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={confirmComplete.isIncomplete && !confirmComplete.reason.trim()}
              className={
                confirmComplete.isIncomplete
                  ? "bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {confirmComplete.isIncomplete ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Mark as Incomplete
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Completion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Case Dialog */}
      <Dialog
        open={editCase.open}
        onOpenChange={(open) => setEditCase({ ...editCase, open })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Edit className="h-5 w-5 text-blue-500 mr-2" />
              Edit Case Details
            </DialogTitle>
            <DialogDescription>
              Update patient and case information
            </DialogDescription>
          </DialogHeader>

          {editCase.caseData && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editPatientName">Patient Name</Label>
                    <Input
                      id="editPatientName"
                      name="patientName"
                      defaultValue={editCase.caseData.patientName}
                      className="focus:border-blue-300 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEmrNumber">EMR Number</Label>
                    <Input
                      id="editEmrNumber"
                      name="emrNumber"
                      defaultValue={editCase.caseData.emrNumber}
                      className="focus:border-blue-300 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editChiefComplaint">
                      Chief Complaint
                    </Label>
                    <Input
                      id="editChiefComplaint"
                      name="chiefComplaint"
                      defaultValue={editCase.caseData.chiefComplaint}
                      className="focus:border-blue-300 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editContactInfo">
                    {editCase.caseData.consultationType === "tele"
                      ? "Google Meet Link"
                      : "Phone Number"}
                  </Label>
                  <Input
                    id="editContactInfo"
                    name="contactInfo"
                    defaultValue={editCase.caseData.contactInfo}
                    className="focus:border-blue-300 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editNotes">Additional Notes</Label>
                  <textarea
                    id="editNotes"
                    name="notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-300 focus:outline-none"
                    defaultValue={editCase.caseData.notes || ""}
                  />
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditCase({ open: false, caseData: null })}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Linked Cases Dialog */}
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
                These cases were created together in the same batch and share the same contact information.
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
                              : caseItem.status === "doctor_incomplete" || caseItem.status === "pharmacist_incomplete"
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
                            className="flex items-center text-gray-600 border-gray-200 hover:bg-gray-50"
                            onClick={() => {
                              setViewLinkedCases({ open: false, cases: [], batchTimestamp: null });
                              openEditDialog(caseItem);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          {!caseItem.doctorCompleted && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => {
                                setViewLinkedCases({ open: false, cases: [], batchTimestamp: null });
                                openConfirmDialog(caseItem.id, "doctor", caseItem);
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" /> Dr Done
                            </Button>
                          )}
                          {caseItem.doctorCompleted && !caseItem.pharmacistCompleted && !caseItem.isIncomplete && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => {
                                setViewLinkedCases({ open: false, cases: [], batchTimestamp: null });
                                openConfirmDialog(caseItem.id, "pharmacist", caseItem);
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" /> Pharm Done
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
              onClick={() => setViewLinkedCases({ open: false, cases: [], batchTimestamp: null })}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NurseCaseManagement;