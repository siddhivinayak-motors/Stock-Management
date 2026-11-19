import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Server auth configuration is missing" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);
  const callerId = authData.user.id;

  const { data: profile, error: profileError } = await callerClient
    .from("profiles").select("is_super_admin,status").eq("user_id", callerId).maybeSingle();
  if (profileError || !profile || profile.status !== "active") return json({ error: "Active employee profile required" }, 403);

  const { data: canManage, error: permError } = await callerClient
    .rpc("has_permission", { p_module: "employee_management", p_action: "manage_users" });
  const allowed = profile.is_super_admin === true || canManage === true;
  if (permError || !allowed) return json({ error: "You are not allowed to manage employees" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const action = String(body.action || "");
  if (action === "create_employee") {
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    if (!email || !fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Valid email and full name are required" }, 400);
    }
    const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (inviteError || !invite.user) return json({ error: inviteError?.message || "Invite failed" }, 400);

    const { error: insertError } = await adminClient.from("profiles").upsert({
      user_id: invite.user.id,
      full_name: fullName,
      email,
      employee_code: body.employee_code ? String(body.employee_code).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      designation: body.designation ? String(body.designation).trim() : null,
      department: body.department ? String(body.department).trim() : null,
      status: "active",
      is_super_admin: false,
    }, { onConflict: "user_id" });
    if (insertError) {
      await adminClient.auth.admin.deleteUser(invite.user.id);
      return json({ error: insertError.message }, 400);
    }

    const rawPermissions = Array.isArray(body.permissions) ? body.permissions : [];
    const validModules = new Set(["dashboard","stock_register","stock_hold_management","price_list_management","quotation_management","employee_management","common_excel_upload","backup_restore","audit_history","retail_reports"]);
    const validActions = new Set(["view","create","edit","delete","approve","manage_users","export","restore"]);
    const rows = rawPermissions.flatMap((item: any) => {
      if (!item || !validModules.has(String(item.module))) return [];
      const actions = Array.isArray(item.actions) ? item.actions.map(String).filter((a: string) => validActions.has(a)) : ["view"];
      return [{ user_id: invite.user!.id, module: item.module, actions, granted_by: callerId }];
    });
    if (rows.length) {
      const { error: permWriteError } = await adminClient.from("employee_permissions").upsert(rows, { onConflict: "user_id,module" });
      if (permWriteError) return json({ error: "Employee invited, but permissions could not be saved: " + permWriteError.message, user_id: invite.user.id }, 500);
    }
    await adminClient.from("audit_logs").insert({
      actor_id: callerId, actor_email: authData.user.email, module: "employee_management",
      action: "create", action_label: "Created employee invitation",
      record_type: "profile", record_id: invite.user.id, details: { email },
    });
    return json({ success: true, user_id: invite.user.id, email, message: "Invitation sent. Employee must set a password from the email link." }, 201);
  }

  if (action === "update_employee") {
    const userId = String(body.user_id || "");
    if (!userId || userId === callerId) return json({ error: "A different employee user_id is required" }, 400);
    const { data: target, error: targetError } = await adminClient.from("profiles")
      .select("user_id,email,is_super_admin").eq("user_id", userId).maybeSingle();
    if (targetError || !target) return json({ error: "Employee not found" }, 404);
    if (target.is_super_admin) return json({ error: "A Super Admin profile cannot be edited here" }, 403);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["full_name","employee_code","phone","designation","department"]) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        patch[key] = body[key] === "" ? null : String(body[key]).trim();
      }
    }
    if (typeof patch.full_name === "string" && !patch.full_name) return json({ error: "Full name cannot be empty" }, 400);
    if (typeof patch.phone === "string" && patch.phone && !/^\\d{10}$/.test(patch.phone)) return json({ error: "Mobile number must be exactly 10 digits" }, 400);
    if (typeof patch.department === "string" && patch.department && !["Personal","EV","Commercial","LLM"].includes(patch.department)) return json({ error: "Invalid department" }, 400);
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!["active","inactive"].includes(status)) return json({ error: "Status must be active or inactive" }, 400);
      patch.status = status;
    }
    const { error: updateError } = await adminClient.from("profiles").update(patch).eq("user_id", userId);
    if (updateError) return json({ error: updateError.message }, 400);
    if (patch.status === "inactive") {
      const { error: banError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (banError) return json({ error: "Profile status updated but login deactivation failed: " + banError.message }, 500);
    } else if (patch.status === "active") {
      const { error: unbanError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (unbanError) return json({ error: "Profile status updated but login activation failed: " + unbanError.message }, 500);
    }
    if (typeof patch.full_name === "string") {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: patch.full_name },
      });
      if (authUpdateError) return json({ error: "Profile updated, but Auth metadata update failed: " + authUpdateError.message }, 500);
    }
    await adminClient.from("audit_logs").insert({
      actor_id: callerId, actor_email: authData.user.email, module: "employee_management",
      action: "edit", action_label: "Updated employee profile",
      record_type: "profile", record_id: userId,
    });
    return json({ success: true, message: "Employee profile updated" });
  }

  if (action === "deactivate_employee") {
    const userId = String(body.user_id || "");
    if (!userId || userId === callerId) return json({ error: "A different employee user_id is required" }, 400);
    const { data: target, error: targetError } = await adminClient.from("profiles")
      .select("user_id,email,is_super_admin").eq("user_id", userId).maybeSingle();
    if (targetError || !target) return json({ error: "Employee not found" }, 404);
    if (target.is_super_admin) return json({ error: "A Super Admin cannot be deactivated by this action" }, 403);
    const { error: updateError } = await adminClient.from("profiles")
      .update({ status: "inactive", updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (updateError) return json({ error: updateError.message }, 400);
    await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    await adminClient.from("audit_logs").insert({
      actor_id: callerId, actor_email: authData.user.email, module: "employee_management",
      action: "edit", action_label: "Deactivated employee",
      record_type: "profile", record_id: userId, details: { email: target.email },
    });
    return json({ success: true, message: "Employee deactivated" });
  }

  return json({ error: "Unsupported action" }, 400);
});