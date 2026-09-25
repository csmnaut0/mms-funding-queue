import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Returns every loan in the funding queue for the dashboard.
// URL: https://<your-site>.netlify.app/api/loans   (header x-view-key: <VIEW_KEY>)

export default async (req: Request, context: Context) => {
  const expected = Netlify.env.get("VIEW_KEY");
  const provided = req.headers.get("x-view-key") || new URL(req.url).searchParams.get("key");

  if (expected && provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const store = getStore({ name: "funding-queue", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "loan/" });
  const loans = (
    await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);

  return new Response(JSON.stringify({ ok: true, count: loans.length, loans, served_at: new Date().toISOString() }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};

export const config: Config = {
  path: "/api/loans",
};
