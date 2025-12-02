require('dotenv').config();
const express = require('express');
const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose'); // NEW: MongoDB/Mongoose dependency

const app = express();
const http = require('http').Server(app);

// NEW: Import Mongoose Models
const Blog = require('./models/Blog'); 
const Course = require('./models/Course');

console.log('Views directory path:', path.join(__dirname, '../Frontend/views'));

// Set the view engine and views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../Frontend/views'));

app.use(express.static(path.join(__dirname, '../Frontend/public')));
app.use(express.urlencoded({ extended: true }));


// NEW: MongoDB/Mongoose Connection
const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB!'))
    .catch(err => console.error('MongoDB Connection Error:', err));
module.exports = { app }; // NEW: Export only the app

app.get('/', async (req, res) => {
    try {

        // NEW: Fetch Blogs from MongoDB
        const blogResults = await Blog.find({}).select('Blog_img Blog_title Blog_description blog_link createdAt').lean();
        const blogs = blogResults.map(blog => ({
            Blog_title: blog.Blog_title,
            Blog_description: blog.Blog_description,
            // Convert Buffer data back to base64 string for EJS
            Blog_img: `data:image/jpeg;base64,${blog.Blog_img.toString('base64')}`,
            created_at: blog.createdAt, // Use Mongoose's createdAt field
            blog_link: blog.blog_link
        }));


        // NEW: Fetch Free Courses from MongoDB
        const freeCourseResults = await Course.find({ price: 0 }).select('course_img coursename price link').lean();
        const freeCourses = freeCourseResults.map(course => ({
            coursename: course.coursename,
            price: course.price,
            link: course.link,
            // Convert Buffer data back to base64 string for EJS
            course_img: `data:image/jpeg;base64,${course.course_img.toString('base64')}`
        }));

        // NEW: Fetch Paid Courses from MongoDB
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
const paymentRoute = require('./routes/paymentRoute');
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

    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error('Form parsing error:', err);
            return res.status(500).send('Error parsing form data');
        }

        // Handle formidable v3 file structure
        const courseImageFile = files.courseImage ? files.courseImage[0] : null;
        
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
                        // NEW: Mongoose insert
                        await Course.create({
                            course_img: data,                          
                            coursename: fields.coursename[0],             
                            price: fields.price[0],
                            course_type: fields.coursetype[0],
                            link: fields.courselink[0]
                        });
                        

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

        // Handle formidable v3 file structure
        const blogImageFile = files.BlogImage ? files.BlogImage[0] : null;

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
                        // NEW: Mongoose insert
                        await Blog.create({
                            Blog_title: fields.BlogTitle[0],           
                            Blog_description: fields.BlogDescription[0],      
                            Blog_img: data, 
                            category: fields.BlogCategory[0],
                            blog_link: fields.bloglink[0]
                        });
                    

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});