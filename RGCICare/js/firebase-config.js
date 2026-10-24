import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    getDoc, 
    query, 
    orderBy, 
    doc, 
    deleteDoc, 
    updateDoc, 
    Timestamp, 
    where, 
    limit,
    setDoc,
    startAfter
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgm9pUMKIsecyxmRNy55LWggLVSVrN4Uk",
    authDomain: "rgci-management.firebaseapp.com",
    projectId: "rgci-management",
    storageBucket: "rgci-management.firebasestorage.app",
    messagingSenderId: "1056711925495",
    appId: "1:1056711925495:web:4aec050ca41610f2347df2",
    measurementId: "G-MXGH6CVQ85"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// Export everything explicitly
export { 
    db, 
    auth, 
    collection, 
    addDoc, 
    getDocs, 
    getDoc, 
    query, 
    orderBy, 
    doc, 
    deleteDoc, 
    updateDoc, 
    Timestamp, 
    where, 
    limit,
    setDoc,
    startAfter,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
};