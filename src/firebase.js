// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAaYqE22EemaN6YGu7DbkidyV-Rh-X3JjA",
  authDomain: "consultations-fa042.firebaseapp.com",
  projectId: "consultations-fa042",
  storageBucket: "consultations-fa042.firebasestorage.app",
  messagingSenderId: "790687866611",
  appId: "1:790687866611:web:1ca05cecdf493a4a7ae186"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

export { app, auth, firestore };