import { getSignedUrl } from '../services/gcpStorage';

/**
 * Process profile picture: convert bucket path to signed URL if needed
 * Returns the original value if it's already a URL or an emoji
 */
export async function processProfilePicture(profilePicture: string | null | undefined): Promise<string | null> {
  if (!profilePicture) return null;
  
  // If it's already a URL (starts with http), return as-is
  if (profilePicture.startsWith('http')) {
    return profilePicture;
  }
  
  // If it's an emoji (short and doesn't contain path separator), return as-is
  if (profilePicture.length <= 10 && !profilePicture.includes('/')) {
    return profilePicture;
  }
  
  // Otherwise, it's likely a bucket path - generate signed URL
  try {
    const signedUrl = await getSignedUrl(profilePicture, 3600); // 1 hour expiry
    return signedUrl;
  } catch (error) {
    console.error('Failed to generate signed URL for profile picture:', error);
    // Return the bucket path as-is if signed URL generation fails
    return profilePicture;
  }
}

