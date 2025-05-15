// hooks/useUserData.js - Custom hook for fetching user data
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../../firebase";

export const useUserData = (userId) => {
  const [userData, setUserData] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userRef = doc(firestore, "users", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          throw new Error("User not found");
        }

        const data = userSnap.data();
        setUserData(data);
        setUserRole(data.role);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load user information. Please try again.");
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  return { /*userData,*/ userRole, loading, error };
};