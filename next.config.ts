import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // Ticket photo attachments allow images up to 8MB; leave headroom for
    // multipart/form-data boundary/field overhead on top of the raw file.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
