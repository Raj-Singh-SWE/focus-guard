"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * AuthGuard: Wraps protected routes. Checks localStorage for a mock token.
 * If not found, redirects to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("safedrive_token");
        if (!token) {
            router.replace("/login");
        } else {
            setAuthorized(true);
        }
    }, [router, pathname]);

    if (!authorized) {
        // Show a minimal loading state while checking auth
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
}
