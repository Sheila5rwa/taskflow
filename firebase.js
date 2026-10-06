// ==========================================================================
// Firebase Initialization & Firestore Export
// Firebase SDK v10.12.2 loaded via CDN ES modules (No build tools required)
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase configuration for project: taskflow-sheila
const firebaseConfig = {
  apiKey: "AIzaSyBttEQdZl8CIbcL4Rdzckf6yfpX0zIOl7k",
  authDomain: "taskflow-sheila.firebaseapp.com",
  projectId: "taskflow-sheila",
  storageBucket: "taskflow-sheila.firebasestorage.app",
  messagingSenderId: "650754266163",
  appId: "1:650754266163:web:c0b85ade6147f7e504bf46",
  measurementId: "G-42CBBVHDBX"
};

// Helper flag to verify if user has configured Firebase
export const isFirebaseConfigured = () => {
  return true;
};

let dbInstance = null;

try {
  const app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
} catch (err) {
  console.error("Firebase initialization failed:", err);
}

export const db = dbInstance;
export { firebaseConfig };
