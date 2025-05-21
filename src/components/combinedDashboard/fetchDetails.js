//Fetch details and helper functions
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
import { firestore } from "../../firebase";
import { initializeApp } from "firebase/app";

const DEFAULT_HOURLY_TARGET = 12; // Default hourly target for all roles

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


// Function to fetch realtime database data for doctors
export const fetchRealtimeData = async () => {
    try {
    const db = getDatabase(realtimeDbApp);
    const doctorsRef = ref(db, 'doctors'); // Specifically target the "doctors" node
    const snapshot = await get(doctorsRef);

    if (snapshot.exists()) {
        const data = snapshot.val();
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


// Enrich doctors with shift data from realtime database
export const enrichDoctorsWithShiftData = (doctorsList, realtimeData) => {
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
export const calculateShiftHours = (shiftTiming) => {
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
export const enrichDoctorsWithCaseData = async (doctorsList) => {
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
        todayCases: 0,
        pendingCases: 0,
        completedCases: 0,
        incompleteCases: 0,
        totalTAT: 0, // For calculating average
        validTatCases: 0 // Count of cases with valid TAT data
    };
    
    casesSnapshot.forEach((caseDoc) => {
        const caseData = caseDoc.data();

        if(caseData.emrNumbers && caseData.emrNumbers.length > 0) {
            doctorMetrics.todayCases += caseData.emrNumbers.length;
        } else {
            doctorMetrics.todayCases++;
        }

        // Count by status
        if (caseData.isIncomplete || caseData.status === "doctor_incomplete") {
            if(caseData.emrNumbers && caseData.emrNumbers.length > 0) {
                doctorMetrics.incompleteCases += caseData.emrNumbers.length;
            } else {
                doctorMetrics.incompleteCases++;
            }
        } else if (caseData.doctorCompleted) {
            if(caseData.emrNumbers && caseData.emrNumbers.length > 0) {
                doctorMetrics.completedCases += caseData.emrNumbers.length;
            } else {
                doctorMetrics.completedCases++;
            }
            
            // Calculate TAT if possible (time from creation to doctor completion)
            if (caseData.createdAt && caseData.doctorCompletedAt) {
                //const startTime = caseData.createdAt.toDate();
                const startTime = (caseData.doctorJoined ?? caseData.createdAt).toDate();
                const endTime = caseData.doctorCompletedAt.toDate();
                const tat = (endTime - startTime) / (1000 * 60); // TAT in minutes
                
                if (tat >= 0) { // Ensure valid TAT (positive value)
                    doctorMetrics.totalTAT += tat;
                    doctorMetrics.validTatCases++;
                }
            }
        } else {
            if(caseData.emrNumbers && caseData.emrNumbers.length > 0) {
                doctorMetrics.pendingCases += caseData.emrNumbers.length;
            } else {
                doctorMetrics.pendingCases++;
            }
            //doctorMetrics.pendingCases++;
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

// Enrich pharmacists with default shift data
export const enrichPharmacistsWithShiftData = (pharmacists) => {
    return pharmacists.map(pharmacist => ({
        ...pharmacist,
        shiftTiming: "9AM-6PM", // Default shift timing
        shiftType: "Full-Time", // Default shift type
        hourlyTarget: DEFAULT_HOURLY_TARGET, // Default hourly target
        dailyTarget: DEFAULT_HOURLY_TARGET * 8 // Default daily target for 8-hour shift
    }));
};

// Enrich pharmacists with case data
export const enrichPharmacistsWithCaseData = async (pharmacistList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Set up promises for parallel execution
    const promises = pharmacistList.map(async (pharmacist) => {
    const casesRef = collection(firestore, "cases");
    
    // Query for cases assigned to this pharmacist created today
    const todayCasesQuery = query(
        casesRef,
        where("pharmacistId", "==", pharmacist.id),
        where("createdAt", ">=", Timestamp.fromDate(today)),
        where("createdAt", "<", Timestamp.fromDate(tomorrow)),
        limit(500) // Increased limit to get all cases for the day
    );
    
    const casesSnapshot = await getDocs(todayCasesQuery);
    
    // Initialize metrics
    const pharmacistMetrics = {
        todayCases: 0,
        pendingCases: 0,
        completedCases: 0,
        incompleteCases: 0,
        totalTAT: 0, // For calculating average
        validTatCases: 0 // Count of cases with valid TAT data
    };
    
    casesSnapshot.forEach((caseDoc) => {
        const caseData = caseDoc.data();

        if(caseData.emrNumbers && caseData.emrNumbers.length > 0) {
            pharmacistMetrics.todayCases += caseData.emrNumbers.length;
        } else {
            pharmacistMetrics.todayCases++;
        }

        if (caseData.isIncomplete){
            if(caseData.emrNumbers && caseData.emrNumbers.length > 0) {
                pharmacistMetrics.incompleteCases += caseData.emrNumbers.length;
            } else {
                pharmacistMetrics.incompleteCases++;
            }
          } else if (caseData.status === "doctor_completed") {
            if(caseData.emrNumbers && caseData.emrNumbers.length > 0) {
                pharmacistMetrics.pendingCases += caseData.emrNumbers.length;
            } else {
                pharmacistMetrics.pendingCases++;
            }
          } else if (caseData.status === "completed") {
            if(caseData.emrNumbers && caseData.emrNumbers.length > 0) {
                pharmacistMetrics.completedCases += caseData.emrNumbers.length;
            } else {
                pharmacistMetrics.completedCases++;
            }
            // Calculate TAT if possible (time from creation to pharmacist completion)
            if (caseData.createdAt && caseData.pharmacistCompletedAt) {
                //const startTime = caseData.createdAt.toDate();
                const startTime = (caseData.pharmacistJoined ?? caseData.createdAt).toDate();
                const endTime = caseData.pharmacistCompletedAt.toDate();
                const tat = (endTime - startTime) / (1000 * 60); // TAT in minutes
                
                if (tat >= 0) { // Ensure valid TAT (positive value)
                pharmacistMetrics.totalTAT += tat;
                pharmacistMetrics.validTatCases++;
            }
          }
        } 
    });

    
    
    // Calculate average TAT (in minutes)
    const averageTAT = pharmacistMetrics.validTatCases > 0 
        ? Math.round(pharmacistMetrics.totalTAT / pharmacistMetrics.validTatCases) 
        : 0;
    
    // Calculate completion percentage based on daily target
    const completionPercentage = pharmacist.dailyTarget > 0
        ? Math.round((pharmacistMetrics.completedCases / pharmacist.dailyTarget) * 100)
        : 0;
    
    // Return updated pharmacist object
    return {
        ...pharmacist,
        todayCases: pharmacistMetrics.todayCases,
        pendingCases: pharmacistMetrics.pendingCases,
        completedCases: pharmacistMetrics.completedCases,
        incompleteCases: pharmacistMetrics.incompleteCases,
        averageTAT,
        completionPercentage
    };
    });
    
    // Wait for all queries to complete
    return Promise.all(promises);
};

    
