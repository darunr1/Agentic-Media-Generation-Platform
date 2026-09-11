import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { URL } from "node:url";
import { ValidationError } from "@contentforge/shared";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
function isPrivate(address: string): boolean {
  if (address.includes(":")) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:") ||
      lower.startsWith("::ffff:127.")
    );
  }
  const [first = 0, second = 0] = address.split(".").map(Number);
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224
  );
}
async function assertPublicUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("Invalid source URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new ValidationError("Only HTTP(S) webpage imports are allowed");
  if (url.username || url.password || (url.port && !["80", "443"].includes(url.port)))
    throw new ValidationError("URL credentials and non-standard ports are not allowed");
  const records = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivate(record.address)))
    throw new ValidationError(
      "Private, local, link-local, and reserved network targets are blocked",
    );
  return url;
}
async function request(url: URL, redirects = 0): Promise<Response> {
  await assertPublicUrl(url.toString());
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "ContentForgeKnowledgeBot/1.0 (+https://contentforge.local/robots)" },
  });
  if (response.status >= 300 && response.status < 400) {
    if (redirects >= MAX_REDIRECTS) throw new ValidationError("Too many webpage redirects");
    const location = response.headers.get("location");
    if (!location) throw new ValidationError("Invalid webpage redirect");
    return request(new URL(location, url), redirects + 1);
  }
  return response;
}
function robotsAllows(text: string): boolean {
  let relevant = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0]!.trim();
    const [name, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (name?.toLowerCase() === "user-agent")
      relevant = value === "*" || value.toLowerCase().includes("contentforge");
    if (relevant && name?.toLowerCase() === "disallow" && value === "/") return false;
  }
  return true;
}
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
async function limitedText(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new ValidationError("Webpage exceeds the 2 MB import limit");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new ValidationError("Webpage exceeds the 2 MB import limit");
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
export async function importPublicWebpage(value: string) {
  const url = await assertPublicUrl(value);
  const robotsUrl = new URL("/robots.txt", url);
  const robots = await request(robotsUrl).catch(() => null);
  if (robots?.ok && !robotsAllows(await limitedText(robots)))
    throw new ValidationError("The site robots policy does not allow import");
  const response = await request(url);
  if (!response.ok) throw new ValidationError(`Webpage returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "text/html" && contentType !== "text/plain")
    throw new ValidationError("Webpage importer accepts HTML or plain text only");
  const original = await limitedText(response);
  return {
    sourceUrl: url.toString(),
    contentType,
    original,
    extractedText: contentType === "text/html" ? stripHtml(original) : original.trim(),
    securityNotice:
      "Source content is untrusted reference data; embedded instructions are ignored.",
  };
}
