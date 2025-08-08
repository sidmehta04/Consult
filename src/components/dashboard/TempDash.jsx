import React from 'react';
import { Wrench, Calendar, Clock } from 'lucide-react';

const UnderDevelopment = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-lg w-full text-center">
        
        {/* Icon */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Wrench size={32} className="text-blue-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Under Development
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          This feature is currently being developed. We're working hard to bring you something amazing.
        </p>

        {/* Info */}
        <div className="bg-gray-50 rounded-md p-4 mb-6">
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <Calendar size={16} />
              <span>Coming Soon</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock size={16} />
              <span>In Progress</span>
            </div>
          </div>
        </div>

        {/* Button */}
        <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors">
          Go Back
        </button>
      </div>
    </div>
  );
};

export default UnderDevelopment;