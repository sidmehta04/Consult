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

  useEffect(() => {
    // Get all QAs for the user's state
    const qasForState = mappingQA[currentUser.state];
    
    if (qasForState && Array.isArray(qasForState) && qasForState.length > 0) {
      setAvailableQAs(qasForState);
    } else {
      // Fallback to default QA
      setAvailableQAs([defaultQA]);
    }
  }, [currentUser])
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission - create ONE ticket assigned to ALL QAs in the state
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description || selectedIssue === 'none' || !selectedSubIssue) {
      setError("Please fill out all required fields.");
      return;
    }

    try {
      // Create array of QA emails for the qaEmails field
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
        comments: [{'time': new Date(), 'comment': formData.description, 'side': 'nurse'}],
        // Store all QAs assigned to this ticket
        qaEmails: qaEmails, // Array of all QA emails
        qaNames: qaNames,   // Array of all QA names
        // Keep backward compatibility with single QA fields (using first QA)
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
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Submit a New Ticket</h2>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col space-y-2">
          <div className="text-gray-700 text-sm">
            Your ticket will be assigned to all QA team members in {currentUser.state}:
          </div>
          <div className="flex flex-wrap gap-2">
            {availableQAs.map((qa, index) => (
              <Badge 
                key={qa.emailQA}
                className="bg-sky-100 text-sky-800 text-sm border-sky-200 px-2 py-1 rounded-md"
              > 
                {qa.nameQA} ({qa.emailQA})
              </Badge>
            ))}
          </div>
          <div className="text-xs text-gray-500">
            {availableQAs.length} QA team member(s) will have access to this ticket
          </div>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Issue Category *
          </label>
          <Select value={selectedIssue} onValueChange={setSelectedIssue}>
            <SelectTrigger className="w-[600px]">
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
        <div>
          <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700">
            Issue Sub-Category *
          </label>
          <Select 
            value={selectedSubIssue} 
            onValueChange={setSelectedSubIssue}
            disabled={selectedIssue === 'none'}
          >
            <SelectTrigger className="w-[600px]">
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
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description *
          </label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Describe your issue in detail"
          />
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          Submit Ticket
        </Button>
      </form>
    </div>
  )
}

export default FeedbackForm