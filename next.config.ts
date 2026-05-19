import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["fluent-ffmpeg", "@ffmpeg-installer/ffmpeg", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb"
    }
  }
};

export default nextConfig;
