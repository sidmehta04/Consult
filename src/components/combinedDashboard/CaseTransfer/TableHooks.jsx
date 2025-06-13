// CaseTransfer/TableHooks.jsx
// Contains all custom hooks for the transfer table

import { useState, useMemo, useCallback, useEffect } from "react";

// Constants
const CASES_PER_PAGE = 20;
const MAX_VISIBLE_PAGES = 5;

// Custom hook for pagination logic
export const usePagination = (items, itemsPerPage = CASES_PER_PAGE) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = items.slice(startIndex, endIndex);

    return {
      totalPages,
      startIndex,
      endIndex,
      currentItems,
      totalItems: items.length,
    };
  }, [items, currentPage, itemsPerPage]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const { totalPages } = paginationData;

    if (totalPages <= MAX_VISIBLE_PAGES) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, paginationData.totalPages]);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, paginationData.totalPages));
  }, [paginationData.totalPages]);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToPage = useCallback(
    (page) => {
      if (page >= 1 && page <= paginationData.totalPages) {
        setCurrentPage(page);
      }
    },
    [paginationData.totalPages]
  );

  // Reset to first page when items change
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  return {
    ...paginationData,
    currentPage,
    pageNumbers,
    goToNextPage,
    goToPreviousPage,
    goToPage,
  };
};

// Enhanced bulk selection hook to support both doctor and pharmacist transfers
export const useBulkSelection = (cases) => {
  const [selectedCases, setSelectedCases] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Filter transferable cases (all cases can have pharmacist transferred, only doctor queue for doctor transfer)
  const transferableCases = useMemo(() => 
    cases.filter(caseItem => true), // All cases are transferable for pharmacist
    [cases]
  );

  const transferableCaseIds = useMemo(() => 
    transferableCases.map(c => c.id), 
    [transferableCases]
  );

  // Calculate selection state
  const selectionState = useMemo(() => {
    const selectedTransferableCount = Array.from(selectedCases)
      .filter(id => transferableCaseIds.includes(id)).length;
    
    return {
      selectedCount: selectedTransferableCount,
      totalTransferable: transferableCases.length,
      isAllSelected: selectedTransferableCount === transferableCases.length && transferableCases.length > 0,
      isIndeterminate: selectedTransferableCount > 0 && selectedTransferableCount < transferableCases.length,
      hasSelection: selectedTransferableCount > 0,
    };
  }, [selectedCases, transferableCases, transferableCaseIds]);

  const toggleBulkMode = useCallback(() => {
    setBulkMode(prev => {
      if (prev) {
        // Exiting bulk mode, clear selections
        setSelectedCases(new Set());
      }
      return !prev;
    });
  }, []);

  const selectCase = useCallback((caseId, checked) => {
    setSelectedCases(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(caseId);
      } else {
        newSet.delete(caseId);
      }
      return newSet;
    });
  }, []);

  const selectAllTransferable = useCallback((checked) => {
    setSelectedCases(prev => {
      const newSet = new Set(prev);
      transferableCaseIds.forEach(id => {
        if (checked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
      });
      return newSet;
    });
  }, [transferableCaseIds]);

  const clearSelection = useCallback(() => {
    setSelectedCases(new Set());
  }, []);

  const getSelectedCases = useCallback(() => {
    return transferableCases.filter(caseItem => selectedCases.has(caseItem.id));
  }, [transferableCases, selectedCases]);

  // Clear selections when cases change significantly
  useEffect(() => {
    setSelectedCases(prev => {
      const validIds = new Set(transferableCaseIds);
      const filtered = new Set(Array.from(prev).filter(id => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [transferableCaseIds]);

  return {
    bulkMode,
    selectedCases,
    selectionState,
    toggleBulkMode,
    selectCase,
    selectAllTransferable,
    clearSelection,
    getSelectedCases,
  };
};

// Custom hook for transfer dialog state management
export const useTransferDialog = () => {
  const [transferDialog, setTransferDialog] = useState({
    open: false,
    case: null,
    cases: [],
    selectedPersonId: "",
    transferType: "", // 'doctor' or 'pharmacist'
    isBulk: false,
  });

  const openTransferDialog = useCallback((caseItem, transferType) => {
    setTransferDialog({
      open: true,
      case: caseItem,
      cases: [],
      selectedPersonId: "",
      transferType,
      isBulk: false,
    });
  }, []);

  const openBulkTransferDialog = useCallback((selectedCases, transferType) => {
    if (selectedCases.length === 0) {
      return { error: "Please select cases to transfer." };
    }

    setTransferDialog({
      open: true,
      case: null,
      cases: selectedCases,
      selectedPersonId: "",
      transferType,
      isBulk: true,
    });

    return { success: true };
  }, []);

  const closeTransferDialog = useCallback(() => {
    setTransferDialog({
      open: false,
      case: null,
      cases: [],
      selectedPersonId: "",
      transferType: "",
      isBulk: false,
    });
  }, []);

  const updateSelectedPersonId = useCallback((personId) => {
    setTransferDialog(prev => ({
      ...prev,
      selectedPersonId: personId,
    }));
  }, []);

  return {
    transferDialog,
    openTransferDialog,
    openBulkTransferDialog,
    closeTransferDialog,
    updateSelectedPersonId,
  };
};

// Custom hook for select styles to prevent recreation
export const useSelectStyles = () => {
  return useMemo(() => ({
    control: (base, state) => ({
      ...base,
      minHeight: '38px',
      borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? '#3b82f6' : '#9ca3af',
      },
      backgroundColor: '#ffffff',
      fontSize: '14px',
    }),
    menu: (base) => ({
      ...base,
      zIndex: 50,
      border: '1px solid #d1d5db',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      backgroundColor: '#ffffff',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? '#3b82f6'
        : state.isFocused
        ? '#eff6ff'
        : 'white',
      color: state.isSelected ? 'white' : '#374151',
      cursor: 'pointer',
      padding: '10px 12px',
      '&:active': {
        backgroundColor: state.isSelected ? '#3b82f6' : '#dbeafe',
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: '#374151',
    }),
    placeholder: (base) => ({
      ...base,
      color: '#9ca3af',
    }),
    input: (base) => ({
      ...base,
      color: '#374151',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: '#d1d5db',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: '#6b7280',
      '&:hover': {
        color: '#374151',
      },
    }),
  }), []);
};

// Custom hook for dialog select styles
export const useDialogSelectStyles = () => {
  const baseStyles = useSelectStyles();
  
  return useMemo(() => ({
    ...baseStyles,
    control: (base, state) => ({
      ...baseStyles.control(base, state),
      minHeight: "40px",
    }),
    option: (base, state) => ({
      ...baseStyles.option(base, state),
      backgroundColor: state.isDisabled 
        ? '#f9fafb' 
        : state.isSelected
        ? '#3b82f6'
        : state.isFocused
        ? '#eff6ff'
        : 'white',
      color: state.isDisabled 
        ? '#9ca3af'
        : state.isSelected 
        ? 'white' 
        : '#374151',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      padding: '8px 12px',
      '&:active': {
        backgroundColor: state.isDisabled 
          ? '#f9fafb'
          : state.isSelected 
          ? '#3b82f6' 
          : '#dbeafe',
      },
    }),
  }), [baseStyles]);
};

// Custom hook for option processing
export const useProcessedOptions = (doctors, pharmacists) => {
  const doctorOptions = useMemo(() => {
    const availableDoctors = doctors.filter((doctor) => doctor.isAvailable);
    
    return availableDoctors.map((doctor) => {
      const canAcceptMoreCases = doctor.caseCount < 10;
      const statusIndicator = canAcceptMoreCases ? "" : " (At Capacity)";
      
      return {
        value: doctor.id,
        label: `${doctor.name} (${doctor.caseCount}/10 cases)${statusIndicator}`,
        person: doctor,
        isDisabled: !canAcceptMoreCases,
      };
    });
  }, [doctors]);

  const pharmacistOptions = useMemo(() => {
    const availablePharmacists = pharmacists.filter((pharmacist) => pharmacist.isAvailable);
    
    return availablePharmacists.map((pharmacist) => {
      const canAcceptMoreCases = pharmacist.caseCount < 15; // Assuming pharmacists can handle more cases
      const statusIndicator = canAcceptMoreCases ? "" : " (At Capacity)";
      
      return {
        value: pharmacist.id,
        label: `${pharmacist.name} (${pharmacist.caseCount}/15 cases)${statusIndicator}`,
        person: pharmacist,
        isDisabled: !canAcceptMoreCases,
      };
    });
  }, [pharmacists]);

  const doctorFilterOptions = useMemo(() => {
    return doctors.map((doctor) => ({
      value: doctor.id,
      label: doctor.name,
      doctor,
    }));
  }, [doctors]);

  return {
    doctorOptions,
    pharmacistOptions,
    doctorFilterOptions,
  };
};