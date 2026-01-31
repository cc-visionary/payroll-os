import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Exclude pdfkit from bundling so it can properly resolve its font files
  serverExternalPackages: ["pdfkit"],
  // Enable standalone output for Electron packaging
  // This creates a self-contained build in .next/standalone
  output: "standalone",
};

export default nextConfig;
