import { google } from 'googleapis';
import { Storage } from '@google-cloud/storage';
import { logger } from '../utils/logger';

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing YouTube OAuth credentials. Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN'
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function getGCSStorage(): Storage {
  const projectId = process.env.GCP_PROJECT_ID;
  const keyFilename = process.env.GCP_KEY_FILE;

  if (!projectId) {
    throw new Error('GCP_PROJECT_ID is required for YouTube upload');
  }

  if (keyFilename) {
    const path = require('path');
    return new Storage({ projectId, keyFilename: path.resolve(keyFilename) });
  }
  return new Storage({ projectId });
}

export async function uploadVideoToYouTube(
  gcpBucketPath: string,
  title: string,
  description: string
): Promise<string> {
  const bucketName = process.env.GCP_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCP_BUCKET_NAME is required for YouTube upload');
  }

  logger.info('Starting YouTube upload', { gcpBucketPath, title });

  const auth = getOAuth2Client();
  const youtube = google.youtube({ version: 'v3', auth });

  // Get a readable stream from GCS
  const gcsStorage = getGCSStorage();
  const fileStream = gcsStorage.bucket(bucketName).file(gcpBucketPath).createReadStream();

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: '22', // People & Blogs (closest to Gaming/Entertainment for shorts)
      },
      status: {
        privacyStatus: 'public',
      },
    },
    media: {
      mimeType: 'video/mp4',
      body: fileStream,
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('YouTube upload succeeded but no video ID was returned');
  }

  logger.info('YouTube upload completed', { videoId, title });
  return videoId;
}
