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
  const [qaDetails, setQaDetails] = useState(defaultQA);
  const [selectedIssue, setSelectedIssue] = useState('none');
  const [selectedSubIssue, setSelectedSubIssue] = useState(null);

  useEffect(() => {
    const details = mappingQA[currentUser.state];
    if (details) setQaDetails(details);
    else setQaDetails(defaultQA);
  }, [currentUser])
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (/*!formData.subject || */!formData.description) {
      setError("Please fill out all fields.");
      return;
    }

    try {
      await addDoc(collection(firestore, "tickets"), {
        ...formData,
        userId: currentUser.uid,
        createdAt: new Date(),
        status: "open",
        issue: selectedIssue,
        subIssue: selectedSubIssue,
        qaName: qaDetails.nameQA,
        qaEmail: qaDetails.emailQA,
        state: currentUser.state,
        name: currentUser.name,
        clinicCode: currentUser.clinicCode,
        comments: [{'time': new Date(), 'comment': formData.description, 'side': 'nurse'}],
        //subject: formData.subject
      });
      setFormData({ subject: "", description: "" });
      setError("");
      alert("Ticket submitted successfully!");
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
        <div className="flex items-center">
          <div className="text-gray-700 text-sm">
            Your query will be submitted to:&nbsp;
          </div>
          <Badge className="bg-sky-100 text-sky-800 text-sm border-sky-200 px-2 py-1 rounded-md relative overflow-visible"> 
            {qaDetails.nameQA} ({qaDetails.emailQA}) 
          </Badge>
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Issue Category
          </label>
          <Select value={selectedIssue} onValueChange={setSelectedIssue}>
            <SelectTrigger className="w-[600px]">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Issue Sub-Category
          </label>
          <Select value={selectedSubIssue} onValueChange={setSelectedSubIssue}>
            <SelectTrigger className="w-[600px]">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {subcategories[selectedIssue].map((category) => (
                <SelectItem value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/*<div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
            Subject
          </label>
          <Input
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            placeholder="Enter ticket subject"
          />
        </div>*/}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Describe your issue"
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