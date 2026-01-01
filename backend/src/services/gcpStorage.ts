import { Storage } from '@google-cloud/storage';
import path from 'path';

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    const projectId = process.env.GCP_PROJECT_ID;
    const keyFilename = process.env.GCP_KEY_FILE;
    
    if (!projectId) {
      console.warn('GCP_PROJECT_ID not configured. File uploads will be disabled.');
      return null as any; // Return null to allow graceful degradation
    }
    
    try {
      // If GCP_KEY_FILE is set, use it (for local dev or if key file is provided)
      // Otherwise, use Application Default Credentials (for Cloud Run with service account)
      if (keyFilename) {
        storage = new Storage({
          projectId: projectId,
          keyFilename: path.resolve(keyFilename),
        });
        console.log(`GCP Storage initialized with key file. Using bucket: ${process.env.GCP_BUCKET_NAME || 'NOT SET'}`);
      } else {
        // Use Application Default Credentials (works with Cloud Run service accounts)
        storage = new Storage({
          projectId: projectId,
        });
        console.log(`GCP Storage initialized with Application Default Credentials. Using bucket: ${process.env.GCP_BUCKET_NAME || 'NOT SET'}`);
      }
    } catch (error) {
      console.error('Failed to initialize GCP Storage:', error);
      throw error;
    }
  }
  return storage;
}

export async function uploadFile(
  file: Express.Multer.File,
  shortId: number | undefined,
  fileType: string,
  userId: number,
  profileUserId?: number
): Promise<string> {
  const storage = getStorage();
  const bucketName = process.env.GCP_BUCKET_NAME;
  
  if (!storage || !bucketName) {
    throw new Error('GCP storage not configured. Please set GCP_BUCKET_NAME, GCP_PROJECT_ID, and GCP_KEY_FILE environment variables.');
  }
  
  console.log(`Uploading to bucket: ${bucketName}`);
  const bucket = storage.bucket(bucketName);
  let fileName: string;
  
  if (fileType === 'profile_picture' && profileUserId) {
    fileName = `users/${profileUserId}/profile_picture/${Date.now()}-${file.originalname}`;
  } else if (shortId) {
    fileName = `shorts/${shortId}/${fileType}/${Date.now()}-${file.originalname}`;
  } else {
    throw new Error('Either shortId or profileUserId must be provided');
  }
  
  const fileUpload = bucket.file(fileName);
  
  const stream = fileUpload.createWriteStream({
    metadata: {
      contentType: file.mimetype,
    },
  });
  
  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', () => {
      resolve(fileName);
    });
    stream.end(file.buffer);
  });
}

export async function getSignedUrl(bucketPath: string, expiresIn: number = 3600): Promise<string> {
  const storage = getStorage();
  const bucketName = process.env.GCP_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('GCP_BUCKET_NAME environment variable is required');
  }
  
  const file = storage.bucket(bucketName).file(bucketPath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresIn * 1000,
  });
  
  return url;
}

export async function deleteFile(bucketPath: string): Promise<void> {
  const storage = getStorage();
  const bucketName = process.env.GCP_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('GCP_BUCKET_NAME environment variable is required');
  }
  
  await storage.bucket(bucketName).file(bucketPath).delete();
}

