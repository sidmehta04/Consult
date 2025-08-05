import PharmacistAvailabilityManager from './PharmaManager';

const SimplifiedPharmaManagement = ({ currentUser }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Pharmacist Management</h1>
            <p className="text-gray-600">Manage your availability status for the Room System</p>
          </div>
          
          <PharmacistAvailabilityManager currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
};

export default SimplifiedPharmaManagement;