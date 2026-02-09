const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./database');
const newsScanner = require('./scanner');
const trendsService = require('./trends');
const keywordSuggester = require('./keywords');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// --- Keywords ---
app.get('/api/keywords', (req, res) => {
    const keywords = db.prepare('SELECT * FROM keywords ORDER BY created_at DESC').all();
    res.json(keywords);
});

app.post('/api/keywords', (req, res) => {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Keyword required' });
    try {
          const stmt = db.prepare('INSERT INTO keywords (keyword) VALUES (?)');
          const result = stmt.run(keyword.trim().toLowerCase());
          res.json({ id: result.lastInsertRowid, keyword: keyword.trim().toLowerCase() });
    } catch (e) {
          res.status(400).json({ error: 'Keyword already exists' });
    }
});

app.delete('/api/keywords/:id', (req, res) => {
    db.prepare('DELETE FROM keywords WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- News ---
app.get('/api/news', (req, res) => {
    const { keyword, limit = 100 } = req.query;
    let query = 'SELECT * FROM news';
    const params = [];
    if (keyword) { query += ' WHERE keyword = ?'; params.push(keyword); }
    query += ' ORDER BY published_at DESC LIMIT ?';
    params.push(parseInt(limit));
    res.json(db.prepare(query).all(...params));
});

app.get('/api/news/stats', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as count FROM news').get();
    const lastHour = db.prepare("SELECT COUNT(*) as count FROM news WHERE created_at > datetime('now', '-1 hour')").get();
    const byKeyword = db.prepare('SELECT keyword, COUNT(*) as count FROM news GROUP BY keyword ORDER BY count DESC').all();
    const bySource = db.prepare('SELECT source, COUNT(*) as count FROM news GROUP BY source ORDER BY count DESC LIMIT 15').all();
    const hourly = db.prepare("SELECT strftime('%H', published_at) as hour, COUNT(*) as count FROM news WHERE published_at > datetime('now', '-24 hours') GROUP BY hour ORDER BY hour").all();
    const daily = db.prepare("SELECT date(published_at) as day, COUNT(*) as count FROM news WHERE published_at > datetime('now', '-7 days') GROUP BY day ORDER BY day").all();
    const scanStats = db.prepare('SELECT * FROM scan_stats WHERE id = 1').get();
    res.json({ total: total.count, lastHour: lastHour.count, byKeyword, bySource, hourly, daily, scanStats });
});

// --- Saved ---
app.post('/api/saved', (req, res) => {
    try { db.prepare('INSERT INTO saved_news (news_id) VALUES (?)').run(req.body.news_id); res.json({ success: true }); }
    catch (e) { res.status(400).json({ error: 'Already saved' }); }
});
app.delete('/api/saved/:news_id', (req, res) => {
    db.prepare('DELETE FROM saved_news WHERE news_id = ?').run(req.params.news_id);
    res.json({ success: true });
});
app.get('/api/saved', (req, res) => {
    res.json(db.prepare('SELECT n.*, 1 as is_saved FROM news n INNER JOIN saved_news s ON n.id = s.news_id ORDER BY s.created_at DESC').all());
});

// --- Scan ---
app.post('/api/scan', async (req, res) => {
    try { res.json(await newsScanner.scanAll()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Google Trends ---
app.get('/api/trends/daily', async (req, res) => {
    try { res.json(await trendsService.getDailyTrends()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/trends/interest', async (req, res) => {
    if (!req.query.keyword) return res.status(400).json({ error: 'Keyword required' });
    try { res.json(await trendsService.getInterestOverTime(req.query.keyword)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/trends/related', async (req, res) => {
    if (!req.query.keyword) return res.status(400).json({ error: 'Keyword required' });
    try { res.json(await trendsService.getRelatedQueries(req.query.keyword)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Keyword Suggestions ---
app.get('/api/suggestions', (req, res) => {
    res.json(keywordSuggester.getSuggestions());
});

// SPA Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// CRON: Scan every 10 min, trends every 30 min
cron.schedule('*/10 * * * *', () => newsScanner.scanAll());
cron.schedule('*/30 * * * *', () => trendsService.updateDailyTrends());

app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
    newsScanner.scanAll();
    trendsService.updateDailyTrends();
});
