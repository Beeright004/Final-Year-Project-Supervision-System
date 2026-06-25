import React from "react";
import { LayoutDashboard } from "lucide-react";

const DashboardLoading: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-500">
      <div className="relative">
        <div className="h-16 w-16 border-4 border-blue-100 rounded-full" />
        <div className="absolute top-0 left-0 h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <LayoutDashboard className="h-6 w-6 text-blue-600" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Initializing Workspace</h3>
        <p className="text-[10px] text-slate-400 font-mono font-bold tracking-widest uppercase">Fetching encrypted academic records...</p>
      </div>
      <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '30%' }} />
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default DashboardLoading;
