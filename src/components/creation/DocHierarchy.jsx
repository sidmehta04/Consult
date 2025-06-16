import React, { useState, useEffect, useCallback } from "react";
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

  // New state for the confirmation dialog
  const [clinicsForConfirmation, setClinicsForConfirmation] = useState([]);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const doctorsQuery = query(collection(firestore, "users"), where("role", "==", "doctor"));
        const doctorsSnapshot = await getDocs(doctorsQuery);
        const doctorsList = doctorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAvailableDoctors(doctorsList);

        const pharmacistRef = doc(firestore, "users", currentUser.uid);
        const pharmacistSnapshot = await getDoc(pharmacistRef);

        if (pharmacistSnapshot.exists()) {
          const pharmacistData = pharmacistSnapshot.data();
          if (pharmacistData.doctorHierarchy && Array.isArray(pharmacistData.doctorHierarchy)) {
            const assignedDoctorsList = await Promise.all(
              pharmacistData.doctorHierarchy.map(async (doctorId, index) => {
                const doctorRef = doc(firestore, "users", doctorId);
                const doctorSnap = await getDoc(doctorRef);
                return doctorSnap.exists()
                  ? { id: doctorId, position: index + 1, ...doctorSnap.data() }
                  : { id: doctorId, position: index + 1, name: "Unknown Doctor", email: "N/A" };
              })
            );
            setAssignedDoctors(assignedDoctorsList);
          } else {
            setAssignedDoctors([]);
          }
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

  const getPositionName = (position) => {
    const positions = ["Primary", "Secondary", "Tertiary", "Quaternary", "Quinary"];
    if (positions[position - 1]) return positions[position - 1];
    const j = position % 10, k = position % 100;
    if (j === 1 && k !== 11) return `${position}st`;
    if (j === 2 && k !== 12) return `${position}nd`;
    if (j === 3 && k !== 13) return `${position}rd`;
    return `${position}th`;
  };

  const updatePositions = (doctors) => doctors.map((doc, i) => ({ ...doc, position: i + 1 }));

  const addDoctor = () => {
    if (!selectedDoctor || assignedDoctors.some(d => d.id === selectedDoctor)) {
      if (assignedDoctors.some(d => d.id === selectedDoctor)) {
          setError("This doctor is already in your hierarchy.");
      }
      return;
    }
    const doctorToAdd = availableDoctors.find(d => d.id === selectedDoctor);
    if (doctorToAdd) {
      const newAssigned = [...assignedDoctors, { ...doctorToAdd, position: assignedDoctors.length + 1 }];
      setAssignedDoctors(updatePositions(newAssigned));
      setSelectedDoctor("");
      setIsDialogOpen(false);
      setError("");
    }
  };

  const moveUp = (index) => {
    if (index <= 0) return;
    const newAssigned = [...assignedDoctors];
    [newAssigned[index - 1], newAssigned[index]] = [newAssigned[index], newAssigned[index - 1]];
    setAssignedDoctors(updatePositions(newAssigned));
  };

  const moveDown = (index) => {
    if (index >= assignedDoctors.length - 1) return;
    const newAssigned = [...assignedDoctors];
    [newAssigned[index], newAssigned[index + 1]] = [newAssigned[index + 1], newAssigned[index]];
    setAssignedDoctors(updatePositions(newAssigned));
  };

  const removeDoctor = (doctorId) => {
    const newAssigned = assignedDoctors.filter(d => d.id !== doctorId);
    setAssignedDoctors(updatePositions(newAssigned));
  };

  // REWRITTEN saveHierarchy function
  const saveHierarchy = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const doctorHierarchy = assignedDoctors.sort((a, b) => a.position - b.position).map(doc => doc.id);
      const pharmacistRef = doc(firestore, "users", currentUser.uid);
      
      await setDoc(pharmacistRef, { 
        doctorHierarchy,
        assignToAnyDoctor 
      }, { merge: true });

      const clinicsQuery = query(collection(firestore, "users"), where("role", "==", "nurse"), where("createdBy", "==", currentUser.uid));
      const clinicsSnapshot = await getDocs(clinicsQuery);

      const autoUpdatePromises = [];
      const clinicsToConfirm = [];

      for (const clinicDoc of clinicsSnapshot.docs) {
        const clinicData = clinicDoc.data();
        const clinicRef = doc(firestore, "users", clinicDoc.id);

        console.log(clinicData);

        if (clinicData.manuallyAddedDoctors) {
          clinicsToConfirm.push({ id: clinicDoc.id, ...clinicData, clinicRef });
        } else {
          const doctorAssignments = {};
          assignedDoctors.forEach((doctor) => {
            const positionKey = getPositionName(doctor.position).toLowerCase();
            doctorAssignments[positionKey] = doctor.id;
            doctorAssignments[`${positionKey}Name`] = doctor.name;
          });
          doctorAssignments.assignToAnyDoctor = assignToAnyDoctor;
          autoUpdatePromises.push(setDoc(clinicRef, { assignedDoctors: doctorAssignments }, { merge: true }));
        }
      }

      if (autoUpdatePromises.length > 0) {
        await Promise.all(autoUpdatePromises);
      }

      if (clinicsToConfirm.length > 0) {
        setClinicsForConfirmation(clinicsToConfirm);
        setIsConfirmationDialogOpen(true);
        setSuccess("Hierarchy saved. Some clinics require confirmation before they are updated.");
      } else {
        setSuccess("Doctor hierarchy saved successfully. All your clinics have been updated.");
      }
    } catch (err) {
      console.error("Error saving hierarchy:", err);
      setError("Failed to save doctor hierarchy. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getAvailableDoctorsForSelect = () => {
    return availableDoctors.filter(doctor => !assignedDoctors.some(assigned => assigned.id === doctor.id));
  };

  const handleCloseDialog = useCallback(() => {
    setClinicsForConfirmation([]);
  }, []);

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto bg-white shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Stethoscope className="h-6 w-6 text-blue-500" />
            <CardTitle className="text-2xl font-bold">Doctor Hierarchy Management</CardTitle>
          </div>
          <CardDescription>Configure the hierarchy of doctors who will be assigned to all your clinics</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              {/* Spinner SVG */}
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Assigned Doctors</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex items-center gap-1"><Plus className="h-4 w-4" />Add Doctor</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Doctor to Hierarchy</DialogTitle>
                      <DialogDescription>Select a doctor to add to your hierarchy. They will be assigned to your clinics.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Select
                        onChange={option => setSelectedDoctor(option ? option.id : "")}
                        options={getAvailableDoctorsForSelect().map(doctor => ({ value: doctor.id, label: `${doctor.name} (${doctor.email})`, id: doctor.id }))}
                        placeholder="Select a doctor"
                        isClearable
                        noOptionsMessage={() => "No available doctors to add"}
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                      <Button onClick={addDoctor} disabled={!selectedDoctor}>Add Doctor</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <Separator />
              {assignedDoctors.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-md border border-dashed border-gray-300">
                  <Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No doctors assigned yet</p>
                  <p className="text-sm text-gray-400 mt-1">Add doctors to create your hierarchy</p>
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
                    {assignedDoctors.map((doctor, index) => (
                      <TableRow key={doctor.id}>
                        <TableCell><Badge variant="outline" className="font-medium">{getPositionName(doctor.position)}</Badge></TableCell>
                        <TableCell className="font-medium">{doctor.name}</TableCell>
                        <TableCell>{doctor.email}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => moveUp(index)} disabled={index === 0} className="h-8 w-8"><ChevronUp className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => moveDown(index)} disabled={index === assignedDoctors.length - 1} className="h-8 w-8"><ChevronDown className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => removeDoctor(doctor.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"><Trash className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex items-center space-x-4 rounded-md border p-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="assign-to-any-doc" className="text-base">Fallback Assignment</Label>
                  <p className="text-sm text-muted-foreground">When primary doctors are unavailable, assign cases to any available doctor</p>
                </div>
                <Switch id="assign-to-any-doc" checked={assignToAnyDoctor} onCheckedChange={setAssignToAnyDoctor} />
              </div>
              {assignedDoctors.length > 0 && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-800">
                    The order above determines the doctor hierarchy. Primary gets first priority.
                    {assignToAnyDoctor && (<span className="block mt-2 font-medium"><Check className="h-4 w-4 inline mr-1" />Fallback to any available doctor is enabled.</span>)}
                  </AlertDescription>
                </Alert>
              )}
              {error && (<Alert variant="destructive"><AlertCircle className="h-4 w-4 mr-2" /><AlertDescription>{error}</AlertDescription></Alert>)}
              {success && (<Alert className="bg-green-50 border-green-200"><BadgeCheck className="h-4 w-4 text-green-700 mr-2" /><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>)}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-gray-50 px-6 py-4">
          <Button onClick={saveHierarchy} disabled={saving || loading || assignedDoctors.length === 0} className="ml-auto flex gap-2 items-center">
            {saving ? (<><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Saving...</>) : (<><Save className="h-4 w-4" />Save Doctor Hierarchy</>)}
          </Button>
        </CardFooter>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmationDialogOpen} onOpenChange={(open) => { if (!open) { handleCloseDialog(); setIsConfirmationDialogOpen(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Hierarchy Override</DialogTitle>
            <DialogDescription>
              Some clinics have manually assigned doctors. Select which clinics should be updated to use this new hierarchy. Unchecked clinics will keep their existing assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-80 overflow-y-auto">
            <div className="space-y-2">
              {clinicsForConfirmation.map((clinic, index) => (
                <div key={clinic.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                  <input
                    type="checkbox"
                    id={`clinic-doc-${index}`}
                    className="h-4 w-4"
                    checked={clinic.checked || false}
                    onChange={(e) => {
                      const updatedClinics = [...clinicsForConfirmation];
                      updatedClinics[index].checked = e.target.checked;
                      setClinicsForConfirmation(updatedClinics);
                    }}
                  />
                  <label htmlFor={`clinic-doc-${index}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {clinic.name || "Unnamed Clinic"}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmationDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  const clinicsToUpdate = clinicsForConfirmation.filter((clinic) => clinic.checked);
                  if (clinicsToUpdate.length === 0) {
                     setIsConfirmationDialogOpen(false);
                     return;
                  }

                  const updatePromises = clinicsToUpdate.map((clinic) => {
                    const doctorAssignments = {};
                    assignedDoctors.forEach((doctor) => {
                      const positionKey = getPositionName(doctor.position).toLowerCase();
                      doctorAssignments[positionKey] = doctor.id;
                      doctorAssignments[`${positionKey}Name`] = doctor.name;
                    });
                    doctorAssignments.assignToAnyDoctor = assignToAnyDoctor;
                    return setDoc(clinic.clinicRef, { assignedDoctors: doctorAssignments }, { merge: true });
                  });

                  await Promise.all(updatePromises);
                  setIsConfirmationDialogOpen(false);
                  handleCloseDialog();
                  setSuccess("Selected clinics have been successfully updated with the new hierarchy.");
                } catch (err) {
                  console.error("Error updating clinics:", err);
                  setError("Failed to update clinics. Please try again.");
                }
              }}
            >
              Update Selected Clinics
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DoctorHierarchyManagement;