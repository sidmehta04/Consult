import React from "react";
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
  UserPlus,
  BadgeCheck,
  AlertCircle,
  PlusCircle,
} from "lucide-react";
import { useUserCreation } from "./userfuncs";
import BasicInfoForm from "./BasicInfo";
import ClinicInfoForm from "./ClinicForm";

const UserCreationForm = ({ currentUserRole, currentUser }) => {
  const {
    formData,
    error,
    success,
    loading,
    handleSubmit,
    setFormData,
    selectedRoleToCreate,
    setSelectedRoleToCreate,
    roleToCreate,
    needsToCreatePharmacistFirst,
    isCreatingPharmacist,
    isCreatingClinic,
    isCreatingDoctor,
    isCreatingAgent,
    availablePharmacists,
  } = useUserCreation(currentUserRole, currentUser);

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white shadow-xl">
      <CardHeader className="space-y-1 pb-6">
        <div className="flex items-center space-x-2">
          <UserPlus className="h-6 w-6 text-blue-500" />
          <CardTitle className="text-2xl font-bold">
            Create New{" "}
            {Array.isArray(roleToCreate) ? (
              <Select
                value={selectedRoleToCreate}
                onValueChange={setSelectedRoleToCreate}
              >
                <SelectTrigger className="w-[180px] inline-flex ml-2 text-xl">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleToCreate.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              selectedRoleToCreate.charAt(0).toUpperCase() +
              selectedRoleToCreate.slice(1)
            )}
          </CardTitle>
        </div>
        <CardDescription>
          Enter the details to create a new {selectedRoleToCreate} account in
          the system
        </CardDescription>
      </CardHeader>

      {needsToCreatePharmacistFirst && (
        <Alert className="mx-6 mb-4 bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-700">
            You need to create a pharmacist first before you can create clinics.
            After creating a pharmacist, you can then create clinics (nurse
            role) which will be automatically assigned to both you and your
            pharmacist.
          </AlertDescription>
        </Alert>
      )}

      {currentUserRole === "ro" && selectedRoleToCreate === "agent" && (
        <Alert className="mx-6 mb-4 bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800">
            As an RO, you create agents who will create their pharmacists and
            then clinics.
          </AlertDescription>
        </Alert>
      )}

      {currentUserRole === "agent" &&
        isCreatingClinic &&
        availablePharmacists.length > 0 && (
          <Alert className="mx-6 mb-4 bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-800">
              This clinic will be automatically assigned to you, your
              pharmacist(s), and your doctor hierarchy.
            </AlertDescription>
          </Alert>
        )}

      <CardContent>
        <form
          id="userCreationForm"
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          <BasicInfoForm 
            formData={formData}
            setFormData={setFormData}
            isCreatingClinic={isCreatingClinic}
            isCreatingDoctor={isCreatingDoctor}
            isCreatingPharmacist={isCreatingPharmacist}
            currentUserRole={currentUserRole}
          />

          {isCreatingClinic && (
            <ClinicInfoForm 
              formData={formData} 
              setFormData={setFormData} 
            />
          )}

          {error && (
            <Alert variant="destructive">
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
        </form>
      </CardContent>

      <CardFooter className="bg-gray-50 px-6 py-4 flex gap-4">
        <Button
          type="submit"
          form="userCreationForm"
          disabled={
            loading || (needsToCreatePharmacistFirst && !isCreatingPharmacist)
          }
          className="flex-1"
          variant="default"
        >
          {loading ? (
            <div className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
              Creating...
            </div>
          ) : (
            `Create ${selectedRoleToCreate}`
          )}
        </Button>

        {needsToCreatePharmacistFirst && !isCreatingPharmacist && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setSelectedRoleToCreate("pharmacist")}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Pharmacist First
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default UserCreationForm;