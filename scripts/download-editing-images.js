#!/usr/bin/env node

/**
 * Script to download images from GitHub user-attachments URLs in markdown files
 * and update the markdown file to use local image paths
 * 
 * Usage: 
 *   node scripts/download-editing-images.js [editing|flashback]
 *   Defaults to 'editing' if no argument provided
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Get type from command line argument (editing or flashback)
const type = process.argv[2] || 'editing';
const isFlashback = type === 'flashback';

const MARKDOWN_FILE = path.join(__dirname, `../frontend/public/${isFlashback ? 'flashback' : 'editing'}-formula.md`);
const IMAGES_DIR = path.join(__dirname, `../frontend/public/${isFlashback ? 'flashback' : 'editing'}-images`);
const IMAGE_PATH_PREFIX = `/${isFlashback ? 'flashback' : 'editing'}-images`;

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  console.log(`Created directory: ${IMAGES_DIR}`);
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadImage(response.headers.location).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

function extractImageUrls(markdown) {
  const urls = [];
  
  // Match GitHub user-attachments URLs in markdown image syntax
  // Format: ![alt](https://github.com/user-attachments/assets/...)
  const markdownImageRegex = /!\[([^\]]*)\]\((https:\/\/github\.com\/user-attachments\/[^)]+)\)/g;
  let match;
  while ((match = markdownImageRegex.exec(markdown)) !== null) {
    urls.push({
      alt: match[1],
      url: match[2],
      fullMatch: match[0],
    });
  }
  
  // Match HTML img tags with GitHub URLs
  // Format: <img ... src="https://github.com/user-attachments/..." ...>
  // This regex matches img tags and captures the full tag and the URL
  const htmlImageRegex = /<img([^>]*?)src=["'](https:\/\/github\.com\/user-attachments\/[^"']+)["']([^>]*)>/g;
  while ((match = htmlImageRegex.exec(markdown)) !== null) {
    const beforeSrc = match[1];
    const url = match[2];
    const afterSrc = match[3];
    urls.push({
      alt: extractAltFromHtmlTag(match[0]),
      url: url,
      fullMatch: match[0],
      beforeSrc,
      afterSrc,
    });
  }
  
  return urls;
}

function extractAltFromHtmlTag(htmlTag) {
  const altMatch = htmlTag.match(/alt=["']([^"']+)["']/);
  return altMatch ? altMatch[1] : 'image';
}

function getFileExtension(url) {
  // Try to get extension from URL
  const urlMatch = url.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i);
  if (urlMatch) {
    return urlMatch[1].toLowerCase();
  }
  // Default to png
  return 'png';
}

async function processMarkdown() {
  console.log('Reading markdown file...');
  const markdown = fs.readFileSync(MARKDOWN_FILE, 'utf8');
  
  console.log('Extracting image URLs...');
  const imageUrls = extractImageUrls(markdown);
  
  // Debug: check for any GitHub URLs in the file
  const allGithubUrls = markdown.match(/https:\/\/github\.com\/user-attachments\/[^\s"']+/g);
  if (allGithubUrls && allGithubUrls.length > 0) {
    console.log(`Found ${allGithubUrls.length} GitHub URLs in file (may not all be images):`);
    allGithubUrls.slice(0, 5).forEach(url => console.log(`  - ${url}`));
  }
  
  if (imageUrls.length === 0) {
    console.log('No GitHub image URLs found in markdown file.');
    return;
  }
  
  console.log(`Found ${imageUrls.length} image(s) to download.`);
  
  let updatedMarkdown = markdown;
  const urlMap = new Map();
  
  for (let i = 0; i < imageUrls.length; i++) {
    const { url, alt, fullMatch, beforeSrc, afterSrc } = imageUrls[i];
    
    // Skip if we've already processed this URL
    if (urlMap.has(url)) {
      const localPath = urlMap.get(url);
      console.log(`  [${i + 1}/${imageUrls.length}] Skipping duplicate: ${url} -> ${localPath}`);
      continue;
    }
    
    try {
      console.log(`  [${i + 1}/${imageUrls.length}] Downloading: ${url}`);
      const imageBuffer = await downloadImage(url);
      
      const extension = getFileExtension(url);
      const filename = `${crypto.randomUUID()}.${extension}`;
      const localPath = `${IMAGE_PATH_PREFIX}/${filename}`;
      const filePath = path.join(IMAGES_DIR, filename);
      
      fs.writeFileSync(filePath, imageBuffer);
      console.log(`    Saved: ${filePath}`);
      
      urlMap.set(url, localPath);
    } catch (error) {
      console.error(`    Error downloading ${url}:`, error.message);
      console.error(`    Skipping this image...`);
    }
  }
  
  // Update markdown file with local paths
  console.log('\nUpdating markdown file with local image paths...');
  
  for (const { url, fullMatch, beforeSrc, afterSrc } of imageUrls) {
    const localPath = urlMap.get(url);
    if (!localPath) {
      console.warn(`    No local path found for ${url}, skipping...`);
      continue;
    }
    
    if (fullMatch.includes('<img')) {
      // HTML img tag - replace src attribute
      const newTag = fullMatch.replace(
        /src=["']https:\/\/github\.com\/user-attachments\/[^"']+["']/,
        `src="${localPath}"`
      );
      updatedMarkdown = updatedMarkdown.replace(fullMatch, newTag);
      console.log(`    Updated HTML img tag: ${url} -> ${localPath}`);
    } else {
      // Markdown image syntax - replace URL in parentheses
      const newMarkdown = fullMatch.replace(
        /\(https:\/\/github\.com\/user-attachments\/[^)]+\)/,
        `(${localPath})`
      );
      updatedMarkdown = updatedMarkdown.replace(fullMatch, newMarkdown);
      console.log(`    Updated markdown image: ${url} -> ${localPath}`);
    }
  }
  
  // Write updated markdown
  fs.writeFileSync(MARKDOWN_FILE, updatedMarkdown, 'utf8');
  console.log(`\n✅ Updated ${MARKDOWN_FILE}`);
  console.log(`✅ Downloaded ${urlMap.size} image(s) to ${IMAGES_DIR}`);
}

// Run the script
processMarkdown().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

