import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  DollarSign, 
  MapPin,
  Pill,
  TrendingUp
} from "lucide-react";

const AnalyticsDashboard = ({ inventoryData }) => {
  // Simplified analytics calculations
  const analytics = useMemo(() => {
    if (!inventoryData?.length) return null;

    // Status distribution
    const statusStats = {
      open: inventoryData.filter(item => item.status === 'open').length,
      approved: inventoryData.filter(item => item.status === 'approved').length,
      inTransit: inventoryData.filter(item => item.status === 'in-transit').length,
      delivered: inventoryData.filter(item => item.status === 'delivered').length,
    };

    // Financial metrics - Requested vs Approved values
    const requestedValue = inventoryData.reduce((sum, item) => {
      if (item.requestedOrder) {
        const itemValue = item.requestedOrder.reduce((itemSum, med) => {
          // Use a default price if not available (you might need to adjust this based on your medicine data structure)
          const price = med.unitPrice || med.price || 1; // Fallback to 1 if no price available
          return itemSum + ((med.requestedQuantity || 0) * price);
        }, 0);
        return sum + itemValue;
      }
      return sum + (item.totalOrderValue || 0);
    }, 0);

    const approvedValue = inventoryData
      .filter(item => item.status === 'approved' || item.status === 'delivered' || item.status === 'in-transit')
      .reduce((sum, item) => {
        // Calculate approved value based on approved quantities if available
        if (item.requestedOrder && item.approvedOrder) {
          return sum + item.approvedOrder.reduce((orderSum, med) => {
            const price = med.unitPrice || med.price || 1;
            return orderSum + ((med.approvedQuantity || med.requestedQuantity || 0) * price);
          }, 0);
        }
        return sum + (item.totalOrderValue || 0);
      }, 0);

    // State-wise distribution
    const stateStats = inventoryData.reduce((acc, item) => {
      const state = item.state || 'Unknown';
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    // Most requested medicines
    const medicineStats = {};
    inventoryData.forEach(item => {
      if (item.requestedOrder) {
        item.requestedOrder.forEach(med => {
          const name = med.medicineName || 'Unknown';
          if (!medicineStats[name]) {
            medicineStats[name] = { count: 0, totalQty: 0 };
          }
          medicineStats[name].count += 1;
          medicineStats[name].totalQty += (med.requestedQuantity || 0);
        });
      }
    });

    return {
      statusStats,
      requestedValue,
      approvedValue,
      stateStats,
      medicineStats,
      totalRequests: inventoryData.length
    };
  }, [inventoryData]);

  if (!analytics) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No Data Available</h3>
          <p className="text-sm text-gray-500">Analytics will appear once medicine requests are available.</p>
        </div>
      </div>
    );
  }

  const topStates = Object.entries(analytics.stateStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 6);

  const topMedicines = Object.entries(analytics.medicineStats)
    .sort(([,a], [,b]) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b pb-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
          Analytics Dashboard
        </h2>
        <p className="text-xs text-gray-600 mt-1">Key insights for Super Medicine Manager</p>
      </div>

      {/* Key Metrics - Requested vs Approved Values */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
            <DollarSign className="h-4 w-4 mr-2" />
            Value Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded border">
              <div className="text-lg font-bold text-blue-600">₹{analytics.requestedValue.toLocaleString('en-IN')}</div>
              <div className="text-xs text-blue-700">Total Requested Value</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded border">
              <div className="text-lg font-bold text-green-600">₹{analytics.approvedValue.toLocaleString('en-IN')}</div>
              <div className="text-xs text-green-700">Total Approved Value</div>
            </div>
          </div>
          <div className="mt-3 text-center">
            <Badge variant="outline" className="text-xs">
              Approval Rate: {analytics.requestedValue > 0 ? ((analytics.approvedValue / analytics.requestedValue) * 100).toFixed(1) : 0}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Two Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Requested Medicines Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
              <Pill className="h-4 w-4 mr-2" />
              Top Requested Medicines
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {topMedicines.map(([medicine, data], idx) => {
                const maxCount = Math.max(...Object.values(analytics.medicineStats).map(d => d.count));
                const percentage = (data.count / maxCount) * 100;
                return (
                  <div key={medicine} className="flex items-center space-x-2">
                    <div className="text-xs font-medium w-4 text-gray-600">{idx + 1}.</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-xs font-medium truncate pr-2">{medicine}</div>
                        <div className="text-xs text-gray-600">{data.count}</div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* State-wise Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              State-wise Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {topStates.map(([state, count], idx) => {
                const maxCount = Math.max(...Object.values(analytics.stateStats));
                const percentage = (count / maxCount) * 100;
                return (
                  <div key={state} className="flex items-center space-x-2">
                    <div className="text-xs font-medium w-4 text-gray-600">{idx + 1}.</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-xs font-medium">{state}</div>
                        <div className="text-xs text-gray-600">{count} requests</div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 bg-red-50 rounded border">
              <div className="text-base font-bold text-red-600">{analytics.statusStats.open}</div>
              <div className="text-xs text-red-700">Open</div>
              <Badge className="bg-red-100 text-red-800 border-red-300 mt-1 text-xs px-1">
                {((analytics.statusStats.open / analytics.totalRequests) * 100).toFixed(0)}%
              </Badge>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded border">
              <div className="text-base font-bold text-blue-600">{analytics.statusStats.approved}</div>
              <div className="text-xs text-blue-700">Approved</div>
              <Badge className="bg-blue-100 text-blue-800 border-blue-300 mt-1 text-xs px-1">
                {((analytics.statusStats.approved / analytics.totalRequests) * 100).toFixed(0)}%
              </Badge>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded border">
              <div className="text-base font-bold text-yellow-600">{analytics.statusStats.inTransit}</div>
              <div className="text-xs text-yellow-700">In Transit</div>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 mt-1 text-xs px-1">
                {((analytics.statusStats.inTransit / analytics.totalRequests) * 100).toFixed(0)}%
              </Badge>
            </div>
            <div className="text-center p-2 bg-green-50 rounded border">
              <div className="text-base font-bold text-green-600">{analytics.statusStats.delivered}</div>
              <div className="text-xs text-green-700">Delivered</div>
              <Badge className="bg-green-100 text-green-800 border-green-300 mt-1 text-xs px-1">
                {((analytics.statusStats.delivered / analytics.totalRequests) * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;