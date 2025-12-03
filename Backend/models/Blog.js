import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({
    Blog_img: {
        type: Buffer, // Storing image binary data, consistent with old MySQL approach
        required: true
    },
    Blog_title: {
        type: String,
        required: true,
        trim: true
    },
    Blog_description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    blog_link: {
        type: String,
        required: true
    }
}, { timestamps: true }); // Mongoose automatically adds `createdAt` (equivalent to created_at)

const Blog = mongoose.model('Blog', BlogSchema);

export default Blog;