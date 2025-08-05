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
} from "@/components/ui/dialog";
import {
  Building2,
  BadgeCheck,
  AlertCircle,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  PillBottle,
  BriefcaseMedical
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
import DoctorHierarchyCard from "./DoctorHierarchyCard";

const ClinicHierarchyManagement = ({ currentUser, userRole }) => {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [clinics, setClinics] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredClinics, setFilteredClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedClinicDr, setSelectedClinicDr] = useState(null)
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch all clinics in the system
  useEffect(() => {
    const fetchClinics = async () => {
      try {
        setLoading(true);

        // Fetch ALL clinics in the system (nurses with role "nurse")
        const clinicsQuery = query(
          collection(firestore, "users"),
          where("role", "==", "nurse")
        );

        const clinicsSnapshot = await getDocs(clinicsQuery);
        const clinicsList = [];

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
            assignedPharmacists: doc.data().assignedPharmacists || {},
            assignedDoctors: doc.data().assignedDoctors || {},
            createdAt: doc.data().createdAt
              ? new Date(
                  doc.data().createdAt.seconds * 1000
                ).toLocaleDateString()
              : "N/A",
            ...doc.data(),
          };

          // Only include non-deactivated clinics
          if (!clinicData.deactivated) {
            clinicsList.push(clinicData);
          }
        });

        // Sort clinics by name
        clinicsList.sort((a, b) => a.name.localeCompare(b.name));

        setClinics(clinicsList);
        setFilteredClinics(clinicsList);
      } catch (err) {
        console.error("Error fetching clinics:", err);
        setError("Failed to load clinics. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (userRole === "teamLeader") {
      fetchClinics();
    }
  }, [userRole]);

  // Filter clinics based on search term and filter type
  useEffect(() => {
    let filtered = [...clinics];

    // Apply filter type first
    if (filterType === "with_pharmacist") {
      filtered = filtered.filter((clinic) => 
        clinic.assignedPharmacists && 
        (clinic.assignedPharmacists.primary || Object.keys(clinic.assignedPharmacists).length > 0)
      );
    } else if (filterType === "without_pharmacist") {
      filtered = filtered.filter((clinic) => 
        !clinic.assignedPharmacists || 
        (!clinic.assignedPharmacists.primary && Object.keys(clinic.assignedPharmacists).length === 0)
      );
    } else if (filterType === "with_doctor") {
      filtered = filtered.filter((clinic) => 
        clinic.assignedDoctors && 
        (clinic.assignedDoctors.primary || Object.keys(clinic.assignedDoctors).length > 0)
      );
    } else if (filterType === "without_doctor") {
      filtered = filtered.filter((clinic) => 
        !clinic.assignedDoctors || 
        (!clinic.assignedDoctors.primary && Object.keys(clinic.assignedDoctors).length === 0)
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
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, clinics, filterType]);

  // Refresh clinic data after hierarchy changes
  const refreshClinicData = async () => {
    try {
      const clinicsQuery = query(
        collection(firestore, "users"),
        where("role", "==", "nurse")
      );

      const clinicsSnapshot = await getDocs(clinicsQuery);
      const updatedClinics = [];

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
          assignedPharmacists: doc.data().assignedPharmacists || {},
          createdAt: doc.data().createdAt
            ? new Date(
                doc.data().createdAt.seconds * 1000
              ).toLocaleDateString()
            : "N/A",
          ...doc.data(),
        };

        if (!clinicData.deactivated) {
          updatedClinics.push(clinicData);
        }
      });

      updatedClinics.sort((a, b) => a.name.localeCompare(b.name));
      setClinics(updatedClinics);
    } catch (err) {
      console.error("Error refreshing clinic data:", err);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredClinics.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClinics = filteredClinics.slice(startIndex, endIndex);

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  // Don't render for non-teamLeader users
  if (userRole !== "teamLeader") {
    return null;
  }

  return (
    <Card className="w-full max-w-8xl mx-auto bg-white shadow-xl">
      <CardHeader className="border-b bg-grey-50">
        <div className="flex items-center space-x-2">
          <Building2 className="h-6 w-6 text-purple-600" />
          <CardTitle className="text-2xl font-bold text-grey-700">
            Clinic Pharmacist & Doctor Hierarchy Management
          </CardTitle>
        </div>
        <CardDescription className="text-grey-700/70">
          Manage pharmacist and doctor hierarchies for all clinics in the system. 
          You can view and update the assigned pharmacists and doctors for each clinic.
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
                <SelectTrigger className="w-full md:w-[250px]">
                  <SelectValue placeholder="Filter clinics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clinics</SelectItem>
                  <SelectItem value="with_pharmacist">With Pharmacist Assigned</SelectItem>
                  <SelectItem value="without_pharmacist">Without Pharmacist</SelectItem>
                  <SelectItem value="with_doctor">With Doctor Assigned</SelectItem>
                  <SelectItem value="without_doctor">Without Doctor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-gray-500">
                  Total Clinics: {filteredClinics.length}
                </h4>
                {/*<Badge
                  variant="outline"
                  className="bg-grey-50 text-grey-700 border-grey-200"
                >
                  {clinics.filter(c => c.assignedPharmacists && 
                    (c.assignedPharmacists.primary || Object.keys(c.assignedPharmacists).length > 0)
                  ).length} with pharmacists assigned
                </Badge>*/}
              </div>
              
              {/* Pagination Info */}
              {filteredClinics.length > 0 && (
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredClinics.length)} of {filteredClinics.length}
                </div>
              )}
            </div>

            {filteredClinics.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-md border border-dashed border-gray-300">
                <Building2 className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No clinics found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try adjusting your search criteria
                </p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="w-[25%]">Nurse Name</TableHead>
                      <TableHead className="w-[10%]">Clinic Code</TableHead>
                      <TableHead className="w-[25%]">Location</TableHead>
                      <TableHead className="w-[15%]">Partner</TableHead>
                      <TableHead className="w-[10%]">Doctor Status</TableHead>
                      <TableHead className="w-[10%]">Pharma. Status</TableHead>
                      <TableHead className="w-[5%] text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentClinics.map((clinic) => {
                      const hasPharmacist = clinic.assignedPharmacists && 
                        (clinic.assignedPharmacists.primary || Object.keys(clinic.assignedPharmacists).length > 0);
                      const hasDoctor = clinic.assignedDoctors &&
                        (clinic.assignedDoctors.primary || Object.keys(clinic.assignedDoctors).length > 0);
                      
                      return (
                        <TableRow key={clinic.id}>
                          <TableCell className="font-medium">
                            {clinic.name}
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
                          <TableCell>
                            {hasDoctor ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                <BadgeCheck className="h-3 w-3 mr-1" />
                                Assigned
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                No Doctor
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasPharmacist ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                <BadgeCheck className="h-3 w-3 mr-1" />
                                Assigned
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                No Pharma.
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedClinic(clinic)}
                              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              title="Manage Pharmacist Hierarchy"
                            >
                              <PillBottle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedClinicDr(clinic)}
                              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              title="Manage Doctor Hierarchy"
                            >
                              <BriefcaseMedical className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Show message when no results on current page */}
                    {currentClinics.length === 0 && filteredClinics.length > 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-6 text-gray-500"
                        >
                          No clinics on this page
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredClinics.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
            <span>
              Managing <strong>{clinics.length}</strong> clinic
              {clinics.length !== 1 ? "s" : ""} in the system
              {filteredClinics.length > itemsPerPage && (
                <span> • Page {currentPage} of {totalPages}</span>
              )}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Click the settings icon to manage pharmacist hierarchies
          </div>
        </div>
      </CardFooter>

      {/* 
       Dialog */}
      {selectedClinic && (
        <Dialog 
          open={!!selectedClinic} 
          onOpenChange={(open) => {
            if (!open) {
              setSelectedClinic(null);
              // Refresh data when dialog closes to reflect any changes
              refreshClinicData();
            }
          }}
        >
          <DialogContent 
            className="!max-w-4xl !w-[90vw] p-0 overflow-hidden"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>
                Manage Pharmacist Hierarchy for {selectedClinic.name}
              </DialogTitle>
              <DialogDescription>
                Update pharmacist assignments and hierarchy for this clinic
              </DialogDescription>
            </DialogHeader>
            <PharmacistHierarchyCard 
              currentUser={currentUser} 
              selectedClinic={selectedClinic}
              userRole={userRole}
              onUpdate={refreshClinicData}
            />
          </DialogContent>
        </Dialog>
      )}
      {/* Doctor Hierarchy Management Dialog */}
      {selectedClinicDr && (
        <Dialog 
          open={!!selectedClinicDr} 
          onOpenChange={(open) => {
            if (!open) {
              setSelectedClinicDr(null);
              // Refresh data when dialog closes to reflect any changes
              refreshClinicData();
            }
          }}
        >
          <DialogContent 
            className="!max-w-4xl !w-[90vw] p-0 overflow-hidden"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>
                Manage Doctor Hierarchy for {selectedClinicDr.name}
              </DialogTitle>
              <DialogDescription>
                Update doctor assignments and hierarchy for this clinic
              </DialogDescription>
            </DialogHeader>
            <DoctorHierarchyCard 
              currentUser={currentUser} 
              selectedClinic={selectedClinicDr}
              userRole={userRole}
              onUpdate={refreshClinicData}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default ClinicHierarchyManagement;