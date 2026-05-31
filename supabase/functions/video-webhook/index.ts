import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
    });
  }

  try {
    const payload = await req.json();
    const { job_id, status, video_url, error } = payload;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "Missing job_id in webhook payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find the video generation record by MuAPI job_id
    const { data: videoRecord, error: findError } = await supabase
      .from("video_generations")
      .select("id, storyboard_id")
      .eq("job_id", job_id)
      .single();

    if (findError || !videoRecord) {
      console.error("Video record not found for job_id:", job_id);
      return new Response(JSON.stringify({ error: "Video record not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update video generation record
    const { error: updateError } = await supabase
      .from("video_generations")
      .update({ 
        status, 
        video_url, 
        error, 
        completed_at: status === "completed" ? new Date().toISOString() : null 
      })
      .eq("id", videoRecord.id);

    if (updateError) {
      throw updateError;
    }

    // Also update storyboard if completed
    if (status === "completed" && video_url && videoRecord.storyboard_id) {
      await supabase
        .from("storyboards")
        .update({ 
          video_url: video_url,
          video_job_id: null 
        })
        .eq("id", videoRecord.storyboard_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});