const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

// Middleware to parse JSON payloads
app.use(bodyParser.json());

// Webhook endpoint
app.post("/webhook", (req, res) => {
  const event = req.body;
  console.log("Received webhook event:", event);

  // Handle different events (page created, updated, deleted)
  if (event.eventType === "page_created") {
    console.log("Page created:", event.page.title);
  } else if (event.eventType === "page_updated") {
    console.log("Page updated:", event.page.title);
  } else if (event.eventType === "page_deleted") {
    console.log("Page deleted:", event.page.title);
  }

  res.status(200).send("Webhook received");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
