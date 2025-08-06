import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Allowed domains for this application
const allowedDomains = [
  'consulttest-be8ce.web.app',
  'localhost:5173',
  'consultations-fa042.web.app'

];

// Domain validation - prevent unauthorized domain usage
const currentDomain = window.location.host;
if (!allowedDomains.includes(currentDomain)) {
  console.error('Unauthorized domain:', currentDomain);
  // Redirect to blank page or show error
  document.body.innerHTML = '<h1>Access Denied</h1><p>This application is not authorized to run on this domain.</p>';
  throw new Error('Unauthorized domain access');
}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN', 
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  throw new Error('Firebase configuration incomplete');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Additional security: Log domain access for monitoring
if (import.meta.env.PROD) {
  console.log('Firebase initialized for domain:', currentDomain);
}

export { app, auth, firestore, db };


// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries


const medicineDriveConfig = {
  apiKey: "AIzaSyB2-CU6mpyILswNPpJMPQ_m4huC6i42-2E",
  authDomain: "medicine-driveautomation.firebaseapp.com",
  projectId: "medicine-driveautomation",
  storageBucket: "medicine-driveautomation.firebasestorage.app",
  messagingSenderId: "648915873887",
  appId: "1:648915873887:web:bd6b37234ac21d00e32bea"
};


// Initialize or get the already initialized app
const MEDICINE_APP_NAME = "Medicine-DriveAutomation";

const medicineDriveApp = getApps().find(app => app.name === MEDICINE_APP_NAME)
  ? getApp(MEDICINE_APP_NAME)
  : initializeApp(medicineDriveConfig, MEDICINE_APP_NAME);
  
const medicineDb = getFirestore(medicineDriveApp);

export { medicineDb };

