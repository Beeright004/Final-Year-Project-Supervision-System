import { promises as fs } from "fs";
import path from "path";

// Ensure data folder exists
const DATA_DIR = path.join(process.cwd(), "data");

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // stored as hashed string
  role: "student" | "supervisor" | "admin";
  matricNumber?: string; // For students
  department: string;
  supervisorId?: string; // For students, references another User (supervisor)
  createdAt: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "revision";
  feedback?: string;
  studentId: string;
  supervisorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  topicId: string;
  fileName: string;
  fileUrl: string; // Base64 or local server path mock for simplicity
  fileSize: string;
  contentType: string; // e.g., application/pdf
  uploadDate: string;
  status: "pending" | "approved" | "rejected";
  feedback?: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  message: string;
  read: boolean;
  type: "info" | "success" | "warning";
  createdAt: string;
}

export interface Schedule {
  id: string;
  meetingDate: string;
  time: string;
  endTime: string;
  duration?: number;
  venue: string;
  supervisorId: string;
  studentId: string;
  title: string;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  createdAt: string;
}

export interface SharedDocument {
  id: string;
  studentId: string;
  studentName?: string;
  fileName: string;
  fileUrl: string;
  fileSize: string;
  contentType: string;
  tag: string; // e.g. "Chapter 1", "Literature Review", etc.
  feedback?: string;
  uploadedAt: string;
}

export interface PresentationRequest {
  id: string;
  supervisorId: string;
  studentId: string;
  title: string;
  description: string;
  dueDate: string;
  status: "pending" | "submitted" | "approved" | "revision";
  meetingUrl?: string;
  slidesUrl?: string;
  fileName?: string;
  fileUrl?: string;
  feedback?: string;
  createdAt: string;
}

export interface PendingOtp {
  email: string;
  otp: string;
  expiresAt: number; // Unix ms timestamp
  details: {
    name: string;
    email: string;
    password: string;
    role: "student" | "supervisor" | "admin";
    matricNumber?: string;
    department: string;
    supervisorId?: string;
  };
}

// Global DB Structure
interface DatabaseSchema {
  users: User[];
  topics: Topic[];
  proposals: Proposal[];
  notifications: Notification[];
  schedules: Schedule[];
  documents: SharedDocument[];
  presentations: PresentationRequest[];
  emails: Array<{
    id: string;
    to: string;
    subject: string;
    html: string;
    sentAt: string;
  }>;
  pendingOtps: PendingOtp[];
}

import crypto from "crypto";
import mongoose, { Schema } from "mongoose";

export function getConsistentObjectId(id: string): mongoose.Types.ObjectId {
  if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
    return new mongoose.Types.ObjectId(id);
  }
  const hash = crypto.createHash("md5").update(id).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hash);
}

// ==========================================
// MONGOOSE SCHEMAS & MODELS
// ==========================================

const MongooseUserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ["student", "supervisor", "admin"] },
  matricNumber: { type: String },
  department: { type: String, required: true },
  supervisorId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  createdAt: { type: String, required: true }
});

const MongooseTopicSchema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, required: true, enum: ["pending", "approved", "rejected", "revision"] },
  feedback: { type: String },
  studentId: { type: String, required: true },
  supervisorId: { type: String, required: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true }
});

const MongooseProposalSchema = new Schema({
  id: { type: String, required: true, unique: true },
  topicId: { type: String, required: true, unique: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileSize: { type: String, required: true },
  contentType: { type: String, required: true },
  uploadDate: { type: String, required: true },
  status: { type: String, required: true, enum: ["pending", "approved", "rejected"] },
  feedback: { type: String }
});

const MongooseNotificationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  recipientId: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, required: true, default: false },
  type: { type: String, required: true, enum: ["info", "success", "warning"] },
  createdAt: { type: String, required: true }
});

const MongooseScheduleSchema = new Schema({
  id: { type: String, required: true, unique: true },
  meetingDate: { type: String, required: true },
  time: { type: String, required: true },
  venue: { type: String, required: true },
  supervisorId: { type: String, required: true },
  studentId: { type: String, required: true },
  title: { type: String, required: true },
  status: { type: String, required: true, enum: ["pending", "approved", "rejected", "completed", "cancelled"] },
  createdAt: { type: String, required: true }
});

const MongooseEmailSchema = new Schema({
  id: { type: String, required: true, unique: true },
  to: { type: String, required: true },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  sentAt: { type: String, required: true }
});

const MongooseDocumentSchema = new Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileSize: { type: String, required: true },
  contentType: { type: String, required: true },
  tag: { type: String, required: true },
  feedback: { type: String },
  uploadedAt: { type: String, required: true }
});

const MongoosePresentationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  supervisorId: { type: String, required: true },
  studentId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: String, required: true },
  status: { type: String, required: true, enum: ["pending", "submitted", "approved", "revision"] },
  meetingUrl: { type: String },
  slidesUrl: { type: String },
  fileName: { type: String },
  fileUrl: { type: String },
  feedback: { type: String },
  createdAt: { type: String, required: true }
});

const MongoosePendingOtpSchema = new Schema({
  email: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  expiresAt: { type: Number, required: true },
  details: { type: Object, required: true }
});

const UserModel = mongoose.models.User || mongoose.model("User", MongooseUserSchema);
const TopicModel = mongoose.models.Topic || mongoose.model("Topic", MongooseTopicSchema);
const ProposalModel = mongoose.models.Proposal || mongoose.model("Proposal", MongooseProposalSchema);
const NotificationModel = mongoose.models.Notification || mongoose.model("Notification", MongooseNotificationSchema);
const ScheduleModel = mongoose.models.Schedule || mongoose.model("Schedule", MongooseScheduleSchema);
const EmailModel = mongoose.models.Email || mongoose.model("Email", MongooseEmailSchema);
const DocumentModel = mongoose.models.Document || mongoose.model("Document", MongooseDocumentSchema);
const PresentationModel = mongoose.models.Presentation || mongoose.model("Presentation", MongoosePresentationSchema);
const PendingOtpModel = mongoose.models.PendingOtp || mongoose.model("PendingOtp", MongoosePendingOtpSchema);

// ==========================================
// FILE-SYSTEM BACKUP DATABASE ENGINE
// ==========================================

class FileDatabase {
  private dbPath = path.join(DATA_DIR, "db.json");
  private memoryDb: DatabaseSchema | null = null;
  private isSaving = false;
  private savePending = false;
  private saveTimeout: NodeJS.Timeout | null = null;


  async initialize() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {
      // Ignored
    }

    try {
      const exists = await fs.stat(this.dbPath).then(() => true).catch(() => false);
      if (!exists) {
        await this.seed();
      } else {
        const data = await fs.readFile(this.dbPath, "utf-8");
        this.memoryDb = JSON.parse(data);
      }
    } catch (e) {
      console.error("Database initialization failed. Re-seeding database.", e);
      await this.seed();
    }
  }

  private async getDb(): Promise<DatabaseSchema> {
    if (!this.memoryDb) {
      await this.initialize();
    }
    if (this.memoryDb && !this.memoryDb.documents) {
      this.memoryDb.documents = [];
    }
    if (this.memoryDb && !this.memoryDb.presentations) {
      this.memoryDb.presentations = [];
    }
    if (this.memoryDb && !this.memoryDb.pendingOtps) {
      this.memoryDb.pendingOtps = [];
    }
    return this.memoryDb!;
  }

  private async saveDb() {
    if (!this.memoryDb) return;

    if (this.isSaving) {
      this.savePending = true;
      return;
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      this.isSaving = true;
      try {
        await fs.writeFile(this.dbPath, JSON.stringify(this.memoryDb, null, 2), "utf-8");
      } catch (err) {
        console.error("Critical: Database persistence error:", err);
      } finally {
        this.isSaving = false;
        if (this.savePending) {
          this.savePending = false;
          this.saveDb();
        }
      }
    }, 500); // 500ms debounce to batch rapid updates
  }


  private async seed() {
    const initialUsers: User[] = [
      {
        id: "usr_admin_heritage15",
        name: "Heritage Oni (Admin)",
        email: "heritageoni15@gmail.com",
        password: "$2b$10$nc9tEmXTnPwwcrGekmL0eOyhpViRhq6CWACGeX2ASiLhunEaoxx36",
        role: "admin",
        department: "Computer Science",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr_admin_heritage",
        name: "Heritage Oni",
        email: "heritageoni16@gmail.com",
        password: "$2b$10$nc9tEmXTnPwwcrGekmL0eOyhpViRhq6CWACGeX2ASiLhunEaoxx36",
        role: "admin",
        department: "Computer Science",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr_stud_1",
        name: "Sunday Bright",
        email: "sunday.bright@student.edu",
        password: "$2b$10$nc9tEmXTnPwwcrGekmL0eOyhpViRhq6CWACGeX2ASiLhunEaoxx36",
        role: "student",
        matricNumber: "210502197",
        department: "Computer Science",
        supervisorId: "usr_sup_olukunle",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr_sup_olukunle",
        name: "Olukunle Adebayo",
        email: "olukunle.adebayo@university.edu",
        password: "$2b$10$nc9tEmXTnPwwcrGekmL0eOyhpViRhq6CWACGeX2ASiLhunEaoxx36",
        role: "supervisor",
        department: "Computer Science",
        createdAt: new Date().toISOString(),
      }
    ];

    const initialTopics: Topic[] = [
      {
        id: "top_demo_1",
        title: "Design and Implementation of a Final Year Project Supervision System",
        description: "A web-based application developed to improve the management of final-year projects in higher institutions. The system serves as a centralized platform where students, supervisors, and administrators can efficiently manage project-related activities.",
        status: "approved",
        studentId: "usr_stud_1",
        supervisorId: "usr_sup_olukunle",
        feedback: "Good topic selection. Please proceed with the proposal document.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];
    const initialProposals: Proposal[] = [];
    const initialSchedules: Schedule[] = [
      {
        id: "sch_demo_1",
        title: "Initial Project Scope Consultation",
        meetingDate: "2026-06-28",
        time: "10:00",
        venue: "Faculty of Computing, Room 205",
        status: "approved",
        studentId: "usr_stud_1",
        supervisorId: "usr_sup_olukunle",
        createdAt: new Date().toISOString(),
      } as any
    ];
    const initialNotifications: Notification[] = [];

    this.memoryDb = {
      users: initialUsers,
      topics: initialTopics,
      proposals: initialProposals,
      notifications: initialNotifications,
      schedules: initialSchedules,
      documents: [],
      presentations: [
        {
          id: "pres_demo_1",
          title: "Mid-Project Progress Presentation",
          description: "Present your current project progress including: system architecture diagram, database schema design, and implementation milestones completed so far. Minimum 15 slides required.",
          dueDate: "2026-06-30",
          meetingUrl: "",
          status: "pending",
          studentId: "usr_stud_1",
          supervisorId: "usr_sup_olukunle",
          studentName: "Sunday Bright",
          studentMatric: "210502197",
          createdAt: new Date().toISOString(),
        }
      ] as any[],
      emails: [],
      pendingOtps: []
    };

    await this.saveDb();
  }

  async getUsers(): Promise<User[]> {
    const db = await this.getDb();
    return db.users;
  }

  async saveUsers(users: User[]): Promise<void> {
    const db = await this.getDb();
    db.users = users;
    await this.saveDb();
  }

  async getTopics(): Promise<Topic[]> {
    const db = await this.getDb();
    return db.topics;
  }

  async saveTopics(topics: Topic[]): Promise<void> {
    const db = await this.getDb();
    db.topics = topics;
    await this.saveDb();
  }

  async getProposals(): Promise<Proposal[]> {
    const db = await this.getDb();
    return db.proposals;
  }

  async saveProposals(proposals: Proposal[]): Promise<void> {
    const db = await this.getDb();
    db.proposals = proposals;
    await this.saveDb();
  }

  async getNotifications(): Promise<Notification[]> {
    const db = await this.getDb();
    return db.notifications;
  }

  async saveNotifications(notifications: Notification[]): Promise<void> {
    const db = await this.getDb();
    db.notifications = notifications;
    await this.saveDb();
  }

  async getSchedules(): Promise<Schedule[]> {
    const db = await this.getDb();
    return db.schedules;
  }

  async saveSchedules(schedules: Schedule[]): Promise<void> {
    const db = await this.getDb();
    db.schedules = schedules;
    await this.saveDb();
  }

  async getEmails(): Promise<any[]> {
    const db = await this.getDb();
    return db.emails;
  }

  async saveEmails(emails: any[]): Promise<void> {
    const db = await this.getDb();
    db.emails = emails;
    await this.saveDb();
  }

  async getDocuments(): Promise<SharedDocument[]> {
    const db = await this.getDb();
    if (!db.documents) db.documents = [];
    return db.documents;
  }

  async saveDocuments(documents: SharedDocument[]): Promise<void> {
    const db = await this.getDb();
    db.documents = documents;
    await this.saveDb();
  }

  async getPresentations(): Promise<PresentationRequest[]> {
    const db = await this.getDb();
    if (!db.presentations) db.presentations = [];
    return db.presentations;
  }

  async savePresentations(presentations: PresentationRequest[]): Promise<void> {
    const db = await this.getDb();
    db.presentations = presentations;
    await this.saveDb();
  }

  async getPendingOtps(): Promise<PendingOtp[]> {
    const db = await this.getDb();
    if (!db.pendingOtps) db.pendingOtps = [];
    // Purge expired OTPs automatically
    const now = Date.now();
    db.pendingOtps = db.pendingOtps.filter((o) => o.expiresAt > now);
    return db.pendingOtps;
  }

  async savePendingOtps(otps: PendingOtp[]): Promise<void> {
    const db = await this.getDb();
    db.pendingOtps = otps;
    await this.saveDb();
  }
}

// ==========================================
// SEEDING AND PERSISTENCE ENGINE DUAL DELEGATE
// ==========================================

async function seedMongoIfEmpty() {
  try {
    const userCount = await UserModel.countDocuments();
    if (userCount > 0) return;

    console.log("🌱 Pristine Database detected! Bootstrapping standard academic seed catalogs to MongoDB Atlas...");

    const initialUsers: User[] = [
      {
        id: "usr_stud_1",
        name: "Sunday Bright",
        email: "beeright004@gmail.com",
        password: "$2b$10$hHw4ldPUCHKKQCJKdFEdG.C23nx8SjIgz1QA9m0.8G7PNIG12RN5.",
        role: "student",
        matricNumber: "210502197",
        department: "Computer Science",
        supervisorId: "usr_sup_olukunle",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr_sup_olukunle",
        name: "Olukunle Adebayo",
        email: "olukunle.adebayo@university.edu",
        password: "$2b$10$hHw4ldPUCHKKQCJKdFEdG.C23nx8SjIgz1QA9m0.8G7PNIG12RN5.",
        role: "supervisor",
        department: "Computer Science",
        createdAt: new Date().toISOString(),
      }
    ];

    const initialTopics: Topic[] = [];
    const initialProposals: Proposal[] = [];
    const initialSchedules: Schedule[] = [];
    const initialNotifications: Notification[] = [];

    await UserModel.insertMany(initialUsers as any[]);
    await TopicModel.insertMany(initialTopics as any[]);
    await ProposalModel.insertMany(initialProposals as any[]);
    await ScheduleModel.insertMany(initialSchedules as any[]);
    await NotificationModel.insertMany(initialNotifications as any[]);

    console.log("❇️ Successfully seeded initial workspace elements to MongoDB Atlas!");
  } catch (error) {
    console.error("❌ Failed to bootstrap initial MongoDB seeds: ", error);
  }
}

class DualDatabase {
  private fileDb = new FileDatabase();
  private isMongoConnected = false;
  private isConnecting = false;
  private lastConnectAttemptTime = 0;
  private lastConnectError: string | null = null;
  private readonly RETRY_COOLDOWN_MS = 60000; // 1 minute cooldown between reconnection attempts

  constructor() {
    this.connectMongo();
  }

  getLastConnectError(): string | null {
    return this.lastConnectError;
  }

  private async connectMongo() {
    const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
    if (!uri) {
      this.lastConnectError = "MONGODB_URI or MONGODB_URL is not set in Vercel settings";
      console.log("ℹ️ MONGODB_URI is not set. Running in Local JSON File Database Fallback mode.");
      return;
    }

    if (this.isConnecting || this.isMongoConnected) return;

    const now = Date.now();
    if (now - this.lastConnectAttemptTime < this.RETRY_COOLDOWN_MS) {
      return;
    }

    this.isConnecting = true;
    this.lastConnectAttemptTime = now;

    try {
      console.log("⚡ Establishing connection with MongoDB Atlas cluster...");
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      this.isMongoConnected = true;
      this.lastConnectError = null;
      console.log("❇️ Successfully established interactive live connection with MongoDB Atlas!");

      // Automatically migrate legacy file-based database to MongoDB Atlas collections
      await this.migrateLegacyDataToMongo();
    } catch (err: any) {
      console.error("❌ Failed to connect with MongoDB Atlas, cascading back to Local Filesystem Sandbox:", err.message);
      this.isMongoConnected = false;
      this.lastConnectError = err.message || "Unknown Mongoose connection error";
    } finally {
      this.isConnecting = false;
    }
  }

  private async migrateLegacyDataToMongo() {
    try {
      console.log("🚚 Initiating automated migration from legacy file-based database to MongoDB Atlas...");
      await this.fileDb.initialize();

      const legacyUsers = await this.fileDb.getUsers();
      const legacyTopics = await this.fileDb.getTopics();
      const legacyProposals = await this.fileDb.getProposals();
      const legacyNotifications = await this.fileDb.getNotifications();
      const legacySchedules = await this.fileDb.getSchedules();
      const legacyEmails = await this.fileDb.getEmails();

      console.log(`📊 Migrating legacy dataset stats - Users: ${legacyUsers.length}, Topics: ${legacyTopics.length}, Proposals: ${legacyProposals.length}, Notifications: ${legacyNotifications.length}, Schedules: ${legacySchedules.length}, Emails: ${legacyEmails.length}`);

      // 1. Migrate Users (with ObjectId ref mapping for supervisorId)
      const userIds = legacyUsers.map(u => u.id);
      await UserModel.deleteMany({ id: { $nin: userIds } });
      await UserModel.deleteMany({ id: { $in: userIds } });
      for (const u of legacyUsers) {
        const mongoUser: any = {
          ...u
        };
        if (u.role === "student" && u.supervisorId) {
          mongoUser.supervisorId = getConsistentObjectId(u.supervisorId);
        } else {
          mongoUser.supervisorId = undefined;
        }
        await UserModel.updateOne(
          { _id: getConsistentObjectId(u.id) },
          { $set: mongoUser },
          { upsert: true }
        );
      }

      // 2. Migrate Topics
      const topicIds = legacyTopics.map(t => t.id);
      await TopicModel.deleteMany({ id: { $nin: topicIds } });
      for (const t of legacyTopics) {
        await TopicModel.updateOne({ id: t.id }, t, { upsert: true });
      }

      // 3. Migrate Proposals
      const proposalIds = legacyProposals.map(p => p.id);
      await ProposalModel.deleteMany({ id: { $nin: proposalIds } });
      for (const p of legacyProposals) {
        await ProposalModel.updateOne({ id: p.id }, p, { upsert: true });
      }

      // 4. Migrate Notifications
      const notificationIds = legacyNotifications.map(n => n.id);
      await NotificationModel.deleteMany({ id: { $nin: notificationIds } });
      for (const n of legacyNotifications) {
        await NotificationModel.updateOne({ id: n.id }, n, { upsert: true });
      }

      // 5. Migrate Schedules
      const scheduleIds = legacySchedules.map(s => s.id);
      await ScheduleModel.deleteMany({ id: { $nin: scheduleIds } });
      for (const s of legacySchedules) {
        await ScheduleModel.updateOne({ id: s.id }, s, { upsert: true });
      }

      // 6. Migrate Emails
      const emailIds = legacyEmails.map(e => e.id);
      await EmailModel.deleteMany({ id: { $nin: emailIds } });
      for (const e of legacyEmails) {
        await EmailModel.updateOne({ id: e.id }, e, { upsert: true });
      }

      // 7. Migrate Documents
      const legacyDocs = await this.fileDb.getDocuments();
      const docIds = legacyDocs.map(d => d.id);
      await DocumentModel.deleteMany({ id: { $nin: docIds } });
      for (const d of legacyDocs) {
        await DocumentModel.updateOne({ id: d.id }, d, { upsert: true });
      }

      // 8. Migrate Presentations
      const legacyPresentations = await this.fileDb.getPresentations();
      const presentationIds = legacyPresentations.map(p => p.id);
      await PresentationModel.deleteMany({ id: { $nin: presentationIds } });
      for (const p of legacyPresentations) {
        await PresentationModel.updateOne({ id: p.id }, p, { upsert: true });
      }

      console.log("❇️ Automated database migration completed successfully!");
    } catch (error: any) {
      console.error("❌ Legacy file-to-Atlas migration encountered error:", error.message || error);
    }
  }

  async checkMongo(): Promise<boolean> {
    if (this.isMongoConnected) return true;
    if (process.env.MONGODB_URI && !this.isConnecting) {
      const now = Date.now();
      if (now - this.lastConnectAttemptTime > this.RETRY_COOLDOWN_MS) {
        await this.connectMongo();
      }
    }
    return this.isMongoConnected;
  }

  async getUsers(): Promise<User[]> {
    if (await this.checkMongo()) {
      const result = await UserModel.find().lean();
      const idMap = new Map<string, string>();
      for (const u of result) {
        idMap.set((u as any)._id.toString(), (u as any).id);
      }

      return result.map((u: any) => {
        const mapped: any = { ...u };
        delete mapped._id;
        delete mapped.__v;
        if (u.supervisorId) {
          const supObjectIdStr = u.supervisorId.toString();
          mapped.supervisorId = idMap.get(supObjectIdStr) || supObjectIdStr;
        }
        return mapped as User;
      });
    }
    return this.fileDb.getUsers();
  }

  async saveUsers(users: User[]): Promise<void> {
    if (await this.checkMongo()) {
      const ids = users.map(u => u.id);
      await UserModel.deleteMany({ id: { $nin: ids } });
      await UserModel.deleteMany({ id: { $in: ids } });
      for (const u of users) {
        const mongoUser: any = {
          ...u
        };
        if (u.role === "student" && u.supervisorId) {
          mongoUser.supervisorId = getConsistentObjectId(u.supervisorId);
        } else {
          mongoUser.supervisorId = undefined;
        }
        await UserModel.updateOne(
          { _id: getConsistentObjectId(u.id) },
          { $set: mongoUser },
          { upsert: true }
        );
      }
      return;
    }
    return this.fileDb.saveUsers(users);
  }

  async getTopics(): Promise<Topic[]> {
    if (await this.checkMongo()) {
      const result = await TopicModel.find().lean();
      return result as unknown as Topic[];
    }
    return this.fileDb.getTopics();
  }

  async saveTopics(topics: Topic[]): Promise<void> {
    if (await this.checkMongo()) {
      const ids = topics.map(t => t.id);
      await TopicModel.deleteMany({ id: { $nin: ids } });
      for (const t of topics) {
        await TopicModel.updateOne({ id: t.id }, t, { upsert: true });
      }
      return;
    }
    return this.fileDb.saveTopics(topics);
  }

  async getProposals(): Promise<Proposal[]> {
    if (await this.checkMongo()) {
      const result = await ProposalModel.find().lean();
      return result as unknown as Proposal[];
    }
    return this.fileDb.getProposals();
  }

  async saveProposals(proposals: Proposal[]): Promise<void> {
    if (await this.checkMongo()) {
      const ids = proposals.map(p => p.id);
      await ProposalModel.deleteMany({ id: { $nin: ids } });
      for (const p of proposals) {
        await ProposalModel.updateOne({ id: p.id }, p, { upsert: true });
      }
      return;
    }
    return this.fileDb.saveProposals(proposals);
  }

  async getNotifications(): Promise<Notification[]> {
    if (await this.checkMongo()) {
      const result = await NotificationModel.find().lean();
      return result as unknown as Notification[];
    }
    return this.fileDb.getNotifications();
  }

  async saveNotifications(notifications: Notification[]): Promise<void> {
    if (await this.checkMongo()) {
      const ids = notifications.map(n => n.id);
      await NotificationModel.deleteMany({ id: { $nin: ids } });
      for (const n of notifications) {
        await NotificationModel.updateOne({ id: n.id }, n, { upsert: true });
      }
      return;
    }
    return this.fileDb.saveNotifications(notifications);
  }

  async getSchedules(): Promise<Schedule[]> {
    if (await this.checkMongo()) {
      const result = await ScheduleModel.find().lean();
      return result as unknown as Schedule[];
    }
    return this.fileDb.getSchedules();
  }

  async saveSchedules(schedules: Schedule[]): Promise<void> {
    if (await this.checkMongo()) {
      const ids = schedules.map(s => s.id);
      await ScheduleModel.deleteMany({ id: { $nin: ids } });
      for (const s of schedules) {
        await ScheduleModel.updateOne({ id: s.id }, s, { upsert: true });
      }
      return;
    }
    return this.fileDb.saveSchedules(schedules);
  }

  async getEmails(): Promise<any[]> {
    if (await this.checkMongo()) {
      const result = await EmailModel.find().lean();
      return result as unknown as any[];
    }
    return this.fileDb.getEmails();
  }

  async saveEmails(emails: any[]): Promise<void> {
    if (await this.checkMongo()) {
      const ids = emails.map(e => e.id);
      await EmailModel.deleteMany({ id: { $nin: ids } });
      for (const e of emails) {
        await EmailModel.updateOne({ id: e.id }, e, { upsert: true });
      }
      return;
    }
    return this.fileDb.saveEmails(emails);
  }

  async getDocuments(): Promise<SharedDocument[]> {
    if (await this.checkMongo()) {
      const result = await DocumentModel.find().lean();
      return result as unknown as SharedDocument[];
    }
    return this.fileDb.getDocuments();
  }

  async saveDocuments(documents: SharedDocument[]): Promise<void> {
    if (await this.checkMongo()) {
      const ids = documents.map(d => d.id);
      await DocumentModel.deleteMany({ id: { $nin: ids } });
      for (const d of documents) {
        await DocumentModel.updateOne({ id: d.id }, d, { upsert: true });
      }
      return;
    }
    return this.fileDb.saveDocuments(documents);
  }

  async getPresentations(): Promise<PresentationRequest[]> {
    if (await this.checkMongo()) {
      const result = await PresentationModel.find().lean();
      return result as unknown as PresentationRequest[];
    }
    return this.fileDb.getPresentations();
  }

  async savePresentations(presentations: PresentationRequest[]): Promise<void> {
    if (await this.checkMongo()) {
      const ids = presentations.map(p => p.id);
      await PresentationModel.deleteMany({ id: { $nin: ids } });
      for (const p of presentations) {
        await PresentationModel.updateOne({ id: p.id }, p, { upsert: true });
      }
      return;
    }
    return this.fileDb.savePresentations(presentations);
  }

  async getPendingOtps(): Promise<PendingOtp[]> {
    if (await this.checkMongo()) {
      const result = await PendingOtpModel.find().lean();
      const otps = result as unknown as PendingOtp[];
      
      // Purge expired OTPs automatically
      const now = Date.now();
      const valid = otps.filter(o => o.expiresAt > now);
      
      // If we filtered out expired ones, we should theoretically delete them, but it's fine
      // to let the save step overwrite later. Let's do a background cleanup:
      if (valid.length < otps.length) {
        PendingOtpModel.deleteMany({ expiresAt: { $lte: now } }).catch(() => {});
      }
      
      return valid;
    }
    return this.fileDb.getPendingOtps();
  }

  async savePendingOtps(otps: PendingOtp[]): Promise<void> {
    if (await this.checkMongo()) {
      const emails = otps.map(o => o.email);
      await PendingOtpModel.deleteMany({ email: { $nin: emails } });
      for (const o of otps) {
        await PendingOtpModel.updateOne({ email: o.email }, o, { upsert: true });
      }
      return;
    }
    return this.fileDb.savePendingOtps(otps);
  }
}

export const db = new DualDatabase();

