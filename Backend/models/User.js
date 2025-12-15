import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String
  },
  bio: { type: String, default: '' },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  profilePic: {
    type: Buffer
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  purchasedCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  enrolledCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course' // For free courses or tracked separately
  }],
  viewedBlogs: [{
    blogId: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog' },
    viewedAt: { type: Date, default: Date.now }
  }],
  viewedCourses: [{
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    viewedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model('User', userSchema);
