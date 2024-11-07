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

const paymentRoute = require('./routes/paymentRoute');
app.use('/', paymentRoute);

// Database pool configuration
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'Sciltra',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

module.exports = { app, pool };


// Serve admin panel for blog management
app.get('/adminpanel', (req, res) => {
    res.sendFile(path.join(__dirname, 'adminpanel', 'addnew.html'));
});

// loads courses and blogs cards from database
const formatCourses = (courses) => {
    return courses.map(course => ({
        course_img: course.course_img ? `data:image/jpeg;base64,${course.course_img.toString('base64')}` : null,
        coursename: course.coursename,
        price: course.price,
        course_type: course.course_type
    }));
};

const formatBlogs = (blogs) => {
    return blogs.map(blog => ({
        Blog_img: blog.Blog_img ? `data:image/jpeg;base64,${blog.Blog_img.toString('base64')}` : null,
        Blog_title: blog.Blog_title,
        Blog_description: blog.Blog_description,
        created_at: new Date(blog.created_at).toLocaleString()
    }));
};

app.get('/', (req, res) => {
    const freeCoursesQuery = 'SELECT course_img, coursename, price, course_type FROM courses WHERE course_type = "free"';
    const paidCoursesQuery = 'SELECT course_img, coursename, price, course_type FROM courses WHERE course_type = "paid"';
    const blogsQuery = 'SELECT Blog_img, Blog_title, Blog_description, created_at FROM blogs';

    Promise.all([
        pool.query(freeCoursesQuery),
        pool.query(paidCoursesQuery),
        pool.query(blogsQuery)
    ])
    .then(([[freeCourses], [paidCourses], [blogs]]) => {
        const formattedFreeCourses = formatCourses(freeCourses);
        const formattedPaidCourses = formatCourses(paidCourses);
        const formattedBlogs = formatBlogs(blogs);

        console.log("Free Courses:", formattedFreeCourses);
        console.log("Paid Courses:", formattedPaidCourses);
        console.log("Blogs:", formattedBlogs);

        res.render('index', { 
            freeCourses: formattedFreeCourses, 
            paidCourses: formattedPaidCourses, 
            blogs: formattedBlogs 
        });
    })
    .catch(err => {
        console.error('Error fetching data:', err);
        res.status(500).send('Internal Server Error');
    });
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
                        INSERT INTO courses (course_img, coursename, price, course_type)
                        VALUES (?, ?, ?, ?)
                    `;
                    pool.query(query, [
                        data,                          
                        fields.coursename,             
                        fields.price,
                        fields.coursetype
                    ], (err, result) => {
                        if (err) {
                            console.error('Database insertion error:', err);
                            return res.status(500).send('Error adding course');
                        }
                        res.send('Course added successfully!');
                    });
                });
            });
        } else {
            console.error('No course image uploaded or file size is 0');
            return res.status(400).send('No image uploaded');
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
                        INSERT INTO BLOGS (Blog_title, Blog_description, Blog_img, category)
                        VALUES (?, ?, ?, ?)
                    `;
                    pool.query(query, [
                        fields.BlogTitle,           
                        fields.BlogDescription,      
                        data, 
                        fields.BlogCategory
                    ], (err, result) => {
                        if (err) {
                            console.error('Database insertion error:', err);
                            return res.status(500).send('Error adding blog');
                        }
                        res.send('Blog added successfully!');
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


