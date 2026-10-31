// Connects Digest Desk to Firebase: Google sign-in + Firestore database.
// The app talks to a small "db" and "user" interface; this file provides both on top of Firebase.
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// The site owner: always an admin. Must match ownerEmail() in the Firestore rules.
const OWNER_EMAIL = "scharfdan2000@gmail.com";
window.__ownerEmail = OWNER_EMAIL;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let authState = { kind: "loading" };
// Google blocks sign-in inside apps' built-in browsers (WhatsApp, Instagram, Facebook, LinkedIn, Telegram...).
const UA = navigator.userAgent || "";
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|Telegram|Snapchat|TikTok|musical_ly|Twitter|MicroMessenger|; wv\)|WhatsApp/i.test(UA);
const IS_IOS = /iPhone|iPad|iPod/i.test(UA);
const inAppHelp = () => `<div class="err" style="display:block;max-width:520px">You opened this inside another app's browser, where Google doesn't allow sign-in.<br><b>${IS_IOS ? "Tap ⋯ or the Share icon → Open in Safari." : "Tap ⋮ → Open in Chrome (or “Open in browser”)."}</b><br><button class="btn" data-auth="copylink" style="margin-top:8px">Copy link</button> then paste it into ${IS_IOS ? "Safari" : "Chrome"}.</div>`;
window.__authScreen = () => {
  const a = authState;
  const hero = (body) => `<section class="hero landing"><canvas class="dna" data-x0="0.56" aria-hidden="true"></canvas><div class="hx"><div class="kicker">NEWSLETTER DESK</div><h1>Nucleate <span class="dash">–</span> Technion Branch</h1>${body}</div></section>`;
  if (a.kind === "setup") return hero(`<p>Almost there: paste your Firebase settings into <code>firebase-config.js</code>, upload it to GitHub, and reload this page.</p>`);
  if (a.kind === "signin") return hero(`<p>Collect what's happening in biotech around campus, decide together, and send the weekly digest to the group.</p><div class="acts"><button class="btn pri" data-auth="signin">Sign in with Google</button></div><div class="note">Team members only. Use the Google account that's on the access list.</div>${IN_APP ? inAppHelp() : ""}${a.err ? `<div class="err">${a.errHtml ? a.err : esc(a.err)}</div>` : ""}`);
  if (a.kind === "denied") return hero(`<p>You're signed in as <b>${esc(a.email)}</b>, but this account isn't on the team yet. Ask an admin to add it on the Team page, then reload.</p><div class="acts"><button class="btn" data-auth="signout">Use a different account</button></div>`);
  if (a.kind === "error") return hero(`<p>Couldn't reach the database: ${esc(a.msg)}</p><div class="acts"><button class="btn" onclick="location.reload()">Try again</button></div>`);
  return hero(`<p>Opening the desk…</p>`);
};
const showAuth = (s) => { authState = s; const m = document.getElementById("main"); if (m) { m.innerHTML = window.__authScreen(); window.__mountDNA && window.__mountDNA(); } };

if (!firebaseConfig || !firebaseConfig.apiKey || /PASTE/i.test(firebaseConfig.apiKey)) { showAuth({ kind: "setup" }); throw new Error("Firebase config missing"); }

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// ---- error mapping: the app understands these codes ----
const mapErr = e => ({ code: e && e.code === "permission-denied" ? "invalid_argument" : e && e.code === "resource-exhausted" ? "quota_exceeded" : e && e.code === "not-found" ? "invalid_argument" : "unavailable", message: (e && e.message) || String(e) });
const wrap = s => ({ id: s.id, exists: s.exists(), data: () => (s.exists() ? s.data() : undefined) });
const isPlain = v => v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
// Firestore's update replaces nested maps; the app expects a deep merge (e.g. votes.{uid}). Flatten to dotted paths.
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) { const p = prefix ? prefix + "." + k : k; if (isPlain(v) && Object.keys(v).length) flatten(v, p, out); else out[p] = v === undefined ? null : v; }
  return out;
}
const guard = p => p.catch(e => { throw mapErr(e); });
const D = r => ({
  id: r.id, path: r.path,
  get: async () => wrap(await guard(getDoc(r))),
  set: d => guard(setDoc(r, d)),
  update: d => guard(updateDoc(r, flatten(d))),
  delete: () => guard(deleteDoc(r)),
  onSnapshot: (next, err) => onSnapshot(r, s => next(wrap(s)), e => err && err(mapErr(e))),
  collection: p => C(collection(r, p)),
});
const Q = q => ({
  orderBy: (f, d) => Q(query(q, orderBy(f, d || "asc"))),
  limit: n => Q(query(q, limit(n))),
  onSnapshot: (next, err) => onSnapshot(q, s => next({ docs: s.docs.map(wrap), size: s.size, empty: s.empty }), e => err && err(mapErr(e))),
});
const C = cr => Object.assign(Q(cr), {
  path: cr.path,
  doc: id => D(id ? doc(cr, id) : doc(cr)),
  add: async d => D(await guard(addDoc(cr, d))),
});
const db = { doc: p => D(doc(fs, p)), collection: p => C(collection(fs, p)) };

// ---- people: each signed-in person writes their name/photo to users/{uid} ----
let usersCache = {};
const initialsAvatar = (name, uid) => { const hue = [...uid].reduce((a, c) => a + c.charCodeAt(0), 0) % 360; const ch = esc((name || "?").trim()[0] || "?").toUpperCase();
  return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='hsl(${hue},55%,45%)'/><text x='32' y='42' font-size='28' text-anchor='middle' fill='white' font-family='sans-serif'>${ch}</text></svg>`); };
const profileOf = (uid, me) => { const u = usersCache[uid]; return u ? { id: uid, name: u.name || u.email || "", avatarUrl: u.photo || initialsAvatar(u.name || u.email, uid), color: "#888", email: u.email || null, isMe: uid === me, guest: false } : null; };

let started = false;
onAuthStateChanged(auth, async u => {
  if (!u) { showAuth({ kind: "signin" }); document.getElementById("btnSignOut").hidden = true; if (started) location.reload(); return; }
  document.getElementById("btnSignOut").hidden = false;
  showAuth({ kind: "loading" });
  // Access check: rules allow only listed emails. A denied read means this account isn't on the list.
  try { await Promise.race([getDoc(doc(fs, "meta/settings")), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("The database didn't answer within 20 seconds. Check your internet connection and reload."), { code: "timeout" })), 20000))]); }
  catch (e) { if (e && e.code === "permission-denied") return showAuth({ kind: "denied", email: u.email }); return showAuth({ kind: "error", msg: (e && e.message) || "Unknown error" }); }
  try { await setDoc(doc(fs, "users", u.uid), { name: u.displayName || "", email: u.email || "", photo: u.photoURL || "", lastSeen: Date.now() }, { merge: true }); } catch (e) { }
  onSnapshot(collection(fs, "users"), s => {
    usersCache = {}; s.docs.forEach(d => usersCache[d.id] = d.data());
    window.dispatchEvent(new CustomEvent("people-changed", { detail: Object.keys(usersCache) }));
  }, () => { });
  const user = {
    id: async () => u.uid, email: async () => (u.email || "").toLowerCase(), isOwner: async () => (u.email || "").toLowerCase() === OWNER_EMAIL, canEdit: async () => true, can: async () => true,
    me: async () => profileOf(u.uid, u.uid) || { id: u.uid, name: u.displayName || "", avatarUrl: u.photoURL || initialsAvatar(u.displayName, u.uid), color: "#888", email: u.email, isOwner: false, canEdit: true },
    profiles: async ids => { const out = {}; (Array.isArray(ids) ? ids : [ids]).forEach(id => { const p = profileOf(id, u.uid); if (p) out[id] = p; }); return out; },
  };
  window.claude = { use: async n => (n === "db" ? db : n === "user" ? user : null) };
  if (!started && window.__startApp) { started = true; window.__startApp(); }
});

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-auth]"); if (!t) return;
  if (t.dataset.auth === "signout") { await signOut(auth); return; }
  if (t.dataset.auth === "copylink") { const url = location.origin + location.pathname; try { await navigator.clipboard.writeText(url); t.textContent = "Link copied ✓"; } catch { prompt && t.insertAdjacentHTML("afterend", `<div style="user-select:all;margin-top:6px">${esc(url)}</div>`); } return; }
  const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, provider); }
  catch (er) {
    // Never fall back to a full-page redirect: on GitHub Pages it lands people on Firebase's own site instead of coming back.
    if (er && (er.code === "auth/popup-blocked" || er.code === "auth/operation-not-supported-in-this-environment" || er.code === "auth/web-storage-unsupported"))
      return showAuth({ kind: "signin", errHtml: true, err: IN_APP ? "Sign-in can't open inside this app. Open the site in your normal browser (see above)." : "Your browser blocked the Google sign-in window. Allow pop-ups for this site (a blocked-pop-up icon usually appears in the address bar) and tap “Sign in with Google” again. If you opened the link from WhatsApp or Instagram, open it in Safari or Chrome instead." });
    if (er && er.code === "auth/network-request-failed") return showAuth({ kind: "signin", err: "Couldn't reach Google. Check your connection and try again." });
    if (er && er.code === "auth/unauthorized-domain") return showAuth({ kind: "signin", err: "This website address isn't approved in Firebase yet. In Firebase → Authentication → Settings → Authorized domains, add " + location.hostname + "." });
    if (er && er.code !== "auth/popup-closed-by-user" && er.code !== "auth/cancelled-popup-request") showAuth({ kind: "signin", err: "Sign-in failed: " + (er.message || er.code) });
  }
});
