// ==========================================================================
// Firebase Initialization & Firestore Export
// Firebase SDK v10.12.2 loaded via CDN ES modules (No build tools required)
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// REPLACE the values below with your Firebase project configuration
// from the Firebase Console (Project settings > General > Your apps > Web app)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Helper flag to verify if user has replaced placeholder credentials
export const isFirebaseConfigured = () => {
  return (
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID" &&
    !firebaseConfig.apiKey.includes("YOUR_")
  );
};

let dbInstance = null;

if (isFirebaseConfigured()) {
  try {
    const app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
} else {
  console.warn(
    "⚠️ TaskFlow: Firebase is not configured yet! Please update `firebase.js` with your Firebase project credentials."
  );
}

export const db = dbInstance;
export { firebaseConfig };
