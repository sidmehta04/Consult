import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { getDoctorsWithPharmacists, setupRoomSystemData } from './roomSystemSetup';

export const useRoomSystem = (currentUser) => {
  const [doctorsData, setDoctorsData] = useState([]);
  const [consultations, setConsultations] = useState([]); // Nurse's own consultations for active cases view
  const [allConsultations, setAllConsultations] = useState([]); // All consultations with assigned doctors for participant counts
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [currentView, setCurrentView] = useState(currentUser?.role === 'pharmacist' ? 'assigned-doctors' : 'rooms');
  const [activeRooms, setActiveRooms] = useState(new Set());
  const [participantCounts, setParticipantCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [pendingCaseData, setPendingCaseData] = useState(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [completionData, setCompletionData] = useState(null);
  const [completionType, setCompletionType] = useState(''); // 'doctor' or 'pharmacist'
  const [availabilityNotifications, setAvailabilityNotifications] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);

  // Set up real-time listeners for doctor availability changes
  useEffect(() => {
    if (!currentUser) return;

    console.log('RoomSystem: Setting up real-time listeners for user:', currentUser);
    const unsubscribers = [];

    const setupRealtimeListeners = async () => {
      try {
        setLoading(true);
        
        // First, get initial doctors data to know which doctors to listen to
        const initialDoctorsData = await getDoctorsWithPharmacists(currentUser);
        console.log('RoomSystem: Initial doctors data:', initialDoctorsData);
        setDoctorsData(initialDoctorsData);

        // Set up real-time listeners for each doctor's availability
        for (const doctor of initialDoctorsData) {
          console.log(`[REALTIME] Setting up listener for doctor: ${doctor.name} (${doctor.id})`);
          
          const doctorDocRef = doc(firestore, 'users', doctor.id);
          const unsubscribe = onSnapshot(doctorDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
              const updatedDoctorData = docSnapshot.data();
              const previousStatus = doctor.availabilityStatus;
              const newStatus = updatedDoctorData.availabilityStatus;
              
              // PERFORMANCE: Debounce rapid updates (max 1 update per second)
              const now = Date.now();
              if (now - lastUpdateTime < 1000) {
                console.log(`[REALTIME] Debouncing update for ${doctor.name}`);
                return;
              }
              setLastUpdateTime(now);
              
              console.log(`[REALTIME] Doctor ${doctor.name} availability changed:`, {
                id: doctor.id,
                previousStatus,
                newStatus,
                previousOnline: doctor.isOnline,
                newOnline: updatedDoctorData.isOnline
              });

              // Add notification if status actually changed
              if (previousStatus !== newStatus) {
                const notification = {
                  id: `${Date.now()}-${doctor.id}-${Math.random().toString(36).substr(2, 9)}`,
                  doctorName: doctor.name,
                  previousStatus,
                  newStatus,
                  timestamp: new Date()
                };
                
                setAvailabilityNotifications(prev => [...prev, notification]);
                
                // Auto-remove notification after 5 seconds
                setTimeout(() => {
                  setAvailabilityNotifications(prev => prev.filter(n => n.id !== notification.id));
                }, 5000);
                
                console.log(`[NOTIFICATION] ${doctor.name} changed from ${previousStatus || 'available'} to ${newStatus || 'available'}`);
              }

              // Update the specific doctor in the doctors array (preserve pharmacists data for performance)
              setDoctorsData(prevDoctors => {
                const updatedDoctors = prevDoctors.map(prevDoctor => {
                  if (prevDoctor.id === doctor.id) {
                    const isAvailable = updatedDoctorData.availabilityStatus === 'available';
                    return {
                      ...prevDoctor,
                      status: isAvailable ? 'available' : 'busy',
                      availabilityStatus: updatedDoctorData.availabilityStatus,
                      // Keep other fields unchanged (including pharmacists for performance)
                      name: updatedDoctorData.displayName || updatedDoctorData.name || updatedDoctorData.email,
                      specialty: updatedDoctorData.specialization || 'General Medicine',
                      // PERFORMANCE: Keep existing pharmacists data to avoid refetching
                      pharmacists: prevDoctor.pharmacists
                    };
                  }
                  return prevDoctor;
                });
                
                console.log(`[REALTIME] Updated doctors data after ${doctor.name} change (preserved pharmacists):`, updatedDoctors);
                return updatedDoctors;
              });
            }
          }, (error) => {
            console.error(`[REALTIME] Error listening to doctor ${doctor.id}:`, error);
          });

          unsubscribers.push(unsubscribe);
        }

      } catch (error) {
        console.error('Error setting up real-time listeners:', error);
      } finally {
        setLoading(false);
      }
    };

    setupRealtimeListeners();

    // Cleanup function to unsubscribe from all listeners
    return () => {
      console.log('[REALTIME] Cleaning up doctor availability listeners');
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [currentUser]);

  // Fetch consultations for participant counts (all consultations with assigned doctors)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'nurse') return;
    
    // Wait until doctors are loaded before setting up consultation listener
    if (doctorsData.length === 0) {
      console.log('[ALL CONSULTATIONS DEBUG] Waiting for doctors to load');
      return;
    }

    console.log('[ALL CONSULTATIONS DEBUG] Setting up query for participant counts');
    console.log('[ALL CONSULTATIONS DEBUG] Nurse assigned doctors:', doctorsData.map(d => ({id: d.id, name: d.name})));
    
    const allConsultationsQuery = query(collection(firestore, 'consultations'));
    
    const unsubscribe = onSnapshot(allConsultationsQuery, (snapshot) => {
      console.log('[ALL CONSULTATIONS DEBUG] Firestore snapshot received, docs count:', snapshot.docs.length);
      
      const consultationsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate() || new Date()
        };
      });
      
      // Get assigned doctor IDs
      const assignedDoctorIds = doctorsData.map(doctor => doctor.id);
      
      // Filter for consultations involving the nurse's assigned doctors
      const relevantConsultations = consultationsData.filter(consultation => {
        const isRelevantStatus = consultation.status === 'pending' || consultation.status === 'doctor_complete';
        if (!isRelevantStatus) return false;
        
        const consultationDoctorIds = consultation.selectedDoctors || [];
        const hasAssignedDoctor = consultationDoctorIds.some(doctorId => 
          assignedDoctorIds.includes(doctorId)
        );
        
        return hasAssignedDoctor;
      });
      
      console.log('[ALL CONSULTATIONS DEBUG] Found consultations with assigned doctors:', relevantConsultations.length);
      setAllConsultations(relevantConsultations);
      
      // Update active rooms based on all consultations with assigned doctors
      const activeRoomSet = new Set();
      relevantConsultations.filter(c => c.status === 'pending').forEach(consultation => {
        consultation.selectedDoctors?.forEach(doctorId => {
          if (assignedDoctorIds.includes(doctorId)) {
            activeRoomSet.add(doctorId);
          }
        });
      });
      setActiveRooms(activeRoomSet);
    }, (error) => {
      console.error('[ALL CONSULTATIONS DEBUG] Firestore error:', error);
    });

    return () => unsubscribe();
  }, [currentUser, doctorsData.length]);

  // Fetch nurse's own consultations for active cases view
  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe;
    
    if (currentUser.role === 'nurse') {
      console.log('[OWN CONSULTATIONS DEBUG] Setting up query for nurse\'s own consultations');
      
      const ownConsultationsQuery = query(
        collection(firestore, 'consultations'),
        where('createdBy', '==', currentUser.uid)
      );
      
      unsubscribe = onSnapshot(ownConsultationsQuery, (snapshot) => {
        const consultationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startTime: doc.data().startTime?.toDate() || new Date()
        }));
        
        // Filter for pending and doctor_complete consultations only
        const relevantConsultations = consultationsData.filter(c => 
          c.status === 'pending' || c.status === 'doctor_complete'
        );
        
        console.log('[OWN CONSULTATIONS DEBUG] Found own consultations:', relevantConsultations.length);
        setConsultations(relevantConsultations);
      }, (error) => {
        console.error('[OWN CONSULTATIONS DEBUG] Firestore error:', error);
      });
    } else if (currentUser.role === 'doctor') {
      const consultationsQuery = query(
        collection(firestore, 'consultations'),
        where('selectedDoctors', 'array-contains', currentUser.uid)
      );
      
      unsubscribe = onSnapshot(consultationsQuery, (snapshot) => {
        const consultationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startTime: doc.data().startTime?.toDate() || new Date()
        }));
        
        // Filter for pending and doctor_complete consultations only (exclude incomplete cases)
        const relevantConsultations = consultationsData.filter(c => 
          c.status === 'pending' || c.status === 'doctor_complete'
        );
        
        setConsultations(relevantConsultations);
        
        // Update active rooms (only for pending consultations)
        const activeRoomSet = new Set();
        relevantConsultations.filter(c => c.status === 'pending').forEach(consultation => {
          consultation.selectedDoctors?.forEach(doctorId => {
            activeRoomSet.add(doctorId);
          });
        });
        setActiveRooms(activeRoomSet);
      });
    } else if (currentUser.role === 'pharmacist') {
      // Pharmacists don't need to track consultations - they just join doctor rooms when needed
      return;
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, doctorsData.length]); // Use doctorsData.length to avoid infinite loops

  // Calculate participant counts based on ALL consultations with assigned doctors
  const updateParticipantCounts = () => {
    const counts = {};
    
    console.log('[PARTICIPANT DEBUG] Updating participant counts...');
    console.log('[PARTICIPANT DEBUG] doctorsData:', doctorsData.length, 'doctors');
    console.log('[PARTICIPANT DEBUG] allConsultations:', allConsultations.length, 'consultations (from all nurses)');
    console.log('[PARTICIPANT DEBUG] ownConsultations:', consultations.length, 'consultations (own only)');
    
    // Count active consultations (pending status) for each doctor using allConsultations
    doctorsData.forEach(doctor => {
      const doctorId = doctor.id;
      const activeConsultationsForDoctor = allConsultations.filter(consultation => {
        // Only count consultations that are still pending (not completed)
        const isPending = consultation.status === 'pending';
        const includesDoctor = consultation.selectedDoctors?.includes(doctorId);
        
        if (isPending && includesDoctor) {
          console.log(`[PARTICIPANT DEBUG] Doctor ${doctor.name} has active consultation:`, {
            patientName: consultation.patientName,
            status: consultation.status,
            selectedDoctors: consultation.selectedDoctors,
            createdBy: consultation.createdBy
          });
        }
        
        return isPending && includesDoctor;
      });
      
      counts[doctorId] = activeConsultationsForDoctor.length;
      console.log(`[PARTICIPANT DEBUG] Doctor ${doctor.name} (${doctorId}): ${activeConsultationsForDoctor.length} active cases`);
    });
    
    console.log('[PARTICIPANT DEBUG] Final counts:', counts);
    setParticipantCounts(counts);
  };

  // Update participant counts whenever allConsultations or doctors data changes
  useEffect(() => {
    if (allConsultations.length > 0 || doctorsData.length > 0) {
      updateParticipantCounts();
    }
  }, [allConsultations, doctorsData]);

  // Auto-deselect doctors ONLY when they become unavailable AND only on doctor selection view
  // Preserve selected doctors across all other views for completion workflow
  useEffect(() => {
    if (selectedDoctors.length > 0 && doctorsData.length > 0 && currentView === 'rooms') {
      // Only check availability status for doctors who are truly unavailable
      const unavailableDoctorIds = doctorsData
        .filter(doctor => doctor.availabilityStatus !== 'available')
        .map(doctor => doctor.id);
      
      const newSelectedDoctors = selectedDoctors.filter(doctorId => 
        !unavailableDoctorIds.includes(doctorId)
      );
      
      if (newSelectedDoctors.length !== selectedDoctors.length) {
        const removedDoctors = selectedDoctors.filter(doctorId => 
          unavailableDoctorIds.includes(doctorId)
        );
        const removedDoctorNames = removedDoctors
          .map(doctorId => {
            const doctor = doctorsData.find(d => d.id === doctorId);
            return doctor ? `${doctor.name} (${doctor.availabilityStatus})` : null;
          })
          .filter(Boolean)
          .join(', ');
        
        console.log(`[AUTO-DESELECT] Auto-deselecting truly unavailable doctors: ${removedDoctorNames}`);
        setSelectedDoctors(newSelectedDoctors);
        
        if (removedDoctorNames) {
          console.warn(`Doctors automatically deselected due to unavailability: ${removedDoctorNames}`);
        }
      }
    }
    // Note: No auto-deselection on other views - preserve selected doctors for completion workflow
  }, [doctorsData, selectedDoctors, currentView, setSelectedDoctors]);

  // Temporary setup function for debugging
  const handleSetupRoomData = async () => {
    try {
      console.log('Setting up room system data...');
      const result = await setupRoomSystemData();
      console.log('Setup result:', result);
      if (result.success) {
        alert('Room system data setup completed! Please refresh to see changes.');
        // Refresh doctors data
        const doctorsWithPharmacists = await getDoctorsWithPharmacists(currentUser);
        console.log('Refreshed doctors data after setup:', doctorsWithPharmacists);
        setDoctorsData(doctorsWithPharmacists);
      } else {
        alert('Setup failed: ' + result.error);
      }
    } catch (error) {
      console.error('Setup error:', error);
      alert('Setup error: ' + error.message);
    }
  };

  return {
    // State
    doctorsData,
    consultations,
    selectedDoctors,
    currentView,
    activeRooms,
    participantCounts,
    loading,
    showCaseForm,
    pendingCaseData,
    showCompletionDialog,
    completionData,
    completionType,
    availabilityNotifications,
    
    // Setters
    setSelectedDoctors,
    setCurrentView,
    setShowCaseForm,
    setPendingCaseData,
    setShowCompletionDialog,
    setCompletionData,
    setCompletionType,
    
    // Functions
    handleSetupRoomData
  };
};

export const useRoomSystemActions = (currentUser, setters, state) => {
  const {
    setSelectedDoctors,
    setShowCaseForm,
    setPendingCaseData,
    setCurrentView,
    setShowCompletionDialog,
    setCompletionData,
    setCompletionType
  } = setters;

  const handleDoctorSelection = (doctorId) => {
    const doctor = state.doctorsData.find(d => d.id === doctorId);
    
    // In room system, only check if doctor is available (allow multiple patients per doctor)
    const isAvailable = doctor && doctor.availabilityStatus === 'available';
    
    if (!isAvailable) {
      alert(`Cannot select ${doctor.name}. Doctor is currently ${doctor.availabilityStatus || 'unavailable'}.`);
      return;
    }
    
    setSelectedDoctors(prev => 
      prev.includes(doctorId) 
        ? prev.filter(id => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  const proceedToCaseForm = () => {
    if (state.selectedDoctors.length === 0) {
      alert('Please select at least one doctor');
      return;
    }
    
    // In room system, only validate that selected doctors are available (allow multiple patients per doctor)
    const selectedDoctorObjects = state.selectedDoctors.map(doctorId => 
      state.doctorsData.find(d => d.id === doctorId)
    ).filter(Boolean);
    
    const unavailableDoctors = selectedDoctorObjects.filter(doctor => 
      doctor.availabilityStatus !== 'available'
    );
    
    if (unavailableDoctors.length > 0) {
      const doctorNames = unavailableDoctors.map(d => d.name).join(', ');
      alert(`Cannot proceed: Selected doctor(s) are currently unavailable: ${doctorNames}`);
      return;
    }
    
    setShowCaseForm(true);
  };

  const handleCaseSubmit = async (caseData) => {
    try {
      // Switch to pending case view FIRST to prevent auto-deselection
      setCurrentView('pending-case');
      setShowCaseForm(false);
      
      const createdCases = [];
      
      // Create separate consultation for each patient
      for (const patient of caseData.patients) {
        // Get doctor names for the selected doctors
        const selectedDoctorsWithNames = caseData.selectedDoctors.map(doctorId => {
          const doctor = state.doctorsData.find(d => d.id === doctorId);
          return {
            id: doctorId,
            name: doctor ? doctor.name : 'Unknown Doctor'
          };
        });

        const activeRoomsWithNames = state.selectedDoctors.map(doctorId => {
          const doctor = state.doctorsData.find(d => d.id === doctorId);
          return {
            id: doctorId,
            name: doctor ? doctor.name : 'Unknown Doctor'
          };
        });

        const consultation = {
          patientName: patient.patientName,
          emrNumber: patient.emrNumber,
          chiefComplaint: patient.chiefComplaint,
          consultationType: caseData.consultationType,
          selectedDoctors: caseData.selectedDoctors, // Keep original array for backward compatibility
          selectedDoctorsWithNames: selectedDoctorsWithNames, // New field with names
          status: 'pending',
          startTime: serverTimestamp(),
          activeRooms: [...state.selectedDoctors], // Keep original array for backward compatibility  
          activeRoomsWithNames: activeRoomsWithNames, // New field with names
          createdBy: currentUser.uid,
          createdByName: currentUser.displayName || currentUser.name || currentUser.email, // Add creator name
          createdAt: serverTimestamp(),
          clinicCode: currentUser.clinicCode
        };
        
        const docRef = await addDoc(collection(firestore, 'consultations'), consultation);
        createdCases.push({
          id: docRef.id,
          ...consultation,
          startTime: new Date()
        });
      }
      
      console.log('Created consultations:', createdCases);
      
      // Store the case data for the pending view
      setPendingCaseData({
        ...caseData,
        createdCases,
        selectedDoctors: state.selectedDoctors
      });
      
    } catch (error) {
      console.error('Error creating consultation:', error);
      alert('Failed to create consultation. Please try again.');
      // Revert view on error
      setCurrentView('rooms');
      setShowCaseForm(true);
    }
  };

  const handleCaseFormCancel = () => {
    setShowCaseForm(false);
  };

  const joinRoom = (doctorId) => {
    const doctor = state.doctorsData.find(d => d.id === doctorId);
    
    if (!doctor) {
      alert('Doctor not found. Please refresh the page and try again.');
      return;
    }
    
    // Check if doctor is available before allowing room access
    const isAvailable = doctor.availabilityStatus === 'available';
    
    if (!isAvailable) {
      const statusMessage = doctor.availabilityStatus || 'unavailable';
      alert(`Cannot join ${doctor.name}'s room. Doctor is currently ${statusMessage}. Please wait for the doctor to become available or contact them directly.`);
      return;
    }
    
    // Check if doctor has a meeting link
    if (!doctor.gmeetLink) {
      alert(`${doctor.name}'s meeting room is not set up. Please contact the doctor or system administrator.`);
      return;
    }
    
    console.log(`[ROOM ACCESS] Joining ${doctor.name}'s room - Status: ${doctor.availabilityStatus}`);
    window.open(doctor.gmeetLink, '_blank');
  };

  const handleDoctorCompletion = (consultationId, doctorId, isComplete) => {
    setCompletionData({ consultationId, doctorId, isComplete });
    setCompletionType('doctor');
    setShowCompletionDialog(true);
  };

  const completeConsultation = async (consultationId, completedByDoctorId, isComplete) => {
    try {
      // Get doctor name for the completion
      const completingDoctor = state.doctorsData.find(d => d.id === completedByDoctorId);
      const doctorName = completingDoctor ? completingDoctor.name : 'Unknown Doctor';

      const updateData = {
        completedBy: completedByDoctorId,
        completedByName: doctorName, // Add doctor name
        doctorCompletedAt: serverTimestamp()
      };

      if (isComplete) {
        updateData.status = 'doctor_complete';
      } else {
        updateData.status = 'incomplete';
      }

      await updateDoc(doc(firestore, 'consultations', consultationId), updateData);
    } catch (error) {
      console.error('Error completing consultation:', error);
      alert('Failed to complete consultation. Please try again.');
    }
  };

  const handlePharmacistCompletion = (consultationId, pharmacistId, pharmacistName, isComplete) => {
    setCompletionData({ consultationId, pharmacistId, pharmacistName, isComplete });
    setCompletionType('pharmacist');
    setShowCompletionDialog(true);
  };

  const completePharmacistTask = async (consultationId, pharmacistId, pharmacistName, isComplete) => {
    try {
      const updateData = {
        pharmacistCompletedBy: pharmacistId,
        pharmacistCompletedByName: pharmacistName,
        pharmacistCompletedAt: serverTimestamp()
      };

      if (isComplete) {
        updateData.status = 'case_completed';
      } else {
        updateData.status = 'case_incomplete';
      }

      await updateDoc(doc(firestore, 'consultations', consultationId), updateData);
    } catch (error) {
      console.error('Error completing pharmacist task:', error);
      alert('Failed to complete pharmacist task. Please try again.');
    }
  };

  return {
    handleDoctorSelection,
    proceedToCaseForm,
    handleCaseSubmit,
    handleCaseFormCancel,
    joinRoom,
    handleDoctorCompletion,
    completeConsultation,
    handlePharmacistCompletion,
    completePharmacistTask
  };
};