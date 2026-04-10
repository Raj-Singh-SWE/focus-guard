"use client";

import { Clock, Calendar, Activity, AlertTriangle } from "lucide-react";

/**
 * Session History page: placeholder for future session persistence.
 * Shows mock driving sessions for now.
 */
export default function HistoryPage() {
    // Mock session data — will be replaced with API calls
    const sessions = [
        { id: 1, date: "Apr 10, 2026", duration: "01:23:45", alerts: 3, status: "completed" },
        { id: 2, date: "Apr 9, 2026", duration: "00:45:12", alerts: 0, status: "completed" },
        { id: 3, date: "Apr 8, 2026", duration: "02:10:03", alerts: 7, status: "completed" },
        { id: 4, date: "Apr 7, 2026", duration: "00:30:55", alerts: 1, status: "completed" },
        { id: 5, date: "Apr 6, 2026", duration: "01:58:22", alerts: 2, status: "completed" },
    ];

    const totalDriveTime = "06:48:17";
    const totalAlerts = sessions.reduce((sum, s) => sum + s.alerts, 0);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-100">Session History</h1>
                <p className="text-slate-400 mt-1">Review past driving sessions and alert logs.</p>
            </header>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="w-5 h-5 text-indigo-400" />
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Sessions</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-100">{sessions.length}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-emerald-400" />
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Drive Time</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-100 font-mono">{totalDriveTime}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Alerts</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-100">{totalAlerts}</p>
                </div>
            </div>

            {/* Session table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-800 text-left">
                            <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-wider font-medium">#</th>
                            <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-wider font-medium">
                                <Calendar className="w-3 h-3 inline mr-1" />Date
                            </th>
                            <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-wider font-medium">
                                <Clock className="w-3 h-3 inline mr-1" />Duration
                            </th>
                            <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-wider font-medium">Alerts</th>
                            <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-wider font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((session) => (
                            <tr key={session.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 text-slate-400 font-mono text-sm">{session.id}</td>
                                <td className="px-6 py-4 text-slate-200 text-sm">{session.date}</td>
                                <td className="px-6 py-4 text-slate-200 text-sm font-mono">{session.duration}</td>
                                <td className="px-6 py-4">
                                    <span className={`text-sm font-medium ${session.alerts > 5 ? "text-red-400" : session.alerts > 0 ? "text-amber-400" : "text-emerald-400"
                                        }`}>
                                        {session.alerts}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
                                        {session.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
