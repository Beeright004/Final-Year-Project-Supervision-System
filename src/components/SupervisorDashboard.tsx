import React, { useState, useEffect } from "react";
import { User, Topic, Proposal, Schedule, SharedDocument } from "../types.js";
import { api } from "../lib/api.js";
import { useApp } from "../context/AppContext.js";
import { 
  Users, CheckCircle2, AlertCircle, FileText, Clock, Trash2, Check, X, Calendar, MapPin, 
  Plus, MessageSquare, Award, CloudDownload, CalendarRange, Filter, RefreshCw, Eye, FileSpreadsheet, FileCode, Inbox, Video
} from "lucide-react";
import VideoCall from "./VideoCall.js";

export default function SupervisorDashboard() {
  const { user, addToast } = useApp();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [presentations, setPresentations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // Filtering & Search
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTopicTab, setFilterTopicTab] = useState<"topics" | "proposals" | "schedules" | "documents" | "presentations">("topics");

  // Document Review and Preview overlay states
  const [previewingDoc, setPreviewingDoc] = useState<SharedDocument | null>(null);
  const [docFeedbackText, setDocFeedbackText] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [previewFileText, setPreviewFileText] = useState<string | null>(null);
  const [isLoadingPreviewText, setIsLoadingPreviewText] = useState(false);

  // Review Operations Modal states
  const [reviewingTopic, setReviewingTopic] = useState<Topic | null>(null);
  const [reviewForm, setReviewForm] = useState({ status: "approved" as "approved" | "rejected" | "revision", feedback: "" });
  const [isSubmitReview, setIsSubmitReview] = useState(false);

  // Proposal Review states
  const [reviewingProposal, setReviewingProposal] = useState<any | null>(null);
  const [proposalForm, setProposalForm] = useState({ status: "approved" as "approved" | "rejected", feedback: "" });
  const [isSubmitPropReview, setIsSubmitPropReview] = useState(false);

  // PowerPoint Presentation request state
  const [isPresCreatorOpen, setIsPresCreatorOpen] = useState(false);
  const [presForm, setPresForm] = useState({ studentId: "", title: "", description: "", dueDate: "", meetingUrl: "" });
  const [isSubmitPres, setIsSubmitPres] = useState(false);

  // Presentation review state
  const [reviewingPres, setReviewingPres] = useState<any | null>(null);
  const [presReviewForm, setPresReviewForm] = useState({ status: "approved" as "approved" | "revision", feedback: "" });
  const [isSubmitPresReview, setIsSubmitPresReview] = useState(false);

  // Video call state
  const [activeVideoCall, setActiveVideoCall] = useState<string | null>(null);

  // Create customized supervisor meetings
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState<"single" | "all">("single");
  const [meetingForm, setMeetingForm] = useState({ title: "", meetingDate: "", time: "", venue: "", studentId: "" });
  const [supervisorStudents, setSupervisorStudents] = useState<User[]>([]);

  const loadSupervisorPanelData = async () => {
    try {
      const topicList = await api.topics.list();
      setTopics(topicList);

      const scheduleList = await api.schedules.list();
      setSchedules(scheduleList);

      const computedStats = await api.admin.stats();
      setStats(computedStats);

      // Load shared general deliverables documents
      const docList = await api.documents.list();
      setDocuments(docList);

      // Load supervised students
      const userList = await api.admin.users.list();
      const mine = userList.filter((u: any) => u.supervisorId === user?.id);
      setSupervisorStudents(mine);

      // Load online PowerPoint presentation requests
      const presList = await api.presentations.list();
      setPresentations(presList);
    } catch (e: any) {
      console.error(e);
      addToast("Failed to pull assigned supervision registers.", "error");
    }
  };

  const handleCreatePresRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presForm.studentId || !presForm.title || !presForm.description || !presForm.dueDate) {
      addToast("Please fill in all required fields.", "error");
      return;
    }
    setIsSubmitPres(true);
    try {
      await api.presentations.create(presForm);
      addToast("Online PowerPoint presentation request sent successfully!", "success");
      setPresForm({ studentId: "", title: "", description: "", dueDate: "", meetingUrl: "" });
      setIsPresCreatorOpen(false);
      // Reload lists
      const presList = await api.presentations.list();
      setPresentations(presList);
    } catch (err: any) {
      addToast(err?.error || "Failed to submit presentation request.", "error");
    } finally {
      setIsSubmitPres(false);
    }
  };

  const handlePresReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingPres) return;
    setIsSubmitPresReview(true);
    try {
      await api.presentations.review(reviewingPres.id, presReviewForm);
      addToast("Presentation request review recorded successfully!", "success");
      setReviewingPres(null);
      setPresReviewForm({ status: "approved", feedback: "" });
      // Reload lists
      const presList = await api.presentations.list();
      setPresentations(presList);
    } catch (err: any) {
      addToast(err?.error || "Failed to commit presentation review.", "error");
    } finally {
      setIsSubmitPresReview(false);
    }
  };

  useEffect(() => {
    loadSupervisorPanelData();
  }, []);

  // Hook for text file live previews
  useEffect(() => {
    if (previewingDoc) {
      setDocFeedbackText(previewingDoc.feedback || "");
      const ext = previewingDoc.fileName.split('.').pop()?.toLowerCase();
      if (ext === "txt" || ext === "log" || ext === "csv") {
        setIsLoadingPreviewText(true);
        setPreviewFileText(null);
        fetch(previewingDoc.fileUrl)
          .then(res => {
            if (!res.ok) throw new Error();
            return res.text();
          })
          .then(text => setPreviewFileText(text))
          .catch(() => setPreviewFileText("⚠️ Content preview is unavailable for this log standard. Try offline downloading."))
          .finally(() => setIsLoadingPreviewText(false));
      } else {
        setPreviewFileText(null);
      }
    } else {
      setPreviewFileText(null);
    }
  }, [previewingDoc]);

  const handleDocFeedbackConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewingDoc) return;

    try {
      setIsSubmittingFeedback(true);
      await api.documents.addFeedback(previewingDoc.id, docFeedbackText);
      addToast("Your review comments have been left successfully on this student file.", "success");
      
      const updatedDocs = await api.documents.list();
      setDocuments(updatedDocs);
      
      setPreviewingDoc({
        ...previewingDoc,
        feedback: docFeedbackText
      });
      setDocFeedbackText("");
    } catch (err: any) {
      addToast(err.message || "Failed to submit review. Try again.", "error");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingTopic) return;

    try {
      setIsSubmitReview(true);
      await api.topics.review(reviewingTopic.id, reviewForm);
      addToast(`Reviewed student topic successfully as '${reviewForm.status}'.`, "success");
      setReviewingTopic(null);
      setReviewForm({ status: "approved" as const, feedback: "" });
      loadSupervisorPanelData();
    } catch (e: any) {
      addToast(e.message || "Failed to submit review decisions.", "error");
    } finally {
      setIsSubmitReview(false);
    }
  };

  const handleProposalReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingProposal) return;

    try {
      setIsSubmitPropReview(true);
      await api.proposals.review(reviewingProposal.id, proposalForm);
      addToast(`Proposal document marked as '${proposalForm.status}'.`, "success");
      setReviewingProposal(null);
      setProposalForm({ status: "approved" as const, feedback: "" });
      loadSupervisorPanelData();
    } catch (e: any) {
      addToast(e.message || "Failed to register document review outcome.", "error");
    } finally {
      setIsSubmitPropReview(false);
    }
  };

  const handleMeetingCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { title, meetingDate, time, venue, studentId } = meetingForm;
    if (!title || !meetingDate || !time || !venue || !studentId) {
      addToast("Complete all fields before scheduling meetings.", "warning");
      return;
    }

    try {
      await api.schedules.create(meetingForm);
      addToast("Supervision meeting scheduled and student account emailed.", "success");
      setMeetingForm({ title: "", meetingDate: "", time: "", venue: "", studentId: "" });
      setBookingMode("single");
      setIsCreatorOpen(false);
      loadSupervisorPanelData();
    } catch (e: any) {
      addToast("Failed to schedule supervision session.", "error");
    }
  };

  const handleUpdateSchedule = async (id: string, status: "approved" | "rejected" | "completed" | "cancelled") => {
    try {
      await api.schedules.updateStatus(id, status);
      addToast(`Meeting status marked as '${status.toUpperCase()}'.`, "success");
      loadSupervisorPanelData();
    } catch (e: any) {
      addToast("Failed to adjust meeting status.", "error");
    }
  };

  // Filtration logic
  const filteredTopics = topics.filter((t) => {
    if (filterStatus === "all") return true;
    return t.status === filterStatus;
  });

  const getStatusStyle = (status: Topic["status"]) => {
    switch (status) {
      case "approved":
        return "bg-emerald-105 text-emerald-805 border-emerald-200";
      case "rejected":
        return "bg-rose-105 text-rose-805 border-rose-250";
      case "revision":
        return "bg-amber-105 text-amber-805 border-amber-205";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  // Capture list of pending proposals
  const pendingProposals = topics.filter(t => t.proposal && t.proposal.status === "pending");

  if (activeVideoCall) {
    return (
      <VideoCall
        channelName={activeVideoCall}
        userName={user?.name || "Supervisor"}
        userRole="supervisor"
        onLeave={() => setActiveVideoCall(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full px-1 text-left">
      
      {/* Overview Greeting */}
      <div className="bg-white rounded-lg border border-slate-200 p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xs">
        <div className="space-y-1 text-left">
          <h2 className="text-lg font-extrabold text-slate-950">Lecturer Workspace: {user?.name}</h2>
          <p className="text-xs text-slate-500">
            Designation: <strong>Faculty Supervisor</strong> &bull; Department: <strong>{user?.department}</strong>
          </p>
        </div>

        {/* Stats Summary cards */}
        <div className="flex flex-wrap items-center gap-3 text-left">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg min-w-[110px]">
            <p className="text-lg font-extrabold text-slate-950">{supervisorStudents.length}</p>
            <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Supervises</p>
          </div>
          <div className="p-2.5 bg-blue-50/40 border border-blue-100 rounded-lg min-w-[110px]">
            <p className="text-lg font-extrabold text-blue-600">{topics.filter(t => t.status === "pending").length}</p>
            <p className="text-[9px] text-blue-400 font-extrabold uppercase tracking-wide">Pending Reviews</p>
          </div>
        </div>
      </div>

      {/* Tabs Layout Switcher */}
      <div className="relative bg-white/50 backdrop-blur-sm sticky top-0 z-10 -mx-1 px-1 pt-2">
        <div className="flex border-b border-slate-200 gap-6 font-sans overflow-x-auto pb-px no-scrollbar">
          <button
            onClick={() => setFilterTopicTab("topics")}
            className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
              filterTopicTab === "topics"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Project Proposals ({topics.length})
          </button>
          <button
            onClick={() => setFilterTopicTab("proposals")}
            className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
              filterTopicTab === "proposals"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Manuscript Drafts ({pendingProposals.length})
          </button>
          <button
            onClick={() => setFilterTopicTab("schedules")}
            className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
              filterTopicTab === "schedules"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Supervision Calendars ({schedules.length})
          </button>
          <button
            onClick={() => setFilterTopicTab("documents")}
            className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
              filterTopicTab === "documents"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Shared Deliverables ({documents.length})
          </button>
          <button
            onClick={() => setFilterTopicTab("presentations")}
            className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
              filterTopicTab === "presentations"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900 ring-4 ring-blue-50/50"
            }`}
          >
            <span className="relative">
              Online Presentations ({presentations.length})
              {presentations.some(p => p.status === "submitted") && (
                <span className="absolute -top-3 -right-3 h-2 w-2 bg-blue-500 rounded-full animate-ping" />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Primary Workspace Sections */}
      {filterTopicTab === "topics" && (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          
          {/* Topics reviewer (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3 mb-4">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950">
                Assigned Student Topic Portfolios
              </h3>

              {/* Filtering Controls */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2 py-1 focus:border-blue-500 bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Review Only</option>
                  <option value="approved">Approved</option>
                  <option value="revision">Revision Requested</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {filteredTopics.length === 0 ? (
              <div className="p-10 text-center text-slate-405">
                <AlertCircle className="h-8 w-8 mx-auto text-slate-300 mb-1 stroke-[1.5]" />
                <p className="text-xs font-semibold">No project topics record matched your search filter.</p>
                <p className="text-[10px] text-slate-440 mt-0.5">Assigned students will appear here as soon as they submit a proposal.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredTopics.map((topic) => (
                  <div key={topic.id} className="p-4 border border-slate-200 rounded-lg space-y-3 hover:border-slate-300 transition-all text-left bg-white">
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-950 leading-tight">
                          {topic.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Proposer: <strong>{topic.studentName}</strong> ({topic.studentMatric}) &bull; Date: {new Date(topic.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <span className={`px-2 py-0.5 text-[9px] uppercase font-extrabold tracking-wide rounded border ${getStatusStyle(topic.status)}`}>
                        {topic.status === "revision" ? "Revision Required" : topic.status}
                      </span>
                    </div>

                    {/* Summary description */}
                    <div className="text-xs text-slate-655 leading-relaxed bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
                      {topic.description}
                    </div>

                    {/* Feedback if any saved */}
                    {topic.feedback && (
                      <div className="p-2.5 bg-blue-50/20 rounded-lg border border-slate-150">
                        <p className="text-[9px] font-bold text-blue-700 uppercase tracking-widest font-mono">Your Saved Appraisal Notes</p>
                        <p className="text-[11px] text-slate-700 mt-0.5">{topic.feedback}</p>
                      </div>
                    )}

                    {/* Topic review action triggers */}
                    {["pending", "revision"].includes(topic.status) && (
                      <div className="border-t border-slate-150 pt-3 flex justify-end">
                        <button
                          onClick={() => {
                            setReviewingTopic(topic);
                            setReviewForm({ status: "approved" as const, feedback: topic.feedback || "" });
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-3.5 py-1.5 rounded cursor-pointer transition flex items-center gap-1"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Appraise Topic Proposal</span>
                        </button>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supervised Roster (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950 border-b border-slate-150 pb-3 mb-3">
              Assigned Students Guild ({supervisorStudents.length})
            </h3>

            {supervisorStudents.length === 0 ? (
              <div className="py-6 text-center text-slate-405">
                <Users className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-semibold">No students assigned.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Admins assign student research portfolios to supervisors.</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {supervisorStudents.map((stu) => {
                  const studentTopic = topics.find((t) => t.studentId === stu.id && t.status === "approved");
                  return (
                    <div key={stu.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-left">
                      <h4 className="text-xs font-bold text-slate-950">{stu.name}</h4>
                      <p className="text-[9px] text-slate-400 font-mono">{stu.matricNumber} &bull; {stu.department}</p>
                      <p className="text-[10px] text-blue-600 font-bold pt-0.5">
                        Topic: {studentTopic ? `Approved: "${studentTopic.title.slice(0, 30)}..."` : "No approved topic scope"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {filterTopicTab === "proposals" && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950 border-b border-slate-150 pb-3 mb-4 text-left">
            Milestone Manuscripts Reviewer ({pendingProposals.length} Pending)
          </h3>

          {pendingProposals.length === 0 ? (
            <div className="py-10 text-center text-slate-405">
              <FileText className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
              <p className="text-xs font-semibold">No pending manuscript documents await review.</p>
              <p className="text-[11px] text-slate-440 mt-0.5">Students with Approved Topics upload PDF scripts to request final authorization.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5 text-left">
              {pendingProposals.map((topic) => {
                const prop = topic.proposal!;
                return (
                  <div key={prop.id} className="p-4 border border-slate-200 rounded-lg space-y-3 hover:border-slate-300 transition-all bg-white">
                    <div className="space-y-0.5 animate-in">
                      <p className="text-[9px] font-bold text-blue-600 uppercase font-mono tracking-wider">Student: {topic.studentName}</p>
                      <h4 className="text-xs font-bold text-slate-950 leading-tight">Project scope: {topic.title}</h4>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 flex items-center justify-between gap-4 text-xs font-medium text-slate-700">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="h-4.5 w-4.5 text-blue-650 shrink-0" />
                        <span className="truncate">{prop.fileName}</span>
                      </div>
                      <span className="text-[10px] text-slate-450 shrink-0 font-bold font-mono">({prop.fileSize})</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-150 justify-between">
                      <a
                        href={prop.fileDataUrl}
                        download={prop.fileName}
                        className="text-[11px] hover:underline flex items-center gap-1 font-bold text-slate-650"
                      >
                        <CloudDownload className="h-4 w-4" />
                        <span>Download Script</span>
                      </a>
                      <button
                        onClick={() => {
                          setReviewingProposal({ id: prop.id, fileName: prop.fileName, studentName: topic.studentName });
                          setProposalForm({ status: "approved", feedback: "" });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Grade Manuscript
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filterTopicTab === "schedules" && (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          
          {/* Right Schedules tracking panel (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950 border-b border-slate-150 pb-3 mb-4 text-left">
              Supervision Calendar List
            </h3>

            {schedules.length === 0 ? (
              <div className="py-10 text-center text-slate-405">
                <Calendar className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-xs font-semibold">No supervisions registered currently.</p>
                <p className="text-[10px] text-slate-400">Assigned students can book date targets or you can establish calendars yourself.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {schedules.map((sch) => {
                  const isIncoming = sch.status === "pending";
                  const isCancelable = ["pending", "approved"].includes(sch.status);

                  return (
                    <div key={sch.id} className="p-4 border border-slate-200 rounded-lg space-y-3 text-left hover:border-slate-300 bg-white">
                      
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide">Candidate: {sch.studentName}</span>
                          <h4 className="text-xs font-bold text-slate-950 leading-tight">
                            {sch.title}
                          </h4>
                        </div>
                        <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded leading-none ${
                          sch.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                          sch.status === "rejected" ? "bg-rose-105 text-rose-805" :
                          sch.status === "completed" ? "bg-slate-100 text-slate-600" :
                          sch.status === "cancelled" ? "bg-rose-50 text-rose-600 line-through" :
                          "bg-amber-100 text-amber-805"
                        }`}>
                          {sch.status === "approved" ? "confirmed" : sch.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600 font-medium">
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{sch.meetingDate} &bull; {sch.time}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-405" />
                          <span className="truncate">{sch.venue}</span>
                        </p>
                      </div>

                      {sch.status === "approved" && (
                        <div className="border-t border-slate-150 pt-3">
                          <button
                            onClick={() => setActiveVideoCall(`supervision-${sch.id}`)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-[10px] rounded flex items-center gap-1.5 transition shadow-sm cursor-pointer w-full justify-center"
                          >
                            <Video className="h-3.5 w-3.5" />
                            <span>Join Video Meeting Room</span>
                          </button>
                        </div>
                      )}

                      {/* Immediate review triggers */}
                      {isCancelable && (
                        <div className="border-t border-slate-150 pt-3 flex justify-between items-center gap-2">
                          {isIncoming ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateSchedule(sch.id, "approved")}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer transition flex items-center gap-0.5"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Confirm Date</span>
                              </button>
                              <button
                                onClick={() => handleUpdateSchedule(sch.id, "rejected")}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer transition flex items-center gap-0.5"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Decline</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleUpdateSchedule(sch.id, "completed")}
                              className="text-[10px] text-blue-600 hover:underline font-bold bg-blue-50 px-2 py-1 rounded"
                            >
                              Mark Completed
                            </button>
                          )}

                          <button
                            onClick={() => handleUpdateSchedule(sch.id, "cancelled")}
                            className="text-[9px] font-bold text-rose-650 hover:text-rose-700 cursor-pointer flex items-center gap-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Cancel Agenda</span>
                          </button>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Left Schedule creator portal panel (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-3 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950">
                Self-Scheduling
              </h3>
              <button
                onClick={() => setIsCreatorOpen(!isCreatorOpen)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] px-2 py-1 rounded cursor-pointer"
              >
                {isCreatorOpen ? "Close Pane" : "Create Session"}
              </button>
            </div>

            {isCreatorOpen ? (
              <form onSubmit={handleMeetingCreate} className="space-y-3 bg-slate-50 border border-slate-150 rounded-lg p-3">
                {/* Booking Scope Selector */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Booking Scope</label>
                  <div className="flex bg-slate-200 p-0.5 rounded-md text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setBookingMode("single");
                        setMeetingForm({ ...meetingForm, studentId: "" });
                      }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        bookingMode === "single"
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Selected Student
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBookingMode("all");
                        setMeetingForm({ ...meetingForm, studentId: "all" });
                      }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        bookingMode === "all"
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Whole Students
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {bookingMode === "single" ? (
                    <>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Target Candidate</label>
                      <select
                        required={bookingMode === "single"}
                        value={meetingForm.studentId === "all" ? "" : meetingForm.studentId}
                        onChange={(e) => setMeetingForm({ ...meetingForm, studentId: e.target.value })}
                        className="w-full text-xs border border-slate-250 rounded px-2 py-1.5 focus:border-blue-500 bg-white leading-normal"
                      >
                        <option value="">-- Choose Candidate Student --</option>
                        {supervisorStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.matricNumber || "No Matric"})</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-md text-[10px] text-blue-900 leading-normal font-medium text-left">
                      ℹ️ Scheduling session for <strong>all {supervisorStudents.length} supervised students</strong>. A separate meeting entry will be created for each student.
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Agenda Focus Title</label>
                  <input
                    type="text"
                    required
                    value={meetingForm.title}
                    onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                    placeholder="e.g. Chapter 3 Draft review"
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Meeting Date</label>
                    <input
                      type="date"
                      required
                      value={meetingForm.meetingDate}
                      onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                      className="w-full text-xs border border-slate-250 rounded px-2 py-1.5 focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Meeting Time</label>
                    <input
                      type="time"
                      required
                      value={meetingForm.time}
                      onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })}
                      className="w-full text-xs border border-slate-250 rounded px-2 py-1.5 focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Platform Venue / Office Coordinates</label>
                  <input
                    type="text"
                    required
                    value={meetingForm.venue}
                    onChange={(e) => setMeetingForm({ ...meetingForm, venue: e.target.value })}
                    placeholder="e.g. Tech Suite Block C 402, or Online Meet Room"
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded transition cursor-pointer"
                >
                  Post supervision Booking
                </button>
              </form>
            ) : (
              <div className="p-3.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center text-slate-400">
                <CalendarRange className="h-7 w-7 mx-auto text-slate-350 mb-1 stroke-[1.5]" />
                <p className="text-xs font-semibold">Self-Scheduling Ready</p>
                <p className="text-[10px] text-slate-400">Click &ldquo;Create Session&rdquo; above to book date options directly.</p>
              </div>
            )}
          </div>

        </div>
      )}


      {filterTopicTab === "documents" && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left" id="supervisor-shared-deliverables-panel">
          <div className="border-b border-slate-150 pb-3 mb-4 bg-transparent col-span-full">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Shared Deliverables & Materials Hub
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Analyze files, chapters, datasets or materials dispatched by your supervised students. Launch the in-app interactive previewer or write feedback commentary.
            </p>
          </div>

          {documents.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Inbox className="h-9 w-9 mx-auto text-slate-300 stroke-[1.5] mb-2" />
              <p className="text-xs font-semibold">No shared deliverables or chapter files found.</p>
              <p className="text-[10px] text-slate-400">When your assigned students upload drafts or documents, they will populate here systematically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-full bg-transparent">
              {documents.map((doc) => {
                const ext = doc.fileName.split('.').pop()?.toLowerCase();
                return (
                  <div key={doc.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-xs transition relative flex flex-col justify-between">
                    <div>
                      {/* Student info header */}
                      <div className="flex items-center gap-2 mb-3 bg-slate-50 p-2 rounded border border-slate-150">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-800 leading-none">{doc.studentName}</p>
                          <p className="text-[9px] text-slate-500 font-mono mt-0.5">Matric: {doc.studentMatric || "N/A"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-slate-100 border border-slate-150 rounded text-blue-600 shrink-0">
                          {ext === "xlsx" || ext === "csv" ? (
                            <FileSpreadsheet className="h-4.5 w-4.5" />
                          ) : ext === "txt" || ext === "log" ? (
                            <FileCode className="h-4.5 w-4.5" />
                          ) : (
                            <FileText className="h-4.5 w-4.5" />
                          )}
                        </div>

                        <div className="space-y-1 block text-left pr-2">
                          <div className="flex flex-wrap items-center gap-1.5 bg-transparent">
                            <h5 className="text-xs font-semibold text-slate-900 truncate max-w-[200px]" title={doc.fileName}>
                              {doc.fileName}
                            </h5>
                            <span className="bg-blue-50 text-blue-700 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-blue-100">
                              {doc.tag}
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 font-semibold">
                            Size: <span className="font-semibold text-slate-600">{doc.fileSize}</span> &bull; Uploaded: <span className="font-semibold text-slate-600">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                          </p>
                        </div>
                      </div>

                      {/* Display current comment if exists */}
                      <div className="mt-3 bg-slate-50/60 border border-slate-150 rounded p-2.5 min-h-[60px] block col-span-full">
                        <span className="block text-[8px] uppercase font-bold text-slate-400 tracking-wider">My Review Feedback Remarks:</span>
                        {doc.feedback ? (
                          <p className="text-[11px] text-slate-800 font-medium mt-1 whitespace-pre-line bg-transparent">
                            {doc.feedback}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic mt-1 bg-transparent">
                            No feedback logged. Write remarks by selecting "Preview & Grade" below.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 gap-2">
                      <a
                        href={doc.fileUrl}
                        download={doc.fileName}
                        referrerPolicy="no-referrer"
                        target="_blank"
                        className="text-slate-600 hover:text-slate-950 font-bold text-[10px] flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded transition cursor-pointer"
                      >
                        <CloudDownload className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </a>

                      <button
                        onClick={() => setPreviewingDoc(doc)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded transition cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Preview & Grade</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}


      {/* ========================================================== */}
      {/* ONLINE POWERPOINT PRESENTATIONS SECTION */}
      {/* ========================================================== */}
      {filterTopicTab === "presentations" && (
        <div className="space-y-6 animate-in fade-in duration-150 text-left" id="supervisor-presentations-panel">
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-4 mb-5">
              <div className="space-y-1 text-left">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950 flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-blue-600" />
                  Lecturer Presentation Scheduling Portal
                </h3>
                <p className="text-xs text-slate-500">
                  Request, inspect, and evaluate online slideshow presentations and PowerPoint deliverables.
                </p>
              </div>
              
              <button
                onClick={() => setIsPresCreatorOpen(!isPresCreatorOpen)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-center"
              >
                <Plus className="h-4 w-4" />
                <span>{isPresCreatorOpen ? "Cancel Request" : "Request PowerPoint Presentation"}</span>
              </button>
            </div>

            {/* Inline Presentation Request Form */}
            {isPresCreatorOpen && (
              <form onSubmit={handleCreatePresRequest} className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-6 space-y-4 max-w-xl animate-in stroke-xs duration-200">
                <div className="border-b border-slate-150 pb-2 mb-2">
                  <h4 className="font-bold text-xs uppercase tracking-wide text-slate-800">New PowerPoint Slide Deck Request</h4>
                  <p className="text-[10px] text-slate-400">Fill details and set a deadline for the candidate.</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Target Project Student</label>
                    <select
                      required
                      value={presForm.studentId}
                      onChange={(e) => setPresForm({ ...presForm, studentId: e.target.value })}
                      className="w-full text-xs border border-slate-250 rounded px-2.5 py-2 focus:border-blue-500 bg-white"
                    >
                      <option value="">-- Choose Supervised Student Candidate --</option>
                      {supervisorStudents.map((stud) => (
                        <option key={stud.id} value={stud.id}>
                          {stud.name} ({stud.matricNumber || "No Matric"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Presentation Title</label>
                    <input
                      type="text"
                      required
                      value={presForm.title}
                      onChange={(e) => setPresForm({ ...presForm, title: e.target.value })}
                      placeholder="e.g. Mid-term Presentation: Methodology & Database Schema"
                      className="w-full text-xs border border-slate-250 rounded px-2.5 py-2 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Instructions / Guidelines</label>
                    <textarea
                      required
                      rows={3}
                      value={presForm.description}
                      onChange={(e) => setPresForm({ ...presForm, description: e.target.value })}
                      placeholder="Detail instructions: expected slides count, key issues to address, or presentation goals..."
                      className="w-full text-xs border border-slate-250 rounded px-2.5 py-2 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Submission Deadline Date</label>
                      <input
                        type="date"
                        required
                        value={presForm.dueDate}
                        onChange={(e) => setPresForm({ ...presForm, dueDate: e.target.value })}
                        className="w-full text-xs border border-slate-250 rounded px-2.5 py-2 focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Meeting Room URL (Optional)</label>
                      <input
                        type="url"
                        value={presForm.meetingUrl}
                        onChange={(e) => setPresForm({ ...presForm, meetingUrl: e.target.value })}
                        placeholder="e.g. Zoom or Google Meet URL"
                        className="w-full text-xs border border-slate-250 rounded px-2.5 py-2 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={() => setIsPresCreatorOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-bold bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitPres}
                    className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitPres ? "Submitting..." : "Send Request"}
                  </button>
                </div>
              </form>
            )}

            {/* List of Requests */}
            {presentations.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                <FileText className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-xs font-bold">No PowerPoint Presentation requests loaded yet.</p>
                <p className="text-[10px] text-slate-400">Click &ldquo;Request PowerPoint Presentation&rdquo; above to prompt a student.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 col-span-full">
                {presentations.map((pres) => {
                  return (
                    <div key={pres.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-xs transition flex flex-col justify-between">
                      <div>
                        {/* Student Info Bar */}
                        <div className="flex items-center justify-between mb-3 bg-slate-50 p-2 border border-slate-150 rounded">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-800 leading-none">{pres.studentName}</p>
                              <p className="text-[9px] text-slate-500 font-mono mt-0.5">Matric: {pres.studentMatric || "N/A"}</p>
                            </div>
                          </div>
                          
                          {/* Rich Status tags */}
                          {pres.status === "pending" && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Pending Response
                            </span>
                          )}
                          {pres.status === "submitted" && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                              Submitted Slides
                            </span>
                          )}
                          {pres.status === "approved" && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Approved
                            </span>
                          )}
                          {pres.status === "revision" && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Revision Required
                            </span>
                          )}
                        </div>

                        {/* Title and Body */}
                        <div className="space-y-1 block text-left">
                          <h4 className="text-xs font-bold text-slate-900">{pres.title}</h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {pres.description}
                          </p>
                        </div>

                        {/* Due Date & Meeting coordinates */}
                        <div className="mt-3.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                          <div>
                            <span className="font-bold text-slate-400 block uppercase text-[8px]">Due Deadline:</span>
                            <span className="font-semibold text-slate-700">
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
                            <span className="font-bold text-slate-400 block uppercase text-[8px]">Online Session Meet:</span>
                            <div className="space-y-2 mt-1">
                              {pres.meetingUrl && (
                                <a
                                  href={pres.meetingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 font-bold hover:underline truncate block text-[11px]"
                                >
                                  External Link &rarr;
                                </a>
                              )}
                              <button
                                onClick={() => setActiveVideoCall(`presentation-${pres.id}`)}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-[9px] py-1.5 rounded flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                              >
                                <Video className="h-3 w-3" />
                                <span>Join Live Video Room</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Deliverables slideshow submission detail */}
                        {(pres.slidesUrl || pres.fileUrl) && (
                          <div className="mt-3.5 bg-blue-50/40 border border-blue-100 rounded p-2.5 text-left">
                            <span className="block text-[8px] uppercase font-bold text-blue-500 tracking-wider mb-1.5">Submitted Slide decks:</span>
                            <div className="flex flex-col gap-1.5">
                              {pres.slidesUrl && (
                                <a
                                  href={pres.slidesUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1.5"
                                >
                                  <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span>Open Online PowerPoint/Google Slides ⧉</span>
                                </a>
                              )}
                              {pres.fileUrl && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <a
                                    href={pres.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-bold bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 transition flex items-center gap-1.5"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span>Open & Read (Real-time)</span>
                                  </a>
                                  <a
                                    href={pres.fileUrl}
                                    download={pres.fileName || "Presentation.pptx"}
                                    className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded hover:bg-slate-200 transition flex items-center gap-1.5"
                                  >
                                    <CloudDownload className="h-3 w-3" />
                                    <span>Download</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Feedback Commentary */}
                        {pres.feedback && (
                          <div className="mt-3.5 bg-slate-50 border border-slate-150 rounded p-2.5 text-left">
                            <span className="block text-[8px] uppercase font-bold text-slate-400 tracking-wider">Evaluation Comments:</span>
                            <p className="text-[11px] text-slate-800 font-medium mt-1 whitespace-pre-line leading-relaxed">
                              {pres.feedback}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Footer evaluation actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => {
                            setReviewingPres(pres);
                            setPresReviewForm({
                              status: pres.status === "approved" || pres.status === "revision" ? pres.status : "approved",
                              feedback: pres.feedback || ""
                            });
                          }}
                          className={`${
                            pres.status === "submitted"
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          } font-extrabold text-[10px] px-3.5 py-1.5 rounded transition cursor-pointer flex items-center gap-1`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{pres.status === "submitted" ? "Assess PowerPoint" : "Grade Slideshow"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}


      {/* MODAL OVERLAY: Deliverable File Previewer & Grade Modal */}
      {previewingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="space-y-0.5 text-left">
                <span className="text-[9px] uppercase font-bold text-blue-600 font-mono tracking-wider">Deliverable Review Center</span>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 leading-none">
                  {previewingDoc.fileName}
                  <span className="text-xs font-normal text-slate-500">[{previewingDoc.tag}]</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">Provided by <strong className="text-slate-700">{previewingDoc.studentName}</strong> &bull; Size: {previewingDoc.fileSize}</p>
              </div>
              <button 
                onClick={() => setPreviewingDoc(null)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 bg-white hover:bg-slate-100 rounded-full border border-slate-150"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Body: Split design for premium interface previewing */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-transparent">
              {/* Left Column: Interactive Previewer (7/12 width) */}
              <div className="lg:col-span-7 bg-slate-900 flex flex-col justify-center items-center relative overflow-y-auto p-4 border-r border-slate-200">
                
                {/* PDF and other renderers */}
                {(() => {
                  const ext = previewingDoc.fileName.split('.').pop()?.toLowerCase();
                  if (["png", "jpg", "jpeg"].includes(ext || "")) {
                    return (
                      <div className="max-w-full max-h-full overflow-auto flex items-center justify-center p-2">
                        <img 
                          src={previewingDoc.fileUrl} 
                          alt="Deliverable Preview" 
                          className="rounded border border-slate-800 shadow-md max-w-full max-h-[60vh] object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    );
                  } else if (["txt", "log", "csv"].includes(ext || "")) {
                    return (
                      <div className="w-full h-full bg-slate-950 rounded border border-slate-850 p-4 font-mono text-[11px] text-emerald-400 text-left overflow-auto whitespace-pre-wrap select-text">
                        {isLoadingPreviewText ? (
                          <div className="flex items-center justify-center h-full gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Reading file contents in real-time...</span>
                          </div>
                        ) : (
                          previewFileText || "File is empty or content is unavailable."
                        )}
                      </div>
                    );
                  } else if (ext === "pdf") {
                    return (
                      <iframe
                        src={`${previewingDoc.fileUrl}#toolbar=0`}
                        title="PDF Viewer"
                        className="w-full h-full rounded border border-slate-800"
                        referrerPolicy="no-referrer"
                      />
                    );
                  } else {
                    return (
                      <div className="text-center text-slate-400 space-y-3 max-w-sm p-6 bg-slate-950/40 border border-slate-800 rounded-lg">
                        <FileText className="h-10 w-10 mx-auto text-slate-500" />
                        <h4 className="font-bold text-xs text-slate-200">Natively Unrenderable Document</h4>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Format standard (<strong className="text-slate-300">.{ext}</strong>) cannot be displayed natively inside your browser page. Please click below to download and review on your physical machine.
                        </p>
                        <a
                          href={previewingDoc.fileUrl}
                          download={previewingDoc.fileName}
                          referrerPolicy="no-referrer"
                          target="_blank"
                          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded transition cursor-pointer"
                        >
                          <CloudDownload className="h-4 w-4" />
                          <span>Download & Review Locally</span>
                        </a>
                      </div>
                    );
                  }
                })()}

              </div>

              {/* Right Column: Feedback commentary Panel (5/12 width) */}
              <div className="lg:col-span-5 bg-white flex flex-col justify-between overflow-y-auto p-5 text-left">
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-lg">
                    <h4 className="text-[10px] font-bold uppercase text-blue-800 tracking-wider font-mono">Academic Candidate details</h4>
                    <div className="mt-2 text-xs grid grid-cols-2 gap-2 text-slate-705 font-medium bg-transparent">
                      <p>Name: <strong className="text-slate-900">{previewingDoc.studentName}</strong></p>
                      <p>Matric: <strong className="text-slate-900 font-mono">{previewingDoc.studentMatric || "N/A"}</strong></p>
                    </div>
                  </div>

                  <form onSubmit={handleDocFeedbackConfirm} className="space-y-4 col-span-full block">
                    <div className="space-y-1 block">
                      <label htmlFor="lecturer-remark-text" className="block text-[10px] font-bold uppercase text-slate-550 tracking-wide">
                        Advisory Assessment Remarks
                      </label>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Provide directives, recommendations or edit requirements. The student receives this review instantly with auto-notifications.
                      </p>
                      <textarea
                        id="lecturer-remark-text"
                        required
                        rows={8}
                        value={docFeedbackText}
                        onChange={(e) => setDocFeedbackText(e.target.value)}
                        placeholder="e.g. Chapter 1 is structured well. However, please expand the problem statement objectives block to include real-world application models and format reference citation styles..."
                        className="w-full text-xs font-semibold border border-slate-200 hover:border-slate-350 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-505 bg-white text-slate-800"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingFeedback}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs py-2 rounded transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Recording assessment...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Submit & Post Remarks</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-5">
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    &bull; Submitting remarks flags the document as reviewed. Students are automatically notified to implement adjustments.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}


      {/* MODAL OVERLAY: Topic Review Modal */}
      {reviewingTopic && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-lg p-5 text-left animate-in zoom-in-95 duration-100">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-150 mb-3 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                Review Student Proposal: &ldquo;{reviewingTopic.title.slice(0, 30)}...&rdquo;
              </h3>
              <button onClick={() => setReviewingTopic(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Appraisal Outcome Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewForm({ ...reviewForm, status: "approved" })}
                    className={`p-2.5 text-xs font-bold border rounded cursor-pointer text-center transition ${
                      reviewForm.status === "approved"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-850 shadow-xs animate-in"
                        : "bg-white hover:bg-slate-50 border-slate-250 text-slate-600"
                    }`}
                  >
                    Approve Topic
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewForm({ ...reviewForm, status: "revision" })}
                    className={`p-2.5 text-xs font-bold border rounded cursor-pointer text-center transition ${
                      reviewForm.status === "revision"
                        ? "bg-amber-50 border-amber-500 text-amber-850 shadow-xs animate-in"
                        : "bg-white hover:bg-slate-50 border-slate-250 text-slate-600"
                    }`}
                  >
                    Request Revision
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewForm({ ...reviewForm, status: "rejected" })}
                    className={`p-2.5 text-xs font-bold border rounded cursor-pointer text-center transition ${
                      reviewForm.status === "rejected"
                        ? "bg-rose-50 border-rose-500 text-rose-850 shadow-xs animate-in"
                        : "bg-white hover:bg-slate-50 border-slate-250 text-slate-600"
                    }`}
                  >
                    Disapprove / Reject
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Educator Written Feedback & Advice</label>
                <textarea
                  required
                  rows={4}
                  value={reviewForm.feedback}
                  onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                  placeholder="Detail academic recommendations, required citations, adjust objectives scope, or explain revision directives..."
                  className="w-full text-xs border border-slate-250 rounded px-2.5 py-2 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-150 pt-3">
                <button
                  type="button"
                  onClick={() => setReviewingTopic(null)}
                  className="px-3.5 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmitReview}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  Save Appraisal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL OVERLAY: Proposal Manuscript Review Modal */}
      {reviewingProposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-lg p-5 text-left animate-in zoom-in-95 duration-100">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-150 mb-3 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                Appraise Document: &ldquo;{reviewingProposal.fileName}&rdquo;
              </h3>
              <button onClick={() => setReviewingProposal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleProposalReviewSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 font-mono tracking-wide">Candidate Student: {reviewingProposal.studentName}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProposalForm({ ...proposalForm, status: "approved" })}
                    className={`p-2.5 text-xs font-bold border rounded cursor-pointer text-center transition ${
                      proposalForm.status === "approved"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-850"
                        : "bg-white hover:bg-slate-50 border-slate-250 text-slate-600"
                    }`}
                  >
                    Accept proposal
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposalForm({ ...proposalForm, status: "rejected" })}
                    className={`p-2.5 text-xs font-bold border rounded cursor-pointer text-center transition ${
                      proposalForm.status === "rejected"
                        ? "bg-rose-50 border-rose-500 text-rose-850"
                        : "bg-white hover:bg-slate-50 border-slate-250 text-slate-600"
                    }`}
                  >
                    Reject proposal with revision
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Appraisal Feedback Comments</label>
                <textarea
                  required
                  rows={4}
                  value={proposalForm.feedback}
                  onChange={(e) => setProposalForm({ ...proposalForm, feedback: e.target.value })}
                  placeholder="Detail manuscript errors, methodology gaps, data collection feedback, or provide overall confirmation remarks..."
                  className="w-full text-xs border border-slate-255 rounded px-2.5 py-2"
                />
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-150 pt-3">
                <button
                  type="button"
                  onClick={() => setReviewingProposal(null)}
                  className="px-3.5 py-1.5 text-xs font-bold bg-slate-100 text-slate-750 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitPropReview}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  Save Tally
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL OVERLAY: Online Presentation Evaluation Modal */}
      {reviewingPres && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-lg p-5 text-left animate-in zoom-in-95 duration-100">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-150 mb-3 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                Grade Online Presentation: &ldquo;{reviewingPres.title.slice(0, 30)}...&rdquo;
              </h3>
              <button onClick={() => setReviewingPres(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handlePresReviewSubmit} className="space-y-3.5 block">
              <div className="space-y-1 block">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Evaluation Verdict</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPresReviewForm({ ...presReviewForm, status: "approved" })}
                    className={`p-2.5 text-xs font-bold border rounded cursor-pointer text-center transition ${
                      presReviewForm.status === "approved"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-850 shadow-xs"
                        : "bg-white hover:bg-slate-50 border-slate-250 text-slate-600"
                    }`}
                  >
                    Approve Presentation
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresReviewForm({ ...presReviewForm, status: "revision" })}
                    className={`p-2.5 text-xs font-bold border rounded cursor-pointer text-center transition ${
                      presReviewForm.status === "revision"
                        ? "bg-amber-50 border-amber-500 text-amber-850 shadow-xs"
                        : "bg-white hover:bg-slate-50 border-slate-250 text-slate-600"
                    }`}
                  >
                    Request Modification / Re-Do
                  </button>
                </div>
              </div>

              <div className="space-y-1 block">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Educator Advisory Feedback Details</label>
                <textarea
                  required
                  rows={5}
                  value={presReviewForm.feedback}
                  onChange={(e) => setPresReviewForm({ ...presReviewForm, feedback: e.target.value })}
                  placeholder="Detail critical slide errors, design layout remarks, key questions answered wall, or overall grading commentary..."
                  className="w-full text-xs border border-slate-250 rounded px-2.5 py-2 focus:border-blue-500 bg-white text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-150 pt-3">
                <button
                  type="button"
                  onClick={() => setReviewingPres(null)}
                  className="px-3.5 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmitPresReview}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer disabled:opacity-50"
                >
                  {isSubmitPresReview ? "Saving..." : "Save Evaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
