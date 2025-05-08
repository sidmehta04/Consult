import React, { memo, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle, AlertTriangle, Users, Calendar } from "lucide-react";

//TODO: Add auto refresh here and refresh now button

// Using memo to prevent unnecessary re-renders
const DashboardSummaryCards = memo(({ data, loading, todayData }) => {
  // State to store the extracted data
  const [cardData, setCardData] = useState({
    totalCases: 0,
    pendingCases: 0,
    completedCases: 0,
    incompleteCases: 0,
    doctorPendingCases: 0,
    pharmacistPendingCases: 0
  });

  // State for today's data
  const [todayCardData, setTodayCardData] = useState({
    totalCases: 0,
    completedCases: 0,
    incompleteCases: 0,
  });

  // Update card data when props change
  useEffect(() => {
    if (data) {
      setCardData(getExtractedData(data));
    }
    
    // Handle today's data
    if (todayData) {
      setTodayCardData(getExtractedData(todayData));
    }
  }, [data, todayData]);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Today's Total Cases Card */}
        <Card className="overflow-hidden border-indigo-100">
          <CardContent className="p-4 bg-indigo-50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-indigo-600">Today's Cases</p>
                <p className="text-2xl font-bold mt-1">{todayCardData.totalCases}</p>
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
                <p className="text-2xl font-bold mt-1">{todayCardData.completedCases}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {todayCardData.totalCases > 0 
                   ? Math.round((todayCardData.completedCases / todayCardData.totalCases) * 100) 
                   : 0}% of today's cases
                </p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
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
                <p className="text-2xl font-bold mt-1">{todayCardData.incompleteCases}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {todayCardData.totalCases > 0 
                   ? Math.round((todayCardData.incompleteCases / todayCardData.totalCases) * 100) 
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

// Helper function to handle all possible data formats
function getExtractedData(data) {
  // Check if data exists
  if (!data) {
    return {
      totalCases: 0,
      pendingCases: 0,
      completedCases: 0, 
      incompleteCases: 0,
      doctorPendingCases: 0,
      pharmacistPendingCases: 0
    };
  }
  
  // If summaryData is already calculated
  if (data.summaryData) {
    const summaryData = data.summaryData;
    
    // Ensure totalCases is the sum of all case types
    const totalCases = (summaryData.completedCases || 0) + 
                      (summaryData.pendingCases || 0) + 
                      (summaryData.incompleteCases || 0);
    
    return {
      totalCases: totalCases || summaryData.totalCases || 0,
      pendingCases: summaryData.pendingCases || 0,
      completedCases: summaryData.completedCases || 0,
      incompleteCases: summaryData.incompleteCases || 0,
      doctorPendingCases: summaryData.doctorPendingCases || 0,
      pharmacistPendingCases: summaryData.pharmacistPendingCases || 0
    };
  }
  
  // If cases array is available and we need to calculate stats
  if (data.cases && Array.isArray(data.cases) && data.cases.length > 0) {
    const pendingDoctorCases = data.cases.filter(c => !c.doctorCompleted && !c.isIncomplete).length;
    const pendingPharmacistCases = data.cases.filter(c => c.doctorCompleted && !c.pharmacistCompleted && !c.isIncomplete).length;
    const pendingCases = pendingDoctorCases + pendingPharmacistCases;
    const completedCases = data.cases.filter(c => !c.isIncomplete && c.doctorCompleted && c.pharmacistCompleted).length;
    const incompleteCases = data.cases.filter(c => c.isIncomplete === true).length;
    
    // Calculate total as sum of all case types
    const totalCases = pendingCases + completedCases + incompleteCases;
    
    return {
      totalCases,
      pendingCases,
      completedCases,
      incompleteCases,
      doctorPendingCases: pendingDoctorCases,
      pharmacistPendingCases: pendingPharmacistCases
    };
  }
  
  // If data itself is the summaryData
  if (typeof data === 'object' && 'totalCases' in data) {
    // Ensure totalCases is correct
    const totalCases = (data.completedCases || 0) + 
                      (data.pendingCases || 0) + 
                      (data.incompleteCases || 0);
    
    return {
      totalCases: totalCases || data.totalCases || 0,
      pendingCases: data.pendingCases || 0,
      completedCases: data.completedCases || 0,
      incompleteCases: data.incompleteCases || 0,
      doctorPendingCases: data.doctorPendingCases || 0,
      pharmacistPendingCases: data.pharmacistPendingCases || 0
    };
  }
  
  // Default empty state
  return {
    totalCases: 0,
    pendingCases: 0,
    completedCases: 0,
    incompleteCases: 0,
    doctorPendingCases: 0,
    pharmacistPendingCases: 0
  };
}

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