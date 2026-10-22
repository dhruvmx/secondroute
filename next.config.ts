import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  devIndicators: false,
};
export default config;
