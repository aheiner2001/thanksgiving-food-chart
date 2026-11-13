import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyXhVv05H51JMmtZ3gQ_zSWPQ_3PIHwfk",
  authDomain: "sandbox-ed1e2.firebaseapp.com",
  projectId: "sandbox-ed1e2",
  storageBucket: "sandbox-ed1e2.firebasestorage.app",
  messagingSenderId: "741844679458",
  appId: "1:741844679458:web:4ac8334f992d52f3ac837b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
