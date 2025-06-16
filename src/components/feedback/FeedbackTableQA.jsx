import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { firestore } from "../../firebase";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CommentBox from "./CommentBox";

const issueMapping = {
  "online-team": "Online Team (Agent/Pharmacist/TL)",
  "offline-team": "Offline Team (DC/Field ops manager)",
  "sales-diagnostic-team": "Sales & Diagnostic Team (Agent/TL)",
  "hr-team": "HR Team (Salary/Accounts/Zing)",
  "branch-issues": "Branch Issues (BM/RM)",
  "doctor": "Doctor",
  "clinic-issues": "Clinic issues (Instruments/Tab/Furniture)", 
  "medicine-issues": "Medicine issues",
  "sim-card-issues": "Sim card issues"
}

const FeedbackTableQA = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const ticketRef = doc(firestore, "tickets", ticketId);
      const updateTime = new Date();
      await setDoc(ticketRef, { status: newStatus, lastUpdatedAt: updateTime }, { merge: true });
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Fetch tickets for the current user
  useEffect(() => {
    console.log(currentUser.email)
    if (currentUser) {
      const ticketsQuery = query(
        collection(firestore, "tickets"),
        where("qaEmail", "==", currentUser.email),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
        const fetchedTickets = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTickets(fetchedTickets);
      });

      return () => unsubscribe();
    }
  }, [currentUser]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Feedback Portal</h1>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Tickets Assigned to You</h2>
      {tickets.length === 0 ? (
        <p className="text-gray-500">No tickets found. Submit a new ticket to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic Name</TableHead>
                <TableHead>Issue Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Last Updated At</TableHead>
                <TableHead>Last Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => {
                const lastComment = ticket.comments[ticket.comments.length - 1];
                let lastCommentStr = lastComment.side === 'nurse' ? 'Nurse: ' : 'QA: '
                lastCommentStr += lastComment.comment
                lastCommentStr = lastCommentStr.length > 50 ? lastCommentStr.slice(0, 50) + '...' : lastCommentStr
                
                return (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.name} | {ticket.clinicCode}</TableCell>
                    <TableCell>{issueMapping[ticket.issue] || ticket.status}</TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>
                      <Select
                        value={ticket.status}
                        onValueChange={(newStatus) => handleStatusChange(ticket.id, newStatus)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{new Date(ticket.createdAt.toDate()).toLocaleString()}</TableCell>
                    <TableCell>
                      {ticket.lastUpdatedAt ? (
                        new Date(ticket.lastUpdatedAt.toDate()).toLocaleString()
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {lastCommentStr}
                    </TableCell>
                    <TableCell>
                      <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <Plus className="w-2 h-2"/>
                        </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {selectedTicket && (
        <Dialog 
          className = "p-0"
          open={true} 
          onOpenChange={(open) => setSelectedTicket(open ? selectedTicket : null)}>
          <DialogContent className="p-0">
            <CommentBox ticketItem={selectedTicket} userType="qa" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
  
}

export default FeedbackTableQA