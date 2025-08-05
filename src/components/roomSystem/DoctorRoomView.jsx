import DoctorAvailabilityManager from '../cases/DovAvailability';
import DoctorUserManagement from '../cases/DoctorUserManagement';

const DoctorRoomView = ({ currentView, currentUser }) => {
  // Extract the meeting link from the doctor's document
  const meetingLink = currentUser.meetingLink || "No room assigned yet";

  return (
    <div className="space-y-6">
      {/* Consultation Room Card - Always visible */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Your Consultation Room
          </h2>
          <p className="text-gray-600">
            Share this link with patients or nurses to start video consultations
          </p>
        </div>
        
        <div className="space-y-4">
          {meetingLink.startsWith("http") ? (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={meetingLink}
                readOnly
                className="flex-1 w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm sm:text-base"
              />
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(meetingLink);
                    // Add toast notification here if needed
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
                >
                  Copy Link
                </button>
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center w-full sm:w-auto"
                >
                  Join Room
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700">{meetingLink}</p>
            </div>
          )}
        </div>
      </div>

      {/* Availability Management */}
      {currentView === 'availability' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Doctor Availability Management
            </h2>
            <p className="text-gray-600">
              Manage your availability status - this affects your visibility in the Room System
            </p>
          </div>
          <DoctorAvailabilityManager currentUser={currentUser} />
        </div>
      )}

      {/* Pharmacist Management */}
      {currentView === 'user-management' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Pharmacist Assignment Management
            </h2>
            <p className="text-gray-600">
              Assign and manage pharmacists who will help you with prescriptions and medication consultations
            </p>
          </div>
          <DoctorUserManagement currentUser={currentUser} />
        </div>
      )}
    </div>
  );
};

export default DoctorRoomView;