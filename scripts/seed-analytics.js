const fs = require('fs');

const csvPath = '/home/quinncaverly/ClaudeCode/youtube-analytics/raw_analytics.csv';
const csv = fs.readFileSync(csvPath, 'utf-8');
const lines = csv.trim().split('\n');
const headers = lines[0].split(',');

const videos = lines.slice(1).map(line => {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  const row = {};
  headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim(); });
  return {
    video_id: row.video_id,
    title: row.title || null,
    published_at: row.published_at || null,
    duration_sec: row.duration_sec ? parseInt(row.duration_sec) : null,
    is_short: (parseInt(row.duration_sec) || 0) <= 180,
    views: parseInt(row.views) || 0,
    estimated_minutes_watched: parseFloat(row.estimatedMinutesWatched) || 0,
    average_view_duration: parseFloat(row.averageViewDuration) || 0,
    average_view_percentage: parseFloat(row.averageViewPercentage) || 0,
    likes: parseInt(row.likes) || 0,
    dislikes: parseInt(row.dislikes) || 0,
    comments: parseInt(row.comments) || 0,
    shares: parseInt(row.shares) || 0,
    subscribers_gained: parseInt(row.subscribersGained) || 0,
    subscribers_lost: parseInt(row.subscribersLost) || 0,
    like_rate: parseFloat(row.like_rate) || 0,
    comment_rate: parseFloat(row.comment_rate) || 0,
    share_rate: parseFloat(row.share_rate) || 0,
    sub_gain_rate: parseFloat(row.sub_gain_rate) || 0,
    engagement_rate: parseFloat(row.engagement_rate) || 0,
    fetched_at: new Date().toISOString(),
  };
}).filter(v => v.video_id && v.title && v.views >= 1000);

const output = JSON.stringify({ videos }, null, 2);
fs.writeFileSync('frontend/public/sample-analytics.json', output);
console.log('Wrote ' + videos.length + ' videos to frontend/public/sample-analytics.json');
fs.mkdirSync('frontend/src/data', { recursive: true });
fs.writeFileSync('frontend/src/data/sampleAnalytics.json', output);
console.log('Wrote dev sample data');
