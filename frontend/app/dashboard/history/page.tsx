"use client";

import { useEffect, useState } from "react";
import { Clock, Calendar, Activity, AlertTriangle, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
        const userEmail = JSON.parse(localStorage.getItem("safedrive_user") || "{}").email || "";
        const queryParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : "";
        fetch(`${config.API_BASE_URL}/api/sessions${queryParam}`)
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

    const chartData = sessions.map((s, index) => ({
        name: `S-${s.id}`,
        alerts: s.alerts_triggered,
        durationMins: Math.round(s.duration / 60),
        date: formatDate(s.start_time)
    }));

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Session History</h1>
                <p className="text-slate-500 mt-1">Review past driving sessions and alert logs.</p>
            </header>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="w-5 h-5 text-indigo-400" />
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Total Sessions</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{sessions.length}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-emerald-400" />
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Total Drive Time</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 font-mono">{totalDriveTime}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Total Alerts</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{totalAlerts}</p>
                </div>
            </div>

            {/* Analytics Visualizers */}
            {sessions.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pb-4">
                    {/* Line Chart */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <TrendingUp className="w-5 h-5 text-indigo-400" />
                            <h3 className="text-slate-800 font-semibold">Alert Trend Over Time</h3>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.5rem', color: '#f1f5f9' }}
                                        itemStyle={{ color: '#818cf8' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    <Line type="monotone" dataKey="alerts" name="Safety Alerts" stroke="#818cf8" strokeWidth={3} dot={{ r: 4, fill: "#818cf8", strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <Clock className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-slate-800 font-semibold">Drive Duration vs Incidents</h3>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.5rem', color: '#f1f5f9' }}
                                        cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    <Bar dataKey="durationMins" name="Duration (min)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                                    <Bar dataKey="alerts" name="Alerts" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Session table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 text-left">
                            <th className="px-6 py-4 text-xs text-slate-400 uppercase tracking-wider font-medium">#</th>
                            <th className="px-6 py-4 text-xs text-slate-400 uppercase tracking-wider font-medium">
                                <Calendar className="w-3 h-3 inline mr-1" />Date
                            </th>
                            <th className="px-6 py-4 text-xs text-slate-400 uppercase tracking-wider font-medium">
                                <Clock className="w-3 h-3 inline mr-1" />Duration
                            </th>
                            <th className="px-6 py-4 text-xs text-slate-400 uppercase tracking-wider font-medium">Alerts</th>
                            <th className="px-6 py-4 text-xs text-slate-400 uppercase tracking-wider font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                                    No driving sessions recorded yet. Start a drive to log history!
                                </td>
                            </tr>
                        ) : sessions.map((session) => (
                            <tr key={session.id} className="border-b border-slate-200/50 hover:bg-slate-100/30 transition-colors">
                                <td className="px-6 py-4 text-slate-500 font-mono text-sm">{session.id}</td>
                                <td className="px-6 py-4 text-slate-800 text-sm">{formatDate(session.start_time)}</td>
                                <td className="px-6 py-4 text-slate-800 text-sm font-mono">{formatDuration(session.duration)}</td>
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
