/**
 * SafeDrive OS - Environment Configuration
 * ==========================================
 * Centralizes all backend connection URLs.
 * Uses NEXT_PUBLIC_ env vars so they're available client-side.
 *
 * In development:  defaults to localhost:8000
 * In production:   set NEXT_PUBLIC_BACKEND_URL to your backend's public address
 *                  (e.g., via ngrok or a cloud VM)
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "localhost:8000";

// Determine protocol based on whether backend uses HTTPS
const isSecure = BACKEND_URL.startsWith("https://") || BACKEND_URL.startsWith("wss://");
const cleanHost = BACKEND_URL
    .replace(/^https?:\/\//, "")
    .replace(/^wss?:\/\//, "")
    .replace(/\/$/, "");

const wsProtocol = isSecure ? "wss" : "ws";
const httpProtocol = isSecure ? "https" : "http";

export const config = {
    WS_VIDEO_URL: `${wsProtocol}://${cleanHost}/ws/video-feed`,
    WS_ALERTS_URL: `${wsProtocol}://${cleanHost}/ws/alerts`,
    API_BASE_URL: `${httpProtocol}://${cleanHost}`,
};
