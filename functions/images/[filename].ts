import type { Env } from "../db";

export async function onRequestGet(context: { request: Request; env: Env }) {
  const url = new URL(context.request.url);
  const filename = url.pathname.split("/images/")[1];
  if (!filename) return new Response("Not found", { status: 404 });

  const key = `images/${filename}`;
  const bucket = (context.env as any).IMAGES_BUCKET as R2Bucket;
  if (!bucket) return new Response("R2 not configured", { status: 500 });

  try {
    const object = await bucket.get(key);
    if (!object) return new Response("Image not found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(object.body, { headers });
  } catch {
    return new Response("Error fetching image", { status: 500 });
  }
}