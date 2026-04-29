const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'SpaceX@11',
    database: 'attndly_db'
});

db.connect((err) => {
    if (err) {
        console.error('❌ MySQL connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL database');
    }
});

const JWT_SECRET = 'attndly_secret_key_2026';

// Authentication middleware
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

// Login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.query('SELECT * FROM teachers WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const teacher = results[0];
        let valid = false;
        
        if (teacher.password_hash.startsWith('$2a$')) {
            valid = await bcrypt.compare(password, teacher.password_hash);
        } else {
            valid = (password === teacher.password_hash);
        }
        
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        
        db.query('SELECT id, section_name, subject FROM sections WHERE teacher_id = ?', [teacher.id], (err, sections) => {
            const token = jwt.sign({ id: teacher.id, email: teacher.email, name: teacher.name }, JWT_SECRET, { expiresIn: '24h' });
            res.json({
                token,
                user: {
                    id: teacher.id,
                    name: teacher.name,
                    email: teacher.email,
                    sections: sections
                }
            });
        });
    });
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    const { name, email, password, sections } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query('INSERT INTO teachers (name, email, password_hash) VALUES (?, ?, ?)', 
            [name, email, hashedPassword], 
            (err, result) => {
                if (err) return res.status(500).json({ error: 'Email already exists' });
                
                const teacherId = result.insertId;
                const sectionQueries = sections.map(section => {
                    const [sectionName, subject] = section.split(':');
                    return new Promise((resolve, reject) => {
                        db.query('INSERT INTO sections (section_name, subject, teacher_id, academic_year) VALUES (?, ?, ?, ?)',
                            [sectionName.trim(), subject.trim(), teacherId, '2026-27'],
                            (err) => err ? reject(err) : resolve());
                    });
                });
                
                Promise.all(sectionQueries)
                    .then(() => res.status(201).json({ message: 'Registration successful!' }))
                    .catch(() => res.status(500).json({ error: 'Error creating sections' }));
            });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get students for a specific section
app.get('/api/section/:sectionId/students', auth, (req, res) => {
    const { sectionId } = req.params;
    const teacherId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
  console.log('🔔 Notifications route hit for teacher:', req.user.id); // ADD THIS
    db.query(`
        SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at,
               s.section_name, s.subject
        FROM notifications n
        LEFT JOIN sections s ON n.section_id = s.id
        WHERE n.teacher_id = ?
        ORDER BY n.created_at DESC
    `, [req.user.id], (err, results) => {
        console.log('Query result:', err, results); // ADD THIS
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(results);
    });
        
        const studentsQuery = `
            SELECT 
                st.id,
                st.roll_number,
                st.name,
                a.status as today_status
            FROM students st
            LEFT JOIN attendance a ON a.student_id = st.id AND a.attendance_date = ?
            WHERE st.section_id = ?
            ORDER BY st.roll_number
        `;
        
        db.query(studentsQuery, [today, sectionId], (err, students) => {
            if (err) {
                console.error('Students query error:', err);
                return res.status(500).json({ error: 'Database error fetching students' });
            }
            console.log(`Found ${students.length} students for section ${sectionId}`);
            res.json(students);
        });
    });


// Get sections with stats
app.get('/api/teacher/sections', auth, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.query(`
        SELECT s.id, s.section_name, s.subject, COUNT(st.id) as total_students,
        SUM(CASE WHEN a.status = 'present' AND a.attendance_date = ? THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' AND a.attendance_date = ? THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'late' AND a.attendance_date = ? THEN 1 ELSE 0 END) as late_count
        FROM sections s
        LEFT JOIN students st ON st.section_id = s.id
        LEFT JOIN attendance a ON a.student_id = st.id AND a.attendance_date = ?
        WHERE s.teacher_id = ?
        GROUP BY s.id
    `, [today, today, today, today, req.user.id], (err, results) => {
        if (err) {
            console.error('Sections query error:', err);
            return res.status(500).json({ error: 'DB error' });
        }
        res.json(results);
    });
});

// Dashboard stats
app.get('/api/dashboard/stats', auth, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.query(`
        SELECT 
            COUNT(DISTINCT st.id) as total_students,
            SUM(CASE WHEN a.status = 'present' AND a.attendance_date = ? THEN 1 ELSE 0 END) as present_today,
            SUM(CASE WHEN a.status = 'absent' AND a.attendance_date = ? THEN 1 ELSE 0 END) as absent_today,
            SUM(CASE WHEN a.status = 'late' AND a.attendance_date = ? THEN 1 ELSE 0 END) as late_today
        FROM sections s
        LEFT JOIN students st ON st.section_id = s.id
        LEFT JOIN attendance a ON a.student_id = st.id AND a.attendance_date = ?
        WHERE s.teacher_id = ?
    `, [today, today, today, today, req.user.id], (err, results) => {
        if (err) {
            console.error('Stats query error:', err);
            return res.status(500).json({ error: 'DB error' });
        }
        res.json(results[0] || { total_students: 0, present_today: 0, absent_today: 0, late_today: 0 });
    });
});

// Save attendance
app.post('/api/attendance/save', auth, (req, res) => {
    const { sectionId, attendance } = req.body;
    const teacherId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    if (!sectionId || !attendance) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    db.query('SELECT id FROM sections WHERE id = ? AND teacher_id = ?', [sectionId, teacherId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const queries = Object.entries(attendance).map(([studentId, status]) => {
            return new Promise((resolve, reject) => {
                db.query(`
                    INSERT INTO attendance (student_id, section_id, attendance_date, status, marked_by)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        status = ?, 
                        marked_by = ?, 
                        marked_at = CURRENT_TIMESTAMP
                `, [studentId, sectionId, today, status, teacherId, status, teacherId], (err) => {
                    if (err) { reject(err); } else { resolve(); }
                });
            });
        });
        
        Promise.all(queries)
            .then(() => res.json({ message: 'Attendance saved successfully!' }))
            .catch((err) => {
                console.error('Error saving attendance:', err);
                res.status(500).json({ error: 'Error saving attendance' });
            });
    });
});

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────

// ✅ MUST come before /api/notifications/:id/read to avoid route conflict
app.get('/api/notifications/unread-count', auth, (req, res) => {
    db.query(
        'SELECT COUNT(*) as count FROM notifications WHERE teacher_id = ? AND is_read = FALSE',
        [req.user.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ count: results[0].count });
        }
    );
});

// ✅ MUST come before /:id/read to avoid route conflict
app.put('/api/notifications/mark-all-read', auth, (req, res) => {
    db.query(
        'UPDATE notifications SET is_read = TRUE WHERE teacher_id = ?',
        [req.user.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ message: 'All notifications marked as read' });
        }
    );
});

// Get all notifications for logged-in teacher
app.get('/api/notifications', auth, (req, res) => {
    db.query(`
        SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at,
               s.section_name, s.subject
        FROM notifications n
        LEFT JOIN sections s ON n.section_id = s.id
        WHERE n.teacher_id = ?
        ORDER BY n.created_at DESC
    `, [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(results);
    });
});

// Mark a single notification as read
app.put('/api/notifications/:id/read', auth, (req, res) => {
    db.query(
        'UPDATE notifications SET is_read = TRUE WHERE id = ? AND teacher_id = ?',
        [req.params.id, req.user.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ message: 'Notification marked as read' });
        }
    );
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📍 Login: http://localhost:${PORT}/login.html`);
    console.log(`📍 Dashboard: http://localhost:${PORT}/dashboard.html\n`);
});
