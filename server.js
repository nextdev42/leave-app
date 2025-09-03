// server.js
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const expressLayouts = require("express-ejs-layouts");

const app = express();
const db = new sqlite3.Database("./database.sqlite");


// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "leave-secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());

// Make flash available in all views
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.user || null;
  next();
});
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layout");

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('employee','manager'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    start_date TEXT,
    end_date TEXT,
    reason TEXT,
    type TEXT,
    status TEXT DEFAULT 'Pending',
    manager_comment TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.get("SELECT * FROM users WHERE role = 'manager'", (err, row) => {
    if (!row) {
      const hashed = bcrypt.hashSync("admin123", 10);
      db.run(
        "INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
        ["Manager", "manager@example.com", hashed, "manager"]
      );
      console.log("Default manager created: manager@example.com / admin123");
    }
  });
});

// Auth Middleware
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// Home redirect
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  if (req.session.user.role === "manager") return res.redirect("/manager");
  res.redirect("/dashboard");
});

// ---------------- Login ----------------
app.get("/login", (req, res) => {
  res.render("login", { error: null, title: "Login", user: null });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.render("login", { error: "Invalid email or password", title: "Login", user: null });
    }
    req.session.user = user;
    res.redirect("/");
  });
});

// ---------------- Logout ----------------
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// ---------------- Register ----------------
app.get("/register", (req, res) => {
  res.render("register", { error: null, title: "Register", user: null });
});

app.post("/register", (req, res) => {
 const { name, email, password, role } = req.body;

if (!name || !email || !password || !role) {
  req.flash("error", "All fields are required");
  return res.redirect("/register");
}

// Prevent multiple managers? Optional:
// if (role === "manager") ...

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
    if (row) {
      return res.render("register", { error: "Email already exists", title: "Register", user: null });
    }

    const hashed = bcrypt.hashSync(password, 10);
   db.run(
  "INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
  [name, email, hashed, role],
  function(err){
    if(err){
      req.flash("error", "Something went wrong");
      return res.redirect("/register");
    }
    db.get("SELECT * FROM users WHERE id = ?", [this.lastID], (err, user) => {
      req.session.user = user;
      req.flash("success", "Registration successful! Welcome " + user.name);
      if(user.role === "manager") return res.redirect("/manager");
      res.redirect("/dashboard");
    });
      }
 );
 });
});


// ---------------- Employee Dashboard ----------------
app.get("/dashboard", requireLogin, (req, res) => {
  if (req.session.user.role !== "employee") return res.redirect("/");
  db.all(
    "SELECT * FROM leave_requests WHERE user_id = ?",
    [req.session.user.id],
    (err, leaves) => {
      res.render("dashboard", { user: req.session.user, leaves, title: "Dashboard" });
    }
  );
});

// ---------------- Leave Form ----------------
app.get("/leave", requireLogin, (req, res) => {
  if (req.session.user.role !== "employee") return res.redirect("/");
  res.render("leave-form", { user: req.session.user, title: "Request Leave" });
});

app.post("/leave", requireLogin, (req, res) => {
  const { start_date, end_date, reason, type } = req.body;
  db.run(
    "INSERT INTO leave_requests (user_id,start_date,end_date,reason,type) VALUES (?,?,?,?,?)",
    [req.session.user.id, start_date, end_date, reason, type],
    () => {
      req.flash("success", "Leave submitted successfully!");
      res.redirect("/dashboard");
    }
  );
});


// ---------------- Manager Dashboard ----------------
app.get("/manager", requireLogin, (req, res) => {
  if (req.session.user.role !== "manager") return res.redirect("/");
  db.all(
    `SELECT lr.*, u.name as employee_name
     FROM leave_requests lr
     JOIN users u ON lr.user_id = u.id`,
    (err, leaves) => {
      res.render("manager", { user: req.session.user, leaves, title: "Manager Dashboard" });
    }
  );
});

app.post("/manager/action/:id", requireLogin, (req, res) => {
  if (req.session.user.role !== "manager") return res.redirect("/");
  const { id } = req.params;
  const { action, comment } = req.body;
  const status = action === "approve" ? "Approved" : "Rejected";

  db.run(
    "UPDATE leave_requests SET status = ?, manager_comment = ? WHERE id = ?",
    [status, comment, id],
    () => {
      req.flash("success", `Leave ${status.toLowerCase()} successfully!`);
      res.redirect("/manager");
    }
  );
});


// ---------------- Start Server ----------------
app.listen(3000, () => console.log("Server running on http://localhost:3000"));
