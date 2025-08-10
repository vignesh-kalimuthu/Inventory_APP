const express = require("express");
const { pool } = require("../config/db");
const { verifyToken, requireRole } = require("../midddleware/authMiddleware");
const router = express.Router();

// Low stock items (unresolved alerts) - admin/manager
router.get(
  "/low-stock",
  verifyToken,
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT a.id, a.menu_item_id, mi.name, a.current_stock, a.min_stock, a.message, a.created_at
       FROM low_stock_alerts a
       JOIN menu_items mi ON mi.id = a.menu_item_id
       WHERE a.is_resolved = 0
       ORDER BY a.created_at DESC`
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch low-stock alerts" });
    }
  }
);

// Stock movements - supports filters
router.get(
  "/stock-movements",
  verifyToken,
  requireRole("admin", "manager"),
  async (req, res) => {
    const { menu_item_id, limit = 100 } = req.query;
    try {
      let sql = `SELECT sm.*, u.name as user_name, mi.name as item_name
               FROM stock_movements sm
               LEFT JOIN users u ON u.id = sm.user_id
               LEFT JOIN menu_items mi ON mi.id = sm.menu_item_id
               WHERE 1=1`;
      const params = [];
      if (menu_item_id) {
        sql += " AND sm.menu_item_id = ?";
        params.push(menu_item_id);
      }
      sql += " ORDER BY sm.created_at DESC LIMIT ?";
      params.push(parseInt(limit, 10));
      const [rows] = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stock movements" });
    }
  }
);

module.exports = router;
