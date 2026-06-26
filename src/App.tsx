import React, { useState, lazy, Suspense } from "react";
import { AppProvider, useApp } from "./context/AppContext.js";
import LandingPage from "./components/LandingPage.js";
import DashboardLoading from "./components/DashboardLoading.js";
import supervisionLogo from "./assets/images/supervision_logo_1780237288997.png";

// Lazy-loaded dashboard components for performance optimization
const StudentDashboard = lazy(() => import("./components/StudentDashboard.js"));
const SupervisorDashboard = lazy(() => import("./components/SupervisorDashboard.js"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard.js"));
const EmailSimulator = lazy(() => import("./components/EmailSimulator.js"));

import { api } from "./lib/api.js";
import {
  Building2, BookOpen, LogIn, UserPlus, LogOut, ArrowRight, BookMarked,
  LayoutDashboard, Bell, FileText, Calendar, Compass, Shield, User,
  HelpCircle, Mail, Globe, CheckCircle, Info, Hash, PhoneCall, AlertCircle, X, ChevronRight,
  Eye, EyeOff, Users, Menu, Server, Cpu, Activity
} from "lucide-react";

function RootApp() {
  const { user, login, register, confirmRegister, logout, loading, toasts, removeToast, supervisors, addToast, notifications, markNotificationRead } = useApp();

  // Public tabs routing states
  const [publicView, setPublicView] = useState<"home" | "about" | "faq" | "contact" | "login" | "register">("home");

  // Auth local inputs
  const [loginRole, setLoginRole] = useState<"student" | "supervisor">("student");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student" as "student" | "supervisor",
    matricNumber: "",
    department: "Computer Science",
    supervisorId: "",
  });

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [dashboardHubOpen, setDashboardHubOpen] = useState(false);
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [supervisorStudentsList, setSupervisorStudentsList] = useState<any[]>([]);
  const [loadingStudentsList, setLoadingStudentsList] = useState(false);

  const handleOpenStudentsList = async () => {
    setStudentsModalOpen(true);
    setLoadingStudentsList(true);
    try {
      const list = await api.supervisors.students();
      setSupervisorStudentsList(list);
    } catch (e) {
      addToast("Failed to load students database.", "error");
    } finally {
      setLoadingStudentsList(false);
    }
  };

  // Registration OTP fields
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationOtp, setVerificationOtp] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.email || !authForm.password) {
      addToast("Please fill in both email and password.", "warning");
      return;
    }
    try {
      setSubmittingAuth(true);
      await login(authForm);
      setAuthForm({ email: "", password: "" });
      setPublicView("home"); // fall back if logged in
    } catch (e) {
      // Handled in context
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.email || !regForm.password || !regForm.department) {
      addToast("Ensure you cover all mandatory registration details.", "warning");
      return;
    }
    if (regForm.role === "student" && (!regForm.matricNumber || !regForm.supervisorId)) {
      addToast("Students must provide their Matric Code and select an Academic Supervisor.", "warning");
      return;
    }

    try {
      setSubmittingAuth(true);
      const response = await register(regForm);
      if (response && (response as any).verificationRequired) {
        setVerificationEmail(regForm.email);
      } else {
        setPublicView("login");
      }
    } catch (e) {
      // Errors handled in context
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleConfirmOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationOtp) {
      addToast("Please enter the 6-digit verification code.", "warning");
      return;
    }
    try {
      setSubmittingAuth(true);
      await confirmRegister(verificationEmail!, verificationOtp);
      setRegForm({
        name: "",
        email: "",
        password: "",
        role: "student",
        matricNumber: "",
        department: "Computer Science",
        supervisorId: "",
      });
      setVerificationEmail(null);
      setVerificationOtp("");
      setPublicView("login");
    } catch (e) {
      // Handled in context
    } finally {
      setSubmittingAuth(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-400">Loading Academic Environment...</p>
      </div>
    );
  }

  // Define notification unreads
  const unreadNotifications = notifications.filter(n => !n.read);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative text-slate-800 selection:bg-blue-600 selection:text-white">

      {/* Dynamic Toast Notifications HUD Stack */}
      <div className="fixed top-5 right-5 z-55 max-w-sm space-y-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-lg border shadow-lg transition-all duration-300 transform translate-y-0 animate-in slide-in-from-top-4 font-sans ${toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-950" :
              toast.type === "error" ? "bg-rose-50 border-rose-250 text-rose-950" :
                toast.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-950" :
                  "bg-blue-50 border-blue-200 text-blue-950"
              }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" ? <CheckCircle className="h-4.5 w-4.5 text-emerald-600" /> :
                toast.type === "error" ? <AlertCircle className="h-4.5 w-4.5 text-rose-600" /> :
                  toast.type === "warning" ? <AlertCircle className="h-4.5 w-4.5 text-amber-600" /> :
                    <Info className="h-4.5 w-4.5 text-blue-600" />}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold leading-dense">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* ==========================================
          LOGGED OUT HEADER & NAVIGATION CHANNELS
         ========================================== */}
      {!user && (
        <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-6 py-3.5 text-white">
          <div className="max-w-7xl mx-auto flex items-center justify-between w-full">

            {/* Branding */}
            <button
              onClick={() => setPublicView("home")}
              className="flex items-center gap-2.5 bg-transparent border-none p-0 cursor-pointer text-left"
            >
              <img src={supervisionLogo} className="h-10 w-auto max-w-[140px] object-contain bg-white p-1 rounded-lg shadow-md border border-slate-800/50" referrerPolicy="no-referrer" />
              <div>
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight leading-none text-white">FYP Supervision</h1>
                <p className="text-[10px] text-slate-400 tracking-wider uppercase mt-0.5 font-bold">University Portal</p>
              </div>
            </button>

            {/* Middle Nav Links */}
            <nav className="hidden md:flex items-center gap-5 text-xs text-slate-300 font-bold">
              <button
                onClick={() => setPublicView("home")}
                className={`cursor-pointer transition-colors ${publicView === "home" ? "text-white" : "hover:text-white"}`}
              >
                Home
              </button>
              <button
                onClick={() => setPublicView("about")}
                className={`cursor-pointer transition-colors ${publicView === "about" ? "text-white" : "hover:text-white"}`}
              >
                About System
              </button>
              <button
                onClick={() => setPublicView("faq")}
                className={`cursor-pointer transition-colors ${publicView === "faq" ? "text-white" : "hover:text-white"}`}
              >
                FAQs
              </button>
              <button
                onClick={() => setPublicView("contact")}
                className={`cursor-pointer transition-colors ${publicView === "contact" ? "text-white" : "hover:text-white"}`}
              >
                Support Desk
              </button>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setPublicView("login")}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-lg cursor-pointer transition ${publicView === "login" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750"
                  }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setPublicView("register")}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-lg cursor-pointer transition ${publicView === "register" ? "bg-blue-600 text-white" : "bg-blue-600/10 hover:bg-blue-600 hover:text-white text-blue-400 border border-blue-500/20"
                  }`}
              >
                Register
              </button>
            </div>

          </div>
        </header>
      )}

      {/* ==========================================
          MAIN SCROLLABLE APP BODY FRAME
         ========================================== */}
      <main className="flex-1 flex flex-col">
        {user ? (

          /* ==========================================
              LOGGED OUT SHELL & ROLES SCREEN WORKSPACES
             ========================================== */
          <div className="flex-1 flex flex-col lg:flex-row min-h-[92vh]">

            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-60 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col text-left">

              {/* Branding Section */}
              <div className="p-4 border-b border-slate-800/80 hidden lg:flex items-center gap-2.5">
                <img src={supervisionLogo} className="h-10 w-auto max-w-[140px] object-contain bg-white p-1 rounded-lg shadow-md border border-slate-800/50 shrink-0" referrerPolicy="no-referrer" />
                <div>
                  <h3 className="font-extrabold text-xs text-white tracking-tight uppercase">Active Station</h3>
                  <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">
                    {user.role} terminal
                  </p>
                </div>
              </div>

              {/* Navigation Elements */}
              <div className="p-3.5 flex-1 space-y-3">
                <div className="space-y-1">
                  <div className="px-2.5 py-1 bg-slate-950/50 rounded text-[9px] font-bold text-blue-400 uppercase tracking-widest font-mono mb-1.5">
                    Primary Panels
                  </div>

                  <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-blue-600/10 border-l-4 border-blue-500 text-white text-xs font-bold text-left cursor-default">
                    <LayoutDashboard className="h-4 w-4 text-blue-400" />
                    <span>Dashboard Hub</span>
                  </button>

                  {user.role === "supervisor" && (
                    <button
                      onClick={handleOpenStudentsList}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold text-left cursor-pointer transition border border-slate-700 mt-1"
                    >
                      <Users className="h-4 w-4 text-blue-400" />
                      <span>Assigned Students List</span>
                    </button>
                  )}
                </div>

                {user.role === "student" && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2 text-left">
                    <div className="px-2 py-1 bg-slate-950/50 rounded text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      Student Bio Details
                    </div>
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/80 text-xs space-y-2 text-slate-300">
                      <div>
                        <span className="text-[9px] text-slate-500 font-mono block uppercase font-bold">Full Name</span>
                        <strong className="text-white block truncate">{user.name}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-mono block uppercase font-bold">Matric No</span>
                        <code className="text-blue-400 font-mono text-xs">{user.matricNumber || "N/A"}</code>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-mono block uppercase font-bold">Department</span>
                        <span className="block truncate text-[11px]">{user.department}</span>
                      </div>
                      {user.supervisor && (
                        <div className="pt-1.5 border-t border-slate-800/80">
                          <span className="text-[9px] text-blue-400 font-mono block uppercase font-bold">Assigned Supervisor</span>
                          <span className="text-white block truncate font-medium text-[11px]">{user.supervisor.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Profile Segment */}
              <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="bg-slate-800 text-blue-305 h-8 w-8 border border-blue-500/30 rounded-full flex items-center justify-center font-extrabold text-xs">
                    {user.name.charAt(0)}
                  </div>
                  <div className="space-y-0.5 truncate text-left flex-1">
                    <p className="text-xs font-bold text-white truncate leading-none">{user.name}</p>
                    <p className="text-[9px] text-slate-400 font-medium font-mono truncate">{user.email}</p>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="w-full bg-slate-800 hover:bg-rose-950/40 hover:text-rose-200 hover:border-rose-900 border border-slate-700 text-xs font-bold py-1.5 px-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-slate-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out Session</span>
                </button>
              </div>

            </aside>

            {/* Center Content Pane container */}
            <div className="flex-1 flex flex-col bg-slate-50">

              {/* Top Workspace controls status bar */}
              <header className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDashboardHubOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer font-bold text-xs"
                    title="Open Dashboard Hub Details & Telemetry"
                  >
                    <Menu className="h-4 w-4" />
                    <span>Dashboard Hub</span>
                  </button>
                  <span className="hidden sm:inline-flex bg-slate-100 px-2.5 py-0.5 border border-slate-200 rounded text-[9px] font-bold font-mono tracking-wider text-slate-600 uppercase">
                    SYS-MODE: {user.role === "admin" ? "MASTER_DECK" : "DECENTRALIZED"}
                  </span>
                </div>

                <div className="flex items-center gap-3 relative">

                  {/* Notifications feed dropdown toggle */}
                  <div className="relative">
                    <button
                      onClick={() => setNotificationOpen(!notificationOpen)}
                      className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg relative cursor-pointer"
                      title="Alert System Channels"
                    >
                      <Bell className="h-4 w-4 text-slate-600" />
                      {unreadNotifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-[8px] font-bold h-3.5 w-3.5 rounded-full flex items-center justify-center text-white border border-white animate-pulse" />
                      )}
                    </button>

                    {notificationOpen && (
                      <div className="absolute right-0 mt-2 z-55 bg-white rounded-lg border border-slate-200 shadow-xl w-72 p-3 text-left animate-in fade-in slide-in-from-top-2 duration-100">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                          <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wide">Notifications</span>
                          <span className="text-[9px] text-slate-400 font-bold">{unreadNotifications.length} unread</span>
                        </div>

                        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                          {notifications.length === 0 ? (
                            <p className="text-[11px] text-slate-405 py-4 text-center">No active notifications channels.</p>
                          ) : (
                            notifications.map((not) => (
                              <div
                                key={not.id}
                                className={`text-[10px] p-2 rounded border text-left space-y-1 relative ${not.read ? "bg-slate-55 border-slate-100 text-slate-500" : "bg-blue-50/50 border-blue-105 text-blue-950"
                                  }`}
                              >
                                <p className="leading-normal font-medium">{not.message}</p>
                                <div className="flex justify-between items-center pt-0.5 text-[8px] text-slate-405">
                                  <span>{new Date(not.createdAt).toLocaleDateString()}</span>
                                  {!not.read && (
                                    <button
                                      onClick={() => markNotificationRead(not.id)}
                                      className="text-blue-600 hover:underline font-bold"
                                    >
                                      Mark Read
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Pill info */}
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-xs font-bold text-slate-950 hidden sm:block">{user.name}</span>
                    <span className="text-[9px] uppercase font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                      {user.role}
                    </span>
                  </div>

                </div>
              </header>

              {/* Main Content Workspace viewport */}
              <div className="p-4 md:p-6 flex-1 overflow-y-auto">
                <Suspense fallback={<DashboardLoading />}>
                  {user.role === "student" && <StudentDashboard />}
                  {user.role === "supervisor" && <SupervisorDashboard />}
                  {user.role === "admin" && <AdminDashboard />}
                </Suspense>
              </div>

            </div>

          </div>
        ) : (

          /* ==========================================
              LOGGED OUT PUBLIC VIEWS ROUTING PANE
             ========================================== */
          <div className="flex-1 flex flex-col">

            {/* Landing Home View */}
            {publicView === "home" && (
              <LandingPage
                onNavigateLogin={() => setPublicView("login")}
                onNavigateRegister={() => setPublicView("register")}
                onSelectTab={(tab) => setPublicView(tab as any)}
              />
            )}

            {/* About Page View */}
            {publicView === "about" && (
              <div className="py-12 px-6 max-w-3xl mx-auto w-full text-left space-y-6 animate-in fade-in duration-150">
                <div className="space-y-2 border-b border-slate-200 pb-4">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-mono">Academic Outline</span>
                  <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">About Final Year Supervision Platform</h2>
                  <p className="text-xs text-slate-550">Unifying technical milestone reviews beneath a single, unified database directory framework.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-start pt-2">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-650 leading-relaxed font-medium">
                      Our portal manages the entire lifespan of final year academic project supervisions. Traditionally, student groups faced back-and-forth delays coordinates proposal drafts via physical papers or unmonitored external text groups.
                    </p>
                    <p className="text-xs text-slate-650 leading-relaxed font-medium">
                      By structuring topic submissions, preserving a master calendar queue, automating Nodemailer alerts simulations, and organizing administrative allocation workloads, we maximize research completion ratios.
                    </p>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-600 font-mono">The Collaboration Stack</h4>
                    <div className="divide-y divide-slate-100 text-[11px] font-medium">
                      <p className="py-2 flex justify-between"><span className="font-bold">Student Proposal Queue</span> <span className="text-slate-500">Active HUD Tracker</span></p>
                      <p className="py-2 flex justify-between"><span className="font-bold">Supervisor Workload Matrix</span> <span className="text-slate-500">Admin Balancing Enabled</span></p>
                      <p className="py-2 flex justify-between"><span className="font-bold">Automated Notifications</span> <span className="text-slate-500">SMTP Sandbox Enabled</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ Page View */}
            {publicView === "faq" && (
              <div className="py-12 px-6 max-w-2xl mx-auto w-full text-left space-y-5 animate-in fade-in duration-150">
                <div className="space-y-1 border-b border-slate-200 pb-3">
                  <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">Supervisors & Registrations FAQs</h2>
                  <p className="text-xs text-slate-500">Quickly coordinate schedules or review security credential behaviors.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="p-4.5 bg-white rounded-lg border border-slate-200 text-xs">
                    <h4 className="font-extrabold text-slate-950">How do supervisors approve project proposals?</h4>
                    <p className="text-slate-600 mt-1 leading-relaxed font-medium">Supervisors log in, navigate to the proposed topics panel, expand any pending student submission card, and click &ldquo;Approve&rdquo;, &ldquo;Revision Required&rdquo;, or &ldquo;Reject&rdquo;, leaving textual critiques which trigger emails automatically.</p>
                  </div>
                  <div className="p-4.5 bg-white rounded-lg border border-slate-200 text-xs">
                    <h4 className="font-extrabold text-slate-950">What format documents must candidates attach?</h4>
                    <p className="text-slate-600 mt-1 leading-relaxed font-medium">The active uploader accepts standard application/pdf, doc, and docx script attachments up to 50MB, saving size indicators automatically on advisors dashboards.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Page View */}
            {publicView === "contact" && (
              <div className="py-12 px-6 max-w-xl mx-auto w-full text-center space-y-3 animate-in fade-in duration-150">
                <h3 className="text-xl font-extrabold text-slate-950">Faculty Help Desk Queue</h3>
                <p className="text-xs text-slate-500 mx-auto">Specify queries regarding academic years, supervisor re-allocations, or physical credentials problems here.</p>
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs text-left">
                  <p className="text-xs text-slate-500 text-center py-8 font-bold">Contact Form placeholder active inside home view. Go to Footer or Heroes desk.</p>
                </div>
              </div>
            )}

            {/* Login Card view */}
            {publicView === "login" && (
              <section className="py-12 px-6 flex-1 flex flex-col items-center justify-center bg-slate-50 relative animate-in fade-in ease-out duration-200">

                <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative">

                  {/* Title Segment */}
                  <div className="text-center space-y-1.5 mb-4">
                    <div className="inline-flex mb-1">
                      <img src={supervisionLogo} className="h-16 w-auto max-w-[180px] object-contain rounded-lg p-1" referrerPolicy="no-referrer" />
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-950">Academic Portal Sign In</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {loginRole === "student"
                        ? "Access your candidate projects dashboard"
                        : "Manage project reviews and advisor bookings"}
                    </p>
                  </div>

                  {/* Role Selector Tabs */}
                  <div className="flex border-b border-slate-200 mb-5 bg-slate-50 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setLoginRole("student")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${loginRole === "student"
                        ? "bg-white text-violet-750 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      <BookOpen className={`h-3.5 w-3.5 ${loginRole === "student" ? "text-violet-600" : "text-slate-400"}`} />
                      <span>Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginRole("supervisor")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${loginRole === "supervisor"
                        ? "bg-white text-blue-750 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      <Shield className={`h-3.5 w-3.5 ${loginRole === "supervisor" ? "text-blue-600" : "text-slate-400"}`} />
                      <span>Supervisor</span>
                    </button>
                  </div>

                  {/* Form Submission */}
                  <form onSubmit={handleLogin} className="space-y-3.5 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Educational Email</label>
                      <input
                        type="email"
                        required
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        placeholder={loginRole === "student" ? "sunday.bright@student.edu" : "olukunle.adebayo@university.edu"}
                        className={`w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2.5 focus:ring-1 focus:outline-hidden ${loginRole === "student"
                          ? "focus:border-violet-500 focus:ring-violet-500"
                          : "focus:border-blue-500 focus:ring-blue-500"
                          }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center bg-transparent">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Password</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!authForm.email) {
                              addToast("Please input your email address in the field first.", "warning");
                              return;
                            }
                            api.auth.forgotPassword(authForm.email)
                              .then(() => addToast("Code RESET_PW_9921 sent to email list simulator.", "success"))
                              .catch(() => addToast("Failed to route recovery.", "error"));
                          }}
                          className={`text-[9px] hover:underline font-bold cursor-pointer ${loginRole === "student" ? "text-violet-600" : "text-blue-600"
                            }`}
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="login-password-input"
                          type={showLoginPassword ? "text" : "password"}
                          required
                          value={authForm.password}
                          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                          placeholder="password123"
                          className={`w-full text-xs border border-slate-200 rounded-lg pl-2.5 pr-10 py-2.5 focus:ring-1 focus:outline-hidden ${loginRole === "student"
                            ? "focus:border-violet-500 focus:ring-violet-500"
                            : "focus:border-blue-500 focus:ring-blue-500"
                            }`}
                        />
                        <button
                          id="login-password-toggle"
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingAuth}
                      className={`w-full text-white font-bold text-xs py-2.5 rounded-lg transition duration-150 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${loginRole === "student"
                        ? "bg-violet-600 hover:bg-violet-750"
                        : "bg-blue-600 hover:bg-blue-755"
                        }`}
                    >
                      {submittingAuth ? "Authorising Connection..." : `Enter ${loginRole === "student" ? "Student" : "Supervisor"} Portal`}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>

                  <div className="border-t border-slate-150 mt-5 pt-3.5 text-center text-xs text-slate-550">
                    New project student candidate?{" "}
                    <button
                      onClick={() => setPublicView("register")}
                      className={`hover:underline font-bold transition cursor-pointer bg-transparent border-none p-0 inline ${loginRole === "student" ? "text-violet-600" : "text-blue-600"
                        }`}
                    >
                      Establish Student Profile
                    </button>
                  </div>

                </div>
              </section>
            )}

            {/* Registration Card view */}
            {publicView === "register" && (
              <section className="py-12 px-6 flex flex-col items-center justify-center bg-slate-50 relative animate-in fade-in duration-200">
                <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-left relative">

                  {verificationEmail ? (
                    <div className="space-y-5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="text-center space-y-1.5">
                        <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs">
                          <Shield className="h-5.5 w-5.5 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-950">Security OTP Verification</h3>
                        <p className="text-[11px] text-slate-500 font-medium font-sans leading-relaxed">
                          A 6-digit academic authorization code (OTP) was automatically dispatched to <strong className="text-slate-800 font-semibold">{verificationEmail}</strong>.
                        </p>
                      </div>

                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2.5 text-[11px] text-blue-805 leading-normal font-sans">
                        <Info className="h-4.5 w-4.5 shrink-0 text-blue-650 mt-0.5" />
                        <div>
                          <strong>Email Verification:</strong> Please check your registered email inbox for the 6-digit OTP code to activate your account.
                          <br /><span className="text-[10px] text-slate-500 font-medium">(Note: If SMTP is not configured, check the backend console terminal output for the OTP code.)</span>
                        </div>
                      </div>

                      <form onSubmit={handleConfirmOTP} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-550 block text-center">Verification Access OTP Token</label>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            value={verificationOtp}
                            onChange={(e) => setVerificationOtp(e.target.value.replace(/\D/g, ""))}
                            placeholder="e.g. 524901"
                            className="w-full text-center text-lg font-mono font-extrabold tracking-[8px] border border-slate-250 rounded-lg px-2.5 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden bg-slate-50 text-slate-800"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingAuth}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {submittingAuth ? "Authorizing Identity..." : "Activate Profile Account"}
                        </button>
                      </form>

                      <div className="text-center pt-2">
                        <button
                          onClick={() => {
                            setVerificationEmail(null);
                            setVerificationOtp("");
                          }}
                          className="text-[11px] text-slate-500 hover:text-blue-600 font-bold underline cursor-pointer bg-transparent border-none p-0"
                        >
                          Modify Registration Details / Restart Form
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Title Segment */}
                      <div className="text-center space-y-1.5 mb-5">
                        <div className="inline-flex mb-1">
                          <img src={supervisionLogo} className="h-16 w-auto max-w-[180px] object-contain rounded-lg p-1" referrerPolicy="no-referrer" />
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-950">Users Profile Registration</h3>
                        <p className="text-[11px] text-slate-500 font-medium font-sans">Establish your active final year project account records</p>
                      </div>

                      <form onSubmit={handleRegister} className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Display Full Name</label>
                          <input
                            type="text"
                            required
                            value={regForm.name}
                            onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                            placeholder="e.g. Sunday Bright"
                            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Active Email</label>
                            <input
                              type="email"
                              required
                              value={regForm.email}
                              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                              placeholder="e.g. sunday.bright@student.edu"
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>
                          <div className="space-y-1 font-sans">
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Desired Password</label>
                            <div className="relative">
                              <input
                                id="register-password-input"
                                type={showRegisterPassword ? "text" : "password"}
                                required
                                value={regForm.password}
                                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                                placeholder="password123"
                                className="w-full text-xs border border-slate-200 rounded-lg pl-2.5 pr-10 py-2 focus:border-blue-500 focus:outline-hidden"
                              />
                              <button
                                id="register-password-toggle"
                                type="button"
                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                              >
                                {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Target Role</label>
                            <select
                              value={regForm.role}
                              onChange={(e) => setRegForm({ ...regForm, role: e.target.value as any })}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 focus:border-blue-500 focus:outline-hidden bg-white"
                            >
                              <option value="student">Project Candidate (Student)</option>
                              <option value="supervisor">Lecturer Supervisor</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Department</label>
                            <select
                              value={regForm.department}
                              onChange={(e) => setRegForm({ ...regForm, department: e.target.value })}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 focus:border-blue-500 focus:outline-hidden bg-white font-medium"
                            >
                              <option value="Computer Science">Computer Science</option>
                              <option value="ICT (Information Technology)">ICT (Information Technology)</option>
                            </select>
                          </div>
                        </div>

                        {/* Conditional Student fields */}
                        {regForm.role === "student" && (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Matric Number</label>
                              <input
                                type="text"
                                required
                                value={regForm.matricNumber}
                                onChange={(e) => setRegForm({ ...regForm, matricNumber: e.target.value })}
                                placeholder="e.g. 210000000"
                                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Assigned Supervisor</label>
                              <select
                                required
                                value={regForm.supervisorId}
                                onChange={(e) => setRegForm({ ...regForm, supervisorId: e.target.value })}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                              >
                                <option value="">-- Choose Supervisor --</option>
                                {supervisors.map((sv) => (
                                  <option key={sv.id} value={sv.id}>{sv.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submittingAuth}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition cursor-pointer"
                        >
                          {submittingAuth ? "Establishing Session Details..." : "Register Profiles"}
                        </button>
                      </form>

                      <div className="border-t border-slate-150 mt-5 pt-3 text-center text-xs text-slate-550">
                        Already registered?{" "}
                        <button
                          onClick={() => setPublicView("login")}
                          className="text-blue-600 hover:underline font-bold transition cursor-pointer bg-transparent inline"
                        >
                          Access Supervision Dashboard
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

          </div>
        )}
      </main>

      {/* Supervisor Assigned Students Modal */}
      {studentsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-left">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Students Database</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Enrolled candidates portfolio & supervisor mappings</p>
                </div>
              </div>
              <button
                onClick={() => setStudentsModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto bg-slate-50">
              {loadingStudentsList ? (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                  <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono font-bold">Loading student records...</span>
                </div>
              ) : supervisorStudentsList.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-xl border border-slate-200 p-8 text-slate-400 font-mono text-xs">
                  No student records found in database.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/75 border-b border-slate-200 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                        <th className="p-3.5">Candidate Name</th>
                        <th className="p-3.5">Matric Number</th>
                        <th className="p-3.5">Department</th>
                        <th className="p-3.5">Assigned Supervisor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {supervisorStudentsList.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5">
                            <strong className="text-slate-900 block">{st.name}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">{st.email}</span>
                          </td>
                          <td className="p-3.5 font-mono font-semibold text-blue-600">{st.matricNumber}</td>
                          <td className="p-3.5 text-slate-700">{st.department}</td>
                          <td className="p-3.5">
                            <span className="inline-flex px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-medium text-slate-700">
                              {st.supervisorName}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setStudentsModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close Database View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universally Active Dashboard Hub Drawer / Slide-Over Modal */}
      {dashboardHubOpen && (
        <div className="fixed inset-0 z-70 bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200 text-left font-sans">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 text-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 text-white">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white tracking-tight uppercase">Dashboard Hub</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wide">Telemetry & system inspection desk</p>
                </div>
              </div>
              <button
                onClick={() => setDashboardHubOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              {/* Telemetry Card */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest block flex items-center gap-1.5">
                  <Server className="h-3 w-3" /> Station Diagnostics
                </span>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs shadow-inner">
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Node Proxy Status</span>
                    <span className="font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" /> Active Express Proxy
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">API Gateway Base</span>
                    <code className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px] text-indigo-300 font-mono">/api</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Active Station Mode</span>
                    <span className="uppercase font-bold text-blue-400 font-mono text-[11px] bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">{user?.role || "Public Guest"}</span>
                  </div>
                </div>
              </div>

              {/* Identity Details */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Operator Identity Metadata
                </span>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase font-mono text-[10px]">Registry ID</span>
                    <code className="text-slate-200 font-mono text-xs">{user?.id || "anon_visitor"}</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase font-mono text-[10px]">Division / Dept</span>
                    <span className="text-white font-medium truncate max-w-[200px]">{user?.department || "General Public"}</span>
                  </div>
                  {user?.matricNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 uppercase font-mono text-[10px]">Matriculation No</span>
                      <span className="text-blue-400 font-mono font-bold">{user.matricNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase font-mono text-[10px]">Session Status</span>
                    <span className="text-emerald-400 font-mono text-[10px]">{user ? "Authenticated" : "Unauthenticated Guest"}</span>
                  </div>
                </div>
              </div>

              {/* Live Channels */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> System Channel Pipes
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl shadow-inner">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Alert Channels</span>
                    <span className="text-xl font-extrabold text-white mt-1 block">{notifications.length}</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl shadow-inner">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Pending Feed</span>
                    <span className="text-xl font-extrabold text-amber-400 mt-1 block">{unreadNotifications.length}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex gap-3">
              <button
                onClick={() => {
                  setDashboardHubOpen(false);
                  addToast("Hub telemetry synchronized.", "info");
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs py-3 rounded-xl transition cursor-pointer active:scale-95 border border-slate-700"
              >
                Close Hub
              </button>
              {user && (
                <button
                  onClick={() => {
                    setDashboardHubOpen(false);
                    logout();
                  }}
                  className="bg-rose-600/15 hover:bg-rose-600 hover:text-white text-rose-400 border border-rose-500/30 px-5 py-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Universally active Simulated Mail Log inbox client component drawer */}
      <Suspense fallback={null}>
        <EmailSimulator />
      </Suspense>

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <RootApp />
    </AppProvider>
  );
}
