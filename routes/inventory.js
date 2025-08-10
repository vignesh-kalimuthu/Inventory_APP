// routes/inventory.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { verifyToken, requireRole } = require("../midddleware/authMiddleware");

// Adjust stock (admin or manager only)
// routes/inventory.js (adjust-stock)
router.post(
  "/adjust-stock",
  verifyToken,
  requireRole("admin", "manager"),
  async (req, res) => {
    const { menu_item_id, edited, reason, note } = req.body;
    if (!menu_item_id || typeof edited !== "number")
      return res
        .status(400)
        .json({ error: "menu_item_id and edited (number) required" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // lock row
      const [rows] = await conn.query(
        "SELECT stock, min_stock FROM menu_items WHERE id = ? FOR UPDATE",
        [menu_item_id]
      );
      if (!rows.length) throw new Error("Menu item not found");
      const oldStock = rows[0].stock;
      const minStock = rows[0].min_stock || 0;
      const newStock = oldStock + edited;
      if (newStock < 0) throw new Error("Resulting stock cannot be negative");

      await conn.query("UPDATE menu_items SET stock = ? WHERE id = ?", [
        newStock,
        menu_item_id,
      ]);

      await conn.query(
        `INSERT INTO stock_movements (menu_item_id, user_id, edited, reason, note) VALUES (?, ?, ?, ?, ?)`,
        [menu_item_id, req.user.id, edited, reason || "Adjust", note || ""]
      );

      // if newStock <= minStock -> create alert (if not exists)
      if (newStock <= minStock) {
        const [existing] = await conn.query(
          "SELECT id FROM low_stock_alerts WHERE menu_item_id = ? AND is_resolved = 0",
          [menu_item_id]
        );
        if (existing.length === 0) {
          await conn.query(
            `INSERT INTO low_stock_alerts (menu_item_id, current_stock, min_stock, created_by, message)
             VALUES (?, ?, ?, ?, ?)`,
            [
              menu_item_id,
              newStock,
              minStock,
              req.user.id,
              `Manual adjust caused low stock (${newStock} <= ${minStock})`,
            ]
          );
        }
      } else {
        // if restocked above minStock -> mark existing alerts resolved
        await conn.query(
          "UPDATE low_stock_alerts SET is_resolved = 1 WHERE menu_item_id = ? AND is_resolved = 0",
          [menu_item_id]
        );
      }

      await conn.commit();
      res.json({ message: "Stock adjusted", menu_item_id, newStock });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: err.message || "Stock update failed" });
    } finally {
      conn.release();
    }
  }
);

module.exports = router;
