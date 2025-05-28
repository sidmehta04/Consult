import React, { useState, useEffect } from "react";
import Select from "react-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  //Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  Stethoscope,
  BadgeCheck,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Trash,
  Plus,
  Save,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase";

const DoctorHierarchyManagement = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [assignedDoctors, setAssignedDoctors] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [assignToAnyDoctor, setAssignToAnyDoctor] = useState(false);

  // Fetch all doctors and current assignments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all available doctors
        const doctorsQuery = query(
          collection(firestore, "users"),
          where("role", "==", "doctor")
        );
        
        const doctorsSnapshot = await getDocs(doctorsQuery);
        const doctorsList = [];
        doctorsSnapshot.forEach((doc) => {
          doctorsList.push({
            id: doc.id,
            name: doc.data().name,
            email: doc.data().email,
            ...doc.data()
          });
        });
        setAvailableDoctors(doctorsList);
        
        // Fetch pharmacist's data to see already assigned doctors
        const pharmacistRef = doc(firestore, "users", currentUser.uid);
        const pharmacistSnapshot = await getDoc(pharmacistRef);
        
        if (pharmacistSnapshot.exists()) {
          const pharmacistData = pharmacistSnapshot.data();
          
          // Check if the pharmacist has doctor hierarchy configured
          if (pharmacistData.doctorHierarchy && Array.isArray(pharmacistData.doctorHierarchy)) {
            // Convert to array of assigned doctors with their hierarchy position
            const assignedDoctorsList = await Promise.all(
              pharmacistData.doctorHierarchy.map(async (doctorId, index) => {
                const doctorRef = doc(firestore, "users", doctorId);
                const doctorSnap = await getDoc(doctorRef);
                
                if (doctorSnap.exists()) {
                  return {
                    id: doctorId,
                    position: index + 1,
                    name: doctorSnap.data().name,
                    email: doctorSnap.data().email
                  };
                } else {
                  return {
                    id: doctorId,
                    position: index + 1,
                    name: "Unknown Doctor",
                    email: "N/A"
                  };
                }
              })
            );
            
            setAssignedDoctors(assignedDoctorsList);
          } else {
            setAssignedDoctors([]);
          }
          
          // Load assignToAnyDoctor setting if it exists
          if (pharmacistData.assignToAnyDoctor !== undefined) {
            setAssignToAnyDoctor(pharmacistData.assignToAnyDoctor);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load doctors. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser.uid]);

  // Get position name based on index
  const getPositionName = (position) => {
    const positions = ["Primary", "Secondary", "Tertiary", "Quaternary", "Quinary"];
    return positions[position - 1] || `${position}${getOrdinalSuffix(position)}`;
  };
  
  // Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    
    if (j === 1 && k !== 11) {
      return "st";
    }
    if (j === 2 && k !== 12) {
      return "nd";
    }
    if (j === 3 && k !== 13) {
      return "rd";
    }
    return "th";
  };

  // Add a doctor to the hierarchy
  const addDoctor = () => {
    if (!selectedDoctor) return;
    
    // Check if doctor is already assigned
    if (assignedDoctors.some(doc => doc.id === selectedDoctor)) {
      setError("This doctor is already in your hierarchy.");
      return;
    }
    
    const doctorToAdd = availableDoctors.find(doc => doc.id === selectedDoctor);
    if (doctorToAdd) {
      const position = assignedDoctors.length + 1;
      setAssignedDoctors([
        ...assignedDoctors,
        {
          id: doctorToAdd.id,
          position: position,
          name: doctorToAdd.name,
          email: doctorToAdd.email
        }
      ]);
      
      setSelectedDoctor("");
      setIsDialogOpen(false);
    }
  };

  // Move doctor up in the hierarchy
  const moveUp = (index) => {
    if (index <= 0) return;
    
    const newAssignedDoctors = [...assignedDoctors];
    [newAssignedDoctors[index - 1], newAssignedDoctors[index]] = 
      [newAssignedDoctors[index], newAssignedDoctors[index - 1]];
    
    // Update positions
    newAssignedDoctors.forEach((doc, i) => {
      doc.position = i + 1;
    });
    
    setAssignedDoctors(newAssignedDoctors);
  };

  // Move doctor down in the hierarchy
  const moveDown = (index) => {
    if (index >= assignedDoctors.length - 1) return;
    
    const newAssignedDoctors = [...assignedDoctors];
    [newAssignedDoctors[index], newAssignedDoctors[index + 1]] = 
      [newAssignedDoctors[index + 1], newAssignedDoctors[index]];
    
    // Update positions
    newAssignedDoctors.forEach((doc, i) => {
      doc.position = i + 1;
    });
    
    setAssignedDoctors(newAssignedDoctors);
  };

  // Remove doctor from hierarchy
  const removeDoctor = (doctorId) => {
    const newAssignedDoctors = assignedDoctors.filter(doc => doc.id !== doctorId);
    
    // Update positions
    newAssignedDoctors.forEach((doc, i) => {
      doc.position = i + 1;
    });
    
    setAssignedDoctors(newAssignedDoctors);
  };

  // Save doctor hierarchy
  const saveHierarchy = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      
      // Extract doctor IDs in order
      const doctorHierarchy = assignedDoctors.sort((a, b) => a.position - b.position).map(doc => doc.id);
      
      const pharmacistRef = doc(firestore, "users", currentUser.uid);
      
      // Update pharmacist's doctor hierarchy and assignToAnyDoctor setting
      await setDoc(pharmacistRef, { 
        doctorHierarchy,
        assignToAnyDoctor 
      }, { merge: true });
      
      // Update all clinics under this pharmacist to assign these doctors
      const clinicsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "nurse"),
        where("createdBy", "==", currentUser.uid)
      );
      
      const clinicsSnapshot = await getDocs(clinicsQuery);
      
      const updatePromises = [];
      clinicsSnapshot.forEach(async (clinic) => {
        // Create doctor assignments object for each clinic
        const doctorAssignments = {};
        
        assignedDoctors.forEach((doctor) => {
          const positionKey = getPositionName(doctor.position).toLowerCase();
          doctorAssignments[positionKey] = doctor.id;
          doctorAssignments[`${positionKey}Name`] = doctor.name;
        });
        
        // Add assignToAnyDoctor setting to clinic
        doctorAssignments.assignToAnyDoctor = assignToAnyDoctor;
        
        // Update the clinic
        const clinicRef = doc(firestore, "users", clinic.id);
        const clinicSnapshot = await getDoc(clinicRef);
        const clinicData = clinicSnapshot.data();

        clinicData.assignedDoctors = doctorAssignments;

        updatePromises.push(
          setDoc(clinicRef, clinicData, { merge: false })
        );
        
        // Also update each doctor's assigned clinics
        doctorHierarchy.forEach((doctorId) => {
          const doctorRef = doc(firestore, "users", doctorId);
          updatePromises.push(
            getDoc(doctorRef).then((doctorSnap) => {
              if (doctorSnap.exists()) {
                const doctorData = doctorSnap.data();
                const updatedClinics = {
                  ...(doctorData.assignedClinics || {}),
                  [clinic.id]: true
                };
                
                return setDoc(doctorRef, 
                  { assignedClinics: updatedClinics }, 
                  { merge: true }
                );
              }
            })
          );
        });
      });
      
      await Promise.all(updatePromises);
      
      setSuccess("Doctor hierarchy saved successfully. All your clinics have been updated.");
    } catch (err) {
      console.error("Error saving hierarchy:", err);
      setError("Failed to save doctor hierarchy. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getAvailableDoctorsForSelect = () => {
    return availableDoctors.filter(
      doctor => !assignedDoctors.some(assigned => assigned.id === doctor.id)
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white shadow-xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Stethoscope className="h-6 w-6 text-blue-500" />
          <CardTitle className="text-2xl font-bold">
            Doctor Hierarchy Management
          </CardTitle>
        </div>
        <CardDescription>
          Configure the hierarchy of doctors who will be assigned to all your clinics
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Assigned Doctors</h3>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    Add Doctor
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Doctor to Hierarchy</DialogTitle>
                    <DialogDescription>
                      Select a doctor to add to your hierarchy. They will be assigned to all your clinics.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-4">
                    <Select
                      //value={getAvailableDoctorsForSelect().find(p => p.id === selectedDoctor) || null}
                      onChange={option => setSelectedDoctors(option ? option.id : "")}
                      options={getAvailableDoctorsForSelect().map(doctor => ({
                        value: doctor.id,
                        label: `${doctor.name} (${doctor.email})`,
                        id: doctor.id,
                      }))}
                      placeholder="Select a doctor"
                      isClearable
                      noOptionsMessage={() => "No available doctors to add"}
                    />
                  </div>
                  {/*<div className="py-4">
                    <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableDoctorsForSelect().length === 0 ? (
                          <SelectItem value="no-doctors" disabled>
                            No available doctors to add
                          </SelectItem>
                        ) : (
                          getAvailableDoctorsForSelect().map((doctor) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              {doctor.name} ({doctor.email})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>*/}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addDoctor} disabled={!selectedDoctor || selectedDoctor === "no-doctors"}>
                      Add Doctor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <Separator />
            
            {assignedDoctors.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-md border border-dashed border-gray-300">
                <Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No doctors assigned yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add doctors to create your hierarchy
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Position</TableHead>
                    <TableHead>Doctor Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedDoctors
                    .sort((a, b) => a.position - b.position)
                    .map((doctor, index) => (
                      <TableRow key={doctor.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {getPositionName(doctor.position)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{doctor.name}</TableCell>
                        <TableCell>{doctor.email}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveUp(index)}
                              disabled={index === 0}
                              className="h-8 w-8"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveDown(index)}
                              disabled={index === assignedDoctors.length - 1}
                              className="h-8 w-8"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDoctor(doctor.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
            
            <div className="flex items-center space-x-4 rounded-md border p-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="assign-to-any" className="text-base">
                  Fallback Assignment
                </Label>
                <p className="text-sm text-muted-foreground">
                  When primary doctors are unavailable, assign cases to any available doctor
                </p>
              </div>
              <Switch 
                id="assign-to-any" 
                checked={assignToAnyDoctor} 
                onCheckedChange={setAssignToAnyDoctor} 
              />
            </div>
            
            {assignedDoctors.length > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800">
                  The order above determines the doctor hierarchy. Primary doctors get first priority, followed by Secondary, etc.
                  {assignToAnyDoctor && (
                    <span className="block mt-2 font-medium">
                      <Check className="h-4 w-4 inline mr-1" />
                      Cases will be assigned to any available doctor when hierarchy doctors are unavailable.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-50 border-green-200">
                <BadgeCheck className="h-4 w-4 text-green-700 mr-2" />
                <AlertDescription className="text-green-800">
                  {success}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-gray-50 px-6 py-4">
        <Button
          onClick={saveHierarchy}
          disabled={saving || loading || assignedDoctors.length === 0}
          className="ml-auto flex gap-2 items-center"
        >
          {saving ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Doctor Hierarchy
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DoctorHierarchyManagement;