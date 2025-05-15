// components/FilterBar.jsx
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

const FilterBar = ({ searchTerm, onSearchChange, onFilterReset, onSearchSubmit }) => {
  const [inputText, setInputText] = useState(searchTerm || "");
  
  // Handle input change without triggering search
  const handleInputChange = (value) => {
    setInputText(value);
  };
  
  // Handle search button click
  const handleSearchClick = () => {
    onSearchChange(inputText.trim());
    
    // If separate submission handler is provided, call it too
    if (onSearchSubmit) {
      onSearchSubmit(inputText.trim());
    }
  };
  
  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearchClick();
    }
  };
  
  // Handle reset of search field
  const handleClearSearch = () => {
    setInputText("");
    onSearchChange("");
  };

  return (
    <Card className="overflow-hidden mt-4">
      <div className="bg-gray-50 border-b p-2">
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="flex-grow flex flex-col">
            <div className="flex relative">
              <div className="relative flex-grow">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                <Input
                  placeholder="Enter exact EMR Number..."
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-8 h-9"
                />
                {inputText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={handleClearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button 
                variant="default" 
                size="sm" 
                className="ml-2 h-9" 
                onClick={handleSearchClick}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter the complete EMR number and click Search
            </p>
          </div>

          {/* Reset All Filters */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={onFilterReset}
          >
            <X className="h-4 w-4 mr-2" />
            Reset Filters
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default FilterBar;