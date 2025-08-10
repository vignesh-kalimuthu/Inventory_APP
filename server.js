const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const reportsRoutes = require("./routes/reports");
const menuRoutes = require("./routes/menuRoutes");

require("dotenv").config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS db FROM users");
    res.json(rows[0]);
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: "Database connection failed" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/reports", reportsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
