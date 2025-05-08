import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
  } from "firebase/firestore";
  import { firestore } from "../../firebase";

const DEFAULT_HOURLY_TARGET = 12; // Default hourly target for all roles
  
  /**
   * Fetch user hierarchy based on reporting relationships
   * Enhanced to properly handle zonalHead, teamLeader, and drManager hierarchies
   */
  export const fetchData = async (userId, doctorPharmacist) => {
    try {
      const returnList = [];
      
      // new logic is to return all doctors, assuming no double reporting?
      const doctorQuery = query(
        collection(firestore, "users"),
        where("role", "==", doctorPharmacist)
      );

      const doctorSnapshot = await getDocs(doctorQuery);

      doctorSnapshot.forEach((doc) => {
        const doctorData = doc.data();

        returnList.push({
          id: doc.id,
          name: doctorData.name || "Unknown " + doctorPharmacist.charAt(0).toUpperCase() + doctorPharmacist.slice(1),
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
          hourlyTarget: DEFAULT_HOURLY_TARGET,
          dailyTarget: DEFAULT_HOURLY_TARGET * 8 
        });
      });
      
      return returnList;

    } catch (error) {
      console.error("Error fetching user hierarchy:", error);
      // Return just the user's own ID as fallback
      return {
        userIds: new Set([userId]),
        doctorIds: new Set(),
        hierarchyDepth: 0,
      };
    }
  };
  
  export default fetchData;