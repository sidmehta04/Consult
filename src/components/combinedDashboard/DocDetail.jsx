import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp 
} from "firebase/firestore";
import { firestore } from "../../firebase";
import DoctorStatusHistory from "./DoctorStatus";
import DoctorCasesSummary from "./DocCases";
import DoctorPerformanceMetrics from "./DocPerformance";

const DoctorDetailView = ({ doctorPharmacist, doctor, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [caseData, setCaseData] = useState({
    totalCases: 0,
    completedCases: 0,
    pendingCases: 0,
    incompleteCases: 0
  });

  const role = doctorPharmacist.charAt(0).toUpperCase() + doctorPharmacist.slice(1);
  
  useEffect(() => {
    const fetchDoctorCases = async () => {
      try {
        setIsLoading(true);
        
        // Set up today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Query for cases assigned to this doctor created today
        const casesRef = collection(firestore, "cases");
        const qualifier = doctorPharmacist === "doctor" ? "assignedDoctors.primary" : "pharmacistId";
        const todayCasesQuery = query(
          casesRef,
          where(qualifier, "==", doctor.id),
          where("createdAt", ">=", Timestamp.fromDate(today)),
          where("createdAt", "<", Timestamp.fromDate(tomorrow)),
          orderBy("createdAt", "desc"),
          limit(500) // High limit to get all cases for the day
        );
        
        const querySnapshot = await getDocs(todayCasesQuery);
        
        // Process the results
        let totalCases = querySnapshot.size;
        let completedCases = 0;
        let pendingCases = 0;
        let incompleteCases = 0;
        
        querySnapshot.forEach(doc => {
          const caseData = doc.data();
          
          if (doctorPharmacist === "doctor") {
            if (caseData.isIncomplete || caseData.status === "doctor_incomplete") {
              incompleteCases++;
            } else if (caseData.doctorCompleted) {
              completedCases++;
            } else {
              pendingCases++;
            }
          } else if (doctorPharmacist === "pharmacist") {
            if (caseData.isIncomplete){
              incompleteCases++;
            } else if (caseData.status === "doctor_completed") {
              pendingCases++;
            } else if (caseData.status === "completed") {
              completedCases++;
            }
          }
        });
        
        setCaseData({
          totalCases,
          completedCases,
          pendingCases,
          incompleteCases
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching doctor cases:", error);
        setIsLoading(false);
      }
    };
    
    if (doctor && doctor.id) {
      fetchDoctorCases();
    }
  }, [doctor]);
  
  // Format time for display
  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (!doctor) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{role} Details</h2>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-4rem)]">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Doctor Info */}
              <div className="bg-white shadow-md rounded-lg p-4 mb-6">
                <div className="flex justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{doctor.name}</h3>
                    <p className="text-gray-600">{doctor.empId || "No ID"}</p>
                    <p className="text-gray-600">{doctor.email}</p>
                    <p className="text-gray-600">Reporting to: {doctor.reportingToName || "N/A"}</p>
                  </div>
                  <div className="text-right">
                    <div className="mb-2">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${doctor.availabilityStatus === "available" ? "bg-green-100 text-green-800" : 
                          doctor.availabilityStatus === "busy" ? "bg-yellow-100 text-yellow-800" : 
                          doctor.availabilityStatus === "on_break" ? "bg-blue-100 text-blue-800" : 
                          "bg-red-100 text-red-800"}`}>
                        {doctor.availabilityStatus === "available" ? "Available" : 
                         doctor.availabilityStatus === "busy" ? "Busy" : 
                         doctor.availabilityStatus === "on_break" ? "On Break" : 
                         "Unavailable"}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">
                      Since {formatTime(doctor.lastStatusUpdate)}
                    </p>
                    {doctor.availabilityStatus === "on_break" && doctor.breakStartedAt && (
                      <p className="text-gray-600 text-sm">
                        Break started at {formatTime(doctor.breakStartedAt)}
                        {doctor.breakDuration && ` (${doctor.breakDuration} min)`}
                      </p>
                    )}
                    <div className="mt-2">
                      <p className="text-gray-600 text-sm">
                        <span className="font-medium">Shift:</span> {doctor.shiftTiming || "Not set"}
                      </p>
                      <p className="text-gray-600 text-sm">
                        <span className="font-medium">Type:</span> {doctor.shiftType || "Standard"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Case Summary Component */}
                <DoctorCasesSummary caseData={caseData} doctor={doctor} />
                
                {/* Status History Component */}
                <DoctorStatusHistory availabilityHistory={doctor.availabilityHistory} />
              </div>
              
              {/* Performance Metrics Component */}
              {doctor.availabilityHistory && (
                <div className="mt-6">
                  <DoctorPerformanceMetrics 
                    doctor={doctor} 
                    availabilityHistory={doctor.availabilityHistory || []} 
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDetailView;