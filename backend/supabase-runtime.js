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
  let client, currentUser, currentProfile, permissions = new Map(), authReady = false, sessionLoginRecordedFor = null;
  let selectedStockVehicle = null;

  if(!document.getElementById('svmSelectedStockStyles')){
    const style=document.createElement('style');style.id='svmSelectedStockStyles';
    style.textContent=`
      #stockTable tbody tr[data-stock-id]{cursor:pointer;transition:background .15s ease,box-shadow .15s ease}
      #stockTable tbody tr[data-stock-id]:hover{background:#fff8f8}
      #stockTable tbody tr.selected-stock-row{background:#fff0f1!important;box-shadow:inset 4px 0 0 #c92535,inset 0 0 0 1px #efb6bc}
      #stockTable tbody tr.selected-stock-row td{border-top-color:#efc4c8;border-bottom-color:#efc4c8}
      .selected-stock-context{margin:0 0 16px;padding:16px;border:1px solid #efb8bf;border-left:5px solid #c92535;border-radius:14px;background:linear-gradient(120deg,#fff1f2,#fff 75%);box-shadow:0 4px 16px rgba(180,35,48,.07)}
      .selected-stock-context .ssc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .selected-stock-context .ssc-title{font-size:14px;font-weight:850;color:#a91f2c;letter-spacing:.35px}
      .selected-stock-context .ssc-clear{border:0;background:transparent;color:#7b8794;font-size:12px;font-weight:700;padding:5px 7px}
      .selected-stock-context .ssc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px}
      .selected-stock-context .ssc-field{min-width:0}
      .selected-stock-context .ssc-label{display:block;font-size:10px;font-weight:800;color:#8b6570;text-transform:uppercase;letter-spacing:.55px;margin-bottom:3px}
      .selected-stock-context .ssc-value{display:block;font-size:13px;font-weight:750;color:#293442;overflow-wrap:anywhere}
      .selected-stock-context .ssc-actions{display:flex;justify-content:flex-end;margin-top:12px}
      .selected-stock-context .ssc-request{border:0;border-radius:9px;padding:10px 14px;background:#c92535;color:#fff;font-size:12px;font-weight:800}
      @media(max-width:480px){.selected-stock-context{padding:13px}.selected-stock-context .ssc-grid{gap:8px}.selected-stock-context .ssc-value{font-size:12px}}
      .q-stock-suggestions{grid-column:1/-1;position:relative;z-index:40;max-height:330px;overflow:auto;border:1px solid #e1aeb4;border-radius:11px;background:#fff;box-shadow:0 12px 28px rgba(20,30,45,.14);margin:-8px 0 8px}.q-stock-suggestions[hidden]{display:none}.q-stock-count,.q-stock-empty{padding:10px 13px;font-size:11px;color:#6b7280;background:#fff8f8}.q-stock-option{width:100%;border:0;border-top:1px solid #edf0f3;background:#fff;padding:11px 13px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer;color:#263445}.q-stock-option:hover,.q-stock-option:focus{background:#fff0f1;outline:0}.q-stock-main{display:grid;gap:3px;min-width:0}.q-stock-main b{font-size:13px}.q-stock-main span,.q-stock-meta small{font-size:11px;color:#64748b}.q-stock-meta{display:grid;gap:3px;text-align:right;max-width:45%;overflow-wrap:anywhere}.q-stock-meta b{font-size:10px;color:#344054}
    `;
    document.head.appendChild(style);
  }
  const $ = id => document.getElementById(id);
  const notify = msg => { if (typeof window.toast === 'function') window.toast(msg); else console.info(msg); };
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db = () => { if (!client) throw new Error('Supabase client is not ready'); return client; };
  async function call(q) { const {data,error}=await q; if(error) throw error; return data; }
  function has(module,action='view') {
    // Super Admin can view all audit records, but audit() below never records Super Admin activity.
    if(currentProfile?.is_super_admin) return true;
    if(module==='audit_history'&&action==='view'&&['Admin','General Manager'].includes(currentProfile?.designation)) return true;
    return (permissions.get(module)||[]).includes(action);
  }
  function roleLevel(){const levels={'Super Admin':100,'Admin':90,'General Manager':80,'Manager':70,'Accountant':60,'HR':50,'DMS':40,'Executive':30,'Reception':20,'Driver':10};return currentProfile?.is_super_admin?100:(levels[currentProfile?.designation]??0);}
  function canManageStock(){return roleLevel()>30;}
  function canManageHolds(){return roleLevel()>=70;}
  function allowedDepartmentList(){
    if(currentProfile?.is_super_admin || ['Admin','General Manager'].includes(currentProfile?.designation)) return ['Personal','EV','Commercial','LLM'];
    if(currentProfile?.designation==='Manager') return currentProfile?.department_access?.length?currentProfile.department_access:[currentProfile?.department].filter(Boolean);
    return currentProfile?.department_access?.length?currentProfile.department_access:[currentProfile?.department].filter(Boolean);
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
    el.innerHTML='<div style="width:min(420px,100%);background:#fff;border-radius:16px;padding:28px;box-shadow:0 24px 80px #0005;color:#1d2733"><div id="svLoginLogoWrap" style="display:flex;justify-content:center;align-items:center;margin:0 auto 18px;min-height:76px"><img id="svLoginBrandLogo" alt="Siddhivinayak Motors Pvt. Ltd. official logo" style="display:block;width:min(100%,168px);height:76px;object-fit:contain" onerror="this.style.display=\'none\';this.parentElement.style.display=\'none\'"></div><div style="font-size:20px;font-weight:800;margin-bottom:6px;text-align:center;text-transform:uppercase;letter-spacing:.35px">Siddhivinayak Mahindra</div><div style="color:#6f7c8b;margin-bottom:22px;text-align:center;letter-spacing:1.2px;font-size:11px">STOCK MANAGEMENT SYSTEM</div><form id="svLoginForm"><label style="display:block;font-weight:650;margin:12px 0 6px">Email address</label><input id="svLoginEmail" type="email" autocomplete="username" required style="width:100%;padding:12px;border:1px solid #dce2e9;border-radius:8px"><label style="display:block;font-weight:650;margin:14px 0 6px">Password</label><input id="svLoginPassword" type="password" autocomplete="current-password" required style="width:100%;padding:12px;border:1px solid #dce2e9;border-radius:8px"><div id="svLoginError" style="color:#c51c2a;font-size:12px;margin:10px 0;min-height:16px"></div><button id="svLoginSubmit" type="submit" style="width:100%;padding:12px;border:0;border-radius:8px;background:#e51e2a;color:#fff;font-weight:750">Sign in</button><button id="svForgotPassword" type="button" style="margin-top:12px;border:0;background:transparent;color:#34404d;text-decoration:underline">Forgot password?</button></form></div>';
    document.body.appendChild(el);
    const appLogo=document.querySelector('.brand-logo img');
    const loginLogo=$('svLoginBrandLogo');
    if(appLogo?.getAttribute('src')) loginLogo.src=appLogo.getAttribute('src');
    else $('svLoginLogoWrap').style.display='none';
    $('svLoginForm').addEventListener('submit',async e=>{
      e.preventDefault();const btn=$('svLoginSubmit'),err=$('svLoginError');btn.disabled=true;btn.textContent='Signing in…';err.textContent='';
      try {
        const {error}=await db().auth.signInWithPassword({email:$('svLoginEmail').value.trim(),password:$('svLoginPassword').value});
        if(error) throw error;
        await refreshIdentity();el.remove();await startApp();await recordSessionLogin();
      } catch(ex){err.textContent=ex.message||'Login failed';}
      finally{btn.disabled=false;btn.textContent='Sign in';}
    });
    $('svForgotPassword').addEventListener('click',async()=>{
      const email=$('svLoginEmail').value.trim();if(!email){$('svLoginError').textContent='Enter your email first.';return;}
      const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      $('svLoginError').textContent=error?error.message:'Password reset email requested.';
    });
  }
  const quotationStockCache = new Map();
  let quotationPickerBound = false;
  const quoteSearchNorm = value => String(value || '').normalize('NFD').replace(/\\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  async function loadQuotationStock(department) {
    if(quotationStockCache.has(department)) return quotationStockCache.get(department);
    const pending=(async()=>{
      if(!has('stock_register','view')) return [];
      const allowed=allowedDepartmentList();
      if(!allowed.some(x=>String(x).toLowerCase()===String(department).toLowerCase())) return [];
      const rows=[];let from=0,chunk=500;
      while(true){
        const part=await call(db().from('vehicles').select('id,department,chassis_number,model,variant,colour,status,stage,seating,manufacturing_year').eq('department',department).order('model').range(from,from+chunk-1));
        rows.push(...part);if(part.length<chunk)break;from+=chunk;
      }
      return rows;
    })();
    quotationStockCache.set(department,pending);
    try{return await pending;}catch(error){quotationStockCache.delete(department);throw error;}
  }
  function setupQuotationVehiclePicker() {
    const model=$('qVehicle'),variant=$('qVariant'),colour=$('qColour'),box=$('qStockSuggestions');
    if(!model||!variant||!colour||!box)return;
    if($('qSalesPerson')){$('qSalesPerson').value=currentProfile?.full_name||currentUser?.email||'';}
    if(quotationPickerBound)return;
    quotationPickerBound=true;
    const fields=[model,variant,colour];
    const hide=()=>{box.hidden=true;};
    const colourQuery=q=>q==='wh'?'white':q==='bl'?'black':q==='si'?'silver':q;
    const render=async()=>{
      const dept=typeof currentQuoteDepartment!=='undefined'?currentQuoteDepartment:'Personal';
      const mq=quoteSearchNorm(model.value),vq=quoteSearchNorm(variant.value),cq=colourQuery(quoteSearchNorm(colour.value));
      if(!mq&&!vq&&!cq){hide();return;}
      box.hidden=false;box.innerHTML='<div class="q-stock-empty">Searching stock…</div>';
      try{
        const rows=await loadQuotationStock(dept);
        const matches=rows.filter(v=>{
          const vm=quoteSearchNorm(v.model),vv=quoteSearchNorm(v.variant),vc=quoteSearchNorm(v.colour);
          return (!mq||vm.includes(mq))&&(!vq||vv.includes(vq))&&(!cq||vc.includes(cq));
        }).sort((a,b)=>{
          const ao=String(a.stage||'').toUpperCase()==='OPEN'?0:1,bo=String(b.stage||'').toUpperCase()==='OPEN'?0:1;
          return ao-bo||String(a.model||'').localeCompare(String(b.model||''))||String(a.variant||'').localeCompare(String(b.variant||''));
        });
        if(!matches.length){box.innerHTML='<div class="q-stock-empty">No matching stock vehicle found. You can continue with manual entry.</div>';return;}
        const count=matches.length;
        box.innerHTML='<div class="q-stock-count">'+count+' matching stock vehicle(s) · '+esc(dept)+'</div>'+matches.slice(0,30).map((v,i)=>'<button type="button" class="q-stock-option" data-quote-stock-index="'+i+'"><span class="q-stock-main"><b>'+esc(v.model||'—')+'</b><span>'+esc(v.variant||'Variant not listed')+' · '+esc(v.colour||'Colour not listed')+'</span></span><span class="q-stock-meta"><b>'+esc(v.chassis_number||'')+'</b><small>'+esc(v.stage||v.status||'')+'</small></span></button>').join('')+(count>30?'<div class="q-stock-count">Showing first 30. Add more variant or colour text to narrow the list.</div>':'');
        box.querySelectorAll('[data-quote-stock-index]').forEach(button=>button.addEventListener('click',()=>{
          const v=matches[Number(button.dataset.quoteStockIndex)];if(!v)return;
          model.value=v.model||'';variant.value=v.variant||'';colour.value=v.colour||'';$('qChassis').value=v.chassis_number||'';
          if($('qCarDesc')&&!$('qCarDesc').value)$('qCarDesc').value=[v.seating,v.manufacturing_year].filter(Boolean).join(' · ');
          if($('qSalesPerson'))$('qSalesPerson').value=currentProfile?.full_name||currentUser?.email||'';
          hide();notify('Stock vehicle selected · Chassis '+(v.chassis_number||'not available'));
        }));
      }catch(error){box.hidden=false;box.innerHTML='<div class="q-stock-empty">Stock search unavailable: '+esc(error.message)+' · Manual entry is available.</div>';}
    };
    fields.forEach(field=>{
      field.addEventListener('input',()=>{render();});
      field.addEventListener('focus',()=>{if(field.value.trim())render();});
      field.setAttribute('aria-autocomplete','list');
    });
    document.addEventListener('click',event=>{if(!box.contains(event.target)&&!fields.includes(event.target))hide();});
    model.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  }
  async function startApp() {
    if(!currentUser){showLogin();return;}
    if($('svAuthGate')) $('svAuthGate').remove();
    const label=$('userName')||document.querySelector('.user-name');
    if(label) label.textContent=currentProfile.full_name||currentUser.email;
    const roleLabel=document.querySelector('.user-role');
    if(roleLabel) roleLabel.textContent=currentProfile?.is_super_admin?'SUPER ADMIN':String(currentProfile?.designation||'EMPLOYEE').toUpperCase();
    setupQuotationVehiclePicker();
    const hasAnyModule=['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','employee_management','common_excel_upload','backup_restore','audit_history','retail_reports'].some(m=>has(m,'view'));
    // Keep the app shell intact; enforce module and department access on the actual navigation items.
    try{await refreshDashboard();}catch(e){console.error('Dashboard data refresh failed:',e);notify('Dashboard data could not be refreshed: '+(e.message||e));}
    const dashRefresh=document.querySelector('#view-dashboard .page-head .btn, #view-dashboard button[onclick*="Dashboard refreshed"]');
    if(dashRefresh&&!dashRefresh.dataset.liveRefreshBound){dashRefresh.dataset.liveRefreshBound='1';dashRefresh.onclick=()=>refreshDashboard().then(()=>notify('Dashboard updated')).catch(e=>notify(e.message));}

    const viewMap={
      'view-dashboard':'dashboard','view-stock':'stock_register','view-quotation':'quotation_management',
      'view-quotation-management':'quotation_management',
      'view-upload':'common_excel_upload','view-stock-hold-central':'stock_hold_management',
      'view-price-list':'price_list_management','view-employees':'employee_management',
      'view-audit':'audit_history','view-reports':'retail_reports','view-backup-restore':'backup_restore'
    };
    const allowedDepartments=new Set(allowedDepartmentList().map(x=>String(x).toLowerCase()));
    const departmentKeys={personal:'Personal',ev:'EV',commercial:'Commercial',llm:'LLM'};
    const pageModule=page=>{
      if(page.startsWith('stock-hold'))return 'stock_hold_management';
      if(page==='upload')return 'common_excel_upload';
      if(page.startsWith('stock'))return 'stock_register';
      if(page.includes('quotation'))return 'quotation_management';
      if(page==='price-list')return 'price_list_management';
      if(page==='employees')return 'employee_management';
      // Department-specific quotation-management pages use the same module gate.
      if(['personal-management','ev-management','commercial-management','llm-management'].includes(page))return 'quotation_management';
      if(page==='audit')return 'audit_history';
      if(page==='reports')return 'retail_reports';
      if(page==='backup-restore')return 'backup_restore';
      if(page==='dashboard')return 'dashboard';
      return null;
    };
    // First hide each department's complete four-item register submenu unless that department is assigned.
    document.querySelectorAll('[data-sub]').forEach(sub=>{
      const dept=departmentKeys[sub.dataset.sub];
      const allowed=!!dept&&allowedDepartments.has(String(dept).toLowerCase());
      sub.style.display=allowed?'':'none';
      sub.querySelectorAll('[data-page]').forEach(item=>{
        const module=pageModule(item.dataset.page||'');
        item.style.display=allowed&&(!module||has(module,'view'))?'':'none';
      });
      const group=document.querySelector('[data-group="'+sub.dataset.sub+'"]');
       // Department Access grants all four department functions; no separate
       // module checkbox is required for Personal / EV / Commercial / LLM.
       sub.querySelectorAll('[data-page]').forEach(item=>item.style.display=allowed?'':'none');
       if(group)group.style.display=allowed?'':'none';
    });
    document.querySelectorAll('[data-page]').forEach(item=>{
      if(item.closest('[data-sub]'))return;
      const module=pageModule(item.dataset.page||'');
      item.style.display=(!module||has(module,'view'))?'':'none';
    });
    document.querySelectorAll('[data-department]').forEach(card=>{
      const dept=String(card.dataset.department||'').toLowerCase();
      card.style.display=allowedDepartments.has(dept)?'':'none';
    });
    const quickModules={quotation:'quotation_management','price-list':'price_list_management',employees:'employee_management',audit:'audit_history',reports:'retail_reports',upload:'common_excel_upload',stock:'stock_register','stock-hold-central':'stock_hold_management','backup-restore':'backup_restore'};
    const shortcutAccess=new Set(Array.isArray(currentProfile?.dashboard_shortcuts)?currentProfile.dashboard_shortcuts:[]);
    document.querySelectorAll('.quick[data-go]').forEach(card=>{
      const module=quickModules[card.dataset.go];
      card.style.display=(currentProfile?.is_super_admin||shortcutAccess.has('quick-access'))&&(card.dataset.go==='password'||(module&&has(module,'view')))?'':'none';
    });
    if(!hasAnyModule){
      document.querySelectorAll('.sidebar [data-page], .sidebar [data-group], .sidebar .nav-section').forEach(item=>{
        if(item.dataset.page==='password')return;
        item.style.display='none';
      });
      document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-password'));
    }else if(!has('dashboard','view')){
      const dashboardNav=document.querySelector('.sidebar [data-page="dashboard"]');
      if(dashboardNav)dashboardNav.style.display='none';
      const firstVisible=document.querySelector('.sidebar [data-page]:not([data-page="password"]):not([style*="display: none"])');
      if(firstVisible){const p=firstVisible.dataset.page;if(p)window.showPage?.(p);}
      else document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-password'));
    }
    await Promise.allSettled([loadHolds(),loadPriceLists(),loadEmployees(),loadAudit(),loadImportHistory()]);
    authReady=true;
  }
  async function signOut() { await audit('dashboard','logout','Employee signed out','auth_session',currentUser?.id||null); await db().auth.signOut(); sessionLoginRecordedFor=null; location.reload(); }

  async function loadHolds() {
    if(!has('stock_hold_management','view')) return;
    let rows=[],from=0,chunk=1000;
    while(true){
      const part=await call(db().from('stock_holds').select('*').order('created_at',{ascending:false}).range(from,from+chunk-1));
      rows.push(...part);if(part.length<chunk)break;from+=chunk;
    }
    window.holdItems=rows;
    if(typeof window.holdRender==='function') window.holdRender();
  }
  async function submitHold() {
    if(roleLevel()>30) throw new Error('Only Executive and junior roles can submit a stock hold request from the register.');
    if(!has('stock_hold_management','create')) throw new Error('You do not have permission to submit hold requests.');
    const selectedDepartment=$('holdDept').value;
    if(!allowedDepartmentList().includes(selectedDepartment)) throw new Error('You do not have access to this department.');
    const vehicle=$('holdVehicle').value.trim(),vin=$('holdVin').value.trim(),reason=$('holdReason').value.trim();
    if(!vehicle||!vin||!reason) throw new Error('Vehicle, VIN/Chassis and reason are required');
    await call(db().from('stock_holds').insert({department:$('holdDept').value,vehicle,variant:$('holdVariant').value,vin,executive:$('holdExecutive').value||'Not specified',reason,created_by:currentUser.id}));
    await loadHolds();['holdVehicle','holdVin','holdVariant','holdExecutive','holdReason'].forEach(id=>$(id).value='');notify('Hold request submitted.');
  }
  async function decideHold(id,decision) {
    if(!canManageHolds()) throw new Error('Stock Hold Management is available to Manager and above only.');
    if(!has('stock_hold_management','approve')) throw new Error('You do not have approval permission.');
    if(!['Approved','Rejected'].includes(decision)) throw new Error('Invalid decision');
    const {data,error}=await db().from('stock_holds').update({status:decision,approver_id:currentUser.id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('status','Pending').select('id');
    if(error)throw error;
    if(!data?.length)throw new Error('Hold request is no longer pending or was already processed.');
    // Database trigger synchronizes the linked stock vehicle stage atomically.
    await loadHolds();await audit('stock_hold_management','approve',decision+' hold','stock_hold',id);
  }
  async function loadPriceListStock() {
    if(!has('stock_register','view')) { window.svPriceListStockRows=[]; return []; }
    let rows=[],from=0,chunk=1000;
    while(true) {
      const part=await call(db().from('vehicles').select('model,variant,colour,department').order('model').range(from,from+chunk-1));
      rows.push(...part); if(part.length<chunk)break; from+=chunk;
    }
    window.svPriceListStockRows=rows; return rows;
  }
  async function loadPriceLists() {
    if(!has('price_list_management','view')) return;
    const versions=await call(db().from('price_list_versions').select('*').order('published_at',{ascending:false}));
    const by={Personal:[],EV:[],Commercial:[],LLM:[]};
    const loaded=new Set();
    for(const v of versions){
      if(loaded.has(v.department))continue;
      loaded.add(v.department);
      let items=[],from=0,chunk=1000;
      while(true){
        const part=await call(db().from('price_list_items').select('*').eq('version_id',v.id).order('vehicle').range(from,from+chunk-1));
        items.push(...part);if(part.length<chunk)break;from+=chunk;
      }
      by[v.department]=items.map(x=>({...x,exShowroom:Number(x.ex_showroom||0),rto:Number(x.rto||0)}));
    }
    window.plData=by;window.plHistory=versions.map(v=>({version:v.version_label,dept:v.department,file:v.source_file||'',date:v.published_at,rows:v.row_count}));
    if(typeof window.plRender==='function') window.plRender();
  }
  async function publishPriceList(rowsByDepartment,sourceFile='',fileObjects=[]) {
    if(!has('price_list_management','create')) throw new Error('No permission to upload price lists.');
    const storagePaths=[];
    for(const file of fileObjects){
      const departments=file.priceListDepartments&&file.priceListDepartments.length?file.priceListDepartments:['Personal'];
      const safeName=String(file.name||'price-list.xlsx').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120);
      for(const dept of departments){
        const path=dept+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'-'+safeName;
        const {error}=await db().storage.from('price-list-files').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
        if(error)throw error;
        storagePaths.push(path);
      }
    }
    const allFileRefs=storagePaths.length?storagePaths.join(' | '):sourceFile;
    for(const [department,rows] of Object.entries(rowsByDepartment)){
      if(!['Personal','EV','Commercial','LLM'].includes(department)||!rows.length)continue;
      const deptFiles=fileObjects.filter(f=>f.department===department).map(f=>f.name);
      const version=await call(db().from('price_list_versions').insert({
        version_label:'V'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14),
        department,source_file:deptFiles.join(', ')||sourceFile,row_count:rows.length,published_by:currentUser.id
      }).select().single());
      const batch=await call(db().from('price_list_import_batches').insert({
        department,version_label:version.version_label,source_file:(deptFiles.join(', ')||sourceFile)+' | '+allFileRefs,
        status:'published',total_rows:rows.length,valid_rows:rows.length,duplicate_rows:0,error_rows:0,
        uploaded_by:currentUser.id,reviewed_by:currentUser.id,reviewed_at:new Date().toISOString(),
        published_version_id:version.id,review_note:'Published from Price List upload screen.'
      }).select().single());
      for(let i=0;i<rows.length;i+=500){
        const chunk=rows.slice(i,i+500);
        const items=chunk.map((r,j)=>({
          batch_id:batch.id,row_number:i+j+1,vehicle:r.vehicle,variant:r.variant||'',colour:r.colour||'',
          ex_showroom:Number(r.exShowroom||0),rto:Number(r.rto||0),
          source_payload:{...r,department}
        }));
        await call(db().from('price_list_import_items').insert(items));
      }
      for(let i=0;i<rows.length;i+=500){
        const payload=rows.slice(i,i+500).map(r=>({
          version_id:version.id,department,vehicle:r.vehicle,variant:r.variant||'',colour:r.colour||'',
          ex_showroom:Number(r.exShowroom||0),rto:Number(r.rto||0),
          other_data:{...r,department,source_files:deptFiles}
        }));
        await call(db().from('price_list_items').insert(payload));
      }
    }
    await loadPriceLists();
    await audit('price_list_management','create','Uploaded and published price list','price_list_version',null,{source_file:sourceFile,storage_paths:storagePaths,departments:Object.keys(rowsByDepartment)});
  }

  async function loadEmployees() {
    if(!has('employee_management','view')&&!currentProfile?.is_super_admin) return;
    let rows=[],from=0,chunk=1000;
    while(true){
      const part=await call(db().from('profiles').select('*').order('full_name').range(from,from+chunk-1));
      rows.push(...part);if(part.length<chunk)break;from+=chunk;
    }
    rows=rows.filter(x=>!x.deleted_at);
    window.svEmployees=rows;
    await renderEmployees();
  }
  async function loadAudit() {
    if(!has('audit_history','view')) {
      window.svAuditRows=[];
      const body=$('view-audit')?.querySelector('.table-wrap table tbody');
      if(body)body.innerHTML='<tr><td colspan="8" class="empty">Audit History permission required.</td></tr>';
      return;
    }
    let rows=[],from=0,chunk=1000;
    while(true){
      const part=await call(db().from('audit_logs').select('*').order('created_at',{ascending:false}).range(from,from+chunk-1));
      rows.push(...part);if(part.length<chunk)break;from+=chunk;
    }
    window.svAuditRows=rows; renderAuditRows(rows);
  }
  function renderAuditRows(rows=window.svAuditRows||[]) {
    const view=$('view-audit');if(!view)return;
    const body=view.querySelector('.table-wrap table tbody');if(!body)return;
    const search=(view.querySelector('.toolbar .search input')?.value||'').trim().toLowerCase();
    const actionFilter=view.querySelector('.toolbar select')?.value||'All actions';
    const filtered=rows.filter(r=>{
      const text=[r.actor_email,r.actor_designation,r.action_label,r.module,r.action,r.record_type,r.record_id,JSON.stringify(r.details||{})].join(' ').toLowerCase();
      return (!search||text.includes(search))&&(actionFilter==='All actions'||String(r.action||'').toUpperCase()===actionFilter);
    });
    body.innerHTML=filtered.length?filtered.map(r=>'<tr><td>'+new Date(r.created_at).toLocaleString()+'</td><td>'+esc(r.actor_email||'—')+'</td><td>'+esc(r.actor_designation||'—')+'</td><td>'+esc(r.module||'—')+'</td><td>'+esc(String(r.action||'').toUpperCase())+'</td><td>'+esc([r.record_type,r.record_id].filter(Boolean).join(' · ')||'—')+'</td><td><span class="pill green">Recorded</span></td><td>'+esc(r.action_label||'')+' '+esc(JSON.stringify(r.details||{}))+'</td></tr>').join(''):'<tr><td colspan="8" class="empty">No matching activity records.</td></tr>';
    const desc=view.querySelector('.card-desc');if(desc)desc.textContent=filtered.length+' activity records · Supabase audit log';
  }
  function downloadAuditCsv(){
    if(!has('audit_history','export')){notify('Audit export permission required.');return;}
    const rows=window.svAuditRows||[];
    const cols=['created_at','actor_email','actor_designation','module','action','action_label','record_type','record_id','details'];
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv=[cols.join(','),...rows.map(r=>cols.map(c=>q(typeof r[c]==='object'?JSON.stringify(r[c]):r[c])).join(','))].join('\r\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.href=url;a.download='Siddhivinayak-Audit-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);void audit('audit_history','export','Exported audit history as CSV');
  }
  async function audit(module,action,label,type=null,id=null,details={}) {
    if(!currentUser || currentProfile?.is_super_admin) return false;
    try {
      const {error}=await db().from('audit_logs').insert({
        actor_id:currentUser.id,
        actor_email:currentProfile?.email||currentUser.email||null,
        actor_designation:currentProfile?.designation||null,
        module,action,action_label:label,
        record_type:type,
        record_id:id==null?null:String(id),
        details:details||{}
      });
      if(error) throw error;
      return true;
    } catch(e){console.error('Audit write failed:',{module,action,label,error:e});return false;}
  }
  async function recordSessionLogin(){
    if(!currentUser||currentProfile?.is_super_admin||sessionLoginRecordedFor===currentUser.id)return;
    sessionLoginRecordedFor=currentUser.id;
    await audit('dashboard','login','Employee signed in','auth_session',currentUser.id);
  }
  async function refreshDashboard(){
    const cards=[...document.querySelectorAll('#view-dashboard .department-kpi[data-department]')];
    if(!has('stock_register','view')){
      cards.forEach(card=>{card.style.display='none';});
      return;
    }
    const assigned=new Set(allowedDepartmentList().map(x=>String(x).toLowerCase()));
    cards.forEach(card=>{card.style.display=assigned.has(String(card.dataset.department||'').toLowerCase())?'':'none';});
    const visibleDepartments=['Personal','EV','Commercial','LLM'].filter(d=>assigned.has(d.toLowerCase()));
    if(!visibleDepartments.length)return;
    const rows=await call(db().from('vehicles').select('department,stage').in('department',visibleDepartments));
    const norm=v=>String(v||'').trim().toUpperCase();
    for(const card of cards){
      const dept=card.dataset.department;
      if(!assigned.has(String(dept||'').toLowerCase()))continue;
      const list=rows.filter(x=>String(x.department||'').toLowerCase()===String(dept).toLowerCase());
      const total=list.length,open=list.filter(x=>norm(x.stage)==='OPEN').length,hold=list.filter(x=>norm(x.stage)==='HOLD').length,retail=list.filter(x=>norm(x.stage)==='RETAIL').length;
      const totalNode=card.querySelector('.kpi-total strong');
      if(totalNode)totalNode.textContent=String(total).padStart(2,'0');
      const vals=card.querySelectorAll('.dashboard-status-item .status-value');
      if(vals[0])vals[0].textContent=String(open).padStart(2,'0');
      if(vals[1])vals[1].textContent=String(hold).padStart(2,'0');
      if(vals[2])vals[2].textContent=String(retail).padStart(2,'0');
    }
  }
  async function loadVehicles(department='Personal') {
    if(!has('stock_register','view')) throw new Error('No stock view permission.');
    const allowed=allowedDepartmentList();
    if(department==='All') return allowed.length?call(db().from('vehicles').select('*').in('department',allowed).order('created_at',{ascending:false})):[];
    if(!allowed.some(x=>String(x).toLowerCase()===String(department).toLowerCase())) throw new Error('You do not have access to this department.');
    return call(db().from('vehicles').select('*').eq('department',department).order('created_at',{ascending:false}));
  }
  async function saveVehicle(data) {
    if(!has('stock_register','create')) throw new Error('No stock create permission.');
    const clean={...data,created_by:currentUser.id};
    const row=await call(db().from('vehicles').insert(clean).select().single());
    quotationStockCache.clear();
    await audit('stock_register','create','Created vehicle','vehicle',row.id,{chassis_number:row.chassis_number});
    return row;
  }
  async function updateVehicle(id,data,viaImport=false) {
    if(!canManageStock()&&!viaImport) throw new Error('Executive and junior roles cannot edit stock.');
    if(viaImport&&!has('common_excel_upload','create')) throw new Error('Common Excel Upload permission required.');
    const row=await call(db().from('vehicles').update({...data,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',id).select().single());
    quotationStockCache.clear();
    await audit(viaImport?'common_excel_upload':'stock_register',viaImport?'create':'edit',viaImport?'Reconciled vehicle by exact chassis':'Updated vehicle','vehicle',id);
    return row;
  }
  async function deleteVehicle(id) {
    if(!canManageStock()||!has('stock_register','delete')) throw new Error('Only roles above Executive with delete permission can delete stock.');
    await call(db().from('vehicles').delete().eq('id',id));quotationStockCache.clear();await audit('stock_register','delete','Deleted vehicle','vehicle',id);
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
    const out=[];let from=0,chunk=500;
    while(true){
      const part=await call(db().from('quotations').select('*,quotation_items(*)').eq('department',department).order('created_at',{ascending:false}).range(from,from+chunk-1));
      out.push(...part);if(part.length<chunk)break;from+=chunk;
    }
    return out;
  }


  // --- Bind the existing screens and controls to persistent Supabase records ---
  const moduleEnum = (label) => MODULES[label] || label;
  const toQuoteView = (row) => ({
    id:row.id,no:row.quote_number,department:row.department,customer:row.customer_name,phone:row.phone||'',
    address:row.address||'',vehicleNos:String(row.vehicle_count??1),hypo:row.hypo||'',
    model:row.model||'',carDescription:row.car_description||'',variant:row.variant||'',colour:row.colour||'',
    vehicle:[row.model,row.variant].filter(Boolean).join(' · '),chassis:row.chassis||'',
    salesPerson:row.sales_person||'',by:row.created_by===currentUser?.id?(currentProfile?.full_name||currentUser.email):'Employee',
    contactPerson:row.contact_person||'',contactMobile:row.contact_mobile||'',email:row.email||'',
    branchAddress:row.branch_address||'',helpline:row.helpline||'',pan:row.pan||'',gstin:row.gstin||'',
    total:Number(row.total||0),subtotal:Number(row.subtotal||0),discount:Number(row.discount||0),
    amountWords:row.amount_words||'',terms:Array.isArray(row.terms)?row.terms:[],
    bank:row.bank_details&&typeof row.bank_details==='object'?row.bank_details:{},
    status:String(row.status||'Pending').toUpperCase(),prints:Number(row.print_count||0),
    date:row.quote_date,items:(row.quotation_items||[]).sort((a,b)=>Number(a.line_no||0)-Number(b.line_no||0)).map(x=>({name:x.particulars,amount:Number(x.amount||0),discount:!!x.is_discount}))
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
        amount_words:q.amountWords||'',terms:q.terms||[],bank_details:q.bank||{},
        created_by:currentUser.id,updated_by:currentUser.id
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
  window.stockImportPreview = async () => {
    try{
      const file=$('stockReportFile')?.files?.[0];if(!file)throw new Error('Select the standard stock report Excel file.');
      if(!has('common_excel_upload','create'))throw new Error('You do not have Excel Upload permission.');
      const rows=await readWorkbook(file);
      const existing=[];
      for(let from=0;;from+=1000){const part=await call(db().from('vehicles').select('chassis_number,excel_number').range(from,from+999));existing.push(...part);if(part.length<1000)break;}
      const seenChassis=new Set(existing.map(x=>String(x.chassis_number||'').trim().toUpperCase()).filter(Boolean));
      const seenVin=new Set(existing.map(x=>String(x.excel_number||'').trim().toUpperCase()).filter(Boolean));
      const allowedDepartments=new Set(allowedDepartmentList().map(x=>String(x).toLowerCase()));
      const mapSegment=segment=>{
        if(segment==='PERSONAL'||segment.startsWith('PERSONAL'))return 'Personal';
        if(segment==='BEV'||segment==='EV'||segment.includes('ELECTRIC'))return 'EV';
        if(segment==='PROSPER'||segment.includes('PROSPER'))return 'Commercial';
        if(segment==='LMM'||segment.startsWith('LMM'))return 'LLM';
        return '';
      };
      const toDateValue=value=>{
        if(value instanceof Date&&!isNaN(value))return value;
        if(typeof value==='number'&&window.XLSX){const z=XLSX.SSF.parse_date_code(value);if(z)return new Date(z.y,z.m-1,z.d);}
        if(value){const d=new Date(value);if(!isNaN(d))return d;}
        return null;
      };
      stockPreviewRows=rows.filter(r=>Object.values(r||{}).some(v=>v!==null&&v!==undefined&&String(v).trim()!=='')).map(r=>{
        const segment=String(plHeader(r,['segmentcode','segment'])||'').trim().toUpperCase();
        const department=mapSegment(segment);
        const chassis=String(plHeader(r,['chassisnumber','chassis'])||'').trim().toUpperCase();
        const vin=String(plHeader(r,['vin'])||'').trim().toUpperCase();
        const date=plHeader(r,['oeminvoicedate','invoicedate']);
        const invoiceDate=toDateValue(date);
        let decision='Import';
        if(!department)decision='Review: Unknown Segment';
        else if(!allowedDepartments.has(String(department).toLowerCase()))decision='Review: Outside your department';
        else if(!chassis)decision='Review: Missing Chassis Number';
        else if(!invoiceDate)decision='Review: Missing Invoice Date';
        else if(invoiceDate.getFullYear()<2025)decision='Skip: Before 2025';
        else if(seenChassis.has(chassis))decision='Duplicate Chassis — Skip';
        else if(vin&&seenVin.has(vin))decision='Duplicate VIN — Skip';
        else {seenChassis.add(chassis);if(vin)seenVin.add(vin);}
        return {chassis,vin,model:String(plHeader(r,['model'])||''),variant:String(plHeader(r,['variantdesc','variant'])||''),segment,department,status:String(plHeader(r,['vehiclestatus','status'])||'Received'),stockType:String(plHeader(r,['stocktype'])||''),date,raw:r,decision};
      });
      const count=k=>stockPreviewRows.filter(x=>x.decision===k).length;
      const review=stockPreviewRows.filter(x=>x.decision.startsWith('Review')).length;
      const duplicates=stockPreviewRows.filter(x=>x.decision.startsWith('Duplicate')||x.decision.startsWith('Skip:')).length;
      $('stockImportSummary').style.display='block';
      $('stockImportSummary').textContent='Rows: '+rows.length+' · Importable: '+count('Import')+' · Duplicates skipped: '+duplicates+' · Needs review: '+review+' · Department: Personal '+stockPreviewRows.filter(x=>x.department==='Personal'&&x.decision==='Import').length+' / Commercial '+stockPreviewRows.filter(x=>x.department==='Commercial'&&x.decision==='Import').length+' / EV '+stockPreviewRows.filter(x=>x.department==='EV'&&x.decision==='Import').length+' / LLM '+stockPreviewRows.filter(x=>x.department==='LLM'&&x.decision==='Import').length;
      $('stockImportRows').innerHTML=stockPreviewRows.slice(0,500).map(x=>'<tr><td>'+esc(x.chassis||'—')+'</td><td>'+esc(x.model)+'</td><td>'+esc(x.variant)+'</td><td>'+esc(x.segment)+'</td><td>'+esc(x.department||'Review')+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.decision)+'</td></tr>').join('')||'<tr><td colspan="7">No valid rows found.</td></tr>';
    }catch(e){console.error(e);notify(e.message);}
  };
  window.stockImportCommit = async () => {
    try{
      if(!Array.isArray(stockPreviewRows)||!stockPreviewRows.length)throw new Error('Generate Preview before uploading.');
      if(!has('common_excel_upload','create'))throw new Error('You do not have Excel Upload permission.');
      const file=$('stockReportFile')?.files?.[0];
      const ready=stockPreviewRows.filter(x=>x.decision==='Import');
      if(!ready.length)throw new Error('No new vehicles to import.');
      if(!confirm('Upload '+ready.length+' new vehicles? Existing chassis numbers and duplicate rows will be skipped.'))return;
      const records=ready.map(x=>{
        const r=x.raw||{},inv=x.date;
        let invoice=null;
        if(inv instanceof Date)invoice=inv.toISOString().slice(0,10);
        else if(typeof inv==='number'&&window.XLSX){const z=XLSX.SSF.parse_date_code(inv);if(z)invoice=new Date(Date.UTC(z.y,z.m-1,z.d)).toISOString().slice(0,10);}
        else if(inv&&!isNaN(Date.parse(inv)))invoice=new Date(inv).toISOString().slice(0,10);
        const stockType=String(x.stockType||'').trim().toUpperCase();
        return {department:x.department,chassis_number:x.chassis,excel_number:x.vin||null,model:x.model||'Unknown',variant:x.variant||null,seating:String(plHeader(r,['seating','seat'])||'')||null,colour:String(plHeader(r,['colour','color'])||'')||null,oem_invoice_date:invoice,engine_number:String(plHeader(r,['enginenumber','engine'])||'')||null,sc_name:String(plHeader(r,['scname','salesconsultant'])||'')||null,customer_name:String(plHeader(r,['customername','customer'])||'')||null,status:x.status||'Received',stage:stockType==='ALLOTED'||stockType==='ALLOTTED'?'ALLOTED':'OPEN',place:String(plHeader(r,['physicallocation','dealerlocationname'])||'')||null,source:'standard_stock_report',imported_at:new Date().toISOString(),created_by:currentUser.id};
      });
      const imported=await call(db().rpc('import_stock_vehicles',{p_rows:records,p_file_name:file?.name||'Stock Report'}));
      const skipped=stockPreviewRows.length-imported;
      const byDepartment=['Personal','EV','Commercial','LLM'];
      for(const dept of byDepartment){
        const deptRows=stockPreviewRows.filter(x=>x.department===dept);
        if(!deptRows.length)continue;
        const deptImported=records.filter(x=>x.department===dept).length;
        await call(db().from('stock_import_batches').insert({file_name:file?.name||'Stock Report',department:dept,imported_rows:deptImported,skipped_rows:deptRows.length-deptImported,error_rows:0,created_by:currentUser.id}));
      }
      await audit('common_excel_upload','create','Uploaded standard stock report','stock_import_batch',null,{imported,skipped,file:file?.name||'',departments:['Personal','EV','Commercial','LLM'].filter(d=>records.some(x=>x.department===d))});
      quotationStockCache.clear();stockPreviewRows=[];await renderStock();await loadImportHistory();
      $('stockImportSummary').textContent='Upload complete · Imported '+imported+' · Skipped '+skipped+'.';
      notify(imported+' vehicles imported; '+skipped+' duplicates or review rows skipped.');
    }catch(e){console.error(e);notify(e.message);}
  };
  window.openStockPrintPreview = () => {
    try {
      const source=$('stockTable');
      if(!source)throw new Error('Stock Register table is not available.');
      const table=source.cloneNode(true);
      table.querySelectorAll('tr').forEach(row=>{if(row.lastElementChild&&/^(ACTIONS|ACTION)$/i.test(row.lastElementChild.textContent.trim()))row.lastElementChild.remove();});
      table.querySelectorAll('button').forEach(button=>button.remove());
      const dept=typeof currentStockDepartment!=='undefined'?currentStockDepartment:'Personal';
      const selected=$('stockDepartmentFilter')?.value||'';
      const department=dept==='All'?(selected==='All Accessible Departments'?'All Accessible Departments':selected):dept;
      const status=$('stockStatusFilter')?.selectedOptions?.[0]?.textContent||'All Statuses';
      const stage=$('stockStageFilter')?.selectedOptions?.[0]?.textContent||'All Stages';
      const sort=$('stockAgeSort')?.selectedOptions?.[0]?.textContent||'Oldest Age First';
      const search=$('stockSearch')?.value?.trim()||'';
      const now=new Date();
      const printed=now.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
      const popup=window.open('','_blank','width=1200,height=850');
      if(!popup)throw new Error('Print Preview popup was blocked. Allow popups for this site and try again.');
      const safe=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
      popup.document.open();
      popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Siddhivinayak Mahindra - Stock Register</title><style>
        *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:22px;background:#eef2f7}
        .toolbar{display:flex;justify-content:flex-end;gap:10px;position:sticky;top:0;padding:10px 0;background:#eef2f7;z-index:5}
        .toolbar button{border:0;border-radius:7px;padding:11px 18px;font-weight:700;cursor:pointer;background:#dc202b;color:white}.toolbar .pdf{background:#172033}
        .sheet{background:#fff;padding:22px;border-radius:10px;box-shadow:0 3px 18px #17203318}
        .brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #dc202b;padding-bottom:12px;margin-bottom:14px}
        .brand h1{font-size:21px;margin:0 0 4px;letter-spacing:.3px}.brand .sub{font-size:11px;color:#5b6678}
        .tag{font-size:10px;letter-spacing:1.6px;color:#d71927;font-weight:800;margin-bottom:7px}
        .meta{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:10.5px;color:#344054;margin:12px 0 14px}
        .meta b{color:#172033}.count{font-size:11px;font-weight:700;margin:0 0 8px}
        table{width:100%;border-collapse:collapse;table-layout:auto;font-size:9.5px}
        thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}
        th{background:#edf1f6;color:#344054;text-transform:uppercase;font-size:8.5px;letter-spacing:.35px;text-align:left}
        th,td{border:1px solid #dce2ea;padding:7px 6px;vertical-align:middle;overflow-wrap:anywhere}
        tbody tr:nth-child(even){background:#fafbfd}
        .foot{margin-top:14px;padding-top:8px;border-top:1px solid #dce2ea;font-size:9px;color:#667085;display:flex;justify-content:space-between}
        @page{size:A4 landscape;margin:10mm}
        @media print{body{margin:0;background:white}.toolbar{display:none}.sheet{padding:0;box-shadow:none;border-radius:0}.brand h1{font-size:18px}table{font-size:8.5px}th{font-size:7.5px}th,td{padding:5px 4px}.foot{margin-top:8px}}
      </style></head><body>
      <div class="toolbar"><button onclick="window.print()">🖨 Print</button><button class="pdf" onclick="window.print()">↓ Save as PDF</button></div>
      <main class="sheet"><header class="brand"><div><div class="tag">SIDDHIVINAYAK MAHINDRA</div><h1>${safe(department)} — Stock Register</h1><div class="sub">Stock Management System · Vehicle Inventory Report</div></div><div class="sub" style="text-align:right">Generated<br>${safe(printed)}</div></header>
      <div class="meta"><span><b>Department:</b> ${safe(department)}</span><span><b>Status:</b> ${safe(status)}</span><span><b>Stage:</b> ${safe(stage)}</span><span><b>Sorting:</b> ${safe(sort)}</span>${search?'<span><b>Search:</b> '+safe(search)+'</span>':''}</div>
      <div class="count">${table.querySelectorAll('tbody tr').length===1&&table.querySelector('tbody td[colspan]')?'0':' '+table.querySelectorAll('tbody tr').length} records · Filtered Stock Register</div>
      ${table.outerHTML}<footer class="foot"><span>Siddhivinayak Mahindra · Confidential Internal Stock Report</span><span>Page <span class="page"></span></span></footer></main>
      </body></html>`);
      popup.document.close();
      popup.focus();
    } catch(error) { notify(error.message||'Unable to prepare print preview.'); }
  };
  async function renderStock(){
    if(!$('stockTable')) return;
    try{
      const dept=typeof currentStockDepartment!=='undefined'?currentStockDepartment:'Personal';
      const canEdit=canManageStock(),canDelete=canManageStock()&&has('stock_register','delete');
      const deptFilter=$('stockDepartmentFilter');
      const selectedDept=dept==='All'?(deptFilter?.value||'All Accessible Departments'):dept;
      let rows=await loadVehicles(dept==='All'&&selectedDept!=='All Accessible Departments'?selectedDept:dept);
      const search=($('stockSearch')?.value||'').trim().toLowerCase();
      const statusFilter=$('stockStatusFilter')?.value||'All';
      const stageFilter=$('stockStageFilter')?.value||'All';
      if(search) rows=rows.filter(v=>[v.chassis_number,v.model,v.variant,v.colour,v.sc_name,v.customer_name,v.status,v.stage].some(x=>String(x||'').toLowerCase().includes(search)));
      if(statusFilter!=='All') rows=rows.filter(v=>String(v.status||'').trim().toLowerCase()===statusFilter.toLowerCase());
      if(stageFilter!=='All') rows=rows.filter(v=>String(v.stage||'').trim().toUpperCase()===stageFilter.toUpperCase());
      const ageSort=$('stockAgeSort')?.value||'oldest';
      rows.sort((a,b)=>{const ta=a.oem_invoice_date?new Date(a.oem_invoice_date).getTime():NaN,tb=b.oem_invoice_date?new Date(b.oem_invoice_date).getTime():NaN;const va=Number.isFinite(ta),vb=Number.isFinite(tb);if(!va&&!vb)return 0;if(!va)return 1;if(!vb)return -1;return ageSort==='newest'?tb-ta:ta-tb;});
      const body=$('stockTable').querySelector('tbody');
      const canHold=!canManageStock()&&roleLevel()<=30&&has('stock_hold_management','create');
      body.innerHTML=rows.length?rows.map(v=>'<tr data-stock-id="'+esc(v.id)+'" tabindex="0" aria-label="Select vehicle '+esc(v.chassis_number)+'" aria-selected="'+(selectedStockVehicle?.id===v.id?'true':'false')+'" class="'+(selectedStockVehicle?.id===v.id?'selected-stock-row':'')+'"><td>'+esc(v.chassis_number)+'</td><td>'+esc([v.model,v.variant].filter(Boolean).join(' / '))+'</td><td>'+esc(v.seating||'—')+'</td><td>'+esc(v.colour||'—')+'</td><td>'+esc(v.manufacturing_year||'—')+'</td><td>'+esc(v.oem_invoice_date||'—')+'</td><td>'+(v.oem_invoice_date?Math.max(0,Math.floor((Date.now()-new Date(v.oem_invoice_date).getTime())/86400000))+' days':'—')+'</td><td>'+esc(v.sc_name||'—')+'</td><td>'+esc(v.customer_name||'—')+'</td><td>'+esc(v.status)+'</td><td>'+esc(v.stage)+'</td><td>'+(canEdit?'<button class="btn small" data-stock-edit="'+esc(v.id)+'">Edit</button>':(canHold&&String(v.stage||'').toUpperCase()==='OPEN'?'<button class="btn small" style="background:#dc2626;color:#fff;border-color:#dc2626" data-stock-hold="'+esc(v.id)+'">Hold</button>':''))+'</td></tr>').join(''):'<tr><td colspan="12" class="empty">No stock records yet.</td></tr>';
      body.querySelectorAll('tr[data-stock-id]').forEach(row=>{
        const selectRow=()=>{
          const vehicle=rows.find(x=>String(x.id)===String(row.dataset.stockId));
          if(!vehicle)return;
          selectedStockVehicle=vehicle;
          body.querySelectorAll('tr[data-stock-id]').forEach(r=>{
            const active=r===row;r.classList.toggle('selected-stock-row',active);r.setAttribute('aria-selected',active?'true':'false');
          });
          notify('Selected vehicle: '+(vehicle.chassis_number||vehicle.model));
        };
        row.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,label'))return;selectRow();});
        row.addEventListener('keydown',e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();selectRow();}});
      });
      body.querySelectorAll('[data-stock-edit]').forEach(b=>b.onclick=()=>editVehicleDialog(rows.find(x=>x.id===b.dataset.stockEdit)));
      body.querySelectorAll('[data-stock-hold]').forEach(b=>b.onclick=()=>openStockHoldDialog(rows.find(x=>x.id===b.dataset.stockHold)));

      const title=$('stockTable').closest('.card')?.querySelector('.card-head .card-title');
      if(title)title.textContent=rows.length+' records · '+(dept==='All'?(selectedDept==='All Accessible Departments'?'All accessible departments':selectedDept):dept);
      const head=$('stockTable').querySelector('thead tr');
      if(head&&head.children.length===11){const th=document.createElement('th');th.textContent='Actions';head.appendChild(th);}
    }catch(e){console.error(e);notify(e.message);}
  }
  function openStockHoldDialog(vehicle){
    if(!vehicle||String(vehicle.stage||'').toUpperCase()!=='OPEN')return;
    const old=$('svStockHoldDialog');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='svStockHoldDialog';wrap.style.cssText='position:fixed;inset:0;z-index:99992;background:#15202dcc;display:grid;place-items:center;padding:16px';
    const field=(label,value)=>'<label style="display:block;font-size:13px;color:#526174">'+label+'<input class="field" value="'+esc(value||'—')+'" readonly style="width:100%;margin-top:4px;background:#f6f8fb"></label>';
    wrap.innerHTML='<form id="svStockHoldForm" style="width:min(680px,100%);max-height:92vh;overflow:auto;background:#fff;padding:22px;border-radius:14px;color:#253140"><h3 style="margin:0 0 6px">Customer Vehicle Hold Request</h3><p style="font-size:13px;color:#64748b;margin:0 0 14px">Vehicle details are filled automatically. Enter customer details to send approval request.</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">'+field('Department',vehicle.department)+field('Chassis Number',vehicle.chassis_number)+field('Model',vehicle.model)+field('Variant',vehicle.variant)+field('Colour',vehicle.colour)+field('Seating',vehicle.seating)+field('Manufacturing Year',vehicle.manufacturing_year)+field('Vehicle Status',vehicle.status)+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><label style="font-size:13px;font-weight:650">Customer Name *<input required name="customer_name" class="field" maxlength="120" style="width:100%;margin-top:4px" placeholder="Enter customer full name"></label><label style="font-size:13px;font-weight:650">Customer Mobile *<input required name="customer_mobile" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" class="field" style="width:100%;margin-top:4px" placeholder="10-digit mobile number"></label></div><label style="display:block;margin:12px 0;font-size:13px;font-weight:650">Reason / Booking Note *<textarea required name="reason" class="field" rows="3" style="width:100%" placeholder="Enter booking or hold details"></textarea></label><div id="svStockHoldError" style="color:#c51c2a;font-size:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svStockHoldCancel" class="btn">Cancel</button><button type="submit" class="btn" style="background:#dc2626;color:#fff">Send for Approval</button></div></form>';
    document.body.appendChild(wrap);$('svStockHoldCancel').onclick=()=>wrap.remove();
    $('svStockHoldForm').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button[type=submit]');b.disabled=true;try{const values=Object.fromEntries(new FormData(e.target).entries());const mobile=String(values.customer_mobile||'').replace(/\\D/g,'');if(!/^[0-9]{10}$/.test(mobile))throw new Error('Enter a valid 10-digit customer mobile number.');await call(db().from('stock_holds').insert({vehicle_id:vehicle.id,department:vehicle.department,vehicle:vehicle.model,variant:[vehicle.variant,vehicle.colour].filter(Boolean).join(' / '),vin:vehicle.chassis_number,executive:currentProfile?.full_name||currentUser.email,reason:values.reason.trim(),customer_name:values.customer_name.trim(),customer_mobile:mobile,created_by:currentUser.id}));await audit('stock_hold_management','create','Submitted customer vehicle hold request','stock_hold',null,{chassis_number:vehicle.chassis_number,department:vehicle.department,customer_name:values.customer_name.trim()});wrap.remove();notify('Customer hold request sent to Manager for approval.');}catch(ex){$('svStockHoldError').textContent=ex.message;b.disabled=false;}};
  }
  function editVehicleDialog(vehicle){
    if(!vehicle)return;
    const existing=$('svVehicleDialog');if(existing)existing.remove();
    const labels={department:'Department',chassis_number:'Chassis Number',excel_number:'Excel Number',model:'Model',variant:'Variant',seating:'Seating',colour:'Colour',manufacturing_year:'Manufacturing Year',oem_invoice_date:'OEM Invoice Date',engine_number:'Engine Number',sc_name:'SC Name',customer_name:'Customer Name',status:'Status',stage:'Stage',place:'Place'};
    const wrap=document.createElement('div');wrap.id='svVehicleDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99990;background:#15202dcc;display:grid;place-items:center;padding:18px';
    const fields=Object.entries(labels).map(([k,label])=>{let control='';if(k==='department')control='<select class="field" name="department">'+allowedDepartmentList().map(d=>'<option value="'+esc(d)+'" '+(vehicle.department===d?'selected':'')+'>'+esc(d)+'</option>').join('')+'</select>';else if(k==='status')control='<select class="field" name="status">'+['Received','In Transit'].map(v=>'<option '+(String(vehicle.status||'').toLowerCase()===v.toLowerCase()?'selected':'')+'>'+v+'</option>').join('')+'</select>';else if(k==='stage')control='<select class="field" name="stage">'+['OPEN','ALLOTED','HOLD','DAMAGE'].map(v=>'<option '+(String(vehicle.stage||'').toUpperCase()===v?'selected':'')+'>'+v+'</option>').join('')+'</select>';else control='<input class="field" name="'+k+'" value="'+esc(vehicle[k]??'')+'" '+(k==='chassis_number'?'readonly':'')+'>';return '<label style="display:block;font-size:12px;font-weight:650">'+label+control+'</label>';}).join('');
    wrap.innerHTML='<form id="svVehicleEditForm" style="width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;padding:24px;border-radius:14px;color:#253140"><div style="font-size:18px;font-weight:850;margin-bottom:14px">Edit Stock Vehicle</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">'+fields+'</div><div id="svVehicleEditError" style="color:#c51c2a;margin:8px 0;font-size:12px"></div><div style="display:flex;justify-content:space-between;gap:8px"><button type="button" id="svVehicleDeleteInside" class="btn" style="color:#b4232c">Delete Vehicle</button><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svVehicleEditCancel" class="btn">Cancel</button><button type="submit" class="btn primary">Save Changes</button></div></div></form>';
    document.body.appendChild(wrap);
    $('svVehicleEditCancel').onclick=()=>wrap.remove();
    $('svVehicleDeleteInside').style.display=has('stock_register','delete')?'':'none';
    $('svVehicleDeleteInside').onclick=async()=>{if(!confirm('Permanently delete this vehicle?'))return;const b=$('svVehicleDeleteInside');b.disabled=true;try{await deleteVehicle(vehicle.id);wrap.remove();await renderStock();notify('Vehicle deleted.');}catch(ex){$('svVehicleEditError').textContent=ex.message;b.disabled=false;}};
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
    const addButton=$('addVehicle');
    if(addButton){addButton.style.display=canManageStock()?'':'none';addButton.disabled=!canManageStock();}
    const fields=[...form.querySelectorAll('.form-grid .field input, .form-grid .field select, .form-grid .field textarea')];
    const names=['chassis_number','excel_number','model','variant','seating','colour','manufacturing_year','oem_invoice_date','engine_number','sc_name','customer_name','status','stage','place'];
    fields.forEach((el,i)=>{if(names[i]){el.dataset.backendField=names[i];el.id='svVehicleField_'+names[i];}});
    if($('svVehicleField_manufacturing_year'))$('svVehicleField_manufacturing_year').type='number';
    const save=form.querySelector('button.primary');
    if(save) save.addEventListener('click',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      try{
        if(!canManageStock())throw new Error('Executive and junior roles cannot add stock vehicles.');
        const deptPicker=$('stockDepartmentForNewVehicle');
        const selectedDepartment=currentStockDepartment==='All'?(deptPicker?.value||''):currentStockDepartment;
        if(!selectedDepartment||!allowedDepartmentList().includes(selectedDepartment)) throw new Error('Select a department you are authorized to access.');
        const obj={department:selectedDepartment};
        fields.forEach(el=>{const k=el.dataset.backendField;if(k)obj[k]=el.value||null;});
        if(!obj.chassis_number||!obj.model) throw new Error('Chassis Number and Model are required.');
        if(obj.manufacturing_year)obj.manufacturing_year=Number(obj.manufacturing_year);
        if(!obj.status)obj.status='Received / In Stock';
        if(!obj.stage)obj.stage='OPEN';
        await saveVehicle(obj);form.style.display='none';form.querySelectorAll('input').forEach(x=>x.value='');form.querySelectorAll('select').forEach(x=>x.selectedIndex=0);await renderStock();notify('Vehicle saved to Supabase.');
      }catch(ex){notify(ex.message);}
    },true);
  }
  async function createEmployee(fields){
    if(!currentProfile?.is_super_admin&&!has('employee_management','create')) throw new Error('You do not have Create Employee permission.');
    const {data:{session}}=await db().auth.getSession();
    const {data,error}=await db().functions.invoke('employee-admin',{body:{action:'create_employee',...fields},headers:{Authorization:'Bearer '+session.access_token}});
    if(error){
      let message=error.message||'Employee account creation failed.';
      try{const payload=await error.context?.clone?.().json();if(payload?.error)message=payload.error;}catch{}
      if(/email_exists|already.*registered|already.*exists/i.test(message))message='આ Emailથી કર્મચારીનું Login પહેલેથી બનાવેલું છે. Employee Directoryમાં તે નામ પર ક્લિક કરીને Edit કરો.';
      throw new Error(message);
    }
    if(data?.error) throw new Error(data.error);
    await loadEmployees();return data;
  }
  const ROLE_MODULES_UI={
    'Admin':['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','employee_management','common_excel_upload','backup_restore','audit_history','retail_reports'],
    'General Manager':['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','employee_management','common_excel_upload','backup_restore','audit_history','retail_reports'],
    'Manager':['dashboard','stock_register','stock_hold_management','quotation_management','employee_management','price_list_management','common_excel_upload','backup_restore','retail_reports'],
    'Accountant':['price_list_management','retail_reports','common_excel_upload'],
    'HR':['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','employee_management','common_excel_upload','backup_restore','retail_reports'],
    'DMS':['price_list_management','retail_reports','common_excel_upload'],
    'Executive':['dashboard','stock_register','stock_hold_management','quotation_management','price_list_management','retail_reports'],
    'Reception':['dashboard','stock_register','stock_hold_management','quotation_management','price_list_management','retail_reports'],
    'Driver':['stock_register']
  };
  const MODULE_LABELS_UI={dashboard:'Dashboard',stock_register:'Stock Register',stock_hold_management:'Stock Hold Management',price_list_management:'Price List',quotation_management:'Quotation',employee_management:'Employee Management',common_excel_upload:'Excel Upload',backup_restore:'Backup & Restore',audit_history:'Audit History',retail_reports:'Retail Reports'};
  function moduleAccessMarkup(role,selected=[]){
    const allowed=ROLE_MODULES_UI[role]||[];
    return '<fieldset style="border:1px solid #dce2e9;border-radius:8px;padding:10px;margin-top:12px"><legend style="font-size:13px;font-weight:700">Function Access</legend><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">'+allowed.map(m=>'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="module_access" value="'+m+'" '+(selected.includes(m)?'checked':'')+'>'+MODULE_LABELS_UI[m]+'</label>').join('')+'</div><small style="color:#718096;display:block;margin-top:8px">Only selected functions will appear in this employee login.</small></fieldset>';
  }
  async function editEmployeeDialog(profile){
    if(profile.is_super_admin){notify('Super Admin profile cannot be edited here.');return;}
    const old=$('svEmployeeDialog');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='svEmployeeDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99990;background:#15202dcc;display:grid;place-items:center;padding:18px';
    const input=(name,label,value,type='text')=>'<label style="display:block;font-size:13px;font-weight:650">'+label+'<input '+(type==='tel'?'type="tel" inputmode="numeric" maxlength="10"':'type="text"')+' name="'+name+'" class="field" value="'+esc(value||'')+'" style="width:100%;margin-top:5px"></label>';
    const selected=profile.department_access?.length?profile.department_access:[profile.department].filter(Boolean);
    const departments='<fieldset style="border:1px solid #dce2e9;border-radius:8px;padding:10px"><legend style="font-size:13px;font-weight:650">Department Access</legend>'+['Personal','EV','Commercial','LLM'].map(x=>'<label style="display:inline-flex;gap:5px;align-items:center;margin:5px 10px 5px 0"><input type="checkbox" name="department_access" value="'+x+'" '+(selected.includes(x)?'checked':'')+'>'+x+'</label>').join('')+'</fieldset>';
    wrap.innerHTML='<form id="svEmployeeForm" style="width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;padding:24px;border-radius:14px;color:#253140"><div style="font-size:18px;font-weight:850;margin-bottom:14px">Edit Employee Details</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+input('full_name','Employee Name',profile.full_name)+input('phone','Mobile Number',profile.phone,'tel')+'<label style="display:block;font-size:13px;font-weight:650">New Password (leave blank to keep current)<input type="password" name="password" minlength="6" autocomplete="new-password" class="field" style="width:100%;margin-top:5px"></label><label style="display:block;font-size:13px;font-weight:650">Designation / Role<select name="designation" id="svEditRole" class="field" style="width:100%;margin-top:5px">'+Object.keys(ROLE_MODULES_UI).concat(['Super Admin']).map(x=>'<option value="'+x+'" '+(profile.designation===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+departments+'<label style="display:block;font-size:13px;font-weight:650">Account Status<select name="status" class="field" style="width:100%;margin-top:5px"><option value="active" '+(profile.status==='active'?'selected':'')+'>Active</option><option value="inactive" '+(profile.status!=='active'?'selected':'')+'>Inactive</option></select></label><label style="display:block;font-size:13px;font-weight:650">City<select name="city" class="field" style="width:100%;margin-top:5px"><option value="">Select City</option>'+['Bhavnagar','Amreli','Botad','Rajula'].map(x=>'<option value="'+x+'" '+(profile.city===x?'selected':'')+' >'+x+'</option>').join('')+'</select></label><label style="display:block;font-size:13px;font-weight:650">Email (read only)<input class="field" value="'+esc(profile.email||'')+'" readonly style="width:100%;margin-top:5px"></label></div><div id="svEmployeeError" style="color:#c51c2a;margin:8px 0;font-size:12px"></div><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><button type="button" id="svEmployeeDelete" class="btn" style="border-color:#efb7bc;color:#b4232c;background:#fff7f7">Delete User</button><div style="display:flex;gap:8px"><button type="button" id="svEmployeeCancel" class="btn">Cancel</button><button class="btn primary" type="submit">Save Changes</button></div></div></form>';
    document.body.appendChild(wrap);
    $('svEmployeeCancel').onclick=()=>wrap.remove();
    const applyEditRole=()=>{
      const role=$('svEditRole').value,selectedModules=[...(ROLE_MODULES_UI[role]||[])];
      const moduleField=wrap.querySelector('fieldset:has(input[name="module_access"])');
      if(moduleField)moduleField.outerHTML=moduleAccessMarkup(role,selectedModules);
      wrap.querySelectorAll('input[name="department_access"]').forEach(c=>c.disabled=false);
    };
    applyEditRole();
    $('svEditRole').addEventListener('change',applyEditRole);
    $('svEmployeeDelete').onclick=async()=>{
      if(!confirm('Delete '+(profile.full_name||profile.email)+'? This removes the account from Employee Directory and blocks login. Historical stock, quotation and audit records will be preserved.'))return;
      const button=$('svEmployeeDelete');button.disabled=true;button.textContent='Deleting…';
      try{
        const {data:{session}}=await db().auth.getSession();
        const {data,error}=await db().functions.invoke('employee-admin',{body:{action:'delete_employee',user_id:profile.user_id},headers:{Authorization:'Bearer '+session.access_token}});
        if(error)throw error;if(data?.error)throw new Error(data.error);
        wrap.remove();await loadEmployees();notify('Employee deleted. Historical records preserved.');
      }catch(ex){$('svEmployeeError').textContent=ex.message;button.disabled=false;button.textContent='Delete User';}
    };
    $('svEmployeeForm').onsubmit=async e=>{
      e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;
      try{
        const fd=new FormData(e.target),fields=Object.fromEntries(fd.entries());fields.department_access=fd.getAll('department_access');
        if(!fields.full_name.trim())throw new Error('Employee name is required.');
        if(fields.phone&&!/^\\d{10}$/.test(fields.phone.trim()))throw new Error('Enter a valid 10-digit mobile number.');
        const {data:{session}}=await db().auth.getSession();
        const {data,error}=await db().functions.invoke('employee-admin',{body:{action:'update_employee',user_id:profile.user_id,...fields},headers:{Authorization:'Bearer '+session.access_token}});
        if(error)throw error;if(data?.error)throw new Error(data.error);
        wrap.remove();await renderEmployees();notify('Employee details updated.');
      }catch(ex){$('svEmployeeError').textContent=ex.message;button.disabled=false;}
    };
  }
  function employeeDialog(){
    const old=$('svEmployeeDialog');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='svEmployeeDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99990;background:#15202dcc;display:grid;place-items:center;padding:12px';
    const roles=['Admin','General Manager','Manager','Accountant','HR','DMS','Executive','Reception','Driver'];
    const depts=allowedDepartmentList();
    const canGrantAll=!!currentProfile?.is_super_admin||['Admin','General Manager'].includes(currentProfile?.designation);
    const canGrantOperational=['Manager','HR'].includes(currentProfile?.designation);
    const allowedModules=new Set(EMPLOYEE_MENU_GROUPS.flatMap(g=>g.items.map(x=>x[0])).filter(m=>canGrantAll||(canGrantOperational&&m!=='audit_history')));
    const deptRows=depts.map(x=>'<label style="display:flex;gap:5px;align-items:center;padding:8px;border:1px solid #edf0f3;border-radius:8px"><input type="checkbox" name="department_access" value="'+x+'">'+x+'</label>').join('');
    const moduleRows=EMPLOYEE_MENU_GROUPS.filter(group=>group.title!=='Dashboard').map(group=>{const items=group.items.filter(([m])=>allowedModules.has(m));return items.length?'<section style="border:1px solid #e1e6ed;border-radius:10px;padding:12px;margin:12px 0"><h3 style="margin:0 0 10px;font-size:14px">'+group.title+'</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">'+items.map(([m,label])=>'<label style="display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #edf0f3;border-radius:8px"><input type="checkbox" name="module_access" value="'+m+'"><span>'+label+'</span></label>').join('')+'</div></section>':'';}).join('');
    const shortcutRows=DASHBOARD_SHORTCUTS.map(([v,label])=>'<label style="display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #edf0f3;border-radius:8px"><input type="checkbox" name="dashboard_shortcuts" value="'+v+'"><span>'+label+'</span></label>').join('');
    const dashboardRows='<section style="border:1px solid #e1e6ed;border-radius:10px;padding:12px;margin:12px 0"><h3 style="margin:0 0 10px;font-size:14px">Dashboard</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px"><label style="display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #edf0f3;border-radius:8px"><input type="checkbox" name="module_access" value="dashboard"><span>Dashboard</span></label>'+shortcutRows+'</div></section>';
    wrap.innerHTML='<form id="svEmployeeForm" style="width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;padding:18px;border-radius:14px;color:#253140"><div style="font-size:20px;font-weight:850;margin-bottom:14px">Create Employee Login</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px"><label>Full Name<input required name="full_name" class="field" autocomplete="off"></label><label>Email<input required type="email" name="email" class="field" autocomplete="off"></label><label>Password<input required type="password" name="password" class="field" minlength="6" autocomplete="new-password"></label><label>Designation / Role<select required name="designation" id="svNewRole" class="field"><option value="">Select role</option>'+roles.map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select></label></div><section style="border:1px solid #e1e6ed;border-radius:10px;padding:12px;margin:12px 0"><h3 style="margin:0 0 10px;font-size:14px">Department Access</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">'+deptRows+'</div></section><div id="svCreateModulePermissions">'+moduleRows+'</div>'+dashboardRows+'<div style="font-size:12px;color:#718096;margin-top:8px">Selected departments automatically include all four department functions. Workspace modules and Dashboard Quick Access are assigned separately. Change Password is always available.</div><div id="svEmployeeError" style="color:#c51c2a;margin:8px 0;font-size:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svEmployeeCancel" class="btn">Cancel</button><button class="btn primary" type="submit">Create User</button></div></form>';
    document.body.appendChild(wrap);
    $('svEmployeeCancel').onclick=()=>wrap.remove();
    $('svEmployeeForm').onsubmit=async e=>{
      e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;button.textContent='Creating…';
      try{
        const fd=new FormData(e.target),fields=Object.fromEntries(fd.entries());
        fields.department_access=fd.getAll('department_access');
        fields.modules=fd.getAll('module_access');
        fields.dashboard_shortcuts=fd.getAll('dashboard_shortcuts');
        if(String(fields.password||'').length<6)throw new Error('Password must be at least 6 characters.');
        if(!fields.department_access.length)throw new Error('Select at least one department.');
        const result=await createEmployee(fields);wrap.remove();notify('User created with selected permissions: '+result.email);await renderEmployees();
      }catch(ex){$('svEmployeeError').textContent=ex.message;button.disabled=false;button.textContent='Create User';}
    };
  }
  async function loadImportHistory(){
    if(!has('common_excel_upload','view'))return;
    const rows=await call(db().from('stock_import_batches').select('*').order('created_at',{ascending:false}).limit(500));
    const body=$('view-upload')?.querySelector('.card:last-child .table-wrap tbody');if(!body)return;
    body.innerHTML=rows.length?rows.map(r=>'<tr><td>'+esc(r.file_name)+'</td><td><span class="pill green">Imported</span></td><td>'+Number(r.imported_rows||0)+'</td><td>'+Number(r.skipped_rows||0)+'</td><td>'+Number(r.error_rows||0)+'</td><td>'+new Date(r.created_at).toLocaleString()+'</td></tr>').join(''):'<tr><td colspan="6" class="empty">No import history yet.</td></tr>';
  }
  // Department functions are inherited automatically from Department Access.
  const EMPLOYEE_MENU_GROUPS = [
    {title:'Workspace',items:[
      ['price_list_management','Price List'],['employee_management','Employee Management'],
      ['audit_history','Audit History'],['retail_reports','Retail Reports'],
      ['common_excel_upload','Common Excel Upload'],['backup_restore','Backup & Restore']
    ]},
    {title:'Dashboard',items:[['dashboard','Dashboard']]}
  ];
  const DASHBOARD_SHORTCUTS=[['quick-access','Quick Access']];
  async function openEmployeePermissions(profile){
    if(!has('employee_management','manage_users')){notify('Manage Users permission required.');return;}
    if(!currentUser||profile.user_id===currentUser.id){notify('You cannot change your own permissions. Ask your superior.');return;}
    if(profile.is_super_admin){notify('Super Admin permissions cannot be changed.');return;}
    const roleLevel={'Super Admin':100,'Admin':90,'General Manager':80,'Manager':70,'Accountant':60,'HR':50,'DMS':40,'Executive':30,'Reception':20,'Driver':10};
    const myRole=currentProfile?.is_super_admin?'Super Admin':String(currentProfile?.designation||'');
    if((roleLevel[profile.designation]??0)>=(roleLevel[myRole]??0)&&!currentProfile?.is_super_admin){notify('You can manage only employees below your designation.');return;}
    const canGrantAll=!!currentProfile?.is_super_admin||myRole==='Admin'||myRole==='General Manager';
    const canGrantOperational=myRole==='Manager'||myRole==='HR';
    const grantable=new Set(EMPLOYEE_MENU_GROUPS.flatMap(g=>g.items.map(x=>x[0])).filter(m=>m!=='audit_history'||canGrantAll).filter(m=>canGrantAll||canGrantOperational));
    const [currentRows]=await Promise.all([call(db().from('employee_permissions').select('module').eq('user_id',profile.user_id))]);
    const selected=new Set(currentRows.map(x=>x.module));
    const departments=['Personal','EV','Commercial','LLM'];
    const selectedDepartments=new Set(profile.department_access?.length?profile.department_access:[profile.department].filter(Boolean));
    const selectedShortcuts=new Set(Array.isArray(profile.dashboard_shortcuts)&&profile.dashboard_shortcuts.length?['quick-access']:[]);
    const wrap=document.createElement('div');wrap.id='svPermissionDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99991;background:#15202dcc;display:grid;place-items:center;padding:12px';
    const checkRows=(name,items,chosen,disabledSet)=>items.map(([value,label])=>'<label style="display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #edf0f3;border-radius:8px"><input type="checkbox" name="'+name+'" value="'+value+'" '+(chosen.has(value)?'checked':'')+' '+(disabledSet&&!disabledSet.has(value)?'disabled':'')+'><span>'+label+'</span></label>').join('');
    const deptRows=checkRows('employee_department',departments.map(x=>[x,x]),selectedDepartments,new Set(allowedDepartmentList()));
    const moduleRows=EMPLOYEE_MENU_GROUPS.filter(group=>group.title!=='Dashboard').map(group=>{const items=group.items.filter(([module])=>grantable.has(module));return items.length?'<section style="border:1px solid #e1e6ed;border-radius:10px;padding:12px;margin:12px 0"><h3 style="margin:0 0 10px;font-size:14px">'+group.title+'</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">'+checkRows('employee_module',items,selected,null)+'</div></section>':'';}).join('');
    const shortcutRows=checkRows('employee_shortcut',DASHBOARD_SHORTCUTS,selectedShortcuts,null);
    const dashboardRows='<section style="border:1px solid #e1e6ed;border-radius:10px;padding:12px;margin:12px 0"><h3 style="margin:0 0 10px;font-size:14px">Dashboard</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">'+checkRows('employee_module',[['dashboard','Dashboard']],selected,null)+shortcutRows+'</div></section>';
    wrap.innerHTML='<div style="width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;padding:18px;border-radius:14px;color:#253140"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><h2 style="font-size:19px;margin:0 0 5px">Employee Access Settings</h2><div style="font-size:13px;color:#64748b">'+esc(profile.full_name||profile.email)+'</div></div><button type="button" id="svPermissionClose" class="btn">✕</button></div><p style="font-size:12px;color:#64748b;margin:12px 0">Selected departments automatically include all four department functions. Workspace access is controlled separately. Change Password is always available.</p><section style="border:1px solid #e1e6ed;border-radius:10px;padding:12px;margin:12px 0"><h3 style="margin:0 0 10px;font-size:14px">Department Access</h3><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">'+deptRows+'</div></section><div id="svPermissionList">'+moduleRows+'</div>'+dashboardRows+'<div id="svPermissionError" style="color:#c51c2a;font-size:12px;margin:8px 0"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svPermissionCancel" class="btn">Cancel</button><button type="button" id="svPermissionSave" class="btn primary">Save Access</button></div></div>';
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();$('svPermissionClose').onclick=close;$('svPermissionCancel').onclick=close;
    $('svPermissionSave').onclick=async()=>{
      const button=$('svPermissionSave');button.disabled=true;button.textContent='Saving…';
      try{
        const workspaceModules=[...new Set([...wrap.querySelectorAll('input[name="employee_module"]:checked')].map(x=>x.value))];
        const departments=[...new Set([...wrap.querySelectorAll('input[name="employee_department"]:checked')].map(x=>x.value))];
        const modules=[...new Set([...workspaceModules,...(departments.length?['stock_register','stock_hold_management','quotation_management']:[])])];
        const dashboard_shortcuts=[...new Set([...wrap.querySelectorAll('input[name="employee_shortcut"]:checked')].map(x=>x.value))];
        const {data:{session}}=await db().auth.getSession();
        const {data,error}=await db().functions.invoke('employee-admin',{body:{action:'save_employee_permissions',user_id:profile.user_id,modules,departments,dashboard_shortcuts},headers:{Authorization:'Bearer '+session.access_token}});
        if(error)throw error;if(data?.error)throw new Error(data.error);
        notify('Employee access saved.');close();await renderEmployees();
      }catch(e){$('svPermissionError').textContent=e.message||'Could not save access';button.disabled=false;button.textContent='Save Access';}
    };
  }
  async function renderEmployees(){
    if(!has('employee_management','view')&&!currentProfile?.is_super_admin) return;
    let rows=[],from=0,chunk=1000;
    while(true){
      const part=await call(db().from('profiles').select('*').order('full_name').range(from,from+chunk-1));
      rows.push(...part);if(part.length<chunk)break;from+=chunk;
    }
    const section=$('view-employees');if(!section)return;
    rows=rows.filter(p=>!p.deleted_at);
    const designationFilter=section.querySelector('#svEmployeeDesignationFilter')?.value||'';
    const cityFilter=section.querySelector('#svEmployeeCityFilter')?.value||'';
    if(currentProfile?.designation==='Manager'){
      const managerDepartments=new Set(allowedDepartmentList().map(x=>String(x).toLowerCase()));
      rows=rows.filter(p=>{
        const employeeDepartments=(Array.isArray(p.department_access)&&p.department_access.length?p.department_access:[p.department].filter(Boolean)).map(x=>String(x).toLowerCase());
        return employeeDepartments.some(d=>managerDepartments.has(d));
      });
    }
    const roleOrder={'Super Admin':0,'Admin':1,'General Manager':2,'Manager':3,'Accountant':4,'HR':5,'DMS':6,'Executive':7,'Reception':8,'Receptionist':8,'Driver':9};
    const cityOrder={'Bhavnagar':0,'Amreli':1,'Botad':2,'Rajula':3};
    rows.sort((a,b)=>{
      const ar=a.is_super_admin?'Super Admin':(a.designation||''),br=b.is_super_admin?'Super Admin':(b.designation||'');
      const rank=(roleOrder[ar]??99)-(roleOrder[br]??99);if(rank)return rank;
      if(ar==='Manager'&&br==='Manager'){
        const city=(cityOrder[a.city]??99)-(cityOrder[b.city]??99);if(city)return city;
      }
      return String(a.full_name||'').localeCompare(String(b.full_name||''));
    });
    if(designationFilter)rows=rows.filter(p=>(p.is_super_admin?'Super Admin':(p.designation||''))===designationFilter);
    if(cityFilter)rows=rows.filter(p=>p.city===cityFilter);
    const cards=section.querySelectorAll('.stat-grid .stat-value');
    if(cards[0])cards[0].textContent=rows.length;
    if(cards[1])cards[1].textContent=rows.filter(p=>p.status==='active').length;
    if(cards[2])cards[2].textContent=rows.filter(p=>p.status!=='active').length;
    const pill=section.querySelector('.card-head .pill');if(pill)pill.textContent=rows.length+' users';
    const table=section.querySelector('.card .table-wrap tbody');
    if(table) table.innerHTML=rows.length?rows.map(p=>{
      const designation=p.is_super_admin?'Super Admin':(p.designation||'—');
      const access=p.is_super_admin?'Personal · EV · Commercial · LLM':((p.department_access?.length?p.department_access:[p.department].filter(Boolean)).join(' · ')||'—');
      const canEditThis=has('employee_management','edit')&&!p.is_super_admin&&p.user_id!==currentUser.id;
      const canManageThis=has('employee_management','manage_users')&&!p.is_super_admin&&p.user_id!==currentUser.id;
      return '<tr><td>'+(canEditThis?'<button type="button" class="btn small" data-edit="'+esc(p.user_id)+'" style="padding:2px 0;background:transparent;border:0;color:#26384d;text-decoration:underline;font-weight:750">'+esc(p.full_name||'—')+'</button>':esc(p.full_name||'—'))+'</td><td>'+esc(p.phone||'—')+'<br><span class="muted">'+esc(p.email||'')+'</span></td><td>'+esc(designation==='Reception'?'Receptionist':designation)+'</td><td>'+esc(p.city||'—')+'</td><td>'+esc(access)+'</td><td><span class="pill '+(p.status==='active'?'green':'red')+'">'+esc(p.status||'inactive')+'</span></td><td>'+(canManageThis?'<button type="button" class="btn small" data-permissions="'+esc(p.user_id)+'">Permissions</button>':'—')+'</td></tr>';
    }).join(''):'<tr><td colspan="7" class="empty">No employees yet.</td></tr>';
    table?.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>{
      const p=rows.find(x=>x.user_id===btn.dataset.edit);if(p)editEmployeeDialog(p).catch(e=>notify(e.message));
    }));
    table?.querySelectorAll('[data-permissions]').forEach(btn=>btn.addEventListener('click',()=>{
      const p=rows.find(x=>x.user_id===btn.dataset.permissions);if(p)openEmployeePermissions(p).catch(e=>notify(e.message));
    }));
  }
  window.holdRender = async () => {
    try{
      if(!has('stock_hold_management','view'))throw new Error('You do not have permission to view Stock Hold Management.');
      let rows=[],from=0,chunk=1000;
      while(true){
        const part=await call(db().from('stock_holds').select('*').order('created_at',{ascending:false}).range(from,from+chunk-1));
        rows.push(...part);if(part.length<chunk)break;from+=chunk;
      }
      holdItems=rows.map(x=>({...x,id:x.id,date:x.created_at,dept:x.department,approver:x.approver_id||'—',approvedAt:x.approved_at||'—'}));
      const permitted=allowedDepartmentList();
      const formDept=$('holdDept');
      if(formDept){const current=formDept.value;formDept.innerHTML=permitted.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');if(permitted.includes(current))formDept.value=current;}
      const deptFilter=$('holdDeptFilter');
      if(deptFilter){const current=deptFilter.value;deptFilter.innerHTML='<option>All Departments</option>'+permitted.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');if(permitted.includes(current))deptFilter.value=current;else deptFilter.value='All Departments';}
      const f=$('holdStatusFilter')?.value||'All',d=$('holdDeptFilter')?.value||'All Departments';
      const filtered=holdItems.filter(x=>(f==='All'||x.status===f||(f==='On Hold'&&x.status==='Approved'))&&(d==='All Departments'||x.dept===d));
      $('holdRows').innerHTML=filtered.length?filtered.map(x=>'<tr><td>'+new Date(x.date).toLocaleDateString()+'</td><td>'+esc(x.dept)+'</td><td>'+esc(x.vehicle)+'</td><td>'+esc(x.variant||'—')+'</td><td>'+esc(x.vin)+'</td><td>'+esc(x.customer_name||'—')+'</td><td>'+esc(x.customer_mobile||'—')+'</td><td>'+esc(x.executive||'—')+'</td><td>'+esc(x.reason)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.approver)+'<br>'+esc(x.approvedAt)+'</td><td>'+(canManageHolds()&&has('stock_hold_management','approve')&&x.status==='Pending'?'<button class="btn small" data-hold-approve="'+esc(x.id)+'">Approve</button> <button class="btn small" data-hold-reject="'+esc(x.id)+'">Reject</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="12">No matching requests.</td></tr>';
      $('holdPendingCount').textContent=rows.filter(x=>x.status==='Pending').length;
      $('holdApprovedCount').textContent=rows.filter(x=>x.status==='Approved').length;
      $('holdRejectedCount').textContent=rows.filter(x=>x.status==='Rejected').length;
      let currentlyOnHold=0;
      if(permitted.length){const {count,error}=await db().from('vehicles').select('id',{count:'exact',head:true}).in('department',permitted).eq('stage','HOLD');if(error)throw error;currentlyOnHold=count||0;}
      $('holdOnCount').textContent=currentlyOnHold;
      renderSelectedStockContext();
      $('holdRows').querySelectorAll('[data-hold-approve]').forEach(b=>b.onclick=()=>decideHold(b.dataset.holdApprove,'Approved').catch(e=>notify(e.message)));
      $('holdRows').querySelectorAll('[data-hold-reject]').forEach(b=>b.onclick=()=>decideHold(b.dataset.holdReject,'Rejected').catch(e=>notify(e.message)));
    }catch(e){console.error(e);notify(e.message);}
  };
  function renderSelectedStockContext(){
    const box=$('selectedStockHoldContext');if(!box)return;
    const v=selectedStockVehicle;
    if(!v){box.hidden=true;box.innerHTML='';return;}
    const field=(label,value)=>'<div class="ssc-field"><span class="ssc-label">'+label+'</span><span class="ssc-value">'+esc(value||'—')+'</span></div>';
    const canSubmit=!canManageStock()&&roleLevel()<=30&&has('stock_hold_management','create')&&String(v.stage||'').toUpperCase()==='OPEN';
    box.hidden=false;
    box.innerHTML='<div class="ssc-head"><span class="ssc-title">SELECTED VEHICLE FROM STOCK REGISTER</span><button type="button" class="ssc-clear" id="clearSelectedStockContext">Clear selection ×</button></div><div class="ssc-grid">'+field('Department',v.department)+field('Chassis Number',v.chassis_number)+field('Model',v.model)+field('Variant',v.variant)+field('Colour',v.colour)+field('Stock Stage',v.stage)+'</div>'+(canSubmit?'<div class="ssc-actions"><button type="button" class="ssc-request" id="requestSelectedStockHold">Create Hold Request →</button></div>':'');
    $('clearSelectedStockContext').onclick=()=>{selectedStockVehicle=null;renderSelectedStockContext();document.querySelectorAll('#stockTable tbody tr.selected-stock-row').forEach(r=>{r.classList.remove('selected-stock-row');r.setAttribute('aria-selected','false');});};
    $('requestSelectedStockHold')?.addEventListener('click',()=>openStockHoldDialog(v));
  }
  window.holdDecision = (id,decision) => decideHold(id,decision).catch(e=>notify(e.message));
  window.openDepartmentStock = (department) => {
    currentStockDepartment=department||'Personal';
    const deptFilter=$('stockDepartmentFilter');if(deptFilter){deptFilter.value='All Accessible Departments';deptFilter.style.display='none';}
    const deptPicker=$('stockDepartmentForNewVehicle');if(deptPicker){deptPicker.value=currentStockDepartment;deptPicker.disabled=true;}
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

  async function changeOwnPassword(currentPassword,newPassword){
    if(!currentUser?.email) throw new Error('You must be signed in to change your password.');
    if(!currentPassword||!newPassword) throw new Error('Enter your current and new password.');
    if(newPassword.length<8) throw new Error('New password must be at least 8 characters.');
    if(currentPassword===newPassword) throw new Error('New password must be different from the current password.');
    // Re-authenticate so the current password is actually verified before changing credentials.
    const {data,error:reauthError}=await db().auth.signInWithPassword({email:currentUser.email,password:currentPassword});
    if(reauthError||!data?.user||data.user.id!==currentUser.id) throw new Error('Current password is incorrect.');
    const {error:updateError}=await db().auth.updateUser({password:newPassword});
    if(updateError) throw updateError;
    await audit('employee_management','edit','Changed own password','auth_account',currentUser.id,{method:'self_service'});
    const form=$('svChangePasswordForm');
    if(form) form.reset();
    notify('Password changed successfully.');
  }

  // UI bindings for existing elements whose original handlers were demo-only.
  function installScreenHooks(){
    mapStockForm();
    const employeeSection=$('view-employees');
    const employeeStats=employeeSection?.querySelector('.stat-grid');
    let newUser=$('svNewEmployee')||employeeStats?.querySelector('.btn.primary');
    // Keep the Create User entry point present even if an older deployed HTML shell omitted it.
    if(!newUser&&employeeStats){
      const slot=document.createElement('div');
      slot.style.cssText='margin-left:auto;align-self:center';
      slot.innerHTML='<button class="btn primary" type="button" id="svNewEmployee">＋ Create User</button>';
      employeeStats.appendChild(slot);
      newUser=$('svNewEmployee');
    }
    if(newUser){
      const canCreate=!!currentProfile?.is_super_admin||has('employee_management','create')||has('employee_management','manage_users');
      newUser.style.display=canCreate?'':'none';
      newUser.textContent='＋ Create User';
      if(canCreate&&!newUser.dataset.createUserBound){
        newUser.dataset.createUserBound='1';
        newUser.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();employeeDialog();},true);
      }
    }
    $('svChangePasswordForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const form=e.currentTarget,button=form.querySelector('button[type="submit"]');
      const error=$('svChangePasswordError');
      const current=$('svCurrentPassword')?.value||'';
      const next=$('svNewPassword')?.value||'';
      const confirmPassword=$('svConfirmPassword')?.value||'';
      if(error)error.textContent='';
      if(next!==confirmPassword){if(error)error.textContent='New password and confirmation do not match.';return;}
      if(button){button.disabled=true;button.textContent='Updating…';}
      try{await changeOwnPassword(current,next);}
      catch(ex){if(error)error.textContent=ex.message||'Could not change password.';}
      finally{if(button){button.disabled=false;button.textContent='Change Password';}}
    });
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
      if(buttons[1])buttons[1].addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();void audit('audit_history','export','Printed audit history');window.print();},true);
    }
    const permittedDepartments=allowedDepartmentList();
    const stockFilter=$('stockDepartmentFilter');
    if(stockFilter){const current=stockFilter.value;stockFilter.innerHTML='<option>All Accessible Departments</option>'+permittedDepartments.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');if(permittedDepartments.includes(current))stockFilter.value=current;stockFilter.onchange=()=>renderStock();}
    $('stockAgeSort')?.addEventListener('change',()=>renderStock());
    const addButton=$('addVehicle');if(addButton){addButton.style.display=canManageStock()?'':'none';addButton.disabled=!canManageStock();}
    const newVehicleDept=$('stockDepartmentForNewVehicle');
    if(newVehicleDept){newVehicleDept.innerHTML=permittedDepartments.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');newVehicleDept.value=permittedDepartments[0]||'';}
    $('holdStatusFilter')?.addEventListener('change',()=>window.holdRender());
    $('holdDeptFilter')?.addEventListener('change',()=>window.holdRender());
    // Let the original UI's own click handlers perform navigation.
    // A document-level CAPTURE listener with stopImmediatePropagation was blocking
    // the existing button handlers, making otherwise valid controls appear dead.
    // Observe navigation in the bubble phase only, then refresh the selected module.
    document.addEventListener('click',e=>{
      const quick=e.target?.closest?.('.quick[data-go]');
      if(quick?.dataset.go==='stock-hold-central') setTimeout(()=>window.holdRender?.(),0);
      if(quick?.dataset.go==='stock'){
        currentStockDepartment='All';
        if($('stockPageTitle'))$('stockPageTitle').textContent='All Accessible Departments — Stock Register';
        if($('stockPageSubtitle'))$('stockPageSubtitle').textContent='Combined live stock across your authorized departments';
        const picker=$('stockDepartmentForNewVehicle');if(picker)picker.disabled=false;
        const filter=$('stockDepartmentFilter');if(filter){filter.value='All Accessible Departments';filter.style.display='';}
        setTimeout(()=>renderStock(),0);
      }
      const b=e.target?.closest?.('[data-page]');
      if(!b)return;
      const p=b.dataset.page||'';
      if(p.startsWith('stock-hold')&&!has('stock_hold_management','view')){e.preventDefault();e.stopImmediatePropagation();notify('You do not have permission to view Stock Hold Management.');return;}
      setTimeout(()=>{
        if(p==='employees')renderEmployees().catch(x=>notify(x.message));
        if(p==='audit')loadAudit().catch(x=>notify(x.message));
        if(p==='upload')loadImportHistory().catch(x=>notify(x.message));
        if(p==='price-list')loadPriceLists().catch(x=>notify(x.message));
        if(p==='quotation-management'||p==='ev-management'||p==='commercial-management'||p==='llm-management')reloadQuoteList().catch(x=>notify(x.message));
        if(p.startsWith('stock-')&&!p.startsWith('stock-hold-'))renderStock();
        if(p.startsWith('stock-hold-')||p==='stock-hold-central')window.holdRender();
        if(p==='reports')loadRetailReport();
      },0);
    },false);
    const originalOpen=window.openDepartmentStock;
    if(originalOpen)window.openDepartmentStock=function(...args){const x=originalOpen.apply(this,args);setTimeout(()=>renderStock(),0);return x;};
    const originalImportPreview=window.stockImportPreview;
    // Keep the original workbook preview parser; only its commit action is replaced above.
    if($('stockSearch'))$('stockSearch').addEventListener('input',()=>renderStock());
    $('stockStatusFilter')?.addEventListener('change',()=>renderStock());
    $('stockStageFilter')?.addEventListener('change',()=>renderStock());
    $('view-stock')?.querySelector('.page-head button')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();renderStock();},true);
    void originalImportPreview;
  }
  async function init() {
    if(!window.supabase?.createClient) throw new Error('Supabase JavaScript SDK failed to load.');
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    // Supabase is the source of truth; remove local demo workspace caches on startup.
    ['sv_quote_records_clean_v2','sv_quotes_by_department_clean_v3','svm_clean_workspace_v2'].forEach(k=>{try{localStorage.removeItem(k);}catch(_e){}});
      try { localStorage.removeItem(quoteStoreKey); localStorage.removeItem(DEPT_QUOTE_KEY); } catch(_e) {}
      // Don't migrate browser records automatically; only explicit new Supabase records are used.
    installScreenHooks();
    const plHead=document.querySelector('.pl-head-actions');if(plHead)plHead.style.flexDirection='row';
    try { await refreshIdentity(); } catch(e){ console.error(e); }
    // Re-apply permission-dependent controls only after the authenticated profile is loaded.
    // The initial call above runs before currentProfile exists and must not hide Super Admin actions.
    if(currentUser) installScreenHooks();
    if(currentUser){await startApp();await recordSessionLogin();} else showLogin();
    db().auth.onAuthStateChange(async(_event,session)=>{
      if(!session){currentUser=null;currentProfile=null;permissions.clear();sessionLoginRecordedFor=null;showLogin();return;}
      try{await refreshIdentity();await startApp();await recordSessionLogin();}catch(e){console.error(e);showLogin();}
    });
    const logout=$('logoutBtn');if(logout){logout.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();signOut().catch(err=>notify(err.message));},true);}
    // holdRender already queries and renders Supabase directly; do not wrap it via loadHolds (would recurse).
    window.holdDecision=(id,decision)=>decideHold(id,decision).catch(e=>notify(e.message));
    window.SVMBackend={client:()=>db(),get user(){return currentUser;},get profile(){return currentProfile;},has,signOut,changeOwnPassword,loadVehicles,saveVehicle,updateVehicle,deleteVehicle,saveQuotation,loadQuotations,publishPriceList,loadPriceLists,loadPriceListStock,loadEmployees,refreshEmployees:renderEmployees,loadAudit,loadImportHistory,audit};
    window.dispatchEvent(new Event('svm:ready'));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{console.error(e);notify('Backend init failed: '+e.message);showLogin();}),{once:true});
  else init().catch(e=>{console.error(e);notify('Backend init failed: '+e.message);showLogin();});

})();