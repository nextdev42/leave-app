// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const expressLayouts = require("express-ejs-layouts");
const flash = require("connect-flash");

const app = express();

// ---------- Postgres Connection ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------- Middleware ----------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: process.env.SESSION_SECRET || "leave-secret",
  resave: false,
  saveUninitialized: false
}));
app.use(flash());
app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("layout", "layout");

// Make flash and user available in all views
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.user || null;
  next();
});

// ---------- Create Tables ----------
async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('employee','manager')) NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'Pending' NOT NULL,
      manager_comment TEXT
    );
  `);

  // Create default manager if none exists
  const res = await pool.query("SELECT * FROM users WHERE role='manager' LIMIT 1");
  if (res.rows.length === 0) {
    const hashed = bcrypt.hashSync("admin123", 10);
    await pool.query(
      "INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4)",
      ["Manager", "manager@example.com", hashed, "manager"]
    );
    console.log("Default manager created: manager@example.com / admin123");
  }
}
createTables();

// ---------- Auth Middleware ----------
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ---------- Routes ----------

// Home redirect
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  if (req.session.user.role === "manager") return res.redirect("/manager");
  res.redirect("/dashboard");
});

// Login
app.get("/login", (req, res) => {
  res.render("login", { error: null, title: "Login", user: null });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash("error", "Email and password are required");
    return res.redirect("/login");
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) {
      console.error(err);
      req.flash("error", "Something went wrong. Please try again.");
      return res.redirect("/login");
    }

    if (!user) {
      req.flash("error", "No account found with that email");
      return res.redirect("/login");
    }

    if (!bcrypt.compareSync(password, user.password)) {
      req.flash("error", "Incorrect password");
      return res.redirect("/login");
    }

    req.session.user = user;
    req.flash("success", `Welcome back, ${user.name}!`);
    res.redirect("/");
  });
});


// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Register
app.get("/register", (req, res) => {
  res.render("register", { error: null, title: "Register", user: null });
});

app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    req.flash("error", "All fields are required");
    return res.redirect("/register");
  }

  const existing = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (existing.rows.length > 0) {
    return res.render("register", { error: "Email already exists", title: "Register", user: null });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const insert = await pool.query(
    "INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING *",
    [name, email, hashed, role]
  );

  req.session.user = insert.rows[0];
  req.flash("success", "Registration successful! Welcome " + insert.rows[0].name);
  if (insert.rows[0].role === "manager") return res.redirect("/manager");
  res.redirect("/dashboard");
});

// Employee dashboard
app.get("/dashboard", requireLogin, async (req, res) => {
  if (req.session.user.role !== "employee") return res.redirect("/");
  const result = await pool.query("SELECT * FROM leave_requests WHERE user_id=$1", [req.session.user.id]);
  res.render("dashboard", { user: req.session.user, leaves: result.rows, title: "Dashboard" });
});

// Leave request form
app.get("/leave", requireLogin, (req, res) => {
  if (req.session.user.role !== "employee") return res.redirect("/");
  res.render("leave-form", { user: req.session.user, title: "Request Leave" });
});

app.post("/leave", requireLogin, async (req, res) => {
  const { start_date, end_date, reason, type } = req.body;
  await pool.query(
    "INSERT INTO leave_requests (user_id,start_date,end_date,reason,type) VALUES ($1,$2,$3,$4,$5)",
    [req.session.user.id, start_date, end_date, reason, type]
  );
  req.flash("success", "Leave submitted successfully!");
  res.redirect("/dashboard");
});

// Manager dashboard
app.get("/manager", requireLogin, async (req, res) => {
  if (req.session.user.role !== "manager") return res.redirect("/");
  const result = await pool.query(`
    SELECT lr.*, u.name AS employee_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
  `);
  res.render("manager", { user: req.session.user, leaves: result.rows, title: "Manager Dashboard" });
});

// Approve/Reject leave
app.post("/manager/action/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "manager") return res.redirect("/");
  const { id } = req.params;
  const { action, comment } = req.body;
  const status = action === "approve" ? "Approved" : "Rejected";

  await pool.query(
    "UPDATE leave_requests SET status=$1, manager_comment=$2 WHERE id=$3",
    [status, comment, id]
  );
  req.flash("success", `Leave ${status.toLowerCase()} successfully!`);
  res.redirect("/manager");
});

// Start server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});

