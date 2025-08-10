const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../midddleware/authMiddleware");

const router = express.Router();

/**
 * Create a new permission
 * Example: POST /permissions { "name": "view_reports" }
 */
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query("INSERT INTO permissions (name) VALUES (?)", [name]);
    res.json({ message: "Permission created successfully" });
  } catch (error) {
    console.error("Create permission error:", error);
    res.status(500).json({ error: "Failed to create permission" });
  }
});

/**
 * Assign a permission to a user
 * Example: POST /permissions/assign { "userId": 2, "permissionId": 1 }
 */
router.post("/assign", verifyToken, requireRole("admin"), async (req, res) => {
  const { userId, permissionId } = req.body;
  try {
    await pool.query(
      "INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (?, ?)",
      [userId, permissionId]
    );
    res.json({ message: "Permission assigned to user" });
  } catch (error) {
    console.error("Assign permission error:", error);
    res.status(500).json({ error: "Failed to assign permission" });
  }
});

/**
 * Remove a permission from a user
 */
router.post("/remove", verifyToken, requireRole("admin"), async (req, res) => {
  const { userId, permissionId } = req.body;
  try {
    await pool.query(
      "DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?",
      [userId, permissionId]
    );
    res.json({ message: "Permission removed from user" });
  } catch (error) {
    console.error("Remove permission error:", error);
    res.status(500).json({ error: "Failed to remove permission" });
  }
});

/**
 * Get all permissions for a user
 */
router.get("/user/:userId", verifyToken, async (req, res) => {
  const { userId } = req.params;
  try {
    const [permissions] = await pool.query(
      `
      SELECT p.id, p.name
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = ?
      `,
      [userId]
    );
    res.json(permissions);
  } catch (error) {
    console.error("Get user permissions error:", error);
    res.status(500).json({ error: "Failed to fetch user permissions" });
  }
});

module.exports = router;
