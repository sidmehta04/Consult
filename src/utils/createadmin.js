// src/utils/createAdmins.js
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, query, where, getDocs,updateDoc } from "firebase/firestore";
import { firestore } from "../firebase";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

/**
 * Function to create admin users directly
 * Execute this function once to set up your admin users
 */
export const createAdminUsers = async () => {
  // Create a new Firebase app instance to avoid conflicts with the main app
  const adminApp = initializeApp(firebaseConfig, "AdminCreationApp");
  const adminAuth = getAuth(adminApp);
  const adminDb = getFirestore(adminApp);
  
  // Admin user data
  const admins = [
    {
      name: "Prakash",
      email: "prakash@mswasth.com", // Change to a real email if needed
      password: "Prakash@Admin123", // Should be changed after creation
      role: "superAdmin"
    },
    {
      name: "Ashwini",
      email: "ashwini@mswasth.com", // Change to a real email if needed
      password: "Ashwini@Admin123", // Should be changed after creation
      role: "superAdmin"
    }
  ];
  
  console.log("Starting admin user creation...");
  
  try {
    for (const admin of admins) {
      console.log(`Creating admin user: ${admin.name}`);
      
      // Check if this admin already exists
      const adminQuery = query(
        collection(adminDb, 'users'),
        where('email', '==', admin.email)
      );
      
      const adminSnapshot = await getDocs(adminQuery);
      
      if (adminSnapshot.empty) {
        // Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          adminAuth,
          admin.email,
          admin.password
        );
        
        const user = userCredential.user;
        
        // Set display name
        await updateProfile(adminAuth.currentUser, {
          displayName: admin.name
        });
        
        // Store user data in Firestore
        await setDoc(doc(adminDb, 'users', user.uid), {
          name: admin.name,
          email: admin.email,
          role: admin.role,
          createdAt: new Date()
        });
        
        // Also mark as admin in a separate collection for quick access
        await setDoc(doc(adminDb, 'admins', user.uid), {
          isAdmin: true,
          createdAt: new Date()
        });
        
        console.log(`Created admin user: ${admin.name} with ID: ${user.uid}`);
      } else {
        console.log(`Admin ${admin.name} already exists, skipping creation`);
      }
      
      // Sign out after creating each user
      await adminAuth.signOut();
    }
    
    console.log("Admin user creation completed successfully!");
    return { success: true, message: "Admin users created successfully" };
    
  } catch (error) {
    console.error("Error creating admin users:", error);
    return { success: false, error: error.message };
  } finally {
    // Clean up
    try {
      adminApp.delete();
    } catch (e) {
      console.warn("Error cleaning up admin app:", e);
    }
  }
};

/**
 * Usage:
 * Import this function and call it once when setting up your application
 * 
 * Example:
 * import { createAdminUsers } from './utils/createAdmins';
 * 
 * // In an initialization function or component
 * const setupAdmins = async () => {
 *   const result = await createAdminUsers();
 *   console.log(result);
 * };
 * 
 * setupAdmins();
 */
export const fixCaseCompletionStatus = async (dryRun = false) => {
  try {
    console.log(`Starting case status correction ${dryRun ? "(DRY RUN)" : ""}`);
    
    // Find cases where doctor and pharmacist marked complete but status isn't "completed"
    const casesQuery = query(
      collection(firestore, "cases"),
      where("doctorCompleted", "==", true),
      where("pharmacistCompleted", "==", true),
      where("status", "!=", "completed")
    );
    
    const casesSnapshot = await getDocs(casesQuery);
    const casesToFix = [];
    
    // Collect cases that need fixing
    casesSnapshot.forEach(caseDoc => {
      const caseData = caseDoc.data();
      casesToFix.push({
        id: caseDoc.id,
        currentStatus: caseData.status,
        patientName: caseData.patientName || "Unknown",
        emrNumber: caseData.emrNumber || "N/A"
      });
    });
    
    console.log(`Found ${casesToFix.length} cases to fix`);
    
    // Track results
    const results = {
      fixed: 0,
      errors: 0
    };
    
    // Fix each case
    for (const caseToFix of casesToFix) {
      try {
        console.log(`Fixing case ${caseToFix.id} (${caseToFix.patientName}, EMR: ${caseToFix.emrNumber}), current status: ${caseToFix.currentStatus}`);
        
        if (!dryRun) {
          const caseRef = doc(firestore, "cases", caseToFix.id);
          await updateDoc(caseRef, {
            status: "completed"
          });
        }
        
        results.fixed++;
      } catch (error) {
        console.error(`Error fixing case ${caseToFix.id}:`, error);
        results.errors++;
      }
    }
    
    console.log(`Case status correction complete. Fixed: ${results.fixed}, Errors: ${results.errors}`);
    return results;
    
  } catch (error) {
    console.error("Error in fixCaseCompletionStatus:", error);
    return { fixed: 0, errors: 1 };
  }
};