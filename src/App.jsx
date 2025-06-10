import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation
} from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, query, collection, where, onSnapshot } from "firebase/firestore";
import { firestore } from "./firebase";
 
import { Badge } from "@/components/ui/badge";
import LoginForm from "./components/Login";
import UserCreationTab from "./components/UserCreation";
import CaseManagementModule from "./components/CaseManagement";
//import DashboardTab from "./components/dashboard_old/Dashboard"; // Import the Dashboard Tab
import DashboardNew from "./components/dashboard/Dashboard";
import CombinedDashboard from "./components/combinedDashboard/DocDashboard"; // Import the Combined Dashboard
import AnalyticsDashboard from "./components/Analytics";
import { ClipboardList, UserPlus, Home, LogOut, Activity, PillBottle} from "lucide-react";
import { createAdminUsers } from "./utils/createadmin";
import {initializeTopAdmins} from "./utils/admin"; // Import the function to create admin users

// Protected route wrapper
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();


    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          // Get user role from Firestore
          const userRef = doc(firestore, "users", user.uid);
          const snapshot = await getDoc(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.data();
            setUserRole(userData.role);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-sky-50">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <div className="p-8 max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg my-8 text-center shadow-md">
        <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
        <p className="text-red-700">
          You don't have permission to access this page
        </p>
      </div>
    );
  }

  return children;
};

// Custom hook to get location for active link styling
const useActivePath = () => {
  const location = useLocation();
  return (path) => {
    // For exact matches
    if (path === location.pathname) return true;
    // For nested routes (optional, if you have them)
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };
};

// Navigation component to avoid repetition
const Navigation = ({ items, userRole, userUid }) => {
  const isActive = useActivePath();
  const [numCases, setNumCases] = useState(0);
  const [flashBadge, setFlashBadge] = useState(false);

  useEffect(() => {
    if (userUid && userRole === 'pharmacist') {
      const casesCountQuery = query(
        collection(firestore, "cases"),
        where("pharmacistId", "==", userUid),
        where("pharmacistCompleted", "==", false),
        where("isIncomplete", "!=", true)
      );

      const unsubscribe = onSnapshot(casesCountQuery, (snapshot) => {
        const newCount = snapshot.size;
        if (newCount !== numCases) {
          setFlashBadge(true); // Trigger flash effect
          setTimeout(() => setFlashBadge(false), 2500); // Reset flash after 2.5 seconds
        }
        setNumCases(newCount); // Update numCases
      });

      return () => unsubscribe(); // Cleanup the listener when the component unmounts
    }
  }, [userUid, numCases]);

  const getNavItemStyles = (active) => {
    return active 
      ? "bg-blue-100 text-blue-800" 
      : "text-blue-800 hover:bg-blue-50 hover:text-blue-700";
  };

  return (
    <div className="bg-white shadow-sm">
      <div className="flex max-w-7xl mx-auto px-4 items-center">
        <nav className="flex items-center space-x-4 py-2 flex-grow">
          {items.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-4 py-2 rounded-lg ${getNavItemStyles(isActive(item.href))}`}
            >
              {item.icon}
              <span className="ml-2 font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>
        {userRole === 'pharmacist' && (
          <div className="flex items-center">
            <Badge
              className={`bg-amber-100 text-amber-800 border-amber-200 px-3 py-1 rounded-md relative overflow-visible`}
            >
              {numCases > 0 && (
                <span
                  className={`absolute -top-1 -right-1 inline-flex w-3 h-3 rounded-full bg-orange-400 opacity-75 ${
                    flashBadge ? "animate-ping" : ""
                  }`}
                ></span>
              )}
              
              Reminder: Start recording for all cases assigned to you. Currently {numCases} cases are active.
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

function AppContent() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const userRef = doc(firestore, "users", user.uid);
          const snapshot = await getDoc(userRef);
          if (snapshot.exists()) {
            const data = snapshot.data();
            setUserRole(data.role);
            setUserData(data);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserRole(null);
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Define navigation items based on user role
  const getNavigationItems = () => {
    const items = [
      { name: "Dashboard", href: "/", icon: <Home className="h-5 w-5" /> }
    ];

    // ---Divyansh's code---
    
    // Replacing following with common dashboard:
    /*
    // Doctor Dashboard for management roles
    if (["zonalHead", "teamLeader", "drManager"].includes(userRole)) {
      items.push({
        name: "Doctor Status",
        href: "/doctor-dashboard",
        icon: <Activity className="h-5 w-5" />
      });
    }

    // Pharmacist Dashboard (not sure if RO is needed)
    if (["zonalHead", "teamLeader", "drManager"].includes(userRole)) {
      items.push({
        name: "Pharmacist Status",
        href: "/pharmacist-dashboard",
        icon: <PillBottle className="h-5 w-5" />
      });
    }
    */

    // combined dashboard
    if (["zonalHead", "teamLeader", "drManager"].includes(userRole)) {
      items.push({
        name: "Doctor/Pharmacist Status",
        href: "/medical-dashboard",
        icon: <Activity className="h-5 w-5" />
      });
    }
    // --- End of Divyansh's code ---

    // User management for administrative roles
    if (["superAdmin", "zonalHead", "teamLeader", "drManager", "ro", "pharmacist"].includes(userRole)) {
      items.push({
        name: "User Management",
        href: "/users",
        icon: <UserPlus className="h-5 w-5" />
      });
    }

    // Case management for relevant roles
    if (["nurse", "doctor", "pharmacist"].includes(userRole)) {
      items.push({
        name: "Case Management",
        href: "/cases",
        icon: <ClipboardList className="h-5 w-5" />
      });
    }

    if (userRole === "superAdmin") {
      items.push({
        name: "Analytics",
        href: "/analytics",
        icon: <Activity className="h-5 w-5" />
      });
    }

    return items;
  };

  // Get header color - consistent blue theme
  const getHeaderColor = () => {
    return "bg-gradient-to-r from-blue-700 to-sky-600";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-sky-50">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <header className={`shadow-md ${getHeaderColor()} text-white`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">
            Consultation Management System
          </h1>
          <div className="flex items-center space-x-4">
            {currentUser && userRole && (
              <div className="text-sm text-white opacity-90">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <div className="mr-2">
                    <span className="font-medium">{currentUser.email}</span>
                  </div>
                  <div>
                    Role:{" "}
                    <span className="font-medium">
                      {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => getAuth().signOut()}
              className="flex items-center text-sm text-white hover:text-white/80 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <Navigation items={getNavigationItems()} userRole={userRole} userUid={currentUser.uid} />

      {/* Main Content Area */}
      <div className="h-[calc(100vh-112px)]">
        <main className="overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            <Routes>
              {/* Dashboard route (home) */}
              {/*
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardTab currentUser={{...currentUser, role: userRole, ...userData}} />
                  </ProtectedRoute>
                }
              />*/}

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardNew currentUser={{...currentUser, role: userRole, ...userData}} />
                  </ProtectedRoute>
                }
              />

              {/* Doctor Dashboard route */}
              {/*}
              <Route
                path="/doctor-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["zonalHead", "teamLeader", "drManager"]}>
                    <DoctorDashboard currentUser={{...currentUser, role: userRole, ...userData}} />
                  </ProtectedRoute>
                }
              />
              */}
              {/* --- Divyansh's code --- */} 
              {/* Pharmacist Dashboard route */}
              {/*
              <Route
                path="/pharmacist-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["teamLeader", "drManager", "zonalHead"]}>
                    <PharmacistDashboard currentUser={{...currentUser, role: userRole, ...userData}} />
                  </ProtectedRoute>
                }
              />
              */}

              <Route
                path="/medical-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["teamLeader", "drManager", "zonalHead"]}>
                    <CombinedDashboard currentUser={{...currentUser, role: userRole, ...userData}} />
                  </ProtectedRoute>
                }
              />  

              {/* --- End of Divyansh's code --- */}

              {/* User management route */}
              <Route
                path="/users"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "superAdmin",
                      "zonalHead", 
                      "teamLeader", 
                      "drManager", 
                      "ro",
                      "pharmacist"
                    ]}
                  >
                    <UserCreationTab />
                  </ProtectedRoute>
                }
              />

              {/* Case management route */}
              <Route
                path="/cases"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "nurse",
                      "doctor",
                      "pharmacist",
                      "drManager",
                      "ro",
                      "teamLeader",
                      "zonalHead",
                      "superAdmin"
                    ]}
                  >
                    <CaseManagementModule currentUser={{...currentUser, role: userRole, ...userData}} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/analytics"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "superAdmin"
                    ]}
                  >
                    <AnalyticsDashboard currentUser={{...currentUser, role: userRole, ...userData}} />
                  </ProtectedRoute>
                }
              />

              {/* Default catch-all route */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
    </>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {

      setIsAuthenticated(!!user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-sky-50">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-sky-50">
        {isAuthenticated ? (
          <AppContent />
        ) : (
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;