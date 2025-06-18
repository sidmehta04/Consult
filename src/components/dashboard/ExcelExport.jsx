import * as XLSX from 'xlsx';

export const exportCasesToExcel = (cases, fileName = 'cases_export.xlsx') => {
  if (!cases || cases.length === 0) {
    console.warn('No cases data to export');
    return;
  }

  // Get all unique keys from all cases to ensure we capture every possible column
  const allKeys = new Set();
  cases.forEach(caseItem => {
    getAllNestedKeys(caseItem, '', allKeys);
  });

  // Convert set to array and sort for consistent column order
  const sortedKeys = Array.from(allKeys).sort();

  // Transform cases for Excel export dynamically
  const excelData = cases.map(caseItem => {
    const row = {};
    
    sortedKeys.forEach(key => {
      const value = getNestedValue(caseItem, key);
      row[formatColumnHeader(key)] = formatCellValue(value);
    });

    return row;
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set dynamic column widths based on content
  const columnWidths = sortedKeys.map(key => {
    const header = formatColumnHeader(key);
    const maxLength = Math.max(
      header.length,
      ...excelData.map(row => String(row[header] || '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) }; // Min 10, Max 50 characters
  });
  
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cases');

  // Create Excel file and download
  XLSX.writeFile(workbook, fileName);
};

// Helper function to get all nested keys from an object
const getAllNestedKeys = (obj, prefix = '', keysSet) => {
  if (obj === null || obj === undefined) return;
  
  if (typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
    Object.keys(obj).forEach(key => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      keysSet.add(newKey);
      getAllNestedKeys(obj[key], newKey, keysSet);
    });
  } else {
    if (prefix) {
      keysSet.add(prefix);
    }
  }
};

// Helper function to get nested value from object using dot notation
const getNestedValue = (obj, path) => {
  if (!path) return obj;
  
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return null;
    return current[key];
  }, obj);
};

// Helper function to format column headers
const formatColumnHeader = (key) => {
  return key
    .split('.')
    .map(part => 
      part.replace(/([A-Z])/g, ' $1') // Add space before capital letters
          .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
          .trim()
    )
    .join(' > '); // Use ' > ' to show nesting
};

// Helper function to format cell values
const formatCellValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Handle dates
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US");
  }
  
  // Handle Firestore timestamps or objects with toDate method
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      return value.toDate().toLocaleDateString("en-US");
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  // Handle objects (convert to JSON string)
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '[Object]';
    }
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  // Handle strings and numbers
  return String(value);
};

// Optional: Enhanced version with custom formatting rules
export const exportCasesToExcelWithCustomFormatting = (cases, fileName = 'cases_export.xlsx', options = {}) => {
  const {
    excludeKeys = [], // Keys to exclude from export
    customHeaders = {}, // Custom header names: { 'originalKey': 'Custom Header' }
    customFormatters = {}, // Custom formatters: { 'keyName': (value) => formatted }
    dateFields = [], // Fields that should be formatted as dates
    timeFields = [], // Fields that should be formatted as times
    booleanFields = [] // Fields that should be formatted as Yes/No
  } = options;

  if (!cases || cases.length === 0) {
    console.warn('No cases data to export');
    return;
  }

  // Get all unique keys from all cases
  const allKeys = new Set();
  cases.forEach(caseItem => {
    getAllNestedKeys(caseItem, '', allKeys);
  });

  // Filter out excluded keys
  const filteredKeys = Array.from(allKeys)
    .filter(key => !excludeKeys.some(excludeKey => key.includes(excludeKey)))
    .sort();

  // Transform cases for Excel export
  const excelData = cases.map(caseItem => {
    const row = {};
    
    filteredKeys.forEach(key => {
      const value = getNestedValue(caseItem, key);
      const header = customHeaders[key] || formatColumnHeader(key);
      
      // Apply custom formatting if available
      if (customFormatters[key]) {
        row[header] = customFormatters[key](value);
      } else if (dateFields.includes(key)) {
        row[header] = formatDate(value);
      } else if (timeFields.includes(key)) {
        row[header] = formatTime(value);
      } else if (booleanFields.includes(key)) {
        row[header] = value ? 'Yes' : 'No';
      } else {
        row[header] = formatCellValue(value);
      }
    });

    return row;
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set dynamic column widths
  const headers = Object.keys(excelData[0] || {});
  const columnWidths = headers.map(header => {
    const maxLength = Math.max(
      header.length,
      ...excelData.map(row => String(row[header] || '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cases');

  // Create Excel file and download
  XLSX.writeFile(workbook, fileName);
};

// Helper function to format date
const formatDate = (dateObj) => {
  if (!dateObj) return '';
  
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
    
    return '';
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'Error';
  }
};

// Helper function to format time
const formatTime = (dateObj) => {
  if (!dateObj) return '';
  
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
    
    return '';
  } catch (error) {
    console.error("Error formatting time:", error);
    return 'Error';
  }
};