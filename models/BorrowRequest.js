const mongoose = require("mongoose");

const borrowRequestSchema = new mongoose.Schema({
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true, min: 0.01 },
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
});

module.exports = mongoose.model("BorrowRequest", borrowRequestSchema);
