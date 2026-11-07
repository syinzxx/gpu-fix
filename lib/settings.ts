import { cache } from "react";
import { db } from "@/lib/db";

export const getSettings = cache(async function getSettings() {
  const s = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
  return {
    shopName: s.shopName || process.env.SHOP_NAME || "GPU Fix Shop",
    shopAddress: s.shopAddress || process.env.SHOP_ADDRESS || "",
    shopPhone: s.shopPhone || process.env.SHOP_PHONE || "",
    shopHours: s.shopHours || process.env.SHOP_HOURS || "",
    whatsappNumber: s.whatsappNumber || process.env.SHOP_WHATSAPP || "",
    socialFacebook: s.socialFacebook || process.env.SOCIAL_FACEBOOK_URL || "",
    socialYoutube: s.socialYoutube || process.env.SOCIAL_YOUTUBE_URL || "",
    socialTiktok: s.socialTiktok || process.env.SOCIAL_TIKTOK_URL || "",
    socialDiscord: s.socialDiscord || process.env.SOCIAL_DISCORD_URL || "",
  };
});
