// background.js
const CLIENT_ID = "909c219dd2f74089bfc150851b5f8500";
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-recently-played"
].join(" ");
const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

// Helper: Generate random string for PKCE
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Helper: Generate code challenge for PKCE
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  // Convert to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper: Exchange authorization code for token
async function exchangeCodeForToken(code, codeVerifier, redirectUri) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

// Helper: start Spotify auth using chrome.identity.launchWebAuthFlow with PKCE
async function startAuth() {
  // Generate PKCE values
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);
  
  // redirect URL required by chrome.identity
  const redirectUri = chrome.identity.getRedirectURL();
  
  // build authorize URL with PKCE
  const authParams = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES,
    state: state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });
  
  const url = `${AUTH_URL}?${authParams.toString()}`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: url, interactive: true },
      async (redirectResponse) => {
        if (chrome.runtime.lastError || !redirectResponse) {
          reject(chrome.runtime.lastError || new Error("No redirect response"));
          return;
        }
        
        // Parse the authorization code from the redirect URL
        const responseUrl = new URL(redirectResponse);
        const code = responseUrl.searchParams.get("code");
        const error = responseUrl.searchParams.get("error");
        
        if (error) {
          reject(new Error(`Spotify error: ${error}`));
          return;
        }
        
        if (!code) {
          reject(new Error("No authorization code found in redirect."));
          return;
        }
        
        try {
          // Exchange code for token
          const tokenData = await exchangeCodeForToken(code, codeVerifier, redirectUri);
          const access_token = tokenData.access_token;
          const expires_in = tokenData.expires_in || 3600;
          const expiry = Date.now() + (expires_in * 1000);
          
          chrome.storage.local.set({ 
            spotify_token: access_token, 
            spotify_token_expiry: expiry 
          }, () => {
            resolve({ access_token, expiry });
          });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

// Get token or refresh flow
async function getToken() {
  const data = await chrome.storage.local.get(["spotify_token", "spotify_token_expiry"]);
  const token = data.spotify_token;
  const expiry = data.spotify_token_expiry || 0;
  if (token && Date.now() < expiry - 60000) { // still valid (with 60s leeway)
    return token;
  }
  // otherwise start auth
  const auth = await startAuth();
  return auth.access_token;
}

// Message listener for popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getToken") {
    getToken().then((token) => sendResponse({ token })).catch((err) => sendResponse({ error: err.message }));
    return true; // indicates async response
  }
});

// Track the popup window ID
let popupWindowId = null;

// Open floating window when extension icon is clicked
chrome.action.onClicked.addListener(async () => {
  // Check if window already exists
  if (popupWindowId !== null) {
    try {
      const existingWindow = await chrome.windows.get(popupWindowId);
      if (existingWindow) {
        // Focus the existing window
        chrome.windows.update(popupWindowId, { focused: true });
        return;
      }
    } catch (e) {
      // Window doesn't exist anymore
      popupWindowId = null;
    }
  }
  
  // Create new popup window
  const window = await chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 380,
    height: 600,
    top: 100,
    left: 100
  });
  
  popupWindowId = window.id;
});

// Clean up when window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
});
