// routes/hotels.js
const express = require('express');
const router = express.Router();
const amadeus = require('./amadeus-api');
// Advanced error categorization and handling
const FATAL_ERROR_CODES = [
    1351,  // VERIFY CHAIN/REP CODE
    1257,  // INVALID PROPERTY CODE
    4070   // UNABLE TO PROCESS
  ];
  
  const IGNORABLE_ERROR_CODES = [
    3664,  // NO ROOMS AVAILABLE
    3289,  // RATE NOT AVAILABLE
    2827,  // HOTEL PROPERTY LOCKED
    10604  // INVALID OR MISSING DATA
  ];
  
  function categorizeHotelErrors(errors) {
    const fatalErrors = [];
    const ignorableErrors = [];
    const unmappedErrors = [];
  
    errors.forEach(error => {
      const code = error.code;
      const hotelIds = error.source?.parameter?.replace('hotelIds=', '').split(',') || [];
  
      if (FATAL_ERROR_CODES.includes(code)) {
        fatalErrors.push(...hotelIds);
      } else if (IGNORABLE_ERROR_CODES.includes(code)) {
        ignorableErrors.push(...hotelIds);
      } else {
        unmappedErrors.push(...hotelIds);
      }
    });
  
    return {
      fatalErrors: [...new Set(fatalErrors)],
      ignorableErrors: [...new Set(ignorableErrors)],
      unmappedErrors: [...new Set(unmappedErrors)]
    };
  }
  
  router.get('/search/city', async (req, res) => {
    try {
      const { cityCode, checkInDate, checkOutDate, adults = 1, ratings = [], priceRange } = req.query;
      
      if (!cityCode) {
        return res.status(400).json({ 
          error: 'Missing required parameter: cityCode is required.' 
        });
      }
      
      console.log(`Searching hotels in city: ${cityCode}`);
      
      // Get hotel list for the city
      const hotelListResponse = await amadeus.referenceData.locations.hotels.byCity.get({
        cityCode
      });
      
      console.log(`Found ${hotelListResponse.data.length} hotels in ${cityCode}`);
      
      // Extract hotel IDs
      let allHotelIds = hotelListResponse.data.map(hotel => hotel.hotelId);
      
      // Tracking failed and processed hotels
      const processedHotels = [];
      const failedHotels = {
        fatal: [],     // Permanent errors, should be completely removed
        temporary: [], // Errors that might be resolved on retry
        ignorable: []  // Soft errors like no rooms available
      };
      
      // Reduced batch size to minimize complete batch failures
      const BATCH_SIZE = 10; 
      
      // If search dates are provided, search for offers in batches
      if (checkInDate && checkOutDate) {
        console.log(`Searching offers for dates: ${checkInDate} to ${checkOutDate}`);
        
        // Process batches with more sophisticated error handling
        for (let i = 0; i < allHotelIds.length; i += BATCH_SIZE) {
          const batchHotelIds = allHotelIds.slice(i, i + BATCH_SIZE);
          
          try {
            const searchParams = {
              hotelIds: batchHotelIds.join(','),
              adults: parseInt(adults),
              checkInDate,
              checkOutDate
            };
            
            if (priceRange) {
              const [min, max] = priceRange.split('-');
              if (min) searchParams.priceRange = min;
              if (max) searchParams.priceRange += `-${max}`;
            }
            
            if (ratings && ratings.length > 0) {
              searchParams.ratings = ratings.join(',');
            }
            
            const batchOffersResponse = await amadeus.shopping.hotelOffersSearch.get(searchParams);
            
            // Add successful results
            if (batchOffersResponse.data && batchOffersResponse.data.length > 0) {
              processedHotels.push(...batchOffersResponse.data);
            }
          } catch (batchError) {
            // Sophisticated error handling
            if (batchError.response && batchError.response.result && batchError.response.result.errors) {
              const { 
                fatalErrors, 
                ignorableErrors, 
                unmappedErrors 
              } = categorizeHotelErrors(batchError.response.result.errors);
              
              // Log and categorize errors
              console.warn('Batch processing errors:', {
                fatalErrors,
                ignorableErrors,
                unmappedErrors
              });
              
              // Update failed hotels tracking
              failedHotels.fatal.push(...fatalErrors);
              failedHotels.ignorable.push(...ignorableErrors);
              failedHotels.temporary.push(...unmappedErrors);
            } else {
              // Unexpected error format
              console.error('Unexpected batch error:', batchError);
            }
          }
        }
        
        // Combine hotel data with offers
        const hotels = processedHotels.map(hotelOffer => {
          const hotel = hotelListResponse.data.find(h => h.hotelId === hotelOffer.hotel.hotelId);
          return {
            ...hotelOffer,
            hotel: {
              ...hotelOffer.hotel,
              address: hotel?.address || hotelOffer.hotel.address,
              latitude: hotel?.geoCode?.latitude || null,
              longitude: hotel?.geoCode?.longitude || null,
              cityName: hotel?.address?.cityName || cityCode
            }
          };
        });
        
        return res.json({
          status: 'OK',
          results: hotels,
          meta: {
            count: hotels.length,
            cityCode,
            failedHotels: {
              fatal: failedHotels.fatal,
              temporary: failedHotels.temporary,
              ignorable: failedHotels.ignorable
            }
          }
        });
      } else {
        // If no dates provided, just return the hotel list
        return res.json({
          status: 'OK',
          results: hotelListResponse.data,
          meta: {
            count: hotelListResponse.data.length,
            cityCode
          }
        });
      }
    } catch (error) {
      console.error('Error searching hotels by city:', error);
      
      // Handle Amadeus API errors
      const status = error.response?.statusCode || 500;
      const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while searching for hotels';
      
      res.status(status).json({
        status: 'ERROR',
        error: message
      });
    }
  });

// Search hotels by coordinates
router.get('/search/geo', async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      radius = 5, 
      checkInDate, 
      checkOutDate, 
      adults = 1,
      ratings = [],
      priceRange
    } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required parameters: latitude and longitude are required.' 
      });
    }
    
    console.log(`Searching hotels near coordinates: ${latitude}, ${longitude}`);
    
    // First, get hotel list for the coordinates
    const hotelListResponse = await amadeus.referenceData.locations.hotels.byGeocode.get({
      latitude,
      longitude,
      radius
    });
    
    console.log(`Found ${hotelListResponse.data.length} hotels near coordinates`);
    
    // Extract hotel IDs
    const hotelIds = hotelListResponse.data.map(hotel => hotel.hotelId).join(',');
    
    // If search dates are provided, search for offers
    if (checkInDate && checkOutDate) {
      console.log(`Searching offers for dates: ${checkInDate} to ${checkOutDate}`);
      
      // Build search parameters
      const searchParams = {
        hotelIds,
        adults: parseInt(adults),
        checkInDate,
        checkOutDate
      };
      
      // Add optional parameters
      if (priceRange) {
        const [min, max] = priceRange.split('-');
        if (min) searchParams.priceRange = min;
        if (max) searchParams.priceRange += `-${max}`;
      }
      
      if (ratings && ratings.length > 0) {
        searchParams.ratings = ratings.join(',');
      }
      
      // Search for offers based on hotel IDs
      const offersResponse = await amadeus.shopping.hotelOffersSearch.get(searchParams);
      
      // Combine hotel data with offers
      const hotels = offersResponse.data.map(hotelOffer => {
        const hotel = hotelListResponse.data.find(h => h.hotelId === hotelOffer.hotel.hotelId);
        return {
          ...hotelOffer,
          hotel: {
            ...hotelOffer.hotel,
            // Add additional details from the hotel list response
            address: hotel?.address || hotelOffer.hotel.address,
            latitude: hotel?.geoCode?.latitude || latitude,
            longitude: hotel?.geoCode?.longitude || longitude
          }
        };
      });
      
      return res.json({
        status: 'OK',
        results: hotels,
        meta: {
          count: hotels.length,
          coordinates: { latitude, longitude }
        }
      });
    } else {
      // If no dates provided, just return the hotel list
      return res.json({
        status: 'OK',
        results: hotelListResponse.data,
        meta: {
          count: hotelListResponse.data.length,
          coordinates: { latitude, longitude }
        }
      });
    }
  } catch (error) {
    console.error('Error searching hotels by coordinates:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while searching for hotels';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

// Search for hotels by keyword
router.get('/locations/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword || keyword.length < 2) {
      return res.status(400).json({ error: 'Keyword parameter must be at least 2 characters' });
    }
    
    console.log(`Searching hotel locations for keyword: "${keyword}"`);
    
    const response = await amadeus.referenceData.locations.hotel.get({
      keyword,
      subType: 'HOTEL_GDS'
    });
    
    console.log(`Found ${response.data.length} hotel locations`);
    
    res.json({
      status: 'OK',
      results: response.data
    });
  } catch (error) {
    console.error('Error searching hotel locations:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while searching for hotel locations';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

// Get hotel offer details
router.get('/offers/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    if (!offerId) {
      return res.status(400).json({ error: 'Offer ID is required' });
    }
    
    console.log(`Getting details for offer ID: ${offerId}`);
    
    const response = await amadeus.shopping.hotelOfferSearch(offerId).get();
    
    res.json({
      status: 'OK',
      result: response.data
    });
  } catch (error) {
    console.error('Error fetching hotel offer details:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while fetching hotel offer details';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

// Search for specific hotel offers
router.get('/offers', async (req, res) => {
  try {
    const {
      hotelIds,
      checkInDate,
      checkOutDate,
      adults = 1,
      roomQuantity = 1,
      priceRange,
      currency = 'USD',
      boardType,
      includeClosed = false
    } = req.query;
    
    if (!hotelIds) {
      return res.status(400).json({ error: 'Hotel IDs are required' });
    }
    
    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'Check-in and check-out dates are required' });
    }
    
    console.log(`Searching for offers for hotels: ${hotelIds}`);
    
    // Build search parameters
    const searchParams = {
      hotelIds,
      adults: parseInt(adults),
      checkInDate,
      checkOutDate,
      roomQuantity: parseInt(roomQuantity),
      currency,
      includeClosed: includeClosed === 'true'
    };
    
    // Add optional parameters
    if (priceRange) {
      searchParams.priceRange = priceRange;
    }
    
    if (boardType) {
      searchParams.boardType = boardType;
    }
    
    const response = await amadeus.shopping.hotelOffersSearch.get(searchParams);
    
    res.json({
      status: 'OK',
      results: response.data,
      meta: {
        count: response.data.length
      }
    });
  } catch (error) {
    console.error('Error searching hotel offers:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while searching for hotel offers';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

// Get hotel reviews and sentiments
router.get('/reviews/:hotelId', async (req, res) => {
  try {
    const { hotelId } = req.params;
    
    if (!hotelId) {
      return res.status(400).json({ error: 'Hotel ID is required' });
    }
    
    console.log(`Getting reviews for hotel ID: ${hotelId}`);
    
    const response = await amadeus.eReputation.hotelSentiments.get({
      hotelIds: hotelId
    });
    
    res.json({
      status: 'OK',
      result: response.data
    });
  } catch (error) {
    console.error('Error fetching hotel reviews:', error);
    
    // Handle Amadeus API errors
    const status = error.response?.statusCode || 500;
    const message = error.response?.result?.errors?.[0]?.detail || error.message || 'An error occurred while fetching hotel reviews';
    
    res.status(status).json({
      status: 'ERROR',
      error: message
    });
  }
});

module.exports = router;