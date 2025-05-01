import React from "react";
import DoctorCard from "./DocCard";

const DoctorCardsGrid = ({ doctors, onViewDoctorDetails }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {doctors.length === 0 ? (
        <div className="col-span-full text-center py-10 bg-white rounded-lg shadow">
          <p className="text-gray-500">No doctors found in your hierarchy</p>
        </div>
      ) : (
        doctors.map(doctor => (
          <DoctorCard 
            key={doctor.id} 
            doctor={doctor} 
            onViewDetails={onViewDoctorDetails} 
          />
        ))
      )}
    </div>
  );
};

export default DoctorCardsGrid;