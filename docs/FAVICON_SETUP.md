# Favicon Setup Guide

## Quick Setup (Recommended)

### Option 1: Use Online Generator (Easiest)

1. Go to https://realfavicongenerator.net/
2. Upload your logo/image (square, at least 260x260px recommended)
3. Configure settings:
   - **iOS**: Use single picture for all devices
   - **Android**: Use single picture for all devices
   - **Favicon for desktop browsers**: Generate all sizes
4. Click "Generate your Favicons and HTML code"
5. Download the package
6. Extract files to `frontend/public/`
7. The HTML code is already in `frontend/index.html`

### Option 2: Create Simple Favicon Manually

If you just want a quick placeholder:

```bash
# Install ImageMagick (if not installed)
# Ubuntu/Debian: sudo apt-get install imagemagick
# macOS: brew install imagemagick

# Run the script
./scripts/create-favicon.sh
```

This creates simple blue square icons. Replace with your actual logo later.

### Option 3: Use Your Existing Logo

If you have a logo file (PNG, SVG, etc.):

1. **Resize to required sizes:**
   - 16x16px → `favicon-16x16.png`
   - 32x32px → `favicon-32x32.png`
   - 180x180px → `apple-touch-icon.png`
   - 192x192px → `android-chrome-192x192.png`
   - 512x512px → `android-chrome-512x512.png`

2. **Create ICO file:**
   - Use online converter: https://convertio.co/png-ico/
   - Or use ImageMagick: `convert favicon-16x16.png favicon-32x32.png favicon.ico`

3. **Place all files in `frontend/public/`**

## File Structure

After setup, `frontend/public/` should contain:

```
frontend/public/
├── favicon.ico
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png
├── android-chrome-192x192.png
├── android-chrome-512x512.png
└── site.webmanifest
```

## HTML Already Configured

The `frontend/index.html` already includes all the necessary `<link>` tags. You just need to add the image files.

## Testing

1. **Local testing:**
   ```bash
   cd frontend
   npm run dev
   ```
   Open browser and check favicon appears in tab

2. **Production testing:**
   - Deploy and check favicon appears
   - Test on mobile devices (iOS/Android)
   - Check browser console for any 404 errors

## Troubleshooting

### Favicon Not Showing

1. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check file paths** - ensure files are in `frontend/public/`
3. **Check file names** - must match exactly (case-sensitive)
4. **Check browser console** - look for 404 errors

### Different Favicon on Different Devices

- **Desktop**: Uses `favicon.ico` or `favicon-32x32.png`
- **iOS**: Uses `apple-touch-icon.png`
- **Android**: Uses `android-chrome-*.png`
- This is normal and expected!

## Quick Placeholder

If you need something immediately, you can use a simple emoji or text:

```bash
# Create a simple text-based favicon
# (This is just a placeholder - replace with real logo)
echo "🎬" > frontend/public/favicon.txt
```

But it's better to use the online generator for a proper favicon.

