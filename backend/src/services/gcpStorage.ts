import { Storage } from '@google-cloud/storage';
import path from 'path';
import { logger } from '../utils/logger';

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    const projectId = process.env.GCP_PROJECT_ID;
    const keyFilename = process.env.GCP_KEY_FILE;
    
    if (!projectId) {
      logger.warn('GCP_PROJECT_ID not configured. File uploads will be disabled.');
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
        logger.info('GCP Storage initialized with key file', { bucketName: process.env.GCP_BUCKET_NAME || 'NOT SET' });
      } else {
        // Use Application Default Credentials (works with Cloud Run service accounts)
        storage = new Storage({
          projectId: projectId,
        });
        logger.info('GCP Storage initialized with Application Default Credentials', { bucketName: process.env.GCP_BUCKET_NAME || 'NOT SET' });
      }
    } catch (error) {
      logger.error('Failed to initialize GCP Storage', { error });
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
  const projectId = process.env.GCP_PROJECT_ID;
  
  if (!storage || !bucketName) {
    const missing = [];
    if (!projectId) missing.push('GCP_PROJECT_ID');
    if (!bucketName) missing.push('GCP_BUCKET_NAME');
    throw new Error(
      `GCP storage not configured. Missing: ${missing.join(', ')}. ` +
      `GCP_KEY_FILE is optional (use Application Default Credentials with service account attached to Cloud Run).`
    );
  }
  
  logger.info('Uploading to bucket', { bucketName });
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
  
  if (!storage) {
    throw new Error('GCP Storage is not initialized. Check GCP_PROJECT_ID configuration.');
  }
  
  if (!bucketPath) {
    throw new Error('bucketPath is required');
  }
  
  try {
    const file = storage.bucket(bucketName).file(bucketPath);
    
    // Check if file exists before generating signed URL
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn('File does not exist in bucket', { 
        bucketPath, 
        bucketName,
        filePath: bucketPath,
        fullPath: `gs://${bucketName}/${bucketPath}`
      });
      throw new Error(`File not found in bucket: ${bucketPath}`);
    }
    
    // Get file metadata for additional debugging
    try {
      const [metadata] = await file.getMetadata();
      logger.debug('File metadata retrieved', { 
        bucketPath, 
        size: metadata.size,
        contentType: metadata.contentType,
        updated: metadata.updated
      });
    } catch (metaError) {
      logger.warn('Could not retrieve file metadata', { bucketPath, error: metaError });
    }
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    
    return url;
  } catch (error) {
    const errorDetails = {
      bucketPath, 
      bucketName,
      filePath: bucketPath,
      fullPath: `gs://${bucketName}/${bucketPath}`,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined
    };
    
    // Check if it's a specific GCS error
    if (error && typeof error === 'object' && 'code' in error) {
      (errorDetails as any).gcsErrorCode = (error as any).code;
      (errorDetails as any).gcsErrors = (error as any).errors;
    }
    
    logger.error('Error generating signed URL', errorDetails);
    throw error;
  }
}

export async function deleteFile(bucketPath: string): Promise<void> {
  const storage = getStorage();
  const bucketName = process.env.GCP_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('GCP_BUCKET_NAME environment variable is required');
  }
  
  await storage.bucket(bucketName).file(bucketPath).delete();
}

