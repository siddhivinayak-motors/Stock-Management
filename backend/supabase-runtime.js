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
    'Quotation Management':'quotation_management', 'OTF Management':'otf_management',
    'Employee Management':'employee_management',
    'Common Excel Upload':'common_excel_upload',
    'Backup & Restore':'backup_restore','Audit History':'audit_history',
    'Retail Reports':'retail_reports'
  };
  let client, currentUser, currentProfile, permissions = new Map(), authReady = false, sessionLoginRecordedFor = null;
  let editingQuotationId = null;
  let selectedStockVehicle = null;
  // Cache invalidation is used by stock and quotation workflows after imports and edits.
  const quotationStockCache = new Map();

  if(!document.getElementById('svmSelectedStockStyles')){
    const style=document.createElement('style');style.id='svmSelectedStockStyles';
    style.textContent=`
      #stockTable th,#stockTable td{padding:6px 7px!important;font-size:12px;white-space:nowrap;line-height:1.25}\n      #stockTable th{letter-spacing:0;font-size:10px}\n      #stockTable .stock-hold-cell{padding:4px 5px!important;text-align:center}\n      #stockTable .stock-hold-btn{padding:5px 7px!important;font-size:10px;min-width:42px;background:#dc2626!important;color:#fff!important;border:1px solid #b91c1c!important;font-weight:800!important;box-shadow:0 1px 3px rgba(127,29,29,.22)}\n      #stockTable .stock-hold-btn:hover{background:#b91c1c!important;color:#fff!important;border-color:#991b1b!important}\n      #stockTable .stock-hold-btn:focus-visible{outline:2px solid #fca5a5;outline-offset:2px}\n      #stockTable tbody tr[data-stock-id]{cursor:pointer;transition:background .15s ease,box-shadow .15s ease}
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

      /* Stock Register: balanced full-width desktop grid with a useful compact tablet view. */
      #stockTable{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;border-collapse:collapse}
      #stockTable th,#stockTable td{box-sizing:border-box;padding:7px 5px!important;white-space:normal!important;overflow-wrap:anywhere;word-break:normal;vertical-align:middle}
      #stockTable th{font-size:9px!important;line-height:1.15;letter-spacing:.15px}
      #stockTable td{font-size:11px!important;line-height:1.25}
      #stockTable th:nth-child(1),#stockTable td:nth-child(1){width:5%;min-width:66px}
      #stockTable th:nth-child(2),#stockTable td:nth-child(2){width:4%;text-align:center}
      #stockTable th:nth-child(3),#stockTable td:nth-child(3){width:8%}
      #stockTable th:nth-child(4),#stockTable td:nth-child(4){width:14%;min-width:0}
      #stockTable th:nth-child(5),#stockTable td:nth-child(5){width:4%;text-align:center}
      #stockTable th:nth-child(6),#stockTable td:nth-child(6){width:6%}
      #stockTable th:nth-child(7),#stockTable td:nth-child(7){width:5%;text-align:center}
      #stockTable th:nth-child(8),#stockTable td:nth-child(8){width:6%}
      #stockTable th:nth-child(9),#stockTable td:nth-child(9){width:9%}
      #stockTable th:nth-child(10),#stockTable td:nth-child(10){width:6%}
      #stockTable th:nth-child(11),#stockTable td:nth-child(11){width:5%}
      #stockTable th:nth-child(12),#stockTable td:nth-child(12){width:5%}
      #stockTable th:nth-child(13),#stockTable td:nth-child(13){width:3%}
      #stockTable th:nth-child(14),#stockTable td:nth-child(14){width:4%}
      #stockTable th:nth-child(15),#stockTable td:nth-child(15){width:5%}
      #stockTable th:nth-child(16),#stockTable td:nth-child(16){width:5%}
      #stockTable th:nth-child(17),#stockTable td:nth-child(17){width:5%}
      #stockTable th:nth-child(18),#stockTable td:nth-child(18){width:3%}
      #stockTable td:nth-child(4){overflow:visible;text-overflow:clip}
      #stockTable .stock-hold-cell{min-width:66px}
      @media(max-width:1200px){
        #stockTable{table-layout:fixed!important;width:100%!important;min-width:0!important}
        #stockTable th:nth-child(n+8),#stockTable td:nth-child(n+8){display:none!important}
        #stockTable th:nth-child(1),#stockTable td:nth-child(1){width:9%;min-width:62px}
        #stockTable th:nth-child(2),#stockTable td:nth-child(2){width:7%}
        #stockTable th:nth-child(3),#stockTable td:nth-child(3){width:13%}
        #stockTable th:nth-child(4),#stockTable td:nth-child(4){width:27%;min-width:0}
        #stockTable th:nth-child(5),#stockTable td:nth-child(5){width:9%}
        #stockTable th:nth-child(6),#stockTable td:nth-child(6){width:19%}
        #stockTable th:nth-child(7),#stockTable td:nth-child(7){width:16%}
        #stockTable th,#stockTable td{padding:8px 6px!important}
        #stockTable td:nth-child(4){white-space:normal!important;overflow-wrap:anywhere;word-break:normal}
      }
      @media(max-width:680px){
        #stockTable th,#stockTable td{font-size:10px!important;padding:7px 4px!important}
        #stockTable .stock-hold-btn{min-width:0;padding:4px 5px!important}
      }
    `;
    document.head.appendChild(style);
  }
  const $ = id => document.getElementById(id);
  const notify = msg => { if (typeof window.toast === 'function') window.toast(msg); else console.info(msg); };
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const QUOTE_COMPANY_DEFAULTS = {
    pan:'AAMCS1007J',gstin:'24AAMCS1007J1ZI',
    email:'SALES.B@SIDDHIVINAYAKMOTORS.COM',
    branch_address:'Press Quarter, near BSNL Telephone Exchange, Chitra, Bhavnagar, Gujarat 364004',
    helplines:['9879100031','9925139389'],
    terms:['All payments in favour of SIDDHIVINAYAK MOTORS PVT. LTD.','Kindly insist for receipt of all payments made.','Subject to availability of stock & colour.','Price prevailing at the time of delivery shall be applicable.','Prices are subject to change without any notice.','Subject to '+(currentProfile?.city||'Bhavnagar')+' Jurisdiction.'],
    bank_details:{accountName:'SIDDHIVINAYAK MOTORS PVT. LTD.',bank:'State Bank of India',account:'33349775105',ifsc:'SBIN0060231',branch:'Chitra, Bhavnagar',payableAt:'Bhavnagar',micr:'364002005'}
  };
  const QUOTE_BRANCH_DETAILS = {
    Bhavnagar:QUOTE_COMPANY_DEFAULTS,
    Amreli:{
      pan:'AAMCS1007J',gstin:'24AAMCS1007J1ZI',
      email:'siddhivinayakac.008@gmail.com',
      branch_address:'Lathi Road Highway, Near Lalav Temple, Amreli, Gujarat',
      helplines:['9879594200'],
      terms:['All payments in favour of SIDDHIVINAYAK MOTORS PVT. LTD.','Kindly insist for receipt of all payments made.','Subject to availability of stock & colour.','Price prevailing at the time of delivery shall be applicable.','Prices are subject to change without any notice.','Subject to Amreli Jurisdiction.'],
      bank_details:{accountName:'SIDDHIVINAYAK MOTORS PVT. LTD.',bank:'State Bank of India',account:'36388108144',ifsc:'SBIN0015502',branch:'SBI Lathi Road Branch - Amreli',payableAt:'Amreli'}
    }
  };
  const quoteBranchDetailsForCity=city=>QUOTE_BRANCH_DETAILS[String(city||'').trim()]||QUOTE_COMPANY_DEFAULTS;
  window.svmGetQuoteBranchDetails=quoteBranchDetailsForCity;
  const canEditQuoteCompanySettings=()=>!!currentProfile&&(currentProfile.is_super_admin===true||['manager','general manager','dms','hr','accountant','accounts','admin'].includes(String(currentProfile.designation||'').trim().toLowerCase()));
  async function loadQuoteCompanySettings(){
    const rows=await call(db().from('quotation_company_settings').select('*').eq('id',true).limit(1));
    return rows?.[0]||QUOTE_COMPANY_DEFAULTS;
  }
  async function applyQuoteCompanyDetails(){
    if(!currentUser||!currentProfile)return;
    const set=(id,value)=>{const el=$(id);if(el&&value!==undefined&&value!==null)el.value=value;};
    // Company identity is shared; branch contact, address and bank coordinates follow the employee's saved City.
    const branchDetails=quoteBranchDetailsForCity(currentProfile.city);
    set('qPan',branchDetails.pan);set('qGstin',branchDetails.gstin);
    set('qEmail',branchDetails.email);
    set('qBranchAddress',branchDetails.branch_address);
    set('qHelpline',(branchDetails.helplines||[]).join(' / '));
    set('qContactPerson',currentProfile.full_name||currentUser.email||'');
    set('qContactMobile',currentProfile.phone||'');
    const canEditContact=canEditQuoteCompanySettings();
    const designation=String(currentProfile.designation||'').trim().toLowerCase();
    const viewOnlyRole=['executive','reception','receptionist','driver'].includes(designation);
    // Target the company details block by its PAN field; the quotation form is shared by every department.
    const companyDetails=$('qPan')?.closest('details.quote-more');
    const companyBody=companyDetails?.querySelector(':scope > div');
    if(companyBody){
      companyBody.inert=viewOnlyRole;
      companyBody.setAttribute('aria-disabled',viewOnlyRole?'true':'false');
      companyBody.style.pointerEvents=viewOnlyRole?'none':'';
      companyBody.style.userSelect=viewOnlyRole?'none':'';
    }
    ['qPan','qGstin','qEmail','qBranchAddress','qHelpline'].forEach(id=>{const el=$(id);if(el){el.readOnly=true;el.disabled=false;el.tabIndex=-1;}});
    ['qContactPerson','qContactMobile'].forEach(id=>{const el=$(id);if(el){el.readOnly=!canEditContact;el.disabled=viewOnlyRole;el.tabIndex=viewOnlyRole?-1:(canEditContact?0:-1);}});
    const actions=$('quoteCompanySettingsActions');if(actions)actions.style.display='none';
  }
  const db = () => { if (!client) throw new Error('Supabase client is not ready'); return client; };
  async function call(q) { const {data,error}=await q; if(error) throw error; return data; }
  function has(module,action='view') {
    // Quotation visibility is a fixed role rule, enforced again by Supabase RLS.
    if(module==='otf_management'&&action==='view'&&['Manager','General Manager','Admin','HR','DMS','Accountant','Accounts','Executive','Reception','Receptionist','Driver'].includes(currentProfile?.designation)) return true;
    if(module==='quotation_management'&&action==='view'&&
      ['Manager','General Manager','Admin','HR','DMS','Accountant','Accounts','Executive','Reception','Receptionist','Driver'].includes(currentProfile?.designation)) return true;
    // Super Admin can view all records, but audit() below never records Super Admin activity.
    const role=String(currentProfile?.designation||'').trim();
    const roleKey=role.toLowerCase();
    // Treat the canonical Super Admin designation as a full-access identity too.
    // Some legacy profiles may have the designation but a false/null flag.
    if(currentProfile?.is_super_admin===true||roleKey==='super admin') return true;
    if(module==='stock_register'&&action==='view'&&
      ([...STOCK_EDIT_ROLES,...STOCK_HOLD_ROLES].some(x=>String(x).toLowerCase()===roleKey))) return true;
    if(module==='retail_reports'&&action==='view'&&canRetailStock()) return true;
    if(module==='stock_hold_management'&&action==='create'&&canSubmitStockHoldRole()) return true;
    if(module==='audit_history'&&action==='view'&&['Admin','General Manager'].includes(role)) return true;
    return (permissions.get(module)||[]).includes(action);
  }
  function roleLevel(){const levels={'Super Admin':100,'Admin':90,'General Manager':80,'Manager':70,'Accountant':60,'HR':50,'DMS':40,'Executive':30,'Reception':20,'Driver':10};return currentProfile?.is_super_admin?100:(levels[currentProfile?.designation]??0);}
  function canManageStock(){return roleLevel()>30;}
  const STOCK_EDIT_ROLES=new Set(['Super Admin','Admin','General Manager','Manager','HR','DMS','Accountant']);
  const STOCK_HOLD_ROLES=new Set(['Executive','Reception','Driver']);
  function canEditStockRole(){return !!currentProfile?.is_super_admin||STOCK_EDIT_ROLES.has(String(currentProfile?.designation||''));}
  function canRetailStock(){return canEditStockRole();}
  function canSubmitStockHoldRole(){return STOCK_HOLD_ROLES.has(String(currentProfile?.designation||''));}
  function canManageHolds(){return roleLevel()>=70;}
  function allowedDepartmentList(){
    // Department access is the source of truth for every role. Only Super Admin
    // receives all four departments automatically; Admin/GM/Manager are scoped
    // to the departments explicitly assigned in Employee Management.
    if(currentProfile?.is_super_admin) return ['Personal','EV','Commercial','LLM'];
    const valid=['Personal','EV','Commercial','LLM'];
    const assigned=Array.isArray(currentProfile?.department_access)&&currentProfile.department_access.length
      ?currentProfile.department_access
      :[currentProfile?.department].filter(Boolean);
    return valid.filter(d=>assigned.some(x=>String(x).trim().toLowerCase()===d.toLowerCase()));
  }
  async function refreshIdentity() {
    const {data:{user},error}=await db().auth.getUser();
    if(error) throw error;
    currentUser=user;
    if(!user){currentProfile=null;permissions.clear();syncOperationalResetVisibility();return;}
    const p=await call(db().from('profiles').select('*').eq('user_id',user.id).maybeSingle());
    currentProfile=p;
    const rows=await call(db().from('employee_permissions').select('module,actions').eq('user_id',user.id));
    permissions=new Map(rows.map(x=>[x.module,x.actions||[]]));
    if(!p || p.status!=='active') { await db().auth.signOut(); throw new Error('Your employee account is not active. Contact Admin.'); }
    syncOperationalResetVisibility();
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
  let quotationPickerBound = false;
  const quoteSearchNorm = value => String(value || '').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  async function setupQuotationVehiclePicker() {
    const model=$('qVehicle'),variant=$('qVariant'),colour=$('qColour'),box=$('qPriceSuggestions');
    if(!model||!variant||!colour||!box)return;
    if($('qSalesPerson'))$('qSalesPerson').value=currentProfile?.full_name||currentUser?.email||'';
    if(quotationPickerBound)return;
    quotationPickerBound=true;
    const fields=[model,variant,colour],hide=()=>{box.hidden=true;};
    // When the user starts a different model search, discard dependent values and old Price List rows.
    // This prevents the previous model's variant/colour from filtering out the next model.
    let lastModelValue=model.value;
    model.addEventListener('input',()=>{
      if(model.value!==lastModelValue){
        lastModelValue=model.value;
        variant.value='';
        colour.value='';
        window.selectedStockQuoteVehicle=null;
        if(typeof window.quoteClearPriceListRows==='function')window.quoteClearPriceListRows();
        const status=$('qPriceListStatus');
        if(status)status.textContent='Model changed. Select the matching variant and colour to load the current Price List.';
      }
    });
    const render=async()=>{
      const activeDept=typeof currentQuoteDepartment!=='undefined'?currentQuoteDepartment:'Personal';
      const query=quoteSearchNorm([model.value,variant.value,colour.value].filter(Boolean).join(' '));
      if(!query){hide();return;}
      box.hidden=false;box.innerHTML='<div class="q-stock-empty">Searching all permitted department Price Lists…</div>';
      try{
        if(!window.SVMBackend||typeof window.SVMBackend.loadPriceLists!=='function')throw new Error('Price List service unavailable');
        await window.SVMBackend.loadPriceLists();
        const departments=['Personal','EV','Commercial','LLM'];
        const rows=departments.flatMap(dept=>((window.plData&&window.plData[dept])||[]).map(row=>({...row,department:row.department||dept})));
        const tokens=query.split(/\s+/).filter(Boolean);
        const matches=rows.map(row=>{
          const vehicle=quoteSearchNorm(row.vehicle),variantText=quoteSearchNorm(row.variant),colourText=quoteSearchNorm(row.colour);
          const hay=[vehicle,variantText,colourText].filter(Boolean).join(' ');
          if(!tokens.every(token=>hay.includes(token)))return null;
          let score=0;
          tokens.forEach(token=>{
            if(vehicle===token)score+=120;else if(vehicle.startsWith(token))score+=70;else if(vehicle.split(' ').some(part=>part.startsWith(token)))score+=48;
            if(variantText===token)score+=110;else if(variantText.startsWith(token))score+=65;else if(variantText.split(' ').some(part=>part.startsWith(token)))score+=42;
            if(colourText.startsWith(token))score+=18;
          });
          if(row.department===activeDept)score+=3;
          return {...row,_searchScore:score};
        }).filter(Boolean).sort((a,b)=>b._searchScore-a._searchScore||String(a.vehicle||'').localeCompare(String(b.vehicle||''))||String(a.variant||'').localeCompare(String(b.variant||''))||String(a.colour||'').localeCompare(String(b.colour||'')));
        if(!matches.length){box.innerHTML='<div class="q-stock-empty">No matching Model / Variant / Colour found in the accessible department Price Lists.</div>';return;}
        box.innerHTML='<div class="q-stock-count">'+matches.length+' Price List match(es) · All permitted departments</div>'+matches.slice(0,100).map((row,i)=>'<button type="button" class="q-stock-option" data-quote-price-index="'+i+'"><span class="q-stock-main"><b>'+esc(row.vehicle||'—')+'</b><span>'+esc(row.variant||'Variant not listed')+' · '+esc(row.colour||'Colour not listed')+'</span></span><span class="q-stock-meta"><small>'+esc(row.department||'PRICE LIST')+'</small></span></button>').join('')+(matches.length>100?'<div class="q-stock-count">Showing first 100 matches. Add more model, variant or colour text to narrow the list.</div>':'');
        box.querySelectorAll('[data-quote-price-index]').forEach(button=>button.addEventListener('click',()=>{
          const row=matches[Number(button.dataset.quotePriceIndex)];if(!row)return;
          if(typeof window.setQuotationDepartment==='function')window.setQuotationDepartment(row.department);
          model.value=row.vehicle||'';lastModelValue=model.value;variant.value=row.variant||'';colour.value=row.colour||'';
          if($('qCarDesc'))$('qCarDesc').value='';
          if($('qSalesPerson'))$('qSalesPerson').value=currentProfile?.full_name||currentUser?.email||'';
          hide();
          if(typeof window.quoteApplyPriceList==='function')window.quoteApplyPriceList(row);else if(typeof quoteAutoFillPrice==='function')quoteAutoFillPrice();
          if(typeof notify==='function')notify('Quotation switched to '+row.department+' · '+(row.vehicle||'')+' / '+(row.variant||''));
        }));
      }catch(error){box.hidden=false;box.innerHTML='<div class="q-stock-empty">Price List search unavailable: '+esc(error.message)+' · Check your Price List access.</div>';}
    };
    fields.forEach(field=>{field.addEventListener('input',render);field.addEventListener('focus',()=>{if(field.value.trim())render();});field.setAttribute('aria-autocomplete','list');field.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});});
    document.addEventListener('click',event=>{if(!box.contains(event.target)&&!fields.includes(event.target))hide();});
  }
  async function startApp() {
    if(!currentUser){showLogin();return;}
    if($('svAuthGate')) $('svAuthGate').remove();
    const label=$('userName')||document.querySelector('.user-name');
    if(label) label.textContent=currentProfile.full_name||currentUser.email;
    const roleLabel=document.querySelector('.user-role');
    if(roleLabel) roleLabel.textContent=currentProfile?.is_super_admin?'SUPER ADMIN':String(currentProfile?.designation||'EMPLOYEE').toUpperCase();
    setupQuotationVehiclePicker();
    bindOtfUi();
    const hasAnyModule=['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','otf_management','employee_management','common_excel_upload','backup_restore','audit_history','retail_reports'].some(m=>has(m,'view'));
    // Keep the app shell intact; enforce module and department access on the actual navigation items.
    try{await refreshDashboard();}catch(e){console.error('Dashboard data refresh failed:',e);notify('Dashboard data could not be refreshed: '+(e.message||e));}
    const dashRefresh=document.querySelector('#view-dashboard .page-head .btn, #view-dashboard button[onclick*="Dashboard refreshed"]');
    if(dashRefresh&&!dashRefresh.dataset.liveRefreshBound){dashRefresh.dataset.liveRefreshBound='1';dashRefresh.onclick=()=>refreshDashboard().then(()=>notify('Dashboard updated')).catch(e=>notify(e.message));}

    const viewMap={
      'view-dashboard':'dashboard','view-stock':'stock_register','view-quotation':'quotation_management',
      'view-quotation-management':'quotation_management',
      'view-otf-order-book':'otf_management','view-otf-management':'otf_management',
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
      if(page.startsWith('otf-'))return 'otf_management';
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
      const otfManagerAccess=has('otf_management','view')&&canManageOtf();
      sub.style.display=(allowed||otfManagerAccess)?'':'none';
      sub.querySelectorAll('[data-page]').forEach(item=>{
        const module=pageModule(item.dataset.page||'');
        item.style.display=allowed&&(!module||has(module,'view'))?'':'none';
      });
      const group=document.querySelector('[data-group="'+sub.dataset.sub+'"]');
       // Department Access grants all four department functions; no separate
       // module checkbox is required for Personal / EV / Commercial / LLM.
       sub.querySelectorAll('[data-page]').forEach(item=>item.style.display=allowed?'':'none');
       sub.querySelectorAll('[data-page^="otf-"]').forEach(item=>{
         const isManagement=(item.dataset.page||'').startsWith('otf-management-');
         item.style.display=has('otf_management','view')&&(allowed|| (isManagement&&canManageOtf()))?'':'none';
       });
       if(group)group.style.display=(allowed||otfManagerAccess)?'':'none';
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
  async function loadPriceLists() {
    // Quotation users also need read access to the current published price list to prepare a quote.
    if(!has('price_list_management','view')&&!has('quotation_management','view')) return;
    const departments=allowedDepartmentList();
    const by={Personal:[],EV:[],Commercial:[],LLM:[]};
    if(!departments.length){window.plData=by;window.plHistory=[];if(typeof window.plRender==='function')window.plRender();return;}
    // Restrict at the Supabase query itself, not only after downloading rows.
    const versions=await call(db().from('price_list_versions').select('*').in('department',departments).order('published_at',{ascending:false}));
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
  async function publishPriceList(rowsByDepartment,sourceFile='',fileObjects=[],withinFileDuplicates=0) {
    if(!has('price_list_management','create')) throw new Error('No permission to upload price lists.');
    // Always compare against the latest published version before deciding what is new.
    await loadPriceLists();
    const departments=['Personal','EV','Commercial','LLM'];
    const normKey=value=>String(value==null?'':value).toUpperCase().replace(/\\bBS[\\s_.-]*6(?:\\.?2)?\\b/g,' ').replace(/\\bREFRESH\\b|\\bNEW\\b/g,' ').replace(/[^A-Z0-9]/g,'');
    const identity=(dept,row)=>[dept,normKey(row.vehicle),normKey(row.variant),normKey(row.colour)].join('|');
    const signature=row=>{
      const d=row.other_data||row;
      const components=(d.components||[]).map(p=>[String(p.label||'').trim().toLowerCase(),Number(p.value||0)]).sort((a,b)=>a[0].localeCompare(b[0]));
      return JSON.stringify([Number(row.ex_showroom!=null?row.ex_showroom:row.exShowroom||0),Number(row.rto||0),Number(d.tcs||0),Number(d.insurance||0),Number(d.onRoadTotal||d.totalOnRoad||0),components]);
    };
    const existingByDepartment=window.plData||{};
    const mergedByDepartment={},incomingByDepartment={};
    const report={added:0,updated:0,skipped:Number(withinFileDuplicates||0),total:0,departments:{},withinFileDuplicates:Number(withinFileDuplicates||0)};
    for(const department of departments){
      const oldItems=existingByDepartment[department]||[];
      const map=new Map(),merged=[];
      oldItems.forEach(old=>{
        const key=identity(department,{vehicle:old.vehicle,variant:old.variant,colour:old.colour});
        if(!map.has(key)){map.set(key,merged.length);merged.push({
          department,vehicle:old.vehicle,variant:old.variant||'',colour:old.colour||'',
          exShowroom:Number(old.ex_showroom||0),rto:Number(old.rto||0),
          ...(old.other_data||{}),other_data:old.other_data||{}
        });}
      });
      const incoming=rowsByDepartment[department]||[];
      let added=0,updated=0,skipped=0;
      incoming.forEach(row=>{
        const key=identity(department,row),idx=map.get(key);
        if(idx===undefined){map.set(key,merged.length);merged.push({...row,department});added++;return;}
        const old=merged[idx];
        const oldComparable={ex_showroom:old.exShowroom!=null?old.exShowroom:old.ex_showroom,rto:old.rto,other_data:old.other_data||old};
        const newComparable={ex_showroom:row.exShowroom,rto:row.rto,other_data:row};
        if(signature(oldComparable)===signature(newComparable)){skipped++;return;}
        merged[idx]={...row,department};updated++;
      });
      report.added+=added;report.updated+=updated;report.skipped+=skipped;
      report.departments[department]={added,updated,skipped,total:merged.length};
      if(incoming.length){incomingByDepartment[department]=incoming;}
      if(incoming.length&&(added||updated))mergedByDepartment[department]=merged;
      report.total+=merged.length;
    }
    if(!report.added&&!report.updated)return report;
    const storagePaths=[];
    for(const file of fileObjects){
      const depts=file.priceListDepartments&&file.priceListDepartments.length?file.priceListDepartments:['Personal'];
      const safeName=String(file.name||'price-list.xlsx').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120);
      for(const dept of depts){
        if(!mergedByDepartment[dept])continue;
        const path=dept+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'-'+safeName;
        const {error}=await db().storage.from('price-list-files').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
        if(error)throw error;
        storagePaths.push(path);
      }
    }
    const allFileRefs=storagePaths.length?storagePaths.join(' | '):sourceFile;
    for(const [department,rows] of Object.entries(mergedByDepartment)){
      const incoming=incomingByDepartment[department]||[];
      const dReport=report.departments[department]||{added:0,updated:0,skipped:0};
      const version=await call(db().from('price_list_versions').insert({
        version_label:'V'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14),
        department,source_file:sourceFile||allFileRefs,row_count:rows.length,published_by:currentUser.id
      }).select().single());
      const batch=await call(db().from('price_list_import_batches').insert({
        department,version_label:version.version_label,source_file:(sourceFile||'')+' | '+allFileRefs,
        status:'published',total_rows:incoming.length,valid_rows:dReport.added+dReport.updated,duplicate_rows:dReport.skipped,error_rows:0,
        uploaded_by:currentUser.id,reviewed_by:currentUser.id,reviewed_at:new Date().toISOString(),
        published_version_id:version.id,review_note:'Incremental publish. Added '+dReport.added+', updated '+dReport.updated+', skipped '+dReport.skipped+'.'
      }).select().single());
      const importRows=incoming.filter(row=>{
        const key=identity(department,row),old=(existingByDepartment[department]||[]).find(x=>identity(department,{vehicle:x.vehicle,variant:x.variant,colour:x.colour})===key);
        return !old||signature({ex_showroom:old.ex_showroom,rto:old.rto,other_data:old.other_data||{}})!==signature({ex_showroom:row.exShowroom,rto:row.rto,other_data:row});
      });
      for(let i=0;i<importRows.length;i+=500){
        const items=importRows.slice(i,i+500).map((row,j)=>({
          batch_id:batch.id,row_number:i+j+1,vehicle:row.vehicle,variant:row.variant||'',colour:row.colour||'',
          ex_showroom:Number(row.exShowroom||0),rto:Number(row.rto||0),source_payload:{...row,department}
        }));
        await call(db().from('price_list_import_items').insert(items));
      }
      for(let i=0;i<rows.length;i+=500){
        const payload=rows.slice(i,i+500).map(row=>({
          version_id:version.id,department,vehicle:row.vehicle,variant:row.variant||'',colour:row.colour||'',
          ex_showroom:Number(row.exShowroom!=null?row.exShowroom:row.ex_showroom||0),rto:Number(row.rto||0),
          other_data:{...(row.other_data||row),department}
        }));
        await call(db().from('price_list_items').insert(payload));
      }
    }
    await loadPriceLists();
    await audit('price_list_management','create','Incrementally uploaded price list','price_list_version',null,{source_file:sourceFile,storage_paths:storagePaths,added:report.added,updated:report.updated,skipped:report.skipped});
    return report;
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
    if(!canEditStockRole()&&!viaImport) throw new Error('Only Manager, General Manager, Admin, Super Admin, HR, DMS and Accountant roles can edit stock.');
    if(viaImport&&!has('common_excel_upload','create')) throw new Error('Common Excel Upload permission required.');
    const row=await call(db().from('vehicles').update({...data,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',id).select().single());
    quotationStockCache.clear();
    await audit(viaImport?'common_excel_upload':'stock_register',viaImport?'create':'edit',viaImport?'Reconciled vehicle by exact chassis':'Updated vehicle','vehicle',id);
    return row;
  }
  async function registerVehicleExit(id,exitType,details={}) {
    if(!canRetailStock()) throw new Error('Vehicle exit permission is limited to Manager and above, HR, DMS and Accountant.');
    const vehicle=await call(db().from('vehicles').select('*').eq('id',id).single());
    const result=await call(db().rpc('register_vehicle_exit',{
      p_vehicle_id:id,p_exit_type:String(exitType||'').toUpperCase(),
      p_exit_date:details.exitDate||new Date().toISOString().slice(0,10),
      p_reason:details.reason||null,p_destination:details.destination||null,
      p_customer_name:details.customerName||null,p_notes:details.notes||null
    }));
    quotationStockCache.clear();
    await audit('stock_register','edit','Moved vehicle out of stock: '+String(exitType).toUpperCase(),'vehicle_exit',result.id,{
      chassis_number:vehicle.chassis_number,department:vehicle.department,exit_type:String(exitType).toUpperCase(),
      exit_date:details.exitDate||new Date().toISOString().slice(0,10),reason:details.reason||null
    });
    return result;
  }
  async function markVehicleRetail(id) {
    const vehicle=await call(db().from('vehicles').select('*').eq('id',id).single());
    return registerVehicleExit(id,'RETAIL',{exitDate:new Date().toISOString().slice(0,10),customerName:vehicle.customer_name||null});
  }
  function openVehicleExitDialog(vehicle) {
    if(!vehicle||!canRetailStock()) throw new Error('Vehicle exit permission required.');
    const old=$('svVehicleExitDialog');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='svVehicleExitDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:100005;background:#15202dcc;display:grid;place-items:center;padding:14px';
    const field=(label,name,value='',type='text',required=false)=>'<label style="display:block;font-size:13px;font-weight:650;color:#344054">'+label+'<input class="field" name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+' style="width:100%;margin-top:5px"></label>';
    wrap.innerHTML='<form id="svVehicleExitForm" style="width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;padding:21px;border-radius:14px;color:#253140"><h2 style="font-size:19px;margin:0 0 5px">Move Vehicle Out of Stock</h2><p style="font-size:12px;color:#64748b;margin:0 0 14px">Vehicle: <b>'+esc(vehicle.chassis_number)+'</b> · '+esc(vehicle.model)+' '+esc(vehicle.variant||'')+'</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><label style="display:block;font-size:13px;font-weight:650">Exit Type<select class="field" name="exit_type" id="svExitType" style="width:100%;margin-top:5px"><option value="RETAIL">Retail / Delivered</option><option value="DEMO">Demo</option><option value="DAMAGE">Damage</option><option value="TRANSFER_OUT">Transfer Out</option><option value="OTHER">Other</option></select></label>'+field('Exit Date','exit_date',new Date().toISOString().slice(0,10),'date',true)+field('Customer Name','customer_name',vehicle.customer_name||'')+field('Transfer / Demo Destination','destination','','text',false)+'</div><label style="display:block;font-size:13px;font-weight:650;margin-top:11px">Reason / Reference <textarea class="field" name="reason" id="svExitReason" rows="2" style="width:100%;margin-top:5px" placeholder="Required for Demo, Damage, Transfer Out and Other"></textarea></label><label style="display:block;font-size:13px;font-weight:650;margin-top:10px">Additional Notes <textarea class="field" name="notes" rows="2" style="width:100%;margin-top:5px"></textarea></label><div style="font-size:11px;color:#64748b;margin-top:9px">The vehicle will be removed from Active Stock and its complete details will remain in the permanent Vehicle Exit Register.</div><div id="svVehicleExitError" style="color:#c51c2a;font-size:12px;margin:9px 0"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svVehicleExitCancel" class="btn">Cancel</button><button type="submit" class="btn primary">Confirm &amp; Move Out</button></div></form>';
    document.body.appendChild(wrap);
    $('svVehicleExitCancel').onclick=()=>wrap.remove();
    $('svExitType').addEventListener('change',()=>{
      const retail=$('svExitType').value==='RETAIL';
      $('svExitReason').required=!retail;
      $('svExitReason').placeholder=retail?'Optional sale note':'Required: explain why this vehicle is leaving stock';
      const dest=wrap.querySelector('[name="destination"]')?.closest('label');
      if(dest)dest.querySelector('input').placeholder=$('svExitType').value==='TRANSFER_OUT'?'Transfer destination / branch':'Destination (optional)';
    });
    $('svVehicleExitForm').onsubmit=async e=>{
      e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;button.textContent='Saving…';
      try{
        const values=Object.fromEntries(new FormData(e.target).entries());
        if(values.exit_type!=='RETAIL'&&!String(values.reason||'').trim())throw new Error('Enter the reason for this stock exit.');
        await registerVehicleExit(vehicle.id,values.exit_type,{exitDate:values.exit_date,reason:values.reason,destination:values.destination,customerName:values.customer_name,notes:values.notes});
        selectedStockVehicle=null;wrap.remove();await renderStock();await loadRetailReport();
        notify('Vehicle moved to '+values.exit_type.replace('_',' ')+' and saved in permanent Exit Register.');
      }catch(ex){$('svVehicleExitError').textContent=ex.message||'Could not move vehicle out.';button.disabled=false;button.textContent='Confirm & Move Out';}
    };
  }
  async function deleteVehicle(id) {
    if(!canManageStock()||!has('stock_register','delete')) throw new Error('Only roles above Executive with delete permission can delete stock.');
    await call(db().from('vehicles').delete().eq('id',id));quotationStockCache.clear();await audit('stock_register','delete','Deleted vehicle','vehicle',id);
  }
  async function saveQuotation(q) {
    if(!has('quotation_management','create')) throw new Error('No quotation create permission.');
    const canEditContact=canEditQuoteCompanySettings();
    const contactPerson=canEditContact?String(q.contactPerson||'').trim():(currentProfile?.full_name||currentUser?.email||'');
    let contactMobile=canEditContact?String(q.contactMobile||'').trim():String(currentProfile?.phone||'').trim();
    if(contactMobile){
      const digits=contactMobile.replace(/\D/g,'');
      const normalized=digits.length===12&&digits.startsWith('91')?digits.slice(2):digits.length===11&&digits.startsWith('0')?digits.slice(1):digits;
      if(normalized.length!==10)throw new Error('Contact Person Mobile must be a valid 10-digit number.');
      contactMobile=normalized;
    }
    const row=await call(db().from('quotations').insert({
      quote_number:q.no,department:q.department,quote_date:q.date,customer_name:q.customer,phone:q.phone,address:q.address,customer_gstin:q.customerGstin||null,sales_mobile:q.salesMobile||null,
      vehicle_count:Number(q.vehicleNos||1),hypo:q.hypo,model:q.model,variant:q.variant,colour:q.colour,
      sales_person:q.salesPerson,contact_person:contactPerson,contact_mobile:contactMobile,
      email:QUOTE_COMPANY_DEFAULTS.email,branch_address:QUOTE_COMPANY_DEFAULTS.branch_address,
      helpline:QUOTE_COMPANY_DEFAULTS.helplines.join(' / '),pan:QUOTE_COMPANY_DEFAULTS.pan,gstin:QUOTE_COMPANY_DEFAULTS.gstin,
      subtotal:q.subtotal,discount:q.discount,total:q.subtotal,amount_words:numberWordsIndian(q.subtotal),
      terms:q.terms||QUOTE_COMPANY_DEFAULTS.terms,bank_details:q.bank||QUOTE_COMPANY_DEFAULTS.bank_details,
      created_by:currentUser.id,updated_by:currentUser.id
    }).select().single());
    if(q.items?.length) await call(db().from('quotation_items').insert(q.items.map((x,i)=>({quotation_id:row.id,line_no:i+1,particulars:x.particulars||x.name||'',amount:Number(x.amount||0),is_discount:!!(x.discount??x.isDiscount)||/discount|\\bless\\b/i.test(String(x.name||x.particulars||'')),is_custom:!!x.custom}))));
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
    id:row.id,no:row.quote_number,department:row.department,customer:row.customer_name,phone:row.phone||'',creatorCity:row.creator_city||'',
    address:row.address||'',customerGstin:row.customer_gstin||'',salesMobile:row.sales_mobile||'',vehicleNos:String(row.vehicle_count??1),hypo:row.hypo||'',
    model:row.model||'',variant:row.variant||'',colour:row.colour||'',
    vehicle:[row.model,row.variant].filter(Boolean).join(' · '),createdAt:row.created_at||null,
    salesPerson:row.sales_person||'',by:row.created_by_name||(row.created_by===currentUser?.id?(currentProfile?.full_name||currentUser.email):'—'),
    contactPerson:row.contact_person||'',contactMobile:row.contact_mobile||'',email:row.email||'',
    branchAddress:row.branch_address||'',helpline:row.helpline||'',pan:row.pan||'',gstin:row.gstin||'',
    total:Number(row.total||0),subtotal:Number(row.subtotal||0),discount:Number(row.discount||0),
    amountWords:row.amount_words||'',terms:Array.isArray(row.terms)?row.terms:[],
    bank:row.bank_details&&typeof row.bank_details==='object'?row.bank_details:{},
    status:String(row.status||'Pending').toUpperCase(),approvedBy:row.approved_by||null,approvedAt:row.approved_at||null,prints:Number(row.print_count||0),
    date:row.quote_date,items:(row.quotation_items||[]).sort((a,b)=>Number(a.line_no||0)-Number(b.line_no||0)).map(x=>({name:x.particulars,amount:Number(x.amount||0),discount:!!x.is_discount||/discount|\\bless\\b/i.test(String(x.particulars||'')),custom:!!x.is_custom}))
  });
  const sameQuoteKey=(a,b)=>
    String(a.department||'').trim().toLowerCase()===String(b.department||'').trim().toLowerCase() &&
    String(a.customer||'').trim().replace(/\s+/g,' ').toLowerCase()===String(b.customer||'').trim().replace(/\s+/g,' ').toLowerCase() &&
    String(a.phone||'').replace(/\D/g,'')===String(b.phone||'').replace(/\D/g,'') &&
    String(a.model||'').trim().replace(/\s+/g,' ').toLowerCase()===String(b.model||'').trim().replace(/\s+/g,' ').toLowerCase() &&
    String(a.variant||'').trim().replace(/\s+/g,' ').toLowerCase()===String(b.variant||'').trim().replace(/\s+/g,' ').toLowerCase() &&
    Math.round(Number(a.total||0)*100)===Math.round(Number(b.total||0)*100);
  const QUOTATION_MANAGER_ROLES = new Set(['Manager','General Manager','Admin']);
  const canReviewQuotationRecords = () => !!currentProfile?.is_super_admin || QUOTATION_MANAGER_ROLES.has(String(currentProfile?.designation||''));
  const canEditQuotationRecords = () => has('quotation_management','edit');
  const canDeleteQuotationRecords = () => canReviewQuotationRecords();
  let quotationCityFilter='All';
  const canUseQuotationCityFilter=()=>!!currentProfile?.is_super_admin || ['Admin','General Manager'].includes(String(currentProfile?.designation||''));
  window.renderQuoteManagement = () => {
    const body=$('quoteManagementRows');if(!body)return;
    const canEdit=canEditQuotationRecords();
    const canDelete=canDeleteQuotationRecords();
    const head=document.querySelector('#view-quotation-management .card-head');
    if(head){
      let wrap=$('quotationCityFilterWrap');
      if(canUseQuotationCityFilter()){
        if(!wrap){
          wrap=document.createElement('label');wrap.id='quotationCityFilterWrap';
          wrap.style.cssText='display:flex;align-items:center;gap:8px;margin-left:auto;font-size:13px;font-weight:600;white-space:nowrap';
          wrap.innerHTML='<span>City</span><select id="quotationCityFilter" class="btn small" aria-label="Filter quotations by city"><option value="All">All Cities</option><option value="Bhavnagar">Bhavnagar</option><option value="Amreli">Amreli</option><option value="Botad">Botad</option></select>';
          head.appendChild(wrap);
          $('quotationCityFilter').addEventListener('change',e=>{quotationCityFilter=e.target.value;window.renderQuoteManagement();});
        }
        wrap.style.display='flex';
        $('quotationCityFilter').value=quotationCityFilter;
      }else if(wrap){wrap.remove();quotationCityFilter='All';}
    }
    const visibleQuotes=(quoteRecords||[]).map((q,i)=>({q,i})).filter(({q})=>!canUseQuotationCityFilter()||quotationCityFilter==='All'||String(q.creatorCity||'').trim().toLowerCase()===quotationCityFilter.toLowerCase());
    body.innerHTML=visibleQuotes.map(({q,i})=>{
      const blocked=q.status==='PENDING'&&quoteRecords.some(other=>other.id!==q.id&&other.status==='APPROVED'&&sameQuoteKey(q,other));
      const canReview=canReviewQuotationRecords() && has('quotation_management','approve');
      const approval=q.status!=='PENDING'||!canReview?'':blocked?'<span class="pill red" title="An identical quotation is already approved">Already Registered</span><button class="btn small danger" onclick="denyQuote('+i+')">Deny</button>':'<button class="btn small" onclick="approveQuote('+i+')">Approve</button><button class="btn small danger" onclick="denyQuote('+i+')">Deny</button>';
      const manage=(canDelete?'<button class="btn small danger" onclick="deleteSavedQuote('+i+')">Delete</button>':'')+(canEdit?'<button class="btn small" onclick="editSavedQuote('+i+')">Edit</button>':'');
      const statusClass=q.status==='APPROVED'?'green':q.status==='PENDING'?'orange':'red';
      const createdAt=q.createdAt?new Date(q.createdAt):null;
      const dateTimeLabel=createdAt&&!Number.isNaN(createdAt.getTime())?createdAt.toLocaleString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'}):'—';
      return '<tr><td class="strong">'+esc(q.no)+'</td><td>'+esc(q.customer)+'</td><td class="qm-mobile">'+esc(q.phone||'—')+'</td><td class="qm-vehicle">'+esc(q.vehicle)+'</td><td class="qm-date" title="'+esc(q.createdAt||'')+'">'+esc(dateTimeLabel)+'</td><td class="qm-department">'+esc(q.department||'')+'</td><td>'+esc(q.by)+'</td><td class="qm-discount">'+money(q.discount||0)+'</td><td class="qm-grand">'+money(q.total)+'</td><td><span class="pill '+statusClass+'">'+esc(q.status)+'</span></td><td><b>'+Number(q.prints||0)+'</b></td><td><div class="qm-action"><button class="btn small" onclick="printSavedQuote('+i+')">Print</button>'+manage+approval+'</div></td></tr>';
    }).join('')||'<tr><td colspan="11" class="empty">No quotations found for the selected city.</td></tr>';
    $('qmTotal').textContent=visibleQuotes.length;
    $('qmPending').textContent=visibleQuotes.filter(({q})=>q.status==='PENDING').length;
    $('qmApproved').textContent=visibleQuotes.filter(({q})=>q.status==='APPROVED').length;
    $('qmPrints').textContent=visibleQuotes.reduce((sum,{q})=>sum+Number(q.prints||0),0);
  };
  let quotationRealtimeChannel=null, quoteRealtimeDebounce=null;
  function startQuotationRealtime(){
    if(!currentUser||!has('quotation_management','view'))return;
    if(quotationRealtimeChannel)return;
    try{
      const uid=currentUser.id;
      quotationRealtimeChannel=db().channel('svm-quotation-live-'+uid)
        .on('postgres_changes',{event:'*',schema:'public',table:'quotations'},()=>{
          clearTimeout(quoteRealtimeDebounce);
          quoteRealtimeDebounce=setTimeout(()=>reloadQuoteList().catch(e=>console.warn('Live quotation refresh failed:',e)),250);
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'quotation_items'},()=>{
          clearTimeout(quoteRealtimeDebounce);
          quoteRealtimeDebounce=setTimeout(()=>reloadQuoteList().catch(e=>console.warn('Live quotation item refresh failed:',e)),350);
        })
        .subscribe((status,error)=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Quotation live updates unavailable:',error||status);});
    }catch(e){console.warn('Quotation realtime subscription could not start:',e);}
  }
  function stopQuotationRealtime(){
    if(quotationRealtimeChannel){try{db().removeChannel(quotationRealtimeChannel);}catch(_e){}quotationRealtimeChannel=null;}
    if(quoteRealtimeDebounce)clearTimeout(quoteRealtimeDebounce);
    quoteRealtimeDebounce=null;
  }
  async function reloadQuoteList() {
    if(!has('quotation_management','view')) return;
    const dept=typeof currentQuoteDepartment!=='undefined'?currentQuoteDepartment:'Personal';
    const rows=await loadQuotations(dept);
    quoteRecords=rows.map(toQuoteView);
    if(typeof renderQuoteManagement==='function') renderQuoteManagement();
    if(typeof updateQuoteNumber==='function') updateQuoteNumber();
  }
  window.editSavedQuote = (i) => {
    try {
      const q=quoteRecords[i];
      if(!q?.id) throw new Error('Quotation record not found.');
      if(!canEditQuotationRecords()) throw new Error('You do not have quotation edit permission.');
      editingQuotationId=q.id;
      currentQuoteDepartment=q.department||'Personal';
      if(typeof showPage==='function') showPage('quotation');
      const set=(id,v)=>{const el=$(id);if(el)el.value=v??'';};
      set('qCustomer',q.customer);set('qPhone',q.phone);set('qDate',q.date);
      set('qAddress',q.address);set('qCustomerGSTIN',q.customerGstin);set('qSalesMobile',q.salesMobile);set('qVehicleNos',q.vehicleNos||1);set('qHypo',q.hypo);
      set('qVehicle',q.model);set('qVariant',q.variant);set('qColour',q.colour);
      set('qSalesPerson',q.salesPerson);
      set('qContactPerson',q.contactPerson);set('qContactMobile',q.contactMobile);
      set('qEmail',q.email);set('qBranchAddress',q.branchAddress);set('qHelpline',q.helpline);
      set('qPan',q.pan);set('qGstin',q.gstin);
      if($('quoteNumber'))$('quoteNumber').textContent=q.no;
      document.querySelectorAll('#view-quotation details').forEach(d=>d.open=false);
      const escAttr=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const allItems=q.items||[];
      const isDiscountItem=x=>!!x.discount||/discount|\\bless\\b/i.test(String(x.name||''));
      const regularItems=allItems.filter(x=>!isDiscountItem(x));
      const discountItems=allItems.filter(isDiscountItem);
      const regularRows=regularItems.map((x,n)=>{const removable=!!x.custom;return '<div class="charge-row"'+(removable?' data-custom-charge="true"':'')+'><span class="charge-index">'+String(n+1).padStart(2,'0')+'</span><div class="q-charge-name">'+esc(x.name)+'</div><div class="amount-wrap"><span>₹</span><input class="amount" type="text" inputmode="decimal" value="'+Number(x.amount||0).toFixed(2)+'" data-charge="'+escAttr(x.name)+'"></div>'+(removable?'<button class="icon-btn remove-charge" aria-label="Remove charge">×</button>':'')+'</div>';}).join('');
      const discountDefs=[
        {name:'LESS RETAIL OFFER',match:/retail/i},
        {name:'LESS EXCHANGE OFFER',match:/exchange/i},
        {name:'LESS EXTRA DISCOUNT',match:/extra|discount/i}
      ];
      const usedDiscounts=new Set();
      const discountRow=(name,amount,n)=>'<div class="charge-row discount-charge"><span class="charge-index">'+String(n).padStart(2,'0')+'</span><div class="q-charge-name">'+esc(name)+'</div><div class="amount-wrap discount-input"><span>− ₹</span><input class="amount" type="text" inputmode="decimal" value="'+Number(amount||0).toFixed(2)+'" data-charge="'+escAttr(name)+'"></div><span class="discount-lock">LESS</span></div>';
      let discountRows=discountDefs.map((def,n)=>{
        const found=discountItems.find(x=>!usedDiscounts.has(x)&&def.match.test(String(x.name||'')));
        if(found)usedDiscounts.add(found);
        return discountRow(def.name,found?.amount||0,n+1);
      }).join('');
      discountItems.filter(x=>!usedDiscounts.has(x)).forEach((x,n)=>{discountRows+=discountRow(x.name, x.amount, discountDefs.length+n+1);});
      $('charges').innerHTML=regularRows;
      if($('quoteDiscounts'))$('quoteDiscounts').innerHTML=discountRows;
      if(typeof renumberCharges==='function')renumberCharges();
      if($('quotationPageTitle'))$('quotationPageTitle').textContent=currentQuoteDepartment+' — Edit Quotation';
      const head=document.querySelector('#view-quotation .card-title');if(head)head.textContent='Edit Quotation';
      const desc=document.querySelector('#view-quotation .card-desc');if(desc)desc.textContent='Save updates this quotation. Print opens the latest saved version.';
      const tag=document.querySelector('#view-quotation .card-head .pill');if(tag){tag.textContent='EDIT MODE';tag.className='pill orange';}
      if($('saveQuote'))$('saveQuote').textContent='Save Changes';
      if($('printQuote'))$('printQuote').textContent='Print Quotation';
      if(typeof calc==='function')calc();
      notify('Quotation loaded for editing.');
    } catch(e){notify(e.message);}
  };
  window.deleteSavedQuote = async (i) => {
    try {
      const q=quoteRecords[i];
      if(!q?.id) throw new Error('Quotation record not found.');
      if(!canDeleteQuotationRecords()) throw new Error('Only Manager, General Manager, Admin and Super Admin can delete quotations.');
      if(!confirm('Delete quotation '+q.no+' for '+q.customer+'? This cannot be undone.')) return;
      await call(db().from('quotation_items').delete().eq('quotation_id',q.id));
      await call(db().from('quotations').delete().eq('id',q.id));
      await audit('quotation_management','delete','Deleted quotation','quotation',q.id,{quote_number:q.no,customer:q.customer});
      await reloadQuoteList();
      notify('Quotation deleted.');
    } catch(e){notify(e.message);}
  };
  window.saveQuote = async (printAfter=false) => {
    try {
      const q=getQuotePayload(); if(!q) return;
      const dept=typeof currentQuoteDepartment!=='undefined'?currentQuoteDepartment:'Personal';
      const model=$('qVehicle').value.trim(),variant=$('qVariant').value.trim();
      if(editingQuotationId){
        if(!canEditQuotationRecords()) throw new Error('You do not have quotation edit permission.');
        const id=editingQuotationId;
        if(quoteRecords.some(other=>other.id!==id&&sameQuoteKey(q,other))) throw new Error('આ જ ગ્રાહક, મોબાઇલ નંબર, ગાડી અને Grand Totalનું બીજું quotation પહેલેથી નોંધાયેલું છે. Duplicate quotation તરીકે ફેરફાર સેવ નહીં થાય.');
        const payload={
          quote_date:q.date||new Date().toISOString().slice(0,10),
          customer_name:q.customer,phone:q.phone,address:q.address,customer_gstin:q.customerGstin||null,sales_mobile:q.salesMobile||null,vehicle_count:Number(q.vehicleNos||1),
          hypo:q.hypo,model,variant,colour:q.colour,
          sales_person:q.salesPerson,contact_person:q.contactPerson,contact_mobile:q.contactMobile,
          email:q.email,branch_address:q.branchAddress,helpline:q.helpline,pan:q.pan,gstin:q.gstin,
          subtotal:q.subtotal,discount:q.discount,total:q.total,amount_words:numberWordsIndian(q.total)||'',
          terms:q.terms||[],bank_details:q.bank||{},status:'Pending',approved_by:null,approved_at:null,
          updated_by:currentUser.id,updated_at:new Date().toISOString()
        };
        // RLS can legitimately return zero updated rows; .single() turns that into
        // the opaque PostgREST "Cannot coerce the result to a single JSON object" error.
        // Use maybeSingle() and report the actual no-row condition clearly.
        const updatedQuote=await call(db().from('quotations').update(payload).eq('id',id).select('id').maybeSingle());
        if(!updatedQuote?.id) throw new Error('Quotation was not updated. Check your Edit permission and confirm this quotation belongs to your assigned branch and department. No quotation items were changed.');
        await call(db().from('quotation_items').delete().eq('quotation_id',id));
        const itemRows=(q.items||[]).map((x,i)=>({quotation_id:id,line_no:i+1,particulars:x.name,amount:Number(x.amount||0),is_discount:!!x.discount,is_custom:!!x.custom}));
        if(itemRows.length) await call(db().from('quotation_items').insert(itemRows));
        await audit('quotation_management','edit','Edited quotation; approval reset to Pending','quotation',id,{quote_number:q.no});
        editingQuotationId=null;
        await reloadQuoteList();
        if(typeof resetQuotationForm==='function')resetQuotationForm();
        notify('Quotation updated. Approval reset to Pending.');
        if(printAfter){const idx=quoteRecords.findIndex(x=>x.id===id);if(idx>=0)window.printSavedQuote(idx);}
        return;
      }
      const phoneKey=String(q.phone||'').replace(/\D/g,'');
      if(phoneKey.length!==10) throw new Error('Enter a valid 10-digit mobile number.');
      // Reuse the latest visible quotation for this department + mobile + model + variant.
      // The database function preserves its quotation number and refreshes all price/charge rows.
      const {data:upsertResult,error:upsertError}=await db().rpc('upsert_customer_vehicle_quotation',{p_quote:{...q,total:q.total,amountWords:numberWordsIndian(q.total)},p_items:q.items||[]});
      if(upsertError)throw upsertError;
      const saved=upsertResult?.row;
      if(!saved?.id)throw new Error('Quotation save returned no record. Please refresh and try again.');
      q.no=saved.quote_number;
      if($('quoteNumber'))$('quoteNumber').textContent=saved.quote_number;
      const updatedExisting=!!upsertResult.updated_existing;
      await audit('quotation_management',updatedExisting?'edit':'create',updatedExisting?'Updated latest quotation for customer and vehicle':'Saved quotation','quotation',saved.id,{quote_number:saved.quote_number,phone:phoneKey,model,variant});
      await reloadQuoteList();
      if($('quoteNumber'))$('quoteNumber').textContent=saved.quote_number;
      notify(updatedExisting?'Existing quotation updated. Same quotation number retained.':'New quotation saved to Supabase.');
      if(printAfter) {
        const savedIndex=quoteRecords.findIndex(x=>x.id===saved.id);
        if(savedIndex>=0)window.printSavedQuote(savedIndex);
      }
    } catch(e){console.error(e);const duplicateError=e.code==='23505'||String(e.message||'').includes('Duplicate quotation');notify(duplicateError?'આ જ ગ્રાહક, મોબાઇલ નંબર, ગાડી અને Grand Totalનું quotation પહેલેથી નોંધાયેલું છે. ફરીથી એન્ટ્રી કરી શકાશે નહીં.':(e.message||'Could not save quotation.'));}
  };
  window.printCurrentSavedQuote = () => {
    const phone=String($('qPhone')?.value||'').replace(/\D/g,'');
    const model=String($('qVehicle')?.value||'').trim().replace(/\s+/g,' ').toLowerCase();
    const variant=String($('qVariant')?.value||'').trim().replace(/\s+/g,' ').toLowerCase();
    const dept=typeof currentQuoteDepartment!=='undefined'?currentQuoteDepartment:'Personal';
    if(phone.length!==10||!model){notify('Enter the customer mobile number and vehicle model, then Save the quotation first.');return;}
    const index=(quoteRecords||[]).findIndex(q=>
      String(q.department||'').toLowerCase()===String(dept).toLowerCase() &&
      String(q.phone||'').replace(/\D/g,'')===phone &&
      String(q.model||'').trim().replace(/\s+/g,' ').toLowerCase()===model &&
      String(q.variant||'').trim().replace(/\s+/g,' ').toLowerCase()===variant
    );
    if(index<0){notify('This quotation is not saved yet. Click Save Quotation first.');return;}
    window.printSavedQuote(index);
  };
  window.resetQuotationForm = ((original)=>function(){ editingQuotationId=null; if(typeof original==='function')original(); document.querySelectorAll('#view-quotation details.quote-more').forEach(d=>d.open=false); if($('quotationPageTitle'))$('quotationPageTitle').textContent=(typeof currentQuoteDepartment!=='undefined'?currentQuoteDepartment:'Personal')+' — Quotation'; const h=document.querySelector('#view-quotation .card-title');if(h)h.textContent='Create New Quotation';const d=document.querySelector('#view-quotation .card-desc');if(d)d.textContent='Save updates the latest matching customer and vehicle quotation. Print opens the latest saved version.';const tag=document.querySelector('#view-quotation .card-head .pill');if(tag){tag.textContent='NEW';tag.className='pill red';}if($('saveQuote'))$('saveQuote').textContent='Save Quotation';if($('printQuote'))$('printQuote').textContent='Print Quotation';})(window.resetQuotationForm);
  window.saveRecords = () => {}; // Quotation records now live in Supabase, not localStorage.
  window.loadDepartmentQuotes = () => { reloadQuoteList().catch(e=>{console.error(e);notify(e.message);}); };
  window.approveQuote = async (i) => {
    try{
      const q=quoteRecords[i];if(!q?.id) return;
      if(!canReviewQuotationRecords() || !has('quotation_management','approve')) throw new Error('Only Manager, General Manager, Admin and Super Admin can approve quotations.');
      if(quoteRecords.some(other=>other.id!==q.id&&other.status==='APPROVED'&&sameQuoteKey(q,other))) throw new Error('આ જ ગ્રાહક, મોબાઇલ નંબર, ગાડી અને Grand Totalનું quotation પહેલેથી APPROVED છે. આ duplicate quotation approve નહીં થાય.');
      const approvedDiscountTotal=(q.items||[]).filter(x=>x.discount).reduce((sum,x)=>sum+Math.abs(Number(x.amount)||0),0);
      const approvedTotal=Math.max(0,Number(q.subtotal||0)-approvedDiscountTotal);
      const {data,error}=await db().from('quotations').update({status:'Approved',discount:approvedDiscountTotal,total:approvedTotal,amount_words:numberWordsIndian(approvedTotal),approved_by:currentUser.id,approved_at:new Date().toISOString(),updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',q.id).eq('status','Pending').select('id');
      if(error)throw error;
      if(!data?.length)throw new Error('Quotation is not pending or was already approved.');
      await audit('quotation_management','approve','Approved quotation','quotation',q.id);
      await reloadQuoteList();notify('Quotation approved.');
    }catch(e){notify(e.message);}
  };
  window.denyQuote = async (i) => {
    try{
      const q=quoteRecords[i];if(!q?.id) return;
      if(!canReviewQuotationRecords() || !has('quotation_management','approve')) throw new Error('Only Manager, General Manager, Admin and Super Admin can deny quotations.');
      if(q.status!=='PENDING') throw new Error('Only pending quotations can be denied.');
      const reason=prompt('Deny quotation '+q.no+'. Enter a reason (optional):','');
      if(reason===null) return;
      if(!confirm('Are you sure you want to mark quotation '+q.no+' as DENIED?')) return;
      const {data,error}=await db().from('quotations')
        .update({status:'Denied',updated_by:currentUser.id,updated_at:new Date().toISOString()})
        .eq('id',q.id).eq('status','Pending').select('id');
      if(error) throw error;
      if(!data?.length) throw new Error('Quotation is no longer pending. Refresh and try again.');
      await audit('quotation_management','deny','Denied quotation','quotation',q.id,{quote_number:q.no,reason:reason.trim()});
      await reloadQuoteList();
      notify('Quotation marked as Denied.');
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
  let pratikStockPreviewRows = [], pratikStockPreviewFile = null;
  window.pratikStockPreview = async () => {
    try {
      const file=$('pratikStockFile')?.files?.[0];
      if(!file)throw new Error('Select Manager Excel file first.');
      if(!has('common_excel_upload','create'))throw new Error('Common Excel Upload permission required.');
      const allowed=new Set(allowedDepartmentList().map(x=>String(x).toLowerCase()));
      const root=!!currentProfile?.is_super_admin;
      if(!root&&(!allowed.has('personal')||!allowed.has('ev')))throw new Error('Login needs both Personal and EV department access.');
      if(!window.XLSX)throw new Error('Excel reader did not load. Reload the page.');
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const sn=wb.SheetNames.find(n=>String(n).trim().toUpperCase()==='STOCK');
      if(!sn)throw new Error('STOCK worksheet not found. No data changed.');
      const raw=XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:'',raw:true});
      if(!raw.length)throw new Error('STOCK worksheet is empty.');
      const nk=k=>String(k??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
      const get=(r,...names)=>{const keys=Object.keys(r||{});for(const n of names){const k=keys.find(x=>nk(x)===nk(n));if(k!==undefined)return r[k];}return '';};
      const t=v=>String(v??'').trim();
      const dt=v=>{if(v instanceof Date&&!isNaN(v))return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');if(typeof v==='number'&&v>0){const z=XLSX.SSF.parse_date_code(v);if(z)return new Date(Date.UTC(z.y,z.m-1,z.d)).toISOString().slice(0,10);}if(v){const d=new Date(v);if(!isNaN(d))return d.toISOString().slice(0,10);}return null;};
      const num=v=>{if(v===null||v===undefined||t(v)==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;};
      const dept=m=>{const x=t(m).toUpperCase();return x==='BEV'||x.includes('EV')||x.includes('ELECTRIC')||/^BE\s*6\b/.test(x)?'EV':'Personal';};
      const stages=new Set(['OPEN','HOLD','ALLOTED','DAMAGE','RETAIL','DEMO','TRANSFER_OUT','OTHER','BILLING DONE','DEALER','DAMO']);
      const seen=new Set();let placeholderNo=0;
      pratikStockPreviewRows=raw.map((r,i)=>{
        const model=t(get(r,'MODEL','MODEL NAME','VEHICLE MODEL')),variant=t(get(r,'VARIENTS','VARIANTS','VARIANT'));
        const original=t(get(r,'CHASSIS NUMBER','CHASSISNUMBER','CHASSIS','CHASSIS NO','CHASIS NUMBER','CHASIS NO')).toUpperCase();
        const chassis=original||(model?'XXXX-'+String(++placeholderNo).padStart(3,'0'):'');
        const explicitDept=t(get(r,'DEPARTMENT','SEGMENT','SEGMENT CODE')).toUpperCase();
        const department=/\b(EV|BEV|ELECTRIC)\b/.test(explicitDept)||explicitDept.includes('ELECTRIC')? 'EV' : /PERSONAL/.test(explicitDept)?'Personal':dept(model);
        const rawStage=t(get(r,'STAGE')).toUpperCase();
        const stageAliases={'IN TRANSIT':'OPEN','TRANSIT':'OPEN','RECEIVED':'OPEN','IN STOCK':'OPEN','AVAILABLE':'OPEN','ALLOTTED':'ALLOTED','ALLOCATED':'ALLOTED','DELIVERED':'RETAIL','RETAILED':'RETAIL','TRANSFER OUT':'TRANSFER_OUT','TRANSFER-OUT':'TRANSFER_OUT','BILLING':'BILLING DONE','BILLING COMPLETED':'BILLING DONE'};
        const stage=stageAliases[rawStage]||rawStage||'OPEN';
        let decision='Ready';
        if(!model)decision='Review: Missing model';
        else if(!chassis)decision='Review: Missing chassis';
        else if(seen.has(chassis))decision='Review: Duplicate chassis';
        else if(!stages.has(stage))decision='Review: Unknown stage "'+rawStage+'" at Excel row '+(i+2);
        else if(!root&&!allowed.has(department.toLowerCase()))decision='Review: No department access';
        seen.add(chassis);
        const mfg=t(get(r,'MFG YEAR')),ym=mfg.match(/(?:19|20)\d{2}/);
        return {sr_no:num(get(r,'SR.NO','SR NO')),department,chassis,model,variant,
          seating:t(get(r,'SEATING')),colour:t(get(r,'COLOR','COLOUR')),mfg_year_label:mfg,
          manufacturing_year:ym?Number(ym[0]):null,oem_invoice_date:dt(get(r,'OEM INVOICE DATE')),
          engine_number:t(get(r,'ENGINE NUMBER')),status:t(get(r,'STATUS'))||'Received / In Stock',
          place:t(get(r,'PLACE')),ageing:num(get(r,'AGEING')),stage,sc_name:t(get(r,'SC NAME')),
          customer_name:t(get(r,'CUSTOMER NAME')),alloted_date:dt(get(r,'ALLOTED DATE')),
          alloted_ageing:num(get(r,'ALLOTED AGEING')),source_row:i+2,decision};
      }).filter(x=>x.model||x.chassis);
      if(!pratikStockPreviewRows.length)throw new Error('No vehicle rows found in STOCK worksheet.');
      const bad=pratikStockPreviewRows.filter(x=>x.decision!=='Ready');
      if(bad.length)throw new Error('Review found '+bad.length+' invalid rows. '+bad.slice(0,5).map(x=>'Excel row '+x.source_row+': '+x.decision).join(' · ')+'. No data changed.');
      const existing=[];
      for(let from=0;;from+=1000){const part=await call(db().from('vehicles').select('chassis_number,department,stage,status').in('department',['Personal','EV']).range(from,from+999));existing.push(...part);if(part.length<1000)break;}
      const incoming=new Set(pratikStockPreviewRows.map(x=>x.chassis));
      const old=new Set(existing.map(x=>String(x.chassis_number||'').toUpperCase()));
      const added=pratikStockPreviewRows.filter(x=>!old.has(x.chassis)).length;
      const updated=pratikStockPreviewRows.length-added;
      const removed=existing.filter(x=>!incoming.has(String(x.chassis_number||'').toUpperCase())).length;
      const counts={Personal:pratikStockPreviewRows.filter(x=>x.department==='Personal').length,EV:pratikStockPreviewRows.filter(x=>x.department==='EV').length};
      const st={};pratikStockPreviewRows.forEach(x=>st[x.stage]=(st[x.stage]||0)+1);
      pratikStockPreviewFile=file.name;
      $('pratikStockApply').disabled=false;
      $('pratikStockSummary').style.display='block';
      $('pratikStockSummary').textContent='Review ready — database unchanged.\nRows: '+pratikStockPreviewRows.length+'\nPersonal: '+counts.Personal+' · EV: '+counts.EV+'\nNew: '+added+' · Updated: '+updated+' · Removed: '+removed+'\nStages: '+Object.entries(st).map(([k,v])=>k+': '+v).join(' · ')+'\nCommercial and LLM: untouched.';
      $('pratikStockRows').innerHTML=pratikStockPreviewRows.slice(0,500).map(x=>'<tr><td>'+esc(x.sr_no??'—')+'</td><td>'+esc(x.chassis)+'</td><td>'+esc(x.model+' / '+x.variant)+'</td><td>'+esc(x.department)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.stage)+'</td><td>'+esc(x.decision)+'</td></tr>').join('');
    } catch(e) {
      console.error(e);pratikStockPreviewRows=[];pratikStockPreviewFile=null;
      if($('pratikStockApply'))$('pratikStockApply').disabled=true;
      notify(e.message||'Unable to review STOCK worksheet.');
    }
  };
  window.pratikStockApply = async () => {
    try {
      if(!pratikStockPreviewRows.length||!pratikStockPreviewFile)throw new Error('Review STOCK worksheet first.');
      if(!confirm('FULL SYNC: Replace current Personal and EV stock with '+pratikStockPreviewRows.length+' STOCK rows? Commercial and LLM stay unchanged. Old stock and exit history will be archived.'))return;
      const result=await call(db().rpc('sync_pratik_personal_ev_stock',{p_rows:pratikStockPreviewRows.map(({decision,...x})=>({...x,chassis_number:x.chassis})),p_file_name:pratikStockPreviewFile}));
      quotationStockCache.clear();pratikStockPreviewRows=[];pratikStockPreviewFile=null;
      $('pratikStockApply').disabled=true;
      $('pratikStockSummary').textContent='Sync completed. Uploaded: '+result.uploaded_rows+' · Personal: '+result.personal_rows+' · EV: '+result.ev_rows+' · Removed: '+result.removed_rows+'. Commercial and LLM unchanged.';
      await renderStock();await loadImportHistory();notify('Manager Personal / EV stock synchronized.');
    } catch(e) {console.error(e);notify(e.message||'Stock sync failed.');}
  };
  let robinStockPreviewRows = [];
  window.robinStockPreview = async () => {
    try{
      const file=$('robinStockFile')?.files?.[0];if(!file)throw new Error('Select the Robin Commercial / LLM stock report Excel file.');
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
      robinStockPreviewRows=rows.filter(r=>Object.values(r||{}).some(v=>v!==null&&v!==undefined&&String(v).trim()!=='')).map(r=>{
        const segment=String(plHeader(r,['segmentcode','segment'])||'').trim().toUpperCase();
        const department=mapSegment(segment);
        const chassis=String(plHeader(r,['chassisnumber','chassis'])||'').trim().toUpperCase();
        const vin=String(plHeader(r,['vin'])||'').trim().toUpperCase();
        const date=plHeader(r,['oeminvoicedate','invoicedate']);
        const invoiceDate=toDateValue(date);
        let decision='Import';
        if(!department)decision='Review: Unknown Segment';
        else if(!['Commercial','LLM'].includes(department))decision='Skip: Manager handles Personal / EV';
        else if(!allowedDepartments.has(String(department).toLowerCase()))decision='Review: Outside your department';
        else if(!chassis)decision='Review: Missing Chassis Number';
        else if(!invoiceDate)decision='Review: Missing Invoice Date';
        else if(invoiceDate.getFullYear()<2025)decision='Skip: Before 2025';
        else if(seenChassis.has(chassis))decision='Duplicate Chassis — Skip';
        else if(vin&&seenVin.has(vin))decision='Duplicate VIN — Skip';
        else {seenChassis.add(chassis);if(vin)seenVin.add(vin);}
        return {chassis,vin,model:String(plHeader(r,['model'])||''),variant:String(plHeader(r,['variantdesc','variant'])||''),segment,department,status:String(plHeader(r,['vehiclestatus','status'])||'Received'),stockType:String(plHeader(r,['stocktype'])||''),date,raw:r,decision};
      });
      const count=k=>robinStockPreviewRows.filter(x=>x.decision===k).length;
      const review=robinStockPreviewRows.filter(x=>x.decision.startsWith('Review')).length;
      const duplicates=robinStockPreviewRows.filter(x=>x.decision.startsWith('Duplicate')||x.decision.startsWith('Skip:')).length;
      $('robinStockSummary').style.display='block';
      $('robinStockSummary').textContent='Rows: '+rows.length+' · Importable: '+count('Import')+' · Duplicates skipped: '+duplicates+' · Needs review: '+review+' · Department: Personal '+robinStockPreviewRows.filter(x=>x.department==='Personal'&&x.decision==='Import').length+' / Commercial '+robinStockPreviewRows.filter(x=>x.department==='Commercial'&&x.decision==='Import').length+' / EV '+robinStockPreviewRows.filter(x=>x.department==='EV'&&x.decision==='Import').length+' / LLM '+robinStockPreviewRows.filter(x=>x.department==='LLM'&&x.decision==='Import').length;
      $('robinStockRows').innerHTML=robinStockPreviewRows.slice(0,500).map(x=>'<tr><td>'+esc(x.chassis||'—')+'</td><td>'+esc(x.model)+'</td><td>'+esc(x.variant)+'</td><td>'+esc(x.segment)+'</td><td>'+esc(x.department||'Review')+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.decision)+'</td></tr>').join('')||'<tr><td colspan="7">No valid rows found.</td></tr>';
    }catch(e){console.error(e);notify(e.message);}
  };
  window.robinStockCommit = async () => {
    try{
      if(!Array.isArray(robinStockPreviewRows)||!robinStockPreviewRows.length)throw new Error('Generate Preview before uploading.');
      if(!has('common_excel_upload','create'))throw new Error('You do not have Excel Upload permission.');
      const file=$('robinStockFile')?.files?.[0];
      const ready=robinStockPreviewRows.filter(x=>x.decision==='Import'&&['Commercial','LLM'].includes(x.department));
      if(!ready.length)throw new Error('No new Commercial / LLM vehicles to import.');
      if(!confirm('Upload '+ready.length+' new vehicles? Existing chassis numbers and duplicate rows will be skipped.'))return;
      const records=ready.map(x=>{
        const r=x.raw||{},inv=x.date;
        let invoice=null;
        if(inv instanceof Date)invoice=inv.toISOString().slice(0,10);
        else if(typeof inv==='number'&&window.XLSX){const z=XLSX.SSF.parse_date_code(inv);if(z)invoice=new Date(Date.UTC(z.y,z.m-1,z.d)).toISOString().slice(0,10);}
        else if(inv&&!isNaN(Date.parse(inv)))invoice=new Date(inv).toISOString().slice(0,10);
        const stockType=String(x.stockType||'').trim().toUpperCase();
        return {department:x.department,chassis_number:x.chassis,excel_number:x.vin||null,model:x.model||'Unknown',variant:x.variant||null,seating:String(plHeader(r,['seating','seat'])||'')||null,colour:String(plHeader(r,['colour','color'])||'')||null,oem_invoice_date:invoice,engine_number:String(plHeader(r,['enginenumber','engine'])||'')||null,sc_name:String(plHeader(r,['scname','salesconsultant'])||'')||null,customer_name:String(plHeader(r,['customername','customer'])||'')||null,status:x.status||'Received',stage:stockType==='ALLOTED'||stockType==='ALLOTTED'?'ALLOTED':'OPEN',place:String(plHeader(r,['physicallocation','dealerlocationname'])||'')||null,source:'robin_commercial_llm_stock_report',imported_at:new Date().toISOString(),created_by:currentUser.id};
      });
      const imported=await call(db().rpc('import_stock_vehicles',{p_rows:records,p_file_name:file?.name||'Stock Report'}));
      const skipped=robinStockPreviewRows.filter(x=>x.decision!=='Import').length;
      const byDepartment=['Commercial','LLM'];
      for(const dept of byDepartment){
        const deptRows=robinStockPreviewRows.filter(x=>x.department===dept);
        if(!deptRows.length)continue;
        const deptImported=records.filter(x=>x.department===dept).length;
        await call(db().from('stock_import_batches').insert({file_name:file?.name||'Stock Report',department:dept,imported_rows:deptImported,skipped_rows:deptRows.length-deptImported,error_rows:0,created_by:currentUser.id}));
      }
      await audit('common_excel_upload','create','Uploaded Robin Commercial / LLM stock report','stock_import_batch',null,{imported,skipped,file:file?.name||'',departments:['Commercial','LLM'].filter(d=>records.some(x=>x.department===d))});
      quotationStockCache.clear();robinStockPreviewRows=[];await renderStock();await loadImportHistory();
      $('robinStockSummary').textContent='Upload complete · Imported '+imported+' · Skipped '+skipped+'.';
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
      <div class="meta"><span><b>Department:</b> ${safe(department)}</span><span><b>Status:</b> ${safe(status)}</span><span><b>Stage:</b> ${safe(stage)}</span>${search?'<span><b>Search:</b> '+safe(search)+'</span>':''}</div>
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
      const canEdit=canEditStockRole(),canRetail=canRetailStock(),canDelete=canEditStockRole()&&has('stock_register','delete');
      const deptFilter=$('stockDepartmentFilter');
      const selectedDept=dept==='All'?(deptFilter?.value||'All Accessible Departments'):dept;
      let rows=await loadVehicles(dept==='All'&&selectedDept!=='All Accessible Departments'?selectedDept:dept);
      const search=($('stockSearch')?.value||'').trim().toLowerCase();
      const statusFilter=$('stockStatusFilter')?.value||'All';
      const stageFilter=$('stockStageFilter')?.value||'All';
      if(search) rows=rows.filter(v=>[v.sr_no,v.model,v.variant,v.seating,v.colour,v.mfg_year_label,v.oem_invoice_date,v.chassis_number,v.engine_number,v.status,v.place,v.ageing,v.stage,v.sc_name,v.customer_name,v.alloted_date,v.alloted_ageing].some(x=>String(x??'').toLowerCase().includes(search)));
      if(statusFilter!=='All') rows=rows.filter(v=>String(v.status||'').trim().toLowerCase()===statusFilter.toLowerCase());
      if(stageFilter==='ACTIVE') rows=rows.filter(v=>['OPEN','ALLOTED','HOLD'].includes(String(v.stage||'').trim().toUpperCase()));
      else if(stageFilter==='EXITED') rows=rows.filter(v=>['RETAIL','DEMO','DAMAGE','TRANSFER_OUT','OTHER'].includes(String(v.stage||'').trim().toUpperCase()));
      else if(stageFilter!=='All') rows=rows.filter(v=>String(v.stage||'').trim().toUpperCase()===stageFilter.toUpperCase());
      rows.sort((a,b)=>{const sa=Number.parseInt(String(a.sr_no??'').replace(/[^0-9-]/g,''),10),sb=Number.parseInt(String(b.sr_no??'').replace(/[^0-9-]/g,''),10);const va=Number.isFinite(sa),vb=Number.isFinite(sb);if(va&&vb)return sa-sb;if(va)return -1;if(vb)return 1;return String(a.sr_no??'').localeCompare(String(b.sr_no??''),undefined,{numeric:true,sensitivity:'base'});});
      const body=$('stockTable').querySelector('tbody');
      const canHold=canSubmitStockHoldRole();
      body.innerHTML=rows.length?rows.map((v,index)=>'<tr data-stock-id="'+esc(v.id)+'" tabindex="0" aria-label="Select vehicle '+esc(v.chassis_number)+'" aria-selected="'+(selectedStockVehicle?.id===v.id?'true':'false')+'" class="'+(selectedStockVehicle?.id===v.id?'selected-stock-row':'')+'"><td class="stock-hold-cell">'+(canHold&&String(v.stage||'').toUpperCase()==='OPEN'?'<button class="btn small stock-hold-btn" data-stock-hold="'+esc(v.id)+'">Hold</button>':'')+(canEdit?'<button class="btn small" data-stock-edit="'+esc(v.id)+'">Edit</button>':'')+'</td><td>'+esc(v.sr_no||String(index+1))+'</td><td>'+esc(v.model||'—')+'</td><td>'+esc(v.variant||'—')+'</td><td>'+esc(v.seating||'—')+'</td><td>'+esc(v.colour||'—')+'</td><td>'+esc(v.mfg_year_label||v.manufacturing_year||'—')+'</td><td>'+esc(v.oem_invoice_date||'—')+'</td><td><b>'+esc(v.chassis_number)+'</b></td><td>'+esc(v.engine_number||'—')+'</td><td>'+esc(v.status||'—')+'</td><td>'+esc(v.place||'—')+'</td><td>'+esc(v.ageing??'—')+'</td><td>'+esc(v.stage||'—')+'</td><td>'+esc(v.sc_name||'—')+'</td><td>'+esc(v.customer_name||'—')+'</td><td>'+esc(v.alloted_date||'—')+'</td><td>'+esc(v.alloted_ageing??'—')+'</td></tr>').join(''):'<tr><td colspan="18" class="empty">No stock records yet.</td></tr>';
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
      body.querySelectorAll('[data-stock-exit]').forEach(b=>b.onclick=()=>{
        const vehicle=rows.find(x=>String(x.id)===String(b.dataset.stockExit));
        if(!vehicle||!canRetailStock())return;
        try{openVehicleExitDialog(vehicle);}catch(ex){notify(ex.message);}
      });
      body.querySelectorAll('[data-stock-hold]').forEach(b=>b.onclick=()=>openStockHoldDialog(rows.find(x=>x.id===b.dataset.stockHold)));
      body.querySelectorAll('[data-stock-quote]').forEach(b=>b.onclick=()=>window.startQuotationFromStock?.(rows.find(x=>String(x.id)===String(b.dataset.stockQuote))));

      const title=$('stockTable').closest('.card')?.querySelector('.card-head .card-title');
      if(title)title.textContent=rows.length+' records · '+(dept==='All'?(selectedDept==='All Accessible Departments'?'All accessible departments':selectedDept):dept);
      const head=$('stockTable').querySelector('thead tr');
      if(head&&head.children.length!==18){head.innerHTML='<th>ACTIONS</th><th>SR.NO</th><th>MODEL</th><th>VARIENTS</th><th>SEATING</th><th>COLOR</th><th>MFG YEAR</th><th>OEM INVOICE DATE</th><th>CHASSIS NUMBER</th><th>ENGINE NUMBER</th><th>STATUS</th><th>PLACE</th><th>AGEING</th><th>STAGE</th><th>SC NAME</th><th>CUSTOMER NAME</th><th>ALLOTED DATE</th><th>ALLOTED AGEING</th>';}
    }catch(e){console.error(e);notify(e.message);}
  }
  function openStockHoldDialog(vehicle){
    if(!vehicle||(!canSubmitStockHoldRole()&&!canEditStockRole())||String(vehicle.stage||'').toUpperCase()!=='OPEN')return;
    const old=$('svStockHoldDialog');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='svStockHoldDialog';wrap.style.cssText='position:fixed;inset:0;z-index:99992;background:#15202dcc;display:grid;place-items:center;padding:16px';
    const field=(label,value)=>'<label style="display:block;font-size:13px;color:#526174">'+label+'<input class="field" value="'+esc(value||'—')+'" readonly style="width:100%;margin-top:4px;background:#f6f8fb"></label>';
    wrap.innerHTML='<form id="svStockHoldForm" style="width:min(680px,100%);max-height:92vh;overflow:auto;background:#fff;padding:22px;border-radius:14px;color:#253140"><h3 style="margin:0 0 6px">Customer Vehicle Hold Request</h3><p style="font-size:13px;color:#64748b;margin:0 0 14px">Vehicle details are filled automatically. Enter customer details to send approval request.</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">'+field('Department',vehicle.department)+field('Chassis Number',vehicle.chassis_number)+field('Model',vehicle.model)+field('Variant',vehicle.variant)+field('Colour',vehicle.colour)+field('Seating',vehicle.seating)+field('Manufacturing Year',vehicle.manufacturing_year)+field('Vehicle Status',vehicle.status)+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><label style="font-size:13px;font-weight:650">Customer Name *<input required name="customer_name" class="field" maxlength="120" style="width:100%;margin-top:4px" placeholder="Enter customer full name"></label><label style="font-size:13px;font-weight:650">Customer Mobile *<input required name="customer_mobile" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" class="field" style="width:100%;margin-top:4px" placeholder="10-digit mobile number"></label></div><label style="display:block;margin:12px 0;font-size:13px;font-weight:650">Reason / Booking Note *<textarea required name="reason" class="field" rows="3" style="width:100%" placeholder="Enter booking or hold details"></textarea></label><div id="svStockHoldError" style="color:#c51c2a;font-size:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svStockHoldCancel" class="btn">Cancel</button><button type="submit" class="btn" style="background:#dc2626;color:#fff">Send for Approval</button></div></form>';
    document.body.appendChild(wrap);$('svStockHoldCancel').onclick=()=>wrap.remove();
    $('svStockHoldForm').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button[type=submit]');b.disabled=true;try{const values=Object.fromEntries(new FormData(e.target).entries());const mobile=String(values.customer_mobile||'').replace(/\D/g,'');if(!/^[0-9]{10}$/.test(mobile))throw new Error('Enter a valid 10-digit customer mobile number.');await call(db().from('stock_holds').insert({vehicle_id:vehicle.id,department:vehicle.department,vehicle:vehicle.model,variant:[vehicle.variant,vehicle.colour].filter(Boolean).join(' / '),vin:vehicle.chassis_number,executive:currentProfile?.full_name||currentUser.email,reason:values.reason.trim(),customer_name:values.customer_name.trim(),customer_mobile:mobile,created_by:currentUser.id}));await audit('stock_hold_management','create','Submitted customer vehicle hold request','stock_hold',null,{chassis_number:vehicle.chassis_number,department:vehicle.department,customer_name:values.customer_name.trim()});wrap.remove();notify('Customer hold request sent to Manager for approval.');}catch(ex){$('svStockHoldError').textContent=ex.message;b.disabled=false;}};
  }
  function editVehicleDialog(vehicle){
    if(!vehicle||!canEditStockRole())return;
    const existing=$('svVehicleDialog');if(existing)existing.remove();
    const labels={department:'Department',chassis_number:'Chassis Number',excel_number:'Excel Number',model:'Model',variant:'Variant',seating:'Seating',colour:'Colour',manufacturing_year:'Manufacturing Year',oem_invoice_date:'OEM Invoice Date',engine_number:'Engine Number',sc_name:'SC Name',customer_name:'Customer Name',status:'Status',stage:'Stage',place:'Place'};
    const wrap=document.createElement('div');wrap.id='svVehicleDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99990;background:#15202dcc;display:grid;place-items:center;padding:18px';
    const fields=Object.entries(labels).map(([k,label])=>{let control='';if(k==='department')control='<select class="field" name="department">'+allowedDepartmentList().map(d=>'<option value="'+esc(d)+'" '+(vehicle.department===d?'selected':'')+'>'+esc(d)+'</option>').join('')+'</select>';else if(k==='status'){const statusOptions=[...new Set([String(vehicle.status||'').trim(),'Received','Received / In Stock','In Transit','Delivered'].filter(Boolean))];control='<select class="field" name="status">'+statusOptions.map(v=>'<option value="'+esc(v)+'" '+(String(vehicle.status||'').toLowerCase()===v.toLowerCase()?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>';}else if(k==='stage'){const currentStage=String(vehicle.stage||'').toUpperCase();control=['RETAIL','DAMAGE','DEMO','TRANSFER_OUT','OTHER'].includes(currentStage)?'<input class="field" value="'+esc(currentStage)+'" readonly><input type="hidden" name="stage" value="'+esc(currentStage)+'">':'<select class="field" name="stage">'+['OPEN','ALLOTED','HOLD'].map(v=>'<option '+(currentStage===v?'selected':'')+'>'+v+'</option>').join('')+'</select>';}else control='<input class="field" name="'+k+'" value="'+esc(vehicle[k]??'')+'" '+(k==='chassis_number'?'readonly':'')+'>';return '<label style="display:block;font-size:12px;font-weight:650">'+label+control+'</label>';}).join('');
    wrap.innerHTML='<form id="svVehicleEditForm" style="width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;padding:24px;border-radius:14px;color:#253140"><div style="font-size:18px;font-weight:850;margin-bottom:14px">Edit Stock Vehicle</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">'+fields+'</div><div id="svVehicleEditError" style="color:#c51c2a;margin:8px 0;font-size:12px"></div><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><button type="button" id="svVehicleDeleteInside" class="btn" style="color:#b4232c">Delete Vehicle</button><div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap"><button type="button" id="svVehicleHoldInside" class="btn" style="background:#c92535;color:#fff;border-color:#b51e2c">Place Hold</button><button type="button" id="svVehicleMoveOutInside" class="btn" style="background:#16834a;color:#fff;border-color:#16834a">Move Out</button><button type="button" id="svVehicleEditCancel" class="btn">Cancel</button><button type="submit" class="btn primary">Save Changes</button></div></div></form>';
    document.body.appendChild(wrap);
    $('svVehicleEditCancel').onclick=()=>wrap.remove();
    $('svVehicleHoldInside').style.display=String(vehicle.stage||'').toUpperCase()==='OPEN'?'':'none';
    $('svVehicleHoldInside').onclick=()=>{wrap.remove();openStockHoldDialog(vehicle);};
    $('svVehicleMoveOutInside').style.display=canRetail&&['OPEN','ALLOTED','HOLD'].includes(String(vehicle.stage||'').toUpperCase())?'':'none';
    $('svVehicleMoveOutInside').onclick=()=>{wrap.remove();openVehicleExitDialog(vehicle);};
    $('svVehicleDeleteInside').style.display=has('stock_register','delete')&&!['RETAIL','DAMAGE','DEMO','TRANSFER_OUT','OTHER'].includes(String(vehicle.stage||'').toUpperCase())?'':'none';
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
  function normalizeEmployeeMobile(value){
    let digits=String(value||'').replace(/\D/g,'');
    if(digits.length===12&&digits.startsWith('91'))digits=digits.slice(2);
    else if(digits.length===11&&digits.startsWith('0'))digits=digits.slice(1);
    if(digits.length!==10)throw new Error('મોબાઇલ નંબર 10 અંકનો હોવો જોઈએ. +91 અથવા શરૂઆતનો 0 હોય તો પણ ચાલશે.');
    return digits;
  }
  async function createEmployee(fields){
    if(!currentProfile?.is_super_admin&&!has('employee_management','create')) throw new Error('You do not have Create Employee permission.');
    const payload={...fields,phone:String(fields.phone||'').trim()?normalizeEmployeeMobile(fields.phone):'',city:String(fields.city||'').trim()};
    const {data:{session}}=await db().auth.getSession();
    const {data,error}=await db().functions.invoke('employee-admin',{body:{action:'create_employee',...payload},headers:{Authorization:'Bearer '+session.access_token}});
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
    'Admin':['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','employee_management','common_excel_upload','backup_restore','audit_history','retail_reports','otf_management'],
    'General Manager':['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','employee_management','common_excel_upload','backup_restore','audit_history','retail_reports','otf_management'],
    'Manager':['dashboard','stock_register','stock_hold_management','quotation_management','employee_management','price_list_management','common_excel_upload','backup_restore','retail_reports','otf_management'],
    'Accountant':['stock_register','price_list_management','retail_reports','common_excel_upload','otf_management'],
    'HR':['dashboard','stock_register','stock_hold_management','price_list_management','quotation_management','employee_management','common_excel_upload','backup_restore','retail_reports','otf_management'],
    'DMS':['stock_register','price_list_management','retail_reports','common_excel_upload','otf_management'],
    'Executive':['dashboard','stock_register','stock_hold_management','quotation_management','price_list_management','retail_reports','otf_management'],
    'Reception':['dashboard','stock_register','stock_hold_management','quotation_management','price_list_management','retail_reports','otf_management'],
    'Driver':['stock_register','otf_management']
  };
  const MODULE_LABELS_UI={dashboard:'Dashboard',stock_register:'Stock Register',stock_hold_management:'Stock Hold Management',price_list_management:'Price List',quotation_management:'Quotation',otf_management:'OTF Management',employee_management:'Employee Management',common_excel_upload:'Excel Upload',backup_restore:'Backup & Restore',audit_history:'Audit History',retail_reports:'Retail Reports'};
  function moduleAccessMarkup(role,selected=[]){
    const allowed=ROLE_MODULES_UI[role]||[];
    return '<fieldset style="border:1px solid #dce2e9;border-radius:8px;padding:10px;margin-top:12px"><legend style="font-size:13px;font-weight:700">Function Access</legend><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">'+allowed.map(m=>'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="module_access" value="'+m+'" '+(selected.includes(m)?'checked':'')+'>'+MODULE_LABELS_UI[m]+'</label>').join('')+'</div><small style="color:#718096;display:block;margin-top:8px">Only selected functions will appear in this employee login.</small></fieldset>';
  }
  async function editEmployeeDialog(profile){
    if(profile.is_super_admin){notify('Super Admin profile cannot be edited here.');return;}
    const old=$('svEmployeeDialog');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='svEmployeeDialog';
    wrap.style.cssText='position:fixed;inset:0;z-index:99990;background:#15202dcc;display:grid;place-items:center;padding:18px';
    const input=(name,label,value,type='text')=>'<label style="display:block;font-size:13px;font-weight:650">'+label+'<input '+(type==='tel'?'type="tel" inputmode="numeric" autocomplete="tel" maxlength="16"':'type="text"')+' name="'+name+'" class="field" value="'+esc(value||'')+'" style="width:100%;margin-top:5px"></label>';
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
        fields.phone=String(fields.phone||'').trim()?normalizeEmployeeMobile(fields.phone):'';
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
    wrap.innerHTML='<form id="svEmployeeForm" style="width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;padding:18px;border-radius:14px;color:#253140"><div style="font-size:20px;font-weight:850;margin-bottom:14px">Create Employee Login</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px"><label>Full Name<input required name="full_name" class="field" autocomplete="off"></label><label>Email<input required type="email" name="email" class="field" autocomplete="off"></label><label>Mobile Number<input type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" name="phone" class="field" placeholder="10-digit mobile number (copy/paste supported)"></label><label>City<select required name="city" class="field"><option value="">Select City</option><option>Bhavnagar</option><option>Amreli</option><option>Botad</option><option>Rajula</option></select></label><label>Password<input required type="password" name="password" class="field" minlength="6" autocomplete="new-password"></label><label>Designation / Role<select required name="designation" id="svNewRole" class="field"><option value="">Select role</option>'+roles.map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select></label></div><section style="border:1px solid #e1e6ed;border-radius:10px;padding:12px;margin:12px 0"><h3 style="margin:0 0 10px;font-size:14px">Department Access</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">'+deptRows+'</div></section><div id="svCreateModulePermissions">'+moduleRows+'</div>'+dashboardRows+'<div style="font-size:12px;color:#718096;margin-top:8px">Selected departments automatically include all four department functions. Workspace modules and Dashboard Quick Access are assigned separately. Change Password is always available.</div><div id="svEmployeeError" style="color:#c51c2a;margin:8px 0;font-size:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="svEmployeeCancel" class="btn">Cancel</button><button class="btn primary" type="submit">Create User</button></div></form>';
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
      ['price_list_management','Price List','otf_management'],['employee_management','Employee Management'],
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
      return '<tr><td>'+(canEditThis?'<button type="button" class="btn small" data-edit="'+esc(p.user_id)+'" style="padding:2px 0;background:transparent;border:0;color:#26384d;text-decoration:underline;font-weight:750">'+esc(p.full_name||'—')+'</button>':esc(p.full_name||'—'))+'</td><td>'+esc(p.email||'—')+'</td><td>'+esc(p.phone||'—')+'</td><td>'+esc(designation==='Reception'?'Receptionist':designation)+'</td><td>'+esc(p.city||'—')+'</td><td>'+esc(access)+'</td><td><span class="pill '+(p.status==='active'?'green':'red')+'">'+esc(p.status||'inactive')+'</span></td><td>'+(canManageThis?'<button type="button" class="btn small" data-permissions="'+esc(p.user_id)+'">Permissions</button>':'—')+'</td></tr>';
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
    box.innerHTML='<div class="ssc-head"><span class="ssc-title">SELECTED VEHICLE FROM STOCK REGISTER</span><button type="button" class="ssc-clear" id="clearSelectedStockContext">Clear selection ×</button></div><div class="ssc-grid">'+field('Department',v.department)+field('Chassis Number',v.chassis_number)+field('Model',v.model)+field('Variant',v.variant)+field('Colour',v.colour)+field('Stock Stage',v.stage)+'</div><div class="ssc-actions">'+(has('quotation_management','create')?'<button type="button" class="ssc-request" id="createQuoteFromSelectedStock">Create Quotation →</button>':'')+(canSubmit?'<button type="button" class="ssc-request" id="requestSelectedStockHold">Create Hold Request →</button>':'')+'</div>';
    $('clearSelectedStockContext').onclick=()=>{selectedStockVehicle=null;renderSelectedStockContext();document.querySelectorAll('#stockTable tbody tr.selected-stock-row').forEach(r=>{r.classList.remove('selected-stock-row');r.setAttribute('aria-selected','false');});};
    $('requestSelectedStockHold')?.addEventListener('click',()=>openStockHoldDialog(v));
    $('createQuoteFromSelectedStock')?.addEventListener('click',async e=>{
      const button=e.currentTarget;if(button.disabled)return;
      if(typeof window.startQuotationFromStock!=='function'){notify('Quotation launch service is not available. Refresh the page and try again.');return;}
      button.disabled=true;const oldText=button.textContent;button.textContent='Opening Quotation…';
      try{await window.startQuotationFromStock(v);}
      catch(error){console.error(error);notify(error.message||'Could not open quotation from selected stock.');}
      finally{button.disabled=false;button.textContent=oldText;}
    });
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
      const tables=['vehicles','vehicle_exit_records','quotations','quotation_items','price_list_versions','price_list_items','stock_holds','stock_import_batches','otf_order_books'];
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
      const order=['vehicles','vehicle_exit_records','quotations','quotation_items','price_list_versions','price_list_items','stock_holds','stock_import_batches','otf_order_books'];
      for(const t of order){const rows=payload.data[t]||[];if(rows.length)await call(db().from(t).upsert(rows));}
      await audit('backup_restore','restore','Restored operational backup');
      notify('Operational data restore completed.');
    }catch(e){notify(e.message);}
  };
  const resetLabels={
    'personal.stock':'Personal · Stock Register','personal.holds':'Personal · Stock Hold Management','personal.quotations':'Personal · Quotations','personal.price_list':'Personal · Price List','personal.excel_upload':'Personal · Excel Upload History',
    'ev.stock':'EV · Stock Register','ev.holds':'EV · Stock Hold Management','ev.quotations':'EV · Quotations','ev.price_list':'EV · Price List','ev.excel_upload':'EV · Excel Upload History',
    'commercial.stock':'Commercial · Stock Register','commercial.holds':'Commercial · Stock Hold Management','commercial.quotations':'Commercial · Quotations','commercial.price_list':'Commercial · Price List','commercial.excel_upload':'Commercial · Excel Upload History',
    'llm.stock':'LLM · Stock Register','llm.holds':'LLM · Stock Hold Management','llm.quotations':'LLM · Quotations','llm.price_list':'LLM · Price List','llm.excel_upload':'LLM · Excel Upload History',
    'workspace.price_list_imports':'Workspace · Price List Import History','workspace.common_excel_upload':'Workspace · Common Excel Upload History','workspace.audit_history':'Workspace · Audit History','workspace.retail_reports':'Workspace · Retail Reports'
  };
  const RESET_OWNER_UID='236565a9-1892-41ee-b54a-c81bde3b9b01';
  function resetIsSuperAdmin(){return !!currentUser&&currentUser.id===RESET_OWNER_UID&&currentProfile?.user_id===RESET_OWNER_UID&&currentProfile?.is_super_admin===true&&String(currentProfile?.status||'').toLowerCase()==='active';}
  function syncOperationalResetVisibility(){
    const allowed=!!currentProfile&&currentProfile.user_id===RESET_OWNER_UID&&currentProfile.is_super_admin===true&&String(currentProfile.status||'').toLowerCase()==='active';
    const area=$('svOperationalResetArea'),dialog=$('svResetDialog');
    if(area){area.style.display=allowed?'block':'none';area.hidden=false;}
    if(!allowed&&dialog)dialog.hidden=true;
    if(!allowed&&$('svResetSelectionSummary'))$('svResetSelectionSummary').hidden=true;
  }
  function resetSelectedKeys(){return [...document.querySelectorAll('#svResetTree input[type=checkbox][value]:checked')].map(x=>x.value);}
  function syncResetSelectionUI(){
    const selected=resetSelectedKeys(),all=[...document.querySelectorAll('#svResetTree input[type=checkbox][value]')];
    if($('svResetCheckedCount'))$('svResetCheckedCount').textContent=selected.length+' options selected';
    if($('svResetSelectAll'))$('svResetSelectAll').checked=all.length>0&&selected.length===all.length;
    document.querySelectorAll('#svResetTree input[data-reset-group]').forEach(g=>{const prefix=g.dataset.resetGroup==='workspace'?'workspace.':g.dataset.resetGroup+'.';const members=all.filter(x=>x.value.startsWith(prefix));g.checked=members.length>0&&members.every(x=>x.checked);});
  }
  window.openOperationalResetDialog=()=>{
    if(!resetIsSuperAdmin()){notify('Operational Reset is available only to an active Super Admin.');return;}
    if($('svResetDialog'))$('svResetDialog').hidden=false;
    syncResetSelectionUI();
  };
  window.closeOperationalResetDialog=()=>{if($('svResetDialog'))$('svResetDialog').hidden=true;};
  window.reviewOperationalReset=async()=>{
    try{
      if(!resetIsSuperAdmin())throw new Error('Only Super Admin can reset operational data.');
      const keys=resetSelectedKeys();if(!keys.length)throw new Error('Select at least one department or function.');
      const result=await call(db().rpc('svm_operational_reset',{p_selection:keys,p_execute:false}));
      const counts=result?.counts||{};
      $('svResetSummaryRows').innerHTML=keys.map(k=>'<div style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #f0dfe1;padding:5px 0"><span>'+String(resetLabels[k]||k).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</span><b>'+Number(counts[k]||0)+' records</b></div>').join('');
      $('svResetSummaryTotal').textContent='Total records to be cleared: '+Number(result?.total_rows||0);
      $('svResetSelectionSummary').hidden=false;
      window.closeOperationalResetDialog();
      $('svResetSelectionSummary').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(e){notify(e.message);}
  };
  window.confirmOperationalReset=async()=>{
    try{
      if(!resetIsSuperAdmin())throw new Error('Only Super Admin can reset operational data.');
      const keys=resetSelectedKeys();if(!keys.length)throw new Error('No reset selection found. Reopen and select items.');
      const preview=await call(db().rpc('svm_operational_reset',{p_selection:keys,p_execute:false}));
      const lines=keys.map(k=>(resetLabels[k]||k)+': '+Number(preview?.counts?.[k]||0)+' records').join('\\n');
      if(!confirm('FINAL CONFIRMATION — permanently delete these selected records?\\n\\n'+lines+'\\n\\nEmployee Management, employee accounts and permissions will NOT be deleted. This action cannot be undone.'))return;
      const done=await call(db().rpc('svm_operational_reset',{p_selection:keys,p_execute:true}));
      if(!done?.executed)throw new Error('Reset did not confirm successful execution.');
      notify('Selected operational data has been reset. Employee Management was preserved.');
      setTimeout(()=>location.reload(),900);
    }catch(e){notify(e.message);}
  };
  document.addEventListener('change',e=>{
    if(e.target?.matches('#svResetTree input[type=checkbox][value]'))syncResetSelectionUI();
    if(e.target?.matches('#svResetTree input[data-reset-group]')){
      const group=e.target.dataset.resetGroup;
      const prefix=group==='workspace'?'workspace.':group+'.';
      document.querySelectorAll('#svResetTree input[type=checkbox][value]').forEach(x=>{if(x.value.startsWith(prefix))x.checked=e.target.checked;});
      syncResetSelectionUI();
    }
    if(e.target?.id==='svResetSelectAll'){
      document.querySelectorAll('#svResetTree input[type=checkbox][value]').forEach(x=>x.checked=e.target.checked);
      document.querySelectorAll('#svResetTree input[data-reset-group]').forEach(x=>x.checked=e.target.checked);
      syncResetSelectionUI();
    }
  });
  window.resetAllExceptEmployees=window.openOperationalResetDialog;
  let retailReportRows=[];
  function retailDateISO(date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
  function retailAddDays(iso,days){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return retailDateISO(d);}
  function retailSelectedRange(){
    const mode=$('retailReportType')?.value||'monthly';
    const today=retailDateISO(new Date());
    let start='',end='';
    if(mode==='daily'){start=$('retailDailyDate')?.value||today;end=start;}
    else if(mode==='weekly'){start=$('retailWeekStart')?.value||today;const d=new Date(start+'T12:00:00');const day=d.getDay();d.setDate(d.getDate()-(day===0?6:day-1));start=retailDateISO(d);end=retailAddDays(start,6);if($('retailWeekStart'))$('retailWeekStart').value=start;}
    else if(mode==='monthly'){const month=$('retailMonth')?.value||today.slice(0,7);const [y,m]=month.split('-').map(Number);if(!y||!m||m<1||m>12)throw new Error('Select a valid report month.');start=month+'-01';end=month+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0');}
    else {start=$('retailFrom')?.value||'';end=$('retailTo')?.value||'';if(!start||!end)throw new Error('Select both From Date and To Date.');if(start>end)throw new Error('From Date cannot be after To Date.');}
    return {mode,start,end};
  }
  function updateRetailFilterVisibility(){
    const mode=$('retailReportType')?.value||'monthly';
    const show=(id,on)=>{const el=$(id);if(el)el.hidden=!on;};
    show('retailDailyWrap',mode==='daily');show('retailWeeklyWrap',mode==='weekly');show('retailMonthlyWrap',mode==='monthly');show('retailFromWrap',mode==='custom');show('retailToWrap',mode==='custom');
  }
  function renderRetailRows(rows){
    const body=$('retailRows');if(!body)return;
    const typeLabel={RETAIL:'Retail',DEMO:'Demo',DAMAGE:'Damage',TRANSFER_OUT:'Transfer Out',OTHER:'Other'};
    body.innerHTML=rows.length?rows.map(v=>'<tr><td>'+esc(v.exit_date||'—')+'</td><td>'+esc(v.chassis_number||'—')+'</td><td>'+esc(v.model||'—')+'</td><td>'+esc(v.variant||'—')+'</td><td>'+esc(v.department||'—')+'</td><td><span class="pill '+(v.exit_type==='RETAIL'?'green':'')+'">'+esc(typeLabel[v.exit_type]||v.exit_type||'—')+'</span></td><td>'+esc(v.customer_name||'—')+'</td><td>'+esc(v.sc_name||'—')+'</td><td>'+esc(v.reason||v.destination||'—')+'</td></tr>').join(''):'<tr><td colspan="9" class="empty">No vehicle exit records found for the selected filters.</td></tr>';
  }
  async function loadRetailReport(){
    const body=$('retailRows'),section=$('view-reports');
    if(!body)return;
    const cards=section?.querySelectorAll('[data-retail-kpi]');
    if(!has('retail_reports','view')){body.innerHTML='<tr><td colspan="9" class="empty">Vehicle Exit Reports permission required.</td></tr>';cards?.forEach(x=>x.textContent='—');return;}
    try{
      const {start,end}=retailSelectedRange();
      const allowed=allowedDepartmentList();
      const chosenDept=$('retailDepartment')?.value||'';
      const departments=chosenDept?(allowed.includes(chosenDept)?[chosenDept]:[]):allowed;
      const customer=String($('retailCustomer')?.value||'').trim();
      const executive=String($('retailExecutive')?.value||'').trim();
      const exitType=$('retailExitType')?.value||'';
      let rows=[],offset=0,chunk=1000;
      while(departments.length){
        let q=db().from('vehicle_exit_records').select('*').gte('exit_date',start).lte('exit_date',end).in('department',departments).order('exit_date',{ascending:false}).order('created_at',{ascending:false}).range(offset,offset+chunk-1);
        if(exitType)q=q.eq('exit_type',exitType);
        if(customer)q=q.ilike('customer_name','%'+customer.replace(/[%_]/g,'\\$&')+'%');
        if(executive)q=q.ilike('sc_name','%'+executive.replace(/[%_]/g,'\\$&')+'%');
        const part=await call(q);rows.push(...part);if(part.length<chunk)break;offset+=chunk;
      }
      retailReportRows=rows;
      const count=type=>rows.filter(v=>v.exit_type===type).length;
      const set=(key,value)=>{const el=section?.querySelector('[data-retail-kpi="'+key+'"]');if(el)el.textContent=String(value).padStart(2,'0');};
      set('total',rows.length);set('retail',count('RETAIL'));set('demo',count('DEMO'));set('damage',count('DAMAGE'));set('transfer',count('TRANSFER_OUT'));set('other',count('OTHER'));
      renderRetailRows(rows);
      const fmt=x=>{const d=new Date(x+'T12:00:00');return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});};
      const period=$('retailPeriod');if(period)period.textContent=fmt(start)+' – '+fmt(end);
      const desc=$('retailRegisterDescription');if(desc)desc.textContent=rows.length+' vehicle exits · '+start+' to '+end+' · Permanent Supabase history';
      const status=$('retailReportStatus');if(status)status.textContent=rows.length+' matching exit record'+(rows.length===1?'':'s');
    }catch(e){
      console.error('Vehicle Exit report load failed:',e);
      body.innerHTML='<tr><td colspan="9" class="empty">'+esc(e.message||'Unable to load vehicle exit records.')+'</td></tr>';
      const status=$('retailReportStatus');if(status)status.textContent=e.message||'Unable to load report';
      notify(e.message||'Unable to load Vehicle Exit Reports.');
    }
  }
  function exportRetailCsv(){
    if(!retailReportRows.length){notify('There are no vehicle exit records to export.');return;}
    const cols=[['Exit Date','exit_date'],['Chassis Number','chassis_number'],['Vehicle Model','model'],['Variant','variant'],['Department','department'],['Exit Type','exit_type'],['Customer','customer_name'],['Sales Executive','sc_name'],['Reason','reason'],['Destination','destination']];
    const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv='\uFEFF'+[cols.map(x=>quote(x[0])).join(','),...retailReportRows.map(row=>cols.map(c=>quote(row[c[1]]||'')).join(','))].join('\\r\\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Siddhivinayak-Vehicle-Exit-Report-'+retailDateISO(new Date())+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
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
    $('printQuote')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.printCurrentSavedQuote?.();},true);
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
    // Explicitly refresh live stock after department navigation. The original shell
    // changes the view first; defer the data request until its department is selected.
    document.querySelectorAll('[data-page^="stock-"]:not([data-page^="stock-hold-"])').forEach(button=>{
      if(button.dataset.liveStockBound==='1')return;
      button.dataset.liveStockBound='1';
      button.addEventListener('click',()=>setTimeout(()=>renderStock(),80),true);
    });
    const stockQuick=document.querySelector('.quick[data-go="stock"]');
    if(stockQuick&&!stockQuick.dataset.liveStockBound){
      stockQuick.dataset.liveStockBound='1';
      stockQuick.addEventListener('click',()=>setTimeout(()=>renderStock(),100),true);
    }
    const stockRefresh=$('view-stock')?.querySelector('.stock-refresh-button');
    if(stockRefresh&&!stockRefresh.dataset.liveStockBound){
      stockRefresh.dataset.liveStockBound='1';
      stockRefresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();renderStock().then(()=>notify('Live Stock Register refreshed.'));},true);
    }
    const stockFilter=$('stockDepartmentFilter');
    if(stockFilter){const current=stockFilter.value;stockFilter.innerHTML='<option>All Accessible Departments</option>'+permittedDepartments.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');if(permittedDepartments.includes(current))stockFilter.value=current;stockFilter.onchange=()=>renderStock();}
    const addButton=$('addVehicle');if(addButton){addButton.style.display=canManageStock()?'':'none';addButton.disabled=!canManageStock();}
    const newVehicleDept=$('stockDepartmentForNewVehicle');
    if(newVehicleDept){newVehicleDept.innerHTML=permittedDepartments.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');newVehicleDept.value=permittedDepartments[0]||'';}
    if($('retailReportType')&&!$('retailReportType').dataset.bound){
      $('retailReportType').dataset.bound='1';
      $('retailReportType').addEventListener('change',()=>{updateRetailFilterVisibility();});
      $('applyRetailMonth')?.addEventListener('click',e=>{e.preventDefault();loadRetailReport();});
      $('retailRefresh')?.addEventListener('click',e=>{e.preventDefault();loadRetailReport();});
      $('retailClearFilters')?.addEventListener('click',()=>{const today=retailDateISO(new Date());$('retailReportType').value='monthly';if($('retailExitType'))$('retailExitType').value='';$('retailDailyDate').value=today;$('retailWeekStart').value=today;$('retailMonth').value=today.slice(0,7);$('retailFrom').value=today;$('retailTo').value=today;$('retailDepartment').value='';$('retailCustomer').value='';$('retailExecutive').value='';updateRetailFilterVisibility();loadRetailReport();});
      $('retailExportCsv')?.addEventListener('click',exportRetailCsv);
      $('retailPrint')?.addEventListener('click',()=>{window.print();});
      ['retailCustomer','retailExecutive'].forEach(id=>$(id)?.addEventListener('keydown',e=>{if(e.key==='Enter')loadRetailReport();}));
      const today=retailDateISO(new Date());$('retailDailyDate').value=today;$('retailWeekStart').value=today;$('retailMonth').value=today.slice(0,7);$('retailFrom').value=today;$('retailTo').value=today;
      const dept=$('retailDepartment');if(dept){const allowed=allowedDepartmentList();dept.innerHTML='<option value="">All Accessible Departments</option>'+allowed.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');}
      updateRetailFilterVisibility();
    }
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
        if(p==='otf-management')loadOtfManagement(otfManagementDepartment).catch(e=>notify(e.message));
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

  // OTF Order Book — quotation lookup and independent chassis verification.
  let otfDepartment='Personal', otfMatches=[], otfSelectedQuote=null, otfVerifiedVehicle=null, otfImportedVehicleId=null;
  const otfDigits=v=>String(v||'').replace(/\D/g,'');
  const otfNorm=v=>String(v||'').normalize('NFD').replace(/\p{M}/gu,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const otfValue=id=>$(id)?.value?.trim()||'';
  const otfNumber=id=>Math.max(0,Number($(id)?.value||0)||0);
  const otfMoney=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const otfDeptCode={Personal:'PV',EV:'EV',Commercial:'CV',LLM:'LV'};
  function otfSetStatus(message,isError=false){const el=$('otfFormStatus');if(el){el.textContent=message;el.style.color=isError?'#b4232c':'#64748b';}}
  function otfResetSelection(){
    otfSelectedQuote=null;otfVerifiedVehicle=null;otfImportedVehicleId=null;
    if($('otfSelectedQuote')){$('otfSelectedQuote').hidden=true;$('otfSelectedQuote').textContent='';}
    if($('otfVehicleVerified')){$('otfVehicleVerified').hidden=true;$('otfVehicleVerified').textContent='';}
    if($('otfPrintPreview'))$('otfPrintPreview').disabled=true;
  }
  window.otfOpenDepartment=async function(department){
    if(!['Personal','EV','Commercial','LLM'].includes(department))return;
    if(!has('otf_management','view')){notify('Quotation / OTF permission required.');return;}
    if(!allowedDepartmentList().includes(department)&&!canManageOtf()){notify('You do not have access to '+department+'.');return;}
    otfDepartment=department;otfResetSelection();otfMatches=[];
    if($('otfPageTitle'))$('otfPageTitle').textContent=department+' — OTF Order Book';
    if($('otfPhoneSearch'))$('otfPhoneSearch').value='';
    if($('otfQuoteResults'))$('otfQuoteResults').innerHTML='';
    if($('otfChassisInput'))$('otfChassisInput').value='';
    const formIds=['otfCustomerName','otfCustomerPhone','otfEnquiryNumber','otfCustomerId','otfInvoiceNumber','otfCustomerGstin','otfAadhaar','otfPan','otfEmail','otfAddress','otfCity','otfDistrict','otfHpa','otfBookingAmount','otfDob','otfAnniversary','otfNominee','otfNomineeRelation','otfNomineeAge','otfExchangeModel','otfExchangeReg','otfExchangeYear','otfExchangeValue','otfExchangeSupport','otfExchangeTotal'];
    formIds.forEach(id=>{if($(id))$(id).value=id==='otfBookingAmount'?'0':'';});
    if($('otfBookingDate')){const d=new Date();$('otfBookingDate').value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    if($('otfPayments'))$('otfPayments').innerHTML='';
    if($('otfAccessories'))$('otfAccessories').innerHTML='';
    otfSetStatus('Select a quotation and verify the chassis number before saving.');

  };
  async function searchOtfQuotes(){
    if(!has('otf_management','view'))throw new Error('Quotation view permission required.');
    const phone=otfDigits(otfValue('otfPhoneSearch'));
    if(phone.length!==10)throw new Error('Enter a valid 10-digit mobile number.');
    otfResetSelection();if($('otfChassisInput'))$('otfChassisInput').value='';
    const phoneVariants=[phone,'+91'+phone,'91'+phone,'0'+phone];
    const rows=await call(db().from('quotations').select('*,quotation_items(*)').eq('department',otfDepartment).in('phone',phoneVariants).order('created_at',{ascending:false}).limit(100));
    otfMatches=rows.filter(q=>otfDigits(q.phone)===phone);
    const box=$('otfQuoteResults');
    if(!otfMatches.length){box.innerHTML='<div class="empty">No quotations found for this mobile number in '+esc(otfDepartment)+'.</div>';return;}
    box.innerHTML='<div class="card-desc" style="margin:8px 0">Found '+otfMatches.length+' quotation(s). Select the exact quotation for this booking.</div><div style="display:grid;gap:8px">'+otfMatches.map((q,i)=>'<button type="button" class="btn" data-otf-quote-index="'+i+'" style="display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left;flex-wrap:wrap"><span><b>'+esc(q.quote_number)+'</b> · '+esc(q.customer_name)+' · '+esc([q.model,q.variant].filter(Boolean).join(' / '))+'</span><b>'+otfMoney(q.total)+'</b></button>').join('')+'</div>';
    box.querySelectorAll('[data-otf-quote-index]').forEach(btn=>btn.addEventListener('click',()=>selectOtfQuote(Number(btn.dataset.otfQuoteIndex))));
  }
  function otfEnsureSuggestionUi(){
    const input=$('otfChassisInput');if(!input)return null;
    let box=$('otfChassisSuggestions');
    if(!box){box=document.createElement('div');box.id='otfChassisSuggestions';box.className='q-stock-suggestions';box.hidden=true;input.closest('.form-grid')?.insertAdjacentElement('afterend',box);}
    return box;
  }
  async function loadOtfChassisSuggestions(){
    const box=otfEnsureSuggestionUi();if(!box||!otfSelectedQuote)return;
    box.hidden=false;box.innerHTML='<div class="q-stock-count">Finding matching chassis in '+esc(otfDepartment)+' Stock Register…</div>';
    const [stock,bookings]=await Promise.all([
      call(db().from('vehicles').select('id,department,chassis_number,engine_number,model,variant,colour,status,stage,manufacturing_year,place').eq('department',otfDepartment).limit(2000)),
      call(db().from('otf_order_books').select('id,order_number,chassis_number,status').in('status',['BOOKED','IN PROCESS','DELIVERED']).limit(5000))
    ]);
    const booked=new Map(bookings.map(x=>[otfNorm(x.chassis_number),x]));
    const candidates=stock.filter(v=>otfNorm(v.model)===otfNorm(otfSelectedQuote.model)&&otfNorm(v.variant)===otfNorm(otfSelectedQuote.variant))
      .map(v=>({...v,activeOtf:booked.get(otfNorm(v.chassis_number))||null}));
    if(!candidates.length){box.innerHTML='<div class="q-stock-empty">No matching chassis found for this exact Model + Variant in '+esc(otfDepartment)+' Stock Register. You may enter an external chassis if applicable.</div>';return;}
    box.innerHTML='<div class="q-stock-count">'+candidates.length+' matching chassis in Stock Register · '+esc(otfSelectedQuote.model)+' / '+esc(otfSelectedQuote.variant)+'. Previously booked vehicles remain visible.</div>'+candidates.map((v,i)=>'<button type="button" class="q-stock-option" data-otf-stock-index="'+i+'"><span class="q-stock-main"><b>'+esc(v.chassis_number)+'</b><span>'+esc(v.model)+' / '+esc(v.variant)+' · '+esc(v.colour||'Colour not recorded')+'</span></span><span class="q-stock-meta"><b>'+esc(v.activeOtf?'Already OTF · '+v.activeOtf.status:(v.status||'')+' · '+(v.stage||''))+'</b><small>'+esc(v.place||'')+(v.activeOtf?' · '+esc(v.activeOtf.order_number||'Existing OTF'):'')+'</small></span></button>').join('');
    box.querySelectorAll('[data-otf-stock-index]').forEach(btn=>btn.addEventListener('click',async()=>{const v=candidates[Number(btn.dataset.otfStockIndex)];if(!v)return;$('otfChassisInput').value=v.chassis_number;await verifyOtfChassis();box.hidden=true;}));
  }
  async function openOtfStockPicker(){
    if(!has('otf_management','view'))throw new Error('OTF Stock import permission required.');
    const existing=$('otfStockPicker');if(existing)existing.remove();
    const wrap=document.createElement('div');wrap.id='otfStockPicker';
    wrap.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.48);display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML='<section style="width:min(980px,100%);max-height:90vh;overflow:hidden;background:#fff;border-radius:16px;box-shadow:0 22px 70px rgba(15,23,42,.28);display:flex;flex-direction:column"><header style="padding:18px 20px;border-bottom:1px solid #e5eaf0;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><h2 style="margin:0;font-size:19px;color:#1d2733">Import Vehicle from '+esc(otfDepartment)+' Stock</h2><p style="margin:5px 0 0;color:#64748b;font-size:13px">Select the exact vehicle from the live Stock Register, then press Verify Chassis.</p></div><button type="button" class="btn" data-otf-stock-close>Close</button></header><div style="padding:14px 20px;border-bottom:1px solid #e5eaf0"><input id="otfStockPickerSearch" class="field" style="width:100%;min-height:42px" placeholder="Search model, variant, chassis number, colour or engine number"></div><div id="otfStockPickerCount" style="padding:9px 20px;color:#64748b;font-size:12px"></div><div id="otfStockPickerRows" style="overflow:auto;padding:0 20px 18px;display:grid;gap:7px"></div></section>';
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.querySelector('[data-otf-stock-close]').addEventListener('click',close);
    wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
    const rowsBox=$('otfStockPickerRows'),count=$('otfStockPickerCount'),search=$('otfStockPickerSearch');
    rowsBox.innerHTML='<div class="notice">Loading live stock records…</div>';
    const [stock,bookings]=await Promise.all([
      call(db().from('vehicles').select('id,department,chassis_number,engine_number,model,variant,colour,status,stage,manufacturing_year,place').eq('department',otfDepartment).order('model',{ascending:true}).limit(2000)),
      call(db().from('otf_order_books').select('id,order_number,chassis_number,status').in('status',['BOOKED','IN PROCESS','DELIVERED']).limit(5000))
    ]);
    const booked=new Map(bookings.map(x=>[otfNorm(x.chassis_number),x]));
    const list=stock.map(v=>({...v,activeOtf:booked.get(otfNorm(v.chassis_number))||null}));
    const render=()=>{
      const term=otfNorm(search.value);
      const filtered=list.filter(v=>!term||[v.model,v.variant,v.chassis_number,v.colour,v.engine_number,v.status,v.stage,v.place].some(x=>otfNorm(x).includes(term)));
      count.textContent=filtered.length+' of '+list.length+' stock vehicles · '+otfDepartment+' Department';
      rowsBox.innerHTML=filtered.length?filtered.map((v,i)=>'<button type="button" data-otf-import-index="'+list.indexOf(v)+'" style="width:100%;text-align:left;border:1px solid #e1e7ef;background:#fff;border-radius:10px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;cursor:pointer;color:#253140"><span style="display:grid;gap:4px"><b>'+esc(v.model||'Model not recorded')+' · '+esc(v.variant||'Variant not recorded')+'</b><span style="font-size:12px;color:#64748b">Chassis: '+esc(v.chassis_number||'Not recorded')+' · Colour: '+esc(v.colour||'Not recorded')+' · Mfg. Year: '+esc(v.manufacturing_year||'Not recorded')+'</span><small style="color:#64748b">Engine: '+esc(v.engine_number||'Not recorded')+' · '+esc(v.place||'')+'</small></span><span style="font-size:12px;font-weight:700;color:'+(v.activeOtf?'#b4232c':'#16734a')+'">'+esc(v.activeOtf?'Already OTF · '+v.activeOtf.order_number:(v.status||'')+' · '+(v.stage||''))+'</span></button>').join(''):'<div class="notice">No stock vehicles match this search.</div>';
      rowsBox.querySelectorAll('[data-otf-import-index]').forEach(btn=>btn.addEventListener('click',()=>{
        const v=list[Number(btn.dataset.otfImportIndex)];if(!v)return;
        if(!v.chassis_number){notify('This stock record has no chassis number. Please correct the Stock Register record first.');return;}
        $('otfChassisInput').value=v.chassis_number;
        otfImportedVehicleId=v.id;
        otfVerifiedVehicle=null;
        if($('otfVehicleVerified')){$('otfVehicleVerified').hidden=true;$('otfVehicleVerified').textContent='';}
        if($('otfPrintPreview'))$('otfPrintPreview').disabled=true;
        close();
        otfSetStatus('Imported '+v.model+' / '+(v.variant||'')+' from Stock Register. Press Verify Chassis to load and confirm the vehicle details.');
        notify('Chassis selected from Stock. Now press Verify Chassis.');
      }));
    };
    search.addEventListener('input',render);render();search.focus();
  }
  function otfShowExternalChoice(message){
    const box=$('otfVehicleVerified');if(!box)return;box.hidden=false;box.innerHTML='';
    const msg=document.createElement('div');msg.textContent=message+' This chassis is not in '+otfDepartment+' Stock Register.';
    const btn=document.createElement('button');btn.type='button';btn.className='btn small primary';btn.style.marginTop='9px';btn.textContent='Use as External Vehicle (Not in Stock Register)';btn.addEventListener('click',()=>markOtfExternalVehicle().catch(e=>notify(e.message)));
    box.append(msg,document.createElement('br'),btn);
  }
  async function markOtfExternalVehicle(){
    if(!otfSelectedQuote)throw new Error('Select a quotation first.');
    const chassis=otfValue('otfChassisInput').toUpperCase().replace(/\\s+/g,'');
    if(chassis.length<5)throw new Error('Enter the complete chassis number.');
    const rows=await call(db().from('otf_order_books').select('id,chassis_number,status').in('status',['BOOKED','IN PROCESS','DELIVERED']).limit(5000));
    if(rows.some(r=>otfNorm(r.chassis_number)===otfNorm(chassis)&&r.id!==otfEditingId))throw new Error('This chassis already has an active OTF booking. A second OTF cannot be created.');
    otfVerifiedVehicle={id:null,department:otfDepartment,chassis_number:chassis,engine_number:'',model:otfSelectedQuote.model,variant:otfSelectedQuote.variant,colour:'',status:'External',stage:'Not in Stock Register',manufacturing_year:null,external:true};
    const box=$('otfVehicleVerified');if(box){box.hidden=false;box.textContent='EXTERNAL VEHICLE · '+chassis+' · '+otfSelectedQuote.model+' / '+(otfSelectedQuote.variant||'')+' · Not present in Stock Register.';}
    if($('otfPrintPreview'))$('otfPrintPreview').disabled=false;otfSetStatus('External vehicle selected. It will not be marked as stock verified.');
  }
  function selectOtfQuote(index){
    const q=otfMatches[index];if(!q)return;
    otfSelectedQuote=q;otfVerifiedVehicle=null;
    if($('otfSelectedQuote')){$('otfSelectedQuote').hidden=false;$('otfSelectedQuote').textContent='Selected quotation: '+q.quote_number+' · '+q.customer_name+' · '+q.model+' / '+(q.variant||'')+' · Grand Total '+otfMoney(q.total)+'. Select a matching chassis suggestion or enter one manually.';}
    const set=(id,value)=>{if($(id))$(id).value=value??'';};
    set('otfCustomerName',q.customer_name);set('otfCustomerPhone',q.phone);set('otfCustomerGstin',q.customer_gstin||'');
    set('otfEmail',q.email||'');set('otfAddress',q.address||'');set('otfCity','');set('otfDistrict','');set('otfHpa',q.hypo||'');
    if($('otfChassisInput'))$('otfChassisInput').value='';
    if($('otfVehicleVerified')){$('otfVehicleVerified').hidden=true;$('otfVehicleVerified').textContent='';}
    if($('otfPrintPreview'))$('otfPrintPreview').disabled=true;
    otfSetStatus('Quotation selected. Matching chassis suggestions are loading.');
    loadOtfChassisSuggestions().catch(e=>{const box=otfEnsureSuggestionUi();if(box){box.hidden=false;box.textContent='Could not load chassis suggestions: '+e.message;}});
  }
  async function verifyOtfChassis(){
    if(!otfSelectedQuote)throw new Error('Select a quotation first.');
    const chassis=otfValue('otfChassisInput').toUpperCase().replace(/\\s+/g,'');
    if(chassis.length<5)throw new Error('Enter the complete chassis number.');
    // Search the employee's accessible departments so a chassis from EV/Commercial/LLM
    // cannot be accidentally booked under the currently open department.
    const accessible=allowedDepartmentList();
    const matches=otfImportedVehicleId
      ? await call(db().from('vehicles').select('id,department,chassis_number,engine_number,model,variant,colour,status,stage,manufacturing_year').in('department',accessible).eq('id',otfImportedVehicleId).limit(1))
      : await call(db().from('vehicles').select('id,department,chassis_number,engine_number,model,variant,colour,status,stage,manufacturing_year').in('department',accessible).eq('chassis_number',chassis).limit(5));
    const row=matches[0]||null;
    if(row&&otfNorm(row.chassis_number)!==otfNorm(chassis))throw new Error('The selected stock vehicle chassis number changed. Import it again from Stock Register.');
    if(row&&row.department!==otfDepartment){
      otfVerifiedVehicle=null;if($('otfPrintPreview'))$('otfPrintPreview').disabled=true;
      throw new Error('Department mismatch: this chassis belongs to '+row.department+', but you opened '+otfDepartment+' OTF. Open '+row.department+' OTF Order Book and select the matching quotation.');
    }
    if(!row){otfVerifiedVehicle=null;if($('otfPrintPreview'))$('otfPrintPreview').disabled=true;otfShowExternalChoice('Chassis not found in your accessible department stock. If it is genuinely an external vehicle, use the external option.');return;}
    const active=await call(db().from('otf_order_books').select('id,order_number,chassis_number,status').in('status',['BOOKED','IN PROCESS','DELIVERED']).limit(5000));
    const activeBooking=active.find(x=>otfNorm(x.chassis_number)===otfNorm(chassis)&&x.id!==otfEditingId)||null;
    const mismatch=otfNorm(row.model)!==otfNorm(otfSelectedQuote.model)||
      (otfNorm(row.variant)!==otfNorm(otfSelectedQuote.variant));
    if(mismatch)throw new Error('Vehicle mismatch: this chassis belongs to '+[row.model,row.variant].filter(Boolean).join(' / ')+', but selected quotation is '+[otfSelectedQuote.model,otfSelectedQuote.variant].filter(Boolean).join(' / ')+'. Select the matching quotation or correct chassis.');
    otfVerifiedVehicle={...row,activeOtfBooking:activeBooking};
    if($('otfVehicleVerified')){
      $('otfVehicleVerified').hidden=false;
      $('otfVehicleVerified').innerHTML='<b style="display:block;margin-bottom:8px">VERIFIED FROM LIVE STOCK REGISTER</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px 14px"><span><b>Model:</b> '+esc(row.model||'Not recorded')+'</span><span><b>Variant:</b> '+esc(row.variant||'Not recorded')+'</span><span><b>Colour:</b> '+esc(row.colour||'Not recorded')+'</span><span><b>Manufacturing Year:</b> '+esc(row.manufacturing_year||'Not recorded')+'</span><span><b>Chassis Number:</b> '+esc(row.chassis_number||'Not recorded')+'</span><span><b>Engine Number:</b> '+esc(row.engine_number||'Not recorded')+'</span><span><b>Stock Status:</b> '+esc(row.status||'Not recorded')+'</span><span><b>Stock Stage:</b> '+esc(row.stage||'Not recorded')+'</span></div>'+(activeBooking?'<div style="margin-top:8px;color:#b4232c;font-weight:700">ALREADY OTF: '+esc(activeBooking.order_number)+' ('+esc(activeBooking.status)+'). Duplicate active booking will be blocked.</div>':'');
    }
    if($('otfPrintPreview'))$('otfPrintPreview').disabled=false;
    otfSetStatus(activeBooking?'Chassis details loaded. Existing OTF found; duplicate active booking will be prevented.':'Chassis verified against the live Stock Register.');
  }
  function otfCollectRows(selector,fields){
    return [...document.querySelectorAll(selector)].map(row=>Object.fromEntries(fields.map(([key,sel])=>[key,row.querySelector(sel)?.value?.trim()||''])))
      .filter(x=>Object.values(x).some(v=>v!==''));
  }
  function addOtfPayment(){
    const wrap=$('otfPayments');if(!wrap)return;
    const row=document.createElement('div');row.className='form-grid otf-payment-row';row.style.cssText='grid-template-columns:1fr 1fr 1fr 1fr auto;margin:8px 0';
    row.innerHTML='<label class="field">Payment Type<input data-pay="type" placeholder="Booking / Loan / Other"></label><label class="field">Date<input data-pay="date" type="date"></label><label class="field">Amount (₹)<input data-pay="amount" type="number" min="0" step="0.01"></label><label class="field">Mode / Reference<input data-pay="mode" placeholder="Cash / UPI / NEFT / Cheque"></label><button type="button" class="btn soft" aria-label="Remove payment" style="align-self:end" data-remove-row>×</button>';
    row.querySelector('[data-remove-row]').onclick=()=>row.remove();wrap.appendChild(row);
  }
  function addOtfAccessory(){
    const wrap=$('otfAccessories');if(!wrap)return;
    const row=document.createElement('div');row.className='form-grid otf-accessory-row';row.style.cssText='grid-template-columns:1.2fr 1fr 1fr auto;margin:8px 0';
    row.innerHTML='<label class="field">Item<input data-acc="item" placeholder="Accessory name"></label><label class="field">Part Number<input data-acc="part" placeholder="Part number"></label><label class="field">Amount (₹)<input data-acc="amount" type="number" min="0" step="0.01"></label><button type="button" class="btn soft" aria-label="Remove accessory" style="align-self:end" data-remove-row>×</button>';
    row.querySelector('[data-remove-row]').onclick=()=>row.remove();wrap.appendChild(row);
  }
  function buildOtfPayload(){
    if(!otfSelectedQuote)throw new Error('Select a quotation by mobile number.');
    if(!otfVerifiedVehicle)throw new Error('Verify the chassis number against Stock Register.');
    if(otfVerifiedVehicle.activeOtfBooking&&otfVerifiedVehicle.activeOtfBooking.id!==otfEditingId)throw new Error('This chassis already has active OTF '+otfVerifiedVehicle.activeOtfBooking.order_number+' ('+otfVerifiedVehicle.activeOtfBooking.status+'). Vehicle details are loaded, but a duplicate active OTF cannot be saved.');
    const address=otfValue('otfAddress');
    if(!address)throw new Error('Enter the complete customer address.');
    const aadhaar=otfDigits(otfValue('otfAadhaar')),pan=otfValue('otfPan').toUpperCase();
    if(aadhaar&&aadhaar.length!==12)throw new Error('Aadhaar must contain 12 digits.');
    if(pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))throw new Error('Enter a valid 10-character PAN number.');
    const q=otfSelectedQuote,v=otfVerifiedVehicle,code=otfDeptCode[otfDepartment]||'PV';
    const now=new Date(),date=now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0');
    const orderNo='OTF-'+code+'-'+date+'-'+now.getTime().toString().slice(-6)+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
    return {
      order_number:orderNo,department:otfDepartment,quotation_id:q.id,vehicle_id:v.id||null,is_external_vehicle:!!v.external,
      customer_name:otfValue('otfCustomerName'),phone:otfDigits(otfValue('otfCustomerPhone')),
      address,city:otfValue('otfCity'),district:otfValue('otfDistrict'),
      customer_gstin:otfValue('otfCustomerGstin'),aadhaar_number:aadhaar||null,pan_number:pan||null,
      enquiry_number:otfValue('otfEnquiryNumber')||null,customer_id:otfValue('otfCustomerId')||null,invoice_number:otfValue('otfInvoiceNumber')||null,
      booking_amount:otfNumber('otfBookingAmount'),booking_date:otfValue('otfBookingDate')||date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8),
      hpa:otfValue('otfHpa'),dob:otfValue('otfDob')||null,marriage_anniversary:otfValue('otfAnniversary')||null,
      email:otfValue('otfEmail')||null,nominee:otfValue('otfNominee')||null,
      nominee_relationship:otfValue('otfNomineeRelation')||null,nominee_age:otfValue('otfNomineeAge')?Number(otfValue('otfNomineeAge')):null,
      chassis_number:v.chassis_number,engine_number:v.engine_number,model:v.model,variant:v.variant,colour:v.colour,
      sales_person:q.sales_person||currentProfile?.full_name||'',
      quotation_snapshot:{quote_number:q.quote_number,quote_date:q.quote_date,branch_address:q.branch_address||'',subtotal:Number(q.subtotal||0),discount:Number(q.discount||0),total:Number(q.total||0),amount_words:q.amount_words||'',items:(q.quotation_items||[]).sort((a,b)=>Number(a.line_no||0)-Number(b.line_no||0)).map(x=>({particulars:x.particulars,amount:Number(x.amount||0),is_discount:!!x.is_discount}))},
      vehicle_snapshot:{status:v.status,stage:v.stage,manufacturing_year:v.manufacturing_year,external:!!v.external},
      exchange_details:{model:otfValue('otfExchangeModel'),registration:otfValue('otfExchangeReg'),manufacturing_year:otfValue('otfExchangeYear'),old_value:otfNumber('otfExchangeValue'),extra_support:otfNumber('otfExchangeSupport'),total_value:otfNumber('otfExchangeTotal')},
      accessories_details:otfCollectRows('.otf-accessory-row',[['item','[data-acc="item"]'],['part_number','[data-acc="part"]'],['amount','[data-acc="amount"]']]),
      payment_details:otfCollectRows('.otf-payment-row',[['type','[data-pay="type"]'],['date','[data-pay="date"]'],['amount','[data-pay="amount"]'],['mode','[data-pay="mode"]']]),
      terms:['All payments in favour of SIDDHIVINAYAK MOTORS PVT. LTD.','Kindly insist for receipt of all payments made.','Subject to availability of stock & colour.','Price prevailing at the time of delivery shall be applicable.','Prices are subject to change without any notice.','Subject to Bhavnagar Jurisdiction.'],
      created_by:currentUser.id,updated_by:currentUser.id
    };
  }
  function otfPrintDocument(order,popup){
    const w=popup||window.open('','_blank','width=1000,height=760');
    if(!w){notify('Allow pop-ups to print the OTF Order Book.');return;}
    const q=order.quotation_snapshot||{},items=q.items||[],v=order.vehicle_snapshot||{},payments=order.payment_details||[],accessories=order.accessories_details||[],exchange=order.exchange_details||{};
    const escHtml=x=>esc(x==null?'':String(x));
    const rows=items.map(x=>'<tr><td>'+escHtml(x.particulars)+'</td><td class="num">'+(x.is_discount?'− ':'')+otfMoney(x.amount)+'</td></tr>').join('');
    const payRows=payments.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+escHtml(x.type)+'</td><td>'+escHtml(x.date)+'</td><td class="num">'+otfMoney(x.amount)+'</td><td>'+escHtml(x.mode)+'</td></tr>').join('')||'<tr><td colspan="5">—</td></tr>';
    const accRows=accessories.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+escHtml(x.item)+'</td><td>'+escHtml(x.part_number)+'</td><td class="num">'+otfMoney(x.amount)+'</td></tr>').join('')||'<tr><td colspan="4">—</td></tr>';
    w.document.open();w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+escHtml(order.order_number)+'</title><style>@page{size:A4 portrait;margin:5mm}*{box-sizing:border-box}html,body{width:auto;margin:0;padding:0}body{font:9.2px Arial,sans-serif;line-height:1.2;color:#18212b}h1{font-size:16px;margin:0;text-align:center}h2{font-size:10.2px;margin:6px 0 3px;border-bottom:1px solid #333;padding-bottom:2px;break-after:avoid;page-break-after:avoid}header{border-bottom:1.5px solid #222;padding-bottom:4px;margin-bottom:4px}header p{text-align:center;margin:2px 0;font-size:8.8px}.meta{display:flex;justify-content:space-between;margin:4px 0;font-weight:bold;font-size:9px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px}.field{border-bottom:1px solid #d5dbe2;padding:2px 0;min-height:14px;overflow-wrap:anywhere}.field b{display:inline-block;min-width:98px}.full{grid-column:1/-1}table{width:100%;border-collapse:collapse;margin-top:2px;break-inside:auto}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #89929b;padding:2.5px 4px;text-align:left;line-height:1.15;font-size:8.9px}th{background:#f0f2f4}.num{text-align:right;white-space:nowrap}.totals{margin:3px 0 0 auto;width:43%;font-weight:bold;font-size:9px}.totals div{display:flex;justify-content:space-between;padding:1.5px 0}.note{border:1px solid #777;padding:4px;margin-top:5px;font-weight:bold;font-size:9px;break-inside:avoid;page-break-inside:avoid}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:14px;break-inside:avoid;page-break-inside:avoid}.sign div{border-top:1px solid #222;padding-top:4px;text-align:center;font-size:9px}.small{font-size:7.8px;color:#444;line-height:1.15}.keep{break-inside:avoid;page-break-inside:avoid}@media screen{body{max-width:190mm;margin:0 auto}}@media print{html,body{width:auto!important;height:auto!important;margin:0!important;padding:0!important}button{display:none!important}h2,.note,.sign{break-inside:avoid;page-break-inside:avoid}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header><h1>SIDDHIVINAYAK MOTORS PVT. LTD.</h1><p>AUTHORISED DEALER : MAHINDRA &amp; MAHINDRA LIMITED</p><p>'+escHtml(q.branch_address)+'</p><div class="meta"><span>OTF ORDER BOOK: '+escHtml(order.order_number)+'</span><span>Date: '+escHtml(order.booking_date)+'</span></div></header><div class="grid"><div class="field"><b>Quotation No.:</b> '+escHtml(q.quote_number)+'</div><div class="field"><b>Enquiry No.:</b> '+escHtml(order.enquiry_number)+'</div><div class="field"><b>Customer ID:</b> '+escHtml(order.customer_id)+'</div><div class="field"><b>Invoice No.:</b> '+escHtml(order.invoice_number)+'</div><div class="field"><b>Quote Date:</b> '+escHtml(q.quote_date)+'</div><div class="field"><b>GSTIN:</b> '+escHtml(order.customer_gstin)+'</div><div class="field"><b>Name:</b> '+escHtml(order.customer_name)+'</div><div class="field"><b>Mobile:</b> '+escHtml(order.phone)+'</div><div class="field full"><b>Address:</b> '+escHtml(order.address)+'</div><div class="field"><b>City / District:</b> '+escHtml([order.city,order.district].filter(Boolean).join(' / '))+'</div><div class="field"><b>Email:</b> '+escHtml(order.email)+'</div><div class="field"><b>Aadhaar:</b> '+escHtml(order.aadhaar_number)+'</div><div class="field"><b>PAN:</b> '+escHtml(order.pan_number)+'</div><div class="field"><b>HPA:</b> '+escHtml(order.hpa)+'</div><div class="field"><b>Booking Amount:</b> '+otfMoney(order.booking_amount)+'</div><div class="field"><b>DOB:</b> '+escHtml(order.dob)+'</div><div class="field"><b>Marriage Anniversary:</b> '+escHtml(order.marriage_anniversary)+'</div><div class="field"><b>Nominee:</b> '+escHtml([order.nominee,order.nominee_relationship,order.nominee_age].filter(Boolean).join(' / '))+'</div><div class="field"><b>Sales Executive:</b> '+escHtml(order.sales_person)+'</div></div><h2>VEHICLE DETAILS — VERIFIED FROM STOCK REGISTER</h2><div class="grid"><div class="field"><b>Model:</b> '+escHtml(order.model)+'</div><div class="field"><b>Variant:</b> '+escHtml(order.variant)+'</div><div class="field"><b>Colour:</b> '+escHtml(order.colour)+'</div><div class="field"><b>Chassis No.:</b> '+escHtml(order.chassis_number)+'</div><div class="field"><b>Engine No.:</b> '+escHtml(order.engine_number)+'</div><div class="field"><b>Stock Stage:</b> '+escHtml(v.stage)+'</div></div><h2>QUOTATION PRICE BREAKUP</h2><table><thead><tr><th>Particular</th><th class="num">Amount</th></tr></thead><tbody>'+rows+'</tbody></table><div class="totals"><div><span>Subtotal</span><span>'+otfMoney(q.subtotal)+'</span></div><div><span>Total Discount</span><span>− '+otfMoney(q.discount)+'</span></div><div><span>GRAND TOTAL</span><span>'+otfMoney(q.total)+'</span></div></div><h2>EXCHANGE DETAILS</h2><div class="grid"><div class="field"><b>Old Car:</b> '+escHtml(exchange.model)+'</div><div class="field"><b>Registration:</b> '+escHtml(exchange.registration)+'</div><div class="field"><b>M.F. Year:</b> '+escHtml(exchange.manufacturing_year)+'</div><div class="field"><b>Old Value:</b> '+otfMoney(exchange.old_value)+'</div><div class="field"><b>Extra Support:</b> '+otfMoney(exchange.extra_support)+'</div><div class="field"><b>Total Exchange:</b> '+otfMoney(exchange.total_value)+'</div></div><h2>ACCESSORIES DETAILS</h2><table><thead><tr><th>SL</th><th>Item</th><th>Part No.</th><th class="num">Amount</th></tr></thead><tbody>'+accRows+'</tbody></table><h2>PAYMENT DETAILS</h2><table><thead><tr><th>SL</th><th>Payment</th><th>Date</th><th class="num">Amount</th><th>Mode / Reference</th></tr></thead><tbody>'+payRows+'</tbody></table><div class="note">ખાસ નોંધ: બુકિંગ કરાવ્યા બાદ વાહનના ભાવમાં જે વધઘટ થશે તે ગ્રાહકના શિરે રહેશે. વાહન ડિલિવરી સમયે જે ભાવ હશે તે જ લાગુ પડશે.</div><div class="small" style="margin-top:7px">'+(order.terms||[]).map(escHtml).join(' · ')+'<br>This order book is generated from the selected quotation and the independently verified stock chassis record.</div><div class="sign"><div>Customer Signature</div><div>SC Sign.</div><div>SM Sign.</div></div><script>window.onload=()=>{document.body.style.zoom="1";document.body.style.transform="none";document.body.style.width="auto";setTimeout(()=>window.print(),300);};</script></body></html>');
    w.document.close();
  }
  let otfManagementRows=[],otfEditingId=null,otfManagementDepartment='Personal';
  function canManageOtf(){return ['Super Admin','Admin','General Manager','Manager','Accountant','Accounts','HR','DMS'].includes(String(currentProfile?.designation||''))||currentProfile?.is_super_admin===true;}
  async function loadOtfManagement(department=otfManagementDepartment){
    if(!has('otf_management','view'))throw new Error('OTF Management view permission required.');
    otfManagementDepartment=department;
    otfManagementRows=await call(db().from('otf_order_books').select('*').eq('department',department).order('created_at',{ascending:false}).limit(2000));
    renderOtfManagement();
  }
  window.otfOpenManagement=async function(department){
    if(!['Personal','EV','Commercial','LLM'].includes(department))return;
    if(!has('otf_management','view')){notify('OTF Management permission required.');return;}
    if(!allowedDepartmentList().includes(department)&&!canManageOtf()){notify('You do not have access to '+department+'.');return;}
    otfManagementDepartment=department;
    if($('otfManagementDepartment'))$('otfManagementDepartment').value=department;
    if($('otfManagementTitle'))$('otfManagementTitle').textContent=department+' — OTF Management';
    await loadOtfManagement(department);
  };
  function renderOtfManagement(){
    const body=$('otfManagementRows');if(!body)return;
    const term=String($('otfManagementSearch')?.value||'').trim().toLowerCase(),dept=otfManagementDepartment,status=$('otfManagementStatus')?.value||'';
    const rows=otfManagementRows.filter(r=>(!dept||r.department===dept)&&(!status||r.status===status)&&(!term||[r.order_number,r.customer_name,r.phone,r.chassis_number,r.model,r.variant].some(v=>String(v||'').toLowerCase().includes(term))));
    if($('otfManagementCount'))$('otfManagementCount').textContent=rows.length+' Records';
    body.innerHTML=rows.length?rows.map(r=>'<tr><td><b>'+esc(r.order_number)+'</b></td><td>'+new Date(r.created_at).toLocaleDateString('en-IN')+'</td><td>'+esc(r.customer_name)+'</td><td>'+esc(r.phone)+'</td><td>'+esc([r.model,r.variant].filter(Boolean).join(' / '))+'</td><td>'+esc(r.chassis_number)+'</td><td>'+otfMoney(r.booking_amount)+'</td><td>'+esc(r.department)+'</td><td><select class="field" data-otf-status="'+esc(r.id)+'" style="min-width:125px;min-height:32px;padding:5px"><option '+(r.status==='BOOKED'?'selected':'')+'>BOOKED</option><option '+(r.status==='IN PROCESS'?'selected':'')+'>IN PROCESS</option><option '+(r.status==='DELIVERED'?'selected':'')+'>DELIVERED</option><option '+(r.status==='CANCELLED'?'selected':'')+'>CANCELLED</option></select></td><td><div style="display:flex;gap:5px"><button class="btn small" data-otf-mprint="'+esc(r.id)+'">Print</button><button class="btn small primary" data-otf-edit="'+esc(r.id)+'">Edit</button></div></td></tr>').join(''):'<tr><td colspan="10" class="empty">No OTF records found for the selected filters.</td></tr>';
    if(!canManageOtf()||!has('otf_management','edit')){body.querySelectorAll('[data-otf-status]').forEach(sel=>sel.disabled=true);body.querySelectorAll('[data-otf-edit]').forEach(btn=>btn.hidden=true);}
    body.querySelectorAll('[data-otf-mprint]').forEach(btn=>btn.addEventListener('click',()=>{const r=otfManagementRows.find(x=>x.id===btn.dataset.otfMprint);if(r)otfPrintDocument(r);}));
    body.querySelectorAll('[data-otf-status]').forEach(sel=>sel.addEventListener('change',async()=>{try{if(!canManageOtf()||!has('otf_management','edit'))throw new Error('OTF edit permission is required to change status.');await call(db().from('otf_order_books').update({status:sel.value,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',sel.dataset.otfStatus));await audit('otf_management','edit','Updated OTF status','otf_order_book',sel.dataset.otfStatus,{status:sel.value});notify('OTF status updated.');await loadOtfManagement();}catch(e){notify(e.message);await loadOtfManagement().catch(()=>{});}}));
    body.querySelectorAll('[data-otf-edit]').forEach(btn=>btn.addEventListener('click',()=>openOtfForEdit(btn.dataset.otfEdit)));
  }
  function openOtfForEdit(id){
    if(!canManageOtf()||!has('otf_management','edit'))return notify('OTF edit permission is required.');
    const r=otfManagementRows.find(x=>x.id===id);if(!r)return;
    window.otfOpenDepartment(r.department).then(()=>{
      otfEditingId=r.id;otfSelectedQuote={id:r.quotation_id,quote_number:r.quotation_snapshot?.quote_number||'',quote_date:r.quotation_snapshot?.quote_date||'',customer_name:r.customer_name,phone:r.phone,customer_gstin:r.customer_gstin,email:r.email,address:r.address,hypo:r.hpa,model:r.model,variant:r.variant,total:r.quotation_snapshot?.total||0,subtotal:r.quotation_snapshot?.subtotal||0,discount:r.quotation_snapshot?.discount||0,amount_words:r.quotation_snapshot?.amount_words||'',quotation_items:r.quotation_snapshot?.items||[],sales_person:r.sales_person};
      otfVerifiedVehicle={id:r.vehicle_id||null,chassis_number:r.chassis_number,engine_number:r.engine_number,model:r.model,variant:r.variant,colour:r.colour,status:r.vehicle_snapshot?.status,stage:r.vehicle_snapshot?.stage,manufacturing_year:r.vehicle_snapshot?.manufacturing_year,external:!!r.is_external_vehicle};
      const set=(id,v)=>{if($(id))$(id).value=v??'';};
      set('otfCustomerName',r.customer_name);set('otfCustomerPhone',r.phone);set('otfCustomerGstin',r.customer_gstin);set('otfEmail',r.email);set('otfAddress',r.address);set('otfCity',r.city);set('otfDistrict',r.district);set('otfHpa',r.hpa);set('otfBookingAmount',r.booking_amount);set('otfBookingDate',r.booking_date);set('otfEnquiryNumber',r.enquiry_number);set('otfCustomerId',r.customer_id);set('otfInvoiceNumber',r.invoice_number);set('otfAadhaar',r.aadhaar_number);set('otfPan',r.pan_number);set('otfDob',r.dob);set('otfAnniversary',r.marriage_anniversary);set('otfNominee',r.nominee);set('otfNomineeRelation',r.nominee_relationship);set('otfNomineeAge',r.nominee_age);set('otfChassisInput',r.chassis_number);
      if($('otfVehicleVerified')){$('otfVehicleVerified').hidden=false;$('otfVehicleVerified').textContent=(r.is_external_vehicle?'EXTERNAL VEHICLE · Not in Stock Register · ':'VERIFIED · ')+r.chassis_number+' · '+r.model+' / '+(r.variant||'');}
      if($('otfSelectedQuote')){$('otfSelectedQuote').hidden=false;$('otfSelectedQuote').textContent='Editing OTF '+r.order_number+' · '+r.customer_name;}
      const ex=r.exchange_details||{};set('otfExchangeModel',ex.model);set('otfExchangeReg',ex.registration);set('otfExchangeYear',ex.manufacturing_year);set('otfExchangeValue',ex.old_value);set('otfExchangeSupport',ex.extra_support);set('otfExchangeTotal',ex.total_value);
      $('otfPayments').innerHTML='';(r.payment_details||[]).forEach(p=>{addOtfPayment();const row=$('otfPayments').lastElementChild;if(row)for(const [k,v] of Object.entries({type:p.type,date:p.date,amount:p.amount,mode:p.mode}))row.querySelector('[data-pay="'+k+'"]').value=v??'';});
      $('otfAccessories').innerHTML='';(r.accessories_details||[]).forEach(p=>{addOtfAccessory();const row=$('otfAccessories').lastElementChild;if(row)for(const [k,v] of Object.entries({item:p.item,part:p.part_number,amount:p.amount}))row.querySelector('[data-acc="'+k+'"]').value=v??'';});
      if($('otfSaveOrder'))$('otfSaveOrder').textContent='Update OTF Order Book';
      if($('otfSavePrintOrder'))$('otfSavePrintOrder').textContent='Update & Print A4';
      if($('otfFormStatus'))$('otfFormStatus').textContent='Editing '+r.order_number;
      window.showPage?.('otf-order-book');
    }).catch(e=>notify(e.message));
  }
  async function saveOtfOrder(printAfter=false){
    let popup=null;
    if(printAfter)popup=window.open('','_blank','width=1000,height=760');
    try{
      const wasEditing=!!otfEditingId;
      if(!wasEditing&&!has('otf_management','create'))throw new Error('OTF create permission required.');
      const payload=buildOtfPayload();
      let saved;
      if(wasEditing){
        if(!canManageOtf()||!has('otf_management','edit'))throw new Error('OTF edit permission is required.');
        const existing=otfManagementRows.find(x=>x.id===otfEditingId);if(existing)payload.order_number=existing.order_number;
        saved=await call(db().from('otf_order_books').update({...payload,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',otfEditingId).select('*').single());
        await audit('otf_management','edit','Updated OTF Order Book','otf_order_book',saved.id,{order_number:saved.order_number,department:saved.department});
        otfEditingId=null;
        if($('otfSaveOrder'))$('otfSaveOrder').textContent='Save OTF Order Book';
        if($('otfSavePrintOrder'))$('otfSavePrintOrder').textContent='Save & Print A4';
      }else{
        saved=await call(db().from('otf_order_books').insert(payload).select('*').single());
        await audit('otf_management','create','Created OTF Order Book','otf_order_book',saved.id,{order_number:saved.order_number,department:saved.department,quotation_id:saved.quotation_id,vehicle_id:saved.vehicle_id});
      }
      await loadOtfManagement(otfDepartment).catch(()=>{});
      otfSetStatus((wasEditing?'Updated successfully: ':'Saved successfully: ')+saved.order_number);
      if($('otfPrintPreview'))$('otfPrintPreview').disabled=false;
      if(printAfter)otfPrintDocument(saved,popup);
      else notify('OTF Order Book saved: '+saved.order_number);
      return saved;
    }catch(e){if(popup)popup.close();console.error(e);const message=e.code==='23505'?'This chassis already has an active OTF booking, or the order number already exists. Check OTF Management.':(e.message||'Could not save OTF Order Book.');otfSetStatus(message,true);notify(message);return null;}
  }
  function bindOtfUi(){
    if($('otfSearchQuotes')&&!$('otfSearchQuotes').dataset.bound){
      $('otfSearchQuotes').dataset.bound='1';
      $('otfSearchQuotes').addEventListener('click',()=>searchOtfQuotes().catch(e=>{notify(e.message);}));
      $('otfPhoneSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchOtfQuotes().catch(x=>notify(x.message));}});
      $('otfChassisInput')?.addEventListener('input',()=>{otfVerifiedVehicle=null;if($('otfVehicleVerified')){$('otfVehicleVerified').hidden=true;$('otfVehicleVerified').textContent='';}if($('otfPrintPreview'))$('otfPrintPreview').disabled=true;});
      $('otfImportStock')?.addEventListener('click',()=>openOtfStockPicker().catch(e=>notify('Could not load Stock Register: '+e.message)));
      $('otfVerifyChassis')?.addEventListener('click',()=>verifyOtfChassis().catch(e=>{otfVerifiedVehicle=null;if($('otfVehicleVerified')){$('otfVehicleVerified').hidden=false;$('otfVehicleVerified').textContent=e.message;}if($('otfPrintPreview'))$('otfPrintPreview').disabled=true;if(/already has an active OTF booking/i.test(e.message))otfSetStatus(e.message,true);notify(e.message);}));
      $('otfSaveOrder')?.addEventListener('click',()=>saveOtfOrder(false));
      $('otfSavePrintOrder')?.addEventListener('click',()=>saveOtfOrder(true));
      $('otfPrintPreview')?.addEventListener('click',()=>{if(otfSelectedQuote&&otfVerifiedVehicle){const draft=buildOtfPayload();otfPrintDocument({...draft,order_number:'PREVIEW',created_at:new Date().toISOString()});}});
      $('otfAddPayment')?.addEventListener('click',addOtfPayment);
      $('otfAddAccessory')?.addEventListener('click',addOtfAccessory);
      $('otfManagementRefresh')?.addEventListener('click',()=>loadOtfManagement(otfManagementDepartment).catch(e=>notify(e.message)));
      ['otfManagementSearch','otfManagementStatus'].forEach(id=>$(id)?.addEventListener(id==='otfManagementSearch'?'input':'change',renderOtfManagement));
    }
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
    if(currentUser){await startApp();startQuotationRealtime();await applyQuoteCompanyDetails();syncOperationalResetVisibility();await recordSessionLogin();} else {syncOperationalResetVisibility();showLogin();}
    db().auth.onAuthStateChange(async(_event,session)=>{
      if(!session){stopQuotationRealtime();currentUser=null;currentProfile=null;permissions.clear();sessionLoginRecordedFor=null;syncOperationalResetVisibility();showLogin();return;}
      try{await refreshIdentity();await startApp();startQuotationRealtime();await applyQuoteCompanyDetails();await recordSessionLogin();}catch(e){console.error(e);showLogin();}
    });
    const logout=$('logoutBtn');if(logout){logout.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();signOut().catch(err=>notify(err.message));},true);}
    // holdRender already queries and renders Supabase directly; do not wrap it via loadHolds (would recurse).
    window.holdDecision=(id,decision)=>decideHold(id,decision).catch(e=>notify(e.message));
    window.SVMBackend={client:()=>db(),get user(){return currentUser;},get profile(){return currentProfile;},has,signOut,changeOwnPassword,loadVehicles,saveVehicle,updateVehicle,markVehicleRetail,deleteVehicle,saveQuotation,loadQuotations,publishPriceList,loadPriceLists,loadEmployees,refreshEmployees:renderEmployees,loadAudit,loadImportHistory,loadQuoteCompanySettings,applyQuoteCompanyDetails,audit};
    window.SVMBackend.loadOtfManagement=loadOtfManagement;
    window.dispatchEvent(new Event('svm:ready'));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{console.error(e);notify('Backend init failed: '+e.message);showLogin();}),{once:true});
  else init().catch(e=>{console.error(e);notify('Backend init failed: '+e.message);showLogin();});

})();