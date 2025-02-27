const express = require('express');
const { body } = require('express-validator');
const { register, verifyEmail, login } = require('../controllers/userController');
const { forgotPassword, resetPassword } = require('../controllers/userController');

const router = express.Router();

// Register Route
router.post(
    '/register',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
            .matches(/[A-Z]/)
            .withMessage('Password must include an uppercase letter')
            .matches(/[a-z]/)
            .withMessage('Password must include a lowercase letter')
            .matches(/\d/)
            .withMessage('Password must include a number')
            .matches(/[@$!%*?&]/)
            .withMessage('Password must include a special character'),
    ],
    register
);

// Verify Email Route
router.get('/verify/:token', verifyEmail);

// Forgot Password Route
router.post('/forgot-password', forgotPassword);

// Reset Password Route
router.post(
    '/reset-password',
    [
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
            .matches(/[A-Z]/)
            .withMessage('Password must include an uppercase letter')
            .matches(/[a-z]/)
            .withMessage('Password must include a lowercase letter')
            .matches(/\d/)
            .withMessage('Password must include a number')
            .matches(/[@$!%*?&]/)
            .withMessage('Password must include a special character'),
    ],
    resetPassword
);


// Login Route
router.post('/login', login);

module.exports = router;
