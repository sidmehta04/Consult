import React from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCircle, Video, Pill } from "lucide-react";
import { generateMeetingLink } from "../../utils/roomSystemSetup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BasicInfoForm = ({
  formData,
  setFormData,
  isCreatingClinic,
  isCreatingDoctor,
  isCreatingPharmacist,
  currentUserRole,
}) => {
  // List of partner names
  const partnerNames = [
    "Namra",
    "Muthoot South",
    "Muthoot North",
    "Nabfins",
    "Pahal North",
    "Pahal South",
    "ACFL",
    "TATA North",
    "TATA South",
    "Humana",
    "NESFB",
    "Uttrayan",
    "Bangia",
    "Share India",
    "Seba",
    "Cashpor Unit 1",
    "Cashpor Unit 2",
    "Satya Foundation",
    "Utkarsh",
    "Utkarsh foundation",
    "Svatantra",
    "ESAF South",
    "ESAF North",
    "UKBGB",
    "UBGB",
    "PBGB",
    "Navchetna South",
    "PAFT South",
    "Sugamya South",
    "Swarnodhayam South",
    "Satya North",
    "Satya South",
    "Projects",
    "Digital/Night Team",
    "AVGB"
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <UserCircle className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold">Basic Information</h3>
      </div>
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Name</label>
          <Input
            type="text"
            required
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <Input
            type="email"
            required
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            {isCreatingClinic ? "Clinic Code" : "Employee ID"}
          </label>
          <Input
            type="text"
            required
            value={formData.idCode}
            onChange={(e) =>
              setFormData({ ...formData, idCode: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Password</label>
          <div className="relative">
            <Input
              type="text"
              readOnly
              className="bg-gray-50"
              value={formData.password}
            />
            <Badge className="absolute right-2 top-2 bg-blue-100 text-blue-800">
              Auto-generated
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Partner Name</label>
          <Select
            value={formData.partnerName || ""}
            onValueChange={(value) =>
              setFormData({ ...formData, partnerName: value })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select partner" />
            </SelectTrigger>
            <SelectContent>
              {partnerNames.map((partner) => (
                <SelectItem key={partner} value={partner}>
                  {partner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Information about clinic doctor assignment for clinics created by pharmacists */}
        {isCreatingClinic && currentUserRole === "pharmacist" && (
          <div className="md:col-span-2">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800">
                This clinic will be automatically assigned to your configured doctor hierarchy.
                You can manage your doctor assignments from the Doctor Hierarchy tab.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Room System Integration Fields */}
        {(isCreatingDoctor || isCreatingPharmacist) && (
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2 pt-4">
              <Video className="h-5 w-5 text-blue-500" />
              <h4 className="text-md font-semibold text-blue-700">Room System Configuration</h4>
            </div>
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {isCreatingDoctor ? 'Specialization' : 'Pharmacy Specialization'}
                </label>
                <Input
                  type="text"
                  value={formData.specialization || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, specialization: e.target.value })
                  }
                  placeholder={isCreatingDoctor ? 'e.g., Cardiology' : 'e.g., Clinical Pharmacy'}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Meeting Room Link
                </label>
                <div className="flex space-x-2">
                  <Input
                    type="url"
                    value={formData.meetingLink || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, meetingLink: e.target.value })
                    }
                    placeholder="https://meet.google.com/..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const generatedLink = generateMeetingLink(formData.employeeId || Math.random().toString(36).substring(2, 11));
                      setFormData({ ...formData, meetingLink: generatedLink });
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Generate
                  </button>
                </div>
              </div>

              {isCreatingPharmacist && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Assign to Doctor
                  </label>
                  <Select
                    value={formData.assignedDoctorId || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, assignedDoctorId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a doctor (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No assignment</SelectItem>
                      {/* TODO: Add dynamic doctor list */}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Video className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                {isCreatingDoctor ? (
                  <>The meeting link will be used for consultation rooms. Pharmacists can be assigned to this doctor later via the Room System.</>
                ) : (
                  <>This pharmacist can be assigned to doctors and will have their own consultation room for medication discussions.</>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
};

export default BasicInfoForm;