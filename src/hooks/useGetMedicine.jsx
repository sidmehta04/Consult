import { collection, getDocs } from 'firebase/firestore';
import React, { useState } from 'react'
import { medicineDb } from '../firebase';


export const useGetMedicine = () => {
    const [medicinesData, setMedicinesData]=useState([]);

    const fetchMedicinesFromDrive = async () => {
  try {
    const querySnapshot = await getDocs(collection(medicineDb, "Medicine Price"));
    const medicines = [];

    querySnapshot.forEach((doc) => {
      medicines.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    setMedicinesData(medicines);
    console.log("✅ Medicines fetched:", );
    // setMedicines(medicines); if using React
  } catch (error) {
    console.error("❌ Error fetching medicines from secondary app:", error);
  }
};

  return { medicinesData, fetchMedicinesFromDrive }
}

