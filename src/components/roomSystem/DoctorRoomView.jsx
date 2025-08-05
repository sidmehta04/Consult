import DoctorAvailabilityManager from '../cases/DovAvailability';
import DoctorUserManagement from '../cases/DoctorUserManagement';

const DoctorRoomView = ({ currentView, currentUser }) => {
  
  if (currentView === 'availability') {
    return (
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
    );
  }

  if (currentView === 'user-management') {
    return (
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
    );
  }

  return null;
};

export default DoctorRoomView;