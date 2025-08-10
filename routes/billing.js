// routes/billing.js (excerpt)
const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { verifyToken, requireRole } = require("../midddleware/authMiddleware");

router.post(
  "/create-bill",
  verifyToken,
  requireRole("cashier", "manager", "admin"),
  async (req, res) => {
    const { items } = req.body; // [{ menu_item_id, quantity, price }]
    if (!items || !items.length)
      return res.status(400).json({ error: "No items provided" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // create bill
      const total_amount = items.reduce(
        (sum, i) => sum + i.quantity * i.price,
        0
      );
      const [billResult] = await conn.query(
        "INSERT INTO bills (user_id, total_amount) VALUES (?, ?)",
        [req.user.id, total_amount]
      );
      const bill_id = billResult.insertId;

      for (const item of items) {
        // 1) add bill_items
        await conn.query(
          `INSERT INTO bill_items (bill_id, menu_item_id, quantity, price)
           VALUES (?, ?, ?, ?)`,
          [bill_id, item.menu_item_id, item.quantity, item.price]
        );

        // 2) lock the menu_item row for safe read/modify
        const [rows] = await conn.query(
          "SELECT stock, min_stock FROM menu_items WHERE id = ? FOR UPDATE",
          [item.menu_item_id]
        );
        if (!rows.length)
          throw new Error(`Menu item ${item.menu_item_id} not found`);
        const currentStock = rows[0].stock;
        const newStock = currentStock - item.quantity;
        if (newStock < 0) {
          throw new Error(`Insufficient stock for item ${item.menu_item_id}`);
        }

        // 3) update stock
        await conn.query("UPDATE menu_items SET stock = ? WHERE id = ?", [
          newStock,
          item.menu_item_id,
        ]);

        // 4) log movement
        await conn.query(
          `INSERT INTO stock_movements (menu_item_id, user_id, edited, reason)
           VALUES (?, ?, ?, ?)`,
          [item.menu_item_id, req.user.id, -item.quantity, "Sale"]
        );

        // 5) check min_stock and create alert IF crossing threshold
        const minStock = rows[0].min_stock || 0;
        if (newStock <= minStock) {
          // Only insert if not already an unresolved alert for this item
          const [existing] = await conn.query(
            `SELECT id FROM low_stock_alerts WHERE menu_item_id = ? AND is_resolved = 0`,
            [item.menu_item_id]
          );
          if (existing.length === 0) {
            const message = `Stock low: now ${newStock} <= min ${minStock}`;
            await conn.query(
              `INSERT INTO low_stock_alerts (menu_item_id, current_stock, min_stock, created_by, message)
               VALUES (?, ?, ?, ?, ?)`,
              [item.menu_item_id, newStock, minStock, req.user.id, message]
            );

            // OPTIONAL: emit real-time event here (socket.io) if set up
            // io.to('managers').emit('low-stock', { menu_item_id: item.menu_item_id, currentStock: newStock, minStock });
          }
        }
      }

      await conn.commit();
      res.json({ message: "Bill created", bill_id });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: err.message || "Billing failed" });
    } finally {
      conn.release();
    }
  }
);

module.exports = router;
