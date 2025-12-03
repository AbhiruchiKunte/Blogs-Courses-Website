import dotenv from 'dotenv';
import express from 'express';
import formidable from 'formidable';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import cors from 'cors';
import { fileURLToPath } from 'url'; // NEW: For ES Modules __dirname equivalent

import Blog from './models/Blog.js'; 
import Course from './models/Course.js'; 
import paymentRoute from './routes/paymentRoute.js'; 

dotenv.config();
const app = express();
app.use(cors());

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Views directory path:', path.join(__dirname, '../Frontend/views'));

// Set the view engine and views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../Frontend/views'));

app.use(express.static(path.join(__dirname, '../Frontend/public')));
app.use(express.urlencoded({ extended: true }));


// MongoDB/Mongoose Connection
const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB!'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Export app for potential testing/server setup (If the server is started here, this export might not be necessary)
// export default app; // Option 1: Default export (if another file imports and runs the server)

app.get('/', async (req, res) => {
    try {
        // Fetch Blogs from MongoDB
        const blogResults = await Blog.find({}).select('Blog_img Blog_title Blog_description blog_link createdAt').lean();
        const blogs = blogResults.map(blog => ({
            Blog_title: blog.Blog_title,
            Blog_description: blog.Blog_description,
            // Convert Buffer data back to base64 string for EJS
            Blog_img: `data:image/jpeg;base64,${blog.Blog_img.toString('base64')}`,
            created_at: blog.createdAt, // Use Mongoose's createdAt field
            blog_link: blog.blog_link
        }));

        // Fetch Free Courses from MongoDB
        const freeCourseResults = await Course.find({ price: 0 }).select('course_img coursename price link').lean();
        const freeCourses = freeCourseResults.map(course => ({
            coursename: course.coursename,
            price: course.price,
            link: course.link,
            // Convert Buffer data back to base64 string for EJS
            course_img: `data:image/jpeg;base64,${course.course_img.toString('base64')}`
        }));

        // Fetch Paid Courses from MongoDB
        const paidCourseResults = await Course.find({ price: { $gt: 0 } }).select('course_img coursename price link').lean();
        const paidCourses = paidCourseResults.map(course => ({
            coursename: course.coursename,
            price: course.price,
            link: course.link,
            // Convert Buffer data back to base64 string for EJS
            course_img: `data:image/jpeg;base64,${course.course_img.toString('base64')}`
        }));

        // Render the data
        res.render('index', { blogs, freeCourses, paidCourses });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Import and use payment routes
app.use('/', paymentRoute);

// Serve admin panel
app.get('/adminpanel', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/adminpanel', 'addnew.html'));
});

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

        // Handle formidable v3 file structure (files.courseImage is an array in v3)
        const courseImageFile = files.courseImage ? files.courseImage[0] : null;
        
        // Handle formidable v3 fields structure (fields are arrays in v3)
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

            // Move the file to the final location
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
                        // Mongoose insert
                        await Course.create({
                            course_img: data,                      
                            coursename: coursename,               
                            price: price,
                            course_type: course_type,
                            link: link
                        });
                        
                        // Respond to the client on success
                        res.status(200).json({ success: true, message: 'Course added successfully' });

                    } catch (dbError) {
                        console.error('Database insertion error:', dbError);
                        // Respond to the client on error
                        return res.status(500).json({ success: false, message: 'Database error' });
                    }
                });
            });
        } else {
            console.error('No course image uploaded or file size is 0');
            // Ensure a response is sent for failed upload
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

        // Handle formidable v3 file structure (files.BlogImage is an array in v3)
        const blogImageFile = files.BlogImage ? files.BlogImage[0] : null;

        // Handle formidable v3 fields structure (fields are arrays in v3)
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

            // Move the file to the final location
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
                        // Mongoose insert
                        await Blog.create({
                            Blog_title: BlogTitle,           
                            Blog_description: BlogDescription,  
                            Blog_img: data, 
                            category: BlogCategory,
                            blog_link: blog_link
                        });
                        
                        // Respond to the client on success
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
const PORT = process.env.PORT || 3000; // Added default port
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});