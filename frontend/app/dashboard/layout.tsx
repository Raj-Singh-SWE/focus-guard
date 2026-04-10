"use client";

import React from "react";
import { Sidebar } from "../components/Sidebar";
import { AuthGuard } from "../components/AuthGuard";

/**
 * Dashboard Layout: All /dashboard/* routes are wrapped with:
 *   1. AuthGuard — redirects to /login if no token
 *   2. Sidebar   — persistent left navigation
 */
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-6 lg:p-10">
                    {children}
                </main>
            </div>
        </AuthGuard>
    );
}
