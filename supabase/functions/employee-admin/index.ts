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
  "Admin": ["dashboard","stock_register","stock_hold_management","price_list_management","quotation_management","otf_management","employee_management","common_excel_upload","audit_history","retail_reports"],
  "General Manager": ["dashboard","stock_register","stock_hold_management","price_list_management","quotation_management","otf_management","employee_management","common_excel_upload","audit_history","retail_reports"],
  "Manager": ["dashboard","stock_register","stock_hold_management","quotation_management","otf_management","employee_management","common_excel_upload","retail_reports"],
  "Accountant": ["stock_register","retail_reports","common_excel_upload","quotation_management","otf_management"],
  "HR": ["stock_register","stock_hold_management","retail_reports","common_excel_upload","quotation_management","otf_management"],
  "DMS": ["stock_register","retail_reports","common_excel_upload","quotation_management","otf_management"],
  "Executive": ["dashboard","stock_register","stock_hold_management","quotation_management","retail_reports","otf_management"],
  "Reception": ["dashboard","stock_register","stock_hold_management","quotation_management","retail_reports","otf_management"],
  "Driver": ["stock_register","stock_hold_management","quotation_management","otf_management"]
};
const ALL_MODULES = ["dashboard","stock_register","stock_hold_management","price_list_management","quotation_management","otf_management","employee_management","common_excel_upload","audit_history","retail_reports"];
function rolePermissionRows(role: string, userId: string, grantedBy: string, selectedModules?: string[]) {
  const selected = selectedModules || [];
  const full = ["view","create","edit","delete","approve","manage_users","export","restore"];
  const view = ["view"];
  const map: Record<string,string[]> = {};
  if (role === "Admin" || role === "General Manager") {
    for (const m of ALL_MODULES) map[m] = [...full];
  } else if (role === "Manager") {
    Object.assign(map,{dashboard:view,stock_register:["view","create","edit","delete","export"],stock_hold_management:["view","create","approve"],quotation_management:["view","create","edit","approve","export"],otf_management:["view","create","edit","approve","delete","export"],employee_management:["view","create","edit","delete","manage_users"],common_excel_upload:["view","create"],price_list_management:view});
  } else if (role === "Accountant") {
    Object.assign(map,{stock_register:view,price_list_management:view,retail_reports:view,common_excel_upload:["view","create"],quotation_management:["view","edit"],otf_management:view});
  } else if (role === "HR") {
    Object.assign(map,{stock_register:view,stock_hold_management:["view","create"],price_list_management:view,retail_reports:view,common_excel_upload:["view","create"],quotation_management:["view","edit"],otf_management:view});
  } else if (role === "DMS") {
    Object.assign(map,{stock_register:view,price_list_management:view,retail_reports:view,common_excel_upload:["view","create"],quotation_management:["view","edit"],otf_management:view});
  } else if (role === "Executive" || role === "Reception") {
    Object.assign(map,{dashboard:view,stock_register:view,stock_hold_management:["view","create"],quotation_management:["view","create","edit"],price_list_management:view,retail_reports:view,otf_management:["view","create","edit"]});
  } else if (role === "Driver") {
    Object.assign(map,{stock_register:view,stock_hold_management:["view","create"],price_list_management:view,quotation_management:["view","edit"],otf_management:view});
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
    .from("profiles").select("is_super_admin,status,designation,department,department_access,city").eq("user_id", callerId).maybeSingle();
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
  const employeeManagerRole = isRoot || ["Admin","General Manager","Manager"].includes(String(profile.designation||""));
  const allowed = isRoot || (employeeManagerRole && (
    (action === "create_employee" && canCreateResult.data === true)
    || (action === "update_employee" && canEditResult.data === true)
    || (action === "deactivate_employee" && canEditResult.data === true)
    || (action === "delete_employee" && canDeleteResult.data === true)
    || (action === "save_employee_permissions" && canManageResult.data === true)
  ));
  const permissionError = canManageResult.error || canCreateResult.error || canEditResult.error || canDeleteResult.error;
  if (permissionError || !allowed) return json({ error: "You do not have the required permission for this employee action." }, 403);
  const ROLE_LEVEL: Record<string,number> = {
    "Super Admin":100,"Admin":90,"General Manager":80,"Manager":70,
    "Accountant":60,"HR":50,"DMS":40,"Executive":30,"Reception":20,"Driver":10
  };
  const callerRole=profile.is_super_admin?"Super Admin":String(profile.designation||"");
  const callerLevel=ROLE_LEVEL[callerRole]??0;
  const isOrgAdmin=isRoot||callerRole==="Admin"||callerRole==="General Manager";
  const callerDepartmentScope=new Set(
    (Array.isArray(profile.department_access)&&profile.department_access.length?profile.department_access:[profile.department].filter(Boolean))
      .map((d:string)=>String(d).toLowerCase())
  );
  const canManageDepartment=(department:string)=>isOrgAdmin||callerDepartmentScope.has(String(department||"").toLowerCase());
  const canManageTargetDepartments=(target:any)=>{
    const targetDepartments=Array.isArray(target.department_access)&&target.department_access.length
      ? target.department_access : [target.department].filter(Boolean);
    if(isOrgAdmin) return true;
    if(callerRole==="Manager"){
      const sameCity=!!profile.city&&String(target.city||"").trim().toLowerCase()===String(profile.city).trim().toLowerCase();
      return sameCity&&targetDepartments.some((d:string)=>callerDepartmentScope.has(String(d).trim().toLowerCase()));
    }
    return targetDepartments.some((d:string)=>callerDepartmentScope.has(String(d).trim().toLowerCase()));
  };
  const {data:callerPermRows,error:callerPermError}=await callerClient
    .from("employee_permissions").select("module,actions").eq("user_id",callerId);
  if(callerPermError)return json({error:"Could not verify your permission limits"},500);
  const callerActions=new Map((callerPermRows||[]).map((r:any)=>[r.module,r.actions||[]]));
  const canGrantModule=(module:string)=>module==="audit_history"
    ? (isRoot||callerRole==="Admin"||callerRole==="General Manager")
    : (isRoot
      || (callerActions.get(module)||[]).includes("view")
      || (module==="common_excel_upload"&&(callerActions.get(module)||[]).includes("create")));
  if (action === "create_employee") {
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const password = String(body.password || "");
    const role = String(body.designation || "").trim();
    const roles = ["Super Admin","Admin","General Manager","Manager","Accountant","HR","DMS","Executive","Reception","Driver"];
    const departments = Array.isArray(body.department_access) ? [...new Set(body.department_access.map(String))] : [];
    const normalizeMobile=(value:unknown)=>{let digits=String(value||"").replace(/\D/g,"");if(digits.length===12&&digits.startsWith("91"))digits=digits.slice(2);else if(digits.length===11&&digits.startsWith("0"))digits=digits.slice(1);return digits;};
    const phone=normalizeMobile(body.phone);
    const city=String(body.city||"").trim();
    const allowedCities=new Set(["Bhavnagar","Amreli","Botad","Rajula"]);
    if(body.phone&&phone.length!==10)return json({error:"Mobile number must be 10 digits. +91 or a leading 0 is accepted."},400);
    if(city&&!allowedCities.has(city))return json({error:"Select a valid city"},400);
    if(callerRole==="Manager"&&(!profile.city||city!==profile.city))return json({error:"A Manager can create employees only in their own city."},403);
    const allowedDepartments = new Set(["Personal","EV","Commercial","LLM"]);
    if (!email || !fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Valid email and full name are required" }, 400);
    if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
    if (!roles.includes(role)) return json({ error: "Select a valid designation / role" }, 400);
    if (role === "Super Admin") return json({ error: "The Super Admin account is unique and cannot be created from New User." }, 403);
    const targetLevel = ROLE_LEVEL[role] ?? 0;
    if (!isRoot && targetLevel >= callerLevel) return json({ error: "You can create only employees below your own designation." }, 403);
    if (!departments.length || departments.some((d: string) => !allowedDepartments.has(d))) return json({ error: "Select valid department access" }, 400);
    const selectedWorkspaceModules = Array.isArray(body.modules) ? [...new Set(body.modules.map(String))] : [];
    if (selectedWorkspaceModules.some(m => !ALL_MODULES.includes(m))) return json({error:"Invalid module selected"},400);
    // Department access automatically includes stock register, stock hold and quotation functions.
    const selectedModules = [...new Set([...selectedWorkspaceModules,...(departments.length?["stock_register","stock_hold_management","quotation_management","otf_management","price_list_management",...(canGrantModule("dashboard")?["dashboard"]:[])]:[])])];
    const forbiddenModules = selectedModules.filter(m => !canGrantModule(m));
    if (forbiddenModules.length) return json({error:"You cannot grant permissions you do not have: "+forbiddenModules.join(", ")},403);
    const selectedShortcuts = Array.isArray(body.dashboard_shortcuts) ? [...new Set(body.dashboard_shortcuts.map(String))] : [];
    const allowedShortcuts = new Set(["quick-access"]);
    if (selectedShortcuts.some(x => !allowedShortcuts.has(x))) return json({error:"Invalid dashboard shortcut"},400);
    if (selectedShortcuts.includes("audit") && !canGrantModule("audit_history")) return json({error:"You cannot grant Audit History shortcut."},403);
    if (!isOrgAdmin && departments.some((d:string)=>!canManageDepartment(d))) return json({error:"You can create employees only in your assigned department."},403);
    if (callerRole==="Manager" && departments.some((d:string)=>!canManageDepartment(d))) return json({error:"A Manager can assign only departments in their own Department Access."},403);
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
      user_id: userId, full_name: fullName, email, employee_code: null, phone: phone||null, city: city||null,
      designation: role, department: finalDepartments[0], department_access: finalDepartments,
      status: "active", is_super_admin: false, dashboard_shortcuts: selectedShortcuts,
    }, { onConflict: "user_id" });
    if (insertError) { await adminClient.auth.admin.deleteUser(userId); return json({ error: insertError.message }, 400); }
    const permissionRows = rolePermissionRows(role,userId,callerId,selectedModules)
      .map((row:any)=>({...row,actions:isRoot?["view","create","edit","delete","approve","manage_users","export","restore"]:row.actions.filter((a:string)=>(callerActions.get(row.module)||[]).includes(a))}))
      .filter((row:any)=>row.actions.length>0);
    if(permissionRows.length){
      const {error:permissionSaveError}=await adminClient.from("employee_permissions").upsert(permissionRows,{onConflict:"user_id,module"});
      if(permissionSaveError){await adminClient.from("profiles").delete().eq("user_id",userId);await adminClient.auth.admin.deleteUser(userId);return json({error:permissionSaveError.message},500);}
    }

    // Department access automatically provisions the department's stock, hold, quotation and price-list view permissions.
    if (!isRoot) await adminClient.from("audit_logs").insert({
      actor_id: callerId, actor_email: authData.user.email, module:"employee_management",
      action:"create", action_label:"Created employee account", record_type:"profile", record_id:userId,
      details:{email,designation:role,department_access:finalDepartments},
    });
    return json({success:true,user_id:userId,email,designation:role,department_access:finalDepartments,modules:selectedModules,dashboard_shortcuts:selectedShortcuts,message:"Employee account created with selected access. They can sign in immediately."},201);
  }

  if (action === "update_employee") {
    const userId = String(body.user_id || "");
    if (!userId || userId === callerId) return json({ error: "A different employee user_id is required" }, 400);
    const { data: target, error: targetError } = await adminClient.from("profiles")
      .select("user_id,email,is_super_admin,designation,department,department_access,city").eq("user_id", userId).maybeSingle();
    if (targetError || !target) return json({ error: "Employee not found" }, 404);
    if (target.is_super_admin) return json({ error: "A Super Admin profile cannot be edited here" }, 403);
    if (!canManageTargetDepartments(target)) return json({error:"You can manage employees only in your assigned department."},403);
    if (!isRoot && (ROLE_LEVEL[String(target.designation||"")]??0)>=callerLevel) return json({error:"You can manage only employees below your own designation."},403);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["full_name","employee_code","phone","city","designation","department"]) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        patch[key] = body[key] === "" ? null : String(body[key]).trim();
      }
    }
    if (typeof patch.full_name === "string" && !patch.full_name) return json({ error: "Full name cannot be empty" }, 400);
    if (typeof patch.designation === "string" && (!Object.keys(ROLE_MODULES).includes(patch.designation) || patch.designation === "Super Admin")) return json({error:"Select a valid employee role"},400);
    if (typeof patch.phone === "string" && patch.phone) {
      const digits=String(patch.phone).replace(/\D/g,"");
      const normalized=digits.length===12&&digits.startsWith("91")?digits.slice(2):digits.length===11&&digits.startsWith("0")?digits.slice(1):digits;
      if(normalized.length!==10)return json({error:"Mobile number must be 10 digits. +91 or a leading 0 is accepted."},400);
      patch.phone=normalized;
    }
    if (typeof patch.city === "string" && patch.city && !["Bhavnagar","Amreli","Botad","Rajula"].includes(patch.city)) return json({error:"Select a valid city"},400);
    if(callerRole==="Manager"&&Object.prototype.hasOwnProperty.call(patch,"city")&&String(patch.city||"").trim()!==String(profile.city||"").trim())return json({error:"A Manager can assign employees only within their own city."},403);
    if (typeof patch.department === "string" && patch.department && !["Personal","EV","Commercial","LLM"].includes(patch.department)) return json({ error: "Invalid department" }, 400);
    if (body.department_access !== undefined) {
      const access = Array.isArray(body.department_access) ? body.department_access.map(String) : [];
      const allowedDepartments = new Set(["Personal","EV","Commercial","LLM"]);
      if (access.some((d: string) => !allowedDepartments.has(d))) return json({ error: "Invalid department access" }, 400);
      const finalAccess = [...new Set(access)];
      if (!finalAccess.length) return json({error:"Select at least one department"},400);
      if (!isOrgAdmin && finalAccess.some((d:string)=>!canManageDepartment(d))) return json({error:"You cannot assign access outside your own department."},403);
      if (callerRole==="Manager" && finalAccess.some((d:string)=>!canManageDepartment(d))) return json({error:"A Manager can assign only departments in their own Department Access."},403);
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
    const {data:target,error:targetError}=await adminClient.from("profiles").select("user_id,is_super_admin,deleted_at,designation,department,department_access,city").eq("user_id",userId).maybeSingle();
    if(targetError||!target||target.deleted_at) return json({error:"Active employee not found"},404);
    if(target.is_super_admin) return json({error:"Super Admin permissions cannot be changed"},403);
    const requestedDepartments=Array.isArray(body.departments)?[...new Set(body.departments.map(String))]:[];
    const validDepartments=new Set(["Personal","EV","Commercial","LLM"]);
    if(requestedDepartments.some((d:string)=>!validDepartments.has(d)))return json({error:"Invalid department selection"},400);
    if(!isOrgAdmin&&requestedDepartments.some((d:string)=>!canManageDepartment(d)))return json({error:"You cannot assign departments outside your own access."},403);
    if(callerRole==="Manager"&&requestedDepartments.some((d:string)=>!canManageDepartment(d)))return json({error:"A Manager can assign only departments in their own Department Access."},403);
    const requestedShortcuts=Array.isArray(body.dashboard_shortcuts)?[...new Set(body.dashboard_shortcuts.map(String))]:[];
    const allowedShortcuts=new Set(["quick-access"]);
    if(requestedShortcuts.some((x:string)=>!allowedShortcuts.has(x)))return json({error:"Invalid dashboard shortcut"},400);
    if(requestedShortcuts.includes("audit")&&!canGrantModule("audit_history"))return json({error:"You cannot grant Audit History shortcut."},403);
    if (!canManageTargetDepartments(target)) return json({error:"You can change permissions only for employees in your assigned department."},403);
    const targetLevel=ROLE_LEVEL[String(target.designation||"")]??0;
    if(!isRoot && targetLevel<=callerLevel) return json({error:"You can manage permissions only for employees below your own designation. Your own and higher-level permissions cannot be changed."},403);
    const requestedModules = Array.isArray(body.modules) ? [...new Set(body.modules.map(String))] : [];
    const selected = [...new Set([...requestedModules,...(requestedDepartments.length?["stock_register","stock_hold_management","quotation_management","otf_management","price_list_management"]:[]),...(requestedDepartments.length&&canGrantModule("dashboard")?["dashboard"]:[])])];
    if(selected.some(m=>!ALL_MODULES.includes(m))) return json({error:"Invalid module selected"},400);
    const forbidden=selected.filter((m:string)=>!canGrantModule(m));
    if(forbidden.length) return json({error:"You cannot grant permissions you do not have: "+forbidden.join(", ")},403);
    const {data:targetExisting,error:existingError}=await adminClient.from("employee_permissions").select("module,actions,granted_by").eq("user_id",userId);
    if(existingError) return json({error:existingError.message},500);
    // Preserve modules outside the caller's authority; a manager cannot revoke or grant a higher authority's modules.
    const protectedRows=(targetExisting||[]).filter((r:any)=>!canGrantModule(r.module));
    const {error:clearError}=await adminClient.from("employee_permissions").delete().eq("user_id",userId);
    if(clearError) return json({error:clearError.message},500);
    const requestedRows=rolePermissionRows(String(target.designation||""),userId,callerId,selected)
      .map((row:any)=>({...row,actions:isRoot?["view","create","edit","delete","approve","manage_users","export","restore"]:row.actions.filter((a:string)=>(callerActions.get(row.module)||[]).includes(a))}))
      .filter((row:any)=>row.actions.length>0);
    const rows=[...protectedRows,...requestedRows];
    if(rows.length){
      const {error:saveError}=await adminClient.from("employee_permissions").upsert(rows,{onConflict:"user_id,module"});
      if(saveError) return json({error:saveError.message},500);
    }
    if (!isRoot) await adminClient.from("audit_logs").insert({actor_id:callerId,actor_email:authData.user.email,module:"employee_management",action:"edit",action_label:"Updated employee menu permissions",record_type:"profile",record_id:userId,details:{modules:selected,departments:requestedDepartments,dashboard_shortcuts:requestedShortcuts}});
    // Publish the profile update last: subscribed employee clients reload only after every permission row is saved.
    const {error:profileUpdateError}=await adminClient.from("profiles").update({
      department:requestedDepartments[0]||null,
      department_access:requestedDepartments,
      dashboard_shortcuts:requestedShortcuts
    }).eq("user_id",userId);
    if(profileUpdateError)return json({error:profileUpdateError.message},500);
    return json({success:true,modules:selected,departments:requestedDepartments,dashboard_shortcuts:requestedShortcuts,message:"Employee access saved"});
  }

  if (action === "delete_employee") {
    const userId = String(body.user_id || "");
    if (!userId || userId === callerId) return json({ error: "You cannot delete your own account" }, 400);
    const { data: target, error: targetError } = await adminClient.from("profiles")
      .select("user_id,email,is_super_admin,deleted_at,designation,department,department_access,city").eq("user_id", userId).maybeSingle();
    if (targetError || !target) return json({ error: "Employee not found" }, 404);
    if (target.is_super_admin) return json({ error: "The Super Admin account is protected and cannot be deleted" }, 403);
    if (!canManageTargetDepartments(target)) return json({error:"You can delete employees only in your assigned department."},403);
    if (!isRoot && (ROLE_LEVEL[String(target.designation||"")]??0)>=callerLevel) return json({error:"You can delete only employees below your own designation."},403);
    if (target.deleted_at) return json({ error: "This employee is already deleted" }, 409);
    const { error: updateError } = await adminClient.from("profiles")
      .update({ status: "inactive", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (updateError) return json({ error: updateError.message }, 400);
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError) return json({ error: "Employee archived but login blocking failed: " + banError.message }, 500);
    const { error: permissionDeleteError } = await adminClient.from("employee_permissions").delete().eq("user_id",userId);
    if (permissionDeleteError) return json({error:"Employee archived but permissions cleanup failed: "+permissionDeleteError.message},500);
    const { error: auditError } = isRoot ? { error: null } : await adminClient.from("audit_logs").insert({
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
      .select("user_id,email,is_super_admin,designation,department,department_access").eq("user_id", userId).maybeSingle();
    if (targetError || !target) return json({ error: "Employee not found" }, 404);
    if (target.is_super_admin) return json({ error: "A Super Admin cannot be deactivated by this action" }, 403);
    if (!canManageTargetDepartments(target)) return json({error:"You can deactivate employees only in your assigned department."},403);
    if (!isRoot && (ROLE_LEVEL[String(target.designation||"")]??0)>=callerLevel) return json({error:"You can deactivate only employees below your own designation."},403);
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