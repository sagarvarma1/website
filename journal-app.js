// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    updateDoc, 
    query, 
    orderBy, 
    where,
    serverTimestamp 
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
const authContainer = document.getElementById('authContainer');
const journalContainer = document.getElementById('journalContainer');
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authButton = document.getElementById('authButton');
const errorMessage = document.getElementById('errorMessage');
const authSwitchText = document.getElementById('authSwitchText');
const authSwitchLink = document.getElementById('authSwitchLink');
const logoutButton = document.getElementById('logoutButton');
const newEntryButton = document.getElementById('newEntryButton');
const analyzeButton = document.getElementById('analyzeButton');
const entriesContainer = document.getElementById('entriesContainer');
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');
const cancelEntry = document.getElementById('cancelEntry');
const saveEntry = document.getElementById('saveEntry');
const entryTextarea = document.getElementById('entryTextarea');

// State
let isSignUpMode = false;
let currentUser = null;
let editingEntryId = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners');
    setupEventListeners();
    
    // Check Firebase initialization
    if (!firebaseInitialized) {
        showError('Firebase not properly initialized. Please check your configuration.');
        return;
    }
    
    // Monitor authentication state
    onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        if (user) {
            currentUser = user;
            console.log('Showing journal interface for user:', user.email);
            showJournalInterface();
            loadEntries();
        } else {
            currentUser = null;
            console.log('Showing auth interface');
            showAuthInterface();
        }
    });
});

function setupEventListeners() {
    // Auth form submission
    authForm.addEventListener('submit', handleAuthSubmit);
    
    // Auth mode switch
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthMode();
    });
    
    // Logout
    logoutButton.addEventListener('click', handleLogout);
    
    // New entry
    newEntryButton.addEventListener('click', openNewEntryModal);
    
    // Analyze button - currently does nothing as requested
    analyzeButton.addEventListener('click', handleAnalyze);
    
    // Modal controls
    closeModal.addEventListener('click', closeNewEntryModal);
    cancelEntry.addEventListener('click', closeNewEntryModal);
    saveEntry.addEventListener('click', handleSaveEntry);
    
    // Close modal when clicking overlay
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeNewEntryModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.style.display === 'block') {
            closeNewEntryModal();
        }
    });
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    
    if (isSignUpMode) {
        authButton.textContent = 'Sign Up';
        authSwitchText.textContent = 'Already have an account?';
        authSwitchLink.textContent = 'Sign in';
    } else {
        authButton.textContent = 'Sign In';
        authSwitchText.textContent = "Don't have an account?";
        authSwitchLink.textContent = 'Sign up';
    }
    
    clearError();
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    console.log('Auth form submitted');
    
    if (!firebaseInitialized) {
        showError('Firebase not initialized. Please check the setup instructions.');
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }
    
    setAuthLoading(true);
    clearError();
    
    try {
        console.log('Attempting authentication for:', email);
        let userCredential;
        
        if (isSignUpMode) {
            console.log('Creating new user account');
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            showSuccessMessage('Account created successfully! Welcome to your journal.');
        } else {
            console.log('Signing in existing user');
            userCredential = await signInWithEmailAndPassword(auth, email, password);
            showSuccessMessage('Welcome back! Loading your journal...');
        }
        
        console.log('Authentication successful:', userCredential.user.email);
        
    } catch (error) {
        console.error('Authentication error:', error);
        showError(getAuthErrorMessage(error));
    } finally {
        setAuthLoading(false);
    }
}

function getAuthErrorMessage(error) {
    console.log('Auth error code:', error.code);
    
    switch (error.code) {
        case 'auth/user-not-found':
            return 'No account found with this email address. Try signing up instead.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Try signing in instead.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters long.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        case 'auth/invalid-credential':
            return 'Invalid email or password. Please check your credentials.';
        default:
            return `Authentication failed: ${error.message || 'Please try again.'}`;
    }
}

function setAuthLoading(loading) {
    authButton.disabled = loading;
    emailInput.disabled = loading;
    passwordInput.disabled = loading;
    
    if (loading) {
        authButton.textContent = 'Please wait...';
        authButton.style.backgroundColor = '#666';
    } else {
        authButton.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        authButton.style.backgroundColor = 'black';
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.color = '#d32f2f';
    console.error('Auth error shown to user:', message);
}

function showSuccessMessage(message) {
    errorMessage.textContent = message;
    errorMessage.style.color = '#2e7d32';
    console.log('Success message shown to user:', message);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
        if (errorMessage.textContent === message) {
            clearError();
        }
    }, 3000);
}

function clearError() {
    errorMessage.textContent = '';
}

async function handleLogout() {
    try {
        console.log('Logging out user');
        await signOut(auth);
        showSuccessMessage('You have been logged out successfully.');
    } catch (error) {
        console.error('Logout error:', error);
        showError('Error logging out. Please try again.');
    }
}

function showAuthInterface() {
    console.log('Displaying authentication interface');
    authContainer.style.display = 'flex';
    journalContainer.style.display = 'none';
    
    // Clear form
    emailInput.value = '';
    passwordInput.value = '';
    clearError();
    
    // Reset form state
    setAuthLoading(false);
}

function showJournalInterface() {
    console.log('Displaying journal interface');
    authContainer.style.display = 'none';
    journalContainer.style.display = 'block';
    
    // Update user info
    if (currentUser) {
        console.log('Journal interface ready for user:', currentUser.email);
    }
}

function openNewEntryModal() {
    // Navigate to editor page
    window.location.href = 'journal-editor.html';
}

function openEditEntryModal(entryId, content) {
    // Navigate to editor page with entry ID
    window.location.href = `journal-editor.html?edit=${entryId}`;
}

function closeNewEntryModal() {
    modalOverlay.style.display = 'none';
    editingEntryId = null;
    entryTextarea.value = '';
}

async function handleSaveEntry() {
    const content = entryTextarea.value.trim();
    
    if (!content) {
        alert('Please write something before saving');
        return;
    }
    
    if (!currentUser) {
        alert('You must be logged in to save entries');
        return;
    }
    
    saveEntry.disabled = true;
    saveEntry.textContent = 'Saving...';
    
    try {
        if (editingEntryId) {
            // Update existing entry
            const entryRef = doc(db, 'journal_entries', editingEntryId);
            await updateDoc(entryRef, {
                content: content,
                updatedAt: serverTimestamp()
            });
        } else {
            // Create new entry
            await addDoc(collection(db, 'journal_entries'), {
                content: content,
                userId: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        closeNewEntryModal();
        loadEntries();
    } catch (error) {
        console.error('Error saving entry:', error);
        alert('Failed to save entry. Please try again.');
    } finally {
        saveEntry.disabled = false;
        saveEntry.textContent = 'Save Entry';
    }
}

async function loadEntries() {
    if (!currentUser) return;
    
    console.log('Loading entries for user:', currentUser.email);
    entriesContainer.innerHTML = '<div class="loading"><div class="loading-text">Loading your entries...</div></div>';
    
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
        
        const title = entry.title || 'Untitled';
        const subtitle = entry.subtitle || '';
        const content = entry.content || '';
        const published = entry.published ? '• Published' : '• Draft';
        
        return `
            <div class="entry">
                <div class="entry-date">${date} ${published}</div>
                ${title !== 'Untitled' ? `<div class="entry-title">${escapeHtml(title)}</div>` : ''}
                ${subtitle ? `<div class="entry-subtitle">${escapeHtml(subtitle)}</div>` : ''}
                <div class="entry-content">${escapeHtml(content)}</div>
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

function escapeForAttribute(text) {
    return text.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

// Global functions for inline event handlers
window.editEntry = function(entryId) {
    openEditEntryModal(entryId);
};

window.deleteEntry = async function(entryId) {
    if (!confirm('Are you sure you want to delete this entry?')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'journal_entries', entryId));
        loadEntries();
    } catch (error) {
        console.error('Error deleting entry:', error);
        alert('Failed to delete entry. Please try again.');
    }
};

function handleAnalyze() {
    // Currently does nothing as requested
    console.log('Analyze button clicked - currently inactive');
} 