const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const BorrowRequest = require("../models/BorrowRequest");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const mongoose = require("mongoose");

// Search users by name or email
router.get("/users/search", auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res
        .status(400)
        .json({ message: "Search query must be at least 2 characters" });
    }

    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    })
      .select("name email")
      .limit(10);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all users with their lending status
router.get("/users/all", auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select("name email")
      .lean();

    // Calculate lending capacity for each user
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        // Get total lent by this user
        const lentTransactions = await Transaction.find({
          user: req.user.id,
          otherUser: user._id,
          type: "lent",
          status: { $in: ["active", "pending_approval"] },
        });
        const totalLent = lentTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0
        );

        // Get total borrowed by this user
        const borrowedTransactions = await Transaction.find({
          user: user._id,
          type: "borrowed",
          status: { $in: ["active", "pending_approval"] },
        });
        const totalBorrowed = borrowedTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0
        );

        // Check if user has lent money (is a lender)
        const hasLentMoney = await Transaction.exists({
          user: user._id,
          type: "lent",
        });

        // User is likely a lender if they have lent money and borrowed less than they lent
        const isLender =
          hasLentMoney || totalBorrowed === 0 || totalLent > totalBorrowed;

        return {
          ...user,
          isLender,
          totalBorrowed,
          totalLent,
        };
      })
    );

    res.json(usersWithStatus);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create borrow request
router.post("/borrow-requests", auth, async (req, res) => {
  try {
    const { lenderId, amount, reason } = req.body;
    if (!lenderId || !amount || !reason) {
      return res
        .status(400)
        .json({ message: "Lender, amount and reason are required" });
    }
    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }
    if (lenderId === req.user.id) {
      return res.status(400).json({ message: "Cannot borrow from yourself" });
    }

    const borrowRequest = new BorrowRequest({
      borrower: new mongoose.Types.ObjectId(req.user.id),
      lender: new mongoose.Types.ObjectId(lenderId),
      amount,
      reason,
    });
    await borrowRequest.save();

    const populated = await BorrowRequest.findById(borrowRequest._id)
      .populate("borrower", "name email")
      .populate("lender", "name email");

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get borrow requests sent by user (as borrower)
router.get("/borrow-requests/sent", auth, async (req, res) => {
  try {
    const requests = await BorrowRequest.find({ borrower: req.user.id })
      .populate("lender", "name email")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get borrow requests received by user (as lender)
router.get("/borrow-requests/received", auth, async (req, res) => {
  try {
    const requests = await BorrowRequest.find({ lender: req.user.id })
      .populate("borrower", "name email")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Accept borrow request
router.put("/borrow-requests/:id/accept", auth, async (req, res) => {
  try {
    const request = await BorrowRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    if (request.lender.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    request.status = "accepted";
    request.respondedAt = new Date();
    await request.save();

    // Create transaction for lender (lent money)
    const lenderTransaction = new Transaction({
      user: new mongoose.Types.ObjectId(req.user.id),
      friendName: (await User.findById(request.borrower)).name,
      amount: request.amount,
      type: "lent",
      otherUser: request.borrower,
      borrowRequest: request._id,
      note: `Accepted borrow request: ${request.reason}`,
    });
    await lenderTransaction.save();

    // Create transaction for borrower (borrowed money)
    const borrowerTransaction = new Transaction({
      user: request.borrower,
      friendName: (await User.findById(req.user.id)).name,
      amount: request.amount,
      type: "borrowed",
      otherUser: new mongoose.Types.ObjectId(req.user.id),
      borrowRequest: request._id,
      note: `Borrow request accepted: ${request.reason}`,
    });
    await borrowerTransaction.save();

    const populated = await BorrowRequest.findById(request._id)
      .populate("borrower", "name email")
      .populate("lender", "name email");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Reject borrow request
router.put("/borrow-requests/:id/reject", auth, async (req, res) => {
  try {
    const request = await BorrowRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    if (request.lender.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    request.status = "rejected";
    request.respondedAt = new Date();
    await request.save();

    const populated = await BorrowRequest.findById(request._id)
      .populate("borrower", "name email")
      .populate("lender", "name email");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
