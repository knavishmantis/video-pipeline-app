import { config } from '../config';
import { RedditPost, SubredditReport } from '../types';

const USER_AGENT = 'video-pipeline-research/1.0';

export async function collectRedditData(since: Date): Promise<SubredditReport[]> {
  const reports: SubredditReport[] = [];
  const seen = new Set<string>();

  for (const sub of config.subreddits) {
    console.log(`  Fetching r/${sub.name} (${sub.sort})...`);

    let url = `https://www.reddit.com/r/${sub.name}/${sub.sort}.json?limit=${sub.limit}&raw_json=1`;
    if (sub.timeframe) {
      url += `&t=${sub.timeframe}`;
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (!response.ok) {
        console.warn(
          `  Reddit returned ${response.status} for r/${sub.name}/${sub.sort}`
        );
        continue;
      }

      const data: any = await response.json();
      const posts: RedditPost[] = [];

      for (const child of data.data?.children || []) {
        const post = child.data;
        const createdAt = new Date(post.created_utc * 1000);

        if (createdAt < since) continue;
        if (seen.has(post.id)) continue;
        seen.add(post.id);

        posts.push({
          title: post.title,
          score: post.score,
          numComments: post.num_comments,
          url: post.url,
          permalink: `https://www.reddit.com${post.permalink}`,
          subreddit: post.subreddit,
          flair: post.link_flair_text || null,
          createdAt: createdAt.toISOString(),
          author: post.author,
        });
      }

      // Merge into existing report for same subreddit (hot + top may overlap)
      const existing = reports.find((r) => r.subreddit === sub.name);
      if (existing) {
        const existingTitles = new Set(existing.posts.map((p) => p.title));
        existing.posts.push(
          ...posts.filter((p) => !existingTitles.has(p.title))
        );
        existing.posts.sort((a, b) => b.score - a.score);
      } else if (posts.length > 0) {
        reports.push({
          subreddit: sub.name,
          posts: posts.sort((a, b) => b.score - a.score),
        });
      }

      console.log(
        `  r/${sub.name} (${sub.sort}): ${posts.length} posts since last report`
      );

      // Reddit rate limit: ~60 req/min unauthenticated
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error: any) {
      console.error(`  Error fetching r/${sub.name}: ${error.message}`);
    }
  }

  return reports;
}
