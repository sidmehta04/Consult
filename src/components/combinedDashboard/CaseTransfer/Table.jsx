// CaseTransfer/Table.jsx
// Main table component that orchestrates everything

import React, { useState, useMemo, useCallback, useRef } from "react";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft,
  Stethoscope,
  Pill,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  History,
  Filter,
  X,
  Users,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  doc,
  serverTimestamp,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "../../../firebase";

// Import our separated components and hooks
import {
  StatusBadge,
  PatientInfoCell,
  ClinicCell,
  AssignmentCell,
  ContactCell,
  DateCell,
  BulkSelectCheckbox,
  CaseTableRow,
} from "./TableComponents";

import {
  usePagination,
  useBulkSelection,
  useTransferDialog,
  useSelectStyles,
  useDialogSelectStyles,
  useProcessedOptions,
} from "./TableHooks";

// Main CaseTransferTable Component
const CaseTransferTable = ({
  cases,
  doctors,
  pharmacists = [],
  loading,
  currentUser,
  onSuccess,
  onError,
}) => {
  const [transferLoading, setTransferLoading] = useState(false);
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState(null);
  
  // Ref to prevent multiple simultaneous transfers
  const transferInProgressRef = useRef(false);

  // Use our custom hooks
  const bulkSelection = useBulkSelection(cases);
  const transferDialogHook = useTransferDialog();
  const selectStyles = useSelectStyles();
  const dialogSelectStyles = useDialogSelectStyles();
  const { doctorOptions, pharmacistOptions, doctorFilterOptions } = useProcessedOptions(doctors, pharmacists);

  // Memoize filtered cases to prevent unnecessary recalculation
  const filteredCases = useMemo(() => {
    if (!selectedDoctorFilter) return cases;
    return cases.filter(
      (caseItem) => caseItem.assignedDoctors?.primary === selectedDoctorFilter
    );
  }, [cases, selectedDoctorFilter]);

  // Use pagination hook
  const pagination = usePagination(filteredCases);

  // Enhanced dialog handlers with transfer type support
  const handleTransferClick = useCallback((caseItem, transferType) => {
    transferDialogHook.openTransferDialog(caseItem, transferType);
  }, [transferDialogHook]);

  // Bulk transfer dialog handler with transfer type selection
  const handleBulkTransferClick = useCallback((transferType) => {
    const selectedCases = bulkSelection.getSelectedCases();
    const result = transferDialogHook.openBulkTransferDialog(selectedCases, transferType);
    
    if (result.error) {
      onError(result.error);
    }
  }, [bulkSelection, transferDialogHook, onError]);

  const handlePersonSelect = useCallback((selectedOption) => {
    transferDialogHook.updateSelectedPersonId(selectedOption?.value || "");
  }, [transferDialogHook]);

  const clearDoctorFilter = useCallback(() => {
    setSelectedDoctorFilter(null);
  }, []);

  // Enhanced transfer handler for both doctors and pharmacists
  const handleTransferCase = useCallback(async () => {
    const { case: singleCase, cases: multipleCases, selectedPersonId, transferType, isBulk } = transferDialogHook.transferDialog;
    
    if (!selectedPersonId) {
      onError(`Please select a ${transferType} to transfer the case(s) to.`);
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
      const personList = transferType === 'doctor' ? doctors : pharmacists;
      const selectedPerson = personList.find(person => person.id === selectedPersonId);

      if (!selectedPerson) {
        throw new Error(`Selected ${transferType} not found`);
      }

      // Check capacity
      const maxCases = transferType === 'doctor' ? 10 : 15;
      const currentCases = selectedPerson.caseCount || 0;
      if (currentCases + casesToTransfer.length > maxCases) {
        throw new Error(`${selectedPerson.name} cannot handle ${casesToTransfer.length} additional cases. Current: ${currentCases}/${maxCases}`);
      }

      // For bulk transfers, use batch operations
      if (isBulk && casesToTransfer.length > 1) {
        const batch = writeBatch(firestore);
        
        casesToTransfer.forEach(caseItem => {
          const caseRef = doc(firestore, "cases", caseItem.id);
          
          // Get current assignment info for transfer history
          const currentPersonId = transferType === 'doctor' 
            ? caseItem.assignedDoctors?.primary 
            : caseItem.pharmacistId;
          const currentPersonName = transferType === 'doctor' 
            ? caseItem.assignedDoctors?.primaryName 
            : caseItem.pharmacistName;

          // Transfer history entry
          const transferHistoryEntry = {
            transferredAt: new Date(),
            transferredBy: currentUser.uid,
            transferredByName: currentUser.displayName || currentUser.name,
            transferType: transferType,
            transferredFrom: currentPersonId || null,
            transferredFromName: currentPersonName || "Unassigned",
            transferredTo: selectedPersonId,
            transferredToName: selectedPerson.name,
            transferReason: `Bulk ${transferType} transfer`,
          };

          // Update data based on transfer type
          let updateData = {
            transferHistory: [
              ...(caseItem.transferHistory || []), 
              transferHistoryEntry
            ],
            transferCount: (caseItem.transferCount || 0) + 1,
            lastTransferredAt: serverTimestamp(),
            lastModified: serverTimestamp(),
          };

          if (transferType === 'doctor') {
            updateData = {
              ...updateData,
              "assignedDoctors.primary": selectedPersonId,
              "assignedDoctors.primaryName": selectedPerson.name,
              "assignedDoctors.primaryType": "bulk_transferred",
            };
          } else {
            updateData = {
              ...updateData,
              pharmacistId: selectedPersonId,
              pharmacistName: selectedPerson.name,
              pharmacistStatus: selectedPerson.availabilityStatus || "available",
              pharmacistType: "transferred",
            };
          }

          batch.update(caseRef, updateData);
        });

        await batch.commit();

        const transferMessage = `Successfully transferred ${casesToTransfer.length} cases to ${selectedPerson.name} (${transferType})`;
        onSuccess(transferMessage);
        
        // Clear bulk selection after successful transfer
        bulkSelection.clearSelection();
        
      } else {
        // Single case transfer using transaction
        const caseToTransfer = casesToTransfer[0];
        const caseRef = doc(firestore, "cases", caseToTransfer.id);

        await runTransaction(firestore, async (transaction) => {
          const caseSnap = await transaction.get(caseRef);
          
          if (!caseSnap.exists()) {
            throw new Error("Case not found");
          }

          const currentCaseData = caseSnap.data();
          
          const currentPersonId = transferType === 'doctor' 
            ? currentCaseData.assignedDoctors?.primary 
            : currentCaseData.pharmacistId;
          const currentPersonName = transferType === 'doctor' 
            ? currentCaseData.assignedDoctors?.primaryName 
            : currentCaseData.pharmacistName;

          const transferHistoryEntry = {
            transferredAt: new Date(),
            transferredBy: currentUser.uid,
            transferredByName: currentUser.displayName || currentUser.name,
            transferType: transferType,
            transferredFrom: currentPersonId || null,
            transferredFromName: currentPersonName || "Unassigned",
            transferredTo: selectedPersonId,
            transferredToName: selectedPerson.name,
            transferReason: `${transferType} transfer`,
          };

          let updateData = {
            transferHistory: [
              ...(currentCaseData.transferHistory || []), 
              transferHistoryEntry
            ],
            transferCount: (currentCaseData.transferCount || 0) + 1,
            lastTransferredAt: serverTimestamp(),
            lastModified: serverTimestamp(),
          };

          if (transferType === 'doctor') {
            updateData = {
              ...updateData,
              "assignedDoctors.primary": selectedPersonId,
              "assignedDoctors.primaryName": selectedPerson.name,
              "assignedDoctors.primaryType": "transferred",
            };
          } else {
            updateData = {
              ...updateData,
              pharmacistId: selectedPersonId,
              pharmacistName: selectedPerson.name,
              pharmacistStatus: selectedPerson.availabilityStatus || "available",
              pharmacistType: "transferred",
            };
          }

          transaction.update(caseRef, updateData);
        });

        const fromPerson = transferType === 'doctor' 
          ? caseToTransfer.assignedDoctors?.primaryName 
          : caseToTransfer.pharmacistName;
        
        const transferMessage = fromPerson 
          ? `Case transferred from ${fromPerson} to ${selectedPerson.name} (${transferType})`
          : `Case assigned to ${selectedPerson.name} (${transferType})`;

        onSuccess(transferMessage);
      }

      transferDialogHook.closeTransferDialog();
      
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
    transferDialogHook.transferDialog,
    doctors,
    pharmacists,
    currentUser,
    onSuccess,
    onError,
    transferDialogHook.closeTransferDialog,
    bulkSelection,
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

  // Get current options based on transfer type
  const currentOptions = transferDialogHook.transferDialog.transferType === 'doctor' ? doctorOptions : pharmacistOptions;
  const maxCases = transferDialogHook.transferDialog.transferType === 'doctor' ? 10 : 15;

  return (
    <>
      <div className="space-y-6">
        {/* Enhanced Bulk Actions Bar with transfer type selection */}
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
                      
                      {/* Separate buttons for doctor and pharmacist bulk transfer */}
                      <Button
                        size="sm"
                        onClick={() => handleBulkTransferClick('doctor')}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Transfer Doctors
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleBulkTransferClick('pharmacist')}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Pill className="h-4 w-4 mr-2" />
                        Transfer Pharmacists
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
                Select cases to transfer doctors or pharmacists in bulk
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
                {/* Bulk selection header */}
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
                <TableHead className="font-semibold">Assignments</TableHead>
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
                  onTransferClick={handleTransferClick}
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

      {/* Enhanced Transfer Dialog - Single & Bulk with Doctor/Pharmacist Support */}
      <Dialog open={transferDialogHook.transferDialog.open} onOpenChange={transferDialogHook.closeTransferDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {transferDialogHook.transferDialog.transferType === 'doctor' ? (
                <Stethoscope className="h-5 w-5 text-blue-500 mr-2" />
              ) : (
                <Pill className="h-5 w-5 text-green-500 mr-2" />
              )}
              {transferDialogHook.transferDialog.isBulk ? "Bulk Transfer" : "Transfer"} {transferDialogHook.transferDialog.transferType === 'doctor' ? 'Doctor' : 'Pharmacist'}
            </DialogTitle>
            <DialogDescription>
              {transferDialogHook.transferDialog.isBulk 
                ? `Select an available ${transferDialogHook.transferDialog.transferType} to transfer ${transferDialogHook.transferDialog.cases.length} selected cases to.`
                : `Select an available ${transferDialogHook.transferDialog.transferType} to transfer this case to.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* Single Case Info */}
            {!transferDialogHook.transferDialog.isBulk && transferDialogHook.transferDialog.case && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm space-y-1">
                  <div><strong>Patient:</strong> {transferDialogHook.transferDialog.case.patientName}</div>
                  <div><strong>EMR:</strong> {transferDialogHook.transferDialog.case.emrNumber}</div>
                  <div><strong>Current {transferDialogHook.transferDialog.transferType === 'doctor' ? 'Doctor' : 'Pharmacist'}:</strong> {
                    transferDialogHook.transferDialog.transferType === 'doctor' 
                      ? (transferDialogHook.transferDialog.case.assignedDoctors?.primaryName || "Not assigned")
                      : (transferDialogHook.transferDialog.case.pharmacistName || "Not assigned")
                  }</div>
                  <div><strong>Clinic:</strong> {transferDialogHook.transferDialog.case.clinicCode} {transferDialogHook.transferDialog.case.manualClinicCode ? `(${transferDialogHook.transferDialog.case.manualClinicCode})` : ""}</div>
                  <div><strong>Complaint:</strong> {transferDialogHook.transferDialog.case.chiefComplaint}</div>
                  {transferDialogHook.transferDialog.case.transferCount > 0 && (
                    <div className="text-orange-600">
                      <strong>Previous Transfers:</strong> {transferDialogHook.transferDialog.case.transferCount}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bulk Cases Info */}
            {transferDialogHook.transferDialog.isBulk && transferDialogHook.transferDialog.cases.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Selected Cases ({transferDialogHook.transferDialog.cases.length})
                  </h4>
                  <Badge variant="secondary" className={`${
                    transferDialogHook.transferDialog.transferType === 'doctor' 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'bg-green-50 text-green-700'
                  }`}>
                    {transferDialogHook.transferDialog.transferType === 'doctor' ? (
                      <Stethoscope className="h-3 w-3 mr-1" />
                    ) : (
                      <Pill className="h-3 w-3 mr-1" />
                    )}
                    Bulk {transferDialogHook.transferDialog.transferType === 'doctor' ? 'Doctor' : 'Pharmacist'} Transfer
                  </Badge>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {transferDialogHook.transferDialog.cases.map((caseItem) => (
                    <div key={caseItem.id} className={`text-sm border-l-2 ${
                      transferDialogHook.transferDialog.transferType === 'doctor' ? 'border-blue-300' : 'border-green-300'
                    } pl-3 py-1`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium">{caseItem.patientName}</span>
                          <span className="text-gray-600 ml-2">EMR: {caseItem.emrNumber}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {transferDialogHook.transferDialog.transferType === 'doctor' 
                            ? (caseItem.assignedDoctors?.primaryName || "Unassigned")
                            : (caseItem.pharmacistName || "Unassigned")
                          }
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {caseItem.clinicCode} • {caseItem.chiefComplaint}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bulk Transfer Summary */}
                <div className={`mt-3 p-2 rounded border ${
                  transferDialogHook.transferDialog.transferType === 'doctor' 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className={`text-xs ${
                    transferDialogHook.transferDialog.transferType === 'doctor' ? 'text-blue-800' : 'text-green-800'
                  }`}>
                    <strong>Transfer Summary:</strong> All {transferDialogHook.transferDialog.cases.length} cases will have their {transferDialogHook.transferDialog.transferType} changed to the selected person with full history tracking.
                  </div>
                </div>
              </div>
            )}

            {/* Transfer History Warnings */}
            {(transferDialogHook.transferDialog.case?.transferHistory?.length > 0 || 
              transferDialogHook.transferDialog.cases.some(c => c.transferHistory?.length > 0)) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <History className="h-4 w-4 text-amber-600 mr-2" />
                  <span className="text-sm font-medium text-amber-800">Transfer History Warning</span>
                </div>
                <div className="text-xs text-amber-700">
                  {transferDialogHook.transferDialog.isBulk 
                    ? `Some of the selected cases have been transferred before. Transfer history will be preserved.`
                    : `This case has been transferred ${transferDialogHook.transferDialog.case?.transferHistory?.length} time(s) previously.`
                  }
                </div>
              </div>
            )}

            {/* Person Selection */}
            <div className="space-y-2">
              <Label>Select New {transferDialogHook.transferDialog.transferType === 'doctor' ? 'Doctor' : 'Pharmacist'}</Label>
              <Select
                options={currentOptions}
                value={currentOptions.find(option => option.value === transferDialogHook.transferDialog.selectedPersonId) || null}
                onChange={handlePersonSelect}
                placeholder={`Select ${transferDialogHook.transferDialog.transferType}...`}
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
                Available {transferDialogHook.transferDialog.transferType}s are shown. {transferDialogHook.transferDialog.transferType === 'doctor' ? 'Doctors' : 'Pharmacists'} at capacity ({maxCases}+ cases) are disabled.
                {transferDialogHook.transferDialog.isBulk && ` Selected ${transferDialogHook.transferDialog.transferType} must be able to handle ${transferDialogHook.transferDialog.cases.length} additional cases.`}
              </p>
            </div>

            {/* Person Capacity Check for Bulk */}
            {transferDialogHook.transferDialog.isBulk && transferDialogHook.transferDialog.selectedPersonId && (
              <div className={`p-3 rounded-lg ${
                transferDialogHook.transferDialog.transferType === 'doctor' ? 'bg-blue-50' : 'bg-green-50'
              }`}>
                {(() => {
                  const personList = transferDialogHook.transferDialog.transferType === 'doctor' ? doctors : pharmacists;
                  const selectedPerson = personList.find(p => p.id === transferDialogHook.transferDialog.selectedPersonId);
                  const currentCases = selectedPerson?.caseCount || 0;
                  const afterTransfer = currentCases + transferDialogHook.transferDialog.cases.length;
                  const canHandle = afterTransfer <= maxCases;
                  
                  return (
                    <div className="flex items-center">
                      {canHandle ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                      )}
                      <div className="text-sm">
                        <div className={canHandle ? "text-green-900" : "text-red-900"}>
                          <strong>{selectedPerson?.name}</strong> case load: {currentCases} → {afterTransfer}/{maxCases}
                        </div>
                        {!canHandle && (
                          <div className="text-red-700 text-xs mt-1">
                            Cannot handle {transferDialogHook.transferDialog.cases.length} additional cases. Please select a different {transferDialogHook.transferDialog.transferType}.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Selected Person Preview */}
            {transferDialogHook.transferDialog.selectedPersonId && !transferDialogHook.transferDialog.isBulk && (
              <div className={`p-3 rounded-lg ${
                transferDialogHook.transferDialog.transferType === 'doctor' ? 'bg-blue-50' : 'bg-green-50'
              }`}>
                <div className="flex items-center">
                  <ArrowRight className={`h-4 w-4 mr-2 ${
                    transferDialogHook.transferDialog.transferType === 'doctor' ? 'text-blue-600' : 'text-green-600'
                  }`} />
                  <span className={`text-sm font-medium ${
                    transferDialogHook.transferDialog.transferType === 'doctor' ? 'text-blue-900' : 'text-green-900'
                  }`}>
                    Transferring {transferDialogHook.transferDialog.transferType} from:{" "}
                    {transferDialogHook.transferDialog.transferType === 'doctor' 
                      ? (transferDialogHook.transferDialog.case.assignedDoctors?.primaryName || "Unassigned")
                      : (transferDialogHook.transferDialog.case.pharmacistName || "Unassigned")
                    } → {" "}
                    {
                      currentOptions.find(
                        (option) =>
                          option.value === transferDialogHook.transferDialog.selectedPersonId
                      )?.person?.name
                    }
                  </span>
                </div>
                <div className={`mt-2 flex items-center text-xs ${
                  transferDialogHook.transferDialog.transferType === 'doctor' ? 'text-blue-700' : 'text-green-700'
                }`}>
                  <div className={`h-2 w-2 rounded-full animate-pulse mr-2 ${
                    transferDialogHook.transferDialog.transferType === 'doctor' ? 'bg-blue-500' : 'bg-green-500'
                  }`}></div>
                  Transfer history will be automatically recorded
                </div>
              </div>
            )}

            {/* Transfer Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-amber-600 mr-2 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Transfer Tracking:</strong> {transferDialogHook.transferDialog.isBulk ? "These transfers" : "This transfer"} will be recorded with full history including previous {transferDialogHook.transferDialog.transferType}, timestamp, and reason. {transferDialogHook.transferDialog.isBulk ? "All cases" : "The case"} will immediately reflect the new {transferDialogHook.transferDialog.transferType} assignment.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={transferDialogHook.closeTransferDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferCase}
              disabled={
                !transferDialogHook.transferDialog.selectedPersonId || 
                transferLoading ||
                (transferDialogHook.transferDialog.isBulk && (() => {
                  const personList = transferDialogHook.transferDialog.transferType === 'doctor' ? doctors : pharmacists;
                  const selectedPerson = personList.find(p => p.id === transferDialogHook.transferDialog.selectedPersonId);
                  const currentCases = selectedPerson?.caseCount || 0;
                  return currentCases + transferDialogHook.transferDialog.cases.length > maxCases;
                })())
              }
              className={transferDialogHook.transferDialog.transferType === 'doctor' 
                ? "bg-blue-600 hover:bg-blue-700" 
                : "bg-green-600 hover:bg-green-700"
              }
            >
              {transferLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {transferDialogHook.transferDialog.isBulk ? "Transferring..." : "Transferring..."}
                </>
              ) : (
                <>
                  {transferDialogHook.transferDialog.transferType === 'doctor' ? (
                    <Stethoscope className="h-4 w-4 mr-2" />
                  ) : (
                    <Pill className="h-4 w-4 mr-2" />
                  )}
                  {transferDialogHook.transferDialog.isBulk 
                    ? `Transfer ${transferDialogHook.transferDialog.cases.length} Cases` 
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