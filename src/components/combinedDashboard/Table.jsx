import React, { useState, useEffect } from "react";
import Select from "react-select"; // Import react-select
import DoctorTableRow from "./DoctorTable";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight,
} from "lucide-react";

const DoctorTable = ({ doctorPharmacist, doctors, onViewDoctorDetails, partnerNames }) => {

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedDoctorPartner, setSelectedDoctorPartner] = useState(null);
  const [selectedPharmaPartner, setSelectedPharmaPartner] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [filteredDoctors, setFilteredDoctors] = useState(doctors);

  var totalPages = Math.ceil(filteredDoctors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const handleViewDetails = (doctor) => {
    setSelectedCase(doctor);
    onViewDoctorDetails(doctor);
  };
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };    

  const role = doctorPharmacist.charAt(0).toUpperCase() + doctorPharmacist.slice(1);

   // Options for the dropdown
  const partnerOptions = partnerNames.map((partner) => ({
    value: partner,
    label: partner,
  }));

  const handlePartnerChange = (selectedOption) => {
    if (doctorPharmacist === "doctor") {
      setSelectedDoctorPartner(selectedOption ? selectedOption.value : null);
    } else if (doctorPharmacist === "pharmacist") {
      setSelectedPharmaPartner(selectedOption ? selectedOption.value : null);
    }
    // Reset the current page to 1 when the partner changes
    setCurrentPage(1);

    setSelectedPartner(selectedOption ? selectedOption.value : null);
  };

  useEffect(() => {
    if (doctorPharmacist === "doctor") {
      setSelectedPartner(selectedDoctorPartner);
    } else if (doctorPharmacist === "pharmacist") {
      setSelectedPartner(selectedPharmaPartner);
    }
  }, [doctorPharmacist]);

  useEffect(() => {
    if (selectedPartner) {
      const filtered = doctors.filter((doctor) => doctor.partnerName === selectedPartner);
      setFilteredDoctors(filtered);
    } else {
      setFilteredDoctors(doctors);
    }

    totalPages = Math.ceil(filteredDoctors.length / itemsPerPage);

  }, [doctors, selectedPartner]);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 bg-gray-50">
        <div className="flex justify-between items-center">
          {/* Left Section: Text */}
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">{role} Status & Cases</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              {selectedPartner ? 
                `Showing ${filteredDoctors.length} ${doctorPharmacist}s under ${selectedPartner}` : 
                `Showing all ${filteredDoctors.length} ${doctorPharmacist}s`
              }
            </p>
          </div>

          {/* Right Section: Dropdown */}
          <div className="w-64">
            <Select
              options={partnerOptions}
              isClearable
              placeholder="Filter by Partner"
              value={partnerOptions.find(option => option.value === selectedPartner || null)}
              onChange={handlePartnerChange}
            />
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {role}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Shift
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Today's Cases
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completed / Pending
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Complete
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg. TAT (min)
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDoctors.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-6 py-4 text-center text-sm text-gray-500">
                  No doctors found under this partner, or some other issue occurred.
                </td>
              </tr>
            ) : (
              filteredDoctors.slice(startIndex, endIndex).map((doctor) => (
                <DoctorTableRow 
                  key={doctor.id} 
                  doctor={doctor} 
                  onViewDetails={onViewDoctorDetails} 
                />
              ))
            )}
          </tbody>
        </table>

        <div className="flex justify-between items-center px-6 py-4 border-t">
          <div className="text-sm text-gray-500">
            Showing {itemsPerPage * (currentPage - 1) + 1} to {Math.min(itemsPerPage * currentPage, filteredDoctors.length)} of {filteredDoctors.length} {doctorPharmacist}s
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorTable;