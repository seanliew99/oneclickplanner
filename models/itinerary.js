// models/itinerary.js
const { db } = require('../config/firebase');
const { 
  collection, doc, setDoc, getDoc, getDocs, 
  query, where, updateDoc, deleteDoc, arrayUnion
} = require('firebase/firestore');
const { v4: uuidv4 } = require('uuid');

const COLLECTION_NAME = 'itineraries';

const ItineraryModel = {
  // Create or update an itinerary
  async saveItinerary(userId, itineraryData) {
    try {
      const itineraryId = itineraryData.itineraryId || uuidv4();
      const docRef = doc(db, COLLECTION_NAME, itineraryId);
      
      const itinerary = {
        userId,
        itineraryId,
        destination: itineraryData.destination,
        startDate: itineraryData.startDate,
        endDate: itineraryData.endDate,
        attractions: itineraryData.attractions || [],
        restaurants: itineraryData.restaurants || [],
        updatedAt: new Date().toISOString(),
        createdAt: itineraryData.createdAt || new Date().toISOString()
      };
      
      await setDoc(docRef, itinerary);
      return itinerary;
    } catch (error) {
      console.error('Error saving itinerary:', error);
      throw error;
    }
  },

  // Get an itinerary by userId
  async getItineraryByUserId(userId) {
    try {
      const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      // Convert to array and sort by updatedAt
      const itineraries = [];
      querySnapshot.forEach(doc => {
        itineraries.push(doc.data());
      });
      
      // Return the most recently updated itinerary
      return itineraries.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
    } catch (error) {
      console.error('Error getting itinerary:', error);
      throw error;
    }
  },

  // Add place to itinerary (attraction or restaurant)
  async addPlaceToItinerary(userId, itineraryId, place, category) {
    try {
      const docRef = doc(db, COLLECTION_NAME, itineraryId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Itinerary not found');
      }
      
      // Include dayIndex and indoor properties if they exist
      const placeToAdd = {
        id: place.id,
        name: place.name,
        address: place.address,
        notes: place.notes || '',
        indoor: place.indoor || false,
        dayIndex: place.dayIndex !== undefined ? place.dayIndex : null,
        addedAt: new Date().toISOString()
      };
      
      // Get the current itinerary data
      const itineraryData = docSnap.data();
      
      // Check if we need to update the attractions or restaurants array
      if (category === 'attraction') {
        // Initialize attractions array if it doesn't exist
        if (!itineraryData.attractions) {
          itineraryData.attractions = [];
        }
        
        // Add the new place
        itineraryData.attractions.push(placeToAdd);
        
        // Update the document
        await setDoc(docRef, {
          ...itineraryData,
          attractions: itineraryData.attractions,
          updatedAt: new Date().toISOString()
        });
      } else if (category === 'restaurant') {
        // Initialize restaurants array if it doesn't exist
        if (!itineraryData.restaurants) {
          itineraryData.restaurants = [];
        }
        
        // Add the new place
        itineraryData.restaurants.push(placeToAdd);
        
        // Update the document
        await setDoc(docRef, {
          ...itineraryData,
          restaurants: itineraryData.restaurants,
          updatedAt: new Date().toISOString()
        });
      }
      
      // Get the updated document
      const updatedDoc = await getDoc(docRef);
      return updatedDoc.data();
    } catch (error) {
      console.error('Error adding place to itinerary:', error);
      throw error;
    }
  },

  // Remove place from itinerary
  async removePlaceFromItinerary(userId, itineraryId, placeId, category) {
    try {
      const docRef = doc(db, COLLECTION_NAME, itineraryId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Itinerary not found');
      }
      
      const itinerary = docSnap.data();
      
      // Filter out the place to remove
      if (category === 'attraction' && itinerary.attractions) {
        itinerary.attractions = itinerary.attractions.filter(place => place.id !== placeId);
      } else if (category === 'restaurant' && itinerary.restaurants) {
        itinerary.restaurants = itinerary.restaurants.filter(place => place.id !== placeId);
      }
      
      // Update the itinerary
      itinerary.updatedAt = new Date().toISOString();
      
      await setDoc(docRef, itinerary);
      return itinerary;
    } catch (error) {
      console.error('Error removing place from itinerary:', error);
      throw error;
    }
  },

  // Delete an itinerary
  async deleteItinerary(userId, itineraryId) {
    try {
      const docRef = doc(db, COLLECTION_NAME, itineraryId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting itinerary:', error);
      throw error;
    }
  }
};

module.exports = ItineraryModel;