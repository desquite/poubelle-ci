// Ce fichier initialise Firebase, Firestore et l'authentification pour toute l'app

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB-iML0Ov75Xxes682O2SkXCviBlWOPXsY",
  authDomain: "poubelle-ci.firebaseapp.com",
  projectId: "poubelle-ci",
  storageBucket: "poubelle-ci.firebasestorage.app",
  messagingSenderId: "208862789714",
  appId: "1:208862789714:web:e4315be6f18d3114429f8b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);