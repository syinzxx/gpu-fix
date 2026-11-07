import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function proxy(req: NextRequest) {
  // The session cookie name follows the connection, not the environment: a
  // production server on the shop network runs over plain http.
  const protocol = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: protocol === "https",
  });

  const isLoggedIn = !!token;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
