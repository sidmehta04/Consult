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


// const mappingQA = {
//   'Bihar': { 'MSID': 'MS00769', 'nameQA': 'Yogesh Kumar', 'emailQA': 'mochakms00769@gmail.com' },
//   'Telangana': { 'MSID': 'MS00562', 'nameQA': 'Chakilam Avinash', 'emailQA': 'mochakms00562@gmail.com' },
//   'Andhra Pradesh': { 'MSID': 'MS00562', 'nameQA': 'Chakilam Avinash', 'emailQA': 'mochakms00562@gmail.com' },
//   'Assam': { 'MSID': 'MS01452', 'nameQA': 'Prasanjit Das', 'emailQA': 'mochakms01452@gmail.com' },
//   'Odisha': { 'MSID': 'MS01626', 'nameQA': 'Junaid Azhar', 'emailQA': 'mochakma0211@gmail.com' },
//   'Haryana': { 'MSID': 'MS01626', 'nameQA': 'Junaid Azhar', 'emailQA': 'mochakma0211@gmail.com' },
//   'Jharkhand': { 'MSID': 'MS01382', 'nameQA': 'Mehjabin Muzid', 'emailQA': 'mochakms01382@gmail.com' },
//   'West Bengal': { 'MSID': 'MS00313', 'nameQA': 'Nupur', 'emailQA': 'mochakms00313@gmail.com' },
//   'UP West': { 'MSID': 'MS00777', 'nameQA': 'Rajdeep Kour', 'emailQA': 'mochakms00777@gmail.com' },
//   'Rajasthan': { 'MSID': 'MS01029', 'nameQA': 'Samyojita Nair', 'emailQA': 'mochakms01029@gmail.com' },
//   'Karnataka': { 'MSID': 'MS01457', 'nameQA': 'Sneha Huddar', 'emailQA': 'mochakms01457@gmail.com' },
//   'Tamil Nadu': { 'MSID': 'MS01450', 'nameQA': 'Pooja Dharmendhra', 'emailQA': 'mochakms01450@gmail.com' },
//   'Kerala': { 'MSID': 'MS00568', 'nameQA': 'Dharshini', 'emailQA': 'mochakms00568@gmail.com' },
//   'UP East': { 'MSID': 'MS00522', 'nameQA': 'Sweta Kaur', 'emailQA': 'mochakms00522@gmail.com' },
//   'Maharashtra': { 'MSID': 'MS00777', 'nameQA': 'Rajdeep Kour', 'emailQA': 'mochakms00777@gmail.com' },
//   'Uttarakhand': { 'MSID': 'MS00014', 'nameQA': 'Yogesh Singh Panwar', 'emailQA': 'mochakma030@gmail.com' },
//   'Chhattisgarh': { 'MSID': 'MS01382', 'nameQA': 'Mehjabin Muzid', 'emailQA': 'mochakms01382@gmail.com' },
//   'Madhya Pradesh': { 'MSID': 'MS01382', 'nameQA': 'Mehjabin Muzid', 'emailQA': 'mochakms01382@gmail.com' },
//   'Gujarat': { 'MSID': 'MS00769', 'nameQA': 'Yogesh Kumar', 'emailQA': 'mochakms00769@gmail.com' },
//   'Punjab': { 'MSID': 'MS00522', 'nameQA': 'Sweta Kaur', 'emailQA': 'mochakms00522@gmail.com' },
//   'Himachal Pradesh': { 'MSID': 'MS00014', 'nameQA': 'Yogesh Singh Panwar', 'emailQA': 'mochakma030@gmail.com' },
// };
////NOTE: CHANGE DEFAULT QA
// const defaultQA = {
//   'MSID': 'MS00769',
//   'nameQA': 'Yogesh Kumar',
//   'emailQA': 'mochakms00769@gmail.com',
//   'isDefault': true
// };

const mappingQA = {}
const defaultQA = {
  'MSID': 'MS000001',
  'nameQA': 'Test QA',
  'emailQA': 'testqa@gmail.com',
  'isDefault': true
};

const FeedbackForm = ({ currentUser }) => {
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [qaDetails, setQaDetails] = useState(defaultQA);
  const [selectedIssue, setSelectedIssue] = useState(null);

  const categories =[
    {'value': '', 'label': ''},
  ]

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
    if (!formData.subject || !formData.description) {
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
        qaName: qaDetails.nameQA,
        qaEmail: qaDetails.emailQA,
        state: currentUser.state,
        name: currentUser.name,
        clinicCode: currentUser.clinicCode,
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
            <SelectItem value="online-team">Online Team (Agent/Pharmacist/TL) (ऑनलाइन टीम (एजेंट/फार्मासिस्ट/टी.एल)</SelectItem>
            <SelectItem value="offline-team">Offline Team (DC/Field ops manager) (ऑफलाइन टीम (डीसी/फील्ड ऑप्स मैनेजर)</SelectItem>
            <SelectItem value="sales-diagnostic-team">Sales & Diagnostic Team (Agent/TL) (सेल्स एवं डायग्नॉस्टिक टीम (एजेंट/टी.एल)</SelectItem>
            <SelectItem value="hr-team"> HR Team (Salary/Accounts/Zing) (एचआर टीम (वेतन/लेखा/जिंग)</SelectItem>
            <SelectItem value="branch-issues">Branch Issues (BM/RM) (शाखा संबंधित समस्याएं (बी.एम/आर.एम)</SelectItem>
            <SelectItem value="doctor">Doctor (डॉक्टर)</SelectItem>
            <SelectItem value="clinic-issues">Clinic issues (Instruments/Tab/Furniture) (क्लिनिक संबंधित समस्याएं (उपकरण/दवा/टैब/फर्नीचर)</SelectItem>
            <SelectItem value="medicine-issues">Medicine issues ( दवाइयों से संबंधित समस्याएँ)</SelectItem>
            <SelectItem value="sim-card-issues">Sim card issues (सिम कार्ड से जुड़ी समस्याएं)</SelectItem>
          </SelectContent>
        </Select>

        </div>
        <div>
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
        </div>
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