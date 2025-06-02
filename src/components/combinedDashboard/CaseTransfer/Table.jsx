import React, { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { firestore } from "../../../firebase";
import { format } from "date-fns";

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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const casesPerPage = 10;

  // Calculate pagination values
  const totalPages = Math.ceil(cases.length / casesPerPage);
  const startIndex = (currentPage - 1) * casesPerPage;
  const endIndex = startIndex + casesPerPage;
  const currentCases = cases.slice(startIndex, endIndex);

  // Pagination handlers
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset to first page when cases change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [cases.length]);

  const openTransferDialog = (caseItem) => {
    setTransferDialog({
      open: true,
      case: caseItem,
      selectedDoctorId: "",
    });
  };

  const closeTransferDialog = () => {
    setTransferDialog({
      open: false,
      case: null,
      selectedDoctorId: "",
    });
  };

  const handleTransferCase = async () => {
    if (!transferDialog.case || !transferDialog.selectedDoctorId) {
      onError("Please select a doctor to transfer the case to.");
      return;
    }

    setTransferLoading(true);

    try {
      const caseRef = doc(firestore, "cases", transferDialog.case.id);
      const selectedDoctor = doctors.find(
        (d) => d.id === transferDialog.selectedDoctorId
      );

      if (!selectedDoctor) {
        throw new Error("Selected doctor not found");
      }

      // Get current case data to preserve version
      const currentCaseSnap = await getDoc(caseRef);
      if (!currentCaseSnap.exists()) {
        throw new Error("Case not found");
      }

      const currentCaseData = currentCaseSnap.data();
      const currentVersion = currentCaseData.version || 0;

      // Update the case with new doctor assignment
      const updateData = {
        "assignedDoctors.primary": transferDialog.selectedDoctorId,
        "assignedDoctors.primaryName": selectedDoctor.name,
        "assignedDoctors.primaryStatus": selectedDoctor.availabilityStatus,
        "assignedDoctors.primaryType": "transferred", // Mark as transferred
        transferredAt: serverTimestamp(),
        transferredBy: currentUser.uid,
        transferredByName: currentUser.displayName || currentUser.name,
        transferReason: "Case load balancing",
        version: currentVersion + 1,
        lastModified: serverTimestamp(),
      };

      await updateDoc(caseRef, updateData);

      onSuccess(`Case transferred successfully to Dr. ${selectedDoctor.name}`);
      closeTransferDialog();
    } catch (err) {
      console.error("Error transferring case:", err);
      onError("Failed to transfer case. Please try again.");
    } finally {
      setTransferLoading(false);
    }
  };

  const getStatusBadge = (caseItem) => {
    if (caseItem.queue === "doctor") {
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
  };

  const getDoctorStatusIcon = (status, caseCount) => {
    if (status === "unavailable" || status === "on_break") {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    } else if (caseCount >= 10) {
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    } else {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

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
              {currentCases.map((caseItem) => (
                <TableRow
                  key={caseItem.id}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-medium">
                          {caseItem.patientName}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        EMR: {caseItem.emrNumber}
                      </div>
                      <div className="text-xs text-gray-500">
                        {caseItem.chiefComplaint}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center">
                      <div className="h-2 w-2 bg-purple-500 rounded-full mr-2"></div>
                      <span className="font-medium text-purple-700 text-sm">
                        {caseItem.clinicCode}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <Stethoscope className="h-4 w-4 text-blue-500 mr-2" />
                        <span className="font-medium">
                          {caseItem.assignedDoctors?.primaryName ||
                            "Not assigned"}
                        </span>
                      </div>
                      {caseItem.assignedDoctors?.primaryType && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {caseItem.assignedDoctors.primaryType}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center">
                      {getStatusBadge(caseItem)}
                      {/* Real-time indicator */}
                      <div
                        className="ml-2 h-2 w-2 bg-green-400 rounded-full animate-pulse"
                        title="Live update enabled"
                      ></div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center text-sm">
                      {caseItem.consultationType === "tele" ? (
                        <Video className="h-4 w-4 text-indigo-500 mr-2" />
                      ) : (
                        <Phone className="h-4 w-4 text-blue-500 mr-2" />
                      )}
                      <span className="truncate max-w-32">
                        {caseItem.consultationType === "tele"
                          ? "Video Call"
                          : "Phone Call"}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 text-gray-400 mr-1" />
                        {format(caseItem.createdAt, "MMM dd")}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 text-gray-400 mr-1" />
                        {format(caseItem.createdAt, "HH:mm")}
                      </div>
                    </div>
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-3 border rounded-lg">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing {startIndex + 1} to {Math.min(endIndex, cases.length)} of{" "}
                {cases.length} cases
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Previous Button */}
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

              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {getPageNumbers().map((pageNum, index) => (
                  <React.Fragment key={index}>
                    {pageNum === '...' ? (
                      <span className="px-2 py-1 text-gray-500">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    ) : (
                      <Button
                        variant={currentPage === pageNum ? "default" : "outline"}
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

              {/* Next Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Dialog */}
      <Dialog open={transferDialog.open} onOpenChange={closeTransferDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Search className="h-5 w-5 text-blue-500 mr-2" />
              Transfer Case to Another Doctor
            </DialogTitle>
            <DialogDescription>
              Select an available doctor to transfer this case to. The case will
              be moved in real-time.
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
                </div>
              </div>

              {/* Doctor Selection */}
              <div className="space-y-2">
                <Label htmlFor="doctor-select" className="text-sm font-medium">
                  Select New Doctor
                </Label>
                <Select
                  value={transferDialog.selectedDoctorId}
                  onValueChange={(value) =>
                    setTransferDialog((prev) => ({
                      ...prev,
                      selectedDoctorId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a doctor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem
                        key={doctor.id}
                        value={doctor.id}
                        disabled={!doctor.isAvailable}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            {getDoctorStatusIcon(
                              doctor.availabilityStatus,
                              doctor.caseCount
                            )}
                            <span className="ml-2">{doctor.name}</span>
                          </div>
                          <div className="flex items-center ml-4">
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {doctor.caseCount}/10 cases
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      Transferring to:{" "}
                      {
                        doctors.find(
                          (d) => d.id === transferDialog.selectedDoctorId
                        )?.name
                      }
                    </span>
                  </div>
                  <div className="mt-2 flex items-center text-xs text-blue-700">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                    Changes will be reflected in real-time
                  </div>
                </div>
              )}

              {/* Real-time Update Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-amber-600 mr-2 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <strong>Real-time Transfer:</strong> Once transferred, the
                    case will immediately appear in the new doctor's queue and
                    disappear from the current view if they're no longer in the
                    selected queue filter.
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

export default CaseTransferTable;