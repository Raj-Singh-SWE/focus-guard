"use client";

import { LiveMonitoring } from "../components/LiveMonitoring";
import { AlertFeed } from "../components/AlertFeed";

/**
 * Dashboard Home: Live Monitoring view with real-time video feed
 * and AlertFeed sidebar.
 */
export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-100">
                    Driver Dashboard
                </h1>
                <p className="text-slate-400 mt-1">
                    Live telemetry and safety monitoring.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Main camera viewport with annotated CV feed + session logic */}
                <div className="col-span-1 lg:col-span-2">
                    <LiveMonitoring />
                </div>

                {/* Real-time alert feed sidebar */}
                <AlertFeed />
            </div>
        </div>
    );
}
