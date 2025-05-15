// Dashboard.jsx - Optimized and fixed for teamLeader, drManager, and RO roles
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
  orderBy,
} from "firebase/firestore";
import { firestore } from "../../firebase";
import {
  // fetchSummaryData, // Not used directly in this component, but by datafetcher
  fetchTabData,
  fetchUserHierarchy,
  fetchTodaySummaryData,
  fetchCounts,
} from "./datafetcher";
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
import { useUserData } from "./userData";

const Dashboard = ({ currentUser }) => {
  // Use custom hook for user data
  const {
    //userData,
    userRole,
    loading: userLoading,
    error: userError,
  } = useUserData(currentUser.uid);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaryData, setSummaryData] = useState(null);
  const [todaySummaryData, setTodaySummaryData] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [userHierarchy, setUserHierarchy] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(60000); // 1 minute refresh by default

  // Store references to unsubscribe from realtime listeners
  const unsubscribeRef = useRef(null);

  // Filters
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [activeColumnFilter, setActiveColumnFilter] = useState(null);
  const [resetTimestamp, setResetTimestamp] = useState(Date.now());

  // Fetch hierarchy data for applicable roles once when component mounts
  useEffect(() => {
    if (
      ["teamLeader", "drManager", "ro"].includes(userRole) &&
      currentUser?.uid
    ) {
      const fetchHierarchy = async () => {
        try {
          const hierarchyData = await fetchUserHierarchy(
            currentUser.uid,
            userRole
          );
          setUserHierarchy(hierarchyData);
        } catch (error) {
          console.error("Error fetching user hierarchy:", error);
        }
      };

      fetchHierarchy();
    }
  }, [currentUser?.uid, userRole]);

  const fetchTodayData = useCallback(async (uid, role) => {
    if (!uid || !role) {
      //console.log("Skipping fetchTodayData: uid or role is missing");
      return;
    }
    //console.log(`Workspaceing today's data for UID: ${uid}, Role: ${role}`);
    try {
      const todayData = await fetchTodaySummaryData(uid, role);
      setTodaySummaryData(todayData);
      //console.log("Today's data fetched:", todayData);
    } catch (error) {
      console.error("Error fetching today's data:", error);
    }
  }, []); // No dependencies on other useCallback hooks defined here

  // Set up realtime listeners for summary data
  const setupRealtimeSummaryListeners = useCallback(async (uid, role) => {
    if (!uid || !role) {
      //console.log("Skipping setupRealtimeSummaryListeners: uid or role is missing");
      return;
    }
    //console.log(`Setting up realtime listeners for UID: ${uid}, Role: ${role}`);
    setLoading(true); // Set loading true at the beginning of summary fetch
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const counts = { /* ... (counts object definition) ... */ };
      // ... (rest of the setupRealtimeSummaryListeners logic remains the same) ...
       // Create an object to store all counts
    counts.totalCases = 0;
    counts.pendingCases = 0;
    counts.completedCases = 0;
    counts.doctorPendingCases = 0;
    counts.pharmacistPendingCases = 0;
    counts.incompleteCases = 0;


    if (["superAdmin", "zonalHead"].includes(role)) {
      try {
        const casesRef = collection(firestore, "cases");
        const [
          totalCount, completedCount, incompleteCount, docPendingCount, pharmPendingCount,
        ] = await Promise.all([
          fetchCounts(query(casesRef)),
          fetchCounts(query(casesRef, where("pharmacistCompleted", "==", true))),
          fetchCounts(query(casesRef, where("isIncomplete", "==", true))),
          fetchCounts(query(casesRef, where("doctorCompleted", "==", false))),
          fetchCounts(query(casesRef, where("doctorCompleted", "==", true), where("pharmacistCompleted", "==", false), where("isIncomplete", "==", false))),
        ]);
        
        counts.totalCases = totalCount.count;
        counts.completedCases = completedCount.count;
        counts.incompleteCases = incompleteCount.count;
        counts.doctorPendingCases = docPendingCount.count;
        counts.pharmacistPendingCases = pharmPendingCount.count;
        counts.pendingCases = counts.doctorPendingCases + counts.pharmacistPendingCases;
        setSummaryData({ summaryData: counts, uniquePartners: [], uniqueClinics: [] });
        //console.log("Summary data updated for admin/zonalHead (counts):", counts);
        setLoading(false);
        return;
      } catch (error) {
        console.error("Error fetching counts:", error);
        setLoading(false); // Ensure loading is false on error
      }
    }

    if (["teamLeader", "drManager", "ro"].includes(role)) {
      try {
        const hierarchyData = userHierarchy || await fetchUserHierarchy(uid, role); // Use existing or fetch
        if (!userHierarchy) setUserHierarchy(hierarchyData); // Set if fetched now
        const userIds = Array.from(hierarchyData.userIds);
        const promises = userIds.flatMap(userId => [
          fetchCounts(query(collection(firestore, "cases"), where("createdBy", "==", userId))),
          fetchCounts(query(collection(firestore, "cases"), where("createdBy", "==", userId), where("pharmacistCompleted", "==", true))),
          fetchCounts(query(collection(firestore, "cases"), where("createdBy", "==", userId), where("isIncomplete", "==", true))),
          fetchCounts(query(collection(firestore, "cases"), where("createdBy", "==", userId), where("doctorCompleted", "==", false), where("isIncomplete", "==", false))),
          fetchCounts(query(collection(firestore, "cases"), where("createdBy", "==", userId), where("doctorCompleted", "==", true), where("pharmacistCompleted", "==", false), where("isIncomplete", "==", false))),
        ]);
        const results = await Promise.all(promises);
        for (let i = 0; i < results.length; i += 5) {
          counts.totalCases += results[i].count;
          counts.completedCases += results[i + 1].count;
          counts.incompleteCases += results[i + 2].count;
          counts.doctorPendingCases += results[i + 3].count;
          counts.pharmacistPendingCases += results[i + 4].count;
        }
        counts.pendingCases = counts.doctorPendingCases + counts.pharmacistPendingCases;
        setSummaryData({ summaryData: counts, uniquePartners: [], uniqueClinics: [] });
        //console.log("Summary data updated for hierarchy role (counts):", counts);
        setLoading(false);
        return;
      } catch (error) {
        console.error("Error fetching hierarchy counts:", error);
         setLoading(false); // Ensure loading is false on error
      }
    }

    let baseQuery;
    switch (role) {
      case "superAdmin": case "zonalHead":
        baseQuery = query(collection(firestore, "cases"), orderBy("createdAt", "desc"), limit(1000));
        break;
      case "teamLeader": case "drManager": case "ro":
        baseQuery = query(collection(firestore, "cases"), where("createdBy", "==", uid), orderBy("createdAt", "desc"), limit(1000));
        break;
      case "doctor":
        baseQuery = query(collection(firestore, "cases"), where("assignedDoctors.primary", "==", uid), orderBy("createdAt", "desc"), limit(1000));
        break;
      case "pharmacist":
        baseQuery = query(collection(firestore, "cases"), where("pharmacistId", "==", uid), orderBy("createdAt", "desc"), limit(1000));
        break;
      default:
        baseQuery = query(collection(firestore, "cases"), where("createdBy", "==", uid), orderBy("createdAt", "desc"), limit(1000));
        break;
    }

    const unsubscribe = onSnapshot(baseQuery, (snapshot) => {
      const uniquePartners = new Set();
      const uniqueClinics = new Set();
      counts.totalCases = snapshot.size;
      counts.pendingCases = 0; counts.completedCases = 0; counts.doctorPendingCases = 0; counts.pharmacistPendingCases = 0; counts.incompleteCases = 0;
      snapshot.forEach((doc) => {
        const caseData = doc.data();
        if (caseData.emrNumbers && caseData.emrNumbers.length > 0) {
          if (caseData.isIncomplete || caseData.status === "doctor_incomplete") counts.incompleteCases+=caseData.emrNumbers.length;
          else if (caseData.doctorCompleted && caseData.pharmacistCompleted) counts.completedCases+=caseData.emrNumbers.length;
          else if (!caseData.doctorCompleted) { counts.doctorPendingCases+=caseData.emrNumbers.length; counts.pendingCases+=caseData.emrNumbers.length; } 
          else if (!caseData.pharmacistCompleted) { counts.pharmacistPendingCases+=caseData.emrNumbers.length; counts.pendingCases+=caseData.emrNumbers.length; }
        } else {
          if (caseData.isIncomplete || caseData.status === "doctor_incomplete") counts.incompleteCases++;
          else if (caseData.doctorCompleted && caseData.pharmacistCompleted) counts.completedCases++;
          else if (!caseData.doctorCompleted) {counts.doctorPendingCases++; counts.pendingCases++; }
          else if (!caseData.pharmacistCompleted) {counts.pharmacistPendingCases++; counts.pendingCases++; }
        }
        
        if (caseData.partnerName) uniquePartners.add(caseData.partnerName);
        if (caseData.clinicCode || caseData.clinicName) uniqueClinics.add(caseData.clinicCode || caseData.clinicName);
      });
      setSummaryData({ summaryData: counts, uniquePartners: Array.from(uniquePartners), uniqueClinics: Array.from(uniqueClinics) });
      //console.log("Summary data updated via onSnapshot:", counts);
      setLoading(false);
    }, (error) => {
      console.error("Error in realtime listener:", error);
      setError("Failed to set up realtime updates. Please refresh the page.");
      setLoading(false);
    });
    unsubscribeRef.current = unsubscribe;
  }, [userHierarchy]); // Added userHierarchy here as it's used before potential fetch

  // Load specific tab data when requested
  const loadTabData = useCallback(
    async (tabName, filters = {}) => {
      if (!userRole || !currentUser?.uid) { // Removed fetchingData from guard, handled by button state
          //console.log("Skipping loadTabData: userRole or currentUser.uid missing.");
          return;
      }
      //console.log(`Loading tab data for: ${tabName} with filters:`, filters);
      setFetchingData(true); // Set fetching true for tab data
      try {
        const activeFilters = {
          status: filters.status !== undefined ? filters.status : (statusFilter !== "all" ? statusFilter : null),
          queue: filters.queue !== undefined ? filters.queue : (queueFilter !== "all" ? queueFilter : null),
          partner: filters.partner !== undefined ? filters.partner : (partnerFilter !== "all" ? partnerFilter : null),
          clinic: filters.clinic !== undefined ? filters.clinic : (clinicFilter !== "all" ? clinicFilter : null),
          dateFrom: filters.dateFrom !== undefined ? filters.dateFrom : dateRange.from,
          dateTo: filters.dateTo !== undefined ? filters.dateTo : dateRange.to,
          searchTerm: filters.searchTerm !== undefined ? filters.searchTerm : (searchTerm || null),
        };

        const tabData = await fetchTabData(
          currentUser.uid,
          userRole,
          tabName,
          activeFilters,
          { page: 1, pageSize: 50 }
        );

        setTableData({
          cases: tabData.cases,
          uniquePartners: tabData.uniquePartners,
          uniqueClinics: tabData.uniqueClinics,
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
    [
      currentUser?.uid,
      userRole,
      statusFilter,
      queueFilter,
      partnerFilter,
      clinicFilter,
      dateRange,
      searchTerm,
      // fetchTabData is an import, not state/prop that changes
    ]
  );

  const handleRefresh = useCallback(async () => {
    //console.log("Refreshing data...");
    if (currentUser?.uid && userRole) {
      // setLoading(true); // Summary loading is handled by setupRealtimeSummaryListeners
      // setFetchingData(true); // Tab data loading is handled by loadTabData
      try {
        await fetchTodayData(currentUser.uid, userRole);
        await setupRealtimeSummaryListeners(currentUser.uid, userRole); // This will set setLoading(false)

        if (activeTab) {
          //console.log(`Refreshing active tab: ${activeTab}`);
          const currentFilters = {
            status: statusFilter !== "all" ? statusFilter : null,
            queue: queueFilter !== "all" ? queueFilter : null,
            partner: partnerFilter !== "all" ? partnerFilter : null,
            clinic: clinicFilter !== "all" ? clinicFilter : null,
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            searchTerm: searchTerm || null,
          };
          await loadTabData(activeTab, currentFilters); // This will setFetchingData(false)
        }
      } catch (e) {
        console.error("Error during manual refresh:", e);
        setError("Failed to refresh data. Please try again.");
        // setLoading(false); // Ensure loading states are reset on error
        // setFetchingData(false);
      }
    } else {
      //console.log("Cannot refresh: User UID or Role not available.");
    }
  }, [
    currentUser?.uid,
    userRole,
    fetchTodayData,
    setupRealtimeSummaryListeners,
    activeTab,
    loadTabData, // Now defined before handleRefresh
    statusFilter,
    queueFilter,
    partnerFilter,
    clinicFilter,
    dateRange,
    searchTerm,
  ]);


  // Set up listeners when user role is available
  useEffect(() => {
    if (userRole && currentUser?.uid) {
      setupRealtimeSummaryListeners(currentUser.uid, userRole);
      fetchTodayData(currentUser.uid, userRole);
    }
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [currentUser?.uid, userRole, setupRealtimeSummaryListeners, fetchTodayData]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0) { // Ensure interval is positive
        const intervalId = setInterval(() => {
            //console.log("Auto-refresh triggered...");
            handleRefresh();
        }, refreshInterval);
        return () => clearInterval(intervalId);
    }
  }, [refreshInterval, handleRefresh]);


  // Handle filter reset
  const handleFilterReset = useCallback(() => {
    //console.log("Resetting filters...");
    // setFetchingData(true); // Let loadTabData handle this

    const emptyFilters = {
      status: null, queue: null, partner: null, clinic: null,
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
      // No need to call fetchTabData directly, call loadTabData
      loadTabData(activeTab, emptyFilters);
    } else {
      // setFetchingData(false); // Not strictly needed if not set true above
    }
  }, [activeTab, loadTabData]); // Dependencies: activeTab and loadTabData

  // Handle individual filter reset
  const handleSingleFilterReset = useCallback(
    (filterType) => {
      let newFilters = { // Collect changes to pass to loadTabData
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: partnerFilter !== "all" ? partnerFilter : null,
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        searchTerm: searchTerm || null,
      };

      switch (filterType) {
        case "status": setStatusFilter("all"); newFilters.status = null; break;
        case "queue": setQueueFilter("all"); newFilters.queue = null; break;
        case "partner": setPartnerFilter("all"); newFilters.partner = null; break;
        case "clinic": setClinicFilter("all"); newFilters.clinic = null; break;
        case "date": setDateRange({ from: null, to: null }); newFilters.dateFrom = null; newFilters.dateTo = null; break;
        case "search": setSearchTerm(""); newFilters.searchTerm = null; break;
        default: break;
      }
      setActiveColumnFilter(null);
      if (activeTab) {
        loadTabData(activeTab, newFilters);
      }
    },
    [activeTab, loadTabData, statusFilter, queueFilter, partnerFilter, clinicFilter, dateRange, searchTerm] // Include all filters it reads before potentially changing
  );

  // Handle filter changes
  const handleFilterApply = useCallback((filterType, value) => {
    let updatedFilters = { // Prepare the filters object for loadTabData
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: partnerFilter !== "all" ? partnerFilter : null,
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        searchTerm: searchTerm || null,
    };

    switch (filterType) {
      case "status": setStatusFilter(value); updatedFilters.status = value === "all" ? null : value; break;
      case "queue": setQueueFilter(value); updatedFilters.queue = value === "all" ? null : value; break;
      case "partner": setPartnerFilter(value); updatedFilters.partner = value === "all" ? null : value; break;
      case "clinic": setClinicFilter(value); updatedFilters.clinic = value === "all" ? null : value; break;
      case "date": setDateRange(value); updatedFilters.dateFrom = value.from; updatedFilters.dateTo = value.to; break;
      default: break;
    }
    setActiveColumnFilter(null);
    if (activeTab) {
      loadTabData(activeTab, updatedFilters);
    }
  }, [activeTab, loadTabData, statusFilter, queueFilter, partnerFilter, clinicFilter, dateRange, searchTerm]);


  const handleSearchChange = (value) => { // Not a useCallback as it just sets state
    setSearchTerm(value);
    // If value is empty, clear search immediately by reloading tab data with no search term
    if (value === "" && activeTab) {
        const currentFilters = {
            status: statusFilter !== "all" ? statusFilter : null,
            queue: queueFilter !== "all" ? queueFilter : null,
            partner: partnerFilter !== "all" ? partnerFilter : null,
            clinic: clinicFilter !== "all" ? clinicFilter : null,
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            searchTerm: "", // explicitly empty
        };
        loadTabData(activeTab, currentFilters);
    }
  };


  const handleSearchSubmit = useCallback((value) => { // value is the new search term
    setSearchTerm(value); // Update state
    if (activeTab) {
      const updatedFilters = {
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: partnerFilter !== "all" ? partnerFilter : null,
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        searchTerm: value, // Use the submitted value directly
      };
      loadTabData(activeTab, updatedFilters);
    }
  }, [activeTab, loadTabData, statusFilter, queueFilter, partnerFilter, clinicFilter, dateRange]); // searchTerm removed as 'value' is used

  const handleTabChange = useCallback((newTabName) => {
    if (newTabName === activeTab) return;

    setActiveTab(newTabName);
    // Filters remain as they are, loadTabData will use current filter states
    // Dates are intentionally not reset here by default when changing tabs,
    // but if you want to reset dates, you'd update dateRange state here too.
    const currentFiltersForNewTab = {
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: partnerFilter !== "all" ? partnerFilter : null,
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        searchTerm: searchTerm || null,
        // No dateFrom or dateTo by default to keep existing date filter if any
        // OR, if you want to clear dates on tab change:
        // dateFrom: null,
        // dateTo: null,
      };

    loadTabData(newTabName, currentFiltersForNewTab);
  }, [activeTab, loadTabData, statusFilter, queueFilter, partnerFilter, clinicFilter, searchTerm]); // Dependencies for reading current filters


  // Handle excel export
  const handleExcelExport = () => {
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
  };

  // Create clinic options from table data
  const clinicOptions = tableData?.uniqueClinics?.map((clinic) => ({ value: clinic, label: clinic })) || [];
  const partnerOptions = tableData?.uniquePartners?.map((partner) => ({ value: partner, label: partner })) || [];


  // --- RENDER LOGIC ---
  if (userLoading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  }
  if (userError) {
    return <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4 mr-2" /><AlertDescription>{userError}</AlertDescription></Alert>;
  }
  // Show initial loading for summary if not yet loaded and no other error
  if (loading && !summaryData && !error) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  }
  if (error) { // General error for other operations
     return <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4 mr-2" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cases Dashboard</h2>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500 flex items-center">
            <ShieldAlert className="h-3 w-3 mr-1 text-blue-500" />
            Showing cases based on your role access
          </div>
          {["superAdmin", "zonalHead"].includes(userRole) && (
            <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={!tableData?.cases || tableData.cases.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : ""}
          </Badge>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500"> Auto-refresh:</span>
            <select
              className="border rounded p-1 text-sm"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={0}>Off</option> {/* Added Off option */}
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
        </div>
      </div>

      <DashboardSummaryCards
        data={summaryData}
        loading={loading && !summaryData}
        todayData={todaySummaryData}
      />
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab && (
        <FilterBar
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          onFilterReset={handleFilterReset}
          key={resetTimestamp} // Force re-render of FilterBar on reset
        />
      )}

      {!activeTab ? (
        <EmptyStateMessage />
      ) : fetchingData ? (
        <Card><CardContent className="p-6"><div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <TableHeader
                    activeColumnFilter={activeColumnFilter}
                    setActiveColumnFilter={setActiveColumnFilter}
                    clinicFilter={clinicFilter}
                    partnerFilter={partnerFilter}
                    dateRange={dateRange}
                    clinicOptions={clinicOptions}
                    partnerOptions={partnerOptions}
                    handleFilterApply={handleFilterApply}
                    handleSingleFilterReset={handleSingleFilterReset}
                  />
                </thead>
                <tbody>
                  {tableData?.cases && tableData.cases.length > 0 ? (
                    <CasesTable
                      data={tableData.cases}
                      loading={false}
                      userRole={userRole}
                      currentUser={currentUser}
                      showHeader={false}
                      pagination={tableData.pagination}
                    />
                  ) : (
                    <NoResultsMessage userRole={userRole} />
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {userRole !== "superAdmin" && userRole !== "zonalHead" && (
        <RoleBasedAccessMessage userRole={userRole} />
      )}
    </div>
  );
};

export default Dashboard;