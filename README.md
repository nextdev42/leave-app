# Leave Request Management System

A simple **Leave Management System** built with **Node.js, Express, SQLite, and EJS**.  
Employees can submit leave requests, and managers can approve or reject them.

---

## 🚀 Features
- User authentication (Employee & Manager roles)
- Employee dashboard to view and submit leave requests
- Manager dashboard to approve/reject requests
- Flash messages for success/error notifications
- Default manager account auto-created on first run

---

## 🛠️ Tech Stack
- **Node.js + Express** (backend server)
- **SQLite** (default database, file-based)
- **EJS** (templating engine)
- **Bootstrap** (for styling UI)
- **bcryptjs** (for password hashing)
- **express-session + connect-flash** (for sessions & messages)

---

## 📂 Project Structure

```bash
leave-app/
│── server.js # Main server file
│── database.sqlite # SQLite database (auto-created)
│── views/ # EJS templates
│── public/ # Static files (CSS, JS, images)
│── package.json
```


---

## 🔑 Default Manager Login
On first run, the app creates a default **manager account**:

- **Email:** `manager@example.com`  
- **Password:** `admin123`

---

## ⚙️ Setup & Run Locally

### 1. Clone the repo
```bash
git clone https://github.com/your-username/leave-app.git
cd leave-app
```

## 2. Install dependencies

```bash
npm install
```
## 3. Run the app

```bash
node server.js
```

## 🧑‍💻 Usage

- Employee: Register an account → login → request leave.

- Manager: Login using manager credentials → review requests → approve/reject.

## 📦 Deployment Notes

**Using SQLite**

- Works fine locally.

- ⚠️ Not recommended for Vercel (serverless resets DB).

- On Render, you must attach a persistent disk.

- Using PostgreSQL (Recommended for Production)

- Replace SQLite with Postgres.

- You can host Postgres on:

- Render PostgreSQL
- Neon

## ✅ To-Do / Improvements
- [ ] Migrate database from SQLite → PostgreSQL
- [ ] Add email notifications for leave approvals
- [ ] Add role-based access control middleware
- [ ] Dockerize for easy deployment

## 📝 License

MIT License – free to use, modify, and distribute.