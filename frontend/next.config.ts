import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Protocol Court Explorer -- frontend only, no server infrastructure of
   * our own. Static-friendly by default; all data comes from the deployed
   * Intelligent Contract via genlayer-js, never from an API route we host. */
};

export default nextConfig;
