import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { firestore } from "../../firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertCircle, Send, Stethoscope } from "lucide-react";

import { 
  partnerQAMapping, 
  defaultQADoctor, 
  doctorCategories, 
  doctorSubcategories 
} from "./doctorMappings";

const DoctorFeedbackForm = ({ currentUser }) => {
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [availableQAs, setAvailableQAs] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState('none');
  const [selectedPartners, setSelectedPartners] = useState(currentUser.partnerName);
  const [selectedSubIssue, setSelectedSubIssue] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [emrNumber, setEMRNumber] = useState('');
  useEffect(() => {

    // Get QAs based on partner name
    const qasForPartner = partnerQAMapping[currentUser.partnerName];
    
    if (qasForPartner && Array.isArray(qasForPartner) && qasForPartner.length > 0) {
      setAvailableQAs(qasForPartner);
    } else {
      setAvailableQAs([defaultQADoctor]);
    }
  }, [currentUser])
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return;
    }

    if (emrerror) {
      return ;
    }

    if (!formData.description || selectedIssue === 'none' || !selectedSubIssue || !emrNumber) {
      setError("Please fill out all required fields.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const qaEmails = availableQAs.map(qa => qa.emailQA);
      const qaNames = availableQAs.map(qa => qa.nameQA);

      await addDoc(collection(firestore, "doctor_tickets"), {
        ...formData,
        userId: currentUser.uid,
        createdAt: new Date(),
        status: "open",
        issue: selectedIssue,
        subIssue: selectedSubIssue,
        partnerName: currentUser.partnerName,
        emrNumber: emrNumber,
        selectedPartner: selectedPartners,
        doctorName: currentUser.name,
        comments: [{'time': new Date(), 'comment': formData.description, 'side': 'doctor'}],
        qaEmails: qaEmails,
        qaNames: qaNames,
        qaEmail: qaEmails[0],
        qaName: qaNames[0],
        userType: 'doctor',
      });
      
      setFormData({ subject: "", description: "" });
      setSelectedIssue('none');
      setSelectedSubIssue(null);
      setError("");
      alert(`Ticket submitted successfully! Assigned to ${availableQAs.length} QA team member(s).`);
    } catch (error) {
      console.error("Error submitting doctor ticket:", error);
      setError("Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

   const filteredCategories = Object.keys(partnerQAMapping).filter((category) =>
    category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const [emrerror, setEmrError] = useState('');

  const handleChange = (e) => {
    const value = e.target.value;
    
    // Check if input is empty or contains only digits
    if (value === '' || /^[0-9]*$/.test(value)) {
      setEMRNumber(value);
      setEmrError('');
    } else {
      // Set error message
      setEmrError('Please enter numbers only');
    }
  };

  return (
    <div className="max-w-12xl mx-auto ">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Stethoscope className="w-6 h-6 text-blue-600" />
            Submit a Doctor Support Ticket
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Describe your issue and our QA team will assist you promptly
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* QA Assignment Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    QA Team Assignment for {currentUser.partnerName}
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {availableQAs.map((qa, index) => (
                      <Badge 
                        key={qa.emailQA}
                        variant="secondary"
                        className="bg-blue-100 text-blue-800 border-blue-300 px-3 py-1"
                      > 
                        {qa.nameQA}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-blue-700">
                    {availableQAs.length} QA team member{availableQAs.length > 1 ? 's' : ''} will have access to this ticket
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Doctor Information Display */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Stethoscope className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 mb-2">
                    Doctor Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                        <span className="font-medium text-green-800">Name:</span>
                        <span className="text-green-700 ml-2">{currentUser.name}</span>
                    </div>

                    <div className="space-y-2 flex items-center gap-4">
                      <span className="font-medium text-green-800 text-nowrap">Partner:</span>
                      <Select value={selectedPartners} 
                       onValueChange={(value) => {
                          setSelectedPartners(value);
                          setSearchTerm('');
                        }}
                       disabled={isSubmitting}>
                        <SelectTrigger className="w-full h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          <div className="px-1 py-2">
                            <input
                              type="text"
                              placeholder="Search..."
                              className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                          {filteredCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                          {filteredCategories.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                     <div className="w-full flex items-center space-y-1 gap-1">
                        <label className="font-medium text-green-800 block text-nowrap ">EMR Number:</label><span className="text-red-500">*</span>
                        <div className="w-full">
                        <input
                            type="text"
                            required
                            name="emrNumber"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Enter EMR Number (digits only)"
                            value={emrNumber}
                            onChange={handleChange}
                            className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                              emrerror 
                                ? 'border-red-500 focus:ring-red-500' 
                                : 'border-gray-300 focus:ring-blue-600 focus:border-blue-600'
                            }`}
                          />
                          {emrerror && (
                          <p className="text-sm text-red-600">{emrerror}</p>
                        )}
                        </div>
                      </div>

                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Issue Category */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                Issue Category
                <span className="text-red-500">*</span>
              </label>
              <Select value={selectedIssue} onValueChange={setSelectedIssue} disabled={isSubmitting}>
                <SelectTrigger className="w-full h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {doctorCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Issue Sub-Category */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                Issue Sub-Category
                <span className="text-red-500">*</span>
              </label>
              <Select 
                value={selectedSubIssue} 
                onValueChange={setSelectedSubIssue}
                disabled={selectedIssue === 'none' || isSubmitting}
              >
                <SelectTrigger className="w-full h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a sub-category" />
                </SelectTrigger>
                <SelectContent>
                  {selectedIssue !== 'none' && doctorSubcategories[selectedIssue]?.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                Description
                <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your issue in detail. Include any relevant information that might help our QA team understand and resolve the problem."
                disabled={isSubmitting}
                className="min-h-32 border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-lg transition-all duration-200"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting Ticket...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Submit Doctor Ticket
                  </div>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default DoctorFeedbackForm