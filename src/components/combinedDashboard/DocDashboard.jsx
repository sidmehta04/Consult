import React, { useState, useEffect, use } from "react";
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
import { set } from "date-fns";


const CombinedDashboard = ({ currentUser }) => {
  const [doctors, setDoctors] = useState([]);
  const [pharmacists, setPharmacists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(15000); // 1 minute refresh by default
  const [realtimeData, setRealtimeData] = useState({});
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // table or cards
  const [doctorPharmacist, setDoctorPharmacist] = useState("doctor");
  const [partnerNames, setPartnerNames] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);

  const loadDoctorData = async (doctorPharmacist) => {
    try {
      setIsLoading(true);
      ////console.log(`Loading doctor data for ${currentUser.role} with ID ${currentUser.uid}`);
      
      const fetchedData = await fetchData(currentUser.uid, doctorPharmacist);
      const displayData = fetchedData.docList;
      setPartnerNames(fetchedData.partnerNames);
      ////console.log("Fetched data from Firestore:", displayData);
      
      if (displayData.length === 0) {
        ////console.log("No doctors found in hierarchy. Check role relationships.");
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
      console.error("Error loading doctor dashboard:", err);
      setError("Failed to load doctor data. Please try again later.");
      setIsLoading(false);
    }
  };

  const updateAvailabilityStatus = async () => {
    try {
      if (doctorPharmacist == "doctor") {
        doctors.forEach(async (doctor) => {
          const userRef = doc(firestore, "users", doctor.id);
          const snapshot = await getDoc(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.data();
            doctor.availabilityStatus = userData.availabilityStatus;
            doctor.availabilityHistory = userData.availabilityHistory;
          }
        })
      } else if (doctorPharmacist == "pharmacist") {
        pharmacists.forEach(async (doctor) => {
          const userRef = doc(firestore, "users", doctor.id);
          const snapshot = await getDoc(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.data();
            doctor.availabilityStatus = userData.availabilityStatus;
            doctor.availabilityHistory = userData.availabilityHistory;
          }
        })
      }
    } catch (err) {
      console.error("Error fetching availability data:", err);
    }
  }

  // Handle refresh button click
  const handleRefresh = async () => {
    if ((doctorPharmacist == "doctor" && doctors.length > 0) || (doctorPharmacist == "pharmacist" && pharmacists.length > 0)) {
      try {
        if (doctorPharmacist == "doctor") {
          await updateAvailabilityStatus();
          const updatedDoctors = await enrichDoctorsWithCaseData(doctors);
          setDoctors(updatedDoctors);
        } else if (doctorPharmacist == "pharmacist") {
          await updateAvailabilityStatus();
          const updatedPharmacists = await enrichPharmacistsWithCaseData(pharmacists);
          setPharmacists(updatedPharmacists);
        }
      } catch (err) {
        console.error("Error refreshing doctor data:", err);
      }
    } else {
      // If no doctors loaded yet, try complete refresh
      loadDoctorData(doctorPharmacist);
    }
  };

  useEffect(() => {
    if (doctorPharmacist === "doctor" && doctors.length == 0) {
      loadDoctorData(doctorPharmacist);
    } else if (doctorPharmacist === "pharmacist" && pharmacists.length == 0) {
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

    //loadDoctorData(doctorPharmacist);

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
      if (currentUser && ["zonalHead", "teamLeader", "drManager"].includes(currentUser.role) && doctors.length > 0) {
        handleRefresh();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [doctors, currentUser, refreshInterval]);

  useEffect(() => {

  }, [selectedPartner]);


  // View a doctor's detailed information
  const viewDoctorDetails = (doctor) => {
    setSelectedDoctor(doctor);
  };

  const handlePartnerChange = (partner) => {
    setSelectedPartner(partner);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header with control buttons */}
      <DashboardHeader 
        viewMode={viewMode}
        setViewMode={setViewMode}
        doctorPharmacist={doctorPharmacist}
        setDoctorPharmacist={setDoctorPharmacist}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        onRefresh={handleRefresh}
      />

      {/* Summary Cards */}
      <DashboardSummary doctorPharmacist={doctorPharmacist} doctors={doctorPharmacist === "doctor" ? doctors : pharmacists} />
      
      {(doctorPharmacist === "doctor" && doctors.length == 0) || (doctorPharmacist === "pharmacist" && pharmacists.length == 0) ? (
        <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-center">
          <p className="text-yellow-700 font-medium mb-2">No {doctorPharmacist}s found in your hierarchy</p>
          <p className="text-yellow-600 text-sm">
            This might happen if there are no {doctorPharmacist}s reporting to you or assigned to clinics in your hierarchy.
          </p>
          <button 
            onClick={handleRefresh}
            className="mt-3 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm"
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
        ) : (
          <DoctorCardsGrid 
            doctors={doctorPharmacist === "doctor" ? doctors : pharmacists} 
            onViewDoctorDetails={viewDoctorDetails} 
          />
        )
      )}
      
      {/* Doctor Detail Modal */}
      {selectedDoctor && (
        <DoctorDetailView 
          doctorPharmacist={doctorPharmacist} 
          doctor={selectedDoctor} 
          onClose={() => setSelectedDoctor(null)} />
      )}
    </div>
  );
};

export default CombinedDashboard;