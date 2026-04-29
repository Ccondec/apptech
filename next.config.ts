import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  runtimeCaching: [
    // Cache Supabase REST API calls (network-first, offline fallback)
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "supabase-rest",
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
    // Cache Supabase Storage (stale-while-revalidate for PDFs / logos)
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "supabase-storage",
        expiration: { maxEntries: 32, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // Cache Next.js static assets
    {
      urlPattern: /^\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Cache page navigations (network-first)
    {
      urlPattern: /^https?:\/\/.*$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const nextConfig: NextConfig = {
  turbopack: {},
};

module.exports = withPWA(nextConfig);
