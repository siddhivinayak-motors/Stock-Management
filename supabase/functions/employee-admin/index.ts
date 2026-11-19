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

const ROLE_MODULES: Record<string,string[]> = {
  "Admin": ["dashboard","stock_register","stock_hold_management","price_list_management","quotation_management","employee_management","common_excel_upload","backup_restore","audit_history","retail_reports"],
  "General Manager": ["dashboard","stock_register","stock_hold_management","price_list_management","quotation_management","employee_management","common_excel_upload","backup_restore","audit_history","retail_reports"],
  "Manager": ["dashboard","stock_register","stock_hold_management","quotation_management"],
  "Accountant": ["price_list_management","retail_reports","common_excel_upload"],
  "HR": ["price_list_management","employee_management","retail_reports","common_excel_upload"],
  "DMS": ["price_list_management","retail_reports","common_excel_upload"],
  "Executive": ["dashboard","stock_register","stock_hold_management","quotation_management","price_list_management","retail_reports"],
  "Reception": ["dashboard","stock_register","stock_hold_management","quotation_management","price_list_management","retail_reports"],
  "Driver": ["stock_register"]
};
const ALL_MODULES = ["dashboard","stock_register","stock_hold_management","price_list_management","quotation_management","employee_management","common_excel_upload","backup_restore","audit_history","retail_reports"];
function rolePermissionRows(role: string, userId: string, grantedBy: string, selectedModules?: string[]) {
  const selected = selectedModules || [];
  const full = ["view","create","edit","delete","approve","manage_users","export","restore"];
  const view = ["view"];
  const map: Record<string,string[]> = {};
  if (role === "Admin" || role === "General Manager") {
    for (const m of ALL_MODULES) map[m] = [...full];
  } else if (role === "Manager") {
    Object.assign(map,{dashboard:view,stock_register:["view","create","edit","delete","export"],stock_hold_management:["view","create","approve"],quotation_management:["view","create","edit","approve","export"],common_excel_upload:["view","create"]});
  } else if (role === "Accountant") {
    Object.assign(map,{price_list_management:view,retail_reports:view,common_excel_upload:["view","create"]});
  } else if (role === "HR") {
    Object.assign(map,{price_list_management:view,employee_management:["view","create","edit","manage_users"],retail_reports:view,common_excel_upload:["view","create"]});
  } else if (role === "DMS") {
    Object.assign(map,{price_list_management:view,retail_reports:view,common_excel_upload:["view","create"]});
  } else if (role === "Executive" || role === "Reception") {
    Object.assign(map,{dashboard:view,stock_register:["view","create","edit"],stock_hold_management:["view","create"],quotation_management:["view","create","edit"],price_list_management:view,retail_reports:view});
  } else if (role === "Driver") {
    Object.assign(map,{stock_register:view});
  }
  return selected.filter(m=>ALL_MODULES.includes(m)).map(module=>({
    user_id:userId,module,actions:map[module]||view,granted_by:grantedBy
  }));
}

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
    .from("profiles").select("is_super_admin,status,designation").eq("user_id", callerId).maybeSingle();
  if (profileError || !profile || profile.status !== "active") return json({ error: "Active employee profile required" }, 403);

  const [canManageResult,canCreateResult,canEditResult,canDeleteResult] = await Promise.all([
    callerClient.rpc("has_permission", { p_module: "employee_management", p_action: "manage_users" }),
    callerClient.rpc("has_permission", { p_module: "employee_management", p_action: "create" }),
    callerClient.rpc("has_permission", { p_module: "employee_management", p_action: "edit" }),
    callerClient.rpc("has_permission", { p_module: "employee_management", p_action: "delete" }),
  ]);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const action = String(body.action || "");
  const isRoot = profile.is_super_admin === true;
  const allowed = isRoot
    || (action === "create_employee" && (canCreateResult.data === true || canManageResult.data === true))
    || (["update_employee","deactivate_employee"].includes(action) && (canEditResult.data === true || canManageResult.data === true))
    || (action === "delete_employee" && (canDeleteResult.data === true || canManageResult.data === true))
    || (action === "save_employee_permissions" && canManageResult.data === true);
  const permissionError = canManageResult.error || canCreateResult.error || canEditResult.error || canDeleteResult.error;
  if (permissionError || !allowed) return json({ error: "You do not have the required permission for this employee action." }, 403);
  const ROLE_LEVEL: Record<string,number> = {
    "Super Admin":100,"Admin":90,"General Manager":80,"Manager":70,
    "Accountant":60,"HR":50,"DMS":40,"Executive":30,"Reception":20,"Driver":10
  };
  const callerRole=profile.is_super_admin?"Super Admin":String(profile.designation||"");
  const callerLevel=ROLE_LEVEL[callerRole]??0;
  const isRoot=profile.is_super_admin===true;
  const isAdmin=callerRole==="Admin";
  const {data:callerPermRows,error:callerPermError}=await callerClient
    .from("employee_permissions").select("module,actions").eq("user_id",callerId);
  if(callerPermError)return json({error:"Could not verify your permission limits"},500);
  const callerActions=new Map((callerPermRows||[]).map((r:any)=>[r.module,r.actions||[]]));
  const callerModules=new Set((callerPermRows||[]).filter((r:any)=>(r.actions||[]).includes("view")).map((r:any)=>r.module));
  const canGrantModule=(module:string)=>isRoot||isAdmin||(module==="common_excel_upload"?(callerActions.get(module)||[]).includes("create"):callerModules.has(module));
  if (action === "create_employee") {
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const password = String(body.password || "");
    const role = String(body.designation || "").trim();
    const roles = ["Super Admin","Admin","General Manager","Manager","Accountant","HR","DMS","Executive","Reception","Driver"];
    const departments = Array.isArray(body.department_access) ? [...new Set(body.department_access.map(String))] : [];
    const allowedDepartments = new Set(["Personal","EV","Commercial","LLM"]);
    if (!email || !fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Valid email and full name are required" }, 400);
    if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
    if (!roles.includes(role)) return json({ error: "Select a valid designation / role" }, 400);
    if (role === "Super Admin") return json({ error: "The Super Admin account is unique and cannot be created from New User." }, 403);
    const targetLevel = ROLE_LEVEL[role] ?? 0;
    if (!isRoot && targetLevel >= callerLevel) return json({ error: "You can create only employees below your own designation." }, 403);
    if (!departments.length || departments.some((d: string) => !allowedDepartments.has(d))) return json({ error: "Select valid department access" }, 400);
    const finalDepartments = departments;
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) {
      const code = String((createError as { code?: string })?.code || "");
      const message = code === "email_exists" || /already.*registered|already.*exists/i.test(createError?.message || "")
        ? "આ Emailથી કર્મચારીનું Login પહેલેથી બનાવેલું છે. Employee Directoryમાં તે નામ પર ક્લિક કરીને Edit કરો."
        : (createError?.message || "User creation failed");
      return json({ error: message, code: code || "create_failed" }, code === "email_exists" ? 409 : 400);
    }
    const userId = created.user.id;
    const { error: insertError } = await adminClient.from("profiles").upsert({
      user_id: userId, full_name: fullName, email, employee_code: null, phone: null,
      designation: role, department: finalDepartments[0], department_access: finalDepartments,
      status: "active", is_super_admin: false,
    }, { onConflict: "user_id" });
    if (insertError) { await adminClient.auth.admin.deleteUser(userId); return json({ error: insertError.message }, 400); }

    // New employees receive no workspace/module access until Super Admin assigns it from the Permissions menu.
    if (!isRoot) await adminClient.from("audit_logs").insert({
      actor_id: callerId, actor_email: authData.user.email, module:"employee_management",
      action:"create", action_label:"Created employee account", record_type:"profile", record_id:userId,
      details:{email,designation:role,department_access:finalDepartments},
    });
    return json({success:true,user_id:userId,email,designation:role,department_access:finalDepartments,message:"Employee account created. They can sign in immediately with this email and password."},201);
  }

  if (action === "update_employee") {
    const userId = String(body.user_id || "");
    if (!userId || userId === callerId) return json({ error: "A different employee user_id is required" }, 400);
    const { data: target, error: targetError } = await adminClient.from("profiles")
      .select("user_id,email,is_super_admin,designation").eq("user_id", userId).maybeSingle();
    if (targetError || !target) return json({ error: "Employee not found" }, 404);
    if (target.is_super_admin) return json({ error: "A Super Admin profile cannot be edited here" }, 403);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["full_name","employee_code","phone","designation","department"]) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        patch[key] = body[key] === "" ? null : String(body[key]).trim();
      }
    }
    if (typeof patch.full_name === "string" && !patch.full_name) return json({ error: "Full name cannot be empty" }, 400);
    if (typeof patch.designation === "string" && (!Object.keys(ROLE_MODULES).includes(patch.designation) || patch.designation === "Super Admin")) return json({error:"Select a valid employee role"},400);
    if (typeof patch.phone === "string" && patch.phone && !/^\\d{10}$/.test(patch.phone)) return json({ error: "Mobile number must be exactly 10 digits" }, 400);
    if (typeof patch.department === "string" && patch.department && !["Personal","EV","Commercial","LLM"].includes(patch.department)) return json({ error: "Invalid department" }, 400);
    if (body.department_access !== undefined) {
      const access = Array.isArray(body.department_access) ? body.department_access.map(String) : [];
      const allowedDepartments = new Set(["Personal","EV","Commercial","LLM"]);
      if (access.some((d: string) => !allowedDepartments.has(d))) return json({ error: "Invalid department access" }, 400);
      const finalAccess = [...new Set(access)];
      if (!finalAccess.length) return json({error:"Select at least one department"},400);
      patch.department_access = finalAccess;
      patch.department = finalAccess[0];
    }
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!["active","inactive"].includes(status)) return json({ error: "Status must be active or inactive" }, 400);
      patch.status = status;
    }
    const { error: updateError } = await adminClient.from("profiles").update(patch).eq("user_id", userId);
    if (updateError) return json({ error: updateError.message }, 400);
    // Function permissions are managed only from the dedicated Permissions menu.
    if (body.password !== undefined && String(body.password).length > 0) {
      const newPassword = String(body.password);
      if (newPassword.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
      if (passwordError) return json({ error: "Profile updated but password change failed: " + passwordError.message }, 400);
    }
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
    if (!isRoot) await adminClient.from("audit_logs").insert({
      actor_id: callerId, actor_email: authData.user.email, module: "employee_management",
      action: "edit", action_label: "Updated employee profile",
      record_type: "profile", record_id: userId,
    });
    return json({ success: true, message: "Employee profile updated" });
  }

  if (action === "save_employee_permissions") {
    const userId = String(body.user_id || "");
    if (!userId || userId === callerId) return json({error:"Select another employee"},400);
    const {data:target,error:targetError}=await adminClient.from("profiles").select("user_id,is_super_admin,deleted_at,designation").eq("user_id",userId).maybeSingle();
    if(targetError||!target||target.deleted_at) return json({error:"Active employee not found"},404);
    if(target.is_super_admin) return json({error:"Super Admin permissions cannot be changed"},403);
    const targetLevel=ROLE_LEVEL[String(target.designation||"")]??0;
    if(!isRoot && targetLevel<=callerLevel) return json({error:"You can manage permissions only for employees below your own designation. Your own and higher-level permissions cannot be changed."},403);
    const selected = Array.isArray(body.modules) ? [...new Set(body.modules.map(String))] : [];
    if(selected.some(m=>!ALL_MODULES.includes(m))) return json({error:"Invalid module selected"},400);
    const forbidden=selected.filter((m:string)=>!canGrantModule(m));
    if(forbidden.length) return json({error:"You cannot grant permissions you do not have: "+forbidden.join(", ")},403);
    const {data:targetExisting,error:existingError}=await adminClient.from("employee_permissions").select("module,actions,granted_by").eq("user_id",userId);
    if(existingError) return json({error:existingError.message},500);
    // Preserve modules outside the caller's authority; a manager cannot revoke or grant a higher authority's modules.
    const protectedRows=(targetExisting||[]).filter((r:any)=>!canGrantModule(r.module));
    const {error:clearError}=await adminClient.from("employee_permissions").delete().eq("user_id",userId);
    if(clearError) return json({error:clearError.message},500);
    const rows=[...protectedRows,...rolePermissionRows(String(target.designation||""),userId,callerId,selected)];
    if(rows.length){
      const {error:saveError}=await adminClient.from("employee_permissions").upsert(rows,{onConflict:"user_id,module"});
      if(saveError) return json({error:saveError.message},500);
    }
    if (!isRoot) await adminClient.from("audit_logs").insert({actor_id:callerId,actor_email:authData.user.email,module:"employee_management",action:"edit",action_label:"Updated employee menu permissions",record_type:"profile",record_id:userId,details:{modules:selected}});
    return json({success:true,modules:selected,message:"Employee permissions saved"});
  }

  if (action === "delete_employee") {
    const userId = String(body.user_id || "");
    if (!userId || userId === callerId) return json({ error: "You cannot delete your own account" }, 400);
    const { data: target, error: targetError } = await adminClient.from("profiles")
      .select("user_id,email,is_super_admin,deleted_at").eq("user_id", userId).maybeSingle();
    if (targetError || !target) return json({ error: "Employee not found" }, 404);
    if (target.is_super_admin) return json({ error: "The Super Admin account is protected and cannot be deleted" }, 403);
    if (target.deleted_at) return json({ error: "This employee is already deleted" }, 409);
    const { error: updateError } = await adminClient.from("profiles")
      .update({ status: "inactive", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (updateError) return json({ error: updateError.message }, 400);
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError) return json({ error: "Employee archived but login blocking failed: " + banError.message }, 500);
    const { error: permissionDeleteError } = await adminClient.from("employee_permissions").delete().eq("user_id",userId);
    if (permissionDeleteError) return json({error:"Employee archived but permissions cleanup failed: "+permissionDeleteError.message},500);
    const { error: auditError } = if (!isRoot) await adminClient.from("audit_logs").insert({
      actor_id: callerId, actor_email: authData.user.email, module: "employee_management",
      action: "delete", action_label: "Deleted employee account (archived)",
      record_type: "profile", record_id: userId, details: { email: target.email, method: "soft_delete" },
    });
    if (auditError) return json({ error: "Employee archived, but audit entry failed: " + auditError.message }, 500);
    return json({ success: true, message: "Employee deleted from the active directory. Historical records were preserved." });
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
    if (!isRoot) await adminClient.from("audit_logs").insert({
      actor_id: callerId, actor_email: authData.user.email, module: "employee_management",
      action: "edit", action_label: "Deactivated employee",
      record_type: "profile", record_id: userId, details: { email: target.email },
    });
    return json({ success: true, message: "Employee deactivated" });
  }

  return json({ error: "Unsupported action" }, 400);
});