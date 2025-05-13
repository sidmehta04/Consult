import React, { useState, useEffect } from "react";
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
  Select,
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
  Building2,
  BadgeCheck,
  AlertCircle,
  ShieldMinus,
  Trash,
  Minus,
  Plus,
  Save,
  ExternalLink,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { firestore } from "../../firebase";

import PharmacistHierarchyCard from "./PharmacistHierarchyCard";



const ClinicHierarchyManagement = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [availableClinics, setAvailableClinics] = useState([]);
  const [assignedClinics, setAssignedClinics] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeletingClinics, setIsDeletingClinics] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredClinics, setFilteredClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [deactivatingId, setDeactivatingId] = useState(null);

  // Fetch all clinics and current assignments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch pharmacist's data to see already assigned clinics
        const pharmacistRef = doc(firestore, "users", currentUser.uid);
        const pharmacistSnapshot = await getDoc(pharmacistRef);

        if (pharmacistSnapshot.exists()) {
          const pharmacistData = pharmacistSnapshot.data();

          // Fetch ALL available clinics in the system
          const clinicsQuery = query(
            collection(firestore, "users"),
            where("role", "==", "nurse")
          );

          const clinicsSnapshot = await getDocs(clinicsQuery);
          const clinicsList = [];
          const assignedClinicsList = [];

          clinicsSnapshot.forEach((doc) => {
            const clinicData = {
              id: doc.id,
              name: doc.data().name,
              clinicCode: doc.data().clinicCode || "N/A",
              email: doc.data().email || "N/A",
              state: doc.data().state || "N/A",
              district: doc.data().district || "N/A",
              address: doc.data().address || "N/A",
              createdBy: doc.data().createdBy || "",
              partnerName: doc.data().partnerName || "N/A",
              deactivated: doc.data().deactivated || false,
              createdAt: doc.data().createdAt
                ? new Date(
                    doc.data().createdAt.seconds * 1000
                  ).toLocaleDateString()
                : "N/A",
              ...doc.data(),
            };

            // Add a flag for clinics created by this pharmacist
            clinicData.isOwnClinic = clinicData.createdBy === currentUser.uid;

            if(!clinicData.deactivated){
              clinicsList.push(clinicData);
              // Check if this clinic is assigned to the pharmacist
              const isAssigned =
                pharmacistData.assignedClinics &&
                pharmacistData.assignedClinics[doc.id] === true;

              if (isAssigned) {
                assignedClinicsList.push(clinicData);
              }
            }
          });

          // Sort clinics - own clinics first, then by name
          clinicsList.sort((a, b) => {
            if (a.isOwnClinic && !b.isOwnClinic) return -1;
            if (!a.isOwnClinic && b.isOwnClinic) return 1;
            return a.name.localeCompare(b.name);
          });

          setAvailableClinics(clinicsList);
          setAssignedClinics(assignedClinicsList);
          setFilteredClinics(clinicsList);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load clinics. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser.uid]);

  const [filterType, setFilterType] = useState("own");

  useEffect(() => {
    setFilterType("own");
  }, [isDialogOpen, isDeletingClinics])

  // Filter clinics based on search term and filter type
  useEffect(() => {
    let filtered = [...availableClinics];

    // Apply filter type first
    if (filterType === "own") {
      filtered = filtered.filter((clinic) => clinic.isOwnClinic);
    } else if (filterType === "other") {
      filtered = filtered.filter((clinic) => !clinic.isOwnClinic);
    } else if (filterType === "assigned") {
      filtered = filtered.filter((clinic) =>
        assignedClinics.some((assigned) => assigned.id === clinic.id)
      );
    } else if (filterType === "unassigned") {
      filtered = filtered.filter(
        (clinic) =>
          !assignedClinics.some((assigned) => assigned.id === clinic.id)
      );
    }

    // Then apply search term if present
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (clinic) =>
          (clinic.name && clinic.name.toLowerCase().includes(term)) ||
          (clinic.clinicCode &&
            clinic.clinicCode.toLowerCase().includes(term)) ||
          (clinic.state && clinic.state.toLowerCase().includes(term)) ||
          (clinic.district && clinic.district.toLowerCase().includes(term)) ||
          (clinic.address && clinic.address.toLowerCase().includes(term)) ||
          (clinic.partnerName &&
            clinic.partnerName.toLowerCase().includes(term))
      );
    }

    setFilteredClinics(filtered);
  }, [searchTerm, availableClinics, filterType, assignedClinics]);

  //Deactivate Clinic
  /*
  const deactivateClinic = async (clinic) => {
    try {
      //remove from all doctors and pharmacists assignments

      const medQuery = query(
        collection(firestore, "users"),
        where("assignedClinics."+clinic.id, "==", true)
      );

      const medSnapshot = await getDocs(medQuery);

      for (const doc of medSnapshot.docs) {
        await setDoc(
          doc.ref,
          { [`assignedClinics.${clinic.id}`]: false },
          { merge: true }
        );
      }
      //add deactivated = true

      const clinicRef = doc(firestore, "users", clinic.id);
      setDoc(
        clinicRef,
        { deactivated : true },
        { merge : true }
      )

    } catch (err) {
      console.error("Error deactivating clinic:", err);
    }
  }
  */
  // Add a clinic to the assignment
  const addClinic = (clinicId) => {
    // Check if clinic is already assigned
    if (assignedClinics.some((clinic) => clinic.id === clinicId)) {
      setError("This clinic is already in your assignments.");
      return;
    }

    const clinicToAdd = availableClinics.find(
      (clinic) => clinic.id === clinicId
    );
    if (clinicToAdd) {
      setAssignedClinics([...assignedClinics, clinicToAdd]);
    }
  };

  // Remove clinic from assignments
  const removeClinic = (clinicId) => {
    setAssignedClinics(
      assignedClinics.filter((clinic) => clinic.id !== clinicId)
    );
  };

  // Save clinic assignments
  const saveAssignments = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Create a new object with clinic IDs as keys and true as values
      const clinicAssignments = {};
      assignedClinics.forEach((clinic) => {
        clinicAssignments[clinic.id] = true;
      });

      // Update pharmacist's assigned clinics
      const pharmacistRef = doc(firestore, "users", currentUser.uid);
      await setDoc(
        pharmacistRef,
        {
          assignedClinics: clinicAssignments,
        },
        { merge: true }
      );

      // Update clinic assignments for all assigned clinics
      const updatePromises = [];

      // Get pharmacist data for name
      const pharmacistSnapshot = await getDoc(pharmacistRef);
      const pharmacistData = pharmacistSnapshot.data();

      // Get the doctor hierarchy if it exists
      const doctorHierarchy = pharmacistData.doctorHierarchy || [];

      // For each clinic, set or remove the pharmacist assignment
      for (const clinic of availableClinics) {
        const clinicRef = doc(firestore, "users", clinic.id);
        const clinicSnapshot = await getDoc(clinicRef);

        if (clinicSnapshot.exists()) {
          const clinicData = clinicSnapshot.data();
          const assignedPharmacists = clinicData.assignedPharmacists || {};

          // Check if clinic is in our assigned list
          const isAssigned = assignedClinics.some((c) => c.id === clinic.id);

          if (isAssigned) {
            // Add pharmacist to clinic's assignedPharmacists
            assignedPharmacists.primary = currentUser.uid;
            assignedPharmacists.primaryName = pharmacistData.name;

            updatePromises.push(
              setDoc(
                clinicRef,
                {
                  assignedPharmacists,
                },
                { merge: true }
              )
            );

            // Also ensure doctors in hierarchy are assigned to this clinic
            for (const doctorId of doctorHierarchy) {
              const doctorRef = doc(firestore, "users", doctorId);
              const doctorSnapshot = await getDoc(doctorRef);

              if (doctorSnapshot.exists()) {
                const doctorData = doctorSnapshot.data();
                const updatedClinics = {
                  ...(doctorData.assignedClinics || {}),
                  [clinic.id]: true,
                };

                updatePromises.push(
                  setDoc(
                    doctorRef,
                    {
                      assignedClinics: updatedClinics,
                    },
                    { merge: true }
                  )
                );
              }
            }
          } else {
            // Remove this pharmacist from clinic's assignedPharmacists if present
            if (assignedPharmacists.primary === currentUser.uid) {
              delete assignedPharmacists.primary;
              delete assignedPharmacists.primaryName;

              updatePromises.push(
                setDoc(
                  clinicRef,
                  {
                    assignedPharmacists,
                  },
                  { merge: true }
                )
              );

              // Also remove doctors in hierarchy from this clinic
              for (const doctorId of doctorHierarchy) {
                const doctorRef = doc(firestore, "users", doctorId);
                const doctorSnapshot = await getDoc(doctorRef);

                if (doctorSnapshot.exists()) {
                  const doctorData = doctorSnapshot.data();
                  const updatedClinics = {
                    ...(doctorData.assignedClinics || {}),
                  };

                  if (updatedClinics[clinic.id]) {
                    delete updatedClinics[clinic.id];

                    updatePromises.push(
                      setDoc(
                        doctorRef,
                        {
                          assignedClinics: updatedClinics,
                        },
                        { merge: true }
                      )
                    );
                  }
                }
              }
            }
          }
        }
      }

      await Promise.all(updatePromises);

      setSuccess("Clinic assignments saved successfully.");
    } catch (err) {
      console.error("Error saving clinic assignments:", err);
      setError("Failed to save clinic assignments. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Check if a clinic is already assigned
  const isClinicAssigned = (clinicId) => {
    return assignedClinics.some((clinic) => clinic.id === clinicId);
  };

  return (
    <Card className="w-full max-w-8xl mx-auto bg-white shadow-xl">
      <CardHeader className="border-b bg-grey-50">
        <div className="flex items-center space-x-2">
          <Building2 className="h-6 w-6 text-purple-600" />
          <CardTitle className="text-2xl font-bold text-grey-700">
            Clinic Management
          </CardTitle>
        </div>
        <CardDescription className="text-grey-700/70">
          Manage which clinics are assigned to you and your doctor hierarchy.
          You can add any clinic in the system to your assignments.
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
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Assigned Clinics</h3>
              <div className="flex gap-2 ml-auto">
                {/*
                <Dialog
                  open={isDeletingClinics}
                  onOpenChange={setIsDeletingClinics}
                  className="!bg-white"
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="flex items-center gap-1 bg-red-600 hover:bg-grey-700"
                    >
                      <Minus className="h-4 w-4" />
                      Deactivate Clinic
                    </Button>
                  </DialogTrigger>

                  <DialogContent
                    className="!w-[70vw] !h-[80vh] !bg-white p-6 shadow-xl border border-gray-200 overflow-auto !max-w-none"
                    style={{ backgroundColor: "white", backdropFilter: "none" }}
                  >
                    <DialogHeader className="px-6 py-4 border-b bg-white">
                      <DialogTitle className="text-xl font-semibold text-grey-700">
                        Deactivate a Clinic
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-600">
                        Select a clinic to deactivate. This will remove the login and unassign it from doctors and pharmacists.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 py-4 bg-white">
                      <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="relative flex-1">
                          <Input
                            type="text"
                            placeholder="Search clinics by name, code, location, partner..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full"
                          />
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        </div>
                        <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Filter clinics" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="own">My Clinics</SelectItem>
                            <SelectItem value="all">All Clinics</SelectItem>
                            <SelectItem value="other">Other Clinics</SelectItem>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="h-[350px] overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead className="w-[30%]">
                                Clinic Name
                              </TableHead>
                              <TableHead className="w-[15%]">
                                Clinic Code
                              </TableHead>
                              <TableHead className="w-[20%]">Location</TableHead>
                              <TableHead className="w-[20%]">Partner</TableHead>
                              <TableHead className="w-[15%] text-right">
                                Action
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredClinics.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="text-center py-8 text-gray-500"
                                >
                                  No clinics found matching your criteria
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredClinics
                                .map((clinic) => (
                                  <TableRow
                                    key={clinic.id}
                                    className={
                                      clinic.isOwnClinic ? "bg-grey-50" : ""
                                    }
                                  >
                                    <TableCell className="font-medium">
                                      {clinic.name}
                                      {clinic.isOwnClinic && (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 bg-grey-100 text-grey-800 border-grey-300"
                                        >
                                          Created by you
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>{clinic.clinicCode}</TableCell>
                                    <TableCell>
                                      {clinic.district}, {clinic.state}
                                    </TableCell>
                                    <TableCell>{clinic.partnerName}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="secondary"
                                        onClick={() => deactivateClinic(clinic.id)}
                                        size="sm"
                                        className="bg-grey-100 text-grey-700 hover:bg-grey-200"
                                      >
                                        {deactivatingId === clinic.id ? (
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
                                            Deactivating
                                          </>
                                        ) : (
                                          <>
                                            <ShieldMinus className="h-4 w-4" />
                                            Deactivate
                                          </>
                                        )}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t bg-gray-50 flex justify-end w-full">
                      <Button
                        onClick={() => {setIsDeletingClinics(false); setFilterType("own")}}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                */}
          
                <Dialog
                  open={isDialogOpen}
                  onOpenChange={setIsDialogOpen}
                  className="!bg-white"
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="flex items-center gap-1 bg-purple-600 hover:bg-grey-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Clinic
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="!w-[70vw] !h-[97vh] !bg-white p-6 shadow-xl border border-gray-200 overflow-auto !max-w-none"
                    style={{ backgroundColor: "white", backdropFilter: "none" }}
                  >
                    <DialogHeader className="px-6 py-4 border-b bg-white">
                      <DialogTitle className="text-xl font-semibold text-grey-700">
                        Add Clinic to Your Assignments
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-600">
                        Select clinics to add to your assignments. Your assigned
                        doctors will also be able to access these clinics.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 py-4 bg-white">
                      <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="relative flex-1">
                          <Input
                            type="text"
                            placeholder="Search clinics by name, code, location, partner..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full"
                          />
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        </div>

                        <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Filter clinics" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="own">My Clinics</SelectItem>
                            <SelectItem value="all">All Clinics</SelectItem>
                            <SelectItem value="other">Other Clinics</SelectItem>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="h-[350px] overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead className="w-[30%]">
                                Clinic Name
                              </TableHead>
                              <TableHead className="w-[15%]">
                                Clinic Code
                              </TableHead>
                              <TableHead className="w-[20%]">Location</TableHead>
                              <TableHead className="w-[20%]">Partner</TableHead>
                              <TableHead className="w-[15%] text-right">
                                Action
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredClinics.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="text-center py-8 text-gray-500"
                                >
                                  No clinics found matching your criteria
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredClinics
                                .filter((clinic) => !isClinicAssigned(clinic.id))
                                .map((clinic) => (
                                  <TableRow
                                    key={clinic.id}
                                    className={
                                      clinic.isOwnClinic ? "bg-grey-50" : ""
                                    }
                                  >
                                    <TableCell className="font-medium">
                                      {clinic.name}
                                      {clinic.isOwnClinic && (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 bg-grey-100 text-grey-800 border-grey-300"
                                        >
                                          Created by you
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>{clinic.clinicCode}</TableCell>
                                    <TableCell>
                                      {clinic.district}, {clinic.state}
                                    </TableCell>
                                    <TableCell>{clinic.partnerName}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="secondary"
                                        onClick={() => addClinic(clinic.id)}
                                        size="sm"
                                        className="bg-grey-100 text-grey-700 hover:bg-grey-200"
                                      >
                                        Add
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Show already assigned clinics in dialog for easy reference */}
                      {assignedClinics.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Already Assigned Clinics
                          </h4>
                          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                            {assignedClinics.map((clinic) => (
                              <Badge
                                key={clinic.id}
                                variant="secondary"
                                className="py-1 px-3"
                              >
                                {clinic.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <DialogFooter className="px-6 py-4 border-t bg-gray-50 flex justify-end w-full">
                      <Button
                        onClick={() => {setIsDialogOpen(false); setFilterType("own")}}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-gray-500">
                  Total Assigned: {assignedClinics.length}
                </h4>
                {assignedClinics.length > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-grey-50 text-grey-700 border-grey-200"
                  >
                    Showing
                    {" "}{assignedClinics.filter((c) => c.isOwnClinic).length}{" "}
                    created by you
                  </Badge>
                )}
              </div>

              {assignedClinics.length > 0 && (
                <Input
                  type="text"
                  placeholder="Filter assigned clinics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              )}
            </div>

            {assignedClinics.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-md border border-dashed border-gray-300">
                <Building2 className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No clinics assigned yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add clinics to your assignments using the button above
                </p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="w-[25%]">Clinic Name</TableHead>
                      <TableHead className="w-[15%]">Clinic Code</TableHead>
                      <TableHead className="w-[20%]">Location</TableHead>
                      <TableHead className="w-[20%]">Partner</TableHead>
                      <TableHead className="w-[20%] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClinics
                      .filter((c) => isClinicAssigned(c.id))
                      .map((clinic) => (
                        <TableRow
                          key={clinic.id}
                          className={clinic.isOwnClinic ? "bg-grey-50" : ""}
                        >
                          <TableCell className="font-medium">
                            {clinic.name}
                            {clinic.isOwnClinic && (
                              <Badge
                                variant="outline"
                                className="ml-2 bg-grey-100 text-grey-800 border-grey-300"
                              >
                                Created by you
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium">
                              {clinic.clinicCode}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {clinic.district}, {clinic.state}
                          </TableCell>
                          <TableCell>{clinic.partnerName}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedClinic(clinic)}
                                className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                title="View Details"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeClinic(clinic.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                title="Remove from assignments"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                    {/* Show message when filtered results are empty */}
                    {filteredClinics.filter((c) => isClinicAssigned(c.id))
                      .length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-6 text-gray-500"
                        >
                          No assigned clinics match your search criteria
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {assignedClinics.length > 0 && (
              <Alert className="bg-grey-50 border-grey-200">
                <AlertDescription className="text-grey-800">
                  <span className="font-semibold">Assignment information:</span>{" "}
                  These clinics will be accessible to you and all doctors in
                  your doctor hierarchy. Removing a clinic will also remove it
                  from your assigned doctors.
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

      <CardFooter className="bg-gray-50 px-6 py-4 border-t">
        <div className="flex items-center justify-between w-full">
          <div className="text-sm text-gray-500">
            {assignedClinics.length > 0 ? (
              <span>
                You have <strong>{assignedClinics.length}</strong> clinic
                {assignedClinics.length !== 1 ? "s" : ""} assigned
              </span>
            ) : (
              <span>No clinics assigned yet</span>
            )}
          </div>

          <div className="flex gap-3">
            
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(true)}
              disabled={loading}
              className="flex gap-2 items-center border-grey-300 text-grey-700 hover:bg-grey-50"
            >
              <Plus className="h-4 w-4" />
              Add Clinics
            </Button>

            <Button
              onClick={saveAssignments}
              disabled={saving || loading}
              className="flex gap-2 items-center bg-purple-600 hover:bg-purple-700"
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
                  Save Clinic Assignments
                </>
              )}
            </Button>
          </div>
        </div>
      </CardFooter>
      {/* Case Detail Dialog */}
      {selectedClinic && (
        <Dialog 
          open={!!selectedClinic} 
          onOpenChange={(open) => {
            if (!open) setSelectedClinic(null);
          }}
        >
          <DialogContent 
            className="!max-w-4xl !w-[90vw] p-0 overflow-hidden"
          >
            <PharmacistHierarchyCard currentUser={currentUser} selectedClinic={selectedClinic}/>
          </DialogContent>
        </Dialog>
      )}
    </Card>

    
  );
};

export default ClinicHierarchyManagement;
