import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Pill, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Coffee,
  ArrowLeftRight,
  UserCheck,
  UserX,
  User,
  Users,
  Calendar as CalendarIcon
} from "lucide-react";
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import { format } from "date-fns";

const PharmacistAvailabilityManager = ({ currentUser }) => {
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [activeCases, setActiveCases] = useState([]);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState("");
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  const [breakDuration, setBreakDuration] = useState(30);
  const [availabilityHistory, setAvailabilityHistory] = useState([]);
  const [dialogType, setDialogType] = useState("");
  
  useEffect(() => {
    const fetchPharmacistStatus = async () => {
      try {
        const docRef = doc(firestore, "users", currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setAvailabilityStatus(userData.availabilityStatus || "available");
            setAvailabilityHistory(userData.availabilityHistory || []);
          }
          setLoading(false);
        });
        
        return unsubscribe;
      } catch (err) {
        console.error("Error fetching pharmacist status:", err);
        setError("Failed to load availability status");
        setLoading(false);
      }
    };
    
    const fetchActiveCases = async () => {
      try {
        const q = query(
          collection(firestore, "cases"),
          where("pharmacistId", "==", currentUser.uid),
          where("pharmacistCompleted", "==", false)
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          setActiveCases(querySnapshot.docs.length);
        });
        
        return unsubscribe;
      } catch (err) {
        console.error("Error fetching active cases:", err);
      }
    };
    
    const unsubscribeStatus = fetchPharmacistStatus();
    const unsubscribeCases = fetchActiveCases();
    
    return () => {
      unsubscribeStatus;
      unsubscribeCases;
    };
  }, [currentUser.uid]);
  
  const updatePharmacistStatus = async (status, reason = "", duration = null) => {
    try {
      setUpdating(true);
      
      const timestamp = serverTimestamp();
      const docRef = doc(firestore, "users", currentUser.uid);
      
      // Get current user data
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Pharmacist profile not found");
      }
      
      const userData = docSnap.data();
      const history = userData.availabilityHistory || [];
      
      // Add new status change to history
      const statusChange = {
        previousStatus: availabilityStatus,
        newStatus: status,
        changedAt: new Date(), // Use client timestamp for immediate UI update
        reason: reason
      };
      
      if (duration) {
        statusChange.expectedDuration = duration;
        // Calculate expected return time (used for lunch breaks)
        const returnTime = new Date();
        returnTime.setMinutes(returnTime.getMinutes() + duration);
        statusChange.expectedReturnTime = returnTime;
      }
      
      // Only keep the last 50 status changes
      const updatedHistory = [statusChange, ...history].slice(0, 50);
      
      // If going on break, set a timestamp for when break started
      let additionalData = {};
      if (status === "on_break") {
        additionalData = {
          breakStartedAt: timestamp,
          breakDuration: duration,
        };
      }
      
      await updateDoc(docRef, {
        availabilityStatus: status,
        lastStatusUpdate: timestamp,
        availabilityHistory: updatedHistory,
        ...additionalData
      });
      
      setShowUnavailableDialog(false);
      setShowBreakDialog(false);
      setUnavailableReason("");
      setUpdating(false);
    } catch (err) {
      console.error("Error updating status:", err);
      setError("Failed to update availability status");
      setUpdating(false);
    }
  };
  
  const handleStatusChange = (newStatus) => {
    if (newStatus === "unavailable") {
      setDialogType("unavailable");
      setShowUnavailableDialog(true);
    } else if (newStatus === "on_break") {
      setDialogType("break");
      setShowBreakDialog(true);
    } else {
      updatePharmacistStatus(newStatus);
    }
  };
  
  const getStatusIndicator = () => {
    switch (availabilityStatus) {
      case "available":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Available</Badge>;
      case "busy":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Busy</Badge>;
      case "unavailable":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Unavailable</Badge>;
      case "on_break":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">On Break</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  const getStatusClass = () => {
    switch (availabilityStatus) {
      case "available":
        return "bg-green-100 text-green-800 border-green-200";
      case "busy":
        return "bg-red-100 text-red-800 border-red-200";
      case "unavailable":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "on_break":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "";
    }
  };
  
  // Auto-update status to busy if case load is high
  useEffect(() => {
    if (availabilityStatus === "available" && activeCases.length >= 5) {
      updatePharmacistStatus("busy", "Automatically marked as busy due to high case load");
    }
  }, [activeCases, availabilityStatus]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-100 shadow-md">
        <CardHeader className={`pb-4 ${getStatusClass()}`}>
          <CardTitle className="flex items-center text-xl">
            <Pill className="h-5 w-5 mr-2" />
            Availability Management
          </CardTitle>
        </CardHeader>
        
        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-md font-medium">Current Status</h3>
                  <div className="flex items-center mt-2">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      availabilityStatus === "available" ? "bg-green-500" :
                      availabilityStatus === "busy" ? "bg-red-500" :
                      availabilityStatus === "unavailable" ? "bg-gray-500" :
                      "bg-amber-500"
                    }`}></div>
                    <p className="font-medium">You are currently {getStatusIndicator()}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <p className="mr-2 text-sm text-gray-500">
                    Active Cases: 
                    <span className={`ml-1 font-medium ${activeCases.length >= 5 ? "text-red-600" : "text-green-600"}`}>
                      {activeCases.length}
                    </span>
                  </p>
                  <Badge className={activeCases.length >= 5 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                    {activeCases.length >= 5 ? "High Load" : "Available"}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={availabilityStatus === "available" ? "default" : "outline"}
                  className={availabilityStatus === "available" ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => handleStatusChange("available")}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Available
                </Button>
                
                <Button
                  variant={availabilityStatus === "busy" ? "default" : "outline"}
                  className={availabilityStatus === "busy" ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => handleStatusChange("busy")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Busy
                </Button>
                
                <Button
                  variant={availabilityStatus === "unavailable" ? "default" : "outline"}
                  className={availabilityStatus === "unavailable" ? "bg-gray-600 hover:bg-gray-700" : ""}
                  onClick={() => handleStatusChange("unavailable")}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Unavailable
                </Button>
                
                <Button
                  variant={availabilityStatus === "on_break" ? "default" : "outline"}
                  className={availabilityStatus === "on_break" ? "bg-amber-600 hover:bg-amber-700" : ""}
                  onClick={() => handleStatusChange("on_break")}
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  Lunch Break
                </Button>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-blue-800">Status Explanation</p>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      <li><span className="font-medium text-green-600">Available:</span> Ready to accept new cases</li>
                      <li><span className="font-medium text-red-600">Busy:</span> Already handling maximum cases</li>
                      <li><span className="font-medium text-gray-600">Unavailable:</span> Off duty or not working</li>
                      <li><span className="font-medium text-amber-600">Lunch Break:</span> Temporarily unavailable</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-md font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                Recent Status Changes
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg max-h-[300px] overflow-y-auto">
                {availabilityHistory.length === 0 ? (
                  <p className="text-gray-500 text-center">No status changes recorded</p>
                ) : (
                  <div className="space-y-3">
                    {availabilityHistory.map((item, index) => (
                      <div key={index} className="bg-white p-3 rounded border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              item.newStatus === "available" ? "bg-green-500" :
                              item.newStatus === "busy" ? "bg-red-500" :
                              item.newStatus === "unavailable" ? "bg-gray-500" :
                              "bg-amber-500"
                            }`}></div>
                            <span className="font-medium">
                              {item.newStatus === "available" ? "Available" :
                               item.newStatus === "busy" ? "Busy" :
                               item.newStatus === "unavailable" ? "Unavailable" :
                               "On Break"}
                            </span>
                          </div>
                          
                          <span className="text-xs text-gray-500">
                            {item.changedAt instanceof Date 
                              ? format(item.changedAt, "MMM d, h:mm a")
                              : "Recently"}
                          </span>
                        </div>
                        
                        {item.reason && (
                          <p className="text-sm text-gray-600 mt-1">
                            Reason: {item.reason}
                          </p>
                        )}
                        
                        {item.expectedDuration && (
                          <p className="text-xs text-gray-500 mt-1">
                            Duration: {item.expectedDuration} minutes
                          </p>
                        )}
                        
                        {item.previousStatus && (
                          <p className="text-xs text-gray-500 mt-1">
                            Previous: {
                              item.previousStatus === "available" ? "Available" :
                              item.previousStatus === "busy" ? "Busy" :
                              item.previousStatus === "unavailable" ? "Unavailable" :
                              "On Break"
                            }
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Unavailable Dialog */}
      <Dialog open={showUnavailableDialog} onOpenChange={setShowUnavailableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <UserX className="h-5 w-5 text-gray-600 mr-2" />
              Mark as Unavailable
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for marking yourself as unavailable.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unavailableReason">Reason for unavailability</Label>
              <Textarea
                id="unavailableReason"
                value={unavailableReason}
                onChange={(e) => setUnavailableReason(e.target.value)}
                placeholder="e.g., Taking time off, personal emergency, etc."
                className="min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setShowUnavailableDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => updatePharmacistStatus("unavailable", unavailableReason)}
              disabled={updating || !unavailableReason.trim()}
              className="bg-gray-600 hover:bg-gray-700"
            >
              {updating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-2" /> Mark as Unavailable
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Break Dialog */}
      <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Coffee className="h-5 w-5 text-amber-500 mr-2" />
              Lunch Break
            </DialogTitle>
            <DialogDescription>
              Please select how long you'll be on break.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="breakDuration">Break Duration (minutes)</Label>
              <div className="flex space-x-2">
                {[15, 30, 45, 60].map((duration) => (
                  <Button
                    key={duration}
                    type="button"
                    variant={breakDuration === duration ? "default" : "outline"}
                    className={breakDuration === duration ? "bg-amber-600 hover:bg-amber-700" : ""}
                    onClick={() => setBreakDuration(duration)}
                  >
                    {duration}
                  </Button>
                ))}
              </div>
              
              <p className="text-sm text-gray-500 mt-2">
                Your status will be marked as "On Break" for {breakDuration} minutes.
              </p>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setShowBreakDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => updatePharmacistStatus("on_break", `Taking a ${breakDuration} minute break`, breakDuration)}
              disabled={updating}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {updating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Coffee className="h-4 w-4 mr-2" /> Start Break
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PharmacistAvailabilityManager;