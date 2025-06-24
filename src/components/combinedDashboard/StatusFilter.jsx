import React, { useState, useMemo } from "react";

const StatusFilter = ({ 
  doctors, 
  doctorPharmacist, 
  onFilteredDataChange, 
  casesData = [] 
}) => {
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showFilter, setShowFilter] = useState(false);

  // Calculate status counts
  const statusCounts = useMemo(() => {
  const counts = {
    available: 0,
    busy: 0,
    on_break: 0,
    on_holiday: 0,  // Add this line
    unavailable: 0,
    unavailable_with_cases: 0
  };

  doctors.forEach(doctor => {
    const status = doctor.availabilityStatus;
    if (status === 'unavailable') {
      // Check if unavailable doctor/pharmacist has pending cases
      const hasPendingCases = doctorPharmacist === "doctor" 
        ? casesData.some(item => 
            item.assignedDoctors?.primary === doctor.id && item.doctorCompleted === false
          )
        : casesData.some(item => 
            item.pharmacistId === doctor.id && item.status === "doctor_completed"
          );
      
      if (hasPendingCases) {
        counts.unavailable_with_cases++;
      } else {
        counts.unavailable++;
      }
    } else if (counts.hasOwnProperty(status)) {
      counts[status]++;
    }
  });

  return counts;
}, [doctors, doctorPharmacist, casesData]);


  // Filter doctors based on selected statuses
  const filteredData = useMemo(() => {
    if (selectedStatuses.length === 0) {
      return doctors; // Return all if no filter selected
    }

    return doctors.filter(doctor => {
      const status = doctor.availabilityStatus;
      
      // Handle unavailable with cases separately
      if (status === 'unavailable') {
        const hasPendingCases = doctorPharmacist === "doctor" 
          ? casesData.some(item => 
              item.assignedDoctors?.primary === doctor.id && item.doctorCompleted === false
            )
          : casesData.some(item => 
              item.pharmacistId === doctor.id && item.status === "doctor_completed"
            );
        
        if (hasPendingCases && selectedStatuses.includes('unavailable_with_cases')) {
          return true;
        } else if (!hasPendingCases && selectedStatuses.includes('unavailable')) {
          return true;
        }
        return false;
      }
      
      return selectedStatuses.includes(status);
    });
  }, [doctors, selectedStatuses, doctorPharmacist, casesData]);

  // Update parent component when filtered data changes
  React.useEffect(() => {
    onFilteredDataChange(filteredData);
  }, [filteredData, onFilteredDataChange]);

  const handleStatusToggle = (status) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
  };

  const selectAll = () => {
  setSelectedStatuses(['available', 'busy', 'on_break', 'on_holiday', 'unavailable', 'unavailable_with_cases']);
};

  const statusOptions = [
  { 
    key: 'available', 
    label: 'Available', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: '✓'
  },
  { 
    key: 'busy', 
    label: 'Busy', 
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '⚡'
  },
  { 
    key: 'on_break', 
    label: 'On Break', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '⏸️'
  },
  { 
    key: 'on_holiday', 
    label: 'On Holiday', 
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: '🏖️'
  },
  { 
    key: 'unavailable', 
    label: 'Unavailable', 
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '✕'
  },
  { 
    key: 'unavailable_with_cases', 
    label: 'Unavailable (with cases)', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '⚠️'
  }
];
  const role = doctorPharmacist.charAt(0).toUpperCase() + doctorPharmacist.slice(1);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-medium text-gray-900">
            Filter {role}s by Status
          </h3>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
          >
            {showFilter ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          Showing {filteredData.length} of {doctors.length} {role.toLowerCase()}s
        </div>
      </div>

      {showFilter && (
        <div className="space-y-3">
          {/* Quick Actions */}
          <div className="flex space-x-2 mb-3">
            <button
              onClick={selectAll}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(option => (
              <button
                key={option.key}
                onClick={() => handleStatusToggle(option.key)}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
                  ${selectedStatuses.includes(option.key) 
                    ? `${option.color} ring-2 ring-offset-1 ring-blue-500` 
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }
                `}
              >
                <span>{option.icon}</span>
                <span>{option.label}</span>
                <span className="bg-white bg-opacity-70 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {statusCounts[option.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Active Filters Summary */}
          {selectedStatuses.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Active Filters:</strong> {selectedStatuses.map(status => {
                  const option = statusOptions.find(opt => opt.key === status);
                  return option?.label;
                }).join(', ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
        {statusOptions.map(option => (
          <div 
            key={option.key}
            className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
              selectedStatuses.includes(option.key) 
                ? `${option.color} ring-1 ring-blue-400` 
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
            onClick={() => handleStatusToggle(option.key)}
          >
            <div className="flex items-center justify-between">
              <div className="text-2xl">{option.icon}</div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {statusCounts[option.key]}
                </div>
                <div className="text-xs text-gray-600">
                  {option.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusFilter;