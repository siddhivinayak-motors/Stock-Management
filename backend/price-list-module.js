/* Simplified Price List UI and multi-sheet Excel parser. */
(function(){
 'use strict';
 var pending=null,booted=false,$=function(id){return document.getElementById(id)};
 var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
 var money=function(v){var n=Number(v);return isFinite(n)?'₹'+Math.round(n).toLocaleString('en-IN'):'—'};
 var clean=function(v){return String(v==null?'':v).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()};
 var norm=function(v){return clean(v).toLowerCase().replace(/[^a-z0-9]/g,'')};
 var num=function(v){if(typeof v==='number'&&isFinite(v))return v;var t=clean(v).replace(/[₹,\s]/g,'');if(!t||!/^[-+]?\d*\.?\d+$/.test(t))return null;var n=Number(t);return isFinite(n)?n:null};
 function modelKey(value){
  var s=clean(value).toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  if(s.indexOf('XUV3XO EV')>=0||s.indexOf('XUV 3XO EV')>=0)return 'XUV 3XO EV';
  if(s.indexOf('X3XO')>=0||s.indexOf('XUV 3XO')>=0)return 'XUV 3XO';
  if(s.indexOf('XUV 7XO')>=0||s.indexOf('7XO')===0)return 'XUV 7XO';
  if(s.indexOf('SCORPIO N')>=0||s.indexOf('SCORPIO-N')>=0)return 'SCORPIO-N';
  if(s.indexOf('THAR ROXX')>=0)return 'THAR ROXX';
  if(s.indexOf('THAR OG')>=0||s==='NEW THAR')return 'NEW THAR';
  if(s.indexOf('BOLERO NEO PLUS')>=0||s.indexOf('NEO PLUS')>=0)return 'BOLERO NEO PLUS';
  if(s.indexOf('BOLERO NEO')>=0||s.indexOf('NEO ')===0)return 'BOLERO NEO';
  if(s.indexOf('SCORPIO CLASSIC')>=0||s.indexOf('SCORPIO CLIASSIC')>=0)return 'SCORPIO CLASSIC';
  if(s.indexOf('BOLERO')>=0)return 'BOLERO';
  if(s.indexOf('BE 6')>=0||s==='BE6')return 'BE 6';
  if(s.indexOf('XEV 9E')>=0||s==='XEV9E')return 'XEV 9E';
  if(s.indexOf('XEV 9S')>=0||s==='XEV9S')return 'XEV 9S';
  return s;
 }
 function variantKey(value){
  return clean(value).toUpperCase().replace(/\+/g,' PLUS ').replace(/\bBS[\s_.-]*6(?:\.?2)?\b/g,' ').replace(/\bREFRESH\b|\bNEW\b/g,' ').replace(/\bSPT\b/g,'SPORTEQ').replace(/\bLNCH\b/g,'LAUNCH').replace(/[^A-Z0-9]+/g,'');
 }
 function variantMatch(stockValue,priceValue){
  var rawA=clean(stockValue).toUpperCase(),rawB=clean(priceValue).toUpperCase();
  var critical=[/(?:^|[^A-Z0-9])(MT|AT)(?:$|[^A-Z0-9])/i,/(?:^|[^A-Z0-9])(2WD|4WD)(?:$|[^A-Z0-9])/i,/(?:^|[^A-Z0-9])([4679]\s*STR)(?:$|[^A-Z0-9])/i,/(?:^|[^A-Z0-9])(CNG|DSL|DIESEL|PETROL|GASOLINE|G|D|P)(?:$|[^A-Z0-9])/i];
  for(var i=0;i<critical.length;i++){var ma=rawA.match(critical[i]),mb=rawB.match(critical[i]);if(ma&&mb&&ma[1].replace(/\s/g,'')!==mb[1].replace(/\s/g,''))return false}
  var a=variantKey(rawA),b=variantKey(rawB);if(!a||!b)return true;if(a===b||a.indexOf(b)>=0||b.indexOf(a)>=0)return true;
  var aa=a.match(/[A-Z]+|[0-9]+/g)||[],bb=b.match(/[A-Z]+|[0-9]+/g)||[],common=aa.filter(function(x){return bb.indexOf(x)>=0});
  return common.length>=Math.min(2,Math.ceil(Math.min(aa.length,bb.length)*0.65));
 }
 function modelFromSheet(title,variant){
  var t=clean(title).toUpperCase(),v=clean(variant).toUpperCase();
  if(t.indexOf('BOLERO,')>=0||t.indexOf('BOLERO NEO')>=0&&t.indexOf('SCORPIO')>=0){
   if(v.indexOf('SCORPIO')>=0)return 'SCORPIO CLASSIC';
   if(v.indexOf('NEO+')===0||v.indexOf('NEO PLUS')===0)return 'BOLERO NEO PLUS';
   if(v.indexOf('NEO')===0)return 'BOLERO NEO';
   return 'BOLERO';
  }
  return modelKey(title);
 }
 function departmentFor(fileName,model,stockRows){
  var key=modelKey(model),found=(stockRows||[]).filter(function(r){return modelKey(r.model)===key&&r.department}),depts=Array.from(new Set(found.map(function(r){return r.department})));
  if(depts.length===1)return depts[0];
  var m=key.toUpperCase(),f=String(fileName||'').toUpperCase();
  if(/^(BE 6|XEV 9E|XEV 9S|XUV 3XO EV)$/.test(m)||/MEAL|ELECTRIC|EV PRICE/.test(f))return 'EV';
  if(/ALFA|TREO|ZOR|E-ALFA/.test(m))return 'LLM';
  if(/CAMPER|MAXX|SUPRO|VEERO|PICKUP/.test(m))return 'Commercial';
  return 'Personal';
 }
 function modelTitle(rows){
  var row=rows[4]||[];
  for(var i=0;i<row.length;i++){var t=clean(row[i]);if(/model\s*:/i.test(t)){var v=t.replace(/^.*?model\s*:/i,'').trim();if(v)return v;for(var j=i+1;j<row.length;j++)if(clean(row[j]))return clean(row[j])}}
  return '';
 }
 function effectiveDate(rows){
  for(var i=0;i<Math.min(7,rows.length);i++)for(var j=0;j<(rows[i]||[]).length;j++){
   var t=clean(rows[i][j]);if(/effective\s*from|w\.?e\.?f\.?/i.test(t)){var rest=t.replace(/.*?(effective\s*from|w\.?e\.?f\.?)\s*:?/i,'').trim();if(rest)return rest;for(var k=j+1;k<(rows[i]||[]).length;k++)if(clean(rows[i][k]))return clean(rows[i][k])}
  }return '';
 }
 function parseSheet(rows,fileName,sheetName,stockRows){
  var hi=-1,col=-1;
  for(var i=0;i<rows.length;i++){var row=rows[i]||[];for(var j=0;j<row.length;j++)if(clean(row[j]).toLowerCase()==='particulars'){hi=i;col=j;break}if(hi>=0)break}
  if(hi<0)return {items:[],warning:'No Particulars header'};
  var header=rows[hi]||[],variantRow=header.slice(),valid=variantRow.slice(col+1).filter(function(v){return !!clean(v)}).length,alt=rows[hi+1]||[],altCount=alt.slice(col+1,col+1+variantRow.length).filter(function(v){return !!clean(v)&&num(v)===null}).length;
  if(altCount>=Math.max(2,Math.ceil(valid*0.55)))variantRow=alt;
  var title=modelTitle(rows),eff=effectiveDate(rows),customer='';
  for(var r=0;r<Math.min(8,rows.length);r++)for(var c=0;c<(rows[r]||[]).length;c++)if(/customer\s*type/i.test(clean(rows[r][c])))customer=clean(rows[r][c+1]||'').replace(/^:/,'').trim();
  var byCol={};
  for(var rr=hi+1;rr<rows.length;rr++){
   var dr=rows[rr]||[],label=clean(dr[col]);if(!label)continue;var vals=[];
   for(var cc=col+1;cc<variantRow.length;cc++)vals.push(num(dr[cc]));
   if(vals.some(function(x){return x!==null}))vals.forEach(function(value,index){if(value===null)return;var abs=col+1+index;if(!byCol[abs])byCol[abs]=[];byCol[abs].push({label:label,value:value})});
  }
  var skippedColumns=0;
  for(var sc=col+1;sc<variantRow.length;sc++){if(!clean(variantRow[sc])&&rows.slice(hi+1).some(function(r){return num((r||[])[sc])!==null}))skippedColumns++;}
  var items=[];
  for(var vc=col+1;vc<variantRow.length;vc++){
   var variant=clean(variantRow[vc]);if(!variant)continue;var components=byCol[vc]||[];if(!components.length)continue;
   var ex=0,rto=0,tcs=0,insurance=0,total=0;
   components.forEach(function(p){var l=p.label.toLowerCase();if(/ex[\s-]*showroom/.test(l))ex=p.value;else if(!ex&&/vehicle\s*price/.test(l))ex=p.value;if(/\btcs\b/.test(l))tcs=p.value;if(/insurance/.test(l)&&!/zero dep/.test(l))insurance=p.value;if(/road tax|registration/.test(l))rto=p.value;if(/total\s*on[\s-]*road/.test(l))total=p.value});
   var vehicle=modelFromSheet(title,variant),department=departmentFor(fileName,vehicle,stockRows);
   items.push({department:department,vehicle:vehicle,variant:variant,colour:'',exShowroom:ex,rto:rto,other:0,onRoadTotal:total,tcs:tcs,insurance:insurance,components:components,sourceFile:fileName,sourceSheet:sheetName,effectiveDate:eff,customerType:customer,variantCode:(variant.match(/\b(NCH|C11|C7)\s*$/i)||[])[1]||''});
  }
  return {items:items,warning:items.length?'':'No price columns found',skippedColumns:skippedColumns};
 }
 async function parseFiles(files){
  if(!window.XLSX)throw new Error('Excel reader could not load. Reload the page with internet access and try again.');
  var stock=window.svPriceListStockRows||[],all=[],warnings=[],sheets=0,fileObjects=[];
  for(var i=0;i<files.length;i++){var file=files[i],fileDepartments=new Set(),buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array',cellDates:true});for(var s=0;s<wb.SheetNames.length;s++){var name=wb.SheetNames[s],matrix=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:true}),parsed=parseSheet(matrix,file.name,name,stock);sheets++;if(parsed.items.length){all=all.concat(parsed.items);parsed.items.forEach(function(x){fileDepartments.add(x.department)})}else warnings.push(file.name+' / '+name+': '+parsed.warning);if(parsed.skippedColumns)warnings.push(file.name+' / '+name+': '+parsed.skippedColumns+' numeric column(s) without a variant name were skipped')}file.priceListDepartments=Array.from(fileDepartments);fileObjects.push(file)}
  var seen=new Set(),duplicates=[];all.forEach(function(x){var k=norm(x.department+'|'+x.vehicle)+'|'+norm(clean(x.variant).toUpperCase().replace(/\+/g,' PLUS '));if(seen.has(k))duplicates.push(x.vehicle+' / '+x.variant);seen.add(k)});
  return {rows:all,files:files.map(function(f){return f.name}),fileObjects:fileObjects,sheets:sheets,warnings:warnings,duplicates:duplicates};
 }
 function getRows(){var by=window.plData||{},out=[];Object.keys(by).forEach(function(k){(by[k]||[]).forEach(function(x){out.push(x)})});return out}
 function getStock(){return window.svPriceListStockRows||[]}
 function unique(a){return Array.from(new Set(a.filter(Boolean))).sort(function(x,y){return String(x).localeCompare(String(y))})}
 function fillSelect(el,values,placeholder){if(!el)return;var cur=el.value,html='<option value="">'+esc(placeholder)+'</option>';values.forEach(function(v){html+='<option value="'+esc(v)+'">'+esc(v)+'</option>'});el.innerHTML=html;if(values.indexOf(cur)>=0)el.value=cur}
 function populateFilters(){
  var stock=getStock(),model=$('plStockVehicle')?.value||'',variant=$('plStockVariant')?.value||'',models=unique(stock.map(function(r){return clean(r.model)}));
  fillSelect($('plStockVehicle'),models,'All vehicles');if(model&&models.indexOf(model)>=0)$('plStockVehicle').value=model;
  var mr=stock.filter(function(r){return !model||clean(r.model)===model}),variants=unique(mr.map(function(r){return clean(r.variant)}));
  fillSelect($('plStockVariant'),variants,'All variants');$('plStockVariant').disabled=!model;if(variant&&variants.indexOf(variant)>=0)$('plStockVariant').value=variant;
  var chosen=$('plStockVariant')?.value||'',cr=mr.filter(function(r){return !chosen||clean(r.variant)===chosen});
  fillSelect($('plStockColour'),unique(cr.map(function(r){return clean(r.colour)})),'All colours');$('plStockColour').disabled=!model;
 }
 function stockFilterChanged(which){if(which==='vehicle')$('plStockVariant').value='';if(which==='vehicle'||which==='variant')$('plStockColour').value='';populateFilters();render()}
 function resetFilters(){['plStockVehicle','plStockVariant','plStockColour','plSearch'].forEach(function(id){if($(id))$(id).value=''});populateFilters();render()}
 function breakup(item){
  var parts=(item.other_data||item).components||[];if(!parts.length)return '<span class="muted">—</span>';
  return '<details class="pl-breakup"><summary>View breakup</summary><div class="pl-breakup-content">'+parts.map(function(p){return '<div class="pl-breakup-row"><span>'+esc(p.label)+'</span><b>'+money(p.value)+'</b></div>'}).join('')+'</div></details>';
 }
 function render(){
  populateFilters();var rows=getRows(),stock=getStock(),model=$('plStockVehicle')?.value||'',variant=$('plStockVariant')?.value||'',colour=$('plStockColour')?.value||'',q=clean($('plSearch')?.value).toLowerCase(),out=rows;
  if(model)out=out.filter(function(x){return modelKey(x.vehicle)===modelKey(model)});if(variant)out=out.filter(function(x){return variantMatch(variant,x.variant)});if(colour){var stockVariants=unique(stock.filter(function(r){return modelKey(r.model)===modelKey(model)&&norm(r.colour)===norm(colour)&&(!variant||variantMatch(variant,r.variant))}).map(function(r){return r.variant}));if(stockVariants.length)out=out.filter(function(x){return stockVariants.some(function(v){return variantMatch(v,x.variant)})});else out=out.filter(function(x){return x.colour&&norm(x.colour)===norm(colour)})}if(q)out=out.filter(function(x){var text=[x.vehicle,x.variant,x.colour,x.source_file,x.sourceFile,x.sourceSheet].join(' ').toLowerCase();var colourHit=stock.some(function(r){return modelKey(r.model)===modelKey(x.vehicle)&&variantMatch(r.variant,x.variant)&&clean(r.colour).toLowerCase().indexOf(q)>=0});return text.indexOf(q)>=0||colourHit});
  out.sort(function(a,b){return String(a.vehicle).localeCompare(String(b.vehicle))||String(a.variant).localeCompare(String(b.variant))});
  var body=$('plRows');if(body)body.innerHTML=out.length?out.map(function(x){var d=x.other_data||x,ex=Number(x.exShowroom!=null?x.exShowroom:x.ex_showroom||d.exShowroom||0),rto=Number(x.rto||d.rto||0),total=Number(d.onRoadTotal||d.totalOnRoad||0);var colours=unique(stock.filter(function(r){return modelKey(r.model)===modelKey(x.vehicle)&&variantMatch(r.variant,x.variant)}).map(function(r){return r.colour}));return '<tr><td>'+esc(x.vehicle)+'</td><td>'+esc(x.variant)+'</td><td>'+esc(x.colour||colours.join(', ')||'—')+'</td><td>'+money(ex)+'</td><td>'+money(d.tcs||0)+'</td><td>'+money(d.insurance||0)+'</td><td>'+money(rto)+'</td><td><b>'+money(total)+'</b></td><td>'+breakup(x)+'</td></tr>'}).join(''):'<tr><td colspan="9" class="empty">'+(rows.length?'No uploaded price list matches these filters. Try another model or use direct search.':'No price lists have been uploaded yet. Use Upload Price Lists to add the Excel files.')+'</td></tr>';
  if($('plResultsSummary'))$('plResultsSummary').textContent=out.length+' variant price(s)'+(rows.length?' · '+rows.length+' total uploaded':'');
  if($('plStockSummary'))$('plStockSummary').textContent=stock.length?unique(stock.map(function(x){return x.model})).length+' stock models available':'Stock filters unavailable — use direct search';
  try{plData=window.plData||{}}catch(e){}
 }
 function status(msg,error){var el=$('plInlineStatus');if(el){el.textContent=msg||'';el.className='pl-inline-status'+(error?' error':'')}}
 async function refresh(){
  status('Refreshing price lists and stock filters…');var api=window.SVMBackend;if(!api){status('Secure backend is still starting. Try Refresh again in a moment.',true);return}
  var jobs=[api.loadPriceLists()];if(api.loadPriceListStock)jobs.push(api.loadPriceListStock().catch(function(e){status('Stock filters could not load: '+e.message,true);return []}));
  await Promise.all(jobs);render();status('Price list is up to date.');
 }
 function showPreview(rows){var body=$('plPreviewRows');body.innerHTML=rows.slice(0,60).map(function(x){return '<tr><td>'+esc(x.sourceFile+' / '+x.sourceSheet)+'</td><td>'+esc(x.vehicle)+'</td><td>'+esc(x.variant)+'</td><td>'+esc(x.department)+'</td><td>'+money(x.exShowroom)+'</td><td>'+money(x.onRoadTotal)+'</td></tr>'}).join('')+(rows.length>60?'<tr><td colspan="6" class="muted">Showing first 60 of '+rows.length+' variants. All detected variants will be saved.</td></tr>':'')}
 async function preview(){
  var files=Array.from($('plFiles')?.files||[]);if(!files.length){status('Select one or more Excel price list files.',true);return}
  if(files.some(function(f){return !/\.(xlsx|xls)$/i.test(f.name)})){status('Only Excel .xlsx or .xls workbooks are supported.',true);return}
  var btn=$('plUploadButton');if(btn){btn.disabled=true;btn.textContent='Reading Excel…'}
  try{pending=await parseFiles(files);if(!pending.rows.length)throw new Error('No price rows were detected. Check the workbook layout.');var groups={};pending.rows.forEach(function(x){(groups[x.department]||(groups[x.department]=[])).push(x)});$('plUploadPreview').style.display='';$('plPreviewSummary').textContent=pending.rows.length+' variants detected across '+pending.files.length+' file(s) and '+pending.sheets+' worksheet(s). Automatic department mapping: '+Object.keys(groups).map(function(k){return k+' ('+groups[k].length+')'}).join(' · ')+'.';$('plPreviewWarnings').textContent=(pending.warnings.length?pending.warnings.length+' sheet(s) had no price rows. ':'')+(pending.duplicates.length?pending.duplicates.length+' duplicate model/variant pair(s) detected. ':'')+'Preview only — database has not been changed.';showPreview(pending.rows);status('Upload preview ready. Review the detected models and variants below.')}
  catch(e){pending=null;$('plUploadPreview').style.display='none';status(e.message||String(e),true)}
  finally{if(btn){btn.disabled=false;btn.textContent='＋  Upload Price List'}}
 }
 async function publish(){
  if(!pending){status('Preview Excel files before saving.',true);return}if(pending.duplicates.length){status('Duplicate model / variant rows detected. Resolve duplicates in the Excel files before saving.',true);return}var api=window.SVMBackend,btn=$('plPublishButton');
  if(!api||!api.publishPriceList){status('Secure backend is not ready. Refresh and try again.',true);return}
  if(!api.has('price_list_management','create')){status('You do not have permission to upload price lists.',true);return}
  var groups={};pending.rows.forEach(function(x){(groups[x.department]||(groups[x.department]=[])).push(x)});if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{await api.publishPriceList(groups,pending.files.join('; '),pending.fileObjects);pending=null;$('plUploadPreview').style.display='none';$('plFiles').value='';await refresh();status('Price lists saved successfully.')}
  catch(e){status(e.message||String(e),true)}finally{if(btn){btn.disabled=false;btn.textContent='Save Price Lists'}}
 }
 function cancelPreview(){pending=null;if($('plUploadPreview'))$('plUploadPreview').style.display='none';if($('plFiles'))$('plFiles').value='';status('Upload preview cancelled.')}
 function setup(){if(booted)return;booted=true;$('plFiles')?.addEventListener('change',preview);if($('plUploadButton')&&window.SVMBackend&&!window.SVMBackend.has('price_list_management','create'))$('plUploadButton').style.display='none';render();if(window.SVMBackend)refresh().catch(function(e){status(e.message,true)})}
 window.plStockFilterChanged=stockFilterChanged;window.plResetFilters=resetFilters;window.plRender=render;window.plRefresh=refresh;window.plPreview=preview;window.plPublish=publish;window.plCancelPreview=cancelPreview;
 window.addEventListener('svm:ready',setup);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){if(window.SVMBackend)setup()},{once:true});else if(window.SVMBackend)setup();
})();