import React from "react";
import { Badge } from "@/components/ui/badge";
import { 
  UserCheck, 
  UserX, 
  Users, 
  Coffee 
} from "lucide-react";

const PharmacistStatusIndicator = ({ status, caseCount }) => {
  const getStatusIcon = () => {
    switch (status) {
      case "available":
        return <UserCheck className="h-3.5 w-3.5 text-green-600" />;
      case "busy":
        return <Users className="h-3.5 w-3.5 text-red-600" />;
      case "unavailable":
        return <UserX className="h-3.5 w-3.5 text-gray-600" />;
      case "on_break":
        return <Coffee className="h-3.5 w-3.5 text-amber-600" />;
      default:
        return <UserCheck className="h-3.5 w-3.5 text-blue-600" />;
    }
  };
  
  const getStatusBadge = () => {
    switch (status) {
      case "available":
        return (
          <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
            Available
          </Badge>
        );
      case "busy":
        return (
          <Badge className="text-xs bg-red-100 text-red-800 border-red-200">
            Busy
          </Badge>
        );
      case "unavailable":
        return (
          <Badge className="text-xs bg-gray-100 text-gray-800 border-gray-200">
            Unavailable
          </Badge>
        );
      case "on_break":
        return (
          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">
            On Break
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Unknown
          </Badge>
        );
    }
  };
  
  const getCaseLoadBadge = () => {
    if (caseCount === undefined || caseCount === null) return null;
    
    if (caseCount >= 10) {
      return (
        <Badge className="text-xs bg-red-100 text-red-800 border-red-200 ml-1">
          {caseCount}/10
        </Badge>
      );
    } else if (caseCount >= 6) {
      return (
        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 ml-1">
          {caseCount}/10
        </Badge>
      );
    } else {
      return (
        <Badge className="text-xs bg-green-100 text-green-800 border-green-200 ml-1">
          {caseCount}/10
        </Badge>
      );
    }
  };
  
  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center">
        {getStatusIcon()}
        <span className="ml-1">{getStatusBadge()}</span>
      </div>
      {getCaseLoadBadge()}
    </div>
  );
};

export default PharmacistStatusIndicator;