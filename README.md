# Attndly - Automated School Attendance Management System

A lightweight, teacher-focused web application for marking and tracking
student attendance digitally. Built with Node.js, Express, and MySQL.

---

## Features

- Teacher registration & login with JWT authentication
- Real-time dashboard with Present / Absent / Late stats
- Multi-section support per teacher
- Per-student attendance marking (Present / Absent / Late / Excused / Holiday)
- Bulk actions — Mark All Present or Mark All Absent
- Notification system with unread badge count
- Duplicate attendance prevention (one record per student per day)
- Academic year support

---

## Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Database   | MySQL 8.0               |
| Backend    | Node.js + Express.js    |
| Auth       | JWT + bcryptjs          |
| Frontend   | HTML, CSS, Vanilla JS   |
| API Style  | RESTful JSON            |

---

## Project Structure
 attndly/
│
├── 📄 .gitignore
├── 📄 package.json
├── 📄 server.js            # Express backend + all API routes
│
└── 📁 public/
    ├── 📄 login.html       # Sign In & Create Account page
    └── 📄 dashboard.html   # Main teacher dashboard

---

## Setup & Installation

### Prerequisites
- Node.js v18+
- MySQL 8.0+

### 1. Clone the repository

```bash
git clone https://github.com/your-username/attndly.git
cd attndly
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the MySQL database

Open MySQL and run the following:

```sql
CREATE DATABASE attndly_db;
USE attndly_db;

CREATE TABLE teachers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    section_name VARCHAR(10) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    teacher_id INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_section_teacher (section_name, teacher_id, academic_year)
);

CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    roll_number VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    section_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_section (roll_number, section_id)
);

CREATE TABLE attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    section_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('present','absent','late','excused','holiday') NOT NULL,
    marked_by INT NOT NULL,
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES teachers(id),
    UNIQUE KEY unique_daily_attendance (student_id, attendance_date)
);

CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    section_id INT,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('attendance_alert','low_attendance','general','reminder') NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
);
```

### 4. Configure your database credentials

Open `server.js` and update this block with your MySQL credentials:

```javascript
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'YOUR_PASSWORD_HERE',
    database: 'attndly_db'
});
```

### 5. Start the server

```bash
node server.js
```

### 6. Open in browser
http://localhost:3000/login.html
---

## Database Schema
teachers      → id, name, email, password_hash, created_at
sections      → id, section_name, subject, teacher_id (FK), academic_year
students      → id, roll_number, name, section_id (FK), created_at
attendance    → id, student_id (FK), section_id (FK), attendance_date,
status, marked_by (FK), marked_at
notifications → id, teacher_id (FK), section_id (FK), title,
message, type, is_read, created_at
---

## API Endpoints

### Auth
| Method | Endpoint       | Description          | Auth |
|--------|----------------|----------------------|------|
| POST   | /api/register  | Register new teacher | ❌   |
| POST   | /api/login     | Login, returns JWT   | ❌   |

### Dashboard
| Method | Endpoint              | Description                     | Auth |
|--------|-----------------------|---------------------------------|------|
| GET    | /api/dashboard/stats  | Total students + today's stats  | ✅   |
| GET    | /api/teacher/sections | All sections with today's count | ✅   |

### Attendance
| Method | Endpoint                  | Description                   | Auth |
|--------|---------------------------|-------------------------------|------|
| GET    | /api/section/:id/students | Students + today's status     | ✅   |
| POST   | /api/attendance/save      | Save attendance for a section | ✅   |

### Notifications
| Method | Endpoint                          | Description        | Auth |
|--------|-----------------------------------|--------------------|------|
| GET    | /api/notifications                | All notifications  | ✅   |
| GET    | /api/notifications/unread-count   | Unread badge count | ✅   |
| PUT    | /api/notifications/mark-all-read  | Mark all as read   | ✅   |
| PUT    | /api/notifications/:id/read       | Mark one as read   | ✅   |

---

## Usage

1. Go to `http://localhost:3000/login.html`
2. Click **Create Account** and register with your name, email, password, and sections in `Class:Subject` format (e.g. `10A:Mathematics`)
3. Log in with your credentials
4. On the dashboard, click any section card to open the attendance modal
5. Mark each student as **P** (Present), **A** (Absent), or **L** (Late)
6. Click **Save Attendance** — done!
7. Click the 🔔 bell icon to view notifications

---

## Screenshots

| Screen | Description |
|--------|-------------|
| Login | Teacher sign in with email & password |
| Register | Create account with sections setup |
| Dashboard | Stats overview + section cards |
| Attendance Modal | Per-student P/A/L marking |
| Notifications | Bell panel with unread alerts |

---

## Known Limitations

- No student-facing portal yet
- Notifications are manually inserted (no auto-trigger yet)
- Passwords stored as plain text for original seed data (new registrations use bcrypt hashing ✅)

---

## Future Enhancements

- [ ] Student portal to view personal attendance
- [ ] Parent SMS/email alerts for low attendance
- [ ] Monthly PDF report export
- [ ] Admin super-dashboard for school-wide analytics
- [ ] QR code or biometric auto-attendance
- [ ] Mobile app (React Native / Flutter)
