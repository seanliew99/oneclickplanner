function showWeatherForDateRange(forecast, startDate, endDate, containerSelector = 'body') {
  const container = document.querySelector(containerSelector);
  if (!container) return;


  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // Include the full end date
  
  // Filter entries within range
  const filtered = forecast.filter(entry => {
    const d = new Date(entry.datetime);
    return d >= start && d <= end;
  });


// Step 1: Build a full list of expected dates
const fullDates = [];
const current = new Date(start);
while (current <= end) {
  fullDates.push(current.toISOString().split('T')[0]);
  current.setDate(current.getDate() + 1);
}

// Step 2: Get available dates from forecast data
const forecastDates = new Set(filtered.map(f => f.datetime.split(' ')[0]));

// Step 3: Find missing dates
const missingDates = fullDates.filter(d => !forecastDates.has(d));

  const section = document.createElement('section');

  
  section.className = 'container mb-5';
  section.innerHTML = `
  <h2 class="text-center mb-3">
    Weather Timeline for Your Trip
    <button class="btn btn-sm btn-outline-secondary ms-2" data-bs-toggle="collapse" data-bs-target="#weatherCollapse" aria-expanded="true" aria-controls="weatherCollapse">
      Toggle
    </button>
  </h2>
  <div class="alert alert-info small">
    Forecast covers: <strong>${[...forecastDates].sort().join(', ')}</strong><br>
    ${missingDates.length > 0
      ? `<span class="text-danger">⚠️ No forecast available for: ${missingDates.join(', ')}</span>`
      : '✅ Forecast is available for all your trip dates.'}
  </div>
  <div class="collapse show" id="weatherCollapse">
    <div id="weather-timeline"></div>
  </div>
`;


  container.appendChild(section);

  const timelineContainer = document.getElementById('weather-timeline');



  if (filtered.length === 0) {
    timelineContainer.innerHTML = `<div class="alert alert-success">No rain or weather forecast available for these dates 🎉</div>`;
    return;
  }

  // Group by date
  const groupedByDay = {};
  filtered.forEach(entry => {
    const date = new Date(entry.datetime);
    const dateKey = date.toISOString().split('T')[0];

    if (!groupedByDay[dateKey]) groupedByDay[dateKey] = [];
    groupedByDay[dateKey].push(entry);
  });

  // Build visual timeline
Object.entries(groupedByDay).forEach(([dateStr, entries]) => {
  const readableDate = new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const card = document.createElement('div');
  card.className = 'card mb-4 shadow-sm';

  card.innerHTML = `
    <div class="card-header bg-primary text-white fw-bold">
      📅 ${readableDate}
    </div>
    <div class="card-body p-0">
      <ul class="list-group list-group-flush timeline-list"></ul>
    </div>
  `;

  const list = card.querySelector('.timeline-list');

  entries.forEach(entry => {
    const time = new Date(entry.datetime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const weather = entry.weather.toLowerCase();
    const rain = entry.rainVolume || 0;
    const emoji =
      weather.includes('rain') ? '🌧️' :
      weather.includes('cloud') ? '☁️' :
      weather.includes('clear') ? '☀️' :
      weather.includes('storm') ? '⛈️' :
      '🌡️';

    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start timeline-entry';

    li.innerHTML = `
      <div>
        <strong>${emoji} ${time}</strong><br>
        <small class="text-muted">${entry.weather}</small>
      </div>
      <div class="text-end">
        <span class="badge bg-secondary mb-1">${entry.temp}°C</span><br>
      ${rain > 0
  ? `<span class="badge bg-info ms-2">Rain: ${rain} mm</span>`
  : `<span class="badge bg-light text-dark ms-2">${weather}</span>`}

      </div>
    `;

    list.appendChild(li);
  });

  timelineContainer.appendChild(card);
});

}
