import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.40.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization,content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Validate user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { scene_description, reasoning_effort, stream = false, enable_web_search, enable_image_generation } = await req.json();

    if (!scene_description) {
      return new Response(JSON.stringify({ error: "Missing scene_description" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build tools array
    const tools: any[] = [];
    if (enable_image_generation) {
      tools.push({ type: "image_generation" });
    }
    if (enable_web_search) {
      tools.push({ type: "web_search_preview" });
    }

    let imageUrl: string | null = null;
    let outputText = "";

    if (stream) {
      const response = await openai.responses.create({
        model: "gpt-5",
        stream: true,
        ...(tools.length > 0 && { tools }),
        input: scene_description,
        ...(reasoning_effort && { reasoning_effort }),
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of response) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const response = await openai.responses.create({
      model: "gpt-5",
      ...(tools.length > 0 && { tools }),
      input: scene_description,
      ...(reasoning_effort && { reasoning_effort }),
    });

    // Extract output_text
    outputText = response.output_text || "";

    // Extract image URL if generated
    if (response.output) {
      for (const item of response.output) {
        if (item.type === "image_generation_call" && item.result) {
          imageUrl = item.result;
          break;
        }
      }
    }

    // Save to database
    const { data: storyboard, error: insertError } = await supabase
      .from("storyboards")
      .insert({
        user_id: user.id,
        scene_description,
        screenplay: outputText.substring(0, 500), // Store first 500 chars as screenplay
        image_url: imageUrl,
        panels: response.output?.filter((o: any) => o.type !== "image_generation_call") || [],
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      id: storyboard.id,
      output_text: outputText,
      image_url: imageUrl,
      panels: storyboard.panels,
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});