import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Blog from '../models/Blog.js';
import Course from '../models/Course.js';
import { verifyUser } from '../middleware/authMiddleware.js';
import { createForm, optimizeToWebP } from '../utils/fileHelpers.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get base URL
function getBaseUrl(req) {
    return `${req.protocol}://${req.get('host')}`;
}

// Helper to format blog/course for frontend (convert buffer to URL)
function formatItem(item, type, baseUrl) {
    if (!item) return null;
    const id = item._id;
    // Don't send buffer
    const { Blog_img, course_img, ...rest } = item.toObject ? item.toObject() : item;

    return {
        ...rest,
        imageUrl: `${baseUrl}/api/${type}s/${id}/image`
    };
}

// Sync user from Firebase to MongoDB
router.post('/sync', verifyUser, async (req, res) => {
    try {
        const { uid, email, name, picture } = req.user;
        let user = await User.findOne({ uid });

        if (!user) {
            user = new User({
                uid,
                email,
                name: name || req.body.name || 'User',
                role: 'user'
            });
            await user.save();
        } else {
            if (name) user.name = name;
            await user.save();
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Error syncing user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Profile (Name + Image)
router.put('/profile', verifyUser, (req, res, next) => {
    const uploadDir = path.join(__dirname, '../uploads');
    let form;
    try {
        form = createForm(uploadDir);
    } catch (err) {
        return next(err);
    }

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ success: false, message: 'Form parse error' });

        try {
            const uid = req.user.uid;
            let user = await User.findOne({ uid });
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });

            // Update Name
            const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
            if (name) user.name = name;

            // Update Image
            let imageFile = files.profileImage;
            if (Array.isArray(imageFile)) imageFile = imageFile[0];

            if (imageFile && imageFile.size > 0) {
                const oldPath = imageFile.filepath || imageFile.path;
                const buffer = fs.readFileSync(oldPath);

                // Optimize
                const optimized = await optimizeToWebP(buffer);
                user.profilePic = optimized;

                // Cleanup temp file
                fs.unlinkSync(oldPath);
            }

            await user.save();
            res.json({ success: true, message: 'Profile updated' });

        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Error updating profile' });
        }
    });
});

// Get User Profile with purchases and history
router.get('/profile', verifyUser, async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.user.uid })
            .populate('viewedBlogs.blogId')
            .populate('viewedCourses.courseId')
            .populate('purchasedCourses')
            .populate('enrolledCourses')
            .lean(); // Use lean for easier modification

        if (!user) return res.status(404).json({ message: 'User not found' });

        const baseUrl = getBaseUrl(req);

        // Format Profile Pic
        user.imageUrl = user.profilePic ? `${baseUrl}/api/users/profile/image/${user.uid}` : null;
        delete user.profilePic; // Don't send buffer

        // Format collections
        if (user.purchasedCourses) {
            user.purchasedCourses = user.purchasedCourses.map(c => formatItem(c, 'course', baseUrl));
        }
        if (user.viewedBlogs) {
            user.viewedBlogs = user.viewedBlogs.map(v => ({
                ...v,
                blogId: formatItem(v.blogId, 'blog', baseUrl)
            })).filter(v => v.blogId); // remove nulls
        }
        // ... (similar for others if needed)

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get User Profile Image
router.get('/profile/image/:uid', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.uid }).select('profilePic');
        if (!user || !user.profilePic) {
            return res.redirect('/Images/Scientific-Logo-SciAstra.jpg'); // Fallback
        }
        res.set('Content-Type', 'image/webp');
        res.send(user.profilePic);
    } catch (err) {
        res.status(404).send('Not found');
    }
});

// Track View
router.post('/track-view', verifyUser, async (req, res) => {
    const { type, id } = req.body;
    const uid = req.user.uid;

    try {
        const user = await User.findOne({ uid });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (type === 'blog') {
            user.viewedBlogs = user.viewedBlogs.filter(v => v.blogId.toString() !== id);
            user.viewedBlogs.unshift({ blogId: id, viewedAt: new Date() });
            if (user.viewedBlogs.length > 50) user.viewedBlogs.pop();
        } else if (type === 'course') {
            user.viewedCourses = user.viewedCourses.filter(v => v.courseId.toString() !== id);
            user.viewedCourses.unshift({ courseId: id, viewedAt: new Date() });
            if (user.viewedCourses.length > 50) user.viewedCourses.pop();
        }

        await user.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Recommendation Engine
router.get('/recommendations', verifyUser, async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.user.uid }).populate('viewedBlogs.blogId');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const baseUrl = getBaseUrl(req);

        // Basic Content-Based Filtering
        const categoryCounts = {};
        user.viewedBlogs.forEach(view => {
            if (view.blogId && view.blogId.category) {
                const cat = view.blogId.category;
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            }
        });

        const sortedCats = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);
        const topCategory = sortedCats[0];

        let recommendedBlogs = [];
        let recommendedCourses = [];

        if (topCategory) {
            recommendedBlogs = await Blog.find({ category: topCategory }).limit(5).lean();
        } else {
            recommendedBlogs = await Blog.find().sort({ createdAt: -1 }).limit(5).lean();
        }

        recommendedCourses = await Course.find().sort({ createdAt: -1 }).limit(4).lean();

        // Format Images
        recommendedBlogs = recommendedBlogs.map(b => formatItem(b, 'blog', baseUrl));
        recommendedCourses = recommendedCourses.map(c => formatItem(c, 'course', baseUrl));

        res.json({ success: true, recommendations: { blogs: recommendedBlogs, courses: recommendedCourses } });

    } catch (error) {
        console.error('Rec error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
