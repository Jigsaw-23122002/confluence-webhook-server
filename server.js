const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const axios = require("axios");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cron = require("node-cron");

const uri = process.env.MONGO_DB_URL;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const auth = Buffer.from(
  `${process.env.BOT_USERNAME}:${process.env.BOT_PASSWORD}`
).toString("base64");
const app = express();
const PORT = 3000;

// Middleware to parse JSON payloads
app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

async function scrapeEditedPages() {
  try {
    const database = client.db("projectZPlus");
    const collection = database.collection("updated_pages");
    const updatedPages = await collection
      .find({
        edited_on: new Date().toISOString().split("T")[0],
      })
      .toArray();
    updatedPages.forEach(async (updatedPage) => {
      const page_url = updatedPage.url;
      const space_id = updatedPage.spaceId;
      const page_id = updatedPage.pageId;
      const baseUrlRegex = page_url.match(/^(https:\/\/[^/]+\/wiki)/)
        ? page_url.match(/^(https:\/\/[^/]+\/wiki)/)[1]
        : null;
      const response = await axios.get(
        `${baseUrlRegex}/rest/api/content/${page_id}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          params: {
            expand: "body.storage,version,space,history",
          },
        }
      );
      if (response.data.body?.storage?.value) {
        const database = client.db("projectZPlus");
        const collection = database.collection("warehoused_data");
        const exists = await collection.findOne({
          key: `${space_id}/${page_id}`,
        });
        if (exists) {
          const data = await collection.updateOne(
            {
              key: `${space_id}/${page_id}`,
            },
            {
              $set: { content: response.data.body.storage.value },
            }
          );
          console.log(data);
        } else {
          const data = await collection.insertOne({
            key: `${space_id}/${page_id}`,
            content: response.data.body.storage.value,
          });
          console.log(data);
        }
      }
    });
  } catch (error) {
    console.log(error);
  }
}

cron.schedule(
  "22 19 * * *",
  () => {
    console.log("Running cron job at 7:12 PM IST");
    scrapeEditedPages();
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata", // Ensures it runs in IST
  }
);

app.post("/webhook", async (req, res) => {
  try {
    const page_details = req.body;
    page_details["edited_on"] = new Date().toISOString().split("T")[0];

    console.log(page_details);
    const database = client.db("projectZPlus");
    const collection = database.collection("updated_pages");
    const exists = await collection.findOne(page_details);
    if (exists) {
      return res.status(400).json({
        status: "success",
        exists,
      });
    } else {
      const result = await collection.insertOne(page_details);
      return res.status(200).json({ status: "success", result });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
});

app.post("/on-board-confluence", async (req, res) => {
  try {
    const spaceUrl = req.body["space-url"];
    const spaceKey = spaceUrl.match(/\/spaces\/([^\/]+)\//)[1];
    const baseUrl = spaceUrl.match(/^https:\/\/[^\/]+\/wiki/)[0];

    const response = await axios.get(`${baseUrl}/rest/api/content`, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      params: {
        spaceKey,
        expand: "body.storage,version,space,history",
      },
    });
    const spaceDetails = response.data.results[0].space;

    const database = client.db("projectZPlus");
    const collection = database.collection("spaces");
    const document = {
      space_id: spaceDetails.id,
      space_key: spaceDetails.key,
      space_name: spaceDetails.name,
      space_url: spaceDetails._links.self,
      space_status: "scraping_initiated",
    };
    const exists = await collection.findOne(document);
    if (exists) {
      return res.status(400).json({
        status: "error",
        exists,
      });
    } else {
      const result = await collection.insertOne(document);
      return res.status(200).json({ status: "success", result });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
});

app.get("/get-on-boarded-spaces", async (req, res) => {
  try {
    const database = client.db("projectZPlus");
    const collection = database.collection("spaces");
    const data = await collection.find().toArray();
    console.log(data);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal Server Error" });
  }
});

app.get("/pages-edited-today", async (req, res) => {
  try {
    const database = client.db("projectZPlus");
    const collection = database.collection("updated_pages");
    const today = new Date().toISOString().split("T")[0];
    console.log(today);
    const data = await collection
      .find({
        edited_on: today,
      })
      .toArray();
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
