import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { features } from "@/lib/config";

export type Profile = {
  email: string | null;
  name: string | null;
  verifiedEmail: boolean;
};

export type AuthUser = Profile & { userId: string };

export async function currentUserId(): Promise<string | null> {
  if (!features().auth) return null;
  const { userId } = await auth();
  return userId;
}

/** The signed-in user's id, read from the session. No network call. */
export async function requireUserId(): Promise<string | Response> {
  if (!features().auth) {
    return Response.json({ type: "error", code: "ai_unavailable" }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) return Response.json({ type: "error", code: "auth_required" }, { status: 401 });
  return userId;
}

/**
 * The signed-in user's email and name. Calls Clerk's Backend API, which is rate-limited,
 * so call it only when the profile is needed (the welcome grant, checkout).
 */
export async function loadProfile(): Promise<Profile | null> {
  if (!features().auth) return null;
  const user = await currentUser();
  if (!user) return null;
  const email = user.primaryEmailAddress;
  return {
    email: email?.emailAddress ?? null,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    verifiedEmail: email?.verification?.status === "verified",
  };
}

/** Both halves at once. Routes that need the profile on every request can keep using this. */
export async function requireUser(): Promise<AuthUser | Response> {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const profile = await loadProfile();
  if (!profile) return Response.json({ type: "error", code: "auth_required" }, { status: 401 });
  return { userId, ...profile };
}
