// models/itinerary.js
const docClient = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = 'OneClickPlannerItineraries';

const ItineraryModel = {
  // Create or update an itinerary
  async saveItinerary(userId, itineraryData) {
    const params = {
      TableName: TABLE_NAME,
      Item: {
        userId,
        itineraryId: itineraryData.itineraryId || uuidv4(),
        destination: itineraryData.destination,
        startDate: itineraryData.startDate,
        endDate: itineraryData.endDate,
        attractions: itineraryData.attractions || [],
        restaurants: itineraryData.restaurants || [],
        updatedAt: new Date().toISOString(),
        createdAt: itineraryData.createdAt || new Date().toISOString()
      }
    };

    try {
      await docClient.put(params).promise();
      return params.Item;
    } catch (error) {
      console.error('Error saving itinerary:', error);
      throw error;
    }
  },

  // Get an itinerary by userId
  async getItineraryByUserId(userId) {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    try {
      const result = await docClient.query(params).promise();
      // Return the most recently updated itinerary if multiple exist
      return result.Items.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0] || null;
    } catch (error) {
      console.error('Error getting itinerary:', error);
      throw error;
    }
  },

  // Add place to itinerary (attraction or restaurant)
  async addPlaceToItinerary(userId, itineraryId, place, category) {
    const placeToAdd = {
      id: place.id,
      name: place.name,
      address: place.address,
      notes: place.notes || '',
      addedAt: new Date().toISOString()
    };

    let updateExpression = '';
    let expressionAttributeValues = {
      ':updatedAt': new Date().toISOString()
    };
    
    if (category === 'attraction') {
      updateExpression = 'SET attractions = list_append(if_not_exists(attractions, :empty_list), :place), updatedAt = :updatedAt';
      expressionAttributeValues[':place'] = [placeToAdd];
      expressionAttributeValues[':empty_list'] = [];
    } else if (category === 'restaurant') {
      updateExpression = 'SET restaurants = list_append(if_not_exists(restaurants, :empty_list), :place), updatedAt = :updatedAt';
      expressionAttributeValues[':place'] = [placeToAdd];
      expressionAttributeValues[':empty_list'] = [];
    }

    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        itineraryId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    try {
      const result = await docClient.update(params).promise();
      return result.Attributes;
    } catch (error) {
      console.error('Error adding place to itinerary:', error);
      throw error;
    }
  },

  // Remove place from itinerary
  async removePlaceFromItinerary(userId, itineraryId, placeId, category) {
    // First, get the current itinerary
    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        itineraryId
      }
    };

    try {
      const result = await docClient.get(params).promise();
      if (!result.Item) {
        throw new Error('Itinerary not found');
      }
      
      const itinerary = result.Item;
      
      // Filter out the place to remove
      if (category === 'attraction' && itinerary.attractions) {
        itinerary.attractions = itinerary.attractions.filter(place => place.id !== placeId);
      } else if (category === 'restaurant' && itinerary.restaurants) {
        itinerary.restaurants = itinerary.restaurants.filter(place => place.id !== placeId);
      }
      
      // Update the itinerary
      itinerary.updatedAt = new Date().toISOString();
      
      const updateParams = {
        TableName: TABLE_NAME,
        Item: itinerary
      };
      
      await docClient.put(updateParams).promise();
      return itinerary;
    } catch (error) {
      console.error('Error removing place from itinerary:', error);
      throw error;
    }
  },

  // Delete an itinerary
  async deleteItinerary(userId, itineraryId) {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        itineraryId
      }
    };

    try {
      await docClient.delete(params).promise();
      return { success: true };
    } catch (error) {
      console.error('Error deleting itinerary:', error);
      throw error;
    }
  }
};

module.exports = ItineraryModel;