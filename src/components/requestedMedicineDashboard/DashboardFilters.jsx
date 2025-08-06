import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, X, AlertTriangle, CheckCircle, Truck, Package } from "lucide-react";

const DashboardFilters = ({ searchTerm, setSearchTerm, statusFilter, setStatusFilter }) => {
  const statusOptions = [
    { value: "all", label: "All Status", icon: Filter, color: "gray" },
    { value: "open", label: "Open", icon: AlertTriangle, color: "red" },
    { value: "approved", label: "Approved", icon: CheckCircle, color: "blue" },
    { value: "in-transit", label: "In Transit", icon: Truck, color: "yellow" },
    { value: "delivered", label: "Delivered", icon: Package, color: "green" },
  ];

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all";

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Simplified Search */}
      <div className="flex-1 min-w-64">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by clinic code, nurse name, or state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Simplified Status Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue>
            <span className="text-sm">{statusOptions.find(s => s.value === statusFilter)?.label}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="text-sm">{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={clearFilters}
          className="h-9 px-3 text-xs"
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
};

export default DashboardFilters;