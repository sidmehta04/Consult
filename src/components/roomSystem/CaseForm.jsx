import { useState } from 'react';
import { Users, X } from 'lucide-react';

const CaseForm = ({ selectedDoctors, doctorsData, onSubmit, onCancel }) => {
  const [patients, setPatients] = useState([
    { patientName: '', emrNumber: '', chiefComplaint: '' }
  ]);

  const addPatient = () => {
    setPatients(prev => [
      ...prev,
      { patientName: '', emrNumber: '', chiefComplaint: '' }
    ]);
  };

  const removePatient = (index) => {
    if (patients.length === 1) return;
    setPatients(prev => prev.filter((_, i) => i !== index));
  };

  const updatePatient = (index, field, value) => {
    setPatients(prev => {
      const updatedPatients = [...prev];
      updatedPatients[index] = { ...updatedPatients[index], [field]: value };
      return updatedPatients;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const isValid = patients.every(patient => 
      patient.patientName.trim() && patient.chiefComplaint.trim()
    );
    
    if (!isValid) {
      alert('Please fill in patient name and chief complaint for all patients');
      return;
    }
    
    const caseData = {
      patients: patients.map(patient => ({
        patientName: patient.patientName.trim(),
        emrNumber: patient.emrNumber.trim(),
        chiefComplaint: patient.chiefComplaint.trim()
      })),
      consultationType: 'tele',
      selectedDoctors
    };
    
    onSubmit(caseData);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Patient Case Details</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-2">Selected Doctors:</h3>
        <div className="flex flex-wrap gap-2">
          {selectedDoctors.map(doctorId => {
            const doctor = doctorsData.find(d => d.id === doctorId);
            return doctor ? (
              <span key={doctorId} className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                {doctor.name} - {doctor.specialty}
              </span>
            ) : null;
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Patient Details</h3>
            <button
              type="button"
              onClick={addPatient}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
            >
              <Users className="h-4 w-4 mr-2" />
              Add Patient
            </button>
          </div>

          {patients.map((patient, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-700">Patient {index + 1}</h4>
                {patients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePatient(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    value={patient.patientName}
                    onChange={(e) => updatePatient(index, 'patientName', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter patient full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    EMR Number
                  </label>
                  <input
                    type="text"
                    value={patient.emrNumber}
                    onChange={(e) => updatePatient(index, 'emrNumber', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter EMR number (optional)"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chief Complaint *
                </label>
                <textarea
                  value={patient.chiefComplaint}
                  onChange={(e) => updatePatient(index, 'chiefComplaint', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe patient symptoms and chief complaints..."
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
          >
            Create Consultation{patients.length > 1 ? 's' : ''}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CaseForm;