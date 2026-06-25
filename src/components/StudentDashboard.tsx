import React, { useState, useEffect } from "react";
import { User, Topic, Proposal, Schedule, SharedDocument } from "../types.js";
import { api } from "../lib/api.js";
import { useApp } from "../context/AppContext.js";
import { 
  FileText, Calendar, Plus, Edit3, CheckCircle, Clock, AlertTriangle, HelpCircle, 
  User as UserIcon, Building2, Mail, ExternalLink, CalendarPlus, MapPin, Inbox, Upload, Trash2, ArrowUpRight, CloudDownload, FileSpreadsheet, FileCode, Check, Award, X, Video
} from "lucide-react";
import VideoCall from "./VideoCall.js";

export default function StudentDashboard() {
  const { user, addToast } = useApp();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  
  // Presentations requests state
  const [presentations, setPresentations] = useState<any[]>([]);

  // Presentation slides submission states
  const [submittingPres, setSubmittingPres] = useState<any | null>(null);
  const [slidesUrlInput, setSlidesUrlInput] = useState("");
  const [isSubmitSlideDeck, setIsSubmitSlideDeck] = useState(false);
  const [sessionFile, setSessionFile] = useState<File | null>(null);

  // App state
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);
  const [topicForm, setTopicForm] = useState({ title: "", description: "" });
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);

  // Video call state
  const [activeVideoCall, setActiveVideoCall] = useState<string | null>(null);

  // Proposal Document states
  const [isUploadingProposal, setIsUploadingProposal] = useState(false);
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [proposalBase64, setProposalBase64] = useState<string>("");

  // Custom general documents sharing
  const [isSharingDoc, setIsSharingDoc] = useState(false);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customFileTag, setCustomFileTag] = useState("Chapter 1");

  // Custom dialog confirmations state
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [meetingToCancel, setMeetingToCancel] = useState<string | null>(null);

  // Scheduling Bookings states
  const [isBookerOpen, setIsBookerOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({ title: "", meetingDate: "", time: "", venue: "" });

  const loadStudentData = async () => {
    try {
      const topicList = await api.topics.list();
      setTopics(topicList);
      
      const scheduleList = await api.schedules.list();
      setSchedules(scheduleList);

      const docList = await api.documents.list();
      setDocuments(docList);

      const presList = await api.presentations.list();
      setPresentations(presList);
    } catch (e: any) {
      console.error(e);
      addToast("Failed to reload personal project records.", "error");
    }
  };

  const handleSlidesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingPres) return;
    if (!slidesUrlInput && !sessionFile) {
      addToast("Please input an online slideshow link or select a file to upload.", "warning");
      return;
    }

    setIsSubmitSlideDeck(true);
    try {
      let fileDataUrl = "";
      let fileName = "";
      let fileSize = "";

      if (sessionFile) {
        fileName = sessionFile.name;
        fileSize = `${(sessionFile.size / (1024 * 1024)).toFixed(2)} MB`;
        
        // Convert to Base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(sessionFile);
        });
        fileDataUrl = await base64Promise;
      }

      await api.presentations.submit(submittingPres.id, {
        slidesUrl: slidesUrlInput || undefined,
        fileName: fileName || undefined,
        fileDataUrl: fileDataUrl || undefined,
        fileSize: fileSize || undefined
      });

      addToast("PowerPoint slides submitted successfully!", "success");
      setSubmittingPres(null);
      setSlidesUrlInput("");
      setSessionFile(null);
      // Reload
      const presList = await api.presentations.list();
      setPresentations(presList);
    } catch (err: any) {
      addToast(err?.error || "Failed to submit slides.", "error");
    } finally {
      setIsSubmitSlideDeck(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, []);

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.title || !topicForm.description) {
      addToast("Please fill in both title and description abstract.", "warning");
      return;
    }

    try {
      setIsSubmittingTopic(true);
      if (editingTopicId) {
        await api.topics.edit(editingTopicId, topicForm);
        addToast("Topic proposal adjusted successfully.", "success");
      } else {
        await api.topics.submit(topicForm);
        addToast("Project topic proposal submitted successfully to supervisions board.", "success");
      }
      setTopicForm({ title: "", description: "" });
      setEditingTopicId(null);
      loadStudentData();
    } catch (error: any) {
      addToast(error.message || "Failed to submit topic details.", "error");
    } finally {
      setIsSubmittingTopic(false);
    }
  };

  const handleEditTopicStart = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setTopicForm({ title: topic.title, description: topic.description });
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf" && !file.name.endsWith(".doc") && !file.name.endsWith(".docx")) {
        addToast("Only PDF, DOC, or DOCX document standards are approved.", "warning");
        return;
      }

      setProposalFile(file);
      
      // Perform simple base64 conversion to persist the file simulation in the database
      const reader = new FileReader();
      reader.onloadend = () => {
        setProposalBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProposalUpload = async (topicId: string) => {
    if (!proposalFile) {
      addToast("Please select a scientific draft file first.", "warning");
      return;
    }

    try {
      setIsUploadingProposal(true);
      
      const formData = new FormData();
      formData.append("topicId", topicId);
      formData.append("file", proposalFile);
      
      await api.proposals.upload(formData);

      addToast("Proposal document uploaded successfully to advisor.", "success");
      setProposalFile(null);
      setProposalBase64("");
      loadStudentData();
    } catch (e: any) {
      addToast(e.message || "Document upload crashed. Please retry.", "error");
    } finally {
      setIsUploadingProposal(false);
    }
  };

  const handleCustomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomFile(file);
    }
  };

  const handleShareCustomDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFile) {
      addToast("Please choose a file or document to upload first.", "warning");
      return;
    }

    try {
      setIsSharingDoc(true);
      const formData = new FormData();
      formData.append("file", customFile);
      formData.append("tag", customFileTag);

      await api.documents.share(formData);
      addToast("File shared successfully with your supervisor.", "success");
      setCustomFile(null);
      
      const docList = await api.documents.list();
      setDocuments(docList);
    } catch (err: any) {
      addToast(err.message || "Failed to share files. Please retry.", "error");
    } finally {
      setIsSharingDoc(false);
    }
  };

  const handleDeleteDocument = (id: string) => {
    setDocToDelete(id);
  };

  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    try {
      await api.documents.delete(docToDelete);
      addToast("Document has been removed from your supervisor's panel.", "success");
      const docList = await api.documents.list();
      setDocuments(docList);
    } catch (err: any) {
      addToast(err.message || "Could not delete document.", "error");
    } finally {
      setDocToDelete(null);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { title, meetingDate, time, venue } = bookingForm;
    if (!title || !meetingDate || !time || !venue) {
      addToast("Ensure you fill all schedule fields completely.", "warning");
      return;
    }

    try {
      await api.schedules.create(bookingForm);
      addToast("Supervision session booked. Waiting for advisor confirmation.", "success");
      setBookingForm({ title: "", meetingDate: "", time: "", venue: "" });
      setIsBookerOpen(false);
      loadStudentData();
    } catch (e: any) {
      addToast(e.message || "Scheduling request failed.", "error");
    }
  };

  const handleCancelMeeting = (id: string) => {
    setMeetingToCancel(id);
  };

  const handleConfirmCancelMeeting = async () => {
    if (!meetingToCancel) return;
    try {
      await api.schedules.updateStatus(meetingToCancel, "cancelled");
      addToast("Meeting cancelled.", "info");
      loadStudentData();
    } catch (e: any) {
      addToast("Action failed.", "error");
    } finally {
      setMeetingToCancel(null);
    }
  };

  // Status badge styling helper
  const getTopicStatusMeta = (status: Topic["status"]) => {
    switch (status) {
      case "approved":
        return { bg: "bg-emerald-50 text-emerald-700 border-emerald-150", icon: CheckCircle, label: "Approved" };
      case "rejected":
        return { bg: "bg-rose-50 text-rose-700 border-rose-150", icon: AlertTriangle, label: "Rejected" };
      case "revision":
        return { bg: "bg-amber-50 text-amber-700 border-amber-150", icon: Clock, label: "Revision Requested" };
      default:
        return { bg: "bg-blue-50 text-blue-700 border-blue-150", icon: Clock, label: "Under Review" };
    }
  };

  const getScheduleStatusMeta = (status: Schedule["status"]) => {
    switch (status) {
      case "approved":
        return { bg: "bg-emerald-100 text-emerald-800", label: "Confirmed" };
      case "rejected":
        return { bg: "bg-rose-100 text-rose-800", label: "Declined" };
      case "completed":
        return { bg: "bg-gray-100 text-gray-800", label: "Completed" };
      case "cancelled":
        return { bg: "bg-rose-50 text-rose-600 line-through", label: "Cancelled" };
      default:
        return { bg: "bg-amber-100 text-amber-800", label: "Pending" };
    }
  };

  const activeApprovedTopic = topics.find((t) => t.status === "approved");

  // progression status calculations
  const hasTopicProposed = topics.length > 0;
  const isTopicApproved = topics.some((t) => t.status === "approved");
  
  const hasProposalUploaded = topics.some((t) => !!t.proposal);
  const isProposalApproved = topics.some((t) => t.proposal?.status === "approved");
  const isProposalPending = topics.some((t) => t.proposal?.status === "pending");
  const isProposalRejected = topics.some((t) => t.proposal?.status === "rejected");

  const defenseSchedule = schedules.find((s) => s.title.toLowerCase().includes("defense") || s.title.toLowerCase().includes("viva") || s.title.toLowerCase().includes("final"));
  const isDefenseCompleted = !!defenseSchedule && defenseSchedule.status === "completed";
  const isDefenseApproved = !!defenseSchedule && defenseSchedule.status === "approved";
  const isDefensePending = !!defenseSchedule && defenseSchedule.status === "pending";

  let overallPercent = 10;
  let activeLinePercent = 0;

  if (hasTopicProposed) {
    overallPercent = 25;
    activeLinePercent = 15;
  }
  if (isTopicApproved) {
    overallPercent = 45;
    activeLinePercent = 50;
  }
  if (hasProposalUploaded) {
    overallPercent = 60;
  }
  if (isProposalApproved) {
    overallPercent = 80;
    activeLinePercent = 100;
  }
  if (isDefenseCompleted) {
    overallPercent = 100;
  } else if (isDefenseApproved) {
    overallPercent = 90;
  }


  if (activeVideoCall) {
    return (
      <VideoCall
        channelName={activeVideoCall}
        userName={user?.name || "Student"}
        onLeave={() => setActiveVideoCall(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full px-1 text-left">
      
      {/* Overview Greeting */}
      <div className="bg-white rounded-lg border border-slate-200 p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xs">
        <div className="space-y-1 text-left">
          <h2 className="text-lg font-extrabold text-slate-950">Welcome, {user?.name}!</h2>
          <p className="text-xs text-slate-500">
            Student Matric: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-semibold text-slate-700">{user?.matricNumber}</code> &bull; Department: <strong className="text-slate-700">{user?.department}</strong>
          </p>
        </div>

        {/* Supervisor Box */}
        {user?.supervisor ? (
          <div className="flex items-center gap-3.5 bg-blue-50/40 rounded-lg p-3.5 border border-blue-100/70 max-w-md text-left">
            <div className="bg-blue-600 text-white h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
              <UserIcon className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] uppercase font-bold text-blue-600 font-mono tracking-wider">Assigned Supervisor</p>
              <h4 className="text-xs font-bold text-slate-950">{user.supervisor.name}</h4>
              <p className="text-[10px] text-slate-500 leading-none">
                {user.supervisor.email} &bull; {user.supervisor.department}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-3.5 max-w-md text-left flex items-start gap-3.5">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-rose-950">Advisor Allocation Pending</h4>
              <p className="text-[10px] text-rose-600 leading-normal mt-0.5">
                Your department has not allocated a project supervisor yet. Contact your administration office immediately.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Visual Progress Milestones Tracker */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="font-extrabold text-xs uppercase text-slate-950 tracking-wider">
              Academic Milestone Tracking
            </h3>
            <p className="text-[11px] text-slate-500">Track your final year project progression through core checkpoints</p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-lg">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Est. Completion</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-sm font-black text-slate-900">{overallPercent}%</span>
            </div>
          </div>
        </div>

        <div className="relative">
          {/* Background Connecting Line */}
          <div className="absolute top-[22px] left-8 right-8 h-1 bg-slate-100 -translate-y-1/2 rounded-full hidden md:block" />
          
          {/* Foreground Active Connecting Line */}
          <div 
            className="absolute top-[22px] left-8 h-1 bg-blue-600 -translate-y-1/2 rounded-full transition-all duration-500 hidden md:block"
            style={{ width: `${Math.max(0, Math.min(100, activeLinePercent))}%` }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            
            {/* Step 1: Topic */}
            <div className="flex md:flex-col items-start md:items-center text-left md:text-center gap-4 md:gap-3.5">
              <div className={`h-11 w-11 rounded-full flex items-center justify-center border font-bold text-sm transition-all shadow-xs shrink-0 ${
                isTopicApproved 
                  ? "bg-emerald-50 text-emerald-600 border-emerald-400 ring-4 ring-emerald-50/50" 
                  : hasTopicProposed 
                    ? "bg-blue-50 text-blue-600 border-blue-400 ring-4 ring-blue-50/50" 
                    : "bg-slate-50 text-slate-400 border-slate-200"
              }`}>
                {isTopicApproved ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isTopicApproved ? "text-emerald-700" : hasTopicProposed ? "text-blue-600" : "text-slate-400"
                }`}>
                  Milestone 1: Topic Selection
                </span>
                <h4 className="text-xs font-extrabold text-slate-950">Topic Submission</h4>
                <p className={`text-[11px] leading-snug p-0.5 ${
                  isTopicApproved ? "text-emerald-700 font-medium" : "text-slate-500"
                }`}>
                  {isTopicApproved ? (
                    <span>Allocated & Certified. Your active approved title is registered.</span>
                  ) : topics.some(t => t.status === "pending") ? (
                    <span className="text-amber-600 font-semibold italic">Draft Submitted — Pending Review</span>
                  ) : topics.some(t => t.status === "revision") ? (
                    <span className="text-amber-600 font-semibold">Changes Advised by Board</span>
                  ) : topics.some(t => t.status === "rejected") ? (
                    <span className="text-rose-600 font-semibold">Topic Rejected. Resubmit details</span>
                  ) : (
                    "Propose your research project title and abstract description below."
                  )}
                </p>
              </div>
            </div>

            {/* Step 2: Proposal */}
            <div className="flex md:flex-col items-start md:items-center text-left md:text-center gap-4 md:gap-3.5">
              <div className={`h-11 w-11 rounded-full flex items-center justify-center border font-bold text-sm transition-all shadow-xs shrink-0 ${
                isProposalApproved 
                  ? "bg-emerald-55 text-emerald-600 border-emerald-400 ring-4 ring-emerald-50/50" 
                  : isTopicApproved 
                    ? "bg-blue-50 text-blue-600 border-blue-400 ring-4 ring-blue-50/50" 
                    : "bg-slate-50 text-slate-350 border-slate-100"
              }`}>
                {isProposalApproved ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <FileSpreadsheet className="h-5 w-5" />
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isProposalApproved ? "text-emerald-700" : isTopicApproved ? "text-blue-600" : "text-slate-300"
                }`}>
                  Milestone 2: Proposal
                </span>
                <h4 className="text-xs font-extrabold text-slate-950">Proposal Approval</h4>
                <p className={`text-[11px] leading-snug p-0.5 ${
                  isProposalApproved ? "text-emerald-700 font-medium" : "text-slate-500"
                }`}>
                  {isProposalApproved ? (
                    <span>Proposal Certified! Digital review marks and feedback are signed off.</span>
                  ) : isProposalPending ? (
                    <span className="text-amber-600 font-semibold italic">Proposal Uploaded — Under Review</span>
                  ) : isProposalRejected ? (
                    <span className="text-rose-600 font-semibold">Manuscript Review Rejected. Adjust files</span>
                  ) : hasProposalUploaded ? (
                    <span className="text-blue-600 font-semibold italic">Manuscript Uploaded</span>
                  ) : isTopicApproved ? (
                    <span className="text-blue-600 font-semibold">Topic Approved. Propose manuscript document!</span>
                  ) : (
                    "Upload and align proposal manuscript chapters format with advisor guidelines."
                  )}
                </p>
              </div>
            </div>

            {/* Step 3: Defense */}
            <div className="flex md:flex-col items-start md:items-center text-left md:text-center gap-4 md:gap-3.5">
              <div className={`h-11 w-11 rounded-full flex items-center justify-center border font-bold text-sm transition-all shadow-xs shrink-0 ${
                isDefenseCompleted 
                  ? "bg-emerald-50 text-emerald-600 border-emerald-400 ring-4 ring-emerald-50/50" 
                  : isDefenseApproved 
                    ? "bg-blue-50 text-blue-600 border-blue-400 ring-4 ring-blue-50/50 animate-pulse" 
                    : isProposalApproved 
                      ? "bg-blue-50 text-blue-500 border-blue-200" 
                      : "bg-slate-50 text-slate-300 border-slate-100"
              }`}>
                <Award className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDefenseCompleted ? "text-emerald-700" : isDefenseApproved ? "text-blue-600" : "text-slate-300"
                }`}>
                  Milestone 3: Final Defense
                </span>
                <h4 className="text-xs font-extrabold text-slate-950">Final Defense Presentation</h4>
                <p className={`text-[11px] leading-snug p-0.5 ${
                  isDefenseCompleted ? "text-emerald-700 font-medium" : "text-slate-500"
                }`}>
                  {isDefenseCompleted ? (
                    <span>Concluded successfully! Approved by supervisor viva voce reviews.</span>
                  ) : isDefenseApproved ? (
                    <span className="text-emerald-600 font-semibold">
                      Confirmed: {defenseSchedule?.meetingDate} @ {defenseSchedule?.time} ({defenseSchedule?.venue})
                    </span>
                  ) : isDefensePending ? (
                    <span className="text-amber-600 font-semibold italic">Booking Sent — Pending Confirmation</span>
                  ) : isProposalApproved ? (
                    <span className="text-blue-600 font-medium">Proposal Approved! Book defense session slot details.</span>
                  ) : (
                    "Authorize final presentation hours and schedules to defended research."
                  )}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Topic and Proposal management */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Submit/Edit Topic Proposal */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <div className="border-b border-slate-150 pb-3 mb-3 flex justify-between items-center bg-transparent">
              <h3 className="font-extrabold text-xs uppercase text-slate-950 tracking-wider">
                {editingTopicId ? "Edit Proposed Topic" : "Propose Final Year Topic"}
              </h3>
              {editingTopicId && (
                <button
                  onClick={() => {
                    setEditingTopicId(null);
                    setTopicForm({ title: "", description: "" });
                  }}
                  className="text-xs text-rose-500 hover:underline font-bold"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {hasApprovedTopic(topics) ? (
              <div className="bg-emerald-55/40 border border-emerald-100 rounded-lg p-4 text-left flex items-start gap-3.5">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-950">You possess an Approved Topic!</h4>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Subject Title: <strong>&ldquo;{activeApprovedTopic?.title}&rdquo;</strong>
                  </p>
                  <p className="text-[11px] text-slate-500 pt-0.5 leading-normal">
                    The Research Board has certified your proposal structure. Scroll down below to submit your milestone PDF drafts or view advisor feedback logs.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTopicSubmit} className="space-y-3 px-0.5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Project Proposal Title</label>
                  <input
                    type="text"
                    required
                    value={topicForm.title}
                    onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                    placeholder="e.g. Robust Real-Time Point Cloud Processing using YOLO v9"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Abstract Summary & Research Methodology Outline</label>
                  <textarea
                    required
                    rows={4}
                    value={topicForm.description}
                    onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                    placeholder="Summarize the core engineering context, what datasets will be deployed, the research objectives, and specify deliverables."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden leading-relaxed"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmittingTopic}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4.5 py-2.5 rounded-lg transition duration-150 active:scale-95 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>{editingTopicId ? "Save Adjusted Proposal" : "Submit Proposal Topic"}</span>
                </button>
              </form>
            )}
          </div>

          {/* Submitted Topics List */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <h3 className="font-extrabold text-xs uppercase text-slate-950 tracking-wider border-b border-slate-150 pb-3 mb-3">
              Your Topics Progress & Feedback
            </h3>

            {topics.length === 0 ? (
              <div className="p-6 text-center text-slate-405">
                <Inbox className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-xs font-semibold">No submitted topics record found.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Propose an first title topic draft above to initiate tracking.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {topics.map((topic) => {
                  const meta = getTopicStatusMeta(topic.status);
                  const canEdit = ["pending", "revision"].includes(topic.status);

                  return (
                    <div key={topic.id} className="p-4 border border-slate-200 rounded-lg space-y-3.5 hover:border-slate-300 transition-all text-left bg-white">
                      
                      {/* Topic Title Line */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-extrabold text-slate-950 leading-snug">
                            {topic.title}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Submitted on: {new Date(topic.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap self-start ${meta.bg}`}>
                          <meta.icon className="h-3.5 w-3.5" />
                          <span>{meta.label}</span>
                        </div>
                      </div>

                      {/* Summary Abstract */}
                      <p className="text-xs text-slate-650 leading-relaxed p-2.5 bg-slate-50 border border-slate-150 rounded-lg">
                        {topic.description}
                      </p>

                      {/* Supervisor Comments Panel */}
                      {topic.feedback && (
                        <div className="p-3 bg-amber-50/40 border border-amber-100/60 rounded-lg">
                          <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest font-mono">Supervisor Review Advice</p>
                          <p className="text-[11px] text-amber-900 leading-relaxed mt-0.5">{topic.feedback}</p>
                        </div>
                      )}

                      {/* Topic Actions */}
                      <div className="flex flex-wrap items-center gap-3.5 justify-between border-t border-slate-150 pt-3">
                        {canEdit ? (
                          <button
                            onClick={() => handleEditTopicStart(topic)}
                            className="bg-slate-100 hover:bg-slate-250 text-slate-700 font-bold text-[11px] px-3 py-1.5 rounded transition flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Alter Topic Elements</span>
                          </button>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Scope locked due to approval</div>
                        )}

                        {/* Proposal upload panel (only if approved) */}
                        {topic.status === "approved" && (
                          <div className="w-full sm:w-auto mt-2 sm:mt-0">
                            {topic.proposal ? (
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>{topic.proposal.fileName} ({topic.proposal.fileSize})</span>
                                </div>
                                <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${
                                  topic.proposal.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                                  topic.proposal.status === "rejected" ? "bg-rose-100 text-rose-800" :
                                  "bg-amber-105 text-amber-805"
                                }`}>
                                  File: {topic.proposal.status}
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                  <label className="w-full sm:w-auto bg-slate-100 hover:bg-slate-205 text-slate-705 text-[11px] font-bold px-3 py-1.5 rounded cursor-pointer transition flex items-center justify-center gap-1 border border-slate-200">
                                    <Upload className="h-3.5 w-3.5" />
                                    <span>{proposalFile ? "Switch Manuscript" : "Choose Proposal File"}</span>
                                    <input
                                      type="file"
                                      accept=".pdf,.doc,.docx"
                                      className="hidden"
                                      onChange={handleFileChange}
                                    />
                                  </label>
                                  {proposalFile && (
                                    <button
                                      type="button"
                                      onClick={() => handleProposalUpload(topic.id)}
                                      disabled={isUploadingProposal}
                                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-3 py-1.5 rounded cursor-pointer transition flex items-center gap-1"
                                    >
                                      <span>Upload Manuscript</span>
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                                {proposalFile && (
                                  <p className="text-[9px] text-slate-400 font-semibold">Selected: <strong>{proposalFile.name}</strong> ({(proposalFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* General Document Hub & Advisor Deliverables (Student Workspace) */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left text-slate-705" id="document-deliverables-panel">
            <div className="border-b border-slate-150 pb-3 mb-4 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase text-slate-950 tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Deliverables & Research Files Sharing
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Upload and partition active research Chapters, datasets, presentations, materials or revisions. Your supervisor can instantly preview them and append feedback reviews.
              </p>
            </div>

            {/* Upload Document Box */}
            <form onSubmit={handleShareCustomDocument} className="bg-slate-50 rounded-lg p-4 border border-slate-200/60 mb-5 space-y-3.5">
              <h4 className="font-bold text-[11px] text-slate-700 uppercase tracking-wide">Share New Material</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 block">
                {/* File input */}
                <div className="space-y-1 block">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Select File</span>
                  <label className="flex items-center justify-between pointer-events-auto cursor-pointer border border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/10 px-3 py-2 rounded-md transition text-xs font-medium text-slate-700 gap-2">
                    <span className="truncate max-w-[150px]">
                      {customFile ? customFile.name : "Choose file..."}
                    </span>
                    <Upload className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleCustomFileChange}
                    />
                  </label>
                  {customFile && (
                    <span className="block text-[9px] text-slate-400 font-medium">Size: {(customFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  )}
                </div>

                {/* Tag Selection */}
                <div className="space-y-1 block">
                  <label htmlFor="custom-file-tag" className="block text-[10px] font-bold text-slate-500 uppercase">File Tag / Section</label>
                  <select
                    id="custom-file-tag"
                    value={customFileTag}
                    onChange={(e) => setCustomFileTag(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 hover:border-slate-300 rounded px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="Chapter 1">Chapter 1</option>
                    <option value="Chapter 2">Chapter 2</option>
                    <option value="Chapter 3">Chapter 3</option>
                    <option value="Chapter 4/5">Chapter 4/5</option>
                    <option value="Literature Review">Literature Review</option>
                    <option value="Research Dataset">Research Dataset</option>
                    <option value="Source Code">Source Code</option>
                    <option value="Presentation Slides">Presentation Slides</option>
                    <option value="Turnitin Report">Turnitin Report</option>
                    <option value="Academic Material">Academic Material</option>
                    <option value="Other Reference">Other Reference</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSharingDoc || !customFile}
                  className={`px-4 py-2 font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer ${
                    customFile 
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs" 
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {isSharingDoc ? "Uploading..." : "Share File"}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            {/* List of Shared General Docs */}
            <h4 className="font-bold text-[11px] text-slate-700 uppercase tracking-wide mb-3">Recently Shared Records</h4>
            
            {documents.length === 0 ? (
              <div className="text-center p-6 bg-slate-50 rounded-lg border border-slate-150">
                <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No external deliverables or reference files have been uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-4 col-span-full bg-transparent">
                {documents.map((doc) => {
                  const ext = doc.fileName.split('.').pop()?.toLowerCase();
                  return (
                    <div key={doc.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-xs transition relative">
                      {/* Delete doc icon */}
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-full transition cursor-pointer"
                        title="Delete Shared Document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-slate-55 border border-slate-150 rounded text-blue-600 shrink-0">
                          {ext === "xlsx" || ext === "csv" ? (
                            <FileSpreadsheet className="h-5 w-5" />
                          ) : ext === "txt" || ext === "log" ? (
                            <FileCode className="h-5 w-5" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>

                        <div className="space-y-1 pr-8 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-xs font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                              {doc.fileName}
                            </h5>
                            <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-blue-100">
                              {doc.tag}
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 font-medium">
                            Size: <span className="font-semibold text-slate-650">{doc.fileSize}</span> &bull; Uploaded: <span className="font-semibold text-slate-655">{new Date(doc.uploadedAt).toLocaleString()}</span>
                          </p>

                          {/* Action links */}
                          <div className="flex items-center gap-3 pt-2">
                            <a
                              href={doc.fileUrl}
                              download={doc.fileName}
                              referrerPolicy="no-referrer"
                              target="_blank"
                              className="text-blue-600 hover:text-blue-700 text-[10px] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <CloudDownload className="h-3.5 w-3.5" /> Download Material
                            </a>
                          </div>

                          {/* Supervisor Feedback comments section */}
                          <div className="mt-3.5 pt-3 border-t border-slate-100 bg-transparent block col-span-full">
                            {doc.feedback ? (
                              <div className="bg-amber-50 border border-amber-100/70 p-3 rounded text-left block">
                                <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-amber-700 font-mono">
                                  <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  Advisor Remarks Review
                                </div>
                                <p className="text-xs text-amber-950 mt-1 font-medium whitespace-pre-line leading-relaxed">
                                  {doc.feedback}
                                </p>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">
                                &bull; Advisor has not recorded any review remarks for this material file yet.
                              </p>
                            )}
                          </div>

                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>


          {/* ========================================================== */}
          {/* LECTURER PRESENTATION REQUESTS SECTION */}
          {/* ========================================================== */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left text-slate-705" id="student-presentations-panel">
            <div className="border-b border-slate-150 pb-3 mb-4 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase text-slate-950 tracking-wider flex items-center gap-2">
                <FileCode className="h-4 w-4 text-blue-600" />
                PowerPoint Presentation Requests
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Deliver files or online PowerPoint slideshow links (e.g., Google Slides or Office 365) requested by your supervisor for online reviews.
              </p>
            </div>

            {presentations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                <Inbox className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-xs font-bold">No PowerPoint Presentation requests issued yet.</p>
                <p className="text-[10px] text-slate-400">Your supervisor will schedule slide reviews here when critical milestone presentations are needed.</p>
              </div>
            ) : (
              <div className="space-y-4 col-span-full">
                {presentations.map((pres) => {
                  const isPending = pres.status === "pending" || pres.status === "revision";
                  return (
                    <div key={pres.id} className="border border-slate-200 rounded-lg p-4.5 bg-white shadow-xs relative flex flex-col justify-between">
                      <div>
                        {/* Header status bar */}
                        <div className="flex items-center justify-between gap-2.5 mb-3 bg-slate-50 p-2 border border-slate-150 rounded">
                          <div className="text-[9px] text-slate-505 font-bold flex items-center gap-1 font-sans">
                            <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>Requested by Advisor: <strong className="text-slate-800">Prof. Olukunle Adebayo</strong></span>
                          </div>

                          {pres.status === "pending" && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-250 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Action Required
                            </span>
                          )}
                          {pres.status === "submitted" && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-250 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                              Submitted, Under review
                            </span>
                          )}
                          {pres.status === "approved" && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-250 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                              <Check className="h-3 w-3" />
                              Approved
                            </span>
                          )}
                          {pres.status === "revision" && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-250 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Needs Revision
                            </span>
                          )}
                        </div>

                        {/* Title & Request Body */}
                        <div className="space-y-1 block text-left">
                          <h4 className="text-xs font-bold text-slate-900">{pres.title}</h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                            {pres.description}
                          </p>
                        </div>

                        {/* Due Date & Meeting Coordinates */}
                        <div className="grid grid-cols-2 gap-3 mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                          <div>
                            <span className="font-bold text-slate-400 block uppercase text-[8px]">Submit Before:</span>
                            <span className={`font-semibold ${isPending ? "text-amber-700" : "text-slate-700"}`}>
                              {(() => {
                                try {
                                  return new Date(pres.dueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                                } catch (e) {
                                  return pres.dueDate;
                                }
                              })()}
                            </span>
                          </div>

                          <div>
                            <span className="font-bold text-slate-400 block uppercase text-[8px]">Meeting Room:</span>
                            <div className="space-y-2 mt-1">
                              {pres.meetingUrl && (
                                <a
                                  href={pres.meetingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                                >
                                  External Link &rarr;
                                </a>
                              )}
                              <button
                                onClick={() => setActiveVideoCall(`presentation-${pres.id}`)}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-[10px] py-2 rounded-lg flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                              >
                                <Video className="h-4 w-4" />
                                <span>Join Live Presentation Room</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Windows PowerPoint Sharing Tip */}
                        <div className="mt-4 bg-slate-50 border border-slate-200 rounded p-3 flex gap-3 text-left">
                          <HelpCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">Windows Presentation Tip:</p>
                            <p className="text-[10px] text-slate-500 leading-normal mt-0.5 font-medium">
                              When presenting on Windows, start your PowerPoint <strong>"Slide Show"</strong> first. Then, in the video call, click the <strong>Monitor</strong> icon &rarr; <strong>Window</strong> &rarr; and select the <strong>"PowerPoint Slide Show"</strong> window for a full-screen experience.
                            </p>
                          </div>
                        </div>

                        {/* Previously Submitted Materials */}
                        {(pres.slidesUrl || pres.fileUrl) && (
                          <div className="mt-3.5 bg-blue-50/25 border border-blue-100 rounded p-2.5 text-left">
                            <span className="block text-[8px] uppercase font-bold text-blue-500 tracking-wider mb-1.5">Your submitted materials:</span>
                            <div className="flex flex-col gap-1.5 text-[11px] font-medium text-slate-700">
                              {pres.slidesUrl && (
                                <a
                                  href={pres.slidesUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1.5"
                                >
                                  <ExternalLink className="h-3 w-3 text-blue-500" />
                                  <span>Web Slideshow URL (PowerPoint / Slides) ⧉</span>
                                </a>
                              )}
                              {pres.fileUrl && (
                                <a
                                  href={pres.fileUrl}
                                  download={pres.fileName || "Slides.pptx"}
                                  className="text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1.5"
                                >
                                  <CloudDownload className="h-3.5 w-3.5 text-indigo-500" />
                                  <span>Download Slide Deck ({pres.fileName || "Slides.pptx"})</span>
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Supervisor Feedback */}
                        {pres.feedback && (
                          <div className="mt-3.5 bg-amber-50/40 border border-amber-100 rounded p-2.5 text-slate-800 text-left">
                            <span className="block text-[8px] uppercase font-bold text-amber-600 tracking-wider">Supervisor Evaluation:</span>
                            <p className="text-[11px] font-medium leading-relaxed whitespace-pre-line mt-1">
                              {pres.feedback}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Submit Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => {
                            setSubmittingPres(pres);
                            setSlidesUrlInput(pres.slidesUrl || "");
                            setSessionFile(null);
                          }}
                          className={`${
                            isPending
                              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          } font-extrabold text-[10px] px-3.5 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5`}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>{isPending ? "Upload PowerPoint Slides" : "Update PowerPoint Slides"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (4 cols): Schedulers, Supervisions bookings */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Stats widget */}
          <div className="bg-slate-900 border border-slate-850 text-white p-4.5 rounded-lg shadow-sm relative text-left overflow-hidden">
            <div className="absolute top-0 right-0 h-24 w-24 bg-blue-500/10 rounded-full blur-2xl" />
            <h4 className="font-extrabold text-[9px] uppercase tracking-widest text-slate-400">Academic Standing</h4>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800">
                <p className="text-base font-extrabold text-blue-400">{topics.length}</p>
                <p className="text-[9px] text-slate-400 font-semibold tracking-wide">Proposed Drafts</p>
              </div>
              <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800">
                <p className="text-base font-extrabold text-blue-400">{schedules.filter(s => s.status === "approved").length}</p>
                <p className="text-[9px] text-slate-400 font-semibold tracking-wide">Booked Session</p>
              </div>
            </div>
          </div>

          {/* Supervisions Meetings Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4.5 shadow-xs text-left">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-3 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase text-slate-950 tracking-wider">
                Supervision Schedule
              </h3>
              <button
                onClick={() => setIsBookerOpen(!isBookerOpen)}
                className="text-blue-600 hover:text-blue-700 p-1 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer transition"
                title="Book supervisor time"
              >
                <CalendarPlus className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Scheduler Submition dropdown panel */}
            {isBookerOpen && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded mb-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono">Assign Supervision Date</h4>
                  <button onClick={() => setIsBookerOpen(false)} className="text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase tracking-wider">Cancel</button>
                </div>

                <form onSubmit={handleBookingSubmit} className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Meeting Topic / Agenda</label>
                    <input
                      type="text"
                      required
                      value={bookingForm.title}
                      onChange={(e) => setBookingForm({ ...bookingForm, title: e.target.value })}
                      placeholder="e.g. Discuss Research Methodology block"
                      list="meeting-presets"
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-hidden bg-white"
                    />
                    <datalist id="meeting-presets">
                      <option value="Initial Project Scope Consultation" />
                      <option value="Topic Discussion & Brainstorming" />
                      <option value="Literature Review Alignment" />
                      <option value="Research Methodology Review" />
                      <option value="Intermediate Chapters Draft Correction" />
                      <option value="Final Thesis Manuscript Presentation" />
                      <option value="Final Defense Presentation / Viva Voce" />
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
                      <input
                        type="date"
                        required
                        value={bookingForm.meetingDate}
                        onChange={(e) => setBookingForm({ ...bookingForm, meetingDate: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-hidden bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time</label>
                      <input
                        type="time"
                        required
                        value={bookingForm.time}
                        onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-hidden bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Venue</label>
                    <input
                      type="text"
                      required
                      value={bookingForm.venue}
                      onChange={(e) => setBookingForm({ ...bookingForm, venue: e.target.value })}
                      placeholder="e.g. Office Building Room 204"
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded transition"
                  >
                    Send Booking Invitation
                  </button>
                </form>
              </div>
            )}

            {/* List of meetings */}
            {schedules.length === 0 ? (
              <div className="py-6 text-center text-slate-405">
                <Calendar className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-semibold">No supervisions booked.</p>
                <p className="text-[10px] text-slate-400">Click the calendar icon above to choose a supervision date.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {schedules.map((sch) => {
                  const meta = getScheduleStatusMeta(sch.status);
                  const isCancelable = ["pending", "approved"].includes(sch.status);

                  return (
                    <div key={sch.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 hover:shadow-xs transition-shadow">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">
                          {sch.title}
                        </h4>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded leading-none ${meta.bg}`}>
                          {meta.label}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600 font-medium">
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{sch.meetingDate} at {sch.time}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{sch.venue}</span>
                        </p>
                      </div>

                      {sch.status === "approved" && (
                        <div className="border-t border-slate-200 mt-2 pt-2.5 flex justify-end">
                          <button
                            onClick={() => setActiveVideoCall(`supervision-${sch.id}`)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-[10px] rounded flex items-center gap-1.5 transition shadow-sm cursor-pointer w-full justify-center"
                          >
                            <Video className="h-3.5 w-3.5" />
                            <span>Join Video Meeting Room</span>
                          </button>
                        </div>
                      )}

                      {isCancelable && (
                        <div className="border-t border-slate-200 mt-2 pt-2 flex justify-end">
                          <button
                            onClick={() => handleCancelMeeting(sch.id)}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Cancel Booking</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Custom Modal: Delete Shared Document Confirmation */}
      {docToDelete && (
        <div className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md p-5 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3.5">
              <div className="p-2.5 bg-rose-50 rounded-full">
                <AlertTriangle className="h-6 w-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 font-sans">Stop Sharing File?</h3>
                <p className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider">Document Deletion Action</p>
              </div>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <p className="text-slate-700 leading-relaxed font-semibold">
                Are you sure you want to delete and stop sharing this research draft document with your supervisor?
              </p>
              <p className="text-slate-400 leading-normal text-[11px] bg-slate-50 p-2.5 rounded border border-slate-150">
                Any existing review feedback records or active remarks submitted for this specific file draft will be lost.
              </p>
            </div>

            <div className="flex justify-end gap-2 pr-1">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDoc}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-sm flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Stop Sharing</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal: Cancel Booked Meeting Confirmation */}
      {meetingToCancel && (
        <div className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md p-5 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600 mb-3.5">
              <div className="p-2.5 bg-amber-50 rounded-full">
                <Calendar className="h-6 w-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 font-sans">Cancel Booked Meeting?</h3>
                <p className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider">Supervision Calendar cancellation</p>
              </div>
            </div>

            <p className="text-slate-700 text-xs mb-4 leading-relaxed font-semibold">
              Are you sure you want to cancel this booked meeting with your supervisor?
            </p>

            <div className="flex justify-end gap-2 pr-1">
              <button
                type="button"
                onClick={() => setMeetingToCancel(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition-all cursor-pointer"
              >
                No, Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelMeeting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-sm flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Cancel Meeting</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal: Submit Slides Deliverables Overlay */}
      {submittingPres && (
        <div className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-lg p-5 text-left animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-150 mb-4 bg-transparent">
              <h3 className="font-extrabold text-sm text-slate-900 font-sans">Submit Slides: &ldquo;{submittingPres.title}&rdquo;</h3>
              <button onClick={() => setSubmittingPres(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSlidesSubmit} className="space-y-4 col-span-full block mb-0">
              <div className="space-y-1 block">
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide">
                  Online PPT Slideshow URL
                </label>
                <input
                  type="url"
                  value={slidesUrlInput}
                  onChange={(e) => setSlidesUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/presentation/d/... or OneDrive slideshow link"
                  className="w-full text-xs border border-slate-200 rounded px-2.5 py-2 focus:border-blue-500 bg-white text-slate-800"
                />
                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Provide a shareable Google Slides or Microsoft PowerPoint link (ensure permissions allow your advisor to view it).</p>
              </div>

              <div className="space-y-1 block">
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide">
                  Physical Slides File (.ppt, .pptx, or .pdf format)
                </label>
                <input
                  type="file"
                  accept=".ppt,.pptx,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      setSessionFile(file);
                    }
                  }}
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-2 cursor-pointer focus:outline-hidden"
                />
                {sessionFile && (
                  <p className="text-[10px] text-indigo-600 font-semibold mt-1">✓ Ready to upload: {sessionFile.name} ({(sessionFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                )}
                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Or choose a PowerPoint presentation file to upload directly.</p>
              </div>

              <div className="flex justify-end gap-2 pr-1 border-t border-slate-150 pt-3.5 mt-2">
                <button
                  type="button"
                  onClick={() => setSubmittingPres(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-755 font-bold text-xs rounded transition-all cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmitSlideDeck}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-sm flex items-center gap-1"
                >
                  {isSubmitSlideDeck ? "Uploading..." : "Save Deliverables"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple topic status validator helper
function hasApprovedTopic(topics: Topic[]) {
  return topics.some((t) => t.status === "approved");
}
