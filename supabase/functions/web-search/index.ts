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

  const { query, count = 5 } = await req.json();

  try {
    const response = await openai.responses.create({
      model: "gpt-5",
      tools: [{ type: "web_search_preview", search_context_size: count }],
      input: [{ role: "user", content: query }],
    });

    const citations = response.output?.flatMap((item: any) =>
      item.citations || []
    ).map((c: any) => ({
      title: c.title,
      url: c.url,
      snippet: c.snippet,
    })) || [];

    return new Response(JSON.stringify({ result: response.output_text, citations }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});