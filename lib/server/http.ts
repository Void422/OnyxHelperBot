export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function apiFailure(error: unknown) {
  if (error instanceof ApiError) {
    return json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
  }
  const reference = `ONX-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  console.error(JSON.stringify({ level: "error", event: "api.unexpected", reference, error }));
  return json(
    { error: { code: "unexpected_error", message: `Something went wrong. Nothing was changed. Error reference: ${reference}` } },
    { status: 500 },
  );
}

export function assertSameOrigin(request: Request, expectedOrigin: string) {
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin) throw new ApiError(403, "This request did not come from the Onyx dashboard.", "invalid_origin");
}

export async function readJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Send this request as JSON.", "unsupported_media_type");
  }
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "The request body is not valid JSON.", "invalid_json");
  }
}
