import {
  collection,
  getDocs,
  updateDoc,
  where,
  query,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { InventoryMapping } from "../feedback/mappings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGetMedicine } from "../../hooks/useGetMedicine";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";

const statusColors = {
  open: "bg-red-100 text-red-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const RequestedMedDashboard = ({ currentUser }) => {
  const [inventoryData, setInventoryData] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [loading, setLoading] = useState(true);
  const { medicinesData, fetchMedicinesFromDrive } = useGetMedicine();
  const [updateQty, setUpdateQty] = useState("");

  const targetEmail = currentUser.email;

  const statesAssigned = Object.entries(InventoryMapping)
    .filter(([state, people]) =>
      people.some((person) => person.email === targetEmail)
    )
    .map(([state]) => state);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "Inventory"));
      let inventoryData = [];

      querySnapshot.forEach((doc) => {
        inventoryData.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      if (!currentUser?.isSuperMedManager) {
        inventoryData = inventoryData.filter((item) =>
          statesAssigned?.includes(item.state)
        );
      }

      setInventoryData(inventoryData);
    } catch (error) {
      console.error("❌ Error fetching inventory data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicinesFromDrive();
    fetchInventoryData();
  }, []);

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStatusChange = async (newStatus, clinicCode) => {
    try {
      const q = query(
        collection(db, "Inventory"),
        where("clinicCode", "==", clinicCode)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn("No matching clinic found for clinicCode:", clinicCode);
        return;
      }

      await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          await updateDoc(docSnap.ref, { status: newStatus });
        })
      );

      fetchInventoryData();
      console.log(
        `✅ Status updated to "${newStatus}" for clinicCode ${clinicCode}`
      );
    } catch (error) {
      console.error("❌ Error updating status:", error);
    }
  };

const handleApproveRequest = async (inventory) => {

  // if(Object.keys(updateQty).length == 0) return;

  const clinicCode = inventory.clinicCode;
  const updatedQuantitiesForClinic = updateQty?.[clinicCode] || {};

  // Prepare updated inventory data
  const updatedInventory = {
    ...inventory,
    approvedOrder: inventory?.requestedOrder?.map((data, index) => ({
      ...data,
      approvedQty:
        updatedQuantitiesForClinic?.[index] !== undefined
          ? Number(updatedQuantitiesForClinic[index])
          : data.requestedQuantity || 0,
    })),
  };



  try {
    // Get document(s) from Inventory where clinicCode matches
    const q = query(collection(db, "Inventory"), where("clinicCode", "==", clinicCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn("❌ No matching document found for clinicCode:", clinicCode);
      return;
    }

    // Update each matching document with the approvedOrder array
    await Promise.all(
      querySnapshot.docs.map(async (docSnap) => {
        await updateDoc(docSnap.ref, {
          approvedOrder: updatedInventory.approvedOrder,
          status: "resolved",
        });
      })
    );

   fetchInventoryData();

    console.log(`✅ Firestore updated successfully for clinicCode: ${clinicCode}`);
  } catch (error) {
    console.error("❌ Error updating Firestore:", error);
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
    return <div className="space-y-4">Loding...</div>;
  }

  if (inventoryData.length === 0) {
    return (
      <Card className="p-6 text-center">
        <h3 className="text-lg font-medium">No inventory requests found</h3>
        <p className="text-muted-foreground mt-2">
          {currentUser?.isSuperMedManager
            ? "There are currently no inventory requests in the system."
            : "There are no inventory requests assigned to your states."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow>
              <TableHead className="w-[120px]">Clinic Code</TableHead>
              <TableHead>Nurse Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Assigned TL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead>Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventoryData.map((inventory) => {
              // const currentStatus=inventory.status;
              // const isDisabled =
              //       (currentStatus === "in-progress" && item === "open") ||
              //       (currentStatus === "resolved" && (item === "open" || item === "in-progress"));
              //       (currentStatus === "closed" && (item === "open" || item === "in-progress" || item === "resolved" ));
              return (
                <React.Fragment key={inventory.id}>
                  <TableRow className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="font-medium">
                      {inventory.clinicCode}
                    </TableCell>
                    <TableCell>{inventory.nurseName}</TableCell>
                    <TableCell>{inventory.state}</TableCell>
                    <TableCell>
                      {InventoryMapping[inventory.state]?.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span>{item?.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {item?.role}
                          </Badge>
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={inventory.status}
                        onValueChange={(newStatus) =>{
                          // if (isDisabled) return;
                          handleStatusChange(newStatus, inventory.clinicCode)
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue>
                            <Badge className={statusColors[inventory.status]}>
                              {inventory.status?.toUpperCase()}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => toggleRow(inventory.id)}
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
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
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={()=>handleApproveRequest(inventory)}
                        className="flex items-center gap-1 cursor-pointer text-sm font-medium text-primary hover:underline"
                      >
                        Approve Reqest
                      </button>
                    </TableCell>
                  </TableRow>

                  {expandedRows[inventory.id] && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <div className="border-t bg-gray-50 dark:bg-gray-800 p-4">
                          <h4 className="font-medium mb-3">Request Details</h4>
                          <div className="overflow-x-auto">
                            <Table className="border">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Medicine</TableHead>
                                  <TableHead>Current Qty</TableHead>
                                  <TableHead>Requested Qty</TableHead>
                                  <TableHead>Price</TableHead>
                                  <TableHead>Last Updated</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {inventory?.requestedOrder?.map((item, idx) => {
                                  return (
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">
                                        {item.medicineName}
                                      </TableCell>
                                      <TableCell>{item.quantity}</TableCell>
                                      <TableCell>
                                        {/* {item.selectedQuantity} */}
                                        <input
                                          type="text"
                                          value={
                                            updateQty[
                                              inventory?.clinicCode
                                            ]?.[idx] ?? item?.requestedQuantity
                                          }
                                          style={{ width: "90px" }}
                                          onChange={(e) =>
                                            handleQtyChanges(
                                              inventory?.clinicCode,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {Math.floor(
                                          medicinesData?.find(
                                            (data) =>
                                              data[
                                                "Medicine Name"
                                              ].toLowerCase() ===
                                              item.medicineName?.toLowerCase()
                                          )?.price * ( updateQty[
                                              inventory?.clinicCode
                                            ]?.[idx] ?? item?.requestedQuantity) || 0
                                        )}
                                      </TableCell>
                                      <TableCell>{item.lastUpdated}</TableCell>
                                    </TableRow>
                                  )
                                  })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
              })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default RequestedMedDashboard;
