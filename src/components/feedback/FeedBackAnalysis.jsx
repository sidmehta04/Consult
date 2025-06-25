import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { firestore } from "../../firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, FileText, Activity, BarChart3 } from "lucide-react";
import { categories, subcategories } from "./mappings";

const FeedbackAnalytics = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if user has access to analytics
  const hasAccess = currentUser.email === "Akash.das@m-insure.in" || currentUser.role === "superAdmin";

  useEffect(() => {
    if (!hasAccess) return;

    const ticketsQuery = query(
      collection(firestore, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const fetchedTickets = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
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

  // Calculate QA assignment data
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
            closed: 0
          };
        }
        qaData[qaName].total += 1;
        qaData[qaName][ticket.status] += 1;
      });
    } else if (ticket.qaName) {
      if (!qaData[ticket.qaName]) {
        qaData[ticket.qaName] = {
          name: ticket.qaName,
          total: 0,
          open: 0,
          'in-progress': 0,
          resolved: 0,
          closed: 0
        };
      }
      qaData[ticket.qaName].total += 1;
      qaData[ticket.qaName][ticket.status] += 1;
    }
  });

  const qaAnalysisData = Object.values(qaData).sort((a, b) => b.total - a.total);

  // Status data for bar chart
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
    count: count,
    status: status
  }));

  // Calculate state-wise data
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
          closed: 0
        };
      }
      stateData[ticket.state].total += 1;
      stateData[ticket.state][ticket.status] += 1;
    }
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories">Issue Categories</TabsTrigger>
          <TabsTrigger value="subcategories">Sub-Categories</TabsTrigger>
          <TabsTrigger value="states">State Analysis</TabsTrigger>
          <TabsTrigger value="qa-analysis">QA Analysis</TabsTrigger>
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
                    <Badge variant="outline" className="text-xs">
                      {state.total} Total
                    </Badge>
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
                    <Badge variant="outline" className="text-xs">
                      {qa.total} Total
                    </Badge>
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
      </Tabs>
    </div>
  );
};

export default FeedbackAnalytics;