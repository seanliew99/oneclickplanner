// config/amadeus.js
// This file is for configuring the Amadeus API client. It initializes the client with the necessary credentials and exports it for use in other parts of the application.
const Amadeus = require('amadeus');
require('dotenv').config();

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  hostname: 'test'
});

module.exports = amadeus;