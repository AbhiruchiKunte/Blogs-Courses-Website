import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Placeholder config - User must replace this or we load it from an endpoint
// verifying if we can fetch it from the backend or a specific file
let firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "sciastra-ak25.firebaseapp.com",
    projectId: "sciastra-ak25",
    storageBucket: "sciastra-ak25.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Try to load config from a global variable if defined (e.g. from a script tag)
if (window.FIREBASE_CONFIG) {
    firebaseConfig = window.FIREBASE_CONFIG;
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Fix for "Access to storage is not allowed"
// We try Local -> Session -> None (InMemory)
// If Local fails (e.g. 3rd party cookies blocked), we try Session.
// If Session fails, we fall back to None, but warn user.
import { browserSessionPersistence, inMemoryPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

setPersistence(auth, browserSessionPersistence)
    .then(() => {
        console.log("Firebase Persistence set to SESSION");
    })
    .catch((error) => {
        console.warn("Could not set SESSION persistence. Falling back to IN_MEMORY.", error);
        return setPersistence(auth, inMemoryPersistence);
    });

const googleProvider = new GoogleAuthProvider();

// Auth Functions
export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        await syncUserWithBackend(user);
        return user;
    } catch (error) {
        console.error("Google Login Error:", error);
        throw error;
    }
};

export const loginWithEmail = async (email, password) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;
        await syncUserWithBackend(user);
        return user;
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
};

export const registerWithEmail = async (email, password, name) => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        // Optionally update profile with name
        await syncUserWithBackend(user, name);
        return user;
    } catch (error) {
        console.error("Register Error:", error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
        window.location.href = '/';
    } catch (error) {
        console.error("Logout Error:", error);
    }
};

// Sync user with our MongoDB
const syncUserWithBackend = async (user, name = null) => {
    try {
        const token = await user.getIdToken();
        const payload = {
            name: name || user.displayName || user.email.split('@')[0]
        };

        const response = await fetch('/api/users/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Backend Sync Failed");
        }
    } catch (error) {
        console.error("Sync Error:", error);
    }
};

export const getAuthToken = async () => {
    if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
    }
    return null;
};

// Auth State Observer
export const onAuthChange = (callback) => {
    onAuthStateChanged(auth, callback);
};

export { auth };
