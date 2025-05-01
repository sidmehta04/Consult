import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
  } from "firebase/firestore";
  import { firestore } from "../../firebase";
  
  /**
   * Fetch user hierarchy based on reporting relationships
   * Enhanced to properly handle zonalHead, teamLeader, and drManager hierarchies
   */
  export const fetchUserHierarchy = async (userId, userRole) => {
    try {
      const userIds = new Set([userId]); // Include the manager's own ID
      const processedIds = new Set();
      const doctorIds = new Set(); // Specifically track doctors for the doctor dashboard
  
      // First, find all users directly reporting to this manager
      const directReportsQuery = query(
        collection(firestore, "users"),
        where("reportingTo", "==", userId)
      );
  
      const directReportsSnapshot = await getDocs(directReportsQuery);
  
      // Add direct reports to the set
      directReportsSnapshot.forEach((doc) => {
        userIds.add(doc.id);
      });
  
      // Handle special hierarchical roles
      if (userRole === "zonalHead") {
        // For zonalHead: Find all drManagers reporting to them
        const drManagerQuery = query(
          collection(firestore, "users"),
          where("reportingTo", "==", userId),
          where("role", "==", "drManager")
        );
  
        const drManagerSnapshot = await getDocs(drManagerQuery);
        const drManagerIds = [];
  
        drManagerSnapshot.forEach((doc) => {
          drManagerIds.push(doc.id);
          userIds.add(doc.id);
        });
  
        // For each drManager, find their doctors
        for (const drManagerId of drManagerIds) {
          const doctorQuery = query(
            collection(firestore, "users"),
            where("reportingTo", "==", drManagerId),
            where("role", "==", "doctor")
          );
  
          const doctorSnapshot = await getDocs(doctorQuery);
          
          doctorSnapshot.forEach((doctorDoc) => {
            const doctorId = doctorDoc.id;
            userIds.add(doctorId);
            doctorIds.add(doctorId); // Track doctor specifically
            
            // Get doctor data to check assigned clinics
            const doctorData = doctorDoc.data();
            
            // Add assigned clinics to the userIds
            if (doctorData.assignedClinics) {
              Object.keys(doctorData.assignedClinics).forEach((clinicId) => {
                if (doctorData.assignedClinics[clinicId] === true) {
                  userIds.add(clinicId);
                }
              });
            }
          });
        }
      } 
      else if (userRole === "drManager") {
        // For drManagers, find all doctors reporting to them
        const doctorQuery = query(
          collection(firestore, "users"),
          where("reportingTo", "==", userId),
          where("role", "==", "doctor")
        );
  
        const doctorSnapshot = await getDocs(doctorQuery);
  
        doctorSnapshot.forEach((doc) => {
          const doctorId = doc.id;
          userIds.add(doctorId);
          doctorIds.add(doctorId); // Track doctor specifically
        });
  
        // For each doctor, get their assigned clinics
        for (const doctorId of doctorIds) {
          const doctorRef = doc(firestore, "users", doctorId);
          const doctorSnap = await getDoc(doctorRef);
  
          if (doctorSnap.exists() && doctorSnap.data().assignedClinics) {
            // Add clinic IDs to the userIds set
            Object.keys(doctorSnap.data().assignedClinics).forEach((clinicId) => {
              if (doctorSnap.data().assignedClinics[clinicId] === true) {
                userIds.add(clinicId);
              }
            });
          }
        }
      } 
      else if (userRole === "teamLeader") {
        // For teamLeaders, find ROs reporting to them
        const roQuery = query(
          collection(firestore, "users"),
          where("reportingTo", "==", userId),
          where("role", "==", "ro")
        );
  
        const roSnapshot = await getDocs(roQuery);
        const roIds = [];
  
        roSnapshot.forEach((doc) => {
          roIds.push(doc.id);
          userIds.add(doc.id);
        });
  
        // For each RO, find their pharmacists
        for (const roId of roIds) {
          const pharmacistQuery = query(
            collection(firestore, "users"),
            where("reportingTo", "==", roId),
            where("role", "==", "pharmacist")
          );
  
          const pharmacistSnapshot = await getDocs(pharmacistQuery);
          const pharmacistIds = [];
  
          pharmacistSnapshot.forEach((doc) => {
            pharmacistIds.push(doc.id);
            userIds.add(doc.id);
          });
  
          // For each pharmacist, find their clinics (nurses)
          for (const pharmacistId of pharmacistIds) {
            const clinicQuery = query(
              collection(firestore, "users"),
              where("reportingTo", "==", pharmacistId),
              where("role", "==", "nurse")
            );
  
            const clinicSnapshot = await getDocs(clinicQuery);
            const clinicIds = [];
            
            clinicSnapshot.forEach((doc) => {
              const clinicId = doc.id;
              clinicIds.push(clinicId);
              userIds.add(clinicId);
            });
            
            // Special step for teamLeader: Find doctors assigned to these clinics
            // First, get all doctors
            const allDoctorsQuery = query(
              collection(firestore, "users"),
              where("role", "==", "doctor")
            );
            
            const allDoctorsSnapshot = await getDocs(allDoctorsQuery);
            
            // Check each doctor's assigned clinics
            for (const doctorDoc of allDoctorsSnapshot.docs) {
              const doctorData = doctorDoc.data();
              const doctorId = doctorDoc.id;
              
              // If the doctor has assignedClinics field
              if (doctorData.assignedClinics) {
                // Check if any of the clinics under this teamLeader are assigned to this doctor
                for (const clinicId of clinicIds) {
                  if (doctorData.assignedClinics[clinicId] === true) {
                    userIds.add(doctorId);
                    doctorIds.add(doctorId); // Track doctor specifically
                    break; // Found a match, no need to check other clinics
                  }
                }
              }
            }
          }
        }
      }
  
      return {
        userIds: userIds,
        doctorIds: doctorIds, // Return specific doctor IDs for doctor dashboard
        hierarchyDepth:
          userRole === "zonalHead" ? 3 : 
          userRole === "teamLeader" ? 3 : 
          userRole === "drManager" ? 2 : 1,
      };
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
  
  export default fetchUserHierarchy;