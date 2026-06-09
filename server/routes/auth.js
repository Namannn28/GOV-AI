const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

const router = express.Router();

/* ── Register ── */
router.post('/register',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }),
        body('full_name').notEmpty().trim(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { email, password, full_name, mobile, department } = req.body;

            const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
            if (existing.rows.length > 0) {
                return res.status(400).json({ success: false, message: 'User already exists with this email' });
            }

            const hashed = await bcrypt.hash(password, 10);

            const result = await db.query(
                `INSERT INTO users (email, password, full_name, mobile, department, role)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [email, hashed, full_name, mobile || null, department || 'General', 'citizen']
            );

            const newUser = await db.query('SELECT * FROM users WHERE email = ?', [email]);
            const user = newUser.rows[0];

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        full_name: user.full_name,
                        department: user.department,
                        role: user.role,
                        profile_completed: false,
                    },
                    token,
                },
            });
        } catch (err) {
            console.error('Registration error:', err);
            res.status(500).json({ success: false, message: 'Server error during registration' });
        }
    }
);

/* ── Login ── */
router.post('/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { email, password } = req.body;

            const result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
            if (result.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const user = result.rows[0];
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            await db.query(
                `UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [user.id]
            );

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        full_name: user.full_name,
                        mobile: user.mobile,
                        department: user.department,
                        role: user.role,
                        profile_completed: !!user.profile_completed,
                    },
                    token,
                },
            });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ success: false, message: 'Server error during login' });
        }
    }
);

/* ── OAuth (mock) ── */
router.post('/oauth/:provider', async (req, res) => {
    try {
        const { provider } = req.params;
        const email = `${provider.toLowerCase()}_${Date.now()}@govai.com`;
        const full_name = req.body.name || `${provider} User`;

        let result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        let user;

        if (result.rows.length === 0) {
            const randomPwd = await bcrypt.hash(Math.random().toString(36), 10);
            await db.query(
                `INSERT INTO users (email, password, full_name, department, is_verified)
                 VALUES (?, ?, ?, ?, 1)`,
                [email, randomPwd, full_name, 'Digital Innovation']
            );
            const newRes = await db.query('SELECT * FROM users WHERE email = ?', [email]);
            user = newRes.rows[0];
        } else {
            user = result.rows[0];
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'OAuth login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    department: user.department,
                    role: user.role,
                    profile_completed: !!user.profile_completed,
                },
                token,
            },
        });
    } catch (err) {
        console.error('OAuth error:', err);
        res.status(500).json({ success: false, message: 'Server error during OAuth login' });
    }
});

module.exports = router;
