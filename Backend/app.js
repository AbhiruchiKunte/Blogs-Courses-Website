// app.js
import dotenv from 'dotenv';
import express from 'express';
import formidable from 'formidable';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import cors from 'cors';
import { fileURLToPath } from 'url';
import Blog from './models/Blog.js'; 
import Course from './models/Course.js'; 
import paymentRoute from './routes/paymentRoute.js'; 

dotenv.config();
const app = express();
app.use(cors());

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from Frontend/public
app.use(express.static(path.join(__dirname, '../Frontend/public')));
app.use(express.urlencoded({ extended: true }));

// Serve index.html as the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

// Serve product.html
app.get('/product.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'product.html'));
});

// Serve success.html
app.get('/success.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'success.html'));
});

// Serve admin panel (addnew.html)
app.get('/addnew.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'addnew.html'));
});

// --------------------------------------------------------
// DATABASE CONNECTION
// --------------------------------------------------------

const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB!'))
    .catch(err => console.error('MongoDB Connection Error:', err));


// --------------------------------------------------------
// PAYMENT ROUTES (Uses existing paymentRoute)
// --------------------------------------------------------

app.use('/', paymentRoute);

// --------------------------------------------------------
// NEW: READ APIs for blogs and courses
// --------------------------------------------------------

// Helper to build absolute URL for images
function getBaseUrl(req) {
    return `${req.protocol}://${req.get('host')}`;
}

// GET all blogs
app.get('/api/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 }).lean();

        const baseUrl = getBaseUrl(req);
        const formatted = blogs.map(blog => ({
            _id: blog._id,
            Blog_title: blog.Blog_title,
            Blog_description: blog.Blog_description,
            blog_link: blog.blog_link,
            category: blog.category,
            createdAt: blog.createdAt || blog._id.getTimestamp(),
            imageUrl: `${baseUrl}/api/blogs/${blog._id}/image`
        }));

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching blogs:', err);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
});

// GET blog image
app.get('/api/blogs/:id/image', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id).select('Blog_img');
        if (!blog || !blog.Blog_img) {
            return res.status(404).send('Image not found');
        }
        res.set('Content-Type', 'image/jpeg');
        res.send(blog.Blog_img);
    } catch (err) {
        console.error('Error fetching blog image:', err);
        res.status(500).send('Error fetching image');
    }
});

// GET courses (free / paid)
app.get('/api/courses', async (req, res) => {
    try {
        const type = req.query.type; // free or paid
        const query = {};

        if (type === 'free') {
            query.course_type = 'free';
        } else if (type === 'paid') {
            query.course_type = 'paid';
        }

        const courses = await Course.find(query).sort({ createdAt: -1 }).lean();
        const baseUrl = getBaseUrl(req);

        const formatted = courses.map(course => ({
            _id: course._id,
            coursename: course.coursename,
            price: course.price,
            course_type: course.course_type,
            link: course.link,
            createdAt: course.createdAt || course._id.getTimestamp(),
            imageUrl: `${baseUrl}/api/courses/${course._id}/image`
        }));

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// GET course image
app.get('/api/courses/:id/image', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).select('course_img');
        if (!course || !course.course_img) {
            return res.status(404).send('Image not found');
        }
        res.set('Content-Type', 'image/jpeg');
        res.send(course.course_img);
    } catch (err) {
        console.error('Error fetching course image:', err);
        res.status(500).send('Error fetching image');
    }
});

// --------------------------------------------------------
// EXISTING DATA SUBMISSION LOGIC (POST routes preserved)
// --------------------------------------------------------

// Route for adding a new course
app.post('/add-course', (req, res) => {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, 'uploads');
    form.keepExtensions = true;

    if (!fs.existsSync(form.uploadDir)) {
        fs.mkdirSync(form.uploadDir);
    }

    // formidable v3 returns fields and files as arrays/single values
    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error('Form parsing error:', err);
            return res.status(500).send('Error parsing form data');
        }

        const courseImageFile = files.courseImage ? files.courseImage[0] : null;
        
        const coursename = fields.coursename ? fields.coursename[0] : undefined;
        const price = fields.price ? fields.price[0] : undefined;
        const course_type = fields.coursetype ? fields.coursetype[0] : undefined;
        const link = fields.courselink ? fields.courselink[0] : undefined;

        if (courseImageFile && courseImageFile.size > 0) {
            if (courseImageFile.size > 5000000) { 
                console.error('Image size exceeds limit:', courseImageFile.size);
                return res.status(400).send('Image size exceeds 5MB limit');
            }
            const oldPath = courseImageFile.filepath;
            const newFileName = Date.now() + '_' + courseImageFile.originalFilename;
            const newPath = path.join(form.uploadDir, newFileName);

            fs.rename(oldPath, newPath, async (err) => { 
                if (err) {
                    console.error('Error moving uploaded file:', err);
                    return res.status(500).send('Internal Server Error');
                }

                fs.readFile(newPath, async (err, data) => { 
                    if (err) {
                        console.error('Error reading image file:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    
                    try {
                        await Course.create({
                            course_img: data,
                            coursename: coursename,
                            price: price,
                            course_type: course_type,
                            link: link
                        });
                        
                        res.status(200).json({ success: true, message: 'Course added successfully' });

                    } catch (dbError) {
                        console.error('Database insertion error:', dbError);
                        return res.status(500).json({ success: false, message: 'Database error' });
                    }
                });
            });
        } else {
            console.error('No course image uploaded or file size is 0');
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }
    });
});

// Route for adding a new blog
app.post('/add-blog', (req, res) => {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, 'uploads');
    form.keepExtensions = true;

    if (!fs.existsSync(form.uploadDir)) {
        fs.mkdirSync(form.uploadDir);
    }

    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error('Form parsing error:', err);
            return res.status(500).send('Error parsing form data');
        }

        const blogImageFile = files.BlogImage ? files.BlogImage[0] : null;

        const BlogTitle = fields.BlogTitle ? fields.BlogTitle[0] : undefined;
        const BlogDescription = fields.BlogDescription ? fields.BlogDescription[0] : undefined;
        const BlogCategory = fields.BlogCategory ? fields.BlogCategory[0] : undefined;
        const blog_link = fields.bloglink ? fields.bloglink[0] : undefined;

        if (blogImageFile && blogImageFile.size > 0) {
            if (blogImageFile.size > 5000000) { 
                console.error('Image size exceeds limit:', blogImageFile.size);
                return res.status(400).send('Image size exceeds 5MB limit');
            }
            const oldPath = blogImageFile.filepath;
            const newFileName = Date.now() + '_' + blogImageFile.originalFilename;
            const newPath = path.join(form.uploadDir, newFileName);

            fs.rename(oldPath, newPath, async (err) => { 
                if (err) {
                    console.error('Error moving uploaded file:', err);
                    return res.status(500).send('Internal Server Error');
                }

                fs.readFile(newPath, async (err, data) => { 
                    if (err) {
                        console.error('Error reading image file:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    try {
                        await Blog.create({
                            Blog_title: BlogTitle,
                            Blog_description: BlogDescription,
                            Blog_img: data,
                            category: BlogCategory,
                            blog_link: blog_link
                        });
                        
                        res.status(200).json({ success: true, message: 'Blog added successfully' });

                    } catch (dbError) {
                        console.error('Database insertion error:', dbError);
                        return res.status(500).send('Error adding blog');
                    }
                });
            });
        } else {
            console.error('No blog image uploaded or file size is 0');
            return res.status(400).send('No image uploaded');
        }
    });
});

// Start the server
const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
