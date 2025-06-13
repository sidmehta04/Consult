import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Select from "react-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft,
  User,
  Stethoscope,
  Pill,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Phone,
  Video,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  History,
  Filter,
  X,
  Users,
  CheckSquare,
  Square,
  Minus,
} from "lucide-react";
import {
  doc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "../../../firebase";
import { format } from "date-fns";

// OPTIMIZATION 1: Move static data outside component to prevent re-creation
const CASES_PER_PAGE = 20;
const MAX_VISIBLE_PAGES = 5;

// OPTIMIZATION 2: Memoize all sub-components with React.memo and proper dependency arrays
const StatusBadge = React.memo(({ queue }) => {
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

const DoctorStatusIcon = React.memo(({ status, caseCount }) => {
  if (status === "unavailable" || status === "on_break") {
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  } else if (caseCount >= 10) {
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  } else {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
});

const PatientInfoCell = React.memo(({ caseItem }) => (
  <div className="space-y-1">
    <div className="flex items-center">
      <User className="h-4 w-4 text-gray-400 mr-2" />
      <span className="font-medium">{caseItem.patientName}</span>
    </div>
    <div className="text-sm text-gray-600">EMR: {caseItem.emrNumber}</div>
    <div className="text-xs text-gray-500">{caseItem.chiefComplaint}</div>
  </div>
));

const ClinicCell = React.memo(({ clinicCode, manualClinicCode }) => (
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

const DoctorCell = React.memo(({ assignedDoctors, transferHistory }) => (
  <div className="space-y-1">
    <div className="flex items-center">
      <Stethoscope className="h-4 w-4 text-blue-500 mr-2" />
      <span className="font-medium">
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
    {transferHistory && transferHistory.length > 0 && (
      <div className="text-xs text-orange-600">
        Transfers: {transferHistory.length}
      </div>
    )}
  </div>
));

const ContactCell = React.memo(({ consultationType }) => (
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

// OPTIMIZATION 3: Optimize DateCell with better memoization
const DateCell = React.memo(({ createdAt, errorFallback = 'N/A' }) => {
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

// NEW: Bulk selection checkbox component
const BulkSelectCheckbox = React.memo(({ 
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
        indeterminate={isIndeterminate}
      />
    </div>
  );
});

// OPTIMIZATION 4: Memoize table row component with bulk selection
const CaseTableRow = React.memo(({ 
  caseItem, 
  onTransferClick, 
  isSelected, 
  onSelectChange, 
  bulkMode 
}) => {
  const handleTransferClick = useCallback(() => {
    onTransferClick(caseItem);
  }, [caseItem, onTransferClick]);

  const handleSelectChange = useCallback((checked) => {
    onSelectChange(caseItem.id, checked);
  }, [caseItem.id, onSelectChange]);

  return (
    <TableRow className={`hover:bg-gray-50 transition-colors duration-200 ${isSelected ? 'bg-blue-50' : ''}`}>
      {/* NEW: Bulk selection column */}
      {bulkMode && (
        <TableCell className="w-12">
          <BulkSelectCheckbox
            isChecked={isSelected}
            onChange={handleSelectChange}
            disabled={caseItem.queue !== "doctor"}
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
        <DoctorCell 
          assignedDoctors={caseItem.assignedDoctors} 
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
        {caseItem.queue === "doctor" && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTransferClick}
            className="flex items-center text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <ArrowRightLeft className="h-4 w-4 mr-1" />
            Transfer
          </Button>
        )}
        {caseItem.queue === "pharmacist" && (
          <span className="text-xs text-gray-500 flex items-center">
            <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
            Doctor completed
          </span>
        )}
      </TableCell>
    </TableRow>
  );
});

// OPTIMIZATION 5: Extract pagination logic to custom hook
const usePagination = (items, itemsPerPage = CASES_PER_PAGE) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = items.slice(startIndex, endIndex);

    return {
      totalPages,
      startIndex,
      endIndex,
      currentItems,
      totalItems: items.length,
    };
  }, [items, currentPage, itemsPerPage]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const { totalPages } = paginationData;

    if (totalPages <= MAX_VISIBLE_PAGES) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, paginationData.totalPages]);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, paginationData.totalPages));
  }, [paginationData.totalPages]);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToPage = useCallback(
    (page) => {
      if (page >= 1 && page <= paginationData.totalPages) {
        setCurrentPage(page);
      }
    },
    [paginationData.totalPages]
  );

  // Reset to first page when items change
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  return {
    ...paginationData,
    currentPage,
    pageNumbers,
    goToNextPage,
    goToPreviousPage,
    goToPage,
  };
};

// NEW: Custom hook for bulk selection management
const useBulkSelection = (cases) => {
  const [selectedCases, setSelectedCases] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Filter transferable cases (only doctor queue cases)
  const transferableCases = useMemo(() => 
    cases.filter(caseItem => caseItem.queue === "doctor"), 
    [cases]
  );

  const transferableCaseIds = useMemo(() => 
    transferableCases.map(c => c.id), 
    [transferableCases]
  );

  // Calculate selection state
  const selectionState = useMemo(() => {
    const selectedTransferableCount = Array.from(selectedCases)
      .filter(id => transferableCaseIds.includes(id)).length;
    
    return {
      selectedCount: selectedTransferableCount,
      totalTransferable: transferableCases.length,
      isAllSelected: selectedTransferableCount === transferableCases.length && transferableCases.length > 0,
      isIndeterminate: selectedTransferableCount > 0 && selectedTransferableCount < transferableCases.length,
      hasSelection: selectedTransferableCount > 0,
    };
  }, [selectedCases, transferableCases, transferableCaseIds]);

  const toggleBulkMode = useCallback(() => {
    setBulkMode(prev => {
      if (prev) {
        // Exiting bulk mode, clear selections
        setSelectedCases(new Set());
      }
      return !prev;
    });
  }, []);

  const selectCase = useCallback((caseId, checked) => {
    setSelectedCases(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(caseId);
      } else {
        newSet.delete(caseId);
      }
      return newSet;
    });
  }, []);

  const selectAllTransferable = useCallback((checked) => {
    setSelectedCases(prev => {
      const newSet = new Set(prev);
      transferableCaseIds.forEach(id => {
        if (checked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
      });
      return newSet;
    });
  }, [transferableCaseIds]);

  const clearSelection = useCallback(() => {
    setSelectedCases(new Set());
  }, []);

  const getSelectedCases = useCallback(() => {
    return transferableCases.filter(caseItem => selectedCases.has(caseItem.id));
  }, [transferableCases, selectedCases]);

  // Clear selections when cases change significantly
  useEffect(() => {
    setSelectedCases(prev => {
      const validIds = new Set(transferableCaseIds);
      const filtered = new Set(Array.from(prev).filter(id => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [transferableCaseIds]);

  return {
    bulkMode,
    selectedCases,
    selectionState,
    toggleBulkMode,
    selectCase,
    selectAllTransferable,
    clearSelection,
    getSelectedCases,
  };
};

// OPTIMIZATION 6: Main component with optimized state management
const CaseTransferTable = ({
  cases,
  doctors,
  loading,
  currentUser,
  onSuccess,
  onError,
}) => {
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferDialog, setTransferDialog] = useState({
    open: false,
    case: null,
    cases: [],
    selectedDoctorId: "",
    isBulk: false,
  });
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState(null);
  
  // Ref to prevent multiple simultaneous transfers
  const transferInProgressRef = useRef(false);

  // NEW: Use bulk selection hook
  const bulkSelection = useBulkSelection(cases);

  // OPTIMIZATION 7: Memoize filtered cases to prevent unnecessary recalculation
  const filteredCases = useMemo(() => {
    if (!selectedDoctorFilter) return cases;
    return cases.filter(
      (caseItem) => caseItem.assignedDoctors?.primary === selectedDoctorFilter
    );
  }, [cases, selectedDoctorFilter]);

  // Use pagination hook
  const pagination = usePagination(filteredCases);

  // OPTIMIZATION 8: Memoize doctor options with deep comparison
  const doctorOptions = useMemo(() => {
    const availableDoctors = doctors.filter((doctor) => doctor.isAvailable);
    
    return availableDoctors.map((doctor) => {
      const canAcceptMoreCases = doctor.caseCount < 10;
      const statusIndicator = canAcceptMoreCases ? "" : " (At Capacity)";
      
      return {
        value: doctor.id,
        label: `${doctor.name} (${doctor.caseCount}/10 cases)${statusIndicator}`,
        doctor,
        isDisabled: !canAcceptMoreCases,
      };
    });
  }, [doctors]);

  const doctorFilterOptions = useMemo(() => {
    return doctors.map((doctor) => ({
      value: doctor.id,
      label: doctor.name,
      doctor,
    }));
  }, [doctors]);

  // OPTIMIZATION 9: Optimize dialog handlers with useCallback
  const openTransferDialog = useCallback((caseItem) => {
    setTransferDialog({
      open: true,
      case: caseItem,
      cases: [],
      selectedDoctorId: "",
      isBulk: false,
    });
  }, []);

  // NEW: Bulk transfer dialog handler
  const openBulkTransferDialog = useCallback(() => {
    const selectedCases = bulkSelection.getSelectedCases();
    if (selectedCases.length === 0) {
      onError("Please select cases to transfer.");
      return;
    }

    setTransferDialog({
      open: true,
      case: null,
      cases: selectedCases,
      selectedDoctorId: "",
      isBulk: true,
    });
  }, [bulkSelection, onError]);

  const closeTransferDialog = useCallback(() => {
    setTransferDialog({
      open: false,
      case: null,
      cases: [],
      selectedDoctorId: "",
      isBulk: false,
    });
  }, []);

  const handleDoctorSelect = useCallback((selectedOption) => {
    setTransferDialog((prev) => ({
      ...prev,
      selectedDoctorId: selectedOption?.value || "",
    }));
  }, []);

  const clearDoctorFilter = useCallback(() => {
    setSelectedDoctorFilter(null);
  }, []);

  // NEW: Enhanced transfer handler for both single and bulk transfers
  const handleTransferCase = useCallback(async () => {
    const { case: singleCase, cases: multipleCases, selectedDoctorId, isBulk } = transferDialog;
    
    if (!selectedDoctorId) {
      onError("Please select a doctor to transfer the case(s) to.");
      return;
    }

    const casesToTransfer = isBulk ? multipleCases : [singleCase];
    
    if (casesToTransfer.length === 0) {
      onError("No cases selected for transfer.");
      return;
    }

    // Prevent multiple simultaneous transfers
    if (transferInProgressRef.current) {
      onError("Transfer already in progress. Please wait.");
      return;
    }

    setTransferLoading(true);
    transferInProgressRef.current = true;

    try {
      const selectedDoctor = doctors.find(
        (doctor) => doctor.id === selectedDoctorId
      );

      if (!selectedDoctor) {
        throw new Error("Selected doctor not found");
      }

      // Check if doctor can handle all cases
      const doctorCurrentCases = doctors.find(d => d.id === selectedDoctorId)?.caseCount || 0;
      if (doctorCurrentCases + casesToTransfer.length > 10) {
        throw new Error(`Doctor ${selectedDoctor.name} cannot handle ${casesToTransfer.length} additional cases. Current: ${doctorCurrentCases}/10`);
      }

      // For bulk transfers, use batch operations for better performance
      if (isBulk && casesToTransfer.length > 1) {
        const batch = writeBatch(firestore);
        
        casesToTransfer.forEach(caseItem => {
          const caseRef = doc(firestore, "cases", caseItem.id);
          
          // Get current doctor info for transfer history
          const currentDoctorId = caseItem.assignedDoctors?.primary;
          const currentDoctorName = caseItem.assignedDoctors?.primaryName;

          // Transfer history entry
          const transferHistoryEntry = {
            transferredAt: new Date(),
            transferredBy: currentUser.uid,
            transferredByName: currentUser.displayName || currentUser.name,
            transferredFrom: currentDoctorId || null,
            transferredFromName: currentDoctorName || "Unassigned",
            transferredTo: selectedDoctorId,
            transferredToName: selectedDoctor.name,
            transferReason: "Bulk case load balancing",
          };

          // Update data
          const updateData = {
            "assignedDoctors.primary": selectedDoctorId,
            "assignedDoctors.primaryName": selectedDoctor.name,
            "assignedDoctors.primaryType": "bulk_transferred",
            
            transferHistory: [
              ...(caseItem.transferHistory || []), 
              transferHistoryEntry
            ],
            
            transferCount: (caseItem.transferCount || 0) + 1,
            lastTransferredAt: serverTimestamp(),
            lastModified: serverTimestamp(),
          };

          batch.update(caseRef, updateData);
        });

        await batch.commit();

        const transferMessage = `Successfully transferred ${casesToTransfer.length} cases to Dr. ${selectedDoctor.name}`;
        onSuccess(transferMessage);
        
        // Clear bulk selection after successful transfer
        bulkSelection.clearSelection();
        
      } else {
        // Single case transfer using transaction (existing logic)
        const caseToTransfer = casesToTransfer[0];
        const caseRef = doc(firestore, "cases", caseToTransfer.id);

        await runTransaction(firestore, async (transaction) => {
          const caseSnap = await transaction.get(caseRef);
          
          if (!caseSnap.exists()) {
            throw new Error("Case not found");
          }

          const currentCaseData = caseSnap.data();
          
          const currentDoctorId = currentCaseData.assignedDoctors?.primary;
          const currentDoctorName = currentCaseData.assignedDoctors?.primaryName;

          const transferHistoryEntry = {
            transferredAt: new Date(),
            transferredBy: currentUser.uid,
            transferredByName: currentUser.displayName || currentUser.name,
            transferredFrom: currentDoctorId || null,
            transferredFromName: currentDoctorName || "Unassigned",
            transferredTo: selectedDoctorId,
            transferredToName: selectedDoctor.name,
            transferReason: "Case load balancing",
          };

          const updateData = {
            "assignedDoctors.primary": selectedDoctorId,
            "assignedDoctors.primaryName": selectedDoctor.name,
            "assignedDoctors.primaryType": "transferred",
            
            transferHistory: [
              ...(currentCaseData.transferHistory || []), 
              transferHistoryEntry
            ],
            
            transferCount: (currentCaseData.transferCount || 0) + 1,
            lastTransferredAt: serverTimestamp(),
            lastModified: serverTimestamp(),
          };

          transaction.update(caseRef, updateData);
        });

        const transferMessage = caseToTransfer.assignedDoctors?.primaryName 
          ? `Case transferred from Dr. ${caseToTransfer.assignedDoctors.primaryName} to Dr. ${selectedDoctor.name}`
          : `Case assigned to Dr. ${selectedDoctor.name}`;

        onSuccess(transferMessage);
      }

      closeTransferDialog();
      
    } catch (err) {
      console.error("Error transferring case(s):", err);
      
      // More specific error messages
      if (err.code === 'permission-denied') {
        onError("Permission denied. You may not have rights to transfer these cases.");
      } else if (err.code === 'not-found') {
        onError("One or more cases no longer exist. They may have been deleted or transferred.");
      } else if (err.message.includes("network")) {
        onError("Network error. Please check your connection and try again.");
      } else if (err.message.includes("cannot handle")) {
        onError(err.message);
      } else {
        onError(`Transfer failed. Please try again in a moment.`);
      }
    } finally {
      setTransferLoading(false);
      transferInProgressRef.current = false;
    }
  }, [
    transferDialog,
    doctors,
    currentUser,
    onSuccess,
    onError,
    closeTransferDialog,
    bulkSelection,
  ]);

  // OPTIMIZATION 11: Memoize select styles to prevent recreation
  const selectStyles = useMemo(() => ({
    control: (base, state) => ({
      ...base,
      minHeight: '38px',
      borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? '#3b82f6' : '#9ca3af',
      },
      backgroundColor: '#ffffff',
      fontSize: '14px',
    }),
    menu: (base) => ({
      ...base,
      zIndex: 50,
      border: '1px solid #d1d5db',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      backgroundColor: '#ffffff',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? '#3b82f6'
        : state.isFocused
        ? '#eff6ff'
        : 'white',
      color: state.isSelected ? 'white' : '#374151',
      cursor: 'pointer',
      padding: '10px 12px',
      '&:active': {
        backgroundColor: state.isSelected ? '#3b82f6' : '#dbeafe',
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: '#374151',
    }),
    placeholder: (base) => ({
      ...base,
      color: '#9ca3af',
    }),
    input: (base) => ({
      ...base,
      color: '#374151',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: '#d1d5db',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: '#6b7280',
      '&:hover': {
        color: '#374151',
      },
    }),
  }), []);

  const dialogSelectStyles = useMemo(() => ({
    ...selectStyles,
    control: (base, state) => ({
      ...selectStyles.control(base, state),
      minHeight: "40px",
    }),
    option: (base, state) => ({
      ...selectStyles.option(base, state),
      backgroundColor: state.isDisabled 
        ? '#f9fafb' 
        : state.isSelected
        ? '#3b82f6'
        : state.isFocused
        ? '#eff6ff'
        : 'white',
      color: state.isDisabled 
        ? '#9ca3af'
        : state.isSelected 
        ? 'white' 
        : '#374151',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      padding: '8px 12px',
      '&:active': {
        backgroundColor: state.isDisabled 
          ? '#f9fafb'
          : state.isSelected 
          ? '#3b82f6' 
          : '#dbeafe',
      },
    }),
  }), [selectStyles]);

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 border rounded-lg bg-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">
            Loading cases with real-time updates...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (cases.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 border rounded-lg bg-white">
        <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium">No pending cases found</p>
        <p className="text-sm">
          All cases are either completed or don't match your filters.
        </p>
        <div className="mt-4 flex items-center justify-center text-xs text-gray-400">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
          Real-time monitoring active
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* NEW: Bulk Actions Bar */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant={bulkSelection.bulkMode ? "default" : "outline"}
                onClick={bulkSelection.toggleBulkMode}
                className="flex items-center"
              >
                {bulkSelection.bulkMode ? (
                  <CheckSquare className="h-4 w-4 mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                {bulkSelection.bulkMode ? "Exit Bulk Mode" : "Bulk Select"}
              </Button>

              {bulkSelection.bulkMode && (
                <>
                  <div className="flex items-center space-x-2">
                    <BulkSelectCheckbox
                      isChecked={bulkSelection.selectionState.isAllSelected}
                      isIndeterminate={bulkSelection.selectionState.isIndeterminate}
                      onChange={bulkSelection.selectAllTransferable}
                    />
                    <span className="text-sm text-gray-600">
                      Select All ({bulkSelection.selectionState.totalTransferable} transferable)
                    </span>
                  </div>

                  {bulkSelection.selectionState.hasSelection && (
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                        <Users className="h-3 w-3 mr-1" />
                        {bulkSelection.selectionState.selectedCount} selected
                      </Badge>
                      
                      <Button
                        size="sm"
                        onClick={openBulkTransferDialog}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Transfer Selected
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={bulkSelection.clearSelection}
                        className="text-gray-600"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bulk Mode Instructions */}
            {bulkSelection.bulkMode && (
              <div className="text-xs text-gray-500 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                Only cases in doctor queue can be transferred
              </div>
            )}
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter Cases</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="min-w-0 flex-1" style={{ minWidth: '280px' }}>
                  <Select
                    options={doctorFilterOptions}
                    value={doctorFilterOptions.find(option => option.value === selectedDoctorFilter) || null}
                    onChange={(selectedOption) => setSelectedDoctorFilter(selectedOption?.value || null)}
                    placeholder="Filter by doctor..."
                    isSearchable
                    isClearable
                    menuPlacement="bottom"
                    styles={selectStyles}
                    filterOption={(option, inputValue) => {
                      return option.label.toLowerCase().includes(inputValue.toLowerCase());
                    }}
                  />
                </div>
                
                {selectedDoctorFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearDoctorFilter}
                    className="flex items-center text-gray-600 hover:text-gray-800"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Filter Results Summary */}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              {selectedDoctorFilter && (
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    <Stethoscope className="h-3 w-3 mr-1" />
                    {doctorFilterOptions.find(d => d.value === selectedDoctorFilter)?.label}
                  </Badge>
                  <span className="text-xs">
                    {filteredCases.length} of {cases.length} cases
                  </span>
                </div>
              )}
              
              <div className="flex items-center text-xs text-gray-500">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                Live updates active
              </div>
            </div>
          </div>
        </div>

        {/* Cases Table */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                {/* NEW: Bulk selection header */}
                {bulkSelection.bulkMode && (
                  <TableHead className="w-12">
                    <BulkSelectCheckbox
                      isChecked={bulkSelection.selectionState.isAllSelected}
                      isIndeterminate={bulkSelection.selectionState.isIndeterminate}
                      onChange={bulkSelection.selectAllTransferable}
                    />
                  </TableHead>
                )}
                <TableHead className="font-semibold">Patient Info</TableHead>
                <TableHead className="font-semibold">Clinic Code</TableHead>
                <TableHead className="font-semibold">Current Doctor</TableHead>
                <TableHead className="font-semibold">Queue Status</TableHead>
                <TableHead className="font-semibold">Contact</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold">Doctor Joined</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.currentItems.map((caseItem) => (
                <CaseTableRow
                  key={caseItem.id}
                  caseItem={caseItem}
                  onTransferClick={openTransferDialog}
                  isSelected={bulkSelection.selectedCases.has(caseItem.id)}
                  onSelectChange={bulkSelection.selectCase}
                  bulkMode={bulkSelection.bulkMode}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-3 border rounded-lg">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing {pagination.startIndex + 1} to{" "}
                {Math.min(pagination.endIndex, filteredCases.length)} of{" "}
                {filteredCases.length} 
                {selectedDoctorFilter ? ' filtered' : ''} cases
              </span>
              {bulkSelection.bulkMode && bulkSelection.selectionState.hasSelection && (
                <span className="ml-4 text-blue-600">
                  • {bulkSelection.selectionState.selectedCount} selected for transfer
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={pagination.goToPreviousPage}
                disabled={pagination.currentPage === 1}
                className="flex items-center"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center space-x-1">
                {pagination.pageNumbers.map((pageNum, index) => (
                  <React.Fragment key={index}>
                    {pageNum === "..." ? (
                      <span className="px-2 py-1 text-gray-500">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    ) : (
                      <Button
                        variant={
                          pagination.currentPage === pageNum ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => pagination.goToPage(pageNum)}
                        className={`min-w-[32px] h-8 ${
                          pagination.currentPage === pageNum
                            ? "bg-blue-600 text-white"
                            : "text-gray-700"
                        }`}
                      >
                        {pageNum}
                      </Button>
                    )}
                  </React.Fragment>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={pagination.goToNextPage}
                disabled={pagination.currentPage === pagination.totalPages}
                className="flex items-center"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Transfer Dialog - Single & Bulk */}
      <Dialog open={transferDialog.open} onOpenChange={closeTransferDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Search className="h-5 w-5 text-blue-500 mr-2" />
              {transferDialog.isBulk ? "Bulk Transfer Cases" : "Transfer Case"}
            </DialogTitle>
            <DialogDescription>
              {transferDialog.isBulk 
                ? `Select an available doctor to transfer ${transferDialog.cases.length} selected cases to.`
                : "Select an available doctor to transfer this case to."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* Single Case Info */}
            {!transferDialog.isBulk && transferDialog.case && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm space-y-1">
                  <div><strong>Patient:</strong> {transferDialog.case.patientName}</div>
                  <div><strong>EMR:</strong> {transferDialog.case.emrNumber}</div>
                  <div><strong>Current Doctor:</strong> {transferDialog.case.assignedDoctors?.primaryName || "Not assigned"}</div>
                  <div><strong>Clinic:</strong> {transferDialog.case.clinicCode} {transferDialog.case.manualClinicCode ? `(${transferDialog.case.manualClinicCode})` : ""}</div>
                  <div><strong>Complaint:</strong> {transferDialog.case.chiefComplaint}</div>
                  {transferDialog.case.transferCount > 0 && (
                    <div className="text-orange-600">
                      <strong>Previous Transfers:</strong> {transferDialog.case.transferCount}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bulk Cases Info */}
            {transferDialog.isBulk && transferDialog.cases.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Selected Cases ({transferDialog.cases.length})
                  </h4>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    <Users className="h-3 w-3 mr-1" />
                    Bulk Transfer
                  </Badge>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {transferDialog.cases.map((caseItem, index) => (
                    <div key={caseItem.id} className="text-sm border-l-2 border-blue-300 pl-3 py-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium">{caseItem.patientName}</span>
                          <span className="text-gray-600 ml-2">EMR: {caseItem.emrNumber}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {caseItem.assignedDoctors?.primaryName || "Unassigned"}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {caseItem.clinicCode} • {caseItem.chiefComplaint}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bulk Transfer Summary */}
                <div className="mt-3 p-2 bg-blue-50 rounded border">
                  <div className="text-xs text-blue-800">
                    <strong>Transfer Summary:</strong> All {transferDialog.cases.length} cases will be moved to the selected doctor with full history tracking.
                  </div>
                </div>
              </div>
            )}

            {/* Transfer History Warnings */}
            {(transferDialog.case?.transferHistory?.length > 0 || 
              transferDialog.cases.some(c => c.transferHistory?.length > 0)) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <History className="h-4 w-4 text-amber-600 mr-2" />
                  <span className="text-sm font-medium text-amber-800">Transfer History Warning</span>
                </div>
                <div className="text-xs text-amber-700">
                  {transferDialog.isBulk 
                    ? `Some of the selected cases have been transferred before. Transfer history will be preserved.`
                    : `This case has been transferred ${transferDialog.case?.transferHistory?.length} time(s) previously.`
                  }
                </div>
              </div>
            )}

            {/* Doctor Selection */}
            <div className="space-y-2">
              <Label>Select New Doctor</Label>
              <Select
                options={doctorOptions}
                value={doctorOptions.find(option => option.value === transferDialog.selectedDoctorId) || null}
                onChange={handleDoctorSelect}
                placeholder="Select doctor..."
                isSearchable
                isClearable
                isOptionDisabled={(option) => option.isDisabled}
                menuPlacement="bottom"
                menuShouldBlockScroll={true}
                styles={dialogSelectStyles}
                filterOption={(option, inputValue) => {
                  return option.label
                    .toLowerCase()
                    .includes(inputValue.toLowerCase());
                }}
              />
              <p className="text-xs text-gray-500">
                Available doctors are shown. Doctors at capacity (10+ cases) are disabled.
                {transferDialog.isBulk && ` Selected doctor must be able to handle ${transferDialog.cases.length} additional cases.`}
              </p>
            </div>

            {/* Doctor Capacity Check for Bulk */}
            {transferDialog.isBulk && transferDialog.selectedDoctorId && (
              <div className="bg-blue-50 p-3 rounded-lg">
                {(() => {
                  const selectedDoc = doctors.find(d => d.id === transferDialog.selectedDoctorId);
                  const currentCases = selectedDoc?.caseCount || 0;
                  const afterTransfer = currentCases + transferDialog.cases.length;
                  const canHandle = afterTransfer <= 10;
                  
                  return (
                    <div className="flex items-center">
                      {canHandle ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                      )}
                      <div className="text-sm">
                        <div className={canHandle ? "text-green-900" : "text-red-900"}>
                          <strong>Dr. {selectedDoc?.name}</strong> case load: {currentCases} → {afterTransfer}/10
                        </div>
                        {!canHandle && (
                          <div className="text-red-700 text-xs mt-1">
                            Cannot handle {transferDialog.cases.length} additional cases. Please select a different doctor.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Selected Doctor Preview */}
            {transferDialog.selectedDoctorId && !transferDialog.isBulk && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center">
                  <ArrowRight className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-900">
                    Transferring from:{" "}
                    {transferDialog.case.assignedDoctors?.primaryName || "Unassigned"} → {" "}
                    {
                      doctorOptions.find(
                        (option) =>
                          option.value === transferDialog.selectedDoctorId
                      )?.doctor?.name
                    }
                  </span>
                </div>
                <div className="mt-2 flex items-center text-xs text-blue-700">
                  <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                  Transfer history will be automatically recorded
                </div>
              </div>
            )}

            {/* Transfer Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-amber-600 mr-2 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Transfer Tracking:</strong> {transferDialog.isBulk ? "These transfers" : "This transfer"} will be recorded with full history including previous doctor, timestamp, and reason. {transferDialog.isBulk ? "All cases" : "The case"} will immediately appear in the new doctor's queue.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={closeTransferDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferCase}
              disabled={
                !transferDialog.selectedDoctorId || 
                transferLoading ||
                (transferDialog.isBulk && (() => {
                  const selectedDoc = doctors.find(d => d.id === transferDialog.selectedDoctorId);
                  const currentCases = selectedDoc?.caseCount || 0;
                  return currentCases + transferDialog.cases.length > 10;
                })())
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {transferLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {transferDialog.isBulk ? "Transferring..." : "Transferring..."}
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  {transferDialog.isBulk 
                    ? `Transfer ${transferDialog.cases.length} Cases` 
                    : "Transfer"
                  }
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default React.memo(CaseTransferTable);