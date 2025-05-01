import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc
  } from "firebase/firestore";
  import { firestore } from "../../firebase";
  
  /**
   * Fetch doctors from hierarchy with improved logic for zonalHead and teamLeader
   * This function can work with either the full userIds set or the specific doctorIds set
   */
  export const fetchDoctorsFromHierarchy = async (hierarchyData, defaultHourlyTarget = 12) => {
    const doctorsList = [];
    
    // Use either the doctorIds (preferred) or fall back to userIds
    const userIds = hierarchyData.doctorIds ? 
      Array.from(hierarchyData.doctorIds) : 
      Array.from(hierarchyData.userIds);
    
    // If we have specific doctorIds, use them directly
    if (hierarchyData.doctorIds && hierarchyData.doctorIds.size > 0) {
      for (const doctorId of userIds) {
        const doctorRef = doc(firestore, "users", doctorId);
        const docSnapshot = await getDoc(doctorRef);
        
        if (docSnapshot.exists()) {
          const doctorData = docSnapshot.data();
          
          // Only add if it's actually a doctor
          if (doctorData.role === "doctor") {
            doctorsList.push({
              id: doctorId,
              name: doctorData.name || "Unknown Doctor",
              email: doctorData.email || "",
              empId: doctorData.empId || "",
              availabilityStatus: doctorData.availabilityStatus || "unavailable",
              lastStatusUpdate: doctorData.lastStatusUpdate || null,
              assignedClinics: doctorData.assignedClinics || {},
              reportingTo: doctorData.reportingTo || "",
              reportingToName: doctorData.reportingToName || "",
              partnerName: doctorData.partnerName || "Unknown",
              availabilityHistory: doctorData.availabilityHistory || [],
              breakStartedAt: doctorData.breakStartedAt || null,
              breakDuration: doctorData.breakDuration || 0,
              // Initialize metrics
              todayCases: 0,
              pendingCases: 0,
              completedCases: 0,
              incompleteCases: 0,
              averageTAT: 0,
              shiftTiming: "",
              shiftType: "",
              hourlyTarget: defaultHourlyTarget,
              dailyTarget: defaultHourlyTarget * 8 // Default 8 hour shift
            });
          }
        }
      }
    } 
    // Otherwise query for all doctors and filter by userIds
    else {
      // Query for users with role "doctor" within the hierarchy
      const doctorsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "doctor")
      );
      
      const doctorsSnapshot = await getDocs(doctorsQuery);
      
      doctorsSnapshot.forEach((docSnapshot) => {
        const doctorData = docSnapshot.data();
        const doctorId = docSnapshot.id;
        
        // Only include doctors in our hierarchy
        if (userIds.includes(doctorId)) {
          doctorsList.push({
            id: doctorId,
            name: doctorData.name || "Unknown Doctor",
            email: doctorData.email || "",
            empId: doctorData.empId || "",
            availabilityStatus: doctorData.availabilityStatus || "unavailable",
            lastStatusUpdate: doctorData.lastStatusUpdate || null,
            assignedClinics: doctorData.assignedClinics || {},
            reportingTo: doctorData.reportingTo || "",
            reportingToName: doctorData.reportingToName || "",
            partnerName: doctorData.partnerName || "Unknown",
            availabilityHistory: doctorData.availabilityHistory || [],
            breakStartedAt: doctorData.breakStartedAt || null,
            breakDuration: doctorData.breakDuration || 0,
            // Initialize metrics
            todayCases: 0,
            pendingCases: 0,
            completedCases: 0,
            incompleteCases: 0,
            averageTAT: 0,
            shiftTiming: "",
            shiftType: "",
            hourlyTarget: defaultHourlyTarget,
            dailyTarget: defaultHourlyTarget * 8 // Default 8 hour shift
          });
        }
      });
    }
    
    return doctorsList;
  };
  
  export default fetchDoctorsFromHierarchy;