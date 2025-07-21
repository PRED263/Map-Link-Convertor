// --- DOM Element References ---
const mapLinkInput = document.getElementById('map-link-input');
const convertBtn = document.getElementById('convert-btn');
const outputSection = document.getElementById('output-section');
const outputLink = document.getElementById('output-link');
const copyBtn = document.getElementById('copy-btn');
const copyFeedback = document.getElementById('copy-feedback');
const errorMessage = document.getElementById('error-message');
const inputLabel = document.getElementById('input-label');
const outputLabel = document.getElementById('output-label');
const appleToGoogleBtn = document.getElementById('apple-to-google-btn');
const googleToAppleBtn = document.getElementById('google-to-apple-btn');
const clearInputBtn = document.getElementById('clear-input-btn');

// --- State ---
let conversionDirection = 'apple-to-google'; // 'apple-to-google' or 'google-to-apple'
let map;
let marker;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    updateUIForDirection();
    
    // --- Event Listeners ---
    convertBtn.addEventListener('click', handleConversion);
    copyBtn.addEventListener('click', copyToClipboard);
    mapLinkInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleConversion();
        }
    });
    appleToGoogleBtn.addEventListener('click', () => setDirection('apple-to-google'));
    googleToAppleBtn.addEventListener('click', () => setDirection('google-to-apple'));
    clearInputBtn.addEventListener('click', clearInputAndResetView);
    mapLinkInput.addEventListener('input', handleInput);
});

/**
 * Initializes the Leaflet map.
 */
function initMap() {
    map = L.map('map').setView([20, 0], 2); // Default view
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // FIX: Sometimes the map initializes before the container has a size.
    // This ensures the map size is recalculated after a brief moment.
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

/**
 * Updates the map view and places a marker.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 */
function updateMap(lat, lon) {
    if (marker) {
        map.removeLayer(marker);
    }
    // FIX: Ensure map size is correct before setting the view, in case the layout changed.
    map.invalidateSize();
    map.setView([lat, lon], 15);
    marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`)
        .openPopup();
}

/**
 * Sets the conversion direction and updates the UI.
 * @param {string} direction - The new direction.
 */
function setDirection(direction) {
    conversionDirection = direction;
    updateUIForDirection();
}

/**
 * Updates UI elements based on the current conversion direction.
 */
function updateUIForDirection() {
    clearInputAndResetView();

    if (conversionDirection === 'apple-to-google') {
        inputLabel.textContent = 'Apple Maps Link or Coordinates';
        outputLabel.textContent = 'Google Maps Link';
        mapLinkInput.placeholder = 'e.g., http://maps.apple.com/?ll=34.0522,-118.2437';
        appleToGoogleBtn.classList.add('bg-white', 'text-blue-600', 'shadow');
        googleToAppleBtn.classList.remove('bg-white', 'text-blue-600', 'shadow');
    } else {
        inputLabel.textContent = 'Google Maps Link or Coordinates';
        outputLabel.textContent = 'Apple Maps Link';
        mapLinkInput.placeholder = 'e.g., https://www.google.com/maps?q=34.0522,-118.2437';
        googleToAppleBtn.classList.add('bg-white', 'text-blue-600', 'shadow');
        appleToGoogleBtn.classList.remove('bg-white', 'text-blue-600', 'shadow');
    }
}

/**
 * Resets the output, error messages, and map to their initial state.
 */
function resetView() {
    outputSection.classList.add('hidden');
    hideError();
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    map.setView([20, 0], 2);
    clearInputBtn.classList.add('hidden');
}

/**
 * Clears the input field and resets the view. Called by the clear button.
 */
function clearInputAndResetView() {
    mapLinkInput.value = '';
    resetView();
}

/**
 * Handles the input event on the textarea to show/hide the clear button.
 */
function handleInput() {
    if (mapLinkInput.value.length > 0) {
        clearInputBtn.classList.remove('hidden');
    } else {
        // If user manually clears the input, also reset the view.
        resetView();
    }
}

/**
 * Main function to handle the conversion logic.
 */
function handleConversion() {
    const input = mapLinkInput.value.trim();
    hideError();
    
    if (!input) {
        showError("Please enter a map link or coordinates.");
        return;
    }

    let locationData;
    let outputUrl;

    if (conversionDirection === 'apple-to-google') {
        locationData = parseAppleInput(input);
        if (locationData) {
            outputUrl = locationData.query 
                ? `https://www.google.com/maps?q=${encodeURIComponent(locationData.query)}`
                : `https://www.google.com/maps?q=${locationData.lat},${locationData.lon}`;
        }
    } else { // google-to-apple
        locationData = parseGoogleInput(input);
        if (locationData) {
            outputUrl = locationData.query
                ? `http://maps.apple.com/?q=${encodeURIComponent(locationData.query)}`
                : `http://maps.apple.com/?ll=${locationData.lat},${locationData.lon}`;
        }
    }

    if (locationData && outputUrl) {
        displayResult(outputUrl);
        if (locationData.lat && locationData.lon) {
            updateMap(parseFloat(locationData.lat), parseFloat(locationData.lon));
        }
    } else {
        showError("Invalid format. Please check the input and try again.");
    }
}

// --- Parsers ---

const coordRegex = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;

function parseAppleInput(input) {
    let match = input.match(coordRegex);
    if (match) return { lat: match[1], lon: match[2] };

    try {
        const url = new URL(input);
        if (url.hostname.endsWith('apple.com')) {
            const params = url.searchParams;
            if (params.has('ll')) {
                const [lat, lon] = params.get('ll').split(',');
                if (lat && lon) return { lat, lon };
            }
            if (params.has('q')) {
                const q = params.get('q');
                match = q.match(coordRegex);
                if(match) return { lat: match[1], lon: match[2] };
                return { query: q };
            }
            if (params.has('address')) return { query: params.get('address') };
        }
    } catch (e) { /* Not a URL, which is fine */ }
    return null;
}

function parseGoogleInput(input) {
    let match = input.match(coordRegex);
    if (match) return { lat: match[1], lon: match[2] };
    
    const pathCoordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    match = input.match(pathCoordRegex);
    if (match) return { lat: match[1], lon: match[2] };

    try {
        const url = new URL(input);
        const params = url.searchParams;
        if (params.has('q')) {
            const q = params.get('q');
            match = q.match(coordRegex);
            if (match) return { lat: match[1], lon: match[2] };
            return { query: q };
        }
         if (params.has('ll')) {
            const [lat, lon] = params.get('ll').split(',');
            if (lat && lon) return { lat, lon };
        }
        const pathSegments = url.pathname.split('/');
        const placeIndex = pathSegments.indexOf('place');
        if (placeIndex !== -1 && pathSegments.length > placeIndex + 1) {
            return { query: decodeURIComponent(pathSegments[placeIndex + 1].replace(/\+/g, ' ')) };
        }
    } catch (e) { /* Not a URL, which is fine */ }
    return null;
}

// --- UI Functions ---

function displayResult(link) {
    outputSection.classList.remove('hidden');
    outputLink.value = link;
}

function copyToClipboard() {
    // A workaround for clipboard API in secure contexts/iframes
    const textarea = document.createElement('textarea');
    textarea.value = outputLink.value;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        copyFeedback.textContent = 'Copied!';
        setTimeout(() => { copyFeedback.textContent = ''; }, 2000);
    } catch (err) {
        copyFeedback.textContent = 'Failed to copy';
    }
    document.body.removeChild(textarea);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    outputSection.classList.add('hidden'); // Hide previous results
}

function hideError() {
    errorMessage.classList.add('hidden');
}
