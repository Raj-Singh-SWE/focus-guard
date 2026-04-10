"use client";

import { useEffect, useRef, useState } from "react";
import { config } from "../lib/config";

interface AlertEntry {
    id: number;
    message: string;
    severity: "critical" | "warning" | "info";
    timestamp: string;
}

interface AlertPayload {
    event: string;
    message: string;
}

const WS_ALERTS_URL = config.WS_ALERTS_URL;
const INITIAL_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 10000;
const KEEPALIVE_INTERVAL = 25000;
const MAX_ALERT_ENTRIES = 50;

export function AlertFeed() {
    const [alerts, setAlerts] = useState<AlertEntry[]>([]);
    const [connected, setConnected] = useState(false);
    const alertIdRef = useRef(0);
    const wsRef = useRef<WebSocket | null>(null);
    const keepaliveRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelay = useRef(INITIAL_RECONNECT_MS);

    // Track previous state to only log *transitions*
    const prevDrowsyRef = useRef(false);
    const prevSeatbeltRef = useRef(true);
    const prevPhoneRef = useRef(false);
    const prevYawnRef = useRef(false);
    const prevHeadRef = useRef(false);

    const pushAlert = (message: string, severity: AlertEntry["severity"]) => {
        alertIdRef.current++;
        const now = new Date().toLocaleTimeString();
        setAlerts((p) => [
            { id: alertIdRef.current, message, severity, timestamp: now },
            ...p.slice(0, MAX_ALERT_ENTRIES - 1),
        ]);
    };

    useEffect(() => {
        const connect = () => {
            if (wsRef.current) wsRef.current.close();
            if (keepaliveRef.current) clearInterval(keepaliveRef.current);

            const ws = new WebSocket(WS_ALERTS_URL);

            ws.onopen = () => {
                setConnected(true);
                reconnectDelay.current = INITIAL_RECONNECT_MS;
                ws.send("ping");

                // Keepalive pings
                keepaliveRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send("ping");
                }, KEEPALIVE_INTERVAL);
            };

            ws.onmessage = (event) => {
                try {
                    const data: AlertPayload = JSON.parse(event.data);
                    if (!data.event || (data as any).type === "pong") return;

                    // ── CLEAR ──
                    if (data.event === "clear") {
                        if (prevDrowsyRef.current) {
                            pushAlert("✅ Driver alert — Drowsiness cleared", "info");
                            prevDrowsyRef.current = false;
                        }
                        if (!prevSeatbeltRef.current) {
                            pushAlert("✅ Seatbelt detected — All clear", "info");
                            prevSeatbeltRef.current = true;
                        }
                        if (prevPhoneRef.current) {
                            pushAlert("✅ Phone put away", "info");
                            prevPhoneRef.current = false;
                        }
                        if (prevYawnRef.current) {
                            pushAlert("✅ Yawning stopped", "info");
                            prevYawnRef.current = false;
                        }
                        if (prevHeadRef.current) {
                            pushAlert("✅ Eyes on road", "info");
                            prevHeadRef.current = false;
                        }
                        return;
                    }

                    // ── SPECIFIC EVENTS (log only on transition) ──
                    if (data.event === "drowsiness" && !prevDrowsyRef.current) {
                        pushAlert(data.message, "critical");
                        prevDrowsyRef.current = true;
                    }
                    if (data.event === "seatbelt" && prevSeatbeltRef.current) {
                        pushAlert(data.message, "warning");
                        prevSeatbeltRef.current = false;
                    }
                    if (data.event === "distraction" && !prevPhoneRef.current) {
                        pushAlert(data.message, "critical");
                        prevPhoneRef.current = true;
                    }
                    if (data.event === "yawning" && !prevYawnRef.current) {
                        pushAlert(data.message, "warning");
                        prevYawnRef.current = true;
                    }
                    if (data.event === "head_down" && !prevHeadRef.current) {
                        pushAlert(data.message, "warning");
                        prevHeadRef.current = true;
                    }
                } catch {
                    /* ignore */
                }
            };

            ws.onclose = () => {
                setConnected(false);
                if (keepaliveRef.current) clearInterval(keepaliveRef.current);
                const delay = reconnectDelay.current;
                reconnectDelay.current = Math.min(delay * 2, MAX_RECONNECT_MS);
                setTimeout(connect, delay);
            };

            ws.onerror = () => { };
            wsRef.current = ws;
        };

        connect();
        return () => {
            if (keepaliveRef.current) clearInterval(keepaliveRef.current);
            wsRef.current?.close();
        };
    }, []);

    const severityColors: Record<string, string> = {
        critical: "border-red-500/40 bg-red-500/10 text-red-400",
        warning: "border-orange-500/40 bg-orange-500/10 text-orange-400",
        info: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-800 tracking-wide">
                    Alert Feed
                </h2>
                <div className="flex items-center gap-2">
                    {alerts.length > 0 && (
                        <button
                            onClick={() => setAlerts([])}
                            className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                    <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full border ${connected
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : "border-slate-300 text-slate-400 bg-slate-100"
                            }`}
                    >
                        {connected ? "LIVE" : "OFFLINE"}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] pr-1">
                {alerts.length === 0 ? (
                    <div className="p-3 bg-slate-100/50 rounded-lg text-sm text-slate-400 border border-slate-200 text-center">
                        No alerts yet. Start a drive session to begin monitoring.
                    </div>
                ) : (
                    alerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`p-3 rounded-lg border text-sm transition-all ${severityColors[alert.severity]}`}
                        >
                            <p className="font-semibold">{alert.message}</p>
                            <p className="text-xs opacity-60 mt-1">{alert.timestamp}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
