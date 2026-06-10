const mongoose = require("mongoose");

const repaymentRequestSchema = new mongoose.Schema({
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    required: true,
  },
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  requestDate: { type: Date, default: Date.now },
  responseDate: { type: Date },
  note: { type: String },
});

module.exports = mongoose.model("RepaymentRequest", repaymentRequestSchema);
