// popup.js

const LASTFM_API_KEY = "f5f43d64bf1acadfbfffa81b5f30c15a";

const connectBtn = document.getElementById("connectBtn");
const fetchNowBtn = document.getElementById("fetchNow");
const clearHistoryBtn = document.getElementById("clearHistory");
const statusEl = document.getElementById("status");
const notConnected = document.getElementById("notConnected");
const dashboard = document.getElementById("dashboard");

// Mood keywords mapped from Last.fm tags
const MOOD_KEYWORDS = {
  Hyped: ['party', 'dance', 'edm', 'club', 'house', 'techno', 'rave', 'electronic', 'big room', 'hardstyle', 'drum and bass', 'dubstep', 'trap', 'hype', 'upbeat', 'energetic dance', 'festival'],
  Energetic: ['rock', 'punk', 'metal', 'hard rock', 'alternative rock', 'grunge', 'hardcore', 'power', 'workout', 'gym', 'hip hop', 'hip-hop', 'rap', 'drill', 'grime', 'aggressive', 'intense'],
  Happy: ['pop', 'happy', 'sunshine', 'feel good', 'bubblegum', 'disco', 'funk', 'soul', 'motown', 'reggae', 'ska', 'tropical', 'summer', 'cheerful', 'uplifting', 'joyful', 'fun'],
  Chill: ['chill', 'chillout', 'lofi', 'lo-fi', 'ambient', 'downtempo', 'easy listening', 'bossa nova', 'jazz', 'smooth', 'relax', 'relaxing', 'soft', 'acoustic', 'singer-songwriter', 'mellow', 'calm', 'peaceful', 'laid back', 'slow'],
  Moody: ['sad', 'melancholy', 'melancholic', 'emo', 'dark', 'gothic', 'doom', 'blues', 'heartbreak', 'ballad', 'depressing', 'emotional', 'introspective', 'atmospheric', 'brooding', 'somber'],
  Romantic: ['rnb', 'r&b', 'love', 'romantic', 'sensual', 'slow jam', 'neo soul', 'bedroom', 'sexy', 'smooth rnb', 'love songs', 'seductive'],
  Focused: ['classical', 'instrumental', 'piano', 'study', 'focus', 'minimal', 'soundtrack', 'orchestral', 'meditation', 'new age', 'concentration', 'ambient', 'post-rock']
};

async function sendBackground(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => resolve(resp));
  });
}

async function ensureToken() {
  const resp = await sendBackground({ action: "getToken" });
  if (resp.error) {
    statusEl.textContent = "Auth error: " + resp.error;
    throw new Error(resp.error);
  }
  return resp.token;
}

async function fetchCurrentlyPlaying(token) {
  const url = "https://api.spotify.com/v1/me/player/currently-playing";
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 204) return null;
  if (!r.ok) throw new Error("Failed to fetch currently playing");
  return r.json();
}

// Fetch tags from Last.fm for a track
async function fetchLastFmTrackTags(artist, track) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.gettoptags&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json`;
  
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    
    if (data.toptags && data.toptags.tag) {
      // Return tag names (top 10)
      return data.toptags.tag.slice(0, 10).map(t => t.name.toLowerCase());
    }
    return [];
  } catch (err) {
    console.error("Last.fm track tags error:", err);
    return [];
  }
}

// Fetch tags from Last.fm for an artist (fallback)
async function fetchLastFmArtistTags(artist) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(artist)}&api_key=${LASTFM_API_KEY}&format=json`;
  
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    
    if (data.toptags && data.toptags.tag) {
      return data.toptags.tag.slice(0, 10).map(t => t.name.toLowerCase());
    }
    return [];
  } catch (err) {
    console.error("Last.fm artist tags error:", err);
    return [];
  }
}

// Map tags to mood
function mapMoodFromTags(tags) {
  if (!tags || tags.length === 0) return "Neutral";
  
  const tagString = tags.join(' ').toLowerCase();
  
  // Check each mood's keywords
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const keyword of keywords) {
      if (tagString.includes(keyword)) {
        return mood;
      }
    }
  }
  
  return "Neutral";
}

function saveRecord(record) {
  chrome.storage.local.get({ listeningHistory: [] }, (data) => {
    const arr = data.listeningHistory;
    arr.unshift(record); // newest first
    // keep max 200 records
    if (arr.length > 200) arr.length = 200;
    chrome.storage.local.set({ listeningHistory: arr }, () => {
      renderAnalytics();
    });
  });
}

function renderCurrent(trackName, artists, tags, mood) {
  const trackInfo = document.getElementById("trackInfo");
  const featInfo = document.getElementById("featInfo");

  trackInfo.textContent = `${trackName} — ${artists}`;
  
  if (tags && tags.length > 0) {
    featInfo.textContent = `Tags: ${tags.slice(0, 3).join(", ")} • Mood: ${mood}`;
  } else {
    featInfo.textContent = `Mood: ${mood}`;
  }
}

function renderAnalytics() {
  chrome.storage.local.get({ listeningHistory: [] }, (data) => {
    const arr = data.listeningHistory;
    document.getElementById("count").textContent = arr.length;
    
    if (arr.length === 0) {
      document.getElementById("topTags").textContent = "—";
      document.getElementById("recentList").innerHTML = "<li>No records yet</li>";
      document.getElementById("moodBreakdown").innerHTML = "";
      return;
    }

    // Count moods and tags
    const moodCounts = {};
    const tagCounts = {};
    
    arr.forEach(r => {
      moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1;
      if (r.tags) {
        r.tags.slice(0, 3).forEach(t => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    });

    // Top tags
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
    
    document.getElementById("topTags").textContent = topTags.length > 0 
      ? topTags.join(", ") 
      : "—";

    // Recent tracks
    const recentList = document.getElementById("recentList");
    recentList.innerHTML = "";
    arr.slice(0, 10).forEach(r => {
      const li = document.createElement("li");
      li.textContent = `${r.track_name} — ${r.artists} (${r.mood})`;
      recentList.appendChild(li);
    });

    // Mood breakdown
    const moodDiv = document.getElementById("moodBreakdown");
    moodDiv.innerHTML = "";
    
    // Sort moods by count
    const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
    
    for (const [mood, count] of sortedMoods) {
      const pill = document.createElement("span");
      pill.className = `mood-pill mood-${mood.toLowerCase()}`;
      pill.textContent = `${mood} (${count})`;
      moodDiv.appendChild(pill);
    }
  });
}

connectBtn?.addEventListener("click", async () => {
  statusEl.textContent = "Opening Spotify auth...";
  try {
    const token = await ensureToken();
    statusEl.textContent = "Connected - auto-tracking enabled";
    notConnected.style.display = "none";
    dashboard.style.display = "block";
    renderAnalytics();
    startPolling(); // Start auto-fetching after connect!
  } catch (err) {
    statusEl.textContent = "Auth failed: " + err.message;
  }
});

fetchNowBtn?.addEventListener("click", async () => {
  statusEl.textContent = "Fetching currently playing...";
  
  try {
    const token = await ensureToken();
    const current = await fetchCurrentlyPlaying(token);
    
    if (!current || !current.item) {
      statusEl.textContent = "No track currently playing.";
      return;
    }
    
    const trackId = current.item.id;
    const trackName = current.item.name;
    const artistName = current.item.artists[0]?.name || "Unknown";
    const artists = current.item.artists.map(a => a.name).join(", ");
    
    statusEl.textContent = "Getting mood from Last.fm...";
    
    // Try to get tags from Last.fm (track first, then artist as fallback)
    let tags = await fetchLastFmTrackTags(artistName, trackName);
    console.log(`Track "${trackName}" tags:`, tags);
    
    if (tags.length === 0) {
      tags = await fetchLastFmArtistTags(artistName);
      console.log(`Artist "${artistName}" tags:`, tags);
    }
    
    const mood = mapMoodFromTags(tags);
    console.log("Final tags:", tags, "Mood:", mood);

    const record = {
      ts: Date.now(),
      track_id: trackId,
      track_name: trackName,
      artists: artists,
      tags: tags,
      mood: mood
    };

    // Save and show
    saveRecord(record);
    renderCurrent(trackName, artists, tags, mood);
    statusEl.textContent = "Fetched and saved!";
    notConnected.style.display = "none";
    dashboard.style.display = "block";
  } catch (err) {
    statusEl.textContent = "Error: " + err.message;
    console.error(err);
  }
});

clearHistoryBtn?.addEventListener("click", () => {
  chrome.storage.local.set({ listeningHistory: [] }, () => {
    renderAnalytics();
    statusEl.textContent = "History cleared.";
  });
});

// Track the last saved track to avoid duplicates
let lastSavedTrackId = null;
let pollInterval = null;

// Auto-fetch current track
async function autoFetchCurrentTrack() {
  try {
    const token = await ensureToken();
    const current = await fetchCurrentlyPlaying(token);
    
    if (!current || !current.item) {
      const trackInfo = document.getElementById("trackInfo");
      const featInfo = document.getElementById("featInfo");
      trackInfo.textContent = "Nothing playing";
      featInfo.textContent = "Play something on Spotify!";
      return;
    }
    
    const trackId = current.item.id;
    const trackName = current.item.name;
    const artistName = current.item.artists[0]?.name || "Unknown";
    const artists = current.item.artists.map(a => a.name).join(", ");
    
    // Update display immediately
    const trackInfo = document.getElementById("trackInfo");
    trackInfo.textContent = `${trackName} — ${artists}`;
    
    // Only save if it's a new track
    if (trackId !== lastSavedTrackId) {
      const featInfo = document.getElementById("featInfo");
      featInfo.textContent = "Getting mood...";
      
      // Get tags from Last.fm
      let tags = await fetchLastFmTrackTags(artistName, trackName);
      if (tags.length === 0) {
        tags = await fetchLastFmArtistTags(artistName);
      }
      
      const mood = mapMoodFromTags(tags);
      
      const record = {
        ts: Date.now(),
        track_id: trackId,
        track_name: trackName,
        artists: artists,
        tags: tags,
        mood: mood
      };

      saveRecord(record);
      renderCurrent(trackName, artists, tags, mood);
      lastSavedTrackId = trackId;
      statusEl.textContent = "Auto-saved!";
    }
  } catch (err) {
    console.error("Auto-fetch error:", err);
  }
}

// Start polling
function startPolling() {
  if (pollInterval) return;
  autoFetchCurrentTrack(); // Fetch immediately
  pollInterval = setInterval(autoFetchCurrentTrack, 5000); // Then every 5 seconds
}

// Stop polling when popup closes
window.addEventListener('unload', () => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});

// on load, check connection
(async () => {
  try {
    const resp = await sendBackground({ action: "getToken" });
    if (resp.token && !resp.error) {
      notConnected.style.display = "none";
      dashboard.style.display = "block";
      renderAnalytics();
      statusEl.textContent = "Connected - auto-tracking enabled";
      startPolling(); // Start auto-fetching!
    } else {
      notConnected.style.display = "block";
      dashboard.style.display = "none";
      statusEl.textContent = "Not connected.";
    }
  } catch (e) {
    notConnected.style.display = "block";
    dashboard.style.display = "none";
    statusEl.textContent = "Ready (not connected).";
  }
})();
