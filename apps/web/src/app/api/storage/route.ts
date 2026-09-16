import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  LocalObjectStorageProvider,
  localStorageRoot,
  verifyStorageSignature,
} from "@contentforge/media";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "",
    expires = Number(req.nextUrl.searchParams.get("expires")),
    signature = req.nextUrl.searchParams.get("signature") ?? "";
  if (!verifyStorageSignature(key, expires, signature))
    return new NextResponse("Expired or invalid media link", { status: 403 });
  try {
    const bytes = await new LocalObjectStorageProvider(localStorageRoot()).get(key);
    const mime = key.endsWith(".mp4")
      ? "video/mp4"
      : key.endsWith(".png")
        ? "image/png"
        : key.endsWith(".wav")
          ? "audio/wav"
          : key.endsWith(".vtt")
            ? "text/vtt"
            : "application/octet-stream";
    const headers = {
      "content-type": mime,
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=60",
      "x-content-type-options": "nosniff",
    };
    const range = req.headers.get("range");
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match)
        return new NextResponse(null, {
          status: 416,
          headers: { "content-range": `bytes */${bytes.length}` },
        });
      const start = Number(match[1]),
        end = match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
      if (start > end || start >= bytes.length)
        return new NextResponse(null, {
          status: 416,
          headers: { "content-range": `bytes */${bytes.length}` },
        });
      return new NextResponse(Buffer.from(bytes.subarray(start, end + 1)), {
        status: 206,
        headers: {
          ...headers,
          "content-range": `bytes ${start}-${end}/${bytes.length}`,
          "content-length": String(end - start + 1),
        },
      });
    }
    return new NextResponse(Buffer.from(bytes), {
      headers: { ...headers, "content-length": String(bytes.length) },
    });
  } catch {
    return new NextResponse("Media unavailable", { status: 404 });
  }
}
