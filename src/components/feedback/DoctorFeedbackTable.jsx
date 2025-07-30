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
import { MessageCircle, Calendar, User, Clock, FileText, Eye, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CommentBox from "./CommentBox";

import { doctorCategories, doctorSubcategories } from "./doctorMappings";

const statusMapping = {
  "open": "Open",
  "in-progress": "In Progress", 
  "resolved": "Resolved",
  "closed": "Closed",
}

const statusColors = {
  "open": "bg-red-100 text-red-800 border-red-200",
  "in-progress": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "resolved": "bg-green-100 text-green-800 border-green-200", 
  "closed": "bg-gray-100 text-gray-800 border-gray-200",
}

const DoctorFeedbackTable = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    console.log("Fetching doctor tickets for user UID:", currentUser.uid);
    if (currentUser) {
      const ticketsQuery = query(
        collection(firestore, "doctor_tickets"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
        const fetchedTickets = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          };
        });

        // Sort: closed tickets last
        fetchedTickets.sort((a, b) => {
          if (a.status === "closed" && b.status !== "closed") return 1;
          if (a.status !== "closed" && b.status === "closed") return -1;
          return 0;
        });

        setTickets(fetchedTickets);
      });

      return () => unsubscribe();
    }
  }, [currentUser]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp.toDate()).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  return (
    <div className="max-w-10xl mx-auto ">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50">
        <CardHeader className="pb-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                <Stethoscope className="w-6 h-6 text-blue-600" />
                Your Doctor Support Tickets
              </CardTitle>
              <p className="text-gray-600 mt-2">
                Track and manage your doctor support requests
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{tickets.length}</div>
              <div className="text-sm text-gray-500">Total Tickets</div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No tickets found</h3>
              <p className="text-gray-500">Submit a new doctor support ticket to get started with our QA team.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-700">Issue</TableHead>
                    <TableHead className="font-semibold text-gray-700">Partner</TableHead>
                    <TableHead className="font-semibold text-gray-700">QA Team</TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700">Created</TableHead>
                    <TableHead className="font-semibold text-gray-700">Last Updated</TableHead>
                    <TableHead className="font-semibold text-gray-700">Recent Activity</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket, index) => {
                    const lastComment = ticket.comments[ticket.comments.length - 1];
                    let lastCommentStr = lastComment.side === 'doctor' ? 'You: ' : 'QA: ';
                    lastCommentStr += lastComment.comment;
                    lastCommentStr = lastCommentStr.length > 60 ? lastCommentStr.slice(0, 60) + '...' : lastCommentStr;

                    const categoryItem = doctorCategories.find((item) => item.value === ticket.issue);
                    const issue = categoryItem ? categoryItem.label.split(' | ')[0] : ticket.issue;
                    
                    const subcategoryItem = doctorSubcategories[ticket.issue]?.find((item) => item.value === ticket.subIssue);
                    const subissue = subcategoryItem ? subcategoryItem.label.split(' | ')[0] : ticket.subIssue;

                    return (
                      <TableRow key={ticket.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="max-w-xs">
                          <div className="font-medium text-gray-900 truncate">{issue}</div>
                          <div className="text-sm text-gray-500 truncate">{subissue}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-blue-700">P</span>
                            </div>
                            <div className="font-medium text-sm text-gray-700">
                              {ticket?.selectedPartner}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              {ticket.qaNames && ticket.qaNames.length > 1 ? (
                                <div>
                                  <div className="font-medium text-sm">{ticket.qaNames.length} QAs</div>
                                  <div className="text-xs text-gray-500">
                                    {ticket.qaNames.slice(0, 2).join(', ')}
                                    {ticket.qaNames.length > 2 && '...'}
                                  </div>
                                </div>
                              ) : (
                                <div className="font-medium text-sm">
                                  {ticket.qaName || ticket.qaNames?.[0] || 'N/A'}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusColors[ticket.status]} font-medium`}>
                            {statusMapping[ticket.status] || ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {formatDate(ticket.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            {formatDate(ticket.lastUpdatedAt)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-start gap-2">
                            <MessageCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-gray-600 truncate">{lastCommentStr}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTicket(ticket)}
                            className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTicket && (
        <Dialog 
          open={true} 
          onOpenChange={(open) => setSelectedTicket(open ? selectedTicket : null)}
        >
          <DialogContent className="p-0 max-w-4xl max-h-[90vh] overflow-hidden">
            <CommentBox ticketItem={selectedTicket} userType="doctor" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default DoctorFeedbackTable