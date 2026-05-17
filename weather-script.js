// Weather App Script
const searchBtn = document.getElementById('searchBtn');
const currentBtn = document.getElementById('currentBtn');
const locationInput = document.getElementById('locationInput');

// Event listeners
searchBtn.addEventListener('click', handleSearch);
currentBtn.addEventListener('click', handleCurrentLocation);
locationInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

// Default location (New York)
let currentLat = 40.7128;
let currentLon = -74.0060;

// Initialize with default location
window.addEventListener('load', () => {
    fetchWeather(currentLat, currentLon);
});

// Handle search
async function handleSearch() {
    const location = locationInput.value.trim();
    
    if (!location) {
        showError('Please enter a city name or coordinates');
        return;
    }

    // Check if input is coordinates (lat, lon)
    const coordMatch = location.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        
        if (isValidCoordinates(lat, lon)) {
            fetchWeather(lat, lon);
        } else {
            showError('Invalid coordinates. Use format: latitude, longitude');
        }
    } else {
        // Search by city name
        geocodeLocation(location);
    }
}

// Geocode location name to coordinates
async function geocodeLocation(cityName) {
    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
        );
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            fetchWeather(result.latitude, result.longitude, result.name, result.country);
        } else {
            showError(`City "${cityName}" not found. Try another search.`);
        }
    } catch (error) {
        showError('Error searching for location: ' + error.message);
    }
}

// Handle current location
function handleCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetchWeather(lat, lon);
            },
            (error) => {
                showError('Unable to get your location: ' + error.message);
            }
        );
    } else {
        showError('Geolocation is not supported by your browser');
    }
}

// Fetch weather data
async function fetchWeather(lat, lon, cityName = null, country = null) {
    try {
        // Show loading state
        document.getElementById('weatherCard').innerHTML = '<div class="loading"></div>';

        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&hourly=temperature_2m,weather_code,precipitation&timezone=auto`
        );

        if (!response.ok) throw new Error('Failed to fetch weather data');

        const data = await response.json();
        currentLat = lat;
        currentLon = lon;

        // Get location name if not provided
        if (!cityName) {
            cityName = await getLocationName(lat, lon);
        }

        // Update UI with weather data
        updateCurrentWeather(data, cityName, country, lat, lon);
        updateDailyForecast(data);
        updateHourlyForecast(data);

        // Clear input
        locationInput.value = '';
    } catch (error) {
        showError('Error fetching weather: ' + error.message);
    }
}

// Get location name from coordinates
async function getLocationName(lat, lon) {
    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results[0].name || 'Unknown Location';
        }
    } catch (error) {
        console.log('Could not get location name');
    }
    return 'Unknown Location';
}

// Update current weather display
function updateCurrentWeather(data, cityName, country, lat, lon) {
    const current = data.current;
    const weatherCode = current.weather_code;
    const weatherIcon = getWeatherIcon(weatherCode);
    const weatherDesc = getWeatherDescription(weatherCode);

    const countryStr = country ? `, ${country}` : '';
    const html = `
        <div class="location-display">
            <h2 id="locationName">${cityName}${countryStr}</h2>
            <p id="coordinates" class="coordinates">${lat.toFixed(4)}°, ${lon.toFixed(4)}°</p>
        </div>
        
        <div class="current-info">
            <div class="temperature-section">
                <span id="temperature" class="temperature">${Math.round(current.temperature_2m)}°C</span>
                <div class="weather-desc">
                    <p id="condition" class="condition">${weatherIcon} ${weatherDesc}</p>
                    <p id="feelsLike" class="feels-like">Feels like: ${Math.round(current.apparent_temperature)}°C</p>
                </div>
            </div>

            <div class="weather-details">
                <div class="detail-box">
                    <span class="detail-icon">💧</span>
                    <div class="detail-content">
                        <p class="detail-label">Humidity</p>
                        <p id="humidity" class="detail-value">${current.relative_humidity_2m}%</p>
                    </div>
                </div>
                <div class="detail-box">
                    <span class="detail-icon">💨</span>
                    <div class="detail-content">
                        <p class="detail-label">Wind Speed</p>
                        <p id="windSpeed" class="detail-value">${Math.round(current.wind_speed_10m)} km/h</p>
                    </div>
                </div>
                <div class="detail-box">
                    <span class="detail-icon">🔽</span>
                    <div class="detail-content">
                        <p class="detail-label">Pressure</p>
                        <p id="pressure" class="detail-value">${Math.round(current.pressure_msl)} hPa</p>
                    </div>
                </div>
                <div class="detail-box">
                    <span class="detail-icon">👁️</span>
                    <div class="detail-content">
                        <p class="detail-label">Visibility</p>
                        <p id="visibility" class="detail-value">${(current.visibility / 1000).toFixed(1)} km</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('weatherCard').innerHTML = html;
}

// Update daily forecast
function updateDailyForecast(data) {
    const daily = data.daily;
    let forecastHtml = '';

    for (let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const weatherCode = daily.weather_code[i];
        const icon = getWeatherIcon(weatherCode);
        const description = getWeatherDescription(weatherCode);

        forecastHtml += `
            <div class="forecast-card">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-icon">${icon}</div>
                <div class="forecast-temp">${Math.round(daily.temperature_2m_max[i])}°</div>
                <div class="forecast-range">${Math.round(daily.temperature_2m_min[i])}°</div>
                <div class="forecast-condition">${description}</div>
            </div>
        `;
    }

    document.getElementById('forecastContainer').innerHTML = forecastHtml;
}

// Update hourly forecast
function updateHourlyForecast(data) {
    const hourly = data.hourly;
    let hourlyHtml = '';

    // Show next 24 hours
    for (let i = 0; i < 24; i++) {
        const dateTime = new Date(hourly.time[i]);
        const hour = dateTime.getHours();
        const timeStr = hour.toString().padStart(2, '0') + ':00';
        const weatherCode = hourly.weather_code[i];
        const icon = getWeatherIcon(weatherCode);
        const description = getWeatherDescription(weatherCode);
        const temp = Math.round(hourly.temperature_2m[i]);
        const precipitation = hourly.precipitation[i];

        hourlyHtml += `
            <div class="hourly-card">
                <div class="hourly-time">${timeStr}</div>
                <div class="hourly-icon">${icon}</div>
                <div class="hourly-temp">${temp}°C</div>
                <div class="hourly-condition">${description}</div>
                ${precipitation > 0 ? `<div class="forecast-range">💧 ${precipitation}mm</div>` : ''}
            </div>
        `;
    }

    document.getElementById('hourlyContainer').innerHTML = hourlyHtml;
}

// Map weather codes to icons and descriptions
function getWeatherIcon(code) {
    const weatherMap = {
        0: '☀️',      // Clear
        1: '🌤️',     // Mainly clear
        2: '⛅',      // Partly cloudy
        3: '☁️',      // Overcast
        45: '🌫️',    // Foggy
        48: '🌫️',    // Foggy (rime)
        51: '🌦️',    // Light drizzle
        53: '🌦️',    // Moderate drizzle
        55: '🌦️',    // Dense drizzle
        61: '🌧️',    // Slight rain
        63: '🌧️',    // Moderate rain
        65: '⛈️',    // Heavy rain
        71: '🌨️',    // Slight snow
        73: '🌨️',    // Moderate snow
        75: '🌨️',    // Heavy snow
        80: '🌦️',    // Slight rain showers
        81: '🌧️',    // Moderate rain showers
        82: '⛈️',    // Violent rain showers
        85: '🌨️',    // Slight snow showers
        86: '🌨️',    // Heavy snow showers
        95: '⛈️',    // Thunderstorm
        96: '⛈️',    // Thunderstorm with hail
        99: '⛈️',    // Thunderstorm with large hail
    };
    return weatherMap[code] || '❓';
}

function getWeatherDescription(code) {
    const descMap = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Foggy',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
        99: 'Thunderstorm with large hail',
    };
    return descMap[code] || 'Unknown';
}

// Validate coordinates
function isValidCoordinates(lat, lon) {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const container = document.querySelector('.container');
    const firstChild = container.firstChild;
    container.insertBefore(errorDiv, firstChild.nextSibling);

    // Remove error after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}
