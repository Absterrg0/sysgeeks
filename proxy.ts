import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";

// Clerk middleware only where auth() is called. Content pages never run it.
export const proxy = features().auth ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    "/api/ai/:path*",
    "/api/billing/:path*",
    "/api/account",
    "/account/:path*",
    "/reports/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
  ],
};
