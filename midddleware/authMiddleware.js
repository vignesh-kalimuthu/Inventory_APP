const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Verify Access Token
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, process.env.JWT_SECRET, (err, userData) => {
    if (err)
      return res.status(403).json({ error: "Invalid or expired access token" });
    req.user = userData; // { userId, role }
    next();
  });
}

// Verify Refresh Token
function verifyRefreshToken(req, res, next) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_SECRET,
    async (err, userData) => {
      if (err) {
        return res
          .status(403)
          .json({ error: "Invalid or expired refresh token" });
      }

      try {
        const [rows] = await pool.query(
          "SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()",
          [refreshToken]
        );

        if (rows.length === 0) {
          return res
            .status(403)
            .json({ error: "Refresh token revoked or expired" });
        }

        req.user = { userId: userData.userId, role: userData.role };
        req.token = refreshToken;
        next();
      } catch (dbError) {
        console.error("Refresh token DB check failed:", dbError);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}

// Require Role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

// Require Permission
function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    try {
      const [rows] = await pool.query(
        `SELECT p.name 
         FROM permissions p
         INNER JOIN user_permissions up ON up.permission_id = p.id
         WHERE up.user_id = ? AND p.name = ?`,
        [req.user.userId, permissionName]
      );

      if (rows.length === 0) {
        return res.status(403).json({ error: "Forbidden: missing permission" });
      }

      next();
    } catch (error) {
      console.error("Permission check failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

module.exports = {
  verifyToken,
  verifyRefreshToken,
  requireRole,
  requirePermission,
};
