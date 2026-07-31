# MCJS Mirror

A static, self-hosted launcher for all Eaglercraft/MCJS WebMC versions. Deploy to GitHub Pages in one click.

## Quick Start

### Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files to the repository
3. Go to **Settings > Pages**
4. Under "Source", select the branch (e.g., `main`) and folder `/ (root)`
5. Click **Save**
6. Your site will be live at `https://yourusername.github.io/repo-name/`

### Local Development

```bash
# Serve locally with Python
cd mcjs-mirror
python -m http.server 8080

# Or with Node.js
npx serve .
```

Then open `http://localhost:8080` in your browser.

## Features

- **All versions** - 16 versions from Alpha 1.2.6 to 26.1.2
- **Custom UI** - Dark themed, responsive, searchable
- **Fully localized** - No external CDN dependencies for the UI
- **Static deploy** - Works on GitHub Pages, Cloudflare Pages, Netlify, etc.
- **Multi-mirror** - Each version has multiple CDN mirrors to choose from
- **File splitting** - Optional: split large files for GitHub Pages compliance

## Game Files

By default, the launcher loads game files from MCJS public CDN mirrors at runtime.

### Offline Mode (Optional)

To include game files locally:

```bash
# Run the download script
chmod +x download.sh
./download.sh

# This will download game files to versions/
# Files > 10MB will be split automatically
```

After downloading, the launcher will prefer local files over CDN.

## File Structure

```
mcjs-mirror/
  index.html          # Launcher page
  css/style.css       # Dark theme styles
  js/app.js           # Main logic
  js/versions.js      # Version data & CDN URLs
  versions/           # Downloaded game files (optional)
    1.8.8/
      classes.js
      assets.epk
    1.12.2/
      ...
  download.sh         # Offline download script
  README.md           # This file
```

## Version List

| Version | Engine | Size | Language | Status |
|---------|--------|------|----------|--------|
| EaglercraftX 1.8.8 | JS | 21.1MB | CN/EN | Recommended |
| EaglercraftX 1.8.8 WASM | WASM | 9.6MB | CN/EN | Recommended |
| Eaglercraft 1.12.2 | JS | 27.7MB | CN/EN | Beta |
| Eaglercraft 1.12.2 WASM u2 | WASM | 15.9MB | CN/EN | Beta |
| Eaglercraft 1.12.2 WASM u3 | WASM | 17.9MB | EN | Beta |
| Eaglercraft 1.16.5 WASM | WASM | 50.6MB | EN | New Beta |
| Eaglercraft 1.21.11 WASM | WASM | 49.5MB | EN | New Beta |
| Eaglercraft 26.1.2 | WASM | 61.6MB | EN | New Beta |
| Eaglercraft 1.6.4 | JS | 23.5MB | EN | Legacy |
| Eaglercraft 1.5.2 | JS | 20.2MB | EN | Legacy |
| Eaglercraft 1.2.5 | JS | 21.3MB | EN | Legacy |
| Eaglercraft Beta 1.7.3 | JS | 15.6MB | EN | Legacy |
| Eaglercraft Beta 1.3 | JS | 4.3MB | EN | Legacy |
| Eaglercraft Alpha 1.2.6 | JS | 8.2MB | EN | Legacy |
| PixelClient 1.8.8 | JS | ? | EN | Modded |
| PixelClient 1.8.8 WASM | WASM | ? | EN | Modded |

## Credits

- [MCJS](https://mcjs.cc) - Chinese Eaglercraft optimization project
- [Eaglercraft](https://eaglercraft.com) - Original WebMC project by lax1dude & ayunami2000
- This mirror is a community project, not affiliated with MCJS or Eaglercraft

## License

This launcher UI is provided as-is for educational purposes. Game files are third-party content subject to their respective licenses. Minecraft is a trademark of Mojang Studios.
