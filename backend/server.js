// A simple, deployable backend server using Node.js and Express.
// This server is designed to receive and process push notifications from Google Cloud Pub/Sub.

const express = require('express');
const app = express();

// Middleware to parse JSON bodies. Pub/Sub sends messages as JSON.
// The 1mb limit is a safe default for Pub/Sub messages.
app.use(express.json({ limit: '1mb' }));

// The primary endpoint that Pub/Sub will push messages to.
// It must be a POST endpoint to receive the message data in the request body.
app.post('/', (req, res) => {
  console.log('Notification received from Pub/Sub.');

  // Pub/Sub messages are wrapped in a standard format.
  // The actual message you send is Base64 encoded in `message.data`.
  if (!req.body || !req.body.message) {
    console.error('Received an invalid Pub/Sub message format.');
    // It's important to send a success status code (2xx) to Pub/Sub,
    // otherwise it will keep trying to redeliver the message.
    return res.status(204).send(); // 204 No Content is a good choice.
  }

  const pubSubMessage = req.body.message;

  try {
    // The actual data is a base64-encoded string. We need to decode it to see the content.
    const messageData = pubSubMessage.data
      ? Buffer.from(pubSubMessage.data, 'base64').toString().trim()
      : 'No data in message.';
    
    console.log('Decoded Message Data:', messageData);

    // ========================================================================
    // TODO: YOUR CUSTOM LOGIC GOES HERE
    // ========================================================================
    // For example, you would:
    // 1. Parse `messageData` if it's JSON.
    // 2. Use the Firebase Admin SDK to send a push notification to a user.
    // 3. Or, you might store this information in a database.
    //
    // For now, we are just logging it to show that the system works.
    // ========================================================================


    // Acknowledge the message by sending a success response.
    // If you don't send a 2xx status, Pub/Sub will assume the delivery failed
    // and will retry, causing duplicate processing.
    res.status(200).send('Notification processed successfully.');

  } catch (error) {
    console.error('Error processing Pub/Sub message:', error);
    // Even in case of an error, we should send a success status to avoid retries
    // for a message that is fundamentally broken and cannot be processed.
    // You might want to add more sophisticated error handling here, like sending
    // un-processable messages to a "dead-letter queue".
    res.status(200).send('Acknowledged with error.');
  }
});

// Cloud Run provides a PORT environment variable that your service should listen on.
// The default is 8080.
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
