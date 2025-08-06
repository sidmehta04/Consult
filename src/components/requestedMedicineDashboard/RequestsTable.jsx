import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Clock, User, MapPin, Package, AlertTriangle, CheckCircle, MessageSquare, Send, X } from "lucide-react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

const statusColors = {
  open: "bg-red-100 text-red-800 border-red-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  "in-transit": "bg-yellow-100 text-yellow-800 border-yellow-300",
  delivered: "bg-green-100 text-green-800 border-green-300",
};

const statusIcons = {
  open: AlertTriangle,
  approved: CheckCircle,
  "in-transit": Clock,
  delivered: Package,
};

const statusOptions = [
  { value: "open", label: "Open", icon: AlertTriangle },
  { value: "approved", label: "Approved", icon: CheckCircle },
  { value: "in-transit", label: "In Transit", icon: Clock },
  { value: "delivered", label: "Delivered", icon: Package },
];

const RequestsTable = ({ 
  filteredInventoryData, 
  expandedRows, 
  setExpandedRows,
  medicinesData,
  updateQty,
  comments,
  setComments,
  processingOrders,
  handleStatusChange,
  handleApproveRequest,
  handleQtyChanges,
  currentUser
}) => {
  const [chatMessages, setChatMessages] = useState({});
  const [newMessage, setNewMessage] = useState({});
  const [chatLoading, setChatLoading] = useState({});
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [chatUnsubscribes, setChatUnsubscribes] = useState({});

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const openChatDialog = (inventory) => {
    setSelectedInventory(inventory);
    setChatDialogOpen(true);
    // Setup chat listener for this inventory if not already done
    if (!chatUnsubscribes[inventory.id]) {
      const unsubscribe = setupChatListener(inventory.id);
      setChatUnsubscribes(prev => ({
        ...prev,
        [inventory.id]: unsubscribe
      }));
    }
  };

  const closeChatDialog = () => {
    setChatDialogOpen(false);
    setSelectedInventory(null);
  };

  // Setup chat listener for a specific inventory
  const setupChatListener = (inventoryId) => {
    const chatQuery = query(
      collection(db, "InventoryChats"),
      where("inventoryId", "==", inventoryId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(chatQuery, (querySnapshot) => {
      const messages = [];
      querySnapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setChatMessages(prev => ({
        ...prev,
        [inventoryId]: messages
      }));
    });

    return unsubscribe;
  };

  // Send message function
  const sendMessage = async (inventoryId, inventory) => {
    const messageText = newMessage[inventoryId]?.trim();
    if (!messageText) return;

    setChatLoading(prev => ({ ...prev, [inventoryId]: true }));

    try {
      await addDoc(collection(db, "InventoryChats"), {
        inventoryId,
        message: messageText,
        senderName: currentUser?.name,
        senderEmail: currentUser?.email,
        senderRole: currentUser?.isSuperMedManager ? 'admin' : 'tl',
        clinicCode: inventory.clinicCode,
        nurseName: inventory.nurseName,
        createdAt: serverTimestamp()
      });

      setNewMessage(prev => ({ ...prev, [inventoryId]: '' }));
      console.log(`✅ Message sent for inventory ${inventoryId}`);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setChatLoading(prev => ({ ...prev, [inventoryId]: false }));
    }
  };

  // Cleanup listeners on component unmount
  useEffect(() => {
    return () => {
      // Cleanup all active chat listeners when component unmounts
      Object.values(chatUnsubscribes).forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [chatUnsubscribes]);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[120px]">Clinic Code</TableHead>
              <TableHead>Nurse Details</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventoryData.map((inventory) => {
              const StatusIcon = statusIcons[inventory.status] || AlertTriangle;
              return (
                <React.Fragment key={inventory.id}>
                  <TableRow className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      {inventory.clinicCode}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{inventory.nurseName}</span>
                        </div>
                        <div className="text-sm text-gray-500">{inventory.nurseEmail}</div>
                       
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{inventory.state}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={inventory.status}
                        onValueChange={(newStatus) => handleStatusChange(newStatus, inventory)}
                        disabled={processingOrders[inventory.id]}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue>
                            <div className="flex items-center space-x-2">
                              <StatusIcon className="h-4 w-4" />
                              <Badge className={statusColors[inventory.status]}>
                                {inventory.status?.replace('-', ' ').toUpperCase()}
                              </Badge>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => {
                            const OptionIcon = option.icon;
                            return (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center space-x-2">
                                  <OptionIcon className="h-4 w-4" />
                                  <span>{option.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600">
                        {inventory.createdAt?.toDate ? (
                          <div>
                            <div className="font-medium">
                              {inventory.createdAt.toDate().toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {inventory.createdAt.toDate().toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </div>
                          </div>
                        ) : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openChatDialog(inventory)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Chat
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleRow(inventory.id)}
                        >
                          {expandedRows[inventory.id] ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Hide
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              View
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>


                  {expandedRows[inventory.id] && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <div className="border-t bg-gray-50 p-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Order Details */}
                            <div>
                              <h4 className="font-semibold text-lg mb-4 flex items-center justify-between">
                                <div className="flex items-center">
                                  <Package className="h-5 w-5 mr-2" />
                                  Medicine Request Details
                                </div>
                                <div className="text-sm text-gray-600">
                                  <div className="flex items-center space-x-4">
                                    <div>
                                      <span className="font-medium">Order ID:</span> #{inventory.id.slice(-6).toUpperCase()}
                                    </div>
                                    <div>
                                      <span className="font-medium">Items:</span> {inventory?.requestedOrder?.length || 0}
                                    </div>
                                  </div>
                                </div>
                              </h4>
                              <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                <div className="flex items-center justify-between text-sm">
                                  <div>
                                    <strong>Request submitted:</strong> {inventory.createdAt?.toDate ? 
                                      inventory.createdAt.toDate().toLocaleString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                      }) : 'N/A'
                                    }
                                  </div>
                                  <div>
                                    <strong>Total medicines requested:</strong> {inventory?.requestedOrder?.reduce((sum, item) => sum + (item.requestedQuantity || 0), 0)}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-3">
                                {inventory?.requestedOrder?.map((item, idx) => {
                                  // For approved orders, get the approved quantity from updatedOrder, otherwise use updateQty state
                                  const approvedItem = inventory?.updatedOrder?.[idx];
                                  const currentQty = inventory.status !== 'open' && approvedItem
                                    ? approvedItem.approvedQuantity
                                    : (updateQty[inventory?.clinicCode]?.[idx] ?? item?.requestedQuantity);
                                  
                                  const unitPrice = medicinesData?.find(
                                    (data) => data["Medicine Name"]?.toLowerCase() === item.medicineName?.toLowerCase()
                                  )?.price || approvedItem?.unitPrice || item?.unitPrice || 1;
                                  const totalPrice = Math.floor(unitPrice * currentQty);

                                  return (
                                    <div key={idx} className="bg-white p-4 rounded-lg border">
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                          <h5 className="font-medium">{item.medicineName}</h5>
                                          <p className="text-sm text-gray-500">Code: {item.medicineCode}</p>
                                        </div>
                                        <Badge variant="outline">₹{unitPrice}/unit</Badge>
                                      </div>
                                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Requested</label>
                                          <p className="text-lg font-semibold text-blue-600">{item.requestedQuantity}</p>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Current Stock</label>
                                          <p className="text-lg font-semibold text-orange-600">
                                            {approvedItem?.currentInventoryQty ?? item?.currentInventoryQty ?? 'N/A'}
                                          </p>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {(approvedItem?.currentInventoryQty ?? item?.currentInventoryQty ?? 0) < (item.requestedQuantity || 0) 
                                              ? '⚠️ Low Stock' 
                                              : '✅ Available'
                                            }
                                          </div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">
                                            {inventory.status === 'open' ? 'Approve Qty' : 'Approved Qty'}
                                          </label>
                                          <Input
                                            type="number"
                                            min="0"
                                            value={currentQty}
                                            onChange={(e) => handleQtyChanges(inventory?.clinicCode, idx, e.target.value)}
                                            disabled={inventory.status !== 'open'}
                                            className={`mt-1 ${inventory.status !== 'open' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Total Cost</label>
                                          <p className="text-lg font-semibold text-green-600">₹{totalPrice}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Actions Panel */}
                            <div>
                              <div className="mb-4">
                                <h4 className="font-semibold text-lg">Actions & Order Processing</h4>
                              </div>
                              <div className="space-y-4">
                                {/* TL Comments */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Comments</label>
                                  <Textarea
                                    placeholder="Add comments about this order..."
                                    value={comments[inventory.id] || ''}
                                    onChange={(e) => setComments(prev => ({ ...prev, [inventory.id]: e.target.value }))}
                                    className="mt-1"
                                    rows={3}
                                  />
                                </div>
                                
                                {/* Order Summary */}
                                <div className="bg-white p-4 rounded-lg border">
                                  <h5 className="font-medium mb-2">Order Summary</h5>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span>Medicine Types:</span>
                                      <span className="font-medium">{inventory?.requestedOrder?.length || 0}</span>
                                    </div>
                                    
                                    {/* Requested Quantities */}
                                    <div className="flex justify-between">
                                      <span>Total Requested:</span>
                                      <span className="font-medium text-blue-600">
                                        {inventory?.requestedOrder?.reduce((sum, item) => {
                                          return sum + (parseInt(item?.requestedQuantity) || 0);
                                        }, 0)}
                                      </span>
                                    </div>
                                    
                                    {/* Show approved quantities for approved orders */}
                                    {inventory.status !== 'open' && (
                                      <div className="flex justify-between">
                                        <span>Total Approved:</span>
                                        <span className="font-medium text-green-600">
                                          {inventory?.requestedOrder?.reduce((sum, item, idx) => {
                                            const approvedItem = inventory?.updatedOrder?.[idx];
                                            const qty = approvedItem ? approvedItem.approvedQuantity : (updateQty[inventory?.clinicCode]?.[idx] ?? item?.requestedQuantity);
                                            return sum + (parseInt(qty) || 0);
                                          }, 0)}
                                        </span>
                                      </div>
                                    )}
                                    
                                    <div className="flex justify-between border-t pt-2">
                                      <span className="font-medium">
                                        {inventory.status === 'open' ? 'Requested Value:' : 'Approved Value:'}
                                      </span>
                                      <span className="font-bold text-green-600">
                                        ₹{inventory.status === 'open' 
                                          ? inventory?.requestedOrder?.reduce((sum, item) => {
                                              const price = medicinesData?.find(
                                                (data) => data["Medicine Name"]?.toLowerCase() === item.medicineName?.toLowerCase()
                                              )?.price || item?.unitPrice || 1;
                                              return sum + ((parseInt(item?.requestedQuantity) || 0) * price);
                                            }, 0).toFixed(2) || '0'
                                          : (inventory?.totalOrderValue?.toFixed(2) || '0')
                                        }
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex space-x-2">
                                  <Button
                                    onClick={() => handleApproveRequest(inventory)}
                                    disabled={processingOrders[inventory.id] || inventory.status !== 'open'}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                  >
                                    {processingOrders[inventory.id] ? (
                                      <div className="flex items-center">
                                        <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                                        Processing...
                                      </div>
                                    ) : inventory.status !== 'open' ? (
                                      `Already ${inventory.status?.charAt(0).toUpperCase() + inventory.status?.slice(1)}`
                                    ) : (
                                      'Approve Order'
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {/* Status History */}
                              {inventory.statusHistory && inventory.statusHistory.length > 0 && (
                                <div className="mt-6">
                                  <h5 className="font-medium mb-2">Status History</h5>
                                  <div className="space-y-2">
                                    {inventory.statusHistory.map((entry, idx) => (
                                      <div key={idx} className="text-sm bg-white p-2 rounded border">
                                        <div className="flex justify-between items-center">
                                          <Badge className={statusColors[entry.status]} variant="outline">
                                            {entry.status?.replace('-', ' ').toUpperCase()}
                                          </Badge>
                                          <span className="text-gray-500">
                                            {entry.updatedAt?.toDate ? entry.updatedAt.toDate().toLocaleString() : 'N/A'}
                                          </span>
                                        </div>
                                        <div className="text-gray-700 mt-1">{entry.comments}</div>
                                        <div className="text-gray-500 text-xs">by {entry.updatedBy}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      {/* Chat Dialog */}
      <Dialog open={chatDialogOpen} onOpenChange={closeChatDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
              Chat with {selectedInventory?.nurseName}
            </DialogTitle>
            <DialogDescription>
              Clinic: {selectedInventory?.clinicCode} • Order #{selectedInventory?.id?.slice(-6).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg space-y-3">
            {chatMessages[selectedInventory?.id]?.length > 0 ? (
              chatMessages[selectedInventory.id].map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderRole === 'nurse' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg ${
                      msg.senderRole === 'nurse' 
                        ? 'bg-white border border-gray-200 text-gray-800' 
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-medium text-xs ${
                        msg.senderRole === 'nurse' ? 'text-gray-700' : 'text-blue-100'
                      }`}>
                        {msg.senderName} 
                        <span className={`ml-1 ${
                          msg.senderRole === 'nurse' ? 'text-gray-500' : 'text-blue-200'
                        }`}>
                          ({msg.senderRole === 'nurse' ? 'Nurse' : 'You'})
                        </span>
                      </span>
                    </div>
                    <div className="text-sm mb-1">{msg.message}</div>
                    <div className={`text-xs ${
                      msg.senderRole === 'nurse' ? 'text-gray-500' : 'text-blue-200'
                    }`}>
                      {msg.createdAt?.toDate ? 
                        msg.createdAt.toDate().toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Now'
                      }
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}
          </div>
          
          {/* Message Input */}
          <div className="flex-shrink-0 pt-4 border-t">
            <div className="flex space-x-3">
              <Input
                type="text"
                placeholder={`Reply to ${selectedInventory?.nurseName}...`}
                value={newMessage[selectedInventory?.id] || ''}
                onChange={(e) => setNewMessage(prev => ({
                  ...prev,
                  [selectedInventory?.id]: e.target.value
                }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedInventory) {
                    sendMessage(selectedInventory.id, selectedInventory);
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={() => selectedInventory && sendMessage(selectedInventory.id, selectedInventory)}
                disabled={chatLoading[selectedInventory?.id] || !newMessage[selectedInventory?.id]?.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {chatLoading[selectedInventory?.id] ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RequestsTable;