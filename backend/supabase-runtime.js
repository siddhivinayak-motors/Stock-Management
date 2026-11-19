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
    // Keep the app shell intact; enforce module access on the actual view sections.
    const viewMap={
      'view-dashboard':'dashboard','view-stock':'stock_register','view-quotation':'quotation_management',
      'view-quotation-management':'quotation_management','view-stock-import':'common_excel_upload',
      'view-upload':'common_excel_upload','view-stock-hold-central':'stock_hold_management',
      'view-price-list':'price_list_management','view-employees':'employee_management',
      'view-audit':'audit_history','view-reports':'retail_reports','view-backup-restore':'backup_restore'
    };
    Object.entries(viewMap).forEach(([id,module])=>{const node=$(id);if(node)node.style.display=has(module,'view')?'':'none';});
    document.querySelectorAll('[data-page]').forEach(n=>{
      const page=n.dataset.page||'';
      const m=page.startsWith('stock-hold')?'stock_hold_management':
        page==='stock-import'||page==='upload'?'common_excel_upload':
        page.startsWith('stock')?'stock_register':
        page.includes('quotation')?'quotation_management':
        page==='price-list'?'price_list_management':
        page==='employees'?'employee_management':
        page==='audit'?'audit_history':
        page==='reports'?'retail_reports':
        page==='backup-restore'?'backup_restore':
        page==='dashboard'?'dashboard':null;
      if(m) n.style.display=has(m,'view')?'':'none';
    });
    await Promise.allSettled([loadHolds(),loadPriceLists(),loadEmployees(),loadAudit(),loadImportHistory()]);
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
    const {data,error}=await db().from('stock_holds').update({status:decision,approver_id:currentUser.id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('status','Pending').select('id');
    if(error)throw error;
    if(!data?.length)throw new Error('Hold request is no longer pending or was already processed.');
    // Database trigger synchronizes the linked stock vehicle stage atomically.
    await loadHolds();await audit('stock_hold_management','approve',decision+' hold','stock_hold',id);
  }
  async function loadPriceLists() {
    if(!has('price_list_management','view')) return;
    const versions=await call(db().from('price_list_versions').select('*').order('published_at',{ascending:false}));
    const by={Personal:[],EV:[],Commercial:[],LLM:[]};
    for(const v of versions){ if(by[v.department]?.length) continue;
      by[v.department]=(await call(db().from('price_list_items').select('*').eq('version_id',v.id).order('vehicle'))).map(x=>({...x,exShowroom:Number(x.ex_showroom||0),rto:Number(x.rto||0)}));
    }
    window.plData=by;window.plHistory=versions.map(v=>({version:v.version_label,dept:v.department,file:v.source_file||'',date:v.published_at,rows:v.row_count}));
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
    window.svAuditRows=rows; renderAuditRows(rows);
  }
  function renderAuditRows(rows=window.svAuditRows||[]) {
    const view=$('view-audit');if(!view)return;
    const body=view.querySelector('.table-wrap table tbody');if(!body)return;
    const search=(view.querySelector('.toolbar .search input')?.value||'').trim().toLowerCase();
    const actionFilter=view.querySelector('.toolbar select')?.value||'All actions';
    const filtered=rows.filter(r=>{
      const text=[r.actor_email,r.action_label,r.module,r.action,r.record_type,r.record_id,JSON.stringify(r.details||{})].join(' ').toLowerCase();
      return (!search||text.includes(search))&&(actionFilter==='All actions'||String(r.action||'').toUpperCase()===actionFilter);
    });
    body.innerHTML=filtered.length?filtered.map(r=>'<tr><td>'+new Date(r.created_at).toLocaleString()+'</td><td>'+esc(r.actor_email||'—')+'</td><td>—</td><td>'+esc(r.module||'—')+'</td><td>'+esc(String(r.action||'').toUpperCase())+'</td><td>'+esc([r.record_type,r.record_id].filter(Boolean).join(' · ')||'—')+'</td><td><span class="pill green">Recorded</span></td><td>'+esc(r.action_label||'')+' '+esc(JSON.stringify(r.details||{}))+'</td></tr>').join(''):'<tr><td colspan="8" class="empty">No matching activity records.</td></tr>';
    const desc=view.querySelector('.card-desc');if(desc)desc.textContent=filtered.length+' activity records · Supabase audit log';
  }
  function downloadAuditCsv(){
    if(!has('audit_history','export')&&!currentProfile?.is_super_admin){notify('Audit export permission required.');return;}
    const rows=window.svAuditRows||[];
    const cols=['created_at','actor_email','module','action','action_label','record_type','record_id','details'];
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv=[cols.join(','),...rows.map(r=>cols.map(c=>q(typeof r[c]==='object'?JSON.stringify(r[c]):r[c])).join(','))].join('\r\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.href=url;a.download='Siddhivinayak-Audit-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);
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
  async function updateVehicle(id,data,viaImport=false) {
    if(!has('stock_register','edit') && !(viaImport && has('common_excel_upload','create'))) throw new Error('No stock edit permission (or Common Excel Upload permission for exact-match reconciliation).');
    const row=await call(db().from('vehicles').update({...data,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',id).select().single());
    await audit(viaImport?'common_excel_upload':'stock_register',viaImport?'create':'edit',viaImport?'Reconciled vehicle by exact chassis':'Updated vehicle','vehicle',id);
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


  // --- Bind the existing screens and controls to persistent Supabase records ---
  const moduleEnum = (label) => MODULES[label] || label;
  const toQuoteView = (row) => ({
    id:row.id,no:row.quote_number,department:row.department,customer:row.customer_name,phone:row.phone||'',
    vehicle:[row.model,row.variant].filter(Boolean).join(' · '),chassis:row.chassis||'',
    by:row.created_by===currentUser?.id?(currentProfile?.full_name||currentUser.email):'Employee',
    total:Number(row.total||0),subtotal:Number(row.subtotal||0),discount:Number(row.discount||0),
    status:String(row.status||'Pending').toUpperCase(),prints:Number(row.print_count||0),
    date:row.quote_date,items:(row.quotation_items||[]).map(x=>({name:x.particulars,amount:Number(x.amount||0),discount:!!x.is_discount}))
  });
  window.renderQuoteManagement = () => {
    const body=$('quoteManagementRows');if(!body)return;
    body.innerHTML=quoteRecords.map((q,i)=>'<tr><td class="strong">'+esc(q.no)+'</td><td>'+esc(q.customer)+'</td><td>'+esc(q.vehicle)+'</td><td>'+esc(q.department||'')+'</td><td>'+esc(q.by)+'</td><td>'+money(q.total)+'</td><td><span class="pill '+(q.status==='APPROVED'?'green':q.status==='PENDING'?'orange':'red')+'">'+esc(q.status)+'</span></td><td><b>'+Number(q.prints||0)+'</b></td><td><div class="qm-action"><button class="btn small" onclick="printSavedQuote('+i+')">Print</button>'+(q.status==='PENDING'?'<button class="btn small" onclick="approveQuote('+i+')">Approve</button>':'')+'</div></td></tr>').join('');
    $('qmTotal').textContent=quoteRecords.length;
    $('qmPending').textContent=quoteRecords.filter(q=>q.status==='PENDING').length;
    $('qmApproved').textContent=quoteRecords.filter(q=>q.status==='APPROVED').length;
    $('qmPrints').textContent=quoteRecords.reduce((sum,q)=>sum+Number(q.prints||0),0);
  };
  async function reloadQuoteList() {
    if(!has('quotation_management','view')) return;
    const dept=typeof currentQuoteDepartment!=='undefined'?currentQuoteDepartment:'Personal';
    const rows=await loadQuotations(dept);
    quoteRecords=rows.map(toQuoteView);
    if(typeof renderQuoteManagement==='function') renderQuoteManagement();
    if(typeof updateQuoteNumber==='function') updateQuoteNumber();
  }
  window.saveQuote = async (printAfter=false) => {
    try {
      const q=getQuotePayload(); if(!q) return;
      const dept=typeof currentQuoteDepartment!=='undefined'?currentQuoteDepartment:'Personal';
      const model=$('qVehicle').value.trim(),variant=$('qVariant').value.trim();
      const allocatedNumber=await call(db().rpc('next_quote_number'));
      q.no=allocatedNumber;
      if($('quoteNumber'))$('quoteNumber').textContent=allocatedNumber;
      const payload={
        quote_number:allocatedNumber,department:dept,quote_date:$('qDate')?.value||new Date().toISOString().slice(0,10),
        customer_name:q.customer,phone:q.phone,address:$('qAddress')?.value||'',
        vehicle_count:Number($('qVehicleNos')?.value||1),hypo:$('qHypo')?.value||'',
        model,car_description:$('qCarDesc')?.value||'',variant,colour:$('qColour')?.value||'',
        chassis:q.chassis,sales_person:$('qSalesPerson')?.value||'',
        contact_person:$('qContactPerson')?.value||'',contact_mobile:$('qContactMobile')?.value||'',
        email:$('qEmail')?.value||'',branch_address:$('qBranchAddress')?.value||'',
        helpline:$('qHelpline')?.value||'',pan:$('qPan')?.value||'',gstin:$('qGstin')?.value||'',
        subtotal:q.subtotal,discount:q.discount,total:q.total,
        amount_words:$('qAmountWords')?.textContent||'',created_by:currentUser.id,updated_by:currentUser.id
      };
      const saved=await call(db().from('quotations').insert(payload).select().single());
      const itemRows=q.items.map((x,i)=>({quotation_id:saved.id,line_no:i+1,particulars:x.name,amount:x.amount,is_discount:x.discount}));
      if(itemRows.length) await call(db().from('quotation_items').insert(itemRows));
      await audit('quotation_management','create','Saved quotation','quotation',saved.id,{quote_number:q.no});
      await reloadQuoteList();
      notify('Quotation saved to Supabase.');
      if(printAfter) window.printSavedQuote(quoteRecords.findIndex(x=>x.id===saved.id));
    } catch(e){console.error(e);notify(e.message||'Could not save quotation.');}
  };
  window.saveRecords = () => {}; // Quotation records now live in Supabase, not localStorage.
  window.loadDepartmentQuotes = () => { reloadQuoteList().catch(e=>{console.error(e);notify(e.message);}); };
  window.approveQuote = async (i) => {
    try{
      const q=quoteRecords[i];if(!q?.id) return;
      if(!has('quotation_management','approve')) throw new Error('You do not have approval permission.');
      const {data,error}=await db().from('quotations').update({status:'Approved',approved_by:currentUser.id,approved_at:new Date().toISOString(),updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',q.id).eq('status','Pending').select('id');
      if(error)throw error;
      if(!data?.length)throw new Error('Quotation is not pending or was already approved.');
      await audit('quotation_management','approve','Approved quotation','quotation',q.id);
      await reloadQuoteList();notify('Quotation approved.');
    }catch(e){notify(e.message);}
  };
  window.printSavedQuote = async (i) => {
    try{
      const q=quoteRecords[i];if(!q) return;
      if(q.id){
        q.prints=Number(await call(db().rpc('increment_quotation_print_count',{p_quotation_id:q.id}))||0);
        if(typeof renderQuoteManagement==='function') renderQuoteManagement();
      }
      printQuoteDocument(q);
    }catch(e){notify(e.message);}
  };
  window.plPublish = async () => {
    try{
      if(!plPending){notify('Preview a price list first');return;}
      if(plPending.duplicates.length&&!confirm('Duplicate entries exist. Continue publishing?')) return;
      if(!confirm('Publish '+plPending.rows.length+' price list rows to Supabase?')) return;
      const grouped={};
      for(const [dept,rows] of Object.entries(plPending.byDept)) grouped[dept]=rows;
      await publishPriceList(grouped,plPending.files.join(', '));
      plPending=null;
      if($('plPreviewMsg')) $('plPreviewMsg').style.display='none';
      notify('Price list published to Supabase.');
    }catch(e){console.error(e);notify(e.message);}
  };
  window.stockImportCommit = async () => {
    try{
      if(!Array.isArray(stockPreviewRows)||!stockPreviewRows.length){notify('Preview a report first');return;}
      if(!has('common_excel_upload','create')&&!has('stock_register','create')) throw new Error('You do not have import permission.');
      const ready=stockPreviewRows.filter(x=>x.decision==='Import');
      if(!ready.length){notify('No importable rows.');return;}
      const file=$('stockReportFile')?.files?.[0];
      const vins=ready.map(x=>x.vin).filter(Boolean);
      const existingSet=new Set();
      for(let i=0;i<vins.length;i+=300){
        const found=await call(db().from('vehicles').select('chassis_number').in('chassis_number',vins.slice(i,i+300)));
        found.forEach(x=>existingSet.add(String(x.chassis_number||'').toLowerCase()));
      }
      const toImport=ready.filter(x=>!existingSet.has(String(x.vin||'').toLowerCase()));
      const dbDuplicates=ready.length-toImport.length;
      if(!toImport.length){notify('All importable VINs already exist in the database.');return;}
      if(!confirm('Import '+toImport.length+' new stock rows into Supabase? '+dbDuplicates+' existing chassis duplicates will be skipped.')) return;
      const records=toImport.map(x=>{
        const r=x.raw||{};
        const inv=plHeader(r,['oem invoicedate','oeminvoicedate','invoicedate']);
        let invoice=null;
        if(inv instanceof Date) invoice=inv.toISOString().slice(0,10);
        else if(inv && !isNaN(Date.parse(inv))) invoice=new Date(inv).toISOString().slice(0,10);
        return {
          department:x.department,chassis_number:x.vin,model:x.model||'Unknown',variant:x.variant||'',
          excel_number:String(plHeader(r,['excelnumber','excelno'])||''),
          seating:String(plHeader(r,['seating','seat'])||''),
          colour:String(plHeader(r,['colour','color'])||''),
          manufacturing_year:Number(plHeader(r,['manufacturingyear','mfgyear','year'])||0)||null,
          oem_invoice_date:invoice,
          engine_number:String(plHeader(r,['enginenumber','engine'])||''),
          sc_name:String(plHeader(r,['scname','salesconsultant'])||''),
          customer_name:String(plHeader(r,['customername','customer'])||''),
          status:'Received / In Stock',stage:'OPEN',source:'stock_report_import',
          imported_at:new Date().toISOString(),created_by:currentUser.id
        };
      });
      let importedCount=0;
      for(let i=0;i<records.length;i+=300){
        const {data,error}=await db().from('vehicles').insert(records.slice(i,i+300)).select('id');
        if(error)throw error;
        importedCount+=data.length;
      }
      await call(db().from('stock_import_batches').insert({file_name:file?.name||'Stock Import',department:null,imported_rows:importedCount,skipped_rows:stockPreviewRows.length-importedCount,error_rows:0,created_by:currentUser.id}));
      await audit('common_excel_upload','create','Imported stock report','stock_import_batch',null,{count:importedCount,database_duplicates:dbDuplicates,file:file?.name||''});
      stockPreviewRows=[];await renderStock();await loadImportHistory();
      notify(importedCount+' vehicles imported; '+dbDuplicates+' existing VIN duplicates skipped.');
    }catch(e){console.error(e);notify(e.message);}
  };
  async function renderStock(){
    if(!$('stockTable')) return;
    try{
      const dept=typeof currentStockDepartment!=='undefined'?currentStockDepartment:'Personal';
      const canEdit=has('stock_register','edit'),canDelete=has('stock_register','delete');
      let rows=await loadVehicles(dept);
      const search=($('stockSearch')?.value||'').trim().toLowerCase();
      const stageFilter=$('view-stock')?.querySelector('.toolbar select')?.value||'All stages and statuses';
      if(search) rows=rows.filter(v=>[v.chassis_number,v.model,v.variant,v.colour,v.sc_name,v.customer_name,v.status,v.stage].some(x=>String(x||'').toLowerCase().includes(search)));
      if(stageFilter!=='All stages and statuses') rows=rows.filter(v=>v.stage===stageFilter||v.status===stageFilter);
      const body=$('stockTable').querySelector('tbody');
      body.innerHTML=rows.length?rows.map(v=>'<tr data-stock-id="'+esc(v.id)+'"><td>'+esc(v.chassis_number)+'</td><td>'+esc([v.model,v.variant].filter(Boolean).join(' / '))+'</td><td>'+esc(v.seating||'—')+'</td><td>'+esc(v.colour||'—')+'</td><td>'+esc(v.manufacturing_year||'—')+'</td><td>'+esc(v.oem_invoice_date||'—')+'</td><td>'+(v.oem_invoice_date?Math.max(0,Math.floor((Date.now()-new Date(v.oem_invoice_date).getTime())/86400000))+' days':'—')+'</td><td>'+esc(v.sc_name||'—')+'</td><td>'+esc(v.customer_name||'—')+'</td><td>'+esc(v.status)+'</td><td>'+esc(v.stage)+'</td><td>'+(canEdit?'<button class="btn small" data-stock-edit="'+esc(v.id)+'">Edit</button> ':'')+(canDelete?'<button class="btn small" data-stock-delete="'+esc(v.id)+'">Delete</button>':'')+'</td></tr>').join(''):'<tr><td colspan="12" class="empty">No stock records yet.</td></tr>';
      body.querySelectorAll('[data-stock-edit]').forEach(b=>b.onclick=()=>editVehicleDialog(rows.find(x=>x.id===b.dataset.stockEdit)));
      body.querySelectorAll('[data-stock-delete]').forEach(b=>b.onclick=async()=>{
        if(!confirm('Delete this stock vehicle? This action is permanent.'))return;
        try{await deleteVehicle(b.dataset.stockDelete);await renderStock();notify('Vehicle deleted.');}catch(e){notify(e.message);}
      });
      const head=$('stockTable').querySelector('thead tr');
      if(head&&head.children.length===11){const th=document.createElement('th');th.textContent='Actions';head.appendChild(th);}
    }catch(e){console.error(e);notify(e.message);}
  }
  function editVehicleDialog(vehicle){
    if(!vehicle)return;
    const existing=$('svVehicleDialog');if(existing)existing.remove();
    const labels={chassis_number:'Chassis Number',excel_number:'Excel Number',model:'Model',variant:'Variant',seating:'Seating',colour:'Colour',manufacturing_year:'Manufacturing Year',oem_invoice_date:'OEM Invoice Date',engine_number:'Engine Number',sc_name:'SC Name',customer_name:'Customer Name',status:'Status',stage:'Stage',place:'Place'};
    const wrap=document.createElement('div');wrap.id='svVehicleDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99990;background:#15202dcc;display:grid;place-items:center;padding:18px';
    const fields=Object.entries(labels).map(([k,label])=>'<label style="display:block;font-size:12px;font-weight:650">'+label+'<input class="field" name="'+k+'" value="'+esc(vehicle[k]??'')+'" '+(k==='chassis_number'?'readonly':'')+'></label>').join('');
    wrap.innerHTML='<form id="svVehicleEditForm" style="width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;padding:24px;border-radius:14px;color:#253140"><div style="font-size:18px;font-weight:850;margin-bottom:14px">Edit Stock Vehicle</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">'+fields+'</div><div id="svVehicleEditError" style="color:#c51c2a;margin:8px 0;font-size:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svVehicleEditCancel" class="btn">Cancel</button><button type="submit" class="btn primary">Save Changes</button></div></form>';
    document.body.appendChild(wrap);
    $('svVehicleEditCancel').onclick=()=>wrap.remove();
    $('svVehicleEditForm').onsubmit=async e=>{
      e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;
      try{
        const values=Object.fromEntries(new FormData(e.target).entries());
        if(values.manufacturing_year)values.manufacturing_year=Number(values.manufacturing_year);else values.manufacturing_year=null;
        Object.keys(values).forEach(k=>{if(values[k]==='')values[k]=null;});
        await updateVehicle(vehicle.id,values);wrap.remove();await renderStock();notify('Stock vehicle updated.');
      }catch(ex){$('svVehicleEditError').textContent=ex.message;button.disabled=false;}
    };
  }
  function mapStockForm(){
    const form=$('vehicleForm');if(!form) return;
    const fields=[...form.querySelectorAll('.form-grid .field input, .form-grid .field select, .form-grid .field textarea')];
    const names=['chassis_number','excel_number','model','variant','seating','colour','manufacturing_year','oem_invoice_date','engine_number','sc_name','customer_name','status','stage','place'];
    fields.forEach((el,i)=>{if(names[i])el.dataset.backendField=names[i];});
    const save=form.querySelector('button.primary');
    if(save) save.addEventListener('click',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      try{
        const obj={department:currentStockDepartment||'Personal'};
        fields.forEach(el=>{const k=el.dataset.backendField;if(k)obj[k]=el.value||null;});
        if(!obj.chassis_number||!obj.model) throw new Error('Chassis Number and Model are required.');
        if(obj.manufacturing_year)obj.manufacturing_year=Number(obj.manufacturing_year);
        await saveVehicle(obj);form.style.display='none';form.querySelectorAll('input').forEach(x=>x.value='');await renderStock();notify('Vehicle saved to Supabase.');
      }catch(ex){notify(ex.message);}
    },true);
  }
  async function createEmployee(fields){
    if(!has('employee_management','manage_users')) throw new Error('You do not have Manage Users permission.');
    const {data:{session}}=await db().auth.getSession();
    const {data,error}=await db().functions.invoke('employee-admin',{body:{action:'create_employee',...fields},headers:{Authorization:'Bearer '+session.access_token}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    await loadEmployees();return data;
  }
  function editEmployeeDialog(profile){
    const old=$('svEmployeeDialog');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='svEmployeeDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99990;background:#15202dcc;display:grid;place-items:center;padding:18px';
    const input=(name,label,value)=>'<label>'+label+'<input name="'+name+'" class="field" value="'+esc(value||'')+'"></label>';
    wrap.innerHTML='<form id="svEmployeeForm" style="width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;padding:24px;border-radius:14px;color:#253140"><div style="font-size:18px;font-weight:850;margin-bottom:14px">Edit Employee</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+input('full_name','Full Name',profile.full_name)+input('email_display','Email (read only)',profile.email)+input('employee_code','Employee Code',profile.employee_code)+input('phone','Mobile',profile.phone)+input('designation','Designation',profile.designation)+input('department','Department',profile.department)+'</div><p style="font-size:12px;color:#6f7c8b">Email address and login identity cannot be changed here.</p><div id="svEmployeeError" style="color:#c51c2a;margin:8px 0;font-size:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svEmployeeCancel" class="btn">Cancel</button><button class="btn primary" type="submit">Save Changes</button></div></form>';
    document.body.appendChild(wrap);
    const email=wrap.querySelector('[name=email_display]');email.readOnly=true;
    $('svEmployeeCancel').onclick=()=>wrap.remove();
    $('svEmployeeForm').onsubmit=async e=>{
      e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;
      try{
        const fd=new FormData(e.target);const fields=Object.fromEntries(fd.entries());delete fields.email_display;
        const {data:{session}}=await db().auth.getSession();
        const {data,error}=await db().functions.invoke('employee-admin',{body:{action:'update_employee',user_id:profile.user_id,...fields},headers:{Authorization:'Bearer '+session.access_token}});
        if(error)throw error;if(data?.error)throw new Error(data.error);
        wrap.remove();await renderEmployees();notify('Employee updated.');
      }catch(ex){$('svEmployeeError').textContent=ex.message;button.disabled=false;}
    };
  }
  function employeeDialog(){
    const old=$('svEmployeeDialog');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='svEmployeeDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99990;background:#15202dcc;display:grid;place-items:center;padding:18px';
    wrap.innerHTML='<form id="svEmployeeForm" style="width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;padding:24px;border-radius:14px;color:#253140"><div style="font-size:18px;font-weight:850;margin-bottom:14px">Create Employee Login</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>Full Name<input required name="full_name" class="field"></label><label>Email<input required type="email" name="email" class="field"></label><label>Employee Code<input name="employee_code" class="field"></label><label>Mobile<input name="phone" class="field"></label><label>Designation<input name="designation" class="field"></label><label>Department<input name="department" class="field"></label></div><p style="font-size:12px;color:#6f7c8b">An invitation email will be sent. Employee creates their own password using that link.</p><div id="svEmployeeError" style="color:#c51c2a;margin:8px 0;font-size:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svEmployeeCancel" class="btn">Cancel</button><button class="btn primary" type="submit">Send Invite</button></div></form>';
    document.body.appendChild(wrap);
    $('svEmployeeCancel').onclick=()=>wrap.remove();
    $('svEmployeeForm').onsubmit=async e=>{
      e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;
      try{
        const fd=new FormData(e.target);const fields=Object.fromEntries(fd.entries());
        const result=await createEmployee(fields);wrap.remove();notify('Invitation sent to '+result.email);await renderEmployees();
      }catch(ex){$('svEmployeeError').textContent=ex.message;button.disabled=false;}
    };
  }
  async function loadImportHistory(){
    if(!has('common_excel_upload','view'))return;
    const rows=await call(db().from('stock_import_batches').select('*').order('created_at',{ascending:false}).limit(500));
    const body=$('view-upload')?.querySelector('.table-wrap tbody');if(!body)return;
    body.innerHTML=rows.length?rows.map(r=>'<tr><td>'+esc(r.file_name)+'</td><td>Imported</td><td>'+Number(r.imported_rows||0)+'</td><td>'+Number(r.imported_rows||0)+'</td><td>'+Number(r.skipped_rows||0)+'</td><td>'+Number(r.error_rows||0)+'</td><td>'+new Date(r.created_at).toLocaleString()+'</td><td>—</td></tr>').join(''):'<tr><td colspan="8" class="empty">No import history yet.</td></tr>';
  }
  async function previewReconciliation(){
    const panel=$('view-upload');if(!panel)return;
    if(!has('common_excel_upload','create'))throw new Error('You do not have reconciliation import permission.');
    const fields=panel.querySelectorAll('.form-grid .field');
    const source=fields[0]?.value||'Tally Main Stock',department=fields[1]?.value||'Personal',file=fields[2]?.files?.[0];
    if(!file)throw new Error('Select a reconciliation workbook.');
    const rows=await readWorkbook(file);
    const existing=await call(db().from('vehicles').select('id,chassis_number,model,variant,stage,status').eq('department',department));
    const byVin=new Map(existing.map(x=>[String(x.chassis_number||'').toLowerCase(),x]));
    const normalized=rows.map(r=>{
      const vin=String(plHeader(r,['chassisnumber','chassis number','vin'])||'').trim();
      const matched=vin?byVin.get(vin.toLowerCase()):null;
      return {vin,matched,raw:r,decision:!vin?'Manual Review — missing full chassis':matched?'Matched':'Stock Arrange — unmatched chassis'};
    });
    let preview=$('svReconcilePreview');
    if(!preview){preview=document.createElement('div');preview.id='svReconcilePreview';preview.className='notice';panel.querySelector('.card .card-body')?.appendChild(preview);}
    preview.dataset.source=source;preview.dataset.department=department;preview.dataset.file=file.name;
    preview._rows=normalized;
    preview.innerHTML='<b>'+esc(source)+' · '+esc(department)+'</b> · Rows '+normalized.length+' · Matched '+normalized.filter(x=>x.matched).length+' · Unmatched/manual review '+normalized.filter(x=>!x.matched).length+'<div style="margin-top:10px;max-height:300px;overflow:auto"><table class="data-table"><thead><tr><th>Full Chassis</th><th>Current Model</th><th>Workbook Model</th><th>Decision</th></tr></thead><tbody>'+normalized.map(x=>'<tr><td>'+esc(x.vin||'—')+'</td><td>'+esc(x.matched?.model||'—')+'</td><td>'+esc(plHeader(x.raw,['model','vehicle'])||'—')+'</td><td>'+esc(x.decision)+'</td></tr>').join('')+'</tbody></table></div><button type="button" id="svReconcileCommit" class="btn primary" style="margin-top:10px">Apply exact chassis matches</button>';
    $('svReconcileCommit').onclick=async()=>{
      try{
        if(!confirm('Apply '+normalized.filter(x=>x.matched).length+' exact full chassis matches to '+source+' rows? Unmatched rows will not change stock.'))return;
        let updated=0;
        for(const item of normalized){
          if(!item.matched)continue;
          const p=item.raw, patch={};
          const model=plHeader(p,['model','vehicle']),variant=plHeader(p,['variant']);
          const colour=plHeader(p,['colour','color']),customer=plHeader(p,['customername','customer']);
          if(model)patch.model=String(model).trim();
          if(variant)patch.variant=String(variant).trim();
          if(colour)patch.colour=String(colour).trim();
          if(customer)patch.customer_name=String(customer).trim();
          if(Object.keys(patch).length){await updateVehicle(item.matched.id,patch,true);updated++;}
        }
        await call(db().from('stock_import_batches').insert({file_name:file.name,department,imported_rows:updated,skipped_rows:normalized.length-updated,error_rows:0,created_by:currentUser.id}));
        await audit('common_excel_upload','create','Applied exact chassis reconciliation','stock_import_batch',null,{source,department,updated,rows:normalized.length});
        await loadImportHistory();await renderStock();notify(updated+' exact chassis matches updated. Unmatched rows remain unchanged.');
      }catch(e){notify(e.message);}
    };
    return {rows:normalized.length,matched:normalized.filter(x=>x.matched).length};
  }

  async function renderEmployees(){
    if(!has('employee_management','view')&&!currentProfile?.is_super_admin) return;
    const rows=await call(db().from('profiles').select('*').order('full_name'));
    const section=$('view-employees');if(!section)return;
    const table=section.querySelector('.card .table-wrap tbody');
    if(table) table.innerHTML=rows.length?rows.map(p=>'<tr><td>'+esc(p.full_name)+'</td><td>'+esc(p.email)+'<br>'+esc(p.phone||'')+'</td><td>'+esc(p.designation||'—')+'</td><td>'+esc(p.department||'—')+'</td><td>'+esc(p.status)+'</td><td>'+new Date(p.created_at).toLocaleDateString()+'</td><td>'+(p.is_super_admin?'Super Admin':(p.status==='active'?'<button class="btn small" data-edit="'+esc(p.user_id)+'">Edit</button> <button class="btn small" data-deactivate="'+esc(p.user_id)+'">Deactivate</button>':'Inactive'))+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">No employees yet.</td></tr>';
    table?.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>{
      const p=rows.find(x=>x.user_id===btn.dataset.edit);if(!p)return;
      editEmployeeDialog(p);
    }));
    table?.querySelectorAll('[data-deactivate]').forEach(btn=>btn.addEventListener('click',async()=>{
      if(!confirm('Deactivate this employee login?'))return;
      try{const {data:{session}}=await db().auth.getSession();const {data,error}=await db().functions.invoke('employee-admin',{body:{action:'deactivate_employee',user_id:btn.dataset.deactivate},headers:{Authorization:'Bearer '+session.access_token}});if(error)throw error;if(data?.error)throw new Error(data.error);await renderEmployees();notify('Employee deactivated.');}catch(ex){notify(ex.message);}
    }));
    const countEl=section.querySelector('.stat-grid .stat-value');if(countEl)countEl.textContent=rows.length;
  }
  async function renderPermissions(){
    if(!has('employee_management','view')&&!currentProfile?.is_super_admin)return;
    const employee=$('permEmployee')?.value,tbody=$('permRows');if(!tbody)return;
    if(!employee){tbody.innerHTML='<tr><td colspan="3">Select an employee to view permissions.</td></tr>';return;}
    const rows=await call(db().from('employee_permissions').select('*').eq('user_id',employee));
    const selectedModule=moduleEnum($('permModule')?.value);
    const current=rows.find(x=>x.module===selectedModule);
    const allowed=new Set(current?.actions||[]);
    document.querySelectorAll('#permChecks input').forEach(x=>{x.checked=allowed.has(x.value);});
    tbody.innerHTML=rows.length?rows.map(x=>'<tr><td>'+esc(employee)+'</td><td>'+esc(x.module)+'</td><td>'+esc((x.actions||[]).join(', '))+'</td></tr>').join(''):'<tr><td colspan="3">No permissions assigned.</td></tr>';
  }
  window.permSave = async () => {
    try{
      const user=$('permEmployee')?.value,module=moduleEnum($('permModule')?.value);
      const actions=[...document.querySelectorAll('#permChecks input:checked')].map(x=>x.value);
      if(!user)throw new Error('Select an employee.');
      await savePermissions(user,module,actions);
      await renderPermissions();notify('Permissions saved to Supabase.');
    }catch(e){notify(e.message);}
  };
  window.permRender=()=>{renderPermissions().catch(e=>notify(e.message));};
  window.holdRender = async () => {
    try{
      const rows=await call(db().from('stock_holds').select('*').order('created_at',{ascending:false}));
      holdItems=rows.map(x=>({...x,id:x.id,date:x.created_at,dept:x.department,approver:x.approver_id||'—',approvedAt:x.approved_at||'—'}));
      const f=$('holdStatusFilter')?.value||'All',d=$('holdDeptFilter')?.value||'All Departments';
      const filtered=holdItems.filter(x=>(f==='All'||x.status===f||(f==='On Hold'&&x.status==='Approved'))&&(d==='All Departments'||x.dept===d));
      $('holdRows').innerHTML=filtered.length?filtered.map(x=>'<tr><td>'+new Date(x.date).toLocaleDateString()+'</td><td>'+esc(x.dept)+'</td><td>'+esc(x.vehicle)+'</td><td>'+esc(x.variant||'—')+'</td><td>'+esc(x.vin)+'</td><td>'+esc(x.executive||'—')+'</td><td>'+esc(x.reason)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.approver)+'<br>'+esc(x.approvedAt)+'</td><td>'+(x.status==='Pending'?'<button class="btn small" data-hold-approve="'+esc(x.id)+'">Approve</button> <button class="btn small" data-hold-reject="'+esc(x.id)+'">Reject</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="10">No matching requests.</td></tr>';
      $('holdPendingCount').textContent=rows.filter(x=>x.status==='Pending').length;
      $('holdApprovedCount').textContent=rows.filter(x=>x.status==='Approved').length;
      $('holdRejectedCount').textContent=rows.filter(x=>x.status==='Rejected').length;
      $('holdOnCount').textContent=rows.filter(x=>x.status==='Approved').length;
      $('holdRows').querySelectorAll('[data-hold-approve]').forEach(b=>b.onclick=()=>decideHold(b.dataset.holdApprove,'Approved').catch(e=>notify(e.message)));
      $('holdRows').querySelectorAll('[data-hold-reject]').forEach(b=>b.onclick=()=>decideHold(b.dataset.holdReject,'Rejected').catch(e=>notify(e.message)));
    }catch(e){console.error(e);notify(e.message);}
  };
  window.holdSubmit = () => submitHold().catch(e=>notify(e.message));
  window.holdDecision = (id,decision) => decideHold(id,decision).catch(e=>notify(e.message));
  window.openDepartmentStock = (department) => {
    currentStockDepartment=department||'Personal';
    if($('stockPageTitle'))$('stockPageTitle').textContent=currentStockDepartment+' — Stock Register';
    if($('stockPageSubtitle'))$('stockPageSubtitle').textContent=currentStockDepartment+' · Live operational workspace';
    if(typeof window.showPage==='function')window.showPage('stock');
    renderStock();
  };
  window.appBackup = async () => {
    try{
      if(!has('backup_restore','export'))throw new Error('Backup permission required.');
      const tables=['vehicles','quotations','quotation_items','price_list_versions','price_list_items','stock_holds','stock_import_batches'];
      const payload={format:'SVM-SUPABASE-BACKUP',version:1,createdAt:new Date().toISOString(),project:'tvpaxdvqvwpblcfssgsj',data:{}};
      for(const t of tables){
        let all=[],from=0,chunk=1000;
        while(true){
          const part=await call(db().from(t).select('*').order('id').range(from,from+chunk-1));
          all=all.concat(part);
          if(part.length<chunk)break;
          from+=chunk;
        }
        payload.data[t]=all;
      }
      const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      a.href=url;a.download='Siddhivinayak-Supabase-Backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
      await audit('backup_restore','export','Downloaded database backup');
    }catch(e){notify(e.message);}
  };
  window.appRestore = async () => {
    try{
      if(!has('backup_restore','restore'))throw new Error('Restore permission required.');
      const file=$('backupFile')?.files?.[0];if(!file)throw new Error('Select a backup JSON file.');
      const payload=JSON.parse(await file.text());
      if(payload.format!=='SVM-SUPABASE-BACKUP'||!payload.data)throw new Error('Invalid backup format.');
      if(!confirm('Restore records from this backup? Existing rows with matching IDs may be updated.'))return;
      const order=['vehicles','quotations','quotation_items','price_list_versions','price_list_items','stock_holds','stock_import_batches'];
      for(const t of order){const rows=payload.data[t]||[];if(rows.length)await call(db().from(t).upsert(rows));}
      await audit('backup_restore','restore','Restored operational backup');
      notify('Operational data restore completed.');
    }catch(e){notify(e.message);}
  };
  window.resetAllExceptEmployees = () => notify('For safety, operational reset is disabled until a server-side, audited reset workflow is configured.');
  async function loadRetailReport(){
    // Retail Date is a separate sales event. OEM Invoice Date is not a valid substitute.
    if($('retailRows'))$('retailRows').innerHTML='<tr><td colspan="7" class="empty">Retail sales date data is not yet connected. This report is disabled rather than using OEM invoice dates as retail dates.</td></tr>';
    const cards=$('view-reports')?.querySelectorAll('.retail-kpi strong');
    cards?.forEach(x=>x.textContent='—');
    notify('Retail reporting needs an approved retail-sale source and retail date field.');
  }
  window.applyRetailMonth=()=>loadRetailReport();

  // UI bindings for existing elements whose original handlers were demo-only.
  function installScreenHooks(){
    mapStockForm();
    const newUser=$('view-employees')?.querySelector('.stat-grid .btn.primary');
    if(newUser)newUser.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();employeeDialog();},true);
    $('permEmployee')?.addEventListener('change',()=>renderPermissions().catch(e=>notify(e.message)));
    $('permModule')?.addEventListener('change',()=>renderPermissions().catch(e=>notify(e.message)));
    const uploadView=$('view-upload');
    if(uploadView){
      const gen=uploadView.querySelector('.card .card-body button.btn.primary');
      if(gen)gen.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();previewReconciliation().catch(x=>notify(x.message));},true);
    }
    $('saveQuote')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.saveQuote(false);},true);
    $('savePrintQuote')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.saveQuote(true);},true);
    const auditView=$('view-audit');
    if(auditView){
      const toolbar=auditView.querySelector('.toolbar');
      const search=toolbar?.querySelector('.search input'),actionSelect=toolbar?.querySelector('select');
      search?.addEventListener('input',()=>renderAuditRows());
      actionSelect?.addEventListener('change',()=>renderAuditRows());
      const buttons=toolbar?.querySelectorAll('button')||[];
      if(buttons[0])buttons[0].addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();downloadAuditCsv();},true);
      if(buttons[1])buttons[1].addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.print();},true);
    }
    $('holdStatusFilter')?.addEventListener('change',()=>window.holdRender());
    $('holdDeptFilter')?.addEventListener('change',()=>window.holdRender());
    document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',e=>{
      const p=b.dataset.page||'';
      const stockDept=p==='stock-personal'?'Personal':p==='stock-ev'?'EV':p==='stock-commercial'?'Commercial':p==='stock-llm'?'LLM':null;
      const quoteDept=p==='ev-quotation'||p==='ev-management'?'EV':p==='commercial-quotation'||p==='commercial-management'?'Commercial':p==='llm-quotation'||p==='llm-management'?'LLM':null;
      const holdDept=p==='stock-hold-personal'?'Personal':p==='stock-hold-ev'?'EV':p==='stock-hold-commercial'?'Commercial':p==='stock-hold-llm'?'LLM':null;
      if(stockDept){
        e.preventDefault();e.stopImmediatePropagation();window.openDepartmentStock(stockDept);return;
      }
      if(holdDept){
        e.preventDefault();e.stopImmediatePropagation();window.showPage('stock-hold-central');
        if($('holdDeptFilter'))$('holdDeptFilter').value=holdDept;
        window.holdRender();return;
      }
      if(quoteDept){
        e.preventDefault();e.stopImmediatePropagation();currentQuoteDepartment=quoteDept;
        window.showPage(p.endsWith('-management')?'quotation-management':'quotation');
        if($('quotationPageTitle'))$('quotationPageTitle').textContent=quoteDept+' Quotation';
        if(typeof resetQuotationForm==='function')resetQuotationForm();
        if(p.endsWith('-management'))reloadQuoteList().catch(x=>notify(x.message));
        return;
      }
      if(p==='quotation'||p==='quotation-management'){
        e.preventDefault();e.stopImmediatePropagation();
        window.showPage(p);
        if(p==='quotation'&&typeof resetQuotationForm==='function')resetQuotationForm();
        if(p==='quotation-management')reloadQuoteList().catch(x=>notify(x.message));
        return;
      }
      if(p==='stock-import'){
        e.preventDefault();e.stopImmediatePropagation();window.showPage('stock-import');return;
      }
      if(p==='price-list'||p==='employees'||p==='audit'||p==='reports'||p==='upload'||p==='backup-restore'||p==='dashboard'){
        e.preventDefault();e.stopImmediatePropagation();
        window.showPage(p==='employees'?'employees':p==='audit'?'audit':p==='reports'?'reports':p==='upload'?'upload':p==='backup-restore'?'backup-restore':p==='price-list'?'price-list':'dashboard');
        if(p==='employees')renderEmployees().catch(x=>notify(x.message));
        if(p==='audit')loadAudit().catch(x=>notify(x.message));
        if(p==='upload')loadImportHistory().catch(x=>notify(x.message));
        if(p==='price-list')loadPriceLists().catch(x=>notify(x.message));
        return;
      }
      if(p.startsWith('stock'))setTimeout(()=>renderStock(),0);
      if(p.includes('quotation'))setTimeout(()=>reloadQuoteList(),0);
      if(p.includes('employee'))setTimeout(()=>renderEmployees().catch(x=>notify(x.message)),0);
    },true));
    const originalOpen=window.openDepartmentStock;
    if(originalOpen)window.openDepartmentStock=function(...args){const x=originalOpen.apply(this,args);setTimeout(()=>renderStock(),0);return x;};
    const originalImportPreview=window.stockImportPreview;
    // Keep the original workbook preview parser; only its commit action is replaced above.
    if($('stockSearch'))$('stockSearch').addEventListener('input',()=>renderStock());
    $('view-stock')?.querySelector('.toolbar select')?.addEventListener('change',()=>renderStock());
    $('view-stock')?.querySelector('.page-head button')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();renderStock();},true);
    void originalImportPreview;
  }
  async function init() {
    if(!window.supabase?.createClient) throw new Error('Supabase JavaScript SDK failed to load.');
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    // Supabase is the source of truth; remove local demo workspace caches on startup.\n    ['sv_quote_records_clean_v2','sv_quotes_by_department_clean_v3','svm_clean_workspace_v2'].forEach(k=>{try{localStorage.removeItem(k);}catch(_e){}});
      try { localStorage.removeItem(quoteStoreKey); localStorage.removeItem(DEPT_QUOTE_KEY); } catch(_e) {}
      // Don't migrate browser records automatically; only explicit new Supabase records are used.
    installScreenHooks();
    try { await refreshIdentity(); } catch(e){ console.error(e); }
    if(currentUser) await startApp(); else showLogin();
    db().auth.onAuthStateChange(async(_event,session)=>{
      if(!session){currentUser=null;currentProfile=null;permissions.clear();showLogin();return;}
      try{await refreshIdentity();await startApp();}catch(e){console.error(e);showLogin();}
    });
    const logout=$('logoutBtn');if(logout){logout.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();signOut().catch(err=>notify(err.message));},true);}
    // holdRender already queries and renders Supabase directly; do not wrap it via loadHolds (would recurse).
    window.holdSubmit=()=>submitHold().catch(e=>notify(e.message));
    window.holdDecision=(id,decision)=>decideHold(id,decision).catch(e=>notify(e.message));
    window.SVMBackend={client:()=>db(),get user(){return currentUser;},get profile(){return currentProfile;},has,signOut,loadVehicles,saveVehicle,updateVehicle,deleteVehicle,saveQuotation,loadQuotations,publishPriceList,savePermissions,loadEmployees,loadAudit,loadImportHistory,previewReconciliation,audit};
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{console.error(e);notify('Backend init failed: '+e.message);showLogin();}),{once:true});
  else init().catch(e=>{console.error(e);notify('Backend init failed: '+e.message);showLogin();});
})();