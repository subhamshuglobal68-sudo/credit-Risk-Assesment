// Supabase Edge Function: admin-invite
// Description: Privileged admin action to invite new administrators or promote existing users.
// Uses SUPABASE_SERVICE_ROLE_KEY strictly server-side. Never exposed in client code.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing server-side Supabase credentials." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify caller's JWT to ensure they are an authenticated Admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client with service_role key to execute privileged operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: tokenError } = await supabaseAdmin.auth.getUser(token);

    if (tokenError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check caller's role in public.profiles
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (profileError || callerProfile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only administrators can execute this action." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request payload
    const { email, fullName, action } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Target email address is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetEmail = String(email).trim().toLowerCase();

    // Action: "promote" -> Update existing profile role to 'admin'
    if (action === "promote") {
      const { data: existingProfile, error: findError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, role")
        .eq("email", targetEmail)
        .maybeSingle();

      if (findError) {
        return new Response(
          JSON.stringify({ error: `Database error: ${findError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!existingProfile) {
        return new Response(
          JSON.stringify({ error: `User with email ${targetEmail} does not exist in profiles.` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ role: "admin", updated_at: new Date().toISOString() })
        .eq("id", existingProfile.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: `Failed to promote user: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully promoted ${targetEmail} to Administrator.`,
          user: { id: existingProfile.id, email: targetEmail, role: "admin" },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: "invite" (default) -> Use auth.admin.inviteUserByEmail to send email invite
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      targetEmail,
      {
        data: {
          full_name: fullName || "CREA AI Admin",
        },
      }
    );

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: `Invite failed: ${inviteError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Provision or update profile to 'admin' role
    if (inviteData?.user?.id) {
      await supabaseAdmin.from("profiles").upsert({
        id: inviteData.user.id,
        email: targetEmail,
        full_name: fullName || "CREA AI Admin",
        role: "admin",
        updated_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Admin invitation successfully dispatched to ${targetEmail}.`,
        user: inviteData.user,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
