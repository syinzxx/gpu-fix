import { headers } from "next/headers";

// desktop/main.js adds this to the window's user agent.
const DESKTOP_MARKER = "GPUFixDesktop";

/**
 * The library is for the PC app only. This keeps it out of ordinary browsers,
 * on top of the staff login, but a user agent can be faked, so it is not a
 * substitute for keeping the server on the shop network. Development servers
 * stay open so the pages can be worked on in a browser.
 */
export async function canOpenLibrary(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  return (await headers()).get("user-agent")?.includes(DESKTOP_MARKER) ?? false;
}

export async function requireLibraryAccess() {
  if (!(await canOpenLibrary())) throw new Error("Forbidden");
}
