const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/add",
  verifyToken,
  requireRole("admin", "manager"),
  async (req, res) => {
    const {
      sku,
      name,
      description,
      price,
      cost_price,
      stock,
      min_stock,
      category,
    } = req.body;

    try {
      const [result] = await pool.query(
        `INSERT INTO menu_items (sku, name, description, price, cost_price, stock, min_stock, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sku, name, description, price, cost_price, stock, min_stock, category]
      );
      res.json({ message: "Menu item added", id: result.insertId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add menu item" });
    }
  }
);

router.get(
  "/view",
  verifyToken,
  requireRole("admin", "manager", "cashier"),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM menu_items");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch menu" });
    }
  }
);

router.put(
  "/:id",
  verifyToken,
  requireRole("admin", "manager"),
  async (req, res) => {
    const { id } = req.params;
    const { name, description, price, cost_price, stock, min_stock, category } =
      req.body;

    try {
      const [result] = await pool.query(
        `UPDATE menu_items 
         SET name = ?, description = ?, price = ?, cost_price = ?, stock = ?, min_stock = ?, category = ?
         WHERE id = ?`,
        [name, description, price, cost_price, stock, min_stock, category, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Menu item not found" });
      }

      res.json({ message: "Menu item updated successfully" });
    } catch (error) {
      console.error("Update menu item error:", error);
      res.status(500).json({ error: "Failed to update menu item" });
    }
  }
);

/**
 * DELETE MENU ITEM
 * Admin only
 */
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM menu_items WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Delete menu item error:", error);
    res.status(500).json({ error: "Failed to delete menu item" });
  }
});

/**
 * SEARCH / FILTER MENU ITEMS
 * Admin & Manager
 */
router.get(
  "/search",
  verifyToken,
  requireRole("admin", "manager", "cashier"),
  async (req, res) => {
    const { name, category, minPrice, maxPrice } = req.query;

    let sql = "SELECT * FROM menu_items WHERE 1=1";
    let params = [];

    if (name) {
      sql += " AND name LIKE ?";
      params.push(`%${name}%`);
    }

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    if (minPrice) {
      sql += " AND price >= ?";
      params.push(minPrice);
    }

    if (maxPrice) {
      sql += " AND price <= ?";
      params.push(maxPrice);
    }

    try {
      const [rows] = await pool.query(sql, params);
      res.json(rows);
    } catch (error) {
      console.error("Search menu items error:", error);
      res.status(500).json({ error: "Failed to search menu items" });
    }
  }
);

module.exports = router;
