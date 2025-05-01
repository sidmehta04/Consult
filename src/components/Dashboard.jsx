import React from "react";
import Dashboard from "./dashboard/Dashboard"; // Import the main Dashboard component
import DoctorDashboard from "./docDashboard/DocDashboard";

// Simple wrapper for the Dashboard to integrate it with your App.js
const DashboardTab = ({ currentUser }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white shadow-md rounded-lg p-6">
        <Dashboard currentUser={currentUser} />
      </div>
      <div className="bg-white shadow-md rounded-lg p-6">
        <DoctorDashboard currentUser={currentUser} />
      </div>
    </div>
  );
};

export default DashboardTab;
