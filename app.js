const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const parseDate=s=>new Date(s+'T12:00:00');
const pretty=s=>parseDate(s).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
const dayName=s=>parseDate(s).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
let scripts=JSON.parse(localStorage.getItem('scriptflow-scripts')||'[]');
let settings=JSON.parse(localStorage.getItem('scriptflow-settings')||'{"theme":"light","reminder":false,"lastReminder":""}');
let selectedDate=todayISO(), calendarDate=new Date(), editingId=null, reminderTimer=null;
let supabaseClient=null, currentUser=null, cloudReady=false, authMode='signin', saveTimer=null;
const save=()=>{
 localStorage.setItem('scriptflow-scripts',JSON.stringify(scripts));
 localStorage.setItem('scriptflow-settings',JSON.stringify(settings));
 if(!cloudReady||!currentUser||!supabaseClient)return;
 clearTimeout(saveTimer);
 saveTimer=setTimeout(async()=>{
  const {error}=await supabaseClient.from('scriptflow_user_data').upsert({user_id:currentUser.id,scripts,settings,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error){console.error(error);toast('Cloud save failed. Check your connection.');}
 },250);
};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const sorted=()=>[...scripts].sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created);
const pendingFor=date=>sorted().filter(s=>s.date===date&&s.status==='pending');
const nextPending=()=>sorted().find(s=>s.status==='pending');
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)}
function applyTheme(){let t=settings.theme;if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;$$('.theme-option').forEach(b=>b.classList.toggle('active',b.dataset.theme===settings.theme))}
function openModal(date=selectedDate,id=null){editingId=id;const s=id?scripts.find(x=>x.id===id):null;$('#modalTitle').textContent=s?'Edit script':'Add a script';$('#scriptTitle').value=s?.title||'';$('#scriptDate').value=s?.date||date;$('#scriptBody').value=s?.body||'';$('#scriptModal').classList.remove('hidden');$('#scriptTitle').focus()}
function closeModal(){$('#scriptModal').classList.add('hidden');editingId=null}
function statusPill(s){return `<span class="pill ${s.status}">${s.status==='pending'?'Pending':s.status==='done'?'Recorded':'Published'}</span>`}
function card(s,compact=false){const preview=(s.body||'').trim();return `<article class="script-card"><div class="script-card-top"><div><h3 class="script-title">${esc(s.title)}</h3><div class="script-meta">${pretty(s.date)} · ${preview?preview.length+' characters':'No script text added'}</div></div>${statusPill(s)}</div>${preview?`<p class="script-preview">${esc(preview.slice(0,compact?150:260))}${preview.length>(compact?150:260)?'…':''}</p>`:''}<div class="card-actions">${s.status==='pending'?`<button class="small-btn complete" data-action="complete" data-id="${s.id}">✓ Mark recorded</button>`:''}${s.status==='done'?`<button class="small-btn publish" data-action="publish" data-id="${s.id}">↗ Mark published</button>`:''}<button class="small-btn" data-action="edit" data-id="${s.id}">Edit</button><button class="small-btn" data-action="copy" data-id="${s.id}">Copy script</button></div></article>`}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderDashboard(){
 const today=todayISO(),todayPending=pendingFor(today),allPending=sorted().filter(s=>s.status==='pending'&&s.date>=today);
 $('#todayLabel').textContent=pretty(today);$('#fullDate').textContent=dayName(today);$('#statTotal').textContent=scripts.length;
 $('#statPending').textContent=todayPending.length;const month=today.slice(0,7);const recorded=scripts.filter(s=>s.date.startsWith(month)&&s.status!=='pending').length;$('#statDone').textContent=recorded;$('#statPublish').textContent=scripts.filter(s=>s.date===today&&s.status==='done').length;
 $('#taskCount').textContent=`${scripts.length} tasks`;$('#queueSubcount').textContent=`${todayPending.length} tasks`;
 const q=$('#queueContent');
 const row=(s,main=false)=>`<div class="task-card"><div class="task-card-main"><span class="task-expand">⌄</span><i class="task-square"></i><strong title="${esc(s.title)}">${esc(s.title)}</strong></div><span class="task-priority ${main?'high':''}">${s.status==='pending'?'To record':s.status==='done'?'Recorded':'Published'}</span><span class="task-due ${s.date===today?'today':''}">${s.date===today?'Today':pretty(s.date)}</span></div><div class="task-actions">${s.status==='pending'?`<button data-action="complete" data-id="${s.id}">✓ Mark recorded</button>`:''}${s.status==='done'?`<button data-action="publish" data-id="${s.id}">↗ Publish</button>`:''}<button data-action="edit" data-id="${s.id}">Edit</button></div>`;
 if(todayPending.length){q.innerHTML=row(todayPending[0],true);$('#queueHeading')?.replaceChildren();$('#queueSubcount').textContent=`${todayPending.length} tasks`;}
 else {const next=allPending[0];q.innerHTML=next?`<div class="empty-state"><div class="empty-icon">✦</div><strong>Today is clear!</strong><p>Your next script is <b>${esc(next.title)}</b> on ${pretty(next.date)}.</p><button class="secondary-btn" data-action="jump" data-id="${next.id}">Go to next scheduled day →</button></div>`:'<div class="empty-state"><div class="empty-icon">✓</div><strong>You’re all caught up.</strong><p>Add a script to your calendar to build your next recording queue.</p><button class="secondary-btn" data-action="add">＋ Add a script</button></div>';
 }
 const later=todayPending.slice(1).concat(allPending.filter(s=>s.date>today)).slice(0,4);$('#upcomingCount').textContent=`${later.length} tasks`;$('#taskUpcoming').innerHTML=later.map(s=>`<div class="task-card"><div class="task-card-main"><span class="task-expand">⌄</span><i class="task-square"></i><strong>${esc(s.title)}</strong></div><span class="task-priority">${s.status==='pending'?'To record':'Recorded'}</span><span class="task-due">${s.date===today?'Today':pretty(s.date)}</span></div>`).join('');
 $('#projectVideoCount').textContent=`${scripts.length} script${scripts.length===1?'':'s'} in workspace`;
 const pct=todayPending.length?Math.round((scripts.filter(s=>s.date===today&&s.status!=='pending').length/Math.max(1,scripts.filter(s=>s.date===today).length))*100):100;
 $('#goalRecordBar').style.width=pct+'%';$('#goalRecordPct').textContent=pct+'%';$('#goalRecordText').textContent=todayPending.length?`${todayPending.length} script${todayPending.length===1?'':'s'} left in today's queue`:"Today's queue is complete";
 const pipeline=Math.min(100,allPending.length*15);$('#goalPipelineBar').style.width=pipeline+'%';$('#goalPipelinePct').textContent=pipeline+'%';
 $('#reminderState').textContent=settings.reminder?'✓':'○';$('#reminderState').style.color=settings.reminder?'var(--green)':'var(--muted)';$('#enableReminder').textContent=settings.reminder?'✓':'♧';$('#reminderNote').textContent=settings.reminder?'Daily 6 PM reminder is enabled.':'Enable notifications to get your daily publishing nudge.';
 renderMiniCalendar();
}
function renderMiniCalendar(){const wrap=$('#dashboardMiniCalendar');if(!wrap)return;const base=parseDate(selectedDate);const start=new Date(base);start.setDate(base.getDate()-base.getDay());let html='';for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const count=scripts.filter(s=>s.date===iso).length;html+=`<button class="mini-day ${iso===selectedDate?'selected':''}" data-mini-date="${iso}"><small>${d.toLocaleDateString(undefined,{weekday:'short'})}</small><strong>${String(d.getDate()).padStart(2,'0')}</strong>${count?'<i class="mini-dot"></i>':'<i></i>'}</button>`}wrap.innerHTML=html;const items=scripts.filter(s=>s.date===selectedDate);$('#miniSelectedEvent').querySelector('strong').textContent=items.length?items[0].title:'No scripts scheduled';$('#miniSelectedEvent').querySelector('small').textContent=items.length?`${items.length} script${items.length===1?'':'s'} · ${dayName(selectedDate)}`:`${dayName(selectedDate)} · Add a script to plan this day`;}

function renderCalendar(){const y=calendarDate.getFullYear(),m=calendarDate.getMonth();$('#monthTitle').textContent=calendarDate.toLocaleDateString(undefined,{month:'long',year:'numeric'});const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());let html='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const count=scripts.filter(s=>s.date===iso).length;html+=`<button class="day-cell ${d.getMonth()!==m?'outside':''} ${iso===selectedDate?'selected':''} ${iso===todayISO()?'today':''}" data-date="${iso}"><span class="day-number">${d.getDate()}</span>${count?`<div class="day-dots">${'<i></i>'.repeat(Math.min(count,4))}</div><div class="day-count">${count} script${count===1?'':'s'}</div>`:''}</button>`}$('#calendarGrid').innerHTML=html;renderSelectedDay()}
function renderSelectedDay(){$('#selectedDateTitle').textContent=dayName(selectedDate);const list=sorted().filter(s=>s.date===selectedDate);$('#selectedDayScripts').innerHTML=list.length?list.map(s=>card(s,true)).join(''):'<div class="empty-state"><div class="empty-icon">▦</div><strong>No scripts on this date</strong><p>Add a script here to plan your recording day.</p></div>'}
function renderLibrary(){const q=$('#searchScripts').value.toLowerCase(),f=$('#filterStatus').value;const list=sorted().filter(s=>(f==='all'||s.status===f)&&(`${s.title} ${s.body}`.toLowerCase().includes(q)));$('#libraryContent').innerHTML=list.length?list.map(s=>card(s)).join(''):'<div class="empty-state"><strong>No matching scripts</strong><p>Try another search or add a new script.</p></div>'}
function render(){renderDashboard();renderCalendar();renderLibrary();applyTheme();$('#reminderSwitch').checked=!!settings.reminder;$('#permissionText').textContent='Browser permission: '+(Notification?.permission||'unsupported')}

function authMessage(message,isError=false){const el=$('#authMessage');el.textContent=message;el.classList.toggle('error',isError)}
function setAuthMode(mode){authMode=mode;$('#authTitle').textContent=mode==='signup'?'Create your account':'Welcome back';$('#authEyebrow').textContent=mode==='signup'?'START YOUR CONTENT WORKSPACE':'YOUR WORKSPACE, EVERYWHERE';$('#authDescription').textContent=mode==='signup'?'Create a free account to keep your scripts synced across devices.':'Sign in to access your scripts and calendar from any device.';$('#authSubmit').textContent=mode==='signup'?'Create account':'Sign in';$('#authSwitchText').textContent=mode==='signup'?'Already have an account?':'New to ScriptFlow?';$('#authSwitch').textContent=mode==='signup'?'Sign in':'Create an account';$('#authPassword').autocomplete=mode==='signup'?'new-password':'current-password';authMessage('')}
async function loadCloudData(){
 const {data,error}=await supabaseClient.from('scriptflow_user_data').select('scripts,settings').eq('user_id',currentUser.id).maybeSingle();
 if(error)throw error;
 if(data){scripts=Array.isArray(data.scripts)?data.scripts:[];settings={...settings,...(data.settings||{})};localStorage.setItem('scriptflow-cloud-migrated','true');}
 else {
  // Import old browser data only once; never copy one account's cached data into another account.
  const alreadyMigrated=localStorage.getItem('scriptflow-cloud-migrated')==='true';
  const localScripts=alreadyMigrated?[]:JSON.parse(localStorage.getItem('scriptflow-scripts')||'[]');
  const localSettings=alreadyMigrated?{theme:'light',reminder:false,lastReminder:''}:JSON.parse(localStorage.getItem('scriptflow-settings')||'{"theme":"light","reminder":false,"lastReminder":""}');
  scripts=localScripts;settings={...settings,...localSettings};
  const {error:insertError}=await supabaseClient.from('scriptflow_user_data').insert({user_id:currentUser.id,scripts,settings});
  if(insertError)throw insertError;
  localStorage.setItem('scriptflow-cloud-migrated','true');
 }
 localStorage.setItem('scriptflow-scripts',JSON.stringify(scripts));localStorage.setItem('scriptflow-settings',JSON.stringify(settings));
}
async function enterWorkspace(user){
 currentUser=user;cloudReady=false;$('#authGate').classList.add('hidden');$('#accountEmail').textContent=user.email||'Signed in';
 try{await loadCloudData();cloudReady=true;render();scheduleReminder();showView('dashboard');}
 catch(err){console.error(err);$('#authGate').classList.remove('hidden');authMessage('Could not load your cloud workspace. Check the database setup and try again.',true);}
}
async function bootAuth(){
 const cfg=window.SCRIPTFLOW_CONFIG||{};
 if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){$('#authTitle').textContent='One-time setup required';$('#authDescription').textContent='Connect your Supabase project to enable secure accounts and cloud sync.';$('#authForm').classList.add('hidden');$('#authSwitch').classList.add('hidden');$('#authSwitchText').classList.add('hidden');authMessage('Open config.js and add your Supabase Project URL and anon/publishable key. Then run the SQL in supabase/schema.sql.',true);return;}
 supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 $('#authForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('#authEmail').value.trim(),password=$('#authPassword').value;$('#authSubmit').disabled=true;$('#authSubmit').textContent='Please wait…';authMessage('');
  try{if(authMode==='signup'){const {data,error}=await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)throw error;if(data.session)await enterWorkspace(data.user);else authMessage('Account created. Check your email to confirm your address, then sign in.');}
  else{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await enterWorkspace(data.user);}}
  catch(err){authMessage(err.message||'Authentication failed. Please try again.',true)}finally{$('#authSubmit').disabled=false;$('#authSubmit').textContent=authMode==='signup'?'Create account':'Sign in';}
 });
 $('#authSwitch').onclick=()=>setAuthMode(authMode==='signup'?'signin':'signup');
 $('#signOutBtn').onclick=async()=>{cloudReady=false;await supabaseClient.auth.signOut();currentUser=null;scripts=[];settings={theme:'light',reminder:false,lastReminder:''};$('#authGate').classList.remove('hidden');setAuthMode('signin');};
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(session?.user)await enterWorkspace(session.user);else $('#authGate').classList.remove('hidden');
 supabaseClient.auth.onAuthStateChange(async(event,session)=>{if(event==='SIGNED_IN'&&session?.user&&!currentUser)await enterWorkspace(session.user);if(event==='SIGNED_OUT'){currentUser=null;cloudReady=false;$('#authGate').classList.remove('hidden')}});
}

function showView(v){$$('.page').forEach(p=>p.classList.add('hidden'));$('#'+v+'View').classList.remove('hidden');$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#breadcrumb').textContent='Workspace / '+({dashboard:'Overview',calendar:'Calendar',library:'Script library',settings:'Settings & reminders'}[v]);if(v==='calendar')renderCalendar();if(v==='library')renderLibrary()}
function action(e){const b=e.target.closest('[data-action]');if(!b)return;const s=scripts.find(x=>x.id===b.dataset.id);switch(b.dataset.action){case'complete':if(s){s.status='done';s.recordedAt=Date.now();save();render();toast('Marked as recorded. Next script is ready.')}break;case'publish':if(s){s.status='published';s.publishedAt=Date.now();save();render();toast('Marked as published.')}break;case'edit':if(s)openModal(s.date,s.id);break;case'copy':if(s){navigator.clipboard?.writeText(s.body||'').then(()=>toast('Script copied')).catch(()=>toast('Clipboard unavailable'));}break;case'add':openModal(selectedDate);break;case'jump':if(s){selectedDate=s.date;calendarDate=parseDate(s.date);showView('calendar')}break}}
document.addEventListener('click',action);
$('#scriptForm').addEventListener('submit',e=>{e.preventDefault();const title=$('#scriptTitle').value.trim(),date=$('#scriptDate').value,body=$('#scriptBody').value;if(!title||!date)return;if(editingId){Object.assign(scripts.find(s=>s.id===editingId),{title,date,body})}else scripts.push({id:uid(),title,date,body,status:'pending',created:Date.now()});selectedDate=date;calendarDate=parseDate(date);save();closeModal();render();toast(editingId?'Script updated':'Script added to your calendar')});
$('#closeModal').onclick=closeModal;$('#cancelModal').onclick=closeModal;$('#addTop').onclick=()=>openModal(selectedDate);$('#addCalendar').onclick=()=>openModal(selectedDate);$('#addLibrary').onclick=()=>openModal(todayISO());$('#addSelected').onclick=()=>openModal(selectedDate);$('#openCalendar').onclick=()=>showView('calendar');
$$('.nav-item').forEach(b=>b.onclick=()=>showView(b.dataset.view));$$('[data-goto]').forEach(b=>b.onclick=()=>showView(b.dataset.goto));
$('#calendarGrid').addEventListener('click',e=>{const b=e.target.closest('[data-date]');if(b){selectedDate=b.dataset.date;renderCalendar()}});
$('#dashboardMiniCalendar').addEventListener('click',e=>{const b=e.target.closest('[data-mini-date]');if(b){selectedDate=b.dataset.miniDate;renderDashboard()}});
$('#miniMonthLink').onclick=()=>showView('calendar');$('#addQuick').onclick=()=>openModal(selectedDate);$('#addTaskInline').onclick=()=>openModal(selectedDate);$('#addTaskText').onclick=()=>openModal(selectedDate);$('#addTopMobile').onclick=()=>openModal(selectedDate);$('#focusToday').onclick=()=>{selectedDate=todayISO();renderDashboard()};
$('#prevMonth').onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()};$('#nextMonth').onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()};$('#goToday').onclick=()=>{selectedDate=todayISO();calendarDate=new Date();renderCalendar()};
$('#searchScripts').oninput=renderLibrary;$('#filterStatus').onchange=renderLibrary;
$('#themeToggle').onclick=()=>{settings.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';save();applyTheme();render()};
$$('.theme-option').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.theme;save();applyTheme()});
async function enableNotifications(){if(!('Notification'in window)){toast('This browser does not support notifications');return}const p=await Notification.requestPermission();$('#permissionText').textContent='Browser permission: '+p;if(p==='granted'){settings.reminder=true;save();render();scheduleReminder();toast('Daily 6 PM reminder enabled')}else toast('Please allow notifications in browser settings')}
$('#enableReminder').onclick=enableNotifications;$('#settingsEnable').onclick=enableNotifications;$('#reminderSwitch').onchange=e=>{settings.reminder=e.target.checked;save();render();scheduleReminder()};
function scheduleReminder(){if(reminderTimer)clearTimeout(reminderTimer);if(!settings.reminder||!('Notification'in window)||Notification.permission!=='granted')return;const now=new Date(),next=new Date();next.setHours(18,0,0,0);if(next<=now)next.setDate(next.getDate()+1);reminderTimer=setTimeout(()=>{const day=todayISO();if(settings.lastReminder!==day){new Notification('ScriptFlow · Publishing time',{body:'It’s 6 PM. Time to publish your finished videos.',icon:'icon.svg'});settings.lastReminder=day;save()}scheduleReminder()},next-now)}
$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify({scripts,settings,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='scriptflow-backup.json';a.click();URL.revokeObjectURL(a.href)};
$('#importData').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.scripts))throw Error();scripts=d.scripts;settings={...settings,...d.settings};save();render();toast('Backup restored')}catch{toast('That backup file is not valid')}e.target.value=''};
$('#clearData').onclick=()=>{if(confirm('Delete every script in this browser? This cannot be undone. Export a backup first if needed.')){scripts=[];save();render();toast('All scripts deleted')}};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
$('#authGate').classList.remove('hidden');bootAuth();
