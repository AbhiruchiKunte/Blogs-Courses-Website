import mongoose from 'mongoose';

const CourseSchema = new mongoose.Schema({
    course_img: {
        type: Buffer,
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
}, { timestamps: true });

const Course = mongoose.model('Course', CourseSchema);

export default Course;