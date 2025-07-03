import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { firestore } from "../../firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, FileText, Activity, BarChart3, Clock } from "lucide-react";
import { categories, subcategories } from "./mappings";

const FeedbackAnalytics = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Check if user has access to analytics
  const hasAccess = currentUser.email === "Akash.das@m-insure.in" || currentUser.role === "superAdmin";

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
    
    if (hours < 24) {
      return `${hours}h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.floor(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  useEffect(() => {
    if (!hasAccess) return;

    const ticketsQuery = query(
      collection(firestore, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const fetchedTickets = snapshot.docs.map((doc) => {
        const data = doc.data();
        let closedAt = null;
        
        // Find the closed timestamp from comments
        if (data.comments && Array.isArray(data.comments)) {
          const closedComment = data.comments
            .filter(comment => comment.side === "qa")
            .find(comment => {
              const commentLower = comment.comment.toLowerCase();
              return commentLower.includes("closed") || 
                     commentLower.includes("resolved") ||
                     commentLower.includes("completed");
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
          tat
        };
      });
      
      setTickets(fetchedTickets);
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
            <h3 className="text-lg font-medium text-gray-700 mb-1">Access Denied</h3>
            <p className="text-gray-500">You don't have permission to view analytics.</p>
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

  // Calculate overall statistics
  const totalIssues = tickets.length;
  const statusCounts = tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {});

  // Calculate TAT statistics
  const closedTicketsWithTAT = tickets.filter(ticket => ticket.status === "closed" && ticket.tat !== null);
  const avgTAT = closedTicketsWithTAT.length > 0 
    ? closedTicketsWithTAT.reduce((sum, ticket) => sum + ticket.tat, 0) / closedTicketsWithTAT.length
    : 0;

  // TAT distribution data
  const tatRanges = [
    { range: "0-24h", min: 0, max: 24, count: 0 },
    { range: "1-3 days", min: 24, max: 72, count: 0 },
    { range: "3-7 days", min: 72, max: 168, count: 0 },
    { range: "1-2 weeks", min: 168, max: 336, count: 0 },
    { range: "> 2 weeks", min: 336, max: Infinity, count: 0 }
  ];

  closedTicketsWithTAT.forEach(ticket => {
    for (let range of tatRanges) {
      if (ticket.tat >= range.min && ticket.tat < range.max) {
        range.count++;
        break;
      }
    }
  });

  // Calculate issue category data
  const categoryData = categories.map(category => {
    const count = tickets.filter(ticket => ticket.issue === category.value).length;
    return {
      name: category.label.split(' | ')[0],
      count: count,
      fullLabel: category.label
    };
  }).filter(item => item.count > 0);

  // Calculate subcategory data
  const subcategoryData = [];
  Object.keys(subcategories).forEach(categoryKey => {
    subcategories[categoryKey].forEach(subcategory => {
      const count = tickets.filter(ticket => 
        ticket.issue === categoryKey && ticket.subIssue === subcategory.value
      ).length;
      if (count > 0) {
        subcategoryData.push({
          name: subcategory.label.split(' | ')[0],
          count: count,
          category: categoryKey
        });
      }
    });
  });

  // Calculate QA assignment data with TAT
  const qaData = {};
  tickets.forEach(ticket => {
    if (ticket.qaNames && Array.isArray(ticket.qaNames)) {
      ticket.qaNames.forEach(qaName => {
        if (!qaData[qaName]) {
          qaData[qaName] = {
            name: qaName,
            total: 0,
            open: 0,
            'in-progress': 0,
            resolved: 0,
            closed: 0,
            totalTAT: 0,
            tatCount: 0
          };
        }
        qaData[qaName].total += 1;
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
          open: 0,
          'in-progress': 0,
          resolved: 0,
          closed: 0,
          totalTAT: 0,
          tatCount: 0
        };
      }
      qaData[ticket.qaName].total += 1;
      qaData[ticket.qaName][ticket.status] += 1;
      
      if (ticket.status === "closed" && ticket.tat !== null) {
        qaData[ticket.qaName].totalTAT += ticket.tat;
        qaData[ticket.qaName].tatCount += 1;
      }
    }
  });

  // Add average TAT to QA data
  Object.values(qaData).forEach(qa => {
    qa.avgTAT = qa.tatCount > 0 ? qa.totalTAT / qa.tatCount : 0;
  });

  const qaAnalysisData = Object.values(qaData).sort((a, b) => b.total - a.total);

  // Status data for bar chart
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
    count: count,
    status: status
  }));

  // Calculate state-wise data with TAT
  const stateData = {};
  tickets.forEach(ticket => {
    if (ticket.state) {
      if (!stateData[ticket.state]) {
        stateData[ticket.state] = {
          name: ticket.state,
          total: 0,
          open: 0,
          'in-progress': 0,
          resolved: 0,
          closed: 0,
          totalTAT: 0,
          tatCount: 0
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
  Object.values(stateData).forEach(state => {
    state.avgTAT = state.tatCount > 0 ? state.totalTAT / state.tatCount : 0;
  });

  const stateAnalysisData = Object.values(stateData).sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-12xl mx-auto p-4 space-y-6">
      {/* Header */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border border-gray-200">
          <CardContent className="p-4 text-center">
            <FileText className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-xl font-semibold text-gray-800">{totalIssues}</div>
            <div className="text-sm text-gray-600">Total Issues</div>
          </CardContent>
        </Card>
        
        <Card className="border border-gray-200">
          <CardContent className="p-4 text-center">
            <Activity className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-xl font-semibold text-gray-800">{statusCounts.open || 0}</div>
            <div className="text-sm text-gray-600">Open Issues</div>
          </CardContent>
        </Card>
        
        <Card className="border border-gray-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-xl font-semibold text-gray-800">{statusCounts['in-progress'] || 0}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </CardContent>
        </Card>
        
        <Card className="border border-gray-200">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-xl font-semibold text-gray-800">{qaAnalysisData.length}</div>
            <div className="text-sm text-gray-600">QA Members</div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-xl font-semibold text-gray-800">{formatTAT(avgTAT)}</div>
            <div className="text-sm text-gray-600">Avg TAT</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="categories">Issue Categories</TabsTrigger>
          <TabsTrigger value="subcategories">Sub-Categories</TabsTrigger>
          <TabsTrigger value="states">State Analysis</TabsTrigger>
          <TabsTrigger value="qa-analysis">QA Analysis</TabsTrigger>
          <TabsTrigger value="tat-analysis">TAT Analysis</TabsTrigger>
        </TabsList>

        {/* Issue Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">Issue Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={categoryData}>
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
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }} 
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      fontSize={11}
                      stroke="#666"
                    />
                    <YAxis fontSize={11} stroke="#666" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }} 
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* State Analysis Tab */}
        <TabsContent value="states" className="space-y-4">
          {/* State Performance Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stateAnalysisData.map((state, index) => (
              <Card key={state.name} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">{state.name}</h4>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {state.total} Total
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-blue-50">
                        TAT: {formatTAT(state.avgTAT)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">{state.open}</div>
                      <div className="text-gray-600">Open</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">{state['in-progress']}</div>
                      <div className="text-gray-600">Progress</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">{state.resolved}</div>
                      <div className="text-gray-600">Resolved</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">{state.closed}</div>
                      <div className="text-gray-600">Closed</div>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Resolution Rate</span>
                      <span>{Math.round(((state.resolved + state.closed) / state.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${((state.resolved + state.closed) / state.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* State Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">Total Issues by State</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stateAnalysisData}>
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
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }} 
                    />
                    <Bar dataKey="total" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">State Workload Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stateAnalysisData}>
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
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }} 
                    />
                    <Legend fontSize={12} />
                    <Bar dataKey="open" stackId="a" fill="#EF4444" name="Open" />
                    <Bar dataKey="in-progress" stackId="a" fill="#F59E0B" name="In Progress" />
                    <Bar dataKey="resolved" stackId="a" fill="#10B981" name="Resolved" />
                    <Bar dataKey="closed" stackId="a" fill="#6B7280" name="Closed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sub-Categories Tab */}
        <TabsContent value="subcategories">
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800">Sub-Category Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={subcategoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={10}
                    stroke="#666"
                  />
                  <YAxis fontSize={11} stroke="#666" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }} 
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[2, 2, 0, 0]} />
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
                  
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">{qa.open}</div>
                      <div className="text-gray-600">Open</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">{qa['in-progress']}</div>
                      <div className="text-gray-600">Progress</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">{qa.resolved}</div>
                      <div className="text-gray-600">Resolved</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-800">{qa.closed}</div>
                      <div className="text-gray-600">Closed</div>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Resolution Rate</span>
                      <span>{Math.round(((qa.resolved + qa.closed) / qa.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${((qa.resolved + qa.closed) / qa.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* QA Workload Chart */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800">QA Workload Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={qaAnalysisData}>
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
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }} 
                  />
                  <Legend fontSize={12} />
                  <Bar dataKey="open" stackId="a" fill="#EF4444" name="Open" />
                  <Bar dataKey="in-progress" stackId="a" fill="#F59E0B" name="In Progress" />
                  <Bar dataKey="resolved" stackId="a" fill="#10B981" name="Resolved" />
                  <Bar dataKey="closed" stackId="a" fill="#6B7280" name="Closed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAT Analysis Tab */}
        <TabsContent value="tat-analysis" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* TAT Distribution Chart */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-gray-800">TAT Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tatRanges}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="range" 
                      fontSize={11}
                      stroke="#666"
                    />
                    <YAxis fontSize={11} stroke="#666" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
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
                <CardTitle className="text-lg font-medium text-gray-800">TAT Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-semibold text-blue-700">{closedTicketsWithTAT.length}</div>
                    <div className="text-sm text-blue-600">Closed Tickets</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-semibold text-green-700">{formatTAT(avgTAT)}</div>
                    <div className="text-sm text-green-600">Average TAT</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">TAT Breakdown:</h4>
                  {tatRanges.map((range, index) => (
                    <div key={range.range} className="flex justify-between items-center py-1">
                      <span className="text-sm text-gray-600">{range.range}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{range.count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${closedTicketsWithTAT.length > 0 ? (range.count / closedTicketsWithTAT.length) * 100 : 0}%` 
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
              <CardTitle className="text-lg font-medium text-gray-800">QA TAT Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={qaAnalysisData.filter(qa => qa.avgTAT > 0)}>
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
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value) => [formatTAT(value), 'Average TAT']}
                  />
                  <Bar dataKey="avgTAT" fill="#10B981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* State TAT Performance */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800">State TAT Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stateAnalysisData.filter(state => state.avgTAT > 0)}>
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
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value) => [formatTAT(value), 'Average TAT']}
                  />
                  <Bar dataKey="avgTAT" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Closed Tickets with TAT */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-gray-800">Recent Closed Tickets with TAT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {closedTicketsWithTAT
                  .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt))
                  .slice(0, 10)
                  .map((ticket) => (
                    <div key={ticket.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-800">{ticket.name}</div>
                        <div className="text-xs text-gray-600">{ticket.description?.substring(0, 50)}...</div>
                        <div className="text-xs text-gray-500 mt-1">
                          QA: {ticket.qaName || ticket.qaNames?.[0] || 'N/A'} | State: {ticket.state}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            ticket.tat < 24 ? 'bg-green-50 text-green-700' :
                            ticket.tat < 72 ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }`}
                        >
                          {formatTAT(ticket.tat)}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedbackAnalytics;