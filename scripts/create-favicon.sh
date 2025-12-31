#!/bin/bash
# Quick script to create a simple favicon
# Requires ImageMagick: sudo apt-get install imagemagick (or brew install imagemagick)

echo "Creating favicon files..."

cd frontend/public

# Create a simple blue square favicon (replace with your logo)
convert -size 32x32 xc:#3B82F6 favicon-32x32.png
convert -size 16x16 xc:#3B82F6 favicon-16x16.png

# Create ICO file (multi-size)
convert favicon-16x16.png favicon-32x32.png favicon.ico

# Create Apple touch icon
convert -size 180x180 xc:#3B82F6 apple-touch-icon.png

# Create Android icons
convert -size 192x192 xc:#3B82F6 android-chrome-192x192.png
convert -size 512x512 xc:#3B82F6 android-chrome-512x512.png

echo "✅ Favicon files created in frontend/public/"
echo "📝 Update frontend/index.html to reference these files"
echo "💡 For better results, use https://realfavicongenerator.net/ with your actual logo"

