import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "../firebase";

import Timeline from "./analytics/Timeline"; // Assuming you have a Timeline component

const AnalyticsDashboard = ({ currentUser }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // for now, use yesterday's data
    today.setDate(today.getDate() - 1);
    tomorrow.setDate(tomorrow.getDate() - 1);

    // Query for the initial load
    const initialQuery = query(
      collection(firestore, "cases"),
      where("createdAt", ">=", Timestamp.fromDate(today)),
      where("createdAt", "<", Timestamp.fromDate(tomorrow)),
      orderBy("createdAt", "desc")
    );

    // Fetch all cases for the initial load
    // TODO: Add doctor and pharmacist availability history fetching
    // TODO: integrate partner filter at this level. - Maybe not? they might want to swap more often.
    const fetchInitialData = async () => {
      try {
        const snapshot = await getDocs(initialQuery);
        const initialData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(), 
        }));
        setData(initialData);
        setLoading(false);

        // Set up real-time listener for new cases
        const realTimeQuery = query(
          collection(firestore, "cases"),
          where("createdAt", ">=", Timestamp.fromDate(new Date()))
        );

        const unsubscribe = onSnapshot(
          realTimeQuery,
          (snapshot) => {
            const newCases = [];
            snapshot.forEach((doc) => {
              const caseData = doc.data();
              if (!initialData.some((item) => item.id === doc.id)) {
                newCases.push({
                  id: doc.id,
                  ...caseData,
                });
              }
            });
            setData((prevData) => [...newCases, ...prevData]);
          },
          (err) => {
            setError(err.message);
          }
        );

        return () => unsubscribe();
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [currentUser.uid]);

  return (
    <div className="analytics-dashboard">
      <h1>Analytics Dashboard</h1>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {!loading && !error && (
        <p>
          {data.length > 0
            ? `Fetched ${data.length} cases.`
            : "No data available for today."}
        </p>
      )}
      {/* Additional components and charts can be added here */}
      {/* A timeline component? */}
      <Timeline data={data}></Timeline>
    </div>
  );
};

export default AnalyticsDashboard;