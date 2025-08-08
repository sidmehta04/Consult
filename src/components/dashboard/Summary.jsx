import React, { memo, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle, AlertTriangle, Users, Calendar } from "lucide-react";

// Using memo to prevent unnecessary re-renders
const DashboardSummaryCards = memo(({ data, loading, }) => {
  // State to store the extracted data
  const [cardData, setCardData] = useState({
    totalCases: 0, pendingCases: 0, completedCases: 0, doctorPendingCases: 0,
    pharmacistPendingCases: 0, incompleteCases: 0, todayCases: 0,
    todayCompleted: 0, todayIncomplete: 0,
  }); 

  // Update card data when props change
  useEffect(() => {
    setCardData(data)
  }, [data]);

  // Check if loading or if data is not available
  if (loading || !data) {
    return <SummaryCardsSkeleton />;
  }

  // Get today's date formatted for display
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="grid grid-cols-1 gap-4 mb-6">
      {/* All-time data heading */}
      <div className="flex items-center">
        <h3 className="text-sm font-medium text-gray-700">All Time Statistics</h3>
        <div className="h-px flex-1 bg-gray-200 ml-3"></div>
      </div>
      
      {/* Row 1: All-time Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Total Cases Card */}
        <Card className="overflow-hidden border-blue-100">
          <CardContent className="p-4 bg-blue-50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Cases</p>
                <p className="text-2xl font-bold mt-1">{cardData.totalCases}</p>
                <p className="text-xs text-gray-500 mt-1">
                  All cases till date
                </p>
              </div>
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
 
        {/* Completed Cases Card */}
        <Card className="overflow-hidden border-green-100">
          <CardContent className="p-4 bg-green-50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-green-600">Completed Cases</p>
                <p className="text-2xl font-bold mt-1">{cardData.completedCases}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {cardData.totalCases > 0 
                   ? Math.round((cardData.completedCases / cardData.totalCases) * 100) 
                   : 0}% of total cases
                </p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incomplete Cases Card */}
        <Card className="overflow-hidden border-red-100">
          <CardContent className="p-4 bg-red-50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-red-600">Incomplete Cases</p>
                <p className="text-2xl font-bold mt-1">{cardData.incompleteCases}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {cardData.totalCases > 0 
                   ? Math.round((cardData.incompleteCases / cardData.totalCases) * 100) 
                   : 0}% of total cases
                </p>
              </div>
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's data heading */}
      <div className="flex items-center mt-1">
        <h3 className="text-sm font-medium text-gray-700">Today's Statistics ({dateString})</h3>
        <div className="h-px flex-1 bg-gray-200 ml-3"></div>
      </div>
      
      {/* Row 2: Today's Statistics (3 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Today's Total Cases Card */}
        <Card className="overflow-hidden border-indigo-100">
          <CardContent className="p-4 bg-indigo-50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-indigo-600">Today's Cases</p>
                <p className="text-2xl font-bold mt-1">{cardData.todayCases}</p>
                <p className="text-xs text-gray-500 mt-1">
                  New cases today
                </p>
              </div>
              <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Completed Cases Card */}
        <Card className="overflow-hidden border-green-100">
          <CardContent className="p-4 bg-green-50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-green-600">Today's Completed</p>
                <p className="text-2xl font-bold mt-1">{cardData.todayCompleted}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {cardData.todayCases > 0 
                   ? Math.round((cardData.todayCompleted / cardData.todayCases) * 100) 
                   : 0}% of today's cases
                </p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Cases Card */}
        <Card className="overflow-hidden border-amber-100">
          <CardContent className="p-4 bg-amber-50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-amber-600">Pending Cases</p>
                <p className="text-2xl font-bold mt-1">{cardData.pendingCases}</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center">
                    <div className="h-2 w-2 bg-amber-500 rounded-full mr-1"></div>
                    <span className="text-xs text-gray-500">Dr: {cardData.doctorPendingCases}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-2 w-2 bg-purple-500 rounded-full mr-1"></div>
                    <span className="text-xs text-gray-500">Pharm: {cardData.pharmacistPendingCases}</span>
                  </div>
                </div>
              </div>
              <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Incomplete Cases Card */}
        <Card className="overflow-hidden border-red-100">
          <CardContent className="p-4 bg-red-50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-red-600">Today's Incomplete</p>
                <p className="text-2xl font-bold mt-1">{cardData.todayIncomplete}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {cardData.todayCases > 0 
                   ? Math.round((cardData.todayIncomplete / cardData.todayCases) * 100) 
                   : 0}% of today's cases
                </p>
              </div>
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

// Extracted skeleton loader component for cleaner code
const SummaryCardsSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center">
      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-px flex-1 bg-gray-200 ml-3"></div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-12 bg-gray-300 rounded animate-pulse"></div>
              </div>
              <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    
    <div className="flex items-center">
      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-px flex-1 bg-gray-200 ml-3"></div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <Card key={i + 4} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-12 bg-gray-300 rounded animate-pulse"></div>
              </div>
              <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export default DashboardSummaryCards;