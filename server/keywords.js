const db = require('./database');

function getSuggestions() {
    const existingKeywords = db.prepare('SELECT keyword FROM keywords').all().map(k => k.keyword);
    const recentNews = db.prepare("SELECT title FROM news WHERE created_at > datetime('now', '-24 hours')").all();
    const stopWords = new Set(['bir', 've', 'bu', 'da', 'de', 'ile', 'mi', 'mu', 'ne', 'o', 'en', 'son', 'gibi', 'icin', 'olan', 'oldu', 'var', 'ise', 'kadar', 'daha', 'cok', 'her', 'ama', 'ancak', 'ya', 'ki']);
    const wordFreq = {};
    for (const { title } of recentNews) {
          const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
          for (const word of words) {
                  if (!existingKeywords.includes(word)) wordFreq[word] = (wordFreq[word] || 0) + 1;
          }
    }
    const pairFreq = {};
    for (const { title } of recentNews) {
          const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
          for (let i = 0; i < words.length - 1; i++) {
                  const pair = words[i] + ' ' + words[i+1];
                  if (!existingKeywords.includes(pair)) pairFreq[pair] = (pairFreq[pair] || 0) + 1;
          }
    }
    const singleWords = Object.entries(wordFreq).filter(([_, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ keyword: word, count, type: 'word' }));
    const pairs = Object.entries(pairFreq).filter(([_, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([pair, count]) => ({ keyword: pair, count, type: 'pair' }));
    const keywordStats = db.prepare("SELECT keyword, COUNT(*) as news_count, MAX(published_at) as latest_news FROM news GROUP BY keyword ORDER BY news_count DESC").all();
    return { suggestions: [...singleWords, ...pairs], keywordStats };
}

module.exports = { getSuggestions };
