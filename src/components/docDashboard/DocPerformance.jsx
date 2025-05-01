import React from "react";

const DoctorPerformanceMetrics = ({ doctor, availabilityHistory = [] }) => {
  // Helper function to calculate average login time
  const calculateAvgLoginTime = () => {
    if (!availabilityHistory || availabilityHistory.length === 0) return "N/A";
    
    // Get all status changes from unavailable to available that look like morning logins
    const loginEvents = availabilityHistory.filter(entry => 
      entry.previousStatus === "unavailable" && 
      entry.newStatus === "available" &&
      entry.changedAt?.toDate && 
      isTimeInRange(entry.changedAt.toDate(), 7, 11) // Between 7 AM and 11 AM
    );
    
    if (loginEvents.length === 0) return "N/A";
    
    // Calculate average time
    let totalMinutes = 0;
    loginEvents.forEach(entry => {
      const date = entry.changedAt.toDate();
      totalMinutes += date.getHours() * 60 + date.getMinutes();
    });
    
    const avgMinutes = Math.round(totalMinutes / loginEvents.length);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  };

  // Helper function to calculate break frequency
  const calculateBreakFrequency = () => {
    if (!availabilityHistory || availabilityHistory.length === 0) return "N/A";
    
    // Group events by date
    const breaksByDate = {};
    availabilityHistory.forEach(entry => {
      if (entry.newStatus === "on_break" && entry.changedAt?.toDate) {
        const date = entry.changedAt.toDate();
        const dateStr = date.toLocaleDateString();
        
        if (!breaksByDate[dateStr]) {
          breaksByDate[dateStr] = 0;
        }
        breaksByDate[dateStr]++;
      }
    });
    
    // Calculate average breaks per day
    const totalDays = Object.keys(breaksByDate).length;
    if (totalDays === 0) return "N/A";
    
    const totalBreaks = Object.values(breaksByDate).reduce((sum, count) => sum + count, 0);
    const avgBreaksPerDay = totalBreaks / totalDays;
    
    return avgBreaksPerDay.toFixed(1) + " per day";
  };

  // Helper to check if a time is within a specific hour range
  const isTimeInRange = (date, startHour, endHour) => {
    const hours = date.getHours();
    return hours >= startHour && hours <= endHour;
  };
  
  // Calculate average TAT
  const avgTAT = doctor?.averageTAT || 0;
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-700 font-medium">Average TAT</div>
          <div className="text-2xl font-bold text-gray-900">{avgTAT} min</div>
          <div className="text-xs text-gray-500 mt-1">
            Per completed case
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-700 font-medium">Completion Rate</div>
          <div className="text-2xl font-bold text-gray-900">
            {doctor?.completionPercentage || 0}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Of daily target
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-700 font-medium">Avg. Daily Login</div>
          <div className="text-2xl font-bold text-gray-900">
            {calculateAvgLoginTime()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Based on login history
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-700 font-medium">Break Frequency</div>
          <div className="text-2xl font-bold text-gray-900">
            {calculateBreakFrequency()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Average across working days
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorPerformanceMetrics;