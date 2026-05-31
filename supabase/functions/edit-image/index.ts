import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.40.0";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization,content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
    });
  }

  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const prompt = formData.get("prompt") as string;
    const mask = formData.get("mask") as File | null;

    if (!image) {
      return new Response(JSON.stringify({ error: "Missing image file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const imageBase64 = arrayBufferToBase64(await image.arrayBuffer());
    const maskBase64 = mask ? arrayBufferToBase64(await mask.arrayBuffer()) : null;

    const result = await openai.images.edit({
      image: imageBase64,
      prompt,
      mask: maskBase64 ?? undefined,
      size: "1024x1024",
    });

    return new Response(JSON.stringify({ url: result.data?.[0]?.url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});