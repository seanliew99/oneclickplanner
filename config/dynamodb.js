// config/dynamodb.js
const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK with credentials from environment variables
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN // Important for temporary credentials
});

// Create DynamoDB document client
const docClient = new AWS.DynamoDB.DocumentClient();

// Export the document client
module.exports = docClient;