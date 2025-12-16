import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Replicating __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!admin.apps.length) {
    try {
        let serviceAccount;

        // 1. Determine the path to the credentials file
        // Render sets process.env.RENDER to "true" automatically.
        const serviceAccountPath = process.env.RENDER 
            ? '/etc/secrets/serviceAccountKey.json' // Path on Render (Secret File)
            : path.join(__dirname, '../serviceAccountKey.json'); // Path for local development

        // 2. Load the credentials
        if (fs.existsSync(serviceAccountPath)) {
            // Option A: Loading from the physical file (preferred for Render Secret Files)
            serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            console.log(`Loading Firebase credentials from: ${serviceAccountPath}`);
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            // Option B: Fallback to string-based environment variable
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log("Loading Firebase credentials from env var string");
        }

        // 3. Initialize Admin SDK
        admin.initializeApp({
            credential: serviceAccount 
                ? admin.credential.cert(serviceAccount) 
                : admin.credential.applicationDefault()
        });
        
        console.log("Firebase Admin Initialized Successfully");
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}

// (verifyUser, verifyAdmin, checkAdminRole) 
export const verifyUser = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(403).json({ message: 'Unauthorized', error: error.message });
    }
};

export const verifyAdmin = async (req, res, next) => {
    if (!req.user) {
        return verifyUser(req, res, () => checkAdminRole(req, res, next));
    }
    checkAdminRole(req, res, next);
};

const checkAdminRole = async (req, res, next) => {
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
    if (adminEmails.includes(req.user.email) || req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Require Admin Role' });
    }
};