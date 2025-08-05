import { Stethoscope, Pill, Video } from 'lucide-react';
import PharmacistAvailabilityManager from '../cases/PharmaManager';

const PharmacistRoomView = ({ 
  currentView, 
  currentUser, 
  doctorsData, 
  handleSetupRoomData 
}) => {
  
  if (currentView === 'assigned-doctors') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Your Assigned Doctors
        </h2>
        
        {(() => {
          // doctorsData already contains only assigned doctors for pharmacists
          const assignedDoctors = doctorsData;
          
          if (assignedDoctors.length === 0) {
            return (
              <div className="text-center py-8">
                <Pill className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Doctor Assignments</h3>
                <p className="text-gray-500">You are not currently assigned to any doctors.</p>
                <p className="text-gray-500 text-sm mt-1">Contact your administrator to get assigned to doctors.</p>
                
                <div className="mt-6">
                  <button
                    onClick={handleSetupRoomData}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    🔧 Setup Room System Data (Debug)
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    This will create doctor-pharmacist assignments for testing
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {assignedDoctors.map(doctor => (
                <div key={doctor.id} className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-blue-100 rounded-full p-3 mr-4">
                        <Stethoscope className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{doctor.name}</h3>
                        <p className="text-gray-600">{doctor.specialty}</p>
                        <p className="text-sm text-gray-500">{doctor.email}</p>
                      </div>
                    </div>
                    
                    {(() => {
                      const isAvailable = doctor.availabilityStatus === 'available';
                      const canJoin = isAvailable && doctor.gmeetLink;
                      
                      return doctor.gmeetLink ? (
                        <div>
                          <button
                            onClick={() => {
                              if (canJoin) {
                                window.open(doctor.gmeetLink, '_blank');
                              } else {
                                alert(`Cannot join ${doctor.name}'s room. Doctor is currently ${doctor.availabilityStatus || 'unavailable'}.`);
                              }
                            }}
                            disabled={!canJoin}
                            className={`px-6 py-3 rounded-lg font-semibold transition-all shadow-md flex items-center ${
                              canJoin
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            }`}
                          >
                            <Video className="h-5 w-5 mr-2" />
                            {canJoin ? `Join ${doctor.name}'s Room` : 'Room Unavailable'}
                          </button>
                          
                          {!canJoin && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-sm text-red-700 text-center">
                                🚫 {doctor.availabilityStatus || 'Doctor currently unavailable'}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    );
  }

  if (currentView === 'availability') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Pharmacist Availability Management
          </h2>
          <p className="text-gray-600">
            Manage your availability status - this affects your visibility in the Room System
          </p>
        </div>
        
        <PharmacistAvailabilityManager currentUser={currentUser} />
      </div>
    );
  }

  return null;
};

export default PharmacistRoomView;