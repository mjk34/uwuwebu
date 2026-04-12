import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/uwuwebu" : "",
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: isProd ? "/uwuwebu" : "" },
};

export default nextConfig;
