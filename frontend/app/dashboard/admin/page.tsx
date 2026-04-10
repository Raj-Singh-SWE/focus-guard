"use client";

import { User, ShieldCheck, AlertCircle, Calendar, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { config } from "../../lib/config";

interface UserProfile {
    name: string;
    license_number: string;
    license_expiry: string;
    insurance_expiry: string;
}

/**
 * Admin & Documents page: Fetches License/Insurance status from DB
 * Shows red warnings when expiry < 30 days.
 */
export default function AdminPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const email = JSON.parse(localStorage.getItem("safedrive_user") || "{}").email || "driver@focusdrive.io";
        fetch(`${config.API_BASE_URL}/api/user/${email}`)
            .then((res) => res.json())
            .then((data) => setProfile(data))
            .catch((err) => console.error("Error fetching user", err));
    }, []);

    const today = new Date();

    const licenseExpiry = profile ? new Date(profile.license_expiry) : new Date();
    const insuranceExpiry = profile ? new Date(profile.insurance_expiry) : new Date();

    const daysUntilLicense = profile ? Math.ceil((licenseExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const daysUntilInsurance = profile ? Math.ceil((insuranceExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    const isLicenseCritical = daysUntilLicense < 30;
    const isInsuranceCritical = daysUntilInsurance < 30;

    const formatDate = (d: Date) => d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin & Documents</h1>
                <p className="text-slate-500 mt-1">Manage driver profile, license, and vehicle insurance renewals.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">

                {/* License Card */}
                <div className={`p-6 rounded-xl border transition-all ${isLicenseCritical
                    ? "border-red-500/50 bg-red-500/5 shadow-[0_0_25px_rgba(239,68,68,0.08)]"
                    : "border-slate-200 bg-white shadow-sm"
                    }`}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${isLicenseCritical ? "bg-red-500/10" : "bg-indigo-500/10"
                                }`}>
                                <User className={`w-6 h-6 ${isLicenseCritical ? "text-red-400" : "text-indigo-400"}`} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Driver License</h3>
                                <p className="text-slate-500 text-sm">Class C — Document Active</p>
                            </div>
                        </div>
                        {isLicenseCritical && <AlertCircle className="text-red-500 w-6 h-6 animate-pulse" />}
                    </div>

                    <div className="mt-8 space-y-3">
                        <div>
                            <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider font-medium flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Expires on
                            </p>
                            <p className="text-slate-700 text-sm font-medium">{formatDate(licenseExpiry)}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Remaining
                            </p>
                            <p className={`text-5xl font-bold tracking-tight ${isLicenseCritical ? "text-red-400" : "text-slate-900"}`}>
                                {daysUntilLicense} <span className="text-xl font-normal opacity-50">days</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Insurance Card */}
                <div className={`p-6 rounded-xl border transition-all ${isInsuranceCritical
                    ? "border-red-500/70 bg-red-500/5 shadow-[0_0_25px_rgba(239,68,68,0.1)]"
                    : "border-slate-200 bg-white shadow-sm"
                    }`}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${isInsuranceCritical ? "bg-red-500/10" : "bg-emerald-500/10"
                                }`}>
                                <ShieldCheck className={`w-6 h-6 ${isInsuranceCritical ? "text-red-400" : "text-emerald-400"}`} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Vehicle Insurance</h3>
                                <p className="text-slate-500 text-sm">Comprehensive Coverage</p>
                            </div>
                        </div>
                        {isInsuranceCritical && <AlertCircle className="text-red-500 w-6 h-6 animate-pulse" />}
                    </div>

                    <div className="mt-8 space-y-3">
                        <div>
                            <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider font-medium flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Expires on
                            </p>
                            <p className="text-slate-700 text-sm font-medium">{formatDate(insuranceExpiry)}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Remaining
                            </p>
                            <p className={`text-5xl font-bold tracking-tight ${isInsuranceCritical ? "text-red-400" : "text-slate-900"}`}>
                                {daysUntilInsurance} <span className="text-xl font-normal opacity-50">days</span>
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Driver Profile Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mt-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Driver Profile</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Name</p>
                        <p className="text-slate-800 font-medium">{profile ? profile.name : "Loading..."}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Vehicle</p>
                        <p className="text-slate-800 font-medium">Tata Nexon EV</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">License #</p>
                        <p className="text-slate-800 font-medium font-mono">{profile ? (profile.license_number || "Not Set") : "Loading..."}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Policy #</p>
                        <p className="text-slate-800 font-medium font-mono">INS-2026-789456</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
