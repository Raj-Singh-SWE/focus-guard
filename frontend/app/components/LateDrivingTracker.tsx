"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

export function LateDrivingTracker() {
    const [isLateNight, setIsLateNight] = useState(false);

    useEffect(() => {
        // Check if current system time is highly risky (1:00 AM - 5:00 AM)
        const checkTime = () => {
            const currentHour = new Date().getHours();

            if (currentHour >= 1 && currentHour < 5) {
                setIsLateNight(true);
            } else {
                setIsLateNight(false);
            }
        };

        checkTime();
        const interval = setInterval(checkTime, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!isLateNight) return null;

    return (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-center text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            <AlertCircle className="w-8 h-8 mr-4 animate-pulse flex-shrink-0" />
            <div>
                <h4 className="font-bold tracking-wide">Late Night Driving Detected</h4>
                <p className="text-sm opacity-90 mt-1">
                    It is currently between 1:00 AM and 5:00 AM. Your drowsiness risk is doubled. Please take a break if you feel tired.
                </p>
            </div>
        </div>
    );
}
