import type { MetadataRoute } from "next";

const SITE_URL = "https://www.getbuildbay.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // ログインが必要な画面・管理画面・APIはクロールさせない
      disallow: [
        "/admin",
        "/api",
        "/dashboard",
        "/seller",
        "/mfa",
        "/submit",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
