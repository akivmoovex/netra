const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const BetterSqlite3 = require("better-sqlite3");
const SqliteSessionStore = require("better-sqlite3-session-store")(session);
const fs = require("fs");

require("dotenv").config();

const { ensureAdminUser } = require("./src/auth");
const { getSubdomain } = require("./src/host");
const { db } = require("./src/db");

const publicRoutes = require("./src/routes/public");
const adminRoutes = require("./src/routes/admin");
const apiRoutes = require("./src/routes/api");

const app = express();

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.disable("x-powered-by");
app.use(helmet());
app.use(morgan("dev"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

const sessionSecret = process.env.SESSION_SECRET || "dev_secret_change_me";
const sessionDir = process.env.SESSION_DIR || path.join(__dirname, "data");
const sessionDbPath = process.env.SESSION_DB_PATH || path.join(sessionDir, "sessions.db");
fs.mkdirSync(sessionDir, { recursive: true });

// Separate DB for session storage (avoid mixing with app data tables)
const sessionDb = new BetterSqlite3(sessionDbPath);

app.use(
  session({
    name: "netraz_sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new SqliteSessionStore({
      client: sessionDb,
      expired: {
        clear: true,
        // Cleanup expired sessions every ~15 minutes
        intervalMs: 15 * 60 * 1000,
      },
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// Determine whether this request is coming from a company subdomain
app.use((req, res, next) => {
  req.subdomain = getSubdomain(req);
  next();
});

// Public routes (marketing site + directory + per-company one-page websites)
app.use("/", publicRoutes({ db }));
// API routes (lead capture)
app.use("/api", apiRoutes({ db }));
// Admin
app.use("/admin", adminRoutes({ db }));

// Healthcheck
app.get("/healthz", (_req, res) => res.json({ ok: true }));

ensureAdminUser({ db })
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Netra running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize admin user:", err);
    process.exit(1);
  });

