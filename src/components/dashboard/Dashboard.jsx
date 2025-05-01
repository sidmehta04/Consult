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
  getCountFromServer,
} from "firebase/firestore";
import { firestore } from "../../firebase";
import {
  fetchSummaryData,
  fetchTabData,
  fetchUserHierarchy,
  fetchTodaySummaryData,
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
    userData,
    userRole,
    loading: userLoading,
    error: userError,
  } = useUserData(currentUser.uid);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaryData, setSummaryData] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [userHierarchy, setUserHierarchy] = useState(null);

  const [todaySummaryData, setTodaySummaryData] = useState(null);

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
    try {
      const todayData = await fetchTodaySummaryData(uid, role);
      setTodaySummaryData(todayData);
    } catch (error) {
      console.error("Error fetching today's data:", error);
    }
  }, []);

  // Set up realtime listeners for summary data
  const setupRealtimeSummaryListeners = useCallback(async (uid, role) => {
    // Clean up any existing listeners
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Create an object to store all counts
    const counts = {
      totalCases: 0,
      pendingCases: 0,
      completedCases: 0,
      doctorPendingCases: 0,
      pharmacistPendingCases: 0,
      incompleteCases: 0,
    };

    // For summary cards, we want to get accurate counts of ALL cases
    // So we'll use specialized queries for counts

    // First, check if we should use the optimized count approach
    if (["superAdmin", "zonalHead"].includes(role)) {
      try {
        // For admins with full access, use getCountFromServer for efficiency
        const casesRef = collection(firestore, "cases");

        // Execute counts in parallel
        const [
          totalCount,
          completedCount,
          incompleteCount,
          docPendingCount,
          pharmPendingCount,
        ] = await Promise.all([
          getCountFromServer(query(casesRef)),
          getCountFromServer(
            query(casesRef, where("pharmacistCompleted", "==", true))
          ),
          getCountFromServer(
            query(casesRef, where("isIncomplete", "==", true))
          ),
          getCountFromServer(
            query(casesRef, where("doctorCompleted", "==", false))
          ),
          getCountFromServer(
            query(
              casesRef,
              where("doctorCompleted", "==", true),
              where("pharmacistCompleted", "==", false),
              where("isIncomplete", "==", false)
            )
          ),
        ]);

        // Update counts with accurate numbers
        counts.totalCases = totalCount.data().count;
        counts.completedCases = completedCount.data().count;
        counts.incompleteCases = incompleteCount.data().count;
        counts.doctorPendingCases = docPendingCount.data().count;
        counts.pharmacistPendingCases = pharmPendingCount.data().count;
        counts.pendingCases =
          counts.doctorPendingCases + counts.pharmacistPendingCases;

        // Update summary data state with accurate counts
        setSummaryData({
          summaryData: counts,
          uniquePartners: [],
          uniqueClinics: [],
        });

        setLoading(false);
        return;
      } catch (error) {
        console.error("Error fetching counts:", error);
        // Fall back to regular listener if count approach fails
      }
    }

    // Special case for teamLeader, drManager, and RO - use hierarchy
    if (["teamLeader", "drManager", "ro"].includes(role)) {
      try {
        // First get the hierarchy data based on reporting relationships
        const hierarchyData = await fetchUserHierarchy(uid, role);
        const userIds = Array.from(hierarchyData.userIds);

        // Store the hierarchy data for later use
        setUserHierarchy(hierarchyData);

        // We'll use aggregated counts from multiple queries
        const totalCasesPromises = [];
        const completedCasesPromises = [];
        const incompleteCasesPromises = [];
        const docPendingPromises = [];
        const pharmPendingPromises = [];

        // Process all users in the hierarchy without limiting
        for (const userId of userIds) {
          const casesRef = collection(firestore, "cases");

          // Add promises for each count type
          totalCasesPromises.push(
            getCountFromServer(
              query(casesRef, where("createdBy", "==", userId))
            )
          );

          completedCasesPromises.push(
            getCountFromServer(
              query(
                casesRef,
                where("createdBy", "==", userId),
                where("pharmacistCompleted", "==", true)
              )
            )
          );

          incompleteCasesPromises.push(
            getCountFromServer(
              query(
                casesRef,
                where("createdBy", "==", userId),
                where("isIncomplete", "==", true)
              )
            )
          );

          docPendingPromises.push(
            getCountFromServer(
              query(
                casesRef,
                where("createdBy", "==", userId),
                where("doctorCompleted", "==", false),
                where("isIncomplete", "==", false)
              )
            )
          );

          pharmPendingPromises.push(
            getCountFromServer(
              query(
                casesRef,
                where("createdBy", "==", userId),
                where("doctorCompleted", "==", true),
                where("pharmacistCompleted", "==", false),
                where("isIncomplete", "==", false)
              )
            )
          );
        }

        // Execute all count promises in parallel
        const [
          totalResults,
          completedResults,
          incompleteResults,
          docPendingResults,
          pharmPendingResults,
        ] = await Promise.all([
          Promise.all(totalCasesPromises),
          Promise.all(completedCasesPromises),
          Promise.all(incompleteCasesPromises),
          Promise.all(docPendingPromises),
          Promise.all(pharmPendingPromises),
        ]);

        // Sum up all the counts
        counts.totalCases = totalResults.reduce(
          (sum, result) => sum + result.data().count,
          0
        );
        counts.completedCases = completedResults.reduce(
          (sum, result) => sum + result.data().count,
          0
        );
        counts.incompleteCases = incompleteResults.reduce(
          (sum, result) => sum + result.data().count,
          0
        );
        counts.doctorPendingCases = docPendingResults.reduce(
          (sum, result) => sum + result.data().count,
          0
        );
        counts.pharmacistPendingCases = pharmPendingResults.reduce(
          (sum, result) => sum + result.data().count,
          0
        );
        counts.pendingCases =
          counts.doctorPendingCases + counts.pharmacistPendingCases;

        // Update summary data state
        setSummaryData({
          summaryData: counts,
          uniquePartners: [], // These will be populated when loading tab data
          uniqueClinics: [],
        });

        setLoading(false);
        return;
      } catch (error) {
        console.error("Error fetching hierarchy counts:", error);
        // Fall back to regular listener
      }
    }

    // For role-specific views or if previous approaches failed, use listeners with a higher limit
    let baseQuery;

    // Apply role-based restrictions to summary data
    switch (role) {
      case "superAdmin":
      case "zonalHead":
        // Admin can see all cases, use a high limit
        baseQuery = query(
          collection(firestore, "cases"),
          orderBy("createdAt", "desc"),
          limit(1000) // Keep the higher limit for summary data
        );
        break;

      case "teamLeader":
      case "drManager":
      case "ro":
        // Fallback to just user's direct cases if hierarchy approach failed
        baseQuery = query(
          collection(firestore, "cases"),
          where("createdBy", "==", uid),
          limit(1000) // Higher limit for accurate summaries
        );
        break;

      case "doctor":
        baseQuery = query(
          collection(firestore, "cases"),
          where("assignedDoctors.primary", "==", uid),
          limit(1000) // Higher limit for accurate summaries
        );
        break;

      case "pharmacist":
        baseQuery = query(
          collection(firestore, "cases"),
          where("pharmacistId", "==", uid),
          limit(1000) // Higher limit for accurate summaries
        );
        break;

      default:
        baseQuery = query(
          collection(firestore, "cases"),
          where("createdBy", "==", uid),
          limit(1000) // Higher limit for accurate summaries
        );
        break;
    }

    // Set up listener for cases
    const unsubscribe = onSnapshot(
      baseQuery,
      (snapshot) => {
        const uniquePartners = new Set();
        const uniqueClinics = new Set();

        // Reset counts
        counts.totalCases = snapshot.size;
        counts.pendingCases = 0;
        counts.completedCases = 0;
        counts.doctorPendingCases = 0;
        counts.pharmacistPendingCases = 0;
        counts.incompleteCases = 0;

        // Process each document
        snapshot.forEach((doc) => {
          const caseData = doc.data();

          // Count by status
          if (
            caseData.isIncomplete ||
            caseData.status === "doctor_incomplete"
          ) {
            counts.incompleteCases++;
          } else if (caseData.doctorCompleted && caseData.pharmacistCompleted) {
            counts.completedCases++;
          } else if (!caseData.doctorCompleted) {
            counts.doctorPendingCases++;
            counts.pendingCases++;
          } else if (!caseData.pharmacistCompleted) {
            counts.pharmacistPendingCases++;
            counts.pendingCases++;
          }

          // Track unique values
          if (caseData.partnerName) uniquePartners.add(caseData.partnerName);
          if (caseData.clinicCode || caseData.clinicName) {
            uniqueClinics.add(caseData.clinicCode || caseData.clinicName);
          }
        });

        // Update summary data state
        setSummaryData({
          summaryData: counts,
          uniquePartners: Array.from(uniquePartners),
          uniqueClinics: Array.from(uniqueClinics),
        });

        // Exit loading state after first load
        setLoading(false);
      },
      (error) => {
        console.error("Error in realtime listener:", error);
        setError("Failed to set up realtime updates. Please refresh the page.");
        setLoading(false);
      }
    );

    // Store unsubscribe function
    unsubscribeRef.current = unsubscribe;
  }, []);

  // Set up listeners when user role is available
  useEffect(() => {
    if (userRole) {
      setupRealtimeSummaryListeners(currentUser.uid, userRole);
      fetchTodayData(currentUser.uid, userRole); // Add this line
    }

    // Clean up listeners on component unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [
    currentUser.uid,
    setupRealtimeSummaryListeners,
    userRole,
    fetchTodayData,
  ]);

  // Load specific tab data when requested
  const loadTabData = useCallback(
    async (tabName, filters = {}) => {
      if (!userRole || fetchingData) return;

      setFetchingData(true);
      try {
        // Create a filter object with all active filters
        // IMPORTANT: Don't set default date filter when first loading a tab
        const activeFilters = {
          status: statusFilter !== "all" ? statusFilter : null,
          queue: queueFilter !== "all" ? queueFilter : null,
          partner: partnerFilter !== "all" ? partnerFilter : null,
          clinic: clinicFilter !== "all" ? clinicFilter : null,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          searchTerm: searchTerm || null,
        };

        // Fetch tab-specific data with role-based access control
        const tabData = await fetchTabData(
          currentUser.uid,
          userRole,
          tabName,
          activeFilters,
          // Add pagination parameters
          { page: 1, pageSize: 50 } // Increased page size from 20 to 50
        );

        // Update table data state (separate from summary data)
        setTableData({
          cases: tabData.cases,
          uniquePartners: tabData.uniquePartners,
          uniqueClinics: tabData.uniqueClinics,
          pagination: tabData.pagination,
        });

        // Show table once we have data
        setShowTable(true);
      } catch (err) {
        console.error("Error fetching tab data:", err);
        setError("Failed to load case data. Please try again.");
      } finally {
        setFetchingData(false);
      }
    },
    [
      currentUser.uid,
      userRole,
      statusFilter,
      queueFilter,
      partnerFilter,
      clinicFilter,
      dateRange,
      searchTerm,
      fetchingData,
    ]
  );

  // Handle filter reset
  const handleFilterReset = useCallback(() => {
    // Set loading state immediately for visual feedback
    setFetchingData(true);

    // Reset all filters in memory
    const emptyFilters = {
      status: null,
      queue: null,
      partner: null,
      clinic: null,
      dateFrom: null,
      dateTo: null,
      searchTerm: null,
    };

    // Also update the state (for UI purposes)
    setDateRange({ from: null, to: null });
    setSearchTerm("");
    setStatusFilter("all");
    setQueueFilter("all");
    setPartnerFilter("all");
    setClinicFilter("all");
    setActiveColumnFilter(null);
    setResetTimestamp(Date.now());

    // If a tab is active, reload data with empty filters
    if (activeTab) {
      // Directly fetch data with empty filters rather than waiting for state to update
      fetchTabData(currentUser.uid, userRole, activeTab, emptyFilters, {
        page: 1,
        pageSize: 50, // Increased from 20 to 50
      })
        .then((tabData) => {
          setTableData({
            cases: tabData.cases,
            uniquePartners: tabData.uniquePartners,
            uniqueClinics: tabData.uniqueClinics,
            pagination: tabData.pagination,
          });
          setFetchingData(false);
        })
        .catch((err) => {
          console.error("Error fetching tab data:", err);
          setError("Failed to load case data. Please try again.");
          setFetchingData(false);
        });
    } else {
      setFetchingData(false);
    }
  }, [activeTab, currentUser.uid, userRole]);

  // Handle individual filter reset
  const handleSingleFilterReset = useCallback(
    (filterType) => {
      // Reset specific filter
      switch (filterType) {
        case "status":
          setStatusFilter("all");
          break;
        case "queue":
          setQueueFilter("all");
          break;
        case "partner":
          setPartnerFilter("all");
          break;
        case "clinic":
          setClinicFilter("all");
          break;
        case "date":
          setDateRange({ from: null, to: null });
          break;
        case "search":
          setSearchTerm("");
          break;
        default:
          break;
      }

      // Close the column filter
      setActiveColumnFilter(null);

      // Reload data if tab is active
      if (activeTab) {
        loadTabData(activeTab);
      }
    },
    [activeTab, loadTabData]
  );

  // Handle filter changes
  const handleFilterApply = (filterType, value) => {
    switch (filterType) {
      case "status":
        setStatusFilter(value);
        break;
      case "queue":
        setQueueFilter(value);
        break;
      case "partner":
        setPartnerFilter(value);
        break;
      case "clinic":
        setClinicFilter(value);
        break;
      case "date":
        setDateRange(value);
        break;
      default:
        break;
    }

    // Close the column filter
    setActiveColumnFilter(null);

    // Reload data if tab is active
    if (activeTab) {
      loadTabData(activeTab);
    }
  };

  // Handle search
  const handleSearch = (value) => {
    setSearchTerm(value);

    // Reload data if search term changed and tab is active
    if (activeTab && value !== searchTerm) {
      loadTabData(activeTab);
    }
  };

  // Handle search button click
  const handleSearchSubmit = (value) => {
    // Set the search term state
    setSearchTerm(value);

    // Set loading state to give visual feedback
    setFetchingData(true);

    // Create a new filter object with the updated search term
    const updatedFilters = {
      status: statusFilter !== "all" ? statusFilter : null,
      queue: queueFilter !== "all" ? queueFilter : null,
      partner: partnerFilter !== "all" ? partnerFilter : null,
      clinic: clinicFilter !== "all" ? clinicFilter : null,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      searchTerm: value, // Use the new value directly
    };

    // Always load tab data when search button is clicked, with latest filters
    if (activeTab) {
      // Small delay to ensure state is updated
      setTimeout(() => {
        // Directly pass the updated filters rather than relying on state
        fetchTabData(currentUser.uid, userRole, activeTab, updatedFilters, {
          page: 1,
          pageSize: 50, // Increased from 20 to 50
        })
          .then((tabData) => {
            setTableData({
              cases: tabData.cases,
              uniquePartners: tabData.uniquePartners,
              uniqueClinics: tabData.uniqueClinics,
              pagination: tabData.pagination,
            });
            setFetchingData(false);
          })
          .catch((err) => {
            console.error("Error fetching tab data:", err);
            setError("Failed to load case data. Please try again.");
            setFetchingData(false);
          });
      }, 100);
    }
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);

    // Don't load data on simple changes, wait for button click
    // If value is empty, we can reload to clear the filter
    if (value === "" && activeTab) {
      loadTabData(activeTab);
    }
  };

  // Handle tab change - FIXED to work properly for tl, dr manager, ro
  const handleTabChange = (value) => {
    // If clicking the same tab, do nothing
    if (value === activeTab) return;

    setActiveTab(value);
    setFetchingData(true);

    // Create a filters object with no date filters by default
    const baseFilters = {
      status: statusFilter !== "all" ? statusFilter : null,
      queue: queueFilter !== "all" ? queueFilter : null,
      partner: partnerFilter !== "all" ? partnerFilter : null,
      clinic: clinicFilter !== "all" ? clinicFilter : null,
      searchTerm: searchTerm || null,
      // Importantly, no dateFrom or dateTo by default
    };

    // For teamLeader, drManager, and RO, we'll use a custom approach
    if (["teamLeader", "drManager", "ro"].includes(userRole)) {
      // Use our custom function directly to avoid date filtering issues
      fetchTabData(
        currentUser.uid,
        userRole,
        value,
        baseFilters,
        { page: 1, pageSize: 100 } // Increased page size for hierarchy roles
      )
        .then((tabData) => {
          setTableData({
            cases: tabData.cases,
            uniquePartners: tabData.uniquePartners,
            uniqueClinics: tabData.uniqueClinics,
            pagination: tabData.pagination,
          });
          setShowTable(true);
          setFetchingData(false);
        })
        .catch((err) => {
          console.error("Error fetching tab data:", err);
          setError("Failed to load case data. Please try again.");
          setFetchingData(false);
        });
    } else {
      // For other roles, use the normal loadTabData function
      loadTabData(value);
    }
  };

  // Handle excel export
  const handleExcelExport = () => {
    if (!tableData?.cases || tableData.cases.length === 0) {
      alert("No data available to export.");
      return;
    }

    // Create a filename with date stamp
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const fileName = `cases_export_${dateStr}.xlsx`;

    // Call the export function
    try {
      exportCasesToExcel(tableData.cases, fileName);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      alert("Failed to export data. Please try again.");
    }
  };

  // Create clinic options from table data
  const clinicOptions =
    tableData?.uniqueClinics?.map((clinic) => ({
      value: clinic,
      label: clinic,
    })) || [];

  // Create partner options from table data
  const partnerOptions =
    tableData?.uniquePartners?.map((partner) => ({
      value: partner,
      label: partner,
    })) || [];

  // Show loading state
  if (loading || userLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  // Show error state
  if (error || userError) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4 mr-2" />
        <AlertDescription>{error || userError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with role info and export button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cases Dashboard</h2>
        <div className="flex items-center gap-2">
          {/* Role-based access indicator */}
          <div className="text-xs text-gray-500 flex items-center">
            <ShieldAlert className="h-3 w-3 mr-1 text-blue-500" />
            Showing cases based on your role access
          </div>

          {/* Excel Export - Only for SuperAdmin and ZonalHead */}
          {["superAdmin", "zonalHead"].includes(userRole) && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {userRole
              ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
              : ""}
          </Badge>
        </div>
      </div>

      {/* Summary Cards - Always show real-time data regardless of table filters */}
      <DashboardSummaryCards
        data={summaryData}
        todayData={todaySummaryData}
        loading={loading}
      />
      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab && (
        <FilterBar
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          onFilterReset={handleFilterReset}
        />
      )}

      {/* Content Area: No Tab Selected, Loading, or Data Table */}
      {!activeTab ? (
        <EmptyStateMessage />
      ) : fetchingData ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                {/* Table Header with Filters */}
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
                      showHeader={false} // Hide duplicate header
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

      {/* Role-based access message */}
      {userRole !== "superAdmin" && userRole !== "zonalHead" && (
        <RoleBasedAccessMessage userRole={userRole} />
      )}
    </div>
  );
};

export default Dashboard;
