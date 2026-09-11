const firebaseConfig = {
  apiKey: "AIzaSyCPf2f_DQND4bGSHVedeLQS_PdvBwADMJE",
  authDomain: "popiapp-75aa3.firebaseapp.com",
  projectId: "popiapp-75aa3",
  storageBucket: "popiapp-75aa3.firebasestorage.app",
  messagingSenderId: "993700905294",
  appId: "1:993700905294:web:4e08f6f00f68350c22de1f"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
