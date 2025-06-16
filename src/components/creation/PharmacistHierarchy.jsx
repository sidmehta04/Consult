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
  Pill,
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

const PharmacistHierarchyManagement = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [availablePharmacists, setAvailablePharmacists] = useState([]);
  const [assignedPharmacists, setAssignedPharmacists] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPharmacist, setSelectedPharmacist] = useState("");
  const [assignToAnyPharmacist, setAssignToAnyPharmacist] = useState(false);
  const [clinicsForConfirmation, setClinicsForConfirmation] = useState([]);
  const [pharmaHierarchy, setPharmaHierarchy] = useState([]);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);

  // Fetch all pharmacists and current assignments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all available pharmacists
        const pharmacistsQuery = query(
          collection(firestore, "users"),
          where("role", "==", "pharmacist")
        );
        
        const pharmacistsSnapshot = await getDocs(pharmacistsQuery);
        const pharmacistsList = [];
        pharmacistsSnapshot.forEach((doc) => {
          pharmacistsList.push({
            id: doc.id,
            name: doc.data().name,
            email: doc.data().email,
            ...doc.data()
          });
        });
        setAvailablePharmacists(pharmacistsList);
        
        // Fetch RO's data to see already assigned pharmacists
        const roRef = doc(firestore, "users", currentUser.uid);
        const roSnapshot = await getDoc(roRef);
        
        if (roSnapshot.exists()) {
          const roData = roSnapshot.data();
          
          // Check if the RO has pharmacist hierarchy configured
          if (roData.pharmacistHierarchy && Array.isArray(roData.pharmacistHierarchy)) {
            // Convert to array of assigned pharmacists with their hierarchy position
            const assignedPharmacistsList = await Promise.all(
              roData.pharmacistHierarchy.map(async (pharmacistId, index) => {
                const pharmacistRef = doc(firestore, "users", pharmacistId);
                const pharmacistSnap = await getDoc(pharmacistRef);
                
                if (pharmacistSnap.exists()) {
                  return {
                    id: pharmacistId,
                    position: index + 1,
                    name: pharmacistSnap.data().name,
                    email: pharmacistSnap.data().email
                  };
                } else {
                  return {
                    id: pharmacistId,
                    position: index + 1,
                    name: "Unknown Pharmacist",
                    email: "N/A"
                  };
                }
              })
            );
            
            setAssignedPharmacists(assignedPharmacistsList);
          } else {
            setAssignedPharmacists([]);
          }
          
          // Load assignToAnyPharmacist setting if it exists
          if (roData.assignToAnyPharmacist !== undefined) {
            setAssignToAnyPharmacist(roData.assignToAnyPharmacist);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load pharmacists. Please try again.");
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

  // Add a pharmacist to the hierarchy
  const addPharmacist = () => {
    if (!selectedPharmacist) return;
    
    // Check if pharmacist is already assigned
    if (assignedPharmacists.some(pharm => pharm.id === selectedPharmacist)) {
      setError("This pharmacist is already in your hierarchy.");
      return;
    }
    
    const pharmacistToAdd = availablePharmacists.find(pharm => pharm.id === selectedPharmacist);
    if (pharmacistToAdd) {
      const position = assignedPharmacists.length + 1;
      setAssignedPharmacists([
        ...assignedPharmacists,
        {
          id: pharmacistToAdd.id,
          position: position,
          name: pharmacistToAdd.name,
          email: pharmacistToAdd.email
        }
      ]);
      
      setSelectedPharmacist("");
      setIsDialogOpen(false);
    }
  };

  // Move pharmacist up in the hierarchy
  const moveUp = (index) => {
    if (index <= 0) return;
    
    const newAssignedPharmacists = [...assignedPharmacists];
    [newAssignedPharmacists[index - 1], newAssignedPharmacists[index]] = 
      [newAssignedPharmacists[index], newAssignedPharmacists[index - 1]];
    
    // Update positions
    newAssignedPharmacists.forEach((pharm, i) => {
      pharm.position = i + 1;
    });
    
    setAssignedPharmacists(newAssignedPharmacists);
  };

  // Move pharmacist down in the hierarchy
  const moveDown = (index) => {
    if (index >= assignedPharmacists.length - 1) return;
    
    const newAssignedPharmacists = [...assignedPharmacists];
    [newAssignedPharmacists[index], newAssignedPharmacists[index + 1]] = 
      [newAssignedPharmacists[index + 1], newAssignedPharmacists[index]];
    
    // Update positions
    newAssignedPharmacists.forEach((pharm, i) => {
      pharm.position = i + 1;
    });
    
    setAssignedPharmacists(newAssignedPharmacists);
  };

  // Remove pharmacist from hierarchy
  const removePharmacist = (pharmacistId) => {
    const newAssignedPharmacists = assignedPharmacists.filter(pharm => pharm.id !== pharmacistId);
    
    // Update positions
    newAssignedPharmacists.forEach((pharm, i) => {
      pharm.position = i + 1;
    });
    
    setAssignedPharmacists(newAssignedPharmacists);
  };

  // Save pharmacist hierarchy
  const saveHierarchy = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // 1. Prepare the data to be saved
      const pharmacistHierarchy = assignedPharmacists.sort((a, b) => a.position - b.position).map(pharm => pharm.id);
      const roRef = doc(firestore, "users", currentUser.uid);

      // 2. Save the main hierarchy settings to the RO document first
      await setDoc(roRef, {
        pharmacistHierarchy,
        assignToAnyPharmacist
      }, { merge: true });

      // 3. Fetch all clinics to determine which ones to update automatically vs. which need confirmation
      const clinicsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "nurse"),
        where("createdBy", "==", currentUser.uid)
      );
      const clinicsSnapshot = await getDocs(clinicsQuery);

      const autoUpdatePromises = [];
      const clinicsToConfirm = [];

      // Use a for...of loop to handle async operations correctly inside the loop
      for (const clinicDoc of clinicsSnapshot.docs) {
        const clinicData = clinicDoc.data();
        const clinicRef = doc(firestore, "users", clinicDoc.id);

        if (clinicData.manuallyAddedPharmacists) {
          // This clinic has manual assignments, add it to the list for confirmation
          clinicsToConfirm.push({
            id: clinicDoc.id,
            ...clinicData,
            clinicRef: clinicRef,
          });
        } else {
          // This clinic can be updated automatically
          const pharmacistAssignments = {};
          assignedPharmacists.forEach((pharmacist) => {
            const positionKey = getPositionName(pharmacist.position).toLowerCase();
            pharmacistAssignments[positionKey] = pharmacist.id;
            pharmacistAssignments[`${positionKey}Name`] = pharmacist.name;
          });
          pharmacistAssignments.assignToAnyPharmacist = assignToAnyPharmacist;

          autoUpdatePromises.push(
            setDoc(clinicRef, { assignedPharmacists: pharmacistAssignments }, { merge: true })
          );
        }
      }

      // 4. Await all the automatic updates
      if (autoUpdatePromises.length > 0) {
        await Promise.all(autoUpdatePromises);
      }

      // 5. NOW, decide whether to show the dialog or the final success message
      if (clinicsToConfirm.length > 0) {
        // There are clinics to confirm, so open the dialog and STOP.
        setClinicsForConfirmation(clinicsToConfirm);
        setIsConfirmationDialogOpen(true);
        // Give a partial success message
        setSuccess("Hierarchy saved. Some clinics require confirmation before they are updated.");
      } else {
        // No clinics needed confirmation, so the process is complete.
        setSuccess("Pharmacist hierarchy saved successfully. All your clinics have been updated.");
      }

    } catch (err) {
      console.error("Error saving hierarchy:", err);
      setError("Failed to save pharmacist hierarchy. Please try again.");
    } finally {
      // This will run after the logic completes, either showing the dialog or the final success message.
      setSaving(false);
    }
  };

  const getAvailablePharmacistsForSelect = () => {
    return availablePharmacists.filter(
      pharmacist => !assignedPharmacists.some(assigned => assigned.id === pharmacist.id)
    );
  };

  const handleCloseDialog = useCallback(() => {
    setClinicsForConfirmation([]);
  }, []);

  return (
    <div>
      <Card className="w-full max-w-4xl mx-auto bg-white shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Pill className="h-6 w-6 text-green-500" />
            <CardTitle className="text-2xl font-bold">
              Pharmacist Hierarchy Management
            </CardTitle>
          </div>
          <CardDescription>
            Configure the hierarchy of pharmacists who will be assigned to all your clinics
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <svg
                className="animate-spin h-8 w-8 text-green-500"
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
                <h3 className="text-lg font-medium">Assigned Pharmacists</h3>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex items-center gap-1">
                      <Plus className="h-4 w-4" />
                      Add Pharmacist
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Pharmacist to Hierarchy</DialogTitle>
                      <DialogDescription>
                        Select a pharmacist to add to your hierarchy. They will be assigned to all your clinics.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                      <Select
                        //value={getAvailablePharmacistsForSelect().find(p => p.id === selectedPharmacist) || null}
                        onChange={option => setSelectedPharmacist(option ? option.id : "")}
                        options={getAvailablePharmacistsForSelect().map(pharmacist => ({
                          value: pharmacist.id,
                          label: `${pharmacist.name} (${pharmacist.email})`,
                          id: pharmacist.id,
                        }))}
                        placeholder="Select a pharmacist"
                        isClearable
                        noOptionsMessage={() => "No available pharmacists to add"}
                      />
                    </div>
                    {/*<div className="py-4">
                      <Select value={selectedPharmacist} onValueChange={setSelectedPharmacist}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a pharmacist" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailablePharmacistsForSelect().length === 0 ? (
                            <SelectItem value="no-pharmacists" disabled>
                              No available pharmacists to add
                            </SelectItem>
                          ) : (
                            getAvailablePharmacistsForSelect().map((pharmacist) => (
                              <SelectItem key={pharmacist.id} value={pharmacist.id}>
                                {pharmacist.name} ({pharmacist.email})
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
                      <Button onClick={addPharmacist} disabled={!selectedPharmacist || selectedPharmacist === "no-pharmacists"}>
                        Add Pharmacist
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <Separator />
              
              {assignedPharmacists.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-md border border-dashed border-gray-300">
                  <Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No pharmacists assigned yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Add pharmacists to create your hierarchy
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Position</TableHead>
                      <TableHead>Pharmacist Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedPharmacists
                      .sort((a, b) => a.position - b.position)
                      .map((pharmacist, index) => (
                        <TableRow key={pharmacist.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-medium">
                              {getPositionName(pharmacist.position)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{pharmacist.name}</TableCell>
                          <TableCell>{pharmacist.email}</TableCell>
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
                                disabled={index === assignedPharmacists.length - 1}
                                className="h-8 w-8"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removePharmacist(pharmacist.id)}
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
                    When primary pharmacists are unavailable, assign cases to any available pharmacist
                  </p>
                </div>
                <Switch 
                  id="assign-to-any" 
                  checked={assignToAnyPharmacist} 
                  onCheckedChange={setAssignToAnyPharmacist} 
                />
              </div>
              
              {assignedPharmacists.length > 0 && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-800">
                    The order above determines the pharmacist hierarchy. Primary pharmacists get first priority, followed by Secondary, etc.
                    {assignToAnyPharmacist && (
                      <span className="block mt-2 font-medium">
                        <Check className="h-4 w-4 inline mr-1" />
                        Cases will be assigned to any available pharmacist when hierarchy pharmacists are unavailable.
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
            disabled={saving || loading || assignedPharmacists.length === 0}
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
                Save Pharmacist Hierarchy
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={isConfirmationDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog();
            setIsConfirmationDialogOpen(false);
          }
        }}
      >
        <DialogContent 
            className="max-w-5xl w-[90vw] p-4 overflow-hidden"
            aria-describedby="case-detail-description">
          <DialogHeader>
            <DialogTitle>Confirm Clinic Updates</DialogTitle>
            <DialogDescription>
              The following clinics have manually assigned pharmacists. Select the ones you wish to override with the new hierarchy.
            </DialogDescription>
          </DialogHeader>
          <div>
            <p className="mb-4">
              Confirm pharmacist hierarchy assignment for clinics with manually assigned pharmacists.
            </p>
            <div className="space-y-2">
              {clinicsForConfirmation.map((clinic, index) => (
                <div key={clinic.clinicRef.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`clinic-${index}`}
                    className="h-4 w-4"
                    checked={clinic.checked || false}
                    onChange={(e) => {
                      const updatedClinics = [...clinicsForConfirmation];
                      updatedClinics[index].checked = e.target.checked;
                      setClinicsForConfirmation(updatedClinics);
                    }}
                  />
                  <label htmlFor={`clinic-${index}`} className="text-sm">
                    {clinic.name || "Unnamed Clinic"}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const updatePromises = clinicsForConfirmation
                    .filter((clinic) => clinic.checked)
                    .map((clinic) => {
                      const pharmacistAssignments = {};
                      assignedPharmacists.forEach((pharmacist) => {
                        const positionKey = getPositionName(pharmacist.position).toLowerCase();
                        pharmacistAssignments[positionKey] = pharmacist.id;
                        pharmacistAssignments[`${positionKey}Name`] = pharmacist.name;
                      });
                      pharmacistAssignments.assignToAnyPharmacist = assignToAnyPharmacist;

                      return setDoc(
                        clinic.clinicRef,
                        { assignedPharmacists: pharmacistAssignments },
                        { merge: true }
                      );
                    });

                  await Promise.all(updatePromises);
                  setClinicsForConfirmation([]);
                  setSuccess("Clinics updated successfully.");
                } catch (err) {
                  console.error("Error updating clinics:", err);
                  setError("Failed to update clinics. Please try again.");
                }
              }}
            >
              Update Clinics
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PharmacistHierarchyManagement;