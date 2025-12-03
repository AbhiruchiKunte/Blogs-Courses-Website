import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url'; // NEW: For ES Modules __dirname equivalent

// NEW: Import from controller using ES Module named imports
import { renderProductPage, createOrder } from '../controllers/paymentController.js';

const router = express.Router();
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));

// ES Module equivalent of __dirname (if needed)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: Do NOT call router.set('view engine', ...) — that's for the app instance.
// The app (in app.js) should set view engine and views directory.

router.get('/index', (req, res) => {
    res.render('index');
});

router.get('/', (req, res) => {
    res.render('index');
});

// Use imported functions directly
router.get('/product', renderProductPage);

// Route for creating order
router.post('/createOrder', createOrder);

// NEW: Export the router using ES Module syntax
export default router;