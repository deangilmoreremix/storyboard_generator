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

    const { prompt, size = "auto", quality = "auto", style = "vivid" } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let imageUrl: string | null = null;

    try {
      // Try Responses API with image_generation tool
      const response = await openai.responses.create({
        model: "gpt-5",
        input: prompt,
        tools: [{ type: "image_generation", size, quality, style }],
      });

      if (response.output) {
        for (const item of response.output) {
          if (item.type === "image_generation_call" && item.result) {
            imageUrl = item.result;
            break;
          }
        }
      }
    } catch (responsesError) {
      // Fallback to images.generate
      const response = await openai.images.generate({
        prompt,
        size,
        quality,
        style,
        n: 1,
      });

      if (response.data && response.data[0]) {
        imageUrl = response.data[0].url;
      }
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate image" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Save to database
    const { data, error } = await supabase
      .from("storyboards")
      .insert({
        user_id: user.id,
        scene_description: prompt,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (error) {
      console.error("DB insert error:", error);
    }

    return new Response(JSON.stringify({ imageUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});