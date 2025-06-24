import React from "react";

const DoctorCard = ({ doctor, onViewDetails }) => {
  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "busy":
        return "bg-yellow-100 text-yellow-800";
      case "on_break":
        return "bg-blue-100 text-blue-800";
      case "on_holiday":
        return "bg-purple-100 text-purple-800";
      case "unavailable":
      default:
        return "bg-red-100 text-red-800";
    }
  };

  // Format status for display
  const formatStatus = (status) => {
    switch (status) {
      case "available":
        return "Available";
      case "busy":
        return "Busy";
      case "on_break":
        return "On Break";
      case "unavailable":
        return "Unavailable";
      case "on_holiday":
        return "On Holiday";
      default:
        return "Unknown";
    }
  };

  // Format shift timing for display
  const formatShiftTiming = (shiftTiming) => {
    return shiftTiming || "Not set";
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div
        className={`px-4 py-2 ${
          doctor.availabilityStatus === "available"
            ? "bg-green-50"
            : doctor.availabilityStatus === "busy"
            ? "bg-yellow-50"
            : doctor.availabilityStatus === "on_break"
            ? "bg-blue-50"
            : doctor.availabilityStatus === "on_holiday"
            ? "bg-purple-50"
            : "bg-red-50"
        }`}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{doctor.name}</h3>
          <span
            className={`px-2 py-1 text-xs rounded-full font-semibold ${getStatusBadgeColor(
              doctor.availabilityStatus
            )}`}
          >
            {formatStatus(doctor.availabilityStatus)}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          {doctor.empId && `ID: ${doctor.empId}`} •{" "}
          {formatShiftTiming(doctor.shiftTiming)}
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-50 p-2 rounded text-center">
            <div className="text-sm text-gray-500">Today's Cases</div>
            <div className="text-xl font-bold">{doctor.todayCases}</div>
          </div>
          <div className="bg-gray-50 p-2 rounded text-center">
            <div className="text-sm text-gray-500">Target</div>
            <div className="text-xl font-bold">{doctor.dailyTarget}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 border border-gray-100 rounded">
            <div className="text-xs text-gray-500">Completed</div>
            <div className="text-lg font-medium text-green-600">
              {doctor.completedCases}
            </div>
          </div>
          <div className="p-2 border border-gray-100 rounded">
            <div className="text-xs text-gray-500">Pending</div>
            <div className="text-lg font-medium text-yellow-600">
              {doctor.pendingCases}
            </div>
          </div>
          <div className="p-2 border border-gray-100 rounded">
            <div className="text-xs text-gray-500">Incomplete</div>
            <div className="text-lg font-medium text-red-600">
              {doctor.incompleteCases}
            </div>
          </div>
          <div className="p-2 border border-gray-100 rounded">
            <div className="text-xs text-gray-500">Avg. TAT</div>
            <div className="text-lg font-medium">
              {doctor.averageTAT} <span className="text-xs">min</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${
                doctor.completionPercentage >= 100
                  ? "bg-green-500"
                  : doctor.completionPercentage >= 75
                  ? "bg-lime-500"
                  : doctor.completionPercentage >= 50
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{
                width: `${Math.min(doctor.completionPercentage, 100)}%`,
              }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>{Math.min(doctor.completionPercentage, 100)}%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => onViewDetails(doctor)}
            className="inline-flex items-center px-3 py-1 border border-blue-300 text-sm leading-5 font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorCard;
