import { Stethoscope, Clock, UserCog, Users, AlertCircle, Bell } from 'lucide-react';
import { useRoomSystem, useRoomSystemActions } from '../utils/useRoomSystem';
import CaseForm from './roomSystem/CaseForm';
import NurseRoomView from './roomSystem/NurseRoomView';
import DoctorRoomView from './roomSystem/DoctorRoomView';
import PharmacistRoomView from './roomSystem/PharmacistRoomView';

import React from 'react';

const RoomSystem = ({ currentUser }) => {
  // Use the custom hook for state management
  const roomSystemState = useRoomSystem(currentUser);

  React.useEffect(() => {
    if (currentUser.role === 'nurse') {
      roomSystemState.setCurrentView('rooms');
    } else if (currentUser.role === 'doctor') {
      roomSystemState.setCurrentView('availability');
    } else if (currentUser.role === 'pharmacist') {
      roomSystemState.setCurrentView('assigned-doctors');
    }
  }, [currentUser.role, roomSystemState.setCurrentView]);

  // Create setters object for actions
  const setters = {
    setSelectedDoctors: roomSystemState.setSelectedDoctors,
    setShowCaseForm: roomSystemState.setShowCaseForm,
    setPendingCaseData: roomSystemState.setPendingCaseData,
    setCurrentView: roomSystemState.setCurrentView,
    setShowCompletionDialog: roomSystemState.setShowCompletionDialog,
    setCompletionData: roomSystemState.setCompletionData,
    setCompletionType: roomSystemState.setCompletionType
  };

  // Use the actions hook
  const actions = useRoomSystemActions(currentUser, setters, roomSystemState);

  if (roomSystemState.loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {/* Real-time Availability Notifications */}
      {roomSystemState.availabilityNotifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {roomSystemState.availabilityNotifications.map(notification => (
            <div
              key={notification.id}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg animate-bounce flex items-center transition-all duration-300"
            >
              <Bell className="h-4 w-4 mr-2" />
              <div className="text-sm">
                <div className="font-semibold">{notification.doctorName}</div>
                <div className="opacity-90">
                  {notification.previousStatus || 'Available'} → {notification.newStatus || 'Available'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-full mx-auto">
        
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              {currentUser.role === 'nurse' && (
                <>
                  <button
                    onClick={() => {
                      roomSystemState.setCurrentView('rooms');
                      roomSystemState.setSelectedDoctors([]);
                      roomSystemState.setShowCaseForm(false);
                    }}
                    className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${roomSystemState.currentView === 'rooms'
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-center">
                      <Stethoscope className="h-5 w-5 mr-2" />
                      <span>Select Doctors</span>
                    </div>
                  </button>
                  <button
                    onClick={() => roomSystemState.setCurrentView('active')}
                    className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${roomSystemState.currentView === 'active'
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-center">
                      <Clock className="h-5 w-5 mr-2" />
                      <span>Active Cases</span>
                      <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                        {roomSystemState.consultations.filter(c => c.status === 'pending' || c.status === 'doctor_complete').length}
                      </span>
                    </div>
                  </button>
                </>
              )}
              {currentUser.role === 'doctor' && (
                <>
                  <button
                    onClick={() => roomSystemState.setCurrentView('availability')}
                    className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${roomSystemState.currentView === 'availability'
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-center">
                      <UserCog className="h-5 w-5 mr-2" />
                      <span>Availability Management</span>
                    </div>
                  </button>
                  <button
                    onClick={() => roomSystemState.setCurrentView('user-management')}
                    className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${roomSystemState.currentView === 'user-management'
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-center">
                      <Users className="h-5 w-5 mr-2" />
                      <span>Manage Pharmacists</span>
                    </div>
                  </button>
                </>
              )}
              {currentUser.role === 'pharmacist' && (
                <>
                  <button
                    onClick={() => roomSystemState.setCurrentView('assigned-doctors')}
                    className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${roomSystemState.currentView === 'assigned-doctors'
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-center">
                      <Stethoscope className="h-5 w-5 mr-2" />
                      <span>Assigned Doctors</span>
                      <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                        {roomSystemState.doctorsData.length}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => roomSystemState.setCurrentView('availability')}
                    className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${roomSystemState.currentView === 'availability'
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-center">
                      <UserCog className="h-5 w-5 mr-2" />
                      <span>Availability Management</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Show Case Form Modal */}
        {roomSystemState.showCaseForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <CaseForm
                selectedDoctors={roomSystemState.selectedDoctors}
                doctorsData={roomSystemState.doctorsData}
                onSubmit={actions.handleCaseSubmit}
                onCancel={actions.handleCaseFormCancel}
              />
            </div>
          </div>
        )}

        {/* Nurse Views */}
        {currentUser.role === 'nurse' && (
          <NurseRoomView
            currentView={roomSystemState.currentView}
            doctorsData={roomSystemState.doctorsData}
            selectedDoctors={roomSystemState.selectedDoctors}
            consultations={roomSystemState.consultations}
            activeRooms={roomSystemState.activeRooms}
            participantCounts={roomSystemState.participantCounts}
            onDoctorSelection={actions.handleDoctorSelection}
            onProceedToCaseForm={actions.proceedToCaseForm}
            onJoinRoom={actions.joinRoom}
            onDoctorCompletion={actions.handleDoctorCompletion}
            onPharmacistCompletion={actions.handlePharmacistCompletion}
            pendingCaseData={roomSystemState.pendingCaseData}
            setPendingCaseData={roomSystemState.setPendingCaseData}
            setSelectedDoctors={roomSystemState.setSelectedDoctors}
            setCurrentView={roomSystemState.setCurrentView}
          />
        )}

        {/* Doctor Views */}
        {currentUser.role === 'doctor' && (
          <DoctorRoomView
            currentView={roomSystemState.currentView}
            currentUser={currentUser}
          />
        )}

        {/* Pharmacist Views */}
        {currentUser.role === 'pharmacist' && (
          <PharmacistRoomView
            currentView={roomSystemState.currentView}
            currentUser={currentUser}
            doctorsData={roomSystemState.doctorsData}
            handleSetupRoomData={roomSystemState.handleSetupRoomData}
          />
        )}

        {/* Completed Cases Summary */}
        {roomSystemState.consultations.filter(c => c.status === 'case_completed' || c.status === 'case_incomplete').length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recently Completed</h2>
            <div className="space-y-3">
              {roomSystemState.consultations.filter(c => c.status === 'case_completed' || c.status === 'case_incomplete').map(consultation => {
                const completedByDoctor = roomSystemState.doctorsData.find(d => d.id === consultation.completedBy);
                return (
                  <div key={consultation.id} className={`flex items-center justify-between p-4 rounded-lg border ${consultation.status === 'case_completed'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                    }`}>
                    <div>
                      <h4 className="font-semibold text-gray-800">{consultation.patientName}</h4>
                      <p className="text-sm text-gray-600">
                        Completed by {completedByDoctor?.name} at {consultation.startTime.toLocaleTimeString()}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{consultation.chiefComplaint}</p>
                    </div>
                    {consultation.status === 'case_completed' ? (
                      <div className="h-6 w-6 text-green-600">✓</div>
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completion Confirmation Dialog */}
        {roomSystemState.showCompletionDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Confirm {roomSystemState.completionType === 'doctor' ? 'Doctor' : 'Pharmacist'} Completion
              </h3>

              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Are you sure you want to mark this {roomSystemState.completionType === 'doctor' ? 'doctor consultation' : 'pharmacist task'} as{' '}
                  <span className={`font-semibold ${roomSystemState.completionData?.isComplete ? 'text-green-600' : 'text-red-600'}`}>
                    {roomSystemState.completionData?.isComplete ? 'COMPLETE' : 'INCOMPLETE'}
                  </span>?
                </p>

                {roomSystemState.completionType === 'doctor' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Doctor:</strong> {roomSystemState.doctorsData.find(d => d.id === roomSystemState.completionData?.doctorId)?.name}
                    </p>
                    {roomSystemState.completionData?.isComplete ? (
                      <p className="text-sm text-blue-700 mt-1">
                        ✓ This will move the case to pharmacist completion step
                      </p>
                    ) : (
                      <p className="text-sm text-red-700 mt-1">
                        ⚠ This will mark the entire case as incomplete (no pharmacist step)
                      </p>
                    )}
                  </div>
                )}

                {roomSystemState.completionType === 'pharmacist' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm text-purple-800">
                      <strong>Pharmacist:</strong> {roomSystemState.completionData?.pharmacistName}
                    </p>
                    <p className="text-sm text-purple-700 mt-1">
                      {roomSystemState.completionData?.isComplete
                        ? '✓ This will mark the entire case as completed'
                        : '⚠ This will mark the case as incomplete'
                      }
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    roomSystemState.setShowCompletionDialog(false);
                    roomSystemState.setCompletionData(null);
                    roomSystemState.setCompletionType('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (roomSystemState.completionType === 'doctor') {
                      await actions.completeConsultation(
                        roomSystemState.completionData.consultationId,
                        roomSystemState.completionData.doctorId,
                        roomSystemState.completionData.isComplete
                      );
                    } else if (roomSystemState.completionType === 'pharmacist') {
                      await actions.completePharmacistTask(
                        roomSystemState.completionData.consultationId,
                        roomSystemState.completionData.pharmacistId,
                        roomSystemState.completionData.pharmacistName,
                        roomSystemState.completionData.isComplete
                      );
                    }
                    roomSystemState.setShowCompletionDialog(false);
                    roomSystemState.setCompletionData(null);
                    roomSystemState.setCompletionType('');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${roomSystemState.completionData?.isComplete
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                  {roomSystemState.completionData?.isComplete ? 'Mark Complete' : 'Mark Incomplete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomSystem;