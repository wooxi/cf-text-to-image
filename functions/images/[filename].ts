// Serve images from R2 bucket
import type { Env } from "../db";

export async function onRequestGet(context: { request: Request; env: Env; params: { filename: string } }) {
  try {
    const filename = context.params.filename;
    if (!filename) {
      return new Response("Not found", { status: 404 });
    }

    const r2Key = `images/${filename}`;
    const object = await context.env.IMAGES_BUCKET.get(r2Key);
    if (!object) {
      return new Response("Not found", { status: 404 });
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
