import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import {
  AlertCircle,
  CheckCircle2,
  File,
  Clock,
  User,
  Clipboard,
  Tag,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CaseDetailView = ({ caseData, userRole, currentUser }) => {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  // Format date
  const formatDate = (dateObj) => {
    if (!dateObj) return "N/A";

    try {
      // Check if dateObj has toDate method (Firestore Timestamp)
      if (dateObj.toDate && typeof dateObj.toDate === "function") {
        return dateObj.toDate().toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      // If it's already a Date object
      if (dateObj instanceof Date) {
        return dateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      // If it's a string, try to parse it
      if (typeof dateObj === "string") {
        return new Date(dateObj).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      // Fallback
      return "Invalid Date";
    } catch (error) {
      console.error("Error formatting date:", error, dateObj);
      return "Error";
    }
  };

  // Format time
  const formatTime = (dateObj) => {
    if (!dateObj) return "N/A";

    try {
      // Check if dateObj has toDate method (Firestore Timestamp)
      if (dateObj.toDate && typeof dateObj.toDate === "function") {
        return dateObj.toDate().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      // If it's already a Date object
      if (dateObj instanceof Date) {
        return dateObj.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      // If it's a string, try to parse it
      if (typeof dateObj === "string") {
        return new Date(dateObj).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      // Fallback
      return "Invalid Time";
    } catch (error) {
      console.error("Error formatting time:", error, dateObj);
      return "Error";
    }
  };

  // Calculate time difference in readable format
  const calculateTimeDifference = (startTime, endTime) => {
    if (!startTime || !endTime) return "N/A";

    try {
      // Convert to Date objects if they are Firestore Timestamps
      let startDate = startTime;
      let endDate = endTime;

      if (startTime.toDate && typeof startTime.toDate === "function") {
        startDate = startTime.toDate();
      } else if (typeof startTime === "string") {
        startDate = new Date(startTime);
      }

      if (endTime.toDate && typeof endTime.toDate === "function") {
        endDate = endTime.toDate();
      } else if (typeof endTime === "string") {
        endDate = new Date(endTime);
      }

      // Calculate difference in milliseconds
      const diffMs = endDate - startDate;

      if (isNaN(diffMs)) return "Invalid";

      // Convert to readable format
      const minutes = Math.floor(diffMs / 1000 / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
      } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else {
        return `${minutes}m`;
      }
    } catch (error) {
      console.error("Error calculating time difference:", error);
      return "Error";
    }
  };

  // Handle status update
  const handleStatusUpdate = async (type) => {
    setUpdating(true);
    setUpdateError("");

    try {
      const caseRef = doc(firestore, "cases", caseData.id);
      const updateData = {};

      if (type === "doctor") {
        updateData.doctorCompleted = true;
        updateData.doctorCompletedBy = currentUser.uid;
        updateData.doctorCompletedAt = Timestamp.now();
      } else if (type === "pharmacist") {
        updateData.pharmacistCompleted = true;
        updateData.pharmacistCompletedBy = currentUser.uid;
        updateData.pharmacistCompletedAt = Timestamp.now();
      }

      // If both are completed, update main status too
      if (
        (type === "doctor" && caseData.pharmacistCompleted) ||
        (type === "pharmacist" && caseData.doctorCompleted)
      ) {
        updateData.status = "completed";
        updateData.completedAt = Timestamp.now();
      }

      updateData.updatedAt = Timestamp.now();
      updateData.updatedBy = currentUser.uid;

      await updateDoc(caseRef, updateData);

      // If successful, we'd ideally refresh the data
      // In a real app, this would be done via a context or state management
    } catch (error) {
      console.error(`Error updating case ${type} status:`, error);
      setUpdateError(`Failed to update case status. Please try again.`);
    } finally {
      setUpdating(false);
    }
  };

  // Check if user can update this case
  const canUpdateDoctorStatus =
    userRole === "doctor" && !caseData.doctorCompleted;
  const canUpdatePharmacistStatus =
    userRole === "pharmacist" && !caseData.pharmacistCompleted;
  const canUpdateAnyStatus = ["superAdmin", "zonalHead", "teamLeader"].includes(
    userRole
  );

  const caseTitle = `Case ${
    caseData.emrNumber ||
    caseData.caseNumber ||
    caseData.id?.substring(0, 8) ||
    "Details"
  }`;

  // Determine if the case is marked as incomplete
  const isIncompleteCase = caseData.isIncomplete === true;

  return (
    <div className="max-w-5xl max-h-[80vh] flex flex-col">
      {/* Adding DialogTitle for accessibility */}
      <DialogTitle className="sr-only">{caseTitle}</DialogTitle>

      {/* Header with title */}
      <div className="bg-blue-900 text-white p-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
          <File className="h-5 w-5 mr-2" />
          <h2 className="text-lg font-medium">
            Case {caseData.emrNumber || caseData.id?.substring(0, 8)}
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <Badge
            variant="outline"
            className={
              isIncompleteCase
                ? "bg-red-700 text-white"
                : caseData.doctorCompleted && caseData.pharmacistCompleted
                ? "bg-green-700 text-white"
                : "bg-blue-800 text-white"
            }
          >
            {isIncompleteCase
              ? "Incomplete"
              : caseData.doctorCompleted && caseData.pharmacistCompleted
              ? "Completed"
              : "Pending"}
          </Badge>
          <Button
            variant="outline"
            className="h-8 px-2 bg-blue-800 hover:bg-blue-700 text-white"
            onClick={() => window.dispatchEvent(new CustomEvent("closeDialog"))}
          >
            Close
          </Button>
        </div>
      </div>

      {/* Error message if status update fails */}
      {updateError && (
        <Alert variant="destructive" className="m-2">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>{updateError}</AlertDescription>
        </Alert>
      )}

      {/* Tabs navigation */}
      <Tabs
        defaultValue="details"
        className="flex-1 overflow-hidden flex flex-col"
        onValueChange={setActiveTab}
        value={activeTab}
      >
        <div className="border-b px-4">
          <TabsList className="bg-transparent pt-2">
            <TabsTrigger
              value="details"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none"
            >
              <Tag className="h-4 w-4 mr-2" />
              Basic Info
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none"
            >
              <Clock className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none"
            >
              <Clipboard className="h-4 w-4 mr-2" />
              Notes
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Basic Info Tab */}
        <TabsContent value="details" className="flex-1 overflow-auto p-0 m-0">
          <div className="grid grid-cols-2 gap-4 p-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  EMR Number(s)
                </label>
                <p className="font-medium">{caseData.emrNumber || (caseData.emrNumbers.join(", ") || "N/A")}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  Clinic
                </label>
                <p>{caseData.clinicCode || caseData.clinicName || "N/A"}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  Partner
                </label>
                <p>{caseData.partnerName || "N/A"}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  Patient Name(s)
                </label>
                <p>{caseData.patientName || (caseData.patientNames.join(", ") || "N/A")}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  Chief Complaint(s)
                </label>
                <p>{caseData.chiefComplaint || (caseData.chiefComplaints.join(", ") || "N/A")}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Doctor
                </label>
                <div className="flex items-center">
                  <span className="mr-2">
                    {caseData.doctorName ||
                      caseData.assignedDoctors?.primaryName ||
                      "N/A"}
                  </span>
                  {isIncompleteCase ? (
                    <Badge
                      variant="outline"
                      className="bg-red-100 text-red-800 border-red-200"
                    >
                      Incomplete
                    </Badge>
                  ) : caseData.doctorCompleted ? (
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 border-green-200"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-amber-800 border-amber-200"
                    >
                      Pending
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  Pharmacist
                </label>
                <div className="flex items-center">
                  <span className="mr-2">
                    {caseData.pharmacistName || "N/A"}
                  </span>
                  {isIncompleteCase ? (
                    <Badge
                      variant="outline"
                      className="bg-red-100 text-red-800 border-red-200"
                    >
                      Incomplete
                    </Badge>
                  ) : caseData.pharmacistCompleted ? (
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 border-green-200"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-amber-800 border-amber-200"
                    >
                      Pending
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  Contact Info
                </label>
                <p className="break-words">{caseData.contactInfo || "N/A"}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  Queue Status
                </label>
                <Badge
                  className={
                    isIncompleteCase
                      ? "bg-red-100 text-red-800"
                      : caseData.pendingQueue === "doctor"
                      ? "bg-amber-100 text-amber-800"
                      : caseData.pendingQueue === "pharmacist"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-green-100 text-green-800"
                  }
                >
                  {isIncompleteCase
                    ? "Incomplete"
                    : caseData.pendingQueue
                    ? caseData.pendingQueue.charAt(0).toUpperCase() +
                      caseData.pendingQueue.slice(1)
                    : "Completed"}
                </Badge>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="flex-1 overflow-auto p-0 m-0">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Created By
                </label>
                <p>{caseData.createdByName || "N/A"}</p>
              </div>
              <div className="text-right">
                <label className="text-sm font-medium text-gray-500">
                  Created At
                </label>
                <p>
                  {formatDate(caseData.createdAt)}{" "}
                  {formatTime(caseData.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Doctor Completed By
                </label>
                <p>
                  {isIncompleteCase
                    ? "Incomplete"
                    : caseData.doctorCompleted
                    ? caseData.doctorCompletedByName || "Unknown"
                    : "Pending"}
                </p>
              </div>
              <div className="text-right">
                <label className="text-sm font-medium text-gray-500">
                  Doctor Completed At
                </label>
                <p>
                  {isIncompleteCase
                    ? "Incomplete"
                    : caseData.doctorCompleted
                    ? `${formatDate(caseData.doctorCompletedAt)} ${formatTime(
                        caseData.doctorCompletedAt
                      )}`
                    : "Pending"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Pharmacist Completed By
                </label>
                <p>
                  {isIncompleteCase
                    ? "Incomplete"
                    : caseData.pharmacistCompleted
                    ? caseData.pharmacistCompletedByName || "Unknown"
                    : "Pending"}
                </p>
              </div>
              <div className="text-right">
                <label className="text-sm font-medium text-gray-500">
                  Pharmacist Completed At
                </label>
                <p>
                  {isIncompleteCase
                    ? "Incomplete"
                    : caseData.pharmacistCompleted
                    ? `${formatDate(
                        caseData.pharmacistCompletedAt
                      )} ${formatTime(caseData.pharmacistCompletedAt)}`
                    : "Pending"}
                </p>
              </div>
            </div>

            {/* Doctor TAT (Turn Around Time) */}
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Doctor TAT
                </label>
                <p className="font-medium">
                  {isIncompleteCase
                    ? "N/A"
                    : caseData.doctorCompleted
                    ? calculateTimeDifference(
                        caseData.doctorJoined ?? caseData.createdAt,
                        caseData.doctorCompletedAt
                      )
                    : "Pending"}
                </p>
              </div>
              <div className="text-right">
                <label className="text-sm font-medium text-gray-500">
                  Doctor Process Time
                </label>
                <p>
                  {isIncompleteCase
                    ? "N/A"
                    : caseData.doctorCompleted
                    ? `${calculateTimeDifference(
                        caseData.createdAt,
                        caseData.doctorCompletedAt
                      )}`
                    : "In progress"}
                </p>
              </div>
            </div>

            {/* Overall TAT (Overall Turn Around Time) */}
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Overall TAT
                </label>
                <p className="font-medium">
                  {isIncompleteCase
                    ? "N/A"
                    : caseData.pharmacistCompleted
                    ? calculateTimeDifference(
                        caseData.pharmacistJoined ?? caseData.createdAt,
                        caseData.pharmacistCompletedAt
                      )
                    : "In progress"}
                </p>
              </div>
              <div className="text-right">
                <label className="text-sm font-medium text-gray-500">
                  Total Process Time
                </label>
                <p>
                  {isIncompleteCase
                    ? "N/A"
                    : caseData.pharmacistCompleted
                    ? `${calculateTimeDifference(
                        caseData.createdAt,
                        caseData.pharmacistCompletedAt
                      )}`
                    : "In progress"}
                </p>
              </div>
            </div>

            {caseData.status === "doctor_incomplete" && (
              <div className="flex items-center justify-between bg-red-50 p-3 rounded-md border border-red-200">
                <div>
                  <label className="text-sm font-medium text-red-800">
                    Case Status
                  </label>
                  <p className="text-red-700 font-medium">
                    Doctor marked as incomplete
                  </p>
                </div>
                <Badge className="bg-red-100 text-red-800">Incomplete</Badge>
              </div>
            )}

            {caseData.status === "pharmacist_incomplete" && (
              <div className="flex items-center justify-between bg-red-50 p-3 rounded-md border border-red-200">
                <div>
                  <label className="text-sm font-medium text-red-800">
                    Case Status
                  </label>
                  <p className="text-red-700 font-medium">
                    Pharmacist marked as incomplete
                  </p>
                </div>
                <Badge className="bg-red-100 text-red-800">Incomplete</Badge>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="flex-1 overflow-auto p-0 m-0">
          <div className="p-4 space-y-4">
            {caseData.chiefComplaint && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">
                  Chief Complaint
                </label>
                <div className="p-3 bg-gray-50 rounded-md">
                  {caseData.chiefComplaint}
                </div>
              </div>
            )}

            {caseData.notes && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">
                  Notes
                </label>
                <div className="p-3 bg-gray-50 rounded-md whitespace-pre-line">
                  {caseData.notes}
                </div>
              </div>
            )}

            {caseData.doctorNotes && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">
                  Doctor Notes
                </label>
                <div className="p-3 bg-gray-50 rounded-md whitespace-pre-line">
                  {caseData.doctorNotes}
                </div>
              </div>
            )}

            {caseData.pharmacistNotes && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">
                  Pharmacist Notes
                </label>
                <div className="p-3 bg-gray-50 rounded-md whitespace-pre-line">
                  {caseData.pharmacistNotes}
                </div>
              </div>
            )}

            {!caseData.chiefComplaint &&
              !caseData.notes &&
              !caseData.doctorNotes &&
              !caseData.pharmacistNotes && (
                <div className="text-center py-8 text-gray-500">
                  No notes available for this case
                </div>
              )}

            {isIncompleteCase && (
              <div className="mt-6 p-4 bg-red-50 rounded-md border border-red-200">
                <label className="text-sm font-medium text-red-800">
                  Case Marked Incomplete
                </label>
                <p className="text-red-700 mt-1">
                  This case has been marked as incomplete and will not proceed
                  to the standard workflow.
                </p>
                {caseData.incompleteReason && (
                  <div className="mt-2">
                    <label className="text-sm font-medium text-red-800">
                      Reason:
                    </label>
                    <div className="p-2 bg-red-100 rounded-md mt-1 whitespace-pre-line">
                      {caseData.incompleteReason}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CaseDetailView;
