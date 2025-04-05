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
        country: itineraryData.country || '',
        attractions: itineraryData.attractions || [],
        restaurants: itineraryData.restaurants || [],
        hotels: itineraryData.hotels || [],        // Include hotels array
        flights: itineraryData.flights || [],      // Include flights array
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

  async addPlaceToItinerary(userId, itineraryId, place, category) {
    try {
      const docRef = doc(db, COLLECTION_NAME, itineraryId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Itinerary not found');
      }
      
      // Get the category array (attractions, restaurants, hotels, flights)
      const categoryField = `${category}s`; // e.g., "attractions", "flights"
      
      // Update just the specific array with the new place
      const updateData = {};
      updateData[categoryField] = arrayUnion(place);
      updateData.updatedAt = new Date().toISOString();
      
      await updateDoc(docRef, updateData);
      return { success: true };
    } catch (error) {
      console.error(`Error adding ${category} to itinerary:`, error);
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
      
      // Get the category array (attractions, restaurants, hotels, flights)
      const categoryArray = category + 's';
      
      // Filter out the place to remove if the array exists
      if (itinerary[categoryArray]) {
        itinerary[categoryArray] = itinerary[categoryArray].filter(place => place.id !== placeId);
      }
      
      // Update the itinerary
      itinerary.updatedAt = new Date().toISOString();
      
      await setDoc(docRef, itinerary);
      return itinerary;
    } catch (error) {
      console.error(`Error removing ${category} from itinerary:`, error);
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