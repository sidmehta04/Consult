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
import { Eye, ChevronLeft, ChevronRight, Crown, Users, Building, Calendar, Clock, MessageCircle, BarChart3, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CommentBox from "./CommentBox";
import FeedbackAnalytics from "./FeedBackAnalysis";
import { categories, subcategories } from "./mappings";

const statusColors = {
  "open": "bg-red-100 text-red-800 border-red-200",
  "in-progress": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "resolved": "bg-green-100 text-green-800 border-green-200",
  "closed": "bg-gray-100 text-gray-800 border-gray-200",
};

const FeedbackTableQA = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSuperQA, setIsSuperQA] = useState(false);
  const [activeTab, setActiveTab] = useState("tickets");
  const [filters, setFilters] = useState({
    clinic: "",
    issue: "__all__",
    status: "__all__",
    qaAssigned: "",
  });
  const ticketsPerPage = 15;

  // Check if current user is super QA or has analytics access
  useEffect(() => {
    if (currentUser.email === "Akash.das@m-insure.in" || currentUser.role === "superAdmin") {
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

  // Filter tickets based on current filters
  useEffect(() => {
    let filtered = tickets;

    if (filters.clinic) {
      filtered = filtered.filter(ticket => 
        ticket.name?.toLowerCase().includes(filters.clinic.toLowerCase()) ||
        ticket.clinicCode?.toLowerCase().includes(filters.clinic.toLowerCase())
      );
    }

    if (filters.issue && filters.issue !== "__all__") {
      const categoryItem = categories.find((item) => item.value === filters.issue);
      const issueLabel = categoryItem ? categoryItem.label.split(' | ')[0] : filters.issue;
      filtered = filtered.filter(ticket => {
        const ticketCategoryItem = categories.find((item) => item.value === ticket.issue);
        const ticketIssue = ticketCategoryItem ? ticketCategoryItem.label.split(' | ')[0] : ticket.issue;
        return ticketIssue?.toLowerCase().includes(issueLabel.toLowerCase());
      });
    }

    if (filters.status && filters.status !== "__all__") {
      filtered = filtered.filter(ticket => ticket.status === filters.status);
    }

    if (filters.qaAssigned && isSuperQA) {
      filtered = filtered.filter(ticket => 
        ticket.qaName?.toLowerCase().includes(filters.qaAssigned.toLowerCase()) ||
        ticket.qaEmail?.toLowerCase().includes(filters.qaAssigned.toLowerCase()) ||
        ticket.qaNames?.some(name => name?.toLowerCase().includes(filters.qaAssigned.toLowerCase())) ||
        ticket.qaEmails?.some(email => email?.toLowerCase().includes(filters.qaAssigned.toLowerCase()))
      );
    }

    setFilteredTickets(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [tickets, filters, isSuperQA]);

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      clinic: "",
      issue: "__all__",
      status: "__all__",
      qaAssigned: "",
    });
  };

  // Get unique values for filter options
  const getUniqueValues = (field) => {
    const values = new Set();
    tickets.forEach(ticket => {
      if (field === 'clinic') {
        if (ticket.name) values.add(ticket.name);
      } else if (field === 'issue') {
        const categoryItem = categories.find((item) => item.value === ticket.issue);
        const issue = categoryItem ? categoryItem.label.split(' | ')[0] : ticket.issue;
        if (issue) values.add(issue);
      } else if (field === 'status') {
        if (ticket.status) values.add(ticket.status);
      } else if (field === 'qaAssigned') {
        if (ticket.qaName) values.add(ticket.qaName);
        if (ticket.qaNames) ticket.qaNames.forEach(name => values.add(name));
      }
    });
    return Array.from(values).sort();
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(filter => filter !== "" && filter !== "__all__");

  // Fetch tickets for the current user
  useEffect(() => {
    if (currentUser) {
      let ticketsQuery;
      
      if (currentUser.email === "Akash.das@m-insure.in" || currentUser.role === "superAdmin") {
        ticketsQuery = query(
          collection(firestore, "tickets"),
          orderBy("createdAt", "desc")
        );
      } else {
        ticketsQuery = query(
          collection(firestore, "tickets"),
          orderBy("createdAt", "desc")
        );
      }

      const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
        let fetchedTickets = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter tickets for regular QA users
        if (currentUser.email !== "Akash.das@m-insure.in" && currentUser.role !== "superAdmin") {
          fetchedTickets = fetchedTickets.filter(ticket => {
            const isInQaEmails = ticket.qaEmails && Array.isArray(ticket.qaEmails) && 
                                ticket.qaEmails.includes(currentUser.email);
            const isOldQaEmail = ticket.qaEmail === currentUser.email;
            return isInQaEmails || isOldQaEmail;
          });
        }

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

  // Calculate pagination
  const indexOfLastTicket = currentPage * ticketsPerPage;
  const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage;
  const currentTickets = filteredTickets.slice(indexOfFirstTicket, indexOfLastTicket);
  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);

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

  // Calculate ticket statistics based on filtered tickets
  const ticketStats = {
    total: filteredTickets.length,
    open: filteredTickets.filter(t => t.status === 'open').length,
    inProgress: filteredTickets.filter(t => t.status === 'in-progress').length,
    resolved: filteredTickets.filter(t => t.status === 'resolved').length,
    closed: filteredTickets.filter(t => t.status === 'closed').length,
  };

  return (
    <div className="max-w-12xl mx-auto p-6">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isSuperQA && <Crown className="w-6 h-6 text-yellow-500" />}
              <div>
                <CardTitle className="text-2xl font-bold text-gray-800">
                  {isSuperQA ? "Super QA Dashboard" : "QA Dashboard"}
                </CardTitle>
                <p className="text-gray-600 mt-1">
                  {isSuperQA ? "Manage all tickets and view analytics" : "Manage your assigned tickets"}
                </p>
              </div>
            </div>
            
            {/* Ticket Statistics */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-center">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-lg font-bold text-blue-600">{ticketStats.total}</div>
                <div className="text-xs text-blue-700">Total</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-lg font-bold text-red-600">{ticketStats.open}</div>
                <div className="text-xs text-red-700">Open</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="text-lg font-bold text-yellow-600">{ticketStats.inProgress}</div>
                <div className="text-xs text-yellow-700">In Progress</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-lg font-bold text-green-600">{ticketStats.resolved}</div>
                <div className="text-xs text-green-700">Resolved</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-bold text-gray-600">{ticketStats.closed}</div>
                <div className="text-xs text-gray-700">Closed</div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tickets" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Tickets Management
              </TabsTrigger>
              {isSuperQA && (
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analytics Dashboard
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="tickets" className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold text-gray-700">
                    {isSuperQA ? "All Tickets" : "Tickets Assigned to You"}
                  </h2>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
                    >
                      <X className="w-4 h-4" />
                      Clear Filters
                    </Button>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Showing {Math.min(indexOfFirstTicket + 1, filteredTickets.length)}-{Math.min(indexOfLastTicket, filteredTickets.length)} of {filteredTickets.length} tickets
                  {hasActiveFilters && ` (filtered from ${tickets.length} total)`}
                </div>
              </div>

              {tickets.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No tickets assigned</h3>
                  <p className="text-gray-500">Check back later for new support requests.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold text-gray-700">
                            <div className="flex items-center gap-2">
                              <span>Clinic</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Filter className={`w-3 h-3 ${filters.clinic ? 'text-blue-600' : 'text-gray-400'}`} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56" align="start">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Filter by Clinic</label>
                                    <Input
                                      placeholder="Search clinic..."
                                      value={filters.clinic}
                                      onChange={(e) => setFilters(prev => ({ ...prev, clinic: e.target.value }))}
                                    />
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-gray-700">
                            <div className="flex items-center gap-2">
                              <span>Issue</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Filter className={`w-3 h-3 ${filters.issue ? 'text-blue-600' : 'text-gray-400'}`} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56" align="start">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Filter by Issue</label>
                                    <Select value={filters.issue} onValueChange={(value) => setFilters(prev => ({ ...prev, issue: value }))}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select issue..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__all__">All Issues</SelectItem>
                                        {getUniqueValues('issue').map(issue => (
                                          <SelectItem key={issue} value={issue}>{issue}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </TableHead>
                          {isSuperQA && (
                            <TableHead className="font-semibold text-gray-700">
                              <div className="flex items-center gap-2">
                                <span>QA Assigned</span>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <Filter className={`w-3 h-3 ${filters.qaAssigned ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56" align="start">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Filter by QA</label>
                                      <Input
                                        placeholder="Search QA..."
                                        value={filters.qaAssigned}
                                        onChange={(e) => setFilters(prev => ({ ...prev, qaAssigned: e.target.value }))}
                                      />
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </TableHead>
                          )}
                          <TableHead className="font-semibold text-gray-700">
                            <div className="flex items-center gap-2">
                              <span>Status</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Filter className={`w-3 h-3 ${filters.status ? 'text-blue-600' : 'text-gray-400'}`} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56" align="start">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Filter by Status</label>
                                    <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select status..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__all__">All Statuses</SelectItem>
                                        <SelectItem value="open">Open</SelectItem>
                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                        <SelectItem value="resolved">Resolved</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-gray-700">Created</TableHead>
                          <TableHead className="font-semibold text-gray-700">Updated</TableHead>
                          <TableHead className="font-semibold text-gray-700">Recent Activity</TableHead>
                          <TableHead className="font-semibold text-gray-700 text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentTickets.map((ticket) => {
                          const lastComment = ticket.comments[ticket.comments.length - 1];
                          let lastCommentStr = lastComment.side === 'nurse' ? 'Nurse: ' : 'QA: ';
                          lastCommentStr += lastComment.comment;
                          lastCommentStr = lastCommentStr.length > 50 ? lastCommentStr.slice(0, 50) + '...' : lastCommentStr;
                          
                          const categoryItem = categories.find((item) => item.value === ticket.issue);
                          const issue = categoryItem ? categoryItem.label.split(' | ')[0] : ticket.issue;
                          
                          const subcategoryItem = subcategories[ticket.issue]?.find((item) => item.value === ticket.subIssue);
                          const subissue = subcategoryItem ? subcategoryItem.label.split(' | ')[0] : ticket.subIssue;
                          
                          return (
                            <TableRow key={ticket.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <div className="font-medium text-sm">{ticket.name}</div>
                                    <div className="text-xs text-gray-500">{ticket.clinicCode}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div className="font-medium text-sm truncate">{issue}</div>
                                <div className="text-xs text-gray-500 truncate">{subissue}</div>
                              </TableCell>
                              {isSuperQA && (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-gray-400" />
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
                                        <div>
                                          <div className="font-medium text-sm">{ticket.qaName || ticket.qaNames?.[0] || 'N/A'}</div>
                                          <div className="text-xs text-gray-500">{ticket.qaEmail || ticket.qaEmails?.[0] || 'N/A'}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              )}
                              <TableCell>
                                <Select
                                  value={ticket.status}
                                  onValueChange={(newStatus) => handleStatusChange(ticket.id, newStatus)}
                                >
                                  <SelectTrigger className="w-36">
                                    <SelectValue>
                                      <Badge className={`${statusColors[ticket.status]} font-medium`}>
                                        {ticket.status?.toUpperCase()}
                                      </Badge>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                  </SelectContent>
                                </Select>
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

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrevPage}
                          disabled={currentPage === 1}
                          className="hover:bg-gray-50"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
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
                                  className="min-w-[40px] hover:bg-gray-50"
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
                          className="hover:bg-gray-50"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {isSuperQA && (
              <TabsContent value="analytics" className="space-y-6">
                <FeedbackAnalytics currentUser={currentUser} />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
      
      {selectedTicket && (
        <Dialog 
          open={true} 
          onOpenChange={(open) => setSelectedTicket(open ? selectedTicket : null)}
        >
          <DialogContent className="p-0 max-w-4xl max-h-[90vh] overflow-hidden">
            <CommentBox ticketItem={selectedTicket} userType="qa" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default FeedbackTableQA;