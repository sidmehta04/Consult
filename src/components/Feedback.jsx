import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import FeedbackForm from "./feedback/FeedbackForm";
import FeedbackTable from "./feedback/FeedbackTable";

const FeedbackPortal = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState("newTicket");

  useEffect(() => {
    //console.log("Current user:", currentUser.uid);
  }, [])
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Feedback Portal</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="newTicket">New Ticket</TabsTrigger>
          <TabsTrigger value="yourTickets">Your Tickets</TabsTrigger>
        </TabsList>

        {/* New Ticket Tab */}
        <TabsContent value="newTicket">
          <FeedbackForm currentUser={currentUser} />
        </TabsContent>

        {/* Your Tickets Tab */}
        <TabsContent value="yourTickets">
          <FeedbackTable currentUser={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedbackPortal;