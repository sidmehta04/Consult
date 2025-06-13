import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Users,
  CheckSquare,
  Zap,
} from "lucide-react";

const CaseTransferHeader = ({
  filteredCasesCount,
  totalCasesCount,
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
  // New props for bulk functionality
  bulkModeActive = false,
  selectedCount = 0,
  transferableCasesCount = 0,
}) => {
  return (
    <Card className="border border-gray-200">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <CardTitle className="text-xl flex items-center">
          <ArrowRightLeft className="h-5 w-5 text-blue-600 mr-2" />
          Case Transfer Management
          <div className="ml-2 flex items-center space-x-2">
            <span className="text-sm font-normal text-gray-600">
              ({filteredCasesCount} pending cases)
            </span>
            
            {/* NEW: Bulk Mode Indicator */}
            {bulkModeActive && (
              <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
                <CheckSquare className="h-3 w-3 mr-1" />
                Bulk Mode
              </Badge>
            )}
            
            {/* NEW: Selection Counter */}
            {bulkModeActive && selectedCount > 0 && (
              <Badge variant="default" className="bg-blue-600 text-white">
                <Users className="h-3 w-3 mr-1" />
                {selectedCount} selected
              </Badge>
            )}
          </div>
          
          <div className="ml-auto flex items-center space-x-3">
            {/* NEW: Quick Stats for Bulk Mode */}
            {bulkModeActive && (
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <div className="flex items-center">
                  <Zap className="h-3 w-3 text-green-500 mr-1" />
                  <span>{transferableCasesCount} transferable</span>
                </div>
              </div>
            )}
            
            <div className="flex items-center">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-xs text-green-600 font-medium">Live Updates</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Error and Success Messages */}
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

        {/* NEW: Bulk Mode Instructions */}
        {bulkModeActive && (
          <Alert className="mb-4 border-purple-200 bg-purple-50">
            <CheckSquare className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              <strong>Bulk Transfer Mode Active:</strong> Select multiple cases from the doctor queue to transfer them all at once. 
              Only cases currently in the doctor queue can be transferred.
              {selectedCount > 0 && (
                <span className="block mt-1">
                  <strong>{selectedCount}</strong> cases selected for bulk transfer.
                </span>
              )}
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
                <SelectItem value="doctor">
                  Doctor Queue
                  {bulkModeActive && (
                    <span className="ml-2 text-xs text-blue-600">(Transferable)</span>
                  )}
                </SelectItem>
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

        {/* Enhanced Real-time Status Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm text-gray-600">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span>
                Real-time updates enabled - Cases will automatically appear/disappear as they move between queues
              </span>
            </div>
            
            {/* NEW: Enhanced Statistics */}
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <span>Total:</span>
                <Badge variant="outline" className="text-xs">
                  {totalCasesCount || filteredCasesCount}
                </Badge>
              </div>
              
              {bulkModeActive && (
                <>
                  <div className="flex items-center space-x-1">
                    <span>Transferable:</span>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                      <Zap className="h-2 w-2 mr-1" />
                      {transferableCasesCount}
                    </Badge>
                  </div>
                  
                  {selectedCount > 0 && (
                    <div className="flex items-center space-x-1">
                      <span>Selected:</span>
                      <Badge variant="default" className="text-xs bg-blue-600 text-white">
                        <Users className="h-2 w-2 mr-1" />
                        {selectedCount}
                      </Badge>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* NEW: Filter Summary for Bulk Mode */}
          {bulkModeActive && (selectedQueue !== "all" || searchTerm) && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center text-xs text-gray-600">
                <span className="mr-2">Active filters:</span>
                {selectedQueue !== "all" && (
                  <Badge variant="outline" className="mr-2 text-xs">
                    Queue: {selectedQueue}
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant="outline" className="mr-2 text-xs">
                    Search: "{searchTerm}"
                  </Badge>
                )}
                <span className="text-amber-600">
                  • Bulk selection limited to filtered results
                </span>
              </div>
            </div>
          )}
        </div>

        {/* NEW: Bulk Transfer Tips */}
        {bulkModeActive && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-2 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Bulk Transfer Tips
              </div>
              <ul className="text-xs space-y-1 ml-6 list-disc">
                <li>All transfer history will be preserved for each case</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CaseTransferHeader;