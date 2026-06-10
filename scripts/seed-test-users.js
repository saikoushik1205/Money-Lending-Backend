const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const dns = require("dns");
const mongoose = require("mongoose");
const QRCode = require("qrcode");

const User = require("../models/User");

dotenv.config();

const password = "Test@12345";

const testUsers = [
  {
    name: "Test Lender",
    email: "lender@test.com",
    phone: "9876543210",
    upiId: "testlender@upi",
  },
  {
    name: "Test Borrower",
    email: "borrower@test.com",
    phone: "9876543211",
    upiId: "testborrower@upi",
  },
];

function configureMongoDns() {
  if (!process.env.MONGO_DNS_SERVERS) return;

  const servers = process.env.MONGO_DNS_SERVERS.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length) {
    dns.setServers(servers);
  }
}

async function buildQrCode(user) {
  const upiUrl = `upi://pay?pa=${user.upiId}&pn=${encodeURIComponent(
    user.name
  )}&cu=INR`;

  return QRCode.toDataURL(upiUrl);
}

async function upsertTestUser(userData, hashedPassword) {
  const qrCode = await buildQrCode(userData);

  await User.findOneAndUpdate(
    { email: userData.email },
    {
      ...userData,
      password: hashedPassword,
      qrCode,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function seedTestUsers() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required. Add it to backend/.env first.");
  }

  configureMongoDns();
  await mongoose.connect(process.env.MONGO_URI);

  const hashedPassword = await bcrypt.hash(password, 10);

  for (const user of testUsers) {
    await upsertTestUser(user, hashedPassword);
  }

  console.log("Test users are ready:");
  for (const user of testUsers) {
    console.log(`- ${user.email} / ${password}`);
  }
}

seedTestUsers()
  .catch((error) => {
    console.error("Failed to seed test users:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
