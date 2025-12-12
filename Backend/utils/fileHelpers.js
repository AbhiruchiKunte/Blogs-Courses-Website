import formidable from 'formidable';
import fs from 'fs';
import sharp from 'sharp';

// helper to create formidable form
export function createForm(uploadDir) {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    return formidable({
        uploadDir,
        keepExtensions: true,
        multiples: true
    });
}

// optimize image (used on add + update image)
export async function optimizeToWebP(buffer) {
    const optimizedBuffer = await sharp(buffer)
        .resize({ width: 500 })    // good for cards
        .webp({ quality: 70 })
        .toBuffer();
    return optimizedBuffer;
}
