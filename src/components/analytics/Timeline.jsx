import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const Timeline = ({ data }) => {
  const [granularity, setGranularity] = useState(15); // Granularity in minutes

  const getActiveCases = (timestamp) => {
    // Mock implementation for demonstration
    let totalCases = 0;
    let withDoctors = 0;
    let withPharmacists = 0;

    const doctorsSet = new Set();
    const pharmacistsSet = new Set();

    const nextTimestamp = new Date(timestamp.getTime() + granularity * 60 * 1000);

    for (const caseData of data) {
      const caseStartTime = caseData.createdAt.toDate();
      let caseEndTime;
      if (caseData.status === "doctor_incomplete") {
        caseEndTime = caseData.doctorCompletedAt.toDate();
      } else {
        caseEndTime = caseData.pharmacistCompletedAt?.toDate();
      }
      // NOTE: there are some cases with status 'pending' and no doctorCompletedAt or pharmacistCompletedAt - how to deal with this?
    
      if (caseStartTime < timestamp && caseEndTime > timestamp) {
        totalCases++;
        if (caseData.assignedDoctors.primary) {
          doctorsSet.add(caseData.assignedDoctors.primary);
        }
        if (caseData.pharmacistId) {
          pharmacistsSet.add(caseData.pharmacistId);
        }

        if (caseData.doctorCompletedAt?.toDate() > timestamp){
          withDoctors++;
        } else if (caseData.pharmacistCompletedAt?.toDate() > timestamp){
          withPharmacists++;
        }
      }
      
    }

    return {
      totalActiveCases: totalCases,
      withDoctors: withDoctors,
      withPharmacists: withPharmacists,
      engagedDoctors: doctorsSet.size,
      engagedPharmacists: pharmacistsSet.size
    }
  };

const generateTimeline = () => {
    const timeline = [];
    const startHour = 8; // 8 AM
    const endHour = 22; // 10 PM

    const interval = granularity * 60 * 1000; // Convert granularity to milliseconds
    let startTimeStamp = new Date();

    //for now, use yesterday's data
    startTimeStamp.setDate(startTimeStamp.getDate() - 1);

    startTimeStamp.setHours(startHour, 0, 0, 0);

    for (let time = startTimeStamp.getTime(); time < startTimeStamp.getTime() + (endHour - startHour) * 60 * 60 * 1000; time += interval) {
      const timestamp = new Date(time);

      timeline.push({
        time: `${timestamp.getHours()}:${String(timestamp.getMinutes()).padStart(2, '0')}`,
        activeCases: getActiveCases(timestamp).totalActiveCases,
        doctorCases: getActiveCases(timestamp).withDoctors,
        pharmacistCases: getActiveCases(timestamp).withPharmacists,
        engagedDoctors: getActiveCases(timestamp).engagedDoctors,
        engagedPharmacists: getActiveCases(timestamp).engagedPharmacists,
        // availablePharmacists: getMedicalStaffData(timestamp).availablePharmacists,
        // availableDoctors: getMedicalStaffData(timestamp).availableDoctors,
      });
    }

    return timeline;
  };

  const timelineData = generateTimeline();

  const handleZoom = (newGranularity) => {
    setGranularity(newGranularity);
  };

  return (
    <div className="timeline-chart">
      <h2>Interactive Timeline of Cases (8 AM - 10 PM)</h2>
      <div>
        <button onClick={() => handleZoom(60)}>Hourly</button>
        <button onClick={() => handleZoom(15)}>15-Minute Intervals</button>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={timelineData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="activeCases" stroke="#8884d8" name="Active Cases" />
          <Line type="monotone" dataKey="doctorCases" stroke="#82ca9d" name="Cases with Doctors" />
          <Line type="monotone" dataKey="pharmacistCases" stroke="#ffc658" name="Cases with Pharmacists" />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={timelineData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="engagedDoctors" stroke="#8884d8" name="Engaged Doctors" />
          <Line type="monotone" dataKey="engagedPharmacists" stroke="#82ca9d" name="Engaged Pharmacists" />
          <Line type="monotone" dataKey="availableDoctors" stroke="#82ca9d" name="Available Doctors" />
          <Line type="monotone" dataKey="availablePharmacists" stroke="#ffc658" name="Available Pharmacists" />
        </LineChart>
      </ResponsiveContainer>
      
    </div>
  );
};

export default Timeline;