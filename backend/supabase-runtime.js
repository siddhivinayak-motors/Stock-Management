/* Siddhivinayak Stock Management — Supabase runtime adapter.
   Loaded after the original inline app script. Does not change the existing visual theme.
   Browser key is publishable only; privileged user creation runs server-side. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://tvpaxdvqvwpblcfssgsj.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_F5FN7weZLRv2Q_iovOmchQ_wLTR6r3K';
  const MODULES = {
    Dashboard:'dashboard', 'Stock Register':'stock_register',
    'Stock Hold Management':'stock_hold_management',
    'Price List Management':'price_list_management',
    'Quotation Management':'quotation_management',
    'Employee Management':'employee_management',
    'Common Excel Upload':'common_excel_upload',
    'Backup & Restore':'backup_restore','Audit History':'audit_history',
    'Retail Reports':'retail_reports'
  };
  let client, currentUser, currentProfile, permissions = new Map(), authReady = false;
  const $ = id => document.getElementById(id);
  const notify = msg => { if (typeof window.toast === 'function') window.toast(msg); else console.info(msg); };
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db = () => { if (!client) throw new Error('Supabase client is not ready'); return client; };
  async function call(q) { const {data,error}=await q; if(error) throw error; return data; }
  function has(module,action='view') {
    if(currentProfile?.is_super_admin) return true;
    return (permissions.get(module)||[]).includes(action);
  }
  async function refreshIdentity() {
    const {data:{user},error}=await db().auth.getUser();
    if(error) throw error;
    currentUser=user;
    if(!user){currentProfile=null;permissions.clear();return;}
    const p=await call(db().from('profiles').select('*').eq('user_id',user.id).maybeSingle());
    currentProfile=p;
    const rows=await call(db().from('employee_permissions').select('module,actions').eq('user_id',user.id));
    permissions=new Map(rows.map(x=>[x.module,x.actions||[]]));
    if(!p || p.status!=='active') { await db().auth.signOut(); throw new Error('Your employee account is not active. Contact Admin.'); }
  }
  function showLogin() {
    if($('svAuthGate')) return;
    const el=document.createElement('div');el.id='svAuthGate';
    el.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(15,20,29,.76);display:grid;place-items:center;padding:20px;font-family:inherit';
    el.innerHTML='<div style="width:min(420px,100%);background:#fff;border-radius:16px;padding:28px;box-shadow:0 24px 80px #0005;color:#1d2733"><div style="font-size:20px;font-weight:800;margin-bottom:6px">Siddhivinayak Mahindra</div><div style="color:#6f7c8b;margin-bottom:22px">Stock Management · Secure Login</div><form id="svLoginForm"><label style="display:block;font-weight:650;margin:12px 0 6px">Email address</label><input id="svLoginEmail" type="email" autocomplete="username" required style="width:100%;padding:12px;border:1px solid #dce2e9;border-radius:8px"><label style="display:block;font-weight:650;margin:14px 0 6px">Password</label><input id="svLoginPassword" type="password" autocomplete="current-password" required style="width:100%;padding:12px;border:1px solid #dce2e9;border-radius:8px"><div id="svLoginError" style="color:#c51c2a;font-size:12px;margin:10px 0;min-height:16px"></div><button id="svLoginSubmit" type="submit" style="width:100%;padding:12px;border:0;border-radius:8px;background:#e51e2a;color:#fff;font-weight:750">Sign in</button><button id="svForgotPassword" type="button" style="margin-top:12px;border:0;background:transparent;color:#34404d;text-decoration:underline">Forgot password?</button></form></div>';
    document.body.appendChild(el);
    $('svLoginForm').addEventListener('submit',async e=>{
      e.preventDefault();const btn=$('svLoginSubmit'),err=$('svLoginError');btn.disabled=true;btn.textContent='Signing in…';err.textContent='';
      try {
        const {error}=await db().auth.signInWithPassword({email:$('svLoginEmail').value.trim(),password:$('svLoginPassword').value});
        if(error) throw error;
        await refreshIdentity();el.remove();await startApp();
      } catch(ex){err.textContent=ex.message||'Login failed';}
      finally{btn.disabled=false;btn.textContent='Sign in';}
    });
    $('svForgotPassword').addEventListener('click',async()=>{
      const email=$('svLoginEmail').value.trim();if(!email){$('svLoginError').textContent='Enter your email first.';return;}
      const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      $('svLoginError').textContent=error?error.message:'Password reset email requested.';
    });
  }
  async function startApp() {
    if(!currentUser){showLogin();return;}
    if($('svAuthGate')) $('svAuthGate').remove();
    const label=$('userName')||document.querySelector('.user-name');
    if(label) label.textContent=currentProfile.full_name||currentUser.email;
    document.querySelectorAll('[data-page]').forEach(n=>{
      const page=n.dataset.page||'';
      const m=page.startsWith('stock')?'stock_register':
        page.includes('quotation')?'quotation_management':
        page.includes('price')?'price_list_management':
        page.includes('employee')?'employee_management':null;
      if(m && !has(m,'view')) n.style.display='none';
    });
    await Promise.allSettled([loadHolds(),loadPriceLists(),loadEmployees(),loadAudit()]);
    authReady=true;
  }
  async function signOut() { await db().auth.signOut(); location.reload(); }

  async function loadHolds() {
    if(!has('stock_hold_management','view')) return;
    const rows=await call(db().from('stock_holds').select('*').order('created_at',{ascending:false}));
    window.holdItems=rows;
    if(typeof window.holdRender==='function') window.holdRender();
  }
  async function submitHold() {
    if(!has('stock_hold_management','create')) throw new Error('You do not have permission to submit hold requests.');
    const vehicle=$('holdVehicle').value.trim(),vin=$('holdVin').value.trim(),reason=$('holdReason').value.trim();
    if(!vehicle||!vin||!reason) throw new Error('Vehicle, VIN/Chassis and reason are required');
    await call(db().from('stock_holds').insert({department:$('holdDept').value,vehicle,variant:$('holdVariant').value,vin,executive:$('holdExecutive').value||'Not specified',reason,created_by:currentUser.id}));
    await loadHolds();['holdVehicle','holdVin','holdVariant','holdExecutive','holdReason'].forEach(id=>$(id).value='');notify('Hold request submitted.');
  }
  async function decideHold(id,decision) {
    if(!has('stock_hold_management','approve')) throw new Error('You do not have approval permission.');
    if(!['Approved','Rejected'].includes(decision)) throw new Error('Invalid decision');
    await call(db().from('stock_holds').update({status:decision,approver_id:currentUser.id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('status','Pending'));
    const h=await call(db().from('stock_holds').select('vehicle_id').eq('id',id).single());
    if(h?.vehicle_id) await call(db().from('vehicles').update({stage:decision==='Approved'?'HOLD':'OPEN',updated_by:currentUser.id}).eq('id',h.vehicle_id));
    await loadHolds();await audit('stock_hold_management','approve',decision+' hold','stock_hold',id);
  }
  async function loadPriceLists() {
    if(!has('price_list_management','view')) return;
    const versions=await call(db().from('price_list_versions').select('*').order('published_at',{ascending:false}));
    const by={Personal:[],EV:[],Commercial:[],LLM:[]};
    for(const v of versions){ if(by[v.department]?.length) continue;
      by[v.department]=await call(db().from('price_list_items').select('*').eq('version_id',v.id).order('vehicle'));
    }
    window.plData=by;window.plHistory=versions;
    if(typeof window.plRender==='function') window.plRender();
  }
  async function publishPriceList(rowsByDepartment,sourceFile='') {
    if(!has('price_list_management','create')) throw new Error('No permission to publish price lists.');
    for(const [department,rows] of Object.entries(rowsByDepartment)){
      if(!['Personal','EV','Commercial','LLM'].includes(department)||!rows.length) continue;
      const version=await call(db().from('price_list_versions').insert({version_label:'V'+Date.now(),department,source_file:sourceFile,row_count:rows.length,published_by:currentUser.id}).select().single());
      const payload=rows.map(r=>({version_id:version.id,department,vehicle:r.vehicle,variant:r.variant||'',colour:r.colour||'',ex_showroom:Number(r.exShowroom??r.ex_showroom??0),rto:Number(r.rto||0),other_data:r}));
      await call(db().from('price_list_items').insert(payload));
    }
    await loadPriceLists();await audit('price_list_management','create','Published price list','price_list_version',null);
  }
  async function loadEmployees() {
    if(!has('employee_management','view')&&!currentProfile?.is_super_admin) return;
    const rows=await call(db().from('profiles').select('*').order('full_name'));
    const sel=$('permEmployee');if(sel) sel.innerHTML='<option value="">Select employee</option>'+rows.map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.full_name||x.email)+'</option>').join('');
    window.svEmployees=rows;
  }
  async function savePermissions(userId,module,actions) {
    if(!has('employee_management','manage_users')) throw new Error('Not allowed to manage employee permissions.');
    await call(db().from('employee_permissions').upsert({user_id:userId,module,actions,granted_by:currentUser.id,updated_at:new Date().toISOString()},{onConflict:'user_id,module'}));
    await audit('employee_management','manage_users','Updated employee permissions','employee_permission',userId);
  }
  async function loadAudit() {
    if(!has('audit_history','view')&&!currentProfile?.is_super_admin) return;
    const rows=await call(db().from('audit_logs').select('*').order('created_at',{ascending:false}).limit(500));
    window.svAuditRows=rows;
  }
  async function audit(module,action,label,type=null,id=null,details={}) {
    try { await db().rpc('log_activity',{p_module:module,p_action:action,p_label:label,p_record_type:type,p_record_id:id==null?null:String(id),p_details:details}); } catch(e){console.warn('Audit write failed',e);}
  }
  async function loadVehicles(department='Personal') {
    if(!has('stock_register','view')) throw new Error('No stock view permission.');
    return call(db().from('vehicles').select('*').eq('department',department).order('created_at',{ascending:false}));
  }
  async function saveVehicle(data) {
    if(!has('stock_register','create')) throw new Error('No stock create permission.');
    const clean={...data,created_by:currentUser.id};
    const row=await call(db().from('vehicles').insert(clean).select().single());
    await audit('stock_register','create','Created vehicle','vehicle',row.id,{chassis_number:row.chassis_number});
    return row;
  }
  async function updateVehicle(id,data) {
    if(!has('stock_register','edit')) throw new Error('No stock edit permission.');
    const row=await call(db().from('vehicles').update({...data,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',id).select().single());
    await audit('stock_register','edit','Updated vehicle','vehicle',id);
    return row;
  }
  async function deleteVehicle(id) {
    if(!has('stock_register','delete')) throw new Error('No stock delete permission.');
    await call(db().from('vehicles').delete().eq('id',id));await audit('stock_register','delete','Deleted vehicle','vehicle',id);
  }
  async function saveQuotation(q) {
    if(!has('quotation_management','create')) throw new Error('No quotation create permission.');
    const row=await call(db().from('quotations').insert({
      quote_number:q.no,department:q.department,quote_date:q.date,customer_name:q.customer,phone:q.phone,address:q.address,
      vehicle_count:Number(q.vehicleNos||1),hypo:q.hypo,model:q.model,car_description:q.carDescription,variant:q.variant,colour:q.colour,chassis:q.chassis,
      sales_person:q.salesPerson,contact_person:q.contactPerson,contact_mobile:q.contactMobile,email:q.email,branch_address:q.branchAddress,
      helpline:q.helpline,pan:q.pan,gstin:q.gstin,subtotal:q.subtotal,discount:q.discount,total:q.total,amount_words:q.amountWords,
      terms:q.terms||[],bank_details:q.bank||{},created_by:currentUser.id,updated_by:currentUser.id
    }).select().single());
    if(q.items?.length) await call(db().from('quotation_items').insert(q.items.map((x,i)=>({quotation_id:row.id,line_no:i+1,particulars:x.particulars||x.name||'',amount:Number(x.amount||0),is_discount:!!x.isDiscount}))));
    await audit('quotation_management','create','Saved quotation','quotation',row.id,{quote_number:row.quote_number});
    return row;
  }
  async function loadQuotations(department='Personal') {
    if(!has('quotation_management','view')) throw new Error('No quotation view permission.');
    return call(db().from('quotations').select('*,quotation_items(*)').eq('department',department).order('created_at',{ascending:false}));
  }

  async function init() {
    if(!window.supabase?.createClient) throw new Error('Supabase JavaScript SDK failed to load.');
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    try { await refreshIdentity(); } catch(e){ console.error(e); }
    if(currentUser) await startApp(); else showLogin();
    db().auth.onAuthStateChange(async(_event,session)=>{
      if(!session){currentUser=null;currentProfile=null;permissions.clear();showLogin();return;}
      try{await refreshIdentity();await startApp();}catch(e){console.error(e);showLogin();}
    });
    const logout=$('logoutBtn');if(logout){logout.addEventListener('click',e=>{e.preventDefault();signOut().catch(err=>notify(err.message));},true);}
    const originalHoldRender=window.holdRender;
    window.holdRender=async()=>{try{await loadHolds();if(originalHoldRender)originalHoldRender();}catch(e){console.error(e);notify(e.message);}};
    window.holdSubmit=()=>submitHold().catch(e=>notify(e.message));
    window.holdDecision=(id,decision)=>decideHold(id,decision).catch(e=>notify(e.message));
    window.SVMBackend={client:()=>db(),get user(){return currentUser;},get profile(){return currentProfile;},has,signOut,loadVehicles,saveVehicle,updateVehicle,deleteVehicle,saveQuotation,loadQuotations,publishPriceList,savePermissions,loadEmployees,loadAudit,audit};
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{console.error(e);notify('Backend init failed: '+e.message);showLogin();}),{once:true});
  else init().catch(e=>{console.error(e);notify('Backend init failed: '+e.message);showLogin();});
})();