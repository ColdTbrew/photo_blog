import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

let supabaseImagePattern:
  | {
      protocol: "http" | "https";
      hostname: string;
      pathname: string;
    }
  | undefined;

if (supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    supabaseImagePattern = {
      protocol: url.protocol === "https:" ? "https" : "http",
      hostname: url.hostname,
      pathname: "/storage/v1/object/public/**",
    };
  } catch {
    supabaseImagePattern = undefined;
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImagePattern ? [supabaseImagePattern] : [],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
