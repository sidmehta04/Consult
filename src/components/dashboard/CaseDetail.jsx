import React, { useState, useMemo, useCallback } from "react";
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
  ArrowRightLeft,
  History,
  ExternalLink,
  Calendar,
  Timer,
  AlertTriangle,
  Info,
  Stethoscope,
  Pill,
  Users,
  Activity
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// OPTIMIZATION 1: Utility functions moved outside component
const DateTimeUtils = {
  formatDate: (dateObj) => {
    if (!dateObj) return "N/A";
    
    try {
      const date = dateObj.toDate?.() || 
                   (dateObj instanceof Date ? dateObj : new Date(dateObj));
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  },

  formatTime: (dateObj) => {
    if (!dateObj) return "N/A";
    
    try {
      const date = dateObj.toDate?.() || 
                   (dateObj instanceof Date ? dateObj : new Date(dateObj));
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid Time";
    }
  },

  formatDateTime: (dateObj) => {
    if (!dateObj) return "N/A";
    return `${DateTimeUtils.formatDate(dateObj)} ${DateTimeUtils.formatTime(dateObj)}`;
  },

  calculateTimeDifference: (startTime, endTime) => {
    if (!startTime || !endTime) return "N/A";

    try {
      const startDate = startTime.toDate?.() || 
                       (startTime instanceof Date ? startTime : new Date(startTime));
      const endDate = endTime.toDate?.() || 
                     (endTime instanceof Date ? endTime : new Date(endTime));

      const diffMs = endDate - startDate;
      if (isNaN(diffMs)) return "Invalid";

      const minutes = Math.floor(diffMs / 1000 / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      return `${minutes}m`;
    } catch {
      return "Error";
    }
  }
};

// OPTIMIZATION 2: Enhanced status utilities
const StatusUtils = {
  getCaseStatus: (caseData) => ({
    isIncomplete: caseData.isIncomplete === true,
    isCompleted: caseData.doctorCompleted && caseData.pharmacistCompleted,
    isDoctorCompleted: caseData.doctorCompleted,
    isPharmacistCompleted: caseData.pharmacistCompleted,
    hasTransfers: caseData.transferHistory?.length > 0,
    transferCount: caseData.transferCount || 0,
    // NEW: Enhanced transfer tracking
    hasDoctorTransfers: caseData.transferHistory?.some(t => t.transferType === 'doctor') || false,
    hasPharmacistTransfers: caseData.transferHistory?.some(t => t.transferType === 'pharmacist') || false,
    doctorTransferCount: caseData.transferHistory?.filter(t => t.transferType === 'doctor').length || 0,
    pharmacistTransferCount: caseData.transferHistory?.filter(t => t.transferType === 'pharmacist').length || 0,
  }),

  getStatusBadge: (status, type = 'case') => {
    if (status.isIncomplete) {
      return {
        className: "bg-red-100 text-red-800 border-red-200",
        label: "Incomplete",
        icon: AlertTriangle
      };
    }

    if (type === 'doctor') {
      return status.isDoctorCompleted 
        ? { className: "bg-green-100 text-green-800 border-green-200", label: "Completed", icon: CheckCircle2 }
        : { className: "bg-amber-100 text-amber-800 border-amber-200", label: "Pending", icon: Clock };
    }

    if (type === 'pharmacist') {
      return status.isPharmacistCompleted 
        ? { className: "bg-green-100 text-green-800 border-green-200", label: "Completed", icon: CheckCircle2 }
        : { className: "bg-amber-100 text-amber-800 border-amber-200", label: "Pending", icon: Clock };
    }

    if (status.isCompleted) {
      return { className: "bg-green-700 text-white", label: "Completed", icon: CheckCircle2 };
    }

    return { className: "bg-blue-800 text-white", label: "Pending", icon: Clock };
  },

  // NEW: Get transfer type badge
  getTransferTypeBadge: (transferType) => {
    if (transferType === 'doctor') {
      return {
        className: "bg-blue-100 text-blue-800 border-blue-200",
        label: "Doctor Transfer",
        icon: Stethoscope
      };
    } else if (transferType === 'pharmacist') {
      return {
        className: "bg-green-100 text-green-800 border-green-200",
        label: "Pharmacist Transfer",
        icon: Pill
      };
    } else {
      return {
        className: "bg-gray-100 text-gray-800 border-gray-200",
        label: "Transfer",
        icon: ArrowRightLeft
      };
    }
  }
};

// OPTIMIZATION 3: Memoized components
const InfoField = React.memo(({ label, value, className = "" }) => (
  <div className={className}>
    <label className="text-sm font-medium text-gray-500">{label}</label>
    <p className="font-medium break-words">{value || "N/A"}</p>
  </div>
));

const StatusBadge = React.memo(({ status, type }) => {
  const badge = StatusUtils.getStatusBadge(status, type);
  const Icon = badge.icon;
  
  return (
    <Badge variant="outline" className={badge.className}>
      <Icon className="h-3 w-3 mr-1" />
      {badge.label}
    </Badge>
  );
});

const TimelineRow = React.memo(({ leftLabel, leftValue, rightLabel, rightValue, className = "" }) => (
  <div className={`flex items-center justify-between border-b pb-2 ${className}`}>
    <div>
      <label className="text-sm font-medium text-gray-500">{leftLabel}</label>
      <p>{leftValue}</p>
    </div>
    <div className="text-right">
      <label className="text-sm font-medium text-gray-500">{rightLabel}</label>
      <p>{rightValue}</p>
    </div>
  </div>
));

// UPDATED: Enhanced TransferHistoryCard with support for both doctor and pharmacist transfers
const TransferHistoryCard = React.memo(({ transfer, index, totalTransfers }) => {
  const transferTypeBadge = StatusUtils.getTransferTypeBadge(transfer.transferType);
  const TransferIcon = transferTypeBadge.icon;

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <ArrowRightLeft className="h-4 w-4 text-orange-600" />
          <span className="font-medium text-gray-900">
            Transfer #{totalTransfers - index}
          </span>
          <Badge variant="outline" className={transferTypeBadge.className}>
            <TransferIcon className="h-3 w-3 mr-1" />
            {transferTypeBadge.label}
          </Badge>
        </div>
        <Badge variant="outline" className="text-xs">
          {DateTimeUtils.formatDateTime(transfer.transferredAt)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Dynamic labels based on transfer type */}
        <InfoField 
          label={`From ${transfer.transferType === 'doctor' ? 'Doctor' : 'Pharmacist'}:`} 
          value={transfer.transferredFromName || "Unassigned"} 
        />
        <InfoField 
          label={`To ${transfer.transferType === 'doctor' ? 'Doctor' : 'Pharmacist'}:`} 
          value={transfer.transferredToName} 
        />
        <InfoField label="Transferred By:" value={transfer.transferredByName} />
        <InfoField label="Reason:" value={transfer.transferReason} />
      </div>

      {/* Additional transfer metadata */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          {transfer.version && (
            <span>Case Version: {transfer.version}</span>
          )}
          {transfer.transferType && (
            <span className="flex items-center">
              <Activity className="h-3 w-3 mr-1" />
              {transfer.transferType === 'doctor' ? 'Doctor Assignment' : 'Pharmacist Assignment'}
            </span>
          )}
        </div>
        {transfer.isBulkTransfer && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <Users className="h-2 w-2 mr-1" />
            Bulk Transfer
          </Badge>
        )}
      </div>

      {/* Legacy support for old transfer format */}
      {!transfer.transferType && (
        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
          <Info className="h-3 w-3 inline mr-1" />
          Legacy transfer record (pre-enhancement)
        </div>
      )}
    </div>
  );
});

// NEW: Transfer Summary Component
const TransferSummary = React.memo(({ status, caseData }) => (
  <div className="space-y-4">
    {/* Transfer Type Breakdown */}
    <div className="grid grid-cols-2 gap-4">
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Stethoscope className="h-4 w-4 text-blue-600 mr-2" />
            <span className="font-medium text-blue-900">Doctor Transfers</span>
          </div>
          <Badge className="bg-blue-600 text-white">
            {status.doctorTransferCount}
          </Badge>
        </div>
        <p className="text-xs text-blue-800 mt-1">
          Current: {caseData.assignedDoctors?.primaryName || "Not assigned"}
        </p>
      </div>

      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Pill className="h-4 w-4 text-green-600 mr-2" />
            <span className="font-medium text-green-900">Pharmacist Transfers</span>
          </div>
          <Badge className="bg-green-600 text-white">
            {status.pharmacistTransferCount}
          </Badge>
        </div>
        <p className="text-xs text-green-800 mt-1">
          Current: {caseData.pharmacistName || "Not assigned"}
        </p>
      </div>
    </div>

    {/* Transfer Warnings */}
    {status.transferCount > 3 && (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center">
          <AlertCircle className="h-4 w-4 text-amber-700 mr-2" />
          <span className="text-amber-900 font-medium">High Transfer Activity</span>
        </div>
        <p className="text-amber-800 text-sm mt-1">
          This case has been transferred {status.transferCount} times. Consider reviewing for complexity or workload distribution issues.
        </p>
        {status.doctorTransferCount > 2 && (
          <p className="text-amber-700 text-xs mt-1">
            • Multiple doctor transfers ({status.doctorTransferCount}) may indicate case complexity
          </p>
        )}
        {status.pharmacistTransferCount > 2 && (
          <p className="text-amber-700 text-xs mt-1">
            • Multiple pharmacist transfers ({status.pharmacistTransferCount}) may indicate workload issues
          </p>
        )}
      </div>
    )}

    {/* Last Transfer Info */}
    {caseData.lastTransferredAt && (
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">Last Transfer</span>
          <span className="text-sm text-gray-600">
            {DateTimeUtils.formatDateTime(caseData.lastTransferredAt)}
          </span>
        </div>
      </div>
    )}
  </div>
));

// OPTIMIZATION 4: Main component with hooks
const CaseDetailView = ({ caseData, userRole, currentUser }) => {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  // OPTIMIZATION 5: Memoized computed values with enhanced transfer data
  const computedData = useMemo(() => {
    const status = StatusUtils.getCaseStatus(caseData);
    
    return {
      status,
      caseTitle: `Case ${caseData.emrNumber || caseData.caseNumber || caseData.id?.substring(0, 8) || "Details"}`,
      canUpdateDoctorStatus: userRole === "doctor" && !caseData.doctorCompleted,
      canUpdatePharmacistStatus: userRole === "pharmacist" && !caseData.pharmacistCompleted,
      canUpdateAnyStatus: ["superAdmin", "zonalHead", "teamLeader"].includes(userRole),
      
      // Pre-compute display values
      emrNumbers: caseData.emrNumber || caseData.emrNumbers?.join(", ") || "N/A",
      patientNames: caseData.patientName || caseData.patientNames?.join(", ") || "N/A",
      chiefComplaints: caseData.chiefComplaint || caseData.chiefComplaints?.join(", ") || "N/A",
      
      // Pre-compute timeline values
      timeline: {
        createdAt: DateTimeUtils.formatDateTime(caseData.createdAt),
        doctorCompletedAt: status.isIncomplete ? "Incomplete" :
                          caseData.doctorCompleted ? DateTimeUtils.formatDateTime(caseData.doctorCompletedAt) : "Pending",
        pharmacistCompletedAt: status.isIncomplete ? "Incomplete" :
                              caseData.pharmacistCompleted ? DateTimeUtils.formatDateTime(caseData.pharmacistCompletedAt) : "Pending",
        doctorTAT: status.isIncomplete ? "N/A" :
                   caseData.doctorCompleted ? DateTimeUtils.calculateTimeDifference(
                     caseData.doctorJoined ?? caseData.createdAt, caseData.doctorCompletedAt
                   ) : "Pending",
        overallTAT: status.isIncomplete ? "N/A" :
                    caseData.pharmacistCompleted ? DateTimeUtils.calculateTimeDifference(
                      caseData.pharmacistJoined ?? caseData.createdAt, caseData.pharmacistCompletedAt
                    ) : "In progress"
      },
      
      // UPDATED: Sort transfer history with enhanced filtering
      sortedTransferHistory: caseData.transferHistory?.sort((a, b) => {
        const dateA = a.transferredAt instanceof Date ? a.transferredAt : new Date(a.transferredAt);
        const dateB = b.transferredAt instanceof Date ? b.transferredAt : new Date(b.transferredAt);
        return dateB - dateA;
      }) || [],

      // NEW: Separate transfer histories by type
      doctorTransferHistory: caseData.transferHistory?.filter(t => t.transferType === 'doctor').sort((a, b) => {
        const dateA = a.transferredAt instanceof Date ? a.transferredAt : new Date(a.transferredAt);
        const dateB = b.transferredAt instanceof Date ? b.transferredAt : new Date(b.transferredAt);
        return dateB - dateA;
      }) || [],

      pharmacistTransferHistory: caseData.transferHistory?.filter(t => t.transferType === 'pharmacist').sort((a, b) => {
        const dateA = a.transferredAt instanceof Date ? a.transferredAt : new Date(a.transferredAt);
        const dateB = b.transferredAt instanceof Date ? b.transferredAt : new Date(b.transferredAt);
        return dateB - dateA;
      }) || []
    };
  }, [caseData, userRole]);

  // OPTIMIZATION 6: Memoized status update handler
  const handleStatusUpdate = useCallback(async (type) => {
    setUpdating(true);
    setUpdateError("");

    try {
      const caseRef = doc(firestore, "cases", caseData.id);
      const updateData = {
        updatedAt: Timestamp.now(),
        updatedBy: currentUser.uid
      };

      if (type === "doctor") {
        updateData.doctorCompleted = true;
        updateData.doctorCompletedBy = currentUser.uid;
        updateData.doctorCompletedAt = Timestamp.now();
      } else if (type === "pharmacist") {
        updateData.pharmacistCompleted = true;
        updateData.pharmacistCompletedBy = currentUser.uid;
        updateData.pharmacistCompletedAt = Timestamp.now();
      }

      // Check if case should be marked as completed
      if (
        (type === "doctor" && caseData.pharmacistCompleted) ||
        (type === "pharmacist" && caseData.doctorCompleted)
      ) {
        updateData.status = "completed";
        updateData.completedAt = Timestamp.now();
      }

      await updateDoc(caseRef, updateData);
      
      // Success feedback could be added here
    } catch (error) {
      console.error(`Error updating case ${type} status:`, error);
      setUpdateError(`Failed to update case status. Please try again.`);
    } finally {
      setUpdating(false);
    }
  }, [caseData.id, caseData.pharmacistCompleted, caseData.doctorCompleted, currentUser.uid]);

  // OPTIMIZATION 7: Memoized close handler
  const handleClose = useCallback(() => {
    window.dispatchEvent(new CustomEvent("closeDialog"));
  }, []);

  // OPTIMIZATION 8: Memoized tab content with enhanced transfer display
  const tabContent = useMemo(() => ({
    details: (
      <div className="grid grid-cols-2 gap-4 p-4">
        <div className="space-y-4">
          <InfoField label="EMR Number(s)" value={computedData.emrNumbers} />
          <InfoField label="Clinic" value={caseData.clinicCode || caseData.clinicName} />
          <InfoField label="Partner" value={caseData.partnerName} />
          <InfoField label="Patient Name(s)" value={computedData.patientNames} />
          <InfoField label="Chief Complaint(s)" value={computedData.chiefComplaints} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Doctor</label>
            <div className="flex items-center flex-wrap gap-2">
              <span className="mr-2">
                {caseData.doctorName || caseData.assignedDoctors?.primaryName || "N/A"}
              </span>
              <StatusBadge status={computedData.status} type="doctor" />
              {computedData.status.hasDoctorTransfers && (
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                  <Stethoscope className="h-3 w-3 mr-1" />
                  {computedData.status.doctorTransferCount} Transfer{computedData.status.doctorTransferCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Pharmacist</label>
            <div className="flex items-center flex-wrap gap-2">
              <span className="mr-2">{caseData.pharmacistName || "N/A"}</span>
              <StatusBadge status={computedData.status} type="pharmacist" />
              {computedData.status.hasPharmacistTransfers && (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  <Pill className="h-3 w-3 mr-1" />
                  {computedData.status.pharmacistTransferCount} Transfer{computedData.status.pharmacistTransferCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          <InfoField label="Contact Info" value={caseData.contactInfo} className="break-words" />

          <div>
            <label className="text-sm font-medium text-gray-500">Queue Status</label>
            <div className="flex items-center space-x-2">
              <StatusBadge status={computedData.status} type="case" />
              {computedData.status.hasTransfers && (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  {computedData.status.transferCount} Total Transfer{computedData.status.transferCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    ),

    timeline: (
      <div className="p-4 space-y-4">
        <TimelineRow
          leftLabel="Created By"
          leftValue={caseData.createdByName || "N/A"}
          rightLabel="Created At"
          rightValue={computedData.timeline.createdAt}
        />

        <TimelineRow
          leftLabel="Doctor Completed By"
          leftValue={computedData.status.isIncomplete ? "Incomplete" :
                    caseData.doctorCompleted ? (caseData.doctorCompletedByName || "Unknown") : "Pending"}
          rightLabel="Doctor Completed At"
          rightValue={computedData.timeline.doctorCompletedAt}
        />

        <TimelineRow
          leftLabel="Pharmacist Completed By"
          leftValue={computedData.status.isIncomplete ? "Incomplete" :
                    caseData.pharmacistCompleted ? (caseData.pharmacistCompletedByName || "Unknown") : "Pending"}
          rightLabel="Pharmacist Completed At"
          rightValue={computedData.timeline.pharmacistCompletedAt}
        />

        <TimelineRow
          leftLabel="Doctor TAT"
          leftValue={computedData.timeline.doctorTAT}
          rightLabel="Doctor Process Time"
          rightValue={computedData.status.isIncomplete ? "N/A" :
                     caseData.doctorCompleted ? DateTimeUtils.calculateTimeDifference(
                       caseData.createdAt, caseData.doctorCompletedAt
                     ) : "In progress"}
        />

        <TimelineRow
          leftLabel="Overall TAT"
          leftValue={computedData.timeline.overallTAT}
          rightLabel="Total Process Time"
          rightValue={computedData.status.isIncomplete ? "N/A" :
                     caseData.pharmacistCompleted ? DateTimeUtils.calculateTimeDifference(
                       caseData.createdAt, caseData.pharmacistCompletedAt
                     ) : "In progress"}
        />

        {/* Status alerts */}
        {caseData.status === "doctor_incomplete" && (
          <div className="bg-red-50 p-3 rounded-md border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-red-800">Case Status</label>
                <p className="text-red-700 font-medium">Doctor marked as incomplete</p>
              </div>
              <StatusBadge status={computedData.status} type="case" />
            </div>
          </div>
        )}

        {caseData.status === "pharmacist_incomplete" && (
          <div className="bg-red-50 p-3 rounded-md border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-red-800">Case Status</label>
                <p className="text-red-700 font-medium">Pharmacist marked as incomplete</p>
              </div>
              <StatusBadge status={computedData.status} type="case" />
            </div>
          </div>
        )}
      </div>
    ),

    notes: (
      <div className="p-4 space-y-4">
        {[
          { label: "Chief Complaint", content: caseData.chiefComplaint },
          { label: "Notes", content: caseData.notes },
          { label: "Doctor Notes", content: caseData.doctorNotes },
          { label: "Pharmacist Notes", content: caseData.pharmacistNotes }
        ].map(({ label, content }) => 
          content && (
            <div key={label} className="space-y-1">
              <label className="text-sm font-medium text-gray-500">{label}</label>
              <div className="p-3 bg-gray-50 rounded-md whitespace-pre-line">{content}</div>
            </div>
          )
        )}

        {!caseData.chiefComplaint && !caseData.notes && !caseData.doctorNotes && !caseData.pharmacistNotes && (
          <div className="text-center py-8 text-gray-500">
            <Clipboard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            No notes available for this case
          </div>
        )}

        {computedData.status.isIncomplete && (
          <div className="mt-6 p-4 bg-red-50 rounded-md border border-red-200">
            <div className="flex items-center mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
              <label className="text-sm font-medium text-red-800">Case Marked Incomplete</label>
            </div>
            <p className="text-red-700 mb-2">
              This case has been marked as incomplete and will not proceed to the standard workflow.
            </p>
            {caseData.incompleteReason && (
              <div className="mt-2">
                <label className="text-sm font-medium text-red-800">Reason:</label>
                <div className="p-2 bg-red-100 rounded-md mt-1 whitespace-pre-line">
                  {caseData.incompleteReason}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    ),

    // UPDATED: Enhanced transfers tab with better organization
    transfers: computedData.status.hasTransfers && (
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <History className="h-5 w-5 text-orange-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Transfer History</h3>
            </div>
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
              {computedData.status.transferCount} Total Transfer{computedData.status.transferCount !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Transfer Summary */}
          <TransferSummary status={computedData.status} caseData={caseData} />
        </div>

        {/* All Transfers */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            All Transfer Activities
          </h4>
          
          {computedData.sortedTransferHistory.length > 0 ? (
            computedData.sortedTransferHistory.map((transfer, index) => (
              <TransferHistoryCard 
                key={index}
                transfer={transfer}
                index={index}
                totalTransfers={computedData.sortedTransferHistory.length}
              />
            ))
          ) : (
            <div className="text-center py-6 text-gray-500">
              <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No detailed transfer history available</p>
            </div>
          )}
        </div>

        {/* Legacy transfer info */}
        {(caseData.transferredFrom || caseData.transferredAt) && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center mb-2">
              <Info className="h-4 w-4 text-blue-600 mr-2" />
              <span className="font-medium text-blue-900">Legacy Transfer Information</span>
            </div>
            <div className="text-sm text-blue-800 space-y-1">
              {caseData.transferredFromName && <p>Previous Doctor: {caseData.transferredFromName}</p>}
              {caseData.transferredAt && <p>Last Transfer: {DateTimeUtils.formatDateTime(caseData.transferredAt)}</p>}
              {caseData.transferredByName && <p>Transferred By: {caseData.transferredByName}</p>}
            </div>
          </div>
        )}
      </div>
    )
  }), [caseData, computedData]);

  return (
    <div className="max-w-7xl max-h-[80vh] flex flex-col">
      <DialogTitle className="sr-only">{computedData.caseTitle}</DialogTitle>

      {/* Header */}
      <div className="bg-blue-900 text-white p-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
          <File className="h-5 w-5 mr-2" />
          <h2 className="text-lg font-medium">
            Case {caseData.emrNumber || caseData.id?.substring(0, 8)}
          </h2>
          {computedData.status.hasTransfers && (
            <div className="ml-3 flex items-center space-x-2">
              <Badge variant="outline" className="bg-orange-700 text-white border-orange-600">
                <ArrowRightLeft className="h-3 w-3 mr-1" />
                {computedData.status.transferCount} Total
              </Badge>
              {computedData.status.hasDoctorTransfers && (
                <Badge variant="outline" className="bg-blue-700 text-white border-blue-600">
                  <Stethoscope className="h-3 w-3 mr-1" />
                  {computedData.status.doctorTransferCount}
                </Badge>
              )}
              {computedData.status.hasPharmacistTransfers && (
                <Badge variant="outline" className="bg-green-700 text-white border-green-600">
                  <Pill className="h-3 w-3 mr-1" />
                  {computedData.status.pharmacistTransferCount}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <StatusBadge status={computedData.status} type="case" />
          <Button
            variant="outline"
            className="h-8 px-2 bg-blue-800 hover:bg-blue-700 text-white"
            onClick={handleClose}
          >
            Close
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {updateError && (
        <Alert variant="destructive" className="m-2">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>{updateError}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-2 overflow-hidden flex flex-col"
      >
        <div className="border-b px-4">
          <TabsList className="bg-transparent pt-2">
            <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
              <Tag className="h-4 w-4 mr-2" />
              Basic Info
            </TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
              <Clock className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
              <Clipboard className="h-4 w-4 mr-2" />
              Notes
            </TabsTrigger>
            {computedData.status.hasTransfers && (
              <TabsTrigger value="transfers" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer History
                <Badge variant="secondary" className="ml-2 bg-orange-200 text-orange-800">
                  {computedData.status.transferCount}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="details" className="p-0 m-0 h-full">
            {tabContent.details}
          </TabsContent>

          <TabsContent value="timeline" className="p-0 m-0 h-full">
            {tabContent.timeline}
          </TabsContent>

          <TabsContent value="notes" className="p-0 m-0 h-full">
            {tabContent.notes}
          </TabsContent>

          {computedData.status.hasTransfers && (
            <TabsContent value="transfers" className="p-0 m-0 h-full">
              {tabContent.transfers}
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default CaseDetailView;