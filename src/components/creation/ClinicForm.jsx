import React from "react";
import Select from "react-select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";


//NOTE: UP has been turned into Uttar Pradesh East and West, but some clinics just have Uttar Pradesh so keeping as legacy
//NOTE: Some clinics had 'NA-Agent', so giving option for that

//NOTE: for reference, currently existing entries in db:

// Uttar Pradesh West
// NA-Agent
// Karnataka
// Himachal Pradesh
// Chhattisgarh
// Uttarakhand
// Haryana
// Delhi
// Madhya Pradesh
// Tamil Nadu
// Assam
// Rajasthan
// Maharashtra
// Kerala
// Bihar
// Uttar Pradesh
// Odisha
// Uttar Pradesh East
// Punjab
// West Bengal
// Andhra Pradesh
// Telangana
// Jharkhand
// Gujarat

const stateOptions = [
  { value: "Andhra Pradesh", label: "Andhra Pradesh" },
  { value: "Arunachal Pradesh", label: "Arunachal Pradesh" },
  { value: "Assam", label: "Assam" },
  { value: "Bihar", label: "Bihar" },
  { value: "Chhattisgarh", label: "Chhattisgarh" },
  { value: "Goa", label: "Goa" },
  { value: "Gujarat", label: "Gujarat" },
  { value: "Haryana", label: "Haryana" },
  { value: "Himachal Pradesh", label: "Himachal Pradesh" },
  { value: "Jharkhand", label: "Jharkhand" },
  { value: "Karnataka", label: "Karnataka" },
  { value: "Kerala", label: "Kerala" },
  { value: "Madhya Pradesh", label: "Madhya Pradesh" },
  { value: "Maharashtra", label: "Maharashtra" },
  { value: "Manipur", label: "Manipur" },
  { value: "Meghalaya", label: "Meghalaya" },
  { value: "Mizoram", label: "Mizoram" },
  { value: "Nagaland", label: "Nagaland" },
  { value: "Odisha", label: "Odisha" },
  { value: "Punjab", label: "Punjab" },
  { value: "Rajasthan", label: "Rajasthan" },
  { value: "Sikkim", label: "Sikkim" },
  { value: "Tamil Nadu", label: "Tamil Nadu" },
  { value: "Telangana", label: "Telangana" },
  { value: "Tripura", label: "Tripura" },
  { value: "Uttar Pradesh East", label: "Uttar Pradesh East" },
  { value: "Uttar Pradesh West", label: "Uttar Pradesh West" },
  { value: "Uttar Pradesh", label: "Uttar Pradesh" },
  { value: "Uttarakhand", label: "Uttarakhand" },
  { value: "West Bengal", label: "West Bengal" },
  { value: "Andaman and Nicobar Islands", label: "Andaman and Nicobar Islands" },
  { value: "Chandigarh", label: "Chandigarh" },
  { value: "Dadra and Nagar Haveli and Daman and Diu", label: "Dadra and Nagar Haveli and Daman and Diu" },
  { value: "Delhi", label: "Delhi" },
  { value: "Jammu and Kashmir", label: "Jammu and Kashmir" },
  { value: "Ladakh", label: "Ladakh" },
  { value: "Lakshadweep", label: "Lakshadweep" },
  { value: "Puducherry", label: "Puducherry" },
  { value: "NA-Agent", label: "NA-Agent" },
];

const ClinicInfoForm = ({ formData, setFormData }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Building2 className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold">Clinic Information</h3>
      </div>
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">State</label>
          <Select
            options={stateOptions}
            value={stateOptions.find((option) => option.value === formData.state)}
            onChange={(selectedOption) =>
              setFormData({ ...formData, state: selectedOption.value })
            }
            placeholder="Select a state"
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">District</label>
          <Input
            type="text"
            required
            value={formData.district}
            onChange={(e) =>
              setFormData({ ...formData, district: e.target.value })
            }
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="text-sm font-medium text-gray-700">Address</label>
          <textarea
            required
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Pincode</label>
          <Input
            type="text"
            required
            pattern="[0-9]{6}"
            value={formData.pincode}
            onChange={(e) =>
              setFormData({ ...formData, pincode: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Clinic Mobile Number</label>
          <Input
            type="tel"
            required
            pattern="[0-9]{10}"
            value={formData.clinicMobileNo}
            onChange={(e) =>
              setFormData({
                ...formData,
                clinicMobileNo: e.target.value,
              })
            }
            placeholder="10-digit mobile number"
          />
        </div>

        <div className="md:col-span-2">
          <Alert className="bg-blue-50 border-blue-200">
            <InfoIcon className="h-4 w-4 text-blue-500 mr-2" />
            <AlertDescription className="text-blue-800">
              After creating this clinic, you can manage its assignments and hierarchy using the Clinic Management tab.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
};

export default ClinicInfoForm;