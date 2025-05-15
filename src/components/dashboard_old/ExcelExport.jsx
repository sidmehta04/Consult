import * as XLSX from 'xlsx';

export const exportCasesToExcel = (cases, fileName = 'cases_export.xlsx') => {
  // Transform cases for Excel export
  const excelData = cases.map(caseItem => ({
    'Case ID': caseItem.id || caseItem.emrNumber || '',
    'Clinic Code': caseItem.clinicCode || caseItem.clinicName || '',
    'Partner': caseItem.partnerName || '',
    'Doctor': caseItem.doctorName || caseItem.assignedDoctors?.primaryName || '',
    'Pharmacist': caseItem.pharmacistName || '',
    'Patient Name': caseItem.patientName || '',
    'Created Date': formatDate(caseItem.createdAt),
    'Start Time': formatTime(caseItem.startTime || caseItem.createdAt),
    'End Time': formatTime(caseItem.endTime || caseItem.pharmacistCompletedAt),
    'Queue': getQueueStatus(caseItem),
    'Status': getStatusLabel(caseItem),
    'Doctor Completed': caseItem.doctorCompleted ? 'Yes' : 'No',
    'Pharmacist Completed': caseItem.pharmacistCompleted ? 'Yes' : 'No',
    'Incomplete': caseItem.isIncomplete ? 'Yes' : 'No'
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const columnWidths = [
    { wch: 20 }, // Case ID
    { wch: 15 }, // Clinic Code
    { wch: 20 }, // Partner
    { wch: 20 }, // Doctor
    { wch: 20 }, // Pharmacist
    { wch: 25 }, // Patient Name
    { wch: 15 }, // Created Date
    { wch: 15 }, // Start Time
    { wch: 15 }, // End Time
    { wch: 15 }, // Queue
    { wch: 15 }, // Status
    { wch: 15 }, // Doctor Completed
    { wch: 20 }, // Pharmacist Completed
    { wch: 15 }  // Incomplete
  ];
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cases');

  // Create Excel file and download
  XLSX.writeFile(workbook, fileName);
};

// Helper function to format date
const formatDate = (dateObj) => {
  if (!dateObj) return 'N/A';
  
  try {
    if (dateObj.toDate && typeof dateObj.toDate === 'function') {
      return dateObj.toDate().toLocaleDateString("en-US");
    }
    
    if (dateObj instanceof Date) {
      return dateObj.toLocaleDateString("en-US");
    }
    
    if (typeof dateObj === 'string') {
      return new Date(dateObj).toLocaleDateString("en-US");
    }
    
    return 'Invalid Date';
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'Error';
  }
};

// Helper function to format time
const formatTime = (dateObj) => {
  if (!dateObj) return 'N/A';
  
  try {
    if (dateObj.toDate && typeof dateObj.toDate === 'function') {
      return dateObj.toDate().toLocaleTimeString("en-US", {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    if (dateObj instanceof Date) {
      return dateObj.toLocaleTimeString("en-US", {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    if (typeof dateObj === 'string') {
      return new Date(dateObj).toLocaleTimeString("en-US", {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return 'Invalid Time';
  } catch (error) {
    console.error("Error formatting time:", error);
    return 'Error';
  }
};

// Helper function to get queue status
const getQueueStatus = (caseItem) => {
  if (caseItem.isIncomplete) {
    return 'Incomplete';
  } else if (!caseItem.doctorCompleted) {
    return 'Doctor';
  } else if (caseItem.doctorCompleted && !caseItem.pharmacistCompleted) {
    return 'Pharmacist';
  } else {
    return 'Completed';
  }
};

// Helper function to get status label
const getStatusLabel = (caseItem) => {
  if (caseItem.isIncomplete) {
    return 'Incomplete';
  } else if (caseItem.doctorCompleted && caseItem.pharmacistCompleted) {
    return 'Completed';
  } else {
    return 'Pending';
  }
};