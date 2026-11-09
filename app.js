/* Andre Health — offline-first personal tracker. All data stays on this phone (localStorage). */
(function(){
'use strict';
const KEY='andre-health-v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return ymd(d);};
const today=()=>ymd(new Date());
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtD=s=>{const d=parse(s);return `${d.getDate()} ${MON[d.getMonth()]}`;};
const fmtDY=s=>{const d=parse(s);return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;};
const weekStart=s=>{const d=parse(s);const k=(d.getDay()+6)%7;d.setDate(d.getDate()-k);return ymd(d);};
const daysBetween=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const num=v=>{if(v===''||v==null)return null;const n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:null;};
const r1=n=>Math.round(n*10)/10;

const HABITS=[
  ['gym','🏋️','Gym session'],['walk','🚶','Walk'],['protein','🍳','Protein meals'],['veg','🥦','Vegetables'],
  ['sugar','🍬','Low added sugar'],['meds','💊','Medication'],['water','💧','Water / hydration'],['sleep','😴','Sleep routine']];

const DEFAULT_PLAN={
  Mon:{brunch:'Eggs, spinach, tomato + plain yoghurt',dinner:'Lemon chicken, broccoli, cauliflower mash',snack:'Apple + almonds'},
  Tue:{brunch:'Plain Greek yoghurt, berries, nuts + 2 eggs',dinner:'Lean mince bolognese, half wholewheat spaghetti / half courgette',snack:'Cottage cheese'},
  Wed:{brunch:'Tuna salad, avocado, boiled egg',dinner:'Baked hake, roast vegetables, small sweet potato',snack:'Pear + walnuts'},
  Thu:{brunch:'Chicken-and-egg salad with olive oil',dinner:'Lean beef mince stir-fry, peppers + small brown-rice portion',snack:'Plain yoghurt'},
  Fri:{brunch:'Vegetable omelette + fruit',dinner:'Chicken curry, vegetables + modest basmati rice',snack:'Handful of unsalted nuts'},
  Sat:{brunch:'Smoked or canned fish, tomato, wholegrain toast',dinner:'Grilled fish, green beans, roast pumpkin',snack:'Berries + yoghurt'},
  Sun:{brunch:'Eggs, mushrooms, avocado + fruit',dinner:'Lean homemade meatballs, tomato sauce + courgette spaghetti / pasta mix',snack:'Dark chocolate, small portion'}};
const DIET_NOTE='Lower-carb, higher-protein — not extreme keto. Limit butter, cream, bacon and fatty cheese. Keep carbohydrates optional and portioned. If oats, beans or lentils cause symptoms, don\u2019t force them.';
const DEFAULT_MARKERS=[
  {name:'LDL cholesterol',unit:'mg/dL'},{name:'Total cholesterol',unit:'mg/dL'},{name:'HDL cholesterol',unit:'mg/dL'},
  {name:'Triglycerides',unit:'mg/dL'},{name:'HbA1c',unit:'%'},{name:'Fasting glucose',unit:'mg/dL'},
  {name:'Creatinine',unit:'mg/dL'},{name:'eGFR',unit:'mL/min/1.73 m²'},{name:'Potassium',unit:'mmol/L'}];

function blank(){return {v:1,settings:{start:null,target:null},habits:{},readings:[],gymLog:[],gymDraft:null,
  mealPlan:JSON.parse(JSON.stringify(DEFAULT_PLAN)),meals:{},medical:[],labs:{markers:DEFAULT_MARKERS.slice(),results:[]},notes:[],lastBackup:null};}

let S;
function load(){
  try{const raw=localStorage.getItem(KEY);S=raw?Object.assign(blank(),JSON.parse(raw)):blank();}catch(e){S=blank();}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){toast('Could not save — storage full?');}}
load();
if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(()=>{});}

/* ---------- UI helpers ---------- */
let tab=(location.hash||'').slice(1)||'today';
if(!['today','body','gym','food','health'].includes(tab)) tab='today';
let showAllRem=false;
let viewDate=today(), mealWeek=weekStart(today());
const TITLES={today:'Today',body:'Weight & BP',gym:'Gym',food:'Meals',health:'Medical'};

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.add('hidden'),2200);}
function openSheet(html,bind){$('#sheet').innerHTML=html;$('#sheetWrap').classList.remove('hidden');bind&&bind($('#sheet'));}
function closeSheet(){$('#sheetWrap').classList.add('hidden');$('#sheet').innerHTML='';}
$('#sheetWrap').addEventListener('click',e=>{if(e.target.id==='sheetWrap')closeSheet();});

function setTab(t){tab=t;history.replaceState(null,'','#'+t);render();window.scrollTo(0,0);}
document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('#settingsBtn').addEventListener('click',openSettings);

/* ---------- Derived data ---------- */
const weights=()=>S.readings.filter(r=>r.w!=null).sort((a,b)=>a.date.localeCompare(b.date));
const bps=()=>S.readings.filter(r=>r.sys!=null&&r.dia!=null).sort((a,b)=>a.date.localeCompare(b.date));
function latestWeight(){const w=weights();return w.length?w[w.length-1].w:S.settings.start;}
function progress(){
  const st=S.settings.start, tg=S.settings.target, lw=latestWeight();
  if(st==null||tg==null) return null;
  const lost=r1(st-lw), total=st-tg, pct=total>0?Math.max(0,Math.min(1,lost/total)):0;
  return {st,tg,lw,lost,toGo:r1(Math.max(0,lw-tg)),pct};
}
function moveStreak(){
  let d=today(),n=0;
  const h=S.habits;
  if(!(h[d]&&(h[d].gym||h[d].walk))) d=addDays(d,-1);
  while(h[d]&&(h[d].gym||h[d].walk)){n++;d=addDays(d,-1);}
  return n;
}
function gymThisWeek(){const ws=weekStart(today());return S.gymLog.filter(g=>g.date>=ws&&g.session!=='D').length;}
function reminders(){
  const t=today(), out=[];
  S.medical.filter(m=>m.status!=='Done'&&m.due).forEach(m=>{
    const dd=daysBetween(t,m.due);
    if(dd<0) out.push({cls:'over',icon:'⚠️',txt:`<b>Overdue:</b> ${esc(m.task)}`,sub:`was due ${fmtDY(m.due)}`,id:m.id,sort:dd});
    else if(dd<=30) out.push({cls:'due',icon:'🩺',txt:esc(m.task),sub:dd===0?'due today':`due in ${dd} day${dd>1?'s':''} · ${fmtD(m.due)}`,id:m.id,sort:dd});
  });
  out.sort((a,b)=>a.sort-b.sort);
  if(S.settings.start!=null){
    const w=weights(); const last=w.length?w[w.length-1].date:null;
    if(!last||daysBetween(last,t)>=7) out.unshift({cls:'due',icon:'⚖️',txt:'<b>Weekly weigh-in due</b>',sub:last?`last weigh-in ${fmtD(last)}`:'log your first weigh-in',act:'addReading'});
  }
  const hasData=S.readings.length||S.gymLog.length||Object.keys(S.habits).length>3;
  if(hasData&&(!S.lastBackup||daysBetween(S.lastBackup.slice(0,10),t)>30))
    out.push({cls:'',icon:'💾',txt:'Back up your data',sub:'saves a file you can restore from',act:'backup'});
  return out;
}

/* ---------- Charts (SVG) ---------- */
function chart({series,refs=[],h=180,dec=0,unit=''}){
  const all=[];series.forEach(s=>s.pts.forEach(p=>all.push(p)));
  if(!all.length) return `<div class="empty">No data yet — add an entry to see the graph.</div>`;
  const W=340,L=34,R=14,T=12,B=22;
  const ts=all.map(p=>parse(p[0]).getTime());let t0=Math.min(...ts),t1=Math.max(...ts);
  if(t0===t1){t0-=7*864e5;t1+=7*864e5;}
  const vals=all.map(p=>p[1]).concat(refs.map(r=>r.y));
  let y0=Math.min(...vals),y1=Math.max(...vals);const padY=(y1-y0)*0.12||Math.max(1,Math.abs(y1)*0.05);y0-=padY;y1+=padY;
  const X=t=>L+(t-t0)/(t1-t0)*(W-L-R), Y=v=>T+(1-(v-y0)/(y1-y0))*(h-T-B);
  let g='';
  for(let i=0;i<=4;i++){const v=y0+(y1-y0)*i/4,y=Y(v);g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#223243"/><text x="${L-5}" y="${y+3}" text-anchor="end">${v.toFixed(dec)}</text>`;}
  const dl=[t0,(t0+t1)/2,t1];
  dl.forEach((t,i)=>{const d=new Date(t);g+=`<text x="${X(t)}" y="${h-6}" text-anchor="${['start','middle','end'][i]}">${d.getDate()} ${MON[d.getMonth()]}${i!==1?" '"+String(d.getFullYear()).slice(2):''}</text>`;});
  refs.forEach(r=>{const y=Y(r.y);g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="${r.color}" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${L+4}" y="${y+12}" text-anchor="start" style="fill:${r.color}">${esc(r.label)}</text>`;});
  series.forEach(s=>{
    const pts=s.pts.slice().sort((a,b)=>a[0].localeCompare(b[0])).map(p=>[X(parse(p[0]).getTime()),Y(p[1]),p[1]]);
    if(pts.length>1) g+=`<path d="${pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach(p=>g+=`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.color}"/>`);
    const lp=pts[pts.length-1];g+=`<text x="${Math.min(lp[0],W-R-2)}" y="${lp[1]-8}" text-anchor="end" style="fill:${s.color};font-weight:700;font-size:11px">${lp[2]}${unit}</text>`;
  });
  const leg=series.length>1||refs.length?`<div class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`:'';
  return `<div class="chart"><svg viewBox="0 0 ${W} ${h}">${g}</svg>${leg}</div>`;
}

/* ---------- Views ---------- */
function vWelcome(){
  return `<div class="card welcome"><div class="logo">💪</div><h2 style="justify-content:center">Welcome</h2>
  <p class="muted small">Set your starting and target weight, or load your starter / backup file.</p>
  <div class="grid2" style="text-align:left"><div class="field"><label>Starting weight (kg)</label><input id="wStart" type="number" inputmode="decimal" placeholder="119"></div>
  <div class="field"><label>Target weight (kg)</label><input id="wTarget" type="number" inputmode="decimal" placeholder="107"></div></div>
  <button class="btn" data-act="setup">Start tracking</button>
  <div style="height:8px"></div><button class="btn sec" data-act="import">📂 Load starter or backup file</button></div>`;
}

function vToday(){
  if(S.settings.start==null) return vWelcome();
  const d=viewDate, isT=d===today(), h=S.habits[d]||{}, dn=HABITS.filter(x=>h[x[0]]).length, p=progress();
  const dObj=parse(d), dayKey=DOW[dObj.getDay()], plan=S.mealPlan[dayKey]||{}, m=S.meals[d]||{};
  let html=`<div class="datebar"><button data-act="day" data-arg="-1">‹</button>
    <div class="d">${isT?'Today':DOW[dObj.getDay()]}<small>${DOW[dObj.getDay()]} ${fmtDY(d)}</small></div>
    <button data-act="day" data-arg="1" ${isT?'disabled style="opacity:.3"':''}>›</button></div>`;
  if(isT){
    const rem=reminders();
    const MAX=3, extra=rem.length-MAX, shown=extra>0&&!showAllRem?rem.slice(0,MAX):rem;
    if(rem.length) html+=`<div class="card"><h2>Reminders <small>${rem.length}</small></h2>${shown.map(r=>`<div class="alert ${r.cls}" data-act="${r.act||'editMed'}" data-arg="${r.id||''}"><span>${r.icon}</span><div class="grow">${r.txt}<div class="small muted">${r.sub}</div></div><span class="muted">›</span></div>`).join('')}${extra>0?`<div style="margin-top:10px"><button class="link" data-act="moreRem">${showAllRem?'Show fewer':'Show '+extra+' more'}</button></div>`:''}</div>`;
  }
  html+=`<div class="card"><h2>Daily checklist <small>${dn}/${HABITS.length}</small></h2><div class="checks">
    ${HABITS.map(([k,ic,l])=>`<button class="chk ${h[k]?'on':''}" data-act="habit" data-arg="${k}"><span class="box">${h[k]?'✓':''}</span><span class="lbl">${ic} ${l}</span></button>`).join('')}
  </div></div>`;
  html+=`<div class="card"><h2>${dayKey} meals <small><button class="link" data-act="tab" data-arg="food">Week ›</button></small></h2>
    ${['brunch','dinner','snack'].map(k=>`<div class="meal"><div class="k">${k==='snack'?'Optional snack':k}</div><div>${esc(plan[k]||'—')}</div>
    <div class="pills"><button class="pill ${m[k]==='done'?'on':''}" data-act="meal" data-arg="${d}|${k}|done">✓ Eaten</button><button class="pill sw ${m[k]==='swap'?'on':''}" data-act="meal" data-arg="${d}|${k}|swap">⇄ Swapped</button></div></div>`).join('')}
  </div>`;
  if(p) html+=`<div class="card"><h2>Weight goal <small>${p.st} → ${p.tg} kg</small></h2>
    <div class="row between"><div><div class="big">${p.lw} kg</div><div class="small muted">latest</div></div>
    <div style="text-align:right"><div style="font-size:20px;font-weight:800;color:var(--accent)">${p.lost>=0?'−':'+'}${Math.abs(p.lost)} kg</div><div class="small muted">${p.toGo} kg to go</div></div></div>
    <div class="bar"><i style="width:${(p.pct*100).toFixed(0)}%"></i></div><div class="small muted">${(p.pct*100).toFixed(0)}% of the way</div></div>`;
  html+=`<div class="stats"><div class="stat"><b>${moveStreak()}</b><span>day move streak</span></div>
    <div class="stat"><b>${gymThisWeek()}/3</b><span>gym this week</span></div>
    <div class="stat"><b>${S.gymLog.length}</b><span>total sessions</span></div></div>`;
  return html;
}

function vBody(){
  const p=progress(), w=weights(), b=bps();
  let html='';
  if(p){
    let pace='';
    if(w.length>=2){const days=daysBetween(w[0].date,w[w.length-1].date);if(days>=7){const wk=(w[0].w-w[w.length-1].w)/(days/7);pace=`${wk>=0?'−':'+'}${Math.abs(r1(wk))} kg / week average`;}}
    html+=`<div class="stats" style="margin-bottom:12px"><div class="stat"><b>${p.lw}</b><span>latest kg</span></div><div class="stat"><b style="color:var(--accent)">${p.lost}</b><span>kg lost</span></div><div class="stat"><b>${p.toGo}</b><span>kg to go</span></div></div>`;
    if(pace) html+=`<div class="note" style="margin:-4px 0 12px">📉 ${pace}</div>`;
  }
  html+=`<button class="btn" data-act="addReading">＋ Log weight / blood pressure</button><div style="height:12px"></div>`;
  html+=`<div class="card"><h2>Weight <small>kg</small></h2>${chart({series:[{name:'Weight',color:'#3ddc97',pts:w.map(r=>[r.date,r.w])}],
    refs:p?[{y:p.tg,label:'Target '+p.tg,color:'#ffb547'},{y:p.st,label:'Start '+p.st,color:'#5c7186'}]:[],dec:0,unit:''})}</div>`;
  html+=`<div class="card"><h2>Blood pressure <small>mmHg</small></h2>${chart({series:[{name:'Systolic',color:'#ff6b6b',pts:b.map(r=>[r.date,r.sys])},{name:'Diastolic',color:'#4aa8ff',pts:b.map(r=>[r.date,r.dia])}],refs:b.length?[{y:120,label:'120',color:'#5c7186'},{y:80,label:'80',color:'#5c7186'}]:[]})}</div>`;
  const rows=S.readings.slice().sort((a,b)=>b.date.localeCompare(a.date));
  html+=`<div class="card"><h2>Log</h2>${rows.length?`<div class="list">${rows.map(r=>`<div class="it" data-act="editReading" data-arg="${r.id}">
    <div><b>${fmtDY(r.date)}</b><div class="small muted">${[r.w!=null?r.w+' kg':'',r.sys!=null?`BP ${r.sys}/${r.dia}`:'',r.pulse!=null?r.pulse+' bpm':'',r.waist!=null?'waist '+r.waist+' cm':''].filter(Boolean).join(' · ')}${r.notes?' · '+esc(r.notes):''}</div></div><span class="muted">›</span></div>`).join('')}</div>`:'<div class="empty">No readings yet.</div>'}</div>`;
  return html;
}

function lastFor(exId){
  for(let i=S.gymLog.length-1;i>=0;i--){const it=S.gymLog[i].items.find(x=>x.id===exId&&x.done);if(it) return {...it,date:S.gymLog[i].date};}
  return null;
}
function ensureDraft(session){
  const t=today();
  if(!S.gymDraft||S.gymDraft.date!==t||(session&&S.gymDraft.session!==session)){
    const sid=session||(S.gymDraft&&S.gymDraft.date===t?S.gymDraft.session:suggestSession());
    const items={};
    SESSIONS[sid].items.forEach(it=>{const l=lastFor(it.id);items[it.id]={sets:l?l.sets:it.sets,reps:l?l.reps:it.reps,kg:l?l.kg:null,done:false};});
    S.gymDraft={date:t,session:sid,items};save();
  }
  return S.gymDraft;
}
function suggestSession(){
  const last=[...S.gymLog].reverse().find(g=>g.session!=='D');
  if(!last) return 'A';
  return {A:'B',B:'C',C:'A'}[last.session]||'A';
}
function vGym(){
  const dr=ensureDraft(), ses=SESSIONS[dr.session];
  const doneCount=Object.values(dr.items).filter(x=>x.done).length;
  let html=`<div class="seg">${Object.values(SESSIONS).map(s=>`<button class="${s.label===dr.session?'on':''}" data-act="session" data-arg="${s.label}">${s.label}<small>${s.type}</small></button>`).join('')}</div>`;
  html+=`<div class="row between" style="margin:0 2px 10px"><div><b style="font-size:18px">Session ${ses.label} · ${ses.name}</b><div class="small muted">${gymThisWeek()}/3 strength sessions this week</div></div></div>`;
  ses.items.forEach(it=>{
    const ex=EXERCISES[it.id], v=dr.items[it.id], l=lastFor(it.id);
    html+=`<div class="ex ${v.done?'done':''}"><div class="pic">${exerciseFigure(it.id)}</div><div class="body">
      <div class="row between"><h3>${ex.name}</h3><span class="tag">${it.sets}×${it.reps} ${it.unit}</span></div>
      <div class="small" style="color:var(--accent2);margin-top:2px">${ex.muscles}</div>
      <div class="cue">${ex.cue}</div>
      <div class="inputs"><div><label>Sets</label><input type="number" inputmode="numeric" data-ex="${it.id}" data-f="sets" value="${v.sets??''}"></div>
      <div><label>${it.unit==='reps'?'Reps':it.unit==='sec'?'Seconds':it.unit==='min'?'Minutes':'Metres'}</label><input type="number" inputmode="numeric" data-ex="${it.id}" data-f="reps" value="${v.reps??''}"></div>
      <div><label>${it.noKg?'Level / incline':'Weight kg'}</label><input type="number" inputmode="decimal" data-ex="${it.id}" data-f="kg" value="${v.kg??''}" placeholder="${it.noKg?'—':'kg'}"></div></div>
      ${l?`<div class="last">Last time (${fmtD(l.date)}): ${l.sets}×${l.reps}${l.kg!=null?' @ '+l.kg+(it.noKg?'':' kg'):''}</div>`:''}
      <button class="btn ${v.done?'':'sec'} donebtn" data-act="exDone" data-arg="${it.id}">${v.done?'✓ Done':'Mark done'}</button></div></div>`;
  });
  html+=`<button class="btn blue" data-act="finishGym">Finish session (${doneCount}/${ses.items.length} done)</button><div style="height:14px"></div>`;
  const hist=S.gymLog.slice().reverse().slice(0,15);
  html+=`<div class="card"><h2>History <small>${S.gymLog.length} sessions</small></h2>${hist.length?`<div class="list">${hist.map(g=>`<div class="it"><div><b>${fmtDY(g.date)} · ${g.session}</b><div class="small muted">${g.items.filter(i=>i.done).map(i=>`${EXERCISES[i.id]?EXERCISES[i.id].name:i.id}${i.kg!=null?' '+i.kg+'kg':''}`).join(' · ')||'—'}</div></div><button class="link" data-act="delGym" data-arg="${g.id}" style="color:var(--muted)">✕</button></div>`).join('')}</div>`:'<div class="empty">Finish a session to start your log.</div>'}</div>`;
  return html;
}

function vFood(){
  const ws=mealWeek, t=today();
  let html=`<div class="datebar"><button data-act="mweek" data-arg="-7">‹</button><div class="d">Week of ${fmtD(ws)}<small>${ws===weekStart(t)?'this week':fmtDY(ws)}</small></div><button data-act="mweek" data-arg="7">›</button></div>`;
  let done=0,tot=0;
  let days='';
  for(let i=0;i<7;i++){
    const d=addDays(ws,i), key=DOW[parse(d).getDay()], plan=S.mealPlan[key]||{}, m=S.meals[d]||{};
    ['brunch','dinner'].forEach(k=>{tot++;if(m[k])done++;});
    days+=`<div class="day ${d===t?'today':''}"><div class="dh"><span>${key} ${fmtD(d)}${d===t?' · today':''}</span></div>
      ${['brunch','dinner','snack'].map(k=>`<div class="mline"><span class="k">${k}</span><span class="t">${esc(plan[k]||'—')}</span>
      <button class="mini ${m[k]==='done'?'on':''}" data-act="meal" data-arg="${d}|${k}|done" aria-label="Eaten">✓</button>
      <button class="mini sw ${m[k]==='swap'?'on':''}" data-act="meal" data-arg="${d}|${k}|swap" aria-label="Swapped">⇄</button></div>`).join('')}</div>`;
  }
  html+=`<div class="card"><h2>Brunch + dinner <small>${done}/${tot} logged</small></h2><div class="bar"><i style="width:${tot?done/tot*100:0}%"></i></div><div style="height:8px"></div>${days}</div>`;
  html+=`<button class="btn sec" data-act="editPlan">✏️ Edit 7-day meal plan</button><div class="note">🥗 ${DIET_NOTE}</div>`;
  return html;
}

const STATUS={'Not started':'ns','In progress':'ip','Done':'dn'};
function vHealth(){
  let html='';
  const pr={High:0,Medium:1,Low:2};
  const items=S.medical.slice().sort((a,b)=>((a.status==='Done')-(b.status==='Done'))||((a.due||'9999').localeCompare(b.due||'9999'))||(pr[a.priority]-pr[b.priority]));
  const dn=S.medical.filter(m=>m.status==='Done').length;
  html+=`<div class="card"><h2>Appointments & follow-ups <small>${dn}/${S.medical.length} done</small></h2>
    ${items.length?`<div class="list">${items.map(m=>`<div class="it"><div class="grow" data-act="editMed" data-arg="${m.id}">
      <div style="${m.status==='Done'?'text-decoration:line-through;opacity:.6':''}">${esc(m.task)}</div>
      <div class="small muted">${m.due?'📅 '+fmtDY(m.due):esc(m.when||'')} ${m.priority?`<span class="tag ${m.priority.toLowerCase()}">${m.priority}</span>`:''}${m.doneDate?' · done '+fmtD(m.doneDate):''}</div></div>
      <button class="status ${STATUS[m.status]||'ns'}" data-act="cycleMed" data-arg="${m.id}">${m.status}</button></div>`).join('')}</div>`:'<div class="empty">No appointments yet.</div>'}
    <div style="height:10px"></div><button class="btn sec" data-act="editMed" data-arg="">＋ Add appointment / blood test reminder</button></div>`;
  const R=S.labs.results.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const ser=(n,c)=>({name:n.replace(' cholesterol',''),color:c,pts:R.filter(r=>r.values[n]!=null).map(r=>[r.date,r.values[n]])});
  html+=`<div class="card"><h2>Cholesterol <small>mg/dL</small></h2>${chart({series:[ser('LDL cholesterol','#ff6b6b'),ser('Total cholesterol','#ffb547'),ser('HDL cholesterol','#3ddc97')].filter(s=>s.pts.length)})}</div>`;
  html+=`<div class="card"><h2>Blood test results</h2>${R.length?`<div class="scroll-x"><table class="labs"><thead><tr><th>Marker</th>${R.map(r=>`<th data-act="editLab" data-arg="${r.id}">${esc(r.label||fmtD(r.date))} ✎</th>`).join('')}</tr></thead><tbody>
    ${S.labs.markers.filter(mk=>R.some(r=>r.values[mk.name]!=null)).map(mk=>`<tr><td>${esc(mk.name)}<div class="small muted">${esc(mk.unit||'')}</div></td>${R.map(r=>`<td>${r.values[mk.name]??'—'}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`:'<div class="empty">No results yet.</div>'}<div style="height:10px"></div><button class="btn sec" data-act="editLab" data-arg="">＋ Add new blood test results</button></div>`;
  if(S.notes&&S.notes.length) html+=`<div class="card"><h2>Notes</h2>${S.notes.map(n=>`<div class="note" style="margin-top:6px">${esc(n)}</div>`).join('')}</div>`;
  html+=`<div class="note">This app is a tracking aid, not a substitute for clinical advice.</div>`;
  return html;
}

function render(){
  $('#title').textContent=TITLES[tab];
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  $('#main').innerHTML={today:vToday,body:vBody,gym:vGym,food:vFood,health:vHealth}[tab]();
}

/* ---------- Actions ---------- */
const ACT={
  tab:a=>setTab(a),
  moreRem:()=>{showAllRem=!showAllRem;render();},
  day:a=>{const n=addDays(viewDate,+a);if(n<=today()){viewDate=n;render();}},
  mweek:a=>{mealWeek=addDays(mealWeek,+a);render();},
  setup:()=>{const s=num($('#wStart').value),t=num($('#wTarget').value);if(s==null||t==null){toast('Enter both weights');return;}S.settings.start=s;S.settings.target=t;save();render();},
  habit:k=>{const d=viewDate;S.habits[d]=S.habits[d]||{};S.habits[d][k]=!S.habits[d][k];save();render();},
  meal:a=>{const [d,k,v]=a.split('|');S.meals[d]=S.meals[d]||{};S.meals[d][k]=S.meals[d][k]===v?null:v;save();render();},
  session:s=>{const dr=S.gymDraft;if(dr&&dr.session!==s&&Object.values(dr.items).some(x=>x.done)&&!confirm('Switch session? Ticks on this session will be cleared.'))return;ensureDraft(s);render();},
  exDone:id=>{const v=S.gymDraft.items[id];v.done=!v.done;save();render();},
  finishGym:()=>{
    const dr=S.gymDraft, done=Object.values(dr.items).filter(x=>x.done).length;
    if(!done){toast('Mark at least one exercise done');return;}
    S.gymLog.push({id:uid(),date:dr.date,session:dr.session,items:Object.entries(dr.items).map(([id,v])=>({id,sets:num(v.sets),reps:num(v.reps),kg:num(v.kg),done:v.done}))});
    S.habits[dr.date]=S.habits[dr.date]||{};S.habits[dr.date].gym=true;
    S.gymDraft=null;save();toast('Session saved 💪');render();},
  delGym:id=>{if(!confirm('Delete this session from history?'))return;S.gymLog=S.gymLog.filter(g=>g.id!==id);save();render();},
  addReading:()=>readingSheet(null),
  editReading:id=>readingSheet(S.readings.find(r=>r.id===id)),
  editMed:id=>medSheet(id?S.medical.find(m=>m.id===id):null),
  cycleMed:id=>{const m=S.medical.find(x=>x.id===id);const o=['Not started','In progress','Done'];m.status=o[(o.indexOf(m.status)+1)%3];m.doneDate=m.status==='Done'?today():null;save();render();},
  editLab:id=>labSheet(id?S.labs.results.find(r=>r.id===id):null),
  editPlan:planSheet,
  backup:exportData,
  import:importData,
};
$('#main').addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  const f=ACT[el.dataset.act];if(f)f(el.dataset.arg);
});
$('#main').addEventListener('input',e=>{
  const el=e.target;if(!el.dataset.ex)return;
  S.gymDraft.items[el.dataset.ex][el.dataset.f]=el.value===''?null:num(el.value);save();
});

/* ---------- Sheets ---------- */
function readingSheet(r){
  const x=r||{date:today()};
  openSheet(`<h3>${r?'Edit reading':'Log reading'}</h3>
    <div class="field"><label>Date</label><input type="date" id="rDate" value="${x.date}"></div>
    <div class="field"><label>Weight (kg)</label><input type="number" inputmode="decimal" id="rW" value="${x.w??''}" placeholder="e.g. 118.4"></div>
    <div class="grid2"><div class="field"><label>Systolic (top)</label><input type="number" inputmode="numeric" id="rSys" value="${x.sys??''}" placeholder="120"></div>
    <div class="field"><label>Diastolic (bottom)</label><input type="number" inputmode="numeric" id="rDia" value="${x.dia??''}" placeholder="80"></div></div>
    <div class="grid2"><div class="field"><label>Pulse (bpm)</label><input type="number" inputmode="numeric" id="rPulse" value="${x.pulse??''}"></div>
    <div class="field"><label>Waist (cm)</label><input type="number" inputmode="decimal" id="rWaist" value="${x.waist??''}"></div></div>
    <div class="field"><label>Notes</label><input type="text" id="rNotes" value="${esc(x.notes||'')}"></div>
    <div class="btns"><button class="btn sec" id="cancel">Cancel</button><button class="btn" id="ok">Save</button></div>
    ${r?'<div style="height:8px"></div><button class="btn danger" id="del">Delete reading</button>':''}`,sh=>{
      sh.querySelector('#cancel').onclick=closeSheet;
      sh.querySelector('#ok').onclick=()=>{
        const o={id:x.id||uid(),date:sh.querySelector('#rDate').value||today(),w:num(sh.querySelector('#rW').value),sys:num(sh.querySelector('#rSys').value),
          dia:num(sh.querySelector('#rDia').value),pulse:num(sh.querySelector('#rPulse').value),waist:num(sh.querySelector('#rWaist').value),notes:sh.querySelector('#rNotes').value.trim()};
        if(o.w==null&&o.sys==null&&o.dia==null){toast('Enter weight or blood pressure');return;}
        if((o.sys==null)!==(o.dia==null)){toast('Enter both BP numbers');return;}
        S.readings=S.readings.filter(z=>z.id!==o.id);S.readings.push(o);save();closeSheet();toast('Saved');render();};
      const d=sh.querySelector('#del');if(d)d.onclick=()=>{if(!confirm('Delete this reading?'))return;S.readings=S.readings.filter(z=>z.id!==x.id);save();closeSheet();render();};
    });
}

function medSheet(m){
  const x=m||{task:'',when:'',due:'',priority:'High',status:'Not started',notes:''};
  openSheet(`<h3>${m?'Appointment / task':'New appointment / reminder'}</h3>
    <div class="field"><label>Task</label><textarea id="mTask" rows="2">${esc(x.task)}</textarea></div>
    <div class="grid2"><div class="field"><label>Date (for reminder)</label><input type="date" id="mDue" value="${x.due||''}"></div>
    <div class="field"><label>Priority</label><select id="mPri">${['High','Medium','Low'].map(p=>`<option ${p===x.priority?'selected':''}>${p}</option>`).join('')}</select></div></div>
    <div class="grid2"><div class="field"><label>Timeframe</label><input type="text" id="mWhen" value="${esc(x.when||'')}" placeholder="e.g. Nov–Dec 2026"></div>
    <div class="field"><label>Status</label><select id="mSt">${Object.keys(STATUS).map(p=>`<option ${p===x.status?'selected':''}>${p}</option>`).join('')}</select></div></div>
    <div class="field"><label>Notes</label><textarea id="mNotes" rows="2">${esc(x.notes||'')}</textarea></div>
    <div class="btns"><button class="btn sec" id="cancel">Cancel</button><button class="btn" id="ok">Save</button></div>
    ${m?`<div style="height:8px"></div><button class="btn blue" id="cal">📅 Add to phone calendar (with alerts)</button><div style="height:8px"></div><button class="btn danger" id="del">Delete</button>`:''}`,sh=>{
      const read=()=>({...x,id:x.id||uid(),task:sh.querySelector('#mTask').value.trim(),due:sh.querySelector('#mDue').value||null,priority:sh.querySelector('#mPri').value,
        when:sh.querySelector('#mWhen').value.trim(),status:sh.querySelector('#mSt').value,notes:sh.querySelector('#mNotes').value.trim()});
      sh.querySelector('#cancel').onclick=closeSheet;
      sh.querySelector('#ok').onclick=()=>{const o=read();if(!o.task){toast('Enter a task');return;}
        if(o.status==='Done'&&!o.doneDate)o.doneDate=today();if(o.status!=='Done')o.doneDate=null;
        const i=S.medical.findIndex(z=>z.id===o.id);if(i>=0)S.medical[i]=o;else S.medical.push(o);save();closeSheet();toast('Saved');render();};
      const c=sh.querySelector('#cal');if(c)c.onclick=()=>{const o=read();if(!o.due){toast('Set a date first');return;}addToCalendar(o);};
      const d=sh.querySelector('#del');if(d)d.onclick=()=>{if(!confirm('Delete this item?'))return;S.medical=S.medical.filter(z=>z.id!==x.id);save();closeSheet();render();};
    });
}

function labSheet(r){
  const x=r||{date:today(),label:'',values:{}};
  openSheet(`<h3>${r?'Edit results':'New blood test results'}</h3>
    <div class="grid2"><div class="field"><label>Test date</label><input type="date" id="lDate" value="${x.date}"></div>
    <div class="field"><label>Label (optional)</label><input type="text" id="lLabel" value="${esc(x.label||'')}" placeholder="e.g. Jan 2027"></div></div>
    ${S.labs.markers.map((mk,i)=>`<div class="field"><label>${esc(mk.name)} <span class="muted">(${esc(mk.unit||'')})</span></label><input type="number" inputmode="decimal" step="any" data-mk="${i}" value="${x.values[mk.name]??''}"></div>`).join('')}
    <div class="field"><label>Add another marker (name, unit)</label><div class="grid2"><input type="text" id="nmName" placeholder="Name"><input type="text" id="nmUnit" placeholder="Unit"></div></div>
    <div class="btns"><button class="btn sec" id="cancel">Cancel</button><button class="btn" id="ok">Save</button></div>
    ${r?'<div style="height:8px"></div><button class="btn danger" id="del">Delete these results</button>':''}`,sh=>{
      sh.querySelector('#cancel').onclick=closeSheet;
      sh.querySelector('#ok').onclick=()=>{
        const vals={};sh.querySelectorAll('[data-mk]').forEach(inp=>{const v=num(inp.value);if(v!=null)vals[S.labs.markers[+inp.dataset.mk].name]=v;});
        const nn=sh.querySelector('#nmName').value.trim();if(nn&&!S.labs.markers.some(m=>m.name===nn))S.labs.markers.push({name:nn,unit:sh.querySelector('#nmUnit').value.trim()});
        if(!Object.keys(vals).length&&!nn){toast('Enter at least one value');return;}
        const o={id:x.id||uid(),date:sh.querySelector('#lDate').value||today(),label:sh.querySelector('#lLabel').value.trim(),values:vals};
        S.labs.results=S.labs.results.filter(z=>z.id!==o.id);S.labs.results.push(o);save();closeSheet();toast('Results saved');render();};
      const d=sh.querySelector('#del');if(d)d.onclick=()=>{if(!confirm('Delete these results?'))return;S.labs.results=S.labs.results.filter(z=>z.id!==x.id);save();closeSheet();render();};
    });
}

function planSheet(){
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  openSheet(`<h3>7-day meal plan</h3>${days.map(d=>`<div class="card" style="background:var(--card2)"><b>${d}</b>
    ${['brunch','dinner','snack'].map(k=>`<div class="field" style="margin-top:6px"><label>${k}</label><input type="text" data-d="${d}" data-k="${k}" value="${esc((S.mealPlan[d]||{})[k]||'')}"></div>`).join('')}</div>`).join('')}
    <div class="btns"><button class="btn sec" id="reset">Reset to original</button><button class="btn" id="ok">Save plan</button></div>`,sh=>{
      sh.querySelector('#ok').onclick=()=>{sh.querySelectorAll('[data-d]').forEach(i=>{S.mealPlan[i.dataset.d]=S.mealPlan[i.dataset.d]||{};S.mealPlan[i.dataset.d][i.dataset.k]=i.value.trim();});save();closeSheet();toast('Plan saved');render();};
      sh.querySelector('#reset').onclick=()=>{if(!confirm('Reset the meal plan to the original?'))return;S.mealPlan=JSON.parse(JSON.stringify(DEFAULT_PLAN));save();closeSheet();render();};
    });
}

function openSettings(){
  openSheet(`<h3>Settings</h3>
    <div class="grid2"><div class="field"><label>Starting weight (kg)</label><input type="number" inputmode="decimal" id="sStart" value="${S.settings.start??''}"></div>
    <div class="field"><label>Target weight (kg)</label><input type="number" inputmode="decimal" id="sTarget" value="${S.settings.target??''}"></div></div>
    <button class="btn" id="ok">Save</button>
    <div class="note">Your data is stored only on this phone. Back it up now and then so you can restore it on a new phone.${S.lastBackup?`<br>Last backup: ${fmtDY(S.lastBackup.slice(0,10))}`:''}</div>
    <div style="height:10px"></div><div class="btns"><button class="btn sec" id="exp">💾 Back up</button><button class="btn sec" id="imp">📂 Restore / import</button></div>
    <div style="height:10px"></div><button class="btn sec" id="inst">📲 How to install on my phone</button>
    <div style="height:10px"></div><button class="btn danger" id="wipe">Erase all data</button>`,sh=>{
      sh.querySelector('#ok').onclick=()=>{S.settings.start=num(sh.querySelector('#sStart').value);S.settings.target=num(sh.querySelector('#sTarget').value);save();closeSheet();toast('Saved');render();};
      sh.querySelector('#exp').onclick=exportData;
      sh.querySelector('#imp').onclick=importData;
      sh.querySelector('#inst').onclick=installHelp;
      sh.querySelector('#wipe').onclick=()=>{if(!confirm('Erase ALL data on this phone? This cannot be undone.'))return;S=blank();save();closeSheet();render();};
    });
}

/* ---------- Files: backup, import, calendar ---------- */
async function shareOrDownload(name,type,text){
  const blob=new Blob([text],{type});
  try{
    const file=new File([blob],name,{type});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return true;}
  }catch(e){if(e&&e.name==='AbortError')return false;}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);return true;
}
async function exportData(){
  S.lastBackup=new Date().toISOString();save();
  const ok=await shareOrDownload(`health-backup-${today()}.json`,'application/json',JSON.stringify({app:'andre-health',exported:S.lastBackup,data:S},null,1));
  if(ok)toast('Backup created');render();
}
function importData(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
  inp.onchange=async()=>{
    const f=inp.files[0];if(!f)return;
    try{
      const j=JSON.parse(await f.text());
      if(j.app==='andre-health'&&j.data){
        if((S.readings.length||S.gymLog.length)&&!confirm('Replace all data on this phone with this backup?'))return;
        S=Object.assign(blank(),j.data);
      }else if(j.app==='andre-health-starter'){
        mergeStarter(j);
      }else throw new Error('bad');
      save();closeSheet();toast('Data loaded ✓');render();
    }catch(e){toast('That file could not be read');}
  };
  inp.click();
}
function mergeStarter(j){
  if(j.settings){S.settings.start=S.settings.start??j.settings.start;S.settings.target=S.settings.target??j.settings.target;}
  (j.medical||[]).forEach(m=>{if(!S.medical.some(x=>x.task===m.task))S.medical.push({id:uid(),status:'Not started',doneDate:null,notes:'',...m});});
  if(j.labs){
    (j.labs.markers||[]).forEach(mk=>{if(!S.labs.markers.some(x=>x.name===mk.name))S.labs.markers.push(mk);});
    // keep marker order from starter
    if(j.labs.markers){const order=j.labs.markers.map(m=>m.name);S.labs.markers.sort((a,b)=>{const ia=order.indexOf(a.name),ib=order.indexOf(b.name);return (ia<0?99:ia)-(ib<0?99:ib);});}
    (j.labs.results||[]).forEach(r=>{if(!S.labs.results.some(x=>x.date===r.date))S.labs.results.push({id:uid(),...r});});
  }
  (j.notes||[]).forEach(n=>{if(!S.notes.includes(n))S.notes.push(n);});
}
function addToCalendar(m){
  const d=m.due.replace(/-/g,''), stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const escI=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Andre Health//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:${m.id}@andre-health`,`DTSTAMP:${stamp}`,`DTSTART:${d}T090000`,`DTEND:${d}T093000`,
    `SUMMARY:${escI('🩺 '+m.task)}`,`DESCRIPTION:${escI((m.notes||'')+(m.when?' ('+m.when+')':''))}`,
    'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Health reminder','TRIGGER:-P1D','END:VALARM',
    'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Health reminder','TRIGGER:-PT1H','END:VALARM',
    'END:VEVENT','END:VCALENDAR'].join('\r\n');
  shareOrDownload('health-reminder.ics','text/calendar',ics);
}

/* ---------- Install prompt ---------- */
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let deferred=null;
function dismissedRecently(){try{const t=+localStorage.getItem('ah-install-dismiss')||0;return Date.now()-t<3*864e5;}catch(e){return false;}}
function showInstall(html){const b=$('#install');b.innerHTML=html;b.classList.remove('hidden');
  b.querySelector('[data-x]').onclick=()=>{b.classList.add('hidden');try{localStorage.setItem('ah-install-dismiss',Date.now());}catch(e){}};
  const go=b.querySelector('[data-go]');if(go)go.onclick=async()=>{if(!deferred){installHelp();return;}deferred.prompt();const r=await deferred.userChoice;deferred=null;b.classList.add('hidden');if(r.outcome==='accepted')toast('Installed 🎉');};}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferred=e;
  if(!isStandalone()&&!dismissedRecently()) showInstall(`<span style="font-size:26px">📲</span><div class="grow"><b>Install Health on your phone</b><span class="muted">Opens like an app, works offline</span></div><button class="btn sm" data-go>Install</button><button class="link" data-x style="color:var(--muted);font-size:20px">✕</button>`);
});
window.addEventListener('appinstalled',()=>{$('#install').classList.add('hidden');});
function installHelp(){
  openSheet(`<h3>Install on your phone</h3>
   <div class="card" style="background:var(--card2)"><b>iPhone (Safari)</b><ol class="small" style="padding-left:18px;margin:8px 0 0">
   <li>Open this website in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with arrow ⬆︎).</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol></div>
   <div class="card" style="background:var(--card2)"><b>Android (Chrome)</b><ol class="small" style="padding-left:18px;margin:8px 0 0">
   <li>Tap <b>Install</b> on the green banner, or</li><li>Tap the <b>⋮</b> menu → <b>Install app</b> / <b>Add to Home screen</b>.</li></ol></div>
   <button class="btn" id="ok">Got it</button>`,sh=>{sh.querySelector('#ok').onclick=closeSheet;});
}
if(!isStandalone()&&isIOS&&!dismissedRecently()){
  showInstall(`<span style="font-size:26px">📲</span><div class="grow"><b>Install this app</b><span class="muted">Tap Share ⬆︎ then “Add to Home Screen”</span></div><button class="btn sm" data-go>How</button><button class="link" data-x style="color:var(--muted);font-size:20px">✕</button>`);
}

/* ---------- Boot ---------- */
if('serviceWorker' in navigator && location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
let bootDay=today();
document.addEventListener('visibilitychange',()=>{if(!document.hidden){const t=today();if(viewDate===bootDay||viewDate>t)viewDate=t;bootDay=t;render();}});
render();
})();
