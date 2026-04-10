"use client";

import { useEffect, useState } from "react";
import { Clock, Calendar, Activity, AlertTriangle } from "lucide-react";
import { config } from "../../lib/config";

interface SessionData {
    id: number;
    start_time: string;
    duration: number; // in seconds
    alerts_triggered: number;
}

export default function HistoryPage() {
    const [sessions, setSessions] = useState<SessionData[]>([]);

    useEffect(() => {
        fetch(`${config.API_BASE_URL}/api/sessions`)
            .then(res => res.json())
            .then(data => setSessions(data))
            .catch(err => console.error("History fetch error:", err));
    }, []);

    const formatDuration = (totalSeconds: number) => {
        const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
        const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
        const secs = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
        return `${hrs}:${mins}:${secs}`;
    };

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
    const totalDriveTime = formatDuration(totalSeconds);
    const totalAlerts = sessions.reduce((sum, s) => sum + s.alerts_triggered, 0);

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
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                                    No driving sessions recorded yet. Start a drive to log history!
                                </td>
                            </tr>
                        ) : sessions.map((session) => (
                            <tr key={session.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 text-slate-400 font-mono text-sm">{session.id}</td>
                                <td className="px-6 py-4 text-slate-200 text-sm">{formatDate(session.start_time)}</td>
                                <td className="px-6 py-4 text-slate-200 text-sm font-mono">{formatDuration(session.duration)}</td>
                                <td className="px-6 py-4">
                                    <span className={`text-sm font-medium ${session.alerts_triggered > 5 ? "text-red-400" : session.alerts_triggered > 0 ? "text-amber-400" : "text-emerald-400"
                                        }`}>
                                        {session.alerts_triggered}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
                                        completed
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
