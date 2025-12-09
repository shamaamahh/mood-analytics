# 🎵 Mood Analytics

A Chrome extension that tracks your Spotify listening and analyzes your mood based on music genre tags.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)

## Features

- **Now Playing** — See what's currently playing on Spotify
- **Genre Tags** — Automatically fetches tags from Last.fm
- **Mood Detection** — Categorizes your music into moods: Hyped, Energetic, Happy, Chill, Moody, Romantic, or Focused
- **Stats Dashboard** — View your mood breakdown and top tags
- **Listening History** — Track your recent plays (up to 200 songs)

## Installation

1. **Download or clone this repo**
   
   git clone https://github.com/YOUR_USERNAME/mood-analytics.git
   2. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)

3. **Load the extension**
   - Click **Load unpacked**
   - Select the `mood-analytics` folder

4. **Connect to Spotify**
   - Click the extension icon in your toolbar
   - Click **Connect Spotify** and authorize

## Usage

1. Play music on Spotify (desktop app or web player)
2. Click the extension icon to open the dashboard
3. Your current track and mood will appear automatically
4. The extension auto-tracks new songs every 5 seconds while the popup is open

## Mood Categories

| Mood | Music Types |
|------|-------------|
| Hyped | EDM, house, techno, festival |
| Energetic | Rock, metal, hip hop, workout |
| Happy | Pop, disco, funk, reggae |
| Chill | Lo-fi, ambient, jazz, acoustic |
| Moody | Sad, emo, blues, melancholy |
| Romantic | R&B, love songs, slow jams |
| Focused | Classical, instrumental, study |

## Tech Stack

- Chrome Extension Manifest V3
- Spotify Web API (OAuth with PKCE)
- Last.fm API for genre tags

## License

MIT