"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { config } from "../lib/config";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [dob, setDob] = useState("");
    const [licenseNumber, setLicenseNumber] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const calculateAge = (dobString: string) => {
        if (!dobString) return 0;
        const dobDate = new Date(dobString);
        const ageDifMs = Date.now() - dobDate.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    const currentAge = calculateAge(dob);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }

        setLoading(true);

        try {
            // First, update the SQLite profile using the onboarding data
            await fetch(`${config.API_BASE_URL}/api/user/1`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: email.split("@")[0],
                    dob: dob ? new Date(dob).toISOString() : null,
                    license_number: licenseNumber || null,
                    license_expiry: null,
                    insurance_expiry: null,
                })
            });
        } catch (err) {
            console.error("Failed to sync onboarding data with DB.");
        }

        // Mock auth — simulate a 600ms server round-trip
        await new Promise((r) => setTimeout(r, 600));

        // Accept any credentials for prototype
        const mockToken = btoa(`${email}:${Date.now()}`);
        localStorage.setItem("safedrive_token", mockToken);
        localStorage.setItem("safedrive_user", JSON.stringify({
            email,
            name: email.split("@")[0],
            loginTime: new Date().toISOString(),
        }));

        setLoading(false);
        router.push("/dashboard");
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-indigo-900/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-violet-900/15 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                    backgroundSize: "60px 60px",
                }} />
            </div>

            <div className="w-full max-w-md px-6 relative z-10">
                {/* Logo & Branding */}
                <div className="text-center mb-10">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(79,70,229,0.15)]">
                        <ShieldAlert className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-100 tracking-tight">SafeDrive OS</h1>
                    <p className="text-slate-500 text-sm mt-2">Driver Safety & Telemetry Platform</p>
                </div>

                {/* Login Card */}
                <form
                    onSubmit={handleLogin}
                    className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-slate-950/50 space-y-6"
                >
                    <div>
                        <h2 className="text-xl font-semibold text-slate-200 mb-1">Welcome back</h2>
                        <p className="text-slate-500 text-sm">Sign in to access your dashboard</p>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 uppercase tracking-wider" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="driver@safedrive.io"
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                            autoComplete="email"
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 uppercase tracking-wider" htmlFor="password">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 uppercase tracking-wider" htmlFor="dob">
                            Date of Birth
                        </label>
                        <input
                            id="dob"
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            required
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all css-date-icon"
                        />
                    </div>

                    {/* Dynamic License Field */}
                    {dob && currentAge >= 18 && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                            <label className="text-sm font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-2" htmlFor="licenseNumber">
                                <ShieldAlert className="w-4 h-4" /> Driver's License No.
                            </label>
                            <input
                                id="licenseNumber"
                                type="text"
                                value={licenseNumber}
                                onChange={(e) => setLicenseNumber(e.target.value)}
                                placeholder="DL-12345-ABCD"
                                required
                                className="w-full bg-slate-800/50 border border-emerald-500/30 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-mono"
                            />
                        </div>
                    )}

                    {dob && currentAge < 18 && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                            Registration Note: Driver must be 18+ to register a License.
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(79,70,229,0.2)] hover:shadow-[0_0_40px_rgba(79,70,229,0.35)] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Authenticating...
                            </>
                        ) : (
                            "Sign In"
                        )}
                    </button>

                    {/* Hint */}
                    <p className="text-center text-slate-600 text-xs mt-4">
                        Prototype mode — any credentials will work
                    </p>
                </form>

                {/* Footer */}
                <p className="text-center text-slate-700 text-xs mt-8">
                    SafeDrive OS v1.0 · CUDA-Accelerated Vision Pipeline
                </p>
            </div>
        </div>
    );
}
