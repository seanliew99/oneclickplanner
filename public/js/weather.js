function showWeatherForDateRange(forecast, startDate, endDate, containerSelector = 'body') {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const section = document.createElement('section');
  section.className = 'container mb-5';
  section.innerHTML = `
  <h2 class="text-center mb-3">
    Weather Timeline for Your Trip
    <button class="btn btn-sm btn-outline-secondary ms-2" data-bs-toggle="collapse" data-bs-target="#weatherCollapse" aria-expanded="true" aria-controls="weatherCollapse">
      Toggle
    </button>
  </h2>
  <div class="collapse show" id="weatherCollapse">
    <div id="weather-timeline"></div>
  </div>
`;

  container.appendChild(section);

  const timelineContainer = document.getElementById('weather-timeline');
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Filter entries within range
  const filtered = forecast.filter(entry => {
    const d = new Date(entry.datetime);
    return d >= start && d <= end;
  });

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
    const dateHeader = document.createElement('h4');
    const readableDate = new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    dateHeader.textContent = `📅 ${readableDate}`;
    timelineContainer.appendChild(dateHeader);

    const list = document.createElement('ul');
    list.className = 'list-group mb-4';

    entries.forEach(entry => {
      const time = new Date(entry.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const weather = entry.weather.toLowerCase();
      const rain = entry.rainVolume || 0;
      const emoji = weather.includes('rain') ? '🌧️' :
                    weather.includes('cloud') ? '☁️' :
                    weather.includes('clear') ? '☀️' :
                    weather.includes('storm') ? '⛈️' :
                    '🌡️';

      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerHTML = `
        <strong>${emoji} ${time}</strong> — ${entry.weather}, ${entry.temp}°C
        ${rain > 0 ? `<span class="badge bg-info ms-2">Rain: ${rain} mm</span>` : ''}
      `;
      list.appendChild(li);
    });

    timelineContainer.appendChild(list);
  });
}
