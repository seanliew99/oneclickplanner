
function showWeatherForDateRange(forecast, startDate, endDate, containerSelector = 'body') {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const section = document.createElement('section');
  section.className = 'container mb-5';

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const filtered = forecast.filter(entry => {
    const d = new Date(entry.datetime);
    return d >= start && d <= end;
  });

  // Build list of all expected dates
const fullDates = [];
const current = new Date(start);
while (current <= end) {
  fullDates.push(current.toISOString().split('T')[0]);
  current.setDate(current.getDate() + 1);
}

// Get dates that exist in forecast
const forecastDates = new Set(filtered.map(f => f.datetime.split(' ')[0]));

// Find missing days
const missingDates = fullDates.filter(d => !forecastDates.has(d));

// Show warning if missing
if (missingDates.length > 0) {
  const warning = document.createElement('div');
  warning.className = 'alert alert-warning fw-semibold text-center';
  warning.innerHTML = `
    ⚠️ Weather forecast is only available for <strong>${forecastDates.size}</strong> of your 
    <strong>${fullDates.length}</strong> trip days.<br>
    Missing: ${missingDates.join(', ')}<br>
    Forecasts are limited to the next 5 days by the weather provider.
  `;
  container.prepend(warning); // place before timeline
}


  const groupedByDay = {};
  filtered.forEach(entry => {
    const date = entry.datetime.split(' ')[0];
    if (!groupedByDay[date]) groupedByDay[date] = [];
    groupedByDay[date].push(entry);
  });

  section.innerHTML = `
    <h2 class="text-center mb-4">📆 Weather Forecast Timeline</h2>
    <div class="overflow-auto pb-2">
      <div class="d-flex flex-nowrap gap-4 px-2" id="weather-timeline" style="min-height: 220px;"></div>
    </div>
    <style>
      .timeline-card {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        cursor: pointer;
      }
      .timeline-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.15);
      }
      .timeline-header {
        font-size: 1rem;
        line-height: 1.4;
      }
    </style>
  `;

  container.appendChild(section);
  const timelineContainer = document.getElementById('weather-timeline');

  Object.entries(groupedByDay).forEach(([dateStr, entries]) => {
    const dateObj = new Date(dateStr);
    const readableDay = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
    const readableDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    const weatherFreq = {};
    entries.forEach(e => {
      const w = e.weather.toLowerCase();
      if (!weatherFreq[w]) weatherFreq[w] = 0;
      weatherFreq[w]++;
    });

    const dominantWeather = Object.entries(weatherFreq).sort((a, b) => b[1] - a[1])[0][0];
    const emoji = dominantWeather.includes('rain') ? '🌧️' :
                  dominantWeather.includes('cloud') ? '☁️' :
                  dominantWeather.includes('clear') ? '☀️' :
                  dominantWeather.includes('storm') ? '⛈️' : '🌡️';

    const column = document.createElement('div');
    column.className = 'card flex-shrink-0 timeline-card border-0 shadow-sm';
    column.style.minWidth = '240px';
    column.dataset.date = dateStr;

    column.innerHTML = `
      <div class="card-header text-center text-white timeline-header" style="background: linear-gradient(135deg, #0077b6, #00b4d8);">
        <div class="fw-bold">${readableDay}</div>
        <div class="small">${readableDate}</div>
        <div class="mt-1">${emoji} ${dominantWeather}</div>
      </div>
      <ul class="list-group list-group-flush small text-center"></ul>
    `;

    // Add click-to-jump
    column.querySelector('.card-header').addEventListener('click', () => {
      window.location.href = `/itinerary?date=${dateStr}`;
    });
    

    const list = column.querySelector('ul');
    entries.forEach(entry => {
      const time = new Date(entry.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const weather = entry.weather.toLowerCase();
      const rain = entry.rainVolume || 0;
      const icon =
        weather.includes('rain') ? '🌧️' :
        weather.includes('cloud') ? '☁️' :
        weather.includes('clear') ? '☀️' :
        weather.includes('storm') ? '⛈️' : '🌡️';

      const li = document.createElement('li');
      li.className = 'list-group-item py-2 px-1 border-0 border-bottom';
      li.innerHTML = `
        <div class="fw-semibold">${icon} ${time}</div>
        <div class="text-muted">${weather}</div>
        <div class="mt-1">
          <span class="badge bg-secondary">${entry.temp}°C</span>
          ${rain > 0 ? `<span class="badge bg-info ms-2">Rain: ${rain} mm</span>` : ''}
        </div>
      `;
      list.appendChild(li);
    });

    timelineContainer.appendChild(column);
  });
}


// Wrapper to safely call showWeatherForDateRange and handle errors
function fetchAndShowWeather(forecast, startDate, endDate, containerSelector) {
  try {
    if (!forecast || !Array.isArray(forecast)) {
      throw new Error("Weather data is missing or invalid.");
    }
    showWeatherForDateRange(forecast, startDate, endDate, containerSelector);
  } catch (err) {
    console.error('Weather render failed:', err);
    const container = document.querySelector(containerSelector || 'body');
    if (container) {
      const section = document.createElement('section');
      section.className = 'container mt-4';
      section.innerHTML = `
        <div class="alert alert-danger">
          ⚠️ Unable to load weather forecast at the moment. Please try again later.
        </div>
      `;
      container.appendChild(section);
    }
  }
}
