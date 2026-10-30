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
const people = () => { const s=new Set(); if(S.meId) s.add(S.meId); S.known.forEach(id=>s.add(id)); S.items.forEach(i=>{i.addedBy&&s.add(i.addedBy); iOwners(i).forEach(o=>s.add(o));}); return [...s]; };
const peopleOpts = (sel, blank) => (blank?`<option value="">${esc(blank)}</option>`:"")+people().map(id=>`<option value="${esc(id)}" ${sel===id?"selected":""}>${esc(nameOf(id))}${id===S.meId?" (you)":""}</option>`).join("");
const arr = v => Array.isArray(v)? v.filter(Boolean) : (v? [v] : []);
const tAss = t => (t.assignees&&t.assignees.length)? t.assignees : arr(t.assignee);
const iOwners = i => (i.owners&&i.owners.length)? i.owners : arr(i.owner);
const cOwners = c => (c.owners&&c.owners.length)? c.owners : arr(c.owner);
const rUids = r => r? ((r.uids&&r.uids.length)? r.uids : arr(r.uid)) : [];
const gOwners = g => (g.owners&&g.owners.length)? g.owners : arr(g.owner);
const runWho = x => (x.whos&&x.whos.length)? x.whos : arr(x.who);
const secOwners = k => arr((settings().owners||{})[k]);
const andList = a => a.length<=1? (a[0]||"") : a.slice(0,-1).join(", ")+" and "+a[a.length-1];
const whoHtml = (ids, none) => ids.length? ids.map(avImg).join("")+`<span>${esc(andList(ids.map(firstName)))}</span>` : (none||`<span>Unassigned</span>`);
// Multi-person picker: tap names to add/remove people. Value lives in a hidden input (comma-separated ids).
function pick(key, sel, opt={}){ sel=arr(sel); return `<div class="ppick" role="group" aria-label="${esc(opt.label||"People")}" data-pp="${esc(key)}" data-default="${esc(sel.join(","))}"${opt.save?` data-ppsave="${esc(opt.save)}"`:""}>${people().map(id=>`<button type="button" class="pp" data-ppid="${esc(id)}" aria-pressed="${sel.includes(id)}" ${opt.dis?"disabled":""}>${avImg(id)}<span>${esc(firstName(id))}</span></button>`).join("")||`<span class="hint">No teammates yet</span>`}<input type="hidden" name="${esc(opt.name||key)}" value="${esc(sel.join(","))}"></div>`; }
const pickVal = box => box? (box.querySelector("input[type=hidden]").value||"").split(",").filter(Boolean) : [];
function pickSet(box, ids){ if(!box) return; box.querySelector("input[type=hidden]").value=ids.join(","); box.querySelectorAll(".pp").forEach(b=>b.setAttribute("aria-pressed", String(ids.includes(b.dataset.ppid)))); }
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
const canEditPlan = p => S.canWrite && (!p || isAdmin() || p.createdBy===S.meId || pLeads(p).includes(S.meId) || (p.team||[]).includes(S.meId));
const canEditContact = c => S.canWrite && (!c || isAdmin() || c.createdBy===S.meId || cOwners(c).includes(S.meId));
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
function views(){ const v=[["home","Home"],["board","Pipeline"],["issue","This issue"],["calendar","Calendar"],["tasks","Tasks"],["events","Event planner"],["contacts","Contacts"],["sources","Sources"],["places","Places"],["team","Team"],["archive","Archive"]];
  if(A("suggestions").length) v.splice(1,0,["inbox","Suggestions"]); return v; }
function doRender(){
  $("#who").innerHTML = S.meId ? avImg(S.meId)+`<span>${esc(nameOf(S.meId))}</span>${S.myEmail&&roleOf(S.myEmail)?`<span class="chip" style="background:rgba(255,255,255,.1);color:var(--band-ink)">${esc(roleOf(S.myEmail))}</span>`:""}` : "";
  $("#btnNew").hidden = !S.canWrite || !S.db; $("#btnSettings").hidden = !S.db;
  const myOpen=A("tasks").filter(t=>!t.done&&tAss(t).includes(S.meId)).length;
  const counts = {board:A("items").filter(i=>i.status!=="archived").length, calendar:upcoming(30).length, places:A("items").filter(i=>i.status!=="archived"&&i.location).length, issue:A("items").filter(i=>i.status==="issue").length,
    sources:S.sources.length, archive:S.issues.length, tasks:myOpen, events:A("plans").filter(p=>p.stage!=="done").length, contacts:A("contacts").length, inbox:A("suggestions").length};
  $("#tabs").innerHTML = S.db ? views().map(([k,l])=>`<a href="#${k}" ${S.view===k||(S.view==="event"&&k==="events")?'aria-current="page"':""}>${l}${counts[k]?`<span class="n">${counts[k]}</span>`:""}</a>`).join("") : "";
  const m=$("#main");
  if(!S.db){ m.innerHTML = window.__authScreen ? window.__authScreen() : `<div class="empty"><b>Opening the desk…</b></div>`; window.__mountDNA&&window.__mountDNA(); return; }
  const banner = S.canWrite ? "" : `<div class="banner">Your account can't save changes. Ask an admin to add you on the Team page.</div>`;
  const v = {event:vEvent,home:vHome,inbox:vInbox,board:vBoard,calendar:vCalendar,tasks:vTasks,events:vEvents,contacts:vContacts,places:vPlaces,issue:vIssue,sources:vSources,team:vTeam,archive:vArchive,trash:vTrash}[S.view]||vHome;
  // Keep whatever someone is typing when live updates from teammates re-draw the page.
  const y=window.scrollY; const ae=document.activeElement; const focusKey=ae&&m.contains(ae)?fieldKey(ae):null; let sel=null; try{ sel=focusKey&&ae.selectionStart!=null?[ae.selectionStart,ae.selectionEnd]:null; }catch{}
  const edited={}; m.querySelectorAll("input,textarea,select").forEach(el=>{ const k=fieldKey(el); if(!k) return; if(el.type==="checkbox"||el.type==="radio"){ if(el.checked!==el.defaultChecked) edited[k]={c:el.checked}; } else if(el.tagName==="SELECT"){ const o=el.options[el.selectedIndex]; if(o&&!o.defaultSelected&&el.dataset.dirty) edited[k]={v:el.value}; } else if(el.value!==el.defaultValue) edited[k]={v:el.value}; });
  const picks={}; m.querySelectorAll(".ppick[data-dirty]").forEach(b=>picks[b.dataset.pp]=pickVal(b));
  m.innerHTML = banner + v(); window.scrollTo(0,y);
  m.querySelectorAll(".ppick").forEach(b=>{ if(picks[b.dataset.pp]){ pickSet(b,picks[b.dataset.pp]); b.dataset.dirty="1"; } });
  m.querySelectorAll("input,textarea,select").forEach(el=>{ const k=fieldKey(el); if(!k) return; const e=edited[k]; if(e){ if("c" in e) el.checked=e.c; else el.value=e.v; if(el.tagName==="SELECT") el.dataset.dirty="1"; } if(k===focusKey){ el.focus(); try{ if(sel) el.setSelectionRange(sel[0],sel[1]); }catch{} } });
  window.__mountDNA&&window.__mountDNA();
  renderDrawer(); refreshProfiles(); purgeOld();
}
function fieldKey(el){ if(el.type==="file"||el.type==="search"&&false) return null; if(el.id) return "#"+el.id; const f=el.closest("form"); const ds=el.dataset; const tag=Object.keys(ds).filter(k=>k!=="dirty").map(k=>k+"="+ds[k]).join("&"); if(tag) return "@"+tag; if(f&&el.name) return (f.id||f.className+":"+Object.values(f.dataset).join(","))+"/"+el.name; return null; }
let profT=0; function refreshProfiles(){
  if(!S.user) return; const ids=people().filter(id=>!S.profiles[id]); if(!ids.length) return;
  clearTimeout(profT); profT=setTimeout(async()=>{ try{ const ps=await S.user.profiles(ids); let ch=false; for(const id in ps){ if(!S.profiles[id]||S.profiles[id].name!==ps[id].name){S.profiles[id]=ps[id]; ch=true;} } if(ch) render(); }catch{} },50);
}

// ───────── calendar data ─────────
const PLAN_COLOR="var(--m-plan)";
const REPEATS=[["none","Doesn't repeat"],["weekly","Every week"],["biweekly","Every 2 weeks"],["monthly","Every month, same date"],["monthly-wd","Every month, same weekday"]];
const REPEAT=Object.fromEntries(REPEATS);
const isSeries = mt => mt && mt.repeat && mt.repeat!=="none";
const shiftS = (s,n) => { const d=parseD(s); d.setDate(d.getDate()+n); return ymd(d); };
function addMonthsClamp(d,n){ const r=new Date(d.getFullYear(),d.getMonth()+n,1); const last=new Date(r.getFullYear(),r.getMonth()+1,0).getDate(); r.setDate(Math.min(d.getDate(),last)); return r; }
function nthWeekday(base,n){ const wd=base.getDay(), nth=Math.floor((base.getDate()-1)/7); const r=new Date(base.getFullYear(),base.getMonth()+n,1); let day=1+((wd-r.getDay()+7)%7)+7*nth; const last=new Date(r.getFullYear(),r.getMonth()+1,0).getDate(); if(day>last) day-=7; r.setDate(day); return r; }
const ordinal = n => ["1st","2nd","3rd","4th","5th"][n]||n+"th";
function repeatLabel(mt){ if(!isSeries(mt)) return ""; const d=parseD(mt.date); let l=REPEAT[mt.repeat]||"Repeats";
  if(mt.repeat==="weekly") l="Every "+d.toLocaleDateString("en-GB",{weekday:"long"}); else if(mt.repeat==="biweekly") l="Every other "+d.toLocaleDateString("en-GB",{weekday:"long"});
  else if(mt.repeat==="monthly"){ const n=d.getDate(); l="Monthly on the "+n+((n%10===1&&n!==11)?"st":(n%10===2&&n!==12)?"nd":(n%10===3&&n!==13)?"rd":"th"); }
  else if(mt.repeat==="monthly-wd") l="Monthly on the "+ordinal(Math.floor((d.getDate()-1)/7))+" "+d.toLocaleDateString("en-GB",{weekday:"long"});
  return l+(mt.until?" until "+fmtD(mt.until):""); }
// Original dates ("keys") of a series between from and to.
function seriesKeys(mt, from, to){ const start=parseD(mt.date); if(!start) return []; if(!isSeries(mt)) return (mt.date>=from&&mt.date<=to)?[mt.date]:[];
  const out=[]; for(let i=0;i<800;i++){ let d; if(mt.repeat==="weekly"){ d=new Date(start); d.setDate(start.getDate()+7*i); } else if(mt.repeat==="biweekly"){ d=new Date(start); d.setDate(start.getDate()+14*i); } else if(mt.repeat==="monthly") d=addMonthsClamp(start,i); else d=nthWeekday(start,i);
    const k=ymd(d); if((mt.until&&k>mt.until)||k>to) break; if(k>=from) out.push(k); } return out; }
// One meeting date: series defaults plus any change made to that date only.
function occOf(mt, key){ const ex=isSeries(mt)?((mt.exceptions||{})[key]||{}):{}; return {key,date:ex.date||key,time:ex.time!==undefined&&ex.time!==null?ex.time:(mt.time||""),endTime:ex.endTime!==undefined&&ex.endTime!==null?ex.endTime:(mt.endTime||""),notes:ex.notes||"",skipped:ex.skipped===true,moved:!!(ex.date&&ex.date!==key),changed:!!(ex.date||ex.time!=null||ex.endTime!=null)}; }
function occurrences(mt, from, to){ if(!isSeries(mt)) return mt.date?[occOf(mt,mt.date)]:[];
  return seriesKeys(mt, shiftS(from,-120), shiftS(to,120)).map(k=>occOf(mt,k)).filter(o=>!o.skipped&&o.date>=from&&o.date<=to); }
function entries(from, to){
  from=from||shiftS(todayS(),-200); to=to||shiftS(todayS(),400);
  const out=[];
  A("items").forEach(i=>{ if(i.date) out.push({kind:"item",id:i.id,date:i.date,time:"",title:i.title,sub:[tlabel(i.type),i.location].filter(Boolean).join(" · "),color:tcol(i.type),archived:i.status==="archived",loc:i.location,url:i.url}); });
  A("meetings").forEach(mt=>{ if(!mt.date) return; const ser=isSeries(mt); occurrences(mt,from,to).forEach(o=>out.push({kind:"meeting",id:mt.id,occ:ser?o.key:"",date:o.date,time:o.time,endTime:o.endTime,title:mt.title,
    sub:[(ser?"↻ ":"")+(MKIND[mt.kind]?.label||"Meeting"),o.time?o.time+(o.endTime?"–"+o.endTime:""):"",mt.location,o.moved?"moved from "+fmtD(o.key):""].filter(Boolean).join(" · "),color:(MKIND[mt.kind]||MKIND.other).color,loc:mt.location,notes:[mt.agenda,o.notes].filter(Boolean).join("\n")})); });
  A("plans").forEach(p=>{ if(p.date) out.push({kind:"plan",id:p.id,date:p.date,time:p.time||"",title:p.title,sub:["Our event · "+(PSTAGE[p.stage]||"Idea"),p.time,p.location].filter(Boolean).join(" · "),color:PLAN_COLOR,loc:p.location}); });
  return out.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.time||"99")<(b.time||"99")?-1:1);
}
function upcoming(days){ const t=todayS(); const e=new Date(today()); e.setDate(e.getDate()+days); const end=ymd(e); return entries().filter(x=>!x.archived&&x.date>=t&&x.date<=end); }
const entryAttr = x => x.kind==="item"?`data-open="${esc(x.id)}"`:x.kind==="plan"?`data-plan="${esc(x.id)}"`:`data-meet="${esc(x.id)}"${x.occ?` data-occ="${esc(x.occ)}"`:""}`;
function agendaRow(x){ const d=parseD(x.date); return `<div class="ag" ${entryAttr(x)} style="--tc:${x.color}" role="button" tabindex="0"><span class="bar"></span><div class="dt"><div class="d">${d.getDate()}</div><div class="m">${d.toLocaleDateString("en-GB",{month:"short"})}</div></div><div class="bd"><div class="t" dir="auto">${esc(x.title)}</div><div class="s" dir="auto">${esc(DOW[d.getDay()])} · ${esc(x.sub)}</div></div></div>`; }
function icsExport(){
  const e=entries(shiftS(todayS(),-60),shiftS(todayS(),365)).filter(x=>!x.archived); const stampNow=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  const fold=s=>String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Nucleate Technion//Desk//EN","CALSCALE:GREGORIAN","X-WR-CALNAME:Nucleate Technion"];
  e.forEach(x=>{ const d=x.date.replace(/-/g,""); lines.push("BEGIN:VEVENT",`UID:${x.kind}-${x.id}${x.occ?"-"+x.occ:""}@nucleate-technion`,`DTSTAMP:${stampNow}`);
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
  return list.filter(i=>(!type||i.type===type)&&(!who||i.addedBy===who||iOwners(i).includes(who))&&(!tag||(i.tags||[]).includes(tag))&&(!ql||[i.title,i.summary,i.location,i.city,i.url,(i.tags||[]).join(" ")].join(" ").toLowerCase().includes(ql))); }
function dateChip(i){
  if(i.date){ const d=daysTo(i.date); const cls=d<0?"":d<=2?"hot":d<=7?"soon":""; return `<span class="chip ${cls}">🗓 ${d===0?"Today":d===1?"Tomorrow":fmtD(i.date)}${d<0?" · past":""}</span>`; }
  if(i.deadline){ const d=daysTo(i.deadline); if(d>=0) return `<span class="chip ${d<=3?"hot":d<=7?"soon":""}">⏳ ${d===0?"today":d+"d left"}</span>`; }
  return "";
}
function dueChip(due, done){ if(!due) return ""; const d=daysTo(due); const cls=done?"":d<0?"hot":d<=2?"soon":""; return `<span class="chip ${cls}">${d<0&&!done?"Overdue · ":""}${d===0?"Today":d===1?"Tomorrow":fmtD(due)}</span>`; }
function actRow(a){ return `<div class="ev-row">${avImg(a.by)}<div class="txt"><b>${esc(nameOf(a.by))}</b> ${esc(a.verb)} ${a.itemId&&A("items").some(i=>i.id===a.itemId)?`<a href="#" data-open="${esc(a.itemId)}" dir="auto">${esc(a.title)}</a>`:`<span dir="auto">${esc(a.title)}</span>`}</div><span class="when">${ago(a.at)}</span></div>`; }

// tasks
function taskRow(t, ctx){
  const link = !ctx && t.meetingId ? (()=>{ const m=S.meetings.find(x=>x.id===t.meetingId); return m?`<a href="#" data-meet="${esc(m.id)}"${t.occurrence?` data-occ="${esc(t.occurrence)}"`:""} class="hint">📅 ${esc(m.title)}${t.occurrence?" · "+esc(fmtD(occOf(m,t.occurrence).date)):""}</a>`:""; })()
             : !ctx && t.planId ? (()=>{ const p=S.plans.find(x=>x.id===t.planId); return p?`<a href="#" data-plan="${esc(p.id)}" class="hint">🎪 ${esc(p.title)}</a>`:""; })() : "";
  return `<div class="task ${t.done?"done":""}"><input type="checkbox" data-done="${esc(t.id)}" ${t.done?"checked":""} ${S.canWrite?"":"disabled"} aria-label="Done"><div class="grow"><a href="#" class="t" data-task="${esc(t.id)}" dir="auto">${esc(t.title)}</a><div class="meta">${whoHtml(tAss(t))}${dueChip(t.due,t.done)}${link}</div></div></div>`;
}
function taskAddForm(ctxAttr, key, def){ def=def===undefined?[S.meId]:arr(def); return S.canWrite? `<form class="taskAdd" ${ctxAttr||""}><div class="taskAddRow"><input name="title" placeholder="Add a task…" aria-label="Task" dir="auto" ${ctxAttr?"":'id="tTitle"'}><input name="due" type="date" aria-label="Due date"><button class="btn" type="submit">Add</button></div><div class="taskAddWho"><span class="hint">Who:</span>${pick("ta-"+(key||"main"),def,{name:"assignees",label:"Assign to"})}</div></form>` : ""; }
async function addTask(form){ const f=new FormData(form); const title=String(f.get("title")||"").trim(); if(!title){ toast("Write the task first."); return; }
  const ass=String(f.get("assignees")||"").split(",").filter(Boolean);
  const data={title,assignees:ass,assignee:ass[0]||"",due:String(f.get("due")||""),done:false,notes:"",meetingId:form.dataset.meeting||"",occurrence:form.dataset.occ||"",planId:form.dataset.forplan||form.dataset.plan||"",section:String(f.get("section")||""),relDays:null,createdBy:S.meId,createdAt:Date.now(),...stamp()};
  const id=await add("tasks",data); if(id){ const box=form.querySelector(".ppick"); form.reset(); form.querySelectorAll("select").forEach(x=>delete x.dataset.dirty); if(box){ pickSet(box,(box.dataset.default||"").split(",").filter(Boolean)); delete box.dataset.dirty; }
    const others=ass.filter(u=>u!==S.meId); logAct(others.length?`gave ${andList(others.map(firstName))} a task:`:"added a task:",title); toast("Task added."); } }
async function toggleTask(id){ const t=S.tasks.find(x=>x.id===id); if(!t) return; const done=!t.done; if(await upd("tasks",id,{done,doneAt:done?Date.now():null,doneBy:done?S.meId:null,...stamp()})&&done) logAct("finished",t.title); }

// mentions
function mentionsIn(text){ const out=[]; people().forEach(id=>{ const n=nameOf(id); if(!n||n==="Teammate"||n==="You") return; const first=n.split(" ")[0]; if(text.includes("@"+n)||new RegExp("@"+first.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(\\b|$)").test(text)) out.push(id); }); return [...new Set(out)]; }
function mentionChips(target){ return `<div class="mention-row"><span class="hint">Mention:</span>${people().filter(id=>id!==S.meId).map(id=>`<button type="button" class="chip mchip" data-mention="${esc(id)}" data-target="${target}">@${esc(firstName(id))}</button>`).join("")||`<span class="hint">no teammates yet</span>`}</div>`; }
function forYou(){
  const out=[]; const since=Date.now()-14*864e5;
  A("items").forEach(i=>Object.values(i.comments||{}).forEach(c=>{ if(c.at>since&&c.by!==S.meId&&(c.mentions||[]).includes(S.meId)) out.push({at:c.at,html:`${avImg(c.by)}<div class="txt"><b>${esc(firstName(c.by))}</b> mentioned you on <a href="#" data-open="${esc(i.id)}" dir="auto">${esc(i.title)}</a><div class="hint" dir="auto">“${esc(c.text.slice(0,120))}”</div></div>`}); }));
  upcoming(7).filter(x=>x.kind==="meeting").forEach(x=>{ const m=S.meetings.find(y=>y.id===x.id); const r=x.occ?((m.orsvp||{})[x.occ]||{}):(m.rsvp||{}); if(r[S.meId]) return; const d=daysTo(x.date);
    out.push({at:Date.now()-d*1000,html:`<span class="dot" style="color:${x.color};margin:8px"></span><div class="txt">Are you coming to <a href="#" ${entryAttr(x)} dir="auto">${esc(m.title)}</a>? <span class="hint">${esc(fmtDW(x.date))}${x.time?" "+esc(x.time):""}</span></div>`}); });
  return out.sort((a,b)=>b.at-a.at);
}

// ───────── views ─────────
function vHome(){
  const st=settings(); const inIssue=A("items").filter(i=>i.status==="issue").length;
  const up=upcoming(14); const nextMeet=entries().find(x=>x.kind==="meeting"&&x.date>=todayS());
  const myTasks=A("tasks").filter(t=>!t.done&&tAss(t).includes(S.meId)).sort((a,b)=>(a.due||"9")<(b.due||"9")?-1:1);
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
    <div class="foot"><div class="meta">${avImg(i.addedBy)}${iOwners(i).filter(o=>o!==i.addedBy).length?" ✎ "+iOwners(i).filter(o=>o!==i.addedBy).map(avImg).join(""):""}<span>${esc(host(i.url))}</span>${cc?`<span>💬 ${cc}</span>`:""}</div>
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
  const gEnd=new Date(start); gEnd.setDate(start.getDate()+41);
  const byDate={}; entries(ymd(start),ymd(gEnd)).forEach(x=>{ (byDate[x.date]=byDate[x.date]||[]).push(x); });
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
  if(f==="mine"){ const mine=sortT(open.filter(t=>tAss(t).includes(S.meId))); const gave=sortT(open.filter(t=>t.createdBy===S.meId&&tAss(t).length&&!tAss(t).includes(S.meId)));
    body=`<div class="panel"><div class="panel-h"><h3>Assigned to me</h3><span class="hint">${mine.length}</span></div>${mine.length?`<div class="tasks">${mine.map(t=>taskRow(t)).join("")}</div>`:`<div class="colempty">Nothing assigned to you.</div>`}</div>
      ${gave.length?`<div class="panel" style="margin-top:12px"><div class="panel-h"><h3>I asked others</h3><span class="hint">${gave.length}</span></div><div class="tasks">${gave.map(t=>taskRow(t)).join("")}</div></div>`:""}`; }
  else if(f==="all"){ const groups={}; open.forEach(t=>{ const a=tAss(t); (a.length?a:[""]).forEach(u=>(groups[u]=groups[u]||[]).push(t)); });
    const keys=Object.keys(groups).sort((a,b)=>a===""?1:b===""?-1:nameOf(a).localeCompare(nameOf(b)));
    body=keys.length? keys.map(k=>`<div class="panel" style="margin-bottom:12px"><div class="panel-h"><h3>${k?avImg(k)+" "+esc(nameOf(k)):"Unassigned"}</h3><span class="hint">${groups[k].length}</span></div><div class="tasks">${sortT(groups[k]).map(t=>taskRow(t)).join("")}</div></div>`).join("") : `<div class="empty"><b>No open tasks</b>Add one above, or create action items from a meeting.</div>`; }
  else body=done.length? `<div class="panel"><div class="tasks">${done.slice(0,60).map(t=>taskRow(t)).join("")}</div></div>` : `<div class="empty"><b>Nothing finished yet</b></div>`;
  return `<h2>Tasks</h2><p class="sub">Who's doing what. Action items from meetings and to-dos for our events show up here too.</p>
    <div class="panel" style="margin-bottom:14px">${taskAddForm()||`<div class="hint">You can't add tasks with this account.</div>`}</div>
    <div class="seg" role="tablist">${[["mine","Mine"],["all",`All open (${open.length})`],["done","Done"]].map(([k,l])=>`<button role="tab" aria-selected="${f===k}" data-tf="${k}">${l}</button>`).join("")}</div>${body}`;
}

function vContacts(){ const {q,kind}=S.cf; const ql=q.trim().toLowerCase();
  const list=A("contacts").filter(c=>(!kind||c.kind===kind)&&(!ql||[c.name,c.org,c.role,c.email,c.notes].join(" ").toLowerCase().includes(ql))).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const stale=c=>!c.lastContact||daysTo(c.lastContact)<-60;
  return `<h2>Contacts</h2><p class="sub">Speakers, sponsors, partner groups and labs we work with, and who on the team owns each relationship.</p>
    <div class="toolbar"><input type="search" id="cq" placeholder="Search names, orgs, notes…" value="${esc(q)}" aria-label="Search contacts"><select id="ckind" aria-label="Kind"><option value="">All kinds</option>${CKINDS.map(([k,l])=>`<option value="${k}" ${kind===k?"selected":""}>${l}</option>`).join("")}</select>${S.canWrite?`<button class="btn pri" data-act="new-contact">+ Add contact</button>`:""}</div>
    ${list.length?`<div class="list">${list.map(c=>`<div class="row" data-contact="${esc(c.id)}" role="button" tabindex="0" style="cursor:pointer"><div class="grow"><div class="t" dir="auto">${esc(c.name)}</div><div class="s" dir="auto">${[c.role,c.org].filter(Boolean).map(esc).join(" · ")||"&nbsp;"}</div></div>
      <span class="chip">${esc(CKIND[c.kind]||"Other")}</span>${cOwners(c).length?`<span class="meta" style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)">${whoHtml(cOwners(c))}</span>`:""}<span class="chip ${stale(c)?"soon":"ok"}">${c.lastContact?"Last contact "+esc(fmtD(c.lastContact)):"Not contacted yet"}</span></div>`).join("")}</div>`
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
  const ownerSel=key=>pick("sec-"+key,secOwners(key),{save:"sec:"+key,dis:!isAdmin(),label:"Section owners"});
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
  const cards=ids.map(id=>{ const mine=A("items").filter(i=>i.addedBy===id); const wk=mine.filter(i=>(i.createdAt||0)>=ws).length; const tasks=A("tasks").filter(t=>tAss(t).includes(id)&&!t.done).length;
    const owns=Object.entries(st.owners||{}).filter(([k,v])=>arr(v).includes(id)).map(([k])=>secName(k)).filter(Boolean); const p=S.profiles[id]; const role=p&&p.email?roleOf(String(p.email).toLowerCase()):"";
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
  if(live){ const c=$("#cmts"); if(c&&it) c.innerHTML=commentsHtml(it); const s=$("#staleBox"); if(s) s.innerHTML=staleHtml(it); const h=$("#itemHint"); if(h&&it){ const tmp=document.createElement("div"); tmp.innerHTML=itemHintHtml(it); h.innerHTML=tmp.firstElementChild.innerHTML; } return; }
  const ro=!canEditItem(it), locked=ro&&S.canWrite, dis=ro?"disabled":"", isEvent=d.type==="event";
  return shell(key, isNew?"Add item":"Edit item", `
    <div class="dh"><h2>${isNew?"Add to the desk":"Newsletter item"}</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    ${it?itemHintHtml(it):""}
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
        ${isNew||ro?"":`<div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted);font-weight:500">Writing it${pick("dWriters",iOwners(it),{label:"Who's writing it"})}</div>`}
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
      ${!S.canWrite?"":`<div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">${isNew?"Add to desk":"Save changes"}</button>`}${it&&!iOwners(it).includes(S.meId)?`<button type="button" class="btn" data-act="claim">✋ ${iOwners(it).length?"I'll help write this":"I'll write this"}</button>`:""}${it&&iOwners(it).includes(S.meId)?`<button type="button" class="btn" data-act="unclaim">I'm not writing it</button>`:""}${it&&it.date?`<a class="btn" target="_blank" rel="noopener" href="${esc(gcalUrl({title:it.title,date:it.date,location:it.location,details:it.url}))}">+ Google Calendar</a>`:""}<span style="flex:1"></span>${it&&!ro?`<button type="button" class="btn ghost danger" data-act="del">Delete</button>`:""}</div>${delBlock("Move this item to the Trash?")}`}
    </form>
    ${it?`<div class="box"><h3>Discussion</h3><div id="cmts">${commentsHtml(it)}</div>${!S.canWrite?"":`<form id="cForm" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:8px"><input id="cText" dir="auto" placeholder="Add a note. Type @ and a name to notify someone" style="flex:1"><button class="btn" type="submit">Post</button></div>${mentionChips("cText")}</form>`}</div>`:""}`);
}
function itemHintHtml(it){ return `<div class="hint" id="itemHint">Added by ${esc(nameOf(it.addedBy))} ${it.createdAt?agoPhrase(it.createdAt):""}${iOwners(it).length?` · ${esc(andList(iOwners(it).map(firstName)))} ${iOwners(it).length>1?"are":"is"} writing it`:""}${it.issueNo?` · ran in issue #${it.issueNo}`:""}${it.suggestedBy?` · suggested by ${esc(it.suggestedBy)}`:""}</div>`; }
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
    else { const prev=S.items.find(i=>i.id===D.id); const wb=document.querySelector('.ppick[data-pp="dWriters"]'); if(wb){ const w=pickVal(wb); fields.owners=w; fields.owner=w[0]||null; } await saveItem(D.id,Object.assign(fields,stamp())); logAct(prev&&prev.status!==d.status?`moved to ${STAGE[d.status]}:`:"edited",d.title,D.id); toast("Saved."); }
    closeDrawer();
  }catch{}
}

// meeting
function openMeeting(id, date, occ){ const mt=id? S.meetings.find(x=>x.id===id) : null; if(id&&!mt) return;
  if(mt&&isSeries(mt)&&!occ){ const next=seriesKeys(mt,todayS(),shiftS(todayS(),400)).find(k=>!occOf(mt,k).skipped); occ=next||mt.date; }
  openD("meeting",{id:id||null,occ:mt&&isSeries(mt)?occ:"",base:mt?(mt.updatedAt||0):0,draft:Object.assign({title:"",kind:"meeting",date:date||todayS(),time:"",endTime:"",location:"",agenda:"",notes:"",repeat:"none",until:""},mt?JSON.parse(JSON.stringify(mt)):{})}); }
function rsvpMap(mt, occ){ return occ? ((mt.orsvp||{})[occ]||{}) : (mt.rsvp||{}); }
function rsvpHtml(mt, occ){ const r=rsvpMap(mt,occ); const mine=r[S.meId]; const grp={yes:[],maybe:[],no:[]}; Object.entries(r).forEach(([u,v])=>grp[v]&&grp[v].push(u));
  return `<div class="seg" style="margin:0">${[["yes","Going"],["maybe","Maybe"],["no","Can't make it"]].map(([k,l])=>`<button type="button" data-rsvp="${k}" aria-pressed="${mine===k}" ${S.canWrite?"":"disabled"}>${l}${grp[k].length?` · ${grp[k].length}`:""}</button>`).join("")}</div>
    <div class="hint" style="margin-top:6px">${[["yes","Going"],["maybe","Maybe"],["no","Can't"]].filter(([k])=>grp[k].length).map(([k,l])=>`${l}: ${grp[k].map(u=>esc(firstName(u))).join(", ")}`).join(" · ")||"No replies yet."}</div>`; }
function skippedHtml(mt){ const sk=Object.entries(mt.exceptions||{}).filter(([k,v])=>v&&v.skipped===true).map(([k])=>k).sort();
  return sk.length?`<div class="hint">Skipped: ${sk.map(k=>`${esc(fmtDW(k))}${canEditMeet(mt)?` <a href="#" data-unskip="${esc(k)}">restore</a>`:""}`).join(" · ")}</div>`:""; }
function seriesFields(d, dis){ return `<div class="grid2"><label class="f">Repeats<select id="mRepeat" ${dis}>${REPEATS.map(([k,l])=>`<option value="${k}" ${(d.repeat||"none")===k?"selected":""}>${l}</option>`).join("")}</select></label>
  <label class="f" ${(d.repeat||"none")==="none"?"hidden":""} id="mUntilWrap">Until (optional)<input id="mUntil" type="date" value="${esc(d.until||"")}" ${dis}></label></div>`; }
function drawMeeting(key, live){
  const D=S.drawer, d=D.draft, mt=D.id?S.meetings.find(x=>x.id===D.id):null; const ser=isSeries(mt)&&D.occ; const o=ser?occOf(mt,D.occ):null;
  if(live){ if(mt){ const r=$("#rsvpBox"); if(r) r.innerHTML=rsvpHtml(mt,ser?D.occ:""); const a=$("#actList"); if(a) a.innerHTML=actionList(mt,ser?D.occ:""); const s=$("#staleBox"); if(s) s.innerHTML=staleHtml(mt); const k=$("#skipList"); if(k) k.innerHTML=skippedHtml(mt); } return; }
  const ro=!canEditMeet(mt), dis=ro?"disabled":"";
  const seriesForm = `<form class="box" id="meetForm" novalidate>
      ${ser?`<h3>Whole series</h3><div class="hint">Changes here apply to every date. Dates you moved or skipped keep their changes.</div>`:""}
      <label class="f"><span class="lh">What<span class="req">*</span></span><input id="mTitle" dir="auto" value="${esc(d.title)}" placeholder="Weekly sync · Call with BioHub" ${dis} data-autofocus></label>
      <div class="typepick" role="radiogroup" aria-label="Kind">${MKINDS.map(([k,l,c])=>`<input type="radio" name="mKind" id="mk-${k}" value="${k}" ${d.kind===k?"checked":""} ${dis}><label for="mk-${k}" style="--tc:var(${c})"><span class="dot"></span>${l}</label>`).join("")}</div>
      <div class="grid2">
        <label class="f"><span class="lh">${isSeries(d)?"First date":"Date"}<span class="req">*</span></span><input id="mDate" type="date" value="${esc(d.date)}" ${dis}></label>
        <label class="f">Start<input id="mTime" type="time" value="${esc(d.time)}" ${dis}></label>
        <label class="f">End<input id="mEnd" type="time" value="${esc(d.endTime)}" ${dis}></label>
      </div>
      ${seriesFields(d,dis)}
      <label class="f">Where<input id="mLoc" dir="auto" value="${esc(d.location)}" placeholder="Room, building, or a Zoom / Meet link" ${dis}></label>
      <label class="f">Agenda<textarea id="mAgenda" rows="3" dir="auto" placeholder="${ser?"What every meeting covers":"What we'll cover"}" ${dis}>${esc(d.agenda)}</textarea></label>
      ${D.id&&!ser?`<label class="f">Notes<textarea id="mNotes" rows="4" dir="auto" placeholder="What was decided" ${dis}>${esc(d.notes)}</textarea></label>`:""}
      ${ser?`<div id="skipList">${skippedHtml(mt)}</div>`:""}
      <div id="mErr"></div>
      <div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">${D.id?(ser?"Save whole series":"Save changes"):"Add to calendar"}</button>`}${mt&&!ser?`<a class="btn" target="_blank" rel="noopener" href="${esc(gcalUrl({title:mt.title,date:mt.date,time:mt.time,endTime:mt.endTime,location:mt.location,details:mt.agenda}))}">+ Google Calendar</a>`:""}<span style="flex:1"></span>${mt&&!ro?`<button type="button" class="btn ghost danger" data-act="del">${ser?"Delete whole series":"Delete"}</button>`:""}</div>
      ${ro?"":delBlock(ser?"Move the whole series (every date) to the Trash?":"Move this entry to the Trash?")}
    </form>`;
  const occBox = ser? `<form class="box" id="occForm" novalidate><h3>This date only</h3>
      ${o.moved?`<div class="hint">Moved from ${esc(fmtDW(o.key))}.</div>`:""}
      <div class="grid2"><label class="f">Date<input id="oDate" type="date" value="${esc(o.date)}" ${dis}></label><label class="f">Start<input id="oTime" type="time" value="${esc(o.time)}" ${dis}></label><label class="f">End<input id="oEnd" type="time" value="${esc(o.endTime)}" ${dis}></label></div>
      <label class="f">Notes for this meeting<textarea id="oNotes" rows="3" dir="auto" placeholder="What was decided" ${dis}>${esc(o.notes)}</textarea></label>
      ${ro?"":`<div class="toolbar" style="margin:0"><button class="btn pri" type="submit">Save this date only</button><button type="button" class="btn" data-act="occ-skip">Skip this date</button>${o.changed?`<button type="button" class="btn ghost" data-act="occ-reset">Undo changes to this date</button>`:""}<span style="flex:1"></span><a class="btn" target="_blank" rel="noopener" href="${esc(gcalUrl({title:mt.title,date:o.date,time:o.time,endTime:o.endTime,location:mt.location,details:mt.agenda}))}">+ Google Calendar</a></div>`}
    </form>` : "";
  return shell(key,"Calendar entry",`
    <div class="dh"><h2>${mt?esc(mt.title):"Add to the calendar"}</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    ${mt?`<div class="hint">${ser?`↻ ${esc(repeatLabel(mt))} · this date: <b>${esc(fmtDW(o.date))}${o.time?" "+esc(o.time):""}</b> · `:""}Added by ${esc(nameOf(mt.createdBy))} ${mt.createdAt?agoPhrase(mt.createdAt):""}${ro&&S.canWrite?" · only they or an admin can edit the details":""}</div>`:""}
    <div id="staleBox">${staleHtml(mt)}</div>
    ${mt?`<div class="box"><h3>Are you coming${ser?" on "+esc(fmtDW(o.date)):""}?</h3><div id="rsvpBox">${rsvpHtml(mt,ser?D.occ:"")}</div></div>`:""}
    ${occBox}
    ${mt?`<div class="box"><h3>Action items${ser?" from this date":""}</h3><div id="actList">${actionList(mt,ser?D.occ:"")}</div>${taskAddForm(`data-meeting="${esc(mt.id)}"${ser?` data-occ="${esc(D.occ)}"`:""}`,"meet")}</div>`:""}
    ${ser?`<details class="box more"><summary>Edit the whole series</summary>${seriesForm}</details>`:seriesForm}`);
}
function actionList(mt, occ){ const ts=A("tasks").filter(t=>t.meetingId===mt.id&&(!occ||t.occurrence===occ)); return ts.length?`<div class="tasks">${ts.map(t=>taskRow(t,true)).join("")}</div>`:`<div class="colempty">No action items yet. Add who does what before you leave the meeting.</div>`; }
function readMeeting(){ const d=S.drawer.draft; const k=document.querySelector('input[name="mKind"]:checked'); Object.assign(d,{title:$("#mTitle").value.trim(),kind:k?k.value:"meeting",date:$("#mDate").value,time:$("#mTime").value,endTime:$("#mEnd").value,repeat:$("#mRepeat").value,until:$("#mRepeat").value==="none"?"":$("#mUntil").value,location:$("#mLoc").value.trim(),agenda:$("#mAgenda").value.trim(),notes:$("#mNotes")?$("#mNotes").value.trim():(d.notes||"")}); return d; }
async function submitMeeting(){
  const D=S.drawer, d=readMeeting(); if(!d.title||!d.date){ $("#mErr").innerHTML=`<div class="dup">Add ${!d.title&&!d.date?"a title and a date":!d.title?"a title":"a date"} first.</div>`; return; }
  if(d.until&&d.until<d.date){ $("#mErr").innerHTML=`<div class="dup">"Until" has to be after the first date.</div>`; return; }
  const data={title:d.title,kind:d.kind,date:d.date,time:d.time,endTime:d.endTime,repeat:d.repeat||"none",until:d.until||"",location:d.location,agenda:d.agenda,notes:d.notes,...stamp()};
  if(D.id){ if(await upd("meetings",D.id,data)){ logAct("updated meeting",d.title); closeDrawer(); toast("Saved."); } }
  else { const id=await add("meetings",Object.assign(data,{rsvp:{},orsvp:{},exceptions:{},createdBy:S.meId,createdAt:Date.now()})); if(id){ logAct(d.kind==="idea"?"added an event idea:":"scheduled",d.title+" · "+(isSeries(data)?repeatLabel(data):fmtDW(d.date))); closeDrawer(); toast(isSeries(data)?`Added to the calendar: ${repeatLabel(data).charAt(0).toLowerCase()+repeatLabel(data).slice(1)}.`:"Added to the calendar."); } }
}
async function submitOcc(){ const D=S.drawer, mt=S.meetings.find(x=>x.id===D.id); const key=D.occ;
  const date=$("#oDate").value||key, time=$("#oTime").value, endTime=$("#oEnd").value, notes=$("#oNotes").value.trim();
  const ex={skipped:false,notes}; if(date!==key) ex.date=date; else ex.date=null; ex.time=time!==(mt.time||"")?time:null; ex.endTime=endTime!==(mt.endTime||"")?endTime:null;
  if(await upd("meetings",mt.id,{exceptions:{[key]:ex},...stamp()})){ if(date!==key) logAct(`moved ${fmtD(key)} to ${fmtD(date)}:`,mt.title); closeDrawer(); toast(date!==key?`Moved to ${fmtDW(date)}. The rest of the series stays the same.`:"Saved for this date."); }
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
      <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted);font-weight:500">Assigned to${pick("kAss",tAss(d),{dis:ro,label:"Assigned to"})}</div>
      <div class="grid2"><label class="f">Due<input id="kDue" type="date" value="${esc(d.due)}" ${dis}></label></div>
      <label class="f">Notes<textarea id="kNotes" rows="3" dir="auto" ${dis}>${esc(d.notes)}</textarea></label>
      <div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">Save changes</button>`}${S.canWrite?`<button type="button" class="btn" data-done="${esc(t.id)}">${t.done?"Mark not done":"✓ Mark done"}</button>`:""}<span style="flex:1"></span>${ro?"":`<button type="button" class="btn ghost danger" data-act="del">Delete</button>`}</div>
      ${ro?"":delBlock("Move this task to the Trash?")}</form>`);
}
async function submitTask(){ const D=S.drawer; const title=$("#kTitle").value.trim(); if(!title){ toast("The task needs a name."); return; }
  const prev=S.tasks.find(x=>x.id===D.id); const ass=pickVal(document.querySelector('.ppick[data-pp="kAss"]'));
  if(await upd("tasks",D.id,{title,assignees:ass,assignee:ass[0]||"",due:$("#kDue").value,notes:$("#kNotes").value.trim(),...stamp()})){ const added=ass.filter(u=>u!==S.meId&&!tAss(prev||{}).includes(u)); if(added.length) logAct(`gave ${andList(added.map(firstName))} a task:`,title); closeDrawer(); toast("Saved."); } }

// plan (our events) ─ full event planner
const EV_SECTIONS = ["General","Venue & logistics","Content & speakers","Marketing","Registration","Budget & sponsors","Follow-up"];
const EV_ROLES = [["lead","Lead"],["logistics","Venue & logistics"],["content","Content & speakers"],["marketing","Marketing"],["registration","Registration"],["budget","Budget & sponsors"]];
const SECTION_ROLE = {"General":"lead","Venue & logistics":"logistics","Content & speakers":"content","Marketing":"marketing","Registration":"registration","Budget & sponsors":"budget","Follow-up":"lead"};
const GKINDS = [["speaker","Speaker"],["panelist","Panelist"],["moderator","Moderator"],["sponsor","Sponsor"],["partner","Partner org"],["guest","Guest"]];
const GSTAT = [["idea","Idea"],["invited","Invited"],["confirmed","Confirmed"],["declined","Declined"]];
const TEMPLATES = {
  workshop:{label:"Workshop / talk",icon:"🎤",desc:"One speaker, a room, an audience.",
    tasks:[[-35,"Venue & logistics","Book the room"],[-35,"Content & speakers","Confirm speaker, topic and date"],[-28,"Marketing","Write the event description"],[-24,"Marketing","Design the poster"],[-21,"Registration","Open the registration form"],[-14,"Marketing","Post in the newsletter and WhatsApp groups"],[-10,"Content & speakers","Get the speaker's bio and photo"],[-7,"Venue & logistics","Order food and drinks"],[-3,"Registration","Send a reminder to registrants"],[-1,"Venue & logistics","Check projector, mic and signage"],[1,"Follow-up","Send a thank-you to the speaker"],[3,"Follow-up","Collect feedback and fill in the review"]],
    run:[["17:30","Team arrives, set up room and food"],["18:00","Doors open, registration"],["18:15","Welcome and intro to Nucleate"],["18:20","Talk"],["19:00","Q&A"],["19:20","Networking"],["20:00","Clean up"]],
    budget:[["Food and drinks",800],["Printing (posters, name tags)",150],["Speaker gift",150]]},
  panel:{label:"Panel",icon:"🪑",desc:"Several panelists and a moderator.",
    tasks:[[-42,"Content & speakers","Pick the panel topic"],[-40,"Content & speakers","Shortlist and invite panelists"],[-35,"Venue & logistics","Book the hall"],[-30,"Content & speakers","Confirm a moderator"],[-28,"Marketing","Design the poster with panelist photos"],[-21,"Registration","Open registration"],[-14,"Marketing","Post in the newsletter and social media"],[-10,"Content & speakers","Send panelists the questions"],[-7,"Venue & logistics","Arrange chairs, mics and water"],[-3,"Registration","Send a reminder"],[-1,"Content & speakers","Brief call with panelists and moderator"],[2,"Follow-up","Thank panelists, share photos"],[4,"Follow-up","Fill in the review"]],
    run:[["17:30","Set up stage and chairs"],["18:00","Doors open"],["18:15","Opening words"],["18:20","Panel discussion"],["19:15","Audience Q&A"],["19:40","Networking"]],
    budget:[["Food and drinks",1200],["Panelist gifts",400],["Printing",150]]},
  social:{label:"Networking / social",icon:"🥂",desc:"Meet people, food, light program.",
    tasks:[[-28,"Venue & logistics","Find and book a venue"],[-21,"Budget & sponsors","Ask a sponsor to cover food"],[-21,"Marketing","Create the invitation"],[-18,"Registration","Open sign-ups"],[-10,"Marketing","Remind in the WhatsApp groups"],[-5,"Venue & logistics","Order food and drinks"],[-2,"Venue & logistics","Prepare name tags and music"],[2,"Follow-up","Share photos and thank attendees"]],
    run:[["19:00","Set up"],["19:30","Guests arrive"],["20:00","Short welcome"],["21:30","Wrap up"]],
    budget:[["Food and drinks",1500],["Venue",500],["Decorations",200]]},
  tour:{label:"Lab / company tour",icon:"🔬",desc:"Visit a lab, startup or company.",
    tasks:[[-35,"Content & speakers","Agree on a date with the host"],[-28,"Registration","Decide the group size and open sign-ups"],[-21,"Marketing","Announce in the newsletter"],[-14,"Venue & logistics","Arrange transport or a meeting point"],[-7,"Registration","Send the final list to the host"],[-2,"Registration","Send participants directions and rules"],[1,"Follow-up","Thank the host"]],
    run:[["09:30","Meet at the meeting point"],["10:00","Arrive, safety briefing"],["10:15","Tour"],["11:30","Q&A with the team"],["12:00","Head back"]],
    budget:[["Transport",600],["Host gift",150]]},
  competition:{label:"Competition / hackathon",icon:"🏆",desc:"Teams, judges, prizes.",
    tasks:[[-60,"Content & speakers","Define the challenge and rules"],[-50,"Budget & sponsors","Secure sponsors and prizes"],[-45,"Venue & logistics","Book the venue"],[-40,"Content & speakers","Recruit judges and mentors"],[-35,"Marketing","Launch the call for teams"],[-14,"Registration","Close registration, confirm teams"],[-7,"Content & speakers","Send judges the scoring sheet"],[-3,"Venue & logistics","Order food, check Wi-Fi and power"],[2,"Follow-up","Announce winners, thank sponsors"],[5,"Follow-up","Fill in the review"]],
    run:[["08:30","Set up"],["09:00","Check-in"],["09:30","Opening and challenge"],["10:00","Work time"],["16:00","Pitches"],["17:30","Judging"],["18:00","Winners and closing"]],
    budget:[["Prizes",3000],["Food",2500],["Venue",1000],["Swag",800]]},
  blank:{label:"Start from scratch",icon:"✏️",desc:"No preset tasks.",tasks:[],run:[],budget:[]}
};
const live = m => Object.entries(m||{}).filter(([,v])=>v);
const nid = p => p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const money = n => "₪"+Math.round(Number(n)||0).toLocaleString("en-US");
function pLeads(p){ const u=rUids((p.roles||{}).lead); return u.length?u:((p.leads&&p.leads.length)?p.leads:arr(p.lead)); }
const planTeam = p => { const s=new Set([p.createdBy,...pLeads(p)].filter(Boolean)); live(p.roles).forEach(([,r])=>rUids(r).forEach(u=>s.add(u))); return [...s]; };
// Who a new task in an area goes to: that area's role people, or the event leads.
function roleFor(p, section){ const k=SECTION_ROLE[section]||"lead"; const u=rUids((p.roles||{})[k]); return u.length?u:pLeads(p); }

function openPlan(id, date){ if(id){ location.hash="event-"+id; return; }
  openD("plan",{id:null,draft:{title:"",template:"workshop",date:date||"",time:"18:00",location:""}}); }
function drawPlan(key, live){ if(live) return; const d=S.drawer.draft;
  return shell(key,"New event",`<div class="dh"><h2>Plan a new event</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    <form class="box" id="planForm" novalidate>
      <label class="f"><span class="lh">Event name<span class="req">*</span></span><input id="pTitle" dir="auto" value="${esc(d.title)}" placeholder="Founders panel · Lab tour at BioHub" data-autofocus></label>
      <div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted);font-weight:500">Start from a template
        <div class="tpl">${Object.entries(TEMPLATES).map(([k,t])=>`<input type="radio" name="pTpl" id="tp-${k}" value="${k}" ${d.template===k?"checked":""}><label for="tp-${k}"><span class="ic">${t.icon}</span><b>${esc(t.label)}</b><span>${esc(t.desc)}${t.tasks.length?` · ${t.tasks.length} tasks`:""}</span></label>`).join("")}</div></div>
      <div class="grid2"><label class="f">Date<input id="pDate" type="date" value="${esc(d.date)}"></label><label class="f">Start time<input id="pTime" type="time" value="${esc(d.time)}"></label></div>
      <label class="f">Where<input id="pLoc" dir="auto" value="${esc(d.location)}" placeholder="Building / room · or TBD"></label>
      <div class="hint">With a date, template tasks get due dates counted back from the event (e.g. "Book the room" 5 weeks before). No date yet? Tasks are added without dates and get them once you set one.</div>
      <div id="pErr"></div>
      <div class="toolbar" style="margin:0"><button class="btn pri" type="submit">Create event</button></div>
    </form>`);
}
async function submitPlan(){ const title=$("#pTitle").value.trim(); if(!title){ $("#pErr").innerHTML=`<div class="dup">Give the event a name first.</div>`; return; }
  const tk=(document.querySelector('input[name="pTpl"]:checked')||{}).value||"blank"; const tpl=TEMPLATES[tk]; const date=$("#pDate").value, time=$("#pTime").value, loc=$("#pLoc").value.trim();
  const roles={}; EV_ROLES.forEach(([k,l],i)=>{ roles[k]={name:l,uids:k==="lead"?[S.meId]:[],uid:k==="lead"?S.meId:"",at:i}; });
  const ck={}; DEFAULT_CHECK.forEach((t,i)=>{ ck["c"+i]={text:t,done:false,at:i}; });
  const run={}; tpl.run.forEach(([t,w],i)=>{ run["r"+i]={time:t,what:w,who:"",at:i}; });
  const budget={}; tpl.budget.forEach(([l,e],i)=>{ budget["b"+i]={label:l,est:e,actual:0,paid:false,by:"",at:i}; });
  const data={title,template:tk,stage:"planning",date,time,endTime:"",location:loc,capacity:"",audience:"",link:"",description:"",lead:S.meId,leads:[S.meId],team:[S.meId],roles,checklist:ck,run,budget,budgetTotal:tpl.budget.reduce((a,b)=>a+b[1],0),guests:{},review:{},itemId:"",createdBy:S.meId,createdAt:Date.now(),...stamp()};
  const id=await add("plans",data); if(!id) return;
  for(const [off,sec,t] of tpl.tasks){ const who=SECTION_ROLE[sec]==="lead"?[S.meId]:[]; await add("tasks",{title:t,assignees:who,assignee:who[0]||"",due:date?shiftS(date,off):"",relDays:off,section:sec,done:false,notes:"",meetingId:"",occurrence:"",planId:id,createdBy:S.meId,createdAt:Date.now(),...stamp()}); }
  logAct("started planning",title); closeDrawer(); S.etab="overview"; location.hash="event-"+id; toast(tpl.tasks.length?`Event created with ${tpl.tasks.length} tasks. Assign roles next.`:"Event created.");
}

function planCard(p){ const ts=A("tasks").filter(t=>t.planId===p.id); const dn=ts.filter(t=>t.done).length; const d=p.date?daysTo(p.date):null;
  return `<div class="card" data-plan="${esc(p.id)}" style="--tc:var(--m-plan)" role="button" tabindex="0"><div class="meta">${p.date?`<span class="chip ${d>=0&&d<=7?"soon":""}">🗓 ${esc(fmtDW(p.date))}${d>=0&&p.stage!=="done"?` · ${d===0?"today":"in "+d+"d"}`:""}</span>`:`<span class="chip">No date yet</span>`}${p.itemId?`<span class="chip ok">In newsletter</span>`:""}</div>
    <div class="t" dir="auto">${(TEMPLATES[p.template]||{}).icon||"🎪"} ${esc(p.title)}</div>${p.location?`<div class="meta" dir="auto">📍 ${esc(p.location)}</div>`:""}
    ${ts.length?`<div class="prog" title="${dn} of ${ts.length} tasks done"><span style="width:${Math.round(100*dn/ts.length)}%"></span></div><div class="meta">${dn}/${ts.length} tasks done</div>`:""}
    <div class="foot"><div class="meta">${planTeam(p).slice(0,5).map(avImg).join("")}<span>${pLeads(p).length?esc(andList(pLeads(p).map(firstName)))+(pLeads(p).length>1?" lead":" leads"):"No lead yet"}</span></div></div></div>`; }
function vEvents(){ const ps=A("plans");
  return `<h2>Event planner</h2><p class="sub">Events the branch organizes. Each event has its own page with tasks and a timeline, roles, budget, guests, run of show and a review afterwards.</p>
    ${S.canWrite?`<div class="toolbar"><button class="btn pri" data-act="new-plan">+ Plan a new event</button></div>`:""}
    ${ps.length?`<div class="board" style="grid-template-columns:repeat(4,minmax(230px,1fr))">${PSTAGES.map(([k,l])=>{ const cs=ps.filter(p=>(p.stage||"idea")===k).sort((a,b)=>(a.date||"9")<(b.date||"9")?-1:1);
      return `<section class="col"><div class="col-h"><h3>${l}</h3><span class="c">${cs.length}</span></div>${cs.map(planCard).join("")||`<div class="colempty">${k==="idea"?"Ideas go here.":"Nothing here."}</div>`}</section>`; }).join("")}</div>`
      :`<div class="empty"><b>No events yet</b>Pick a template (workshop, panel, social, tour, competition) and the planner sets up tasks, a run of show and a starter budget for you.<br><br>${S.canWrite?`<button class="btn pri" data-act="new-plan">+ Plan a new event</button>`:""}</div>`}`; }

// ── event page ──
function vEvent(){
  const p=S.plans.find(x=>x.id===S.eventId);
  if(!p||p.deleted) return `<div class="empty"><b>${S.plans.length?"This event isn't here anymore":"Loading…"}</b>${S.plans.length?`It may have been moved to the Trash.<br><br><a class="btn" href="#events">Back to events</a>`:""}</div>`;
  const ed=canEditPlan(p); const tab=S.etab||"overview"; const ts=A("tasks").filter(t=>t.planId===p.id); const d=p.date?daysTo(p.date):null;
  const done=ts.filter(t=>t.done).length; const over=ts.filter(t=>!t.done&&t.due&&daysTo(t.due)<0).length;
  const tabs=[["overview","Overview"],["tasks",`Tasks${ts.length?` (${ts.length-done})`:""}`],["team","Team & roles"],["budget","Budget"],["guests",`Guests${live(p.guests).length?` (${live(p.guests).length})`:""}`],["run","Run of show"],["after","After the event"]];
  const body={overview:evOverview,tasks:evTasks,team:evTeam,budget:evBudget,guests:evGuests,run:evRun,after:evAfter}[tab](p,ed,ts);
  return `<div class="crumbs"><a href="#events">← Event planner</a></div>
    <section class="evhead"><div class="evtitle"><span class="ic">${(TEMPLATES[p.template]||{}).icon||"🎪"}</span><div style="min-width:0"><h2 dir="auto">${esc(p.title)}</h2>
      <div class="meta">${p.date?`<span class="chip ${d!==null&&d>=0&&d<=7?"soon":""}">🗓 ${esc(fmtDW(p.date))}${p.time?" · "+esc(p.time):""}${p.endTime?"–"+esc(p.endTime):""}</span>`:`<span class="chip hot">No date yet</span>`}${p.location?`<span class="chip">📍 ${esc(p.location)}</span>`:""}${d!==null&&p.stage!=="done"?`<span class="chip ${d<0?"":"ok"}">${d>0?`in ${plural(d,"day")}`:d===0?"Today!":`${plural(-d,"day")} ago`}</span>`:""}${ts.length?`<span class="chip ${over?"hot":""}">${done}/${ts.length} tasks${over?` · ${over} overdue`:""}</span>`:""}</div></div></div>
      <div class="seg" style="margin:0" role="radiogroup" aria-label="Stage">${PSTAGES.map(([k,l])=>`<button type="button" data-evstage="${k}" aria-pressed="${(p.stage||"idea")===k}" ${ed?"":"disabled"}>${l}</button>`).join("")}</div>
    </section>
    ${ed?"":`<div class="banner" style="background:var(--sunk)">You're viewing this event. Its lead, its team members and admins can edit it; you can still tick tasks and checklist steps.</div>`}
    <div class="seg evtabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-etab="${k}">${l}</button>`).join("")}</div>
    ${body}`;
}
function evOverview(p,ed,ts){ const dis=ed?"":"disabled"; const g=live(p.guests).map(([,v])=>v); const b=live(p.budget).map(([,v])=>v); const est=b.reduce((a,x)=>a+(+x.est||0),0); const ck=live(p.checklist); const ckd=ck.filter(([,c])=>c.done).length;
  const next=ts.filter(t=>!t.done).sort((a,b)=>(a.due||"9")<(b.due||"9")?-1:1).slice(0,6);
  return `<div class="tiles">
      <a class="tile" href="#" data-etab="tasks"><span class="v">${ts.filter(t=>!t.done).length}</span><span class="l">open tasks${ts.filter(t=>!t.done&&!tAss(t).length).length?` · ${ts.filter(t=>!t.done&&!tAss(t).length).length} unassigned`:""}</span></a>
      <a class="tile" href="#" data-etab="team"><span class="v">${planTeam(p).length}</span><span class="l">people on the team</span></a>
      <a class="tile" href="#" data-etab="budget"><span class="v small">${money(est)}${p.budgetTotal?` / ${money(p.budgetTotal)}`:""}</span><span class="l">planned spend${p.budgetTotal&&est>p.budgetTotal?" · over budget":""}</span></a>
      <a class="tile" href="#" data-etab="guests"><span class="v">${g.filter(x=>x.status==="confirmed").length}/${g.length}</span><span class="l">guests confirmed</span></a></div>
    <div class="home-grid">
      <form class="panel" id="evDetails" novalidate><div class="panel-h"><h3>Details</h3></div><div style="display:flex;flex-direction:column;gap:12px">
        <label class="f">Event name<input id="eTitle" dir="auto" value="${esc(p.title)}" ${dis}></label>
        <div class="grid2"><label class="f">Date<input id="eDate" type="date" value="${esc(p.date)}" ${dis}></label><label class="f">Start<input id="eTime" type="time" value="${esc(p.time)}" ${dis}></label><label class="f">End<input id="eEnd" type="time" value="${esc(p.endTime||"")}" ${dis}></label>
          <label class="f">Where<input id="eLoc" dir="auto" value="${esc(p.location)}" ${dis}></label><label class="f">Expected attendance<input id="eCap" type="number" min="0" value="${esc(p.capacity||"")}" ${dis}></label><label class="f">Audience<input id="eAud" dir="auto" value="${esc(p.audience||"")}" placeholder="BSc, MSc/PhD, everyone" ${dis}></label></div>
        <label class="f">Registration / info link<input id="eLink" type="url" value="${esc(p.link||"")}" placeholder="https://…" ${dis}></label>
        <label class="f">Description<textarea id="eDesc" rows="4" dir="auto" placeholder="What it is, who it's for, why come. This becomes the newsletter blurb." ${dis}>${esc(p.description||"")}</textarea></label>
        ${ed?`<div class="toolbar" style="margin:0"><button class="btn pri" type="submit">Save details</button>${p.date?`<a class="btn" target="_blank" rel="noopener" href="${esc(gcalUrl({title:p.title,date:p.date,time:p.time,endTime:p.endTime,location:p.location,details:p.link}))}">+ Google Calendar</a>`:""}${!p.itemId?`<button type="button" class="btn" data-act="plan-to-news">➜ Add to newsletter</button>`:`<a class="btn" href="#" data-open="${esc(p.itemId)}">Newsletter item</a>`}<span style="flex:1"></span><button type="button" class="btn ghost danger" data-act="ev-del">Delete event</button></div>
        ${S.evConfirmDel?`<div class="confirm">Move this event and its plan to the Trash? Its tasks stay in Tasks. <button type="button" class="btn sm danger" data-act="ev-del-yes">Move to Trash</button><button type="button" class="btn sm" data-act="ev-del-no">Keep</button></div>`:""}`:""}
      </div></form>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <div class="panel"><div class="panel-h"><h3>Next up</h3><a href="#" class="hint" data-etab="tasks">All tasks →</a></div>${next.length?`<div class="tasks">${next.map(t=>taskRow(t,true)).join("")}</div>`:`<div class="colempty">${ts.length?"Everything's done.":"No tasks yet."}</div>`}</div>
        <div class="panel"><div class="panel-h"><h3>Checklist</h3><span class="hint">${ckd}/${ck.length}</span></div><div id="ckBox">${checklistHtml(p,!ed)}</div></div>
      </div></div>`; }
function checklistHtml(p, ro){ const ck=live(p.checklist).sort((a,b)=>(a[1].at||0)-(b[1].at||0));
  return (ck.length?`<div class="tasks">${ck.map(([k,c])=>`<div class="task ${c.done?"done":""}"><input type="checkbox" data-ck="${esc(k)}" ${c.done?"checked":""} ${S.canWrite?"":"disabled"} aria-label="Done"><div class="grow"><span class="t" dir="auto">${esc(c.text)}</span>${c.done&&c.by?`<div class="meta"><span>${esc(firstName(c.by))}</span></div>`:""}</div>${ro?"":`<button type="button" class="btn sm ghost" data-ckdel="${esc(k)}" aria-label="Remove">✕</button>`}</div>`).join("")}</div>`:`<div class="colempty">No checklist yet.</div>`)
    +(ro?"":`<form id="ckForm" style="display:flex;gap:8px;margin-top:8px"><input id="ckText" placeholder="Add a checklist step…" dir="auto" style="flex:1"><button class="btn" type="submit">Add</button></form>`); }
function evTasks(p,ed,ts){
  const phase=t=>{ if(!t.due) return 0; if(!p.date) return 1; const r=Math.round((parseD(t.due)-parseD(p.date))/864e5); return r<=-28?1:r<=-14?2:r<=-7?3:r<0?4:r===0?5:6; };
  const PH=[[0,"No date yet"],[1,"4+ weeks before"],[2,"2–4 weeks before"],[3,"The week before"],[4,"Final days"],[5,"Event day"],[6,"After the event"]];
  const by=S.etf||"phase"; const sorted=ts.slice().sort((a,b)=>(a.due||"9999")<(b.due||"9999")?-1:(a.due||"9999")>(b.due||"9999")?1:0);
  let groups; if(by==="phase") groups=PH.map(([k,l])=>[l,sorted.filter(t=>phase(t)===k)]); else if(by==="section") groups=EV_SECTIONS.map(s=>[s,sorted.filter(t=>(t.section||"General")===s)]); else { const us=[...new Set(sorted.flatMap(t=>tAss(t).length?tAss(t):[""]))].sort((a,b)=>a===""?1:b===""?-1:nameOf(a).localeCompare(nameOf(b))); groups=us.map(u=>[u?nameOf(u):"Unassigned",sorted.filter(t=>u?tAss(t).includes(u):!tAss(t).length)]); }
  const needShift=p.date&&ts.some(t=>typeof t.relDays==="number"&&!t.done&&t.due!==shiftS(p.date,t.relDays));
  const secOpts=EV_SECTIONS.map(s=>`<option ${s==="General"?"selected":""}>${s}</option>`).join("");
  return `${needShift&&ed?`<div class="dup" style="margin-bottom:12px">The event date changed (or was just set). <button class="btn sm" data-act="ev-shift">Update task due dates to match</button></div>`:""}
    ${S.canWrite?`<form class="panel taskAdd evtask" data-forplan="${esc(p.id)}" style="margin-bottom:14px"><input name="title" id="evTaskTitle" placeholder="Add a task for this event…" dir="auto" aria-label="Task"><select name="section" aria-label="Area" data-evsec>${secOpts}</select><input name="due" type="date" aria-label="Due date"><button class="btn pri" type="submit">Add</button><div class="taskAddWho" style="flex-basis:100%"><span class="hint">Who:</span>${pick("ta-ev",roleFor(p,"General"),{name:"assignees",label:"Assign to"})}</div></form>`:""}
    <div class="seg" role="tablist" style="margin-bottom:12px">${[["phase","By timeline"],["section","By area"],["person","By person"]].map(([k,l])=>`<button role="tab" aria-selected="${by===k}" data-etf="${k}">${l}</button>`).join("")}</div>
    ${ts.length? groups.filter(([,g])=>g.length).map(([l,g])=>`<div class="panel" style="margin-bottom:12px"><div class="panel-h"><h3>${esc(l)}</h3><span class="hint">${g.filter(t=>t.done).length}/${g.length} done</span></div><div class="tasks">${g.map(t=>evTaskRow(t,p)).join("")}</div></div>`).join("")
      : `<div class="empty"><b>No tasks yet</b>Add tasks above, or apply a template.${ed?`<div class="toolbar" style="justify-content:center;margin:12px 0 0">${Object.entries(TEMPLATES).filter(([k])=>k!=="blank").map(([k,t])=>`<button class="btn sm" data-tplapply="${k}">${t.icon} ${esc(t.label)}</button>`).join("")}</div>`:""}</div>`}`; }
function evTaskRow(t,p){ const rel=p.date&&t.due?Math.round((parseD(t.due)-parseD(p.date))/864e5):null;
  return `<div class="task ${t.done?"done":""}"><input type="checkbox" data-done="${esc(t.id)}" ${t.done?"checked":""} ${S.canWrite?"":"disabled"} aria-label="Done"><div class="grow"><a href="#" class="t" data-task="${esc(t.id)}" dir="auto">${esc(t.title)}</a>
    <div class="meta">${whoHtml(tAss(t),`<span class="chip soon">Unassigned</span>`)}${dueChip(t.due,t.done)}${rel!==null?`<span>${rel<0?`${-rel}d before`:rel===0?"event day":`${rel}d after`}</span>`:""}<span class="chip">${esc(t.section||"General")}</span></div></div></div>`; }
function evTeam(p,ed){ const roles=live(p.roles).sort((a,b)=>(a[1].at??99)-(b[1].at??99)); const ts=A("tasks").filter(t=>t.planId===p.id);
  return `<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Roles</h3><span class="hint">Tap names to add or remove people. New tasks in an area go to that area's people automatically</span></div>
    <div class="list">${roles.map(([k,r])=>`<div class="row"><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${rUids(r).length?`${esc(andList(rUids(r).map(firstName)))} · ${ts.filter(t=>!t.done&&tAss(t).some(u=>rUids(r).includes(u))).length} open tasks`:"Nobody yet. Tap names to add people"}</div></div>
      ${ed?`${pick("role-"+k,rUids(r),{save:"role:"+k,label:"People for "+r.name})}${k!=="lead"?`<button class="btn sm ghost danger" data-roledel="${esc(k)}" aria-label="Remove role">✕</button>`:""}`:(rUids(r).length?`<span class="meta" style="display:flex;gap:6px;align-items:center">${whoHtml(rUids(r))}</span>`:"")}</div>`).join("")}</div>
    ${ed?`<form id="roleForm" class="toolbar" style="margin:12px 0 0"><input id="roleName" placeholder="Add a role: Photographer, MC, Treasurer…" dir="auto" style="flex:1 1 220px"><button class="btn" type="submit">Add role</button><div class="taskAddWho" style="flex-basis:100%"><span class="hint">Who:</span>${pick("roleWho",[],{label:"People for the new role"})}</div></form>`:""}</div>
    <div class="panel"><div class="panel-h"><h3>Workload</h3></div><div class="list">${planTeam(p).map(u=>{ const mine=ts.filter(t=>tAss(t).includes(u)); const open=mine.filter(t=>!t.done); const od=open.filter(t=>t.due&&daysTo(t.due)<0).length;
      return `<div class="row"><span class="meta" style="display:flex;gap:8px;align-items:center">${avImg(u)}<b>${esc(nameOf(u))}</b></span><span class="grow"></span><span class="chip">${open.length} open</span>${od?`<span class="chip hot">${od} overdue</span>`:""}<span class="chip ok">${mine.length-open.length} done</span></div>`; }).join("")||`<div class="colempty">Assign roles to build the team.</div>`}</div></div>`; }
function evBudget(p,ed){ const b=live(p.budget).sort((a,c)=>(a[1].at||0)-(c[1].at||0)); const est=b.reduce((a,[,x])=>a+(+x.est||0),0), act=b.reduce((a,[,x])=>a+(+x.actual||0),0), total=+p.budgetTotal||0; const dis=ed?"":"disabled";
  return `<div class="tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="tile"><span class="v small">${money(total)}</span><span class="l">budget</span></div><div class="tile"><span class="v small" style="color:${total&&est>total?"var(--coral)":"inherit"}">${money(est)}</span><span class="l">planned${total?` · ${money(total-est)} left`:""}</span></div><div class="tile"><span class="v small">${money(act)}</span><span class="l">spent so far</span></div></div>
    ${total?`<div class="prog" style="height:10px;margin-bottom:16px" title="${Math.round(100*est/total)}% planned"><span style="width:${Math.min(100,Math.round(100*est/total))}%;background:${est>total?"var(--coral)":"var(--m-plan)"}"></span></div>`:""}
    <div class="panel"><div class="panel-h"><h3>Budget lines</h3>${ed?`<form id="btForm" style="display:flex;gap:6px;align-items:center"><label class="hint" for="bTotal">Total budget ₪</label><input id="bTotal" type="number" min="0" value="${esc(total||"")}" style="width:110px"><button class="btn sm">Set</button></form>`:""}</div>
      <div class="btable" role="table"><div class="bh" role="row"><span>Item</span><span>Planned ₪</span><span>Actual ₪</span><span>Paid by</span><span>Paid</span><span></span></div>
      ${b.map(([k,x])=>`<div class="br" role="row"><span dir="auto">${esc(x.label)}</span><input type="number" min="0" value="${esc(x.est||"")}" data-bud="${esc(k)}" data-f="est" aria-label="Planned for ${esc(x.label)}" ${dis}><input type="number" min="0" value="${esc(x.actual||"")}" data-bud="${esc(k)}" data-f="actual" aria-label="Actual for ${esc(x.label)}" ${dis}><select data-bud="${esc(k)}" data-f="by" aria-label="Paid by" ${dis}>${peopleOpts(x.by,"—")}<option value="sponsor" ${x.by==="sponsor"?"selected":""}>Sponsor</option><option value="uni" ${x.by==="uni"?"selected":""}>University</option></select><input type="checkbox" data-bud="${esc(k)}" data-f="paid" ${x.paid?"checked":""} aria-label="Paid" ${dis}>${ed?`<button class="btn sm ghost danger" data-buddel="${esc(k)}" aria-label="Remove">✕</button>`:"<span></span>"}</div>`).join("")||`<div class="colempty">No budget lines yet.</div>`}
      </div>${ed?`<form id="budForm" class="toolbar" style="margin:12px 0 0"><input id="budLabel" placeholder="Add an item: Pizza, Printing, Speaker gift…" dir="auto" style="flex:1 1 220px"><input id="budEst" type="number" min="0" placeholder="₪ planned" style="width:120px"><button class="btn" type="submit">Add</button></form>`:""}</div>`; }
function evGuests(p,ed){ const g=live(p.guests).sort((a,b)=>(a[1].at||0)-(b[1].at||0)); const dis=ed?"":"disabled";
  return `<div class="panel"><div class="panel-h"><h3>Speakers, sponsors and guests</h3><span class="hint">${g.filter(([,x])=>x.status==="confirmed").length} confirmed</span></div>
    <div class="list">${g.map(([k,x])=>{ const c=x.contactId&&S.contacts.find(y=>y.id===x.contactId); return `<div class="row"><div class="grow"><div class="t" dir="auto">${esc(x.name)}${c?` <a href="#" data-contact="${esc(c.id)}" class="hint">contact card</a>`:""}</div><div class="s" dir="auto">${esc((GKINDS.find(q=>q[0]===x.kind)||["","Guest"])[1])}${gOwners(x).length?" · "+esc(andList(gOwners(x).map(firstName)))+" in touch":""}${x.note?" · "+esc(x.note):""}</div></div>
      <select data-guest="${esc(k)}" data-f="status" aria-label="Status" ${dis}>${GSTAT.map(([v,l])=>`<option value="${v}" ${x.status===v?"selected":""}>${l}</option>`).join("")}</select>${pick("guest-"+k,gOwners(x),{save:"guest:"+k,dis:!ed,label:"Who's in touch"})}${ed?`<button class="btn sm ghost danger" data-guestdel="${esc(k)}" aria-label="Remove">✕</button>`:""}</div>`; }).join("")||`<div class="colempty">Nobody added yet.</div>`}</div>
    ${ed?`<form id="guestForm" class="toolbar" style="margin:12px 0 0"><select id="gContact" aria-label="From contacts"><option value="">New person…</option>${A("contacts").sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.org?" · "+esc(c.org):""}</option>`).join("")}</select><input id="gName" placeholder="Name" dir="auto" style="flex:1 1 160px"><select id="gKind" aria-label="Kind">${GKINDS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select><input id="gNote" placeholder="Note (optional)" dir="auto" style="flex:1 1 160px"><button class="btn" type="submit">Add</button></form>`:""}</div>`; }
function evRun(p,ed){ const r=live(p.run).sort((a,b)=>(a[1].time||"")<(b[1].time||"")?-1:(a[1].time||"")>(b[1].time||"")?1:(a[1].at||0)-(b[1].at||0)); const dis=ed?"":"disabled";
  return `<div class="panel"><div class="panel-h"><h3>Run of show${p.date?" · "+esc(fmtDW(p.date)):""}</h3><span class="hint">The minute-by-minute plan for the day</span></div>
    <div class="list">${r.map(([k,x])=>`<div class="row"><input type="time" value="${esc(x.time||"")}" data-run="${esc(k)}" data-f="time" aria-label="Time" style="width:120px" ${dis}><div class="grow"><input value="${esc(x.what||"")}" data-run="${esc(k)}" data-f="what" dir="auto" aria-label="What happens" style="width:100%" ${dis}></div>${pick("run-"+k,runWho(x),{save:"run:"+k,dis:!ed,label:"Who"})}${ed?`<button class="btn sm ghost danger" data-rundel="${esc(k)}" aria-label="Remove">✕</button>`:""}</div>`).join("")||`<div class="colempty">Nothing planned yet.</div>`}</div>
    ${ed?`<form id="runForm" class="toolbar" style="margin:12px 0 0"><input id="runTime" type="time" aria-label="Time"><input id="runWhat" placeholder="What happens: Doors open, Opening words…" dir="auto" style="flex:1 1 220px"><button class="btn" type="submit">Add</button><div class="taskAddWho" style="flex-basis:100%"><span class="hint">Who:</span>${pick("runWho",[],{label:"Who"})}</div></form>`:""}</div>`; }
function evAfter(p,ed){ const rv=p.review||{}; const dis=ed?"":"disabled";
  return `<form class="panel" id="reviewForm" novalidate><div class="panel-h"><h3>After the event</h3><span class="hint">Write it down while it's fresh, so the next event goes better</span></div><div style="display:flex;flex-direction:column;gap:12px">
    <div class="grid2"><label class="f">Registered<input id="rReg" type="number" min="0" value="${esc(rv.registered||"")}" ${dis}></label><label class="f">Actually came<input id="rAtt" type="number" min="0" value="${esc(rv.attendance||"")}" ${dis}></label><label class="f">Rating (1–5)<input id="rRate" type="number" min="1" max="5" value="${esc(rv.rating||"")}" ${dis}></label></div>
    <label class="f">What went well<textarea id="rWell" rows="3" dir="auto" ${dis}>${esc(rv.wentWell||"")}</textarea></label>
    <label class="f">What to do differently next time<textarea id="rImprove" rows="3" dir="auto" ${dis}>${esc(rv.improve||"")}</textarea></label>
    <label class="f">Photos / slides link<input id="rPhotos" type="url" value="${esc(rv.photos||"")}" placeholder="https://…" ${dis}></label>
    ${ed?`<div class="toolbar" style="margin:0"><button class="btn pri" type="submit">Save review</button>${p.stage!=="done"?`<button type="button" class="btn" data-evstage="done">Mark the event as done</button>`:""}${S.canWrite?`<button type="button" class="btn" data-act="ev-dup">Plan it again (copy)</button>`:""}</div>`:""}</div></form>`; }

async function savePick(box, spec, ids, prev){ const [kind,key]=spec.split(":"); let ok=false;
  if(kind==="sec"){ await saveSettings({owners:{[key]:ids}}); ok=true; }
  else { const p=S.plans.find(x=>x.id===S.eventId); if(!p) return;
    if(kind==="role"){ const r=Object.assign({},(p.roles||{})[key],{uids:ids,uid:ids[0]||""}); const roles=Object.assign({},p.roles,{[key]:r}); const patch={roles:{[key]:{uids:ids,uid:ids[0]||""}},team:syncTeam(p,roles)}; if(key==="lead"){ patch.lead=ids[0]||""; patch.leads=ids; }
      const added=ids.filter(u=>!prev.includes(u)); ok=await evUpdate(p,patch,added.length?`made ${andList(added.map(firstName))} ${r.name} for`:null);
      if(ok&&ids.length){ const secs=Object.entries(SECTION_ROLE).filter(([,rk])=>rk===key).map(([sec])=>sec); const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x)); const open=A("tasks").filter(t=>t.planId===p.id&&!t.done&&secs.includes(t.section||"General")&&(!tAss(t).length||(prev.length&&same(tAss(t),prev))));
        for(const t of open) await upd("tasks",t.id,{assignees:ids,assignee:ids[0],...stamp()}); if(open.length) toast(`${plural(open.length,"task")} in ${secs.join(" / ")} now ${open.length===1?"goes":"go"} to ${andList(ids.map(firstName))}.`); } }
    else if(kind==="guest") ok=await evUpdate(p,{guests:{[key]:{owners:ids,owner:ids[0]||""}}});
    else if(kind==="run") ok=await evUpdate(p,{run:{[key]:{whos:ids,who:ids[0]||""}}}); }
  if(ok&&box) delete box.dataset.dirty; }
async function evUpdate(p, data, verb){ if(await upd("plans",p.id,{...data,...stamp()})){ if(verb) logAct(verb,p.title); return true; } return false; }
function syncTeam(p, roles){ const s=new Set([p.createdBy].filter(Boolean)); Object.values(roles).forEach(r=>rUids(r).forEach(u=>s.add(u))); return [...s]; }
async function applyTemplate(p, tk){ const tpl=TEMPLATES[tk]; for(const [off,sec,t] of tpl.tasks){ const who=roleFor(p,sec); await add("tasks",{title:t,assignees:who,assignee:who[0]||"",due:p.date?shiftS(p.date,off):"",relDays:off,section:sec,done:false,notes:"",meetingId:"",occurrence:"",planId:p.id,createdBy:S.meId,createdAt:Date.now(),...stamp()}); }
  const patch={template:tk}; if(!live(p.run).length&&tpl.run.length){ patch.run={}; tpl.run.forEach(([t,w],i)=>patch.run["r"+i]={time:t,what:w,who:"",at:i}); } if(!live(p.budget).length&&tpl.budget.length){ patch.budget={}; tpl.budget.forEach(([l,e],i)=>patch.budget["b"+i]={label:l,est:e,actual:0,paid:false,by:"",at:i}); if(!p.budgetTotal) patch.budgetTotal=tpl.budget.reduce((a,b)=>a+b[1],0); }
  await evUpdate(p,patch,`applied the ${tpl.label.toLowerCase()} template to`); toast(`Added ${tpl.tasks.length} tasks.`); }
async function duplicatePlan(p){ const ts=A("tasks").filter(t=>t.planId===p.id);
  const copy={title:p.title+" (copy)",template:p.template||"blank",stage:"idea",date:"",time:p.time||"",endTime:p.endTime||"",location:p.location||"",capacity:p.capacity||"",audience:p.audience||"",link:"",description:p.description||"",lead:S.meId,leads:[S.meId],team:[S.meId],roles:Object.fromEntries(live(p.roles).map(([k,r])=>[k,{...r,uid:k==="lead"?S.meId:"",uids:k==="lead"?[S.meId]:[]}])),
    checklist:Object.fromEntries(live(p.checklist).map(([k,c])=>[k,{text:c.text,done:false,at:c.at||0}])),run:Object.fromEntries(live(p.run).map(([k,r])=>[k,{...r}])),budget:Object.fromEntries(live(p.budget).map(([k,b])=>[k,{label:b.label,est:b.est,actual:0,paid:false,by:"",at:b.at||0}])),budgetTotal:p.budgetTotal||0,guests:{},review:{},itemId:"",copiedFrom:p.id,createdBy:S.meId,createdAt:Date.now(),...stamp()};
  const id=await add("plans",copy); if(!id) return; for(const t of ts){ await add("tasks",{title:t.title,assignee:"",assignees:[],due:"",relDays:typeof t.relDays==="number"?t.relDays:null,section:t.section||"General",done:false,notes:t.notes||"",meetingId:"",occurrence:"",planId:id,createdBy:S.meId,createdAt:Date.now(),...stamp()}); }
  logAct("copied an event:",p.title); await whenExists("plans",id); S.etab="overview"; location.hash="event-"+id; toast("Copied with its tasks, run of show and budget. Set a date and assign people."); }

// contact
function openContact(id){ const c=id? S.contacts.find(x=>x.id===id) : null; if(id&&!c) return;
  openD("contact",{id:id||null,base:c?(c.updatedAt||0):0,draft:Object.assign({name:"",org:"",role:"",kind:"speaker",email:"",phone:"",owner:S.meId,owners:[S.meId],lastContact:"",notes:""},c?JSON.parse(JSON.stringify(c)):{})}); }
function drawContact(key, live){
  const D=S.drawer, d=D.draft, c=D.id?S.contacts.find(x=>x.id===D.id):null; if(live){ const s=$("#staleBox"); if(s) s.innerHTML=staleHtml(c); return; }
  const ro=!canEditContact(c), dis=ro?"disabled":"";
  return shell(key,"Contact",`<div class="dh"><h2>${c?esc(c.name):"New contact"}</h2><button class="btn ghost" data-act="close" aria-label="Close">✕</button></div>
    ${c?`<div class="hint">Added by ${esc(nameOf(c.createdBy))} ${c.createdAt?agoPhrase(c.createdAt):""}</div>`:""}<div id="staleBox">${staleHtml(c)}</div>
    <form class="box" id="contactForm" novalidate>
      <label class="f"><span class="lh">Name<span class="req">*</span></span><input id="oName" dir="auto" value="${esc(d.name)}" ${dis} data-autofocus></label>
      <div class="grid2"><label class="f">Organization<input id="oOrg" dir="auto" value="${esc(d.org)}" placeholder="Company, lab, NGO" ${dis}></label><label class="f">Role<input id="oRole" dir="auto" value="${esc(d.role)}" placeholder="CEO · PI · Program manager" ${dis}></label>
        <label class="f">Kind<select id="oKind" ${dis}>${CKINDS.map(([k,l])=>`<option value="${k}" ${d.kind===k?"selected":""}>${l}</option>`).join("")}</select></label><div class="f" style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted);font-weight:500;grid-column:1/-1">Who on our team is in touch${pick("oOwners",cOwners(d),{dis:ro,label:"Our contact people"})}</div>
        <label class="f">Email<input id="oEmail" type="email" value="${esc(d.email)}" ${dis}></label><label class="f">Phone<input id="oPhone" type="tel" value="${esc(d.phone)}" ${dis}></label>
        <label class="f">Last contact<input id="oLast" type="date" value="${esc(d.lastContact)}" ${dis}></label></div>
      <label class="f">Notes<textarea id="oNotes" rows="4" dir="auto" placeholder="How we know them, what we talked about, what they could help with" ${dis}>${esc(d.notes)}</textarea></label>
      <div id="oErr"></div>
      <div class="toolbar" style="margin:0">${ro?"":`<button class="btn pri" type="submit">${c?"Save changes":"Add contact"}</button>${c?`<button type="button" class="btn" data-act="contact-today">Talked to them today</button>`:""}`}${c&&c.email?`<span class="hint" style="user-select:all">${esc(c.email)}</span>`:""}<span style="flex:1"></span>${c&&!ro?`<button type="button" class="btn ghost danger" data-act="del">Delete</button>`:""}</div>
      ${ro?"":delBlock("Move this contact to the Trash?")}</form>`);
}
async function submitContact(today){ const D=S.drawer; const name=$("#oName").value.trim(); if(!name){ $("#oErr").innerHTML=`<div class="dup">Add a name first.</div>`; return; }
  const data={name,org:$("#oOrg").value.trim(),role:$("#oRole").value.trim(),kind:$("#oKind").value,owners:pickVal(document.querySelector('.ppick[data-pp="oOwners"]')),owner:pickVal(document.querySelector('.ppick[data-pp="oOwners"]'))[0]||"",email:$("#oEmail").value.trim(),phone:$("#oPhone").value.trim(),lastContact:today?todayS():$("#oLast").value,notes:$("#oNotes").value.trim(),...stamp()};
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
      if(i.recurring&&i.recurring!=="none"){ const c=JSON.parse(JSON.stringify(i)); delete c.id; Object.assign(c,{status:"found",issueNo:null,votes:{},comments:{},owner:null,owners:[],order:null,date:shiftDate(i.date,i.recurring),deadline:shiftDate(i.deadline,i.recurring),createdAt:Date.now(),...stamp(),addedBy:S.meId,tags:[...new Set([...(i.tags||[]),"recurring"])]}); await S.db.collection("items").add(c); } }
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
  const t=e.target.closest("[data-act],[data-open],[data-meet],[data-plan],[data-task],[data-contact],[data-vote],[data-next],[data-pnext],[data-check],[data-delsrc],[data-move],[data-copyissue],[data-cal],[data-day],[data-done],[data-tf],[data-rsvp],[data-pstage],[data-ck],[data-ckdel],[data-mention],[data-restore],[data-purge],[data-sugg-ok],[data-sugg-no],[data-unskip],[data-ppid],[data-etab],[data-etf],[data-evstage],[data-tplapply],[data-roledel],[data-buddel],[data-guestdel],[data-rundel]");
  if(!t){ if(e.target.classList.contains("scrim")) closeDrawer(); return; }
  const ds=t.dataset;
  if(ds.ppid){ const box=t.closest(".ppick"); const cur=pickVal(box); const next=cur.includes(ds.ppid)?cur.filter(x=>x!==ds.ppid):[...cur,ds.ppid]; pickSet(box,next); box.dataset.dirty="1"; if(box.dataset.ppsave) savePick(box,box.dataset.ppsave,next,cur); return; }
  if(ds.done!==undefined&&t.tagName==="INPUT"){ toggleTask(ds.done); return; }
  if(ds.done!==undefined){ await toggleTask(ds.done); closeDrawer(); return; }
  if(ds.next){ const it=S.items.find(i=>i.id===ds.next); const ns=it&&nextStage(it.status); if(ns){ await moveStage(it.id,ns); toast(`Moved to ${STAGE[ns]}.`); } return; }
  if(ds.pnext){ const p=S.plans.find(x=>x.id===ds.pnext); const ix=PSTAGES.findIndex(x=>x[0]===(p.stage||"idea")); const ns=PSTAGES[ix+1]; if(ns&&await upd("plans",p.id,{stage:ns[0],...stamp()})){ logAct(`moved event to ${ns[1]}:`,p.title); } return; }
  if(ds.vote){ vote(ds.id,Number(ds.vote)); return; }
  if(ds.open){ e.preventDefault(); openItem(ds.open); return; }
  if(ds.meet){ e.preventDefault(); openMeeting(ds.meet, null, ds.occ); return; }
  if(ds.unskip){ e.preventDefault(); const mt=S.meetings.find(x=>x.id===S.drawer.id); if(await upd("meetings",mt.id,{exceptions:{[ds.unskip]:{skipped:false}},...stamp()})){ S.drawer.base=null; toast(`${fmtDW(ds.unskip)} is back on the calendar.`); } return; }
  if(ds.plan){ e.preventDefault(); openPlan(ds.plan); return; }
  if(ds.task){ e.preventDefault(); openTask(ds.task); return; }
  if(ds.contact){ openContact(ds.contact); return; }
  if(ds.tf){ S.tf=ds.tf; render(); return; }
  if(ds.rsvp){ const id=S.drawer&&S.drawer.id; const mt=S.meetings.find(x=>x.id===id); if(!mt) return; const occ=isSeries(mt)?S.drawer.occ:""; const cur=rsvpMap(mt,occ)[S.meId]; const v=cur===ds.rsvp?null:ds.rsvp;
    await upd("meetings",id,occ?{orsvp:{[occ]:{[S.meId]:v}},...stamp()}:{rsvp:{[S.meId]:v},...stamp()}); S.drawer.base=null; return; }
  if(ds.etab){ e.preventDefault(); S.etab=ds.etab; render(); window.scrollTo(0,0); return; }
  if(ds.etf){ S.etf=ds.etf; render(); return; }
  const EP=()=>S.plans.find(x=>x.id===S.eventId);
  if(ds.evstage){ const p=EP(); if(p&&p.stage!==ds.evstage) evUpdate(p,{stage:ds.evstage},`moved event to ${PSTAGE[ds.evstage]}:`); return; }
  if(ds.tplapply){ const p=EP(); if(p) applyTemplate(p,ds.tplapply); return; }
  if(ds.roledel){ const p=EP(); const roles=Object.assign({},p.roles,{[ds.roledel]:null}); evUpdate(p,{roles:{[ds.roledel]:null},team:syncTeam(p,roles)}); return; }
  if(ds.buddel){ evUpdate(EP(),{budget:{[ds.buddel]:null}}); return; }
  if(ds.guestdel){ evUpdate(EP(),{guests:{[ds.guestdel]:null}}); return; }
  if(ds.rundel){ evUpdate(EP(),{run:{[ds.rundel]:null}}); return; }
  if(ds.ck&&t.tagName==="INPUT"){ const p=S.plans.find(x=>x.id===S.eventId); const c=(p.checklist||{})[ds.ck]; if(c){ await upd("plans",p.id,{checklist:{[ds.ck]:{done:!c.done,by:S.meId}},...stamp()}); S.drawer.base=null; if(!c.done) logAct(`ticked “${c.text}” for`,p.title); } return; }
  if(ds.ckdel){ evUpdate(S.plans.find(x=>x.id===S.eventId),{checklist:{[ds.ckdel]:null}}); return; }
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
  else if(a==="claim"||a==="unclaim"){ const it=S.items.find(i=>i.id===D.id); readItemForm(); const cur=iOwners(it); const next=a==="claim"?[...new Set([...cur,S.meId])]:cur.filter(u=>u!==S.meId);
    if(await upd("items",D.id,{owners:next,owner:next[0]||null})){ if(a==="claim"){ logAct("is writing",it.title,D.id); if((it.status||"found")!=="issue"&&it.status!=="archived"&&await upd("items",D.id,{status:"writing",...stamp()})) D.draft.status="writing"; } D.draft.owners=next; D.base=null; bump(); } }
  else if(a==="del"){ S.drawer.confirmDel=true; bump(); }
  else if(a==="del-no"){ S.drawer.confirmDel=false; bump(); }
  else if(a==="del-yes"){ trash({item:"items",meeting:"meetings",task:"tasks",plan:"plans",contact:"contacts"}[D.kind], D.id); }
  else if(a==="plan-to-news"){ const p=S.plans.find(x=>x.id===S.eventId); openItem(null,{type:"event",title:p.title,date:p.date,location:p.location,url:p.link||"",summary:p.description||""}); S.drawer.fromPlan=p.id; }
  else if(a==="ev-del"){ S.evConfirmDel=true; render(); }
  else if(a==="ev-del-no"){ S.evConfirmDel=false; render(); }
  else if(a==="ev-del-yes"){ S.evConfirmDel=false; const id=S.eventId; await trash("plans",id); location.hash="events"; }
  else if(a==="ev-shift"){ const p=S.plans.find(x=>x.id===S.eventId); let n=0; for(const t of A("tasks").filter(t=>t.planId===p.id&&typeof t.relDays==="number"&&!t.done)){ const nd=shiftS(p.date,t.relDays); if(t.due!==nd&&await upd("tasks",t.id,{due:nd,...stamp()})) n++; } toast(`Updated ${plural(n,"due date")}.`); }
  else if(a==="ev-dup"){ duplicatePlan(S.plans.find(x=>x.id===S.eventId)); }
  else if(a==="contact-today") submitContact(true);
  else if(a==="occ-skip"){ const mt=S.meetings.find(x=>x.id===D.id), k=D.occ; if(await upd("meetings",mt.id,{exceptions:{[k]:{skipped:true}},...stamp()})){ logAct(`skipped ${fmtD(k)}:`,mt.title); closeDrawer(); toast(`${fmtDW(k)} skipped.`,{label:"Undo",fn:()=>upd("meetings",mt.id,{exceptions:{[k]:{skipped:false}},...stamp()})}); } }
  else if(a==="occ-reset"){ const mt=S.meetings.find(x=>x.id===D.id), k=D.occ; const notes=occOf(mt,k).notes; if(await upd("meetings",mt.id,{exceptions:{[k]:notes?{notes,skipped:false,date:null,time:null,endTime:null}:null},...stamp()})){ closeDrawer(); toast(`Back to the usual date and time.`); } }
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
  if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches(".ag[role=button],.row[role=button],.card[role=button]")){ e.preventDefault(); e.target.click(); } });
document.addEventListener("submit", async e=>{
  e.preventDefault(); const f=e.target, id=f.id;
  if(f.classList.contains("taskAdd")) return addTask(f);
  if(id==="itemForm") submitItem(); else if(id==="meetForm") submitMeeting(); else if(id==="occForm") submitOcc(); else if(id==="taskForm") submitTask(); else if(id==="planForm") submitPlan(); else if(id==="contactForm") submitContact(false);
  else if(id==="evDetails"){ const p=S.plans.find(x=>x.id===S.eventId); const v=x=>$("#"+x).value.trim(); const data={title:v("eTitle")||p.title,date:$("#eDate").value,time:$("#eTime").value,endTime:$("#eEnd").value,location:v("eLoc"),capacity:v("eCap"),audience:v("eAud"),link:v("eLink"),description:v("eDesc")};
    if(await evUpdate(p,data,p.date!==data.date?"moved the date of":"updated")){ f.querySelectorAll("input,textarea").forEach(el=>el.defaultValue=el.value); toast(p.date!==data.date&&A("tasks").some(t=>t.planId===p.id&&typeof t.relDays==="number")?"Saved. Check the Tasks tab to update due dates.":"Saved."); } }
  else if(id==="roleForm"){ const p=S.plans.find(x=>x.id===S.eventId); const name=$("#roleName").value.trim(); if(!name) return; const k=nid("role"); const who=pickVal(document.querySelector('.ppick[data-pp="roleWho"]')); const r={name,uids:who,uid:who[0]||"",at:Date.now()}; const roles=Object.assign({},p.roles,{[k]:r});
    if(await evUpdate(p,{roles:{[k]:r},team:syncTeam(p,roles)})){ f.reset(); const b=f.querySelector(".ppick"); pickSet(b,[]); if(b) delete b.dataset.dirty; toast(`Added ${name}.`); } }
  else if(id==="budForm"){ const p=S.plans.find(x=>x.id===S.eventId); const label=$("#budLabel").value.trim(); if(!label) return; if(await evUpdate(p,{budget:{[nid("b")]:{label,est:Number($("#budEst").value)||0,actual:0,paid:false,by:"",at:Date.now()}}})) f.reset(); }
  else if(id==="btForm"){ const p=S.plans.find(x=>x.id===S.eventId); if(await evUpdate(p,{budgetTotal:Number($("#bTotal").value)||0})){ $("#bTotal").defaultValue=$("#bTotal").value; toast("Budget set."); } }
  else if(id==="guestForm"){ const p=S.plans.find(x=>x.id===S.eventId); const cid=$("#gContact").value; const c=cid&&S.contacts.find(x=>x.id===cid); const name=$("#gName").value.trim()||(c&&c.name)||""; if(!name){ toast("Add a name or pick a contact."); return; }
    if(await evUpdate(p,{guests:{[nid("g")]:{name,kind:$("#gKind").value,status:"idea",owners:c?cOwners(c):[],owner:(c&&cOwners(c)[0])||"",contactId:cid||"",note:$("#gNote").value.trim(),at:Date.now()}}})){ f.reset(); f.querySelectorAll("select").forEach(x=>delete x.dataset.dirty); } }
  else if(id==="runForm"){ const p=S.plans.find(x=>x.id===S.eventId); const what=$("#runWhat").value.trim(); if(!what) return; if(await evUpdate(p,{run:{[nid("r")]:{time:$("#runTime").value,what,whos:pickVal(f.querySelector(".ppick")),who:pickVal(f.querySelector(".ppick"))[0]||"",at:Date.now()}}})){ f.reset(); const b=f.querySelector(".ppick"); pickSet(b,[]); if(b) delete b.dataset.dirty; } }
  else if(id==="reviewForm"){ const p=S.plans.find(x=>x.id===S.eventId); const review={registered:$("#rReg").value,attendance:$("#rAtt").value,rating:$("#rRate").value,wentWell:$("#rWell").value.trim(),improve:$("#rImprove").value.trim(),photos:$("#rPhotos").value.trim()};
    if(await evUpdate(p,{review},"wrote the review for")){ f.querySelectorAll("input,textarea").forEach(el=>el.defaultValue=el.value); toast("Review saved."); } }
  else if(id==="quickForm"){ const u=$("#quickUrl").value.trim(); if(!u) return; $("#quickUrl").value=""; openItem(null,{url:/^https?:\/\//i.test(u)?u:"https://"+u}); }
  else if(id==="ckForm"){ const inp=$("#ckText"); const text=inp.value.trim(); if(!text) return; const p=S.plans.find(x=>x.id===S.eventId); const k=nid("c");
    inp.value=""; inp.defaultValue=""; await evUpdate(p,{checklist:{[k]:{text,done:false,at:Date.now()}}}); }
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
  const id=e.target.id, ds=e.target.dataset; if(e.target.tagName==="SELECT") e.target.dataset.dirty="1";
  if(id==="ftype"){S.f.type=e.target.value;render();} else if(id==="fwho"){S.f.who=e.target.value;render();} else if(id==="ftag"){S.f.tag=e.target.value;render();} else if(id==="ckind"){S.cf.kind=e.target.value;render();}
  else if(id==="intro"){ saveSettings({draftIntro:e.target.value}); }
  else if(ds.bud){ const v=e.target.type==="checkbox"?e.target.checked:e.target.tagName==="SELECT"?e.target.value:(Number(e.target.value)||0); evUpdate(S.plans.find(x=>x.id===S.eventId),{budget:{[ds.bud]:{[ds.f]:v}}}).then(()=>{ e.target.defaultValue=e.target.value; delete e.target.dataset.dirty; if(e.target.type==="checkbox") e.target.defaultChecked=e.target.checked; }); }
  else if(ds.guest){ evUpdate(S.plans.find(x=>x.id===S.eventId),{guests:{[ds.guest]:{[ds.f]:e.target.value}}}).then(()=>delete e.target.dataset.dirty); }
  else if(ds.run){ evUpdate(S.plans.find(x=>x.id===S.eventId),{run:{[ds.run]:{[ds.f]:e.target.value}}}).then(()=>{ e.target.defaultValue=e.target.value; delete e.target.dataset.dirty; }); }
  else if(ds.evsec!==undefined){ const p=S.plans.find(x=>x.id===S.eventId); const b=e.target.form.querySelector(".ppick"); if(b){ pickSet(b,roleFor(p,e.target.value)); b.dataset.dirty="1"; } }
  else if(id==="gContact"){ const c=S.contacts.find(x=>x.id===e.target.value); if(c){ $("#gName").value=c.name; const k={speaker:"speaker",sponsor:"sponsor",partner:"partner"}[c.kind]; if(k) $("#gKind").value=k; } }
  else if(id==="mRepeat"){ const w=$("#mUntilWrap"); if(w) w.hidden=e.target.value==="none"; }
  else if(id==="dUrl"){ const u=e.target.value.trim(); if(u&&S.drawer&&!S.drawer.id){ readItemForm(); if(!S.drawer.draft.title) fetchMeta(u); } }
  else if(e.target.name==="dType"&&S.drawer){ readItemForm(); bump(); }
  else if(id==="dStatus"&&ds.quickstage&&S.drawer){ const st=e.target.value; moveStage(S.drawer.id,st).then(()=>{ if(S.drawer){ S.drawer.draft.status=st; toast(`Moved to ${STAGE[st]}.`);} }); }
  else if(id==="restoreFile"&&e.target.files[0]){ $("#restoreConfirm").innerHTML=`<div class="confirm">Restore “${esc(e.target.files[0].name)}”? Records in the file overwrite the current versions with the same ID; nothing else is deleted. <button class="btn sm danger" data-act="restore-yes">Restore</button><button class="btn sm" data-act="restore-no">Cancel</button></div>`; }
  else if(ds.access){ changeRole(ds.access, e.target.value); }
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
function route(){ const h=location.hash.replace("#",""); if(h.startsWith("event-")){ if(S.eventId!==h.slice(6)){ S.etab="overview"; S.evConfirmDel=false; } S.view="event"; S.eventId=h.slice(6); window.scrollTo(0,0); } else S.view=ALLV.includes(h)?h:"home"; render(); }
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
