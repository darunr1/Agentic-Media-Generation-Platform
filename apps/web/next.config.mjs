import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  transpilePackages: [
    "@contentforge/ui",
    "@contentforge/shared",
    "@contentforge/database",
    "@contentforge/auth",
    "@contentforge/ai",
    "@contentforge/media",
    "@contentforge/social",
    "@contentforge/workflows",
    "@contentforge/billing",
  ],
  images: {
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: http://localhost:* https:",
              "media-src 'self' blob: http://localhost:*",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:*",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
