export interface CompetitorConfig {
  channelId?: string;
  handle: string;
  name: string;
}

export interface SubredditConfig {
  name: string;
  sort: 'hot' | 'top' | 'new';
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limit: number;
}

export const config = {
  competitors: [
    { handle: '@camman18', name: 'camman18' },
    { handle: '@mogswamp', name: 'mogswamp' },
    { handle: '@dashpum4', name: 'Dash Pum' },
  ] as CompetitorConfig[],

  subreddits: [
    { name: 'Minecraft', sort: 'hot', limit: 50 },
    { name: 'Minecraft', sort: 'top', timeframe: 'week', limit: 30 },
    { name: 'MinecraftMemes', sort: 'top', timeframe: 'week', limit: 20 },
  ] as SubredditConfig[],

  // How many videos to fetch per channel to compute their average views
  videosForAverage: 50,

  // Videos with views >= this multiplier of the channel average are "standouts"
  standoutThreshold: 1.5,

  // Default lookback when no previous report exists (days)
  defaultLookbackDays: 14,
};
