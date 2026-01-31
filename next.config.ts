import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Exclude pdfkit from bundling so it can properly resolve its font files
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
