import { NextResponse } from "next/server";
export default function middleware() {
  // Authorization is deliberately enforced in Node-backed layouts and API
  // handlers where Auth.js can verify the JWT and query membership. Keeping
  // the edge layer transport-only avoids treating cookie presence as proof.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
