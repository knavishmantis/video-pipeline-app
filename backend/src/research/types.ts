export interface CompetitorChannel {
  channelId: string;
  handle: string;
  name: string;
}

export interface VideoData {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  channelId: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  durationSec: number;
  isShort: boolean;
}

export interface VideoWithRatio extends VideoData {
  ratio: number;
}

export interface ChannelReport {
  channel: CompetitorChannel;
  avgViews: number;
  medianViews: number;
  recentVideos: VideoWithRatio[];
  standouts: VideoWithRatio[];
}

export interface RedditPost {
  title: string;
  score: number;
  numComments: number;
  url: string;
  permalink: string;
  subreddit: string;
  flair: string | null;
  createdAt: string;
  author: string;
}

export interface SubredditReport {
  subreddit: string;
  posts: RedditPost[];
}

export interface MinecraftVersion {
  id: string;
  type: 'snapshot' | 'release';
  releaseTime: string;
  changelog?: string;
}

export interface MinecraftReport {
  newVersions: MinecraftVersion[];
}

export interface CollectedData {
  youtube: ChannelReport[];
  reddit: SubredditReport[];
  minecraft: MinecraftReport;
  ownChannel: {
    recentShorts: { title: string; views: number | null }[];
    avgViews: number;
  };
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
}
