import React from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Building2 } from "lucide-react";

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
          <Input
            type="text"
            required
            value={formData.state}
            onChange={(e) =>
              setFormData({ ...formData, state: e.target.value })
            }
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
      </div>
    </div>
  );
};

export default ClinicInfoForm;