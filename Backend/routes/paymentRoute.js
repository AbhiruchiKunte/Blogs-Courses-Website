// Backend/routes/paymentRoute.js

import express from 'express';
import bodyParser from 'body-parser';
import { renderProductPage, createOrder } from '../controllers/paymentController.js';

const router = express.Router();
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));


// Route for product page (using the now-fixed controller)
router.get('/product', renderProductPage);

// Route for creating order (API)
router.post('/createOrder', createOrder);

// NEW: Export the router using ES Module syntax
export default router;