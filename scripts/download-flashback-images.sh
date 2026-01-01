#!/bin/bash
# Script to download images from flashback-formula.md and update URLs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MD_FILE="$PROJECT_ROOT/frontend/public/flashback-formula.md"
IMAGES_DIR="$PROJECT_ROOT/frontend/public/flashback-images"

# Create images directory
mkdir -p "$IMAGES_DIR"

# Extract all GitHub image URLs from the markdown file
echo "Extracting image URLs from flashback-formula.md..."
grep -oP 'https://github\.com/user-attachments/assets/[a-f0-9-]+' "$MD_FILE" | sort -u > /tmp/flashback_image_urls.txt

# Download each image
echo "Downloading images..."
count=0
while IFS= read -r url; do
    count=$((count + 1))
    image_id=$(echo "$url" | grep -oP '[a-f0-9-]+$')
    filename="${image_id}.png"
    output_path="$IMAGES_DIR/$filename"
    
    echo "[$count] Downloading $image_id..."
    if curl -sSL -f "$url" -o "$output_path"; then
        echo "  ✓ Saved to $filename"
        # Update markdown file to use local path
        sed -i "s|$url|/flashback-images/$filename|g" "$MD_FILE"
    else
        echo "  ✗ Failed to download $url"
    fi
done < /tmp/flashback_image_urls.txt

# Also check for file URLs (like the .txt file)
grep -oP 'https://github\.com/user-attachments/files/[0-9]+' "$MD_FILE" | sort -u > /tmp/flashback_file_urls.txt || true

if [ -s /tmp/flashback_file_urls.txt ]; then
    echo ""
    echo "Note: Found file URLs (like .txt files). These need to be handled separately."
    echo "You may want to download these manually and update the markdown."
fi

echo ""
echo "Done! Downloaded $count images to $IMAGES_DIR"
echo "Updated flashback-formula.md to use local image paths"
echo ""
echo "Next steps:"
echo "1. Review the updated flashback-formula.md"
echo "2. Test that images load correctly"
echo "3. Commit the changes"

