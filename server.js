const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
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
const sessionDbName = process.env.SESSION_DB || "sessions";
fs.mkdirSync(sessionDir, { recursive: true });

app.use(
  session({
    name: "netraz_sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({
      dir: sessionDir,
      db: sessionDbName,
      table: "sessions",
      createDirIfNotExists: true,
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

