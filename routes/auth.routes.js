const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const QRCode = require("qrcode");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth.middleware");

dotenv.config();

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, upiId } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, phone, upiId });

    // Generate QR code if UPI ID provided
    if (upiId) {
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
        name
      )}&cu=INR`;
      const qrCode = await QRCode.toDataURL(upiUrl);
      user.qrCode = qrCode;
    }

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get user profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update UPI details
router.put("/profile/upi", authMiddleware, async (req, res) => {
  try {
    const { phone, upiId } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (phone) user.phone = phone;
    if (upiId) {
      user.upiId = upiId;
      // Regenerate QR code
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
        user.name
      )}&cu=INR`;
      const qrCode = await QRCode.toDataURL(upiUrl);
      user.qrCode = qrCode;
    }

    await user.save();
    const updatedUser = await User.findById(req.userId).select("-password");
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get user's QR code by ID
router.get("/user/:id/qr", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name phone upiId qrCode"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
