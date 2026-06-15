// ==========================================================================
// Firebase SDK Modules Import (CDN)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================================================
// FIREBASE CONFIGURATION
// Real Firebase Realtime Database config for ChildLink app.
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSySmartGridDemoKeyBypassCheck", // Web SDK DB client only requires databaseURL to access database
  authDomain: "smartgrid-abc67.firebaseapp.com",
  databaseURL: "https://smartgrid-abc67-default-rtdb.firebaseio.com/",
  projectId: "smartgrid-abc67",
  storageBucket: "smartgrid-abc67.appspot.com",
  messagingSenderId: "729486015243",
  appId: "1:729486015243:web:5d2a938c1b7e5f0d"
};

// ==========================================================================
// App State Variables & Caching
// ==========================================================================
// Load last known location from localStorage if available
const storedLat = localStorage.getItem("childlink_last_lat");
const storedLng = localStorage.getItem("childlink_last_lng");
const storedAddress = localStorage.getItem("childlink_last_address");
const storedTime = localStorage.getItem("childlink_last_time");

const FALLBACK_LAT = storedLat ? parseFloat(storedLat) : 24.8607; // Karachi fallback
const FALLBACK_LNG = storedLng ? parseFloat(storedLng) : 67.0011;

let activeLat = FALLBACK_LAT;
let activeLng = FALLBACK_LNG;
let activeAddress = storedAddress || "Awaiting coordinate stream...";
let lastUpdatedTime = storedTime || "Never";

let isFirstLoad = true;
let isFirebaseDataValid = false;
let isDatabaseOnline = false;

// History Timeline Store
const locationHistory = [
    {
        lat: 24.8615,
        lng: 67.0025,
        address: "M.A. Jinnah Road, Karachi, Sindh, Pakistan",
        time: "Today, 10:15 AM"
    },
    {
        lat: 24.8631,
        lng: 67.0082,
        address: "Jail Chowrangi, Karachi, Sindh, Pakistan",
        time: "Today, 09:42 AM"
    }
];

// ==========================================================================
// DOM Element Selectors
// ==========================================================================
// Screens
const screenLogin = document.getElementById("screen-login");
const screenHome = document.getElementById("screen-home");
const screenHistory = document.getElementById("screen-history");
const screenProfile = document.getElementById("screen-profile");
const appNav = document.getElementById("app-nav");

// Buttons & Forms
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnLogout = document.getElementById("btn-logout");
const btnRecenter = document.getElementById("btn-recenter");
const btnExternalMaps = document.getElementById("btn-external-maps");
const appToast = document.getElementById("app-toast");

// Telemetry & Details DOM
const parentGreetingName = document.getElementById("parent-greeting-name");
const homeDeviceStatusBadge = document.getElementById("home-device-status-badge");
const childConnectionIndicator = document.getElementById("child-connection-indicator");
const childAddressText = document.getElementById("child-address-text");
const childTimeText = document.getElementById("child-time-text");
const historyContainer = document.getElementById("history-container");
const historyEmpty = document.getElementById("history-empty");
const profileDeviceState = document.getElementById("profile-device-state");

// ==========================================================================
// Leaflet Map Initialization
// ==========================================================================
const map = L.map('map', {
    zoomControl: false // Disable zoom control temporarily to position it
}).setView([FALLBACK_LAT, FALLBACK_LNG], 15);

// Add zoom control to top-left out of card way
L.control.zoom({ position: 'topleft' }).addTo(map);

// Using classic clean CartoDB Voyager tiles (parent-friendly, clear street tags, similar to Uber/Google Maps)
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Custom Avatar Map Marker Icon (Parent-Friendly Pin)
const customChildIcon = L.divIcon({
    className: 'custom-child-marker',
    html: `
        <div class="child-marker-pin">
            <div class="child-marker-inner">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
        </div>
        <div class="child-marker-pulse"></div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Create child tracking marker on map
const childMarker = L.marker([FALLBACK_LAT, FALLBACK_LNG], { icon: customChildIcon }).addTo(map);

// Bind simple popup
childMarker.bindPopup(`
    <div style="font-family: var(--font-body); font-size: 0.8rem; text-align: center;">
        <strong style="color: var(--primary-color);">Liam's Location</strong><br>
        <span id="popup-address-sub">Loading Address...</span>
    </div>
`);

// ==========================================================================
// Reverse Geocoding Utility (Nominatim Free API)
// ==========================================================================
async function getAddressFromCoords(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: {
                'Accept-Language': 'en'
            }
        });
        if (!response.ok) throw new Error("API limit or issue");
        const data = await response.json();
        
        if (data && data.address) {
            const addr = data.address;
            const parts = [];
            
            // Build a readable shortened address sequence
            if (addr.road) parts.push(addr.road);
            if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
            if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
            
            return parts.length > 0 ? parts.join(", ") : data.display_name.split(",").slice(0, 3).join(", ");
        }
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (e) {
        console.warn("Reverse geocode failed: ", e);
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; // Fallback to raw coords
    }
}

// ==========================================================================
// SPA Screen Navigation Logic
// ==========================================================================
const screens = {
    "screen-login": screenLogin,
    "screen-home": screenHome,
    "screen-history": screenHistory,
    "screen-profile": screenProfile
};

function navigateTo(screenId) {
    // Hide all screens
    Object.values(screens).forEach(screen => screen.classList.remove("active"));
    
    // Show designated screen
    screens[screenId].classList.add("active");
    
    // Toggle Nav Bar presence
    if (screenId === "screen-login") {
        appNav.classList.add("hidden");
    } else {
        appNav.classList.remove("hidden");
        // Update active nav button class
        document.querySelectorAll(".nav-item").forEach(btn => {
            if (btn.getAttribute("data-screen") === screenId) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    // Leaflet map refresh when returning to home screen (fixes container draw issues)
    if (screenId === "screen-home") {
        setTimeout(() => {
            map.invalidateSize();
            map.panTo([activeLat, activeLng]);
        }, 150);
    }
}

// Nav items click listener
document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        const targetScreen = button.getAttribute("data-screen");
        navigateTo(targetScreen);
    });
});

// ==========================================================================
// Mock User Authentication
// ==========================================================================
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (email === "parent@childlink.com" && password === "password123") {
        // Successful login
        parentGreetingName.textContent = "Hello, Fahad!";
        navigateTo("screen-home");
    } else {
        // Error toast alert
        showToast("Invalid email or password!");
    }
});

btnLogout.addEventListener("click", () => {
    emailInput.value = "";
    passwordInput.value = "";
    navigateTo("screen-login");
    showToast("Signed out successfully.");
});

// ==========================================================================
// Telemetry UI Updating & Coordinate Validation
// ==========================================================================
function isValidCoordinates(lat, lng) {
    return (
        !isNaN(lat) && 
        !isNaN(lng) && 
        lat >= -90 && 
        lat <= 90 && 
        lng >= -180 && 
        lng <= 180 && 
        lat !== 0 && 
        lng !== 0
    );
}

// Show local notification toast inside phone screen
function showToast(message) {
    appToast.textContent = message;
    appToast.classList.add("show");
    setTimeout(() => {
        appToast.classList.remove("show");
    }, 2000);
}

// Center active coordinates
function recenterMap(zoomLevel = 17) {
    map.flyTo([activeLat, activeLng], zoomLevel, {
        animate: true,
        duration: 1.2
    });
    childMarker.openPopup();
}

// Recenter button click
btnRecenter.addEventListener("click", () => {
    recenterMap(map.getZoom() < 15 ? 17 : map.getZoom());
    showToast("Map centered on Liam");
});

// Update Action triggers
function updateExternalLinks(lat, lng) {
    btnExternalMaps.href = `https://www.google.com/maps?q=${lat},${lng}`;
}

// Dynamic Timeline rendering
function renderHistory() {
    historyContainer.innerHTML = "";
    if (locationHistory.length === 0) {
        historyEmpty.classList.remove("hidden");
        return;
    }
    historyEmpty.classList.add("hidden");
    
    locationHistory.forEach((item, index) => {
        const isNewest = index === 0;
        const timelineItem = document.createElement("div");
        timelineItem.className = `history-item ${isNewest ? 'newest' : ''}`;
        timelineItem.innerHTML = `
            <div class="history-card">
                <div class="history-meta">
                    <span class="history-time">${item.time}</span>
                    ${isNewest ? '<span class="history-tag">Newest</span>' : ''}
                </div>
                <div class="history-address">${item.address}</div>
                <div class="history-coords">${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}</div>
            </div>
        `;
        historyContainer.appendChild(timelineItem);
    });
}

// Render history initially
renderHistory();

// Handle new coordinate values received
async function handleNewCoordinates(lat, lng) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    lastUpdatedTime = timeStr;

    // 1. Update active tracker variables
    activeLat = lat;
    activeLng = lng;
    isFirebaseDataValid = true;

    // 2. Perform reverse geocoding asynchronously
    const address = await getAddressFromCoords(lat, lng);
    activeAddress = address;

    // Save to localStorage cache as last known location
    localStorage.setItem("childlink_last_lat", lat);
    localStorage.setItem("childlink_last_lng", lng);
    localStorage.setItem("childlink_last_address", address);
    localStorage.setItem("childlink_last_time", timeStr);

    // 3. Update dashboard elements (Display address + GPS coordinates)
    childAddressText.innerHTML = `${address}<br><span style="font-size: 0.65rem; color: var(--text-light); font-weight: 600; font-family: monospace;">GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}</span>`;
    
    // If online/connected
    if (isDatabaseOnline) {
        childConnectionIndicator.textContent = "Active Now";
        childConnectionIndicator.className = "status-indicator online";
        childTimeText.textContent = `Updated: ${timeStr}`;
    } else {
        childConnectionIndicator.textContent = "Last Seen";
        childConnectionIndicator.className = "status-indicator offline";
        childTimeText.textContent = `Last Seen: ${timeStr}`;
    }

    // Update map marker positions
    childMarker.setLatLng([lat, lng]);
    
    const popupEl = document.getElementById("popup-address-sub");
    if (popupEl) {
        popupEl.textContent = address;
    } else {
        childMarker.bindPopup(`
            <div style="font-family: var(--font-body); font-size: 0.8rem; text-align: center;">
                <strong style="color: var(--primary-color);">Liam's Location</strong><br>
                <span>${address}</span>
            </div>
        `);
    }

    // If first data arrival, fly directly to center the marker
    if (isFirstLoad) {
        map.setView([lat, lng], 17);
        isFirstLoad = false;
    } else {
        map.panTo([lat, lng]);
    }

    updateExternalLinks(lat, lng);

    // 4. Log to history if different from the last logged entry
    const lastHistoryItem = locationHistory[0];
    const distanceDelta = lastHistoryItem ? Math.abs(lastHistoryItem.lat - lat) + Math.abs(lastHistoryItem.lng - lng) : 999;
    
    // Approx 15 meters delta check
    if (distanceDelta > 0.00015) {
        locationHistory.unshift({
            lat: lat,
            lng: lng,
            address: address,
            time: `Today, ${timeStr}`
        });
        // Limit history array to 10 items
        if (locationHistory.length > 10) locationHistory.pop();
        renderHistory();
    }
}

// Handle invalid database payload (or device reporting 0,0)
function handleInvalidTelemetry(errorMsg) {
    isFirebaseDataValid = false;
    childConnectionIndicator.textContent = "Offline";
    childConnectionIndicator.className = "status-indicator offline";
    
    // Show "Waiting for GPS Signal" while retaining coordinate details
    childAddressText.innerHTML = `Waiting for GPS Signal<br><span style="font-size: 0.65rem; color: var(--text-light); font-weight: 600; font-family: monospace;">Last Location: ${activeLat.toFixed(6)}, ${activeLng.toFixed(6)}</span>`;
    childTimeText.textContent = `Last Attempt: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    // Keep marker at last known coordinates, do not move to 0,0
    childMarker.setLatLng([activeLat, activeLng]);
    updateExternalLinks(activeLat, activeLng);
    
    console.warn("Telemetry parsing issue: " + errorMsg);
}

// ==========================================================================
// Firebase Connection & Subscriptions
// ==========================================================================
const isDefaultConfig = firebaseConfig.apiKey === "YOUR_API_KEY";

if (isDefaultConfig) {
    // Show examiner instructional values
    console.log("Firebase config not set. Running in demo mode.");
    
    // In demo mode, mock coordinates feed after login to show examiner map movement
    setTimeout(() => {
        handleNewCoordinates(24.8614, 67.0016);
    }, 2000);
} else {
    try {
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        // Track active WebSocket status to database
        const connectedRef = ref(db, ".info/connected");
        onValue(connectedRef, (snap) => {
            const connected = snap.val() === true;
            isDatabaseOnline = connected;
            
            // Adjust badges
            if (connected) {
                homeDeviceStatusBadge.textContent = "Live";
                homeDeviceStatusBadge.parentElement.querySelector(".pulse-dot-online").style.backgroundColor = "var(--success)";
                profileDeviceState.textContent = "Connected";
                profileDeviceState.className = "info-value text-highlight";
            } else {
                homeDeviceStatusBadge.textContent = "Offline";
                homeDeviceStatusBadge.parentElement.querySelector(".pulse-dot-online").style.backgroundColor = "var(--danger)";
                profileDeviceState.textContent = "Offline";
                profileDeviceState.className = "info-value text-muted";
            }
        });

        // Track GPS Telemetry node 'Data'
        const gpsRef = ref(db, "Data");
        onValue(gpsRef, (snapshot) => {
            const data = snapshot.val();
            
            if (data && data.latt !== undefined && data.longg !== undefined) {
                const lat = parseFloat(data.latt);
                const lng = parseFloat(data.longg);

                if (isValidCoordinates(lat, lng)) {
                    handleNewCoordinates(lat, lng);
                } else {
                    handleInvalidTelemetry(`Invalid format: latt=${data.latt}, longg=${data.longg}`);
                }
            } else {
                handleInvalidTelemetry("Data nodes 'latt' or 'longg' missing from database path.");
            }
        }, (error) => {
            console.error("Firebase read error: ", error);
            handleInvalidTelemetry("Database connection denied: check credentials.");
        });

    } catch (e) {
        console.error("Firebase initialization failed: ", e);
        handleInvalidTelemetry("Firebase initialization failed.");
    }
}

// Initialize UI with last cached location if found in localStorage
if (storedLat && storedLng) {
    activeLat = parseFloat(storedLat);
    activeLng = parseFloat(storedLng);
    activeAddress = storedAddress || "Last known location";
    lastUpdatedTime = storedTime || "Never";

    // Set UI elements (Display address + GPS coordinates)
    childAddressText.innerHTML = `${activeAddress}<br><span style="font-size: 0.65rem; color: var(--text-light); font-weight: 600; font-family: monospace;">GPS: ${activeLat.toFixed(6)}, ${activeLng.toFixed(6)}</span>`;
    childConnectionIndicator.textContent = "Last Seen";
    childConnectionIndicator.className = "status-indicator offline";
    childTimeText.textContent = `Last Seen: ${lastUpdatedTime}`;

    // Move map marker to cached location
    childMarker.setLatLng([activeLat, activeLng]);
    map.setView([activeLat, activeLng], 15);
    
    // Bind marker popup details
    childMarker.bindPopup(`
        <div style="font-family: var(--font-body); font-size: 0.8rem; text-align: center;">
            <strong style="color: var(--primary-color);">Liam's Last Location</strong><br>
            <span>${activeAddress}</span>
        </div>
    `);
}

// Initial settings setup
updateExternalLinks(activeLat, activeLng);
navigateTo("screen-login");
