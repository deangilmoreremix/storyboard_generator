import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const MU_API_KEY = Deno.env.get("MUAPI_KEY") ?? "";
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

    const { storyboardId, sceneDescription, duration = 5, resolution = "720p", webhookUrl } = await req.json();

    if (!sceneDescription) {
      return new Response(JSON.stringify({ error: "Missing sceneDescription" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create video record
    const { data: videoRecord, error: videoError } = await supabase
      .from("video_generations")
      .insert({
        user_id: user.id,
        storyboard_id: storyboardId,
        prompt: sceneDescription,
        status: "processing",
      })
      .select()
      .single();

    if (videoError) {
      return new Response(JSON.stringify({ error: videoError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update storyboard with job_id
    if (storyboardId) {
      await supabase
        .from("storyboards")
        .update({ video_job_id: videoRecord.id })
        .eq("id", storyboardId);
    }

    const response = await fetch(`${MU_API_BASE}/videos/generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: sceneDescription,
        duration,
        resolution,
        webhook_url: webhookUrl,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: result.error || "MuAPI error" }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!webhookUrl) {
      // Poll for result
      const finalResult = await pollVideoStatus(result.id);

      if (finalResult.status === "completed") {
        if (storyboardId) {
          await supabase
            .from("storyboards")
            .update({ video_url: finalResult.video_url })
            .eq("id", storyboardId);
        }
        
        await supabase
          .from("video_generations")
          .update({ status: "completed", video_url: finalResult.video_url })
          .eq("id", videoRecord.id);

        return new Response(JSON.stringify({ video_url: finalResult.video_url }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      await supabase
        .from("video_generations")
        .update({ status: "failed", error: "Video generation failed" })
        .eq("id", videoRecord.id);

      return new Response(JSON.stringify({ error: "Video generation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return pending status with job_id
    return new Response(JSON.stringify({ 
      job_id: result.id, 
      status: "processing",
      video_generation_id: videoRecord.id,
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