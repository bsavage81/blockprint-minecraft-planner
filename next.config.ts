import type { NextConfig } from "next";

const pagesBasePath = process.env.GITHUB_ACTIONS
  ? "/blockprint-minecraft-planner"
  : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: pagesBasePath,
  assetPrefix: pagesBasePath,
};

export default nextConfig;
