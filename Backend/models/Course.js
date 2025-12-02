const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    course_img: {
        type: Buffer, // Storing image binary data, consistent with old MySQL approach
        required: true
    },
    coursename: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true
    },
    course_type: { 
        type: String,
        enum: ['free', 'paid'],
        required: true
    },
    link: {
        type: String, 
        required: true
    }
}, { timestamps: true }); // Mongoose automatically adds `createdAt` (equivalent to created_at)

const Course = mongoose.model('Course', CourseSchema);

module.exports = Course;   