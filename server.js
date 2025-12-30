const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();
const app = express();

// Connect DB
connectDB();

// Middleware
app.use(express.json());
app.use(cors({ origin: "http://localhost:4200" }));

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api", require("./routes/transaction.routes"));
app.use("/api", require("./routes/borrow.routes"));
app.use("/api", require("./routes/repayment.routes"));

app.get("/", (req, res) => res.send("Money Lending API"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
