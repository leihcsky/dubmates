import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["ogv"],
  async redirects() {
    return [
      {
        source: "/:locale/scenes",
        destination: "/:locale/packs",
        permanent: false,
      },
      {
        source: "/:locale/scenes/:slug",
        destination: "/:locale/play/:slug",
        permanent: false,
      },
      {
        source: "/:locale/studio/:slug",
        destination: "/:locale/play/:slug",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
