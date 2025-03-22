// Travel Planner Server using Google Places API v1
const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

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
app.post('/api/plan', (req, res) => {
  const { destination, startDate, endDate } = req.body;
  
  if (!destination) {
    return res.status(400).json({ error: 'Destination is required' });
  }
  
  // Save plan to session
  req.session.plan = {
    destination,
    startDate,
    endDate,
    createdAt: new Date(),
    attractions: req.session.plan?.attractions || [],
    restaurants: req.session.plan?.restaurants || []
  };
  
  res.json({ success: true,  n: req.session.plan });
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

    // Send all entries (rainy or not)
    const forecast = response.data.list.map(entry => ({
      datetime: entry.dt_txt,
      rainVolume: entry.rain?.['3h'] || 0,
      temp: entry.main.temp,
      weather: entry.weather[0].description
    }));

    res.json({ city: response.data.city.name, forecast });
  } catch (err) {
    console.error('Weather API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch weather forecast' });
  }
});




// Get current travel plan
app.get('/api/plan', (req, res) => {
  res.json({ plan: req.session.plan || null });
});

// Add place to itinerary (attraction or restaurant)
app.post('/api/plan/places', (req, res) => {
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
    addedAt: new Date()
  };
  
  // Add to appropriate category
  if (category === 'attraction') {
    req.session.plan.attractions = req.session.plan.attractions || [];
    req.session.plan.attractions.push(place);
  } else if (category === 'restaurant') {
    req.session.plan.restaurants = req.session.plan.restaurants || [];
    req.session.plan.restaurants.push(place);
  }
  
  res.json({ success: true, plan: req.session.plan });
});

// Remove place from itinerary
app.delete('/api/plan/places/:id', (req, res) => {
  const { id } = req.params;
  const { category } = req.query;
  
  if (!req.session.plan) {
    return res.status(400).json({ error: 'No active travel plan' });
  }
  
  if (category === 'attraction') {
    req.session.plan.attractions = (req.session.plan.attractions || []).filter(place => place.id !== id);
  } else if (category === 'restaurant') {
    req.session.plan.restaurants = (req.session.plan.restaurants || []).filter(place => place.id !== id);
  }
  
  res.json({ success: true, plan: req.session.plan });
});

// Route to search for places using Places API v1
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
    
    let searchQuery = keyword;
    if (type === 'attraction') {
      searchQuery = keyword ? `${keyword} attractions in ${location}` : `attractions in ${location}`;
    } else if (type === 'restaurant') {
      searchQuery = keyword ? `${keyword} restaurants in ${location}` : `restaurants in ${location}`;
    }
    
    console.log(`Searching for "${searchQuery}"...`);

    // Call the Places API v1 Text Search endpoint
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: searchQuery,
        languageCode: "en",
        maxResultCount: 20
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

    res.json({
      status: "OK",
      results: transformedResults,
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