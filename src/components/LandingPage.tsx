import React, { useState } from "react";
import { BookOpen, FileText, Calendar, CheckSquare, Award, Users, BookMarked, ArrowRight, ShieldCheck, Mail, Phone, MapPin, Sparkles, HelpCircle } from "lucide-react";
import supervisionLogo from "../assets/images/supervision_logo_1780237288997.png";

interface LandingPageProps {
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
  onSelectTab: (tab: string) => void;
}

export default function LandingPage({ onNavigateLogin, onNavigateRegister, onSelectTab }: LandingPageProps) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", query: "" });
  const [submitted, setSubmitted] = useState(false);

  const stats = [
    { label: "Active Project Students", count: "1,240+", icon: Users },
    { label: "Approved Research Topics", count: "98.2%", icon: Award },
    { label: "Designated Supervisors", count: "85+", icon: BookMarked },
    { label: "Average Approval Time", count: "48 Hours", icon: Calendar },
  ];

  const steps = [
    { title: "Topic Proposal", text: "Student proposes academic project title and research outline context details.", icon: FileText },
    { title: "Supervisor Review", text: "Dr. Advisor reviews, submits notes, recommends references, or grants status approval.", icon: BookOpen },
    { title: "Proposal Defense", text: "Student uploads detailed milestone PDF scripts and schedules face-to-face defenses.", icon: ShieldCheck },
    { title: "Calendar Bookings", text: "Consistent research schedules, live status dashboards, and automated email alerts tracking.", icon: Calendar },
  ];

  const faqs = [
    {
      q: "How does the topic approval workflow operate?",
      a: "Students submit an original final-year project proposal title and description. Assigned supervisors are instantly notified by email and can approve the topic, request revisions, or discard the topic with structural written advice."
    },
    {
      q: "Can I edit my project topic description after submission?",
      a: "You can modify titles and abstract drafts freely as long as the topic is in a 'pending' or 'revision requested' state. Once approved by your supervisor, the scope is locked to preserve academic consistency."
    },
    {
      q: "How are student accounts connected with supervisors?",
      a: "During profile registration, students choose their assigned research supervisor from the institutional faculty list. High-level administrators also retain the master capability to balance workloads by manually reassigning and creating relationships in the Admin dashboard."
    },
    {
      q: "Are proposal file attachments (PDF/DOC) fully preserved?",
      a: "Yes. The system supports full document workflows, allowing students to upload scientific proposal drafts. Supervisors can review file size, names, and formats, and mark review decisions directly."
    }
  ];

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contactForm.name && contactForm.email && contactForm.query) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setContactForm({ name: "", email: "", query: "" });
      }, 3500);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 border-b border-slate-800 py-16 lg:py-24 text-white px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.18),rgba(255,255,255,0))]" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-center relative z-10 w-full">

          <div className="lg:col-span-7 space-y-5 text-left">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              University Academic Supervision Suite
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              A Web-Based Scheduling & <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-blue-100">Supervision Portal</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Unifying final year project workflows in real time. Seamlessly connect students, academic supervisors, and administrators through structured proposals, automated emails, and booking schedulers.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onNavigateLogin}
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs px-5 py-3 rounded-lg transition duration-150 shadow-sm cursor-pointer flex items-center gap-2"
              >
                Access Portal Dashboard <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onNavigateRegister}
                className="bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 border border-slate-700 font-bold text-xs px-5 py-3 rounded-lg transition cursor-pointer"
              >
                Register Student Account
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl relative glow-on-hover">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <span className="text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Supervisors Desk Active
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                  <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" /> Connection Stable
                </span>
              </div>
              <div className="space-y-3 text-left">
                <div className="p-3 bg-slate-900 rounded-lg space-y-1.5 border border-slate-800">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono">Latest Proposal Abstract</p>
                  <p className="text-xs text-white font-bold truncate">Decentralized Healthcare Audits with ZK-SNARKs</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">Researching zero-knowledge cryptographic assertions for EHR ledger compliance across regional host groups.</p>
                </div>
                <div className="p-3 bg-blue-950/40 rounded-lg space-y-1.5 border border-blue-900/40">
                  <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest font-mono">Current Meeting Status</p>
                  <p className="text-xs text-blue-100 font-bold flex items-center gap-2">
                    <span className="h-2 w-2 bg-amber-400 rounded-full" /> Initial Methodology Review
                  </p>
                  <p className="text-[11px] text-blue-300/80 leading-relaxed">Booked for June 5th, 10:30 am in Suite 402, Technology Wing.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-10 border-b border-slate-200 px-6">
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-3.5 p-3 text-left border-r last:border-0 border-slate-100">
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xl font-extrabold text-slate-950">{stat.count}</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Diagram Section */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full text-center">
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12">
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
            Methodical Progress
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            How The Supervision Platform Unifies the Process
          </h2>
          <p className="text-xs text-slate-500 max-w-xl mx-auto">
            From initial brain-storming abstracts to the verified proposal document drafts, explore the standard milestone checkpoints.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 text-left space-y-3 relative shadow-xs glow-on-hover">
              <div className="inline-flex p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                  <span className="text-blue-500 font-mono text-xs font-bold">0{idx + 1}.</span> {step.title}
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Detail Grid */}
      <section className="py-12 bg-slate-100/60 border-y border-slate-200 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center w-full">
          <div>
            <video
              className="rounded-xl shadow-md border border-slate-200"
              poster="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=600&auto=format&fit=crop"
              muted
              playsInline
            />
          </div>
          <div className="space-y-4 text-left">
            <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
              Coordinated Features Designed for Educators & Researchers
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              We provide supervisors, admin offices, and final year students with custom-tailored dashboard panels to monitor topics progress without paper delays.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3.5 p-3.5 bg-white rounded-lg border border-slate-200">
                <CheckSquare className="h-4.5 w-4.5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-950">Institutional Roles Access</h4>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5 font-medium">Separate custom dashboards for Students, Academic Supervisors, and Administration staffs.</p>
                </div>
              </div>
              <div className="flex gap-3.5 p-3.5 bg-white rounded-lg border border-slate-200">
                <CheckSquare className="h-4.5 w-4.5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-950">Real-Time In-App and Email Alerts</h4>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5 font-medium">Automated visual triggers send SMTP mail logs instantly whenever topics are approved or schedules modified.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section id="landing-faq" className="py-16 px-6 max-w-3xl mx-auto w-full text-center">
        <div className="space-y-3 mb-10">
          <HelpCircle className="h-7 w-7 text-blue-600 mx-auto" />
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">Frequently Asked Questions</h2>
          <p className="text-xs text-slate-500">Need immediate answers on credentials, file uploads, or bookings? Review our quick answers below.</p>
        </div>

        <div className="space-y-3 text-left">
          {faqs.map((faq, i) => {
            const isSelected = activeFaq === i;
            return (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => setActiveFaq(isSelected ? null : i)}
                  className="w-full text-left p-4 font-bold text-xs text-slate-950 flex justify-between items-center bg-white hover:bg-slate-50 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className={`text-lg transition-transform ${isSelected ? "rotate-45" : ""}`}>+</span>
                </button>
                {isSelected && (
                  <div className="px-4 pb-4 pt-1 text-[11px] text-slate-600 leading-relaxed bg-slate-50/50 border-t border-slate-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-950 text-white py-14 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center space-y-10 w-full">
          <h3 className="text-xl font-bold uppercase tracking-wider text-blue-400">Recommended by Faculty Heads</h3>
          <div className="grid md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
            <div className="p-5 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
              <p className="text-[11px] text-slate-300 italic leading-relaxed">
                &ldquo;Proposing project abstracts, tracking supervisor comments, and receiving instant email alerts changed our workflow. Our students defend their research proposals weeks ahead of time now.&rdquo;
              </p>
              <div>
                <h5 className="text-xs font-bold text-white">Dr. Olukunle Adebayo</h5>
                <p className="text-[10px] text-slate-500 tracking-wide font-mono uppercase mt-0.5">Head of Computer Science Division</p>
              </div>
            </div>
            <div className="p-5 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
              <p className="text-[11px] text-slate-300 italic leading-relaxed">
                &ldquo;Booking supervisor calendars from our dashboard prevents the endless corridor walks. It provides a visual trace of every single supervisor checklist.&rdquo;
              </p>
              <div>
                <h5 className="text-xs font-bold text-white">James Smith</h5>
                <p className="text-[10px] text-slate-500 tracking-wide font-mono uppercase mt-0.5">Final Year Computer Science Student</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support & Contact Desk */}
      <section id="landing-contact" className="py-16 px-6 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-left space-y-5">
          <div className="text-center space-y-1.5">
            <h3 className="text-xl font-extrabold text-slate-950 tracking-tight">Academic Help Desk Support</h3>
            <p className="text-xs text-slate-500">Contact the Computer Science & ICT (Information Technology) research office directly.</p>
          </div>

          <form onSubmit={handleContactSubmit} className="space-y-3.5">
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Full Name</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Educational Email</label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="e.g. john.doe@university.edu"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Query / Academic Advice Request</label>
              <textarea
                required
                rows={3}
                value={contactForm.query}
                onChange={(e) => setContactForm({ ...contactForm, query: e.target.value })}
                placeholder="Detail your request such as topic adjustments, supervisor allocation problems, etc."
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {submitted ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg p-3 text-center font-bold">
                Your support proposal has been submitted successfully! The academic registry office will follow-up soon.
              </div>
            ) : (
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition cursor-pointer"
              >
                Submit Request
              </button>
            )}
          </form>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-slate-950 border-t border-slate-800 py-10 text-slate-400 text-xs px-6">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-3 gap-8 text-left w-full">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <img src={supervisionLogo} className="h-9 w-auto max-w-[130px] object-contain bg-white p-1 rounded-md shadow-xs" referrerPolicy="no-referrer" />
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Crawford Portal</h4>
            </div>
            <p className="leading-relaxed text-[11px] text-slate-400">Integrated System for scheduling, supervision topic milestones, document hand-offs and digital reviews.</p>
          </div>
          <div className="space-y-3">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Contact Registers</h4>
            <div className="space-y-2 text-[11px]">
              <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-blue-400" /> Technology Wing, Block D, Faculty of Computing</p>
              <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-blue-400" /> computing-support@university.edu</p>
              <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-blue-400" /> +2348183699804</p>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Designated Links</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
              <button onClick={() => onSelectTab("about")} className="hover:text-white cursor-pointer transition">About Portal</button>
              <button onClick={() => onSelectTab("faq")} className="hover:text-white cursor-pointer transition">FAQs Desk</button>
              <button onClick={() => onSelectTab("contact")} className="hover:text-white cursor-pointer transition">Contact Office</button>
              <button onClick={onNavigateLogin} className="hover:text-white cursor-pointer transition font-bold text-blue-400">Institutional Access</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-slate-800 mt-8 pt-6 text-center text-slate-500 text-[10px] w-full">
          &copy; {new Date().getFullYear()} Faculty of Science & Technology Supervision Portal. Active sandbox setup.
        </div>
      </footer>

    </div>
  );
}
