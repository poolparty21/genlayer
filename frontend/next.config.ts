import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local-loopback hosts to load dev resources (scripts, HMR) so the
  // Studio Next wallet-signing flow works when the app is opened on
  // http://127.0.0.1:<port> or http://localhost:<port> during development.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
