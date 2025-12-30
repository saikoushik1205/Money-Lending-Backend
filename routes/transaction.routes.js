const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

// Create transaction (auth required)
router.post("/transactions", auth, async (req, res) => {
  try {
    const { friendName, amount, date, note } = req.body;
    if (!friendName || typeof amount === "undefined") {
      return res
        .status(400)
        .json({ message: "friendName and amount are required" });
    }
    if (amount <= 0)
      return res.status(400).json({ message: "Amount must be greater than 0" });

    const tx = new Transaction({
      user: new mongoose.Types.ObjectId(req.user.id),
      friendName,
      amount,
      date: date || undefined,
      note,
    });
    await tx.save();
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all transactions for user
router.get("/transactions", auth, async (req, res) => {
  try {
    const txs = await Transaction.find({ user: req.user.id }).sort({
      date: -1,
    });
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get transactions by friendName for user
router.get("/transactions/:friendName", auth, async (req, res) => {
  try {
    const friendName = req.params.friendName;
    const txs = await Transaction.find({ user: req.user.id, friendName }).sort({
      date: -1,
    });
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete transaction by id (only owner)
router.delete("/transactions/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });
    if (tx.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });
    await Transaction.findByIdAndDelete(id);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update transaction by id (only owner)
router.put("/transactions/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    const { friendName, amount, date, note } = req.body;

    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });
    if (tx.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    if (friendName) tx.friendName = friendName;
    if (amount !== undefined) {
      if (amount <= 0)
        return res
          .status(400)
          .json({ message: "Amount must be greater than 0" });
      tx.amount = amount;
    }
    if (date) tx.date = date;
    if (note !== undefined) tx.note = note;

    await tx.save();
    res.json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get lent money (money I lent to others)
router.get("/transactions/type/lent", auth, async (req, res) => {
  try {
    const txs = await Transaction.find({
      user: req.user.id,
      type: "lent",
    })
      .populate("otherUser", "name email")
      .sort({ date: -1 });
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get borrowed money (money I borrowed from others)
router.get("/transactions/type/borrowed", auth, async (req, res) => {
  try {
    const txs = await Transaction.find({
      user: req.user.id,
      type: "borrowed",
    })
      .populate("otherUser", "name email")
      .sort({ date: -1 });
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Friend summary aggregation
router.get("/friends/summary", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const summary = await Transaction.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$friendName", totalAmount: { $sum: "$amount" } } },
      { $project: { _id: 0, friendName: "$_id", totalAmount: 1 } },
      { $sort: { totalAmount: -1 } },
    ]);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
