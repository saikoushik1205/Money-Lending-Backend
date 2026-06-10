const mongoose = require("mongoose");
const dns = require("dns");
require("dotenv").config();

const configureMongoDns = () => {
  if (!process.env.MONGO_DNS_SERVERS) return;

  const servers = process.env.MONGO_DNS_SERVERS.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length) {
    dns.setServers(servers);
  }
};

const connectDB = async () => {
  try {
    configureMongoDns();
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
