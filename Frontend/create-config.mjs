// create-config.mjs
import fs from 'fs';
const adminConfigFilePath = './Frontend/adminConfig.js';

// Admin config (for frontend usage)
const adminConfigContent = `
export const ADMIN_EMAIL = "${process.env.PUBLIC_ADMIN_EMAIL}";
export const ADMIN_PASSWORD = "${process.env.PUBLIC_ADMIN_PASSWORD}";
`;

fs.writeFileSync(adminConfigFilePath, adminConfigContent);
console.log('✅ Successfully created adminConfig.js for deployment inside /frontend!');
