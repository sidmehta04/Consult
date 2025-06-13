import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { firestore } from "../../firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

const FeedbackTable = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);

  // Fetch tickets for the current user
  useEffect(() => {
    if (currentUser) {
      const ticketsQuery = query(
        collection(firestore, "tickets"),
        where("userId", "==", currentUser.uid),
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
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Your Tickets</h2>
      {tickets.length === 0 ? (
        <p className="text-gray-500">No tickets found. Submit a new ticket to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>{ticket.subject}</TableCell>
                  <TableCell>{issueMapping[ticket.subject] || ticket.status}</TableCell>
                  <TableCell>{new Date(ticket.createdAt.toDate()).toLocaleString()}</TableCell>
                  <TableCell>
                    {ticket.lastUpdatedAt ? (
                      new Date(ticket.lastUpdatedAt.toDate()).toLocaleString()
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>{ticket.comments}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
  
}

export default FeedbackTable