/* ═════════════ FIREBASE PROFILE LOAD ═════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getDoc,
  getCountFromServer,
  getDocs,
  doc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* FIREBASE CONFIG */

const firebaseConfig = {
  apiKey: "AIzaSyCvQRc84dH2EofxUbcNCVd7drOlS1ihWzo",
  authDomain: "nota-10-f40a1.firebaseapp.com",
  projectId: "nota-10-f40a1",
  storageBucket: "nota-10-f40a1.appspot.com",
  messagingSenderId: "1030556044064",
  appId: "1:1030556044064:web:41beb99b6d695800ac2545"
};

/* INIT FIREBASE */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* save to firestore */
async function saveToFirestore(note) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "notes"), {
      uid: user.uid,
      title: note.title.trim(),
      content: note.content.trim(),
      category: note.category,
      isPinned: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error("Firestore save error:", error);
    showNotification("Error saving to cloud.");
  }
}
async function saveJournalToFirestore(content, mood) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "journals"), {
      uid: user.uid,
      content: content.trim(),
      mood: mood,
      createdAt: serverTimestamp()
    });

    showNotification("Journal saved successfully!");

  } catch (error) {
    console.error("Journal save error:", error);
    showNotification("Error saving journal.");
  }
}
async function saveComfortToFirestore(content) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "thoughts"), {
      uid: user.uid,
      content: content.trim(),
      type: "comfort",
      createdAt: serverTimestamp()
    });

    showNotification("Thought saved successfully!");

  } catch (error) {
    console.error("Comfort save error:", error);
    showNotification("Error saving thought.");
  }
}
async function saveThoughtOfDayToFirestore(content) {
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification("Please log in first.");
      return;
    }

    await addDoc(collection(db, "community_thoughts"), {
      uid: user.uid,
      content: content.trim(),
      author: "Anonymous",
      source: "user",
      approved: true,
      createdAt: serverTimestamp()
    });

    showNotification("Thought shared anonymously ✨");
  } catch (error) {
    console.error("Thought save error:", error);
    showNotification("Error sharing thought.");
  }
}
/* LOAD USER */
onAuthStateChanged(auth, async (user) => {
  // Always update sidebar profile first
  await loadSidebarProfile();

  if (user) {
    // Logged-in user → disable guest mode
    localStorage.removeItem("guestMode");

    // Close login popup
    closeLogin();

    // Load profile details into Personal Details page
    await loadProfileDetails();

    // Get latest name from Firestore
    const currentName =
      document.getElementById("profileName")?.value ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "User";

    // Update top-right profile avatar
    // If photoURL exists → show photo
    // Otherwise → show initials from currentName
    updateTopProfile(user, currentName);

    // Load user-specific notes
    loadNotesFromFirestore("work", "workNotesContainer");
    loadNotesFromFirestore("ideas", "ideasNotesContainer");
    loadNotesFromFirestore("todo", "todoNotesContainer");
    loadNotesFromFirestore("quick", "quickNotesContainer");
    loadNotesFromFirestore("study", "studyNotesContainer");
    loadPinnedNotes();
    loadHomeDashboardData();
    // Load other user data
    loadLatestJournal();
    loadComfortThoughts();
    loadCommunityThoughts();
  } else {
    // No user logged in

    // Guest profile in sidebar and top-right avatar
    updateTopProfile(null, "Guest");

    // Load guest profile details if account page is opened
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const profileAddress = document.getElementById("profileAddress");
    const profilePhone = document.getElementById("profilePhone");

    if (profileName) profileName.value = "Guest";
    if (profileEmail) profileEmail.value = "";
    if (profileAddress) profileAddress.value = "";
    if (profilePhone) profilePhone.value = "";

    // Community thoughts are public
    loadCommunityThoughts();
  }
});
/* ═════════════════════════════════════════════════════════════════ */
/* NOTA APP - JavaScript                                            */
/* Page Navigation, Sidebar Controls & Interactions                 */
/* ═════════════════════════════════════════════════════════════════ */

const menuBtn = document.getElementById('menuBtn');
const overlay = document.getElementById('overlay');
const sidebar = document.getElementById('sidebar');

/* ═════════════════════ SIDEBAR TOGGLE ═════════════════════ */
function openSidebar() {
  document.body.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  document.body.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
}

if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    document.body.classList.contains('open') ? closeSidebar() : openSidebar();
  });
}

if (overlay) {
  overlay.addEventListener('click', closeSidebar);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSidebar();
});

/* ═════════════════════ ACCORDION TOGGLE ═════════════════════ */
function toggleGrp(id) {
  const element = document.getElementById(id);
  element.classList.toggle('grp-open');

  // Update aria-expanded for accessibility
  const button = element.querySelector('.sb-toggle');
  if (button) {
    const isOpen = element.classList.contains('grp-open');
    button.setAttribute('aria-expanded', isOpen);
  }
}
window.toggleGrp = toggleGrp;
/* ═════════════════════ PAGE LOADING SYSTEM ═════════════════════ */
function isGuestUser() {
  return localStorage.getItem("guestMode") === "true";
}
function loadPage(pageId, event) {
  if (event) {
    event.preventDefault();
  }

  // Guest users can access only Home and Quick Notes
  if (isGuestUser()) {
    const allowedPages = ["home", "quicknotes"];

    if (!allowedPages.includes(pageId)) {
      showNotification("Please log in to access this feature.");

      if (typeof openLogin === "function") {
        openLogin();
      }

      return;
    }
  }

  // Hide all sections
  const sections = document.querySelectorAll(".page-section");
  sections.forEach(section => {
    section.classList.remove("active");
  });

  // Show selected page
  const selectedPage = document.getElementById(`page-${pageId}`);
  if (selectedPage) {
    selectedPage.classList.add("active");
  }

  // Update active sidebar link
  updateActiveLink(pageId);

  // Close sidebar on mobile
  if (window.innerWidth < 860) {
    closeSidebar();
  }

  // Update browser title
  updatePageTitle(pageId);

  // Scroll to top
  window.scrollTo(0, 0);
}
window.loadPage = loadPage;
/* ═════════════════════ UPDATE ACTIVE LINK ═════════════════════ */
function updateActiveLink(pageId) {
  // Remove active class from all sidebar items
  document.querySelectorAll('ul.sb-sub li').forEach(li => {
    li.classList.remove('active');
  });

  // Find and activate the current link
  const links = document.querySelectorAll('ul.sb-sub li a');
  links.forEach(link => {
    const href = link.getAttribute('onclick');
    if (href && href.includes(`loadPage('${pageId}'`)) {
      link.closest('li').classList.add('active');
    }
  });
}

/* ═════════════════════ UPDATE PAGE TITLE ═════════════════════ */
function updatePageTitle(pageId) {
  const titles = {
    home: 'Nota - Welcome',
    addnotes: 'Nota - Add Notes',
    allnotes: 'Nota - All Notes',
    pinned: 'Nota - Pinned Notes',
    studynotes: 'Nota - Study Notes',
    trash: 'Nota - Trash',
    journal: 'Nota - Daily Journal',
    ideas: 'Nota - Ideas Board',
    quicknotes: 'Nota - Quick Notes',
    'ai-summary': 'Nota - AI Summary',
    account: 'Nota - Account Settings',
    notifications: 'Nota - Notifications',
    privacy: 'Nota - Privacy & Security',
    support: 'Nota - Support'
  };

  document.title = titles[pageId] || 'Nota';
}

/* ═════════════════════ GO HOME ═════════════════════ */
function goHome() {
  loadPage("home");
}
window.goHome = goHome;

/* ═════════════════════ FORM HANDLERS ═════════════════════ */

// Add Notes Form
const notesForm = document.getElementById('notesForm');

if (notesForm) {
  notesForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const category = document.getElementById('noteCategory').value;

    if (!title || !content) {
      showNotification("Please fill all fields.");
      return;
    }

    const isGuest = localStorage.getItem("guestMode") === "true";

    const newNote = {
      id: Date.now(),
      title,
      content,
      category,
      date: new Date().toLocaleString()
    };

    if (isGuest) {
      let notes = JSON.parse(localStorage.getItem('notes')) || [];

      if (notes.length >= 3) {
        showNotification("Free version limit reached. Please log in.");
        openLogin();
        return;
      }

      notes.push(newNote);
      localStorage.setItem('notes', JSON.stringify(notes));
    } else {
      await saveToFirestore(newNote);
    }

    showNotification("Note saved successfully!");
    notesForm.reset();
  });
}

// Journal Form
/* ═════════════ DAILY JOURNAL FORM ═════════════ */

const journalForm = document.getElementById("journalForm");

if (journalForm) {
  journalForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const journalEntry =
      document.getElementById("journalEntry");

    const content = journalEntry.value.trim();

    // Validation
    if (!content) {
      showNotification("Please write something in your journal.");
      return;
    }

    // Get selected mood
    const activeMood =
      document.querySelector(".mood.active");

    const mood = activeMood
      ? activeMood.querySelector("p").innerText
      : "Okay";

    // Guest Mode Check
    const isGuest =
      localStorage.getItem("guestMode") === "true";

    // Guest users save to localStorage
    if (isGuest) {
      const journals =
        JSON.parse(localStorage.getItem("journals")) || [];

      journals.unshift({
        id: Date.now(),
        content: content,
        mood: mood,
        createdAt: new Date().toISOString()
      });

      localStorage.setItem(
        "journals",
        JSON.stringify(journals)
      );

      showNotification("Journal saved successfully!");
      loadLatestJournalFromLocalStorage();
    }
    // Logged-in users save to Firestore
    else {
      await saveJournalToFirestore(content, mood);
      loadLatestJournal();
    }

    // Reset textarea
    journalEntry.value = "";

    // Reset counter
    const journalCount =
      document.getElementById("journalCount");

    if (journalCount) {
      journalCount.innerText = "0";
    }

    // Reset mood selection to first mood
    const moods =
      document.querySelectorAll(".mood");

    moods.forEach((moodBox) => {
      moodBox.classList.remove("active");
    });

    if (moods.length > 0) {
      moods[0].classList.add("active");
    }
  });
}

// Quick Notes Form
const quickForm = document.getElementById("quickForm");

if (quickForm) {
  quickForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const quickInput = document.getElementById("quickInput");
    const content = quickInput.value.trim();

    if (!content) {
      showNotification("Please write something first.");
      return;
    }

    // Generate title from first 3 words
    const words = content.split(/\s+/);
    let title = words.slice(0, 3).join(" ");

    if (title.length > 30) {
      title = title.substring(0, 30) + "...";
    }

    // Capitalize each word
    title = title.replace(/\b\w/g, c => c.toUpperCase());

    const newQuickNote = {
      id: Date.now(),
      title,
      content,
      category: "quick",
      date: new Date().toLocaleString()
    };

    // Save to localStorage (guest mode)
    // Check guest mode
    const isGuest =
      localStorage.getItem("guestMode") === "true";

    // Load existing quick notes
    const quickNotes =
      JSON.parse(localStorage.getItem("quicknotes")) || [];

    // Guest limit: maximum 3 quick notes
    if (isGuest && quickNotes.length >= 3) {
      showNotification(
        "Free version allows only 3 quick notes. Please log in."
      );

      if (typeof openLogin === "function") {
        openLogin();
      }

      return;
    }

    // Save note to localStorage
    // Save note to localStorage
    quickNotes.unshift(newQuickNote);

    localStorage.setItem(
      "quicknotes",
      JSON.stringify(quickNotes)
    );

    // Save to Firestore for logged-in users
    if (!isGuest) {
      await saveToFirestore(newQuickNote);
    }

    showNotification("Quick note saved!");
    quickForm.reset();

    if (isGuest) {
      // Show notes immediately from localStorage
      renderQuickNotes(quickNotes);
    } else {
      // Reload notes from Firestore for logged-in users
      loadNotesFromFirestore("quick", "quickNotesContainer");
    }
  });
}

// Support Form
const supportForm = document.getElementById('supportForm');
if (supportForm) {
  supportForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const subject = document.getElementById('subject').value;
    const message = document.getElementById('message').value;

    // Here you would send to backend/email
    console.log('Support ticket:', { subject, message });
    showNotification('Support request sent! We\'ll get back to you soon.');
    supportForm.reset();
  });
}
function renderQuickNotes(notes) {
  const container =
    document.getElementById("quickNotesContainer");

  if (!container) return;

  if (!notes.length) {
    container.innerHTML = "<p>No quick notes yet.</p>";
    return;
  }

  container.innerHTML = notes.map(note =>
    createNoteHTML(note, note.id)
  ).join("");
}
/* ═════════════════════ NOTIFICATIONS ═════════════════════ */
function showNotification(message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #2ecc7f;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 2000;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;

  document.body.appendChild(notification);

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
window.showNotification = showNotification;

/* ═════════════════════ NAVIGATION LINKS ═════════════════════ */
// Add click handlers to all sidebar navigation links
document.querySelectorAll('ul.sb-sub li a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    // The onclick attribute will handle page loading
  });
});

/* ═════════════════════ RESPONSIVE SIDEBAR ═════════════════════ */
// Close sidebar when resizing to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth >= 860) {
    closeSidebar();
  }
});

/* ═════════════════════ NOTIFICATION BUTTON ═════════════════════ */
const notifButton = document.querySelector('.nav-notif');
if (notifButton) {
  notifButton.addEventListener('click', () => {
    showNotification('You have no new notifications!');
  });

  notifButton.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      showNotification('You have no new notifications!');
    }
  });
}

/* ═════════════════════ PROFILE CLICK HANDLER ═════════════════════ */
const profileSection = document.querySelector('.sb-profile');
if (profileSection) {
  profileSection.addEventListener('click', () => {
    loadPage('account');
  });
}

/* ═════════════════════ INITIALIZATION ═════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const homePage = document.getElementById('page-home');
  if (homePage) {
    homePage.classList.add('active');
  }

  updateNotesCount();
  setupKeyboardShortcuts();

  // Load guest quick notes
  const isGuest = localStorage.getItem("guestMode") === "true";

  if (isGuest) {
    const quickNotes =
      JSON.parse(localStorage.getItem("quicknotes")) || [];
    renderQuickNotes(quickNotes);

    // Apply guest mode dimming on sidebar
    document.body.classList.add("guest-mode");
  }
});
/* ═════════════════════ UPDATE NOTES COUNT ═════════════════════ */
function updateNotesCount() {
  const notes = JSON.parse(localStorage.getItem('notes')) || [];
  const notesCount = notes.length;

  // You can update UI with count if needed
  console.log(`Total notes: ${notesCount}`);
}

/* ═════════════════════ KEYBOARD SHORTCUTS ═════════════════════ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }

    // Ctrl/Cmd + N for new note
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      loadPage('addnotes');
    }
  });
}

/* ═════════════════════ SMOOTH SCROLL ═════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href !== '#') {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});

/* ═════════════════════ LOCAL STORAGE MANAGEMENT ═════════════════════ */
window.clearAllData = function () {
  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    localStorage.removeItem('notes');
    localStorage.removeItem('journal');
    localStorage.removeItem('quicknotes');
    showNotification('All data cleared!');
  }
};

window.exportData = function () {
  const data = {
    notes: JSON.parse(localStorage.getItem('notes')) || [],
    journal: JSON.parse(localStorage.getItem('journal')) || [],
    quicknotes: JSON.parse(localStorage.getItem('quicknotes')) || [],
    exportDate: new Date().toISOString()
  };

  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nota-backup-${Date.now()}.json`;
  link.click();

  showNotification('Data exported successfully!');
};

/* ═════════════════════ UTILITY FUNCTIONS ═════════════════════ */

// Format date to readable format
window.formatDate = function (dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Debounce function for performance
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Log page analytics (optional)
function logPageView(pageId) {
  console.log(`Page viewed: ${pageId} at ${new Date().toISOString()}`);
  // You can send this to analytics service
}

// Enhanced logging for debugging
console.log('Nota App Initialized - v2.4.1');
console.log('Browser:', navigator.userAgent);
console.log('Screen Size:', window.innerWidth + 'x' + window.innerHeight);
/* ═════════════════════ LOGIN / REGISTER POPUP ═════════════════════ */

const loginOverlay = document.getElementById("loginOverlay");
const loginPopup = document.getElementById("loginPopup");
const loginFrame = document.querySelector("#loginPopup iframe");

// OPEN LOGIN
function openLogin() {
  loginOverlay.style.display = "block";
  loginPopup.style.display = "block";
  loginFrame.src = "login.html";
}

// OPEN REGISTER
function openRegister() {
  loginOverlay.style.display = "block";
  loginPopup.style.display = "block";
  loginFrame.src = "register.html";
}

// CLOSE POPUP
function closeLogin() {
  loginOverlay.style.display = "none";
  loginPopup.style.display = "none";
  loginFrame.src = ""; // reset (important)
}

// CLICK OUTSIDE TO CLOSE
if (loginOverlay) {
  loginOverlay.addEventListener("click", closeLogin);
}

// ESC KEY CLOSE
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLogin();
  }
});
async function startFree() {
  // Force sign out any existing Firebase session
  if (auth.currentUser) {
    await signOut(auth);
  }

  // Enable guest mode
  localStorage.setItem("guestMode", "true");

  // Go to dashboard
  window.location.href = "dashboard.html";
}
/* =========================================================
   PROFILE DETAILS (ACCOUNT PAGE)
   Replace your existing enableEdit() and saveProfile()
   functions with this complete version.
   ========================================================= */

async function loadProfileDetails() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let userData = {};

    if (userSnap.exists()) {
      userData = userSnap.data();
    }

    // Fill form fields
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const profileAddress = document.getElementById("profileAddress");
    const profilePhone = document.getElementById("profilePhone");

    if (profileName) {
      profileName.value =
        userData.name ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "User";
    }

    if (profileEmail) {
      profileEmail.value =
        user.email || "";
    }

    if (profileAddress) {
      profileAddress.value =
        userData.address || "";
    }

    if (profilePhone) {
      profilePhone.value =
        userData.phone || "";
    }

  } catch (error) {
    console.error("Error loading profile details:", error);
  }
}

/* Enable editing */
function enableEdit() {
  const editableFields = [
    "profileName",
    "profileAddress",
    "profilePhone"
  ];

  editableFields.forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.removeAttribute("readonly");
    }
  });

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.style.display = "inline-block";
  }
}

/* Save profile changes */
async function saveProfile() {
  const user = auth.currentUser;

  if (!user) {
    showNotification("Please log in first.");
    return;
  }

  try {
    const name =
      document.getElementById("profileName")?.value.trim() || "";

    const address =
      document.getElementById("profileAddress")?.value.trim() || "";

    const phone =
      document.getElementById("profilePhone")?.value.trim() || "";

    // Update Firestore users collection
    await updateDoc(doc(db, "users", user.uid), {
      name,
      address,
      phone,
      updatedAt: serverTimestamp()
    });

    // Make fields readonly again
    ["profileName", "profileAddress", "profilePhone"]
      .forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
          input.setAttribute("readonly", true);
        }
      });

    // Hide save button
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) {
      saveBtn.style.display = "none";
    }

    // Update sidebar profile name and initials
    await loadSidebarProfile();

    // Update top-right avatar initials or photo
    updateTopProfile(user, name);

    showNotification("Profile updated successfully!");

  } catch (error) {
    console.error("Error saving profile:", error);
    showNotification("Failed to update profile.");
  }
}

/* Make functions global */
window.enableEdit = enableEdit;
window.saveProfile = saveProfile;
window.loadProfileDetails = loadProfileDetails;
/* DAILY JOURNAL MOOD SELECT */

const moods = document.querySelectorAll(".mood");

moods.forEach(mood => {
  mood.addEventListener("click", () => {

    moods.forEach(item => {
      item.classList.remove("active");
    });

    mood.classList.add("active");
  });
});

/* CHARACTER COUNT */

const journalEntry = document.getElementById("journalEntry");
const journalCount = document.getElementById("journalCount");

if (journalEntry) {

  journalEntry.addEventListener("input", () => {
    journalCount.innerText = journalEntry.value.length;
  });

}
/* ═════════════ COMFORT CORNER ═════════════ */

const comfortText = document.getElementById("comfortText");
const comfortCount = document.getElementById("comfortCount");

if (comfortText) {

  comfortText.addEventListener("input", () => {
    comfortCount.innerText = comfortText.value.length;
  });

}

/* LET GO BUTTON */

const letGoBtn = document.querySelector(".letgo-btn");

if (letGoBtn) {

  letGoBtn.addEventListener("click", () => {

    comfortText.value = "";
    comfortCount.innerText = "0";

    showNotification("Your thoughts have been released 💜");

  });

}

/* SAVE THOUGHT */

/* ═════════════ SAVE THOUGHT ═════════════ */

const saveThoughtBtn = document.querySelector(".save-thought-btn");

if (saveThoughtBtn) {
  saveThoughtBtn.addEventListener("click", async () => {
    const content = comfortText.value.trim();

    if (!content) {
      showNotification("Write something first.");
      return;
    }

    const isGuest =
      localStorage.getItem("guestMode") === "true";

    /* Guest users -> localStorage */
    if (isGuest) {
      const savedThoughts =
        JSON.parse(localStorage.getItem("comfortThoughts")) || [];

      savedThoughts.unshift({
        id: Date.now(),
        content: content,
        createdAt: new Date().toISOString()
      });

      localStorage.setItem(
        "comfortThoughts",
        JSON.stringify(savedThoughts)
      );

      showNotification("Thought saved locally 💗");
    }

    /* Logged-in users -> Firestore */
    else {
      await saveComfortToFirestore(content);
      loadComfortThoughts();
    }

    /* Reset textarea */
    comfortText.value = "";
    comfortCount.innerText = "0";
  });
}
/* ═════════════ THOUGHT OF THE DAY ═════════════ */
/* ═════════════ THOUGHT OF THE DAY ═════════════ */

const thoughtInput = document.getElementById("thoughtInput");
const thoughtCount = document.getElementById("thoughtCount");
const liveThoughtText = document.getElementById("liveThoughtText");

/* Character Counter */
if (thoughtInput && thoughtCount) {
  thoughtInput.addEventListener("input", () => {
    thoughtCount.innerText = thoughtInput.value.length;
  });
}

/* Share Button */
const thoughtShareBtn = document.querySelector(".thought-share-btn");

if (thoughtShareBtn) {
  thoughtShareBtn.addEventListener("click", async () => {
    const text = thoughtInput.value.trim();

    if (!text) {
      showNotification("Write something first 💭");
      return;
    }

    await saveThoughtOfDayToFirestore(text);

    thoughtInput.value = "";
    thoughtCount.innerText = "0";
  });
}

/* Global Thoughts Array */
/* ═════════════ THOUGHT OF THE DAY ROTATION ═════════════ */

let communityThoughts = [];
let thoughtIndex = 0;
let thoughtRotationInterval = null;

function loadCommunityThoughts() {
  const q = query(
    collection(db, "community_thoughts"),
    where("approved", "==", true),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    communityThoughts = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.content && data.content.trim() !== "") {
        communityThoughts.push(data.content.trim());
      }
    });

    // Default thought if collection is empty
    if (communityThoughts.length === 0) {
      communityThoughts = [
        "Sometimes the smallest step in the right direction ends up being the biggest step of your life."
      ];
    }

    // Reset index
    thoughtIndex = 0;

    // Show first thought immediately
    if (liveThoughtText) {
      liveThoughtText.style.opacity = "1";
      liveThoughtText.innerText = communityThoughts[0];
    }

    // Clear previous interval
    if (thoughtRotationInterval) {
      clearInterval(thoughtRotationInterval);
    }

    // Start rotation only if more than one thought exists
    if (communityThoughts.length > 1) {
      thoughtRotationInterval = setInterval(() => {
        rotateThoughts();
      }, 5000);
    }
  });
}

function rotateThoughts() {
  if (!liveThoughtText) return;
  if (communityThoughts.length <= 1) return;

  liveThoughtText.style.opacity = "0";

  setTimeout(() => {
    thoughtIndex =
      (thoughtIndex + 1) % communityThoughts.length;

    liveThoughtText.innerText =
      communityThoughts[thoughtIndex];

    liveThoughtText.style.opacity = "1";
  }, 500);
}
window.openLogin = openLogin;
window.openRegister = openRegister;
window.startFree = startFree;
window.enableEdit = enableEdit;
window.saveProfile = saveProfile;
function createNoteHTML(note, docId) {
  let formattedDate = "Just now";

  // Firestore Timestamp
  if (note.createdAt && typeof note.createdAt.toDate === "function") {
    formattedDate = note.createdAt.toDate().toLocaleString();
  }
  // LocalStorage date string
  else if (note.date) {
    formattedDate = note.date;
  }

  const pinIcon = note.isPinned ? "📌" : "📍";
  const pinTitle = note.isPinned ? "Unpin Note" : "Pin Note";

  return `
    <div class="note-item ${note.isPinned ? "pinned" : ""}">
      <div class="note-header">
        <h3>${note.isPinned ? "📌 " : ""}${note.title}</h3>

        <div class="note-actions">

          <!-- PIN BUTTON -->
          <button
            class="note-action-btn pin-btn"
            onclick="togglePinNote('${docId}', ${note.isPinned ? "true" : "false"})"
            title="${pinTitle}">
            ${pinIcon}
          </button>

          <!-- EDIT BUTTON -->
          <button
            class="note-action-btn edit-btn"
            onclick="editQuickNote('${docId}')"
            title="Edit Note">
            ✏️
          </button>

          <!-- DELETE BUTTON -->
          <button
            class="note-action-btn delete-btn"
            onclick="deleteQuickNote('${docId}')"
            title="Delete Note">
            🗑️
          </button>

        </div>
      </div>

      <p>${note.content}</p>
      <span class="note-date">${formattedDate}</span>
    </div>
  `;
}
// Replace your existing loadNotesFromFirestore() function with this version

function loadNotesFromFirestore(category, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "notes"),
    where("uid", "==", user.uid),
    where("category", "==", category),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    // Show category-specific empty state
    if (snapshot.empty) {
      const emptyStates = {
        work: `
          <div class="quicknotes-empty-state">
            <div class="quicknotes-empty-icon">💼</div>
            <h4>No work notes yet</h4>
            <p>Your work related notes will appear here.</p>
          </div>
        `,
        ideas: `
          <div class="quicknotes-empty-state">
            <div class="quicknotes-empty-icon">💡</div>
            <h4>No ideas notes yet</h4>
            <p>Your best ideas will appear here.</p>
          </div>
        `,
        todo: `
          <div class="quicknotes-empty-state">
            <div class="quicknotes-empty-icon">✅</div>
            <h4>No to-do notes yet</h4>
            <p>Your tasks and reminders will appear here.</p>
          </div>
        `,
        study: `
          <div class="quicknotes-empty-state">
            <div class="quicknotes-empty-icon">📘</div>
            <h4>No study notes yet</h4>
            <p>Your study materials will appear here.</p>
          </div>
        `,
        quick: `
          <div class="quicknotes-empty-state">
            <div class="quicknotes-empty-icon">📝</div>
            <h4>No quick notes yet</h4>
            <p>Write your first quick note and it will appear here.</p>
          </div>
        `
      };

      container.innerHTML =
        emptyStates[category] ||
        `
          <div class="quicknotes-empty-state">
            <div class="quicknotes-empty-icon">📄</div>
            <h4>No notes yet</h4>
            <p>Your notes will appear here.</p>
          </div>
        `;

      return;
    }

    // Render notes
    let html = "";

    snapshot.forEach((docSnap) => {
      html += createNoteHTML(
        docSnap.data(),
        docSnap.id
      );
    });

    container.innerHTML = html;
  }, (error) => {
    console.error(`Error loading ${category} notes:`, error);

    container.innerHTML = `
      <div class="quicknotes-empty-state">
        <div class="quicknotes-empty-icon">⚠️</div>
        <h4>Unable to load notes</h4>
        <p>Please refresh the page and try again.</p>
      </div>
    `;
  });
}
/* =========================================================
   AI SUMMARY JAVASCRIPT
   Add this to your script.js
   ========================================================= */

const inputText = document.getElementById("inputText");
const wordCount = document.getElementById("wordCount");
const styleButtons = document.querySelectorAll(".ai-style-btn");
const summarizeBtn = document.getElementById("summarizeBtn");
const summaryOutput = document.getElementById("summaryOutput");
const copyBtn = document.getElementById("copyBtn");

let selectedStyle = "brief";
let currentSummary = "";

/* Word Count */
if (inputText) {
  inputText.addEventListener("input", () => {
    const text = inputText.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    wordCount.textContent = `${words} word${words !== 1 ? "s" : ""}`;
  });
}

/* Style Selection */
styleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    styleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedStyle = btn.dataset.style;
  });
});

/* Summarize */
if (summarizeBtn) {
  summarizeBtn.addEventListener("click", summarizeText);
}

async function summarizeText() {
  const text = inputText.value.trim();

  if (!text) {
    showError("Please enter some text to summarize.");
    return;
  }

  if (text.split(/\s+/).length < 10) {
    showError("Please enter at least 10 words for a meaningful summary.");
    return;
  }

  summarizeBtn.disabled = true;
  summarizeBtn.innerHTML =
    '<span class="ai-spinner"></span> Summarizing...';

  summaryOutput.classList.remove("empty", "error");
  summaryOutput.textContent = "Generating summary...";
  copyBtn.style.display = "none";

  try {
    const response = await fetch(
      "https://textsumarizer.onrender.com/api/summarize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text,
          style: selectedStyle
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.summary) {
      throw new Error("No summary received.");
    }

    currentSummary = data.summary;
    summaryOutput.textContent = currentSummary;
    copyBtn.style.display = "inline-flex";

    await saveSummaryToFirestore(
      text,
      currentSummary,
      selectedStyle
    );

    loadHomeDashboardData();
  } catch (error) {
    showError("Failed to generate summary: " + error.message);
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.innerHTML = "✨ Summarize";
  }
}

/* Error */
function showError(message) {
  summaryOutput.textContent = message;
  summaryOutput.classList.remove("empty");
  summaryOutput.classList.add("error");
}

/* Copy */
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!currentSummary) return;

    try {
      await navigator.clipboard.writeText(currentSummary);

      copyBtn.classList.add("copied");
      copyBtn.textContent = "✓ Copied";

      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyBtn.textContent = "📋 Copy";
      }, 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  });
}
async function deleteQuickNote(docId) {
  const confirmDelete = await showCustomConfirm(
    "Are you sure you want to delete this quick note?"
  );

  if (!confirmDelete) return;

  const isGuest =
    localStorage.getItem("guestMode") === "true";

  // Guest mode: delete from localStorage
  if (isGuest) {
    let quickNotes =
      JSON.parse(localStorage.getItem("quicknotes")) || [];

    quickNotes = quickNotes.filter(
      note => String(note.id) !== String(docId)
    );

    localStorage.setItem(
      "quicknotes",
      JSON.stringify(quickNotes)
    );

    renderQuickNotes(quickNotes);
    showNotification("Quick note deleted.");
    return;
  }

  // Logged-in user: delete from Firestore
  try {
    await deleteDoc(doc(db, "notes", docId));
    showNotification("Quick note deleted.");
  } catch (error) {
    console.error("Delete error:", error);
    showNotification("Failed to delete note.");
  }
}
async function editQuickNote(docId) {
  try {
    const docRef = doc(db, "notes", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      showNotification("Note not found.");
      return;
    }

    const note = docSnap.data();

    const newContent = await showCustomPrompt(
      "Edit your quick note:",
      note.content
    );
    if (newContent === null) return;

    const trimmed = newContent.trim();

    if (!trimmed) {
      showNotification("Note cannot be empty.");
      return;
    }

    const words = trimmed.split(/\s+/);
    let newTitle = words.slice(0, 3).join(" ");

    if (newTitle.length > 30) {
      newTitle = newTitle.substring(0, 30) + "...";
    }

    newTitle = newTitle.replace(/\b\w/g, c => c.toUpperCase());

    await updateDoc(docRef, {
      title: newTitle,
      content: trimmed,
      updatedAt: serverTimestamp()
    });

    showNotification("Quick note updated.");
  } catch (error) {
    console.error("Edit error:", error);
    showNotification("Failed to update note.");
  }
}
window.editQuickNote = editQuickNote;
window.deleteQuickNote = deleteQuickNote;
/* ═════════════════════ LOGOUT ═════════════════════ */
async function logoutUser(event) {
  if (event) event.preventDefault();

  const isGuest = localStorage.getItem("guestMode") === "true";

  if (isGuest) {
    // Clear guest mode and go back to landing page
    localStorage.removeItem("guestMode");
    window.location.href = "index.html";
    return;
  }

  try {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js");
    await signOut(auth);
    localStorage.removeItem("guestMode");
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("Error logging out. Try again.");
  }
}
window.logoutUser = logoutUser;
const quickInput = document.getElementById("quickInput");
const quickCharCount = document.getElementById("quickCharCount");

if (quickInput && quickCharCount) {
  quickInput.addEventListener("input", () => {
    quickCharCount.textContent = quickInput.value.length;
  });
}
function loadLatestJournal() {
  const container =
    document.getElementById("journalHistoryContainer");

  if (!container) return;

  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "journals"),
    where("uid", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = `
        <p>No journal entries yet.</p>
      `;
      return;
    }

    const docSnap = snapshot.docs[0];
    const journal = docSnap.data();

    const date = journal.createdAt?.toDate() || new Date();

    const day = date.getDate();
    const month = date.toLocaleString("default", {
      month: "short"
    });

    const preview =
      journal.content.length > 80
        ? journal.content.substring(0, 80) + "..."
        : journal.content;

    container.innerHTML = `
      <div class="history-card">
        <div class="history-date">
          <h2>${day}</h2>
          <p>${month}</p>
        </div>

        <div class="history-content">
          <h4>${journal.mood}</h4>
          <p>${preview}</p>
        </div>

        <div class="history-icon">📔</div>
      </div>
    `;
  });
}
/* =========================================================
   COMFORT CORNER - LOAD SAVED THOUGHTS FROM FIRESTORE
   ========================================================= */

/* Create one saved thought card */
function createComfortThoughtHTML(thought, docId) {
  let formattedDate = "Just now";

  // Format Firestore timestamp
  if (
    thought.createdAt &&
    typeof thought.createdAt.toDate === "function"
  ) {
    formattedDate =
      thought.createdAt.toDate().toLocaleString();
  }

  // Show only first 5 words
  const words =
    (thought.content || "").trim().split(/\s+/);

  let preview =
    words.slice(0, 5).join(" ");

  if (words.length > 5) {
    preview += "...";
  }

  return `
    <div class="saved-thought-card">
      <p class="saved-thought-preview">
        ${preview}
      </p>

      <div class="saved-thought-footer">
        <span class="saved-thought-date">
          ${formattedDate}
        </span>

        <button
          type="button"
          class="thought-delete-btn"
          onclick="deleteComfortThought('${docId}')"
          title="Delete Thought"
        >
          🗑️
        </button>
      </div>
    </div>
  `;
}

/* Load thoughts */
function loadComfortThoughts() {
  const container =
    document.getElementById("comfortHistoryContainer");

  // Check container exists
  if (!container) {
    console.log(
      "comfortHistoryContainer not found"
    );
    return;
  }

  // Check logged in user
  const user = auth.currentUser;

  if (!user) {
    console.log("No logged in user");
    return;
  }

  console.log(
    "Loading comfort thoughts for user:",
    user.uid
  );

  const q = query(
    collection(db, "thoughts"),
    where("uid", "==", user.uid),
    where("type", "==", "comfort"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      console.log(
        "Comfort thoughts found:",
        snapshot.size
      );

      // Empty state
      if (snapshot.empty) {
        container.innerHTML = `
          <div class="quicknotes-empty-state">
            <div class="quicknotes-empty-icon">💭</div>
            <h4>No saved thoughts yet</h4>
            <p>Your saved thoughts will appear here.</p>
          </div>
        `;
        return;
      }

      // Build HTML
      let html = "";

      snapshot.forEach((docSnap) => {
        html += createComfortThoughtHTML(
          docSnap.data(),
          docSnap.id
        );
      });

      container.innerHTML = html;
    },
    (error) => {
      console.error(
        "Error loading comfort thoughts:",
        error
      );

      container.innerHTML = `
        <div class="quicknotes-empty-state">
          <div class="quicknotes-empty-icon">⚠️</div>
          <h4>Unable to load thoughts</h4>
          <p>Please refresh and try again.</p>
        </div>
      `;
    }
  );
}

/* Delete thought */
/* Delete comfort thought */
async function deleteComfortThought(docId) {
  const confirmDelete = await showCustomConfirm(
    "Delete this thought?"
  );

  // User clicked Cancel
  if (!confirmDelete) return;

  try {
    // Delete from Firestore
    await deleteDoc(doc(db, "thoughts", docId));

    showNotification("Thought deleted successfully.");
  } catch (error) {
    console.error("Delete comfort thought error:", error);
    showNotification("Failed to delete thought.");
  }
}

/* Make available globally */
window.deleteComfortThought = deleteComfortThought;
function showModal({
  title = "Message",
  message = "",
  input = false,
  defaultValue = "",
  okText = "OK",
  cancelText = "Cancel",
  showCancel = true
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("customModal");
    const titleEl = document.getElementById("modalTitle");
    const messageEl = document.getElementById("modalMessage");
    const inputEl = document.getElementById("modalInput");
    const okBtn = document.getElementById("modalOkBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");

    titleEl.textContent = title;
    messageEl.textContent = message;

    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;

    if (input) {
      inputEl.classList.remove("hidden");
      inputEl.value = defaultValue;
    } else {
      inputEl.classList.add("hidden");
      inputEl.value = "";
    }

    cancelBtn.style.display = showCancel ? "inline-block" : "none";
    modal.classList.remove("hidden");

    okBtn.onclick = () => {
      modal.classList.add("hidden");
      resolve(input ? inputEl.value : true);
    };

    cancelBtn.onclick = () => {
      modal.classList.add("hidden");
      resolve(null);
    };
  });
}

function showCustomAlert(message) {
  return showModal({
    title: "Notice",
    message,
    showCancel: false
  });
}

function showCustomConfirm(message) {
  return showModal({
    title: "Confirm",
    message
  });
}

function showCustomPrompt(message, defaultValue = "") {
  return showModal({
    title: "Edit",
    message,
    input: true,
    defaultValue
  });
}
window.showCustomAlert = showCustomAlert;
window.showCustomConfirm = showCustomConfirm;
window.showCustomPrompt = showCustomPrompt;
async function loadSidebarProfile() {
  const profileName = document.getElementById("sidebarProfileName");
  const avatar = document.querySelector(".avatar");

  if (!profileName) return;

  // Guest mode
  if (localStorage.getItem("guestMode") === "true") {
    profileName.textContent = "Guest";

    if (avatar) {
      avatar.textContent = "G";
    }
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    profileName.textContent = "Guest";
    if (avatar) avatar.textContent = "G";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let name = "";

    if (userSnap.exists()) {
      name = userSnap.data().name || "";
    }

    if (!name) {
      name =
        user.displayName ||
        user.email?.split("@")[0] ||
        "User";
    }

    profileName.textContent = name;

    // Avatar initials
    if (avatar) {
      const initials = name
        .split(" ")
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      avatar.textContent = initials;
    }
  } catch (error) {
    console.error("Error loading sidebar profile:", error);
    profileName.textContent = "User";
  }
}
/* ================= PROFILE DROPDOWN ================= */

function toggleProfileMenu() {
  const menu = document.getElementById("profileDropdown");
  if (!menu) return;

  menu.classList.toggle("hidden");
}

window.toggleProfileMenu = toggleProfileMenu;

/* Close dropdown when clicking outside */
document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".nav-profile-wrapper");
  const menu = document.getElementById("profileDropdown");

  if (!wrapper || !menu) return;

  if (!wrapper.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

/* Close on Escape */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const menu = document.getElementById("profileDropdown");
    if (menu) {
      menu.classList.add("hidden");
    }
  }
});

/* ================= PROFILE IMAGE / INITIALS ================= */

function updateTopProfile(user, displayName = "Guest") {
  const img = document.getElementById("navProfileImg");
  const fallback = document.getElementById("navProfileFallback");

  if (!img || !fallback) return;

  // Create initials
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "G";

  // If user has a valid photo
  if (user && user.photoURL && user.photoURL.trim() !== "") {
    img.src = user.photoURL;
    img.onerror = () => {
      // If image fails to load, show initials instead
      img.classList.add("hidden");
      fallback.textContent = initials;
      fallback.classList.remove("hidden");
    };

    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    // No photo → show initials
    fallback.textContent = initials;
    fallback.classList.remove("hidden");
    img.classList.add("hidden");
  }
}
/* =========================================================
   GLOBAL SEARCH
   Search by note title and redirect to matching section
   ========================================================= */

/* =========================================================
   GLOBAL SEARCH
   Search note title and open the exact category page
   ========================================================= */

const globalSearch = document.getElementById("globalSearch");

if (globalSearch) {
  globalSearch.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;

    e.preventDefault();

    const searchTerm = globalSearch.value.trim().toLowerCase();

    if (!searchTerm) {
      showNotification("Please enter a note title.");
      return;
    }

    const isGuest = localStorage.getItem("guestMode") === "true";

    /* =====================================================
       CATEGORY → PAGE MAPPING
       ===================================================== */
    const categoryPageMap = {
      work: "worknotes",
      ideas: "ideasnotes",
      todo: "todonotes",
      study: "studynotes",
      quick: "quicknotes"
    };

    /* =====================================================
       GUEST MODE SEARCH (localStorage)
       ===================================================== */
    if (isGuest) {
      const notes = JSON.parse(localStorage.getItem("notes")) || [];
      const quickNotes =
        JSON.parse(localStorage.getItem("quicknotes")) || [];

      const allNotes = [...notes, ...quickNotes];

      const foundNote = allNotes.find((note) =>
        (note.title || "")
          .toLowerCase()
          .includes(searchTerm)
      );

      if (!foundNote) {
        showNotification("No matching note found.");
        return;
      }

      const targetPage =
        categoryPageMap[foundNote.category] || "allnotes";

      // Open correct section
      loadPage(targetPage);

      // Scroll to notes container
      setTimeout(() => {
        const containerMap = {
          work: "workNotesContainer",
          ideas: "ideasNotesContainer",
          todo: "todoNotesContainer",
          study: "studyNotesContainer",
          quick: "quickNotesContainer"
        };

        const containerId =
          containerMap[foundNote.category];

        const container =
          document.getElementById(containerId);

        if (container) {
          container.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }, 300);

      showNotification(
        `Found "${foundNote.title}" in ${foundNote.category} notes.`
      );

      globalSearch.value = "";
      return;
    }

    /* =====================================================
       FIRESTORE SEARCH
       ===================================================== */
    const user = auth.currentUser;

    if (!user) {
      showNotification("Please log in first.");
      return;
    }

    try {
      const q = query(
        collection(db, "notes"),
        where("uid", "==", user.uid)
      );

      const snapshot = await getDocs(q);

      let foundNote = null;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        if (
          !foundNote &&
          data.title &&
          data.title
            .toLowerCase()
            .includes(searchTerm)
        ) {
          foundNote = {
            id: docSnap.id,
            ...data
          };
        }
      });

      if (!foundNote) {
        showNotification("No matching note found.");
        return;
      }

      /* Determine exact page to open */
      const targetPage =
        categoryPageMap[foundNote.category] || "allnotes";

      /* Open the category page */
      loadPage(targetPage);

      /* Wait for section to render and scroll to note */
      setTimeout(() => {
        const noteTitles =
          document.querySelectorAll(".note-item h3");

        noteTitles.forEach((titleEl) => {
          const titleText = titleEl.textContent
            .replace("📌", "")
            .trim()
            .toLowerCase();

          if (
            titleText ===
            foundNote.title.trim().toLowerCase()
          ) {
            const noteCard =
              titleEl.closest(".note-item");

            if (noteCard) {
              noteCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
              });

              /* Highlight the note */
              noteCard.style.boxShadow =
                "0 0 0 3px #2ecc71";

              setTimeout(() => {
                noteCard.style.boxShadow = "";
              }, 3000);
            }
          }
        });
      }, 700);

      /* Show message */
      showNotification(
        `Found "${foundNote.title}" in ${foundNote.category} notes.`
      );

      /* Clear search */
      globalSearch.value = "";

    } catch (error) {
      console.error("Search error:", error);
      showNotification("Search failed.");
    }
  });
}
function loadPinnedNotes() {
  const container = document.getElementById("pinnedNotesContainer");
  if (!container) return;

  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "notes"),
    where("uid", "==", user.uid),
    where("isPinned", "==", true),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = `
          <div class="quicknotes-empty-state">
            <div class="quicknotes-empty-icon">📌</div>
            <h4>No pinned notes yet</h4>
            <p>Pin your important notes to access them quickly.</p>
          </div>
        `;
        return;
      }

      let html = "";
      snapshot.forEach((docSnap) => {
        html += createNoteHTML(docSnap.data(), docSnap.id);
      });

      container.innerHTML = html;
    },
    (error) => {
      console.error("Pinned notes error:", error);

      container.innerHTML = `
        <div class="quicknotes-empty-state">
          <div class="quicknotes-empty-icon">⚠️</div>
          <h4>Unable to load pinned notes</h4>
          <p>${error.message}</p>
        </div>
      `;
    }
  );
}
async function togglePinNote(docId, currentState) {
  try {
    await updateDoc(doc(db, "notes", docId), {
      isPinned: !currentState,
      updatedAt: serverTimestamp()
    });

    showNotification(
      !currentState
        ? "Note pinned successfully!"
        : "Note unpinned successfully!"
    );
  } catch (error) {
    console.error("Pin error:", error);
    showNotification("Failed to update pin status.");
  }
}

window.togglePinNote = togglePinNote;
async function loadHomeDashboardData() {

  const user = auth.currentUser;

  if (!user) return;

  try {

    /* =========================
       USER NAME
       ========================= */

    const nameEl =
      document.getElementById("homeUserName");

    const userRef =
      doc(db, "users", user.uid);

    const userSnap =
      await getDoc(userRef);

    let userName = "User";

    if (userSnap.exists()) {
      userName =
        userSnap.data().name ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "User";
    }

    if (nameEl) {
      nameEl.textContent = userName;
    }

    /* =========================
       NOTES COUNT
       ========================= */

    const notesQuery = query(
      collection(db, "notes"),
      where("uid", "==", user.uid)
    );

    const notesSnapshot =
      await getCountFromServer(notesQuery);

    const notesCount =
      notesSnapshot.data().count;

    const notesEl =
      document.getElementById("homeNotesCount");

    if (notesEl) {
      notesEl.textContent =
        `${notesCount} notes created.`;
    }

    /* =========================
       AI SUMMARY COUNT
       ========================= */

    const summaryQuery = query(
      collection(db, "ai_summaries"),
      where("uid", "==", user.uid)
    );

    const summarySnapshot =
      await getCountFromServer(summaryQuery);

    const summaryCount =
      summarySnapshot.data().count;

    const summaryEl =
      document.getElementById("homeSummaryCount");

    if (summaryEl) {
      summaryEl.textContent =
        `${summaryCount} summaries generated.`;
    }

  } catch (error) {
    console.error(
      "Dashboard load error:",
      error
    );
  }
}
async function saveSummaryToFirestore(originalText, summary, style) {
  try {
    const user = auth.currentUser;

    if (!user) return;

    await addDoc(collection(db, "ai_summaries"), {
      uid: user.uid,
      originalText: originalText,
      summary: summary,
      style: style,
      createdAt: serverTimestamp()
    });

  } catch (error) {
    console.error("Error saving AI summary:", error);
  }
}