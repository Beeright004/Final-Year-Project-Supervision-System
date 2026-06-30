import express, { Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { db, User, Topic, Proposal, Schedule, Notification, PendingOtp } from "./server/db.js";
import { createNotification, sendEmailNotification, emailTemplates } from "./server/notifier.js";
import agoraTokenPkg from "agora-access-token";

const { RtcTokenBuilder, RtcRole } = agoraTokenPkg;

// Extended Express Request to support user contexts
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "student" | "supervisor" | "admin";
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "university-supervision-jwt-secret-key-2026";
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Dynamic Production CORS policy integration
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["*"];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocalhost = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
      const isRunApp = origin.endsWith(".run.app");

      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        isLocalhost ||
        isRunApp
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy violation: origin ${origin} not verified.`));
      }
    },
    credentials: true,
  })
);

import multer from "multer";
import fs from "fs";

// Ensure uploads folder exists in root
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded manuscripts statically
app.use("/uploads", express.static(uploadsDir));

// Multer physical storage and file configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${uniqueSuffix}-${cleanFileName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".pptx", ".xlsx", ".csv", ".log", ".zip"];
    if (!allowed.includes(ext)) {
      return cb(new Error("Supported file types: PDF, DOC, DOCX, TXT, PNG, JPG, PPTX, XLSX, CSV, ZIP, LOG"));
    }
    cb(null, true);
  }
});

// Middleware for parsing JSON and URLencoded requests with high limit for mock PDFs
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ID Generator helper
const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

// Helper to handle base64 data and save to file
async function saveBase64ToFile(base64Data: string, originalName: string): Promise<{ url: string; size: string }> {
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 string");
    }

    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(originalName) || ".bin";
    const fileName = `${uniqueSuffix}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.promises.writeFile(filePath, buffer);
    return {
      url: `/uploads/${fileName}`,
      size: (buffer.length / (1024 * 1024)).toFixed(2) + " MB"
    };
  } catch (err) {
    console.error("Base64 save error:", err);
    throw err;
  }
}


// Authentication Middleware
function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. Authentication token missing." });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: any };
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired session token." });
  }
}

// Role Guard Middleware
function requireRole(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Not authorized. This feature requires standard ${roles.join(" or ")} privileges.` });
    }
    next();
  };
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// OTP storage is now persisted in the database (see server/db.ts PendingOtp)
// This ensures OTPs survive serverless cold starts on Vercel

// Register Account (Dual-Stage with 6-digit OTP check)
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, matricNumber, department, supervisorId } = req.body;

    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({ error: "Please provide all required fields." });
    }

    if (!["student", "supervisor"].includes(role)) {
      return res.status(400).json({ error: "Invalid registration role specified." });
    }

    const emailStr = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailStr)) {
      return res.status(400).json({ error: "Please enter a valid academic or personal email address." });
    }

    const users = await db.getUsers();
    const existingUser = users.find((u) => u.email.toLowerCase() === emailStr);
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email address already exists in the division." });
    }

    if (role === "student" && !matricNumber) {
      return res.status(400).json({ error: "Students must provide a registration or matriculation number." });
    }

    // Generate a secure 6-digit verification code OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    // Persist OTP to database (survives serverless cold starts)
    const pendingOtps = await db.getPendingOtps();
    // Remove any previous pending OTP for this email
    const filtered = pendingOtps.filter((p) => p.email !== emailStr);
    const pendingEntry: PendingOtp = {
      email: emailStr,
      otp,
      expiresAt,
      details: {
        name,
        email: emailStr,
        password,
        role,
        matricNumber: role === "student" ? matricNumber : undefined,
        department,
        supervisorId: role === "student" ? supervisorId : undefined,
      }
    };
    filtered.push(pendingEntry);
    await db.savePendingOtps(filtered);

    // Build OTP email with professional HTML template
    const subject = `[${otp}] Verify Your FYP Supervision Academic Profile`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px;">
          <h2 style="color: #1e3a8a; margin: 0; font-size: 20px;">FYP Project Portal</h2>
          <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">Department of Computer Science &amp; ICT</p>
        </div>
        <p>Dear <strong>${name}</strong>,</p>
        <p>You have initiated registration as a <strong>${role === "student" ? "Project Candidate" : "Supervisor Adviser"}</strong>. Use the secure 6-digit OTP below to activate your account:</p>

        <div style="background-color: #f8fafc; border: 2px dashed #2563eb; border-radius: 10px; padding: 22px; text-align: center; margin: 22px 0;">
          <span style="font-family: 'Courier New', monospace; font-size: 38px; font-weight: 900; color: #2563eb; letter-spacing: 10px;">${otp}</span>
          <p style="color: #64748b; font-size: 10px; margin: 10px 0 0 0; text-transform: uppercase; font-weight: bold;">Your Verification OTP — Valid for 10 Minutes</p>
        </div>

        <p style="font-size: 13px; color: #334155;">
          Enter this code on the verification screen to complete your registration. Do not share this code with anyone.
        </p>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
          This OTP expires in <strong>10 minutes</strong>. If you did not initiate this request, please ignore this email.
        </p>
      </div>
    `;

    // Always save to in-app inbox as fallback (visible in the system even if SMTP fails)
    await sendEmailNotification(emailStr, subject, html, false);

    res.status(200).json({
      verificationRequired: true,
      email: emailStr,
      message: "A 6-digit verification OTP has been sent to your email address. Check your inbox (and spam folder) to activate your account.",
    });

  } catch (error) {
    console.error("Registration dispatch error:", error);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// Confirm Register OTP Verification Code and Save Account
app.post("/api/auth/register/confirm", async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Both registered email and 6-digit verification code are required to activate account." });
    }

    const emailStr = email.trim().toLowerCase();

    // Load OTPs from database (persisted across serverless calls)
    const pendingOtps = await db.getPendingOtps();
    const pending = pendingOtps.find((p) => p.email === emailStr);

    if (!pending) {
      return res.status(400).json({ error: "No pending registration found for this email. Please register again." });
    }

    if (Date.now() > pending.expiresAt) {
      // Remove expired
      await db.savePendingOtps(pendingOtps.filter((p) => p.email !== emailStr));
      return res.status(400).json({ error: "Your verification OTP has expired (10-minute limit). Please register again." });
    }

    if (pending.otp !== otp.trim()) {
      return res.status(400).json({ error: "Invalid OTP entered. Please check your email inbox and try again." });
    }

    // OTP matches — create the account
    const { name, password, role, matricNumber, department, supervisorId } = pending.details;
    const users = await db.getUsers();

    const existingUser = users.find((u) => u.email.toLowerCase() === emailStr);
    if (existingUser) {
      await db.savePendingOtps(pendingOtps.filter((p) => p.email !== emailStr));
      return res.status(400).json({ error: "This email address is already registered." });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser: User = {
      id: generateId("usr"),
      name,
      email: emailStr,
      password: hashedPassword,
      role,
      matricNumber: role === "student" ? matricNumber : undefined,
      department,
      supervisorId: role === "student" ? supervisorId : undefined,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await db.saveUsers(users);

    // Remove OTP from DB after successful registration
    await db.savePendingOtps(pendingOtps.filter((p) => p.email !== emailStr));

    // Create notifications & emails welcoming candidate
    await createNotification(
      newUser.id,
      `Welcome to FYP project supervision! Propose research titles to start milestones tracking.`,
      "success"
    );

    const welcomeTemplate = emailTemplates.studentRegistered(newUser.name, newUser.email, newUser.role);
    await sendEmailNotification(newUser.email, welcomeTemplate.subject, welcomeTemplate.html);

    res.status(201).json({
      message: "Academic profile verified and registered successfully! You can now log into your console.",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
      }
    });

  } catch (error) {
    console.error("Verification verification error:", error);
    res.status(500).json({ error: "OTP verification failed. Please try again." });
  }
});

// Login Account
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please input both email and password." });
    }

    const users = await db.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid email or password credentials." });
    }

    const match = bcrypt.compareSync(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password credentials." });
    }

    // Sign Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Resolve supervisor details for student
    let supervisorInfo = null;
    if (user.role === "student" && user.supervisorId) {
      const sup = users.find((u) => u.id === user.supervisorId);
      if (sup) {
        supervisorInfo = { id: sup.id, name: sup.name, email: sup.email, department: sup.department };
      }
    }

    res.json({
      message: "Authentication successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        matricNumber: user.matricNumber,
        department: user.department,
        supervisorId: user.supervisorId,
        supervisor: supervisorInfo,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed due to unexpected server error." });
  }
});

// Get Current User Profile / Session
app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.getUsers();
    const user = users.find((u) => u.id === req.user!.id);

    if (!user) {
      return res.status(404).json({ error: "Profile not found." });
    }

    let supervisorInfo = null;
    if (user.role === "student" && user.supervisorId) {
      const sup = users.find((u) => u.id === user.supervisorId);
      if (sup) {
        supervisorInfo = { id: sup.id, name: sup.name, email: sup.email, department: sup.department };
      }
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      matricNumber: user.matricNumber,
      department: user.department,
      supervisorId: user.supervisorId,
      supervisor: supervisorInfo,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Could not fetch user profile session." });
  }
});

// Forgot / Reset Password Simulator
app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Please enter your register email." });

    const users = await db.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(404).json({ error: "No account matched with this email." });
    }

    // Trigger SMTP simulations
    await sendEmailNotification(
      user.email,
      "Manual Password Reset Code — Academic Supervisions",
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Academic Account Recovery</h2>
          <p>Dear ${user.name}, Code: <code>RESET_PW_9921</code></p>
          <p>Please use high security token below to reset your password credentials inside your application.</p>
          <p style="background: #f3f4f6; font-size: 18px; padding: 10px; font-family: monospace; letter-spacing: 2px;">RESET_PW_9921</p>
          <p>Do not share this authorization key with anyone else.</p>
        </div>
      `
    );

    res.json({ message: "Recovery code has been automatically routed to your registered inbox." });
  } catch (e) {
    res.status(500).json({ error: "Failed to dispatch recovery code." });
  }
});

app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "All arguments (email, code, and newPassword) are required." });
    }

    if (code !== "RESET_PW_9921") {
      return res.status(400).json({ error: "Invalid password reset verification code." });
    }

    const users = await db.getUsers();
    const userIndex = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      return res.status(404).json({ error: "User accounts not found." });
    }

    const salt = bcrypt.genSaltSync(10);
    users[userIndex].password = bcrypt.hashSync(newPassword, salt);
    await db.saveUsers(users);

    await createNotification(users[userIndex].id, "Account password was changed successfully.", "info");

    res.json({ message: "Password updated successfully! You can register login session now." });
  } catch (e) {
    res.status(500).json({ error: "Reset passwords workflow crashed." });
  }
});


// ==========================================
// USER & SUPERVISOR LIST ENDPOINTS
// ==========================================

// Get list of active Supervisors/Lecturers for registration dropdown
app.get("/api/supervisors", async (req: Request, res: Response) => {
  try {
    const users = await db.getUsers();
    const supervisors = users
      .filter((u) => u.role === "supervisor" || u.role === "admin") // Administrators also supervise sometimes
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
      }));
    res.json(supervisors);
  } catch (error) {
    res.status(500).json({ error: "Failed to download supervisors portfolio." });
  }
});

// Get list of students in supervisor's database
app.get("/api/supervisors/students", authenticateToken, requireRole(["supervisor", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.getUsers();
    const allStudents = users.filter((u) => u.role === "student");
    const supervisorsList = users.filter((u) => u.role === "supervisor" || u.role === "admin");

    const enrichedStudents = allStudents.map((s) => {
      const sup = supervisorsList.find((sv) => sv.id === s.supervisorId);
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        matricNumber: s.matricNumber || "N/A",
        department: s.department || "N/A",
        supervisorId: s.supervisorId,
        supervisorName: sup ? sup.name : "Unassigned",
        createdAt: s.createdAt,
      };
    });
    res.json(enrichedStudents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch students database." });
  }
});


// ==========================================
// TOPICS WORKFLOW ENDPOINTS (STUDENT & LECTURER)
// ==========================================

// Submit Topic Title & Proposal Abstract
app.post("/api/topics", authenticateToken, requireRole(["student"]), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Please enter your topic title and a summary abstraction." });
    }

    const studentId = req.user!.id;
    const users = await db.getUsers();
    const student = users.find((u) => u.id === studentId);

    if (!student || !student.supervisorId) {
      return res.status(400).json({ error: "You must have an assigned academic supervisor before proposing topics." });
    }

    const topics = await db.getTopics();
    const studentTopics = topics.filter((t) => t.studentId === studentId);
    const hasApprovedTopic = studentTopics.some((t) => t.status === "approved");

    if (hasApprovedTopic) {
      return res.status(400).json({ error: "You already have an approved project topic. You cannot submit another topic." });
    }

    const newTopic: Topic = {
      id: generateId("top"),
      title,
      description,
      status: "pending",
      studentId,
      supervisorId: student.supervisorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    topics.push(newTopic);
    await db.saveTopics(topics);

    // Notify Lecturer in-app
    await createNotification(
      student.supervisorId,
      `New final year project topic proposed by ${student.name}: "${title.slice(0, 40)}..."`,
      "info"
    );

    // Notify Lecturer email
    const supervisor = users.find((u) => u.id === student.supervisorId);
    if (supervisor) {
      const template = emailTemplates.topicSubmitted(student.name, title, supervisor.name);
      await sendEmailNotification(supervisor.email, template.subject, template.html);
    }

    res.status(201).json({ message: "Topic proposal submitted successfully.", topic: newTopic });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit project proposal." });
  }
});

// Edit topic (only feasible for student if status is pending or revision)
app.put("/api/topics/:id", authenticateToken, requireRole(["student"]), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body;
    const { id } = req.params;

    if (!title || !description) {
      return res.status(400).json({ error: "Both title and description must be supplied." });
    }

    const topics = await db.getTopics();
    const topicIndex = topics.findIndex((t) => t.id === id);

    if (topicIndex === -1) {
      return res.status(404).json({ error: "Requested topic was not found." });
    }

    const topic = topics[topicIndex];
    if (topic.studentId !== req.user!.id) {
      return res.status(403).json({ error: "This topic does not belong to your student account." });
    }

    if (topic.status === "approved") {
      return res.status(400).json({ error: "Approved topics cannot be edited directly." });
    }

    // Apply adjustments
    topics[topicIndex].title = title;
    topics[topicIndex].description = description;
    topics[topicIndex].status = "pending"; // Reset to pending for subsequent approval cycles
    topics[topicIndex].updatedAt = new Date().toISOString();

    await db.saveTopics(topics);

    // Notify supervisor
    const users = await db.getUsers();
    const student = users.find((u) => u.id === req.user!.id);
    await createNotification(
      topic.supervisorId,
      `${student?.name || "Student"} has updated proposed topic coordinates: "${title.slice(0, 40)}..."`,
      "info"
    );

    res.json({ message: "Topic proposal updated successfully.", topic: topics[topicIndex] });
  } catch (error) {
    res.status(500).json({ error: "Could not modify topic settings." });
  }
});

// Get list of topics for logged-in role
app.get("/api/topics", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const topics = await db.getTopics();
    const users = await db.getUsers();
    const proposals = await db.getProposals();

    let myTopics: Topic[] = [];

    if (req.user!.role === "student") {
      myTopics = topics.filter((t) => t.studentId === req.user!.id);
    } else if (req.user!.role === "supervisor") {
      myTopics = topics.filter((t) => t.supervisorId === req.user!.id);
    } else if (req.user!.role === "admin") {
      myTopics = topics;
    }

    // Attach student and supervisor name meta summaries for user-friendly UI display
    const enrichedTopics = myTopics.map((topic) => {
      const student = users.find((u) => u.id === topic.studentId);
      const supervisor = users.find((u) => u.id === topic.supervisorId);
      const proposal = proposals.find((p) => p.topicId === topic.id);

      return {
        ...topic,
        studentName: student ? student.name : "Unknown Student",
        studentMatric: student ? student.matricNumber : "N/A",
        supervisorName: supervisor ? supervisor.name : "Unassigned Lecturer",
        proposal: proposal ? {
          ...proposal,
          fileDataUrl: proposal.fileUrl || (proposal as any).fileDataUrl
        } : null,
      };
    });

    res.json(enrichedTopics);
  } catch (error) {
    res.status(500).json({ error: "Failed to download supervision topics." });
  }
});

// Approve, Reject or Request revisions on proposed topic (Lecturer Only)
app.put("/api/topics/:id/review", authenticateToken, requireRole(["supervisor", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { status, feedback } = req.body;
    const { id } = req.params;

    if (!status || !["approved", "rejected", "revision"].includes(status)) {
      return res.status(400).json({ error: "Invalid review decision status specified." });
    }

    const topics = await db.getTopics();
    const topicIndex = topics.findIndex((t) => t.id === id);

    if (topicIndex === -1) {
      return res.status(404).json({ error: "Requested topic proposal not found." });
    }

    const topic = topics[topicIndex];

    if (req.user!.role === "supervisor" && topic.supervisorId !== req.user!.id) {
      return res.status(403).json({ error: "You are not authorized to review this student's proposed topic." });
    }

    topics[topicIndex].status = status;
    topics[topicIndex].feedback = feedback || "";
    topics[topicIndex].updatedAt = new Date().toISOString();

    await db.saveTopics(topics);

    // Notify student in-app
    await createNotification(
      topic.studentId,
      `Your proposed project topic "${topic.title.slice(0, 30)}..." has been reviewed as [${status.toUpperCase()}].`,
      status === "approved" ? "success" : status === "rejected" ? "warning" : "info"
    );

    // Notify student email
    const users = await db.getUsers();
    const student = users.find((u) => u.id === topic.studentId);

    if (student) {
      const template = emailTemplates.topicStatusUpdated(student.name, topic.title, status, feedback || "");
      await sendEmailNotification(student.email, template.subject, template.html);
    }

    res.json({ message: `Proposal status successfully marked as '${status}'.`, topic: topics[topicIndex] });
  } catch (error) {
    res.status(500).json({ error: "Error reviewing topic proposal." });
  }
});


// ==========================================
// PROPOSALS / FILE UPLOADS
// ==========================================

// Real and simulated file upload endpoint
// The UI can upload a PDF by converting it to local mock or base64, or submitting a real multipart file.
app.post(
  "/api/proposals",
  authenticateToken,
  requireRole(["student"]),
  (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      upload.single("file")(req, res, (err) => {
        if (err) {
          return res.status(400).json({ error: err.message || "File upload failed." });
        }
        next();
      });
    } else {
      next();
    }
  },
  async (req: AuthRequest, res: Response) => {
    try {
      let topicId = req.body.topicId;
      let fileName = req.body.fileName;
      let fileUrl = req.body.fileDataUrl;
      let fileSize = req.body.fileSize;

      // Ensure upload parameters can handle physical multer file
      if (req.file) {
        fileName = req.file.originalname;
        fileUrl = `/uploads/${req.file.filename}`;
        fileSize = (req.file.size / (1024 * 1024)).toFixed(2) + " MB";
      } else if (fileUrl && fileUrl.startsWith("data:")) {
        const saved = await saveBase64ToFile(fileUrl, fileName || "proposal.pdf");
        fileUrl = saved.url;
        fileSize = saved.size;
      }


      if (!topicId) {
        return res.status(400).json({ error: "Topic ID and File parameters must be configured." });
      }

      if (!fileName && !req.file) {
        return res.status(400).json({ error: "File name must be configured." });
      }

      const topics = await db.getTopics();
      const topic = topics.find((t) => t.id === topicId);

      if (!topic) {
        return res.status(404).json({ error: "Topic associated with this proposal not found." });
      }

      if (topic.status !== "approved") {
        return res.status(400).json({ error: "You can only submit formal proposals for Approved Topics." });
      }

      const proposals = await db.getProposals();
      // Re-submit checks
      const existingProposalIndex = proposals.findIndex((p) => p.topicId === topicId);

      const newProposal: Proposal = {
        id: generateId("prop"),
        topicId,
        fileName: fileName || (req.file ? req.file.originalname : "proposal.pdf"),
        fileUrl: fileUrl || `/simulated-storage/${fileName}`,
        fileSize: fileSize || "1.4 MB",
        contentType: req.file ? req.file.mimetype : "application/pdf",
        uploadDate: new Date().toISOString(),
        status: "pending",
      };

      if (existingProposalIndex !== -1) {
        proposals[existingProposalIndex] = newProposal;
      } else {
        proposals.push(newProposal);
      }

      await db.saveProposals(proposals);

      // Notify advisor
      const users = await db.getUsers();
      const student = users.find((u) => u.id === req.user!.id);
      await createNotification(
        topic.supervisorId,
        `${student?.name || "Student"} uploaded proposal draft document: "${newProposal.fileName}"`,
        "info"
      );

      const advisor = users.find((u) => u.id === topic.supervisorId);
      if (advisor) {
        await sendEmailNotification(
          advisor.email,
          `Proposal Document Uploaded — ${student?.name || "Student"}`,
          `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #4f46e5; margin-top: 0;">New Proposal File Available</h2>
              <p>Dear <strong>${advisor.name}</strong>,</p>
              <p>Your supervised student <strong>${student?.name || "Student"}</strong> has uploaded a project proposal document:</p>
              <div style="background-color: #f9fafb; padding: 12px; border-radius: 4px; margin: 15px 0;">
                <p style="margin: 0 0 6px 0;"><strong>File Name:</strong> ${newProposal.fileName}</p>
                <p style="margin: 0;"><strong>Uploaded At:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              <p>Please log in to review the script and leave academic feedback.</p>
            </div>
          `
        );
      }

      res.status(201).json({ message: "Proposal file saved and distributed to supervisor successfully.", proposal: newProposal });
    } catch (error) {
      console.error("Proposal upload backend error:", error);
      res.status(500).json({ error: "Failed to upload and submit proposal metadata." });
    }
  }
);

// Review proposal document
app.put("/api/proposals/:id/review", authenticateToken, requireRole(["supervisor", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { status, feedback } = req.body;
    const { id } = req.params;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Select positive decision approval or rejection." });
    }

    const proposals = await db.getProposals();
    const propIndex = proposals.findIndex((p) => p.id === id);

    if (propIndex === -1) {
      return res.status(404).json({ error: "Proposal document not found in system registers." });
    }

    const proposal = proposals[propIndex];
    const topics = await db.getTopics();
    const topic = topics.find((t) => t.id === proposal.topicId);

    if (!topic) {
      return res.status(404).json({ error: "Causal topic records missing." });
    }

    if (req.user!.role === "supervisor" && topic.supervisorId !== req.user!.id) {
      return res.status(403).json({ error: "You are not designated to review this student's proposal." });
    }

    proposals[propIndex].status = status;
    proposals[propIndex].feedback = feedback || "";
    await db.saveProposals(proposals);

    // Notify student
    await createNotification(
      topic.studentId,
      `Your proposal file "${proposal.fileName}" was rated as [${status.toUpperCase()}].`,
      status === "approved" ? "success" : "warning"
    );

    const users = await db.getUsers();
    const student = users.find((u) => u.id === topic.studentId);
    if (student) {
      await sendEmailNotification(
        student.email,
        `Proposal Progress: [${status.toUpperCase()}] — Supervision System`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: ${status === "approved" ? "#16a34a" : "#dc2626"}; margin-top: 0;">Proposal Decision: ${status.toUpperCase()}</h2>
            <p>Dear <strong>${student.name}</strong>,</p>
            <p>Your academic supervisor has processed the review cycles on your scientific draft <strong>${proposal.fileName}</strong>.</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p><strong>Review Result:</strong> <span style="font-weight: bold; color: ${status === "approved" ? "#16a34a" : "#dc2626"};">${status.toUpperCase()}</span></p>
              <p><strong>Educator Comments:</strong> ${feedback || "No specific comments registered."}</p>
            </div>
            <p>Logs are available in your portal session dashboard.</p>
          </div>
        `
      );
    }

    res.json({ message: `Proposal document review has been completed as '${status}'.`, proposal: proposals[propIndex] });
  } catch (error) {
    res.status(500).json({ error: "Crashed editing proposal reviews." });
  }
});


// ==========================================
// SHARED GENERAL DOCUMENTS & MATERIALS
// ==========================================

// Get list of shared documents
app.get("/api/documents", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const documents = await db.getDocuments();
    const users = await db.getUsers();

    let myDocs = [];
    if (req.user!.role === "student") {
      myDocs = documents.filter((d) => d.studentId === req.user!.id);
    } else if (req.user!.role === "supervisor") {
      // Find students supervised by me
      const supervisees = users.filter((u) => u.role === "student" && u.supervisorId === req.user!.id);
      const superviseeIds = supervisees.map((s) => s.id);
      myDocs = documents.filter((d) => superviseeIds.includes(d.studentId));
    } else {
      // Admin sees everything
      myDocs = documents;
    }

    const enrichedDocs = myDocs.map((doc) => {
      const student = users.find((u) => u.id === doc.studentId);
      return {
        ...doc,
        studentName: student ? student.name : "Unknown Student",
        studentMatric: student ? (student.matricNumber || "N/A") : "N/A",
      };
    });

    res.json(enrichedDocs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch shared documents." });
  }
});

// Student uploads a custom general document/file
app.post("/api/documents", authenticateToken, requireRole(["student"]), (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "File upload failed." });
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  try {
    const tag = req.body.tag || "General Materials";
    let fileName = "";
    let fileUrl = "";
    let fileSize = "";
    let contentType = "";

    if (req.file) {
      fileName = req.file.originalname;
      fileUrl = `/uploads/${req.file.filename}`;
      fileSize = (req.file.size / (1024 * 1024)).toFixed(2) + " MB";
      contentType = req.file.mimetype;
    } else if (req.body.fileDataUrl) {
      fileName = req.body.fileName || "document.pdf";
      const savedOrRaw = req.body.fileDataUrl;
      if (savedOrRaw.startsWith("data:")) {
        const saved = await saveBase64ToFile(savedOrRaw, fileName);
        fileUrl = saved.url;
        fileSize = saved.size;
      } else {
        fileUrl = savedOrRaw;
        fileSize = req.body.fileSize || "1.0 MB";
      }
      contentType = req.body.contentType || "application/pdf";
    } else {
      return res.status(400).json({ error: "No actual file was received." });
    }


    const documents = await db.getDocuments();

    const newDoc = {
      id: generateId("doc"),
      studentId: req.user!.id,
      fileName,
      fileUrl,
      fileSize,
      contentType,
      tag,
      feedback: "",
      uploadedAt: new Date().toISOString()
    };

    documents.push(newDoc);
    await db.saveDocuments(documents);

    // Notify advisor
    const users = await db.getUsers();
    const student = users.find((u) => u.id === req.user!.id);
    if (student && student.supervisorId) {
      await createNotification(
        student.supervisorId,
        `Student ${student.name} shared a new file: "${fileName}" [${tag}]`,
        "info"
      );

      const advisor = users.find((u) => u.id === student.supervisorId);
      if (advisor) {
        await sendEmailNotification(
          advisor.email,
          `New File Shared — ${student.name}`,
          `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #2563eb; margin-top: 0;">Student Shared a New Document</h2>
              <p>Dear <strong>${advisor.name}</strong>,</p>
              <p>Your supervised student <strong>${student.name}</strong> has shared a new document for your review and grade:</p>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 15px 0;">
                <p style="margin: 0 0 8px 0;"><strong>File Name:</strong> ${fileName}</p>
                <p style="margin: 0 0 8px 0;"><strong>Category / Tag:</strong> ${tag}</p>
                <p style="margin: 0 0 0 0;"><strong>File Size:</strong> ${fileSize}</p>
              </div>
              <p>Please log into your supervisor dashboard to preview, download, and log formal grade/feedback comments about this document.</p>
              <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Final Year Supervisions Project Office</p>
            </div>
          `
        );
      }
    }

    res.status(201).json({ message: "Document shared successfully with your supervisor.", document: newDoc });
  } catch (error) {
    console.error("Shared document upload error:", error);
    res.status(500).json({ error: "Failed to upload and share document." });
  }
});

// Student deletes an uploaded custom document
app.delete("/api/documents/:id", authenticateToken, requireRole(["student"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const documents = await db.getDocuments();
    const docIndex = documents.findIndex((d) => d.id === id);

    if (docIndex === -1) {
      return res.status(404).json({ error: "Document not found." });
    }

    if (documents[docIndex].studentId !== req.user!.id) {
      return res.status(403).json({ error: "Not authorized to delete this document." });
    }

    documents.splice(docIndex, 1);
    await db.saveDocuments(documents);

    res.json({ message: "Document deleted successfully." });
  } catch (error) {
    console.error("Shared document delete error:", error);
    res.status(500).json({ error: "Failed to delete document." });
  }
});

// Supervisor leaves feedback/review comments on a document
app.put("/api/documents/:id/feedback", authenticateToken, requireRole(["supervisor", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    const documents = await db.getDocuments();
    const docIndex = documents.findIndex((d) => d.id === id);

    if (docIndex === -1) {
      return res.status(404).json({ error: "Document of interest not found." });
    }

    documents[docIndex].feedback = feedback || "";
    await db.saveDocuments(documents);

    // Notify student
    const doc = documents[docIndex];
    await createNotification(
      doc.studentId,
      `Your lecturer reviewed your shared file "${doc.fileName}" and left feedback.`,
      "success"
    );

    const users = await db.getUsers();
    const student = users.find((u) => u.id === doc.studentId);
    const supervisor = users.find((u) => u.id === req.user!.id);
    const supervisorName = supervisor ? supervisor.name : "Your Supervisor";

    if (student) {
      await sendEmailNotification(
        student.email,
        `Document Feedback commentary: "${doc.fileName}" — Final Year Supervision`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #10b981; margin-top: 0;">New Document Feedback Logged</h2>
            <p>Dear <strong>${student.name}</strong>,</p>
            <p>Your academic supervisor (<strong>${supervisorName}</strong>) has reviewed your shared document <strong>${doc.fileName}</strong> and submitted formal feedback remarks:</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 15px 0;">
              <p><strong>Document ID:</strong> <code>${doc.id}</code></p>
              <p><strong>Classification / Tag:</strong> ${doc.tag}</p>
              <p><strong>Advisor Feedback:</strong></p>
              <p style="white-space: pre-line; color: #1f2937; background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #f3f4f6;">${feedback || "No comment description provided."}</p>
            </div>
            <p>Please connect to your student portal terminal to read full review details and carry out required adjustments.</p>
            <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Autonomous Notification Module</p>
          </div>
        `
      );
    }

    res.json({ message: "Feedback saved and distributed successfully.", document: documents[docIndex] });
  } catch (error) {
    console.error("Shared document feedback error:", error);
    res.status(500).json({ error: "Failed to record advisor feedback comments." });
  }
});

// ==========================================================
// ONLINE POWER POINT PRESENTATION MANAGEMENT SYSTEM
// ==========================================================

// 1. Get List of Presentation Requests
app.get("/api/presentations", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const presentations = await db.getPresentations();
    const users = await db.getUsers();

    let myPresentations = [];
    if (req.user!.role === "student") {
      myPresentations = presentations.filter((p) => p.studentId === req.user!.id);
    } else if (req.user!.role === "supervisor") {
      myPresentations = presentations.filter((p) => p.supervisorId === req.user!.id);
    } else {
      myPresentations = presentations;
    }

    const enriched = myPresentations.map((p) => {
      const student = users.find((u) => u.id === p.studentId);
      const supervisor = users.find((u) => u.id === p.supervisorId);
      return {
        ...p,
        studentName: student ? student.name : "Unknown Student",
        studentMatric: student ? (student.matricNumber || "N/A") : "N/A",
        supervisorName: supervisor ? supervisor.name : "Unknown Supervisor"
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error("Error fetching presentations:", error);
    res.status(500).json({ error: "Failed to fetch presentations." });
  }
});

// 2. Create a PowerPoint Presentation Request
app.post("/api/presentations", authenticateToken, requireRole(["supervisor", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, title, description, dueDate, meetingUrl } = req.body;
    if (!studentId || !title || !description || !dueDate) {
      return res.status(400).json({ error: "Missing required presentation fields (studentId, title, description, dueDate)." });
    }

    const presentations = await db.getPresentations();
    const newPresentation = {
      id: `pres_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      supervisorId: req.user!.id,
      studentId,
      title,
      description,
      dueDate,
      status: "pending" as const,
      meetingUrl: meetingUrl || "",
      createdAt: new Date().toISOString()
    };

    presentations.unshift(newPresentation);
    await db.savePresentations(presentations);

    // Notify student of request
    await createNotification(
      studentId,
      `Your supervisor requested a new online PowerPoint presentation: "${title}"`,
      "warning"
    );

    const users = await db.getUsers();
    const student = users.find((u) => u.id === studentId);
    const supervisor = users.find((u) => u.id === req.user!.id);
    const supervisorName = supervisor ? supervisor.name : "Your Supervisor";

    if (student) {
      await sendEmailNotification(
        student.email,
        `New PowerPoint Presentation Request: "${title}"`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #6366f1; margin-top: 0;">Online Presentation Requested</h2>
            <p>Dear <strong>${student.name}</strong>,</p>
            <p>Your research advisor <strong>${supervisorName}</strong> has scheduled a mandatory online PowerPoint presentation request for your project work.</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 15px 0;">
              <p><strong>Topic Title:</strong> <strong>${title}</strong></p>
              <p><strong>Presentation Description:</strong></p>
              <p style="color: #4b5563;">${description}</p>
              <p><strong>Submission Target Date:</strong> <span style="color: #dc2626; font-weight: bold;">${dueDate}</span></p>
              ${meetingUrl ? `<p><strong>Online Meeting URL Session:</strong> <a href="${meetingUrl}" target="_blank" style="color: #3b82f6; font-weight: bold; text-decoration: underline;">Join Room</a></p>` : ""}
            </div>
            <p>Please log in to your portal to submit online presentation slides before the due date.</p>
            <p style="margin-top: 25px; font-size: 11px; color: #9ca3af;">Automated Supervision Platform System</p>
          </div>
        `
      );
    }

    res.status(201).json(newPresentation);
  } catch (error) {
    console.error("Error creating presentation request:", error);
    res.status(500).json({ error: "Failed to schedule online PowerPoint presentation request." });
  }
});

// 3. Student Submits Slides / PowerPoint
app.put("/api/presentations/:id/submit", authenticateToken, requireRole(["student"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { slidesUrl, fileDataUrl, fileName, fileSize } = req.body;

    if (!slidesUrl && !fileDataUrl) {
      return res.status(400).json({ error: "Please provide either an online presentation link or upload slides files." });
    }

    const presentations = await db.getPresentations();
    const presIndex = presentations.findIndex((p) => p.id === id);

    if (presIndex === -1) {
      return res.status(404).json({ error: "Presentation request not found." });
    }

    const pres = presentations[presIndex];
    if (pres.studentId !== req.user!.id) {
      return res.status(403).json({ error: "You are not authorized to submit for this presentation request." });
    }

    // Update fields
    if (slidesUrl) {
      pres.slidesUrl = slidesUrl;
    }
    if (fileDataUrl) {
      if (fileDataUrl.startsWith("data:")) {
        const saved = await saveBase64ToFile(fileDataUrl, fileName || "Presentation.pptx");
        pres.fileUrl = saved.url;
        pres.fileName = fileName || "Presentation.pptx";
      } else {
        pres.fileUrl = fileDataUrl;
        pres.fileName = fileName || "Presentation.pptx";
      }
    }


    pres.status = "submitted";
    await db.savePresentations(presentations);

    // Notify supervisor
    await createNotification(
      pres.supervisorId,
      `Student submitted online PowerPoint slides for task: "${pres.title}"`,
      "success"
    );

    const users = await db.getUsers();
    const supervisor = users.find((u) => u.id === pres.supervisorId);
    const student = users.find((u) => u.id === req.user!.id);
    const studentName = student ? student.name : "Your student";

    if (supervisor) {
      await sendEmailNotification(
        supervisor.email,
        `Student Online PowerPoint Slides Submitted: "${pres.title}"`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #10b981; margin-top: 0;">Presentation Slides Submitted</h2>
            <p>Dear <strong>${supervisor.name}</strong>,</p>
            <p>Your student <strong>${studentName}</strong> has uploaded materials / linked an online slideshow presentation for the task <strong>"${pres.title}"</strong>.</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 15px 0;">
              ${slidesUrl ? `<p><strong>Slides Online View Link:</strong> <a href="${slidesUrl}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: bold;">Browse PowerPoint / Google Slides</a></p>` : ""}
              ${fileName ? `<p><strong>Uploaded Physical Slide Deck:</strong> <code>${fileName}</code> (${fileSize || "Unknown size"})</p>` : ""}
            </div>
            <p>Please access your advisor desk, review the slideshow, and mark approval comments or request modifications.</p>
            <p style="margin-top: 25px; font-size: 11px; color: #9ca3af;">Automated Supervision Platform System</p>
          </div>
        `
      );
    }

    res.json(pres);
  } catch (error) {
    console.error("Error submitting presentation slides:", error);
    res.status(500).json({ error: "Failed to submit presentation slides." });
  }
});

// 4. Supervisor Reviews Presentation (Approve / Revision)
app.put("/api/presentations/:id/review", authenticateToken, requireRole(["supervisor", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;

    if (!status || !["approved", "revision"].includes(status)) {
      return res.status(400).json({ error: "Invalid review status. Must be approved or revision." });
    }

    const presentations = await db.getPresentations();
    const presIndex = presentations.findIndex((p) => p.id === id);

    if (presIndex === -1) {
      return res.status(404).json({ error: "Presentation request not found." });
    }

    const pres = presentations[presIndex];
    if (pres.supervisorId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ error: "You are not authorized to review this presentation." });
    }

    pres.status = status;
    pres.feedback = feedback || "";
    await db.savePresentations(presentations);

    // Notify student
    await createNotification(
      pres.studentId,
      `Your PowerPoint slides for "${pres.title}" were reviewed by your supervisor (Status: ${status.toUpperCase()})`,
      status === "approved" ? "success" : "warning"
    );

    const users = await db.getUsers();
    const student = users.find((u) => u.id === pres.studentId);
    const supervisor = users.find((u) => u.id === req.user!.id);
    const supervisorName = supervisor ? supervisor.name : "Your Supervisor";

    if (student) {
      await sendEmailNotification(
        student.email,
        `Academic Review Update: "${pres.title}" PowerPoint Slide Deck Content`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: ${status === "approved" ? "#10b981" : "#f59e0b"}; margin-top: 0;">Presentation Review Outputed</h2>
            <p>Dear <strong>${student.name}</strong>,</p>
            <p>Your supervisor <strong>${supervisorName}</strong> has examined your slides/presentation draft for <strong>"${pres.title}"</strong> and assigned the status as: <strong>${status.toUpperCase()}</strong>.</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 15px 0;">
              <p><strong>Review Evaluation:</strong> <span style="font-weight: bold; color: ${status === "approved" ? "#10b981" : "#d97706"};">${status.toUpperCase()}</span></p>
              <p><strong>Feedback Comments:</strong></p>
              <p style="white-space: pre-line; background: #fff; border: 1px solid #f3f4f6; padding: 10px; border-radius: 4px; color: #1e293b;">${feedback || "No comments attached."}</p>
            </div>
            <p>${status === "approved" ? "Great job! Your presentation slides are officially approved." : "Please revise your slides in accordance with feedback and submit updates cleanly."}</p>
            <p style="margin-top: 25px; font-size: 11px; color: #9ca3af;">Automated Supervision Platform System</p>
          </div>
        `
      );
    }

    res.json(pres);
  } catch (error) {
    console.error("Error reviewing presentation slides:", error);
    res.status(500).json({ error: "Failed to record advisor presentation review." });
  }
});


// ==========================================================
// SCHEDULING & MEETING SYSTEMS
// ==========================================

// Create Meeting / Bookings
app.post("/api/schedules", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { title, meetingDate, time, endTime, venue, studentId, supervisorId } = req.body;

    if (!title || !meetingDate || !time || !endTime || !venue) {
      return res.status(400).json({ error: "Missing required booking details (title, meetingDate, time, endTime, venue)." });
    }

    // Parse start and end times to calculate duration in minutes
    const [startH, startM] = time.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60; // handle overnight crossover
    }

    const meetingDuration = endMinutes - startMinutes;
    if (meetingDuration < 15) {
      return res.status(400).json({ error: "Supervision meetings must be scheduled for a range of at least 15 minutes." });
    }

    const users = await db.getUsers();
    let computedStudentId = "";
    let computedSupervisorId = "";

    if (req.user!.role === "student") {
      computedStudentId = req.user!.id;
      const studentObj = users.find((u) => u.id === computedStudentId);
      if (!studentObj || !studentObj.supervisorId) {
        return res.status(400).json({ error: "You cannot schedule a meeting without an assigned supervisor." });
      }
      computedSupervisorId = studentObj.supervisorId;
    } else {
      // Supervisor or Admin booking
      if (!studentId) {
        return res.status(400).json({ error: "Please choose which student group or user to book with." });
      }
      computedStudentId = studentId;
      computedSupervisorId = req.user!.role === "supervisor" ? req.user!.id : (supervisorId || "");
    }

    const schedules = await db.getSchedules();

    if (computedStudentId === "all") {
      const targetStudents = users.filter((u) => u.role === "student" && u.supervisorId === computedSupervisorId);
      if (targetStudents.length === 0) {
        return res.status(400).json({ error: "You do not have any assigned students to schedule a meeting with." });
      }

      const initiatorName = users.find((u) => u.id === req.user!.id)?.name || "Academic User";
      const newSchedules: Schedule[] = [];

      for (const s of targetStudents) {
        const newSch: Schedule = {
          id: generateId("sch"),
          title,
          meetingDate,
          time,
          endTime,
          duration: meetingDuration,
          venue,
          studentId: s.id,
          supervisorId: computedSupervisorId,
          status: "approved",
          createdAt: new Date().toISOString(),
        };
        schedules.push(newSch);
        newSchedules.push(newSch);

        // Notifications Delivery
        await createNotification(
          s.id,
          `Supervision schedule proposed by ${initiatorName}: "${title}" at ${meetingDate} ${time}`,
          "info"
        );

        const emailTemplate = emailTemplates.meetingScheduled(
          req.user!.role,
          initiatorName,
          title,
          meetingDate,
          time,
          venue
        );
        await sendEmailNotification(s.email, emailTemplate.subject, emailTemplate.html);
      }

      await db.saveSchedules(schedules);
      return res.status(201).json({ message: "Supervision meetings registered successfully for all students.", schedules: newSchedules });
    }

    const newSchedule: Schedule = {
      id: generateId("sch"),
      title,
      meetingDate,
      time,
      endTime,
      duration: meetingDuration,
      venue,
      studentId: computedStudentId,
      supervisorId: computedSupervisorId,
      status: req.user!.role === "student" ? "pending" : "approved",
      createdAt: new Date().toISOString(),
    };

    schedules.push(newSchedule);
    await db.saveSchedules(schedules);


    // Notifications Delivery
    const opponentId = req.user!.role === "student" ? computedSupervisorId : computedStudentId;
    const initiatorName = users.find((u) => u.id === req.user!.id)?.name || "Academic User";
    const opponentUser = users.find((u) => u.id === opponentId);

    await createNotification(
      opponentId,
      `Supervision schedule proposed by ${initiatorName}: "${title}" at ${meetingDate} ${time}`,
      "info"
    );

    if (opponentUser) {
      const emailTemplate = emailTemplates.meetingScheduled(
        req.user!.role,
        initiatorName,
        title,
        meetingDate,
        time,
        venue
      );
      await sendEmailNotification(opponentUser.email, emailTemplate.subject, emailTemplate.html);
    }

    res.status(201).json({ message: "Supervision meeting registered successfully.", schedule: newSchedule });
  } catch (error) {
    res.status(500).json({ error: "Scheduling failed due to a server error." });
  }
});

// Reschedule or Update status (Approve/Reject/Complete/Cancel)
app.put("/api/schedules/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!status || !["approved", "rejected", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status state supplied." });
    }

    const schedules = await db.getSchedules();
    const scheduleIndex = schedules.findIndex((s) => s.id === id);

    if (scheduleIndex === -1) {
      return res.status(404).json({ error: "Meeting coordinate not found." });
    }

    const schedule = schedules[scheduleIndex];

    // Authorization checks: student or supervisor can cancel/complete meetings.
    // Student can approve of supervisor meeting or vice versa.
    const isStudent = req.user!.id === schedule.studentId;
    const isSupervisor = req.user!.id === schedule.supervisorId;
    const isAdmin = req.user!.role === "admin";

    if (!isStudent && !isSupervisor && !isAdmin) {
      return res.status(403).json({ error: "You are not authorized to update this scheduling coordinate." });
    }

    schedules[scheduleIndex].status = status;
    await db.saveSchedules(schedules);

    // Notify other party
    const opponentId = isStudent ? schedule.supervisorId : schedule.studentId;
    const users = await db.getUsers();
    const executorName = users.find((u) => u.id === req.user!.id)?.name || "Academic Partner";
    const opponentObj = users.find((u) => u.id === opponentId);

    await createNotification(
      opponentId,
      `Supervision Scheduled session "${schedule.title}" updated to [${status.toUpperCase()}] by ${executorName}.`,
      status === "approved" ? "success" : "info"
    );

    if (opponentObj) {
      const template = emailTemplates.meetingStatusUpdated(req.user!.role, executorName, schedule.title, status);
      await sendEmailNotification(opponentObj.email, template.subject, template.html);
    }

    res.json({ message: `Schedule labeled as '${status}' successfully.`, schedule: schedules[scheduleIndex] });
  } catch (error) {
    res.status(500).json({ error: "Error adjusting schedule indices." });
  }
});

// Delete a cancelled schedule (admin only)
app.delete("/api/schedules/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can permanently delete schedule records." });
    }
    const { id } = req.params;
    const schedules = await db.getSchedules();
    const idx = schedules.findIndex((s) => s.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Schedule record not found." });
    }
    if (schedules[idx].status !== "cancelled") {
      return res.status(400).json({ error: "Only cancelled sessions can be deleted." });
    }
    schedules.splice(idx, 1);
    await db.saveSchedules(schedules);
    res.json({ message: "Cancelled session deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete schedule record." });
  }
});

// Get scheduling list sorted
app.get("/api/schedules", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const schedules = await db.getSchedules();
    const users = await db.getUsers();

    let mySchedules: Schedule[] = [];

    if (req.user!.role === "student") {
      mySchedules = schedules.filter((s) => s.studentId === req.user!.id);
    } else if (req.user!.role === "supervisor") {
      mySchedules = schedules.filter((s) => s.supervisorId === req.user!.id);
    } else if (req.user!.role === "admin") {
      mySchedules = schedules;
    }

    // Sort by chronological order
    mySchedules.sort((a, b) => new Date(a.meetingDate + "T" + a.time).getTime() - new Date(b.meetingDate + "T" + b.time).getTime());

    const enrichedSchedules = mySchedules.map((sch) => {
      const studentObj = users.find((u) => u.id === sch.studentId);
      const supervisorObj = users.find((u) => u.id === sch.supervisorId);

      return {
        ...sch,
        studentName: studentObj ? studentObj.name : "Student (Suspended/Deleted)",
        studentMatric: studentObj ? studentObj.matricNumber : "N/A",
        supervisorName: supervisorObj ? supervisorObj.name : "Supervisor (Suspended/Deleted)",
      };
    });

    res.json(enrichedSchedules);
  } catch (error) {
    res.status(500).json({ error: "Failed to download scheduling calendar." });
  }
});


// ==========================================
// IN-APP NOTIFICATIONS
// ==========================================

// Get notifications
app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await db.getNotifications();
    const userNotifications = notifications.filter((n) => n.recipientId === req.user!.id);
    res.json(userNotifications);
  } catch (error) {
    res.status(500).json({ error: "Could not fetch notifications." });
  }
});

// Mark single as read
app.put("/api/notifications/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const notifications = await db.getNotifications();
    const notificationIndex = notifications.findIndex((n) => n.id === id);

    if (notificationIndex === -1) {
      return res.status(404).json({ error: "Notification not found." });
    }

    if (notifications[notificationIndex].recipientId !== req.user!.id) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    notifications[notificationIndex].read = true;
    await db.saveNotifications(notifications);

    res.json({ message: "Notification marked as read." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification." });
  }
});

// Clear all notifications
app.put("/api/notifications/clear-all", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await db.getNotifications();
    const updated = notifications.map((n) => {
      if (n.recipientId === req.user!.id) {
        return { ...n, read: true };
      }
      return n;
    });

    await db.saveNotifications(updated);
    res.json({ message: "All notifications declared read." });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear notifications." });
  }
});


// ==========================================
// ADMIN DASHBOARD FEATURES
// ==========================================

// Get all users (Admin & Supervisor Privileged)
app.get("/api/admin/users", authenticateToken, requireRole(["admin", "supervisor"]), async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.getUsers();
    // Exclude security credential from standard transfer index, but keep others
    const sanitized = users.map(({ password, ...u }) => u);
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: "Failed to download system user registry." });
  }
});

// Register / Create new user (Admins manually injecting students or lecturers)
app.post("/api/admin/users", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, department, matricNumber, supervisorId } = req.body;

    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({ error: "All properties (name, email, password, role, department) are compulsory." });
    }

    const users = await db.getUsers();
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: "An account with this email address already exists." });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser: User = {
      id: generateId("usr"),
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      department,
      matricNumber: role === "student" ? matricNumber : undefined,
      supervisorId: role === "student" ? supervisorId : undefined,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await db.saveUsers(users);

    // Send Registered Welcome emails
    const template = emailTemplates.studentRegistered(newUser.name, newUser.email, newUser.role);
    await sendEmailNotification(newUser.email, template.subject, template.html);

    res.status(201).json({ message: "Academic user profile built successfully.", user: newUser });
  } catch (error) {
    res.status(500).json({ error: "An unexpected error occurred while creating that profile." });
  }
});

// Update user details (Admins assigning supervisors, reassigning, editing details)
app.put("/api/admin/users/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, role, department, matricNumber, supervisorId, password } = req.body;
    const { id } = req.params;

    const users = await db.getUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: "Academic user not found." });
    }

    // Apply adjustments
    if (name) users[userIndex].name = name;
    if (email) users[userIndex].email = email.toLowerCase();
    if (role) users[userIndex].role = role;
    if (department) users[userIndex].department = department;

    if (users[userIndex].role === "student") {
      if (matricNumber) users[userIndex].matricNumber = matricNumber;
      if (supervisorId !== undefined) users[userIndex].supervisorId = supervisorId;
    }

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      users[userIndex].password = bcrypt.hashSync(password, salt);
    }

    await db.saveUsers(users);

    res.json({ message: "User account modified successfully.", user: users[userIndex] });
  } catch (error) {
    res.status(500).json({ error: "Error editing user profile coordinates." });
  }
});

// Delete user account
app.delete("/api/admin/users/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    let users = await db.getUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: "User accounts missing." });
    }

    if (id === req.user!.id) {
      return res.status(400).json({ error: "Security Halt. You cannot destroy your own primary administrator workspace session." });
    }

    users = users.filter((u) => u.id !== id);
    await db.saveUsers(users);

    res.json({ message: "Academic registry block removed from live catalogs." });
  } catch (e) {
    res.status(500).json({ error: "Error removing account registry." });
  }
});

// Analytics Calculator Dashboard stats (Admin Dashboard)
app.get("/api/admin/stats", authenticateToken, requireRole(["admin", "supervisor"]), async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.getUsers();
    const topics = await db.getTopics();
    const proposals = await db.getProposals();
    const schedules = await db.getSchedules();

    const students = users.filter((u) => u.role === "student");
    const supervisors = users.filter((u) => u.role === "supervisor");

    // Overall approvals tally
    const approvedTopicsCount = topics.filter((t) => t.status === "approved").length;
    const pendingTopicsCount = topics.filter((t) => t.status === "pending").length;
    const rejectedTopicsCount = topics.filter((t) => t.status === "rejected").length;
    const revisionTopicsCount = topics.filter((t) => t.status === "revision").length;

    // Proposal documents counts
    const approvedProposals = proposals.filter((p) => p.status === "approved").length;
    const pendingProposals = proposals.filter((p) => p.status === "pending").length;

    // Calculate detailed supervisor workload metrics
    const workloadMap = supervisors.map((sv) => {
      const assignedStudents = students.filter((s) => s.supervisorId === sv.id).length;
      const supervisorTopics = topics.filter((t) => t.supervisorId === sv.id);
      const approvedTopics = supervisorTopics.filter((t) => t.status === "approved").length;

      return {
        id: sv.id,
        name: sv.name,
        department: sv.department,
        email: sv.email,
        assignedStudentsCount: assignedStudents,
        approvedTopicsCount: approvedTopics,
      };
    });

    res.json({
      summary: {
        totalStudents: students.length,
        totalSupervisors: supervisors.length,
        totalTopics: topics.length,
        totalProposals: proposals.length,
        totalSchedules: schedules.length,
        topicStats: {
          approved: approvedTopicsCount,
          pending: pendingTopicsCount,
          rejected: rejectedTopicsCount,
          revision: revisionTopicsCount,
        },
        proposalStats: {
          approved: approvedProposals,
          pending: pendingProposals,
        },
        smtp: {
          configured: !!process.env.SMTP_HOST,
          host: process.env.SMTP_HOST || "Not Configured",
          port: process.env.SMTP_PORT || "N/A",
          user: process.env.SMTP_USER || "None"
        }
      },
      workloadMap,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to recalculate administrative analytics charts." });
  }
});


// ==========================================
// SIMULATED EMAIL INBOX CLIENT ENDPOINT
// ==========================================

// Pull log register of sent emails so user can visually see emails in-app
app.get("/api/admin/emails", async (req: Request, res: Response) => {
  try {
    const emails = await db.getEmails();
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: "Failed to download simulation communication registers." });
  }
});

// Clear simulated email log
app.delete("/api/admin/emails/clear", async (req: Request, res: Response) => {
  try {
    await db.saveEmails([]);
    res.json({ message: "SMTP simulation logs cleared successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to purge SMTP logs." });
  }
});


// ==========================================
// AGORA VIDEO CALL TOKEN GENERATION
// ==========================================

// Robust DJB2 string hashing to prevent UID collisions when multiple students join Agora
function getAgoraNumericUid(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (Math.abs(hash) % 89999) + 1;
}

// Get mapping of numeric UIDs to real names for video calls
app.get("/api/users/map", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.getUsers();
    const mapping: Record<number, string> = {};
    users.forEach((u) => {
      const baseUid = getAgoraNumericUid(u.id + (u.email || ""));
      mapping[baseUid] = u.name;
    });
    res.json(mapping);
  } catch (error) {
    console.error("Error generating user name map:", error);
    res.status(500).json({ error: "Failed to generate user mapping." });
  }
});

// Generate Agora RTC token for video call sessions (authenticated users only)
app.get("/api/agora/token", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const APP_ID = process.env.AGORA_APP_ID;
    const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

    if (!APP_ID || !APP_CERTIFICATE) {
      return res.status(500).json({ error: "Agora credentials are not configured on the server. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env" });
    }

    const channelName = req.query.channelName as string;
    if (!channelName) {
      return res.status(400).json({ error: "channelName query parameter is required." });
    }

    // Lookup full user object to ensure identical hash input as users/map
    const allUsers = await db.getUsers();
    const curUser = allUsers.find(u => u.id === req.user!.id) || { id: req.user!.id, email: req.user!.email };

    const baseUid = getAgoraNumericUid(curUser.id + (curUser.email || ""));
    const isScreen = req.query.isScreen === "true";
    const uid = isScreen ? baseUid + 100000 : baseUid;
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTimestamp = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpireTimestamp
    );

    res.json({ token, uid, channelName, appId: APP_ID });
  } catch (error) {
    console.error("Agora token generation error:", error);
    res.status(500).json({ error: "Failed to generate video call access token." });
  }
});


// ==========================================
// SERVER BOOTSTRAPS & VITE REVERSE PROXY
// ==========================================

async function startServer() {
  // Vite Dev / Prod config integration
  if (process.env.NODE_ENV !== "production") {
    console.log("🛠️  Initializing Vite Middleware in Sandbox Context...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("🚀 Serving production optimized static bundles...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n==========================================`);
    console.log(`✅ Academic Supervision Server Initialized successfully!`);
    console.log(`✅ Running at: http://localhost:${PORT}`);
    console.log(`==========================================\n`);
  });
}

startServer().catch((err) => {
  console.error("FATAL: Academic supervision server failed to launch:", err);
});
