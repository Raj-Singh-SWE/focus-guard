import "./globals.css";
import React from "react";

export const metadata = {
    title: "SafeDrive OS",
    description: "Driver Safety and Telemetry Dashboard — CUDA-Accelerated Vision Pipeline",
};

/**
 * Root layout: minimal shell. No sidebar here — the sidebar is
 * rendered inside the /dashboard route group layout which is
 * protected by the AuthGuard.
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="bg-slate-950 text-slate-50 antialiased">
                {children}
            </body>
        </html>
    );
}
