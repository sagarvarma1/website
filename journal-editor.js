// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    getDoc,
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
const titleInput = document.getElementById('titleInput');
const subtitleInput = document.getElementById('subtitleInput');
const contentTextarea = document.getElementById('contentTextarea');
const saveButton = document.getElementById('saveButton');
const wordCount = document.getElementById('wordCount');
const loadingOverlay = document.getElementById('loadingOverlay');
const toolbar = document.getElementById('toolbar');
const editorLoadingOverlay = document.getElementById('editorLoadingOverlay');

// State
let currentUser = null;
let entryId = null; // For editing existing entries
let autoSaveTimeout = null;
let hasUnsavedChanges = false;
let lastSavedContent = { title: '', subtitle: '', content: '' };

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Editor loaded');
    
    // Check if editing existing entry
    const urlParams = new URLSearchParams(window.location.search);
    entryId = urlParams.get('edit');
    
    // Show loading overlay immediately if editing existing entry
    if (entryId) {
        showEditorLoading(true);
    }
    
    // Check authentication
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log('User authenticated:', user.email);
            setupEditor();
            
            // Load existing entry if editing
            if (entryId) {
                console.log('Loading existing entry:', entryId);
                loadExistingEntry(entryId);
            }
        } else {
            console.log('User not authenticated, redirecting to login');
            window.location.href = 'journal.html';
        }
    });
});

function setupEditor() {
    // Auto-resize textareas
    setupAutoResize(titleInput);
    setupAutoResize(subtitleInput);
    
    // Word count
    contentTextarea.addEventListener('input', updateWordCount);
    
    // Auto-save (every 30 seconds)
    setInterval(autoSave, 30000);
    
    // Save on input with debounce
    [titleInput, subtitleInput, contentTextarea].forEach(element => {
        element.addEventListener('input', () => {
            checkForUnsavedChanges();
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(autoSave, 3000); // Auto-save 3 seconds after user stops typing
        });
    });
    
    // Save buttons
    saveButton.addEventListener('click', () => saveEntry(false));
    
    // Show toolbar on text selection
    document.addEventListener('selectionchange', handleTextSelection);
    
    // Initial word count
    updateWordCount();
}

function setupAutoResize(textarea) {
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}

function updateWordCount() {
    const content = contentTextarea.value;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

function handleTextSelection() {
    const selection = window.getSelection();
    if (selection.toString().length > 0 && contentTextarea.contains(selection.anchorNode)) {
        toolbar.classList.add('visible');
    } else {
        toolbar.classList.remove('visible');
    }
}

window.formatText = function(command) {
    document.execCommand(command, false, null);
    contentTextarea.focus();
};

async function saveEntry(publish = false) {
    if (!currentUser) {
        alert('You must be logged in to save entries');
        return;
    }

    const title = titleInput.value.trim();
    const subtitle = subtitleInput.value.trim();
    const content = contentTextarea.value.trim();

    if (!title && !content) {
        alert('Please add a title or content before saving');
        return;
    }

    showLoading(true);

    try {
        const entryData = {
            title: title || 'Untitled',
            subtitle: subtitle,
            content: content,
            userId: currentUser.uid,
            published: publish,
            updatedAt: serverTimestamp()
        };

        if (entryId) {
            // Update existing entry
            const entryRef = doc(db, 'journal_entries', entryId);
            await updateDoc(entryRef, entryData);
            console.log('Entry updated:', entryId);
        } else {
            // Create new entry
            entryData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, 'journal_entries'), entryData);
            entryId = docRef.id;
            console.log('New entry created:', entryId);
            
            // Update URL to reflect we're now editing
            window.history.replaceState({}, '', `journal-editor.html?edit=${entryId}`);
        }

        // Show success feedback
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Saved!';
        saveButton.style.backgroundColor = '#2e7d32';
        
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.style.backgroundColor = 'black';
        }, 2000);

        // Update saved content tracking
        updateLastSavedContent();

    } catch (error) {
        console.error('Error saving entry:', error);
        alert('Failed to save entry. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function autoSave() {
    if (!currentUser) return;
    
    const title = titleInput.value.trim();
    const content = contentTextarea.value.trim();
    
    // Only auto-save if there's meaningful content
    if (!title && !content) return;
    
    console.log('Auto-saving...');
    
    try {
        const entryData = {
            title: title || 'Untitled',
            subtitle: subtitleInput.value.trim(),
            content: content,
            userId: currentUser.uid,
            published: false, // Auto-save as draft
            updatedAt: serverTimestamp()
        };

        if (entryId) {
            const entryRef = doc(db, 'journal_entries', entryId);
            await updateDoc(entryRef, entryData);
        } else {
            entryData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, 'journal_entries'), entryData);
            entryId = docRef.id;
            window.history.replaceState({}, '', `journal-editor.html?edit=${entryId}`);
        }
        
        console.log('Auto-save completed');
        updateLastSavedContent();
    } catch (error) {
        console.error('Auto-save failed:', error);
    }
}

async function loadExistingEntry(id) {
    if (!currentUser) return;
    
    showLoading(true);
    
    try {
        const entryRef = doc(db, 'journal_entries', id);
        const entrySnap = await getDoc(entryRef);
        
        if (entrySnap.exists()) {
            const entry = entrySnap.data();
            
            // Verify user owns this entry
            if (entry.userId !== currentUser.uid) {
                alert('You do not have permission to edit this entry');
                window.location.href = 'journal-dashboard.html';
                return;
            }
            
            // Populate fields
            titleInput.value = entry.title || '';
            subtitleInput.value = entry.subtitle || '';
            contentTextarea.value = entry.content || '';
            
            updateWordCount();
            
            // Trigger auto-resize
            titleInput.dispatchEvent(new Event('input'));
            subtitleInput.dispatchEvent(new Event('input'));
            
            // Initialize saved content tracking
            updateLastSavedContent();
            
            console.log('Entry loaded:', id);
        } else {
            alert('Entry not found');
            window.location.href = 'journal-dashboard.html';
        }
    } catch (error) {
        console.error('Error loading entry:', error);
        alert('Failed to load entry');
        window.location.href = 'journal-dashboard.html';
    } finally {
        showLoading(false);
        showEditorLoading(false);
    }
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showEditorLoading(show) {
    editorLoadingOverlay.style.display = show ? 'flex' : 'none';
}

window.goBack = function() {
    // Save before leaving if there are unsaved changes
    if (hasUnsavedChanges) {
        autoSave().then(() => {
            window.location.href = 'journal-dashboard.html';
        });
    } else {
        window.location.href = 'journal-dashboard.html';
    }
};

// Handle page unload (save before leaving)
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        autoSave();
        e.preventDefault();
        e.returnValue = '';
    }
});

function checkForUnsavedChanges() {
    const currentContent = {
        title: titleInput.value.trim(),
        subtitle: subtitleInput.value.trim(),
        content: contentTextarea.value.trim()
    };
    
    hasUnsavedChanges = (
        currentContent.title !== lastSavedContent.title ||
        currentContent.subtitle !== lastSavedContent.subtitle ||
        currentContent.content !== lastSavedContent.content
    );
}

function updateLastSavedContent() {
    lastSavedContent = {
        title: titleInput.value.trim(),
        subtitle: subtitleInput.value.trim(),
        content: contentTextarea.value.trim()
    };
    hasUnsavedChanges = false;
} 