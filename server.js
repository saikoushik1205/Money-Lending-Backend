const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();
const app = express();

// Connect DB
connectDB();

// Security middleware
app.use(helmet());

// CORS - Allow local frontend origins
const allowedOrigins = [
  "http://localhost:4200",
  "http://localhost:4300",
  "https://your-app.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// Body parser with size limit
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api", require("./routes/transaction.routes"));
app.use("/api", require("./routes/borrow.routes"));
app.use("/api", require("./routes/repayment.routes"));

// Health check
app.get("/", (req, res) =>
  res.json({ status: "Money Lending API is running", timestamp: new Date() }),
);
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
