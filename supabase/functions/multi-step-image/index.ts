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

    const { steps, prompt } = await req.json();

    const results: Array<{ step: string; imageUrl: string }> = [];
    let previousResponseId: string | undefined;

    const stepsToProcess = steps || [{ step: "generate", prompt }];

    for (const stepConfig of stepsToProcess) {
      try {
        const response = await openai.responses.create({
          model: "gpt-5",
          tools: [{ type: "image_generation" }],
          input: stepConfig.prompt,
          ...(previousResponseId && { previous_response_id: previousResponseId }),
        });

        let imageUrl: string | null = null;
        if (response.output) {
          for (const item of response.output) {
            if (item.type === "image_generation_call" && item.result) {
              imageUrl = item.result;
              break;
            }
          }
        }

        if (imageUrl) {
          results.push({ step: stepConfig.step, imageUrl });
          previousResponseId = response.id;
        }
      } catch (stepError) {
        console.error(`Step ${stepConfig.step} failed:`, stepError);
      }
    }

    return new Response(JSON.stringify({ results }), {
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