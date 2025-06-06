import React, { useState, useMemo, useCallback, useEffect } from "react";
import Select from "react-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import {
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  writeBatch,
  arrayUnion,
} from "firebase/firestore";
import { firestore } from "../../../firebase";
import { format } from "date-fns";

// Memoized components for better performance
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

const ClinicCell = React.memo(({ clinicCode }) => (
  <div className="flex items-center">
    <div className="h-2 w-2 bg-purple-500 rounded-full mr-2"></div>
    <span className="font-medium text-purple-700 text-sm">{clinicCode}</span>
  </div>
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

const DateCell = React.memo(({ createdAt }) => (
  <div className="text-sm space-y-1">
    <div className="flex items-center">
      <Calendar className="h-3 w-3 text-gray-400 mr-1" />
      {format(createdAt, "MMM dd")}
    </div>
    <div className="flex items-center">
      <Clock className="h-3 w-3 text-gray-400 mr-1" />
      {format(createdAt, "HH:mm")}
    </div>
  </div>
));

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
    selectedDoctorId: "",
  });

  // Pagination state with better initial values
  const [currentPage, setCurrentPage] = useState(1);
  const casesPerPage = 20;

  // Memoized pagination calculations
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(cases.length / casesPerPage);
    const startIndex = (currentPage - 1) * casesPerPage;
    const endIndex = startIndex + casesPerPage;
    const currentCases = cases.slice(startIndex, endIndex);

    return {
      totalPages,
      startIndex,
      endIndex,
      currentCases,
    };
  }, [cases, currentPage, casesPerPage]);

  // Memoized doctor options for select
  const doctorOptions = useMemo(() => {
    return doctors
      .filter((doctor) => doctor.isAvailable && doctor.caseCount < 10)
      .map((doctor) => ({
        value: doctor.id,
        label: `${doctor.name} (${doctor.caseCount}/10 cases)`,
        doctor,
      }));
  }, [doctors]);

  // Memoized page numbers calculation
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisiblePages = 5;
    const { totalPages } = paginationData;

    if (totalPages <= maxVisiblePages) {
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

  // Optimized pagination handlers
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

  // Reset to first page when cases change (with debouncing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [cases.length]);

  // Optimized dialog handlers
  const openTransferDialog = useCallback((caseItem) => {
    setTransferDialog({
      open: true,
      case: caseItem,
      selectedDoctorId: "",
    });
  }, []);

  const closeTransferDialog = useCallback(() => {
    setTransferDialog({
      open: false,
      case: null,
      selectedDoctorId: "",
    });
  }, []);

  // Optimized doctor selection handler
  const handleDoctorSelect = useCallback((selectedOption) => {
    setTransferDialog((prev) => ({
      ...prev,
      selectedDoctorId: selectedOption?.value || "",
    }));
  }, []);

  // Enhanced transfer handler with transfer history tracking
  const handleTransferCase = useCallback(async () => {
    if (!transferDialog.case || !transferDialog.selectedDoctorId) {
      onError("Please select a doctor to transfer the case to.");
      return;
    }

    setTransferLoading(true);

    try {
      const selectedDoctor = doctorOptions.find(
        (option) => option.value === transferDialog.selectedDoctorId
      )?.doctor;

      if (!selectedDoctor) {
        throw new Error("Selected doctor not found");
      }

      // Use batch write for better performance
      const batch = writeBatch(firestore);
      const caseRef = doc(firestore, "cases", transferDialog.case.id);

      // Get current case data
      const currentCaseSnap = await getDoc(caseRef);
      if (!currentCaseSnap.exists()) {
        throw new Error("Case not found");
      }

      const currentCaseData = currentCaseSnap.data();
      const currentVersion = currentCaseData.version || 0;

      // Get current doctor info for transfer history
      const currentDoctorId = currentCaseData.assignedDoctors?.primary;
      const currentDoctorName = currentCaseData.assignedDoctors?.primaryName;

      // Create transfer history entry with current timestamp
      const now = new Date();
      const transferHistoryEntry = {
        transferredAt: now, // Use Date object instead of serverTimestamp()
        transferredBy: currentUser.uid,
        transferredByName: currentUser.displayName || currentUser.name,
        transferredFrom: currentDoctorId || null,
        transferredFromName: currentDoctorName || "Unassigned",
        transferredTo: transferDialog.selectedDoctorId,
        transferredToName: selectedDoctor.name,
        transferReason: "Case load balancing",
        version: currentVersion + 1,
      };

      // Prepare update data with enhanced transfer tracking
      const updateData = {
        "assignedDoctors.primary": transferDialog.selectedDoctorId,
        "assignedDoctors.primaryName": selectedDoctor.name,
        "assignedDoctors.primaryStatus": selectedDoctor.availabilityStatus,
        "assignedDoctors.primaryType": "transferred",
        
        // Legacy fields (maintain backwards compatibility)
        transferredAt: serverTimestamp(),
        transferredBy: currentUser.uid,
        transferredByName: currentUser.displayName || currentUser.name,
        transferredFrom: currentDoctorId || null,
        transferredFromName: currentDoctorName || "Unassigned",
        transferReason: "Case load balancing",
        
        // Enhanced transfer tracking
        transferHistory: arrayUnion(transferHistoryEntry),
        lastTransferredAt: serverTimestamp(),
        transferCount: (currentCaseData.transferCount || 0) + 1,
        
        // Version control
        version: currentVersion + 1,
        lastModified: serverTimestamp(),
      };

      // Add to batch
      batch.update(caseRef, updateData);

      // Commit batch
      await batch.commit();

      const transferMessage = currentDoctorName 
        ? `Case transferred successfully from Dr. ${currentDoctorName} to Dr. ${selectedDoctor.name}`
        : `Case transferred successfully to Dr. ${selectedDoctor.name}`;

      onSuccess(transferMessage);
      closeTransferDialog();
    } catch (err) {
      console.error("Error transferring case:", err);
      onError("Failed to transfer case. Please try again.");
    } finally {
      setTransferLoading(false);
    }
  }, [
    transferDialog,
    doctorOptions,
    currentUser,
    onSuccess,
    onError,
    closeTransferDialog,
  ]);

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
      <div className="space-y-4">
        {/* Cases Table */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-semibold">Patient Info</TableHead>
                <TableHead className="font-semibold">Clinic Code</TableHead>
                <TableHead className="font-semibold">Current Doctor</TableHead>
                <TableHead className="font-semibold">Queue Status</TableHead>
                <TableHead className="font-semibold">Contact</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginationData.currentCases.map((caseItem) => (
                <TableRow
                  key={caseItem.id}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <TableCell>
                    <PatientInfoCell caseItem={caseItem} />
                  </TableCell>

                  <TableCell>
                    <ClinicCell clinicCode={caseItem.clinicCode} />
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
                    {caseItem.queue === "doctor" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTransferDialog(caseItem)}
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
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {paginationData.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-3 border rounded-lg">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing {paginationData.startIndex + 1} to{" "}
                {Math.min(paginationData.endIndex, cases.length)} of{" "}
                {cases.length} cases
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="flex items-center"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center space-x-1">
                {pageNumbers.map((pageNum, index) => (
                  <React.Fragment key={index}>
                    {pageNum === "..." ? (
                      <span className="px-2 py-1 text-gray-500">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    ) : (
                      <Button
                        variant={
                          currentPage === pageNum ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className={`min-w-[32px] h-8 ${
                          currentPage === pageNum
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
                onClick={goToNextPage}
                disabled={currentPage === paginationData.totalPages}
                className="flex items-center"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Transfer Dialog */}
      <Dialog open={transferDialog.open} onOpenChange={closeTransferDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Search className="h-5 w-5 text-blue-500 mr-2" />
              Transfer Case to Another Doctor
            </DialogTitle>
            <DialogDescription>
              Select an available doctor to transfer this case to. The transfer history will be tracked automatically.
            </DialogDescription>
          </DialogHeader>

          {transferDialog.case && (
            <div className="space-y-4">
              {/* Case Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-gray-900">Case Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Patient:</span>
                    <span className="ml-2 font-medium">
                      {transferDialog.case.patientName}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">EMR:</span>
                    <span className="ml-2 font-medium">
                      {transferDialog.case.emrNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Clinic:</span>
                    <span className="ml-2 font-medium text-purple-700">
                      {transferDialog.case.clinicCode}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Current Doctor:</span>
                    <span className="ml-2 font-medium">
                      {transferDialog.case.assignedDoctors?.primaryName ||
                        "Not assigned"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Complaint:</span>
                    <span className="ml-2">
                      {transferDialog.case.chiefComplaint}
                    </span>
                  </div>
                  {transferDialog.case.transferCount > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Previous Transfers:</span>
                      <span className="ml-2 text-orange-600 font-medium">
                        {transferDialog.case.transferCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transfer History */}
              {transferDialog.case.transferHistory && transferDialog.case.transferHistory.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <History className="h-4 w-4 text-amber-600 mr-2" />
                    <span className="text-sm font-medium text-amber-800">Transfer History</span>
                  </div>
                  <div className="text-xs text-amber-700">
                    This case has been transferred {transferDialog.case.transferHistory.length} time(s) previously.
                  </div>
                </div>
              )}

              {/* Doctor Selection */}
              <div className="space-y-2">
                <Label htmlFor="doctor-select" className="text-sm font-medium">
                  Select New Doctor
                </Label>
                <Select
                  id="doctor-select"
                  options={doctorOptions}
                  value={
                    doctorOptions.find(
                      (option) =>
                        option.value === transferDialog.selectedDoctorId
                    ) || null
                  }
                  onChange={handleDoctorSelect}
                  placeholder="Search and select a doctor..."
                  isSearchable
                  isClearable
                  menuPlacement="bottom"
                  menuShouldBlockScroll={true}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: "40px",
                      borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
                      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
                      '&:hover': {
                        borderColor: state.isFocused ? '#3b82f6' : '#9ca3af',
                      },
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 50,
                      border: '1px solid #d1d5db',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
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
                      padding: '8px 12px',
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
                  }}
                  filterOption={(option, inputValue) => {
                    return option.label
                      .toLowerCase()
                      .includes(inputValue.toLowerCase());
                  }}
                />
                <p className="text-xs text-gray-500">
                  Only available doctors with less than 10 cases are shown.
                </p>
              </div>

              {/* Selected Doctor Info */}
              {transferDialog.selectedDoctorId && (
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

              {/* Real-time Update Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-amber-600 mr-2 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <strong>Transfer Tracking:</strong> This transfer will be recorded with full history including previous doctor, timestamp, and reason. The case will immediately appear in the new doctor's queue.
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={closeTransferDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferCase}
              disabled={!transferDialog.selectedDoctorId || transferLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {transferLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transfer Case
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