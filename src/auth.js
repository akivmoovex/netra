const bcrypt = require("bcryptjs");

async function ensureAdminUser({ db }) {
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const admin = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username);
  if (admin) return;

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD is not set. Create a .env from .env.example and set a strong password."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run(username, passwordHash);
  // eslint-disable-next-line no-console
  console.log(`Admin user created: ${username}`);
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminUser) return next();
  res.redirect("/admin/login");
}

async function authenticateAdmin({ db, username, password }) {
  const admin = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username.toLowerCase());
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return null;
  return admin;
}

module.exports = { ensureAdminUser, requireAdmin, authenticateAdmin };

