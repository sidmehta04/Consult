// components/TabNavigation.jsx
import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, CheckCircle, AlertTriangle } from "lucide-react";

const TabNavigation = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex overflow-x-auto pb-2 -mb-2">
      <Button
        variant={activeTab === "all" ? "default" : "outline"}
        className="mr-2 flex items-center"
        onClick={() => onTabChange("all")}
      >
        <FileText className="h-4 w-4 mr-2" />
        All Cases
      </Button>
      <Button
        variant={activeTab === "doctor" ? "default" : "outline"}
        className="mr-2 flex items-center"
        onClick={() => onTabChange("doctor")}
      >
        <Calendar className="h-4 w-4 mr-2" />
        Doctor Queue
      </Button>
      <Button
        variant={activeTab === "pharmacist" ? "default" : "outline"}
        className="mr-2 flex items-center"
        onClick={() => onTabChange("pharmacist")}
      >
        <Calendar className="h-4 w-4 mr-2" />
        Pharmacist Queue
      </Button>
      <Button
        variant={activeTab === "completed" ? "default" : "outline"}
        className="mr-2 flex items-center"
        onClick={() => onTabChange("completed")}
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        Completed
      </Button>
      <Button
        variant={activeTab === "incomplete" ? "default" : "outline"}
        className="flex items-center"
        onClick={() => onTabChange("incomplete")}
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        Incomplete
      </Button>
    </div>
  );
};

export default TabNavigation;