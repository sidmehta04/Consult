import React, { useState, useEffect, use } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertCircle, Send } from "lucide-react";

import { mappingQA, defaultQA, categories, subcategories} from "./mappings";

const FeedbackForm = ({ currentUser }) => {
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [availableQAs, setAvailableQAs] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState('none');
  const [selectedSubIssue, setSelectedSubIssue] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const qasForState = mappingQA[currentUser.state];
    
    if (qasForState && Array.isArray(qasForState) && qasForState.length > 0) {
      setAvailableQAs(qasForState);
    } else {
      setAvailableQAs([defaultQA]);
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

    if (!formData.description || selectedIssue === 'none' || !selectedSubIssue) {
      setError("Please fill out all required fields.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const qaEmails = availableQAs.map(qa => qa.emailQA);
      const qaNames = availableQAs.map(qa => qa.nameQA);

      await addDoc(collection(firestore, "tickets"), {
        ...formData,
        userId: currentUser.uid,
        createdAt: new Date(),
        status: "open",
        issue: selectedIssue,
        subIssue: selectedSubIssue,
        state: currentUser.state,
        name: currentUser.name,
        clinicCode: currentUser.clinicCode,
        userType: 'nurse',
        comments: [{'time': new Date(), 'comment': formData.description, 'side': 'nurse'}],
        qaEmails: qaEmails,
        qaNames: qaNames,
        qaEmail: qaEmails[0],
        qaName: qaNames[0],
      });
      
      setFormData({ subject: "", description: "" });
      setSelectedIssue('none');
      setSelectedSubIssue(null);
      setError("");
      alert(`Ticket submitted successfully! Assigned to ${availableQAs.length} QA team member(s).`);
    } catch (error) {
      console.error("Error submitting ticket:", error);
      setError("Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-9xl mx-auto p-2">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Send className="w-6 h-6 text-blue-600" />
            Submit a New Ticket
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
                    QA Team Assignment for {currentUser.state}
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
                  {categories.map((category) => (
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
                  {selectedIssue !== 'none' && subcategories[selectedIssue]?.map((category) => (
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
                    Submit Ticket
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

export default FeedbackForm