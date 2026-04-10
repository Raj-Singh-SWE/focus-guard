"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Root page: redirect to /dashboard if authenticated, or /login if not.
 */
export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("safedrive_token");
        if (token) {
            router.replace("/dashboard");
        } else {
            router.replace("/login");
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
