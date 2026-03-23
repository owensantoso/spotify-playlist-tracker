import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./node_modules/kuromoji/dict/**/*"],
  },
};

export default nextConfig;
