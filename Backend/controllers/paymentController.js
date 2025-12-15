import Razorpay from 'razorpay';
import dotenv from 'dotenv';

import crypto from 'crypto';
import User from '../models/User.js';
import Course from '../models/Course.js';
dotenv.config();

const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;

const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY
});

const renderProductPage = async (req, res) => {
    try {
        res.render('index');
    } catch (error) {
        console.log(error.message);
    }
};

const createOrder = async (req, res) => {
    try {
        const amount = req.body.amount * 100; // Converting to paise
        const options = {
            amount: amount,
            currency: 'INR',
            receipt: 'razorUser@gmail.com'
        };

        razorpayInstance.orders.create(options, (err, order) => {
            if (!err) {
                res.status(200).send({
                    success: true,
                    msg: 'Order Created',
                    order_id: order.id,
                    amount: amount,
                    key_id: RAZORPAY_ID_KEY,
                    product_name: req.body.name,
                    description: req.body.description,
                    contact: "9876543211",
                    name: "Abhiruchi Kunte",
                    email: "ruchiii@gmail.com"
                });
            } else {
                res.status(400).send({ success: false, msg: 'Something went wrong!' });
            }
        });
    } catch (error) {
        console.log(error.message);
    }
};

const verifyOrder = async (req, res) => {
    try {
        const { order_id, payment_id, signature, course_name, user_uid } = req.body;
        const secret = process.env.RAZORPAY_SECRET_KEY;

        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(order_id + '|' + payment_id)
            .digest('hex');

        if (generated_signature === signature) {
            // Payment is valid
            // Find Course (Use ID if available, else name fallback)
            let course;
            if (req.body.course_id) {
                course = await Course.findById(req.body.course_id);
            }
            // Fallback to name if ID search failed or ID wasn't provided
            if (!course && course_name) {
                course = await Course.findOne({ coursename: course_name });
            }

            if (!course) {
                return res.json({ success: true, message: 'Payment verified, but course not found' });
            }

            // Update User if uid is present
            if (user_uid) {
                await User.findOneAndUpdate(
                    { uid: user_uid },
                    { $addToSet: { purchasedCourses: course._id } }
                );
            }

            return res.status(200).json({ success: true, message: 'Payment verified and course added' });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Server Verification Error' });
    }
};

// NEW: Export named functions using ES Module syntax
export {
    renderProductPage,
    createOrder,
    verifyOrder
};
