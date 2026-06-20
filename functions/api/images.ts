// Serve images from R2 bucket via API endpoint
import type { Env } from "../db";

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const url = new URL(context.request.url);
    const file = url.searchParams.get("file");
    if (!file) {
      return new Response("Missing file param", { status: 400 });
    }

    // Sanitize: only allow alphanumeric, dash, underscore, dot
    if (!/^[a-zA-Z0-9_\-.]+$/.test(file)) {
      return new Response("Invalid filename", { status: 400 });
    }

    const r2Key = `images/${file}`;
    const object = await context.env.IMAGES_BUCKET.get(r2Key);
    if (!object) {
      return new Response("Image not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("etag", object.httpEtag);

    return new Response(object.body, { headers });
  } catch (e) {
    return new Response("Internal error", { status: 500 });
  }
}
