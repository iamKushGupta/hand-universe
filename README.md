# 🌌 Hand Universe

An interactive 3D particle experience controlled by your hand gestures via webcam.

**[Live Demo →](https://yourusername.github.io/hand-universe/)**

## ✋ Gestures

| Gesture | Effect |
|---------|--------|
| ✊ Fist | Particles cluster and follow your hand |
| 🖐️ Open Palm | Particles explode outward |
| ✊ Fist again | Explosion reverses (implode) |
| 🤟 I Love You | Particles form "I LOVE YOU" text |

## Tech Stack

- **Three.js** — 3D particle rendering with custom shaders
- **MediaPipe Hands** — Real-time hand tracking (runs entirely in-browser)
- **Vanilla JS/CSS** — Zero build tools, zero server requirements

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push this folder:
   ```bash
   cd hand-universe
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/hand-universe.git
   git push -u origin main
   ```
3. Go to **Settings → Pages → Source → Deploy from branch → `main`**
4. Your site will be live at `https://YOUR_USERNAME.github.io/hand-universe/`

## Privacy

All hand tracking runs **100% client-side** in your browser. No video data is ever sent to any server.

## License

MIT
