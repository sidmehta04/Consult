import { Search } from "lucide-react";
import React, { useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

const MedicineModal = ({ open, onClose, filteredInventory }) => {
  const [selectedRows, setSelectedRows] = useState({});
  const [amounts, setAmounts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  const handleCheckboxChange = (medicineName) => {
    setSelectedRows((prev) => ({
      ...prev,
      [medicineName]: !prev[medicineName],
    }));
  };

  const handleAmountChange = (medicineName, value) => {
    setAmounts((prev) => ({
      ...prev,
      [medicineName]: value,
    }));
  };

  const handleSubmit = () => {
    const selectedData = filteredInventory
      .filter((item) => selectedRows[item.medicineName])
      .map((item) => ({
        ...item,
        selectedQuantity: Number(amounts[item.medicineName]) || "",
      }));

    sendData(selectedData);

    // console.log("Selected Medicines:", selectedData);
    onClose(); // Close modal
  };

  const InventaryData = useMemo(() => {
    return filteredInventory?.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.medicineName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [searchTerm, filteredInventory]);

 const sendData = async (selectedData) => {
  try {
    for (const item of selectedData) {
      const docRef = await addDoc(collection(db, "Inventory"), item);
      console.log("Document written with ID:", docRef.id);
    }
    console.log("✅ All data uploaded successfully!");
  } catch (e) {
    console.error("❌ Error adding document: ", e);
  }
};

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 min-h-[500px] flex items-center justify-center bg-slate-100 bg-opacity-80">
      <div className="bg-white min-h-[600px] rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4 ">
            <h2 className="text-xl font-semibold">Select Medicines</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search medicines..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className=" flex justify-end gap-4 ">
            <button
              onClick={handleSubmit}
              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 cursor-pointer"
            >
              Submit
            </button>

            <button
              onClick={onClose}
              className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gray-600 my-2 mb-4 "></div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border">Select</th>
              <th className="px-4 py-2 border">Medicine</th>
              <th className="px-4 py-2 border">Clinic Code</th>
              <th className="px-4 py-2 border">Quantity</th>
              <th className="px-4 py-2 border">Last Updated</th>
              <th className="px-4 py-2 border">Add Quantity</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {InventaryData.map((item, index) => (
              <tr key={index} className="text-center">
                <td className="px-4 py-2 border">
                  <input
                    className="w-5 h-5"
                    type="checkbox"
                    checked={!!selectedRows[item.medicineName]}
                    onChange={() => handleCheckboxChange(item.medicineName)}
                  />
                </td>
                <td className="px-4 py-2 border">{item.medicineName}</td>
                <td className="px-4 py-2 border">{item.clinicCode}</td>
                <td className="px-4 py-2 border">{item.quantity}</td>
                <td className="px-4 py-2 border">{item.lastUpdated}</td>
                <td className="px-4  border">
                  {selectedRows[item.medicineName] && (
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-24"
                      placeholder="Amount"
                      value={amounts[item.medicineName] || ""}
                      onChange={(e) =>
                        handleAmountChange(item.medicineName, e.target.value)
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {InventaryData.length === 0 && (
          <div className="text-center mt-10">No data available</div>
        )}
      </div>
    </div>
  );
};

export default MedicineModal;
