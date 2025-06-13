// CaseTransfer/TableComponents.jsx
// Contains all the smaller UI components used in the table

import React, { useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Stethoscope,
  Pill,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  Phone,
  Video,
  History,
  CheckSquare,
  Square,
} from "lucide-react";
import { format } from "date-fns";

// Status Badge Component
export const StatusBadge = React.memo(({ queue }) => {
  if (queue === "doctor") {
    return (
      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 border-blue-200"
      >
        <Stethoscope className="h-3 w-3 mr-1" />
        Doctor Queue
      </Badge>
    );
  } else {
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 border-green-200"
      >
        <Pill className="h-3 w-3 mr-1" />
        Pharmacist Queue
      </Badge>
    );
  }
});

// Doctor Status Icon Component
export const DoctorStatusIcon = React.memo(({ status, caseCount }) => {
  if (status === "unavailable" || status === "on_break") {
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  } else if (caseCount >= 10) {
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  } else {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
});

// Patient Info Cell Component
export const PatientInfoCell = React.memo(({ caseItem }) => (
  <div className="space-y-1">
    <div className="flex items-center">
      <User className="h-4 w-4 text-gray-400 mr-2" />
      <span className="font-medium">{caseItem.patientName}</span>
    </div>
    <div className="text-sm text-gray-600">EMR: {caseItem.emrNumber}</div>
    <div className="text-xs text-gray-500">{caseItem.chiefComplaint}</div>
  </div>
));

// Clinic Cell Component
export const ClinicCell = React.memo(({ clinicCode, manualClinicCode }) => (
  <>
    <div className="flex items-center">
      <div className="h-2 w-2 bg-purple-500 rounded-full mr-2"></div>
      <span className="font-medium text-purple-700 text-sm">{clinicCode}</span>
    </div>
    <div className="flex items-center">
      <div className="h-2 w-2 bg-purple-500 rounded-full mr-2"></div>
      <span className="font-medium text-purple-700 text-sm">{manualClinicCode ?? "N/A"}</span>
    </div>
  </>
));

// Enhanced Assignment Cell - shows both doctor and pharmacist info
export const AssignmentCell = React.memo(({ 
  assignedDoctors, 
  pharmacistId, 
  pharmacistName, 
  pharmacistStatus, 
  transferHistory 
}) => (
  <div className="space-y-2">
    {/* Doctor Assignment */}
    <div className="space-y-1">
      <div className="flex items-center">
        <Stethoscope className="h-4 w-4 text-blue-500 mr-2" />
        <span className="font-medium text-sm">
          {assignedDoctors?.primaryName || "Not assigned"}
        </span>
        {transferHistory && transferHistory.length > 0 && (
          <History className="h-3 w-3 text-orange-500 ml-2" title="Case has been transferred" />
        )}
      </div>
      {assignedDoctors?.primaryType && (
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
          {assignedDoctors.primaryType}
        </span>
      )}
    </div>
    
    {/* Pharmacist Assignment */}
    <div className="space-y-1">
      <div className="flex items-center">
        <Pill className="h-4 w-4 text-green-500 mr-2" />
        <span className="font-medium text-sm">
          {pharmacistName || "Not assigned"}
        </span>
      </div>
      {pharmacistStatus && (
        <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
          {pharmacistStatus}
        </span>
      )}
    </div>
    
    {/* Transfer History */}
    {transferHistory && transferHistory.length > 0 && (
      <div className="text-xs text-orange-600">
        Transfers: {transferHistory.length}
      </div>
    )}
  </div>
));

// Contact Cell Component
export const ContactCell = React.memo(({ consultationType }) => (
  <div className="flex items-center text-sm">
    {consultationType === "tele" ? (
      <Video className="h-4 w-4 text-indigo-500 mr-2" />
    ) : (
      <Phone className="h-4 w-4 text-blue-500 mr-2" />
    )}
    <span className="truncate max-w-32">
      {consultationType === "tele" ? "Video Call" : "Phone Call"}
    </span>
  </div>
));

// Date Cell Component with enhanced error handling
export const DateCell = React.memo(({ createdAt, errorFallback = 'N/A' }) => {
  const formattedDate = useMemo(() => {
    if (!createdAt) return { date: errorFallback, time: errorFallback };
    
    let date;
    
    try {
      // Handle Firestore Timestamp
      if (createdAt && typeof createdAt.toDate === 'function') {
        date = createdAt.toDate();
      }
      // Handle existing Date objects
      else if (createdAt instanceof Date) {
        date = createdAt;
      }
      // Handle timestamp numbers
      else if (typeof createdAt === 'number') {
        date = new Date(createdAt);
      }
      // Handle date strings
      else if (typeof createdAt === 'string') {
        date = new Date(createdAt);
      }
      else {
        return { date: errorFallback, time: errorFallback };
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        return { date: errorFallback, time: errorFallback };
      }
      
      return {
        date: format(date, "MMM dd"),
        time: format(date, "HH:mm")
      };
    } catch (error) {
      console.warn('Date formatting error:', error);
      return { date: errorFallback, time: errorFallback };
    }
  }, [createdAt, errorFallback]);

  return (
    <div className="text-sm space-y-1">
      <div className="flex items-center">
        <Calendar className="h-3 w-3 text-gray-400 mr-1" />
        {formattedDate.date}
      </div>
      <div className="flex items-center">
        <Clock className="h-3 w-3 text-gray-400 mr-1" />
        {formattedDate.time}
      </div>
    </div>
  );
});

// Bulk Selection Checkbox Component
export const BulkSelectCheckbox = React.memo(({ 
  isChecked, 
  isIndeterminate, 
  onChange, 
  disabled = false 
}) => {
  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={isChecked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
        indeterminate={isIndeterminate || undefined}
      />
    </div>
  );
});

// Enhanced Table Row Component with both doctor and pharmacist transfer options
export const CaseTableRow = React.memo(({ 
  caseItem, 
  onTransferClick, 
  isSelected, 
  onSelectChange, 
  bulkMode 
}) => {
  const handleDoctorTransferClick = useCallback(() => {
    onTransferClick(caseItem, 'doctor');
  }, [caseItem, onTransferClick]);

  const handlePharmacistTransferClick = useCallback(() => {
    onTransferClick(caseItem, 'pharmacist');
  }, [caseItem, onTransferClick]);

  const handleSelectChange = useCallback((checked) => {
    onSelectChange(caseItem.id, checked);
  }, [caseItem.id, onSelectChange]);

  // Determine if case can be transferred
  const canTransferDoctor = caseItem.queue === "doctor";
  const canTransferPharmacist = true; // Pharmacists can be transferred for any case

  return (
    <TableRow className={`hover:bg-gray-50 transition-colors duration-200 ${isSelected ? 'bg-blue-50' : ''}`}>
      {/* Bulk selection column */}
      {bulkMode && (
        <TableCell className="w-12">
          <BulkSelectCheckbox
            isChecked={isSelected}
            onChange={handleSelectChange}
            disabled={!canTransferDoctor && !canTransferPharmacist}
          />
        </TableCell>
      )}

      <TableCell>
        <PatientInfoCell caseItem={caseItem} />
      </TableCell>

      <TableCell>
        <ClinicCell clinicCode={caseItem.clinicCode} manualClinicCode={caseItem.manualClinicCode} />
      </TableCell>

      <TableCell>
        <AssignmentCell 
          assignedDoctors={caseItem.assignedDoctors}
          pharmacistId={caseItem.pharmacistId}
          pharmacistName={caseItem.pharmacistName}
          pharmacistStatus={caseItem.pharmacistStatus}
          transferHistory={caseItem.transferHistory}
        />
      </TableCell>

      <TableCell>
        <div className="flex items-center">
          <StatusBadge queue={caseItem.queue} />
          <div
            className="ml-2 h-2 w-2 bg-green-400 rounded-full animate-pulse"
            title="Live update enabled"
          ></div>
        </div>
      </TableCell>

      <TableCell>
        <ContactCell consultationType={caseItem.consultationType} />
      </TableCell>

      <TableCell>
        <DateCell createdAt={caseItem.createdAt} />
      </TableCell>
      
      <TableCell>
        <DateCell createdAt={caseItem.doctorJoined} />
      </TableCell>

      <TableCell>
        <div className="flex flex-col space-y-2">
          {/* Doctor Transfer Button */}
          {canTransferDoctor && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDoctorTransferClick}
              className="flex items-center text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Stethoscope className="h-4 w-4 mr-1" />
              Transfer Doctor
            </Button>
          )}
          
          {/* Pharmacist Transfer Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handlePharmacistTransferClick}
            className="flex items-center text-green-600 border-green-200 hover:bg-green-50"
          >
            <Pill className="h-4 w-4 mr-1" />
            Transfer Pharmacist
          </Button>
          
          {/* Status indicators */}
          {caseItem.queue === "pharmacist" && !canTransferDoctor && (
            <span className="text-xs text-gray-500 flex items-center">
              <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
              Doctor completed
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});