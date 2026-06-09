const express = require('express');
const authMiddleware = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/* ── GET /api/users/profile ── */
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.email, u.full_name, u.mobile, u.department, u.role,
                    u.is_verified, u.profile_completed,
                    p.resume_url, p.skills, p.education, p.experience, p.certifications, p.preferences
             FROM users u
             LEFT JOIN user_profiles p ON u.id = p.user_id
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const row = result.rows[0];
        // Parse JSON strings stored in SQLite
        ['skills', 'education', 'experience', 'certifications', 'preferences'].forEach(k => {
            if (typeof row[k] === 'string') {
                try { row[k] = JSON.parse(row[k]); } catch { /* keep as string */ }
            }
        });

        res.json({ success: true, data: row });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching profile' });
    }
});

/* ── PUT /api/users/profile ── */
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { full_name, mobile, department, resume_url, skills, education, experience, certifications, preferences } = req.body;

        if (full_name || mobile || department) {
            await db.query(
                `UPDATE users
                 SET full_name  = COALESCE(?, full_name),
                     mobile     = COALESCE(?, mobile),
                     department = COALESCE(?, department),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [full_name || null, mobile || null, department || null, req.user.id]
            );
        }

        const profileCheck = await db.query(
            'SELECT id FROM user_profiles WHERE user_id = ?',
            [req.user.id]
        );

        const skillsStr = skills ? JSON.stringify(skills) : null;
        const eduStr = education ? JSON.stringify(education) : null;
        const expStr = experience ? JSON.stringify(experience) : null;
        const certsStr = certifications ? JSON.stringify(certifications) : null;
        const prefStr = preferences ? JSON.stringify(preferences) : null;

        if (profileCheck.rows.length === 0) {
            await db.query(
                `INSERT INTO user_profiles (user_id, resume_url, skills, education, experience, certifications, preferences)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.user.id, resume_url || null, skillsStr, eduStr, expStr, certsStr, prefStr]
            );
        } else {
            await db.query(
                `UPDATE user_profiles
                 SET resume_url     = COALESCE(?, resume_url),
                     skills         = COALESCE(?, skills),
                     education      = COALESCE(?, education),
                     experience     = COALESCE(?, experience),
                     certifications = COALESCE(?, certifications),
                     preferences    = COALESCE(?, preferences),
                     updated_at     = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [resume_url || null, skillsStr, eduStr, expStr, certsStr, prefStr, req.user.id]
            );
        }

        // Mark profile as completed if key fields are present
        if (full_name || skills) {
            await db.query(
                'UPDATE users SET profile_completed = 1 WHERE id = ?',
                [req.user.id]
            );
        }

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ success: false, message: 'Server error updating profile' });
    }
});

/* ── GET /api/users/notifications ── */
router.get('/notifications', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
            [req.user.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching notifications' });
    }
});

/* ── PUT /api/users/notifications/:id/read ── */
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        console.error('Mark notification error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
