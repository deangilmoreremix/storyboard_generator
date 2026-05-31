import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const MU_API_KEY = Deno.env.get("MU_API_KEY") ?? "";
const MU_API_BASE = "https://api.muapi.io/v1";

async function pollVideoStatus(jobId: string, maxAttempts = 60): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${MU_API_BASE}/videos/${jobId}`, {
      headers: { "Authorization": `Bearer ${MU_API_KEY}` },
    });
    const status = await response.json();

    if (status.status === "completed" || status.status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Video generation timed out");
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

  const { prompt, webhook_url, ...options } = await req.json();

  try {
    const response = await fetch(`${MU_API_BASE}/videos/generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        webhook_url,
        ...options,
      }),
    });

    const result = await response.json();

    if (webhook_url) {
      return new Response(JSON.stringify({ job_id: result.id, status: "processing" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const finalResult = await pollVideoStatus(result.id);

    if (finalResult.status === "completed") {
      return new Response(JSON.stringify({ video_url: finalResult.video_url }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Video generation failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});