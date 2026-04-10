"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, FileText, Settings, ShieldAlert, LogOut, Radio } from "lucide-react";

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const navItems = [
        { name: "Live Monitoring", href: "/dashboard", icon: Radio },
        { name: "Session History", href: "/dashboard/history", icon: Activity },
        { name: "Admin & Documents", href: "/dashboard/admin", icon: FileText },
    ];

    const handleLogout = () => {
        localStorage.removeItem("safedrive_token");
        localStorage.removeItem("safedrive_user");
        router.push("/login");
    };

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-col hidden md:flex">
            {/* Brand */}
            <div className="h-16 flex items-center px-6 border-b border-slate-800">
                <ShieldAlert className="w-6 h-6 text-indigo-500 mr-2" />
                <span className="font-bold text-lg tracking-wide text-slate-100">SafeDrive OS</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map((item) => {
                    const isActive =
                        item.href === "/dashboard"
                            ? pathname === "/dashboard"
                            : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center px-3 py-2.5 rounded-lg font-medium transition-all ${isActive
                                    ? "bg-indigo-500/10 text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.05)]"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                }`}
                        >
                            <item.icon className="w-5 h-5 mr-3" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer: Settings + Logout */}
            <div className="p-4 border-t border-slate-800 space-y-1">
                <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 font-medium transition-colors rounded-lg hover:bg-slate-800">
                    <Settings className="w-5 h-5 mr-3" />
                    Settings
                </button>
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 font-medium transition-colors rounded-lg"
                >
                    <LogOut className="w-5 h-5 mr-3" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
