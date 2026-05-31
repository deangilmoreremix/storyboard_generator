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

  const { steps, initial_prompt } = await req.json();

  try {
    const results: any[] = [];
    let previousImageUrl: string | undefined;

    for (let i = 0; i < steps; i++) {
      const stepPrompt = steps[i] || initial_prompt;
      const fullPrompt = previousImageUrl
        ? `${stepPrompt}. Build upon the previous image: ${previousImageUrl}`
        : stepPrompt;

      const response = await openai.responses.create({
        model: "gpt-5",
        tools: [{ type: "image_generation" }],
        input: [{ role: "user", content: fullPrompt }],
      });

      const toolCall = response.output?.find((o: any) => o.type === "image_generation_call");
      const imageUrl = toolCall?.results?.[0]?.url;

      if (imageUrl) {
        previousImageUrl = imageUrl;
        results.push({ step: i + 1, url: imageUrl });
      }
    }

    return new Response(JSON.stringify({ images: results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});