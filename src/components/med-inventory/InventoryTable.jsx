import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Package, Search, AlertTriangle, Filter } from "lucide-react";
import { useGetMedicine } from "../../hooks/useGetMedicine";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";
import { InventoryMapping } from "../feedback/mappings";
import { toast } from "react-toastify";

const InventoryTable = ({
  inventoryData,
  loading,
  error,
  displayClinicCode,
  lastUpdated,
  cacheStatus,
  loadInventoryData,
  currentUser
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const { medicinesData, fetchMedicinesFromDrive } = useGetMedicine();
  const [selectedRows, setSelectedRows] = useState({});
  const [amounts, setAmounts] = useState({});
  const [open, setOpen] = useState(false);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emptyMedError, setEmptyMedError] = useState('')
  // Fetch medicines data when component mounts
  useEffect(() => {
    fetchMedicinesFromDrive();
  }, []);

  // Optimized filtering with memoization
  const filteredInventory = useMemo(() => {
    if (!inventoryData.length) return [];

    return inventoryData.filter((item) => {
      // Fast text search using toLowerCase for case-insensitive matching
      const matchesSearch =
        !searchTerm ||
        item.medicineName.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Filter by stock status
      switch (filterType) {
        case "low-stock":
          return item.quantity > 0 && item.quantity <= 10;
        case "out-of-stock":
          return item.quantity === 0;
        default:
          return true;
      }
    });
  }, [inventoryData, searchTerm, filterType]);

  // Memoized statistics calculation
  const stats = useMemo(
    () => ({
      total: inventoryData.length,
      outOfStock: inventoryData.filter((item) => item.quantity === 0).length,
      lowStock: inventoryData.filter(
        (item) => item.quantity > 0 && item.quantity <= 10
      ).length,
      inStock: inventoryData.filter((item) => item.quantity > 10).length,
    }),
    [inventoryData]
  );

  const getQuantityBadge = (quantity) => {
    if (quantity === 0) {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          Out of Stock
        </Badge>
      );
    } else if (quantity <= 10) {
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
          Low Stock
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          In Stock
        </Badge>
      );
    }
  };

  const handleCheckboxChange = (medicineName, item) => {

    setSelectedRows((prev) => ({
    ...prev,
    [medicineName]: !prev[medicineName],
  }));

  const isSelected = selectedMedicines.some(
    (med) => med.medicineName === medicineName
  );

  if (isSelected) {
    // Remove from selected
    setSelectedMedicines((prev) =>
      prev.filter((med) => med.medicineName !== medicineName)
    );
  } else {
    const priceObj = medicinesData?.find(
      (data) =>
        data["Medicine Name"]?.toLowerCase() === medicineName.toLowerCase()
    );
    const price = priceObj?.price || 0;
    const lookup_key = priceObj?.lookup_key;
    const totalAmount = price * item.quantity;

    const newMedicine = {
      medicineName,
      price,
      quantity: item.quantity,
      totalAmount,
      lookup_key,
      requestQuantity: amounts[medicineName] || 0,
    };

    setSelectedMedicines((prev) => [...prev, newMedicine]);
  }
};


const handleAmountChange = (medicineName, value) => {
  setEmptyMedError("");
  setAmounts((prev) => ({
    ...prev,
    [medicineName]: value,
  }));

  setSelectedMedicines((prev) =>
    prev.map((med) =>
      med.medicineName === medicineName
        ? {
            ...med,
            requestQuantity: value,
          }
        : med
    )
  );
};

  const sendData = async () => {
    if (!selectedMedicines || selectedMedicines.length === 0) {
      return;
    }
    try {
      setIsSubmitting(true);

      const requestedOrder = selectedMedicines.map(medicine => ({
        medicineName: medicine?.medicineName,
        medicineKey: medicine?.lookup_key,
        requestedQuantity: medicine?.requestQuantity,
        currentInventoryQty: medicine?.quantity || 0,
        unitPrice: medicine.price || 0,
        estimatedCost: (medicine.requestQuantity * (medicine.price || 0)),
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
      
      console.log("✅ Medicine request uploaded with Document ID:", docRef.id);
      toast.success("Medicine request uploaded successfully")

    } catch (e) {
      console.error("❌ Error adding document:", e);
      toast.error("Error submitting request. Please try again.");
    } finally {
      setIsSubmitting(false);
      setOpen(false);
      setSelectedRows({});
      setAmounts({});
      setSearchTerm('');
      setSelectedMedicines([]);
    }
  };

  const handleSubmit = () => {
    if (Object.keys(selectedRows).length !== Object.keys(amounts).length) {
      setEmptyMedError("Please enter the amount for the selected medicine.");
      toast.error("Please enter the amount for the selected medicine.");
      return;
    }
    sendData();
  };

  return (
    <>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Medicines
              </p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.inStock}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.lowStock}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.outOfStock}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search medicines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Items</option>
              <option value="out-of-stock">Out of Stock</option>
              <option value="low-stock">Low Stock</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center px-4 py-2  bg-gradient-to-r from-red-500 via-red-600 to-red-700  text-white rounded-lg hover:from-red-600 hover:via-red-700 hover:to-orange-800 disabled:opacity-50"
        >
          Request for Medicine
        </button>
         <button
              onClick={handleSubmit}
              disabled={loading || selectedMedicines.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : (
                <div className="flex items-center gap-2">
                  <span>Submit Request ({selectedMedicines.length})</span>
                  {selectedMedicines.length > 0 && (
                    <span className="bg-blue-500 px-2 py-1 rounded text-xs">
                      ₹{selectedMedicines.reduce((sum, med) => sum + (med.requestQuantity * (med.price || 0)), 0).toFixed(2)}
                    </span>
                  )}
                </div>
              )}
         </button>
         {
          emptyMedError && (
            <div className="bg-red-400 text-white px-6 py-2 rounded hover:bg-red-500">
                {emptyMedError}
            </div>
          )
         }
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg mt-4 shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Inventory
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => loadInventoryData(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Inventory Found
            </h3>
            <p className="text-gray-600">
              {searchTerm
                ? "No medicines match your search criteria."
                : `No inventory data available for clinic ${displayClinicCode}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {open && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Select Medicine
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Medicine Name
                  </th>
                  {open && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Request Quantity
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount(Rupee)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item, index) => (
                  <tr
                    key={`${item.medicineName}-${index}`}
                    className="hover:bg-gray-50"
                  >
                    {open && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          className="w-5 h-5"
                          type="checkbox"
                          checked={!!selectedRows[item.medicineName]}
                          onChange={() =>
                            handleCheckboxChange(item.medicineName, item)
                          }
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.medicineName}
                      </div>
                    </td>
                    {
                      open && (
                      <td className="px-6 py-2 whitespace-nowrap">
                      { selectedRows[item.medicineName] && (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24"
                            placeholder="Amount"
                            min={0}
                            value={amounts[item.medicineName] || ""}
                            onChange={(e) =>
                              handleAmountChange(
                                item.medicineName,
                                e.target.value
                              )
                            }
                          />
                        )}
                      </td>
                      )
                    }

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-semibold">
                        {item.quantity}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-semibold">
                        ₹
                        {(() => {
                          const medicinePrice = medicinesData?.find(
                            (data) =>
                              data["Medicine Name"]?.toLowerCase() ===
                              item.medicineName?.toLowerCase()
                          )?.price;
                          const totalAmount =
                            (medicinePrice || 0) * (item?.quantity || 0);
                          return Math.floor(totalAmount);
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getQuantityBadge(item.quantity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {item.lastUpdated}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {!loading && !error && filteredInventory.length > 0 && (
        <div className="text-sm text-gray-600 text-center mt-4">
          Showing {filteredInventory.length} of {inventoryData.length} medicines
        </div>
      )}
    </>
  );
};

export default InventoryTable;
