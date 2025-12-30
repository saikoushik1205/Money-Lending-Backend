const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const RepaymentRequest = require("../models/RepaymentRequest");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

// Create repayment request (borrower marks as paid)
router.post("/repayments/request", auth, async (req, res) => {
  try {
    const { transactionId, note } = req.body;
    if (!transactionId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    if (transaction.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    if (transaction.type !== "borrowed") {
      return res
        .status(400)
        .json({
          message: "Can only request repayment for borrowed transactions",
        });
    }
    if (transaction.status === "repaid") {
      return res.status(400).json({ message: "Transaction already repaid" });
    }
    if (transaction.status === "pending_approval") {
      return res
        .status(400)
        .json({ message: "Repayment request already pending" });
    }

    // Create repayment request
    const repaymentRequest = new RepaymentRequest({
      transaction: transaction._id,
      borrower: new mongoose.Types.ObjectId(req.user.id),
      lender: transaction.otherUser,
      amount: transaction.amount,
      note: note || "Repayment completed",
    });
    await repaymentRequest.save();

    // Update transaction status
    transaction.status = "pending_approval";
    await transaction.save();

    const populated = await RepaymentRequest.findById(repaymentRequest._id)
      .populate("borrower", "name email")
      .populate("lender", "name email")
      .populate("transaction");

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get pending repayment requests for lender
router.get("/repayments/pending", auth, async (req, res) => {
  try {
    const requests = await RepaymentRequest.find({
      lender: req.user.id,
      status: "pending",
    })
      .populate("borrower", "name email")
      .populate("transaction")
      .sort({ requestDate: -1 });

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all repayment requests history
router.get("/repayments/history", auth, async (req, res) => {
  try {
    // Get requests where user is either borrower or lender
    const requests = await RepaymentRequest.find({
      $or: [{ borrower: req.user.id }, { lender: req.user.id }],
    })
      .populate("borrower", "name email")
      .populate("lender", "name email")
      .populate("transaction")
      .sort({ requestDate: -1 });

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Approve repayment request
router.put("/repayments/:id/approve", auth, async (req, res) => {
  try {
    const request = await RepaymentRequest.findById(req.params.id).populate(
      "transaction"
    );

    if (!request) {
      return res.status(404).json({ message: "Repayment request not found" });
    }
    if (request.lender.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    // Update repayment request
    request.status = "approved";
    request.responseDate = new Date();
    await request.save();

    // Update borrowed transaction
    const borrowedTransaction = await Transaction.findById(
      request.transaction._id
    );
    if (borrowedTransaction) {
      borrowedTransaction.status = "repaid";
      borrowedTransaction.repaymentDate = new Date();
      await borrowedTransaction.save();
    }

    // Find and update corresponding lent transaction
    const lentTransaction = await Transaction.findOne({
      user: req.user.id,
      otherUser: request.borrower,
      borrowRequest: borrowedTransaction.borrowRequest,
      type: "lent",
    });

    if (lentTransaction) {
      lentTransaction.status = "repaid";
      lentTransaction.repaymentDate = new Date();
      await lentTransaction.save();
    }

    const populated = await RepaymentRequest.findById(request._id)
      .populate("borrower", "name email")
      .populate("lender", "name email")
      .populate("transaction");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Reject repayment request
router.put("/repayments/:id/reject", auth, async (req, res) => {
  try {
    const request = await RepaymentRequest.findById(req.params.id).populate(
      "transaction"
    );

    if (!request) {
      return res.status(404).json({ message: "Repayment request not found" });
    }
    if (request.lender.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    // Update repayment request
    request.status = "rejected";
    request.responseDate = new Date();
    await request.save();

    // Update transaction back to active
    const transaction = await Transaction.findById(request.transaction._id);
    if (transaction) {
      transaction.status = "active";
      await transaction.save();
    }

    const populated = await RepaymentRequest.findById(request._id)
      .populate("borrower", "name email")
      .populate("lender", "name email")
      .populate("transaction");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
