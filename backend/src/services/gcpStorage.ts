import { Storage } from '@google-cloud/storage';
import path from 'path';

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    const keyFilename = process.env.GCP_KEY_FILE;
    const projectId = process.env.GCP_PROJECT_ID;
    
    if (!keyFilename || !projectId) {
      throw new Error('GCP_KEY_FILE and GCP_PROJECT_ID environment variables are required for file uploads. See SETUP.md for configuration.');
    }
    
    storage = new Storage({
      projectId: projectId,
      keyFilename: path.resolve(keyFilename),
    });
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
  
  if (!bucketName) {
    throw new Error('GCP_BUCKET_NAME environment variable is required');
  }
  
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

