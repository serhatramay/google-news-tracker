const Parser = require('rss-parser');
const db = require('./database');
const parser = new Parser();

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=QUERY&hl=tr&gl=TR&ceid=TR:tr';

function extractSource(title) {
    const match = title.match(/\s-\s([^-]+)$/);
    return match ? match[1].trim() : 'Bilinmiyor';
}

function cleanTitle(title) {
    return title.replace(/\s-\s[^-]+$/, '').trim();
}

async function scanKeyword(keyword) {
    const url = GOOGLE_NEWS_RSS.replace('QUERY', encodeURIComponent(keyword));
    try {
          const feed = await parser.parseURL(url);
          const insertStmt = db.prepare(
                  'INSERT OR IGNORE INTO news (title, link, source, keyword, published_at) VALUES (?, ?, ?, ?, ?)'
                );
          let added = 0;
          const insertMany = db.transaction((items) => {
                  for (const item of items) {
                            const source = extractSource(item.title);
                            const title = cleanTitle(item.title);
                            const published = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
                            const result = insertStmt.run(title, item.link, source, keyword, published);
                            if (result.changes > 0) added++;
                  }
          });
          insertMany(feed.items || []);
          return { keyword, found: feed.items?.length || 0, added };
    } catch (e) {
          console.error('Scan error for ' + keyword + ':', e.message);
          return { keyword, found: 0, added: 0, error: e.message };
    }
}

async function scanAll() {
    const keywords = db.prepare('SELECT keyword FROM keywords').all();
    db.prepare('UPDATE scan_stats SET is_scanning = 1 WHERE id = 1').run();
    const results = [];
    for (const { keyword } of keywords) {
          const result = await scanKeyword(keyword);
          results.push(result);
          await new Promise(r => setTimeout(r, 500));
    }
    db.prepare('UPDATE scan_stats SET scan_count = scan_count + 1, last_scan_time = CURRENT_TIMESTAMP, is_scanning = 0 WHERE id = 1').run();
    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    console.log('[SCAN] Complete. Added ' + totalAdded + ' new articles.');
    return { results, totalAdded };
}

module.exports = { scanAll, scanKeyword };
