# ChildLink - Parent Tracking Mobile App 📱🛰️

A complete, modern, mobile-first tracking application designed for Final Year Project (FYP) presentations. **ChildLink** replaces complex developer dashboards with a parent-friendly tracking interface. It simulates a native iOS/Android application that allows parents to securely log in, monitor their child's live location on an interactive map, and check historical location timelines.

---

## 🌟 Key Application Features

1. **Smartphone Frame Simulation (SPA):**
   - On desktop displays, the app renders inside a simulated iOS/Android smartphone frame, providing a visual demonstration of a native mobile app interface.
   - On actual mobile devices, it automatically collapses its bezels to fill the screen for a native web-app experience.
2. **Seamless Navigation:**
   - Features a bottom tab bar (Tracker, History, Settings/Profile) with responsive screen switches and Leaflet layout recalculations.
3. **Smart Address Translating (Geocoding):**
   - Translates raw GPS coordinate numbers from the ESP32 (e.g. `24.9732, 67.0714`) into human-readable street addresses (e.g., `M.A. Jinnah Road, Karachi`) in real-time using the free OpenStreetMap Nominatim API.
4. **Interactive Location Timeline:**
   - Records movement events dynamically. When new valid coordinates arrive from the ESP32 database, they are reverse-geocoded and appended to the **History** tab.
5. **Connection & Status Guards:**
   - Real-time online/offline indicators for both the parent database connection and child hardware connection state.
   - Displays "Active Now" when receiving updates, or falls back to "Last Seen" using cached coordinates if the tracking module goes offline.

---

## 🚪 Demo Access Credentials
To demonstrate the app for examiners, use these pre-configured credentials:
- **Email:** `parent@childlink.com`
- **Password:** `password123`

---

## 🗄️ Firebase Database Schema
The web application reads data from the root of your Realtime Database:

```json
{
  "Data": {
    "latt": "24.973224",
    "longg": "67.0714226"
  }
}
```

> [!IMPORTANT]
> - The database structure keys **must** be `latt` and `longg` nested under the `Data` parent node.
> - The web application handles parsing from both strings and numerical floats automatically.

---

## 🚀 Setup & Launch Instructions

### 1. Insert Firebase Config Credentials
Open `app.js` and locate the config block on lines 12–20. Replace the placeholder values with your Firebase web app keys (obtained from your Firebase Console > Project Settings):

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "YOUR_REALTIME_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 2. Configure Firebase Database Rules
Allow read permission in your Firebase Realtime Database rules:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### 3. Run the App Locally
Because the app loads JavaScript as a module for Firebase SDK CDNs, modern browsers block directory execution (`file://` URL scheme). You must serve files via a local HTTP server:

#### Option A: VS Code Live Server (Recommended)
1. Open the project folder in VS Code.
2. Click **Go Live** in the bottom status bar (or right-click `index.html` > **Open with Live Server**).
3. The browser will launch the app at `http://127.0.0.1:5500/`.

#### Option B: Python Simple HTTP Server
Open terminal in the project directory and run:
`python -m http.server 3000`
Then navigate to `http://localhost:3000/`.

#### Option C: Node.js static server
If npm is available, run:
`npx http-server -p 3000`

---

## 👨‍🏫 Examiner Demonstration Walkthrough

When presenting **ChildLink** to evaluators, execute the following steps for maximum impact:

1. **Demonstrate Login & Security:**
   - Start the demo at the Login screen. Emphasize that the app secures family location data by requiring account verification.
   - Enter wrong credentials to show input handling, then enter the correct credentials (`parent@childlink.com` / `password123`) to unlock the tracking view.
2. **Showcase Leaflet Map & Geocoding:**
   - Point out the user-friendly layout. Instead of raw developer logs, show how the app geocodes the coordinates into a readable address (e.g., "M.A. Jinnah Road") under the child's avatar.
3. **Simulate Live GPS Movement:**
   - Go to your Firebase console and alter the values of `latt` and `longg` (e.g., from `24.8607` to `24.8635`).
   - Show the examiners how the map centers instantly and glides the child marker automatically to the new location with zero delay.
4. **Showcase Location History Timeline:**
   - Navigate to the **History** tab. Show how previous locations are archived with precise timestamps, and explain that new locations are logged automatically as the child travels.
5. **Demonstrate Offline Resiliency:**
   - Turn off Wi-Fi on the tracking device (or simulate it by setting the Firebase values to invalid ranges). 
   - Point out how the app switches the badge to "Offline", displays the "Last Seen" timestamp, and preserves the last known location on screen without failing or crashing.
