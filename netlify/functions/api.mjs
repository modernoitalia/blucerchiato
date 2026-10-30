import { getStore } from "@netlify/blobs";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const DEFAULT = { year: 2026, fee: 10, fees: {}, members: [], exp: [] };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
const sign = p => createHmac("sha256", secret()).update(p).digest("base64url");
const mkToken = o => { const p = Buffer.from(JSON.stringify(o)).toString("base64url"); return p + "." + sign(p); };
function readToken(t) {
  if (!t || !secret()) return null;
  const [p, s] = t.split(".");
  if (!p || !s) return null;
  const e = sign(p);
  if (s.length !== e.length || !timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return o.exp > Date.now() ? o : null; } catch { return null; }
}
const same = (a, b) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

function clean(b) {
  if (!b || typeof b !== "object") return null;
  const num = v => (v !== null && v !== "" && Number.isFinite(+v)) ? +v : null;
  const str = (v, l = 80) => String(v ?? "").trim().slice(0, l);
  const year = num(b.year), fee = num(b.fee);
  if (!year || fee === null) return null;
  const fees = {};
  for (const [k, v] of Object.entries(b.fees || {})) if (/^\d{4}$/.test(k) && num(v) !== null) fees[k] = +v;
  const seen = new Set(), members = [];
  for (const m of (Array.isArray(b.members) ? b.members : []).slice(0, 2000)) {
    const n = Math.trunc(num(m.n) || 0);
    const nome = str(m.nome), cognome = str(m.cognome);
    if (n < 1 || seen.has(n) || !nome || !cognome) return null;
    seen.add(n);
    const anni = [...new Set((Array.isArray(m.anni) ? m.anni : []).map(Number).filter(y => Number.isInteger(y) && y >= 1950 && y <= 3000))].sort((a, c) => a - c);
    members.push({ n, nome, cognome, nascita: Math.trunc(num(m.nascita) || 0) || null, email: str(m.email, 120).toLowerCase(), anni });
  }
  const exp = (Array.isArray(b.exp) ? b.exp : []).slice(0, 5000).map(e => ({ label: str(e.label, 120), amt: num(e.amt) })).filter(e => e.label && e.amt !== null);
  return { year, fee, fees, members, exp };
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  const store = getStore("club");
  const load = async () => (await store.get("data", { type: "json" })) || DEFAULT;
  const auth = readToken((req.headers.get("authorization") || "").replace(/^Bearer /, ""));
  try {
    if (path === "public" && req.method === "GET") {
      const d = await load();
      return json({ year: d.year, count: d.members.filter(m => m.anni.includes(d.year)).length });
    }
    if (path === "login" && req.method === "POST") {
      if (!secret()) return json({ error: "Server non configurato (mancano le variabili ADMIN_PASSWORD e SESSION_SECRET)." }, 500);
      const body = await req.json().catch(() => ({}));
      const p = String(body.password || "").trim();
      const admin = process.env.ADMIN_PASSWORD || "";
      if (admin && same(p.toLowerCase(), admin.toLowerCase()))
        return json({ token: mkToken({ r: "a", exp: Date.now() + 8 * 36e5 }), role: "admin" });
      const d = await load(), u = norm(p);
      const m = u && d.members.find(x => norm(x.cognome) + x.n === u);
      if (m) return json({ token: mkToken({ r: "m", n: m.n, exp: Date.now() + 8 * 36e5 }), role: "member" });
      await new Promise(r => setTimeout(r, 600));
      return json({ error: "Password non corretta." }, 401);
    }
    if (!auth) return json({ error: "Non autorizzato" }, 401);
    if (path === "club" && req.method === "GET") {
      const d = await load();
      if (auth.r === "a") return json({ role: "admin", data: d });
      const me = d.members.find(x => x.n === auth.n);
      if (!me) return json({ error: "Non autorizzato" }, 401);
      return json({ role: "member", me, data: { year: d.year, fee: d.fee, fees: d.fees, exp: d.exp, members: d.members.map(({ n, nome, cognome, anni }) => ({ n, nome, cognome, anni })) } });
    }
    if (path === "admin/save" && req.method === "POST" && auth.r === "a") {
      const c = clean(await req.json().catch(() => null));
      if (!c) return json({ error: "Dati non validi" }, 400);
      await store.setJSON("data", c);
      return json({ ok: true });
    }
    return json({ error: "Non trovato" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Errore del server" }, 500);
  }
};

export const config = { path: "/api/*" };
