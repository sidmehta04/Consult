import React from "react";

const DoctorCasesSummary = ({ caseData, doctor }) => {
  const { 
    totalCases = 0, 
    completedCases = 0,
    pendingCases = 0,
    incompleteCases = 0
  } = caseData;
  
  // Calculate completion percentage
  const calculateCompletionPercentage = () => {
    if (!doctor?.dailyTarget || doctor.dailyTarget === 0) return 0;
    return Math.round((completedCases / doctor.dailyTarget) * 100);
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Today's Cases</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-blue-700 font-medium">Total Cases</div>
          <div className="text-2xl font-bold text-blue-900">{totalCases}</div>
        </div>
        
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm text-green-700 font-medium">Completed</div>
          <div className="text-2xl font-bold text-green-900">{completedCases}</div>
        </div>
        
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-sm text-yellow-700 font-medium">Pending</div>
          <div className="text-2xl font-bold text-yellow-900">{pendingCases}</div>
        </div>
        
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-sm text-red-700 font-medium">Incomplete</div>
          <div className="text-2xl font-bold text-red-900">{incompleteCases}</div>
        </div>
      </div>
      
      {/* Target Information */}
      {doctor && (
        <div className="bg-gray-50 p-3 rounded-lg mb-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-700 font-medium">Daily Target</div>
            <div className="text-xl font-bold text-gray-900">{doctor.dailyTarget} cases</div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Based on {doctor.shiftType === "Part-Time" ? "no break" : "1 hour break"} for {doctor.shiftTiming} shift
          </div>
        </div>
      )}
      
      {/* Case Breakdown Chart */}
      <div className="mt-4">
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                Case Distribution
              </span>
            </div>
          </div>
          <div className="flex h-4 overflow-hidden text-xs bg-gray-200 rounded">
            <div 
              style={{ width: `${totalCases ? (completedCases / totalCases) * 100 : 0}%` }}
              className="flex flex-col justify-center text-center text-white bg-green-500 shadow-none whitespace-nowrap"
            ></div>
            <div 
              style={{ width: `${totalCases ? (pendingCases / totalCases) * 100 : 0}%` }}
              className="flex flex-col justify-center text-center text-white bg-yellow-500 shadow-none whitespace-nowrap"
            ></div>
            <div 
              style={{ width: `${totalCases ? (incompleteCases / totalCases) * 100 : 0}%` }}
              className="flex flex-col justify-center text-center text-white bg-red-500 shadow-none whitespace-nowrap"
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{Math.round(totalCases ? (completedCases / totalCases) * 100 : 0)}% Completed</span>
            <span>{Math.round(totalCases ? (pendingCases / totalCases) * 100 : 0)}% Pending</span>
            <span>{Math.round(totalCases ? (incompleteCases / totalCases) * 100 : 0)}% Incomplete</span>
          </div>
        </div>
      </div>
      
      {/* Progress bar for target completion */}
      {doctor && (
        <div className="mt-4">
          <div className="flex mb-1 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                Completion: {calculateCompletionPercentage()}%
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              style={{ width: `${Math.min(calculateCompletionPercentage(), 100)}%` }}
              className={`h-2.5 rounded-full ${
                calculateCompletionPercentage() >= 100 ? "bg-green-500" :
                calculateCompletionPercentage() >= 75 ? "bg-lime-500" :
                calculateCompletionPercentage() >= 50 ? "bg-yellow-500" :
                "bg-red-500"
              }`}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0</span>
            <span>{doctor.dailyTarget}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorCasesSummary;