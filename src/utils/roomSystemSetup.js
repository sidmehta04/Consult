import { doc, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';

/**
 * Updates user documents to include meeting links and pharmacy assignments
 */
export const setupRoomSystemData = async () => {
  try {
    console.log('Setting up Room System data...');

    // Update doctors with meeting links
    const doctorsQuery = query(
      collection(firestore, 'users'),
      where('role', '==', 'doctor')
    );
    const doctorsSnapshot = await getDocs(doctorsQuery);
    
    for (const doctorDoc of doctorsSnapshot.docs) {
      const doctorData = doctorDoc.data();
      
      // Generate meeting link if not exists
      const meetingLink = doctorData.meetingLink || `https://meet.google.com/${doctorDoc.id}-room`;
      
      await updateDoc(doc(firestore, 'users', doctorDoc.id), {
        meetingLink: meetingLink,
        availabilityStatus: doctorData.availabilityStatus || 'available', // Use availabilityStatus instead of isOnline
        specialization: doctorData.specialization || 'General Medicine'
      });
    }

    // Update pharmacists with meeting links and assign them to doctors
    const pharmacistsQuery = query(
      collection(firestore, 'users'),
      where('role', '==', 'pharmacist')
    );
    const pharmacistsSnapshot = await getDocs(pharmacistsQuery);
    const pharmacists = pharmacistsSnapshot.docs;
    const doctors = doctorsSnapshot.docs;

    // Assign pharmacists to doctors (up to 3 per doctor)
    for (let i = 0; i < pharmacists.length; i++) {
      const pharmacistDoc = pharmacists[i];
      const pharmacistData = pharmacistDoc.data();
      
      // Assign to doctor (round-robin or specific assignment)
      const assignedDoctorIndex = i % doctors.length;
      const assignedDoctorId = doctors[assignedDoctorIndex].id;
      
      // Generate meeting link for pharmacist
      const meetingLink = pharmacistData.meetingLink || `https://meet.google.com/${pharmacistDoc.id}-pharmacy`;
      
      // Support both old single assignment and new multiple assignment system
      const currentAssignedDoctorIds = pharmacistData.assignedDoctorIds || [];
      const updatedAssignedDoctorIds = currentAssignedDoctorIds.includes(assignedDoctorId) 
        ? currentAssignedDoctorIds 
        : [...currentAssignedDoctorIds, assignedDoctorId];

      await updateDoc(doc(firestore, 'users', pharmacistDoc.id), {
        assignedDoctorId: assignedDoctorId, // Keep for backward compatibility
        assignedDoctorIds: updatedAssignedDoctorIds, // New array-based system
        meetingLink: meetingLink,
        specialization: pharmacistData.specialization || 'General Pharmacy'
      });
    }

    console.log('Room System data setup completed successfully!');
    return { success: true, message: 'Room System data setup completed' };
    
  } catch (error) {
    console.error('Error setting up Room System data:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generates a unique Google Meet-style link
 */
export const generateMeetingLink = (userId, type = 'room') => {
  const baseUrl = 'https://meet.google.com/';
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  
  // Generate pattern like: abc-defg-hij
  const part1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part3 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  return `${baseUrl}${part1}-${part2}-${part3}`;
};

/**
 * Get doctors with their assigned pharmacists for a specific user
 */
export const getDoctorsWithPharmacists = async (currentUser) => {
  const startTime = performance.now();
  console.log(`[PERF] Starting getDoctorsWithPharmacists for ${currentUser.role}:`, currentUser.uid);
  
  try {
    let doctorsWithPharmacists = [];
    const addedDoctorIds = new Set(); // Track added doctors to prevent duplicates
    
    if (currentUser.role === 'nurse') {
      // For nurses, get doctors from assignedDoctors field
      console.log('Fetching doctors for nurse:', currentUser.uid);
      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        console.error('User document not found');
        return [];
      }
      
      const userData = userDoc.data();
      console.log('User data:', userData);
      const assignedDoctors = userData.assignedDoctors || {};
      console.log('Assigned doctors:', assignedDoctors);
      
      // Extract unique doctor IDs from assignedDoctors object
      const doctorIdsSet = new Set();
      if (assignedDoctors.primary) {
        doctorIdsSet.add(assignedDoctors.primary);
      }
      if (assignedDoctors.secondary) {
        doctorIdsSet.add(assignedDoctors.secondary);
      }
      if (assignedDoctors.tertiary) {
        doctorIdsSet.add(assignedDoctors.tertiary);
      }
      
      const doctorIds = Array.from(doctorIdsSet);
      console.log('Doctor IDs to fetch:', doctorIds);
      
      // PERFORMANCE OPTIMIZATION: Fetch all pharmacists and filter by assignedDoctorIds array
      let pharmacistsByDoctor = {};
      
      if (doctorIds.length > 0) {
        // Get all pharmacists since we can't query array-contains with multiple values efficiently
        const allPharmacistsQuery = query(
          collection(firestore, 'users'),
          where('role', '==', 'pharmacist')
        );
        
        const allPharmacistsSnapshot = await getDocs(allPharmacistsQuery);
        const allPharmacists = allPharmacistsSnapshot.docs.map(pharmDoc => ({
          id: pharmDoc.id,
          ...pharmDoc.data(),
          specialty: pharmDoc.data().specialization || 'General Pharmacy',
          name: pharmDoc.data().displayName || pharmDoc.data().name || pharmDoc.data().email,
          assignedDoctorId: pharmDoc.data().assignedDoctorId, // Backward compatibility
          assignedDoctorIds: pharmDoc.data().assignedDoctorIds || []
        }));
        
        console.log(`[PERF] Fetched ${allPharmacists.length} pharmacists in single query:`, allPharmacists);
        
        // Group pharmacists by doctor ID for quick lookup (support both old and new systems)
        allPharmacists.forEach(pharmacist => {
          const assignedDoctorIds = pharmacist.assignedDoctorIds || [];
          
          // Check new array-based system first
          if (assignedDoctorIds.length > 0) {
            assignedDoctorIds.forEach(doctorId => {
              if (doctorIds.includes(doctorId)) {
                if (!pharmacistsByDoctor[doctorId]) {
                  pharmacistsByDoctor[doctorId] = [];
                }
                pharmacistsByDoctor[doctorId].push(pharmacist);
              }
            });
          } 
          // Fallback to old single assignment system
          else if (pharmacist.assignedDoctorId && doctorIds.includes(pharmacist.assignedDoctorId)) {
            if (!pharmacistsByDoctor[pharmacist.assignedDoctorId]) {
              pharmacistsByDoctor[pharmacist.assignedDoctorId] = [];
            }
            pharmacistsByDoctor[pharmacist.assignedDoctorId].push(pharmacist);
          }
        });
      } else {
        console.log('[PERF] No doctor IDs to fetch pharmacists for');
      }
      
      // Fetch each assigned doctor
      for (const doctorId of doctorIds) {
        // Skip if already added
        if (addedDoctorIds.has(doctorId)) {
          console.log('Doctor already added, skipping:', doctorId);
          continue;
        }
        
        try {
          console.log('Fetching doctor:', doctorId);
          const doctorDoc = await getDoc(doc(firestore, 'users', doctorId));
          if (doctorDoc.exists()) {
            const doctorData = doctorDoc.data();
            console.log('Doctor data:', doctorId, doctorData);
            
            // Check assignToAnyDoctor flag to determine filtering strictness
            const assignToAnyDoctor = assignedDoctors.assignToAnyDoctor || false;
            const isAvailable = doctorData.availabilityStatus === 'available' || !doctorData.availabilityStatus;
            
            console.log('Doctor availability check:', {
              doctorId,
              availabilityStatus: doctorData.availabilityStatus,
              assignToAnyDoctor,
              isAvailable,
              willInclude: assignToAnyDoctor ? isAvailable : true // Show assigned doctors regardless of availability when assignToAnyDoctor is false
            });
            
            // If assignToAnyDoctor is false, show assigned doctors regardless of availability status
            // If assignToAnyDoctor is true, filter by availability
            const shouldIncludeDoctor = assignToAnyDoctor ? isAvailable : true;
            
            if (shouldIncludeDoctor) {
              // Use pre-fetched pharmacists data for performance
              const pharmacists = pharmacistsByDoctor[doctorId] || [];
              console.log(`[PERF] Using cached pharmacists for doctor ${doctorId}:`, pharmacists);

              doctorsWithPharmacists.push({
                id: doctorDoc.id,
                name: doctorData.displayName || doctorData.name || doctorData.email,
                specialty: doctorData.specialization || 'General Medicine',
                gmeetLink: doctorData.meetingLink || `https://meet.google.com/${doctorDoc.id}-room`,
                status: isAvailable ? 'available' : 'busy',
                availabilityStatus: doctorData.availabilityStatus,
                pharmacists: pharmacists
              });
              addedDoctorIds.add(doctorId);
              console.log('Added doctor to list:', doctorDoc.id);
            } else {
              console.log('Doctor not available or offline:', doctorId);
            }
          } else {
            console.log('Doctor document does not exist:', doctorId);
          }
        } catch (error) {
          console.error(`Error fetching doctor ${doctorId}:`, error);
        }
      }
      
      console.log('Final doctors list:', doctorsWithPharmacists);
      
      // Fallback: If no assigned doctors found, check assignToAnyDoctor flag before showing all available doctors
      if (doctorsWithPharmacists.length === 0) {
        const assignToAnyDoctor = assignedDoctors.assignToAnyDoctor || false;
        console.log('No assigned doctors found. assignToAnyDoctor flag:', assignToAnyDoctor);
        
        if (assignToAnyDoctor) {
          console.log('assignToAnyDoctor is true, falling back to all available doctors...');
          
          const allDoctorsQuery = query(
            collection(firestore, 'users'),
            where('role', '==', 'doctor')
          );
          
          const allDoctorsSnapshot = await getDocs(allDoctorsQuery);
          
          for (const doctorDoc of allDoctorsSnapshot.docs) {
            // Skip if already added
            if (addedDoctorIds.has(doctorDoc.id)) {
              console.log('Fallback doctor already added, skipping:', doctorDoc.id);
              continue;
            }
            
            const doctorData = doctorDoc.data();
            console.log('Fallback doctor check:', doctorDoc.id, doctorData);
            
            const isAvailable = doctorData.availabilityStatus === 'available' || !doctorData.availabilityStatus;
            if (isAvailable) {
              // Fetch pharmacists assigned to this doctor (support both systems)
              const allPharmacistsQuery = query(
                collection(firestore, 'users'),
                where('role', '==', 'pharmacist')
              );
              
              const allPharmacistsSnapshot = await getDocs(allPharmacistsQuery);
              const pharmacists = allPharmacistsSnapshot.docs
                .map(pharmDoc => ({
                  id: pharmDoc.id,
                  ...pharmDoc.data(),
                  specialty: pharmDoc.data().specialization || 'General Pharmacy',
                  name: pharmDoc.data().displayName || pharmDoc.data().name || pharmDoc.data().email,
                  assignedDoctorIds: pharmDoc.data().assignedDoctorIds || []
                }))
                .filter(pharmacist => {
                  // Check new array-based system first
                  if (pharmacist.assignedDoctorIds.length > 0) {
                    return pharmacist.assignedDoctorIds.includes(doctorDoc.id);
                  }
                  // Fallback to old single assignment system
                  return pharmacist.assignedDoctorId === doctorDoc.id;
                });

              doctorsWithPharmacists.push({
                id: doctorDoc.id,
                name: doctorData.displayName || doctorData.name || doctorData.email,
                specialty: doctorData.specialization || 'General Medicine',
                gmeetLink: doctorData.meetingLink || `https://meet.google.com/${doctorDoc.id}-room`,
                status: 'available',
                availabilityStatus: doctorData.availabilityStatus,
                pharmacists: pharmacists
              });
              addedDoctorIds.add(doctorDoc.id);
              console.log('Added fallback doctor:', doctorDoc.id);
            }
          }
          
          console.log('Fallback doctors list:', doctorsWithPharmacists);
        } else {
          console.log('assignToAnyDoctor is false, not falling back to other doctors. Only assigned doctors will be shown.');
        }
      }
    } else if (currentUser.role === 'doctor') {
      // Doctor sees only themselves
      const doctorDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      if (doctorDoc.exists()) {
        const doctorData = doctorDoc.data();
        
        // Fetch pharmacists assigned to this doctor (support both systems)
        const allPharmacistsQuery = query(
          collection(firestore, 'users'),
          where('role', '==', 'pharmacist')
        );
        
        const allPharmacistsSnapshot = await getDocs(allPharmacistsQuery);
        const pharmacists = allPharmacistsSnapshot.docs
          .map(pharmDoc => ({
            id: pharmDoc.id,
            ...pharmDoc.data(),
            specialty: pharmDoc.data().specialization || 'General Pharmacy',
            name: pharmDoc.data().displayName || pharmDoc.data().name || pharmDoc.data().email,
            assignedDoctorIds: pharmDoc.data().assignedDoctorIds || []
          }))
          .filter(pharmacist => {
            // Check new array-based system first
            if (pharmacist.assignedDoctorIds.length > 0) {
              return pharmacist.assignedDoctorIds.includes(currentUser.uid);
            }
            // Fallback to old single assignment system
            return pharmacist.assignedDoctorId === currentUser.uid;
          });

        doctorsWithPharmacists.push({
          id: currentUser.uid,
          name: doctorData.displayName || doctorData.name || doctorData.email,
          specialty: doctorData.specialization || 'General Medicine',
          gmeetLink: doctorData.meetingLink || `https://meet.google.com/${currentUser.uid}-room`,
          status: doctorData.availabilityStatus || 'available',
          availabilityStatus: doctorData.availabilityStatus,
          pharmacists: pharmacists
        });
      }
    } else if (currentUser.role === 'pharmacist') {
      // For pharmacists, efficiently get their assigned doctor(s) - support both single and multiple assignments
      console.log('Fetching assigned doctors for pharmacist:', currentUser.uid);
      
      // First, get the pharmacist's document to find their assignedDoctorIds
      const pharmacistQueryStart = performance.now();
      const pharmacistDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      console.log(`[PERF] Pharmacist document fetch: ${Math.round(performance.now() - pharmacistQueryStart)}ms`);
      
      if (pharmacistDoc.exists()) {
        const pharmacistData = pharmacistDoc.data();
        // Support both new array-based system and old single assignment
        const assignedDoctorIds = pharmacistData.assignedDoctorIds || [];
        const singleAssignedDoctorId = pharmacistData.assignedDoctorId;
        
        // Combine both systems - use array if available, fallback to single assignment
        let doctorIdsToFetch = [...assignedDoctorIds];
        if (singleAssignedDoctorId && !doctorIdsToFetch.includes(singleAssignedDoctorId)) {
          doctorIdsToFetch.push(singleAssignedDoctorId);
        }
        
        console.log('Pharmacist assigned to doctors:', doctorIdsToFetch);
        
        // Fetch all assigned doctors
        for (const assignedDoctorId of doctorIdsToFetch) {
          const doctorQueryStart = performance.now();
          const doctorDoc = await getDoc(doc(firestore, 'users', assignedDoctorId));
          console.log(`[PERF] Doctor document fetch: ${Math.round(performance.now() - doctorQueryStart)}ms`);
          
          if (doctorDoc.exists()) {
            const doctorData = doctorDoc.data();
            
            // For pharmacist view, we can skip fetching all other pharmacists and just include current pharmacist
            // This is much faster than querying all pharmacists assigned to this doctor
            const pharmacists = [{
              id: currentUser.uid,
              ...pharmacistData,
              specialty: pharmacistData.specialization || 'General Pharmacy',
              name: pharmacistData.displayName || pharmacistData.name || pharmacistData.email || currentUser.email
            }];
            console.log(`[PERF] Skipped pharmacists query for performance - pharmacist only needs to see assigned doctor`);

            doctorsWithPharmacists.push({
              id: assignedDoctorId,
              name: doctorData.displayName || doctorData.name || doctorData.email,
              specialty: doctorData.specialization || 'General Medicine',
              gmeetLink: doctorData.meetingLink || `https://meet.google.com/${assignedDoctorId}-room`,
              status: doctorData.availabilityStatus || 'available',
              availabilityStatus: doctorData.availabilityStatus,
              pharmacists: pharmacists
            });
            console.log('Added assigned doctor for pharmacist:', assignedDoctorId);
          } else {
            console.log('Assigned doctor document does not exist:', assignedDoctorId);
          }
        }
      } else {
        console.log('Pharmacist document does not exist:', currentUser.uid);
      }
    }

    const endTime = performance.now();
    console.log(`[PERF] getDoctorsWithPharmacists completed in ${Math.round(endTime - startTime)}ms. Found ${doctorsWithPharmacists.length} doctors.`);
    
    return doctorsWithPharmacists;
  } catch (error) {
    const endTime = performance.now();
    console.error(`[PERF] Error in getDoctorsWithPharmacists after ${Math.round(endTime - startTime)}ms:`, error);
    return [];
  }
};