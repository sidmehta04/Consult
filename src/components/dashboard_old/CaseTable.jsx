import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  FileText, 
  Video,
  PhoneCall,
  CheckCircle,
  AlertTriangle,
  Clock
} from "lucide-react";
import { 
  Dialog, 
  DialogContent,
} from "@/components/ui/dialog";
import CaseDetailView from "./CaseDetail";

const isAllDigits = (str) => {
  return /^\d+$/.test(str);
}

const CasesTable = ({ 
  data, 
  loading, 
  userRole, 
  currentUser, 
  showHeader = true,
  pagination = null, // New pagination prop from parent
  onPageChange = null // Callback for server-side pagination
}) => {
  // Local pagination state (for client-side pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedCase, setSelectedCase] = useState(null);
  
  // Determine if we're using server-side or client-side pagination
  const isServerPagination = pagination !== null && onPageChange !== null;

  // Update current page when pagination prop changes
  useEffect(() => {
    if (pagination?.page) {
      setCurrentPage(pagination.page);
    }
  }, [pagination?.page]);

  // Add effect to listen for custom close event
  useEffect(() => {
    const handleClose = () => setSelectedCase(null);
    window.addEventListener('closeDialog', handleClose);
    return () => window.removeEventListener('closeDialog', handleClose);
  }, []);

  // Calculate paginated data for client-side pagination
  const currentCases = isServerPagination 
    ? data // If server pagination, use data as-is
    : data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage); // Client pagination

  // Page navigation calculations
  const totalPages = isServerPagination 
    ? pagination.totalPages || Math.ceil(pagination.totalItems / pagination.pageSize) || 1
    : Math.ceil(data.length / itemsPerPage);
  
  // Handle next page navigation
  const nextPage = () => {
    if (currentPage < totalPages) {
      if (isServerPagination) {
        // Call parent's callback for server pagination
        onPageChange(currentPage + 1, pagination.lastDoc);
      }
      setCurrentPage(currentPage + 1);
    }
  };
  
  // Handle previous page navigation
  const prevPage = () => {
    if (currentPage > 1) {
      if (isServerPagination) {
        // Call parent's callback for server pagination
        onPageChange(currentPage - 1);
      }
      setCurrentPage(currentPage - 1);
    }
  };

  // Format date
  const formatDate = (dateObj) => {
    if (!dateObj) return "N/A";
    
    try {
      // Check if dateObj has toDate method (Firestore Timestamp)
      if (dateObj.toDate && typeof dateObj.toDate === 'function') {
        return dateObj.toDate().toLocaleDateString("en-US", {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      
      // If it's already a Date object
      if (dateObj instanceof Date) {
        return dateObj.toLocaleDateString("en-US", {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      
      // If it's a string, try to parse it
      if (typeof dateObj === 'string') {
        return new Date(dateObj).toLocaleDateString("en-US", {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
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
      if (dateObj.toDate && typeof dateObj.toDate === 'function') {
        return dateObj.toDate().toLocaleTimeString("en-US", {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // If it's already a Date object
      if (dateObj instanceof Date) {
        return dateObj.toLocaleTimeString("en-US", {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // If it's a string, try to parse it
      if (typeof dateObj === 'string') {
        return new Date(dateObj).toLocaleTimeString("en-US", {
          hour: '2-digit',
          minute: '2-digit'
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

  // Helper to determine if a case is incomplete
  const isIncompleteCase = (caseItem) => {
    return caseItem.isIncomplete === true || caseItem.status === "doctor_incomplete";
  };

  // Render pagination footer
  const renderPaginationFooter = () => {
    // Don't show pagination if not enough data
    if ((isServerPagination && !pagination.hasMore && currentPage === 1) || 
        (!isServerPagination && data.length <= itemsPerPage)) {
      return null;
    }
    
    // Calculate display text
    let paginationText;
    if (isServerPagination) {
      const startItem = (currentPage - 1) * (pagination.pageSize || 20) + 1;
      paginationText = `Page ${currentPage}${pagination.hasMore ? ' (more available)' : ''}`;
    } else {
      const startItem = Math.min(data.length, ((currentPage - 1) * itemsPerPage) + 1);
      const endItem = Math.min(currentPage * itemsPerPage, data.length);
      paginationText = `Showing ${startItem} to ${endItem} of ${data.length} cases`;
    }
    
    return (
      <tr className="border-t bg-gray-50">
        <td colSpan="8">
          <div className="flex justify-between items-center px-6 py-4">
            <div className="text-sm text-gray-500">
              {paginationText}
            </div>
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
  };

  // For direct embed in parent table (no header)
  if (!showHeader) {
    return (
      <>
        {currentCases.map((caseItem) => (
          <tr 
            key={caseItem.id} 
            className={`hover:bg-gray-50 cursor-pointer border-b ${isIncompleteCase(caseItem) ? 'bg-red-50' : ''}`}
            onClick={() => setSelectedCase(caseItem)}
          >
            <td className="p-3 font-medium">
              {caseItem.clinicCode || caseItem.clinicName || "N/A"}
            </td>
            <td className="p-3">{caseItem.partnerName || "N/A"}</td>
            <td className="p-3">{caseItem.doctorName || caseItem.assignedDoctors?.primaryName || "N/A"}</td>
            {/* Timeline columns - Doctor TAT */}
            <td className="p-3 whitespace-nowrap">
              {isIncompleteCase(caseItem) ? (
                <span className="text-red-600">Incomplete</span>
              ) : caseItem.doctorCompleted ? (
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1 text-green-600" />
                  {calculateTimeDifference(caseItem.createdAt, caseItem.doctorCompletedAt)}
                </span>
              ) : (
                <span className="text-amber-600">In progress</span>
              )}
            </td>
            {/* Timeline columns - Overall TAT */}
            <td className="p-3 whitespace-nowrap">
              {isIncompleteCase(caseItem) ? (
                <span className="text-red-600">Incomplete</span>
              ) : caseItem.pharmacistCompleted ? (
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1 text-green-600" />
                  {calculateTimeDifference(caseItem.createdAt, caseItem.pharmacistCompletedAt)}
                </span>
              ) : (
                <span className="text-amber-600">In progress</span>
              )}
            </td>
            <td className="p-3">{formatDate(caseItem.createdAt)}</td>
            <td className="p-0">
              <div className="flex items-center justify-center h-full">
                {isAllDigits(caseItem.contactInfo) ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open("tel:"+caseItem.contactInfo, '_blank'); //open as telephone link
                    }}
                    title={caseItem.contactInfo}
                    className="h-8 w-8 flex items-center justify-center"
                  >
                    <PhoneCall className="!h-5 !w-5 text-blue-500"/>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(caseItem.contactInfo, '_blank');
                    }}
                    title="Open Google Meet"
                    className="h-8 w-8 flex items-center justify-center"
                  >
                    <Video className="!h-5 !w-5 text-blue-500"/>
                  </Button>
                )}
              </div>
            </td>
            <td className="p-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center space-x-1">
                {caseItem.meetLink && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(caseItem.meetLink, '_blank');
                    }}
                    title="Open Google Meet"
                    className="h-8 w-8"
                  >
                    <Video className="h-4 w-4 text-blue-500" />
                  </Button>
                )}
                
                {caseItem.audioLink && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(caseItem.audioLink, '_blank');
                    }}
                    title="Open Audio Call"
                    className="h-8 w-8"
                  >
                    <PhoneCall className="h-4 w-4 text-green-500" />
                  </Button>
                )}
                
                {caseItem.emrLink && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(caseItem.emrLink, '_blank');
                    }}
                    title="Open EMR"
                    className="h-8 w-8"
                  >
                    <FileText className="h-4 w-4 text-purple-500" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCase(caseItem);
                  }}
                  title="View Details"
                  className="h-8 w-8"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </td>
          </tr>
        ))}

        {/* Pagination footer */}
        {renderPaginationFooter()}

        {/* Case Detail Dialog */}
        {selectedCase && (
          <Dialog 
            open={!!selectedCase} 
            onOpenChange={(open) => {
              if (!open) setSelectedCase(null);
            }}
          >
            <DialogContent 
              className="max-w-5xl w-[90vw] p-0 overflow-hidden"
            >
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

  // Full table with header
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="p-3 text-left font-medium">Clinic Code</th>
            <th className="p-3 text-left font-medium">Partner</th>
            <th className="p-3 text-left font-medium">Doctor</th>
            <th className="p-3 text-left font-medium">Doctor TAT</th>
            <th className="p-3 text-left font-medium">Overall TAT</th>
            <th className="p-3 text-left font-medium">Created</th>
            <th className="p-3 text-left font-medium">Queue</th>
            <th className="p-3 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {currentCases.map((caseItem) => (
            <tr 
              key={caseItem.id} 
              className={`hover:bg-gray-50 cursor-pointer border-b ${isIncompleteCase(caseItem) ? 'bg-red-50' : ''}`}
              onClick={() => setSelectedCase(caseItem)}
            >
              <td className="p-3 font-medium">
                {caseItem.clinicCode || caseItem.clinicName || "N/A"}
              </td>
              <td className="p-3">{caseItem.partnerName || "N/A"}</td>
              <td className="p-3">{caseItem.doctorName || caseItem.assignedDoctors?.primaryName || "N/A"}</td>
              {/* Timeline columns - Doctor TAT */}
              <td className="p-3 whitespace-nowrap">
                {isIncompleteCase(caseItem) ? (
                  <span className="text-red-600">Incomplete</span>
                ) : caseItem.doctorCompleted ? (
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1 text-green-600" />
                    {calculateTimeDifference(caseItem.createdAt, caseItem.doctorCompletedAt)}
                  </span>
                ) : (
                  <span className="text-amber-600">In progress</span>
                )}
              </td>
              {/* Timeline columns - Overall TAT */}
              <td className="p-3 whitespace-nowrap">
                {isIncompleteCase(caseItem) ? (
                  <span className="text-red-600">Incomplete</span>
                ) : caseItem.pharmacistCompleted ? (
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1 text-green-600" />
                    {calculateTimeDifference(caseItem.createdAt, caseItem.pharmacistCompletedAt)}
                  </span>
                ) : (
                  <span className="text-amber-600">In progress</span>
                )}
              </td>
              <td className="p-3">{formatDate(caseItem.createdAt)}</td>
              <td className="p-3">
                <Badge
                  variant="outline"
                  className={
                    isIncompleteCase(caseItem)
                      ? "bg-red-100 text-red-800 border-red-200"
                      : !caseItem.doctorCompleted
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : caseItem.doctorCompleted && !caseItem.pharmacistCompleted
                      ? "bg-purple-100 text-purple-800 border-purple-200"
                      : "bg-gray-100 text-gray-800 border-gray-200"
                  }
                >
                  {isIncompleteCase(caseItem)
                    ? "Incomplete"
                    : !caseItem.doctorCompleted
                    ? "Doctor"
                    : caseItem.doctorCompleted && !caseItem.pharmacistCompleted
                    ? "Pharmacist"
                    : "Completed"}
                </Badge>
              </td>
              <td className="p-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center space-x-1">
                  {caseItem.meetLink && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(caseItem.meetLink, '_blank');
                      }}
                      title="Open Google Meet"
                      className="h-8 w-8"
                    >
                      <Video className="h-4 w-4 text-blue-500" />
                    </Button>
                  )}
                  
                  {caseItem.audioLink && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(caseItem.audioLink, '_blank');
                      }}
                      title="Open Audio Call"
                      className="h-8 w-8"
                    >
                      <PhoneCall className="h-4 w-4 text-green-500" />
                    </Button>
                  )}
                  
                  {caseItem.emrLink && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(caseItem.emrLink, '_blank');
                      }}
                      title="Open EMR"
                      className="h-8 w-8"
                    >
                      <FileText className="h-4 w-4 text-purple-500" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCase(caseItem);
                    }}
                    title="View Details"
                    className="h-8 w-8"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {renderPaginationFooter() && (
        <div className="flex justify-between items-center px-6 py-4 border-t">
          <div className="text-sm text-gray-500">
            {isServerPagination
              ? `Page ${currentPage}${pagination.hasMore ? ' (more available)' : ''}`
              : `Showing ${Math.min(data.length, ((currentPage - 1) * itemsPerPage) + 1)} to ${Math.min(currentPage * itemsPerPage, data.length)} of ${data.length} cases`
            }
          </div>
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

      {/* Case Detail Dialog */}
      {selectedCase && (
        <Dialog 
          open={!!selectedCase} 
          onOpenChange={(open) => {
            if (!open) setSelectedCase(null);
          }}
        >
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