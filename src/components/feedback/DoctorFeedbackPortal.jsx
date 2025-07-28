import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, PlusCircle, List } from "lucide-react";
import DoctorFeedbackForm from "./DocFeedbackForm";
import DoctorFeedbackTable from "./DoctorFeedbackTable";

const DoctorFeedbackPortal = ({ currentUser }) => {
  const [currentTab, setCurrentTab] = useState("submit");

  return (
    <div className="container mx-auto p-6 max-w-12xl">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50">
        <CardHeader className="pb-6 border-b border-gray-100">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <CardTitle className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3 mb-2">
                <Stethoscope className="w-8 h-8 text-blue-600" />
                Doctor Support Portal
              </CardTitle>
              <p className="text-gray-600 text-lg">
                Submit support requests and track your tickets with our QA team
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="submit" className="flex items-center gap-2 py-3">
                <PlusCircle className="w-4 h-4" />
                Submit New Ticket
              </TabsTrigger>
              <TabsTrigger value="tickets" className="flex items-center gap-2 py-3">
                <List className="w-4 h-4" />
                My Tickets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="submit" className="space-y-6">
              <DoctorFeedbackForm currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="tickets" className="space-y-6">
              <DoctorFeedbackTable currentUser={currentUser} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorFeedbackPortal;