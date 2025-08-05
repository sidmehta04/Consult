import { useState } from 'react';
import { Stethoscope, Clock, Users, Video, AlertCircle, CheckCircle } from 'lucide-react';

const NurseRoomView = ({
  currentView,
  doctorsData,
  selectedDoctors,
  consultations,
  activeRooms,
  participantCounts,
  onDoctorSelection,
  onProceedToCaseForm,
  onJoinRoom,
  onDoctorCompletion,
  onPharmacistCompletion,
  pendingCaseData,
  setPendingCaseData,
  setSelectedDoctors,
  setCurrentView
}) => {
  const [selectedDoctorForCompletion, setSelectedDoctorForCompletion] = useState(null);
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-100';
      case 'unavailable': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (currentView === 'rooms') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Step 1: Select Doctors</h2>
          <div className="text-sm text-gray-500">
            Selected: {selectedDoctors.length} doctor{selectedDoctors.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doctorsData.map(doctor => {
              const isAvailable = doctor.availabilityStatus === 'available';
              const isSelectable = isAvailable; // Allow selection of available doctors even if they have active consultations
              
              return (
                <div
                  key={doctor.id}
                  onClick={isSelectable ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Doctor selection clicked:', doctor.name, doctor.id);
                    onDoctorSelection(doctor.id);
                  } : (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    alert(`Cannot select ${doctor.name}. Doctor is currently ${doctor.availabilityStatus || 'unavailable'}.`);
                  }}
                  className={`p-4 border-2 rounded-xl transition-all ${
                    !isSelectable 
                      ? 'cursor-not-allowed opacity-60 bg-gray-50 border-gray-300' 
                      : selectedDoctors.includes(doctor.id)
                        ? 'cursor-pointer border-blue-500 bg-blue-50 shadow-md hover:shadow-lg'
                        : 'cursor-pointer border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-blue-600 font-semibold text-lg">
                        {doctor.name?.charAt(0) || 'D'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{doctor.name}</h3>
                      <p className="text-sm text-gray-600">{doctor.specialty}</p>
                    </div>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-500 ${getStatusColor(doctor.availabilityStatus || 'available')}`}>
                    <span className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        doctor.availabilityStatus === 'available' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`}></div>
                      {doctor.availabilityStatus || 'available'}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Available Pharmacists:</p>
                  <div className="flex flex-wrap gap-1">
                    {doctor.pharmacists && doctor.pharmacists.length > 0 ? (
                      <>
                        {doctor.pharmacists.slice(0, 3).map((pharmacist, index) => (
                          <span key={index} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            {pharmacist.name || pharmacist.displayName || pharmacist.email}
                          </span>
                        ))}
                        {doctor.pharmacists.length > 3 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            +{doctor.pharmacists.length - 3} more
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-500 italic">
                        No pharmacists assigned
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  {activeRooms.has(doctor.id) ? (
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                      <span className="font-medium">Live Consultation</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-500">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                      <span className="font-medium">Ready for Consultation</span>
                    </div>
                  )}
                  <div className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{participantCounts[doctor.id] || 0} active cases</span>
                  </div>
                </div>

                {/* Unavailability Message - Only show if doctor is actually unavailable */}
                {!isAvailable && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-medium">
                      🚫 {doctor.availabilityStatus || 'Currently unavailable'}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      This doctor cannot be selected for new consultations at this time.
                    </p>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onProceedToCaseForm}
            disabled={selectedDoctors.length === 0}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            Next: Add Patient Details →
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'pending-case' && pendingCaseData) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">🎉 Consultation Created Successfully!</h2>
          <div className="text-sm text-green-600 font-semibold">ACTIVE</div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-semibold text-gray-700">Patient(s):</span> {pendingCaseData.patients?.length || 0}
            </div>
            <div>
              <span className="font-semibold text-gray-700">Type:</span> Teleconsultation
            </div>
            <div>
              <span className="font-semibold text-gray-700">Started:</span> {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Join Doctor Rooms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(pendingCaseData.selectedDoctors || selectedDoctors).map(doctorId => {
              const doctor = doctorsData.find(d => d.id === doctorId);
              return doctor ? (
                <div key={doctorId} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></div>
                      <span className="text-sm font-semibold text-green-700">LIVE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  
                  <h4 className="text-lg font-bold text-gray-800 mb-2">{doctor.name}</h4>
                  <p className="text-gray-600 mb-4">{doctor.specialty}</p>
                  
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Available Pharmacists:</p>
                    <div className="space-y-1">
                      {doctor.pharmacists.slice(0, 2).map(pharmacist => (
                        <div key={pharmacist.id} className="flex items-center text-sm text-gray-600">
                          <Users className="h-3 w-3 text-indigo-500 mr-2" />
                          {pharmacist.name || pharmacist.displayName || pharmacist.email}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {(() => {
                    const canJoin = doctor.availabilityStatus === 'available';
                    
                    return (
                      <div>
                        <button
                          onClick={() => onJoinRoom(doctorId)}
                          disabled={!canJoin}
                          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all shadow-md flex items-center justify-center ${
                            canJoin
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          }`}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          {canJoin ? `Join ${doctor.name}'s Room` : `Room Unavailable`}
                        </button>
                        
                        {!canJoin && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700 text-center">
                              🚫 {doctor.availabilityStatus || 'Doctor currently unavailable'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : null;
            })}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gray-800">Quick Actions</h3>
              <p className="text-gray-600 text-sm">Navigate to other sections</p>
            </div>
            <div className="space-x-3">
              <button
                onClick={() => {
                  setCurrentView('rooms');
                  setPendingCaseData(null);
                  setSelectedDoctors([]);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                New Case
              </button>
              <button
                onClick={() => setCurrentView('active')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                View Active Cases
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'active') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Active Consultations
        </h2>
        
        {consultations.filter(c => c.status === 'pending' || c.status === 'doctor_complete').length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Consultations</h3>
            <p className="text-gray-500 mb-6">All consultations have been completed or there are no active cases at the moment.</p>
            <button
              onClick={() => setCurrentView('rooms')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Create New Consultation
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {consultations.filter(c => c.status === 'pending' || c.status === 'doctor_complete').map(consultation => {
              const assignedDoctor = doctorsData.find(d => d.id === consultation.selectedDoctors?.[0]);
              
              // Check if this consultation involves any of the selected doctors
              const isFromSelectedDoctors = selectedDoctors.length === 0 || 
                consultation.selectedDoctors?.some(doctorId => selectedDoctors.includes(doctorId));
              
              // Only show consultations from selected doctors if doctors are selected
              if (!isFromSelectedDoctors) return null;
              
              return (
                <div key={consultation.id} className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{consultation.patientName}</h3>
                      {consultation.emrNumber && (
                        <p className="text-gray-600">EMR: {consultation.emrNumber}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Started: {consultation.startTime.toLocaleTimeString()} • 
                        Created by: Nurse
                      </p>
                      {selectedDoctors.length > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          ✓ From your selected doctors
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        consultation.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {consultation.status === 'pending' ? 'Doctor In Progress' : 'Ready for Pharmacist'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Chief Complaint:</h4>
                    <p className="text-gray-700">{consultation.chiefComplaint}</p>
                  </div>

                  <div className="space-y-4">
                    {consultation.status === 'pending' ? (
                      selectedDoctorForCompletion ? (
                        // Step 2: Show selected doctor with completion buttons
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-gray-700">Mark completion for:</p>
                            <button
                              onClick={() => setSelectedDoctorForCompletion(null)}
                              className="text-blue-600 text-sm hover:text-blue-800"
                            >
                              ← Back to doctor selection
                            </button>
                          </div>
                          
                          {(() => {
                            const doctor = doctorsData.find(d => d.id === selectedDoctorForCompletion);
                            if (!doctor) return null;
                            
                            return (
                              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-gray-800">{doctor.name}</p>
                                    <p className="text-sm text-gray-600">{doctor.specialty}</p>
                                  </div>
                                  
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => onJoinRoom(selectedDoctorForCompletion)}
                                      className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center"
                                    >
                                      <Video className="h-4 w-4 mr-1" />
                                      Join Room
                                    </button>
                                    <button
                                      onClick={() => {
                                        onDoctorCompletion(consultation.id, selectedDoctorForCompletion, true);
                                        setSelectedDoctorForCompletion(null);
                                      }}
                                      className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Complete
                                    </button>
                                    <button
                                      onClick={() => {
                                        onDoctorCompletion(consultation.id, selectedDoctorForCompletion, false);
                                        setSelectedDoctorForCompletion(null);
                                      }}
                                      className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center"
                                    >
                                      <AlertCircle className="h-4 w-4 mr-1" />
                                      Incomplete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        // Step 1: Show all selected doctors for selection
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-3">Select doctor to mark completion:</p>
                          {consultation.selectedDoctors?.map(doctorId => {
                            const doctor = doctorsData.find(d => d.id === doctorId);
                            if (!doctor) return null;
                            
                            return (
                              <div key={doctorId} className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-200 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-gray-800">{doctor.name}</p>
                                    <p className="text-sm text-gray-600">{doctor.specialty}</p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onJoinRoom(doctorId);
                                      }}
                                      className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center"
                                    >
                                      <Video className="h-3 w-3 mr-1" />
                                      Join Room
                                    </button>
                                    <button
                                      onClick={() => setSelectedDoctorForCompletion(doctorId)}
                                      className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                                    >
                                      Mark Complete →
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      // Case already completed - show which doctor completed it
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-3">Consultation completed by:</p>
                        {(() => {
                          const completedByDoctor = doctorsData.find(d => d.id === consultation.completedBy);
                          return completedByDoctor ? (
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                              <div className="flex items-center">
                                <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                                <div>
                                  <p className="font-semibold text-gray-800">{completedByDoctor.name}</p>
                                  <p className="text-sm text-gray-600">{completedByDoctor.specialty}</p>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                    
                    {consultation.status === 'doctor_complete' && (
                      <div className="border-t border-gray-200 pt-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Pharmacist Completion:</p>
                        {(() => {
                          // Get pharmacists from the doctor who completed the consultation (consultation.completedBy)
                          const completedByDoctor = doctorsData.find(d => d.id === consultation.completedBy);
                          const doctorPharmacists = completedByDoctor?.pharmacists || [];
                          
                          console.log('Doctor who completed:', completedByDoctor?.name, 'Pharmacists:', doctorPharmacists);
                        
                          if (doctorPharmacists.length > 0) {
                            // Show buttons for pharmacists of the completing doctor only
                            return (
                              <div className="space-y-2">
                                <p className="text-xs text-blue-600 mb-2">
                                  Pharmacists assigned to {completedByDoctor?.name}:
                                </p>
                                {doctorPharmacists.map(pharmacist => (
                                  <div key={pharmacist.id} className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-semibold text-gray-800">{pharmacist.name || pharmacist.displayName || pharmacist.email}</p>
                                        <p className="text-sm text-gray-600">{pharmacist.specialty || 'Pharmacist'}</p>
                                      </div>
                                      <div className="flex space-x-2">
                                        <button
                                          onClick={() => onPharmacistCompletion(consultation.id, pharmacist.id, pharmacist.name || pharmacist.displayName || pharmacist.email, true)}
                                          className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center"
                                        >
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Complete
                                        </button>
                                        <button
                                          onClick={() => onPharmacistCompletion(consultation.id, pharmacist.id, pharmacist.name || pharmacist.displayName || pharmacist.email, false)}
                                          className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center"
                                        >
                                          <AlertCircle className="h-3 w-3 mr-1" />
                                          Incomplete
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          } else {
                            // No pharmacists available - show original buttons
                            return (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => onPharmacistCompletion(consultation.id, 'no-pharmacist', 'No Pharmacist Required', true)}
                                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Complete (No Pharmacist)
                                </button>
                                <button
                                  onClick={() => onPharmacistCompletion(consultation.id, 'no-pharmacist', 'No Pharmacist Required', false)}
                                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center"
                                >
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  Incomplete (No Pharmacist)
                                </button>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default NurseRoomView;