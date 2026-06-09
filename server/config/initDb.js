const db = require('../config/database');
const bcrypt = require('bcryptjs');

const createTables = async () => {
  const isPg = !!process.env.DATABASE_URL;
  const SERIAL = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const TIMESTAMP = 'CURRENT_TIMESTAMP';

  // Users
  await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id ${SERIAL},
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            mobile TEXT,
            department TEXT,
            role TEXT DEFAULT 'citizen',
            is_verified INTEGER DEFAULT 0,
            profile_completed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT ${TIMESTAMP},
            updated_at TIMESTAMP DEFAULT ${TIMESTAMP}
        )
    `);

  // User profiles
  await db.query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            id ${SERIAL},
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            resume_url TEXT,
            skills TEXT,
            education TEXT,
            experience TEXT,
            certifications TEXT,
            preferences TEXT,
            created_at TIMESTAMP DEFAULT ${TIMESTAMP},
            updated_at TIMESTAMP DEFAULT ${TIMESTAMP}
        )
    `);

  // Schemes
  await db.query(`
        CREATE TABLE IF NOT EXISTS schemes (
            id ${SERIAL},
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            department TEXT,
            eligibility_criteria TEXT,
            benefits TEXT,
            application_process TEXT,
            documents_required TEXT,
            deadline TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT ${TIMESTAMP},
            updated_at TIMESTAMP DEFAULT ${TIMESTAMP}
        )
    `);

  // Applications
  await db.query(`
        CREATE TABLE IF NOT EXISTS applications (
            id ${SERIAL},
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            scheme_id INTEGER REFERENCES schemes(id) ON DELETE CASCADE,
            application_data TEXT,
            status TEXT DEFAULT 'submitted',
            stage TEXT DEFAULT 'initial_review',
            submitted_at TIMESTAMP DEFAULT ${TIMESTAMP},
            last_updated TIMESTAMP DEFAULT ${TIMESTAMP},
            notes TEXT,
            timeline TEXT
        )
    `);

  // Jobs
  await db.query(`
        CREATE TABLE IF NOT EXISTS jobs (
            id ${SERIAL},
            title TEXT NOT NULL,
            department TEXT,
            description TEXT,
            requirements TEXT,
            skills_required TEXT,
            location TEXT,
            salary_range TEXT,
            job_type TEXT,
            deadline TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT ${TIMESTAMP}
        )
    `);

  // Notifications
  await db.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id ${SERIAL},
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title TEXT,
            message TEXT,
            type TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT ${TIMESTAMP}
        )
    `);

  console.log('✅ All tables created successfully');
};

const seedData = async () => {
  // Check if already seeded
  const check = await db.query('SELECT COUNT(*) as count FROM schemes');
  if (parseInt(check.rows[0]?.count) > 0) {
    console.log('📌 Database already seeded, skipping...');
    return;
  }

  // Demo users
  const hashedPwd = await bcrypt.hash('password123', 10);

  const insertUserQuery = `
        INSERT INTO users (email, password, full_name, mobile, department, role, is_verified, profile_completed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO NOTHING
  `;

  await db.query(insertUserQuery, [
    'alex@govai.com', hashedPwd, 'Alex Henderson',
    '9876543210', 'Digital Innovation', 'citizen', 1, 1
  ]);

  await db.query(insertUserQuery, [
    'priya@govai.com', hashedPwd, 'Priya Sharma',
    '9876543211', 'Urban Development', 'citizen', 1, 0
  ]);

  await db.query(insertUserQuery, [
    'admin@govai.com', hashedPwd, 'Admin User',
    '9876543212', 'Administration', 'admin', 1, 1
  ]);

  console.log('✅ Demo users created  →  alex@govai.com / password123');

  // Schemes
  const schemes = [
    ['Tech Startup Grant 2026', 'Financial assistance for technology startups in India',
      'Business', 'Ministry of Electronics and IT',
      'Up to ₹50 lakhs funding with mentorship support', '2026-12-31'],
    ['Housing Sustainability Credit', 'Subsidised loans for sustainable housing projects',
      'Housing', 'Ministry of Housing and Urban Affairs',
      '4% interest subsidy on home loans up to ₹35 lakhs', '2026-08-15'],
    ['Skill Development Program', 'Free certification courses for underemployed youth',
      'Education', 'Ministry of Skill Development',
      'Free training + ₹3,000/month stipend', '2026-06-30'],
    ['Women Entrepreneur Scheme', 'Special funding for women-led businesses',
      'Business', 'Ministry of Women and Child Development',
      '₹25 lakhs at 3% interest rate + mentoring', '2026-09-30'],
    ['Digital Infrastructure Grant', 'Grant for rural digital infrastructure',
      'Technology', 'Department of Telecommunications',
      'Up to ₹1 crore for approved projects', '2026-11-15'],
    ['PM-KUSUM Solar Scheme', 'Solar pump installation for farmers',
      'Agriculture', 'Ministry of New & Renewable Energy',
      '60% central subsidy on solar pumps', '2026-07-31'],
  ];

  for (const s of schemes) {
    await db.query(
      `INSERT INTO schemes (name, description, category, department, benefits, deadline, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
      s
    );
  }

  console.log('✅ Sample schemes seeded');

  // Jobs
  const jobs = [
    ['Senior UI/UX Designer', 'Department of Digital Innovation',
      'Lead design initiatives for government digital services',
      'New Delhi', '₹12-18 LPA', 'Full-time', '2026-03-31'],
    ['Data Analyst', 'Ministry of Statistics',
      'Analyse government data for policy insights',
      'Mumbai', '₹8-12 LPA', 'Full-time', '2026-04-15'],
    ['Software Engineer', 'NIC - National Informatics Centre',
      'Develop and maintain government web applications',
      'Bangalore', '₹10-15 LPA', 'Full-time', '2026-05-20'],
    ['Cybersecurity Analyst', 'CERT-In',
      'Monitor and respond to cybersecurity incidents',
      'New Delhi', '₹15-22 LPA', 'Full-time', '2026-04-30'],
    ['AI/ML Engineer', 'ISRO - Innovation Lab',
      'Build AI tools for satellite data analysis',
      'Bengaluru', '₹18-25 LPA', 'Full-time', '2026-06-15'],
  ];

  for (const j of jobs) {
    await db.query(
      `INSERT INTO jobs (title, department, description, location, salary_range, job_type, deadline, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      j
    );
  }

  console.log('✅ Sample jobs seeded');
};

const initializeDatabase = async () => {
  await createTables();
  await seedData();
};

module.exports = { initializeDatabase, createTables, seedData };
