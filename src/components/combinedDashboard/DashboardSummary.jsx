import React from "react";

const DashboardSummary = ({ doctors, doctorPharmacist }) => {
  // Calculate summary metrics
  const availableDoctors = doctors.filter(
    (d) => d.availabilityStatus === "available"
  ).length;
  const busyDoctors = doctors.filter(
    (d) => d.availabilityStatus === "busy"
  ).length;
  const totalCasesToday = doctors.reduce(
    (sum, d) => sum + (d.todayCases || 0),
    0
  );
  const completedCases = doctors.reduce(
    (sum, d) => sum + (d.completedCases || 0),
    0
  );
  const avgTAT = Math.round(
    doctors.reduce((sum, d) => sum + (d.averageTAT || 0), 0) /
      (doctors.filter((d) => d.averageTAT > 0).length || 1)
  );
  const onBreakCount = doctors.filter(
    (d) => d.availabilityStatus === "on_break"
  ).length;

  // Segregate unavailable doctors/pharmacists
  const unavailableDoctors = doctors.filter(
    (d) => d.availabilityStatus === "unavailable"
  );

  // Check if unavailable doctors/pharmacists have pending cases using existing data
  const unavailableWithCases = unavailableDoctors.filter((doctor) => {
    if (doctorPharmacist === "doctor") {
      // Check if doctor has pending cases from their data
      return (
        (doctor.pendingCases && doctor.pendingCases > 0) ||
        (doctor.activeCases && doctor.activeCases > 0) ||
        (doctor.todayCases &&
          doctor.completedCases &&
          doctor.todayCases > doctor.completedCases)
      );
    } else {
      // Check if pharmacist has pending cases from their data
      return (
        (doctor.pendingCases && doctor.pendingCases > 0) ||
        (doctor.activeCases && doctor.activeCases > 0) ||
        (doctor.todayCases &&
          doctor.completedCases &&
          doctor.todayCases > doctor.completedCases)
      );
    }
  });

  const unavailableCount = unavailableDoctors.length;
  const unavailableWithCasesCount = unavailableWithCases.length;
  const unavailableWithoutCasesCount =
    unavailableCount - unavailableWithCasesCount;

  const role =
    doctorPharmacist.charAt(0).toUpperCase() + doctorPharmacist.slice(1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500">Available {role}s</h3>
        <p className="text-3xl font-bold text-green-600">{availableDoctors}</p>
        <div className="text-xs text-gray-500 mt-1">
          out of {doctors.length} total
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500">Busy {role}s</h3>
        <p className="text-3xl font-bold text-orange-600">{busyDoctors}</p>
        <div className="text-xs text-gray-500 mt-1">
          currently working on cases
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500">Total Cases Today</h3>
        <p className="text-3xl font-bold text-gray-800">{totalCasesToday}</p>
        <div className="text-xs text-gray-500 mt-1">
          {completedCases} completed (
          {totalCasesToday > 0
            ? Math.round((completedCases / totalCasesToday) * 100)
            : 0}
          %)
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500">Average TAT</h3>
        <p className="text-3xl font-bold text-gray-800">{avgTAT}</p>
        <div className="text-xs text-gray-500 mt-1">minutes per case</div>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500">
          On Break / Unavailable
        </h3>
        <p className="text-3xl font-bold text-red-600">
          {onBreakCount + unavailableCount}
        </p>
        <div className="text-xs text-gray-500 mt-1">
          {onBreakCount} on break, {unavailableWithoutCasesCount} unavailable
          {unavailableWithCasesCount > 0 && (
            <>
              , {unavailableWithCasesCount} unavailable but have cases in queue
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardSummary;
