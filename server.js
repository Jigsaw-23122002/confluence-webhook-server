const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const axios = require("axios");

const auth = Buffer.from(
  `${process.env.BOT_USERNAME}:${process.env.BOT_PASSWORD}`
).toString("base64");

const app = express();
const PORT = 3000;

function isLinkConfluence(url) {
  // Regular expression to match Confluence page URLs
  const confluenceRegex =
    /^https:\/\/[^\/]+\.atlassian\.net\/wiki\/spaces\/[^\/]+\/pages\/\d+\/[^\/]+$/;

  if (confluenceRegex.test(url)) {
    return true;
  } else {
    return false;
  }
}

function detectAndCategorizeLinks(pageCoontent) {
  // Regular expression to match <a> tags with href attributes
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

  const confluenceLinks = [];
  const nonConfluenceLinks = [];
  let match;

  // Loop through all matches of the regex in the body content
  while ((match = linkRegex.exec(pageCoontent)) !== null) {
    const href = match[1]; // The link URL
    const text = match[2]; // The link text

    // Check if the link is a Confluence link (contains .atlassian.net)
    if (isLinkConfluence(href)) {
      confluenceLinks.push({ href, text });
    } else {
      nonConfluenceLinks.push({ href, text });
    }
  }

  return { confluenceLinks, nonConfluenceLinks };
}

// Middleware to parse JSON payloads
app.use(bodyParser.json());

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

app.get("/scrape-space", async (req, res) => {
  try {
    const response = await axios.get(process.env.CONFLUENCE_SPACE_URL, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });
    var requiredResponse = [];

    for (var i = 0; i < response.data.results.length; i++) {
      if (response.data.results[i]?.body?.storage?.value) {
        const pageContent = response.data.results[i].body.storage.value;
        const childUrls = detectAndCategorizeLinks(pageContent);
        requiredResponse.push({ pageContent, childUrls });
      }
    }
    res.status(200).json(requiredResponse);
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
