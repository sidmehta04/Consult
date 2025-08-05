import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../firebase";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle,
  User
} from "lucide-react";


const CaseManagementModule = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [error, setError] = useState("");
  
  useEffect(() => {
    const fetchUserRole = async () => {
      if (currentUser) {
        try {
          // Get user role from Firestore
          const userRef = doc(firestore, "users", currentUser.uid);
          const snapshot = await getDoc(userRef);
          
          if (snapshot.exists()) {
            const userData = snapshot.data();
            setUserRole(userData.role);
          } else {
            setError("User data not found. Please contact support.");
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
          setError("Failed to load user data. Please try again later.");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    fetchUserRole();
  }, [currentUser]);
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  if (!currentUser) {
    return (
      <Alert className="max-w-2xl mx-auto my-8 bg-blue-50 text-blue-800 border-blue-200">
        <AlertDescription>Please log in to access this page</AlertDescription>
      </Alert>
    );
  }
  
  
  // For management roles, redirect to appropriate dashboards instead of showing the tabs
  const isManagementRole = ['drManager', 'ro', 'teamLeader', 'zonalHead', 'superAdmin'].includes(userRole);
  
  if (isManagementRole) {
    return (
      <Alert className="max-w-2xl mx-auto my-8 bg-blue-50 text-blue-800 border-blue-200">
        <User className="h-4 w-4 mr-2" />
        <AlertDescription>
          Management users should use the management dashboard instead of direct case management.
          Please contact your system administrator if you need access to case-level details.
        </AlertDescription>
      </Alert>
    );
  }
  
  // All regular users now use Room System instead of Case Management
  return (
    <Alert className="max-w-2xl mx-auto my-8 bg-blue-50 text-blue-800 border-blue-200">
      <AlertCircle className="h-4 w-4 mr-2" />
      <AlertDescription>
        Case Management has been replaced by the Room System. All nurses, doctors, and pharmacists 
        should now use the Room System from the main navigation for consultation management.
      </AlertDescription>
    </Alert>
  );
};

export default CaseManagementModule;