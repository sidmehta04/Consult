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
import { ref, get, getDatabase } from "firebase/database";
import { initializeApp } from "firebase/app";
import { firestore } from "../../firebase";
import { fetchUserHierarchy } from "./fetchUsers"; 
import { fetchDoctorsFromHierarchy } from "./fetchDoc";

// Import components
import DoctorDetailView from "./DocDetail";
import DashboardHeader from "./Header";
import DashboardSummary from "./DashboardSummary";
import DoctorTable from "./Table";
import DoctorCardsGrid from "./Card";

// Firebase Realtime Database configuration
const realtimeDbConfig = {
  apiKey: "AIzaSyDO93Lazw7F3pZXM1u5p-kSdGObza9ZrI0",
  authDomain: "docmanagement-40261.firebaseapp.com",
  databaseURL: "https://docmanagement-40261-default-rtdb.firebaseio.com",
  projectId: "docmanagement-40261",
  storageBucket: "docmanagement-40261.firebasestorage.app",
  messagingSenderId: "456008274635",
  appId: "1:456008274635:web:1d8e9e6246e499df8dc14e"
};

// Initialize a separate Firebase app for the realtime database
const realtimeDbApp = initializeApp(realtimeDbConfig, "realtimeDb");

// Default hourly target (can be overridden by shift data)
const DEFAULT_HOURLY_TARGET = 12;

const DoctorDashboard = ({ currentUser }) => {
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(60000); // 1 minute refresh by default
  const [realtimeData, setRealtimeData] = useState({});
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // table or cards

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

    // Function to fetch realtime database data
    const fetchRealtimeData = async () => {
      try {
        const db = getDatabase(realtimeDbApp);
        const doctorsRef = ref(db, 'doctors'); // Specifically target the "doctors" node
        const snapshot = await get(doctorsRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          setRealtimeData(data);
          return data;
        } else {
          console.log("No data available in doctors node of realtime database");
          return {};
        }
      } catch (error) {
        console.error("Error fetching realtime data:", error);
        return {};
      }
    };

    const loadDoctorData = async () => {
      try {
        setIsLoading(true);
        console.log(`Loading doctor data for ${currentUser.role} with ID ${currentUser.uid}`);
        
        // Get realtime database data first
        const rtData = await fetchRealtimeData();
        
        // Get hierarchy data to determine which doctors to display
        // This will now include specific doctorIds for the dashboard
        const hierarchyData = await fetchUserHierarchy(currentUser.uid, currentUser.role);
        console.log(`Hierarchy data fetched. Total userIds: ${hierarchyData.userIds.size}, 
                    doctorIds: ${hierarchyData.doctorIds ? hierarchyData.doctorIds.size : 0}`);
        
        // Find all doctors in the hierarchy using the enhanced fetchDoctorsFromHierarchy
        const doctorsList = await fetchDoctorsFromHierarchy(hierarchyData, DEFAULT_HOURLY_TARGET);
        console.log(`Found ${doctorsList.length} doctors in hierarchy`);
        
        if (doctorsList.length === 0) {
          console.log("No doctors found in hierarchy. Check role relationships.");
        }
        
        // Enrich doctors with shift information from realtime DB
        const enrichedWithShifts = enrichDoctorsWithShiftData(doctorsList, rtData);
        
        // Fetch today's case data for each doctor
        const fullyEnrichedDoctors = await enrichDoctorsWithCaseData(enrichedWithShifts);
        
        setDoctors(fullyEnrichedDoctors);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading doctor dashboard:", err);
        setError("Failed to load doctor data. Please try again later.");
        setIsLoading(false);
      }
    };

    loadDoctorData();

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
        try {
          // Fetch updated case counts without reloading the entire doctor list
          const updatedDoctors = await enrichDoctorsWithCaseData(doctors);
          setDoctors(updatedDoctors);
        } catch (err) {
          console.error("Error refreshing doctor data:", err);
        }
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [doctors, currentUser, refreshInterval]);

  // Enrich doctors with shift data from realtime database
  const enrichDoctorsWithShiftData = (doctorsList, realtimeData) => {
    return doctorsList.map(doctor => {
      // Try to find doctor in realtime data by empId
      let shiftInfo = { 
        shiftTiming: "9AM-5PM", // Default shift
        shiftType: "Full-Time",
        hourlyTarget: DEFAULT_HOURLY_TARGET,
        dailyTarget: DEFAULT_HOURLY_TARGET * 8
      };
      
      // Search through realtime data to find matching doctor by empId
      if (doctor.empId) {
        Object.keys(realtimeData || {}).forEach(key => {
          const rtDoctor = realtimeData[key];
          if (rtDoctor.empId === doctor.empId) {
            // Found matching doctor in realtime DB
            shiftInfo.shiftTiming = rtDoctor.shiftTiming || shiftInfo.shiftTiming;
            shiftInfo.shiftType = rtDoctor.shiftType || shiftInfo.shiftType;
            
            // Calculate shift hours and targets
            const shiftHours = calculateShiftHours(rtDoctor.shiftTiming);
            shiftInfo.shiftHours = shiftHours;
            
            // Calculate daily target based on shift type
            // Part-time: No break, full hours × 12 cases
            // Full-time: 1 hour break, (hours - 1) × 12 cases
            if (rtDoctor.shiftType === "Part-Time") {
              shiftInfo.dailyTarget = DEFAULT_HOURLY_TARGET * shiftHours;
            } else {
              // For full-time, account for 1-hour break
              shiftInfo.dailyTarget = DEFAULT_HOURLY_TARGET * (shiftHours - 1);
            }
          }
        });
      }
      
      // Return doctor with shift info
      return {
        ...doctor,
        ...shiftInfo
      };
    });
  };

  // Calculate shift hours from shift timing string
  const calculateShiftHours = (shiftTiming) => {
    if (!shiftTiming) return 8; // Default to 8 hours
    
    try {
      // Parse shift timing (e.g., "8AM-2PM", "1PM-9PM")
      const parts = shiftTiming.split('-');
      if (parts.length !== 2) return 8;
      
      const startPart = parts[0].trim();
      const endPart = parts[1].trim();
      
      // Extract hours and AM/PM
      const startHour = parseInt(startPart.replace(/[^0-9]/g, ''));
      const endHour = parseInt(endPart.replace(/[^0-9]/g, ''));
      const startIsAM = startPart.toLowerCase().includes('am');
      const endIsAM = endPart.toLowerCase().includes('am');
      
      // Convert to 24-hour format
      let start24 = startHour;
      if (startIsAM && startHour === 12) start24 = 0;
      if (!startIsAM && startHour !== 12) start24 += 12;
      
      let end24 = endHour;
      if (endIsAM && endHour === 12) end24 = 0;
      if (!endIsAM && endHour !== 12) end24 += 12;
      
      // Calculate hours
      let hours = end24 - start24;
      if (hours < 0) hours += 24; // Handle overnight shifts
      
      return hours > 0 ? hours : 8; // Return calculated hours or default to 8
    } catch (err) {
      console.error("Error parsing shift timing:", err);
      return 8; // Default to 8 hours on error
    }
  };

  // Enrich doctors with case data
  const enrichDoctorsWithCaseData = async (doctorsList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Set up promises for parallel execution
    const promises = doctorsList.map(async (doctor) => {
      const casesRef = collection(firestore, "cases");
      
      // Query for cases assigned to this doctor created today
      const todayCasesQuery = query(
        casesRef,
        where("assignedDoctors.primary", "==", doctor.id),
        where("createdAt", ">=", Timestamp.fromDate(today)),
        where("createdAt", "<", Timestamp.fromDate(tomorrow)),
        limit(500) // Increased limit to get all cases for the day
      );
      
      const casesSnapshot = await getDocs(todayCasesQuery);
      
      // Initialize metrics
      const doctorMetrics = {
        todayCases: casesSnapshot.size,
        pendingCases: 0,
        completedCases: 0,
        incompleteCases: 0,
        totalTAT: 0, // For calculating average
        validTatCases: 0 // Count of cases with valid TAT data
      };
      
      casesSnapshot.forEach((caseDoc) => {
        const caseData = caseDoc.data();
        
        // Count by status
        if (caseData.isIncomplete || caseData.status === "doctor_incomplete") {
          doctorMetrics.incompleteCases++;
        } else if (caseData.doctorCompleted) {
          doctorMetrics.completedCases++;
          
          // Calculate TAT if possible (time from creation to doctor completion)
          if (caseData.createdAt && caseData.doctorCompletedAt) {
            const startTime = caseData.createdAt.toDate();
            const endTime = caseData.doctorCompletedAt.toDate();
            const tat = (endTime - startTime) / (1000 * 60); // TAT in minutes
            
            if (tat >= 0) { // Ensure valid TAT (positive value)
              doctorMetrics.totalTAT += tat;
              doctorMetrics.validTatCases++;
            }
          }
        } else {
          doctorMetrics.pendingCases++;
        }
      });
      
      // Calculate average TAT (in minutes)
      const averageTAT = doctorMetrics.validTatCases > 0 
        ? Math.round(doctorMetrics.totalTAT / doctorMetrics.validTatCases) 
        : 0;
      
      // Calculate completion percentage based on daily target
      const completionPercentage = doctor.dailyTarget > 0
        ? Math.round((doctorMetrics.completedCases / doctor.dailyTarget) * 100)
        : 0;
      
      // Return updated doctor object
      return {
        ...doctor,
        todayCases: doctorMetrics.todayCases,
        pendingCases: doctorMetrics.pendingCases,
        completedCases: doctorMetrics.completedCases,
        incompleteCases: doctorMetrics.incompleteCases,
        averageTAT,
        completionPercentage
      };
    });
    
    // Wait for all queries to complete
    return Promise.all(promises);
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    if (doctors.length > 0) {
      try {
        const updatedDoctors = await enrichDoctorsWithCaseData(doctors);
        setDoctors(updatedDoctors);
      } catch (err) {
        console.error("Error refreshing doctor data:", err);
      }
    } else {
      // If no doctors loaded yet, try complete refresh
      try {
        setIsLoading(true);
        const rtData = await fetchRealtimeData();
        const hierarchyData = await fetchUserHierarchy(currentUser.uid, currentUser.role);
        const doctorsList = await fetchDoctorsFromHierarchy(hierarchyData, DEFAULT_HOURLY_TARGET);
        const enrichedWithShifts = enrichDoctorsWithShiftData(doctorsList, rtData);
        const fullyEnrichedDoctors = await enrichDoctorsWithCaseData(enrichedWithShifts);
        setDoctors(fullyEnrichedDoctors);
        setIsLoading(false);
      } catch (err) {
        console.error("Error refreshing doctor data:", err);
        setError("Failed to load doctor data. Please try again later.");
        setIsLoading(false);
      }
    }
  };

  // View a doctor's detailed information
  const viewDoctorDetails = (doctor) => {
    setSelectedDoctor(doctor);
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
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        onRefresh={handleRefresh}
      />

      {/* Summary Cards */}
      <DashboardSummary doctors={doctors} />
      
      {doctors.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-center">
          <p className="text-yellow-700 font-medium mb-2">No doctors found in your hierarchy</p>
          <p className="text-yellow-600 text-sm">
            This might happen if there are no doctors reporting to you or assigned to clinics in your hierarchy.
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
            doctors={doctors} 
            onViewDoctorDetails={viewDoctorDetails} 
          />
        ) : (
          <DoctorCardsGrid 
            doctors={doctors} 
            onViewDoctorDetails={viewDoctorDetails} 
          />
        )
      )}
      
      {/* Doctor Detail Modal */}
      {selectedDoctor && (
        <DoctorDetailView doctor={selectedDoctor} onClose={() => setSelectedDoctor(null)} />
      )}
    </div>
  );
};

export default DoctorDashboard;