// auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  getFirestore,
  setDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* ═════════════════════ FIREBASE CONFIG ═════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyCvQRc84dH2EofxUbcNCVd7drOlS1ihWzo",
  authDomain: "nota-10-f40a1.firebaseapp.com",
  projectId: "nota-10-f40a1",
  storageBucket: "nota-10-f40a1.appspot.com",
  messagingSenderId: "1030556044064",
  appId: "1:1030556044064:web:41beb99b6d695800ac2545"
};

/* ═════════════════════ INITIALIZE FIREBASE ═════════════════════ */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ═════════════════════ SHOW MESSAGE HELPER ═════════════════════
   Uses custom modal from parent page if available.
   Falls back to normal alert() if opened directly.
   This prevents login from breaking.
*/
async function showMessage(message) {
  try {
    if (
      window.parent &&
      window.parent !== window &&
      typeof window.parent.showCustomAlert === "function"
    ) {
      await window.parent.showCustomAlert(message);
    } else {
      alert(message);
    }
  } catch (error) {
    console.error("showMessage error:", error);
    alert(message);
  }
}

/* ═════════════════════ SAVE USER TO FIRESTORE ═════════════════════ */
async function saveUserToFirestore(user, extra = {}) {
  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        name: extra.name || user.displayName || "",
        address: extra.address || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        provider: user.providerData[0]?.providerId || "password",
        createdAt: new Date()
      },
      { merge: true }
    );

    console.log("User saved to Firestore:", user.uid);
  } catch (error) {
    console.error("Error saving user to Firestore:", error);
    throw error;
  }
}

/* ═════════════════════ REGISTER ═════════════════════ */
const signupBtn = document.getElementById("signup");

if (signupBtn) {
  signupBtn.addEventListener("click", async () => {
    const name = document.getElementById("name")?.value.trim();
    const address = document.getElementById("address")?.value.trim();
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;

    if (!name || !address || !email || !password) {
      await showMessage("Please fill all fields.");
      return;
    }

    try {
      const userCredential =
        await createUserWithEmailAndPassword(auth, email, password);

      const user = userCredential.user;

      await saveUserToFirestore(user, {
        name,
        address
      });

      window.parent.showNotification("✅ Registration successful!");

      setTimeout(() => {
        window.parent.location.href = "dashboard.html";
      }, 1500);
    } catch (error) {
      console.error("Registration error:", error);
      await showMessage(error.message);
    }
  });
}

/* ═════════════════════ LOGIN ═════════════════════ */
const loginBtn = document.getElementById("signin");

if (loginBtn && document.getElementById("loginEmail")) {
  loginBtn.addEventListener("click", async () => {
    const email =
      document.getElementById("loginEmail").value.trim();

    const password =
      document.getElementById("loginPassword").value;

    if (!email || !password) {
      await showMessage("Enter email and password.");
      return;
    }

    try {
      const userCredential =
        await signInWithEmailAndPassword(auth, email, password);

      const user = userCredential.user;

      // Ensure Firestore user document exists
      await saveUserToFirestore(user);

      window.parent.showNotification("✅ Login successful!");

      setTimeout(() => {
        window.parent.location.href = "dashboard.html";
      }, 1500);
    } catch (error) {
      console.error("Login error:", error);
      await showMessage(error.message);
    }
  });
}

/* ═════════════════════ GOOGLE SIGN-IN ═════════════════════ */
const googleBtn = document.getElementById("signgoogle");

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save Google user in Firestore
      await saveUserToFirestore(user);
      window.parent.showNotification("✅ Google Sign-In successful!");

      setTimeout(() => {
        window.parent.location.href = "dashboard.html";
      }, 1500);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      await showMessage(error.message);
    }
  });
}