import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Stethoscope, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Coffee,
  ArrowLeftRight,
  UserCheck,
  UserX,
  User,
  Users
} from "lucide-react";
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase";
import { format } from "date-fns";

const DoctorAvailabilityManager = ({ currentUser }) => {
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
  
  // New state for break timer management
  const [breakTimer, setBreakTimer] = useState(null);
  const [breakEndTime, setBreakEndTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  
  useEffect(() => {
    const fetchDoctorStatus = async () => {
      try {
        const docRef = doc(firestore, "users", currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setAvailabilityStatus(userData.availabilityStatus || "available");
            setAvailabilityHistory(userData.availabilityHistory || []);
            
            // Check if user is on break and has break data
            if (userData.availabilityStatus === "on_break" && userData.breakStartedAt && userData.breakDuration) {
              const breakStart = userData.breakStartedAt.toDate();
              const duration = userData.breakDuration;
              const breakEnd = new Date(breakStart.getTime() + (duration * 60 * 1000));
              
              setBreakEndTime(breakEnd);
              
              // If break should have ended already, auto-return to available
              if (new Date() >= breakEnd) {
                updateDoctorStatus("available", "Automatically returned from break");
              } else {
                // Start countdown timer
                startBreakCountdown(breakEnd);
              }
            } else {
              // Clear any existing timers if not on break
              clearBreakTimer();
            }
          }
          setLoading(false);
        });
        
        return unsubscribe;
      } catch (err) {
        console.error("Error fetching doctor status:", err);
        setError("Failed to load availability status");
        setLoading(false);
      }
    };
    
    const fetchActiveCases = async () => {
      try {
        const q = query(
          collection(firestore, "cases"),
          where("assignedDoctors.primary", "==", currentUser.uid),
          where("doctorCompleted", "==", false),
          where("isIncomplete", "==", false)          
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const casesData = [];
          querySnapshot.forEach((doc) => {
            casesData.push({ id: doc.id, ...doc.data() });
          });
          setActiveCases(casesData);
        });
        
        return unsubscribe;
      } catch (err) {
        console.error("Error fetching active cases:", err);
      }
    };
    
    const unsubscribeStatus = fetchDoctorStatus();
    const unsubscribeCases = fetchActiveCases();
    
    return () => {
      if (typeof unsubscribeStatus === 'function') unsubscribeStatus();
      if (typeof unsubscribeCases === 'function') unsubscribeCases();
      clearBreakTimer();
    };
  }, [currentUser.uid]);
  
  // Break timer management functions
  const startBreakCountdown = (endTime) => {
    clearBreakTimer(); // Clear any existing timer
    
    const updateCountdown = () => {
      const now = new Date();
      const remaining = endTime - now;
      
      if (remaining <= 0) {
        // Break time is over, automatically return to available
        updateDoctorStatus("available", "Automatically returned from break");
        clearBreakTimer();
      } else {
        setTimeRemaining(remaining);
      }
    };
    
    // Update immediately
    updateCountdown();
    
    // Set interval to update every second
    countdownRef.current = setInterval(updateCountdown, 1000);
    
    // Set timeout for the exact end time
    timerRef.current = setTimeout(() => {
      updateDoctorStatus("available", "Automatically returned from break");
      clearBreakTimer();
    }, endTime - new Date());
  };
  
  const clearBreakTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setBreakEndTime(null);
    setTimeRemaining(null);
  };
  
  const formatTimeRemaining = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return "0:00";
    
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const updateDoctorStatus = async (status, reason = "", duration = null) => {
    try {
      setUpdating(true);
      
      const timestamp = serverTimestamp();
      const docRef = doc(firestore, "users", currentUser.uid);
      
      // Get current user data
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Doctor profile not found");
      }
      
      const userData = docSnap.data();
      const history = userData.availabilityHistory || [];
      
      // Add new status change to history
      const statusChange = {
        previousStatus: availabilityStatus,
        newStatus: status,
        changedAt: new Date(), // Use client timestamp for immediate UI update
        reason: reason,
        casesNo: activeCases.length,
      };
      
      if (duration) {
        statusChange.expectedDuration = duration;
        // Calculate expected return time (used for lunch breaks)
        const returnTime = new Date();
        returnTime.setMinutes(returnTime.getMinutes() + duration);
        statusChange.expectedReturnTime = returnTime;
      }
      
      const updatedHistory = [statusChange, ...history];
      
      // Prepare update data
      let updateData = {
        availabilityStatus: status,
        lastStatusUpdate: timestamp,
        availabilityHistory: updatedHistory,
      };
      
      // If going on break, set break start time and duration
      if (status === "on_break" && duration) {
        updateData.breakStartedAt = timestamp;
        updateData.breakDuration = duration;
        
        // Start the countdown timer
        const endTime = new Date(Date.now() + (duration * 60 * 1000));
        startBreakCountdown(endTime);
      } else {
        // If returning from break or changing to any other status, clear break data
        updateData.breakStartedAt = null;
        updateData.breakDuration = null;
        clearBreakTimer();
      }
      
      await updateDoc(docRef, updateData);
      
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
      updateDoctorStatus(newStatus);
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
        return (
          <div className="flex items-center space-x-2">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">On Break</Badge>
            {timeRemaining && (
              <Badge variant="outline" className="text-xs">
                {formatTimeRemaining(timeRemaining)} left
              </Badge>
            )}
          </div>
        );
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
    if (availabilityStatus === "available" && activeCases.length >= 10) {
      updateDoctorStatus("busy", "Automatically marked as busy due to high case load");
    }
  }, [activeCases, availabilityStatus]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-100 shadow-md">
        <CardHeader className={`pb-4 ${getStatusClass()}`}>
          <CardTitle className="flex items-center text-xl">
            <Stethoscope className="h-5 w-5 mr-2" />
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
                    <div className="flex items-center">
                      <p className="font-medium mr-2">You are currently</p>
                      {getStatusIndicator()}
                    </div>
                  </div>
                  
                  {/* Break countdown display */}
                  {availabilityStatus === "on_break" && breakEndTime && (
                    <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 text-amber-600 mr-1" />
                        <span className="text-amber-800">
                          Break ends at {format(breakEndTime, "h:mm a")}
                        </span>
                      </div>
                      {timeRemaining && (
                        <div className="text-lg font-mono text-amber-800 mt-1">
                          {formatTimeRemaining(timeRemaining)} remaining
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center">
                  <p className="mr-2 text-sm text-gray-500">
                    Active Cases: 
                    <span className={`ml-1 font-medium ${activeCases.length >= 10 ? "text-red-600" : "text-green-600"}`}>
                      {activeCases.length}
                    </span>
                  </p>
                  <Badge className={activeCases.length >= 10 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                    {activeCases.length >= 10 ? "High Load" : "Available"}
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
                  disabled
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
              
              {/* Early return from break button */}
              {availabilityStatus === "on_break" && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => updateDoctorStatus("available", "Returned early from break")}
                  >
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Return Early from Break
                  </Button>
                </div>
              )}
              
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
                      <li><span className="font-medium text-amber-600">Lunch Break:</span> Temporarily unavailable (auto-return)</li>
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
                              : item.changedAt && item.changedAt.toDate
                              ? format(item.changedAt.toDate(), "MMM d, h:mm a")
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
                        
                        {item.expectedReturnTime && (
                          <p className="text-xs text-gray-500 mt-1">
                            Expected return: {
                              item.expectedReturnTime instanceof Date 
                                ? format(item.expectedReturnTime, "h:mm a")
                                : item.expectedReturnTime && item.expectedReturnTime.toDate
                                ? format(item.expectedReturnTime.toDate(), "h:mm a")
                                : "Unknown"
                            }
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
              onClick={() => updateDoctorStatus("unavailable", unavailableReason)}
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
              Please select how long you'll be on break. Your status will automatically return to "Available" when the time is up.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="breakDuration">Break Duration (minutes)</Label>
              <div className="flex space-x-2">
                {[10, 15, 30, 45, 60].map((duration) => (
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
                Your status will automatically change back to "Available" after {breakDuration} minutes.
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
              onClick={() => updateDoctorStatus("on_break", `Taking a ${breakDuration} minute break`, breakDuration)}
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

export default DoctorAvailabilityManager;