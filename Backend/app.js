// app.js
import dotenv from 'dotenv';
import express from 'express';
import formidable from 'formidable';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import cors from 'cors';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import compression from 'compression';

import Blog from './models/Blog.js';
import Course from './models/Course.js';
import paymentRoute from './routes/paymentRoute.js';

dotenv.config();
const app = express();

// ---------- PATHS / DIR ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static for /public and /Images (frontend assets)
app.use(express.static(path.join(__dirname, '../Frontend/public')));
app.use(
  '/Images',
  express.static(path.join(__dirname, '../Frontend/public/Images'))
);

// ---------- BASIC PAGES ----------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

app.get('/product.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend', 'product.html'));
});

app.get('/success.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend', 'success.html'));
});

app.get('/addnew.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend', 'addnew.html'));
});

// ---------- DB CONNECTION ----------
const mongoUri = process.env.MONGODB_URI;
mongoose
  .connect(mongoUri)
  .then(() => console.log('Connected to MongoDB!'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// ---------- PAYMENT ROUTES ----------
app.use('/', paymentRoute);

// ---------- HELPERS ----------
function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// helper to create formidable form
function createForm(uploadDir) {
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
async function optimizeToWebP(buffer) {
  const optimizedBuffer = await sharp(buffer)
    .resize({ width: 500 })    // good for cards
    .webp({ quality: 70 })
    .toBuffer();
  return optimizedBuffer;
}

// ---------- READ APIs (blogs / courses) ----------

// GET all blogs
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 }).lean();
    const baseUrl = getBaseUrl(req);

    const formatted = blogs.map((blog) => ({
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

    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('ETag', `"blog-${req.params.id}"`);

    res.send(blog.Blog_img);
  } catch (err) {
    console.error('Error fetching blog image:', err);
    res.status(500).send('Error fetching image');
  }
});

// GET courses (free / paid)
app.get('/api/courses', async (req, res) => {
  try {
    const type = req.query.type;
    const query = {};

    if (type === 'free') query.course_type = 'free';
    else if (type === 'paid') query.course_type = 'paid';

    const courses = await Course.find(query).sort({ createdAt: -1 }).lean();
    const baseUrl = getBaseUrl(req);

    const formatted = courses.map((course) => ({
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

    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('ETag', `"course-${req.params.id}"`);

    res.send(course.course_img);
  } catch (err) {
    console.error('Error fetching course image:', err);
    res.status(500).send('Error fetching image');
  }
});

// ---------- CREATE (ADD) BLOG / COURSE ----------

// POST /add-course
app.post('/add-course', (req, res, next) => {
  const uploadDir = path.join(__dirname, 'uploads');
  let form;

  try {
    form = createForm(uploadDir);
  } catch (err) {
    console.error('Error creating formidable form (course):', err);
    return next(err);
  }

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error('Form parsing error (course):', err);
      return res
        .status(500)
        .json({ success: false, message: 'Error parsing form data' });
    }

    let courseImageFile = files.courseImage;
    if (Array.isArray(courseImageFile)) courseImageFile = courseImageFile[0];

    const coursename = Array.isArray(fields.coursename)
      ? fields.coursename[0]
      : fields.coursename;
    const price = Array.isArray(fields.price) ? fields.price[0] : fields.price;
    const course_type = Array.isArray(fields.coursetype)
      ? fields.coursetype[0]
      : fields.coursetype;
    const link = Array.isArray(fields.courselink)
      ? fields.courselink[0]
      : fields.courselink;

    if (!courseImageFile || courseImageFile.size <= 0) {
      console.error('No course image uploaded or file size is 0');
      return res
        .status(400)
        .json({ success: false, message: 'No image uploaded' });
    }

    if (courseImageFile.size > 5000000) {
      console.error('Image size exceeds limit (course):', courseImageFile.size);
      return res
        .status(400)
        .json({ success: false, message: 'Image size exceeds 5MB limit' });
    }

    const oldPath = courseImageFile.filepath || courseImageFile.path;
    const newFileName =
      Date.now() + '_' + (courseImageFile.originalFilename || courseImageFile.name);
    const newPath = path.join(uploadDir, newFileName);

    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error('Error moving uploaded file (course):', err);
        return res
          .status(500)
          .json({ success: false, message: 'Internal Server Error (moving file)' });
      }

      fs.readFile(newPath, async (err, data) => {
        if (err) {
          console.error('Error reading image file (course):', err);
          return res
            .status(500)
            .json({ success: false, message: 'Internal Server Error (reading file)' });
        }

        try {
          const optimizedBuffer = await optimizeToWebP(data);

          await Course.create({
            course_img: optimizedBuffer,
            coursename,
            price,
            course_type,
            link
          });

          return res
            .status(200)
            .json({ success: true, message: 'Course added successfully' });
        } catch (dbError) {
          console.error('Database insertion error (course):', dbError);
          return res
            .status(500)
            .json({ success: false, message: 'Database error' });
        }
      });
    });
  });
});

// POST /add-blog
app.post('/add-blog', (req, res, next) => {
  const uploadDir = path.join(__dirname, 'uploads');
  let form;

  try {
    form = createForm(uploadDir);
  } catch (err) {
    console.error('Error creating formidable form (blog):', err);
    return next(err);
  }

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error('Form parsing error (blog):', err);
      return res
        .status(500)
        .json({ success: false, message: 'Error parsing form data' });
    }

    let blogImageFile = files.BlogImage;
    if (Array.isArray(blogImageFile)) blogImageFile = blogImageFile[0];

    const BlogTitle = Array.isArray(fields.BlogTitle)
      ? fields.BlogTitle[0]
      : fields.BlogTitle;
    const BlogDescription = Array.isArray(fields.BlogDescription)
      ? fields.BlogDescription[0]
      : fields.BlogDescription;
    const BlogCategory = Array.isArray(fields.BlogCategory)
      ? fields.BlogCategory[0]
      : fields.BlogCategory;
    const blog_link = Array.isArray(fields.bloglink)
      ? fields.bloglink[0]
      : fields.bloglink;

    if (!blogImageFile || blogImageFile.size <= 0) {
      console.error('No blog image uploaded or file size is 0');
      return res
        .status(400)
        .json({ success: false, message: 'No image uploaded' });
    }

    if (blogImageFile.size > 5000000) {
      console.error('Image size exceeds limit (blog):', blogImageFile.size);
      return res
        .status(400)
        .json({ success: false, message: 'Image size exceeds 5MB limit' });
    }

    const oldPath = blogImageFile.filepath || blogImageFile.path;
    const newFileName =
      Date.now() + '_' + (blogImageFile.originalFilename || blogImageFile.name);
    const newPath = path.join(uploadDir, newFileName);

    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error('Error moving uploaded file (blog):', err);
        return res
          .status(500)
          .json({ success: false, message: 'Internal Server Error (moving file)' });
      }

      fs.readFile(newPath, async (err, data) => {
        if (err) {
          console.error('Error reading image file (blog):', err);
          return res
            .status(500)
            .json({ success: false, message: 'Internal Server Error (reading file)' });
        }

        try {
          const optimizedBuffer = await optimizeToWebP(data);

          await Blog.create({
            Blog_title: BlogTitle,
            Blog_description: BlogDescription,
            Blog_img: optimizedBuffer,
            category: BlogCategory,
            blog_link
          });

          return res
            .status(200)
            .json({ success: true, message: 'Blog added successfully' });
        } catch (dbError) {
          console.error('Database insertion error (blog):', dbError);
          return res
            .status(500)
            .json({ success: false, message: 'Error adding blog' });
        }
      });
    });
  });
});

// ---------- UPDATE (FIELDS) BLOG / COURSE ----------

app.put('/api/blogs/:id', async (req, res) => {
  try {
    const { Blog_title, Blog_description, category, blog_link } = req.body;

    const updated = await Blog.findByIdAndUpdate(
      req.params.id,
      { Blog_title, Blog_description, category, blog_link },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    res.json({ success: true, blog: updated });
  } catch (err) {
    console.error('Error updating blog:', err);
    res.status(500).json({ success: false, message: 'Error updating blog' });
  }
});

app.put('/api/courses/:id', async (req, res) => {
  try {
    const { coursename, price, course_type, link } = req.body;

    const updated = await Course.findByIdAndUpdate(
      req.params.id,
      { coursename, price, course_type, link },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    res.json({ success: true, course: updated });
  } catch (err) {
    console.error('Error updating course:', err);
    res.status(500).json({ success: false, message: 'Error updating course' });
  }
});

// ---------- UPDATE IMAGE BLOG / COURSE (NEW) ----------

// PUT /api/blogs/:id/image  (BlogImage file)
app.put('/api/blogs/:id/image', (req, res, next) => {
  const uploadDir = path.join(__dirname, 'uploads');
  let form;

  try {
    form = createForm(uploadDir);
  } catch (err) {
    console.error('Error creating formidable form (blog image update):', err);
    return next(err);
  }

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error('Form parsing error (blog image update):', err);
      return res
        .status(500)
        .json({ success: false, message: 'Error parsing image form data' });
    }

    let blogImageFile = files.BlogImage;
    if (Array.isArray(blogImageFile)) blogImageFile = blogImageFile[0];

    if (!blogImageFile || blogImageFile.size <= 0) {
      console.error('No blog image uploaded or file size is 0 (update)');
      return res
        .status(400)
        .json({ success: false, message: 'No image uploaded' });
    }

    if (blogImageFile.size > 5000000) {
      console.error(
        'Image size exceeds limit (blog update):',
        blogImageFile.size
      );
      return res
        .status(400)
        .json({ success: false, message: 'Image size exceeds 5MB limit' });
    }

    const oldPath = blogImageFile.filepath || blogImageFile.path;
    const newFileName =
      Date.now() + '_' + (blogImageFile.originalFilename || blogImageFile.name);
    const newPath = path.join(uploadDir, newFileName);

    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error('Error moving uploaded file (blog update):', err);
        return res
          .status(500)
          .json({ success: false, message: 'Internal Server Error (moving file)' });
      }

      fs.readFile(newPath, async (err, data) => {
        if (err) {
          console.error('Error reading image file (blog update):', err);
          return res
            .status(500)
            .json({ success: false, message: 'Internal Server Error (reading file)' });
        }

        try {
          const optimizedBuffer = await optimizeToWebP(data);

          await Blog.findByIdAndUpdate(req.params.id, {
            Blog_img: optimizedBuffer
          });

          return res.json({ success: true, message: 'Blog image updated' });
        } catch (dbError) {
          console.error('Database update error (blog image):', dbError);
          return res
            .status(500)
            .json({ success: false, message: 'Database error updating image' });
        }
      });
    });
  });
});

// PUT /api/courses/:id/image  (courseImage file)
app.put('/api/courses/:id/image', (req, res, next) => {
  const uploadDir = path.join(__dirname, 'uploads');
  let form;

  try {
    form = createForm(uploadDir);
  } catch (err) {
    console.error('Error creating formidable form (course image update):', err);
    return next(err);
  }

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error('Form parsing error (course image update):', err);
      return res
        .status(500)
        .json({ success: false, message: 'Error parsing image form data' });
    }

    let courseImageFile = files.courseImage;
    if (Array.isArray(courseImageFile)) courseImageFile = courseImageFile[0];

    if (!courseImageFile || courseImageFile.size <= 0) {
      console.error('No course image uploaded or file size is 0 (update)');
      return res
        .status(400)
        .json({ success: false, message: 'No image uploaded' });
    }

    if (courseImageFile.size > 5000000) {
      console.error(
        'Image size exceeds limit (course update):',
        courseImageFile.size
      );
      return res
        .status(400)
        .json({ success: false, message: 'Image size exceeds 5MB limit' });
    }

    const oldPath = courseImageFile.filepath || courseImageFile.path;
    const newFileName =
      Date.now() +
      '_' +
      (courseImageFile.originalFilename || courseImageFile.name);
    const newPath = path.join(uploadDir, newFileName);

    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error('Error moving uploaded file (course update):', err);
        return res
          .status(500)
          .json({ success: false, message: 'Internal Server Error (moving file)' });
      }

      fs.readFile(newPath, async (err, data) => {
        if (err) {
          console.error('Error reading image file (course update):', err);
          return res
            .status(500)
            .json({ success: false, message: 'Internal Server Error (reading file)' });
        }

        try {
          const optimizedBuffer = await optimizeToWebP(data);

          await Course.findByIdAndUpdate(req.params.id, {
            course_img: optimizedBuffer
          });

          return res.json({ success: true, message: 'Course image updated' });
        } catch (dbError) {
          console.error('Database update error (course image):', dbError);
          return res
            .status(500)
            .json({ success: false, message: 'Database error updating image' });
        }
      });
    });
  });
});

// ---------- DELETE BLOG / COURSE ----------
app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting blog:', err);
    res.status(500).json({ success: false, message: 'Error deleting blog' });
  }
});

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const deleted = await Course.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: 'Course not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ success: false, message: 'Error deleting course' });
  }
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error('UNCAUGHT ERROR:', err.stack || err);
  if (res.headersSent) return next(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message || 'Unknown error'
  });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
