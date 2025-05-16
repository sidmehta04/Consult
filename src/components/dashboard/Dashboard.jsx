import React, { useState, useEffect, useCallback, useRef} from "react";
import Select from "react-select"; // Import react-select
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
  fetchCounts,
  getClinicMapping,
} from "./datafetcher";

const Dashboard = ({ currentUser }) => {

  const [loading, setLoading] = useState(false);//change this
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
  const [partnersList, setPartnersList] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [activeColumnFilter, setActiveColumnFilter] = useState(null);
  const [resetTimestamp, setResetTimestamp] = useState(Date.now());

  const [summaryCounts, setSummaryCounts] = useState(null);
  const [loadingCounts, setLoadingCounts] = useState(null);

  const [clinicMapping, setClinicMapping] = useState(null);

  const unsubscribeRef = useRef(null);
  const recentCasesCacheRef = useRef(new Map());
  const initialLoadCompleteRef = useRef(false);
  // To ensure first listener snapshot populates cache without affecting counts already set by full load
  const listenerCachePopulatedRef = useRef(false);


  //Set some helper data on component mount
  useEffect(() => {
    async function fetchClinicMapping() {
      const [mapping, partnerNames] = await getClinicMapping();
      setClinicMapping(mapping);

      const formattedPartners = partnerNames.map(partner => ({
        value: partner,
        label: partner,
      }));

      setPartnersList(formattedPartners);
    }
    fetchClinicMapping();

    if(["ro"].includes(currentUser?.role) && currentUser?.uid){
      console.log("ro, partnerName=", currentUser.partnerName);
      setPartnerName(currentUser.partnerName);
      setPartnersList([{
        value: currentUser.partnerName,
        label: currentUser.partnerName
      }])
    }

  }, [currentUser?.uid, currentUser?.role])

  const handlePartnerChange = (selectedOption) => {
    setPartnerName(selectedOption ? selectedOption.value : null);
  };

  //Summary
  // Memoized helper to update global counts
  const applyCountChanges = useCallback((singleCaseContribution, operation) => {
      setSummaryCounts(prevGlobalCounts => {
          const newGlobalCounts = { ...prevGlobalCounts };
          const factor = operation === 'add' ? 1 : -1;
          for (const key in singleCaseContribution) {
              newGlobalCounts[key] = (newGlobalCounts[key] || 0) + (factor * singleCaseContribution[key]);
          }
            // Recalculate explicitly summed fields if their components changed
          if (singleCaseContribution.doctorPendingCases !== undefined || singleCaseContribution.pharmacistPendingCases !== undefined) {
              newGlobalCounts.pendingCases = (newGlobalCounts.doctorPendingCases || 0) + (newGlobalCounts.pharmacistPendingCases || 0);
          }
          return newGlobalCounts;
      });
  }, []);

  useEffect(() => {
      if (!currentUser?.uid || !currentUser?.role || !firestore) {
          setLoadingCounts(false);
          return;
      }

      let isMounted = true;
      initialLoadCompleteRef.current = false;
      listenerCachePopulatedRef.current = false; // Reset for new uid/role
      recentCasesCacheRef.current.clear(); // Clear cache for new uid/role
      // Reset counts to default when uid/role changes before new load
      setSummaryCounts({
          totalCases: 0, pendingCases: 0, completedCases: 0, doctorPendingCases: 0,
          pharmacistPendingCases: 0, incompleteCases: 0, todayCases: 0,
          todayCompleted: 0, todayIncomplete: 0,
      });


      const loadData = async () => {
          setLoadingCounts(true);
          setError(null);

          try {
              // --- Step 1: Initial Full Load ---
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);


              let initialQueryParam;
              switch(currentUser.role){
                case "superAdmin": case "zonalHead": case "drManager": case "teamLeader":
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
              const [
                totalCount, completedCount, incompleteCount, docPendingCount, pharmPendingCount, todayCount, todayCompleted, todayIncomplete
              ] = await Promise.all([
                fetchCounts(partnerName, clinicMapping, query(casesRef)),
                fetchCounts(partnerName, clinicMapping, query(casesRef, initialQueryParam, where("pharmacistCompleted", "==", true))),
                fetchCounts(partnerName, clinicMapping, query(casesRef, initialQueryParam, where("isIncomplete", "==", true))),
                fetchCounts(partnerName, clinicMapping, query(casesRef, initialQueryParam, where("doctorCompleted", "==", false))),
                fetchCounts(partnerName, clinicMapping, query(casesRef, initialQueryParam, where("doctorCompleted", "==", true), where("pharmacistCompleted", "==", false), where("isIncomplete", "==", false))),
                fetchCounts(partnerName, clinicMapping, query(casesRef, initialQueryParam, where("createdAt", ">=", today), where("createdAt", "<", tomorrow))),
                fetchCounts(partnerName, clinicMapping, query(casesRef, initialQueryParam, where("pharmacistCompleted", "==", true), where("createdAt", ">=", today), where("createdAt", "<", tomorrow))),
                fetchCounts(partnerName, clinicMapping, query(casesRef, initialQueryParam, where("isIncomplete", "==", true), where("createdAt", ">=", today), where("createdAt", "<", tomorrow)))
              ]);

              if (!isMounted) return;

              const pendingCases = docPendingCount.count + pharmPendingCount.count;

              setSummaryCounts({
                totalCases: totalCount.count, 
                pendingCases: pendingCases,
                completedCases: completedCount.count, 
                doctorPendingCases: docPendingCount.count,
                pharmacistPendingCases: pharmPendingCount.count, 
                incompleteCases: incompleteCount.count, 
                todayCases: todayCount.count,
                todayCompleted: todayCompleted.count, 
                todayIncomplete: todayIncomplete.count,
              });
              initialLoadCompleteRef.current = true;
              

              // --- Step 2: Setup Real-time Listener for Recent 1000 ---
              let listenerQuery; // Define based on role, WITH limit(1000)
              switch(currentUser.role){
                case "superAdmin": case "zonalHead": case "drManager": case "TeamLeader":
                  listenerQuery = query(collection(firestore, "cases"), orderBy("createdAt", "desc"), limit(1000));
                  break;
                case "doctor":
                  listenerQuery = query(collection(firestore, "cases"), where("assignedDoctors.primary", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(1000));
                  break;
                case "pharmacist":
                  listenerQuery = query(collection(firestore, "cases"), where("pharmacistId", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(1000));
                  break;
                default:
                  listenerQuery = query(collection(firestore, "cases"), where("createdBy", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(1000));
                  break;
              }

              unsubscribeRef.current = onSnapshot(listenerQuery, (snapshot) => {
                  if (!isMounted || !initialLoadCompleteRef.current) return; // Process only if initial load done and component mounted

                  const snapTodayDate = new Date(); snapTodayDate.setHours(0, 0, 0, 0);
                  const snapTomorrowDate = new Date(snapTodayDate); snapTomorrowDate.setDate(snapTomorrowDate.getDate() + 1);
                  const snapTodayEpoch = Math.floor(snapTodayDate.getTime() / 1000);
                  const snapTomorrowEpoch = Math.floor(snapTomorrowDate.getTime() / 1000);

                  // First snapshot from listener is used to populate the cache
                  if (!listenerCachePopulatedRef.current) {
                      snapshot.docs.forEach(doc => {
                          recentCasesCacheRef.current.set(doc.id, doc.data());
                      });
                      listenerCachePopulatedRef.current = true;
                      if(isMounted) setLoadingCounts(false); // Initial data + first listener pass complete
                      return; // Don't process docChanges for this first cache population
                  }

                  snapshot.docChanges().forEach((change) => {
                      const docId = change.doc.id;
                      const newCaseData = change.doc.exists() ? change.doc.data() : null;
                      const oldCaseDataFromCache = recentCasesCacheRef.current.get(docId);

                      if (change.type === "added") {
                          if (newCaseData && !oldCaseDataFromCache) { // New to the 1000-window cache
                              // This means it's either a brand new document OR an existing doc that just entered the 1000-window.
                              // Since the initial load already counted all existing docs,
                              // we only add to global counts if it's TRULY new to the system.
                              // A common simplification: If it's new to the cache, assume it's a net new addition to overall counts.
                              // This can lead to slight overcounting if an old doc scrolls into the 1000 window
                              // *unless* the "removed" logic for items scrolling out is perfect.
                              // For now, let's assume "added" to this listener window when not in its cache = new to be counted.
                              applyCountChanges(calculateCaseContribution(newCaseData, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'add');
                              recentCasesCacheRef.current.set(docId, newCaseData);
                          }
                      } else if (change.type === "modified") {
                          if (newCaseData && oldCaseDataFromCache) {
                              applyCountChanges(calculateCaseContribution(oldCaseDataFromCache, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'subtract');
                              applyCountChanges(calculateCaseContribution(newCaseData, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'add');
                              recentCasesCacheRef.current.set(docId, newCaseData);
                          } else if (newCaseData) { // Modified but wasn't in cache (entered window and modified)
                              applyCountChanges(calculateCaseContribution(newCaseData, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'add');
                              recentCasesCacheRef.current.set(docId, newCaseData);
                          }
                      } else if (change.type === "removed") {
                          if (oldCaseDataFromCache) {
                              applyCountChanges(calculateCaseContribution(oldCaseDataFromCache, snapTodayEpoch, snapTomorrowEpoch, partnerName, clinicMapping), 'subtract');
                              recentCasesCacheRef.current.delete(docId);
                          }
                      }
                  });
                    if(isMounted && snapshot.docChanges().length > 0) setLoadingCounts(false); // Stop loading if there were changes
              }, (err) => {
                  if (!isMounted) return;
                  console.error("Listener Error:", err);
                  setError("Real-time updates failed.");
                  setLoadingCounts(false);
              });

          } catch (e) {
              if (!isMounted) return;
              console.error("Initial Load Error:", e);
              setError("Failed to load initial summary data.");
              setLoadingCounts(false);
          }
      };

      loadData();

      return () => {
          isMounted = false;
          if (unsubscribeRef.current) {
              unsubscribeRef.current();
          }
          initialLoadCompleteRef.current = false; // Reset on cleanup
          listenerCachePopulatedRef.current = false;
      };
  }, [currentUser, calculateCaseContribution, applyCountChanges, partnerName, clinicMapping]); // Ensure all stable dependencies are listed

  // --- FUNCS ---
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

  const handleRefresh = useCallback(async () => {

  });

  // Load specific tab data when requested
  const loadTabData = useCallback(
    async (tabName, filters = {}) => {
      if (!currentUser?.role || !currentUser?.uid) { // Removed fetchingData from guard, handled by button state
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
        //console.log(clinicMapping)
        const tabData = await fetchTabData(
          currentUser.uid,
          currentUser.role,
          tabName,
          activeFilters,
          { page: 1, pageSize: 50 },
          clinicMapping
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
      currentUser?.role,
      statusFilter,
      queueFilter,
      partnerFilter,
      clinicFilter,
      dateRange,
      searchTerm,
      clinicMapping,
    ]
  );

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
    const currentFiltersForNewTab = {
        status: statusFilter !== "all" ? statusFilter : null,
        queue: queueFilter !== "all" ? queueFilter : null,
        partner: partnerFilter !== "all" ? partnerFilter : null,
        clinic: clinicFilter !== "all" ? clinicFilter : null,
        searchTerm: searchTerm || null,
      };

    loadTabData(newTabName, currentFiltersForNewTab);
  }, [activeTab, loadTabData, statusFilter, queueFilter, partnerFilter, clinicFilter, searchTerm]); // Dependencies for reading current filters

  const clinicOptions = tableData?.uniqueClinics?.map((clinic) => ({ value: clinic, label: clinic })) || [];
  const partnerOptions = tableData?.uniquePartners?.map((partner) => ({ value: partner, label: partner })) || [];

  // --- RENDER LOGIC ---
  if (!currentUser?.role) {
    return <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4 mr-2" /><AlertDescription>User Role Not Recognised</AlertDescription></Alert>;
  }
  // Show initial loading for summary if not yet loaded and no other error
  if (loading && !summaryCounts && !error) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  }
  if (error) { // General error for other operations
     return <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4 mr-2" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cases Dashboard</h2>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500 flex items-center">
            <ShieldAlert className="h-3 w-3 mr-1 text-blue-500" />
            Showing cases based on your role access
          </div>
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
          {["superAdmin", "zonalHead", "teamLeader", "drManager"].includes(currentUser.role) && (
            <div className="w-64">
              <Select
                options={partnersList}
                isClearable
                placeholder="Filter by Partner"
                onChange={handlePartnerChange}
                //value={partnersList.find(option => option.value === selectedPartner || null)}
              />
            </div>
          )}
          

        </div>
      </div>

      <DashboardSummaryCards
        data={summaryCounts}
        loading={loadingCounts}
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
                      userRole={currentUser.role}
                      currentUser={currentUser}
                      showHeader={false}
                      pagination={tableData.pagination}
                    />
                  ) : (
                    <NoResultsMessage userRole={currentUser.role} />
                  )}
                </tbody>
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