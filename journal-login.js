// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
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
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authButton = document.getElementById('authButton');
const errorMessage = document.getElementById('errorMessage');
const securityLockout = document.getElementById('securityLockout');
const authContainer = document.getElementById('authContainer');

// Security tracking
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Generate a client fingerprint for tracking
function getClientFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Client fingerprint', 2, 2);
    const fingerprint = canvas.toDataURL();
    
    const data = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        fingerprint.slice(-50) // Last 50 chars of canvas fingerprint
    ].join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
}

// Initialize the app
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Login page loaded, setting up event listeners');
    
    // Check Firebase initialization
    if (!firebaseInitialized) {
        showError('Firebase not properly initialized. Please check your configuration.');
        return;
    }
    
    // Check if already locked out
    if (await isLockedOut()) {
        showSecurityLockout();
        return;
    }
    
    setupEventListeners();
    
    // Check if user is already logged in
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('User already logged in, redirecting to dashboard');
            window.location.href = 'journal-dashboard.html';
        }
    });
});

function setupEventListeners() {
    // Auth form submission
    authForm.addEventListener('submit', handleAuthSubmit);
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
        
        console.log('Signing in existing user');
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        showSuccessMessage('Welcome back! Redirecting...');
        
        console.log('Authentication successful:', userCredential.user.email);
        
        // Reset failed attempts on successful login
        await resetFailedAttempts();
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'journal-dashboard.html';
        }, 1000);
        
    } catch (error) {
        console.error('Authentication error:', error);
        
        // Record failed attempt
        await recordFailedAttempt();
        
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
        authButton.textContent = 'Sign In';
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
}

function clearError() {
    errorMessage.textContent = '';
}

async function isLockedOut() {
    if (!db) return false;
    
    try {
        const clientId = getClientFingerprint();
        const securityDoc = await getDoc(doc(db, 'security_tracking', clientId));
        
        if (!securityDoc.exists()) {
            return false;
        }
        
        const data = securityDoc.data();
        const now = Date.now();
        
        // Check if lockout period has expired
        if (data.lockedUntil && now < data.lockedUntil) {
            return true;
        }
        
        // Check if we need to reset attempts (after lockout expires)
        if (data.lockedUntil && now >= data.lockedUntil) {
            await resetFailedAttempts();
            return false;
        }
        
        return data.failedAttempts >= MAX_FAILED_ATTEMPTS;
    } catch (error) {
        console.error('Error checking lockout status:', error);
        return false;
    }
}

function showSecurityLockout() {
    authContainer.style.display = 'none';
    securityLockout.style.display = 'flex';
    console.log('SECURITY LOCKOUT ACTIVATED');
}

async function recordFailedAttempt() {
    if (!db) return;
    
    try {
        const clientId = getClientFingerprint();
        const securityRef = doc(db, 'security_tracking', clientId);
        const securityDoc = await getDoc(securityRef);
        
        let failedAttempts = 1;
        
        if (securityDoc.exists()) {
            const data = securityDoc.data();
            failedAttempts = (data.failedAttempts || 0) + 1;
        }
        
        const updateData = {
            failedAttempts: failedAttempts,
            lastAttempt: serverTimestamp(),
            userAgent: navigator.userAgent
        };
        
        // If max attempts reached, set lockout
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            updateData.lockedUntil = Date.now() + LOCKOUT_DURATION;
        }
        
        await setDoc(securityRef, updateData, { merge: true });
        
        console.log(`Failed attempt ${failedAttempts}/${MAX_FAILED_ATTEMPTS}`);
        
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            showSecurityLockout();
        }
    } catch (error) {
        console.error('Error recording failed attempt:', error);
    }
}

async function resetFailedAttempts() {
    if (!db) return;
    
    try {
        const clientId = getClientFingerprint();
        const securityRef = doc(db, 'security_tracking', clientId);
        
        await setDoc(securityRef, {
            failedAttempts: 0,
            lastReset: serverTimestamp(),
            lockedUntil: null
        }, { merge: true });
        
        console.log('Failed attempts reset');
    } catch (error) {
        console.error('Error resetting failed attempts:', error);
    }
} 