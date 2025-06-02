import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ArrowRightLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const CaseTransferHeader = ({
  filteredCasesCount,
  error,
  success,
  searchTerm,
  setSearchTerm,
  selectedQueue,
  setSelectedQueue,
  selectedClinic,
  setSelectedClinic,
  clinics,
  onRefresh,
}) => {
  return (
    <Card className="border border-gray-200">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <CardTitle className="text-xl flex items-center">
          <ArrowRightLeft className="h-5 w-5 text-blue-600 mr-2" />
          Case Transfer Management
          <span className="ml-2 text-sm font-normal text-gray-600">
            ({filteredCasesCount} pending cases)
          </span>
          <div className="ml-auto flex items-center">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
            <span className="text-xs text-green-600 font-medium">Live Updates</span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Label
              htmlFor="search"
              className="text-sm font-medium mb-2 block"
            >
              Search Cases
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by patient name or EMR number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-full sm:w-48">
            <Label htmlFor="queue" className="text-sm font-medium mb-2 block">
              Filter by Queue
            </Label>
            <Select value={selectedQueue} onValueChange={setSelectedQueue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Queues</SelectItem>
                <SelectItem value="doctor">Doctor Queue</SelectItem>
                <SelectItem value="pharmacist">Pharmacist Queue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={onRefresh}
              variant="outline"
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        
        {/* Real-time Status Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center text-sm text-gray-600">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
            <span>
              Real-time updates enabled - Cases will automatically appear/disappear as they move between queues
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CaseTransferHeader;