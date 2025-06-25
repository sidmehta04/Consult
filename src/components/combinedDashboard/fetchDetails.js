//Optimized Fetch details and helper functions
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

const DEFAULT_HOURLY_TARGET = 12;

// Cache for realtime data - refresh every 30 minutes
let realtimeDataCache = null;
let realtimeDataCacheTime = 0;
const REALTIME_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Cache for today's cases - refresh every 5 minutes
let todayCasesCache = null;
let todayCasesCacheTime = 0;
const CASES_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

const realtimeDbApp = initializeApp(realtimeDbConfig, "realtimeDb");

// OPTIMIZATION 1: Cache realtime data
export const fetchRealtimeData = async () => {
    const now = Date.now();
    
    // Return cached data if still valid
    if (realtimeDataCache && (now - realtimeDataCacheTime) < REALTIME_CACHE_DURATION) {
        console.log("Using cached realtime data");
        return realtimeDataCache;
    }
    
    try {
        const db = getDatabase(realtimeDbApp);
        const doctorsRef = ref(db, 'doctors');
        const snapshot = await get(doctorsRef);

        if (snapshot.exists()) {
            realtimeDataCache = snapshot.val();
            realtimeDataCacheTime = now;
            console.log("Fetched fresh realtime data");
            return realtimeDataCache;
        } else {
            console.log("No data available in doctors node of realtime database");
            realtimeDataCache = {};
            realtimeDataCacheTime = now;
            return {};
        }
    } catch (error) {
        console.error("Error fetching realtime data:", error);
        return realtimeDataCache || {}; // Return cached data on error
    }
};

// OPTIMIZATION 2: Batch fetch all today's cases once
const fetchAllTodaysCases = async () => {
    const now = Date.now();
    
    // Return cached data if still valid
    if (todayCasesCache && (now - todayCasesCacheTime) < CASES_CACHE_DURATION) {
        console.log("Using cached cases data");
        return todayCasesCache;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
        const casesRef = collection(firestore, "cases");
        
        // SINGLE QUERY: Get all today's cases at once
        const todayCasesQuery = query(
            casesRef,
            where("createdAt", ">=", Timestamp.fromDate(today)),
            where("createdAt", "<", Timestamp.fromDate(tomorrow)),
            limit(10000) // Increased limit - adjust based on your daily volume
        );
        
        const casesSnapshot = await getDocs(todayCasesQuery);
        
        // Process all cases into grouped data structure
        const casesData = {
            doctorCases: new Map(), // doctorId -> cases[]
            pharmacistCases: new Map(), // pharmacistId -> cases[]
            allCases: []
        };
        
        casesSnapshot.forEach((caseDoc) => {
            const caseData = { id: caseDoc.id, ...caseDoc.data() };
            casesData.allCases.push(caseData);
            
            // Group by doctor
            if (caseData.assignedDoctors?.primary) {
                const doctorId = caseData.assignedDoctors.primary;
                if (!casesData.doctorCases.has(doctorId)) {
                    casesData.doctorCases.set(doctorId, []);
                }
                casesData.doctorCases.get(doctorId).push(caseData);
            }
            
            // Group by pharmacist
            if (caseData.pharmacistId) {
                const pharmacistId = caseData.pharmacistId;
                if (!casesData.pharmacistCases.has(pharmacistId)) {
                    casesData.pharmacistCases.set(pharmacistId, []);
                }
                casesData.pharmacistCases.get(pharmacistId).push(caseData);
            }
        });
        
        todayCasesCache = casesData;
        todayCasesCacheTime = now;
        console.log(`Fetched ${casesData.allCases.length} cases for today`);
        
        return casesData;
    } catch (error) {
        console.error("Error fetching today's cases:", error);
        return todayCasesCache || { doctorCases: new Map(), pharmacistCases: new Map(), allCases: [] };
    }
};

// OPTIMIZATION 3: Process doctor metrics from cached data
const calculateDoctorMetrics = (doctorCases, doctor) => {
    const doctorMetrics = {
        todayCases: 0,
        pendingCases: 0,
        completedCases: 0,
        incompleteCases: 0,
        totalTAT: 0,
        validTatCases: 0
    };
    
    if (!doctorCases || doctorCases.length === 0) {
        return {
            ...doctor,
            ...doctorMetrics,
            averageTAT: 0,
            completionPercentage: 0
        };
    }
    
    doctorCases.forEach((caseData) => {
        // Count cases (handle EMR numbers)
        const caseCount = (caseData.emrNumbers && caseData.emrNumbers.length > 0) 
            ? caseData.emrNumbers.length 
            : 1;
        
        doctorMetrics.todayCases += caseCount;
        
        // Count by status
        if (caseData.status === "doctor_incomplete") {
            doctorMetrics.incompleteCases += caseCount;
        } else if (caseData.doctorCompleted || caseData.status === "pharmacist_incomplete") {
            doctorMetrics.completedCases += caseCount;
            
            // Calculate TAT
            if (caseData.createdAt && caseData.doctorCompletedAt) {
                const startTime = (caseData.doctorJoined ?? caseData.createdAt).toDate();
                const endTime = caseData.doctorCompletedAt.toDate();
                const tat = (endTime - startTime) / (1000 * 60);
                
                if (tat >= 0) {
                    doctorMetrics.totalTAT += tat;
                    doctorMetrics.validTatCases++;
                }
            }
        } else {
            doctorMetrics.pendingCases += caseCount;
        }
    });
    
    const averageTAT = doctorMetrics.validTatCases > 0 
        ? Math.round(doctorMetrics.totalTAT / doctorMetrics.validTatCases) 
        : 0;
    
    const completionPercentage = doctor.dailyTarget > 0
        ? Math.round((doctorMetrics.completedCases / doctor.dailyTarget) * 100)
        : 0;
    
    return {
        ...doctor,
        ...doctorMetrics,
        averageTAT,
        completionPercentage
    };
};

// OPTIMIZATION 4: Process pharmacist metrics from cached data
const calculatePharmacistMetrics = (pharmacistCases, pharmacist) => {
    const pharmacistMetrics = {
        todayCases: 0,
        pendingCases: 0,
        completedCases: 0,
        incompleteCases: 0,
        totalTAT: 0,
        validTatCases: 0
    };
    
    if (!pharmacistCases || pharmacistCases.length === 0) {
        return {
            ...pharmacist,
            ...pharmacistMetrics,
            averageTAT: 0,
            completionPercentage: 0
        };
    }
    
    pharmacistCases.forEach((caseData) => {
        const caseCount = (caseData.emrNumbers && caseData.emrNumbers.length > 0) 
            ? caseData.emrNumbers.length 
            : 1;
        
        pharmacistMetrics.todayCases += caseCount;
        
        if (caseData.isIncomplete) {
            pharmacistMetrics.incompleteCases += caseCount;
        } else if (caseData.status === "doctor_completed") {
            pharmacistMetrics.pendingCases += caseCount;
        } else if (caseData.status === "completed") {
            pharmacistMetrics.completedCases += caseCount;
            
            if (caseData.createdAt && caseData.pharmacistCompletedAt) {
                const startTime = (caseData.pharmacistJoined ?? caseData.createdAt).toDate();
                const endTime = caseData.pharmacistCompletedAt.toDate();
                const tat = (endTime - startTime) / (1000 * 60);
                
                if (tat >= 0) {
                    pharmacistMetrics.totalTAT += tat;
                    pharmacistMetrics.validTatCases++;
                }
            }
        }
    });
    
    const averageTAT = pharmacistMetrics.validTatCases > 0 
        ? Math.round(pharmacistMetrics.totalTAT / pharmacistMetrics.validTatCases) 
        : 0;
    
    const completionPercentage = pharmacist.dailyTarget > 0
        ? Math.round((pharmacistMetrics.completedCases / pharmacist.dailyTarget) * 100)
        : 0;
    
    return {
        ...pharmacist,
        ...pharmacistMetrics,
        averageTAT,
        completionPercentage
    };
};

// Existing helper functions (unchanged)
export const enrichDoctorsWithShiftData = (doctorsList, realtimeData) => {
    return doctorsList.map(doctor => {
        let shiftInfo = { 
            shiftTiming: "9AM-6PM",
            shiftType: "Full-Time",
            hourlyTarget: DEFAULT_HOURLY_TARGET,
            dailyTarget: DEFAULT_HOURLY_TARGET * 8
        };
        
        if (doctor.empId) {
            Object.keys(realtimeData || {}).forEach(key => {
                const rtDoctor = realtimeData[key];
                if (rtDoctor.empId === doctor.empId) {
                    shiftInfo.shiftTiming = rtDoctor.shiftTiming || shiftInfo.shiftTiming;
                    shiftInfo.shiftType = rtDoctor.shiftType || shiftInfo.shiftType;
                    
                    const shiftHours = calculateShiftHours(rtDoctor.shiftTiming);
                    shiftInfo.shiftHours = shiftHours;
                    
                    if (rtDoctor.shiftType === "Part-Time") {
                        shiftInfo.dailyTarget = DEFAULT_HOURLY_TARGET * shiftHours;
                    } else {
                        shiftInfo.dailyTarget = DEFAULT_HOURLY_TARGET * (shiftHours - 1);
                    }
                }
            });
        }
        
        return { ...doctor, ...shiftInfo };
    });
};

export const calculateShiftHours = (shiftTiming) => {
    if (!shiftTiming) return 8;

    try {
        const parts = shiftTiming.split('-');
        if (parts.length !== 2) return 8;
        
        const startPart = parts[0].trim();
        const endPart = parts[1].trim();
        
        const startHour = parseInt(startPart.replace(/[^0-9]/g, ''));
        const endHour = parseInt(endPart.replace(/[^0-9]/g, ''));
        const startIsAM = startPart.toLowerCase().includes('am');
        const endIsAM = endPart.toLowerCase().includes('am');
        
        let start24 = startHour;
        if (startIsAM && startHour === 12) start24 = 0;
        if (!startIsAM && startHour !== 12) start24 += 12;
        
        let end24 = endHour;
        if (endIsAM && endHour === 12) end24 = 0;
        if (!endIsAM && endHour !== 12) end24 += 12;
        
        let hours = end24 - start24;
        if (hours < 0) hours += 24;
        
        return hours > 0 ? hours : 8;
    } catch (err) {
        console.error("Error parsing shift timing:", err);
        return 8;
    }
};

// OPTIMIZED: Single function to enrich doctors with case data
export const enrichDoctorsWithCaseData = async (doctorsList) => {
    // Fetch all today's cases once
    const casesData = await fetchAllTodaysCases();
    
    // Process each doctor using cached data
    return doctorsList.map(doctor => {
        const doctorCases = casesData.doctorCases.get(doctor.id) || [];
        return calculateDoctorMetrics(doctorCases, doctor);
    });
};

export const enrichPharmacistsWithShiftData = (pharmacists) => {
    return pharmacists.map(pharmacist => ({
        ...pharmacist,
        shiftTiming: "9AM-6PM",
        shiftType: "Full-Time",
        hourlyTarget: 6.25,
        dailyTarget: 60
    }));
};

// OPTIMIZED: Single function to enrich pharmacists with case data
export const enrichPharmacistsWithCaseData = async (pharmacistList) => {
    // Fetch all today's cases once (will use cache if available)
    const casesData = await fetchAllTodaysCases();
    
    // Process each pharmacist using cached data
    return pharmacistList.map(pharmacist => {
        const pharmacistCases = casesData.pharmacistCases.get(pharmacist.id) || [];
        return calculatePharmacistMetrics(pharmacistCases, pharmacist);
    });
};

// BONUS: Function to clear caches manually if needed
export const clearCaches = () => {
    realtimeDataCache = null;
    realtimeDataCacheTime = 0;
    todayCasesCache = null;
    todayCasesCacheTime = 0;
    console.log("All caches cleared");
};

// BONUS: Function to get cache stats
export const getCacheStats = () => {
    const now = Date.now();
    return {
        realtimeData: {
            cached: !!realtimeDataCache,
            age: realtimeDataCache ? Math.round((now - realtimeDataCacheTime) / 1000) : 0,
            valid: realtimeDataCache && (now - realtimeDataCacheTime) < REALTIME_CACHE_DURATION
        },
        casesData: {
            cached: !!todayCasesCache,
            age: todayCasesCache ? Math.round((now - todayCasesCacheTime) / 1000) : 0,
            valid: todayCasesCache && (now - todayCasesCacheTime) < CASES_CACHE_DURATION,
            totalCases: todayCasesCache ? todayCasesCache.allCases.length : 0
        }
    };
};