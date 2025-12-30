const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  friendName: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, default: Date.now },
  note: { type: String },
  type: { type: String, enum: ["lent", "borrowed"], default: "lent" },
  otherUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  borrowRequest: { type: mongoose.Schema.Types.ObjectId, ref: "BorrowRequest" },
  status: {
    type: String,
    enum: ["active", "pending_approval", "repaid"],
    default: "active",
  },
  repaymentDate: { type: Date },
});

module.exports = mongoose.model("Transaction", transactionSchema);
