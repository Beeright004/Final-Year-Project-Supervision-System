import { db, Notification } from "./db.js";
import nodemailer from "nodemailer";

// A unique ID generator helper
const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

export async function createNotification(
  recipientId: string,
  message: string,
  type: "info" | "success" | "warning" = "info"
) {
  try {
    const notifications = await db.getNotifications();
    const newNotification: Notification = {
      id: generateId("not"),
      recipientId,
      message,
      read: false,
      type,
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(newNotification);
    await db.saveNotifications(notifications);
    return newNotification;
  } catch (error) {
    console.error("Failed to create in-app notification:", error);
  }
}

// Get SMTP transporter — supports Gmail service shorthand and custom SMTP
function getTransporter() {
  // Hardcoded fallback since Vercel env vars are frequently misconfigured
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const user = process.env.SMTP_USER || "beeright004@gmail.com";
  const pass = process.env.SMTP_PASS || "pgdqeqepkiyxbjdz";

  if (!host || !user || !pass) {
    return null;
  }

  // Gmail shorthand: use the 'gmail' service for automatic host/port/security setup
  if (host.toLowerCase().includes("gmail")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  const port = parseInt(process.env.SMTP_PORT || "465");
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}

export async function sendEmailNotification(
  toEmail: string,
  subject: string,
  htmlContent: string,
  skipSimulatedLog: boolean = false
) {
  try {
    // 1. Always log to server console (including OTP codes — visible in Vercel/Railway/server logs)
    console.log("\n==========================================");
    console.log(`✉️  [EMAIL] To: ${toEmail}`);
    console.log(`✉️  Subject: ${subject}`);
    // Extract OTP from subject line if present for easy visibility
    const otpMatch = subject.match(/\[(\d{6})\]/);
    if (otpMatch) {
      console.log(`🔐 OTP CODE: ${otpMatch[1]}  <--- COPY THIS if email not delivered`);
    }
    console.log(`✉️  Preview: ${htmlContent.replace(/<[^>]*>/g, "").slice(0, 120)}...`);
    console.log("==========================================\n");

    // 2. Always persist to in-app inbox (accessible via the system UI)
    if (!skipSimulatedLog) {
      const emails = await db.getEmails();
      emails.unshift({
        id: generateId("email"),
        to: toEmail,
        subject,
        html: htmlContent,
        sentAt: new Date().toISOString(),
      });
      await db.saveEmails(emails);
    }

    // 3. Real SMTP delivery via Nodemailer
    try {
      const transporter = getTransporter();
      if (transporter) {
        const fromAddress = process.env.SMTP_USER || "beeright004@gmail.com";
        await transporter.sendMail({
          from: `"FYP Supervision System" <${fromAddress}>`,
          to: toEmail,
          subject,
          html: htmlContent,
        });
        console.log(`✅ Email delivered via SMTP to ${toEmail}`);
      } else {
        console.log(`ℹ️  SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). Email saved to in-app inbox only.`);
        console.log(`ℹ️  To enable real email: set SMTP_HOST=smtp.gmail.com, SMTP_USER=your@gmail.com, SMTP_PASS=your-app-password in Vercel Environment Variables.`);
      }
    } catch (smtpError: any) {
      console.error("❌ SMTP delivery failed (email saved to in-app inbox as fallback):", smtpError.message);
    }
  } catch (error) {
    console.error("Failed to send email notification:", error);
  }
}

// Complete predefined email template builders to match system requirements
export const emailTemplates = {
  studentRegistered: (name: string, email: string, role: string) => ({
    subject: "Academic Account Activation — Final Year Supervision System",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #1e3a8a; margin-top: 0;">Welcome to the Supervision Platform!</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>Your academic supervision account (registered with email: <code>${email}</code>) as a <strong>${role}</strong> has been successfully authorized.</p>
        <p>You can now log in to propose topics, manage documents, and schedule face-to-face or digital milestone reviews with your supervisor.</p>
        <br />
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-size: 14px;">
          <strong>Next Steps:</strong>
          <ul>
            <li>Log in and complete your student/advisor profile.</li>
            <li>Submit your final-year project title or review assigned student teams.</li>
          </ul>
        </div>
        <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">This is an automated notification from the University FYP Division.</p>
      </div>
    `,
  }),

  topicSubmitted: (studentName: string, title: string, supervisorName: string) => ({
    subject: `New Project Proposal Submitted — ${studentName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">New Project Topic submitted for Review</h2>
        <p>Dear <strong>${supervisorName}</strong>,</p>
        <p>Your supervised student <strong>${studentName}</strong> has proposed a new final year project topic:</p>
        <div style="background: #eff6ff; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1e3a8a;">${title}</h3>
        </div>
        <p>Please log into your supervisor terminal to approve, reject, or request methodology revisions on this topic.</p>
        <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Final Year Supervisions Project Management Office</p>
      </div>
    `,
  }),

  topicStatusUpdated: (studentName: string, title: string, status: "approved" | "rejected" | "revision", feedback: string) => {
    const statusMeta = {
      approved: { color: "#16a34a", label: "APPROVED", intro: "Congratulations! Your project proposal has been Approved." },
      rejected: { color: "#dc2626", label: "DISAPPROVED", intro: "Your proposed project topic has been rejected." },
      revision: { color: "#ca8a04", label: "REVISION REQUESTED", intro: "Your supervisor requested adjustments before giving approval." },
    }[status];

    return {
      subject: `Project Topic Notification: [${statusMeta.label}] — Final Year Supervision`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: ${statusMeta.color}; margin-top: 0;">Topic Setup Updated: ${statusMeta.label}</h2>
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>${statusMeta.intro}</p>
          <div style="background: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 15px 0;">
            <p><strong>Topic Title:</strong> ${title}</p>
            <p><strong>Advisor Feedback:</strong> ${feedback || "No comment description provided."}</p>
          </div>
          <p>Please connect to your personal student portal to check approval history and upload required PDFs.</p>
          <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Autonomous Digital Notification Service</p>
        </div>
      `,
    };
  },

  meetingScheduled: (organizerRole: string, opponentName: string, title: string, date: string, time: string, venue: string) => ({
    subject: `Supervision Session Booked: ${title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Meeting Notification Details</h2>
        <p>A new supervision review meeting has been scheduled with <strong>${opponentName}</strong>:</p>
        <div style="background: #f5f3ff; border-left: 4px solid #4f46e5; padding: 15px; margin: 15px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0;"><strong>Session Title:</strong> ${title}</p>
          <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${date}</p>
          <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${time}</p>
          <p style="margin: 0 0 0 0;"><strong>Venue / Platform:</strong> ${venue}</p>
        </div>
        <p>Please sign into your university portal dashboard to confirm availability, reschedule, or review project records prior to the meeting.</p>
        <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Supervision Schedulers Office</p>
      </div>
    `,
  }),

  meetingStatusUpdated: (userRole: string, opponentName: string, title: string, status: string) => ({
    subject: `Meeting Booking [${status.toUpperCase()}] — Supervision Schedule`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">Supervision Schedule Update</h2>
        <p>A meeting request is now marked as <strong>${status.toUpperCase()}</strong> by <strong>${opponentName}</strong>:</p>
        <div style="background: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; margin: 15px 0; border-radius: 6px;">
          <p><strong>Session:</strong> ${title}</p>
        </div>
        <p>Log in to view the adjusted booking timeline in your dashboard schedule calendar.</p>
        <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">University Automation Systems</p>
      </div>
    `,
  })
};
