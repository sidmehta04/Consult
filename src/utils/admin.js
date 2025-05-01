// src/utils/initializeAdmins.js
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, getDocs, query, where } from "firebase/firestore";

/**
 * Creates top admin accounts if they don't already exist
 */
export const initializeTopAdmins = async () => {
  try {
    // Initialize a secondary app for creating users
    const secondaryApp = initializeApp({
      apiKey: "AIzaSyAaYqE22EemaN6YGu7DbkidyV-Rh-X3JjA",
      authDomain: "consultations-fa042.firebaseapp.com",
      projectId: "consultations-fa042",
      storageBucket: "consultations-fa042.firebasestorage.app",
      messagingSenderId: "790687866611",
      appId: "1:790687866611:web:1ca05cecdf493a4a7ae186"
    }, "SecondaryApp");
    
    const secondaryAuth = getAuth(secondaryApp);
    const secondaryDb = getFirestore(secondaryApp);
    
    // Check if admins already exist
    const adminsQuery = query(
      collection(secondaryDb, 'users'),
      where('role', '==', 'superAdmin')
    );
    
    const adminsSnapshot = await getDocs(adminsQuery);
    
    if (!adminsSnapshot.empty && adminsSnapshot.size >= 2) {
      console.log("Top admins already exist");
      return { success: true, message: "Top admins already exist" };
    }
    
    // Admin data
    const admins = [
      {
        name: "Prakash",
        email: "prakash.admin@consultapp.com",
        password: "Prakash@123",
      },
      {
        name: "Ashwini",
        email: "ashwini.admin@consultapp.com",
        password: "Ashwini@123",
      }
    ];
    
    // Create each admin
    for (const admin of admins) {
      // Check if this specific admin already exists
      const adminQuery = query(
        collection(secondaryDb, 'users'),
        where('email', '==', admin.email)
      );
      
      const adminSnapshot = await getDocs(adminQuery);
      
      if (adminSnapshot.empty) {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          admin.email, 
          admin.password
        );
        
        const user = userCredential.user;
        
        // Update display name
        await updateProfile(secondaryAuth.currentUser, {
          displayName: admin.name
        });
        
        // Store in Firestore
        await setDoc(doc(secondaryDb, 'users', user.uid), {
          name: admin.name,
          email: admin.email,
          role: "superAdmin",
          createdAt: new Date()
        });
        
        // Add to admins collection
        await setDoc(doc(secondaryDb, 'admins', user.uid), {
          isAdmin: true,
          createdAt: new Date()
        });
        
        console.log(`Created admin: ${admin.name}`);
      }
      
      // Sign out from secondary app
      await secondaryAuth.signOut();
    }
    
    // Clean up secondary app
    secondaryApp.delete();
    
    return { success: true, message: "Top admins created successfully" };
    
  } catch (error) {
    console.error("Error creating top admins:", error);
    return { success: false, message: error.message };
  }
};