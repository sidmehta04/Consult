import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import UserCreationForm from './creation/CreateUser';
import DoctorHierarchyManagement from './creation/DocHierarchy';
import PharmacistHierarchyManagement from './creation/PharmacistHierarchy';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import ClinicHierarchyManagement from './creation/HierarchyManage';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Users, Stethoscope, Pill, Hospital } from 'lucide-react';

const UserCreationTab = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  
  useEffect(() => {
    const auth = getAuth();
    
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        
        try {
          // Get user role from Firestore
          const userRef = doc(firestore, 'users', user.uid);
          const snapshot = await getDoc(userRef);
          
          if (snapshot.exists()) {
            const userData = snapshot.data();
            setUserRole(userData.role);
          } else {
            setError('User data not found');
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Failed to load user data');
        } finally {
          setLoading(false);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        setUserRole('');
        setLoading(false);
      }
    });
    
    // Cleanup subscription
    return () => unsubscribe();
  }, []);
  
  if (loading) {
    return <div className="flex justify-center items-center min-h-[400px]">Loading...</div>;
  }
  
  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  if (!currentUser) {
    return (
      <Alert className="max-w-2xl mx-auto my-8">
        <AlertDescription>Please log in to access this page</AlertDescription>
      </Alert>
    );
  }
  
  // Only certain roles can create users
  const canCreateUsers = [
    'superAdmin', 
    'zonalHead', 
    'teamLeader', 
    'drManager', 
    'ro',
    'pharmacist'
  ].includes(userRole);
  
  if (!canCreateUsers) {
    return (
      <Alert className="max-w-2xl mx-auto my-8">
        <AlertDescription>You don't have permission to create users</AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center space-x-2 mb-6">
        <UserPlus className="h-6 w-6 text-blue-500" />
        <h1 className="text-2xl font-bold">User Management</h1>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="create">
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </TabsTrigger>
          
          {/* Show doctor hierarchy management tab for pharmacists */}
          {userRole === 'pharmacist' && (
            <TabsTrigger value="doctorHierarchy">
              <Stethoscope className="h-4 w-4 mr-2" />
              Doctor Hierarchy
            </TabsTrigger>
          )}
          
          {/* Show pharmacist hierarchy management tab for pharmacists */}
          {userRole === 'pharmacist' && (
            <TabsTrigger value="pharmacistHierarchy">
              <Pill className="h-4 w-4 mr-2" />
              Pharmacist Hierarchy
            </TabsTrigger>
          )}
           {/* Show pharmacist hierarchy management tab for pharmacists and TLs, DrManagers, ZonalHeads */}
           {['teamLeader', 'drManager', 'zonalHead', 'pharmacist'].includes(userRole) && (
            <TabsTrigger value="clinicHierarchy">
              <Hospital className="h-4 w-4 mr-2" />
              Clinic Hierarchy
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="create" className="pt-4">
          <UserCreationForm 
            currentUserRole={userRole} 
            currentUser={currentUser} 
          />
        </TabsContent>
        
        {userRole === 'pharmacist' && (
          <TabsContent value="doctorHierarchy" className="pt-4">
            <DoctorHierarchyManagement 
              currentUser={currentUser} 
            />
          </TabsContent>
        )}
        
        {userRole === 'pharmacist' && (
          <TabsContent value="pharmacistHierarchy" className="pt-4">
            <PharmacistHierarchyManagement 
              currentUser={currentUser} 
            />
          </TabsContent>
        )}
        {['teamLeader', 'drManager', 'zonalHead', 'pharmacist'].includes(userRole)  && (
          <TabsContent value="clinicHierarchy" className="pt-4">
            <ClinicHierarchyManagement 
              currentUser={currentUser}
              userRole={userRole} 
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default UserCreationTab;