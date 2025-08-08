import { useState } from 'react';
import { Stethoscope, Clock, Users, Video, AlertCircle, CheckCircle, Trash2, User, Calendar } from 'lucide-react';

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
  const [selectedDoctorsForCompletion, setSelectedDoctorsForCompletion] = useState({});
  // Also add these state variables at the top of your component:
  const [selectedDoctorForConsultation, setSelectedDoctorForConsultation] = useState({});
  const [selectedPharmacistForConsultation, setSelectedPharmacistForConsultation] = useState({});

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-100';
      case 'unavailable': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleDeleteCase = (consultationId) => {
    if (window.confirm('Are you sure you want to delete this case? This action cannot be undone.')) {
      // Add your delete logic here
      console.log('Deleting case:', consultationId);
      // onDeleteCase(consultationId); - You'll need to add this prop and function
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialization</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available Pharmacists</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active Cases</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {doctorsData.map(doctor => {
                  const isAvailable = doctor.availabilityStatus === 'available';
                  const isSelectable = isAvailable;

                  return (
                    <tr
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
                      className={`transition-all ${!isSelectable
                        ? 'cursor-not-allowed opacity-60 bg-gray-50'
                        : selectedDoctors.includes(doctor.id)
                          ? 'cursor-pointer bg-blue-100 hover:bg-blue-100'
                          : 'cursor-pointer hover:bg-gray-50'
                        }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-semibold text-lg">
                              {doctor.name?.charAt(0) || 'D'}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800">{doctor.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {doctor.specialty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{participantCounts[doctor.id] || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-500 ${getStatusColor(doctor.availabilityStatus || 'available')}`}>
                          <span className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${doctor.availabilityStatus === 'available' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                              }`}></div>
                            {doctor.availabilityStatus || 'available'}
                          </span>
                        </div>
                        {!isAvailable && (
                          <div className="mt-2 p-1 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-700">
                              🚫 {doctor.availabilityStatus || 'Currently unavailable'}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pharmacist</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(pendingCaseData.selectedDoctors || selectedDoctors).map(doctorId => {
                  const doctor = doctorsData.find(d => d.id === doctorId);
                  return doctor ? (
                    <tr key={doctorId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-800">{doctor.name}</h4>
                            {/* <p className="text-xs text-gray-600">{doctor.specialty}</p> */}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {doctor.pharmacists.map(pharmacist => (
                            <div key={pharmacist.id} className="flex items-center text-sm text-gray-600">
                              <Users className="h-3 w-3 text-indigo-500 mr-2" />
                              {pharmacist.name || pharmacist.displayName || pharmacist.email}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => onJoinRoom(doctorId)}
                          disabled={doctor.availabilityStatus !== 'available'}
                          className={`py-2 px-4 rounded-lg font-semibold transition-all shadow-md flex items-center justify-center ${doctor.availabilityStatus === 'available'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            }`}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          {doctor.availabilityStatus === 'available' ? 'Join Room' : 'Unavailable'}
                        </button>
                      </td>
                    </tr>
                  ) : null;
                })}
              </tbody>
            </table>
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
    const activeConsultations = consultations.filter(c =>
      c.status === 'pending' ||
      c.status === 'doctor_complete' ||
      c.status === 'case_incomplete'
    ); 

    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Active Consultations ({activeConsultations.length})
        </h2>

        {activeConsultations.length === 0 ? (
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
          // Replace the activeConsultations mapping section with this table structure:

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                    Patient Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    EMR Number
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                    Chief Complaint
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                    Created At
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                    Assigned To
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                    Pharmacist
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* {activeConsultations.map((consultation) => {
                  const isFromSelectedDoctors = selectedDoctors.length === 0 ||
                    consultation.selectedDoctors?.some(doctorId => selectedDoctors.includes(doctorId));

                  if (!isFromSelectedDoctors) return null; */}
                {activeConsultations
                  // Sort by `startTime` (oldest first)
                  .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
                  // Then map as before
                  .map((consultation) => {
                    const isFromSelectedDoctors = selectedDoctors.length === 0 ||
                      consultation.selectedDoctors?.some(doctorId => selectedDoctors.includes(doctorId));

                    if (!isFromSelectedDoctors) return null;

                    // Auto-select first doctor if not already selected
                    const selectedDoctorId = selectedDoctorForConsultation[consultation.id] || consultation.selectedDoctors?.[0];
                    const selectedDoctor = doctorsData.find(d => d.id === selectedDoctorId);

                    const completedByDoctor = doctorsData.find(d => d.id === consultation.completedBy);
                    const doctorPharmacists = completedByDoctor?.pharmacists || [];
                    const selectedPharmacistId = selectedPharmacistForConsultation[consultation.id] || doctorPharmacists[0]?.id;
                    const selectedPharmacist = doctorPharmacists.find(p => p.id === selectedPharmacistId);

                    // Initialize selections
                    if (!selectedDoctorForConsultation[consultation.id] && consultation.selectedDoctors?.length > 0) {
                      setSelectedDoctorForConsultation(prev => ({
                        ...prev,
                        [consultation.id]: consultation.selectedDoctors[0]
                      }));
                    }

                    if (consultation.status === 'doctor_complete' && !selectedPharmacistForConsultation[consultation.id] && doctorPharmacists.length > 0) {
                      setSelectedPharmacistForConsultation(prev => ({
                        ...prev,
                        [consultation.id]: doctorPharmacists[0].id
                      }));
                    }

                    return (
                      <tr key={consultation.id} className="hover:bg-gray-50">
                        {/* Patient Name */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {consultation.patientName}
                            </div>
                          </div>
                        </td>

                        {/* EMR Number */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {consultation.emrNumber || 'N/A'}
                        </td>

                        {/* Chief Complaint */}
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-600 max-w-[200px] truncate" title={consultation.chiefComplaint}>
                            {consultation.chiefComplaint}
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="flex items-center text-xs text-gray-500 mb-1">
                              <Calendar className="h-3 w-3 mr-1" />
                              {consultation.startTime.toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              {consultation.startTime.toLocaleTimeString()}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${consultation.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : consultation.status === 'doctor_complete'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                            }`}>
                            {consultation.status === 'pending'
                              ? 'Pending'
                              : consultation.status === 'doctor_complete'
                                ? 'Awaiting Pharmacist'
                                : 'Incomplete'
                            }
                          </span>
                        </td>

                        {/* Assigned To */}
                        <td className="px-4 py-4">
                          {consultation.status === 'doctor_complete' ? (
                            // Show only the completed doctor when status is doctor_complete
                            <div className="flex items-center space-x-2">
                              <div className="text-sm">
                                <div className="font-medium text-gray-900 flex items-center">
                                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                  {completedByDoctor?.name}
                                </div>
                                {/* <div className="text-xs text-gray-500">{completedByDoctor?.specialty}</div> */}
                                <div className="text-xs text-green-600 font-medium">✓ Marked as Done</div>
                              </div>
                            </div>
                          ) : (
                            // Show radio selection for pending consultations
                            <div className="space-y-2">
                              {consultation.selectedDoctors?.map(doctorId => {
                                const doctor = doctorsData.find(d => d.id === doctorId);
                                if (!doctor) return null;

                                const isSelected = selectedDoctorId === doctorId;

                                return (
                                  <div key={doctorId} className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      name={`doctor-${consultation.id}`}
                                      value={doctorId}
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedDoctorForConsultation(prev => ({
                                          ...prev,
                                          [consultation.id]: doctorId
                                        }));
                                      }}
                                      className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <div
                                      className="text-sm cursor-pointer"
                                      onClick={() => {
                                        setSelectedDoctorForConsultation(prev => ({
                                          ...prev,
                                          [consultation.id]: doctorId
                                        }));
                                      }}
                                    >
                                      <div className="font-medium text-gray-900 hover:text-blue-600">{doctor.name}</div>
                                      {/* <div className="text-xs text-gray-500">{doctor.specialty}</div> */}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Pharmacist */}
                        <td className="px-4 py-4">
                          {consultation.status === 'doctor_complete' && doctorPharmacists.length > 0 ? (
                            <div className="space-y-2">
                              {doctorPharmacists.map(pharmacist => (
                                <div key={pharmacist.id} className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name={`pharmacist-${consultation.id}`}
                                    value={pharmacist.id}
                                    checked={selectedPharmacistId === pharmacist.id}
                                    onChange={() => {
                                      setSelectedPharmacistForConsultation(prev => ({
                                        ...prev,
                                        [consultation.id]: pharmacist.id
                                      }));
                                    }}
                                    className="text-purple-600 focus:ring-purple-500"
                                  />
                                  <div
                                    className="text-sm cursor-pointer"
                                    onClick={() => {
                                      setSelectedPharmacistForConsultation(prev => ({
                                        ...prev,
                                        [consultation.id]: pharmacist.id
                                      }));
                                    }}
                                  >
                                    <div className="font-medium text-gray-900 hover:text-purple-600">
                                      {pharmacist.name || pharmacist.displayName || pharmacist.email}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : consultation.status === 'doctor_complete' && doctorPharmacists.length === 0 ? (
                            <span className="text-xs text-blue-600 italic">No Pharmacist Required</span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              {consultation.status === 'pending' ? 'Waiting for doctor...' : 'N/A'}
                            </span>
                          )}
                        </td>


                        {/* Actions */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {consultation.status === 'case_incomplete' ? (
                            <button
                              onClick={() => handleDeleteCase(consultation.id)}
                              className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium transition-colors flex items-center"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </button>
                          ) : consultation.status === 'doctor_complete' ? (
                            // Show Complete and Skip buttons when doctor is done
                            <div className="space-y-1">
                              <button
                                onClick={() => {
                                  if (selectedPharmacist) {
                                    onPharmacistCompletion(consultation.id, selectedPharmacistId, selectedPharmacist.name || selectedPharmacist.displayName || selectedPharmacist.email, true);
                                  } else {
                                    onPharmacistCompletion(consultation.id, 'no-pharmacist', 'No Pharmacist Required', true);
                                  }
                                }}
                                disabled={!selectedPharmacist && doctorPharmacists.length > 0}
                                className="w-full bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Complete
                              </button>
                              <button
                                onClick={() => {
                                  if (selectedPharmacist) {
                                    onPharmacistCompletion(consultation.id, selectedPharmacistId, selectedPharmacist.name || selectedPharmacist.displayName || selectedPharmacist.email, false);
                                  } else {
                                    onPharmacistCompletion(consultation.id, 'no-pharmacist', 'No Pharmacist Required', false);
                                  }
                                }}
                                className="w-full bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700 transition-colors flex items-center justify-center"
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Mark as Incomplete
                              </button>
                            </div>
                          ) : (
                            // Show Join Video, Mark Doctor Done, and Mark as Incomplete for pending consultations
                            <div className="space-y-1">
                              <button
                                onClick={() => selectedDoctor && onJoinRoom(selectedDoctorId)}
                                disabled={!selectedDoctor}
                                className="w-full bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50"
                              >
                                <Video className="h-3 w-3 mr-1" />
                                Join Room
                              </button>

                              {consultation.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => {
                                      if (selectedDoctor) {
                                        onDoctorCompletion(consultation.id, selectedDoctorId, true);
                                      }
                                    }}
                                    disabled={!selectedDoctor}
                                    className="w-full bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Mark Doctor Done
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (selectedDoctor) {
                                        onDoctorCompletion(consultation.id, selectedDoctorId, false);
                                      }
                                    }}
                                    disabled={!selectedDoctor}
                                    className="w-full bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-colors flex items-center justify-center disabled:opacity-50"
                                  >
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Mark as Incomplete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default NurseRoomView;