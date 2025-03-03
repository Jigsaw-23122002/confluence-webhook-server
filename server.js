const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const axios = require("axios");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

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
