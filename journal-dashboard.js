// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs, 
    deleteDoc, 
    query, 
    orderBy, 
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCJz0TYMBOtGklexYDEkPyDohxHMclrU1E",
    authDomain: "website-699b0.firebaseapp.com",
    projectId: "website-699b0",
    storageBucket: "website-699b0.firebasestorage.app",
    messagingSenderId: "951365627391",
    appId: "1:951365627391:web:e58048a22a074894694bca",
    measurementId: "G-Q4ELVFRDKP"
};

// Initialize Firebase
let app, auth, db;
let firebaseInitialized = false;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseInitialized = true;
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    firebaseInitialized = false;
}

// DOM elements
const logoutButton = document.getElementById('logoutButton');
const newEntryButton = document.getElementById('newEntryButton');
const analyzeButton = document.getElementById('analyzeButton');
const entriesContainer = document.getElementById('entriesContainer');
const deleteModalOverlay = document.getElementById('deleteModalOverlay');
const deleteModalNo = document.getElementById('deleteModalNo');
const deleteModalYes = document.getElementById('deleteModalYes');

// State
let currentUser = null;
let entryToDelete = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard loaded, setting up event listeners');
    setupEventListeners();
    
    // Check Firebase initialization
    if (!firebaseInitialized) {
        entriesContainer.innerHTML = '<div class="no-entries">Firebase not properly initialized. Please check your configuration.</div>';
        return;
    }
    
    // Monitor authentication state
    onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        if (user) {
            currentUser = user;
            console.log('Loading dashboard for user:', user.email);
            loadEntries();
        } else {
            console.log('User not authenticated, redirecting to login');
            window.location.href = 'journal.html';
        }
    });
});

function setupEventListeners() {
    // Logout
    logoutButton.addEventListener('click', handleLogout);
    
    // New entry
    newEntryButton.addEventListener('click', openNewEntry);
    
    // Analyze button - currently does nothing as requested
    analyzeButton.addEventListener('click', handleAnalyze);
    
    // Delete modal
    deleteModalNo.addEventListener('click', hideDeleteModal);
    deleteModalYes.addEventListener('click', confirmDelete);
    
    // Close modal when clicking overlay
    deleteModalOverlay.addEventListener('click', (e) => {
        if (e.target === deleteModalOverlay) {
            hideDeleteModal();
        }
    });
}

async function handleLogout() {
    try {
        console.log('Logging out user');
        await signOut(auth);
        // Redirect will happen automatically via onAuthStateChanged
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

function openNewEntry() {
    // Navigate to editor page
    window.location.href = 'journal-editor.html';
}

function openEditEntry(entryId) {
    // Navigate to editor page with entry ID
    window.location.href = `journal-editor.html?edit=${entryId}`;
}

async function loadEntries() {
    if (!currentUser) return;
    
    console.log('Loading entries for user:', currentUser.email);
    entriesContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div class="loading-text">Loading...</div></div>';
    
    try {
        const q = query(
            collection(db, 'journal_entries'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const entries = [];
        
        querySnapshot.forEach((doc) => {
            entries.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Loaded', entries.length, 'entries');
        displayEntries(entries);
    } catch (error) {
        console.error('Error loading entries:', error);
        if (error.code === 'failed-precondition') {
            entriesContainer.innerHTML = '<div class="no-entries">Firestore database not properly set up. Please check the setup instructions.</div>';
        } else {
            entriesContainer.innerHTML = '<div class="no-entries">Failed to load entries. Please check that Firestore is enabled in your Firebase project.</div>';
        }
    }
}

function displayEntries(entries) {
    if (entries.length === 0) {
        entriesContainer.innerHTML = '<div class="no-entries">No entries yet. Click the + button to create your first entry!</div>';
        return;
    }
    
    const entriesHTML = entries.map(entry => {
        const date = entry.createdAt ? 
            entry.createdAt.toDate().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 
            'Unknown date';
        
        const title = entry.title || '';
        const subtitle = entry.subtitle || '';
        const published = entry.published ? '• Published' : '• Draft';
        
        // Check if we have title or subtitle to display
        const hasTitle = title && title !== 'Untitled';
        const hasSubtitle = subtitle;
        
        return `
            <div class="entry">
                <div class="entry-date">${date} ${published}</div>
                ${hasTitle ? `<div class="entry-title">${escapeHtml(title)}</div>` : ''}
                ${hasSubtitle ? `<div class="entry-subtitle">${escapeHtml(subtitle)}</div>` : ''}
                <div class="entry-actions">
                    <button class="entry-action-button" onclick="editEntry('${entry.id}')">Edit</button>
                    <button class="entry-action-button" onclick="deleteEntry('${entry.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
    
    entriesContainer.innerHTML = entriesHTML;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global functions for inline event handlers
window.editEntry = function(entryId) {
    openEditEntry(entryId);
};

window.deleteEntry = async function(entryId) {
    entryToDelete = entryId;
    showDeleteModal();
};

function showDeleteModal() {
    deleteModalOverlay.style.display = 'flex';
}

function hideDeleteModal() {
    deleteModalOverlay.style.display = 'none';
    entryToDelete = null;
}

async function confirmDelete() {
    if (!entryToDelete) return;
    
    try {
        await deleteDoc(doc(db, 'journal_entries', entryToDelete));
        loadEntries();
        hideDeleteModal();
    } catch (error) {
        console.error('Error deleting entry:', error);
        alert('Failed to delete entry. Please try again.');
    }
}

function handleAnalyze() {
    // Currently does nothing as requested
    console.log('Analyze button clicked - currently inactive');
} 