import {
  collection,
  updateDoc,
  query,
  onSnapshot,
  orderBy,
  doc
} from "firebase/firestore";

import { useEffect, useState, useMemo } from "react";
import { db } from "../../firebase";
import { InventoryMapping } from "../feedback/mappings";
import { useGetMedicine } from "../../hooks/useGetMedicine";
import { Package, BarChart3, Clipboard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StatisticsCards from "./StatisticsCards";
import DashboardFilters from "./DashboardFilters";
import RequestsTable from "./RequestsTable";
import AnalyticsDashboard from "./AnalyticsDashboard";

const RequestedMedDashboard = ({ currentUser }) => {
  const [inventoryData, setInventoryData] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [loading, setLoading] = useState(true);
  const { medicinesData, fetchMedicinesFromDrive } = useGetMedicine();
  const [updateQty, setUpdateQty] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [comments, setComments] = useState({});
  const [processingOrders, setProcessingOrders] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState(currentUser?.isSuperMedManager ? "dashboard" : "tickets");

  const targetEmail = currentUser?.email;

  // Get states assigned to current user
  const statesAssigned = useMemo(() => {
    if (!targetEmail) return [];
    return Object.entries(InventoryMapping)
      .filter(([, people]) =>
        people.some((person) => person.email === targetEmail)
      )
      .map(([state]) => state);
  }, [targetEmail]);

  // Filter and search functionality
  const filteredInventoryData = useMemo(() => {
    let filtered = inventoryData;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.clinicCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nurseName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.state?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    return filtered;
  }, [inventoryData, searchTerm, statusFilter]);


  // Real-time listener for inventory data
  const setupRealTimeListener = () => {
    try {
      setLoading(true);
      
      // Create query with ordering for consistent results
      const inventoryQuery = query(
        collection(db, "Inventory"),
        orderBy("createdAt", "desc")
      );

      // Setup real-time listener
      const unsubscribe = onSnapshot(inventoryQuery, (querySnapshot) => {
        let inventoryData = [];
        
        querySnapshot.forEach((doc) => {
          inventoryData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        // Filter based on user permissions
        if (!currentUser?.isSuperMedManager) {
          inventoryData = inventoryData.filter((item) =>
            statesAssigned?.includes(item.state)
          );
        }

        setInventoryData(inventoryData);
        setLoading(false);
        setLastUpdated(new Date());
        
        console.log("🔄 Real-time update: Received", inventoryData.length, "inventory items");
      }, (error) => {
        console.error("❌ Error in real-time listener:", error);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error setting up real-time listener:", error);
      setLoading(false);
      return null;
    }
  };

  useEffect(() => {
    fetchMedicinesFromDrive();
    
    // Setup real-time listener instead of one-time fetch
    const unsubscribe = setupRealTimeListener();
    
    // Cleanup listener on component unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log("🔄 Real-time listener cleaned up");
      }
    };
  }, [currentUser, statesAssigned]); // Re-setup listener if user or states change

  const handleStatusChange = async (newStatus, inventory) => {
    if (processingOrders[inventory.id]) return;
    
    setProcessingOrders(prev => ({ ...prev, [inventory.id]: true }));

    try {
      // Find the specific document by ID instead of clinicCode
      const docRef = doc(db, "Inventory", inventory.id);
      
      const newStatusEntry = {
        status: newStatus,
        updatedBy: currentUser?.name,
        updatedAt: new Date(),
        comments: `Status changed to ${newStatus} by ${currentUser?.name}`
      };

      // Update only the specific document
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: currentUser?.name,
        statusHistory: [...(inventory.statusHistory || []), newStatusEntry]
      });

      // Real-time listener will automatically update the data
      console.log(`✅ Status updated to "${newStatus}" for order ${inventory.id}`);
    } catch (error) {
      console.error("❌ Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setProcessingOrders(prev => ({ ...prev, [inventory.id]: false }));
    }
  };

  const handleApproveRequest = async (inventory) => {
    const clinicCode = inventory.clinicCode;
    const updatedQuantitiesForClinic = updateQty?.[clinicCode] || {};
    const orderComments = comments[inventory.id] || '';

    if (processingOrders[inventory.id]) return;
    
    setProcessingOrders(prev => ({ ...prev, [inventory.id]: true }));

    try {
      // Calculate updated order with pricing
      const updatedOrder = inventory?.requestedOrder?.map((data, index) => {
        const approvedQty = updatedQuantitiesForClinic?.[index] !== undefined
          ? Number(updatedQuantitiesForClinic[index])
          : data.requestedQuantity || 0;
        
        const medicinePrice = medicinesData?.find(
          med => med['Medicine Name']?.toLowerCase() === data.medicineName?.toLowerCase()
        )?.price || 0;
        
        const totalCost = approvedQty * medicinePrice;

        return {
          ...data,
          approvedQuantity: approvedQty,
          unitPrice: medicinePrice,
          totalCost,
          status: approvedQty > 0 ? 'approved' : 'rejected'
        };
      });

      const totalOrderValue = updatedOrder.reduce((sum, item) => sum + item.totalCost, 0);

      // Create status history entry
      const newStatusEntry = {
        status: 'approved',
        updatedBy: currentUser?.name,
        updatedAt: new Date(),
        comments: orderComments || 'Order processed and approved by TL'
      };

      // Update only the specific document by ID
      const docRef = doc(db, "Inventory", inventory.id);
      
      await updateDoc(docRef, {
        updatedOrder,
        status: "approved",
        totalOrderValue,
        updatedAt: new Date(),
        updatedBy: currentUser?.name,
        tlComments: orderComments,
        statusHistory: [...(inventory.statusHistory || []), newStatusEntry]
      });

      // Clear local state
      setUpdateQty(prev => ({ ...prev, [clinicCode]: {} }));
      setComments(prev => ({ ...prev, [inventory.id]: '' }));
      
      // Real-time listener will automatically update the data  
      console.log(`✅ Order approved successfully for order ID: ${inventory.id}`);
    } catch (error) {
      console.error("❌ Error approving order:", error);
    } finally {
      setProcessingOrders(prev => ({ ...prev, [inventory.id]: false }));
    }
  };

  const handleQtyChanges = (clinicCode, itemIndex, value) => {
    setUpdateQty((prev) => ({
      ...prev,
      [clinicCode]: {
        ...(prev[clinicCode] || {}),
        [itemIndex]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          <p className="text-gray-600">Loading medicine requests...</p>
        </div>
      </div>
    );
  }

  if (inventoryData.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Medicine Requests Found</h3>
        <p className="text-gray-600">
          {currentUser?.isSuperMedManager
            ? "There are currently no medicine requests in the system."
            : "There are no medicine requests assigned to your states."}
        </p>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Simplified Header */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-blue-600">
                  Medicine Management System
                </h1>
                <p className="text-sm text-gray-600 mt-0.5">
                  {currentUser?.isSuperMedManager 
                    ? "Super Medicine Manager Portal" 
                    : "Team Leader Portal"
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-2 py-1 bg-green-50 rounded border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-700 font-medium">Live Data</span>
              </div>
              {lastUpdated && (
                <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Simplified Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-white rounded-lg shadow-sm border p-1">
            <TabsList className={`grid w-full h-10 ${currentUser?.isSuperMedManager ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {currentUser?.isSuperMedManager && (
                <TabsTrigger 
                  value="dashboard" 
                  className="flex items-center space-x-2 text-sm font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="tickets" 
                className="flex items-center space-x-2 text-sm font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white"
              >
                <Clipboard className="h-4 w-4" />
                <span>Ticket Management</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard Tab Content - SuperMedManager Only */}
          {currentUser?.isSuperMedManager && (
            <TabsContent value="dashboard" className="mt-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <AnalyticsDashboard 
                  inventoryData={inventoryData}
                />
              </div>
            </TabsContent>
          )}

          {/* Ticket Management Tab Content */}
          <TabsContent value="tickets" className="mt-4 space-y-4">
            {/* Simplified Filters */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-medium text-gray-900">Search & Filter</h3>
                <div className="text-xs text-gray-500">
                  {filteredInventoryData.length} of {inventoryData.length} requests
                </div>
              </div>
              <DashboardFilters 
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
              />
            </div>

            {/* Simplified Requests Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-blue-50">
                <h3 className="text-base font-medium text-gray-900 flex items-center">
                  <Package className="h-5 w-5 mr-2 text-blue-600" />
                  Medicine Requests
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Manage and process medicine requests from healthcare facilities
                </p>
              </div>
              <RequestsTable 
                filteredInventoryData={filteredInventoryData}
                expandedRows={expandedRows}
                setExpandedRows={setExpandedRows}
                medicinesData={medicinesData}
                updateQty={updateQty}
                setUpdateQty={setUpdateQty}
                comments={comments}
                setComments={setComments}
                processingOrders={processingOrders}
                handleStatusChange={handleStatusChange}
                handleApproveRequest={handleApproveRequest}
                handleQtyChanges={handleQtyChanges}
                currentUser={currentUser}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RequestedMedDashboard;