import React, { useState, useEffect, Suspense } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../firebase";

// Fix dynamic imports with correct path references
const NurseCaseManagement = React.lazy(() => import("./cases/NurseCaseManagement"));
const DoctorCaseManagement = React.lazy(() => import("./cases/DocManagement"));
const PharmacistCaseManagement = React.lazy(() => import("./cases/Pharmasist"));

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ClipboardList, 
  Stethoscope, 
  Pill, 
  AlertCircle,
  User
} from "lucide-react";

const LoadingSpinner = () => (
  <div className="flex justify-center items-center min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

const ComponentNotFound = ({ componentName }) => (
  <Card className="border border-amber-200 shadow-md">
    <CardHeader className="bg-amber-50 pb-4">
      <CardTitle className="flex items-center text-amber-700">
        <AlertCircle className="h-5 w-5 mr-2 text-amber-500" />
        Component Not Available
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-6 pb-6">
      <div className="text-center space-y-4">
        <p className="text-gray-700">
          The {componentName} component could not be loaded. This might be due to:
        </p>
        <ul className="list-disc list-inside text-left max-w-md mx-auto text-gray-600 space-y-2">
          <li>File path configuration issues</li>
          <li>Component naming mismatches</li>
          <li>Component not yet implemented</li>
        </ul>
        <p className="text-blue-600 font-medium pt-2">
          Please contact the development team for assistance.
        </p>
      </div>
    </CardContent>
  </Card>
);

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
  
  // Simplified access check - only allow nurse, doctor, and pharmacist roles
  const canAccessCaseManagement = ['nurse', 'doctor', 'pharmacist'].includes(userRole);
  
  // For management roles, redirect to appropriate dashboards instead of showing the tabs
  const isManagementRole = ['drManager', 'ro', 'teamLeader', 'zonalHead', 'superAdmin'].includes(userRole);
  
  if (!canAccessCaseManagement && !isManagementRole) {
    return (
      <Alert className="max-w-2xl mx-auto my-8 bg-amber-50 text-amber-800 border-amber-200">
        <AlertCircle className="h-4 w-4 mr-2" />
        <AlertDescription>You don't have permission to access case management</AlertDescription>
      </Alert>
    );
  }
  
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
  
  return (
    <div className="p-4">
      
      
      {/* Render specific component based on user role */}
      {userRole === 'nurse' && (
        <Suspense fallback={<LoadingSpinner />}>
          <NurseCaseManagement currentUser={currentUser} />
        </Suspense>
      )}
      
      {userRole === 'doctor' && (
        <Suspense fallback={<LoadingSpinner />}>
          <DoctorCaseManagement currentUser={currentUser} />
        </Suspense>
      )}
      
      {userRole === 'pharmacist' && (
        <Suspense fallback={<LoadingSpinner />}>
          <PharmacistCaseManagement currentUser={currentUser} />
        </Suspense>
      )}
    </div>
  );
};

export default CaseManagementModule;