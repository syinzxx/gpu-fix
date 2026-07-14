import { cookies } from "next/headers";
import { translations, type Locale, type Translations } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const val = cookieStore.get("locale")?.value;
  return val === "ar" ? "ar" : "en";
}

export async function getT(): Promise<Translations> {
  const locale = await getLocale();
  return translations[locale] as Translations;
}
