// Nucleate Technion · Newsletter & team desk. Talks to Firebase through firebase-backend.js.
(() => {
"use strict";
// ───────── constants ─────────
const TYPES = [
  ["event","Event","--t-event"],["funding","Funding / Grant","--t-funding"],["job","Job / Internship","--t-job"],
  ["research","Research news","--t-research"],["industry","Industry news","--t-industry"],["opportunity","Call for applications","--t-opportunity"],["tool","Tool / Resource","--t-tool"]
];
const TYPE = Object.fromEntries(TYPES.map(([k,l,c])=>[k,{label:l,color:`var(${c})`}]));
const MKINDS = [["meeting","Team meeting","--m-meeting"],["call","Call / partner meeting","--m-call"],["idea","Potential event","--m-idea"],["other","Other","--m-other"]];
const MKIND = Object.fromEntries(MKINDS.map(([k,l,c])=>[k,{label:l,color:`var(${c})`}]));
const STAGES = [["found","Found"],["shortlist","Shortlisted"],["writing","Writing"],["issue","In this issue"],["archived","Archived"]];
const STAGE = Object.fromEntries(STAGES);
const PSTAGES = [["idea","Idea"],["planning","Planning"],["confirmed","Confirmed"],["done","Done"]];
const PSTAGE = Object.fromEntries(PSTAGES);
const CKINDS = [["speaker","Speaker"],["sponsor","Sponsor"],["partner","Partner org"],["lab","Lab / faculty"],["company","Company"],["other","Other"]];
const CKIND = Object.fromEntries(CKINDS);
const DEFAULT_CHECK = ["Venue booked","Speaker / host confirmed","Poster designed","Registration link ready","Announced in the newsletter"];
const SECTIONS = [
  {key:"soon",title:"⏰ Coming up this week",types:null},
  {key:"events",title:"📅 Events",types:["event"]},
  {key:"opps",title:"💰 Opportunities",types:["funding","job","opportunity"]},
  {key:"science",title:"🧪 Science & industry",types:["research","industry"]},
  {key:"resources",title:"🧰 Resources",types:["tool"]},
];
const AUDIENCES = ["All","BSc","MSc / PhD","Postdocs"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const COLS = ["items","meetings","tasks","plans","contacts","sources","issues","activity","suggestions","users"];
const TRASHABLE = {items:"Newsletter item",meetings:"Calendar entry",tasks:"Task",plans:"Event plan",contacts:"Contact"};

// ───────── state ─────────
const now0 = new Date();
const S = {items:[],sources:[],activity:[],issues:[],meetings:[],tasks:[],plans:[],contacts:[],suggestions:[],settings:null,access:null,known:[],
  db:null,user:null,meId:null,myEmail:"",profiles:{},canWrite:true,purged:false,
  view:"home",f:{q:"",type:"",who:"",tag:""},cf:{q:"",kind:""},tf:"mine",drawer:null,confirmRemove:null,
  cal:{y:now0.getFullYear(),m:now0.getMonth(),sel:null}};
const $ = s => document.querySelector(s);
const A = k => S[k].filter(x=>!x.deleted);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => /^https?:\/\//i.test(u||"") ? u : "";
const normUrl = u => (u||"").trim().toLowerCase().replace(/^https?:\/\/(www\.)?/,"").replace(/[?#].*$/,"").replace(/\/+$/,"");
const host = u => { try { return new URL(u).hostname.replace(/^www\./,""); } catch { return ""; } };
const z2 = n => String(n).padStart(2,"0");
const ymd = d => `${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}`;
const today = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const todayS = () => ymd(today());
const parseD = s => { if(!s) return null; const d=new Date(s+"T00:00:00"); return isNaN(d)?null:d; };
const daysTo = s => { const d=parseD(s); return d? Math.round((d-today())/864e5) : null; };
const fmtD = s => { const d=parseD(s); return d? d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : ""; };
const fmtDW = s => { const d=parseD(s); return d? d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}) : ""; };
const ago = ms => { const m=Math.round((Date.now()-ms)/6e4); if(m<1)return"now"; if(m<60)return m+"m"; const h=Math.round(m/60); if(h<24)return h+"h"; const d=Math.round(h/24); return d<8? d+"d" : new Date(ms).toLocaleDateString("en-GB",{day:"numeric",month:"short"}); };
const agoPhrase = ms => { const a=ago(ms); return a==="now"?"just now":/^\d+[mhd]$/.test(a)? a+" ago" : "on "+a; };
const plural = (n,w,pl) => n+" "+(n===1?w:(pl||w+"s"));
const nextStage = s => { const ix=STAGES.findIndex(x=>x[0]===(s||"found")); return ix>=0&&ix<STAGES.length-1? STAGES[ix+1][0] : null; };
const weekStart = (t=Date.now()) => { const d=new Date(t); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d.getTime(); };
const settings = () => Object.assign({name:"Nucleate Technion Weekly",footer:"Forward to a friend who'd want this 🙌",nextIssue:1,draftIntro:"",owners:{}}, S.settings||{});
const nameOf = id => { if(!id) return "Someone"; const p=S.profiles[id]; return (p&&p.name) || (id===S.meId ? "You" : "Teammate"); };
const firstName = id => nameOf(id).split(" ")[0];
const avOf = id => (S.profiles[id]&&S.profiles[id].avatarUrl) || "";
const avImg = id => avOf(id) ? `<img class="av" src="${esc(avOf(id))}" alt="" referrerpolicy="no-referrer">` : "";
const people = () => { const s=new Set(); if(S.meId) s.add(S.meId); S.known.forEach(id=>s.add(id)); S.items.forEach(i=>{i.addedBy&&s.add(i.addedBy); i.owner&&s.add(i.owner);}); return [...s]; };
const peopleOpts = (sel, blank) => (blank?`<option value="">${esc(blank)}</option>`:"")+people().map(id=>`<option value="${esc(id)}" ${sel===id?"selected":""}>${esc(nameOf(id))}${id===S.meId?" (you)":""}</option>`).join("");
const upvotes = it => Object.values(it.votes||{}).filter(v=>v===1).length;
const downvotes = it => Object.values(it.votes||{}).filter(v=>v===-1).length;
const tcol = t => (TYPE[t]||{color:"var(--t-industry)"}).color;
const tlabel = t => (TYPE[t]||{label:t||"Item"}).label;
const ownerEmail = () => (window.__ownerEmail||"").toLowerCase();
const accessList = k => ((S.access&&S.access[k])||[]).map(e=>String(e).toLowerCase());
const isAdmin = () => !!S.myEmail && (S.myEmail===ownerEmail() || accessList("admins").includes(S.myEmail));
const roleOf = email => email===ownerEmail()? "Owner" : accessList("admins").includes(email)? "Admin" : accessList("members").includes(email)? "Member" : "";
const canEditItem = it => S.canWrite && (!it || isAdmin() || it.addedBy===S.meId);
const canEditMeet = mt => S.canWrite && (!mt || isAdmin() || mt.createdBy===S.meId);
const canEditTask = t => S.canWrite && (!t || isAdmin() || t.createdBy===S.meId);
const canEditPlan = p => S.canWrite && (!p || isAdmin() || p.createdBy===S.meId || p.lead===S.meId);
const canEditContact = c => S.canWrite && (!c || isAdmin() || c.createdBy===S.meId || c.owner===S.meId);
const titleOf = (col,x) => x.title || x.name || "Untitled";
const titleCase = s => s.charAt(0).toUpperCase()+s.slice(1);

let toastT; function toast(msg, action){ $("#layer").querySelector(".toast")?.remove(); const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  if(action){ const b=document.createElement("button"); b.textContent=action.label; b.onclick=()=>{ t.remove(); action.fn(); }; t.append(b); }
  $("#layer").append(t); clearTimeout(toastT); toastT=setTimeout(()=>t.remove(), action?6000:2600); }
function gcalUrl({title,date,time,endTime,location,details}){
  const p=new URLSearchParams({action:"TEMPLATE",text:title||"Event"}); const d=(date||"").replace(/-/g,"");
  if(time){ const st=d+"T"+time.replace(":","")+"00"; let et;
    if(endTime) et=d+"T"+endTime.replace(":","")+"00"; else { const [h,m]=time.split(":").map(Number); const e=new Date(2000,0,1,h+1,m); et=d+"T"+z2(e.getHours())+z2(e.getMinutes())+"00"; }
    p.set("dates",st+"/"+et); p.set("ctz","Asia/Jerusalem"); }
  else { const nd=parseD(date); nd.setDate(nd.getDate()+1); p.set("dates",d+"/"+ymd(nd).replace(/-/g,"")); }
  if(location) p.set("location",location); if(details) p.set("details",details);
  return "https://calendar.google.com/calendar/render?"+p.toString();
}
function downloadFile(name, text, type){ const blob=new Blob([text],{type}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000); }

// ───────── writes ─────────
const stamp = () => ({updatedAt:Date.now(),updatedBy:S.meId});
async function logAct(verb, title, itemId){ if(!S.db||!S.meId) return; try{ await S.db.collection("activity").add({by:S.meId,verb,title:String(title||"").slice(0,140),itemId:itemId||null,at:Date.now()}); }catch(e){} }
function writeErr(e){ if(e&&e.code==="quota_exceeded") toast("Storage is full. Empty the Trash or delete old items."); else if(e&&e.code==="invalid_argument") toast("You don't have permission to do that. Ask an admin."); else toast("Couldn't save. Check your connection and try again."); }
async function upd(col,id,data){ try{ await S.db.collection(col).doc(id).update(data); return true; }catch(e){ writeErr(e); return false; } }
async function add(col,data){ try{ const r=await S.db.collection(col).add(data); return r.id; }catch(e){ writeErr(e); return null; } }
async function saveItem(id, data, isNew){ try{ const ref=S.db.collection("items").doc(id||undefined); if(isNew) await ref.set(data); else await ref.update(data); return ref.id; }catch(e){ writeErr(e); throw e; } }
async function saveSettings(patch){ const ref=S.db.doc("meta/settings"); try{ if(S.settings) await ref.update(patch); else await ref.set(Object.assign(settings(),patch)); }catch(e){ writeErr(e); } }
async function trash(col,id){ const x=S[col].find(d=>d.id===id); if(!x) return; const t=titleOf(col,x);
  if(await upd(col,id,{deleted:true,deletedAt:Date.now(),deletedBy:S.meId,...stamp()})){ logAct("moved to Trash:",t); closeDrawer(); toast("Moved to Trash.",{label:"Undo",fn:()=>restore(col,id)}); } }
async function restore(col,id){ const x=S[col].find(d=>d.id===id); if(await upd(col,id,{deleted:false,deletedAt:null,deletedBy:null,...stamp()})){ logAct("restored",x?titleOf(col,x):""); toast("Restored."); } }
async function purgeOld(){ if(S.purged||!isAdmin()) return; S.purged=true; const cut=Date.now()-30*864e5;
  for(const col of Object.keys(TRASHABLE)) for(const x of S[col]) if(x.deleted&&x.deletedAt&&x.deletedAt<cut){ try{ await S.db.collection(col).doc(x.id).delete(); }catch{} } }

const whenExists = (col,id) => new Promise(res=>{ let n=0; const tick=()=>{ if(S[col].some(x=>x.id===id)||++n>40) return res(); setTimeout(tick,50); }; tick(); });
// ───────── render loop ─────────
let raf=0; function render(){ cancelAnimationFrame(raf); raf=requestAnimationFrame(doRender); }
function views(){ const v=[["home","Home"],["board","Pipeline"],["issue","This issue"],["calendar","Calendar"],["tasks","Tasks"],["events","Our events"],["contacts","Contacts"],["sources","Sources"],["places","Places"],["team","Team"],["archive","Archive"]];
  if(A("suggestions").length) v.splice(1,0,["inbox","Suggestions"]); return v; }
function doRender(){
  $("#who").innerHTML = S.meId ? avImg(S.meId)+`<span>${esc(nameOf(S.meId))}</span>${S.myEmail&&roleOf(S.myEmail)?`<span class="chip" style="background:rgba(255,255,255,.1);color:var(--band-ink)">${esc(roleOf(S.myEmail))}</span>`:""}` : "";
  $("#btnNew").hidden = !S.canWrite || !S.db; $("#btnSettings").hidden = !S.db;
  const myOpen=A("tasks").filter(t=>!t.done&&t.assignee===S.meId).length;
  const counts = {board:A("items").filter(i=>i.status!=="archived").length, calendar:upcoming(30).length, places:A("items").filter(i=>i.status!=="archived"&&i.location).length, issue:A("items").filter(i=>i.status==="issue").length,
    sources:S.sources.length, archive:S.issues.length, tasks:myOpen, events:A("plans").filter(p=>p.stage!=="done").length, contacts:A("contacts").length, inbox:A("suggestions").length};
  $("#tabs").innerHTML = S.db ? views().map(([k,l])=>`<a href="#${k}" ${S.view===k?'aria-current="page"':""}>${l}${counts[k]?`<span class="n">${counts[k]}</span>`:""}</a>`).join("") : "";
  const m=$("#main");
  if(!S.db){ m.innerHTML = window.__authScreen ? window.__authScreen() : `<div class="empty"><b>Opening the desk…</b></div>`; window.__mountDNA&&window.__mountDNA(); return; }
  const banner = S.canWrite ? "" : `<div class="banner">Your account can't save changes. Ask an admin to add you on the Team page.</div>`;
  const v = {home:vHome,inbox:vInbox,board:vBoard,calendar:vCalendar,tasks:vTasks,events:vEvents,contacts:vContacts,places:vPlaces,issue:vIssue,sources:vSources,team:vTeam,archive:vArchive,trash:vTrash}[S.view]||vHome;
  const y=window.scrollY; const ae=document.activeElement; const keepId=ae&&ae.id&&m.contains(ae)&&/^(quickUrl|cq|tTitle|accEmail)$/.test(ae.id)?ae.id:null; const keepVal=keepId?ae.value:null;
  m.innerHTML = banner + v(); window.scrollTo(0,y);
  if(keepId&&$("#"+keepId)){ const el=$("#"+keepId); el.value=keepVal; el.focus(); try{ el.setSelectionRange(keepVal.length,keepVal.length); }catch{} }
  window.__mountDNA&&window.__mountDNA();
  renderDrawer(); refreshProfiles(); purgeOld();
}
let profT=0; function refreshProfiles(){
  if(!S.user) return; const ids=people().filter(id=>!S.profiles[id]); if(!ids.length) return;
  clearTimeout(profT); profT=setTimeout(async()=>{ try{ const ps=await S.user.profiles(ids); let ch=false; for(const id in ps){ if(!S.profiles[id]||S.profiles[id].name!==ps[id].name){S.profiles[id]=ps[id]; ch=true;} } if(ch) render(); }catch{} },50);
}

// ───────── calendar data ─────────
const PLAN_COLOR="var(--m-plan)";
function entries(){
  const out=[];
  A("items").forEach(i=>{ if(i.date) out.push({kind:"item",id:i.id,date:i.date,time:"",title:i.title,sub:[tlabel(i.type),i.location].filter(Boolean).join(" · "),color:tcol(i.type),archived:i.status==="archived",loc:i.location,url:i.url}); });
  A("meetings").forEach(mt=>{ if(mt.date) out.push({kind:"meeting",id:mt.id,date:mt.date,time:mt.time||"",endTime:mt.endTime||"",title:mt.title,sub:[MKIND[mt.kind]?.label||"Meeting",mt.time?mt.time+(mt.endTime?"–"+mt.endTime:""):"",mt.location].filter(Boolean).join(" · "),color:(MKIND[mt.kind]||MKIND.other).color,loc:mt.location,notes:mt.agenda||mt.notes}); });
  A("plans").forEach(p=>{ if(p.date) out.push({kind:"plan",id:p.id,date:p.date,time:p.time||"",title:p.title,sub:["Our event · "+(PSTAGE[p.stage]||"Idea"),p.time,p.location].filter(Boolean).join(" · "),color:PLAN_COLOR,loc:p.location}); });
  return out.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.time||"99")<(b.time||"99")?-1:1);
}
function upcoming(days){ const t=todayS(); const e=new Date(today()); e.setDate(e.getDate()+days); const end=ymd(e); return entries().filter(x=>!x.archived&&x.date>=t&&x.date<=end); }
const entryAttr = x => x.kind==="item"?`data-open="${esc(x.id)}"`:x.kind==="plan"?`data-plan="${esc(x.id)}"`:`data-meet="${esc(x.id)}"`;
function agendaRow(x){ const d=parseD(x.date); return `<div class="ag" ${entryAttr(x)} style="--tc:${x.color}" role="button" tabindex="0"><span class="bar"></span><div class="dt"><div class="d">${d.getDate()}</div><div class="m">${d.toLocaleDateString("en-GB",{month:"short"})}</div></div><div class="bd"><div class="t" dir="auto">${esc(x.title)}</div><div class="s" dir="auto">${esc(DOW[d.getDay()])} · ${esc(x.sub)}</div></div></div>`; }
function icsExport(){
  const e=entries().filter(x=>!x.archived); const stampNow=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  const fold=s=>String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Nucleate Technion//Desk//EN","CALSCALE:GREGORIAN","X-WR-CALNAME:Nucleate Technion"];
  e.forEach(x=>{ const d=x.date.replace(/-/g,""); lines.push("BEGIN:VEVENT",`UID:${x.kind}-${x.id}@nucleate-technion`,`DTSTAMP:${stampNow}`);
    if(x.time){ const st=d+"T"+x.time.replace(":","")+"00"; let et=x.endTime? d+"T"+x.endTime.replace(":","")+"00" : null; if(!et){ const [h,m]=x.time.split(":").map(Number); const t=new Date(2000,0,1,h+1,m); et=d+"T"+z2(t.getHours())+z2(t.getMinutes())+"00"; }
      lines.push(`DTSTART;TZID=Asia/Jerusalem:${st}`,`DTEND;TZID=Asia/Jerusalem:${et}`); }
    else { const n=parseD(x.date); n.setDate(n.getDate()+1); lines.push(`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${ymd(n).replace(/-/g,"")}`); }
    lines.push(`SUMMARY:${fold(x.title)}`); if(x.loc) lines.push(`LOCATION:${fold(x.loc)}`); if(x.url||x.notes) lines.push(`DESCRIPTION:${fold([x.notes,x.url].filter(Boolean).join("\n"))}`); lines.push("END:VEVENT"); });
  lines.push("END:VCALENDAR"); downloadFile("nucleate-technion-calendar.ics", lines.join("\r\n"), "text/calendar"); toast(`Downloaded ${plural(e.length,"entry","entries")}. Open the file to import it.`);
}

// ───────── shared bits ─────────
function filterBar(){
  const tags=[...new Set(A("items").flatMap(i=>i.tags||[]))].sort();
  return `<div class="toolbar">
    <input type="search" id="fq" placeholder="Search titles, places, tags…" value="${esc(S.f.q)}" aria-label="Search">
    <button class="btn ${S.f.who===S.meId?"pri":""}" data-act="mine" aria-pressed="${S.f.who===S.meId}">Only mine</button>
    <select id="ftype" aria-label="Type"><option value="">All types</option>${TYPES.map(([k,l])=>`<option value="${k}" ${S.f.type===k?"selected":""}>${l}</option>`).join("")}</select>
    <select id="fwho" aria-label="Person"><option value="">Everyone</option>${people().map(id=>`<option value="${esc(id)}" ${S.f.who===id?"selected":""}>${esc(nameOf(id))}</option>`).join("")}</select>
    ${tags.length?`<select id="ftag" aria-label="Tag"><option value="">All tags</option>${tags.map(t=>`<option ${S.f.tag===t?"selected":""}>${esc(t)}</option>`).join("")}</select>`:""}
  </div>`;
}
function filtered(list){ const {q,type,who,tag}=S.f; const ql=q.trim().toLowerCase();
  return list.filter(i=>(!type||i.type===type)&&(!who||i.addedBy===who||i.owner===who)&&(!tag||(i.tags||[]).includes(tag))&&(!ql||[i.title,i.summary,i.location,i.city,i.url,(i.tags||[]).join(" ")].join(" ").toLowerCase().includes(ql))); }
function dateChip(i){
  if(i.date){ const d=daysTo(i.date); const cls=d<0?"":d<=2?"hot":d<=7?"soon":""; return `<span class="chip ${cls}">🗓 ${d===0?"Today":d===1?"Tomorrow":fmtD(i.date)}${d<0?" · past":""}</span>`; }
  if(i.deadline){ const d=daysTo(i.deadline); if(d>=0) return `<span class="chip ${d<=3?"hot":d<=7?"soon":""}">⏳ ${d===0?"today":d+"d left"}</span>`; }
  return "";
}
function dueChip(due, done){ if(!due) return ""; const d=daysTo(due); const cls=done?"":d<0?"hot":d<=2?"soon":""; return `<span class="chip ${cls}">${d<0&&!done?"Overdue · ":""}${d===0?"Today":d===1?"Tomorrow":fmtD(due)}</span>`; }
function actRow(a){ return `<div class="ev-row">${avImg(a.by)}<div class="txt"><b>${esc(nameOf(a.by))}</b> ${esc(a.verb)} ${a.itemId&&A("items").some(i=>i.id===a.itemId)?`<a href="#" data-open="${esc(a.itemId)}" dir="auto">${esc(a.title)}</a>`:`<span dir="auto">${esc(a.title)}</span>`}</div><span class="when">${ago(a.at)}</span></div>`; }

// tasks
function taskRow(t, ctx){
  const link = !ctx && t.meetingId ? (()=>{ const m=S.meetings.find(x=>x.id===t.meetingId); return m?`<a href="#" data-meet="${esc(m.id)}" class="hint">📅 ${esc(m.title)}</a>`:""; })()
             : !ctx && t.planId ? (()=>{ const p=S.plans.find(x=>x.id===t.planId); return p?`<a href="#" data-plan="${esc(p.id)}" class="hint">🎪 ${esc(p.title)}</a>`:""; })() : "";
  return `<div class="task ${t.done?"done":""}"><input type="checkbox" data-done="${esc(t.id)}" ${t.done?"checked":""} ${S.canWrite?"":"disabled"} aria-label="Done"><div class="grow"><a href="#" class="t" data-task="${esc(t.id)}" dir="auto">${esc(t.title)}</a><div class="meta">${t.assignee?`${avImg(t.assignee)}<span>${esc(firstName(t.assignee))}</span>`:`<span>Unassigned</span>`}${dueChip(t.due,t.done)}${link}</div></div></div>`;
}
function taskAddForm(ctxAttr){ return S.canWrite? `<form class="taskAdd" ${ctxAttr||""}><input name="title" placeholder="Add a task…" aria-label="Task" dir="auto" ${ctxAttr?"":'id="tTitle"'}><select name="assignee" aria-label="Assign to">${peopleOpts(S.meId,"Unassigned")}</select><input name="due" type="date" aria-label="Due date"><button class="btn" type="submit">Add</button></form>` : ""; }
async function addTask(form){ const f=new FormData(form); const title=String(f.get("title")||"").trim(); if(!title){ toast("Write the task first."); return; }
  const data={title,assignee:String(f.get("assignee")||""),due:String(f.get("due")||""),done:false,notes:"",meetingId:form.dataset.meeting||"",planId:form.dataset.plan||"",createdBy:S.meId,createdAt:Date.now(),...stamp()};
  const id=await add("tasks",data); if(id){ form.reset(); const a=form.querySelector('[name=assignee]'); if(a) a.value=S.meId; logAct(data.assignee&&data.assignee!==S.meId?`gave ${firstName(data.assignee)} a task:`:"added a task:",title); toast("Task added."); } }
async function toggleTask(id){ const t=S.tasks.find(x=>x.id===id); if(!t) return; const done=!t.done; if(await upd("tasks",id,{done,doneAt:done?Date.now():null,doneBy:done?S.meId:null,...stamp()})&&done) logAct("finished",t.title); }

// mentions
function mentionsIn(text){ const out=[]; people().forEach(id=>{ const n=nameOf(id); if(!n||n==="Teammate"||n==="You") return; const first=n.split(" ")[0]; if(text.includes("@"+n)||new RegExp("@"+first.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(\\b|$)").test(text)) out.push(id); }); return [...new Set(out)]; }
function mentionChips(target){ return `<div class="mention-row"><span class="hint">Mention:</span>${people().filter(id=>id!==S.meId).map(id=>`<button type="button" class="chip mchip" data-mention="${esc(id)}" data-target="${target}">@${esc(firstName(id))}</button>`).join("")||`<span class="hint">no teammates yet</span>`}</div>`; }
function forYou(){
  const out=[]; const since=Date.now()-14*864e5;
  A("items").forEach(i=>Object.values(i.comments||{}).forEach(c=>{ if(c.at>since&&c.by!==S.meId&&(c.mentions||[]).includes(S.meId)) out.push({at:c.at,html:`${avImg(c.by)}<div class="txt"><b>${esc(firstName(c.by))}</b> mentioned you on <a href="#" data-open="${esc(i.id)}" dir="auto">${esc(i.title)}</a><div class="hint" dir="auto">“${esc(c.text.slice(0,120))}”</div></div>`}); }));
  A("meetings").forEach(m=>{ const d=daysTo(m.date); if(d!==null&&d>=0&&d<=7&&!(m.rsvp||{})[S.meId]) out.push({at:Date.now()-d*1000,html:`<span class="dot" style="color:${(MKIND[m.kind]||MKIND.other).color};margin:8px"></span><div class="txt">Are you coming to <a href="#" data-meet="${esc(m.id)}" dir="auto">${esc(m.title)}</a>? <span class="hint">${esc(fmtDW(m.date))}${m.time?" "+esc(m.time):""}</span></div>`}); });
  return out.sort((a,b)=>b.at-a.at);
}

// ───────── views ─────────
function vHome(){
  const st=settings(); const inIssue=A("items").filter(i=>i.status==="issue").length;
  const up=upcoming(14); const nextMeet=entries().find(x=>x.kind==="meeting"&&x.date>=todayS());
  const myTasks=A("tasks").filter(t=>!t.done&&t.assignee===S.meId).sort((a,b)=>(a.due||"9")<(b.due||"9")?-1:1);
  const sugg=A("suggestions"); const fy=forYou(); const hello=S.meId? firstName(S.meId) : "";
  return `<section class="hero"><canvas class="dna" aria-hidden="true"></canvas><div class="hx">
      <div class="kicker">ISSUE #${st.nextIssue} · IN PROGRESS</div>
      <h1>Nucleate <span class="dash">–</span> Technion Branch</h1>
      <p>${hello?`Hi ${esc(hello)}. `:""}Collect what's happening in biotech around campus, plan our events, and send the weekly digest to the group.</p>
      <div class="acts">${S.canWrite?`<button class="btn pri" data-act="new">+ Add item</button><button class="btn" data-act="new-meeting">+ Meeting</button><button class="btn" data-act="new-plan">+ Event idea</button>`:""}<a class="btn" href="#issue">Open this issue</a></div>
    </div></section>
    <div class="tiles">
      <a class="tile" href="#tasks"><span class="v">${myTasks.length}</span><span class="l">${myTasks.length===1?"open task for you":"open tasks for you"}</span></a>
      <a class="tile" href="#issue"><span class="v">${inIssue}</span><span class="l">in this issue</span></a>
      <a class="tile" href="#calendar"><span class="v small" dir="auto">${nextMeet?esc(nextMeet.title):"—"}</span><span class="l">${nextMeet?`next meeting · ${esc(fmtDW(nextMeet.date))}${nextMeet.time?" "+esc(nextMeet.time):""}`:"no meetings scheduled"}</span></a>
      <a class="tile" href="${sugg.length?"#inbox":"#events"}"><span class="v">${sugg.length||A("plans").filter(p=>p.stage!=="done").length}</span><span class="l">${sugg.length?(sugg.length===1?"suggestion from students":"suggestions from students"):"events we're planning"}</span></a>
    </div>
    <div class="home-grid">
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <div class="panel"><div class="panel-h"><h3>For you</h3><a href="#tasks" class="hint">All tasks →</a></div>
          ${myTasks.length?`<div class="tasks">${myTasks.slice(0,5).map(t=>taskRow(t)).join("")}</div>`:""}
          ${fy.length?`<div class="feed" style="${myTasks.length?"margin-top:8px;border-top:1px solid var(--line);padding-top:4px":""}">${fy.slice(0,6).map(x=>`<div class="ev-row">${x.html}</div>`).join("")}</div>`:""}
          ${!myTasks.length&&!fy.length?`<div class="colempty">You're all caught up. Tasks assigned to you, @mentions and meetings to RSVP show up here.</div>`:""}</div>
        <div class="panel"><div class="panel-h"><h3>Coming up</h3><a href="#calendar" class="hint">Full calendar →</a></div>
          ${up.length?`<div class="agenda">${up.slice(0,7).map(agendaRow).join("")}</div>`:`<div class="colempty">Nothing dated in the next two weeks.</div>`}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        ${S.canWrite?`<form class="panel" id="quickForm"><div class="panel-h"><h3>Quick add</h3><span class="hint">${A("items").filter(i=>(i.status||"found")==="found").length} waiting in Found</span></div>
          <div class="quick"><input id="quickUrl" type="url" placeholder="Paste a link…" aria-label="Link"><button class="btn pri" type="submit">Add</button></div>
          <div class="hint" style="margin-top:6px">The title fills in from the page when possible.</div></form>`:""}
        ${sugg.length?`<div class="panel"><div class="panel-h"><h3>From students</h3><a href="#inbox" class="hint">Review ${sugg.length} →</a></div>${sugg.slice(0,3).map(suggRow).join("")}</div>`:""}
        <div class="panel"><div class="panel-h"><h3>Latest activity</h3><a href="#team" class="hint">Team →</a></div>
          ${S.activity.length?`<div class="feed">${S.activity.slice(0,6).map(actRow).join("")}</div>`:`<div class="colempty">Nothing yet.</div>`}</div>
      </div>
    </div>`;
}
function suggRow(s){ return `<div class="row" style="margin-bottom:8px"><div class="grow"><div class="t" dir="auto">${esc(s.title)}</div><div class="s" dir="auto">${[s.date?fmtDW(s.date):"",s.location,s.name?"from "+s.name:"",host(s.url)].filter(Boolean).map(esc).join(" · ")}</div>${s.note?`<div class="s" dir="auto">“${esc(s.note)}”</div>`:""}</div>
  ${S.canWrite?`<button class="btn sm pri" data-sugg-ok="${esc(s.id)}">Add to desk</button><button class="btn sm ghost danger" data-sugg-no="${esc(s.id)}">Dismiss</button>`:""}</div>`; }
function vInbox(){ const s=A("suggestions").sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return `<h2>Suggestions from students</h2><p class="sub">Sent through the public page. "Add to desk" puts it in Found on the pipeline; nothing is published until your team decides.</p>${s.length?s.map(suggRow).join(""):`<div class="empty"><b>Inbox zero</b>New suggestions from the public page land here.</div>`}`; }

function card(i){
  const my=(i.votes||{})[S.meId]; const cc=Object.keys(i.comments||{}).length; const ns=nextStage(i.status);
  return `<div class="card" data-open="${esc(i.id)}" draggable="${S.canWrite}" data-id="${esc(i.id)}" style="--tc:${tcol(i.type)}">
    <div class="meta"><span class="chip type" style="--tc:${tcol(i.type)}"><span class="dot"></span>${esc(tlabel(i.type))}</span>${dateChip(i)}${i.recurring&&i.recurring!=="none"?`<span class="chip">↻ ${esc(i.recurring)}</span>`:""}</div>
    <div class="t" dir="auto">${esc(i.title||"Untitled")}</div>
    ${i.location?`<div class="meta" dir="auto">📍 ${esc(i.location)}</div>`:""}
    <div class="foot"><div class="meta">${avImg(i.addedBy)}${i.owner&&i.owner!==i.addedBy?" ✎ "+avImg(i.owner):""}<span>${esc(host(i.url))}</span>${cc?`<span>💬 ${cc}</span>`:""}</div>
      <div class="votes">${S.canWrite&&ns&&(ns!=="archived"||canEditItem(i))?`<button data-next="${esc(i.id)}" title="Move to ${esc(STAGE[ns])}" aria-label="Move to ${esc(STAGE[ns])}">→</button>`:""}<button data-vote="1" data-id="${esc(i.id)}" class="${my===1?"on":""}" aria-label="Upvote">👍 ${upvotes(i)||""}</button><button data-vote="-1" data-id="${esc(i.id)}" class="${my===-1?"on":""}" aria-label="Downvote">👎 ${downvotes(i)||""}</button></div>
    </div></div>`;
}
function vBoard(){
  const head=`<h2>Pipeline</h2><p class="sub">Every find moves left to right until it lands in the issue. Two 👍 moves an item straight into this issue.</p>`;
  if(!A("items").length) return head+`<div class="empty"><b>Nothing on the desk yet</b>Add the first thing you found this week.<br><br>${S.canWrite?`<button class="btn pri" data-act="new">+ Add item</button>`:""}</div>`;
  const list=filtered(A("items"));
  const sorted = a => a.slice().sort((x,y)=>(upvotes(y)-downvotes(y))-(upvotes(x)-downvotes(x)) || (y.createdAt||0)-(x.createdAt||0));
  return head+filterBar()+`<div class="board">${STAGES.map(([k,l])=>{ const cs=sorted(list.filter(i=>(i.status||"found")===k)); const shown=k==="archived"?cs.slice(0,12):cs;
    return `<section class="col" data-stage="${k}"><div class="col-h"><h3>${l}</h3><span class="c">${cs.length}</span></div>${shown.map(card).join("")||`<div class="colempty">${k==="found"?"New finds land here.":"Drop cards here."}</div>`}${k==="archived"&&cs.length>12?`<div class="colempty">+${cs.length-12} older</div>`:""}</section>`;}).join("")}</div>`;
}

function vCalendar(){
  const {y,m}=S.cal; const first=new Date(y,m,1); const start=new Date(first); start.setDate(1-first.getDay());
  const byDate={}; entries().forEach(x=>{ (byDate[x.date]=byDate[x.date]||[]).push(x); });
  const t=todayS(); const sel=S.cal.sel;
  let cells=""; for(let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i); if(i===35&&d.getMonth()!==m) break; const k=ymd(d); const es=byDate[k]||[];
    cells+=`<button class="day ${d.getMonth()!==m?"out":""} ${k===t?"today":""} ${k===sel?"sel":""}" data-day="${k}" aria-label="${esc(d.toDateString())}${es.length?", "+plural(es.length,"entry","entries"):""}"><span class="num">${d.getDate()}</span>
      ${es.slice(0,3).map(x=>`<span class="ev" style="--tc:${x.color}" dir="auto">${x.time?esc(x.time)+" ":""}${esc(x.title)}</span>`).join("")}${es.length>3?`<span class="more">+${es.length-3} more</span>`:""}
      ${es.length?`<span class="dots">${es.slice(0,4).map(x=>`<span class="dot" style="--tc:${x.color}"></span>`).join("")}</span>`:""}</button>`; }
  const monthName=first.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  const selList = sel ? (byDate[sel]||[]) : null;
  const dayPanel = sel ? `<div class="panel daypanel"><div class="panel-h"><h3>${esc(fmtDW(sel))}</h3>${S.canWrite?`<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="new-meeting" data-date="${sel}">+ Meeting</button><button class="btn sm" data-act="new-plan" data-date="${sel}">+ Our event</button><button class="btn sm" data-act="new" data-date="${sel}">+ Newsletter item</button></div>`:""}</div>
      ${selList.length?`<div class="agenda">${selList.map(agendaRow).join("")}</div>`:`<div class="colempty">Nothing on this day.</div>`}</div>` : "";
  const up=upcoming(30);
  return `<h2>Calendar</h2><p class="sub">Newsletter events, our own events, meetings and calls in one place. Click a day to add something on it.</p>
    <div class="cal-h"><button class="btn sm" data-cal="-1" aria-label="Previous month">←</button><h3>${esc(monthName)}</h3><button class="btn sm" data-cal="1" aria-label="Next month">→</button><button class="btn sm ghost" data-cal="0">Today</button>
      <button class="btn sm" data-act="ics" title="Download all entries as a calendar file">⤓ Calendar file</button>
      <div class="legend"><span><span class="dot" style="color:var(--t-event)"></span>Newsletter</span><span><span class="dot" style="color:var(--m-plan)"></span>Our events</span>${MKINDS.slice(0,3).map(([k,l,c])=>`<span><span class="dot" style="color:var(${c})"></span>${l}</span>`).join("")}</div></div>
    <div class="cal">${DOW.map(d=>`<div class="dow">${d}</div>`).join("")}${cells}</div>
    ${dayPanel}
    <div class="panel daypanel"><div class="panel-h"><h3>Next 30 days</h3>${S.canWrite?`<button class="btn sm" data-act="new-meeting">+ Add meeting</button>`:""}</div>
      ${up.length?`<div class="agenda">${up.map(agendaRow).join("")}</div>`:`<div class="colempty">Nothing scheduled yet.</div>`}</div>`;
}

function vTasks(){
  const all=A("tasks"); const f=S.tf;
  const sortT=a=>a.slice().sort((x,y)=>(x.due||"9999")<(y.due||"9999")?-1:(x.due||"9999")>(y.due||"9999")?1:(x.createdAt||0)-(y.createdAt||0));
  const open=all.filter(t=>!t.done); const done=all.filter(t=>t.done).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
  let body="";
  if(f==="mine"){ const mine=sortT(open.filter(t=>t.assignee===S.meId)); const gave=sortT(open.filter(t=>t.createdBy===S.meId&&t.assignee&&t.assignee!==S.meId));
    body=`<div class="panel"><div class="panel-h"><h3>Assigned to me</h3><span class="hint">${mine.length}</span></div>${mine.length?`<div class="tasks">${mine.map(t=>taskRow(t)).join("")}</div>`:`<div class="colempty">Nothing assigned to you.</div>`}</div>
      ${gave.length?`<div class="panel" style="margin-top:12px"><div class="panel-h"><h3>I asked others</h3><span class="hint">${gave.length}</span></div><div class="tasks">${gave.map(t=>taskRow(t)).join("")}</div></div>`:""}`; }
  else if(f==="all"){ const groups={}; open.forEach(t=>{ (groups[t.assignee||""]=groups[t.assignee||""]||[]).push(t); });
    const keys=Object.keys(groups).sort((a,b)=>a===""?1:b===""?-1:nameOf(a).localeCompare(nameOf(b)));
    body=keys.length? keys.map(k=>`<div class="panel" style="margin-bottom:12px"><div class="panel-h"><h3>${k?avImg(k)+" "+esc(nameOf(k)):"Unassigned"}</h3><span class="hint">${groups[k].length}</span></div><div class="tasks">${sortT(groups[k]).map(t=>taskRow(t)).join("")}</div></div>`).join("") : `<div class="empty"><b>No open tasks</b>Add one above, or create action items from a meeting.</div>`; }
  else body=done.length? `<div class="panel"><div class="tasks">${done.slice(0,60).map(t=>taskRow(t)).join("")}</div></div>` : `<div class="empty"><b>Nothing finished yet</b></div>`;
  return `<h2>Tasks</h2><p class="sub">Who's doing what. Action items from meetings and to-dos for our events show up here too.</p>
    <div class="panel" style="margin-bottom:14px">${taskAddForm()||`<div class="hint">You can't add tasks with this account.</div>`}</div>
    <div class="seg" role="tablist">${[["mine","Mine"],["all",`All open (${open.length})`],["done","Done"]].map(([k,l])=>`<button role="tab" aria-selected="${f===k}" data-tf="${k}">${l}</button>`).join("")}</div>${body}`;
}

function planCard(p){ const ck=Object.values(p.checklist||{}); const dn=ck.filter(c=>c.done).length; const ns=PSTAGES[PSTAGES.findIndex(x=>x[0]===(p.stage||"idea"))+1];
  return `<div class="card" data-plan="${esc(p.id)}" style="--tc:var(--m-plan)"><div class="meta">${p.date?`<span class="chip ${daysTo(p.date)>=0&&daysTo(p.date)<=7?"soon":""}">🗓 ${esc(fmtDW(p.date))}</span>`:`<span class="chip">No date yet</span>`}${p.itemId?`<span class="chip ok">In newsletter</span>`:""}</div>
    <div class="t" dir="auto">${esc(p.title)}</div>${p.location?`<div class="meta" dir="auto">📍 ${esc(p.location)}</div>`:""}
    ${ck.length?`<div class="prog" title="${dn} of ${ck.length} done"><span style="width:${Math.round(100*dn/ck.length)}%"></span></div><div class="meta">${dn}/${ck.length} checklist</div>`:""}
    <div class="foot"><div class="meta">${p.lead?avImg(p.lead)+`<span>${esc(firstName(p.lead))} leads</span>`:"<span>No lead yet</span>"}</div>${ns&&canEditPlan(p)?`<div class="votes"><button data-pnext="${esc(p.id)}" title="Move to ${esc(ns[1])}" aria-label="Move to ${esc(ns[1])}">→</button></div>`:""}</div></div>`; }
function vEvents(){ const ps=A("plans");
  return `<h2>Our events</h2><p class="sub">Events the branch is organizing, from first idea to done. Each one has a lead, a checklist and its own tasks.</p>
    ${S.canWrite?`<div class="toolbar"><button class="btn pri" data-act="new-plan">+ New event idea</button></div>`:""}
    <div class="board" style="grid-template-columns:repeat(4,minmax(230px,1fr))">${PSTAGES.map(([k,l])=>{ const cs=ps.filter(p=>(p.stage||"idea")===k).sort((a,b)=>(a.date||"9")<(b.date||"9")?-1:1);
      return `<section class="col"><div class="col-h"><h3>${l}</h3><span class="c">${cs.length}</span></div>${cs.map(planCard).join("")||`<div class="colempty">${k==="idea"?"Throw ideas in here.":"Nothing here."}</div>`}</section>`; }).join("")}</div>`; }

function vContacts(){ const {q,kind}=S.cf; const ql=q.trim().toLowerCase();
  const list=A("contacts").filter(c=>(!kind||c.kind===kind)&&(!ql||[c.name,c.org,c.role,c.email,c.notes].join(" ").toLowerCase().includes(ql))).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const stale=c=>!c.lastContact||daysTo(c.lastContact)<-60;
  return `<h2>Contacts</h2><p class="sub">Speakers, sponsors, partner groups and labs we work with, and who on the team owns each relationship.</p>
    <div class="toolbar"><input type="search" id="cq" placeholder="Search names, orgs, notes…" value="${esc(q)}" aria-label="Search contacts"><select id="ckind" aria-label="Kind"><option value="">All kinds</option>${CKINDS.map(([k,l])=>`<option value="${k}" ${kind===k?"selected":""}>${l}</option>`).join("")}</select>${S.canWrite?`<button class="btn pri" data-act="new-contact">+ Add contact</button>`:""}</div>
    ${list.length?`<div class="list">${list.map(c=>`<div class="row" data-contact="${esc(c.id)}" role="button" tabindex="0" style="cursor:pointer"><div class="grow"><div class="t" dir="auto">${esc(c.name)}</div><div class="s" dir="auto">${[c.role,c.org].filter(Boolean).map(esc).join(" · ")||"&nbsp;"}</div></div>
      <span class="chip">${esc(CKIND[c.kind]||"Other")}</span>${c.owner?`<span class="meta" style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)">${avImg(c.owner)}${esc(firstName(c.owner))}</span>`:""}<span class="chip ${stale(c)?"soon":"ok"}">${c.lastContact?"Last contact "+esc(fmtD(c.lastContact)):"Not contacted yet"}</span></div>`).join("")}</div>`
      :`<div class="empty"><b>${A("contacts").length?"No matches":"No contacts yet"}</b>${A("contacts").length?"Try a different search.":"Add the people you work with so the whole team knows who to talk to."}</div>`}`; }

function vPlaces(){
  const list=filtered(A("items").filter(i=>i.status!=="archived"&&(i.location||i.online)));
  const head=`<h2>Places</h2><p class="sub">Where things happen, grouped by city or campus, so readers can spot what's near them.</p>${filterBar()}`;
  if(!list.length) return head+`<div class="empty"><b>No locations yet</b>Items with a location show up here.</div>`;
  const g={}; list.forEach(i=>{ const k=i.online&&!i.location?"Online":(i.city||i.location||"Online").trim(); (g[k]=g[k]||[]).push(i); });
  return head+Object.keys(g).sort((a,b)=>a==="Online"?1:b==="Online"?-1:g[b].length-g[a].length).map(k=>`<div class="group-h"><h3>${k==="Online"?"🌐":"📍"} ${esc(k)}</h3><span class="eyebrow">${g[k].length}</span></div><div class="list">${g[k].map(i=>`<div class="row" data-open="${esc(i.id)}" style="cursor:pointer"><span class="dot" style="color:${tcol(i.type)}"></span><div class="grow"><div class="t" dir="auto">${esc(i.title)}</div><div class="s" dir="auto">${esc(i.location||"Online")}${i.date?" · "+fmtDW(i.date):""}</div></div>${dateChip(i)}</div>`).join("")}</div>`).join("");
}

// issue
function issueItems(){
  const its=A("items").filter(i=>i.status==="issue");
  const order=(a,b)=>(a.order??1e9)-(b.order??1e9)||((a.date||a.deadline||"9")<(b.date||b.deadline||"9")?-1:1);
  const out={}; SECTIONS.forEach(s=>out[s.key]=[]);
  its.forEach(i=>{ const d=i.date?daysTo(i.date):(i.deadline?daysTo(i.deadline):null); if(d!==null&&d>=0&&d<=7){out.soon.push(i);return;} const s=SECTIONS.find(s=>s.types&&s.types.includes(i.type)); (out[s?s.key:"resources"]).push(i); });
  for(const k in out) out[k].sort(order); return out;
}
function itemText(i){
  const lines=[`▪️ *${(i.title||"").trim()}*`]; const body=(i.summary||i.why||"").trim(); if(body) lines.push(body);
  const meta=[]; if(i.date) meta.push("🗓 "+fmtDW(i.date)); if(i.location) meta.push("📍 "+i.location); else if(i.online) meta.push("🌐 Online"); if(i.deadline&&daysTo(i.deadline)>=0) meta.push("⏳ Apply by "+fmtDW(i.deadline));
  if(meta.length) lines.push("_"+meta.join(" · ")+"_"); if(i.url) lines.push("🔗 "+i.url); return lines.join("\n");
}
function composeText(){
  const st=settings(); const secs=issueItems(); const date=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  let t=`*${st.name}* · Issue #${st.nextIssue}\n_${date}_\n`; if((st.draftIntro||"").trim()) t+=`\n${st.draftIntro.trim()}\n`;
  SECTIONS.forEach(s=>{ const its=secs[s.key]; if(!its.length) return; t+=`\n━━━━━━━━━━\n*${s.title}*\n\n`+its.map(itemText).join("\n\n")+"\n"; });
  if((st.footer||"").trim()) t+=`\n━━━━━━━━━━\n${st.footer.trim()}`; return t;
}
function waHtml(t){ return esc(t).replace(/\*([^*\n]+)\*/g,"<b>$1</b>").replace(/(^|[\s(])_([^_\n]+)_/g,"$1<i>$2</i>"); }
function vIssue(){
  const st=settings(); const secs=issueItems(); const total=Object.values(secs).reduce((a,b)=>a+b.length,0);
  const ownerSel=key=>`<select data-owner="${key}" aria-label="Section owner" ${isAdmin()?"":"disabled"}>${peopleOpts(st.owners&&st.owners[key],"Unassigned")}</select>`;
  const left=`<div class="list" style="gap:12px">
    <div class="sec"><div class="sec-h"><h3>Intro</h3></div><textarea id="intro" rows="3" dir="auto" placeholder="${isAdmin()?"A line or two to open the issue (optional)":"Admins write the intro"}" ${isAdmin()?"":"disabled"}>${esc(st.draftIntro)}</textarea></div>
    ${SECTIONS.map(s=>`<div class="sec"><div class="sec-h"><h3>${s.title}</h3>${s.key==="soon"?`<span class="eyebrow">auto: within 7 days</span>`:ownerSel(s.key)}</div>
      ${secs[s.key].length? secs[s.key].map((i,ix)=>`<div class="mini"><span class="dot" style="color:${tcol(i.type)}"></span><span class="t" dir="auto">${esc(i.title)}</span>${S.canWrite?`<button class="btn sm ghost" data-move="${esc(i.id)}" data-sec="${s.key}" data-dir="-1" aria-label="Move up" ${ix===0?"disabled":""}>↑</button><button class="btn sm ghost" data-move="${esc(i.id)}" data-sec="${s.key}" data-dir="1" aria-label="Move down" ${ix===secs[s.key].length-1?"disabled":""}>↓</button>`:""}<button class="btn sm" data-open="${esc(i.id)}">Edit</button></div>`).join("") : `<div class="colempty">No items. Move cards to "In this issue" on the pipeline.</div>`}
    </div>`).join("")}</div>`;
  const right=`<div><div class="phone"><div class="eyebrow" style="margin-bottom:8px">WhatsApp preview</div><div class="bubble" dir="auto">${waHtml(composeText())}</div></div>
    <div class="toolbar" style="margin-top:12px"><button class="btn pri" data-act="copy-issue" ${total?"":"disabled"}>Copy for WhatsApp</button>${isAdmin()?`<button class="btn" data-act="send-issue" ${total?"":"disabled"}>Mark issue #${st.nextIssue} as sent</button>`:`<span class="hint">An admin sends the issue.</span>`}</div><div id="sendConfirm"></div></div>`;
  return `<h2>Issue #${st.nextIssue}</h2><p class="sub">${plural(total,"item")} · ${composeText().length.toLocaleString()} characters. The text uses WhatsApp formatting, so it pastes straight into the group.</p><div class="issue-grid">${left}${right}</div>`;
}

function vSources(){
  const head=`<h2>Source library</h2><p class="sub">The places you check every week. Mark one as checked when you've gone through it; overdue ones float to the top.</p>`;
  const form = isAdmin()? `<form class="box" id="srcForm" style="margin-bottom:16px"><div class="grid2">
      <label class="f">Name<input id="sName" required placeholder="e.g. Technion events calendar" dir="auto"></label>
      <label class="f">Link<input id="sUrl" type="url" placeholder="https://…"></label>
      <label class="f">Kind<select id="sKind"><option>Website</option><option>Events calendar</option><option>LinkedIn</option><option>Mailing list</option><option>WhatsApp / Telegram</option><option>Journal / feed</option><option>Person</option><option>Other</option></select></label>
      <label class="f">Check every<select id="sFreq"><option value="7">Week</option><option value="3">3 days</option><option value="14">2 weeks</option><option value="30">Month</option></select></label>
    </div><div><button class="btn pri" type="submit">Add source</button></div></form>` : "";
  if(!S.sources.length) return head+form+`<div class="empty"><b>No sources saved</b>${isAdmin()?"Add the sites, calendars and lists you scan for news.":"An admin adds sources here."}</div>`;
  const due=s=>{ const last=s.lastChecked||0; return last? (Date.now()-last)/864e5 - (s.freq||7) : 999; };
  return head+form+`<div class="list">${S.sources.slice().sort((a,b)=>due(b)-due(a)).map(s=>{ const d=due(s); const n=A("items").filter(i=>i.sourceId===s.id).length; const u=safeUrl(s.url);
    return `<div class="row"><div class="grow"><div class="t" dir="auto">${u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(s.name)}</a>`:esc(s.name)}</div><div class="s"><span class="src-kind">${esc(s.kind||"")}</span> · every ${s.freq||7} days · ${plural(n,"item")} found${s.lastChecked?` · checked ${agoPhrase(s.lastChecked)} by ${esc(nameOf(s.lastCheckedBy))}`:" · never checked"}</div></div>
    <span class="chip ${d>0?"hot":"ok"}">${d>0?"Due":"Up to date"}</span>${S.canWrite?`<button class="btn sm" data-check="${esc(s.id)}">Checked today</button>`:""}${isAdmin()?`<button class="btn sm ghost danger" data-delsrc="${esc(s.id)}" aria-label="Remove source">✕</button>`:""}</div>`;}).join("")}</div>`;
}

function vTeam(){
  const ws=weekStart(); const ids=people(); const st=settings(); const secName=k=>(SECTIONS.find(s=>s.key===k)||{}).title;
  const streak=id=>{ const weeks=new Set(A("items").filter(i=>i.addedBy===id&&i.createdAt).map(i=>weekStart(i.createdAt))); let w=weeks.has(ws)?ws:ws-7*864e5, n=0; while(weeks.has(w)){n++; w=weekStart(w-864e5);} return n; };
  const cards=ids.map(id=>{ const mine=A("items").filter(i=>i.addedBy===id); const wk=mine.filter(i=>(i.createdAt||0)>=ws).length; const tasks=A("tasks").filter(t=>t.assignee===id&&!t.done).length;
    const owns=Object.entries(st.owners||{}).filter(([k,v])=>v===id).map(([k])=>secName(k)).filter(Boolean); const p=S.profiles[id]; const role=p&&p.email?roleOf(String(p.email).toLowerCase()):"";
    return `<div class="panel person"><div class="hd">${avImg(id)}<div><h3>${esc(nameOf(id))} ${role?`<span class="chip">${role}</span>`:""}</h3><div class="hint">${owns.length?"Owns "+owns.map(esc).join(", "):"No newsletter sections"}</div></div></div>
      <div class="stats"><div class="stat"><div class="v">${wk}</div><div class="l">added this week</div></div><div class="stat"><div class="v">${tasks}</div><div class="l">open tasks</div></div><div class="stat"><div class="v">${streak(id)}🔥</div><div class="l">week streak</div></div></div></div>`; }).join("");
  const feed=S.activity.length? `<div class="feed">${S.activity.map(actRow).join("")}</div>` : `<div class="colempty">Everything the team adds, edits, votes on or sends shows up here.</div>`;
  return `<h2>Team</h2><p class="sub">Who's doing what this week. Weeks run Sunday to Saturday.</p><div class="team">${cards}</div>${accessPanel()}<div class="panel"><div class="panel-h"><h3>Activity</h3></div>${feed}</div>`;
}
function accessPanel(){
  const admin=isAdmin(); const byEmail={}; Object.values(S.profiles).forEach(p=>{ if(p&&p.email) byEmail[String(p.email).toLowerCase()]=p; });
  const rows=[[ownerEmail(),"Owner"],...accessList("admins").filter(e=>e!==ownerEmail()).map(e=>[e,"Admin"]),...accessList("members").filter(e=>e!==ownerEmail()&&!accessList("admins").includes(e)).map(e=>[e,"Member"])];
  const row=([email,role])=>{ const p=byEmail[email]; const isMe=email===S.myEmail;
    return `<div class="row"><div class="grow"><div class="t">${p&&p.name?esc(p.name):esc(email)}${isMe?" (you)":""}</div><div class="s">${p&&p.name?esc(email)+" · ":""}${p?"has signed in":"hasn't signed in yet"}</div></div>
      ${admin&&role!=="Owner"?`<select data-access="${esc(email)}" aria-label="Role for ${esc(email)}"><option value="admins" ${role==="Admin"?"selected":""}>Admin</option><option value="members" ${role==="Member"?"selected":""}>Member</option></select>
        ${S.confirmRemove===email?`<span class="confirm" style="padding:4px 8px">Remove? <button class="btn sm danger" data-act="rm-yes" data-email="${esc(email)}">Remove</button><button class="btn sm" data-act="rm-no">Keep</button></span>`:`<button class="btn sm ghost danger" data-act="rm" data-email="${esc(email)}">Remove</button>`}`
      :`<span class="chip ${role==="Member"?"":"ok"}">${role}</span>`}</div>`; };
  return `<div class="panel" style="margin-bottom:24px"><div class="panel-h"><h3>Who has access</h3><span class="hint">${rows.length} ${rows.length===1?"person":"people"}</span></div>
    <p class="sub" style="margin-bottom:12px">${admin?"Add people by their Google email. <b>Members</b> add items, tasks, meetings and contacts, vote, comment, move items into the issue and edit their own work. <b>Admins</b> can also edit or delete anything, send issues, manage sources, settings, backups and this list.":"Ask an admin to add someone new."}</p>
    ${admin?`<form id="accessForm" class="toolbar"><input id="accEmail" type="email" placeholder="name@gmail.com" style="flex:1 1 220px" aria-label="Google email"><select id="accRole" aria-label="Role"><option value="members">Member</option><option value="admins">Admin</option></select><button class="btn pri" type="submit">Add</button></form>`:""}
    <div class="list">${rows.map(row).join("")}</div></div>`;
}
async function saveAccess(admins,members){ const ref=S.db.doc("meta/access"); const data={admins:[...new Set(admins)],members:[...new Set(members)],...stamp()};
  try{ if(S.access) await ref.update(data); else await ref.set(data); return true; }catch(e){ writeErr(e); return false; } }
async function changeRole(email,list){ let a=accessList("admins").filter(e=>e!==email), m=accessList("members").filter(e=>e!==email); (list==="admins"?a:m).push(email);
  if(await saveAccess(a,m)){ logAct(list==="admins"?"made admin:":"made member:",email); toast(`${email} is now ${list==="admins"?"an admin":"a member"}.`); } }

function vArchive(){
  const head=`<h2>Archive</h2><p class="sub">Every issue you've sent. They're also on the <a href="public.html" target="_blank" rel="noopener">public page</a>, which anyone can open.</p>`;
  if(!S.issues.length) return head+`<div class="empty"><b>No issues sent yet</b>When an admin marks an issue as sent, it's saved here.</div>`;
  return head+`<div class="list" style="gap:14px">${S.issues.slice().sort((a,b)=>b.number-a.number).map(is=>`<details class="box"><summary style="cursor:pointer;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><h3>Issue #${is.number}</h3><span class="hint">${new Date(is.sentAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})} · ${plural((is.itemIds||[]).length,"item")} · sent by ${esc(nameOf(is.sentBy))}</span></summary>
    <div class="bubble" dir="auto" style="max-height:none">${waHtml(is.text||"")}</div><div><button class="btn sm" data-copyissue="${esc(is.id)}">Copy text</button></div></details>`).join("")}</div>`;
}
function vTrash(){
  const rows=[]; for(const col of Object.keys(TRASHABLE)) S[col].filter(x=>x.deleted).forEach(x=>rows.push({col,x}));
  rows.sort((a,b)=>(b.x.deletedAt||0)-(a.x.deletedAt||0));
  const left=x=>Math.max(0,30-Math.floor((Date.now()-(x.deletedAt||Date.now()))/864e5));
  const mayPurge=(col,x)=> isAdmin() || (col==="items"?x.addedBy:col==="plans"||col==="contacts"||col==="tasks"||col==="meetings"?x.createdBy:null)===S.meId;
  return `<h2>Trash</h2><p class="sub">Deleted things stay here for 30 days, then they're removed for good. Anyone can see the Trash; restoring follows the same rules as editing.</p>
    ${rows.length?`<div class="list">${rows.map(({col,x})=>`<div class="row"><div class="grow"><div class="t" dir="auto">${esc(titleOf(col,x))}</div><div class="s">${esc(TRASHABLE[col])} · deleted by ${esc(nameOf(x.deletedBy))} ${x.deletedAt?agoPhrase(x.deletedAt):""} · ${plural(left(x),"day")} left</div></div>
      ${S.canWrite?`<button class="btn sm" data-restore="${col}:${esc(x.id)}">Restore</button>`:""}${mayPurge(col,x)?`<button class="btn sm ghost danger" data-purge="${col}:${esc(x.id)}">Delete forever</button>`:""}</div>`).join("")}</div>`
      :`<div class="empty"><b>Trash is empty</b>Deleted items, tasks, meetings, event plans and contacts land here first.</div>`}`;
}

// ───────── drawers ─────────
function closeDrawer(){ S.drawer=null; $("#layer").querySelector(".scrim")?.remove(); }
function openD(kind,obj){ $("#layer").querySelector(".scrim")?.remove(); S.drawer=Object.assign({kind,v:0,confirmDel:false},obj); renderDrawer(); }
function bump(){ S.drawer.v=(S.drawer.v||0)+1; renderDrawer(); }
function shell(key, label, inner){ const el=document.createElement("div"); el.className="scrim"; el.dataset.for=key; el.dataset.v=String(S.drawer.v||0);
  el.innerHTML=`<div class="drawer" role="dialog" aria-modal="true" aria-label="${esc(label)}">${inner}</div>`; return el; }
function renderDrawer(){
  const L=$("#layer"); const old=L.querySelector(".scrim");
  if(old&&old.dataset.kind==="settings") return;
  if(!S.drawer){ old&&old.remove(); return; }
  const fn={item:drawItem,meeting:drawMeeting,task:drawTask,plan:drawPlan,contact:drawContact}[S.drawer.kind];
  const key=S.drawer.kind+"-"+(S.drawer.id||"new");
  if(old && old.dataset.for===key && old.dataset.v===String(S.drawer.v||0)){ fn(null,true); return; }
  const sy=old? old.querySelector(".drawer").scrollTop : 0; old&&old.remove();
  const el=fn(key,false); if(!el) return; L.append(el); el.querySelector(".drawer").scrollTop=sy;
  if(!S.drawer.id&&!old) setTimeout(()=>el.querySelector("[data-autofocus]")?.focus(),30);
}
const delBlock = (label) => S.drawer.confirmDel?`<div class="confirm">${label} <button type="button" class="btn sm danger" data-act="del-yes">Move to Trash</button><button type="button" class="btn sm" data-act="del-no">Keep</button></div>`:"";
function commentsHtml(it){ const cs=Object.entries(it.comments||{}).map(([k,v])=>({k,...v})).sort((a,b)=>a.at-b.at);
  return cs.length? cs.map(c=>`<div class="comment">${avImg(c.by)}<div class="b"><div class="n">${esc(nameOf(c.by))} · ${ago(c.at)}</div><div dir="auto">${esc(c.text).replace(/(^|\s)(@[^\s@]+(?:\s[A-Z][^\s@]*)?)/g,"$1<b class=\"men\">$2</b>")}</div></div></div>`).join("") : `<div class="colempty">No notes yet.</div>`; }
function staleHtml(it){ const D=S.drawer; if(!D||!it||!it.updatedAt||it.updatedAt===D.base||it.updatedBy===S.meId) return "";
  return `<div class="dup">${esc(nameOf(it.updatedBy))} just changed this. Saving now would overwrite their changes. <button type="button" class="btn sm" data-act="reload">Load their version</button></div>`; }

// item
function blankItem(){ return {type:"event",title:"",url:"",sourceId:"",summary:"",date:"",location:"",city:"",online:false,audience:"All",tags:[],recurring:"none",status:"found"}; }
function openItem(id, preset){ const it=id? S.items.find(i=>i.id===id) : null; if(id&&!it) return;
  openD("item",{id:id||null,base:it?(it.updatedAt||0):0,draft:Object.assign(blankItem(),it?JSON.parse(JSON.stringify(it)):{},preset||{}),dup:null});
  if(!id&&preset&&preset.url&&!S.drawer.draft.title) fetchMeta(preset.url); }
function drawItem(key, live){
  const D=S.drawer, d=D.draft, isNew=!D.id, it=isNew?null:S.items.find(i=>i.id===D.id);
  if(live){ const c=$("#cmts"); if(c&&it) c.innerHTML=commentsHtml(it); const s=$("#staleBox"); if(s) s.innerHTML=staleHtml(it); return; }
  const ro=!canEditItem(it), locked=ro&&S.canWrite, dis=ro?"disabled":"", isEvent=d.type==="event";
  return shell(key, isNew?"Add item":"Edit item", `
    <div class="dh"><h2>${isNew?"Add to the desk":"Newsletter item"}</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    ${it?`<div class="hint">Added by ${esc(nameOf(it.addedBy))} ${it.createdAt?agoPhrase(it.createdAt):""}${it.owner?` · ${esc(nameOf(it.owner))} is writing it`:""}${it.issueNo?` · ran in issue #${it.issueNo}`:""}${it.suggestedBy?` · suggested by ${esc(it.suggestedBy)}`:""}</div>`:""}
    <div id="staleBox">${staleHtml(it)}</div>
    ${locked?`<div class="dup">${esc(nameOf(it.addedBy))} added this, so only they or an admin can edit the details. You can still change the stage, vote, claim it and comment.</div>`:""}
    <form class="box" id="itemForm" novalidate>
      <label class="f"><span class="lh">Link${safeUrl(d.url)?`<a href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener" style="font-weight:400">Open ↗</a>`:""}</span><input id="dUrl" type="url" value="${esc(d.url)}" placeholder="https://… (paste it and the title fills in)" ${dis} ${d.url?"":"data-autofocus"}></label>
      <label class="f"><span class="lh">Title<span class="req">*</span></span><input id="dTitle" dir="auto" value="${esc(d.title)}" placeholder="What is it?" ${dis} ${d.url?"data-autofocus":""}></label>
      <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted);font-weight:500">Type
        <div class="typepick" role="radiogroup" aria-label="Type">${TYPES.map(([k,l,c])=>`<input type="radio" name="dType" id="ty-${k}" value="${k}" ${d.type===k?"checked":""} ${dis}><label for="ty-${k}" style="--tc:var(${c})"><span class="dot"></span>${l}</label>`).join("")}</div></div>
      <div class="grid2">
        <label class="f"><span class="lh">Date${isEvent?`<span class="req">*</span>`:""}</span><input id="dDate" type="date" value="${esc(d.date)}" ${dis}></label>
        <label class="f"><span class="lh">Location${isEvent?`<span class="req">*</span>`:""}</span><input id="dLoc" dir="auto" value="${esc(d.location)}" placeholder="Technion, Haifa · or Online" ${dis}></label>
      </div>
      <div id="formErr"></div>
      <details class="more" ${isNew?"":"open"}><summary>More details (optional)</summary><div style="display:flex;flex-direction:column;gap:12px">
        ${isNew?"":`<label class="f">Stage<select id="dStatus" ${S.canWrite?"":"disabled"} ${locked?'data-quickstage="1"':""}>${STAGES.filter(([k])=>!locked||k!=="archived"||d.status==="archived").map(([k,l])=>`<option value="${k}" ${d.status===k?"selected":""}>${l}</option>`).join("")}</select></label>`}
        <label class="f">Newsletter blurb<textarea id="dSummary" rows="3" dir="auto" placeholder="One or two short lines readers will see" ${dis}>${esc(d.summary||d.why||"")}</textarea></label>
        <div class="grid2">
          <label class="f">City / campus<input id="dCity" dir="auto" value="${esc(d.city)}" placeholder="Haifa" ${dis}></label>
          <label class="f">Audience<select id="dAud" ${dis}>${AUDIENCES.map(a=>`<option ${d.audience===a?"selected":""}>${a}</option>`).join("")}</select></label>
          <label class="f">Repeats<select id="dRec" ${dis}>${[["none","No"],["weekly","Weekly"],["monthly","Monthly"],["yearly","Yearly"]].map(([k,l])=>`<option value="${k}" ${d.recurring===k?"selected":""}>${l}</option>`).join("")}</select></label>
          <label class="f">Found via<select id="dSrc" ${dis}><option value="">—</option>${S.sources.map(s=>`<option value="${esc(s.id)}" ${d.sourceId===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label>
        </div>
        <label class="f">Tags (comma separated)<input id="dTags" dir="auto" value="${esc((d.tags||[]).join(", "))}" placeholder="biotech, medtech" ${dis}></label>
      </div></details>
      <div id="dupBox">${D.dup?`<div class="dup">Looks like this is already on the desk: <a href="#" data-open="${esc(D.dup.id)}">${esc(D.dup.title)}</a> (${esc(STAGE[D.dup.status||"found"])}). Save again to add it anyway.</div>`:""}</div>
      ${!S.canWrite?"":`<div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">${isNew?"Add to desk":"Save changes"}</button>`}${it&&it.owner!==S.meId?`<button type="button" class="btn" data-act="claim">✋ I'll write this</button>`:""}${it&&it.owner===S.meId?`<button type="button" class="btn" data-act="unclaim">Release</button>`:""}${it&&it.date?`<a class="btn" target="_blank" rel="noopener" href="${esc(gcalUrl({title:it.title,date:it.date,location:it.location,details:it.url}))}">+ Google Calendar</a>`:""}<span style="flex:1"></span>${it&&!ro?`<button type="button" class="btn ghost danger" data-act="del">Delete</button>`:""}</div>${delBlock("Move this item to the Trash?")}`}
    </form>
    ${it?`<div class="box"><h3>Discussion</h3><div id="cmts">${commentsHtml(it)}</div>${!S.canWrite?"":`<form id="cForm" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:8px"><input id="cText" dir="auto" placeholder="Add a note. Type @ and a name to notify someone" style="flex:1"><button class="btn" type="submit">Post</button></div>${mentionChips("cText")}</form>`}</div>`:""}`);
}
function readItemForm(){ const d=S.drawer.draft, v=id=>{const e=$("#"+id); return e? e.value : undefined;}; const ty=document.querySelector('input[name="dType"]:checked');
  Object.assign(d,{type:ty?ty.value:d.type,title:(v("dTitle")||"").trim(),url:(v("dUrl")||"").trim(),summary:(v("dSummary")??d.summary??"").trim(),date:v("dDate")||"",location:(v("dLoc")||"").trim(),city:(v("dCity")??d.city??"").trim(),audience:v("dAud")??d.audience,recurring:v("dRec")??d.recurring,sourceId:v("dSrc")??d.sourceId??"",tags:(v("dTags")??(d.tags||[]).join(",")).split(",").map(s=>s.trim()).filter(Boolean)});
  if($("#dStatus")) d.status=$("#dStatus").value; if(d.location&&/^online$/i.test(d.location)) d.online=true; return d; }
const metaCache={};
async function fetchMeta(url){
  if(!safeUrl(url)) return; const D=S.drawer; if(!D) return;
  const box=$("#formErr"); if(box) box.innerHTML=`<div class="hint">Looking up the page title…</div>`;
  try{ const m = metaCache[url] || (metaCache[url] = await fetch("https://api.microlink.io/?url="+encodeURIComponent(url)).then(r=>r.json()));
    if(S.drawer!==D) return; readItemForm();
    if(m&&m.status==="success"&&m.data){ if(!D.draft.title&&m.data.title) D.draft.title=String(m.data.title).trim().slice(0,160); if(!D.draft.summary&&m.data.description) D.draft.summary=String(m.data.description).trim().slice(0,280); bump(); const b=$("#formErr"); if(b) b.innerHTML=`<div class="hint">Filled from the page. Check it before saving.</div>`; }
    else { const b=$("#formErr"); if(b) b.innerHTML=""; }
  }catch{ const b=$("#formErr"); if(b) b.innerHTML=""; }
}
async function submitItem(){
  const D=S.drawer, d=readItemForm(); const miss=[];
  if(!d.title) miss.push("a title"); if(d.type==="event"&&!d.date) miss.push("a date"); if(d.type==="event"&&!d.location) miss.push("a location");
  if(miss.length){ $("#formErr").innerHTML=`<div class="dup">Add ${miss.join(", ").replace(/, ([^,]*)$/," and $1")} first.</div>`; return; }
  if(!D.id && !D.dupAck){ const nu=normUrl(d.url), nt=d.title.toLowerCase(); const dup=A("items").find(i=>(nu&&normUrl(i.url)===nu)||(i.title||"").trim().toLowerCase()===nt);
    if(dup){ D.dup=dup; D.dupAck=true; bump(); return; } }
  const now=Date.now(); const fields=(({type,status,title,url,summary,date,location,city,audience,recurring,sourceId,online,tags})=>({type,status,title,url,summary,date,location,city,audience,recurring,sourceId,online:!!online,tags}))(d);
  try{
    if(!D.id){ fields.status="found"; if(d.suggestedBy) fields.suggestedBy=d.suggestedBy; const id=await saveItem(null,Object.assign(fields,{addedBy:S.meId,owner:null,votes:{},comments:{},createdAt:now,...stamp()}),true); logAct("added",d.title,id); if(D.fromPlan) await upd("plans",D.fromPlan,{itemId:id,...stamp()}); toast("Added to the desk."); }
    else { const prev=S.items.find(i=>i.id===D.id); await saveItem(D.id,Object.assign(fields,stamp())); logAct(prev&&prev.status!==d.status?`moved to ${STAGE[d.status]}:`:"edited",d.title,D.id); toast("Saved."); }
    closeDrawer();
  }catch{}
}

// meeting
function openMeeting(id, date){ const mt=id? S.meetings.find(x=>x.id===id) : null; if(id&&!mt) return;
  openD("meeting",{id:id||null,base:mt?(mt.updatedAt||0):0,draft:Object.assign({title:"",kind:"meeting",date:date||todayS(),time:"",endTime:"",location:"",agenda:"",notes:""},mt?JSON.parse(JSON.stringify(mt)):{})}); }
function rsvpHtml(mt){ const r=mt.rsvp||{}; const mine=r[S.meId]; const grp={yes:[],maybe:[],no:[]}; Object.entries(r).forEach(([u,v])=>grp[v]&&grp[v].push(u));
  return `<div class="seg" style="margin:0">${[["yes","Going"],["maybe","Maybe"],["no","Can't make it"]].map(([k,l])=>`<button type="button" data-rsvp="${k}" aria-pressed="${mine===k}" ${S.canWrite?"":"disabled"}>${l}${grp[k].length?` · ${grp[k].length}`:""}</button>`).join("")}</div>
    <div class="hint" style="margin-top:6px">${[["yes","Going"],["maybe","Maybe"],["no","Can't"]].filter(([k])=>grp[k].length).map(([k,l])=>`${l}: ${grp[k].map(u=>esc(firstName(u))).join(", ")}`).join(" · ")||"No replies yet."}</div>`; }
function drawMeeting(key, live){
  const D=S.drawer, d=D.draft, mt=D.id?S.meetings.find(x=>x.id===D.id):null;
  if(live){ if(mt){ const r=$("#rsvpBox"); if(r) r.innerHTML=rsvpHtml(mt); const a=$("#actList"); if(a) a.innerHTML=actionList(mt); const s=$("#staleBox"); if(s) s.innerHTML=staleHtml(mt); } return; }
  const ro=!canEditMeet(mt), dis=ro?"disabled":"";
  return shell(key,"Calendar entry",`
    <div class="dh"><h2>${D.id?"Calendar entry":"Add to the calendar"}</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    ${mt?`<div class="hint">Added by ${esc(nameOf(mt.createdBy))} ${mt.createdAt?agoPhrase(mt.createdAt):""}${ro&&S.canWrite?" · only they or an admin can edit the details":""}</div>`:""}
    <div id="staleBox">${staleHtml(mt)}</div>
    ${mt?`<div class="box"><h3>Are you coming?</h3><div id="rsvpBox">${rsvpHtml(mt)}</div></div>`:""}
    <form class="box" id="meetForm" novalidate>
      <label class="f"><span class="lh">What<span class="req">*</span></span><input id="mTitle" dir="auto" value="${esc(d.title)}" placeholder="Weekly sync · Call with BioHub" ${dis} data-autofocus></label>
      <div class="typepick" role="radiogroup" aria-label="Kind">${MKINDS.map(([k,l,c])=>`<input type="radio" name="mKind" id="mk-${k}" value="${k}" ${d.kind===k?"checked":""} ${dis}><label for="mk-${k}" style="--tc:var(${c})"><span class="dot"></span>${l}</label>`).join("")}</div>
      <div class="grid2">
        <label class="f"><span class="lh">Date<span class="req">*</span></span><input id="mDate" type="date" value="${esc(d.date)}" ${dis}></label>
        <label class="f">Start<input id="mTime" type="time" value="${esc(d.time)}" ${dis}></label>
        <label class="f">End<input id="mEnd" type="time" value="${esc(d.endTime)}" ${dis}></label>
      </div>
      <label class="f">Where<input id="mLoc" dir="auto" value="${esc(d.location)}" placeholder="Room, building, or a Zoom / Meet link" ${dis}></label>
      <label class="f">Agenda<textarea id="mAgenda" rows="3" dir="auto" placeholder="What we'll cover" ${dis}>${esc(d.agenda)}</textarea></label>
      ${D.id?`<label class="f">Notes<textarea id="mNotes" rows="4" dir="auto" placeholder="What was decided" ${dis}>${esc(d.notes)}</textarea></label>`:""}
      <div id="mErr"></div>
      <div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">${D.id?"Save changes":"Add to calendar"}</button>`}${mt?`<a class="btn" target="_blank" rel="noopener" href="${esc(gcalUrl({title:mt.title,date:mt.date,time:mt.time,endTime:mt.endTime,location:mt.location,details:mt.agenda}))}">+ Google Calendar</a>`:""}<span style="flex:1"></span>${mt&&!ro?`<button type="button" class="btn ghost danger" data-act="del">Delete</button>`:""}</div>
      ${ro?"":delBlock("Move this entry to the Trash?")}
    </form>
    ${mt?`<div class="box"><h3>Action items</h3><div id="actList">${actionList(mt)}</div>${taskAddForm(`data-meeting="${esc(mt.id)}"`)}</div>`:""}`);
}
function actionList(mt){ const ts=A("tasks").filter(t=>t.meetingId===mt.id); return ts.length?`<div class="tasks">${ts.map(t=>taskRow(t,true)).join("")}</div>`:`<div class="colempty">No action items yet. Add who does what before you leave the meeting.</div>`; }
function readMeeting(){ const d=S.drawer.draft; const k=document.querySelector('input[name="mKind"]:checked'); Object.assign(d,{title:$("#mTitle").value.trim(),kind:k?k.value:"meeting",date:$("#mDate").value,time:$("#mTime").value,endTime:$("#mEnd").value,location:$("#mLoc").value.trim(),agenda:$("#mAgenda").value.trim(),notes:$("#mNotes")?$("#mNotes").value.trim():(d.notes||"")}); return d; }
async function submitMeeting(){
  const D=S.drawer, d=readMeeting(); if(!d.title||!d.date){ $("#mErr").innerHTML=`<div class="dup">Add ${!d.title&&!d.date?"a title and a date":!d.title?"a title":"a date"} first.</div>`; return; }
  const data={title:d.title,kind:d.kind,date:d.date,time:d.time,endTime:d.endTime,location:d.location,agenda:d.agenda,notes:d.notes,...stamp()};
  if(D.id){ if(await upd("meetings",D.id,data)){ logAct("updated meeting",d.title); closeDrawer(); toast("Saved."); } }
  else { const id=await add("meetings",Object.assign(data,{rsvp:{},createdBy:S.meId,createdAt:Date.now()})); if(id){ logAct(d.kind==="idea"?"added an event idea:":"scheduled",d.title+" · "+fmtDW(d.date)); closeDrawer(); toast("Added to the calendar."); } }
}

// task
function openTask(id){ const t=S.tasks.find(x=>x.id===id); if(!t) return; openD("task",{id,base:t.updatedAt||0,draft:JSON.parse(JSON.stringify(t))}); }
function drawTask(key, live){
  const D=S.drawer, d=D.draft, t=S.tasks.find(x=>x.id===D.id); if(live){ const s=$("#staleBox"); if(s) s.innerHTML=staleHtml(t); return; } if(!t){ closeDrawer(); return null; }
  const ro=!canEditTask(t), dis=ro?"disabled":""; const mt=t.meetingId&&S.meetings.find(x=>x.id===t.meetingId), pl=t.planId&&S.plans.find(x=>x.id===t.planId);
  return shell(key,"Task",`<div class="dh"><h2>Task</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    <div class="hint">Added by ${esc(nameOf(t.createdBy))} ${t.createdAt?agoPhrase(t.createdAt):""}${t.done?` · done by ${esc(nameOf(t.doneBy))}`:""}${mt?` · from <a href="#" data-meet="${esc(mt.id)}">${esc(mt.title)}</a>`:""}${pl?` · for <a href="#" data-plan="${esc(pl.id)}">${esc(pl.title)}</a>`:""}</div>
    <div id="staleBox">${staleHtml(t)}</div>
    <form class="box" id="taskForm" novalidate>
      <label class="f"><span class="lh">Task<span class="req">*</span></span><input id="kTitle" dir="auto" value="${esc(d.title)}" ${dis}></label>
      <div class="grid2"><label class="f">Assigned to<select id="kAss" ${dis}>${peopleOpts(d.assignee,"Unassigned")}</select></label><label class="f">Due<input id="kDue" type="date" value="${esc(d.due)}" ${dis}></label></div>
      <label class="f">Notes<textarea id="kNotes" rows="3" dir="auto" ${dis}>${esc(d.notes)}</textarea></label>
      <div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">Save changes</button>`}${S.canWrite?`<button type="button" class="btn" data-done="${esc(t.id)}">${t.done?"Mark not done":"✓ Mark done"}</button>`:""}<span style="flex:1"></span>${ro?"":`<button type="button" class="btn ghost danger" data-act="del">Delete</button>`}</div>
      ${ro?"":delBlock("Move this task to the Trash?")}</form>`);
}
async function submitTask(){ const D=S.drawer; const title=$("#kTitle").value.trim(); if(!title){ toast("The task needs a name."); return; }
  const prev=S.tasks.find(x=>x.id===D.id); const assignee=$("#kAss").value;
  if(await upd("tasks",D.id,{title,assignee,due:$("#kDue").value,notes:$("#kNotes").value.trim(),...stamp()})){ if(prev&&prev.assignee!==assignee&&assignee) logAct(`gave ${firstName(assignee)} a task:`,title); closeDrawer(); toast("Saved."); } }

// plan (our events)
function openPlan(id, date){ const p=id? S.plans.find(x=>x.id===id) : null; if(id&&!p) return;
  openD("plan",{id:id||null,base:p?(p.updatedAt||0):0,draft:Object.assign({title:"",stage:"idea",date:date||"",time:"",location:"",lead:S.meId,link:"",blurb:"",notes:""},p?JSON.parse(JSON.stringify(p)):{})}); }
function checklistHtml(p, ro){ const ck=Object.entries(p.checklist||{}).sort((a,b)=>(a[1].at||0)-(b[1].at||0));
  return (ck.length?`<div class="tasks">${ck.map(([k,c])=>`<div class="task ${c.done?"done":""}"><input type="checkbox" data-ck="${esc(k)}" ${c.done?"checked":""} ${S.canWrite?"":"disabled"} aria-label="Done"><div class="grow"><span class="t" dir="auto">${esc(c.text)}</span>${c.done&&c.by?`<div class="meta"><span>${esc(firstName(c.by))}</span></div>`:""}</div>${ro?"":`<button type="button" class="btn sm ghost" data-ckdel="${esc(k)}" aria-label="Remove">✕</button>`}</div>`).join("")}</div>`:`<div class="colempty">No checklist yet.</div>`)
    +(S.canWrite?`<form id="ckForm" style="display:flex;gap:8px;margin-top:8px"><input id="ckText" placeholder="Add a checklist step…" dir="auto" style="flex:1"><button class="btn" type="submit">Add</button></form>`:""); }
function drawPlan(key, live){
  const D=S.drawer, d=D.draft, p=D.id?S.plans.find(x=>x.id===D.id):null;
  if(live){ if(p){ const c=$("#ckBox"); if(c&&document.activeElement?.id!=="ckText") c.innerHTML=checklistHtml(p,!canEditPlan(p)); const t=$("#ptasks"); if(t) t.innerHTML=planTasks(p); const s=$("#staleBox"); if(s) s.innerHTML=staleHtml(p); } return; }
  const ro=!canEditPlan(p), dis=ro?"disabled":"";
  return shell(key,"Our event",`<div class="dh"><h2>${p?"Our event":"New event idea"}</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    ${p?`<div class="hint">Added by ${esc(nameOf(p.createdBy))} ${p.createdAt?agoPhrase(p.createdAt):""}${ro&&S.canWrite?" · only the lead, its creator or an admin can edit the details; anyone can tick the checklist":""}</div>`:""}
    <div id="staleBox">${staleHtml(p)}</div>
    <form class="box" id="planForm" novalidate>
      <label class="f"><span class="lh">Event<span class="req">*</span></span><input id="pTitle" dir="auto" value="${esc(d.title)}" placeholder="Lab tour night · Founders panel" ${dis} data-autofocus></label>
      <div class="seg" role="radiogroup" aria-label="Stage" style="margin:0">${PSTAGES.map(([k,l])=>`<button type="button" data-pstage="${k}" aria-pressed="${(d.stage||"idea")===k}" ${dis}>${l}</button>`).join("")}</div>
      <div class="grid2"><label class="f">Date<input id="pDate" type="date" value="${esc(d.date)}" ${dis}></label><label class="f">Time<input id="pTime" type="time" value="${esc(d.time)}" ${dis}></label>
        <label class="f">Where<input id="pLoc" dir="auto" value="${esc(d.location)}" placeholder="Building / room" ${dis}></label><label class="f">Lead<select id="pLead" ${dis}>${peopleOpts(d.lead,"No lead yet")}</select></label></div>
      <label class="f">Registration / info link<input id="pLink" type="url" value="${esc(d.link)}" placeholder="https://…" ${dis}></label>
      <label class="f">Notes<textarea id="pNotes" rows="3" dir="auto" placeholder="Idea, budget, who to invite" ${dis}>${esc(d.notes)}</textarea></label>
      <div id="pErr"></div>
      <div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">${p?"Save changes":"Add event idea"}</button>`}${p&&S.canWrite&&!p.itemId?`<button type="button" class="btn" data-act="plan-to-news">➜ Add to newsletter</button>`:""}${p&&p.itemId?`<a class="btn" href="#" data-open="${esc(p.itemId)}">Open newsletter item</a>`:""}${p&&p.date?`<a class="btn" target="_blank" rel="noopener" href="${esc(gcalUrl({title:p.title,date:p.date,time:p.time,location:p.location,details:p.link}))}">+ Google Calendar</a>`:""}<span style="flex:1"></span>${p&&!ro?`<button type="button" class="btn ghost danger" data-act="del">Delete</button>`:""}</div>
      ${ro?"":delBlock("Move this event to the Trash?")}
    </form>
    ${p?`<div class="box"><h3>Checklist</h3><div id="ckBox">${checklistHtml(p,ro)}</div></div><div class="box"><h3>Tasks</h3><div id="ptasks">${planTasks(p)}</div>${taskAddForm(`data-plan="${esc(p.id)}"`)}</div>`:""}`);
}
function planTasks(p){ const ts=A("tasks").filter(t=>t.planId===p.id); return ts.length?`<div class="tasks">${ts.map(t=>taskRow(t,true)).join("")}</div>`:`<div class="colempty">No tasks yet.</div>`; }
function readPlan(){ const d=S.drawer.draft; Object.assign(d,{title:$("#pTitle").value.trim(),date:$("#pDate").value,time:$("#pTime").value,location:$("#pLoc").value.trim(),lead:$("#pLead").value,link:$("#pLink").value.trim(),notes:$("#pNotes").value.trim()}); return d; }
async function submitPlan(){ const D=S.drawer, d=readPlan(); if(!d.title){ $("#pErr").innerHTML=`<div class="dup">Give the event a name first.</div>`; return; }
  const data={title:d.title,stage:d.stage||"idea",date:d.date,time:d.time,location:d.location,lead:d.lead,link:d.link,notes:d.notes,...stamp()};
  if(D.id){ const prev=S.plans.find(x=>x.id===D.id); if(await upd("plans",D.id,data)){ logAct(prev&&prev.stage!==data.stage?`moved event to ${PSTAGE[data.stage]}:`:"updated event",d.title); closeDrawer(); toast("Saved."); } }
  else { const ck={}; DEFAULT_CHECK.forEach((t,i)=>{ ck["c"+i]={text:t,done:false,at:i}; });
    const id=await add("plans",Object.assign(data,{checklist:ck,itemId:"",createdBy:S.meId,createdAt:Date.now()})); if(id){ logAct("added an event idea:",d.title); closeDrawer(); await whenExists("plans",id); openPlan(id); toast("Event added with a starter checklist."); } }
}

// contact
function openContact(id){ const c=id? S.contacts.find(x=>x.id===id) : null; if(id&&!c) return;
  openD("contact",{id:id||null,base:c?(c.updatedAt||0):0,draft:Object.assign({name:"",org:"",role:"",kind:"speaker",email:"",phone:"",owner:S.meId,lastContact:"",notes:""},c?JSON.parse(JSON.stringify(c)):{})}); }
function drawContact(key, live){
  const D=S.drawer, d=D.draft, c=D.id?S.contacts.find(x=>x.id===D.id):null; if(live){ const s=$("#staleBox"); if(s) s.innerHTML=staleHtml(c); return; }
  const ro=!canEditContact(c), dis=ro?"disabled":"";
  return shell(key,"Contact",`<div class="dh"><h2>${c?esc(c.name):"New contact"}</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    ${c?`<div class="hint">Added by ${esc(nameOf(c.createdBy))} ${c.createdAt?agoPhrase(c.createdAt):""}</div>`:""}<div id="staleBox">${staleHtml(c)}</div>
    <form class="box" id="contactForm" novalidate>
      <label class="f"><span class="lh">Name<span class="req">*</span></span><input id="oName" dir="auto" value="${esc(d.name)}" ${dis} data-autofocus></label>
      <div class="grid2"><label class="f">Organization<input id="oOrg" dir="auto" value="${esc(d.org)}" placeholder="Company, lab, NGO" ${dis}></label><label class="f">Role<input id="oRole" dir="auto" value="${esc(d.role)}" placeholder="CEO · PI · Program manager" ${dis}></label>
        <label class="f">Kind<select id="oKind" ${dis}>${CKINDS.map(([k,l])=>`<option value="${k}" ${d.kind===k?"selected":""}>${l}</option>`).join("")}</select></label><label class="f">Our contact person<select id="oOwner" ${dis}>${peopleOpts(d.owner,"Nobody yet")}</select></label>
        <label class="f">Email<input id="oEmail" type="email" value="${esc(d.email)}" ${dis}></label><label class="f">Phone<input id="oPhone" type="tel" value="${esc(d.phone)}" ${dis}></label>
        <label class="f">Last contact<input id="oLast" type="date" value="${esc(d.lastContact)}" ${dis}></label></div>
      <label class="f">Notes<textarea id="oNotes" rows="4" dir="auto" placeholder="How we know them, what we talked about, what they could help with" ${dis}>${esc(d.notes)}</textarea></label>
      <div id="oErr"></div>
      <div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">${c?"Save changes":"Add contact"}</button>${c?`<button type="button" class="btn" data-act="contact-today">Talked to them today</button>`:""}`}${c&&c.email?`<span class="hint" style="user-select:all">${esc(c.email)}</span>`:""}<span style="flex:1"></span>${c&&!ro?`<button type="button" class="btn ghost danger" data-act="del">Delete</button>`:""}</div>
      ${ro?"":delBlock("Move this contact to the Trash?")}</form>`);
}
async function submitContact(today){ const D=S.drawer; const name=$("#oName").value.trim(); if(!name){ $("#oErr").innerHTML=`<div class="dup">Add a name first.</div>`; return; }
  const data={name,org:$("#oOrg").value.trim(),role:$("#oRole").value.trim(),kind:$("#oKind").value,owner:$("#oOwner").value,email:$("#oEmail").value.trim(),phone:$("#oPhone").value.trim(),lastContact:today?todayS():$("#oLast").value,notes:$("#oNotes").value.trim(),...stamp()};
  if(D.id){ if(await upd("contacts",D.id,data)){ if(today) logAct("talked to",name); closeDrawer(); toast("Saved."); } }
  else { const id=await add("contacts",Object.assign(data,{createdBy:S.meId,createdAt:Date.now()})); if(id){ logAct("added a contact:",name); closeDrawer(); toast("Contact added."); } }
}

// ───────── actions ─────────
async function vote(id,val){
  if(!S.canWrite) return; const it=S.items.find(i=>i.id===id); if(!it) return; const nv=(it.votes||{})[S.meId]===val?0:val;
  if(await upd("items",id,{votes:{[S.meId]:nv}})&&nv===1){ logAct("upvoted",it.title,id);
    const ups=Object.entries(Object.assign({},it.votes,{[S.meId]:1})).filter(([,v])=>v===1).length;
    if(ups>=2&&["found","shortlist","writing"].includes(it.status||"found")&&await upd("items",id,{status:"issue",...stamp()})){ logAct("auto-added to the issue:",it.title,id); toast("Two 👍 — moved into this issue."); } }
}
async function moveStage(id,stage){ const it=S.items.find(i=>i.id===id); if(!it||(it.status||"found")===stage) return; if(stage==="archived"&&!canEditItem(it)){ toast("Only an admin or the person who added it can archive this."); return; }
  if(await upd("items",id,{status:stage,...stamp()})) logAct(`moved to ${STAGE[stage]}:`,it.title,id); }
async function moveInSection(id,sec,dir){ const list=issueItems()[sec]; const ix=list.findIndex(i=>i.id===id); const j=ix+dir; if(ix<0||j<0||j>=list.length) return;
  const arr=list.slice(); [arr[ix],arr[j]]=[arr[j],arr[ix]]; for(let k=0;k<arr.length;k++){ if(arr[k].order!==k&&!await upd("items",arr[k].id,{order:k})) return; } }
function shiftDate(s,rec){ const d=parseD(s); if(!d) return ""; if(rec==="weekly") d.setDate(d.getDate()+7); else if(rec==="monthly") d.setMonth(d.getMonth()+1); else if(rec==="yearly") d.setFullYear(d.getFullYear()+1); return ymd(d); }
async function sendIssue(){
  const st=settings(); const its=A("items").filter(i=>i.status==="issue"); const text=composeText(); const n=st.nextIssue; const sentAt=Date.now();
  try{
    await S.db.collection("issues").doc("issue-"+n).set({number:n,text,itemIds:its.map(i=>i.id),intro:st.draftIntro||"",sentAt,sentBy:S.meId});
    try{ await S.db.collection("published").doc("issue-"+n).set({number:n,text,sentAt,name:st.name,events:its.filter(i=>i.date).map(i=>({title:i.title,date:i.date,location:i.location||"",url:i.url||"",summary:i.summary||"",type:i.type}))}); }catch{}
    for(const i of its){ await S.db.collection("items").doc(i.id).update({status:"archived",issueNo:n,order:null,...stamp()});
      if(i.recurring&&i.recurring!=="none"){ const c=JSON.parse(JSON.stringify(i)); delete c.id; Object.assign(c,{status:"found",issueNo:null,votes:{},comments:{},owner:null,order:null,date:shiftDate(i.date,i.recurring),deadline:shiftDate(i.deadline,i.recurring),createdAt:Date.now(),...stamp(),addedBy:S.meId,tags:[...new Set([...(i.tags||[]),"recurring"])]}); await S.db.collection("items").add(c); } }
    await saveSettings({nextIssue:n+1,draftIntro:""}); logAct("sent issue",`#${n} (${plural(its.length,"item")})`,null); toast(`Issue #${n} archived and published. On to #${n+1}.`);
  }catch(e){ writeErr(e); }
}
async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast("Copied. Paste it into WhatsApp."); }catch{ const ta=document.createElement("textarea"); ta.value=t; ta.style.position="fixed"; ta.style.opacity="0"; document.body.append(ta); ta.select(); let ok=false; try{ok=document.execCommand("copy");}catch{} ta.remove(); toast(ok?"Copied. Paste it into WhatsApp.":"Couldn't copy automatically. Select the preview text and copy it."); } }
async function acceptSuggestion(id){ const s=S.suggestions.find(x=>x.id===id); if(!s) return;
  const now=Date.now(); const iid=await saveItem(null,{type:s.date?"event":"opportunity",title:s.title,url:s.url||"",summary:s.note||"",date:s.date||"",location:s.location||"",city:"",audience:"All",recurring:"none",sourceId:"",online:/online/i.test(s.location||""),tags:["suggested"],status:"found",suggestedBy:s.name||"a student",addedBy:S.meId,owner:null,votes:{},comments:{},createdAt:now,...stamp()},true).catch(()=>null);
  if(iid){ try{ await S.db.collection("suggestions").doc(id).delete(); }catch{} logAct("added a student suggestion:",s.title,iid); toast("Added to Found on the pipeline."); } }

// backup
async function exportBackup(){ const out={app:"nucleate-technion-desk",version:1,exportedAt:new Date().toISOString(),meta:{settings:S.settings,access:S.access},collections:{}};
  for(const c of COLS) out.collections[c]=S[c]!==undefined? S[c].map(x=>({...x})) : [];
  out.collections.users=S.known.map(id=>({id,...(S.profiles[id]?{name:S.profiles[id].name,email:S.profiles[id].email}:{})}));
  downloadFile(`nucleate-backup-${todayS()}.json`, JSON.stringify(out,null,1), "application/json"); await saveSettings({lastBackup:Date.now()}); toast("Backup downloaded. Keep it somewhere safe."); }
async function importBackup(file){ let data; try{ data=JSON.parse(await file.text()); }catch{ toast("That file isn't a backup from this site."); return; }
  if(!data||data.app!=="nucleate-technion-desk"||!data.collections){ toast("That file isn't a backup from this site."); return; }
  const box=$("#restoreMsg"); let n=0, fail=0;
  for(const c of COLS){ if(c==="users") continue; for(const x of data.collections[c]||[]){ const {id,...rest}=x; if(!id) continue; try{ await S.db.collection(c).doc(id).set(rest); n++; }catch{ fail++; } if(box&&n%20===0) box.textContent=`Restoring… ${n} done`; } }
  try{ if(data.meta&&data.meta.settings) await S.db.doc("meta/settings").set(data.meta.settings); if(data.meta&&data.meta.access) await S.db.doc("meta/access").set(data.meta.access); }catch{ fail++; }
  if(box) box.textContent=""; logAct("restored a backup",`${n} records`); toast(fail?`Restored ${n} records; ${fail} couldn't be written.`:`Restored ${n} records.`); }

// ───────── events ─────────
document.addEventListener("click", async e=>{
  const t=e.target.closest("[data-act],[data-open],[data-meet],[data-plan],[data-task],[data-contact],[data-vote],[data-next],[data-pnext],[data-check],[data-delsrc],[data-move],[data-copyissue],[data-cal],[data-day],[data-done],[data-tf],[data-rsvp],[data-pstage],[data-ck],[data-ckdel],[data-mention],[data-restore],[data-purge],[data-sugg-ok],[data-sugg-no]");
  if(!t){ if(e.target.classList.contains("scrim")) closeDrawer(); return; }
  const ds=t.dataset;
  if(ds.done!==undefined&&t.tagName==="INPUT"){ toggleTask(ds.done); return; }
  if(ds.done!==undefined){ await toggleTask(ds.done); closeDrawer(); return; }
  if(ds.next){ const it=S.items.find(i=>i.id===ds.next); const ns=it&&nextStage(it.status); if(ns){ await moveStage(it.id,ns); toast(`Moved to ${STAGE[ns]}.`); } return; }
  if(ds.pnext){ const p=S.plans.find(x=>x.id===ds.pnext); const ix=PSTAGES.findIndex(x=>x[0]===(p.stage||"idea")); const ns=PSTAGES[ix+1]; if(ns&&await upd("plans",p.id,{stage:ns[0],...stamp()})){ logAct(`moved event to ${ns[1]}:`,p.title); } return; }
  if(ds.vote){ vote(ds.id,Number(ds.vote)); return; }
  if(ds.open){ e.preventDefault(); openItem(ds.open); return; }
  if(ds.meet){ e.preventDefault(); openMeeting(ds.meet); return; }
  if(ds.plan){ e.preventDefault(); openPlan(ds.plan); return; }
  if(ds.task){ e.preventDefault(); openTask(ds.task); return; }
  if(ds.contact){ openContact(ds.contact); return; }
  if(ds.tf){ S.tf=ds.tf; render(); return; }
  if(ds.rsvp){ const id=S.drawer&&S.drawer.id; const mt=S.meetings.find(x=>x.id===id); if(!mt) return; const cur=(mt.rsvp||{})[S.meId]; await upd("meetings",id,{rsvp:{[S.meId]:cur===ds.rsvp?null:ds.rsvp},...stamp()}); S.drawer.base=null; return; }
  if(ds.pstage){ S.drawer.draft.stage=ds.pstage; readPlan(); bump(); return; }
  if(ds.ck&&t.tagName==="INPUT"){ const p=S.plans.find(x=>x.id===S.drawer.id); const c=(p.checklist||{})[ds.ck]; if(c){ await upd("plans",p.id,{checklist:{[ds.ck]:{done:!c.done,by:S.meId}},...stamp()}); S.drawer.base=null; if(!c.done) logAct(`ticked “${c.text}” for`,p.title); } return; }
  if(ds.ckdel){ const p=S.plans.find(x=>x.id===S.drawer.id); const ck=Object.assign({},p.checklist); delete ck[ds.ckdel]; try{ await S.db.collection("plans").doc(p.id).set(Object.assign({},p,{checklist:ck},stamp(),{id:undefined})); S.drawer.base=null; }catch(er){ writeErr(er); } return; }
  if(ds.mention){ const inp=$("#"+ds.target); if(inp){ const n="@"+firstName(ds.mention)+" "; inp.value=(inp.value&&!/\s$/.test(inp.value)?inp.value+" ":inp.value)+n; inp.focus(); } return; }
  if(ds.restore){ const [c,id]=ds.restore.split(":"); restore(c,id); return; }
  if(ds.purge){ const [c,id]=ds.purge.split(":"); try{ await S.db.collection(c).doc(id).delete(); toast("Deleted for good."); }catch(er){ writeErr(er); } return; }
  if(ds.suggOk){ acceptSuggestion(ds.suggOk); return; }
  if(ds.suggNo){ try{ await S.db.collection("suggestions").doc(ds.suggNo).delete(); toast("Dismissed."); }catch(er){ writeErr(er); } return; }
  if(ds.cal!==undefined){ const n=Number(ds.cal); if(n===0){ const d=new Date(); S.cal.y=d.getFullYear(); S.cal.m=d.getMonth(); S.cal.sel=todayS(); } else { const d=new Date(S.cal.y,S.cal.m+n,1); S.cal.y=d.getFullYear(); S.cal.m=d.getMonth(); } render(); return; }
  if(ds.day){ S.cal.sel = S.cal.sel===ds.day? null : ds.day; const d=parseD(ds.day); if(d.getMonth()!==S.cal.m){ S.cal.y=d.getFullYear(); S.cal.m=d.getMonth(); } render(); return; }
  if(ds.check){ const s=S.sources.find(x=>x.id===ds.check); if(await upd("sources",ds.check,{lastChecked:Date.now(),lastCheckedBy:S.meId})) logAct("checked source",s&&s.name); return; }
  if(ds.delsrc){ const s=S.sources.find(x=>x.id===ds.delsrc); try{ await S.db.collection("sources").doc(ds.delsrc).delete(); logAct("removed source",s&&s.name); }catch(er){writeErr(er);} return; }
  if(ds.move){ moveInSection(ds.move,ds.sec,Number(ds.dir)); return; }
  if(ds.copyissue){ const is=S.issues.find(x=>x.id===ds.copyissue); is&&copyText(is.text); return; }
  const a=ds.act; const D=S.drawer;
  if(a==="new") openItem(null, ds.date?{date:ds.date,type:"event"}:null);
  else if(a==="new-meeting") openMeeting(null, ds.date);
  else if(a==="new-plan") openPlan(null, ds.date);
  else if(a==="new-contact") openContact(null);
  else if(a==="close"){ closeDrawer(); }
  else if(a==="settings") openSettings();
  else if(a==="mine"){ S.f.who = S.f.who===S.meId? "" : S.meId; render(); }
  else if(a==="ics") icsExport();
  else if(a==="reload"){ const fn={item:openItem,meeting:openMeeting,task:openTask,plan:openPlan,contact:openContact}[D.kind]; fn(D.id); }
  else if(a==="claim"||a==="unclaim"){ const it=S.items.find(i=>i.id===D.id); readItemForm(); if(await upd("items",D.id,{owner:a==="claim"?S.meId:null})){ if(a==="claim"){ logAct("is writing",it.title,D.id); if((it.status||"found")!=="issue"&&it.status!=="archived"&&await upd("items",D.id,{status:"writing",...stamp()})) D.draft.status="writing"; } D.draft.owner=a==="claim"?S.meId:null; D.base=null; bump(); } }
  else if(a==="del"){ S.drawer.confirmDel=true; bump(); }
  else if(a==="del-no"){ S.drawer.confirmDel=false; bump(); }
  else if(a==="del-yes"){ trash({item:"items",meeting:"meetings",task:"tasks",plan:"plans",contact:"contacts"}[D.kind], D.id); }
  else if(a==="plan-to-news"){ const p=S.plans.find(x=>x.id===D.id); openItem(null,{type:"event",title:p.title,date:p.date,location:p.location,url:p.link||"",summary:""}); S.drawer.fromPlan=p.id; }
  else if(a==="contact-today") submitContact(true);
  else if(a==="rm"){ S.confirmRemove=ds.email; render(); }
  else if(a==="rm-no"){ S.confirmRemove=null; render(); }
  else if(a==="rm-yes"){ const em=ds.email; S.confirmRemove=null; if(await saveAccess(accessList("admins").filter(e=>e!==em),accessList("members").filter(e=>e!==em))){ logAct("removed from the team:",em); toast(`${em} no longer has access.`); } }
  else if(a==="copy-issue") copyText(composeText());
  else if(a==="send-issue"){ const n=settings().nextIssue; $("#sendConfirm").innerHTML=`<div class="confirm">Archive issue #${n} and its ${A("items").filter(i=>i.status==="issue").length} items, and publish it on the public page? Recurring items come back for next time. <button class="btn sm pri" data-act="send-yes">Yes, mark sent</button><button class="btn sm" data-act="send-no">Not yet</button></div>`; }
  else if(a==="send-yes") sendIssue();
  else if(a==="send-no") $("#sendConfirm").innerHTML="";
  else if(a==="save-settings"){ const name=$("#stName").value.trim()||"Nucleate Technion Weekly", footer=$("#stFooter").value; await saveSettings({name,footer}); closeDrawer(); toast("Settings saved."); }
  else if(a==="backup") exportBackup();
  else if(a==="restore-pick") $("#restoreFile").click();
  else if(a==="restore-yes"){ const f=$("#restoreFile").files[0]; if(f) importBackup(f); $("#restoreConfirm").innerHTML=""; }
  else if(a==="restore-no"){ $("#restoreConfirm").innerHTML=""; $("#restoreFile").value=""; }
  else if(a==="copy-public"){ copyText(new URL("public.html",location.href).href).then(()=>toast("Public page link copied.")); }
  else if(a==="go-trash"){ closeDrawer(); location.hash="trash"; }
});
document.addEventListener("keydown", e=>{ if(e.key==="Escape"&&$("#layer").querySelector(".scrim")) closeDrawer();
  if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches(".ag[role=button],.row[role=button]")){ e.preventDefault(); e.target.click(); } });
document.addEventListener("submit", async e=>{
  e.preventDefault(); const f=e.target, id=f.id;
  if(f.classList.contains("taskAdd")) return addTask(f);
  if(id==="itemForm") submitItem(); else if(id==="meetForm") submitMeeting(); else if(id==="taskForm") submitTask(); else if(id==="planForm") submitPlan(); else if(id==="contactForm") submitContact(false);
  else if(id==="quickForm"){ const u=$("#quickUrl").value.trim(); if(!u) return; $("#quickUrl").value=""; openItem(null,{url:/^https?:\/\//i.test(u)?u:"https://"+u}); }
  else if(id==="ckForm"){ const inp=$("#ckText"); const text=inp.value.trim(); if(!text) return; const p=S.plans.find(x=>x.id===S.drawer.id); const k="c"+Date.now().toString(36);
    inp.value=""; inp.blur(); if(await upd("plans",p.id,{checklist:{[k]:{text,done:false,at:Date.now()}},...stamp()})) S.drawer.base=null; }
  else if(id==="cForm"){ const inp=$("#cText"); const text=inp.value.trim(); if(!text) return; const iid=S.drawer.id, it=S.items.find(i=>i.id===iid); const cid="c"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); const mentions=mentionsIn(text);
    inp.value=""; if(await upd("items",iid,{comments:{[cid]:{by:S.meId,text:text.slice(0,2000),at:Date.now(),mentions}}})) logAct(mentions.length?`mentioned ${mentions.map(firstName).join(", ")} on`:"commented on",it.title,iid); else inp.value=text; }
  else if(id==="accessForm"){ const em=$("#accEmail").value.trim().toLowerCase(); const list=$("#accRole").value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ toast("Enter a full email address."); return; }
    if(em===ownerEmail()||accessList("admins").includes(em)||accessList("members").includes(em)){ toast("That person already has access. Change their role in the list."); return; }
    const ad=accessList("admins"), mb=accessList("members"); (list==="admins"?ad:mb).push(em);
    if(await saveAccess(ad,mb)){ logAct(list==="admins"?"added an admin:":"added a member:",em); toast(`Added ${em}. Send them the site link.`); $("#accEmail").value=""; } }
  else if(id==="srcForm"){ const name=$("#sName").value.trim(); if(!name) return; const url=$("#sUrl").value.trim();
    if(url&&S.sources.some(s=>normUrl(s.url)===normUrl(url))){ toast("That source is already in the library."); return; }
    try{ await S.db.collection("sources").add({name,url,kind:$("#sKind").value,freq:Number($("#sFreq").value),lastChecked:0,lastCheckedBy:null,addedBy:S.meId,createdAt:Date.now()}); logAct("added source",name); f.reset(); }catch(er){writeErr(er);} }
});
document.addEventListener("input", e=>{
  if(e.target.id==="fq"){ S.f.q=e.target.value; clearTimeout(S._qT); S._qT=setTimeout(()=>{ render(); requestAnimationFrame(()=>{ const q=$("#fq"); if(q){ q.focus(); q.setSelectionRange(q.value.length,q.value.length);} }); },200); }
  if(e.target.id==="cq"){ S.cf.q=e.target.value; clearTimeout(S._cT); S._cT=setTimeout(render,200); }
});
document.addEventListener("change", e=>{
  const id=e.target.id, ds=e.target.dataset;
  if(id==="ftype"){S.f.type=e.target.value;render();} else if(id==="fwho"){S.f.who=e.target.value;render();} else if(id==="ftag"){S.f.tag=e.target.value;render();} else if(id==="ckind"){S.cf.kind=e.target.value;render();}
  else if(id==="intro"){ saveSettings({draftIntro:e.target.value}); }
  else if(id==="dUrl"){ const u=e.target.value.trim(); if(u&&S.drawer&&!S.drawer.id){ readItemForm(); if(!S.drawer.draft.title) fetchMeta(u); } }
  else if(e.target.name==="dType"&&S.drawer){ readItemForm(); bump(); }
  else if(id==="dStatus"&&ds.quickstage&&S.drawer){ const st=e.target.value; moveStage(S.drawer.id,st).then(()=>{ if(S.drawer){ S.drawer.draft.status=st; toast(`Moved to ${STAGE[st]}.`);} }); }
  else if(id==="restoreFile"&&e.target.files[0]){ $("#restoreConfirm").innerHTML=`<div class="confirm">Restore “${esc(e.target.files[0].name)}”? Records in the file overwrite the current versions with the same ID; nothing else is deleted. <button class="btn sm danger" data-act="restore-yes">Restore</button><button class="btn sm" data-act="restore-no">Cancel</button></div>`; }
  else if(ds.access){ changeRole(ds.access, e.target.value); }
  else if(ds.owner){ const owners=Object.assign({},settings().owners,{[ds.owner]:e.target.value||null}); saveSettings({owners}); }
});
let dragId=null;
document.addEventListener("dragstart", e=>{ const c=e.target.closest&&e.target.closest(".card[draggable=true]"); if(!c) return; dragId=c.dataset.id; e.dataTransfer.effectAllowed="move"; try{e.dataTransfer.setData("text/plain",dragId);}catch{} });
document.addEventListener("dragover", e=>{ const col=e.target.closest&&e.target.closest(".col[data-stage]"); if(!col||!dragId) return; e.preventDefault(); document.querySelectorAll(".col.over").forEach(c=>c!==col&&c.classList.remove("over")); col.classList.add("over"); });
document.addEventListener("dragleave", e=>{ const col=e.target.closest&&e.target.closest(".col"); if(col&&!col.contains(e.relatedTarget)) col.classList.remove("over"); });
document.addEventListener("drop", e=>{ const col=e.target.closest&&e.target.closest(".col[data-stage]"); document.querySelectorAll(".col.over").forEach(c=>c.classList.remove("over")); if(!col||!dragId) return; e.preventDefault(); moveStage(dragId,col.dataset.stage); dragId=null; });
document.addEventListener("dragend", ()=>{ dragId=null; document.querySelectorAll(".col.over").forEach(c=>c.classList.remove("over")); });

function openSettings(){
  S.drawer=null; const st=settings(); const L=$("#layer"); L.querySelector(".scrim")?.remove(); const admin=isAdmin(); const trashN=Object.keys(TRASHABLE).reduce((n,c)=>n+S[c].filter(x=>x.deleted).length,0);
  const el=document.createElement("div"); el.className="scrim"; el.dataset.kind="settings"; el.innerHTML=`<div class="drawer" role="dialog" aria-modal="true" aria-label="Settings"><div class="dh"><h2>Settings</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    ${admin?`<div class="box"><h3>Newsletter</h3><label class="f">Newsletter name<input id="stName" dir="auto" value="${esc(st.name)}"></label>
    <label class="f">Sign-off line at the bottom of each issue<textarea id="stFooter" rows="2" dir="auto">${esc(st.footer)}</textarea></label><div><button class="btn pri" data-act="save-settings">Save</button></div></div>`:""}
    <div class="box"><h3>Public page</h3><p class="sub" style="margin:0">Anyone can open it without signing in. It shows published issues, upcoming events from them, and a form where students suggest items. Suggestions land in your Suggestions inbox.</p><div class="toolbar" style="margin:0"><a class="btn" href="public.html" target="_blank" rel="noopener">Open public page ↗</a><button class="btn" data-act="copy-public">Copy link</button></div></div>
    <div class="box"><h3>Calendar</h3><p class="sub" style="margin:0">Download every meeting, event and dated item as one file. Open it on your computer or phone to add them all to Google Calendar, Apple Calendar or Outlook. Download it again when things change.</p><div><button class="btn" data-act="ics">⤓ Download calendar file</button></div></div>
    <div class="box"><h3>Trash</h3><p class="sub" style="margin:0">${plural(trashN,"thing")} in the Trash. Deleted things are kept for 30 days.</p><div><button class="btn" data-act="go-trash">Open Trash</button></div></div>
    ${admin?`<div class="box"><h3>Backup</h3><p class="sub" style="margin:0">Download everything as one file, about once a week or before uploading a new version of the site. ${st.lastBackup?`Last backup ${agoPhrase(st.lastBackup)}.`:"No backup yet."}</p>
      <div class="toolbar" style="margin:0"><button class="btn pri" data-act="backup">⤓ Download backup</button><button class="btn" data-act="restore-pick">Restore from a backup…</button><input type="file" id="restoreFile" accept="application/json,.json" hidden></div><div id="restoreConfirm"></div><div id="restoreMsg" class="hint"></div></div>`:""}
    <div class="box"><h3>Install on your phone</h3><p class="sub" style="margin:0"><b>iPhone:</b> open the site in Safari → Share → Add to Home Screen. <b>Android:</b> open it in Chrome → ⋮ menu → Install app (or Add to Home screen).</p></div>
    ${admin?`<div class="box"><h3>Adding a teammate</h3><p class="sub" style="margin:0">Go to the <a href="#team" data-act="close">Team</a> tab and add their Google email under "Who has access".</p></div>`:""}
  </div>`;
  L.append(el);
}

// ───────── routing + boot ─────────
const ALLV=["home","inbox","board","calendar","tasks","events","contacts","places","issue","sources","team","archive","trash"];
function route(){ const h=location.hash.replace("#",""); S.view=ALLV.includes(h)?h:"home"; render(); }
window.addEventListener("hashchange",route);
window.addEventListener("people-changed",e=>{ S.known=e.detail||[]; S.profiles={}; render(); });
async function boot(){
  route();
  if(!window.claude||!window.claude.use){ render(); return; }
  const [db,user]=await Promise.all([claude.use("db"),claude.use("user")]);
  S.db=db; S.user=user;
  if(user){ S.meId=await user.id(); S.myEmail=user.email? await user.email() : ""; const w=await user.can("data.write"); if(w===false) S.canWrite=false; }
  if(!S.meId) S.canWrite=false;
  if(!db){ render(); return; }
  const onErr=e=>{ if(e&&e.code==="revoked"){ S.db=null; render(); } };
  const sub=(name,q)=>(q||db.collection(name)).onSnapshot(s=>{ S[name]=s.docs.map(d=>Object.assign({id:d.id},d.data())); render(); },onErr);
  ["items","sources","issues","meetings","tasks","plans","contacts","suggestions"].forEach(n=>sub(n));
  sub("activity",db.collection("activity").orderBy("at","desc").limit(80));
  db.doc("meta/settings").onSnapshot(s=>{ S.settings=s.exists? s.data() : null; render(); },onErr);
  db.doc("meta/access").onSnapshot(s=>{ S.access=s.exists? s.data() : null; render(); },onErr);
  render();
}
window.__startApp = boot;
if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
