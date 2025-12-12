import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!admin.apps.length) {
    try {
        let serviceAccount;
        const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

        if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            console.log("Loading Firebase credentials from serviceAccountKey.json");
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log("Loading Firebase credentials from env var");
        }

        admin.initializeApp({
            credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault()
        });
        console.log("Firebase Admin Initialized");
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}

export const verifyUser = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken; // uid, email, etc.
        next();
    } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(403).json({ message: 'Unauthorized', error: error.message });
    }
};

export const verifyAdmin = async (req, res, next) => {
    if (!req.user) {
        return verifyUser(req, res, () => {
            checkAdminRole(req, res, next);
        });
    } else {
        checkAdminRole(req, res, next);
    }
};

const checkAdminRole = async (req, res, next) => {
    // Check if user email is in allowed admins list (env var) or check DB role
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];

    if (adminEmails.includes(req.user.email) || req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Require Admin Role' });
    }
};
