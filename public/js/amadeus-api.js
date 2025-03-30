// config/amadeus.js
const Amadeus = require('amadeus');
require('dotenv').config();

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  hostname: 'test'
});

module.exports = amadeus;