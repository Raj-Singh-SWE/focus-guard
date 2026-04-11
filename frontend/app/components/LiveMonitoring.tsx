"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { config } from "../lib/config";

// ─────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────
interface AlertPayload {
    event: string;
    message: string;
}

// ─────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────
const WS_VIDEO_URL = config.WS_VIDEO_URL;
const WS_ALERTS_URL = config.WS_ALERTS_URL;
const INITIAL_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 10000;
const KEEPALIVE_INTERVAL = 25000; // ping every 25s
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export function LiveMonitoring() {
    // ── Refs ──
    const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const videoWsRef = useRef<WebSocket | null>(null);
    const alertWsRef = useRef<WebSocket | null>(null);
    const keepaliveRef = useRef<NodeJS.Timeout | null>(null);

    // Exponential backoff state
    const videoReconnectDelay = useRef(INITIAL_RECONNECT_MS);
    const alertReconnectDelay = useRef(INITIAL_RECONNECT_MS);

    // ── Connection & Session State ──
    const [sessionActive, setSessionActive] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [sessionStart, setSessionStart] = useState<number | null>(null);
    const [sessionElapsed, setSessionElapsed] = useState("00:00:00");
    const [connectionState, setConnectionState] = useState<"idle" | "connecting" | "streaming" | "reconnecting">("idle");

    // ── Alert State ──
    const [isDrowsy, setIsDrowsy] = useState(false);
    const [seatbeltOn, setSeatbeltOn] = useState(true);
    const [isDistracted, setIsDistracted] = useState(false);
    const [isYawning, setIsYawning] = useState(false);
    const [isHeadDown, setIsHeadDown] = useState(false);

    const [alarmActive, setAlarmActive] = useState(false);
    const [alertType, setAlertType] = useState<string | null>(null);

    // ── Smart Driving Warnings ──
    const [isLateNight, setIsLateNight] = useState(false);
    const [showBreakReminder, setShowBreakReminder] = useState(false);

    const [sessionId, setSessionId] = useState<number | null>(null);
    const [alertCount, setAlertCount] = useState(0);
    const alertCountRef = useRef(0);
    const sessionIdRef = useRef<number | null>(null);

    // ── Age Enforcement ──
    const [userAge, setUserAge] = useState<number | null>(null);
    const [ageBlocker, setAgeBlocker] = useState(false);

    // ── FPS Tracking ──
    const [fps, setFps] = useState(0);
    const frameCountRef = useRef(0);
    const lastFpsTimeRef = useRef(Date.now());

    // ─────────────────────────────────────────────────
    //  SESSION TIMER
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!sessionActive || !sessionStart) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - sessionStart;

            const hrs = Math.floor(elapsed / 3600000).toString().padStart(2, "0");
            const mins = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, "0");
            const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, "0");
            setSessionElapsed(`${hrs}:${mins}:${secs}`);

            if (elapsed >= THREE_HOURS_MS) {
                setShowBreakReminder(true);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [sessionActive, sessionStart]);

    // ─────────────────────────────────────────────────
    //  LATE NIGHT CHECK
    // ─────────────────────────────────────────────────
    useEffect(() => {
        const checkTime = () => {
            const hour = new Date().getHours();
            setIsLateNight(hour >= 1 && hour < 5);
        };
        checkTime();
        const interval = setInterval(checkTime, 60000);
        return () => clearInterval(interval);
    }, []);

    // ─────────────────────────────────────────────────
    //  ALARM AUDIO
    // ─────────────────────────────────────────────────
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (alarmActive) {
            audio.loop = true;
            audio.currentTime = 0;
            audio.play().catch(() => console.warn("Audio play blocked."));
        } else {
            audio.pause();
            audio.currentTime = 0;
        }
    }, [alarmActive]);

    // Sync alarm state with all safety alerts
    useEffect(() => {
        if (isDrowsy || !seatbeltOn || isDistracted || isYawning || isHeadDown) {
            setAlarmActive(true);
            if (isDistracted) {
                setAlertType("PHONE DETECTED — PULL OVER!");
            } else if (isDrowsy) {
                setAlertType("DROWSINESS DETECTED — WAKE UP!");
            } else if (isYawning) {
                setAlertType("YAWNING — PLEASE TAKE A BREAK!!");
            } else if (isHeadDown) {
                setAlertType("EYES OFF ROAD — LOOK AHEAD!");
            } else if (!seatbeltOn) {
                setAlertType("SEATBELT NOT FASTENED");
            }
        } else {
            setAlarmActive(false);
            setAlertType(null);
        }
    }, [isDrowsy, seatbeltOn, isDistracted, isYawning, isHeadDown]);

    const dismissAlarm = useCallback(() => {
        setAlarmActive(false);
        setAlertType(null);
    }, []);

    const endDriveSession = useCallback(() => {
        // Sync final stats to DB
        if (sessionIdRef.current && sessionStart) {
            const durationSecs = Math.floor((Date.now() - sessionStart) / 1000);
            fetch(`${config.API_BASE_URL}/api/sessions/${sessionIdRef.current}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    duration: durationSecs,
                    alerts_triggered: alertCountRef.current
                })
            }).catch(e => console.error("Failed to end SQL session:", e));
        }

        setSessionActive(false);
        setSessionId(null);
        sessionIdRef.current = null;
        setIsConnected(false);
        setConnectionState("idle");
        setAlarmActive(false);
        setAlertType(null);
        setIsDrowsy(false);
        setSeatbeltOn(true);
        setIsDistracted(false);
        setIsYawning(false);
        setIsHeadDown(false);
        setShowBreakReminder(false);

        if (keepaliveRef.current) clearInterval(keepaliveRef.current);
        videoWsRef.current?.close();
        alertWsRef.current?.close();
        videoWsRef.current = null;
        alertWsRef.current = null;
    }, [sessionStart]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.removeEventListener("ended", () => setAlarmActive(false));
            audio.pause();
        }
    }, [endDriveSession]);

    // Fetch user age on mount
    useEffect(() => {
        const email = JSON.parse(localStorage.getItem("safedrive_user") || "{}").email || "driver@focusdrive.io";
        fetch(`${config.API_BASE_URL}/api/user/${email}`)
            .then(res => res.json())
            .then(data => {
                if (data.dob) {
                    const dob = new Date(data.dob);
                    const ageDifMs = Date.now() - dob.getTime();
                    const ageDate = new Date(ageDifMs);
                    setUserAge(Math.abs(ageDate.getUTCFullYear() - 1970));
                }
            })
            .catch(err => console.error("Could not fetch user profile for age check.", err));
    }, []);

    // ─────────────────────────────────────────────────
    //  WEBSOCKET: Video Feed (with exponential backoff)
    // ─────────────────────────────────────────────────
    const connectVideoFeed = useCallback(() => {
        if (videoWsRef.current) videoWsRef.current.close();
        setConnectionState("connecting");

        const ws = new WebSocket(WS_VIDEO_URL);

        ws.onopen = () => {
            setIsConnected(true);
            setConnectionState("streaming");
            videoReconnectDelay.current = INITIAL_RECONNECT_MS; // Reset backoff
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                // Ignore heartbeat messages
                if (payload.type === "heartbeat") return;

                if (payload.type === "frame" && payload.data) {
                    const canvas = videoCanvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;

                    const img = new Image();
                    img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = `data:image/jpeg;base64,${payload.data}`;

                    frameCountRef.current += 1;
                    const now = Date.now();
                    if (now - lastFpsTimeRef.current >= 1000) {
                        setFps(frameCountRef.current);
                        frameCountRef.current = 0;
                        lastFpsTimeRef.current = now;
                    }
                }
            } catch {
                /* ignore */
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            setConnectionState("reconnecting");
            // Exponential backoff: 1s → 2s → 4s → 8s → cap at 10s
            const delay = videoReconnectDelay.current;
            videoReconnectDelay.current = Math.min(delay * 2, MAX_RECONNECT_MS);
            setTimeout(connectVideoFeed, delay);
        };

        ws.onerror = () => setIsConnected(false);
        videoWsRef.current = ws;
    }, []);

    // ─────────────────────────────────────────────────
    //  WEBSOCKET: Alerts (with keepalive ping)
    // ─────────────────────────────────────────────────
    const connectAlerts = useCallback(() => {
        if (alertWsRef.current) alertWsRef.current.close();
        if (keepaliveRef.current) clearInterval(keepaliveRef.current);

        const ws = new WebSocket(WS_ALERTS_URL);

        ws.onopen = () => {
            ws.send("ping");
            alertReconnectDelay.current = INITIAL_RECONNECT_MS;

            // Send keepalive pings to prevent proxy/firewall timeouts
            keepaliveRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send("ping");
                }
            }, KEEPALIVE_INTERVAL);
        };

        ws.onmessage = (event) => {
            try {
                const payload: AlertPayload = JSON.parse(event.data);

                // Ignore pong responses
                if (payload.event === "pong" || (payload as any).type === "pong") return;

                if (payload.event === "clear") {
                    setIsDrowsy(false);
                    setSeatbeltOn(true);
                    setIsDistracted(false);
                    setIsYawning(false);
                    setIsHeadDown(false);
                } else {
                    // Record an alert incident
                    if (!alarmActive && (payload.event === "drowsiness" || payload.event === "distraction" || payload.event === "yawning" || payload.event === "head_down" || payload.event === "seatbelt")) {
                        alertCountRef.current += 1;
                        setAlertCount(alertCountRef.current);
                    }

                    if (payload.event === "drowsiness") setIsDrowsy(true);
                    else if (payload.event === "distraction") setIsDistracted(true);
                    else if (payload.event === "seatbelt") setSeatbeltOn(false);
                    else if (payload.event === "yawning") setIsYawning(true);
                    else if (payload.event === "head_down") setIsHeadDown(true);
                }
            } catch {
                /* ignore */
            }
        };

        ws.onclose = () => {
            if (keepaliveRef.current) clearInterval(keepaliveRef.current);
            const delay = alertReconnectDelay.current;
            alertReconnectDelay.current = Math.min(delay * 2, MAX_RECONNECT_MS);
            setTimeout(connectAlerts, delay);
        };

        ws.onerror = () => { };
        alertWsRef.current = ws;
    }, []);

    // ─────────────────────────────────────────────────
    //  SESSION CONTROL
    // ─────────────────────────────────────────────────
    const startDriveSession = useCallback(async () => {
        // Enforce Age limit
        if (userAge !== null && userAge < 18) {
            setAgeBlocker(true);
            return;
        }

        if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext();
        }
        if (audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume();
        }
        const audio = audioRef.current;
        if (audio) {
            audio.volume = 1.0;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                }).catch((err) => console.log("Audio unlock:", err));
            }
        }

        // Track session in DB with user's email
        const userEmail = JSON.parse(localStorage.getItem("safedrive_user") || "{}").email || null;
        try {
            const res = await fetch(`${config.API_BASE_URL}/api/sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_email: userEmail }),
            });
            const data = await res.json();
            setSessionId(data.id);
            sessionIdRef.current = data.id;
        } catch (e) {
            console.error("Failed to start SQL session:", e);
        }

        alertCountRef.current = 0;
        setAlertCount(0);
        setSessionStart(Date.now());
        setShowBreakReminder(false);
        setSessionActive(true);

        connectVideoFeed();
        connectAlerts();
    }, [connectVideoFeed, connectAlerts, userAge]);

    useEffect(() => {
        return () => {
            if (keepaliveRef.current) clearInterval(keepaliveRef.current);
            videoWsRef.current?.close();
            alertWsRef.current?.close();
        };
    }, []);

    // ─────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────
    const alarmEmoji = isDrowsy ? "😴" : isDistracted ? "📱" : isYawning ? "🥱" : isHeadDown ? "👇" : "🚨";

    return (
        <div className="flex flex-col space-y-4">

            {/* LATE NIGHT WARNING */}
            {isLateNight && sessionActive && (
                <div className="bg-amber-500/10 border border-amber-500/50 p-4 rounded-xl flex items-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)] animate-pulse">
                    <span className="text-2xl mr-4">🌙</span>
                    <div>
                        <h4 className="font-bold tracking-wide">Late Night Driving: Risk of Fatigue High</h4>
                        <p className="text-sm opacity-90 mt-1">
                            It is currently between 1:00 AM and 5:00 AM. Consider pulling over if you feel drowsy.
                        </p>
                    </div>
                </div>
            )}

            {/* BREAK REMINDER */}
            {showBreakReminder && sessionActive && (
                <div className="bg-sky-500/10 border border-sky-500/50 p-4 rounded-xl flex items-center justify-between text-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.1)]">
                    <div className="flex items-center">
                        <span className="text-2xl mr-4">☕</span>
                        <div>
                            <h4 className="font-bold tracking-wide">Time for a Coffee Break!</h4>
                            <p className="text-sm opacity-90 mt-1">
                                You have been driving for over 3 hours. Rest improves reaction time.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowBreakReminder(false)}
                        className="text-xs bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 px-4 py-2 rounded-lg transition-all ml-4"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* AGE RESTRICTION BLOCKER */}
            {ageBlocker && (
                <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl flex items-center text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-in fade-in zoom-in duration-300">
                    <span className="text-4xl mr-6">🛑</span>
                    <div>
                        <h4 className="font-bold text-lg tracking-wide text-red-300">Access Restricted</h4>
                        <p className="text-sm opacity-90 mt-1">
                            You must be at least 18 years old to operate this vehicle. Please update your Date of Birth in the Settings page if this is an error.
                        </p>
                    </div>
                </div>
            )}

            {/* MAIN VIDEO MONITORING AREA */}
            <div
                className={`relative bg-black rounded-xl overflow-hidden shadow-lg transition-all duration-300 ${alarmActive
                    ? "border-4 border-red-500 animate-pulse shadow-[0_0_60px_rgba(220,38,38,0.5)]"
                    : "border border-slate-200"
                    }`}
            >
                <canvas
                    ref={videoCanvasRef}
                    className="w-full h-auto block"
                    style={{ minHeight: "360px" }}
                />

                {!sessionActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-10">
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                                <span className="text-4xl">🚗</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Focus Drive Ready</h2>
                                <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
                                    Press the button below to unlock audio alerts, start the session timer, and begin live AI monitoring.
                                </p>
                            </div>
                            <button
                                onClick={startDriveSession}
                                className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)]"
                            >
                                ▶ Start Drive Session
                            </button>
                        </div>
                    </div>
                )}

                {sessionActive && !isConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <span className="text-slate-500 font-mono text-sm tracking-widest">
                            {connectionState === "reconnecting" ? "RECONNECTING..." : "CONNECTING TO BACKEND..."}
                        </span>
                    </div>
                )}

                {isConnected && (
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur text-emerald-400 text-xs font-mono px-3 py-1 rounded-full border border-emerald-500/30 z-20">
                        {fps} FPS
                    </div>
                )}

                {sessionActive && (
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-slate-700 text-xs font-mono px-3 py-1 rounded-full border border-slate-300 z-20">
                        ⏱ {sessionElapsed}
                    </div>
                )}

                {/* ALARM OVERLAYS */}
                {alarmActive && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-900/40 backdrop-blur-sm">
                        <div className="text-center space-y-6 animate-bounce">
                            <span className="text-7xl block">{alarmEmoji}</span>
                            <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                                ⚠️ {alertType}
                            </h2>
                        </div>
                        <button
                            onClick={dismissAlarm}
                            className="mt-8 bg-white/90 hover:bg-white active:scale-95 text-red-700 font-bold px-10 py-4 rounded-xl text-lg transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                        >
                            ✋ Acknowledged
                        </button>
                    </div>
                )}
            </div>

            <audio ref={audioRef} preload="auto" className="hidden">
                <source src="/alarm.wav" type="audio/wav" />
                <source src="/alarm.mp3" type="audio/mpeg" />
            </audio>

            {/* STATUS BAR */}
            <div className="flex flex-wrap justify-between items-center bg-white border border-slate-200 p-5 rounded-xl shadow-sm gap-4">
                <div className="flex items-center gap-6 flex-wrap">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pipeline</h3>
                        <p className={`font-medium flex items-center ${isConnected ? "text-emerald-400" : "text-slate-500"}`}>
                            <span className={`w-2.5 h-2.5 rounded-full mr-2 ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}></span>
                            {connectionState === "streaming" ? "Streaming" : connectionState === "reconnecting" ? "Reconnecting..." : connectionState === "connecting" ? "Connecting..." : "Idle"}
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Drowsiness</h3>
                        <p className={`font-medium ${isDrowsy ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                            {isDrowsy ? "⚠ Alert" : "✓ Normal"}
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Yawning</h3>
                        <p className={`font-medium ${isYawning ? "text-orange-400 animate-pulse" : "text-emerald-400"}`}>
                            {isYawning ? "⚠ Yawning" : "✓ Normal"}
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Seatbelt</h3>
                        <p className={`font-medium ${seatbeltOn ? "text-emerald-400" : "text-orange-400 animate-pulse"}`}>
                            {seatbeltOn ? "✓ Detected" : "⚠ Missing"}
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Distraction</h3>
                        <p className={`font-medium ${isDistracted ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                            {isDistracted ? "⚠ Phone" : "✓ None"}
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Head Pose</h3>
                        <p className={`font-medium ${isHeadDown ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                            {isHeadDown ? "⚠ Down" : "✓ Forward"}
                        </p>
                    </div>
                </div>

                {sessionActive ? (
                    <button
                        onClick={endDriveSession}
                        className="bg-red-600/80 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                    >
                        ⏹ End Session
                    </button>
                ) : (
                    <button
                        onClick={startDriveSession}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)]"
                    >
                        ▶ Start Drive
                    </button>
                )}
            </div>
        </div>
    );
}
