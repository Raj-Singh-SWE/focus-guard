"use client";

import { useEffect, useState, FormEvent } from "react";
import { Save, User, ShieldCheck, Mail, Calendar, FileText } from "lucide-react";
import { config } from "../../lib/config";

interface UserProfile {
    name: string;
    dob: string;
    license_number: string;
    license_expiry: string;
    insurance_expiry: string;
}

export default function SettingsPage() {
    const [profile, setProfile] = useState<UserProfile>({
        name: "", dob: "", license_number: "", license_expiry: "", insurance_expiry: ""
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");

    const calculateAge = (dobString: string) => {
        if (!dobString) return 0;
        const dob = new Date(dobString);
        const ageDifMs = Date.now() - dob.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    const currentAge = calculateAge(profile.dob);

    useEffect(() => {
        fetch(`${config.API_BASE_URL}/api/user/1`)
            .then(res => res.json())
            .then(data => {
                setProfile({
                    name: data.name || "",
                    dob: data.dob ? data.dob.split("T")[0] : "",
                    license_number: data.license_number || "",
                    license_expiry: data.license_expiry ? data.license_expiry.split("T")[0] : "",
                    insurance_expiry: data.insurance_expiry ? data.insurance_expiry.split("T")[0] : "",
                });
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage("");

        try {
            const res = await fetch(`${config.API_BASE_URL}/api/user/1`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: profile.name,
                    dob: profile.dob ? new Date(profile.dob).toISOString() : null,
                    license_number: profile.license_number,
                    license_expiry: profile.license_expiry ? new Date(profile.license_expiry).toISOString() : null,
                    insurance_expiry: profile.insurance_expiry ? new Date(profile.insurance_expiry).toISOString() : null,
                })
            });

            if (res.ok) {
                setMessage("Profile updated successfully.");
            } else {
                setMessage("Error updating profile.");
            }
        } catch (error) {
            setMessage("Network error saving profile.");
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return <div className="p-8 text-slate-400">Loading profile data...</div>;
    }

    return (
        <div className="max-w-3xl space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-100">Settings & Profile</h1>
                <p className="text-slate-400 mt-1">Manage your driver demographics and registered documents.</p>
            </header>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-medium border ${message.includes("success") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6 space-y-6">

                {/* Personal Information */}
                <div>
                    <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-4">Personal Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                <User className="w-4 h-4" /> Full Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={profile.name}
                                onChange={handleChange}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> Date of Birth (Age Verification)
                            </label>
                            <input
                                type="date"
                                name="dob"
                                value={profile.dob}
                                onChange={handleChange}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors css-date-icon"
                            />
                        </div>
                    </div>
                </div>

                {/* Document Information (Only visible if 18+) */}
                {currentAge >= 18 ? (
                    <div>
                        <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-4">Driver Documents</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2 col-span-1 sm:col-span-2">
                                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Driver's License Number
                                </label>
                                <input
                                    type="text"
                                    name="license_number"
                                    value={profile.license_number}
                                    onChange={handleChange}
                                    placeholder="e.g. DL-12345-ABCD"
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-emerald-400" /> License Expiry
                                </label>
                                <input
                                    type="date"
                                    name="license_expiry"
                                    value={profile.license_expiry}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-sky-400" /> Insurance Expiry
                                </label>
                                <input
                                    type="date"
                                    name="insurance_expiry"
                                    value={profile.insurance_expiry}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center">
                        <p className="text-amber-400 text-sm font-medium">You must be 18 or older to register driver documents.</p>
                    </div>
                )}

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? "Saving..." : "Save Profile Updates"}
                    </button>
                </div>
            </form>
        </div>
    );
}
