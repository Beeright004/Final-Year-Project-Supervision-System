export interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "supervisor" | "admin";
  matricNumber?: string;
  department: string;
  supervisorId?: string;
  supervisor?: {
    id: string;
    name: string;
    email: string;
    department: string;
  } | null;
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
  studentName?: string;
  studentMatric?: string;
  supervisorName?: string;
  proposal?: Proposal | null;
}

export interface Proposal {
  id: string;
  topicId: string;
  fileName: string;
  fileUrl: string;
  fileSize: string;
  contentType: string;
  uploadDate: string;
  status: "pending" | "approved" | "rejected";
  feedback?: string;
}

export interface SharedDocument {
  id: string;
  studentId: string;
  studentName?: string;
  studentMatric?: string;
  fileName: string;
  fileUrl: string;
  fileSize: string;
  contentType: string;
  tag: string; // e.g. "Chapter 1", "Presentation Slides", "Sources", etc.
  feedback?: string;
  uploadedAt: string;
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
  duration: number; // in minutes, minimum 15
  venue: string;
  supervisorId: string;
  studentId: string;
  title: string;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  createdAt: string;
  studentName?: string;
  studentMatric?: string;
  supervisorName?: string;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  html: string;
  sentAt: string;
}

export interface PresentationRequest {
  id: string;
  supervisorId: string;
  studentId: string;
  title: string;
  description: string;
  dueDate: string;
  status: "pending" | "submitted" | "approved" | "revision";
  meetingUrl?: string; // presentation platform/jitsi/teams/zoom/meet
  slidesUrl?: string; // google slides or office 365 powerpoint URL
  fileName?: string; // client uploaded PowerPoint/PDF filename
  fileUrl?: string; // uploaded slide path / Base64 Data URI
  feedback?: string; // supervisor feedback
  createdAt: string;
  studentName?: string;
  studentMatric?: string;
  supervisorName?: string;
}
