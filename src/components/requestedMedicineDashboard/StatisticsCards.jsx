import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, CheckCircle, Clock, Truck, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const StatisticsCards = ({ stats }) => {
  const cards = [
    {
      title: "Total Requests",
      value: stats.total,
      icon: Package,
      color: "blue",
      bg: "from-blue-500 to-blue-600",
      textColor: "text-blue-700",
      bgLight: "bg-blue-50",
      borderColor: "border-l-blue-500"
    },
    {
      title: "Open",
      value: stats.open,
      icon: AlertTriangle,
      color: "red",
      bg: "from-red-500 to-red-600", 
      textColor: "text-red-700",
      bgLight: "bg-red-50",
      borderColor: "border-l-red-500",
      percentage: stats.total > 0 ? ((stats.open / stats.total) * 100).toFixed(1) : 0
    },
    {
      title: "Approved", 
      value: stats.approved,
      icon: CheckCircle,
      color: "blue",
      bg: "from-blue-500 to-blue-600",
      textColor: "text-blue-700", 
      bgLight: "bg-blue-50",
      borderColor: "border-l-blue-500",
      percentage: stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : 0
    },
    {
      title: "In Transit",
      value: stats.inTransit, 
      icon: Truck,
      color: "yellow",
      bg: "from-yellow-500 to-yellow-600",
      textColor: "text-yellow-700",
      bgLight: "bg-yellow-50", 
      borderColor: "border-l-yellow-500",
      percentage: stats.total > 0 ? ((stats.inTransit / stats.total) * 100).toFixed(1) : 0
    },
    {
      title: "Delivered",
      value: stats.delivered,
      icon: Package, 
      color: "green",
      bg: "from-green-500 to-green-600",
      textColor: "text-green-700",
      bgLight: "bg-green-50",
      borderColor: "border-l-green-500",
      percentage: stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(1) : 0
    },
    {
      title: "Total Value",
      value: `₹${stats.totalValue.toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: "purple", 
      bg: "from-purple-500 to-purple-600",
      textColor: "text-purple-700",
      bgLight: "bg-purple-50",
      borderColor: "border-l-purple-500",
      subtitle: stats.total > 0 ? `Avg: ₹${(stats.totalValue / stats.total).toFixed(0)}` : 'No data'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className={`hover:shadow-lg transition-all duration-200 border-l-4 ${card.borderColor} ${card.bgLight} border-r-0 border-t-0 border-b-0`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${card.bg} shadow-sm`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col space-y-2">
                <div className={`text-2xl font-bold ${card.textColor}`}>
                  {card.value}
                </div>
                <div className="flex items-center justify-between">
                  {card.percentage && (
                    <Badge variant="outline" className={`text-xs ${card.textColor} border-current`}>
                      {card.percentage}%
                    </Badge>
                  )}
                  {card.subtitle && (
                    <div className="text-xs text-gray-500">
                      {card.subtitle}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StatisticsCards;