// components/EmptyStateMessage.jsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, AlertCircle,ShieldAlert } from "lucide-react";

export const EmptyStateMessage = () => (
  <Card className="bg-gray-50 border border-dashed border-gray-300 mt-4">
    <CardContent className="flex flex-col items-center justify-center py-12">
      <div className="rounded-full bg-blue-100 p-3 mb-4">
        <Filter className="h-6 w-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Select a tab to view cases
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-md mb-6">
        Click one of the tabs above to load and view cases.
      </p>
    </CardContent>
  </Card>
);

export const NoResultsMessage = ({ userRole }) => (
  <tr>
    <td colSpan="10" className="text-center py-8 text-gray-500">
      <div className="flex flex-col items-center">
        <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
        <p>No cases found matching your criteria</p>
        {(userRole === "doctor" ||
          userRole === "pharmacist" ||
          userRole === "clinic" ||
          userRole === "nurse") && (
          <p className="text-xs text-gray-400 mt-2">
            Note: Based on your role, you can only see cases that are directly
            related to you
          </p>
        )}
      </div>
    </td>
  </tr>
);

export const RoleBasedAccessMessage = ({ userRole }) => (
  <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded-md mt-4 flex items-center">
    <ShieldAlert className="h-4 w-4 mr-2 text-blue-600" />
    <span>
      <strong>Access Note:</strong> As a
      {userRole === "doctor"
        ? " Doctor"
        : userRole === "pharmacist"
        ? " Pharmacist"
        : userRole === "clinic" || userRole === "nurse"
        ? " Clinic/Nurse"
        : " Team Leader"}
      , you can only see cases that are{" "}
      {userRole === "doctor"
        ? "assigned to you"
        : userRole === "pharmacist"
        ? "assigned to you for review"
        : userRole === "clinic" || userRole === "nurse"
        ? "created by you"
        : "within your team hierarchy"}
      .
    </span>
  </div>
);