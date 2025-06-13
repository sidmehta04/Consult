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
  Pill,
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
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase";

const PharmacistHierarchyCard = ({ currentUser, selectedClinic }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [availablePharmacists, setAvailablePharmacists] = useState([]);
  const [assignedPharmacists, setAssignedPharmacists] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPharmacist, setSelectedPharmacist] = useState("");
  const [clinicUid, setClinicUid] = useState("");
  const [hasExistingHierarchy, setHasExistingHierarchy] = useState(false);

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
        
        // Fetch clinic-specific pharmacist assignments (nurse)
        const clinicQuery = query(
          collection(firestore, "users"),
          where("clinicCode", "==", selectedClinic.clinicCode),
        );

        const clinicSnapshot = await getDocs(clinicQuery);
        const clinicData = clinicSnapshot.docs[0]?.data(); //there should only be one item

        if (clinicData && clinicData.assignedPharmacists) {
          setClinicUid(clinicSnapshot.docs[0].id); // Set the clinic UID
          
          // Check if there are any assigned pharmacists
          const hasAnyPharmacists = Object.keys(clinicData.assignedPharmacists).some(key => 
            !key.includes('Name') && !key.includes('assignToAnyPharmacist') && clinicData.assignedPharmacists[key]
          );
          
          setHasExistingHierarchy(hasAnyPharmacists);
          
          if (hasAnyPharmacists) {
            const assignedPharmacistsList = await Promise.all(
              Array.from({ length: 5 }, (_, index) => {//check up to 5 pharmacists ??
                const i = index + 1;
                const positionKey = getPositionName(i).toLowerCase();
                const pharmacistId = clinicData.assignedPharmacists?.[positionKey];

                if (!pharmacistId) {
                  return Promise.resolve(null); // Skip this one
                }

                return getDoc(doc(firestore, "users", pharmacistId))
                  .then(snapshot => ({
                    id: pharmacistId,
                    position: i,
                    name: snapshot.exists() ? snapshot.data().name : "Unknown Pharmacist",
                    email: snapshot.exists() ? snapshot.data().email : "Unknown Email",
                  }))
                  .catch(error => {
                    console.error(`Error fetching pharmacist at position ${i}`, error);
                    return {
                      id: pharmacistId,
                      position: i,
                      name: "Error Fetching",
                      email: "Error Fetching",
                    };
                  });
              })
            );

            // Filter out null values
            const filteredAssignedPharmacists = assignedPharmacistsList.filter(pharmacist => pharmacist !== null);
        
            setAssignedPharmacists(filteredAssignedPharmacists);
          }
        } else {
          setClinicUid(clinicSnapshot.docs[0]?.id || "");
          setHasExistingHierarchy(false);
        }
        
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load pharmacists. Please try again.");
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
      
      // Update the clinic's assigned pharmacists
      const clinicRef = doc(firestore, "users", clinicUid);

      const clinicSnapshot = await getDoc(clinicRef);
      const clinicData = clinicSnapshot.data();
      
      // Build the new assignedPharmacists object
      const newAssignedPharmacists = assignedPharmacists.reduce((acc, pharm) => {
        const positionKey = getPositionName(pharm.position).toLowerCase();
        acc[positionKey] = pharm.id;
        acc[`${positionKey}Name`] = pharm.name;
        return acc;
      }, {});

      // Preserve the existing assignToAnyPharmacist setting if it exists, otherwise default to false
      const existingAssignToAny = clinicData.assignedPharmacists?.assignToAnyPharmacist;
      if (existingAssignToAny !== undefined) {
        newAssignedPharmacists.assignToAnyPharmacist = existingAssignToAny;
      } else {
        newAssignedPharmacists.assignToAnyPharmacist = false;
      }

      clinicData.assignedPharmacists = newAssignedPharmacists;
      clinicData.manuallyAddedPharmacists = true;

      await setDoc(clinicRef, clinicData, {merge: false});

      // Also update each pharmacist's assigned clinics
      for (const pharmacist of assignedPharmacists) {
        const pharmacistRef = doc(firestore, "users", pharmacist.id);

        await setDoc(pharmacistRef, {
          [`assignedClinics.${clinicUid}`]: true
        }, { merge: true });
      }

      setSuccess("Pharmacist hierarchy updated successfully.");
    } catch (err) {
      console.error("Error saving hierarchy:", err);
      setError("Failed to save pharmacist hierarchy. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getAvailablePharmacistsForSelect = () => {
    return availablePharmacists.filter(
      pharmacist => !assignedPharmacists.some(assigned => assigned.id === pharmacist.id)
    );
  };

  // Component for when no hierarchy exists
  const NoHierarchyMessage = () => (
    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      <UserPlus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No Pharmacist Hierarchy Found
      </h3>
      <p className="text-gray-500 mb-4 max-w-md mx-auto">
        This clinic doesn't have a pharmacist hierarchy set up yet. 
        Please create a hierarchy first before you can edit pharmacist assignments.
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
          <Pill className="h-6 w-6 text-purple-500" />
          <CardTitle className="text-2xl font-bold">
            {hasExistingHierarchy ? "Edit Pharmacist Hierarchy" : "Pharmacist Hierarchy"}
          </CardTitle>
        </div>
        <CardDescription>
          {hasExistingHierarchy 
            ? `Edit the pharmacist hierarchy for ${selectedClinic.name} : ${selectedClinic.clinicCode}`
            : `View pharmacist hierarchy status for ${selectedClinic.name} : ${selectedClinic.clinicCode}`
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
                      Select a pharmacist to add to the existing hierarchy for this clinic.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-4">
                    <Select
                      value={getAvailablePharmacistsForSelect().find(p => p.id === selectedPharmacist) || null}
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
                <p className="text-gray-500">No pharmacists currently assigned</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add pharmacists to update the hierarchy
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
                              title="Move up in hierarchy"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveDown(index)}
                              disabled={index === assignedPharmacists.length - 1}
                              className="h-8 w-8"
                              title="Move down in hierarchy"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePharmacist(pharmacist.id)}
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
            
            {assignedPharmacists.length > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800">
                  The order above determines the pharmacist hierarchy. Primary pharmacists get first priority, followed by Secondary, etc.
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

export default PharmacistHierarchyCard;