// create-config.mjs
import fs from 'fs';
import path from 'path';

// Targeted path based on your folder structure
const targetDir = './Frontend/public/js';

// Ensure the directory exists
if (!fs.existsSync(targetDir)){
    fs.mkdirSync(targetDir, { recursive: true });
}

// 1. Admin Config Content
const adminConfigContent = `
window.adminConfig = {
  email: "${process.env.PUBLIC_ADMIN_EMAIL}",
  password: "${process.env.PUBLIC_ADMIN_PASSWORD}"
};
`;

// 2. Firebase Config Content
const firebaseConfigContent = `
window.FIREBASE_CONFIG = {
    apiKey: "${process.env.FIREBASE_API_KEY}",
    authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
    projectId: "${process.env.FIREBASE_PROJECT_ID}",
    storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${process.env.FIREBASE_APP_ID}"
};
`;

try {
    fs.writeFileSync(path.join(targetDir, 'adminConfig.js'), adminConfigContent);
    fs.writeFileSync(path.join(targetDir, 'firebaseConfig.js'), firebaseConfigContent);
    console.log('✅ Successfully created configs in ./Frontend/public/js/');
} catch (error) {
    console.error('❌ Error writing config files:', error);
    process.exit(1);
}