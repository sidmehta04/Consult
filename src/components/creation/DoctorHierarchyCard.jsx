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
  ClipboardPlus,
  BadgeCheck,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Trash,
  Plus,
  Save,
  Check,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteField } from "firebase/firestore";
import { firestore } from "../../firebase";

const DoctorHierarchyCard = ({ currentUser, selectedClinic }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [assignedDoctors, setAssignedDoctors] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [clinicUid, setClinicUid] = useState("");
  const [hasExistingHierarchy, setHasExistingHierarchy] = useState(false);

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
        
        // Fetch clinic-specific doctor assignments (nurse)
        const clinicQuery = query(
          collection(firestore, "users"),
          where("clinicCode", "==", selectedClinic.clinicCode),
        );

        const clinicSnapshot = await getDocs(clinicQuery);
        const clinicData = clinicSnapshot.docs[0]?.data(); //there should only be one item

        if (clinicData && clinicData.assignedDoctors) {
          setClinicUid(clinicSnapshot.docs[0].id); // Set the clinic UID
          
          // Check if there are any assigned doctors
          const hasAnyDoctors = Object.keys(clinicData.assignedDoctors).some(key => 
            !key.includes('Name') && clinicData.assignedDoctors[key]
          );
          
          setHasExistingHierarchy(hasAnyDoctors);
          
          if (hasAnyDoctors) {
            const assignedDoctorsList = await Promise.all(
              Array.from({ length: 5 }, (_, index) => {//check up to 5 doctors ??
                const i = index + 1;
                const positionKey = getPositionName(i).toLowerCase();
                const doctorId = clinicData.assignedDoctors?.[positionKey];

                if (!doctorId) {
                  return Promise.resolve(null); // Skip this one
                }

                return getDoc(doc(firestore, "users", doctorId))
                  .then(snapshot => ({
                    id: doctorId,
                    position: i,
                    name: snapshot.exists() ? snapshot.data().name : "Unknown Doctor",
                    email: snapshot.exists() ? snapshot.data().email : "Unknown Email",
                  }))
                  .catch(error => {
                    console.error(`Error fetching doctor at position ${i}`, error);
                    return {
                      id: doctorId,
                      position: i,
                      name: "Error Fetching",
                      email: "Error Fetching",
                    };
                  });
              })
            );

            // Filter out null values
            const filteredAssignedDoctors = assignedDoctorsList.filter(doctor => doctor !== null);
        
            setAssignedDoctors(filteredAssignedDoctors);
          }
        } else {
          setClinicUid(clinicSnapshot.docs[0]?.id || "");
          setHasExistingHierarchy(false);
        }
        
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load doctors. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser.uid, selectedClinic]);

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
    if (assignedDoctors.some(pharm => pharm.id === selectedDoctor)) {
      setError("This doctor is already in your hierarchy.");
      return;
    }
    
    const doctorToAdd = availableDoctors.find(pharm => pharm.id === selectedDoctor);
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
    newAssignedDoctors.forEach((pharm, i) => {
      pharm.position = i + 1;
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
    newAssignedDoctors.forEach((pharm, i) => {
      pharm.position = i + 1;
    });
    
    setAssignedDoctors(newAssignedDoctors);
  };

  // Remove doctor from hierarchy
  const removeDoctor = (doctorId) => {
    const newAssignedDoctors = assignedDoctors.filter(pharm => pharm.id !== doctorId);
    
    // Update positions
    newAssignedDoctors.forEach((pharm, i) => {
      pharm.position = i + 1;
    });
    
    setAssignedDoctors(newAssignedDoctors);
  };

  // Save doctor hierarchy
const saveHierarchy = async () => {
  try {
    setSaving(true);
    setError("");
    setSuccess("");
    
    // Update the clinic's assigned doctors
    const clinicRef = doc(firestore, "users", clinicUid);

    const clinicSnapshot = await getDoc(clinicRef);
    const clinicData = clinicSnapshot.data();

    const toAssignDoctors = assignedDoctors;

    // Add any missing doctors to the end of the list
    for (let i = 0; i < 10 - toAssignDoctors.length; i++) {
      toAssignDoctors.push({
        id: deleteField(),
        name: deleteField(),
      });
    }
    
    // Create the new assignedDoctors object with proper undefined handling
    const newAssignedDoctors = {
      ...toAssignDoctors.reduce((acc, doctor) => {
        const positionKey = getPositionName(doctor.position).toLowerCase();
        acc[positionKey] = doctor.id;
        acc[`${positionKey}Name`] = doctor.name;
        return acc;
      }, {})
    };

    // Only add assignToAnyDoctor if it exists and is not undefined
    if (clinicData.assignedDoctors?.assignToAnyDoctor !== undefined) {
      newAssignedDoctors.assignToAnyDoctor = clinicData.assignedDoctors.assignToAnyDoctor;
    }

    // Update the clinic data
    const updatedClinicData = {
      ...clinicData,
      assignedDoctors: newAssignedDoctors,
      manuallyAddedDoctors: true
    };

    await setDoc(clinicRef, updatedClinicData, { merge: false });

    // Also update each doctor's assigned clinics
    for (const doctor of assignedDoctors) {
      const doctorRef = doc(firestore, "users", doctor.id);

      await setDoc(doctorRef, {
        [`assignedClinics.${clinicUid}`]: true
      }, { merge: true });
    }

    setSuccess("Doctor hierarchy updated successfully.");
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

  // Component for when no hierarchy exists
  const NoHierarchyMessage = () => (
    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      <UserPlus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No Doctor Hierarchy Found
      </h3>
      <p className="text-gray-500 mb-4 max-w-md mx-auto">
        This clinic doesn't have a doctor hierarchy set up yet. 
        Please create a hierarchy first before you can edit doctor assignments.
      </p>
      <Alert className="bg-blue-50 border-blue-200 max-w-md mx-auto">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          You can only edit existing hierarchies here. To create a new hierarchy, 
          please use the hierarchy creation feature.
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white shadow-xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <ClipboardPlus className="h-6 w-6 text-purple-500" />
          <CardTitle className="text-2xl font-bold">
            {hasExistingHierarchy ? "Edit Doctor Hierarchy" : "Doctor Hierarchy"}
          </CardTitle>
        </div>
        <CardDescription>
          {hasExistingHierarchy 
            ? `Edit the doctor hierarchy for ${selectedClinic.name} : ${selectedClinic.clinicCode}`
            : `View doctor hierarchy status for ${selectedClinic.name} : ${selectedClinic.clinicCode}`
          }
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <svg
              className="animate-spin h-8 w-8 text-purple-500"
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
        ) : !hasExistingHierarchy ? (
          <NoHierarchyMessage />
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
                      Select a doctor to add to the existing hierarchy for this clinic.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-4">
                    <Select
                      //value={getAvailableDoctorsForSelect().find(p => p.id === selectedDoctor) || null}
                      onChange={option => setSelectedDoctor(option ? option.id : "")}
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
                <p className="text-gray-500">No doctors currently assigned</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add doctors to update the hierarchy
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
                              title="Move up in hierarchy"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveDown(index)}
                              disabled={index === assignedDoctors.length - 1}
                              className="h-8 w-8"
                              title="Move down in hierarchy"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDoctor(doctor.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Remove from hierarchy"
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
            
            {assignedDoctors.length > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800">
                  The order above determines the doctor hierarchy. Primary doctors get first priority, followed by Secondary, etc.
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

      {hasExistingHierarchy && (
        <CardFooter className="bg-gray-50 px-6 py-4">
          <Button
            onClick={saveHierarchy}
            disabled={saving || loading}
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
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default DoctorHierarchyCard;