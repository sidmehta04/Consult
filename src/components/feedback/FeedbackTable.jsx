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

import { categories, subcategories } from "./mappings";

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
    console.log("Fetching tickets for user UID:", currentUser.uid);
    console.log("User email:", currentUser.email);
    if (currentUser) {
      const ticketsQuery = query(
        collection(firestore, "tickets"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
        console.log("Tickets snapshot received:", snapshot.docs.length);
        const fetchedTickets = snapshot.docs.map((doc) => {
          const data = doc.data();
          console.log("Ticket data:", {
            id: doc.id,
            userId: data.userId,
            userIdMatches: data.userId === currentUser.uid,
            issue: data.issue,
            subIssue: data.subIssue,
            status: data.status,
            qaEmails: data.qaEmails
          });
          return {
            id: doc.id,
            ...data,
          };
        });

        //set closed tickets last
        fetchedTickets.sort((a, b) => {
          if (a.status === "closed" && b.status !== "closed") return 1;
          if (a.status !== "closed" && b.status === "closed") return -1;
          return 0;
        });

        console.log("Final tickets for nurse:", fetchedTickets);
        setTickets(fetchedTickets);
      });

      return () => unsubscribe();
    }
  }, [currentUser]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Your Tickets</h2>
      <div className="text-sm text-gray-500 mb-2">
        Found {tickets.length} tickets for user: {currentUser.uid}
      </div>
      {tickets.length === 0 ? (
        <p className="text-gray-500">No tickets found. Submit a new ticket to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Assigned QAs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead>Last Comment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => {
                const lastComment = ticket.comments[ticket.comments.length - 1];
                let lastCommentStr = lastComment.side === 'nurse' ? 'Nurse: ' : 'QA: '
                lastCommentStr += lastComment.comment
                lastCommentStr = lastCommentStr.length > 50 ? lastCommentStr.slice(0, 50) + '...' : lastCommentStr

                // Safe category and subcategory lookup
                const categoryItem = categories.find((item) => item.value === ticket.issue);
                const issue = categoryItem ? categoryItem.label.split(' | ')[0] : ticket.issue;
                
                const subcategoryItem = subcategories[ticket.issue]?.find((item) => item.value === ticket.subIssue);
                const subissue = subcategoryItem ? subcategoryItem.label.split(' | ')[0] : ticket.subIssue;

                return (
                  <TableRow key={ticket.id}>
                    <TableCell>{issue + ' | ' + subissue}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {ticket.qaNames && ticket.qaNames.length > 1 ? (
                          <div>
                            <div className="font-medium">{ticket.qaNames.length} QAs</div>
                            <div className="text-gray-500 text-xs">
                              {ticket.qaNames.join(', ')}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium">{ticket.qaName || ticket.qaNames?.[0] || 'N/A'}</div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{statusMapping[ticket.status] || ticket.status}</TableCell>
                    <TableCell>{new Date(ticket.createdAt.toDate()).toLocaleString()}</TableCell>
                    <TableCell>
                      {ticket.lastUpdatedAt ? (
                        new Date(ticket.lastUpdatedAt.toDate()).toLocaleString()
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>{lastCommentStr}</TableCell>
                    <TableCell>
                      <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <Plus className="w-4 h-4"/>
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
          className = "p-0 max-h-xl overflow-y-auto"
          open={true} 
          onOpenChange={(open) => setSelectedTicket(open ? selectedTicket : null)
        }>
          <DialogContent className="p-0 max-h-xl overflow-y-auto">
            <CommentBox ticketItem={selectedTicket} userType="nurse" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default FeedbackTable