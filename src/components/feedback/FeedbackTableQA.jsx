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
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
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
import { categories, subcategories } from "./mappings";

const FeedbackTableQA = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSuperQA, setIsSuperQA] = useState(false);
  const ticketsPerPage = 15;

  // Check if current user is super QA
  useEffect(() => {
    if (currentUser.email === "Akash.das@m-insure.in") {
      setIsSuperQA(true);
    }
  }, [currentUser]);

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
      let ticketsQuery;
      
      // Special case for the super QA leader
      if (currentUser.email === "Akash.das@m-insure.in") {
        // Fetch ALL tickets for the super QA leader
        ticketsQuery = query(
          collection(firestore, "tickets"),
          orderBy("createdAt", "desc")
        );
      } else {
        // Regular QA users only see their assigned tickets
        ticketsQuery = query(
          collection(firestore, "tickets"),
          where("qaEmail", "==", currentUser.email),
          orderBy("createdAt", "desc")
        );
      }

      const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
        const fetchedTickets = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        //set closed tickets last
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

  // Calculate pagination
  const indexOfLastTicket = currentPage * ticketsPerPage;
  const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage;
  const currentTickets = tickets.slice(indexOfFirstTicket, indexOfLastTicket);
  const totalPages = Math.ceil(tickets.length / ticketsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Feedback Portal</h1>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-700">
          {isSuperQA ? "All Tickets" : "Tickets Assigned to You"}
        </h2>
        <div className="text-sm text-gray-600">
          Showing {Math.min(indexOfFirstTicket + 1, tickets.length)}-{Math.min(indexOfLastTicket, tickets.length)} of {tickets.length} tickets
        </div>
      </div>
      
      {tickets.length === 0 ? (
        <p className="text-gray-500">No tickets found. Submit a new ticket to get started.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic Name</TableHead>
                  <TableHead>Issue Category</TableHead>
                  {isSuperQA && <TableHead>QA Assigned</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Last Updated At</TableHead>
                  <TableHead>Last Comment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTickets.map((ticket) => {
                  const lastComment = ticket.comments[ticket.comments.length - 1];
                  let lastCommentStr = lastComment.side === 'nurse' ? 'Nurse: ' : 'QA: '
                  lastCommentStr += lastComment.comment
                  lastCommentStr = lastCommentStr.length > 50 ? lastCommentStr.slice(0, 50) + '...' : lastCommentStr
                  
                  // Safe category and subcategory lookup with fallbacks
                  const categoryItem = categories.find((item) => item.value === ticket.issue);
                  const issue = categoryItem ? categoryItem.label.split(' | ')[0] : ticket.issue;
                  
                  const subcategoryItem = subcategories[ticket.issue]?.find((item) => item.value === ticket.subIssue);
                  const subissue = subcategoryItem ? subcategoryItem.label.split(' | ')[0] : ticket.subIssue;
                  
                  return (
                    <TableRow key={ticket.id}>
                      <TableCell>{ticket.name} | {ticket.clinicCode}</TableCell>
                      <TableCell>{issue + ' | ' + subissue}</TableCell>
                      {isSuperQA && (
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{ticket.qaName || 'N/A'}</div>
                            <div className="text-gray-500">{ticket.qaEmail || 'N/A'}</div>
                          </div>
                        </TableCell>
                      )}
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                
                <div className="flex items-center space-x-1">
                  {getPageNumbers().map((pageNumber, index) => (
                    <React.Fragment key={index}>
                      {pageNumber === '...' ? (
                        <span className="px-3 py-1 text-gray-500">...</span>
                      ) : (
                        <Button
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNumber)}
                          className="min-w-[40px]"
                        >
                          {pageNumber}
                        </Button>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
            </div>
          )}
        </>
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