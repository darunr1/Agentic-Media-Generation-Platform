# Workspace image upload API

## Request

`POST /api/v1/workspaces/{workspaceSlug}/assets`

Authenticate with the existing session cookie. The caller must have
`brand:write` in the workspace; the brand must belong to that workspace.
Send multipart form data with exactly one `file` and a `brandId` (1–128
ASCII letters, digits, underscores or hyphens). PNG and JPEG only, with
matching file extension, MIME type and actual image bytes. The maximum file
size is 15 MiB (15,728,640 bytes); multipart overhead is limited to 64 KiB.
The browser must set the multipart boundary itself.

```ts
const form = new FormData();
form.set("brandId", brandId);
form.set("file", file);
const response = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/assets`, {
  method: "POST",
  body: form,
  credentials: "same-origin",
});
const result = await response.json();
if (!response.ok) throw new Error(result.error.message);
const assetId: string = result.data.id;
```

## Success

HTTP 201. Save the opaque ID; it is not a media URL or storage key.

```json
{ "data": { "id": "asset-safe-id" } }
```

## Failure

| Status | Code             | Meaning                                                                        |
| ------ | ---------------- | ------------------------------------------------------------------------------ |
| 400    | VALIDATION_ERROR | Invalid multipart, missing fields, spoofed or unsupported image, or size limit |
| 401    | UNAUTHENTICATED  | No valid session                                                               |
| 403    | FORBIDDEN        | Missing workspace write permission or rejected cross-origin mutation           |
| 404    | NOT_FOUND        | Unknown/deleted workspace or brand outside the selected workspace              |
| 429    | RATE_LIMITED     | Too many requests                                                              |
| 500    | INTERNAL_ERROR   | Unexpected storage/database failure                                            |

Example HTTP 401:

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication required",
    "requestId": "example-request-id"
  }
}
```

All responses include `X-Request-Id`. Errors may contain optional `details`;
display the message as plain text and preserve the request ID for support.
Do not automatically retry an ambiguous upload failure: the endpoint does not
promise idempotency. Client-side checks are UX only, not a security boundary.

## Regression checks

Run `pnpm --filter @contentforge/web test`. The route tests exercise the
real handler and image validator with mocked session, database and storage
boundaries. They do not replace an authenticated end-to-end test.
