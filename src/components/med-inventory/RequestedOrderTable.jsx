import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Send } from "lucide-react";
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

const RequestedOrderTable = ({ inventoriesData, currentUser }) => {
  const [expandedRequests, setExpandedRequests] = useState({});
  const [chatMessages, setChatMessages] = useState({});
  const [newMessage, setNewMessage] = useState({});
  const [chatLoading, setChatLoading] = useState({});
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [chatUnsubscribes, setChatUnsubscribes] = useState({});

  const toggleRequest = (requestId) => {
    setExpandedRequests((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "open":
        return "bg-red-100 text-red-800 border-red-300";
      case "approved":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "in-transit":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "delivered":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "open":
        return "🔴";
      case "approved":
        return "🔵";
      case "in-transit":
        return "🟡";
      case "delivered":
        return "✅";
      default:
        return "⚪";
    }
  };

  const getStatusMessage = (status) => {
    switch (status?.toLowerCase()) {
      case "open":
        return "Waiting for team leader review";
      case "approved":
        return "Approved by team leader, preparing for dispatch";
      case "in-transit":
        return "Order dispatched, in transit to clinic";
      case "delivered":
        return "Order delivered successfully";
      default:
        return "Status unknown";
    }
  };

  const pendingOrders =
    inventoriesData?.filter(
      (inventory) =>
        inventory?.requestedOrder && (inventory.status === "open" || inventory.status === "approved" || inventory.status === "in-transit")
    ) || [];

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
          ...doc.data(),
        });
      });

      setChatMessages((prev) => ({
        ...prev,
        [inventoryId]: messages,
      }));
    });

    return unsubscribe;
  };

  // Send message function
  const sendMessage = async (inventoryId, inventory) => {
    const messageText = newMessage[inventoryId]?.trim();
    if (!messageText) return;

    setChatLoading((prev) => ({ ...prev, [inventoryId]: true }));

    try {
      await addDoc(collection(db, "InventoryChats"), {
        inventoryId,
        message: messageText,
        senderName: currentUser?.name,
        senderEmail: currentUser?.email,
        senderRole: "nurse",
        clinicCode: inventory.clinicCode,
        nurseName: inventory.nurseName,
        createdAt: serverTimestamp(),
      });

      setNewMessage((prev) => ({ ...prev, [inventoryId]: "" }));
      console.log(`✅ Message sent for inventory ${inventoryId}`);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setChatLoading((prev) => ({ ...prev, [inventoryId]: false }));
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

  if (pendingOrders.length === 0) {
    return (
      <div className="mt-4">
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <div className="text-4xl mb-2">📋</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            No Pending Requests
          </h3>
          <p className="text-gray-500">
            You don't have any pending medicine requests at the moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900">
          Pending Medicine Requests
        </h3>
        <div className="text-sm text-gray-500">
          {pendingOrders.length} pending requests
        </div>
      </div>

      <div className="space-y-4">
        {pendingOrders.map((inventory) => {
          const totalRequestedQty =
            inventory.requestedOrder?.reduce(
              (sum, item) => sum + (item.requestedQuantity || 0),
              0
            ) || 0;
          const isExpanded = expandedRequests[inventory.id];

          return (
            <div
              key={inventory.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-orange-300 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {/* Request Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleRequest(inventory.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">
                        {getStatusIcon(inventory.status)}
                      </span>
                      <div>
                        <div className="font-semibold text-gray-900">
                          Request #{inventory.id?.slice(-6).toUpperCase()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {inventory.requestedOrder?.length || 0} medicines •{" "}
                          {totalRequestedQty} total requested
                        </div>
                        <div className="text-xs text-orange-600 font-medium mt-1">
                          {getStatusMessage(inventory.status)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {inventory.createdAt?.toDate
                          ? inventory.createdAt
                              .toDate()
                              .toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })
                          : "N/A"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {inventory.createdAt?.toDate
                          ? inventory.createdAt
                              .toDate()
                              .toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                          : ""}
                      </div>
                    </div>

                    <Badge className={getStatusColor(inventory.status)}>
                      {inventory.status?.toUpperCase()}
                    </Badge>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the expand
                        openChatDialog(inventory);
                      }}
                      className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Chat
                    </Button>

                    <div className="text-gray-400">
                      {isExpanded ? "🔽" : "▶️"}
                    </div>
                  </div>
                </div>
                
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50">
                  <div className="p-4">
                    {/* Request Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">
                          Submitted On
                        </div>
                        <div className="font-medium">
                          {inventory.createdAt?.toDate
                            ? inventory.createdAt
                                .toDate()
                                .toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                            : "N/A"}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">
                          Assigned To
                        </div>
                        <div className="font-medium">
                          {inventory.assignedTL &&
                          inventory.assignedTL.length > 0
                            ? inventory.assignedTL[0]?.name || "Team Leader"
                            : "Team Leader"}
                        </div>
                      </div>
                    </div>

                    {/* Medicine Details */}
                    <div className="bg-white rounded border">
                      <div className="p-3 border-b bg-gray-50">
                        <h4 className="font-medium text-gray-900">
                          Requested Medicines
                        </h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                                Medicine
                              </th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">
                                Current Stock
                              </th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">
                                Requested Qty
                              </th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {inventory.requestedOrder?.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-t hover:bg-gray-50"
                              >
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">
                                    {item.medicineName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Code: {item.medicineCode}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center space-y-1">
                                    <span className="text-sm font-medium text-gray-900">
                                      {item.currentInventoryQty ?? 'N/A'}
                                    </span>
                                    <div className="text-xs">
                                      {(item.currentInventoryQty ?? 0) < (item.requestedQuantity || 0) 
                                        ? <span className="text-red-600">⚠️ Low Stock</span>
                                        : <span className="text-green-600">✅ Available</span>
                                      }
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {item.requestedQuantity}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                    ⏳ Pending
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Chat Dialog */}
      <Dialog open={chatDialogOpen} onOpenChange={closeChatDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-orange-600" />
              Chat with Team Leader
            </DialogTitle>
            <DialogDescription>
              Request #{selectedInventory?.id?.slice(-6).toUpperCase()} • {selectedInventory?.requestedOrder?.length || 0} medicines
            </DialogDescription>
          </DialogHeader>
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg space-y-3">
            {chatMessages[selectedInventory?.id]?.length > 0 ? (
              chatMessages[selectedInventory.id].map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderRole === 'nurse' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg ${
                      msg.senderRole === 'nurse' 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-medium text-xs ${
                        msg.senderRole === 'nurse' ? 'text-orange-100' : 'text-gray-700'
                      }`}>
                        {msg.senderRole === 'nurse' ? 'You' : 'Team Leader'}
                      </span>
                    </div>
                    <div className="text-sm mb-1">{msg.message}</div>
                    <div className={`text-xs ${
                      msg.senderRole === 'nurse' ? 'text-orange-200' : 'text-gray-500'
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
                placeholder="Message to team leader..."
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
                className="bg-orange-600 hover:bg-orange-700"
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
    </div>
  );
};

export default RequestedOrderTable;