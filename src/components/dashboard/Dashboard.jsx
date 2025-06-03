import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Select from "react-select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  doc,
  getDocs,
  onSnapshot,
  collection,
  query,
  where,
  limit,
  orderBy,
  getCountFromServer,
} from "firebase/firestore";
import { firestore } from "../../firebase";

import { exportCasesToExcel } from "./ExcelExport";
import CasesTable from "./CaseTable";
import DashboardSummaryCards from "./Summary";
import TabNavigation from "./TabNavigation";
import FilterBar from "./FilterBar";
import TableHeader from "./TableHeader";
import {
  EmptyStateMessage,
  NoResultsMessage,
  RoleBasedAccessMessage,
} from "./EmptyState";

import {
  calculateCaseContribution,
  fetchTabData,
  getClinicMapping,
} from "./datafetcher";

const Dashboard = ({ currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchingData, setFetchingData] = useState(false);

  const [partnerName, setPartnerName] = useState(null);
  const [tableData, setTableData] = useState(null);

  const [activeTab, setActiveTab] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const [refreshInterval, setRefreshInterval] = useState(60000);

  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState("all");
  const [partnersList, setPartnersList] = useState([]);
  const [partnerFilter, setPartnerFilter] = useState([]);
  const [clinicFilter, setClinicFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [activeColumnFilter, setActiveColumnFilter] = useState(null);
  const [resetTimestamp, setResetTimestamp] = useState(Date.now());
  const [refresh, setRefresh] = useState(false);
  

  // OPTIMIZATION 1: Use lazy loading for summary counts
  const [summaryCounts, setSummaryCounts] = useState({
    totalCases: 0, pendingCases: 0, completedCases: 0, doctorPendingCases: 0,
    pharmacistPendingCases: 0, incompleteCases: 0, todayCases: 0,
    todayCompleted: 0, todayIncomplete: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(false);

  const [clinicMapping, setClinicMapping] = useState(null);

  const unsubscribeRef = useRef(null);
  const recentCasesCacheRef = useRef(new Map());
  const initialLoadCompleteRef = useRef(false);
  const listenerCachePopulatedRef = useRef(false);

  // OPTIMIZATION 2: Memoize clinic mapping and partners setup
  const setupClinicData = useCallback(async () => {
    try {
      const [mapping, partnerNames] = await getClinicMapping();
      setClinicMapping(mapping);

      const formattedPartners = partnerNames.map(partner => ({
        value: partner,
        label: partner,
      }));

      setPartnersList(formattedPartners);

      if (["ro"].includes(currentUser?.role) && currentUser?.uid) {
        setPartnerName(currentUser.partnerName);
        setPartnersList([{
          value: currentUser.partnerName,
          label: currentUser.partnerName
        }]);
      }
    } catch (error) {
      console.error("Error setting up clinic data:", error);
      setError("Failed to load clinic data");
    }
  }, [currentUser?.role, currentUser?.uid, currentUser?.partnerName]);

  // OPTIMIZATION 3: Setup clinic data once on mount
  useEffect(() => {
    setupClinicData();
  }, [setupClinicData]);

  const handlePartnerChange = useCallback((selectedOption) => {
    const newPartnerName = selectedOption ? selectedOption.value : null;
    setPartnerName(newPartnerName);
    
    // Clear the current listener and cache when partner changes
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    recentCasesCacheRef.current.clear();
    initialLoadCompleteRef.current = false;
    listenerCachePopulatedRef.current = false;
    
    // Reset counts to trigger reload with new partner filter
    setCountsLoaded(false);
    setSummaryCounts({
      totalCases: 0, pendingCases: 0, completedCases: 0, doctorPendingCases: 0,
      pharmacistPendingCases: 0, incompleteCases: 0, todayCases: 0,
      todayCompleted: 0, todayIncomplete: 0,
    });
    
    // If there's an active tab, reload the data with new partner filter
    if (activeTab) {
      const currentFilters = {
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: newPartnerName,
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        doctor: doctorFilter !== "all" ? doctorFilter : null,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        searchTerm: searchTerm || null,
      };
      loadTabData(activeTab, currentFilters);
    }
  }, [activeTab, statusFilter, queueFilter, clinicFilter, doctorFilter, dateRange, searchTerm]);

  // OPTIMIZATION 4: Lazy load summary counts - only when user explicitly requests or after initial render
  const loadSummaryCounts = useCallback(async () => {
    // Add firestore check here
    if (!currentUser?.uid || !currentUser?.role || !firestore || !clinicMapping) {
      console.log("Missing requirements for loadSummaryCounts:", {
        uid: !!currentUser?.uid,
        role: !!currentUser?.role,
        firestore: !!firestore,
        clinicMapping: !!clinicMapping
      });
      return;
    }

    setLoadingCounts(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let initialQueryParam;

      switch (currentUser.role) {
        case "superAdmin":
        case "zonalHead":
        case "drManager":
        case "teamLeader":
          break;
        case "doctor":
          initialQueryParam = where("assignedDoctors.primary", "==", currentUser.uid);
          break;
        case "pharmacist":
          initialQueryParam = where("pharmacistId", "==", currentUser.uid);
          break;
        default:
          initialQueryParam = where("createdBy", "==", currentUser.uid);
          break;
      }

      const casesRef = collection(firestore, "cases");

      const withPartner = (filters) => {
        const baseFilters = initialQueryParam ? [initialQueryParam, ...filters] : filters;
        return partnerName ? [where("partnerName", "==", partnerName), ...baseFilters] : baseFilters;
      };

      // OPTIMIZATION 5: Run only essential counts first, defer others
      const essentialQueries = [
        getCountFromServer(query(casesRef, ...withPartner([]))),
        getCountFromServer(query(casesRef, ...withPartner([where("status", "==", "completed")])))
      ];

      const [totalCount, completedCount] = await Promise.all(essentialQueries);

      // Set essential counts immediately
      setSummaryCounts(prev => ({
        ...prev,
        totalCases: totalCount.data().count,
        completedCases: completedCount.data().count,
      }));
      setLoadingCounts(false);

      // OPTIMIZATION 6: Load remaining counts in background
      setTimeout(async () => {
        try {
          const [
            incompleteCount,
            docPendingCount,
            pharmPendingCount,
            todayCount,
            todayCompleted,
            todayIncomplete
          ] = await Promise.all([
            getCountFromServer(query(casesRef, ...withPartner([where("isIncomplete", "==", true)]))),
            getCountFromServer(query(casesRef, ...withPartner([where("doctorCompleted", "==", false)]))),
            getCountFromServer(query(casesRef, ...withPartner([
              where("doctorCompleted", "==", true),
              where("pharmacistCompleted", "==", false),
              where("isIncomplete", "==", false)
            ]))),
            getCountFromServer(query(casesRef, ...withPartner([
              where("createdAt", ">=", today),
              where("createdAt", "<", tomorrow)
            ]))),
            getCountFromServer(query(casesRef, ...withPartner([
              where("status", "==", "completed"),
              where("createdAt", ">=", today),
              where("createdAt", "<", tomorrow)
            ]))),
            getCountFromServer(query(casesRef, ...withPartner([
              where("isIncomplete", "==", true),
              where("createdAt", ">=", today),
              where("createdAt", "<", tomorrow)
            ])))
          ]);

          const pendingCases = docPendingCount.data().count + pharmPendingCount.data().count;

          setSummaryCounts({
            totalCases: totalCount.data().count,
            pendingCases: pendingCases,
            completedCases: completedCount.data().count,
            doctorPendingCases: docPendingCount.data().count,
            pharmacistPendingCases: pharmPendingCount.data().count,
            incompleteCases: incompleteCount.data().count,
            todayCases: todayCount.data().count,
            todayCompleted: todayCompleted.data().count,
            todayIncomplete: todayIncomplete.data().count,
          });
        } catch (backgroundError) {
          console.error("Background count loading failed:", backgroundError);
        }
      }, 100); // Load in background after 100ms

    } catch (e) {
      console.error("Initial Load Error:", e);
      setError("Failed to load summary data.");
      setLoadingCounts(false);
    }
  }, [currentUser, partnerName, clinicMapping]);

  // OPTIMIZATION 7: Only load counts when clinicMapping is ready and user requests it
  const [countsLoaded, setCountsLoaded] = useState(false);

  // Trigger count loading only when explicitly needed
  const triggerCountsLoad = useCallback(() => {
    if (!countsLoaded && clinicMapping) {
      setCountsLoaded(true);
      loadSummaryCounts();
    }
  }, [countsLoaded, clinicMapping, loadSummaryCounts]);

  // Add effect to reload counts when partner changes
  useEffect(() => {
    if (countsLoaded && clinicMapping) {
      loadSummaryCounts();
    }
  }, [partnerName, loadSummaryCounts, countsLoaded, clinicMapping]);

  // Auto-load summary cards when clinicMapping becomes available
  useEffect(() => {
    if (clinicMapping && !countsLoaded) {
      setCountsLoaded(true);
      loadSummaryCounts();
    }
  }, [clinicMapping, countsLoaded, loadSummaryCounts]);

  // Handle partner change for summary cards
  useEffect(() => {
    if (clinicMapping && partnerName !== null) {
      // When partner changes, reload the counts
      setTimeout(() => {
        if (!countsLoaded) {
          setCountsLoaded(true);
        }
        loadSummaryCounts();
      }, 100);
    }
  }, [partnerName, clinicMapping, loadSummaryCounts, countsLoaded]);

  // OPTIMIZATION 8: Memoized helper to update global counts
  const applyCountChanges = useCallback((singleCaseContribution, operation) => {
    setSummaryCounts(prevGlobalCounts => {
      const newGlobalCounts = { ...prevGlobalCounts };
      const factor = operation === 'add' ? 1 : -1;
      for (const key in singleCaseContribution) {
        newGlobalCounts[key] = (newGlobalCounts[key] || 0) + (factor * singleCaseContribution[key]);
      }
      if (singleCaseContribution.doctorPendingCases !== undefined || singleCaseContribution.pharmacistPendingCases !== undefined) {
        newGlobalCounts.pendingCases = (newGlobalCounts.doctorPendingCases || 0) + (newGlobalCounts.pharmacistPendingCases || 0);
      }
      return newGlobalCounts;
    });
  }, []);

  // OPTIMIZATION 9: Setup real-time listener only when needed
  const setupRealtimeListener = useCallback(() => {
    // Add comprehensive checks before setting up listener
    if (!currentUser?.uid || !currentUser?.role || !firestore || unsubscribeRef.current) {
      console.log("Cannot setup listener - missing requirements:", {
        uid: !!currentUser?.uid,
        role: !!currentUser?.role,
        firestore: !!firestore,
        alreadyExists: !!unsubscribeRef.current
      });
      return;
    }

    try {
      let listenerQuery;
      const baseQuery = collection(firestore, "cases");
      
      switch (currentUser.role) {
        case "superAdmin":
        case "zonalHead":
        case "drManager":
        case "teamLeader":
          listenerQuery = query(baseQuery, orderBy("createdAt", "desc"), limit(200));
          break;
        case "doctor":
          listenerQuery = query(baseQuery, where("assignedDoctors.primary", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(200));
          break;
        case "pharmacist":
          listenerQuery = query(baseQuery, where("pharmacistId", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(200));
          break;
        default:
          listenerQuery = query(baseQuery, where("createdBy", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(200));
          break;
      }

      unsubscribeRef.current = onSnapshot(listenerQuery, (snapshot) => {
        if (!initialLoadCompleteRef.current) {
          // First snapshot - just populate cache
          snapshot.docs.forEach(doc => {
            recentCasesCacheRef.current.set(doc.id, doc.data());
          });
          listenerCachePopulatedRef.current = true;
          initialLoadCompleteRef.current = true;
          return;
        }

        // Process changes for real-time updates
        const snapTodayDate = new Date();
        snapTodayDate.setHours(0, 0, 0, 0);
        const snapTomorrowDate = new Date(snapTodayDate);
        snapTomorrowDate.setDate(snapTomorrowDate.getDate() + 1);
        const snapTodayEpoch = Math.floor(snapTodayDate.getTime() / 1000);
        const snapTomorrowEpoch = Math.floor(snapTomorrowDate.getTime() / 1000);

        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id;
          const newCaseData = change.doc.exists() ? change.doc.data() : null;
          const oldCaseDataFromCache = recentCasesCacheRef.current.get(docId);

          if (change.type === "added" && newCaseData && !oldCaseDataFromCache) {
            applyCountChanges(calculateCaseContribution(newCaseData, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'add');
            recentCasesCacheRef.current.set(docId, newCaseData);
          } else if (change.type === "modified" && newCaseData && oldCaseDataFromCache) {
            applyCountChanges(calculateCaseContribution(oldCaseDataFromCache, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'subtract');
            applyCountChanges(calculateCaseContribution(newCaseData, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'add');
            recentCasesCacheRef.current.set(docId, newCaseData);
          } else if (change.type === "removed" && oldCaseDataFromCache) {
            applyCountChanges(calculateCaseContribution(oldCaseDataFromCache, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'subtract');
            recentCasesCacheRef.current.delete(docId);
          }
        });
      }, (err) => {
        console.error("Listener Error:", err);
        setError("Real-time updates failed.");
      });
    } catch (error) {
      console.error("Error setting up listener:", error);
    }
  }, [currentUser, applyCountChanges, partnerName, clinicMapping]);

  // Handle excel export
  const handleExcelExport = useCallback(() => {
    if (!tableData?.cases || tableData.cases.length === 0) {
      alert("No data available to export.");
      return;
    }
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const fileName = `cases_export_${dateStr}.xlsx`;
    try {
      exportCasesToExcel(tableData.cases, fileName);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      alert("Failed to export data. Please try again.");
    }
  }, [tableData?.cases]);

  const handleRefresh = useCallback(async () => {
    setRefresh(!refresh);
    loadTabData();
  });

  // OPTIMIZATION 10: Debounced auto-refresh
  useEffect(() => {
    if (refreshInterval === 0) return;
    
    const interval = setInterval(handleRefresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, handleRefresh]);

  // Load specific tab data when requested
  const loadTabData = useCallback(
    async (tabName, filters = {}) => {
      if (!currentUser?.role || !currentUser?.uid || !clinicMapping) {
        return;
      }
      
      setFetchingData(true);
      try {
        const activeFilters = {
          status: filters.status !== undefined ? filters.status : (statusFilter !== "all" ? statusFilter : null),
          queue: filters.queue !== undefined ? filters.queue : (queueFilter !== "all" ? queueFilter : null),
          partner: filters.partner !== undefined ? filters.partner : (partnerName || (partnerFilter !== "all" ? partnerFilter : null)),
          clinic: filters.clinic !== undefined ? filters.clinic : (clinicFilter !== "all" ? clinicFilter : null),
          doctor: filters.doctor !== undefined ? filters.doctor : (doctorFilter !== "all" ? doctorFilter : null),
          dateFrom: filters.dateFrom !== undefined ? filters.dateFrom : dateRange.from,
          dateTo: filters.dateTo !== undefined ? filters.dateTo : dateRange.to,
          searchTerm: filters.searchTerm !== undefined ? filters.searchTerm : (searchTerm || null),
        };

        const tabData = await fetchTabData(
          currentUser.uid,
          currentUser.role,
          tabName,
          activeFilters,
          { page: 1, pageSize: 200 },
          clinicMapping
        );

        setTableData({
          cases: tabData.cases,
          uniquePartners: tabData.uniquePartners,
          uniqueClinics: tabData.uniqueClinics,
          uniqueDoctors: tabData.uniqueDoctors,
          pagination: tabData.pagination,
        });
        setShowTable(true);
      } catch (err) {
        console.error("Error fetching tab data:", err);
        setError("Failed to load case data. Please try again.");
      } finally {
        setFetchingData(false);
      }
    },
    [currentUser?.uid, currentUser?.role, statusFilter, queueFilter, partnerName, partnerFilter, clinicFilter, dateRange, searchTerm, clinicMapping]
  );

  // OPTIMIZATION 11: Memoize filters
  const handleFilterReset = useCallback(() => {
    const emptyFilters = {
      status: null, queue: null, partner: null, clinic: null, doctor: null,
      dateFrom: null, dateTo: null, searchTerm: null,
    };

    setDateRange({ from: null, to: null });
    setSearchTerm("");
    setStatusFilter("all");
    setQueueFilter("all");
    setPartnerFilter("all");
    setClinicFilter("all");
    setActiveColumnFilter(null);
    setResetTimestamp(Date.now());

    if (activeTab) {
      loadTabData(activeTab, emptyFilters);
    }
  }, [activeTab, loadTabData]);

  const handleSingleFilterReset = useCallback(
    (filterType) => {
      let newFilters = {
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: partnerName || (partnerFilter.length > 0 ? partnerFilter : null),
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        doctor: doctorFilter !== "all" ? doctorFilter : null,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        searchTerm: searchTerm || null,
      };

      switch (filterType) {
        case "status": setStatusFilter("all"); newFilters.status = null; break;
        case "queue": setQueueFilter("all"); newFilters.queue = null; break;
        case "partner": setPartnerFilter([]); newFilters.partner = null; break;
        case "clinic": setClinicFilter("all"); newFilters.clinic = null; break;
        case "doctor": setDoctorFilter("all"); newFilters.doctor = null; break;
        case "date": setDateRange({ from: null, to: null }); newFilters.dateFrom = null; newFilters.dateTo = null; break;
        case "search": setSearchTerm(""); newFilters.searchTerm = null; break;
        default: break;
      }
      setActiveColumnFilter(null);
      if (activeTab) {
        loadTabData(activeTab, newFilters);
      }
    },
    [activeTab, loadTabData, statusFilter, queueFilter, partnerName, partnerFilter, clinicFilter, dateRange, searchTerm]
  );

  const handleFilterApply = useCallback((filterType, value) => {
    let updatedFilters = {
      status: statusFilter !== "all" ? statusFilter : null,
      queue: queueFilter !== "all" ? queueFilter : null,
      partner: partnerName || (partnerFilter.length > 0 ? partnerFilter : null),
      clinic: clinicFilter !== "all" ? clinicFilter : null,
      doctor: doctorFilter !== "all" ? doctorFilter : null,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      searchTerm: searchTerm || null,
    };

    switch (filterType) {
      case "status": setStatusFilter(value); updatedFilters.status = value === "all" ? null : value; break;
      case "queue": setQueueFilter(value); updatedFilters.queue = value === "all" ? null : value; break;
      case "partner": setPartnerFilter(value); updatedFilters.partner = value.length === 0 ? null : value; break;
      case "clinic": setClinicFilter(value); updatedFilters.clinic = value === "all" ? null : value; break;
      case "doctor": setDoctorFilter(value); updatedFilters.doctor = value === "all" ? null : value; break;
      case "date": setDateRange(value); updatedFilters.dateFrom = value.from; updatedFilters.dateTo = value.to; break;
      default: break;
    }
    if (filterType !== "partner") setActiveColumnFilter(null);
    
    if (activeTab) {
      loadTabData(activeTab, updatedFilters);
    }
  }, [activeTab, loadTabData, statusFilter, queueFilter, partnerName, partnerFilter, clinicFilter, dateRange, searchTerm]);

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    if (value === "" && activeTab) {
      const currentFilters = {
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: partnerName || (partnerFilter !== "all" ? partnerFilter : null),
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        doctor: doctorFilter !== "all" ? doctorFilter : null,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        searchTerm: "",
      };
      loadTabData(activeTab, currentFilters);
    }
  }, [activeTab, loadTabData, statusFilter, queueFilter, partnerName, partnerFilter, clinicFilter, dateRange]);

  const handleSearchSubmit = useCallback((value) => {
    setSearchTerm(value);
    if (activeTab) {
      const updatedFilters = {
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: partnerName || (partnerFilter !== "all" ? partnerFilter : null),
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        doctor: doctorFilter !== "all" ? doctorFilter : null,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        searchTerm: value,
      };
      loadTabData(activeTab, updatedFilters);
    }
  }, [activeTab, loadTabData, statusFilter, queueFilter, partnerName, partnerFilter, clinicFilter, dateRange]);

  const handleTabChange = useCallback((newTabName) => {
    if (newTabName === activeTab) return;
    if (!clinicMapping) return;

    setActiveTab(newTabName);
    
    // Trigger counts loading if not already loaded
    triggerCountsLoad();
    
    // Setup real-time listener if not already setup and firestore is available
    if (!unsubscribeRef.current && firestore) {
      setupRealtimeListener();
    }

    const currentFiltersForNewTab = {
      status: statusFilter !== "all" ? statusFilter : null,
      queue: queueFilter !== "all" ? queueFilter : null,
      partner: partnerName || (partnerFilter !== "all" ? partnerFilter : null),
      clinic: clinicFilter !== "all" ? clinicFilter : null,
      doctor: doctorFilter !== "all" ? doctorFilter : null,
      searchTerm: searchTerm || null,
    };

    loadTabData(newTabName, currentFiltersForNewTab);
  }, [activeTab, loadTabData, statusFilter, queueFilter, partnerName, partnerFilter, clinicFilter, searchTerm, clinicMapping, triggerCountsLoad, setupRealtimeListener]);

  // OPTIMIZATION 12: Memoize clinic and doctor options
  const clinicOptions = useMemo(() => 
    tableData?.uniqueClinics?.map((clinic) => ({ value: clinic, label: clinic })) || [], 
    [tableData?.uniqueClinics]
  );
  
  const doctorOptions = useMemo(() => 
    tableData?.uniqueDoctors?.map((doctor) => ({ value: doctor, label: doctor })) || [], 
    [tableData?.uniqueDoctors]
  );

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // --- RENDER LOGIC ---
  if (!currentUser?.role) {
    return <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4 mr-2" /><AlertDescription>User Role Not Recognised</AlertDescription></Alert>;
  }

  if (loading && !clinicMapping && !error) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  }

  if (error) {
    return <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4 mr-2" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cases Dashboard</h2>
        <div className="flex items-center gap-2">
          {["superAdmin", "zonalHead"].includes(currentUser.role) && (
            <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={!tableData?.cases || tableData.cases.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {currentUser.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : ""}
          </Badge>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Auto-refresh:</span>
            <select
              className="border rounded p-1 text-sm"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={0}>Off</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
              <option value={300000}>5 minutes</option>
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={fetchingData || loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm disabled:opacity-50"
          >
            Refresh Now
          </button>
          {["superAdmin", "zonalHead", "teamLeader", "drManager"].includes(currentUser.role) && (
            <div className="w-64">
              <Select
                options={partnersList}
                isClearable
                placeholder="Filter by Partner"
                value={partnerName ? { value: partnerName, label: partnerName } : null}
                onChange={handlePartnerChange}
              />
            </div>
          )}
        </div>
      </div>

      <DashboardSummaryCards
        data={summaryCounts}
        loading={loadingCounts}
        onLoadCounts={triggerCountsLoad} // Allow manual trigger
      />
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab && (
        <FilterBar
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          onFilterReset={handleFilterReset}
          key={resetTimestamp}
        />
      )}

      {!activeTab ? (
        <EmptyStateMessage />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <TableHeader
                    activeColumnFilter={activeColumnFilter}
                    setActiveColumnFilter={setActiveColumnFilter}
                    clinicFilter={clinicFilter}
                    partnerFilter={partnerFilter}
                    doctorFilter={doctorFilter}
                    dateRange={dateRange}
                    clinicOptions={clinicOptions}
                    doctorOptions={doctorOptions}
                    partnerOptions={partnersList}
                    handleFilterApply={handleFilterApply}
                    handleSingleFilterReset={handleSingleFilterReset}
                  />
                </thead>
                {fetchingData ? (
                  <tbody>
                    <tr>
                      <td colSpan="9">
                        <div className="flex justify-center py-8">
                          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody>
                    {tableData?.cases && tableData.cases.length > 0 ? (
                      <CasesTable
                        data={tableData.cases}
                        loading={false}
                        userRole={currentUser.role}
                        currentUser={currentUser}
                        showHeader={false}
                        pagination={tableData.pagination}
                      />
                    ) : (
                      <NoResultsMessage userRole={currentUser.role} />
                    )}
                  </tbody>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {currentUser.role !== "superAdmin" && currentUser.role !== "zonalHead" && (
        <RoleBasedAccessMessage userRole={currentUser.role} />
      )}
    </div>
  );
};

export default Dashboard;