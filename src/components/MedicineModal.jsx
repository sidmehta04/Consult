import { Search, X } from "lucide-react";
import React, { useMemo, useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { InventoryMapping } from "./feedback/mappings";
import { useGetMedicine } from "../hooks/useGetMedicine";

const MedicineModal = ({ open, onClose, currentUser, fetchInventoriesData, inventoryData = [] }) => {
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { medicinesData, fetchMedicinesFromDrive } = useGetMedicine();

  const addMedicine = (medicine) => {
    const isAlreadySelected = selectedMedicines.some(item => item.lookup_key === medicine.lookup_key);
    if (!isAlreadySelected) {
      // Get current inventory quantity for this medicine
      const currentInventory = inventoryData.find(item => 
        item.medicineName?.toLowerCase() === medicine['Medicine Name']?.toLowerCase()
      );
      const currentQty = currentInventory?.quantity || 0;
      
      setSelectedMedicines(prev => [...prev, { 
        ...medicine, 
        quantity: 1, 
        currentInventoryQty: currentQty
      }]);
    }
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removeMedicine = (lookup_key) => {
    setSelectedMedicines(prev => prev.filter(item => item.lookup_key !== lookup_key));
  };

  const updateQuantity = (lookup_key, quantity) => {
    setSelectedMedicines(prev => 
      prev.map(item => 
        item.lookup_key === lookup_key ? { 
          ...item, 
          quantity: Math.max(1, parseInt(quantity) || 1),
          totalCost: (Math.max(1, parseInt(quantity) || 1) * (item.price || 0))
        } : item
      )
    );
  };

  const handleSubmit = () => {
    if (selectedMedicines.length === 0) {
      alert("Please select at least one medicine");
      return;
    }
    sendData(selectedMedicines);
  };
  

  const handleClose = () => {
    onClose();
    setSelectedMedicines([]);
    setSearchTerm("");
    setShowDropdown(false);
  };

  // Fetch medicine prices and inventory data
  useEffect(() => {
    if (open) {
      fetchMedicinesFromDrive();
      // Fetch current inventory for the clinic
      // This would typically come from props or a hook
    }
  }, [open]);

  const filteredMedicines = useMemo(() => {
    if (!searchTerm || !medicinesData.length) return [];
    return medicinesData.filter(medicine => 
      medicine['Medicine Name']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.lookup_key?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [searchTerm, medicinesData]);

  const sendData = async (selectedData) => {
    if (!selectedData || selectedData.length === 0) {
      return;
    }

    try {
      setLoading(true);

      const requestedOrder = selectedData.map(medicine => ({
        medicineName: medicine['Medicine Name'],
        medicineKey: medicine.lookup_key,
        requestedQuantity: medicine.quantity,
        currentInventoryQty: medicine.currentInventoryQty || 0,
        unitPrice: medicine.price || 0,
        estimatedCost: (medicine.quantity * (medicine.price || 0)),
        approvedQuantity: null,
        totalCost: 0,
        status: 'pending'
      }));
      
      const totalOrderValue = requestedOrder.reduce((sum, item) => sum + item.estimatedCost, 0);

      const docRef = await addDoc(collection(db, "Inventory"), {
        requestedOrder,
        updatedOrder: null, // Will be filled by TL
        clinicCode: currentUser?.clinicCode,
        nurseName: currentUser?.name,
        nurseEmail: currentUser?.email,
        partnerName: currentUser?.partnerName,
        state: currentUser?.state,
        assignedTL: InventoryMapping[currentUser?.state] || [],
        status: 'open',
        priority: 'medium',
        totalOrderValue,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusHistory: [
          {
            status: 'open',
            updatedBy: currentUser?.name,
            updatedAt: new Date(),
            comments: 'Order created by nurse'
          }
        ]
      });
      
      if (fetchInventoriesData) {
        fetchInventoriesData();
      }
      
      console.log("✅ Medicine request uploaded with Document ID:", docRef.id);

    } catch (e) {
      console.error("❌ Error adding document:", e);
      alert("Error submitting request. Please try again.");
    } finally {
      setLoading(false);
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 min-h-[500px] flex items-center justify-center bg-slate-100 bg-opacity-80">
      <div className="bg-white min-h-[600px] rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4 items-center">
            <h2 className="text-xl font-semibold">Request Medicines</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search medicines by name or code..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(e.target.value.length > 0);
                }}
                onFocus={() => setShowDropdown(searchTerm.length > 0)}
                className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {showDropdown && filteredMedicines.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10 mt-1">
                  {filteredMedicines.map((medicine) => (
                    <div
                      key={medicine.lookup_key}
                      onClick={() => addMedicine(medicine)}
                      className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{medicine['Medicine Name']}</div>
                          <div className="text-xs text-gray-500">Key: {medicine.lookup_key}</div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-medium text-green-600">₹{medicine.price || 0}/unit</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={handleSubmit}
              disabled={loading || selectedMedicines.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : (
                <div className="flex items-center gap-2">
                  <span>Submit Request ({selectedMedicines.length})</span>
                  {selectedMedicines.length > 0 && (
                    <span className="bg-blue-500 px-2 py-1 rounded text-xs">
                      ₹{selectedMedicines.reduce((sum, med) => sum + (med.quantity * (med.price || 0)), 0).toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </button>

            <button
              onClick={handleClose}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gray-300 my-4"></div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Selected Medicines ({selectedMedicines.length})</h3>
          
          {selectedMedicines.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">No medicines selected</div>
              <div className="text-sm">Use the search bar above to find and add medicines to your request</div>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedMedicines.map((medicine) => (
                <div key={medicine.lookup_key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{medicine['Medicine Name']}</div>
                        <div className="text-xs text-gray-500 mt-1">Key: {medicine.lookup_key}</div>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-600">Current Stock:</span>
                            <span className={`font-medium ${
                              (medicine.currentInventoryQty || 0) > 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {medicine.currentInventoryQty || 0}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-600">Unit Price:</span>
                            <span className="font-medium text-blue-600">₹{medicine.price || 0}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => removeMedicine(medicine.lookup_key)}
                        className="text-red-600 hover:text-red-800 p-1 ml-2"
                        title="Remove medicine"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Quantity:</label>
                        <input
                          type="number"
                          min="1"
                          value={medicine.quantity}
                          onChange={(e) => updateQuantity(medicine.lookup_key, e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Estimated Cost</div>
                        <div className="font-bold text-green-600">₹{(medicine.quantity * (medicine.price || 0)).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicineModal;
