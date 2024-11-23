require('dotenv').config();
const express = require('express');
const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');

const app = express();
var http = require('http').Server(app);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
add
const paymentRoute = require('./routes/paymentRoute');
app.use('/', paymentRoute);

// Database pool configuration
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Abhiruchi@25',
    database: 'SciAstra',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

module.exports = { app, pool };


// Serve admin panel for blog management
app.get('/adminpanel', (req, res) => {
    res.sendFile(path.join(__dirname, 'adminpanel', 'addnew.html'));
});

//route for the display of blogs & courses data on the website
app.get('/blogs-courses-platform', async (req, res) => {
    try {
        // Query for blogs
        const blogsQuery = 'SELECT Blog_img, Blog_title, Blog_description, created_at, blog_link FROM blogs';
        const [blogResults] = await pool.query(blogsQuery);
        const blogs = blogResults.map(blog => ({
            ...blog,
            Blog_img: blog.Blog_img
                ? `data:image/jpeg;base64,${Buffer.from(blog.Blog_img).toString('base64')}`
                : null
        }));

        // Query for free courses
        const freeCoursesQuery = `
            SELECT course_img, coursename, price, link
            FROM courses 
            WHERE price = 0
        `;
        const [freeCourseResults] = await pool.query(freeCoursesQuery);
        const freeCourses = freeCourseResults.map(course => ({
            ...course,
            course_img: course.course_img
                ? `data:image/jpeg;base64,${Buffer.from(course.course_img).toString('base64')}`
                : null
        }));

        // Query for paid courses
        const paidCoursesQuery = `
            SELECT course_img, coursename, price, link 
            FROM courses 
            WHERE price > 0
        `;
        const [paidCourseResults] = await pool.query(paidCoursesQuery);
        const paidCourses = paidCourseResults.map(course => ({
            ...course,
            course_img: course.course_img
                ? `data:image/jpeg;base64,${Buffer.from(course.course_img).toString('base64')}`
                : null
        }));

        // Render the index page
        res.render('index', { blogs, freeCourses, paidCourses });

    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Internal Server Error');
    }
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

        if (files.courseImage && files.courseImage[0] && files.courseImage[0].size > 0) {
            if (files.courseImage[0].size > 5000000) { 
                console.error('Image size exceeds limit:', files.courseImage[0].size);
                return res.status(400).send('Image size exceeds 5MB limit');
            }
            const oldPath = files.courseImage[0].filepath;
            const newFileName = Date.now() + '_' + files.courseImage[0].originalFilename;
            const newPath = path.join(form.uploadDir, newFileName);

            // Move the file to the final location
            fs.rename(oldPath, newPath, (err) => {
                if (err) {
                    console.error('Error moving uploaded file:', err);
                    return res.status(500).send('Internal Server Error');
                }

                fs.readFile(newPath, (err, data) => {
                    if (err) {
                        console.error('Error reading image file:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    const query = `
                        INSERT INTO courses (course_img, coursename, price, course_type, link)
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    pool.query(query, [
                        data,                          
                        fields.coursename,             
                        fields.price,
                        fields.coursetype,
                        fields.courselink
                    ], (err, result) => {
                        if (err) {
                            console.error('Database insertion error:', err);
                             return res.status(500).json({ success: false, message: 'Database error' });
                        }
                    });
                });
            });
        } else {
            console.error('No course image uploaded or file size is 0');
            return res.status(400).json('No image uploaded');
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

        if (files.BlogImage && files.BlogImage[0] && files.BlogImage[0].size > 0) {
            if (files.BlogImage[0].size > 5000000) { 
                console.error('Image size exceeds limit:', files.BlogImage[0].size);
                return res.status(400).send('Image size exceeds 5MB limit');
            }
            const oldPath = files.BlogImage[0].filepath;
            const newFileName = Date.now() + '_' + files.BlogImage[0].originalFilename;
            const newPath = path.join(form.uploadDir, newFileName);

            // Move the file to the final location
            fs.rename(oldPath, newPath, (err) => {
                if (err) {
                    console.error('Error moving uploaded file:', err);
                    return res.status(500).send('Internal Server Error');
                }

                fs.readFile(newPath, (err, data) => {
                    if (err) {
                        console.error('Error reading image file:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    // SQL query for inserting the blog into the database
                    const query = `
                        INSERT INTO BLOGS (Blog_title, Blog_description, Blog_img, category, blog_link)
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    pool.query(query, [
                        fields.BlogTitle,           
                        fields.BlogDescription,      
                        data, 
                        fields.BlogCategory,
                        fields.bloglink
                    ], (err, result) => {
                        if (err) {
                            console.error('Database insertion error:', err);
                            return res.status(500).send('Error adding blog');
                        }
                    });
                });
            });
        } else {
            console.error('No blog image uploaded or file size is 0');
            return res.status(400).send('No image uploaded');
        }
    });
});

http.listen(3000, function(){
    console.log('Server is running');
});