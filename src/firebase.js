import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";


const firebaseConfig = {
  apiKey: "AIzaSyBGsaFFMmKS7xb1I_ZnFzGG_MZMuhO_YTw",
  authDomain: "andhra-confessions.firebaseapp.com",
  projectId: "andhra-confessions",
  storageBucket: "andhra-confessions.appspot.com",
  messagingSenderId: "939687932777",
  appId: "1:939687932777:web:b8a670f7bf9bcf0b5383f8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);