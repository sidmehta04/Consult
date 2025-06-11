import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  FileText, 
  Video,
  PhoneCall,
  Clock
} from "lucide-react";
import { 
  Dialog, 
  DialogContent,
} from "@/components/ui/dialog";
import CaseDetailView from "./CaseDetail";

// OPTIMIZATION 1: Better data structure with computed fields
const enhanceCaseData = (caseItem) => ({
  ...caseItem,
  // Pre-compute commonly used values
  computed: {
    isIncomplete: caseItem.isIncomplete === true || 
                  caseItem.status === "doctor_incomplete" || 
                  caseItem.status === "pharmacist_incomplete",
    
    clinicDisplay: caseItem.clinicCode || caseItem.clinicName || "N/A",
    partnerDisplay: caseItem.partnerName || "N/A",
    doctorDisplay: caseItem.doctorName || caseItem.assignedDoctors?.primaryName || "N/A",
    
    // Pre-format dates and times
    createdDate: formatDate(caseItem.createdAt),
    createdTime: formatTime(caseItem.createdAt),
    doctorJoinedDisplay: caseItem.doctorJoined 
      ? `${formatDate(caseItem.doctorJoined)} ${formatTime(caseItem.doctorJoined)}`
      : "Pending",
    
    // Pre-calculate TATs
    doctorTAT: calculateTAT(caseItem, 'doctor'),
    overallTAT: calculateTAT(caseItem, 'overall'),
    
    // Pre-determine queue status
    queueStatus: getQueueStatus(caseItem),
    
    // Pre-determine contact type
    contactType: /^\d+$/.test(caseItem.contactInfo) ? 'phone' : 'video',
    
    // Pre-organize action links
    actionLinks: {
      meet: caseItem.meetLink,
      audio: caseItem.audioLink,
      emr: caseItem.emrLink,
      contact: caseItem.contactInfo
    }
  }
});

// OPTIMIZATION 2: Utility functions moved outside component
const formatDate = (dateObj) => {
  if (!dateObj) return "N/A";
  
  try {
    const date = dateObj.toDate?.() || 
                 (dateObj instanceof Date ? dateObj : new Date(dateObj));
    return date.toLocaleDateString("en-US", {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return "Invalid Date";
  }
};

const formatTime = (dateObj) => {
  if (!dateObj) return "N/A";
  
  try {
    const date = dateObj.toDate?.() || 
                 (dateObj instanceof Date ? dateObj : new Date(dateObj));
    return date.toLocaleTimeString("en-US", {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return "Invalid Time";
  }
};

const calculateTAT = (caseItem, type) => {
  const isIncomplete = caseItem.isIncomplete === true || 
                      caseItem.status === "doctor_incomplete" || 
                      caseItem.status === "pharmacist_incomplete";
  
  if (isIncomplete) return { type: 'incomplete', display: 'Incomplete' };
  
  if (type === 'doctor') {
    if (!caseItem.doctorCompleted) {
      return { type: 'progress', display: 'In progress' };
    }
    const duration = calculateTimeDifference(
      caseItem.doctorJoined ?? caseItem.createdAt, 
      caseItem.doctorCompletedAt
    );
    return { type: 'completed', display: duration };
  }
  
  if (type === 'overall') {
    if (!caseItem.pharmacistCompleted) {
      return { type: 'progress', display: 'In progress' };
    }
    const duration = calculateTimeDifference(
      caseItem.pharmacistJoined ?? caseItem.createdAt, 
      caseItem.pharmacistCompletedAt
    );
    return { type: 'completed', display: duration };
  }
  
  return { type: 'unknown', display: 'N/A' };
};

const calculateTimeDifference = (startTime, endTime) => {
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
};

const getQueueStatus = (caseItem) => {
  const isIncomplete = caseItem.isIncomplete === true || 
                      caseItem.status === "doctor_incomplete" || 
                      caseItem.status === "pharmacist_incomplete";
  
  if (isIncomplete) {
    return { 
      status: 'incomplete', 
      label: 'Incomplete',
      className: 'bg-red-100 text-red-800 border-red-200'
    };
  }
  
  if (!caseItem.doctorCompleted) {
    return { 
      status: 'doctor', 
      label: 'Doctor',
      className: 'bg-amber-100 text-amber-800 border-amber-200'
    };
  }
  
  if (caseItem.doctorCompleted && !caseItem.pharmacistCompleted) {
    return { 
      status: 'pharmacist', 
      label: 'Pharmacist',
      className: 'bg-purple-100 text-purple-800 border-purple-200'
    };
  }
  
  return { 
    status: 'completed', 
    label: 'Completed',
    className: 'bg-gray-100 text-gray-800 border-gray-200'
  };
};

// OPTIMIZATION 3: Memoized components for better performance
const TATDisplay = React.memo(({ tat }) => {
  if (tat.type === 'incomplete') {
    return <span className="text-red-600">{tat.display}</span>;
  }
  
  if (tat.type === 'progress') {
    return <span className="text-amber-600">{tat.display}</span>;
  }
  
  if (tat.type === 'completed') {
    return (
      <span className="flex items-center">
        <Clock className="h-3 w-3 mr-1 text-green-600" />
        {tat.display}
      </span>
    );
  }
  
  return <span>{tat.display}</span>;
});

const ContactButton = React.memo(({ contactInfo, contactType, onClick }) => {
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (contactType === 'phone') {
      window.open(`tel:${contactInfo}`, '_blank');
    } else {
      window.open(contactInfo, '_blank');
    }
    onClick?.(e);
  }, [contactInfo, contactType, onClick]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      title={contactType === 'phone' ? contactInfo : "Open Video Call"}
      className="h-8 w-8 flex items-center justify-center"
    >
      {contactType === 'phone' ? (
        <PhoneCall className="!h-5 !w-5 text-blue-500" />
      ) : (
        <Video className="!h-5 !w-5 text-blue-500" />
      )}
    </Button>
  );
});

const ActionButtons = React.memo(({ actionLinks, onDetailClick }) => {
  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  return (
    <div className="flex items-center space-x-1" onClick={stopPropagation}>
      {actionLinks.meet && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.open(actionLinks.meet, '_blank')}
          title="Open Google Meet"
          className="h-8 w-8"
        >
          <Video className="h-4 w-4 text-blue-500" />
        </Button>
      )}
      
      {actionLinks.audio && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.open(actionLinks.audio, '_blank')}
          title="Open Audio Call"
          className="h-8 w-8"
        >
          <PhoneCall className="h-4 w-4 text-green-500" />
        </Button>
      )}
      
      {actionLinks.emr && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.open(actionLinks.emr, '_blank')}
          title="Open EMR"
          className="h-8 w-8"
        >
          <FileText className="h-4 w-4 text-purple-500" />
        </Button>
      )}
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onDetailClick}
        title="View Details"
        className="h-8 w-8"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  );
});

// OPTIMIZATION 4: Pagination hook for reusability
const usePagination = (data, pagination, onPageChange) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const isServerPagination = pagination !== null && onPageChange !== null;

  useEffect(() => {
    if (pagination?.page) {
      setCurrentPage(pagination.page);
    }
  }, [pagination?.page]);

  const currentCases = useMemo(() => {
    return isServerPagination 
      ? data 
      : data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [data, currentPage, itemsPerPage, isServerPagination]);

  const totalPages = useMemo(() => {
    return isServerPagination 
      ? pagination.totalPages || Math.ceil(pagination.totalItems / pagination.pageSize) || 1
      : Math.ceil(data.length / itemsPerPage);
  }, [isServerPagination, pagination, data.length, itemsPerPage]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      if (isServerPagination) {
        onPageChange(currentPage + 1, pagination.lastDoc);
      }
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages, isServerPagination, onPageChange, pagination]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      if (isServerPagination) {
        onPageChange(currentPage - 1);
      }
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage, isServerPagination, onPageChange]);

  return {
    currentCases,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    isServerPagination
  };
};

// OPTIMIZATION 5: Main component with better structure
const CasesTable = ({ 
  data, 
  loading, 
  userRole, 
  currentUser, 
  showHeader = true,
  pagination = null,
  onPageChange = null
}) => {
  const [selectedCase, setSelectedCase] = useState(null);
  
  // OPTIMIZATION 6: Memoize enhanced data
  const enhancedData = useMemo(() => 
    data.map(enhanceCaseData), 
    [data]
  );
  
  const {
    currentCases,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    isServerPagination
  } = usePagination(enhancedData, pagination, onPageChange);

  // OPTIMIZATION 7: Memoized event handlers
  const handleCaseClick = useCallback((caseItem) => {
    setSelectedCase(caseItem);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setSelectedCase(null);
  }, []);

  const handleDetailClick = useCallback((caseItem) => (e) => {
    e.stopPropagation();
    setSelectedCase(caseItem);
  }, []);

  // Listen for custom close event
  useEffect(() => {
    const handleClose = () => setSelectedCase(null);
    window.addEventListener('closeDialog', handleClose);
    return () => window.removeEventListener('closeDialog', handleClose);
  }, []);

  // OPTIMIZATION 8: Memoized pagination info
  const paginationInfo = useMemo(() => {
    if (isServerPagination) {
      return `Page ${currentPage}${pagination.hasMore ? ' (more available)' : ''}`;
    }
    
    const startItem = Math.min(data.length, ((currentPage - 1) * 10) + 1);
    const endItem = Math.min(currentPage * 10, data.length);
    return `Showing ${startItem} to ${endItem} of ${data.length} cases`;
  }, [isServerPagination, currentPage, pagination, data.length]);

  // OPTIMIZATION 9: Show pagination condition
  const shouldShowPagination = useMemo(() => {
    return !((isServerPagination && !pagination.hasMore && currentPage === 1) || 
             (!isServerPagination && data.length <= 10));
  }, [isServerPagination, pagination, currentPage, data.length]);

  // OPTIMIZATION 10: Memoized table rows
  const tableRows = useMemo(() => (
    currentCases.map((caseItem) => (
      <tr 
        key={caseItem.id} 
        className={`hover:bg-gray-50 cursor-pointer border-b ${
          caseItem.computed.isIncomplete ? 'bg-red-50' : ''
        }`}
        onClick={() => handleCaseClick(caseItem)}
      >
        <td className="p-3 font-medium">{caseItem.computed.clinicDisplay}</td>
        <td className="p-3">{caseItem.computed.partnerDisplay}</td>
        <td className="p-3">{caseItem.computed.doctorDisplay}</td>
        <td className="p-3">{caseItem.computed.doctorJoinedDisplay}</td>
        <td className="p-3 whitespace-nowrap">
          <TATDisplay tat={caseItem.computed.doctorTAT} />
        </td>
        <td className="p-3 whitespace-nowrap">
          <TATDisplay tat={caseItem.computed.overallTAT} />
        </td>
        <td className="p-3">
          {caseItem.computed.createdTime}; {caseItem.computed.createdDate}
        </td>
        <td className="p-0">
          <div className="flex items-center justify-center h-full">
            <ContactButton 
              contactInfo={caseItem.contactInfo}
              contactType={caseItem.computed.contactType}
            />
          </div>
        </td>
        <td className="p-3">
          <ActionButtons 
            actionLinks={caseItem.computed.actionLinks}
            onDetailClick={handleDetailClick(caseItem)}
          />
        </td>
      </tr>
    ))
  ), [currentCases, handleCaseClick, handleDetailClick]);

  // OPTIMIZATION 11: Memoized pagination footer
  const paginationFooter = useMemo(() => {
    if (!shouldShowPagination) return null;
    
    return (
      <tr className="border-t bg-gray-50">
        <td colSpan="13">
          <div className="flex justify-between items-center px-6 py-4">
            <div className="text-sm text-gray-500">{paginationInfo}</div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} {isServerPagination ? '' : `of ${totalPages}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={isServerPagination ? !pagination.hasMore : currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </td>
      </tr>
    );
  }, [shouldShowPagination, paginationInfo, currentPage, totalPages, isServerPagination, pagination, prevPage, nextPage]);

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No cases found matching your criteria</p>
      </div>
    );
  }

  // For direct embed in parent table (no header)
  if (!showHeader) {
    return (
      <>
        {tableRows}
        {paginationFooter}
        
        {selectedCase && (
          <Dialog open={!!selectedCase} onOpenChange={(open) => !open && handleCloseDialog()}>
            <DialogContent className="max-w-5xl w-[90vw] p-0 overflow-hidden">
              <CaseDetailView
                caseData={selectedCase} 
                userRole={userRole} 
                currentUser={currentUser} 
              />
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // Full table with header
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="p-3 text-left font-medium">Clinic Code</th>
            <th className="p-3 text-left font-medium">Partner</th>
            <th className="p-3 text-left font-medium">Doctor</th>
            <th className="p-3 text-left font-medium">Doctor Joined</th>
            <th className="p-3 text-left font-medium">Doctor TAT</th>
            <th className="p-3 text-left font-medium">Overall TAT</th>
            <th className="p-3 text-left font-medium">Created</th>
            <th className="p-3 text-left font-medium">Queue</th>
            <th className="p-3 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tableRows}
        </tbody>
      </table>

      {shouldShowPagination && (
        <div className="flex justify-between items-center px-6 py-4 border-t">
          <div className="text-sm text-gray-500">{paginationInfo}</div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} {isServerPagination ? '' : `of ${totalPages}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={isServerPagination ? !pagination.hasMore : currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {selectedCase && (
        <Dialog open={!!selectedCase} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent 
            className="max-w-5xl w-[90vw] p-0 overflow-hidden"
            aria-describedby="case-detail-description"
          >
            <div className="sr-only" id="case-detail-description">
              Case details view showing complete information about the selected case
            </div>
            <CaseDetailView 
              caseData={selectedCase} 
              userRole={userRole} 
              currentUser={currentUser} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CasesTable;