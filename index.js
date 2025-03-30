// Travel Planner Server using Google Places API v1
const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

const ItineraryModel = require('./models/itinerary');

const isAuthenticated = (req, res, next) => {
  if (req.session.user && req.session.user.sub) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized', authenticated: false });
};


const app = express();
const PORT = process.env.PORT || 3000;

// Google API Key
const API_KEY = process.env.GOOGLE_API_KEY;

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Configure session
app.use(session({
  secret: 'travel-planner-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Create route to serve the API key to the frontend
app.get('/api/config', (req, res) => {
  res.json({
    apiKey: API_KEY
  });
});

// Save or update travel plan
app.post('/api/plan', async (req, res) => {
  const { destination, cities = [], startDate, endDate, country } = req.body;
  
  if (!destination) {
    return res.status(400).json({ error: 'Destination is required' });
  }
  
  // Store the plan in session as before (for non-authenticated users)
  req.session.plan = {
    destination, // still keep for quick display
    cities,      // <-- array of { name, days }
    startDate,
    endDate,
    country,
    createdAt: new Date().toISOString(),
    attractions: req.session.plan?.attractions || [],
    restaurants: req.session.plan?.restaurants || []
  };
  
  // If user is authenticated, also save to DynamoDB
  if (req.session.user && req.session.user.sub) {
    try {
      const userId = req.session.user.sub;
      
      // First check if the user already has an itinerary
      let existingItinerary = await ItineraryModel.getItineraryByUserId(userId);
      let savedItinerary;
      
      if (existingItinerary) {
        // Update existing itinerary
        existingItinerary.destination = destination;
        existingItinerary.cities = cities;
        existingItinerary.startDate = startDate;
        existingItinerary.endDate = endDate;  
        existingItinerary.country = country;
        existingItinerary.updatedAt = new Date().toISOString();
        savedItinerary = await ItineraryModel.saveItinerary(userId, existingItinerary);
      } else {
        // Create new itinerary
        savedItinerary = await ItineraryModel.saveItinerary(userId, req.session.plan);
      }
      
      // Update session with the saved data
      req.session.plan = savedItinerary;
    } catch (error) {
      console.error('Error saving itinerary to DynamoDB:', error);
      // Continue even if DB save fails - at least it's in the session
    }
  }
  
  res.json({ success: true, plan: req.session.plan });
});

// Route to replace an entire itinerary
app.post('/api/plan/places', async (req, res) => {
  const { placeId, name, address, category, notes } = req.body;
  
  if (!req.session.plan) {
    return res.status(400).json({ error: 'No active travel plan' });
  }
  
  if (!placeId || !name || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const place = {
    id: placeId,
    name,
    address,
    notes: notes || '',
    indoor: req.body.indoor || false,
    dayIndex: req.body.dayIndex !== undefined ? req.body.dayIndex : null,
    addedAt: new Date().toISOString()
  };
  
  let isDuplicate = false;
  
  // Add to appropriate category, but check for duplicates first
  if (category === 'attraction') {
    req.session.plan.attractions = req.session.plan.attractions || [];
    isDuplicate = req.session.plan.attractions.some(item => item.id === placeId);
    
    if (!isDuplicate) {
      req.session.plan.attractions.push(place);
    }
  } else if (category === 'restaurant') {
    req.session.plan.restaurants = req.session.plan.restaurants || [];
    isDuplicate = req.session.plan.restaurants.some(item => item.id === placeId);
    
    if (!isDuplicate) {
      req.session.plan.restaurants.push(place);
    }
  }
  
  if (isDuplicate) {
    return res.json({ 
      success: false, 
      duplicate: true,
      message: `This ${category} is already in your itinerary`
    });
  }
  
  // If user is authenticated, also update in DynamoDB
  if (req.session.user && req.session.user.sub && req.session.plan.itineraryId) {
    try {
      const userId = req.session.user.sub;
      const itineraryId = req.session.plan.itineraryId;
      
      await ItineraryModel.addPlaceToItinerary(userId, itineraryId, place, category);
    } catch (error) {
      console.error(`Error adding ${category} to DynamoDB:`, error);
      // Continue even if DB save fails - at least it's in the session
    }
  }
  
  res.json({ success: true, plan: req.session.plan });
});


// Authentication routes
const jwt = require('jsonwebtoken');

// Cognito token exchange endpoint
app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  try {
    // Exchange the authorization code for tokens
    const tokenResponse = await axios.post(
      `${process.env.COGNITO_DOMAIN}/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.COGNITO_CLIENT_ID,
        code,
        redirect_uri: process.env.COGNITO_REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${process.env.COGNITO_CLIENT_ID}:${process.env.COGNITO_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    const { id_token, access_token, refresh_token } = tokenResponse.data;
    
    // Decode the ID token to get user info
    const decodedToken = jwt.decode(id_token);
    
    // Store tokens in session
    req.session.tokens = {
      idToken: id_token,
      accessToken: access_token,
      refreshToken: refresh_token
    };
    
    req.session.user = {
      sub: decodedToken.sub,
      email: decodedToken.email,
      username: decodedToken['cognito:username'] || decodedToken.email
    };
    
    // Redirect to home page or other appropriate page
    res.redirect('/');
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});

// API endpoint to check if user is authenticated
app.get('/api/auth/user', (req, res) => {
  if (req.session.user) {
    // Return user info without sensitive data
    res.json({
      authenticated: true,
      user: {
        username: req.session.user.username,
        email: req.session.user.email
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// API endpoint for logout
app.get('/api/auth/logout', (req, res) => {
  // Clear session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    
    // Instead of redirecting to Cognito logout, just respond with success
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

//Weather related stuff
app.get('/api/weather', async (req, res) => {
  const city = req.query.city;
  const apiKey = process.env.WEATHER_API_KEY;

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`
    );

    const forecast = response.data.list.map(entry => ({
      datetime: entry.dt_txt,
      rainVolume: entry.rain?.['3h'] || 0,
      temp: entry.main.temp,
      weather: entry.weather[0].description.toLowerCase()
    }));

    const blockWeather = {};
    const blocks = {
      morning: [6, 12],
      afternoon: [12, 17],
      evening: [17, 22]
    };

    forecast.forEach(entry => {
      const [dateStr, timeStr] = entry.datetime.split(' ');
      const hour = parseInt(timeStr.split(':')[0]);

      for (const [block, [start, end]] of Object.entries(blocks)) {
        if (hour >= start && hour < end) {
          if (!blockWeather[dateStr]) blockWeather[dateStr] = {};
          if (!blockWeather[dateStr][block]) {
            blockWeather[dateStr][block] = {
              rainVolume: 0,
              weatherCount: {}
            };
          }

          blockWeather[dateStr][block].rainVolume += entry.rainVolume;

          const condition = entry.weather.includes('rain') ? 'rain'
            : entry.weather.includes('cloud') ? 'cloudy'
            : entry.weather.includes('clear') ? 'clear'
            : entry.weather.includes('storm') ? 'storm'
            : 'other';

          blockWeather[dateStr][block].weatherCount[condition] =
            (blockWeather[dateStr][block].weatherCount[condition] || 0) + 1;
        }
      }
    });

    const blockForecast = {};
    for (const [date, blocks] of Object.entries(blockWeather)) {
      blockForecast[date] = {};
      for (const [block, data] of Object.entries(blocks)) {
        const dominant = Object.entries(data.weatherCount)
          .reduce((a, b) => a[1] > b[1] ? a : b)[0];
        blockForecast[date][block] = dominant;
      }
    }

    // Old format (optional)
    const dailyWeather = {};
    const rainDays = [];

    for (const [date, blockMap] of Object.entries(blockForecast)) {
      const values = Object.values(blockMap);
      const summary = values.includes('rain') ? 'rain'
        : values.includes('storm') ? 'storm'
        : values.includes('cloudy') ? 'cloudy'
        : values.includes('clear') ? 'clear' : 'other';

      dailyWeather[date] = summary;
      if (values.includes('rain')) rainDays.push(date);
    }

    res.json({
      forecast,
      rainDays,
      dailyWeather,
      blockForecast // ✅ NEW: weather per time block per day
    });

  } catch (err) {
    console.error('Weather API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch weather forecast' });
  }
});






// Get current travel plan
app.get('/api/plan', async (req, res) => {
  // If user is authenticated, try to get plan from DynamoDB
  if (req.session.user && req.session.user.sub) {
    try {
      const userId = req.session.user.sub;
      const itinerary = await ItineraryModel.getItineraryByUserId(userId);
      
      if (itinerary) {
        // Store in session for future use
        req.session.plan = itinerary;
        return res.json({ plan: itinerary });
      }
    } catch (error) {
      console.error('Error fetching itinerary from DynamoDB:', error);
      // Fall back to session if DB fails
    }
  }
  
  // Return from session for non-authenticated users or as fallback
  res.json({ plan: req.session.plan || null });
});

// Add place to itinerary (attraction or restaurant)
app.post('/api/plan/places', async (req, res) => {
  const { placeId, name, address, category, notes } = req.body;
  
  if (!req.session.plan) {
    return res.status(400).json({ error: 'No active travel plan' });
  }
  
  if (!placeId || !name || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const place = {
    id: placeId,
    name,
    address,
    notes: notes || '',
    indoor: req.body.indoor || false,
    dayIndex: req.body.dayIndex !== undefined ? req.body.dayIndex : null,
    addedAt: new Date().toISOString()
  };
  
  
  let isDuplicate = false;
  
  // Add to appropriate category, but check for duplicates first
  if (category === 'attraction') {
    req.session.plan.attractions = req.session.plan.attractions || [];
    isDuplicate = req.session.plan.attractions.some(item => item.id === placeId);
    
    if (!isDuplicate) {
      req.session.plan.attractions.push(place);
    }
  } else if (category === 'restaurant') {
    req.session.plan.restaurants = req.session.plan.restaurants || [];
    isDuplicate = req.session.plan.restaurants.some(item => item.id === placeId);
    
    if (!isDuplicate) {
      req.session.plan.restaurants.push(place);
    }
  }
  
  if (isDuplicate) {
    return res.json({ 
      success: false, 
      duplicate: true,
      message: `This ${category} is already in your itinerary`
    });
  }
  
  // If user is authenticated, also update in DynamoDB
  if (req.session.user && req.session.user.sub && req.session.plan.itineraryId) {
    try {
      const userId = req.session.user.sub;
      const itineraryId = req.session.plan.itineraryId;
      
      await ItineraryModel.addPlaceToItinerary(userId, itineraryId, place, category);
    } catch (error) {
      console.error(`Error adding ${category} to DynamoDB:`, error);
      // Continue even if DB save fails - at least it's in the session
    }
  }
  
  res.json({ success: true, plan: req.session.plan });
});app.post('/api/plan/places', async (req, res) => {
  const { placeId, name, address, category, notes } = req.body;
  
  if (!req.session.plan) {
    return res.status(400).json({ error: 'No active travel plan' });
  }
  
  if (!placeId || !name || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const place = {
    id: placeId,
    name,
    address,
    notes: notes || '',
    addedAt: new Date().toISOString()
  };
  
  let isDuplicate = false;
  
  // Add to appropriate category in session, but check for duplicates first
  if (category === 'attraction') {
    req.session.plan.attractions = req.session.plan.attractions || [];
    isDuplicate = req.session.plan.attractions.some(item => item.id === placeId);
    
    if (!isDuplicate) {
      req.session.plan.attractions.push(place);
    }
  } else if (category === 'restaurant') {
    req.session.plan.restaurants = req.session.plan.restaurants || [];
    isDuplicate = req.session.plan.restaurants.some(item => item.id === placeId);
    
    if (!isDuplicate) {
      req.session.plan.restaurants.push(place);
    }
  }
  
  if (isDuplicate) {
    return res.json({ 
      success: false, 
      duplicate: true,
      message: `This ${category} is already in your itinerary`
    });
  }
  
  // If user is authenticated, also update in DynamoDB
  if (req.session.user && req.session.user.sub && req.session.plan.itineraryId) {
    try {
      const userId = req.session.user.sub;
      const itineraryId = req.session.plan.itineraryId;
      
      await ItineraryModel.addPlaceToItinerary(userId, itineraryId, place, category);
    } catch (error) {
      console.error(`Error adding ${category} to DynamoDB:`, error);
      // Continue even if DB save fails - at least it's in the session
    }
  }
  
  res.json({ success: true, plan: req.session.plan });
});

app.delete('/api/plan/places/:id', async (req, res) => {
  const { id } = req.params;
  const { category } = req.query;
  
  if (!req.session.plan) {
    return res.status(400).json({ error: 'No active travel plan' });
  }
  
  // Remove from session
  if (category === 'attraction') {
    req.session.plan.attractions = (req.session.plan.attractions || []).filter(place => place.id !== id);
  } else if (category === 'restaurant') {
    req.session.plan.restaurants = (req.session.plan.restaurants || []).filter(place => place.id !== id);
  }
  
  // If user is authenticated, also remove from DynamoDB
  if (req.session.user && req.session.user.sub && req.session.plan.itineraryId) {
    try {
      const userId = req.session.user.sub;
      const itineraryId = req.session.plan.itineraryId;
      
      await ItineraryModel.removePlaceFromItinerary(userId, itineraryId, id, category);
    } catch (error) {
      console.error(`Error removing ${category} from DynamoDB:`, error);
      // Continue even if DB operation fails - at least it's removed from the session
    }
  }
  
  res.json({ success: true, plan: req.session.plan });
});


app.post('/api/plan/migrate', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.sub;
    
    // Check if there's a plan in the session to migrate
    if (!req.session.plan || !req.session.plan.destination) {
      return res.json({ success: true, message: 'No plan to migrate' });
    }
    
    // Check if user already has an itinerary in DynamoDB
    const existingItinerary = await ItineraryModel.getItineraryByUserId(userId);
    
    if (!existingItinerary) {
      // Save the session plan to DynamoDB
      const savedItinerary = await ItineraryModel.saveItinerary(userId, req.session.plan);
      req.session.plan = savedItinerary;
      return res.json({ success: true, message: 'Plan migrated successfully' });
    } else {
      // User already has a plan in DB, merge if needed
      // For simplicity, we'll just keep the DB version
      req.session.plan = existingItinerary;
      return res.json({ success: true, message: 'Using existing plan from database' });
    }
  } catch (error) {
    console.error('Error migrating plan:', error);
    res.status(500).json({ success: false, error: 'Failed to migrate plan' });
  }
});

// Route to search for places using Places API v1 - with location bounds
app.get('/api/places', async (req, res) => {
  try {
    const { 
      keyword = '',
      type = 'attraction',  // attraction or restaurant
      location = ''
    } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    // First, geocode the location to get its bounding box
    const geocodingResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${API_KEY}`
    );

    if (geocodingResponse.data.status !== 'OK' || !geocodingResponse.data.results.length) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get the viewport boundaries for the location
    const { viewport } = geocodingResponse.data.results[0].geometry;
    
    // Build search query with explicit location mention
    let searchQuery = keyword;
    if (type === 'attraction') {
      searchQuery = keyword ? `${keyword} attractions in ${location}` : `attractions in ${location}`;
    } else if (type === 'restaurant') {
      searchQuery = keyword ? `${keyword} restaurants in ${location}` : `restaurants in ${location}`;
    }
    
    console.log(`Searching for "${searchQuery}" in location "${location}"...`);

    // Call the Places API v1 Text Search endpoint with locationBias
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: searchQuery,
        languageCode: "en",
        maxResultCount: 20,
        // Important: Use the viewport from geocoding to restrict results
        locationBias: {
          rectangle: {
            low: {
              latitude: viewport.southwest.lat,
              longitude: viewport.southwest.lng
            },
            high: {
              latitude: viewport.northeast.lat,
              longitude: viewport.northeast.lng
            }
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.location,places.types,places.photos'
        }
      }
    );

    // Transform the API response
    const transformedResults = response.data.places ? response.data.places.map(place => ({
      place_id: place.id,
      name: place.displayName?.text || 'Unknown Name',
      formatted_address: place.formattedAddress || 'Address not available',
      rating: place.rating,
      price_level: place.priceLevel ? parseInt(place.priceLevel.replace('PRICE_LEVEL_', '')) : undefined,
      geometry: {
        location: {
          lat: place.location?.latitude,
          lng: place.location?.longitude
        }
      },
      types: place.types || []
    })) : [];

    // Filter results by checking if they contain the location name in the address
    // This is an additional step to ensure we only get results from the specified location
    const filteredResults = transformedResults.filter(place => {
      const address = place.formatted_address.toLowerCase();
      return address.includes(location.toLowerCase());
    });

    res.json({
      status: "OK",
      results: filteredResults,
      query: searchQuery
    });
  } catch (error) {
    console.error('Error fetching places:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error message:', error.message);
    }
    
    res.status(error.response?.status || 500).json({
      status: "ERROR",
      error: error.response ? error.response.data : error.message
    });
  }
});

// Route to get details for a specific place by ID
app.get('/api/places/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Getting details for place ID: ${id}`);
    
    // Call the Google Place Details API v1
    const response = await axios.get(
      `https://places.googleapis.com/v1/places/${id}`,
      {
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,websiteUri,nationalPhoneNumber,priceLevel,regularOpeningHours,reviews,photos,editorialSummary'
        }
      }
    );
    
    // Transform the new API response
    const place = response.data;
    const transformedResult = {
      place_id: place.id,
      name: place.displayName?.text || 'Unknown Name',
      formatted_address: place.formattedAddress || 'Address not available',
      rating: place.rating,
      price_level: place.priceLevel ? parseInt(place.priceLevel.replace('PRICE_LEVEL_', '')) : undefined,
      formatted_phone_number: place.nationalPhoneNumber || '',
      website: place.websiteUri || '',
      opening_hours: place.regularOpeningHours ? {
        open_now: place.regularOpeningHours.openNow || false,
        weekday_text: place.regularOpeningHours.weekdayDescriptions || []
      } : undefined,
      reviews: place.reviews || [],
      photos: place.photos || [],
      description: place.editorialSummary?.text || ''
    };

    res.json({
      status: "OK",
      result: transformedResult
    });
  } catch (error) {
    console.error('Error fetching place details:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error message:', error.message);
    }
    
    res.status(error.response?.status || 500).json({
      status: "ERROR",
      error: error.response ? error.response.data : error.message
    });
  }
});

// Routes for serving HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/restaurants', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'restaurants.html'));
});

app.get('/attractions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'attractions.html'));
});

app.get('/itinerary', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'itinerary.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Travel Planner running on http://localhost:${PORT}`);
});