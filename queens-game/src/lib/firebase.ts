import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDlFYcFeyRCfwegTYfw03qVwi0USsKYGJU",
    authDomain: "jeuxvico-f4efd.firebaseapp.com",
    projectId: "jeuxvico-f4efd",
    storageBucket: "jeuxvico-f4efd.firebasestorage.app",
    messagingSenderId: "899860542308",
    appId: "1:899860542308:web:ea4ddd3d423a72c7090071",
    measurementId: "G-KSBPWP5TRX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
