const googleTrends = require('google-trends-api');
const db = require('./database');

async function getDailyTrends() {
    const cached = db.prepare("SELECT * FROM trends WHERE date = date('now') ORDER BY created_at DESC").all();
    if (cached.length > 0) return cached;
    return await updateDailyTrends();
}

async function updateDailyTrends() {
    try {
          const results = await googleTrends.dailyTrends({ geo: 'TR' });
          const data = JSON.parse(results);
          const days = data.default?.trendingSearchesDays || [];
          const insertStmt = db.prepare('INSERT OR REPLACE INTO trends (title, traffic, related_queries, source, date) VALUES (?, ?, ?, ?, ?)');
          const allTrends = [];
          const insertMany = db.transaction(() => {
                  for (const day of days) {
                            for (const search of day.trendingSearches || []) {
                                        const title = search.title?.query || '';
                                        const traffic = search.formattedTraffic || '';
                                        const related = (search.relatedQueries || []).map(q => q.query).join(', ');
                                        const source = search.articles?.[0]?.source || '';
                                        const date = day.date || new Date().toISOString().split('T')[0];
                                        insertStmt.run(title, traffic, related, source, date);
                                        allTrends.push({ title, traffic, related_queries: related, source, date });
                            }
                  }
          });
          insertMany();
          return allTrends;
    } catch (e) { console.error('[TRENDS] Error:', e.message); return []; }
}

async function getInterestOverTime(keyword) {
    try {
          const results = await googleTrends.interestOverTime({ keyword, geo: 'TR', startTime: new Date(Date.now() - 7*24*60*60*1000) });
          return JSON.parse(results).default?.timelineData || [];
    } catch (e) { return []; }
}

async function getRelatedQueries(keyword) {
    try {
          const results = await googleTrends.relatedQueries({ keyword, geo: 'TR' });
          return JSON.parse(results).default || {};
    } catch (e) { return {}; }
}

module.exports = { getDailyTrends, updateDailyTrends, getInterestOverTime, getRelatedQueries };
