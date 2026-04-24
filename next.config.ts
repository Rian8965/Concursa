import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "descompliqueseuconcurso.com.br",
        "www.descompliqueseuconcurso.com.br",
      ],
    },
  },
};

export default nextConfig;
