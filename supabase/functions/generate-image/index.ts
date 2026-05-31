import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.40.0";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

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

  const { prompt, size = "1024x1024", quality = "standard" } = await req.json();

  try {
    let imageUrl: string | undefined;

    try {
      const response = await openai.responses.create({
        model: "gpt-5",
        tools: [{ type: "image_generation", size, quality }],
        input: [{ role: "user", content: prompt }],
      });

      const toolCall = response.output?.find((o: any) => o.type === "image_generation_call");
      if (toolCall?.results?.[0]?.url) {
        imageUrl = toolCall.results[0].url;
      }
    } catch (_e) {
      const fallback = await openai.images.generate({
        prompt,
        n: 1,
        size: size as "1024x1024" | "512x512" | "256x256" | "1792x1024" | "1024x1792",
      });
      imageUrl = fallback.data?.[0]?.url;
    }

    if (!imageUrl) throw new Error("Image generation failed");

    return new Response(JSON.stringify({ url: imageUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});