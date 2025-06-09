// components/TableHeader.jsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const TableHeader = ({
  activeColumnFilter,
  setActiveColumnFilter,
  clinicFilter,
  partnerFilter,
  doctorFilter,
  dateRange,
  clinicOptions,
  doctorOptions,
  partnerOptions,
  handleFilterApply,
  handleSingleFilterReset,
}) => {
  const [doctorSearchQuery, setDoctorSearchQuery] = useState("");
  const [filteredDoctorOptions, setFilteredDoctorOptions] = useState(doctorOptions);

  // Update filteredDoctorOptions whenever doctorSearchQuery or doctorOptions changes
  useEffect(() => {
    setFilteredDoctorOptions(
      doctorOptions.filter((option) =>
        option.label.toLowerCase().includes(doctorSearchQuery.toLowerCase())
      )
    );
  }, [doctorSearchQuery, doctorOptions]);


  return (
    <tr className="bg-gray-50 border-b">
      {/* Clinic Code Column with Filter */}
      <th className="p-3 text-left font-medium min-w-[140px]">
        <div className="flex items-center justify-between gap-1">
          <span>Clinic Code</span>
          <Popover
            open={activeColumnFilter === "clinic"}
            onOpenChange={(open) =>
              setActiveColumnFilter(open ? "clinic" : null)
            }
          >
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Filter
                  className={`h-3.5 w-3.5 ${
                    clinicFilter !== "all" ? "text-blue-500" : ""
                  }`}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Filter by Clinic</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleSingleFilterReset("clinic")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <RadioGroup
                    value={clinicFilter}
                    onValueChange={(value) =>
                      handleFilterApply("clinic", value)
                    }
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="all" id="clinic-all" />
                      <Label htmlFor="clinic-all">All Clinics</Label>
                    </div>
                    {clinicOptions.map((option) => (
                      <div
                        key={option.value}
                        className="flex items-center space-x-2 mb-2"
                      >
                        <RadioGroupItem
                          value={option.value}
                          id={`clinic-${option.value}`}
                        />
                        <Label htmlFor={`clinic-${option.value}`}>
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </th>

      {/* Partner Column with Filter */}
      <th className="p-3 text-left font-medium min-w-[100px]">
        <div className="flex items-center justify-between gap-1">
          <span>Partner</span>
          <Popover
            open={activeColumnFilter === "partner"}
            onOpenChange={(open) => {
              setActiveColumnFilter(open ? "partner" : null)
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Filter
                  className={`h-3.5 w-3.5 ${
                    partnerFilter.length > 0 ? "text-blue-500" : ""
                  }`}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Filter by Partner</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleSingleFilterReset("partner")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {partnerOptions.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2 mb-2"
                    >
                      <input
                        type="checkbox"
                        id={`partner-${option.value}`}
                        checked={partnerFilter.includes(option.value)}
                        onChange={(e) => {
                          const updatedFilter = e.target.checked
                            ? [...partnerFilter, option.value]
                            : partnerFilter.filter((item) => item !== option.value);
                          handleFilterApply("partner", updatedFilter);
                        }}
                      />
                      <Label htmlFor={`partner-${option.value}`}>
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </th>

      <th className="p-3 text-left font-medium min-w-[140px]">
        <div className="flex items-center justify-between gap-1">
          <span>Doctor</span>
          <Popover
            open={activeColumnFilter === "doctor"}
            onOpenChange={(open) =>
              setActiveColumnFilter(open ? "doctor" : null)
            }
          >
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Filter
                  className={`h-3.5 w-3.5 ${
                    doctorFilter !== "all" ? "text-blue-500" : ""
                  }`}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Filter by Doctor Name</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleSingleFilterReset("doctor")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Search doctors..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto">
                    <RadioGroup
                      value={doctorFilter}
                      onValueChange={(value) => handleFilterApply("doctor", value)}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <RadioGroupItem value="all" id="clinic-all" />
                        <Label htmlFor="clinic-all">All Doctors</Label>
                      </div>
                      {filteredDoctorOptions.map((option) => (
                        <div
                          key={option.value}
                          className="flex items-center space-x-2 mb-2"
                        >
                          <RadioGroupItem
                            value={option.value}
                            id={`clinic-${option.value}`}
                          />
                          <Label htmlFor={`clinic-${option.value}`}>
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </div>
            </PopoverContent>
            {/*
            <PopoverContent className="w-60 p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Filter by Doctor Name</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleSingleFilterReset("doctor")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <RadioGroup
                    value={doctorFilter}
                    onValueChange={(value) =>
                      handleFilterApply("doctor", value)
                    }
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="all" id="clinic-all" />
                      <Label htmlFor="clinic-all">All Doctors</Label>
                    </div>
                    {doctorOptions.map((option) => (
                      <div
                        key={option.value}
                        className="flex items-center space-x-2 mb-2"
                      >
                        <RadioGroupItem
                          value={option.value}
                          id={`clinic-${option.value}`}
                        />
                        <Label htmlFor={`clinic-${option.value}`}>
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </PopoverContent>
            */}
          </Popover>
        </div>
      </th>

      {/*
      <th className="p-3 text-left font-medium min-w-[160px]">
        <div className="flex items-center justify-between gap-1">
          <span>Doctor</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 invisible">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
      </th>
      */}
      {/*
      <th className="p-3 text-left font-medium min-w-[220px]">
        <div className="flex items-center justify-between gap-1">
          <span>Doctor Joined At</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 invisible">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
      </th>

      <th className="p-3 text-left font-medium min-w-[220px]">
        <div className="flex items-center justify-between gap-1">
          <span>Doctor Completed At</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 invisible">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
      </th>

      <th className="p-3 text-left font-medium min-w-[220px]">
        <div className="flex items-center justify-between gap-1">
          <span>Pharma. Joined At</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 invisible">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
      </th>

      <th className="p-3 text-left font-medium min-w-[220px]">
        <div className="flex items-center justify-between gap-1">
          <span>Pharma. Completed At</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 invisible">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
      </th>
      */}
      {/* Doctor TAT Column */}
      <th className="p-3 text-left font-medium min-w-[140px]">
        <div className="flex items-center justify-between gap-1">
          <span>Doctor Joined Time</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 invisible">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
      </th>
      
      {/* Doctor TAT Column */}
      <th className="p-3 text-left font-medium min-w-[140px]">
        <div className="flex items-center justify-between gap-1">
          <span>Doctor TAT</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 invisible">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
      </th>

      {/* Overall TAT Column */}
      <th className="p-3 text-left font-medium min-w-[140px]">
        <div className="flex items-center justify-between gap-1">
          <span>Overall TAT</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 invisible">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
      </th>

      {/* Date Column with Filter */}
      <th className="p-3 text-left font-medium min-w-[140px]">
        <div className="flex items-center justify-between gap-1">
          <span>Created</span>
          <Popover
            open={activeColumnFilter === "date"}
            onOpenChange={(open) =>
              setActiveColumnFilter(open ? "date" : null)
            }
          >
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Filter
                  className={`h-3.5 w-3.5 ${
                    dateRange.from || dateRange.to ? "text-blue-500" : ""
                  }`}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Filter by Date</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleSingleFilterReset("date")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label
                      htmlFor="date-from"
                      className="text-xs mb-1 block"
                    >
                      From
                    </Label>
                    <input
                      id="date-from"
                      type="date"
                      value={
                        dateRange.from
                          ? dateRange.from.toISOString().substring(0, 10)
                          : ""
                      }
                      onChange={(e) => {
                        const date = e.target.value
                          ? new Date(e.target.value)
                          : null;
                        handleFilterApply("date", {
                          ...dateRange,
                          from: date,
                        });
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="date-to"
                      className="text-xs mb-1 block"
                    >
                      To
                    </Label>
                    <input
                      id="date-to"
                      type="date"
                      value={
                        dateRange.to
                          ? dateRange.to.toISOString().substring(0, 10)
                          : ""
                      }
                      onChange={(e) => {
                        const date = e.target.value
                          ? new Date(e.target.value)
                          : null;
                        handleFilterApply("date", {
                          ...dateRange,
                          to: date,
                        });
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </th>

      <th className="p-3 text-center font-medium min-w-[40px]">Meeting</th>             

      <th className="p-3 text-left font-medium min-w-[40px]">Actions</th>
    </tr>
  );
};

export default TableHeader;