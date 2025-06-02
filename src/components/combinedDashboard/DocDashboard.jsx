import React, { useState, useEffect } from "react";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    orderBy, 
    limit, 
    onSnapshot,
    Timestamp
  } from "firebase/firestore";

import { firestore } from "../../firebase";

import { fetchData } from "./fetchData"; 
import { fetchRealtimeData, 
  enrichDoctorsWithShiftData, 
  enrichDoctorsWithCaseData, 
  enrichPharmacistsWithShiftData, 
  enrichPharmacistsWithCaseData 
} from "./fetchDetails";

// Import components
import DoctorDetailView from "./DocDetail";
import DashboardHeader from "./Header";
import DashboardSummary from "./DashboardSummary";
import DoctorTable from "./Table";
import DoctorCardsGrid from "./Card";
import CaseTransferMain from "./CaseTransfer";


const CombinedDashboard = ({ currentUser }) => {
  const [doctors, setDoctors] = useState([]);
  const [pharmacists, setPharmacists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(15000); // 15 seconds refresh by default
  const [realtimeData, setRealtimeData] = useState({});
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // table, cards, or cases
  const [doctorPharmacist, setDoctorPharmacist] = useState("doctor");
  const [partnerNames, setPartnerNames] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);

  // Check if current user can transfer cases
  const canTransferCases = currentUser.role === "teamLeader";

  const loadDoctorData = async (doctorPharmacist) => {
    try {
      setIsLoading(true);
      
      const fetchedData = await fetchData(currentUser.uid, doctorPharmacist);
      const displayData = fetchedData.docList;
      setPartnerNames(fetchedData.partnerNames);
      
      if (displayData.length === 0) {
        console.log(`No ${doctorPharmacist}s found in hierarchy. Check role relationships.`);
      }
      
      if (doctorPharmacist === "doctor") {
        const rtData = await fetchRealtimeData();
        setRealtimeData(rtData);
        const enrichedWithShifts = enrichDoctorsWithShiftData(displayData, rtData);
        const fullyEnrichedDoctors = await enrichDoctorsWithCaseData(enrichedWithShifts);
        setDoctors(fullyEnrichedDoctors);
      } else if (doctorPharmacist === "pharmacist") {
        const enrichedWithShifts = enrichPharmacistsWithShiftData(displayData);
        const fullyEnrichedPharmacists = await enrichPharmacistsWithCaseData(enrichedWithShifts);
        setPharmacists(fullyEnrichedPharmacists);
      }

      setIsLoading(false);

    } catch (err) {
      console.error(`Error loading ${doctorPharmacist} dashboard:`, err);
      setError(`Failed to load ${doctorPharmacist} data. Please try again later.`);
      setIsLoading(false);
    }
  };

  const updateAvailabilityStatus = async () => {
    try {
      if (doctorPharmacist === "doctor") {
        const updatePromises = doctors.map(async (doctor) => {
          const userRef = doc(firestore, "users", doctor.id);
          const snapshot = await getDoc(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.data();
            doctor.availabilityStatus = userData.availabilityStatus;
            doctor.availabilityHistory = userData.availabilityHistory;
          }
        });
        await Promise.all(updatePromises);
      } else if (doctorPharmacist === "pharmacist") {
        const updatePromises = pharmacists.map(async (pharmacist) => {
          const userRef = doc(firestore, "users", pharmacist.id);
          const snapshot = await getDoc(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.data();
            pharmacist.availabilityStatus = userData.availabilityStatus;
            pharmacist.availabilityHistory = userData.availabilityHistory;
          }
        });
        await Promise.all(updatePromises);
      }
    } catch (err) {
      console.error("Error fetching availability data:", err);
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    if ((doctorPharmacist === "doctor" && doctors.length > 0) || (doctorPharmacist === "pharmacist" && pharmacists.length > 0)) {
      try {
        if (doctorPharmacist === "doctor") {
          await updateAvailabilityStatus();
          const updatedDoctors = await enrichDoctorsWithCaseData(doctors);
          setDoctors(updatedDoctors);
        } else if (doctorPharmacist === "pharmacist") {
          await updateAvailabilityStatus();
          const updatedPharmacists = await enrichPharmacistsWithCaseData(pharmacists);
          setPharmacists(updatedPharmacists);
        }
      } catch (err) {
        console.error(`Error refreshing ${doctorPharmacist} data:`, err);
      }
    } else {
      // If no data loaded yet, try complete refresh
      loadDoctorData(doctorPharmacist);
    }
  };

  useEffect(() => {
    if (doctorPharmacist === "doctor" && doctors.length === 0) {
      loadDoctorData(doctorPharmacist);
    } else if (doctorPharmacist === "pharmacist" && pharmacists.length === 0) {
      loadDoctorData(doctorPharmacist);
    }
    handleRefresh();
  }, [doctorPharmacist]);

  useEffect(() => {
    if (!currentUser || !currentUser.uid || !currentUser.role) {
      setError("User information not available");
      setIsLoading(false);
      return;
    }

    // Only allow specific roles to access this dashboard
    if (!["zonalHead", "teamLeader", "drManager"].includes(currentUser.role)) {
      setError("You don't have permission to access this dashboard");
      setIsLoading(false);
      return;
    }

    // Set up real-time updates for doctor status
    const doctorStatusListeners = [];
    
    // Cleanup function to unsubscribe from all listeners
    return () => {
      doctorStatusListeners.forEach(unsubscribe => unsubscribe());
    };
  }, [currentUser]);

  // Set up periodic refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentUser && 
          ["zonalHead", "teamLeader", "drManager"].includes(currentUser.role) && 
          ((doctorPharmacist === "doctor" && doctors.length > 0) || 
           (doctorPharmacist === "pharmacist" && pharmacists.length > 0)) &&
          viewMode !== "cases") { // Don't auto-refresh when in case transfer view
        handleRefresh();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [doctors, pharmacists, currentUser, refreshInterval, doctorPharmacist, viewMode]);

  useEffect(() => {
    // Handle partner selection changes if needed
  }, [selectedPartner]);

  // View a doctor's detailed information
  const viewDoctorDetails = (doctor) => {
    setSelectedDoctor(doctor);
  };

  const handlePartnerChange = (partner) => {
    setSelectedPartner(partner);
  };

  // Handle view mode changes
  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
    
    // If switching to cases view, ensure we have the latest data
    if (newViewMode === "cases" && canTransferCases) {
      // The CaseTransferMain will handle its own data loading
      console.log("Switching to case transfer view");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with control buttons */}
      <DashboardHeader 
        viewMode={viewMode}
        setViewMode={handleViewModeChange}
        doctorPharmacist={doctorPharmacist}
        setDoctorPharmacist={setDoctorPharmacist}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        onRefresh={handleRefresh}
        showCaseTransfer={canTransferCases}
      />

      {/* Show Case Transfer Component if selected and user has permission */}
      {viewMode === "cases" && canTransferCases ? (
        <CaseTransferMain currentUser={currentUser} />
      ) : viewMode === "cases" && !canTransferCases ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-yellow-800">
            <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
            <p className="text-sm">
              Case transfer functionality is only available to Team Leaders. 
              Please contact your administrator if you need access.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <DashboardSummary 
            doctorPharmacist={doctorPharmacist} 
            doctors={doctorPharmacist === "doctor" ? doctors : pharmacists} 
          />
          
          {/* Main Content */}
          {(doctorPharmacist === "doctor" && doctors.length === 0) || 
           (doctorPharmacist === "pharmacist" && pharmacists.length === 0) ? (
            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-center">
              <p className="text-yellow-700 font-medium mb-2">
                No {doctorPharmacist}s found in your hierarchy
              </p>
              <p className="text-yellow-600 text-sm mb-3">
                This might happen if there are no {doctorPharmacist}s reporting to you or assigned to clinics in your hierarchy.
              </p>
              <button 
                onClick={handleRefresh}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
              >
                Refresh Now
              </button>
            </div>
          ) : (
            /* Table or Card View based on mode */
            viewMode === "table" ? (
              <DoctorTable
                doctorPharmacist={doctorPharmacist} 
                doctors={doctorPharmacist === "doctor" ? doctors : pharmacists} 
                onViewDoctorDetails={viewDoctorDetails}
                partnerNames={partnerNames}
              />
            ) : viewMode === "cards" ? (
              <DoctorCardsGrid 
                doctors={doctorPharmacist === "doctor" ? doctors : pharmacists} 
                onViewDoctorDetails={viewDoctorDetails} 
              />
            ) : null
          )}
        </>
      )}
      
      {/* Doctor Detail Modal */}
      {selectedDoctor && (
        <DoctorDetailView 
          doctorPharmacist={doctorPharmacist} 
          doctor={selectedDoctor} 
          onClose={() => setSelectedDoctor(null)} 
        />
      )}

      {/* Debug Information (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 p-2 rounded text-xs text-gray-600">
          <strong>Debug:</strong> Role: {currentUser.role} | View: {viewMode} | 
          Type: {doctorPharmacist} | Can Transfer: {canTransferCases ? 'Yes' : 'No'} | 
          Data Count: {doctorPharmacist === "doctor" ? doctors.length : pharmacists.length}
        </div>
      )}
    </div>
  );
};

export default CombinedDashboard;