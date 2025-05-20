import { useState, useEffect } from "react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { firestore } from "../../firebase";

// Firebase secondary app config

// Your web app's Firebase configuration
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const useUserCreation = (currentUserRole, currentUser) => {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    idCode: "",
    password: "",
    partnerName: "", // Added partner name
    state: "",
    district: "",
    address: "",
    pincode: "",
    clinicMobileNo: "",
    supervisorName: "",
    supervisorId: "",
    additionalInfo: "",
  });

  // UI state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [availableClinics, setAvailableClinics] = useState([]);
  const [availablePharmacists, setAvailablePharmacists] = useState([]);
  const [needsToCreatePharmacistFirst, setNeedsToCreatePharmacistFirst] = useState(false);

  // Initialize secondary Firebase app 
  const secondaryApp = initializeApp(FIREBASE_CONFIG, "Secondary");
  const secondaryAuth = getAuth(secondaryApp);
  const secondaryDb = getFirestore(secondaryApp);

  // Role hierarchy definition
  const getRoleToCreate = (currentRole) => {
    const roleHierarchy = {
      // First hierarchy
      superAdmin: ["zonalHead", "teamLeader"],
      zonalHead: "drManager",
      drManager: "doctor",

      // Second hierarchy
      teamLeader: "ro",
      ro: "pharmacist", // RO creates pharmacists
      pharmacist: "nurse", // Pharmacists create clinics/nurses
    };

    return roleHierarchy[currentRole];
  };

  const roleToCreate = getRoleToCreate(currentUserRole);

  // Role selection state
  const [selectedRoleToCreate, setSelectedRoleToCreate] = useState(
    Array.isArray(roleToCreate) ? roleToCreate[0] : roleToCreate
  );

  // Role type flags
  const isCreatingClinic = selectedRoleToCreate === "nurse";
  const isCreatingDoctor = selectedRoleToCreate === "doctor";
  const isCreatingPharmacist = selectedRoleToCreate === "pharmacist";
  const isCreatingAgent = selectedRoleToCreate === "ro";

  // Fetch supporting data (supervisor info, clinics, available pharmacists)
  useEffect(() => {
    // Fetch supervisor info for reporting relationship
    const fetchSupervisorInfo = async () => {
      if (currentUser?.uid) {
        try {
          const creatorRef = doc(firestore, "users", currentUser.uid);
          const creatorSnapshot = await getDoc(creatorRef);

          if (creatorSnapshot.exists()) {
            const creatorData = creatorSnapshot.data();
            setFormData((prev) => ({
              ...prev,
              supervisorName: creatorData.name,
              supervisorId: currentUser.uid,
            }));
          }
        } catch (error) {
          console.error("Error fetching supervisor info:", error);
        }
      }
    };

    // Fetch available clinics
    const fetchClinics = async () => {
      if (currentUserRole === "pharmacist") {
        try {
          const clinicsQuery = query(
            collection(firestore, "users"),
            where("role", "==", "nurse"),
            where("createdBy", "==", currentUser.uid)
          );

          const clinicsSnapshot = await getDocs(clinicsQuery);

          if (!clinicsSnapshot.empty) {
            const clinicsData = [];
            clinicsSnapshot.forEach((doc) => {
              clinicsData.push({
                id: doc.id,
                ...doc.data(),
              });
            });
            setAvailableClinics(clinicsData);
          }
        } catch (error) {
          console.error("Error fetching clinics:", error);
        }
      }
    };

    // Fetch available pharmacists (for checking if pharmacist creation is needed)
    const fetchPharmacists = async () => {
      if (currentUserRole === "agent" && isCreatingClinic) {
        try {
          const pharmacistsQuery = query(
            collection(firestore, "users"),
            where("role", "==", "pharmacist"),
            where("createdBy", "==", currentUser.uid)
          );

          const pharmacistsSnapshot = await getDocs(pharmacistsQuery);
          
          if (pharmacistsSnapshot.empty) {
            setNeedsToCreatePharmacistFirst(true);
          } else {
            setNeedsToCreatePharmacistFirst(false);
            const pharmacistsData = [];
            pharmacistsSnapshot.forEach((doc) => {
              pharmacistsData.push({
                id: doc.id,
                ...doc.data(),
              });
            });
            setAvailablePharmacists(pharmacistsData);
          }
        } catch (error) {
          console.error("Error fetching pharmacists:", error);
        }
      }
    };

    fetchSupervisorInfo();
    fetchClinics();
    fetchPharmacists();
  }, [currentUser?.uid, currentUserRole, selectedRoleToCreate, success]);

  // Auto-generate password from name and ID code
  useEffect(() => {
    if (formData.name && formData.idCode) {
      const cleanName = formData.name.toLowerCase().replace(/[^a-z]/g, "");
      const firstPart = cleanName.slice(0, 3);
      const secondPart = formData.idCode.slice(-3);
      setFormData((prev) => ({
        ...prev,
        password: `${firstPart}${secondPart}`,
      }));
    }
  }, [formData.name, formData.idCode]);

  // Form validation
  const validateForm = () => {
    // Basic required fields for all roles
    if (!formData.name.trim()) return "Name is required";
    if (!formData.email.trim()) return "Email is required";
    if (!formData.idCode.trim())
      return (isCreatingClinic ? "Clinic Code" : "Employee ID") + " is required";
    if (!formData.password.trim()) return "Password is required";
    if (!formData.partnerName) return "Partner name is required"; // Validate partner name

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email))
      return "Please enter a valid email address";

    // Additional validation for clinics
    if (isCreatingClinic) {
      if (!formData.state.trim()) return "State is required";
      if (!formData.district.trim()) return "District is required";
      if (!formData.address.trim()) return "Address is required";

      // Validate pincode (6 digits)
      if (!formData.pincode.trim()) return "Pincode is required";
      if (!/^\d{6}$/.test(formData.pincode)) return "Pincode must be 6 digits";

      // Validate mobile number (10 digits)
      if (!formData.clinicMobileNo.trim())
        return "Clinic Mobile Number is required";
      if (!/^\d{10}$/.test(formData.clinicMobileNo))
        return "Mobile Number must be 10 digits";
    }

    return null; // No errors
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email,
        formData.password
      );

      const newUser = userCredential.user;

      // Update display name
      await updateProfile(secondaryAuth.currentUser, {
        displayName: formData.name,
      });

      // Prepare base user data
      const effectiveRoleToCreate = Array.isArray(roleToCreate)
        ? selectedRoleToCreate
        : roleToCreate;

      const userData = {
        name: formData.name,
        email: formData.email,
        [effectiveRoleToCreate === "nurse" ? "clinicCode" : "empId"]: formData.idCode,
        role: effectiveRoleToCreate,
        partnerName: formData.partnerName, // Add partner name to user data
        createdBy: currentUser.uid,
        createdAt: new Date(),
        reportingTo: currentUser.uid,
        reportingToName: formData.supervisorName,
      };

      // Add role-specific data
      if (effectiveRoleToCreate === "nurse") {
        Object.assign(userData, {
          state: formData.state,
          district: formData.district,
          address: formData.address,
          pincode: formData.pincode,
          clinicMobileNo: formData.clinicMobileNo,
        });
        
        // If pharmacist is creating clinic, check for doctor hierarchy
        if (currentUserRole === "pharmacist") {
          const pharmacistRef = doc(secondaryDb, "users", currentUser.uid);
          const pharmacistSnapshot = await getDoc(pharmacistRef);
          
          if (pharmacistSnapshot.exists()) {
            const pharmacistData = pharmacistSnapshot.data();
            
            // Apply doctor hierarchy if available
            if (pharmacistData.doctorHierarchy && Array.isArray(pharmacistData.doctorHierarchy) && pharmacistData.doctorHierarchy.length > 0) {
              // Create doctor assignments based on hierarchy
              const doctorAssignments = {};
              
              await Promise.all(pharmacistData.doctorHierarchy.map(async (doctorId, index) => {
                const doctorRef = doc(secondaryDb, "users", doctorId);
                const doctorSnap = await getDoc(doctorRef);
                
                if (doctorSnap.exists()) {
                  const position = index + 1;
                  const positionName = getPositionName(position).toLowerCase();
                  
                  doctorAssignments[positionName] = doctorId;
                  doctorAssignments[`${positionName}Name`] = doctorSnap.data().name;
                }
              }));
              
              userData.assignedDoctors = doctorAssignments;
            }
          }
        }
      }

      // Handle role-specific initializations
      if (effectiveRoleToCreate === "pharmacist" && currentUserRole === "ro") {
        // When RO creates pharmacist - initialize doctor hierarchy and clinics
        userData.doctorHierarchy = [];
        userData.assignedClinics = {};
      } else if (effectiveRoleToCreate === "doctor") {
        // Doctors start with no assigned clinics - they'll be assigned by pharmacists
        userData.assignedClinics = {};
      }

      // Save user data to Firestore
      await setDoc(doc(secondaryDb, "users", newUser.uid), userData);

      // Sign out from secondary app
      await secondaryAuth.signOut();

      // Reset form
      setFormData({
        name: "",
        email: "",
        idCode: "",
        password: "",
        partnerName: "", // Reset partner name
        state: "",
        district: "",
        address: "",
        pincode: "",
        clinicMobileNo: "",
        supervisorName: formData.supervisorName,
        supervisorId: formData.supervisorId,
        additionalInfo: "",
      });

      setSuccess(
        `Successfully created ${effectiveRoleToCreate} account for ${userData.name}`
      );

      // Handle post-creation assignments
      await handlePostCreationAssignments(newUser.uid, userData, effectiveRoleToCreate);
      
    } catch (error) {
      console.error("Error creating user:", error);
      setError(error.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  // Get position name based on index for doctor hierarchy
  const getPositionName = (position) => {
    const positions = ["Primary", "Secondary", "Tertiary", "Quaternary", "Quinary"];
    return positions[position - 1] || `${position}${getOrdinalSuffix(position)}`;
  };
  
  // Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    
    if (j === 1 && k !== 11) {
      return "st";
    }
    if (j === 2 && k !== 12) {
      return "nd";
    }
    if (j === 3 && k !== 13) {
      return "rd";
    }
    return "th";
  };

  // Handle post-creation assignments and notifications
  const handlePostCreationAssignments = async (newUserId, userData, roleCreated) => {
    if (currentUserRole === "pharmacist" && roleCreated === "nurse") {
      // After clinic is created by pharmacist, auto-assign to the pharmacist
      try {
        const pharmacistRef = doc(firestore, "users", currentUser.uid);
        const pharmacistSnapshot = await getDoc(pharmacistRef);

        if (pharmacistSnapshot.exists()) {
          const pharmacistData = pharmacistSnapshot.data();
          const updatedClinics = {
            ...(pharmacistData.assignedClinics || {}),
            [newUserId]: true,
          };

          // Update pharmacist's assignedClinics
          await setDoc(
            pharmacistRef,
            { assignedClinics: updatedClinics },
            { merge: true }
          );

          // Also update doctors assigned to this clinic
          if (pharmacistData.doctorHierarchy && Array.isArray(pharmacistData.doctorHierarchy)) {
            for (const doctorId of pharmacistData.doctorHierarchy) {
              const doctorRef = doc(firestore, "users", doctorId);
              const doctorSnapshot = await getDoc(doctorRef);
              
              if (doctorSnapshot.exists()) {
                const doctorData = doctorSnapshot.data();
                const updatedDoctorClinics = {
                  ...(doctorData.assignedClinics || {}),
                  [newUserId]: true,
                };
                
                // Update doctor's assignedClinics
                await setDoc(
                  doctorRef,
                  { assignedClinics: updatedDoctorClinics },
                  { merge: true }
                );
              }
            }

            setSuccess(
              `Successfully created clinic "${userData.name}" and assigned to you and your doctor hierarchy.`
            );
          } else {
            setSuccess(
              `Successfully created clinic "${userData.name}" and assigned to you.`
            );
          }
        }
      } catch (error) {
        console.error("Error assigning clinic:", error);
      }
    }
  };

  return {
    formData,
    setFormData,
    error,
    success,
    loading,
    handleSubmit,
    selectedRoleToCreate,
    setSelectedRoleToCreate,
    roleToCreate,
    isCreatingPharmacist,
    isCreatingClinic,
    isCreatingDoctor,
    isCreatingAgent,
    availableClinics,
    availablePharmacists,
    needsToCreatePharmacistFirst,
  };
};