import React from "react";

/**
 * A component for displaying productivity metrics with visual indicators
 */
const ProductivityIndicator = ({ 
  completedCases = 0, 
  totalTarget = 0, 
  completionPercentage = 0,
  size = "medium", // small, medium, large
  showLabel = true
}) => {
  // Get color based on percentage
  const getColorClass = (percentage) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-lime-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Get text color based on percentage
  const getTextColorClass = (percentage) => {
    if (percentage >= 100) return "text-green-700";
    if (percentage >= 75) return "text-lime-700";
    if (percentage >= 50) return "text-yellow-700";
    return "text-red-700";
  };

  // Get badge background color based on percentage
  const getBadgeBgClass = (percentage) => {
    if (percentage >= 100) return "bg-green-100 text-green-800";
    if (percentage >= 75) return "bg-lime-100 text-lime-800";
    if (percentage >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  // Determine height based on size
  const getHeightClass = () => {
    switch (size) {
      case "small": return "h-1.5";
      case "large": return "h-4";
      default: return "h-2.5";
    }
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center">
            <span className={`text-xs font-semibold inline-flex items-center px-2.5 py-0.5 rounded-full ${getBadgeBgClass(completionPercentage)}`}>
              {completionPercentage}%
            </span>
            {size !== "small" && (
              <span className="text-xs text-gray-500 ml-2">
                of target
              </span>
            )}
          </div>
          {size === "large" && (
            <span className={`text-sm font-medium ${getTextColorClass(completionPercentage)}`}>
              {completedCases}/{totalTarget}
            </span>
          )}
        </div>
      )}
      
      <div className="w-full bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`${getHeightClass()} ${getColorClass(completionPercentage)} rounded-full`}
          style={{ width: `${Math.min(completionPercentage, 100)}%` }}
        ></div>
      </div>
      
      {(size === "medium" || size === "small") && showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0</span>
          <span>{totalTarget}</span>
        </div>
      )}
    </div>
  );
};

export default ProductivityIndicator;