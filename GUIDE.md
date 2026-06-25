# Final Year Supervision System — Developer & Deployment Guide

This guide details the steps to set up, operate, and deploy the **Web-Based Scheduling and Final Year Project Supervision System** in local development environments and production environments.

---

## 1. Local Development Setup (VS Code Guide)

Follow these steps to run the complete client-server application on your machine.

### Prerequisites
- **Node.js** (v18.x or v20.x recommended)
- **NPM** (v9.x or later)

### Step 1: Clone and Install Dependencies
Navigate to your project root and install both frontend and backend dependencies:

```bash
# Install core package.json dependencies
npm install
```

### Step 2: Configure Environment Variables
Create a file named `.env` in the root directory:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-high-security-jwt-key-2026

# MongoDB Settings (Once you transition to cloud database)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/supervision?retryWrites=true&w=majority

# Nodemailer SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-institutional-email@university.edu
SMTP_PASS=your-app-specific-gmail-password
```

### Step 3: Run the Application
To run the server and client concurrently under Vite:

```bash
# Launches Express backend + Vite client build on localhost
npm run dev
```

Open `http://localhost:3000` in your web browser.

---

## 2. Transitioning from File-DB to Real MongoDB

The pre-seeded sandbox uses a highly robust, persistent local JSON database (located in `/data/db.json`) so it runs instantly inside container previews. 
To transition to a real MongoDB Atlas database, follow these steps:

### Step 1: Install Mongoose
In your local environment, install Mongoose:

```bash
npm install mongoose
```

### Step 2: Replace `/server/db.ts` with MongoDB Connection
Rewrite `/server/db.ts` to utilize Mongoose schemas:

```typescript
import mongoose from "mongoose";

// Express startup connection
export async function connectDatabase() {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/supervision";
    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully!");
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}

// User Schema Example
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "supervisor", "admin"], required: true },
  matricNumber: String,
  department: { type: String, required: true },
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export const User = mongoose.model("User", UserSchema);
```

### Step 3: Call `connectDatabase()` on Server Start
In `/server.ts`, import `connectDatabase` and call it inside the `startServer()` block:

```typescript
// Import connection helper
import { connectDatabase } from "./server/db.js";

async function startServer() {
  await connectDatabase();
  // ... rest of express startup
}
```

---

## 3. Real Nodemailer SMTP Email Setup

To switch from our **Simulated In-App Inbox Client** to real physical email delivery (e.g. Gmail):

1. **Install Nodemailer:**
   ```bash
   npm install nodemailer
   ```
2. **Implement SMTP Transport:**
   Modify `/server/notifier.ts` to utilize nodemailer:

   ```typescript
   import nodemailer from "nodemailer";

   const transporter = nodemailer.createTransport({
     host: process.env.SMTP_HOST,
     port: parseInt(process.env.SMTP_PORT || "465"),
     secure: true, // Use SSL
     auth: {
       user: process.env.SMTP_USER,
       pass: process.env.SMTP_PASS,
     },
   });

   export async function sendRealEmail(to: string, subject: string, html: string) {
     try {
       await transporter.sendMail({
         from: '"University Project Supervision Module" <noreply@university.edu>',
         to,
         subject,
         html,
       });
       console.log(`Email successfully delivered to ${to}`);
     } catch (error) {
       console.error("SMTP Delivery failed:", error);
     }
   }
   ```

---

## 4. Production Deployment Guidelines

Ready to deploy? Follow these standard pipelines for high-performance scale.

### A. Deploy Database (MongoDB Atlas)
1. Sign up on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a Free Shared Cluster.
3. Whitelist access from any IP address (`0.0.0.0/0`) or configure secure VPC peering.
4. Copy your Database Connection URI and set it inside your production environment variables checklist as `MONGODB_URI`.

### B. Deploy Backend Node.js (Render / Railway)
Since our application is bundled using **Vite + Express**, both the client and API are served from a single port! This is the most optimal production architecture.

#### 1. On Railway:
1. Connect your Github Repository to Railway.
2. Under "Variables", configure:
   - `NODE_ENV=production`
   - `JWT_SECRET=make-a-high-security-hash`
   - `MONGODB_URI=your-atlas-connection-string`
3. Railway automatically parses `package.json` build scripts, executes `npm run build`, and starts the production bundle with `npm start`.

#### 2. On Render:
1. Under Render, create a new **Web Service**.
2. Connect your Github Repository.
3. Configure the following build variables context:
   - **Environment:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm run start`
4. Set your Environment variables in the Render dashboard.

### C. Advanced Deploy with Static Isolation (Frontend on Vercel)
If you want to host the frontend statically on Vercel and backend on Render:
1. In `vite.config.ts`, build normal assets and deploy them on Vercel.
2. Configure Axios/Fetch base URL inside `/src/lib/api.ts` to target your deployed backend Render URL instead of the local prefix `/api`:
   `const API_BASE = "https://your-express-render-app.onrender.com/api";`
3. Configure CORS on the backend Express app to accept connections from your Vercel domains:
   ```typescript
   import cors from "cors";
   app.use(cors({ origin: "https://your-supervision-system.vercel.app" }));
   ```
