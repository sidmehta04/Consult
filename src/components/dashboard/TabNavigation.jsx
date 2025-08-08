// import { Button } from "@/components/ui/button";
// import { FileText, Calendar, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";

// const TabNavigation = ({ activeTab, onTabChange, handleTableRefresh }) => {
//   return (
//     <div className="flex overflow-x-auto pb-2 -mb-2">
//       <Button
//         variant={activeTab === "all" ? "default" : "outline"}
//         className="mr-2 flex items-center"
//         onClick={() => onTabChange("all")}
//       >
//         <FileText className="h-4 w-4 mr-2" />
//         All Cases
//       </Button>
//       <Button
//         variant={activeTab === "doctor" ? "default" : "outline"}
//         className="mr-2 flex items-center"
//         onClick={() => onTabChange("doctor")}
//       >
//         <Calendar className="h-4 w-4 mr-2" />
//         Doctor Queue
//       </Button>
//       <Button
//         variant={activeTab === "pharmacist" ? "default" : "outline"}
//         className="mr-2 flex items-center"
//         onClick={() => onTabChange("pharmacist")}
//       >
//         <Calendar className="h-4 w-4 mr-2" />
//         Pharmacist Queue
//       </Button>
//       <Button
//         variant={activeTab === "completed" ? "default" : "outline"}
//         className="mr-2 flex items-center"
//         onClick={() => onTabChange("completed")}
//       >
//         <CheckCircle className="h-4 w-4 mr-2" />
//         Completed
//       </Button>
//       <Button
//         variant={activeTab === "incomplete" ? "default" : "outline"}
//         className="mr-2 flex items-center"
//         onClick={() => onTabChange("incomplete")}
//       >
//         <AlertTriangle className="h-4 w-4 mr-2" />
//         Incomplete
//       </Button>

//       <Button
//         variant={"outline"}
//         className="flex items-center"
//         onClick={handleTableRefresh}
//       >
//         <RefreshCw className="h-4 w-4 mr-2" />
//         Refresh
//       </Button>
//     </div>
//   );
// };
 
// export default TabNavigation;

import { Button } from "@/components/ui/button";
import { FileText, Calendar, CheckCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TabNavigation = ({ activeTab, onTabChange, counts }) => {
  const tabs = [
    {
      id: "all",
      label: "All Cases",
      icon: <FileText className="h-4 w-4 mr-2" />,
    },
    {
      id: "doctor_queue",
      label: "Doctor Queue",
      icon: <Calendar className="h-4 w-4 mr-2" />,
      badge: counts?.doctorPendingCases,
    },
    {
      id: "pharmacist_queue",
      label: "Pharmacist Queue",
      icon: <Calendar className="h-4 w-4 mr-2" />,
      badge: counts?.pharmacistPendingCases,
    },
    {
      id: "completed",
      label: "Completed",
      icon: <CheckCircle className="h-4 w-4 mr-2" />,
      badge: counts?.completedCases,
    },
    {
      id: "incomplete",
      label: "Incomplete",
      icon: <AlertTriangle className="h-4 w-4 mr-2" />,
      badge: counts?.incompleteCases,
    },
  ];

  return (
    <div className="flex overflow-x-auto pb-2 -mb-2 space-x-2">
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant={activeTab === tab.id ? "default" : "outline"}
          className="flex items-center"
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <Badge variant="secondary" className="ml-2">
              {tab.badge}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );
};

export default TabNavigation;