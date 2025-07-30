import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { firestore } from "../../firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Users,
  FileText,
  Activity,
  BarChart3,
  Clock,
  Stethoscope,
  Users2,
} from "lucide-react";
import { categories, subcategories } from "./mappings";
import { doctorCategories, doctorSubcategories } from "./doctorMappings";

const UnifiedFeedbackAnalytics = ({ currentUser }) => {
  const [nurseTickets, setNurseTickets] = useState([]);
  const [doctorTickets, setDoctorTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  // const [allTickets, setAllTickets] = useState('')
  const [ticketType, setTicketType] = useState('all')
   // Check if user has access to analytics
  const hasAccess =
    currentUser.email === "Akash.das@m-insure.in" ||
    currentUser.role === "superAdmin";

  // Helper function to calculate TAT in hours
  const calculateTAT = (createdAt, closedAt) => {
    if (!createdAt || !closedAt) return null;

    const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const closed = closedAt.toDate ? closedAt.toDate() : new Date(closedAt);

    const diffInMs = closed.getTime() - created.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    return Math.round(diffInHours * 100) / 100; // Round to 2 decimal places
  };

  // Helper function to format TAT display
  const formatTAT = (hours) => {
    if (!hours) return "N/A";
    if( hours <1) {
      const minutes = Math.floor( hours*60 );
      return `${minutes}min`;
    } 
    if (hours < 24) {
      return `${hours}h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.floor(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  // Fetch nurse tickets
  useEffect(() => {
    if (!hasAccess) return;

    const nurseTicketsQuery = query(
      collection(firestore, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(nurseTicketsQuery, (snapshot) => {
      const fetchedTickets = snapshot.docs.map((doc) => {
        const data = doc.data();
        let closedAt = null;

        // Find the closed timestamp from comments
        if (data.comments && Array.isArray(data.comments)) {
          const closedComment = data.comments
            .filter((comment) => comment.side === "qa")
            .find((comment) => {
              const commentLower = comment.comment.toLowerCase();
              return (
                commentLower.includes("closed") ||
                commentLower.includes("resolved") ||
                commentLower.includes("completed")
              );
            });

          if (closedComment && closedComment.time) {
            closedAt = closedComment.time;
          }
        }

        // If no closed comment found but status is closed, use lastUpdatedAt
        if (!closedAt && data.status === "closed" && data.lastUpdatedAt) {
          closedAt = data.lastUpdatedAt;
        }

        const tat = calculateTAT(data.createdAt, closedAt);

        return {
          id: doc.id,
          ...data,
          closedAt,
          tat,
          ticketType: 'nurse',
        };
      });

      setNurseTickets(fetchedTickets);
    });

    return () => unsubscribe();
  }, [hasAccess]);

  // Fetch doctor tickets
  useEffect(() => {
    if (!hasAccess) return;

    const doctorTicketsQuery = query(
      collection(firestore, "doctor_tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(doctorTicketsQuery, (snapshot) => {
      const fetchedTickets = snapshot.docs.map((doc) => {
        const data = doc.data();
        let closedAt = null;

        // Find the closed timestamp from comments
        if (data.comments && Array.isArray(data.comments)) {
          const closedComment = data.comments
            .filter((comment) => comment.side === "qa")
            .find((comment) => {
              const commentLower = comment.comment.toLowerCase();
              return (
                commentLower.includes("closed") ||
                commentLower.includes("resolved") ||
                commentLower.includes("completed")
              );
            });

          if (closedComment && closedComment.time) {
            closedAt = closedComment.time;
          }
        }

        // If no closed comment found but status is closed, use lastUpdatedAt
        if (!closedAt && data.status === "closed" && data.lastUpdatedAt) {
          closedAt = data.lastUpdatedAt;
        }

        const tat = calculateTAT(data.createdAt, closedAt);

        return {
          id: doc.id,
          ...data,
          closedAt,
          tat,
          ticketType: 'doctor',
        };
      });

      setDoctorTickets(fetchedTickets);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <div className="max-w-12xl mx-auto p-4">
        <Card className="border border-gray-200">
          <CardContent className="p-8 text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-700 mb-1">
              Access Denied
            </h3>
            <p className="text-gray-500">
              You don't have permission to view analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-12xl mx-auto p-4">
        <Card className="border border-gray-200">
          <CardContent className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Combine all tickets
  const allTickets = [...nurseTickets, ...doctorTickets];

  // Calculate overall statistics
  const totalIssues = allTickets.length;
  const nurseIssues = nurseTickets.length;
  const doctorIssues = doctorTickets.length;
  
  const statusCounts = allTickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {});


  // Calculate TAT statistics
  const closedTicketsWithTAT = allTickets.filter(
    (ticket) => ticket.status === "closed" && ticket.tat !== null
  );
  const avgTAT =
    closedTicketsWithTAT.length > 0
      ? closedTicketsWithTAT.reduce((sum, ticket) => sum + ticket.tat, 0) /
        closedTicketsWithTAT.length
      : 0;


    const closedDoctorTicketsWithTAT = doctorTickets.filter(
    (ticket) => ticket.status === "closed" && ticket.tat !== null
  );


   const closedNurseTicketsWithTAT = nurseTickets.filter(
    (ticket) => ticket.status === "closed" && ticket.tat !== null
  );
  const avgTATofDoctor =
    closedDoctorTicketsWithTAT.length > 0
      ? closedDoctorTicketsWithTAT.reduce((sum, ticket) => sum + ticket.tat, 0) /
        closedDoctorTicketsWithTAT.length
      : 0;
      
  const avgTATofNurse =
    closedNurseTicketsWithTAT.length > 0
      ? closedNurseTicketsWithTAT.reduce((sum, ticket) => sum + ticket.tat, 0) /
        closedNurseTicketsWithTAT.length
      : 0;

  // TAT distribution data
  const tatRanges = [
    { range: "0-24h", min: 0, max: 24, count: 0 },
    { range: "1-3 days", min: 24, max: 72, count: 0 },
    { range: "3-7 days", min: 72, max: 168, count: 0 },
    { range: "1-2 weeks", min: 168, max: 336, count: 0 },
    { range: "> 2 weeks", min: 336, max: Infinity, count: 0 },
  ];

  closedTicketsWithTAT.forEach((ticket) => {
    for (let range of tatRanges) {
      if (ticket.tat >= range.min && ticket.tat < range.max) {
        range.count++;
        break;
      }
    }
  });

  // Calculate unified issue category data
  const getAllCategories = () => {
    const nurseCategories = categories.map(cat => ({ ...cat, type: 'nurse' }));
    const docCategories = doctorCategories.map(cat => ({ ...cat, type: 'doctor' }));
    return [...nurseCategories, ...docCategories];
  };

  const categoryData = getAllCategories()
    .map((category) => {
      const categoryTickets = allTickets.filter(
        (ticket) => ticket.issue === category.value && 
        ((category.type === 'nurse' && ticket.ticketType === 'nurse') ||
         (category.type === 'doctor' && ticket.ticketType === 'doctor'))
      );
      const count = categoryTickets.length;
      return {
        name: category.label.split(" | ")[0],
        count: count,
        type: category.type,
        fullLabel: category.label,
      };
    })
    .filter((item) => item.count > 0);

  // Calculate QA assignment data with TAT
  const qaData = {};
  allTickets.forEach((ticket) => {
    if (ticket.qaNames && Array.isArray(ticket.qaNames)) {
      ticket.qaNames.forEach((qaName) => {
        if (!qaData[qaName]) {
          qaData[qaName] = {
            name: qaName,
            total: 0,
            nurse: 0,
            doctor: 0,
            open: 0,
            "in-progress": 0,
            resolved: 0,
            closed: 0,
            totalTAT: 0,
            tatCount: 0,
          };
        }
        qaData[qaName].total += 1;
        qaData[qaName][ticket.ticketType] += 1;
        qaData[qaName][ticket.status] += 1;

        if (ticket.status === "closed" && ticket.tat !== null) {
          qaData[qaName].totalTAT += ticket.tat;
          qaData[qaName].tatCount += 1;
        }
      });
    } else if (ticket.qaName) {
      if (!qaData[ticket.qaName]) {
        qaData[ticket.qaName] = {
          name: ticket.qaName,
          total: 0,
          nurse: 0,
          doctor: 0,
          open: 0,
          "in-progress": 0,
          resolved: 0,
          closed: 0,
          totalTAT: 0,
          tatCount: 0,
        };
      }
      qaData[ticket.qaName].total += 1;
      qaData[ticket.qaName][ticket.ticketType] += 1;
      qaData[ticket.qaName][ticket.status] += 1;

      if (ticket.status === "closed" && ticket.tat !== null) {
        qaData[ticket.qaName].totalTAT += ticket.tat;
        qaData[ticket.qaName].tatCount += 1;
      }
    }
  });

  // Add average TAT to QA data
  Object.values(qaData).forEach((qa) => {
    qa.avgTAT = qa.tatCount > 0 ? qa.totalTAT / qa.tatCount : 0;
  });

  const qaAnalysisData = Object.values(qaData).sort(
    (a, b) => b.total - a.total
  );

  // Status data for bar chart
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1).replace("-", " "),
    count: count,
    status: status,
  }));

  // Calculate ticket type comparison data
  const ticketTypeData = [
    { type: "Nurse", count: nurseIssues, icon: "nurse" },
    { type: "Doctor", count: doctorIssues, icon: "doctor" },
  ];

  // Calculate state-wise data with TAT (for nurse tickets)
  const stateData = {};
  nurseTickets.forEach((ticket) => {
    if (ticket.state) {
      if (!stateData[ticket.state]) {
        stateData[ticket.state] = {
          name: ticket.state,
          total: 0,
          open: 0,
          "in-progress": 0,
          resolved: 0,
          closed: 0,
          totalTAT: 0,
          tatCount: 0,
        };
      }
      stateData[ticket.state].total += 1;
      stateData[ticket.state][ticket.status] += 1;

      if (ticket.status === "closed" && ticket.tat !== null) {
        stateData[ticket.state].totalTAT += ticket.tat;
        stateData[ticket.state].tatCount += 1;
      }
    }
  });

  // Add average TAT to state data
  Object.values(stateData).forEach((state) => {
    state.avgTAT = state.tatCount > 0 ? state.totalTAT / state.tatCount : 0;
  });

  const stateAnalysisData = Object.values(stateData).sort(
    (a, b) => b.total - a.total
  );

  // Calculate partner-wise data with TAT (for doctor tickets)
  const partnerData = {};
  doctorTickets.forEach((ticket) => {
    if (ticket.partnerName) {
      if (!partnerData[ticket.partnerName]) {
        partnerData[ticket.partnerName] = {
          name: ticket.partnerName,
          total: 0,
          open: 0,
          "in-progress": 0,
          resolved: 0,
          closed: 0,
          totalTAT: 0,
          tatCount: 0,
        };
      }
      partnerData[ticket.partnerName].total += 1;
      partnerData[ticket.partnerName][ticket.status] += 1;

      if (ticket.status === "closed" && ticket.tat !== null) {
        partnerData[ticket.partnerName].totalTAT += ticket.tat;
        partnerData[ticket.partnerName].tatCount += 1;
      }
    }
  });

  // Add average TAT to partner data
  Object.values(partnerData).forEach((partner) => {
    partner.avgTAT = partner.tatCount > 0 ? partner.totalTAT / partner.tatCount : 0;
  });

  const partnerAnalysisData = Object.values(partnerData).sort(
    (a, b) => b.total - a.total
  );

  // Calculate issue category data with TAT
  const issueCategoryTATData = {};
  allTickets.forEach((ticket) => {
    if (ticket.issue) {
      const ticketCategories = ticket.ticketType === 'doctor' ? doctorCategories : categories;
      const categoryItem = ticketCategories.find(
        (item) => item.value === ticket.issue
      );
      const issueType = categoryItem
        ? categoryItem.label.split(" | ")[0]
        : ticket.issue;

      if (!issueCategoryTATData[issueType]) {
        issueCategoryTATData[issueType] = {
          name: issueType,
          total: 0,
          open: 0,
          "in-progress": 0,
          resolved: 0,
          closed: 0,
          totalTAT: 0,
          tatCount: 0,
        };
      }
      issueCategoryTATData[issueType].total += 1;
      issueCategoryTATData[issueType][ticket.status] += 1;

      if (ticket.status === "closed" && ticket.tat !== null) {
        issueCategoryTATData[issueType].totalTAT += ticket.tat;
        issueCategoryTATData[issueType].tatCount += 1;
      }
    }
  });

  // Add average TAT to issue category data
  Object.values(issueCategoryTATData).forEach((category) => {
    category.avgTAT =
      category.tatCount > 0 ? category.totalTAT / category.tatCount : 0;
  });

  const issueCategoryAnalysisData = Object.values(issueCategoryTATData)
    .filter((category) => category.total > 0)
    .sort((a, b) => b.avgTAT - a.avgTAT); // Sort by highest TAT first

  return (
    <div className="max-w-12xl mx-auto  space-y-6">
      {/* Header */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Unified Support Analytics Dashboard
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Combined analytics for nurse and doctor support tickets
          </p>
        </CardHeader>
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="border border-blue-200 hover:border hover:border-blue-600 hover:shadow">
          <CardContent className="p-4 text-center">
            <FileText className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-xl font-semibold text-gray-800">
              {totalIssues}
            </div>
            <div className="text-sm text-gray-600">Total Issues</div>
          </CardContent>
        </Card>

        <Card className="border border-green-200 hover:border hover:border-green-600 hover:shadow">
          <CardContent className="p-4 text-center">
            <Users2 className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <div className="text-xl font-semibold text-gray-800">
              {nurseIssues}
            </div>
            <div className="text-sm text-gray-600">Nurse Issues</div>
          </CardContent>
        </Card>

        <Card className="border border-purple-200 hover:border hover:border-purple-600 hover:shadow">
          <CardContent className="p-4 text-center">
            <Stethoscope className="w-6 h-6 mx-auto mb-2 text-purple-600" />
            <div className="text-xl font-semibold text-gray-800">
              {doctorIssues}
            </div>
            <div className="text-sm text-gray-600">Doctor Issues</div>
          </CardContent>
        </Card>

        <Card className="border border-red-200 hover:border hover:border-red-600 hover:shadow">
          <CardContent className="p-4 text-center">
            <Activity className="w-6 h-6 mx-auto mb-2 text-red-600" />
            <div className="text-xl font-semibold text-gray-800">
              {statusCounts.open || 0}
            </div>
            <div className="text-sm text-gray-600">Open Issues</div>
          </CardContent>
        </Card>

        <Card className="border border-yellow-200 hover:border hover:border-yellow-600 hover:shadow">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
            <div className="text-xl font-semibold text-gray-800">
              {qaAnalysisData.length}
            </div>
            <div className="text-sm text-gray-600">QA Members</div>
          </CardContent>
        </Card>

        {/* <Card className="border border-blue-200 hover:border hover:border-blue-600 hover:shadow">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-xl font-semibold text-gray-800">
              {formatTAT(avgTAT)}
            </div>
            <div className="text-sm text-gray-600">Avg TAT</div>
          </CardContent>
        </Card> */}

        <Card className="border border-blue-200 hover:border-blue-600 hover:shadow">
  <CardContent className="p-4">
    <div className="flex items-center justify-center gap-2 mb-4">
      <Clock className="w-6 h-6 text-blue-600" />
      <h2 className="text-lg font-semibold text-gray-800">Average TAT</h2>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Doctor TAT */}
      <div className="rounded-lg border p-3 text-center bg-blue-50 hover:shadow-sm transition">
        <div className=" text-blue-700 font-semibold">{formatTAT(avgTATofDoctor)}</div>
        <div className="text-sm text-gray-600">Doctor</div>
      </div>

      {/* Nurse TAT */}
      <div className="rounded-lg border p-3 text-center bg-blue-50 hover:shadow-sm transition">
        <div className="text-blue-700 font-semibold ">{formatTAT(avgTATofNurse)}</div>
        <div className="text-sm text-gray-600">Nurse</div>
      </div>
    </div>
  </CardContent>
</Card>

      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className={`${activeTab === "overview" ? 'border-blue-500 text-blue-600' : 'border-transparent' }`}>Overview</TabsTrigger>
          <TabsTrigger value="categories" className={`${activeTab === "categories" ? 'border-blue-500 text-blue-600' : 'border-transparent' }`}>Issue Analysis</TabsTrigger>
          <TabsTrigger value="qa-analysis" className={`${activeTab === "qa-analysis" ? 'border-blue-500 text-blue-600' : 'border-transparent' }`}>QA Performance</TabsTrigger>
          <TabsTrigger value="state-partner" className={`${activeTab === "state-partner" ? 'border-blue-500 text-blue-600' : 'border-transparent' }`}>State/Partner</TabsTrigger>
          <TabsTrigger value="tat-analysis" className={`${activeTab === "tat-analysis" ? 'border-blue-500 text-blue-600' : 'border-transparent' }`}>TAT Analysis</TabsTrigger>
          <TabsTrigger value="department-tat" className={`${activeTab === "department-tat" ? 'border-blue-500 text-blue-600' : 'border-transparent' }`}>Dept TAT</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">
                  Ticket Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ticketTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="type" fontSize={12} stroke="#666" />
                    <YAxis fontSize={11} stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={11} stroke="#666" />
                    <YAxis fontSize={11} stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" fill="#10B981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">
                  QA Workload Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {qaAnalysisData.slice(0, 5).map((qa, index) => (
                    <div key={qa.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">{qa.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {qa.total} tickets
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-blue-50">
                          {formatTAT(qa.avgTAT)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* State/Partner Analysis Tab */}
        <TabsContent value="state-partner" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* State Analysis for Nurse Tickets */}
            <div className="space-y-4">
              <Card className="border border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium text-gray-800 flex items-center gap-2">
                    <Users2 className="w-5 h-5 text-green-600" />
                    Nurse Tickets by State
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stateAnalysisData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        fontSize={10}
                        stroke="#666"
                      />
                      <YAxis fontSize={11} stroke="#666" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="total" fill="#10B981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* State Performance Cards */}
              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                {stateAnalysisData.slice(0, 8).map((state, index) => (
                  <Card key={state.name} className="border border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-800 text-sm">{state.name}</h4>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {state.total} Total
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-green-50">
                            TAT: {formatTAT(state.avgTAT)}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-center text-xs">
                        <div className="p-1 bg-red-50 rounded">
                          <div className="font-semibold text-red-700">{state.open}</div>
                          <div className="text-red-600">Open</div>
                        </div>
                        <div className="p-1 bg-yellow-50 rounded">
                          <div className="font-semibold text-yellow-700">{state["in-progress"]}</div>
                          <div className="text-yellow-600">Progress</div>
                        </div>
                        <div className="p-1 bg-green-50 rounded">
                          <div className="font-semibold text-green-700">{state.resolved}</div>
                          <div className="text-green-600">Resolved</div>
                        </div>
                        <div className="p-1 bg-gray-50 rounded">
                          <div className="font-semibold text-gray-700">{state.closed}</div>
                          <div className="text-gray-600">Closed</div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Resolution Rate</span>
                          <span>
                            {Math.round(((state.resolved + state.closed) / state.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-green-600 h-1 rounded-full transition-all duration-300"
                            style={{
                              width: `${((state.resolved + state.closed) / state.total) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Partner Analysis for Doctor Tickets */}
            <div className="space-y-4">
              <Card className="border border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium text-gray-800 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-purple-600" />
                    Doctor Tickets by Partner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={partnerAnalysisData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        fontSize={10}
                        stroke="#666"
                      />
                      <YAxis fontSize={11} stroke="#666" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="total" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Partner Performance Cards */}
              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                {partnerAnalysisData.slice(0, 8).map((partner, index) => (
                  <Card key={partner.name} className="border border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-800 text-sm">{partner.name}</h4>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {partner.total} Total
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-purple-50">
                            TAT: {formatTAT(partner.avgTAT)}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-center text-xs">
                        <div className="p-1 bg-red-50 rounded">
                          <div className="font-semibold text-red-700">{partner.open}</div>
                          <div className="text-red-600">Open</div>
                        </div>
                        <div className="p-1 bg-yellow-50 rounded">
                          <div className="font-semibold text-yellow-700">{partner["in-progress"]}</div>
                          <div className="text-yellow-600">Progress</div>
                        </div>
                        <div className="p-1 bg-green-50 rounded">
                          <div className="font-semibold text-green-700">{partner.resolved}</div>
                          <div className="text-green-600">Resolved</div>
                        </div>
                        <div className="p-1 bg-gray-50 rounded">
                          <div className="font-semibold text-gray-700">{partner.closed}</div>
                          <div className="text-gray-600">Closed</div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Resolution Rate</span>
                          <span>
                            {Math.round(((partner.resolved + partner.closed) / partner.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-purple-600 h-1 rounded-full transition-all duration-300"
                            style={{
                              width: `${((partner.resolved + partner.closed) / partner.total) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Combined State vs Partner TAT Comparison */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800">
                State vs Partner TAT Comparison
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Average resolution time comparison between nurse states and doctor partners
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Top States by TAT (Nurse)</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stateAnalysisData.filter((state) => state.avgTAT > 0).slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        fontSize={10}
                        stroke="#666"
                      />
                      <YAxis fontSize={11} stroke="#666" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                        formatter={(value) => [formatTAT(value), "Average TAT"]}
                      />
                      <Bar dataKey="avgTAT" fill="#10B981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Top Partners by TAT (Doctor)</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={partnerAnalysisData.filter((partner) => partner.avgTAT > 0).slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        fontSize={10}
                        stroke="#666"
                      />
                      <YAxis fontSize={11} stroke="#666" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                        formatter={(value) => [formatTAT(value), "Average TAT"]}
                      />
                      <Bar dataKey="avgTAT" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Department TAT Analysis Tab */}
        <TabsContent value="department-tat" className="space-y-4">
          {/* Issue Category TAT Performance */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Issue Category TAT Performance
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Average resolution time by issue type/department
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={issueCategoryAnalysisData.filter(
                    (category) => category.avgTAT > 0
                  )}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                    fontSize={11}
                    stroke="#666"
                  />
                  <YAxis fontSize={11} stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => [
                      formatTAT(value),
                      "Average TAT",
                    ]}
                    labelFormatter={(label) => `Category: ${label}`}
                  />
                  <Bar dataKey="avgTAT" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Issue Category Performance Cards */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Department Performance Overview
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Detailed breakdown by issue category/department
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {issueCategoryAnalysisData.map((category, index) => (
                  <div
                    key={category.name}
                    className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-gray-50 to-white"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-800 flex items-center gap-2">
                        {category.name === "HR Team" && (
                          <Users className="w-4 h-4 text-blue-500" />
                        )}
                        {category.name === "Online Team" && (
                          <Activity className="w-4 h-4 text-green-500" />
                        )}
                        {category.name === "Clinic Issues" && (
                          <BarChart3 className="w-4 h-4 text-purple-500" />
                        )}
                        {!["HR Team", "Online Team", "Clinic Issues"].includes(category.name) && (
                          <FileText className="w-4 h-4 text-gray-500" />
                        )}
                        {category.name}
                      </h4>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {category.total} Total
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            category.avgTAT < 24
                              ? "bg-green-50 text-green-700"
                              : category.avgTAT < 72
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          TAT: {formatTAT(category.avgTAT)}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                      <div className="p-2 bg-red-50 rounded">
                        <div className="font-semibold text-red-700">
                          {category.open}
                        </div>
                        <div className="text-red-600">Open</div>
                      </div>
                      <div className="p-2 bg-yellow-50 rounded">
                        <div className="font-semibold text-yellow-700">
                          {category["in-progress"]}
                        </div>
                        <div className="text-yellow-600">Progress</div>
                      </div>
                      <div className="p-2 bg-green-50 rounded">
                        <div className="font-semibold text-green-700">
                          {category.resolved}
                        </div>
                        <div className="text-green-600">Resolved</div>
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <div className="font-semibold text-gray-700">
                          {category.closed}
                        </div>
                        <div className="text-gray-600">Closed</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Resolution Rate</span>
                        <span>
                          {Math.round(
                            ((category.resolved + category.closed) /
                              category.total) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              ((category.resolved + category.closed) /
                                category.total) *
                              100
                            }%`,
                          }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-xs text-gray-600 mt-2">
                        <span>Closed Tickets with TAT</span>
                        <span>
                          {category.tatCount} of {category.closed}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            category.avgTAT < 24
                              ? "bg-green-500"
                              : category.avgTAT < 72
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{
                            width: `${
                              category.closed > 0
                                ? (category.tatCount / category.closed) * 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {issueCategoryAnalysisData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No issue categories found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issue Category Comparison Chart */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Department Workload vs TAT Comparison
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Volume of tickets vs average resolution time by department
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={issueCategoryAnalysisData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={11} stroke="#666" />
                  <YAxis yAxisId="left" fontSize={11} stroke="#666" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    fontSize={11}
                    stroke="#666"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => {
                      if (name === "Average TAT")
                        return [formatTAT(value), name];
                      return [value, name];
                    }}
                  />
                  <Legend fontSize={12} />
                  <Bar
                    yAxisId="left"
                    dataKey="total"
                    fill="#3B82F6"
                    name="Total Tickets"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="avgTAT"
                    fill="#EF4444"
                    name="Average TAT (Hours)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issue Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800">
                Issue Categories (Nurse & Doctor Combined)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={10}
                    stroke="#666"
                  />
                  <YAxis fontSize={11} stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value, name, props) => [
                      value,
                      `Count (${props.payload.type})`
                    ]}
                  />
                  <Bar 
                    dataKey="count" 
                    fill={(entry) => entry.type === 'doctor' ? '#8B5CF6' : '#10B981'}
                    radius={[2, 2, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QA Analysis Tab */}
        <TabsContent value="qa-analysis" className="space-y-4">
          {/* QA Performance Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {qaAnalysisData.map((qa, index) => (
              <Card key={qa.name} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">{qa.name}</h4>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {qa.total} Total
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-blue-50">
                        TAT: {formatTAT(qa.avgTAT)}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
                    <div className="p-2 bg-green-50 rounded">
                      <div className="font-semibold text-green-700">
                        {qa.nurse}
                      </div>
                      <div className="text-green-600">Nurse</div>
                    </div>
                    <div className="p-2 bg-purple-50 rounded">
                      <div className="font-semibold text-purple-700">
                        {qa.doctor}
                      </div>
                      <div className="text-purple-600">Doctor</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">
                        {qa.open}
                      </div>
                      <div className="text-gray-600">Open</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">
                        {qa["in-progress"]}
                      </div>
                      <div className="text-gray-600">Progress</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">
                        {qa.resolved}
                      </div>
                      <div className="text-gray-600">Resolved</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">
                        {qa.closed}
                      </div>
                      <div className="text-gray-600">Closed</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Resolution Rate</span>
                      <span>
                        {Math.round(
                          ((qa.resolved + qa.closed) / qa.total) * 100
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            ((qa.resolved + qa.closed) / qa.total) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAT Analysis Tab */}
        <TabsContent value="tat-analysis" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* TAT Distribution Chart */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">
                  TAT Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tatRanges}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="range" fontSize={11} stroke="#666" />
                    <YAxis fontSize={11} stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* TAT Statistics */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">
                  TAT Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-semibold text-blue-700">
                      {closedTicketsWithTAT.length}
                    </div>
                    <div className="text-sm text-blue-600">Closed Tickets</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-semibold text-green-700">
                      {formatTAT(avgTAT)}
                    </div>
                    <div className="text-sm text-green-600">Average TAT</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">TAT Breakdown:</h4>
                  {tatRanges.map((range, index) => (
                    <div
                      key={range.range}
                      className="flex justify-between items-center py-1"
                    >
                      <span className="text-sm text-gray-600">
                        {range.range}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {range.count}
                        </span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                closedTicketsWithTAT.length > 0
                                  ? (range.count /
                                      closedTicketsWithTAT.length) *
                                    100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* QA TAT Performance */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800">
                QA TAT Performance (Combined)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={qaAnalysisData.filter((qa) => qa.avgTAT > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                    fontSize={11}
                    stroke="#666"
                  />
                  <YAxis fontSize={11} stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [formatTAT(value), "Average TAT"]}
                  />
                  <Bar dataKey="avgTAT" fill="#10B981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};


export default UnifiedFeedbackAnalytics;