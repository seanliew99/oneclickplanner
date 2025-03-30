// routes/flights.js
const express = require('express');
const router = express.Router();
const amadeus = require('./amadeus-api');

// Search flights
router.get('/search', async (req, res) => {
  try {
    const {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      returnDate,
      adults = '1',
      travelClass = 'ECONOMY',
      nonStop = 'false',
      currencyCode = 'USD',
      max = 20
    } = req.query;
    
    // Validate required parameters
    if (!originLocationCode || !destinationLocationCode || !departureDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters: originLocationCode, destinationLocationCode, and departureDate are required.' 
      });
    }

    // Build search parameters
    const searchParams = {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      adults,
      currencyCode,
      max
    };

    // Add optional parameters if provided
    if (returnDate) searchParams.returnDate = returnDate;
    if (travelClass) searchParams.travelClass = travelClass;
    if (nonStop === 'true') searchParams.nonStop = true;

    // Call Amadeus Flight Offers Search API
    const response = await amadeus.shopping.flightOffersSearch.get(searchParams);
    
    // Transform the response
    const flights = response.data.map(flight => {
      // Extract important details for each flight
      return {
        id: flight.id,
        price: {
          total: flight.price.total,
          currency: flight.price.currency
        },
        itineraries: flight.itineraries.map(itinerary => ({
          duration: itinerary.duration,
          segments: itinerary.segments.map(segment => ({
            departure: {
              iataCode: segment.departure.iataCode,
              terminal: segment.departure.terminal,
              at: segment.departure.at
            },
            arrival: {
              iataCode: segment.arrival.iataCode,
              terminal: segment.arrival.terminal,
              at: segment.arrival.at
            },
            carrierCode: segment.carrierCode,
            number: segment.number,
            aircraft: segment.aircraft,
            duration: segment.duration,
            numberOfStops: segment.numberOfStops
          }))
        })),
        numberOfBookableSeats: flight.numberOfBookableSeats,
        travelerPricings: flight.travelerPricings
      };
    });

    res.json({
      status: 'OK',
      results: flights,
      meta: {
        count: flights.length,
        currency: currencyCode
      }
    });
  } catch (error) {
    console.error('Error searching flights:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while searching for flights';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

// Get flight details by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Call Amadeus Flight Offers Search API with ID
    const response = await amadeus.shopping.flightOffers.get({ id });
    
    res.json({
      status: 'OK',
      result: response.data
    });
  } catch (error) {
    console.error('Error fetching flight details:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while fetching flight details';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

// Search for airport locations
router.get('/locations/search', async (req, res) => {
    try {
      // Only use valid subType values according to Amadeus API
      const { keyword, subType = 'AIRPORT,CITY' } = req.query;
      
      if (!keyword) {
        return res.status(400).json({ error: 'Keyword parameter is required' });
      }
      
      console.log(`Searching locations for keyword: "${keyword}" with subType: "${subType}"`);
      
      const response = await amadeus.referenceData.locations.get({
        keyword,
        subType,
        // No need for page limit if not supported by API
      });
      
      console.log(`Found ${response.data.length} locations`);
      
      res.json({
        status: 'OK',
        results: response.data
      });
    } catch (error) {
      console.error('Error searching locations:', error);
      
      // Handle Amadeus API errors
      const status = error.response?.statusCode || 500;
      const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while searching for locations';
      
      res.status(status).json({
        status: 'ERROR',
        error: message
      });
    }
  });

// Flight prices analysis
router.get('/prices/analysis', async (req, res) => {
  try {
    const { 
      originIataCode, 
      destinationIataCode, 
      departureDate,
      currencyCode = 'USD'
    } = req.query;
    
    if (!originIataCode || !destinationIataCode || !departureDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters: originIataCode, destinationIataCode, and departureDate are required.' 
      });
    }
    
    const response = await amadeus.analytics.itineraryPriceMetrics.get({
      originIataCode,
      destinationIataCode,
      departureDate,
      currencyCode
    });
    
    res.json({
      status: 'OK',
      results: response.data
    });
  } catch (error) {
    console.error('Error analyzing flight prices:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while analyzing flight prices';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

// Flight pricing
router.post('/pricing', async (req, res) => {
  try {
    const flightOffers = req.body.flightOffers;
    
    if (!flightOffers || !Array.isArray(flightOffers) || flightOffers.length === 0) {
      return res.status(400).json({ error: 'Valid flightOffers are required in the request body' });
    }
    
    const response = await amadeus.shopping.flightOffers.pricing.post(
      {
        'data': {
          'type': 'flight-offers-pricing',
          'flightOffers': flightOffers
        }
      }
    );
    
    res.json({
      status: 'OK',
      result: response.data
    });
  } catch (error) {
    console.error('Error pricing flights:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while pricing flights';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

module.exports = router;