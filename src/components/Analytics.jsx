import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "../firebase";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

// Summary Cards Component
const SummaryCards = ({ data, selectedPartner }) => {
  const metrics = useMemo(() => {
    const filteredData =
      selectedPartner === "all"
        ? data
        : data.filter((item) => item.partnerName === selectedPartner);

    const busyDoctors = new Set();
    const busyPharmacists = new Set();
    const activeClinics = new Set();
    let activeCases = 0;

    filteredData.forEach((caseItem) => {
      // Count only ACTIVE cases (not completed and not marked incomplete)
      // Doctor pending cases
      const isDoctorPending = caseItem.doctorCompleted === false;

      // Pharmacist pending cases
      const isPharmacistPending =
        caseItem.doctorCompleted === true &&
        caseItem.pharmacistCompleted === false &&
        caseItem.isIncomplete === false;

      const isActive = isDoctorPending || isPharmacistPending;
      if (isActive) {
        activeCases++;

        // Count unique doctors working on active cases
        if (caseItem.assignedDoctors?.primary) {
          busyDoctors.add(caseItem.assignedDoctors.primary);
        }
        // Count unique pharmacists working on active cases
        if (caseItem.pharmacistId) {
          busyPharmacists.add(caseItem.pharmacistId);
        }
      }

      // Count all clinics that have any cases (active or completed)
      if (caseItem.clinicCode) {
        activeClinics.add(caseItem.clinicCode);
      }
    });

    return {
      totalCases: filteredData.length,
      activeCases: activeCases,
      busyDoctors: busyDoctors.size,
      busyPharmacists: busyPharmacists.size,
      activeClinics: activeClinics.size,
    };
  }, [data, selectedPartner]);

  const cards = [
    { title: "Total Cases", value: metrics.totalCases },
    { title: "Active Cases", value: metrics.activeCases },
    { title: "Busy Doctors", value: metrics.busyDoctors },
    { title: "Busy Pharmacists", value: metrics.busyPharmacists },
  ];

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            <div className="text-sm text-gray-500 mb-1">{card.title}</div>
            <div className="text-2xl font-semibold text-gray-900">
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Cases Completion Chart Component
const CasesCompletionChart = ({
  data,
  selectedPartner,
  granularity,
  setGranularity,
  selectedDate,
}) => {
  const completionData = useMemo(() => {
    const filteredData =
      selectedPartner === "all"
        ? data
        : data.filter((item) => item.partnerName === selectedPartner);

    const timeline = [];
    const startHour = 8;
    const endHour = 22;
    const interval = granularity * 60 * 1000;

    // Create base timestamp for the selected date
    const baseDate = new Date(selectedDate);
    baseDate.setHours(startHour, 0, 0, 0);

    for (
      let time = baseDate.getTime();
      time < baseDate.getTime() + (endHour - startHour) * 60 * 60 * 1000;
      time += interval
    ) {
      const timestamp = new Date(time);
      const timeStr = `${timestamp.getHours()}:${String(
        timestamp.getMinutes()
      ).padStart(2, "0")}`;

      let completedCases = 0;

      filteredData.forEach((caseItem) => {
        let completionTime = null;

        // Check for completion time based on completion flags
        if (
          (caseItem.doctorCompleted === true &&
            caseItem.pharmacistCompleted === true) ||
          caseItem.isIncomplete === true
        ) {
          // Use the latest completion timestamp
          if (caseItem.pharmacistCompletedAt) {
            completionTime = caseItem.pharmacistCompletedAt.toDate();
          } else if (caseItem.doctorCompletedAt) {
            completionTime = caseItem.doctorCompletedAt.toDate();
          }
        }

        // Count cases completed in this time slot
        if (completionTime) {
          const nextTimestamp = new Date(time + interval);
          if (completionTime >= timestamp && completionTime < nextTimestamp) {
            completedCases++;
          }
        }
      });

      timeline.push({
        time: timeStr,
        completedCases,
        period:
          granularity === 60
            ? `${timeStr} - ${new Date(time + interval).getHours()}:00`
            : `${timeStr} - ${new Date(time + interval).getHours()}:${String(
                new Date(time + interval).getMinutes()
              ).padStart(2, "0")}`,
      });
    }

    return timeline;
  }, [data, selectedPartner, granularity, selectedDate]);

  return (
    <div className="mb-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Cases Completion Timeline
            </h3>
            <p className="text-sm text-gray-500">
              Cases completed (including incomplete) from 8 AM - 10 PM on{" "}
              {new Date(selectedDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setGranularity(60)}
              className={`px-3 py-1 rounded text-sm ${
                granularity === 60
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Hourly
            </button>
            <button
              onClick={() => setGranularity(15)}
              className={`px-3 py-1 rounded text-sm ${
                granularity === 15
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              15 Min
            </button>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={completionData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [value, "Cases Completed"]}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    return `Period: ${payload[0].payload.period}`;
                  }
                  return `Time: ${label}`;
                }}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                }}
              />
              <Bar dataKey="completedCases" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-lg font-semibold text-gray-900">
              {completionData.reduce(
                (sum, item) => sum + item.completedCases,
                0
              )}
            </div>
            <div className="text-sm text-gray-500">Total Completed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-lg font-semibold text-gray-900">
              {Math.max(...completionData.map((item) => item.completedCases))}
            </div>
            <div className="text-sm text-gray-500">Peak Period</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-lg font-semibold text-gray-900">
              {(
                completionData.reduce(
                  (sum, item) => sum + item.completedCases,
                  0
                ) / completionData.length
              ).toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">Average per Period</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Case Timeline Row (for today's active cases)
const CaseTimelineRow = ({
  data,
  selectedPartner,
  granularity,
  setGranularity,
  totalDoctors,
  totalPharmacists,
}) => {
  const timelineData = useMemo(() => {
    const filteredData =
      selectedPartner === "all"
        ? data
        : data.filter((item) => item.partnerName === selectedPartner);

    const timeline = [];
    const startHour = 8;
    const endHour = 22;
    const interval = granularity * 60 * 1000;

    const now = new Date();
    const startTimeStamp = new Date();
    startTimeStamp.setHours(startHour, 0, 0, 0);

    // Calculate end time based on current time or end hour, whichever is earlier
    const maxEndTime = Math.min(
      now.getTime(),
      startTimeStamp.getTime() + (endHour - startHour) * 60 * 60 * 1000
    );

    for (
      let time = startTimeStamp.getTime();
      time <= maxEndTime;
      time += interval
    ) {
      const timestamp = new Date(time);

      // Skip future time slots
      if (timestamp > now) break;

      const timeStr = `${timestamp.getHours()}:${String(
        timestamp.getMinutes()
      ).padStart(2, "0")}`;

      let activeCases = 0;
      const busyDoctors = new Set();
      const busyPharmacists = new Set();

      filteredData.forEach((caseItem) => {
        const caseStart = caseItem.createdAt?.toDate();
        let caseEnd = null;

        // Case is considered ended if both doctor and pharmacist are completed OR marked as incomplete
        if (
          (caseItem.doctorCompleted === true &&
            caseItem.pharmacistCompleted === true) ||
          caseItem.isIncomplete === true
        ) {
          // Use the latest completion timestamp
          if (caseItem.pharmacistCompletedAt) {
            caseEnd = caseItem.pharmacistCompletedAt.toDate();
          } else if (caseItem.doctorCompletedAt) {
            caseEnd = caseItem.doctorCompletedAt.toDate();
          }
        }
        // If no end time, case is still active (caseEnd remains null)

        // Check if case was ACTIVE during this time period
        // Active = started before/at this time AND (not ended OR ended after this time)
        const caseIsActive =
          caseStart &&
          caseStart <= timestamp &&
          (!caseEnd || caseEnd > timestamp);

        if (caseIsActive) {
          activeCases++;

          // Count unique doctors working on active cases at this time
          if (caseItem.assignedDoctors?.primary) {
            busyDoctors.add(caseItem.assignedDoctors.primary);
          }

          // Count unique pharmacists working on active cases at this time
          if (caseItem.pharmacistId) {
            busyPharmacists.add(caseItem.pharmacistId);
          }
        }
      });

      timeline.push({
        time: timeStr,
        activeCases,
        busyDoctors: busyDoctors.size,
        busyPharmacists: busyPharmacists.size,
        totalDoctors,
        totalPharmacists,
      });
    }

    return timeline;
  }, [data, selectedPartner, granularity, totalDoctors, totalPharmacists]);

  return (
    <div className="mb-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Active Cases Timeline
            </h3>
            <p className="text-sm text-gray-500">
              Cases in progress and unique staff working on them •{" "}
              {totalDoctors} total doctors, {totalPharmacists} total pharmacists
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setGranularity(60)}
              className={`px-3 py-1 rounded text-sm ${
                granularity === 60
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Hourly
            </button>
            <button
              onClick={() => setGranularity(15)}
              className={`px-3 py-1 rounded text-sm ${
                granularity === 15
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              15 Min
            </button>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={timelineData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name, props) => {
                  const payload = props.payload;
                  if (name === "Active Cases") {
                    return [value, name];
                  } else if (name === "Busy Doctors") {
                    return [`${value}/${payload.totalDoctors}`, name];
                  } else if (name === "Busy Pharmacists") {
                    return [`${value}/${payload.totalPharmacists}`, name];
                  }
                  return [value, name];
                }}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                }}
              />
              <Bar dataKey="activeCases" fill="#3b82f6" name="Active Cases" />
              <Bar dataKey="busyDoctors" fill="#10b981" name="Busy Doctors" />
              <Bar
                dataKey="busyPharmacists"
                fill="#f59e0b"
                name="Busy Pharmacists"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Doctor Utilization Row
const DoctorUtilizationRow = ({
  data,
  selectedPartner,
  granularity,
  totalDoctors,
}) => {
  const utilizationData = useMemo(() => {
    const filteredData =
      selectedPartner === "all"
        ? data
        : data.filter((item) => item.partnerName === selectedPartner);

    const timeline = [];
    const startHour = 8;
    const endHour = 22;
    const interval = granularity * 60 * 1000;

    const now = new Date();
    const startTimeStamp = new Date();
    startTimeStamp.setHours(startHour, 0, 0, 0);

    // Calculate end time based on current time or end hour, whichever is earlier
    const maxEndTime = Math.min(
      now.getTime(),
      startTimeStamp.getTime() + (endHour - startHour) * 60 * 60 * 1000
    );

    for (
      let time = startTimeStamp.getTime();
      time <= maxEndTime;
      time += interval
    ) {
      const timestamp = new Date(time);

      // Skip future time slots
      if (timestamp > now) break;

      const timeStr = `${timestamp.getHours()}:${String(
        timestamp.getMinutes()
      ).padStart(2, "0")}`;

      const engagedDoctors = new Set();

      filteredData.forEach((caseItem) => {
        const caseStart = caseItem.createdAt?.toDate();
        let caseEnd = null;

        // Case is considered ended if it's completed OR marked as incomplete
        // Case is considered ended if both doctor and pharmacist are completed OR marked as incomplete
        if (
          (caseItem.doctorCompleted === true &&
            caseItem.pharmacistCompleted === true) ||
          caseItem.isIncomplete === true
        ) {
          // Use the latest completion timestamp
          if (caseItem.pharmacistCompletedAt) {
            caseEnd = caseItem.pharmacistCompletedAt.toDate();
          } else if (caseItem.doctorCompletedAt) {
            caseEnd = caseItem.doctorCompletedAt.toDate();
          }
        }
        // If no end time, case is still active

        // Check if case was ACTIVE during this time period
        const caseIsActive =
          caseStart &&
          caseStart <= timestamp &&
          (!caseEnd || caseEnd > timestamp);

        if (caseIsActive && caseItem.assignedDoctors?.primary) {
          engagedDoctors.add(caseItem.assignedDoctors.primary);
        }
      });

      timeline.push({
        time: timeStr,
        utilization:
          totalDoctors > 0 ? (engagedDoctors.size / totalDoctors) * 100 : 0,
        engaged: engagedDoctors.size,
        total: totalDoctors,
      });
    }

    return timeline;
  }, [data, selectedPartner, granularity, totalDoctors]);

  return (
    <div className="mb-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Doctor Utilization
          </h3>
          <p className="text-sm text-gray-500">
            Percentage of doctors working on active cases • {totalDoctors} total
            doctors
          </p>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={utilizationData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name, props) => {
                  const payload = props.payload;
                  return [
                    `${value.toFixed(1)}% (${payload.engaged}/${
                      payload.total
                    })`,
                    "Utilization",
                  ];
                }}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                }}
              />
              <Line
                type="monotone"
                dataKey="utilization"
                stroke="#10b981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Clinic Distribution Row
const ClinicDistributionRow = ({
  data,
  selectedPartner,
  totalClinicsFromUsers,
}) => {
  const clinicData = useMemo(() => {
    const activeClinics = new Set();

    const filteredData =
      selectedPartner === "all"
        ? data
        : data.filter((item) => item.partnerName === selectedPartner);

    filteredData.forEach((caseItem) => {
      if (caseItem.clinicCode) {
        activeClinics.add(caseItem.clinicCode);
      }
    });

    const activeCount = activeClinics.size;
    const totalCount = totalClinicsFromUsers;
    const inactiveCount = Math.max(0, totalCount - activeCount);

    return {
      totalClinics: totalCount,
      activeClinics: activeCount,
      inactiveClinics: inactiveCount,
      utilizationRate: totalCount > 0 ? (activeCount / totalCount) * 100 : 0,
    };
  }, [data, selectedPartner, totalClinicsFromUsers]);

  const pieData = [
    {
      name: "Active Clinics",
      value: clinicData.activeClinics,
      color: "#10b981",
    },
    {
      name: "Inactive Clinics",
      value: clinicData.inactiveClinics,
      color: "#e5e7eb",
    },
  ];

  const displayData =
    clinicData.totalClinics === 0
      ? [{ name: "No Data", value: 1, color: "#f3f4f6" }]
      : pieData;

  return (
    <div className="mb-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Clinic Distribution
          </h3>
          <p className="text-sm text-gray-500">Active vs inactive clinics</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex justify-center">
            <ResponsiveContainer width={300} height={300}>
              <PieChart>
                <Pie
                  data={displayData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {displayData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-xl font-semibold text-gray-900">
                  {clinicData.totalClinics}
                </div>
                <div className="text-sm text-gray-500">Total Clinics</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-xl font-semibold text-green-600">
                  {clinicData.activeClinics}
                </div>
                <div className="text-sm text-gray-500">Active Today</div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Utilization Rate
                </span>
                <span className="text-lg font-semibold text-gray-900">
                  {clinicData.utilizationRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(clinicData.utilizationRate, 100)}%`,
                  }}
                ></div>
              </div>
            </div>

            {clinicData.totalClinics > 0 && (
              <div className="flex justify-center space-x-6 pt-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-700">
                    Active ({clinicData.activeClinics})
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-700">
                    Inactive ({clinicData.inactiveClinics})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
const AnalyticsDashboard = ({ currentUser }) => {
  const [data, setData] = useState([]);
  const [previousDayData, setPreviousDayData] = useState([]);
  const [totalClinicsFromUsers, setTotalClinicsFromUsers] = useState(0);
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [totalPharmacists, setTotalPharmacists] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState("all");
  const [granularity, setGranularity] = useState(15);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("today"); // "today" or "previous"
  const [currentTime, setCurrentTime] = useState(new Date()); // For real-time updates

  // Real-time clock update to refresh charts every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch total clinics from users collection where role = nurse
  useEffect(() => {
    const fetchTotalClinics = async () => {
      try {
        const usersQuery = query(
          collection(firestore, "users"),
          where("role", "==", "nurse")
        );

        const snapshot = await getDocs(usersQuery);
        const uniqueClinics = new Set();

        snapshot.docs.forEach((doc) => {
          const userData = doc.data();
          if (userData.clinicCode) {
            uniqueClinics.add(userData.clinicCode);
          }
        });

        setTotalClinicsFromUsers(uniqueClinics.size);
      } catch (err) {
        console.error("Error fetching total clinics:", err);
      }
    };

    fetchTotalClinics();
  }, []);

  // Fetch total doctors and pharmacists from users collection
  useEffect(() => {
    const fetchTotalStaff = async () => {
      try {
        const doctorsQuery = query(
          collection(firestore, "users"),
          where("role", "==", "doctor")
        );
        const doctorsSnapshot = await getDocs(doctorsQuery);
        setTotalDoctors(doctorsSnapshot.size);

        const pharmacistsQuery = query(
          collection(firestore, "users"),
          where("role", "==", "pharmacist")
        );
        const pharmacistsSnapshot = await getDocs(pharmacistsQuery);
        setTotalPharmacists(pharmacistsSnapshot.size);
      } catch (err) {
        console.error("Error fetching total staff:", err);
      }
    };

    fetchTotalStaff();
  }, []);

  // Fetch data for selected date
  useEffect(() => {
    const fetchSelectedDateData = async () => {
      if (viewMode === "today") return; // Today's data is handled by real-time effect

      try {
        const targetDate = new Date(selectedDate);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const dateQuery = query(
          collection(firestore, "cases"),
          where("createdAt", ">=", Timestamp.fromDate(targetDate)),
          where("createdAt", "<", Timestamp.fromDate(nextDay)),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(dateQuery);
        const dateData = snapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            createdAtProcessed: docData.createdAt?.toDate(),
            doctorCompletedAtProcessed: docData.doctorCompletedAt?.toDate(),
            pharmacistCompletedAtProcessed:
              docData.pharmacistCompletedAt?.toDate(),
          };
        });

        setPreviousDayData(dateData);
      } catch (err) {
        console.error("Error fetching selected date data:", err);
      }
    };

    fetchSelectedDateData();
  }, [selectedDate, viewMode]);

  // Optimized data fetching with performance improvements (today's data)
  useEffect(() => {
    const startTime = performance.now();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const initialQuery = query(
      collection(firestore, "cases"),
      where("createdAt", ">=", Timestamp.fromDate(today)),
      where("createdAt", "<", Timestamp.fromDate(tomorrow)),
      orderBy("createdAt", "desc")
    );

    const fetchInitialData = async () => {
      try {
        const snapshot = await getDocs(initialQuery);
        const initialData = snapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            createdAtProcessed: docData.createdAt?.toDate(),
            doctorCompletedAtProcessed: docData.doctorCompletedAt?.toDate(),
            pharmacistCompletedAtProcessed:
              docData.pharmacistCompletedAt?.toDate(),
          };
        });

        setData(initialData);
        setLoading(false);

        const endTime = performance.now();
        console.log(
          `Data fetch completed in ${(endTime - startTime).toFixed(
            2
          )} milliseconds`
        );

        const realTimeQuery = query(
          collection(firestore, "cases"),
          where("createdAt", ">=", Timestamp.fromDate(new Date())),
          orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
          realTimeQuery,
          (snapshot) => {
            const newCases = [];
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const docData = change.doc.data();
                const newCase = {
                  id: change.doc.id,
                  ...docData,
                  createdAtProcessed: docData.createdAt?.toDate(),
                  doctorCompletedAtProcessed:
                    docData.doctorCompletedAt?.toDate(),
                  pharmacistCompletedAtProcessed:
                    docData.pharmacistCompletedAt?.toDate(),
                };

                if (!initialData.some((item) => item.id === newCase.id)) {
                  newCases.push(newCase);
                }
              }
            });

            if (newCases.length > 0) {
              setData((prevData) => [...newCases, ...prevData]);
            }
          },
          (err) => {
            setError(err.message);
          }
        );

        return () => unsubscribe();
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [currentUser.uid]);

  const partners = useMemo(() => {
    const todayPartners = [
      ...new Set(data.map((item) => item.partnerName)),
    ].filter(Boolean);
    const previousPartners = [
      ...new Set(previousDayData.map((item) => item.partnerName)),
    ].filter(Boolean);
    return [...new Set([...todayPartners, ...previousPartners])];
  }, [data, previousDayData]);

  const filteredPartners = useMemo(() => {
    if (!partnerSearch) return partners;
    return partners.filter((partner) =>
      partner.toLowerCase().includes(partnerSearch.toLowerCase())
    );
  }, [partners, partnerSearch]);

  const handlePartnerSelect = (partner) => {
    setSelectedPartner(partner);
    setPartnerSearch(partner === "all" ? "" : partner);
    setShowPartnerDropdown(false);
  };

  const handleDateChange = (date) => {
    setSelectedDate(new Date(date));
  };

  const currentData = viewMode === "today" ? data : previousDayData;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-600">
            Loading analytics...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="text-center bg-white p-6 rounded-lg shadow">
          <div className="text-red-500 text-lg font-medium mb-2">
            Error loading data
          </div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* View Mode Toggle and Date Selector */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode("today")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                viewMode === "today"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Today's Activity
            </button>
            <button
              onClick={() => setViewMode("previous")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                viewMode === "previous"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Historical Data
            </button>
          </div>

          {/* Date Picker - Only show when in historical mode */}
          {viewMode === "previous" && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">
                Select Date:
              </label>
              <input
                type="date"
                value={selectedDate.toISOString().split("T")[0]}
                onChange={(e) => handleDateChange(e.target.value)}
                max={new Date().toISOString().split("T")[0]} // Prevent future dates
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Partner Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Partner
          </label>
          <div className="relative max-w-xs">
            <input
              type="text"
              value={partnerSearch}
              onChange={(e) => {
                setPartnerSearch(e.target.value);
                setShowPartnerDropdown(true);
              }}
              onFocus={() => setShowPartnerDropdown(true)}
              placeholder="Search partners..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {showPartnerDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                <div
                  onClick={() => handlePartnerSelect("all")}
                  className={`px-4 py-2 cursor-pointer hover:bg-gray-50 ${
                    selectedPartner === "all"
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-900"
                  }`}
                >
                  All Partners
                </div>
                {filteredPartners.map((partner) => (
                  <div
                    key={partner}
                    onClick={() => handlePartnerSelect(partner)}
                    className={`px-4 py-2 cursor-pointer hover:bg-gray-50 ${
                      selectedPartner === partner
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-900"
                    }`}
                  >
                    {partner}
                  </div>
                ))}
                {filteredPartners.length === 0 && partnerSearch && (
                  <div className="px-4 py-2 text-gray-500 text-sm">
                    No partners found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Click outside to close dropdown */}
          {showPartnerDropdown && (
            <div
              className="fixed inset-0 z-5"
              onClick={() => setShowPartnerDropdown(false)}
            />
          )}
        </div>

        {/* Conditional Content Based on View Mode */}
        {viewMode === "today" ? (
          <>
            {/* Summary Cards */}
            <SummaryCards
              data={currentData}
              selectedPartner={selectedPartner}
            />

            {/* Case Timeline */}
            <CaseTimelineRow
              data={currentData}
              selectedPartner={selectedPartner}
              granularity={granularity}
              setGranularity={setGranularity}
              totalDoctors={totalDoctors}
              totalPharmacists={totalPharmacists}
            />

            {/* Doctor Utilization */}
            <DoctorUtilizationRow
              data={currentData}
              selectedPartner={selectedPartner}
              granularity={granularity}
              totalDoctors={totalDoctors}
            />

            {/* Clinic Distribution */}
            <ClinicDistributionRow
              data={currentData}
              selectedPartner={selectedPartner}
              totalClinicsFromUsers={totalClinicsFromUsers}
            />
          </>
        ) : (
          <>
            {/* Selected Date Summary */}
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Cases Data for {selectedDate.toLocaleDateString()}
                </h2>
                <div className="text-sm text-gray-600">
                  Total cases: {currentData.length} | Completed cases:{" "}
                  {
                    currentData.filter(
                      (c) =>
                        c.status === "completed" ||
                        c.status === "doctor_completed" ||
                        c.incomplete === true
                    ).length
                  }
                </div>
              </div>
            </div>

            {/* Cases Completion Chart */}
            <CasesCompletionChart
              data={currentData}
              selectedPartner={selectedPartner}
              granularity={granularity}
              setGranularity={setGranularity}
              selectedDate={selectedDate}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
