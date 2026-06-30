import React, { useState, useEffect } from "react";
import { User, Topic, Proposal, Schedule } from "../types.js";
import { api } from "../lib/api.js";
import { useApp } from "../context/AppContext.js";
import {
  Users, UserPlus, Building2, BookMarked, Calendar, Award, CheckCircle, Clock,
  Trash2, Edit3, ShieldAlert, KeyRound, Download, RefreshCw, Layers, Check, X, Search,
  Eye, EyeOff, Mail, CalendarX
} from "lucide-react";

export default function AdminDashboard() {
  const { user, addToast } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Searching & Selection State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"users" | "topics" | "workloads" | "schedules">("users");

  // Create User State
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student" as "student" | "supervisor" | "admin",
    matricNumber: "",
    department: "Computer Science",
    supervisorId: "",
  });

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateUserPassword, setShowCreateUserPassword] = useState(false);
  const [showEditUserPassword, setShowEditUserPassword] = useState(false);

  const loadAdminWorkspaceData = async () => {
    try {
      const userList = await api.admin.users.list();
      setUsers(userList);

      const topicList = await api.topics.list();
      setTopics(topicList);

      const scheduleList = await api.schedules.list();
      setSchedules(scheduleList);

      const statsData = await api.admin.stats();
      setStats(statsData);
    } catch (e: any) {
      console.error(e);
      addToast("Failed to load administration registries.", "error");
    }
  };

  useEffect(() => {
    loadAdminWorkspaceData();
  }, []);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.password || !userForm.role || !userForm.department) {
      addToast("Please fill in all mandatory account properties.", "warning");
      return;
    }

    try {
      await api.admin.users.create(userForm);
      addToast(`Supervision account for '${userForm.name}' established successfully.`, "success");
      setUserForm({
        name: "",
        email: "",
        password: "",
        role: "student" as const,
        matricNumber: "",
        department: "Computer Science",
        supervisorId: "",
      });
      setIsCreatorOpen(false);
      loadAdminWorkspaceData();
    } catch (e: any) {
      addToast(e.message || "Failed to establish user account.", "error");
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await api.admin.users.update(editingUser.id, editingUser);
      addToast(`Account details updated for ${editingUser.name}.`, "success");
      setEditingUser(null);
      loadAdminWorkspaceData();
    } catch (e: any) {
      addToast(e.message || "Failed to update account.", "error");
    }
  };

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null);
  const [deleteScheduleConfirm, setDeleteScheduleConfirm] = useState<{ id: string; title: string } | null>(null);

  const handleDeleteUser = (id: string, name: string) => {
    setDeleteConfirmation({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await api.admin.users.delete(deleteConfirmation.id);
      addToast(`Account for '${deleteConfirmation.name}' permanently erased.`, "success");
      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirmation!.id));
    } catch (e: any) {
      addToast(e.message || "Failed to delete account.", "error");
    } finally {
      setDeleteConfirmation(null);
    }
  };

  const handleDeleteSchedule = (id: string, title: string) => {
    setDeleteScheduleConfirm({ id, title });
  };

  const handleConfirmDeleteSchedule = async () => {
    if (!deleteScheduleConfirm) return;
    try {
      await api.schedules.delete(deleteScheduleConfirm.id);
      addToast(`Cancelled session "${deleteScheduleConfirm.title}" deleted.`, "success");
      setSchedules((prev) => prev.filter((s) => s.id !== deleteScheduleConfirm!.id));
    } catch (e: any) {
      addToast(e.message || "Failed to delete session.", "error");
    } finally {
      setDeleteScheduleConfirm(null);
    }
  };

  const handleDownloadReport = () => {
    if (!stats) return;

    // Create standard CSV content format simulation
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Metric,Value\r\n";
    csvContent += `Total Students Registered,${stats.summary.totalStudents}\r\n`;
    csvContent += `Active Designated Supervisors,${stats.summary.totalSupervisors}\r\n`;
    csvContent += `Total Topics Proposed,${stats.summary.totalTopics}\r\n`;
    csvContent += `Approved Topics Count,${stats.summary.topicStats.approved}\r\n`;
    csvContent += `Revision Requested Topics,${stats.summary.topicStats.revision}\r\n`;
    csvContent += `Rejected Topics Count,${stats.summary.topicStats.rejected}\r\n`;
    csvContent += `Total Proposal Draft Uploaded,${stats.summary.totalProposals}\r\n`;
    csvContent += `Booked Session Calendars,${stats.summary.totalSchedules}\r\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `university_supervision_metrics_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Analytics spreadsheet report generated successfully.", "success");
  };

  // Filter users based on query
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.matricNumber && u.matricNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === "all" ? true : u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const supervisorsOnly = users.filter((u) => u.role === "supervisor");

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full px-1 text-left">

      {/* Overview Greeting */}
      <div className="bg-white rounded-lg border border-slate-200 p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xs">
        <div className="space-y-1 text-left">
          <h2 className="text-lg font-extrabold text-slate-950">Administrative Control Center</h2>
          <p className="text-xs text-slate-500">
            Designation: <strong>System Super-Administrator</strong> &bull; Department: <strong>FYP Division Registry</strong>
          </p>
        </div>

        {/* Generate Report simulation button */}
        <button
          onClick={handleDownloadReport}
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition duration-150 cursor-pointer flex items-center gap-2 shadow-xs"
        >
          <Download className="h-4 w-4" />
          <span>Export Analytics Report</span>
        </button>
      </div>

      {/* Physical SMTP Email Notification Status Header */}
      {stats && stats.summary && stats.summary.smtp && (
        <div className="bg-slate-900 border border-slate-800 text-white rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm text-left animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2.5 rounded-lg shrink-0 ${stats.summary.smtp.configured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700/50'} border`}>
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-100 font-mono">Phase 3: Physical SMTP Email Notifications</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                {stats.summary.smtp.configured
                  ? `Authenticated Node Server active: relaying over '${stats.summary.smtp.host}' (Port ${stats.summary.smtp.port}) using account ${stats.summary.smtp.user}.`
                  : "SMTP email delivery is currently offline. System emails are temporarily routing to the high-performance simulated Inbox Client."
                }
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center">
            {stats.summary.smtp.configured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold text-[10px] uppercase font-mono tracking-wider">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                SMTP Delivery Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-semibold text-[10px] uppercase font-mono tracking-wider">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Simulator Mode Active
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards section */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-xs text-left space-y-1">
            <p className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">Total Students</p>
            <h3 className="text-xl font-black text-slate-950">{stats.summary.totalStudents}</h3>
            <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold">
              <Users className="h-3.5 w-3.5" />
              <span>Registered Accounts</span>
            </div>
          </div>

          <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-xs text-left space-y-1">
            <p className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">Supervisors</p>
            <h3 className="text-xl font-black text-slate-950">{stats.summary.totalSupervisors}</h3>
            <div className="flex items-center gap-1 text-[10px] text-teal-600 font-bold">
              <Building2 className="h-3.5 w-3.5" />
              <span>Coordinated Faculty</span>
            </div>
          </div>

          <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-xs text-left space-y-1">
            <p className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">Approved topics</p>
            <h3 className="text-xl font-black text-slate-950">{stats.summary.topicStats.approved}</h3>
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>{((stats.summary.topicStats.approved / (stats.summary.totalTopics || 1)) * 100).toFixed(0)}% Approval</span>
            </div>
          </div>

          <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-xs text-left space-y-1">
            <p className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">Pending Topics</p>
            <h3 className="text-xl font-black text-slate-950">{stats.summary.topicStats.pending}</h3>
            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
              <Clock className="h-3.5 w-3.5" />
              <span>Awaiting Review</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs list switches */}
      <div className="flex border-b border-slate-200 gap-5 font-sans">
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 transition-all ${activeTab === "users" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
        >
          User accounts ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("topics")}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 transition-all ${activeTab === "topics" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
        >
          All Topics List ({topics.length})
        </button>
        <button
          onClick={() => setActiveTab("workloads")}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 transition-all ${activeTab === "workloads" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
        >
          Supervision Workloads
        </button>
        <button
          onClick={() => setActiveTab("schedules")}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer border-b-2 transition-all ${activeTab === "schedules" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
        >
          Supervision Schedule ({schedules.length})
        </button>
      </div>

      {/* Grid Panels layout contents */}
      {activeTab === "users" && (
        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* List Users (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3 mb-4">

              {/* Search Bar Input */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Query student or index..."
                  className="w-full text-xs border border-slate-300 rounded pl-8 pr-2.5 py-1.5 focus:border-blue-500 bg-white"
                />
              </div>

              {/* Roles Filtering */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">RoleFilter:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="text-xs border border-slate-250 rounded px-2 py-1 focus:border-blue-500 bg-white font-medium"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="supervisor">Supervisors</option>
                  <option value="admin">Administrators</option>
                </select>
              </div>

            </div>

            {/* Grid directory Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-extrabold uppercase tracking-widest text-[9px] font-mono">
                    <th className="p-2.5">User Coordinates</th>
                    <th className="p-2.5">Matric Code</th>
                    <th className="p-2.5">Department</th>
                    <th className="p-2.5">Assigned Supervisor</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No match registered.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((item) => {
                      // Lookup supervisor name for students
                      const supervisor = users.find((sv) => sv.id === item.supervisorId);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2.5">
                            <div>
                              <p className="font-extrabold text-slate-905">{item.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono leading-none mt-0.5">{item.email}</p>
                              <span className={`inline-block text-[9px] uppercase font-bold mt-1 px-1.5 py-0.2 rounded leading-none ${item.role === "admin" ? "bg-slate-100 text-slate-800" :
                                item.role === "supervisor" ? "bg-blue-50 border border-blue-100 text-blue-800" :
                                  "bg-emerald-50 border border-emerald-100 text-emerald-800"
                                }`}>
                                {item.role}
                              </span>
                            </div>
                          </td>
                          <td className="p-2.5 font-mono text-slate-600 font-bold uppercase tracking-wider">
                            {item.matricNumber || "N/A STAFF"}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-600">
                            {item.department}
                          </td>
                          <td className="p-2.5">
                            {item.role === "student" ? (
                              supervisor ? (
                                <span className="font-bold text-slate-700">{supervisor.name}</span>
                              ) : (
                                <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[9px] uppercase border border-rose-100">Unassigned</span>
                              )
                            ) : (
                              <span className="text-slate-400 font-semibold font-mono text-[10px]">FACULTY</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingUser(item)}
                                className="p-1 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                                title="Edit parameters"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(item.id, item.name)}
                                className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                                title="Delete account profile"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create User Sidepane (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-3 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950">
                Supervision Profiler
              </h3>
              <button
                onClick={() => setIsCreatorOpen(!isCreatorOpen)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] px-2 py-1 rounded cursor-pointer transition uppercase tracking-wider"
              >
                {isCreatorOpen ? "Close Panel" : "Register User"}
              </button>
            </div>

            {isCreatorOpen ? (
              <form onSubmit={handleCreateUserSubmit} className="space-y-3.5 bg-slate-50 p-3 rounded-lg border border-slate-150 animate-in">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Candidate Full Name</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    placeholder="e.g. Sunday Bright"
                    className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:border-blue-500 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="e.g. sunday.bright@university.edu"
                    className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:border-blue-500 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Password Cipher code</label>
                  <div className="relative">
                    <input
                      id="admin-create-password"
                      type={showCreateUserPassword ? "text" : "password"}
                      required
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="Secret portal access password"
                      className="w-full text-xs border border-slate-250 rounded pl-2.5 pr-10 py-1.5 focus:border-blue-500 bg-white"
                    />
                    <button
                      id="admin-create-password-toggle"
                      type="button"
                      onClick={() => setShowCreateUserPassword(!showCreateUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                    >
                      {showCreateUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Coordinates Role</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                      className="w-full text-xs border border-slate-250 rounded px-2 py-1.5 focus:border-blue-500 bg-white font-medium"
                    >
                      <option value="student">Student</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Field Department</label>
                    <select
                      value={userForm.department}
                      onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                      className="w-full text-xs border border-slate-250 rounded px-2 py-1.5 focus:border-blue-500 bg-white font-medium"
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="ICT (Information Technology)">ICT (Information Technology)</option>
                      <option value="Cyber Security">Cyber Security</option>
                      <option value="Artificial Intelligence">Artificial Intelligence</option>
                    </select>
                  </div>
                </div>

                {userForm.role === "student" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">Student Matric indices</label>
                      <input
                        type="text"
                        required
                        value={userForm.matricNumber}
                        onChange={(e) => setUserForm({ ...userForm, matricNumber: e.target.value })}
                        placeholder="e.g. MATRIC/CS/2026/0912"
                        className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:border-blue-500 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">Supervising Professor</label>
                      <select
                        required
                        value={userForm.supervisorId}
                        onChange={(e) => setUserForm({ ...userForm, supervisorId: e.target.value })}
                        className="w-full text-xs border border-slate-255 rounded px-2 py-1.5 focus:border-blue-500 bg-white font-medium"
                      >
                        <option value="">-- Choose Advisor Supervisor --</option>
                        {supervisorsOnly.map((sv) => (
                          <option key={sv.id} value={sv.id}>{sv.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded cursor-pointer transition flex items-center justify-center gap-1 shadow-xs"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Build Supervision Profile</span>
                </button>
              </form>
            ) : (
              <div className="p-3.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center text-slate-400">
                <UserPlus className="h-7 w-7 mx-auto text-slate-350 mb-1 stroke-[1.5]" />
                <p className="text-xs font-semibold font-sans">Quick-Add Enabled</p>
                <p className="text-[10px] text-slate-400">Expand form to load matric indices, credentials, roles, and faculty fields.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === "topics" && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-955 border-b border-slate-150 pb-3 mb-3">
            Master Research Submissions Portfolio
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-extrabold uppercase tracking-widest text-[9px] font-mono">
                  <th className="p-2.5">Topic Coordinate</th>
                  <th className="p-2.5">Supervisee</th>
                  <th className="p-2.5">Assigned Supervisor</th>
                  <th className="p-2.5">Decision Status</th>
                  <th className="p-2.5">Proposal Manuscript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {topics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-semibold font-mono">
                      Academic submissions registries has currently no proposals.
                    </td>
                  </tr>
                ) : (
                  topics.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/55 transition-all">
                      <td className="p-2.5 max-w-sm">
                        <p className="font-extrabold text-slate-905">{t.title}</p>
                        <p className="text-[10px] text-slate-450 line-clamp-1 mt-0.5">{t.description}</p>
                      </td>
                      <td className="p-2.5 font-bold text-slate-705">
                        {t.studentName}
                        <p className="text-[9px] font-mono font-normal text-slate-400 select-all">{t.studentMatric}</p>
                      </td>
                      <td className="p-2.5 font-bold text-slate-705">
                        {t.supervisorName}
                      </td>
                      <td className="p-2.5">
                        <span className={`inline-block text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${t.status === "approved" ? "bg-emerald-50 border border-emerald-100 text-emerald-800" :
                          t.status === "revision" ? "bg-amber-50 border border-amber-100 text-amber-800" :
                            t.status === "rejected" ? "bg-rose-50 border border-rose-100 text-rose-800" :
                              "bg-blue-50 border border-blue-105 text-blue-850"
                          }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-2.5">
                        {t.proposal ? (
                          <span className={`inline-block text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded border ${t.proposal.status === "approved" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                            t.proposal.status === "rejected" ? "bg-rose-50 text-rose-800 border-rose-100" :
                              "bg-amber-50 text-amber-850 border-amber-100"
                            }`}>
                            MS: {t.proposal.status}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold italic text-[10px]">No upload</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === "schedules" && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left">
          <div className="border-b border-slate-150 pb-3 mb-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950">Supervision Schedule Registry</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              View all supervision sessions across the system. Cancelled sessions can be permanently deleted.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-widest text-[9px] font-mono">
                  <th className="p-2.5">Meeting Title</th>
                  <th className="p-2.5">Student</th>
                  <th className="p-2.5">Supervisor</th>
                  <th className="p-2.5">Date & Time</th>
                  <th className="p-2.5">Duration</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 font-semibold">
                      No scheduled sessions found in the system.
                    </td>
                  </tr>
                ) : (
                  schedules.map((sch) => {
                    const statusStyle =
                      sch.status === "approved" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                        sch.status === "cancelled" ? "bg-rose-50 text-rose-700 border-rose-100" :
                          sch.status === "completed" ? "bg-slate-100 text-slate-700 border-slate-200" :
                            sch.status === "rejected" ? "bg-rose-100 text-rose-800 border-rose-200" :
                              "bg-amber-50 text-amber-800 border-amber-100";
                    return (
                      <tr key={sch.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-2.5 font-extrabold text-slate-900 max-w-[200px]">
                          <p className="truncate">{sch.title}</p>
                          <p className="text-[9px] font-mono text-slate-400 mt-0.5">{sch.venue}</p>
                        </td>
                        <td className="p-2.5 font-bold text-slate-700">
                          {sch.studentName || sch.studentId}
                          <p className="text-[9px] font-mono text-slate-400">{sch.studentMatric}</p>
                        </td>
                        <td className="p-2.5 font-bold text-slate-700">{sch.supervisorName || sch.supervisorId}</td>
                        <td className="p-2.5 font-mono text-[10px] text-slate-600">
                          <p>{sch.meetingDate}</p>
                          <p className="text-slate-400">{sch.time} - {sch.endTime || "?"}</p>
                        </td>
                        <td className="p-2.5 text-[10px] font-bold text-slate-600">
                          {sch.duration ? `${sch.duration} min` : "—"}
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-block text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${statusStyle}`}>
                            {sch.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          {sch.status === "cancelled" && (
                            <button
                              onClick={() => handleDeleteSchedule(sch.id, sch.title)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded border border-rose-100 cursor-pointer transition flex items-center gap-1 ml-auto"
                              title="Permanently delete this cancelled session"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="text-[9px] font-bold">Delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {activeTab === "workloads" && stats && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-left space-y-5">
          <div className="border-b border-slate-150 pb-3">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950">
              Faculty Workload Balancing Analyzer
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-normal font-sans">
              Administer counts of active supervisees allocated matching individual supervisor portfolios. Balance portfolios dynamically.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stats.workloadMap.map((sv: any) => {
              // Calculate percent density
              const densityPct = Math.min((sv.assignedStudentsCount / 6) * 100, 100);
              const densityColor = sv.assignedStudentsCount >= 5 ? "bg-rose-500" : "bg-blue-600";

              return (
                <div key={sv.id} className="p-4 border border-slate-200 rounded-lg space-y-2.5 hover:border-slate-300 transition-all bg-white">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-extrabold text-slate-950">{sv.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">{sv.department} &bull; {sv.email}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 font-mono uppercase">
                      <span>Assigned Supervisees</span>
                      <span>{sv.assignedStudentsCount} Candidates (Max recommended: 5)</span>
                    </div>
                    {/* Visual bar */}
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${densityColor}`} style={{ width: `${densityPct}%` }} />
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>Approved Objectives: <strong>{sv.approvedTopicsCount}</strong></span>
                    {sv.assignedStudentsCount >= 5 && (
                      <span className="text-rose-600 font-black flex items-center gap-0.5 leading-none font-mono text-[9px] uppercase">
                        <ShieldAlert className="h-3 w-3 shrink-0" /> High Density
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* MODAL OVERLAY: User Editor Panel */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in duration-75">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-lg p-5 text-left animate-in zoom-in-95 duration-100">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-150 mb-3 bg-transparent">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                Modify Account: {editingUser.name}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Display Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Registered Email Address</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Scope Department</label>
                  <select
                    value={editingUser.department}
                    onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                    className="w-full text-xs border border-slate-250 rounded px-2 py-1.5 bg-white font-medium focus:border-blue-500"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="ICT (Information Technology)">ICT (Information Technology)</option>
                    <option value="Cyber Security">Cyber Security</option>
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Registered Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full text-xs border border-slate-250 rounded px-2 py-1.5 bg-white font-medium focus:border-blue-500"
                  >
                    <option value="student">Student</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              {editingUser.role === "student" && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-555 font-mono">Student Matric indices</label>
                    <input
                      type="text"
                      required
                      value={editingUser.matricNumber || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, matricNumber: e.target.value })}
                      className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-555 font-mono">Supervisor advisor Allocation</label>
                    <select
                      value={editingUser.supervisorId || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, supervisorId: e.target.value })}
                      className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:border-blue-500 bg-white"
                    >
                      <option value="">-- No Advisor Assigned --</option>
                      {supervisorsOnly.map((sv) => (
                        <option key={sv.id} value={sv.id}>{sv.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="flex items-center gap-1 text-slate-700 font-bold text-[10px] uppercase font-mono tracking-wider font-semibold">
                  <KeyRound className="h-4 w-4 text-blue-600" />
                  <span>Manual Password Override</span>
                </div>
                <div className="relative mt-1">
                  <input
                    id="admin-override-password"
                    type={showEditUserPassword ? "text" : "password"}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    placeholder="Insert secret code to reset, otherwise skip"
                    className="w-full text-xs border border-slate-250 rounded pl-2.5 pr-10 py-1.5 bg-white"
                  />
                  <button
                    id="admin-override-password-toggle"
                    type="button"
                    onClick={() => setShowEditUserPassword(!showEditUserPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                  >
                    {showEditUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-150 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition"
                >
                  Save Coordinates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Custom Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md p-5 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3.5">
              <div className="p-2.5 bg-rose-50 rounded-full">
                <ShieldAlert className="h-6 w-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Confirm Account Deletion</h3>
                <p className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider">Irreversible Academic Change</p>
              </div>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <p className="text-slate-700 leading-relaxed">
                Are you absolutely sure you want to delete <strong className="text-slate-950 font-extrabold">{deleteConfirmation.name}</strong>'s academic supervision profile?
              </p>
              <p className="text-slate-400 leading-normal text-[11px] bg-slate-50 p-2.5 rounded border border-slate-150">
                ⚠️ <strong>Warning:</strong> Deleting this account will permanently clear their credential keys, draft submission files, and review comment registers from the system catalog.
              </p>
            </div>

            <div className="flex justify-end gap-2 px-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-250 text-slate-700 font-bold text-xs rounded transition-all cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-sm flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Schedule Confirmation Modal */}
      {deleteScheduleConfirm && (
        <div className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md p-5 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3.5">
              <div className="p-2.5 bg-rose-50 rounded-full">
                <CalendarX className="h-6 w-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Delete Cancelled Session</h3>
                <p className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider">Permanent Record Removal</p>
              </div>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <p className="text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete the cancelled session: <strong className="text-slate-950 font-extrabold">"{deleteScheduleConfirm.title}"</strong>?
              </p>
              <p className="text-slate-400 leading-normal text-[11px] bg-slate-50 p-2.5 rounded border border-slate-150">
                ⚠️ This will permanently remove this session record from the system. This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2 px-1">
              <button
                type="button"
                onClick={() => setDeleteScheduleConfirm(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSchedule}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-sm flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Delete Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
