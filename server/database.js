const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'news.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    link TEXT UNIQUE NOT NULL,
    source TEXT,
    keyword TEXT NOT NULL,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saved_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id INTEGER UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (news_id) REFERENCES news(id)
  );
  CREATE TABLE IF NOT EXISTS trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    traffic TEXT,
    related_queries TEXT,
    source TEXT,
    date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS scan_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    scan_count INTEGER DEFAULT 0,
    last_scan_time DATETIME,
    is_scanning INTEGER DEFAULT 0,
    scan_interval INTEGER DEFAULT 10
  );
  CREATE INDEX IF NOT EXISTS idx_news_keyword ON news(keyword);
  CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at);
  CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);
`);

const existing = db.prepare('SELECT * FROM scan_stats WHERE id = 1').get();
if (!existing) {
  db.prepare('INSERT INTO scan_stats (id, scan_count, scan_interval) VALUES (1, 0, 10)').run();
}

const keywordCount = db.prepare('SELECT COUNT(*) as count FROM keywords').get();
if (keywordCount.count === 0) {
  const defaults = ['ne zaman', 'kimdir', 'neden', 'deprem', 'hamile', 'ayrildi', 'temettu', 'hisse', 'cekilis', 'nerede', 'tatil', 'toki'];
  const insert = db.prepare('INSERT OR IGNORE INTO keywords (keyword) VALUES (?)');
  defaults.forEach(k => insert.run(k));
}

module.exports = db;
