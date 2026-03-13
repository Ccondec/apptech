cat > /Users/ccondec/Documents/apptech/next.config.ts << 'EOF'
import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
};

module.exports = withPWA(nextConfig);
EOF