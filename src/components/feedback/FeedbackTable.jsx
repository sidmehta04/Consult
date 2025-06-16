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
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CommentBox from "./CommentBox";
import { set } from "date-fns";

const statusMapping = {
  "open": "Open",
  "in-progress": "In Progress",
  "resolved": "Resolved",
  "closed": "Closed",
}

const FeedbackTable = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

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
                <TableHead>Last Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>{ticket.subject}</TableCell>
                  <TableCell>{statusMapping[ticket.status] || ticket.status}</TableCell>
                  <TableCell>{new Date(ticket.createdAt.toDate()).toLocaleString()}</TableCell>
                  <TableCell>
                    {ticket.lastUpdatedAt ? (
                      new Date(ticket.lastUpdatedAt.toDate()).toLocaleString()
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>{ticket.comments[ticket.comments.length - 1].comment}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {selectedTicket && (
        <Dialog open={true} onOpenChange={(open) => setSelectedTicket(open ? selectedTicket : null)}>
          <DialogContent>
            
            <CommentBox ticketItem={selectedTicket} userType="nurse" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
  
}

export default FeedbackTable