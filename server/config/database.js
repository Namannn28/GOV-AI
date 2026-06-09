const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let pool;
let db;

// If DATABASE_URL is provided, use PostgreSQL (for Vercel/Render)
if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    pool.on('connect', () => {
        console.log('✅ PostgreSQL database connected');
    });

    // Wrapper to make pg's query compatible with the expected interface
    const query = async (text, params = []) => {
        // Convert ? placeholders to $1, $2, etc for PostgreSQL
        let i = 1;
        const pgText = text.replace(/\?/g, () => `$${i++}`);
        
        try {
            const result = await pool.query(pgText, params);
            return { rows: result.rows, rowCount: result.rowCount };
        } catch (error) {
            console.error('PostgreSQL Query Error:', error);
            throw error;
        }
    };

    module.exports = { query, pool };
} else {
    // Fallback to local SQLite for local development
    const DB_PATH = path.join(__dirname, '..', 'data', 'govai.db');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const query = (text, params = []) => {
        // Leave ? as ? for SQLite
        let sqliteText = text.replace(/\$(\d+)/g, '?'); // just in case

        const trimmed = sqliteText.trim().toUpperCase();

        if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
            const stmt = db.prepare(sqliteText);
            const rows = stmt.all(...params);
            return Promise.resolve({ rows, rowCount: rows.length });
        } else if (trimmed.startsWith('INSERT') && sqliteText.toUpperCase().includes('RETURNING')) {
            const withoutReturning = sqliteText.replace(/\s+RETURNING\s+.*/i, '');
            const stmt = db.prepare(withoutReturning);
            const info = stmt.run(...params);
            const lastId = info.lastInsertRowid;

            const tableMatch = sqliteText.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+"?(\w+)"?/i);
            const tableName = tableMatch ? tableMatch[1] : null;

            let row = null;
            if (tableName && lastId) {
                const selStmt = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ?`); // Assume id is PK
                row = selStmt.get(lastId);
            }

            return Promise.resolve({ rows: row ? [row] : [], rowCount: info.changes });
        } else {
            const stmt = db.prepare(sqliteText);
            const info = stmt.run(...params);
            return Promise.resolve({ rows: [], rowCount: info.changes });
        }
    };

    console.log(`✅ SQLite database connected: ${DB_PATH}`);
    module.exports = { query, db };
}
