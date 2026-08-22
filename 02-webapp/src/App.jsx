import React, { useState, useEffect, useContext, createContext, useRef, useCallback } from "react";
import * as Supabase from "./supabase.js";
import { suggestGoals, personaliseGoal, askAlpAi, AiUnavailable } from "./ai.js";

// ═══════════════════════════════════════════════════════════
// PDF GENERATION — real, professional ALP document export
// jsPDF is lazy-loaded on first use so it doesn't bloat initial page load
// ═══════════════════════════════════════════════════════════
let _jsPDFModule = null;
async function loadJsPDF() {
  if (!_jsPDFModule) _jsPDFModule = await import("jspdf");
  return _jsPDFModule.jsPDF;
}

async function generateALPPdf({ student, goals = [], notes = "", reviewer = "", school = "", guardians = [] }) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 56;
  let y = 64;
  const purple = [124, 58, 237];
  const warm = [107, 114, 128];
  const black = [17, 17, 17];

  function ensureSpace(h) {
    if (y + h > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 64;
    }
  }
  function heading(text) {
    ensureSpace(30);
    doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(...black);
    doc.text(text.toUpperCase(), margin, y);
    doc.setDrawColor(220, 220, 220); doc.line(margin, y + 6, W - margin, y + 6);
    y += 26;
  }
  function body(text, opts = {}) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(opts.size || 10.5); doc.setTextColor(...(opts.color || warm));
    const lines = doc.splitTextToSize(text || "Not recorded.", W - margin * 2);
    ensureSpace(lines.length * 14 + 10);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 14;
  }
  function fieldRow(pairs) {
    doc.setFontSize(9.5);
    pairs.forEach(([k, v]) => {
      ensureSpace(16);
      doc.setFont("helvetica", "bold"); doc.setTextColor(...black);
      doc.text(`${k}:`, margin, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...warm);
      doc.text(String(v || "–"), margin + 130, y);
      y += 16;
    });
    y += 8;
  }

  // ── Cover header ──
  doc.setFont("times", "bold"); doc.setFontSize(22); doc.setTextColor(...purple);
  doc.text("Accelerated Learning Plan", margin, y); y += 22;
  doc.setFont("times", "italic"); doc.setFontSize(12); doc.setTextColor(...warm);
  doc.text(school || "ALP Platform", margin, y); y += 10;
  doc.setDrawColor(...purple); doc.setLineWidth(1.5); doc.line(margin, y, W - margin, y); y += 30;

  heading("Student Information");
  fieldRow([
    ["Student", student?.name], ["Grade", student?.grade],
    ["Date of Birth", student?.dob], ["Disability / Need", student?.disability],
    ["School", student?.school_name || school], ["Plan Year", student?.plan_year],
    ["Status", (student?.alp_status || "draft").replace("_", " ").toUpperCase()],
  ]);

  // ── Parent / Guardian ──
  // Read from student_guardians. The primary contact is who this PDF
  // is addressed to; the database enforces at most one per student via
  // a partial unique index, so there is no ambiguity to resolve here.
  if (guardians.length) {
    const primary = guardians.find(g => g.is_primary) || guardians[0];
    heading("Parent / Guardian");
    fieldRow([
      ["Name", primary.parent_name],
      ["Relationship", primary.relationship],
      ["Phone", primary.parent_phone],
      ["Email", primary.parent_email],
      ...(primary.address ? [["Address", primary.address]] : []),
    ]);

    const others = guardians.filter(g => g.id !== primary.id);
    if (others.length) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...black);
      ensureSpace(16); doc.text("Additional contacts:", margin, y); y += 16;
      others.forEach(g => {
        ensureSpace(14);
        doc.setFont("helvetica", "normal"); doc.setTextColor(...warm);
        doc.text([g.parent_name, g.relationship, g.parent_phone, g.parent_email]
          .filter(Boolean).join(" · "), margin, y);
        y += 14;
      });
      y += 10;
    }
  }

  heading("Present Levels");
  body(student?.strengths ? `Strengths: ${student.strengths}` : "Strengths: Not recorded.");
  body(student?.growth_areas ? `Growth Areas: ${student.growth_areas}` : "Growth Areas: Not recorded.");
  body(student?.concerns ? `Concerns: ${student.concerns}` : "Concerns: Not recorded.");

  heading("Annual Goals");
  if (!goals.length) { body("No goals recorded yet."); }
  goals.forEach((g, i) => {
    ensureSpace(50);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...purple);
    doc.text(`${i + 1}. [${g.domain || "Goal"}]`, margin, y); y += 14;
    body(g.goal_text || "");
    fieldRow([["Baseline", g.baseline], ["Target", g.target], ["Progress", `${g.current_pct || 0}%`]]);
  });

  // ── Accommodations (Step 6) — from alp_data JSONB blob ──
  const alpData = student?.alp_data || {};
  const accoms = alpData.accommodations || {};
  const accomCategories = { presentation: "Presentation", response: "Response", setting: "Setting", timing: "Timing & Scheduling" };
  const hasAccoms = Object.values(accoms).some(arr => Array.isArray(arr) && arr.length > 0) || alpData.customAccomm;
  if (hasAccoms) {
    heading("Accommodations & Supports");
    Object.entries(accomCategories).forEach(([key, label]) => {
      const list = accoms[key] || [];
      if (list.length) {
        ensureSpace(20);
        doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...black);
        doc.text(`${label}:`, margin, y); y += 14;
        list.forEach(item => { body(`• ${item}`); });
      }
    });
    if (alpData.customAccomm) {
      body(`Additional accommodations: ${alpData.customAccomm}`);
    }
  }

  // ── Interventions (Step 7) — from alp_data JSONB blob ──
  const interventions = alpData.interventions || [];
  if (interventions.length) {
    heading("Intervention Plans");
    interventions.forEach((iv, i) => {
      ensureSpace(60);
      doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor(...purple);
      doc.text(`${i + 1}. ${iv.program || "Intervention"}`, margin, y); y += 14;
      fieldRow([
        ["Status", iv.status || "—"],
        ["Frequency", iv.frequency || "—"],
        ["Duration", iv.duration || "—"],
        ["Staff", iv.staff || "—"],
      ]);
    });
  }

  // ── Future Readiness / Transition (Step 9) — from alp_data ──
  const transTarget = alpData.transitionTarget || student?.transition_target;
  const postSecGoal = alpData.postSecGoal;
  if (transTarget || postSecGoal) {
    heading("Future Readiness & Transition");
    if (transTarget) body(`Transition Target: ${transTarget}`);
    if (postSecGoal) body(`Post-Secondary Goal: ${postSecGoal}`);
    if (alpData.transitionDomain) body(`Domain: ${alpData.transitionDomain}`);
  }

  heading("Meeting / Review Notes");
  body(notes || "No notes recorded.");

  heading("Parent / Guardian Information & Signatures");
  const _sig = guardians.find(g => g.is_primary) || guardians[0] || null;
  fieldRow([
    ["Student", student?.name || "—"],
    ["Parent / Guardian", _sig?.parent_name || "—"],
    ["Relationship", _sig?.relationship || "—"],
    ["Parent Email", _sig?.parent_email || "—"],
    ["Parent Phone", _sig?.parent_phone || "—"],
    ["ALP Coordinator", reviewer || "—"],
    ["Date of Meeting", new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })],
  ]);
  y += 10;
  // Signature lines
  ["ALP Coordinator Signature", "Parent / Guardian Signature"].forEach(label => {
    ensureSpace(40);
    doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(...warm);
    doc.text(label + ":", margin, y);
    doc.setDrawColor(180,180,180); doc.line(margin + 140, y, W - margin, y);
    y += 24;
  });

  doc.setFontSize(8); doc.setTextColor(...warm);
  doc.text(`Generated ${new Date().toLocaleString()} — ALP Platform`, margin, doc.internal.pageSize.getHeight() - 30);

  return doc;
}


// ═══════════════════════════════════════════════════════════
// ALP PLATFORM — ADAPTIVE LEARNING PROGRAM
// Built by Stan Paraclete · www.stanparaclete.com
// ═══════════════════════════════════════════════════════════

// ─── THEME CONTEXT ─────────────────────────────────────────
const ThemeCtx = createContext({ isDark: false, toggle: () => {} });

function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem("alp-theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    try { localStorage.setItem("alp-theme", isDark ? "dark" : "light"); } catch {}
    // Update module-level C so all inline styles re-render with correct colors
    Object.assign(C, isDark ? CD : CL);
  }, [isDark]);

  const toggle = () => setIsDark(d => !d);
  return <ThemeCtx.Provider value={{ isDark, toggle }}>{children}</ThemeCtx.Provider>;
}

function useTheme() { return useContext(ThemeCtx); }

// ─── THEME TOGGLE COMPONENT ────────────────────────────────
function ThemeToggle({ style = {} }) {
  const { isDark, toggle } = useTheme();
  return (
    <button onClick={toggle} title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid var(--border-purple)",
        background: "var(--bg-surface)", cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 16, transition: "all .2s", flexShrink: 0, ...style }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}>
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}

const CSS = `
/* ── ALP AI THEME VARIABLES ──────────────────────────── */
:root {
  --bg-primary:#F5F5F7;
  --bg-secondary:#FFFFFF;
  --bg-card:#FFFFFF;
  --bg-surface:#F5F5F7;
  --bg-hover:#EBEBF0;
  --text-primary:#1D1D1F;
  --text-secondary:#6E6E73;
  --text-muted:#8E8E93;
  --border:#E3E3E8;
  --border-purple:#D9CDF7;
  /* Shadows are near-invisible by default and only appear on lift.
     A surface that is always floating reads as noise. */
  --shadow-card:0 1px 2px rgba(0,0,0,.04);
  --shadow-hover:0 12px 32px rgba(0,0,0,.10),0 2px 6px rgba(0,0,0,.04);
  --shadow-glow:0 0 0 4px rgba(109,40,217,.14);
  --purple-main:#6D28D9;
  --purple-soft:#8B5CF6;
  --purple-accent:#A855F7;
  --sidebar-bg:#111111;
  --sidebar-border:rgba(255,255,255,.07);
  --input-border:#C8B89A;
  --input-color:#1A1A1A;
  --rule-color:#E8DDD0;
}
[data-theme="dark"] {
  --bg-primary:#0F0A1E;
  --bg-secondary:#1B1333;
  --bg-card:#1B1333;
  --bg-surface:rgba(139,92,246,.08);
  --bg-hover:rgba(139,92,246,.14);
  --text-primary:#F0EEFF;
  --text-secondary:rgba(240,238,255,.6);
  --text-muted:rgba(240,238,255,.35);
  --border:rgba(139,92,246,.2);
  --border-purple:rgba(139,92,246,.25);
  --shadow-card:0 4px 24px rgba(0,0,0,.4),0 0 0 1px rgba(139,92,246,.15);
  --shadow-hover:0 8px 32px rgba(139,92,246,.3);
  --shadow-glow:0 0 0 3px rgba(139,92,246,.2);
  --sidebar-bg:#0B0718;
  --sidebar-border:rgba(139,92,246,.15);
  --input-border:rgba(139,92,246,.35);
  --input-color:#F0EEFF;
  --rule-color:rgba(139,92,246,.18);
}
*,*::before,*::after{transition:background-color .25s ease,border-color .2s ease,box-shadow .2s ease;box-sizing:border-box;margin:0;padding:0}
html{font-size:16px}
body{font-family:'DM Sans',sans-serif;background:var(--bg-primary);color:var(--text-primary);-webkit-font-smoothing:antialiased}
button,input,select,textarea{font-family:'DM Sans',sans-serif}
button{cursor:pointer;border:none;background:none}
.dot-bg{background:var(--bg-primary)}
.card{background:var(--bg-card);border-radius:14px;box-shadow:var(--shadow-card);border:1px solid var(--border-purple)}
.app-main{flex:1;background:var(--bg-primary);min-height:100vh;overflow-y:auto}
.rule{width:100%;height:1px;background:var(--rule-color);border:none}
.lbl{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--text-muted)}

/* ── HAMBURGER & MOBILE SIDEBAR ─────────────────── */
.hamburger {
  display: none; flex-direction: column; justify-content: center;
  gap: 5px; width: 36px; height: 36px; cursor: pointer;
  padding: 6px; border-radius: 8px; transition: background 0.15s; flex-shrink: 0;
}
.hamburger:hover { background: var(--bg-hover); }
.hamburger span { display: block; height: 2px; background: var(--text-primary); border-radius: 2px; transition: all 0.25s ease; }
.hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
.sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 998; backdrop-filter: blur(4px); }
@media (max-width: 768px) {
  .hamburger { display: flex !important; }
  .sidebar-overlay.open { display: block; }
  .sidebar { position: fixed !important; top: 0; left: -240px; z-index: 999; transition: left 0.28s cubic-bezier(0.4,0,0.2,1); box-shadow: 4px 0 24px rgba(0,0,0,0.3); }
  .sidebar.open { left: 0 !important; }
  .mobile-topbar { display: flex !important; position: sticky; top: 0; z-index: 100; background: var(--sidebar-bg); backdrop-filter: blur(12px); border-bottom: 1px solid var(--sidebar-border); padding: 0 16px; height: 56px; align-items: center; justify-content: space-between; }
  .landing-nav-links { display: none !important; }
}
@media (min-width: 769px) {
  .mobile-topbar { display: none !important; }
  .hamburger { display: none !important; }
}

@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600;1,700;1,800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg-secondary)}::-webkit-scrollbar-thumb{background:#7C3AED;border-radius:2px}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.ticker-wrap{overflow:hidden;border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:13px 0;background:var(--bg-surface)}
.ticker-inner{display:flex;animation:ticker 26s linear infinite;white-space:nowrap}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
@keyframes glow{0%,100%{box-shadow:0 0 16px rgba(109,40,217,.3)}50%{box-shadow:0 0 32px rgba(109,40,217,.6)}}
.fade-up{animation:fadeUp .38s ease both}
.spin{animation:spin .8s linear infinite}
.pulse{animation:pulse 2s ease infinite}
.serif{font-family:'Playfair Display',Georgia,serif}
.serif-italic{font-family:'Playfair Display',Georgia,serif;font-style:italic}
.u-input{width:100%;background:transparent;border:none;border-bottom:1px solid #C8B89A;padding:11px 0;font-size:14px;color:#1A1A1A;outline:none;transition:border-color .2s;font-family:'DM Sans',sans-serif}
.u-input:focus{border-bottom-color:var(--purple-main)}
.u-input::placeholder{color:var(--text-muted);font-size:13px}
.u-select{width:100%;background:transparent;border:none;border-bottom:1px solid var(--input-border);padding:11px 0;font-size:14px;color:var(--input-color);outline:none;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%237C3AED'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 4px center;padding-right:20px}
.u-select option{background:var(--bg-secondary);color:var(--text-primary)}
.u-textarea{width:100%;background:transparent;border:none;border-bottom:1px solid var(--input-border);padding:10px 0;font-size:13.5px;color:var(--input-color);outline:none;resize:none;line-height:1.65;font-family:'DM Sans',sans-serif;transition:border-color .2s}
.u-textarea:focus{border-bottom-color:var(--purple-main)}
.u-textarea::placeholder{color:var(--text-muted)}
.btn-black{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--text-primary);color:var(--bg-primary);border:none;border-radius:99px;padding:13px 30px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;cursor:pointer;transition:all .18s}
.btn-black:hover{opacity:.82;transform:translateY(-1px)}
.btn-black:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:transparent;color:var(--text-primary);border:1.5px solid var(--text-primary);border-radius:99px;padding:12px 28px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;cursor:pointer;transition:all .18s}
.btn-outline:hover{background:var(--text-primary);color:var(--bg-primary)}
.btn-purple{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--purple-main);color:#fff;border:none;border-radius:99px;padding:12px 28px;font-size:12px;font-weight:700;letter-spacing:.06em;cursor:pointer;transition:all .18s;box-shadow:0 4px 14px rgba(109,40,217,.3)}
.btn-purple:hover{background:var(--purple-soft);transform:translateY(-1px);box-shadow:var(--shadow-hover)}
.btn-purple:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:transparent;color:var(--text-secondary);border:1px solid var(--border);border-radius:99px;padding:9px 20px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:all .18s}
.btn-ghost:hover{border-color:var(--purple-soft);color:var(--text-primary);background:var(--bg-surface)}
.btn-red{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#FEE2E2;color:#B91C1C;border:1px solid #FECACA;border-radius:99px;padding:9px 20px;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s}
[data-theme="dark"] .btn-red{background:rgba(248,113,113,.12);color:#F87171;border-color:rgba(248,113,113,.3)}
.btn-red:hover{background:#FEF2F2}
[data-theme="dark"] .btn-red:hover{background:rgba(248,113,113,.2)}
.card-dark{background:#1A1A1A;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.2)}
.sidebar{width:220px;flex-shrink:0;background:var(--sidebar-bg);border-right:1px solid var(--sidebar-border);height:100vh;position:sticky;top:0;display:flex;flex-direction:column;overflow:hidden}
.badge{display:inline-flex;align-items:center;padding:3px 10px;font-size:11px;font-weight:700;border-radius:99px;letter-spacing:.03em}
.data-table{width:100%;border-collapse:collapse}
.data-table th{padding:11px 20px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--bg-surface)}
.data-table td{padding:15px 20px;border-bottom:1px solid var(--border);font-size:13.5px;color:var(--text-primary);transition:background .1s}
.data-table tr:hover td{background:var(--bg-hover)}
.data-table tr:last-child td{border-bottom:none}
.prog-track{height:4px;background:var(--border);border-radius:99px;overflow:hidden}
.prog-fill{height:100%;border-radius:99px;transition:width 1s ease}
.nav-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 14px;border-radius:8px;font-size:13px;color:#8A7A6A;transition:all .12s;cursor:pointer;border-left:3px solid transparent;text-align:left;border:none;background:none}
.nav-item:hover{background:rgba(255,255,255,.06);color:#D0C4B0}
.nav-item.active{background:rgba(124,58,237,.2);color:#fff;border-left:3px solid #7C3AED;font-weight:600}
.step-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;transition:all .12s;font-size:12.5px;color:#8A7A6A;border-left:3px solid transparent;border:none;background:none;width:100%;text-align:left}
.step-item:hover{background:rgba(255,255,255,.06);color:#D0C4B0}
.step-item.active{background:rgba(124,58,237,.18);color:#fff;border-left:3px solid #7C3AED;font-weight:600}
.step-item.done{color:#6A9A6A}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(8px)}
.tab-btn{padding:10px 0;border:none;background:transparent;font-size:13px;font-weight:500;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-family:'DM Sans',sans-serif}
.tab-btn.active{color:var(--text-primary);border-bottom-color:var(--purple-main);font-weight:700}
.metric-card{background:var(--bg-card);border-radius:12px;padding:22px 24px;box-shadow:var(--shadow-card);border:1px solid var(--border-purple)}
.input-dark{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 16px;font-size:14px;color:#fff;outline:none;transition:border-color .2s;font-family:'DM Sans',sans-serif}
.input-dark:focus{border-color:rgba(124,58,237,.6);box-shadow:var(--shadow-glow)}
.input-dark::placeholder{color:rgba(255,255,255,.3)}

/* ── GLOBAL MOBILE OVERFLOW FIX ───────────────────── */
html, body { overflow-x: hidden; max-width: 100vw; }
* { box-sizing: border-box; }
img { max-width: 100%; }
section { max-width: 100vw; overflow-x: hidden; }

/* ── RESPONSIVE SYSTEM ───────────────────────────────── */
@media (max-width: 1024px){
  .r-grid-4{grid-template-columns:repeat(2,1fr)!important}
  .r-grid-3{grid-template-columns:repeat(2,1fr)!important}
  .r-hide-tablet{display:none!important}
  .page-padding{padding:24px 20px!important}
}
@media (max-width: 768px){
  .r-grid-4,.r-grid-3,.r-grid-2,.r-grid-21{grid-template-columns:1fr!important}
  .r-stack{flex-direction:column!important}
  .r-full{width:100%!important}
  .r-hide-mobile{display:none!important}
  .r-show-mobile{display:flex!important}
  .r-text-sm{font-size:13px!important}
  .page-padding{padding:16px 14px!important}
  .metric-card{padding:16px 18px!important}
  .card{border-radius:10px!important}
  .data-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px}
  .data-table th,.data-table td{padding:10px 12px!important;font-size:12px!important;white-space:nowrap}
  .tab-btn{font-size:12px!important;margin-right:14px!important}
  .modal-overlay{padding:12px!important;align-items:flex-end!important}
  .modal-overlay > .card,.modal-overlay > div{border-radius:14px 14px 0 0!important;max-height:90vh;overflow-y:auto}
  .r-col-span-full{grid-column:1/-1!important}
  .btn-black,.btn-purple,.btn-outline{padding:11px 18px!important;font-size:11px!important}
  .sidebar{width:240px!important}
  .step-item span:last-child{font-size:10px!important}
  .prog-fill{transition:none}
}
@media (max-width: 480px){
  .r-grid-4,.r-grid-3,.r-grid-2{grid-template-columns:1fr!important}
  .page-padding{padding:12px 10px!important}
  .metric-card{padding:14px 16px!important}
}
/* ── FULL MOBILE RESPONSIVE ─────────────────────────── */
@media (max-width: 1024px) {
  .r-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
  .r-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
}
@media (max-width: 768px) {
  .r-grid-4, .r-grid-3, .r-grid-2 { grid-template-columns: 1fr !important; }
  .r-stack { flex-direction: column !important; }
  .r-hide { display: none !important; }
  .card { border-radius: 12px !important; }
  .tab-btn { font-size: 12px !important; padding-bottom: 12px !important; margin-right: 16px !important; }
  .metric-card { padding: 16px 14px !important; }
  .data-table th, .data-table td { padding: 10px 12px !important; font-size: 12px !important; }
  .modal-overlay { padding: 0 !important; align-items: flex-end !important; }
  .modal-overlay > .card, .modal-overlay > div { border-radius: 20px 20px 0 0 !important; max-height: 92vh !important; overflow-y: auto !important; }
  .landing-nav-links { display: none !important; }
  .page-padding { padding: 16px 14px 40px !important; }
  .sidebar { width: 240px !important; }
  .app-main { padding-bottom: 40px; }
}
@media (max-width: 480px) {
  .metric-card { padding: 14px 12px !important; }
  .btn-black, .btn-purple, .btn-outline { padding: 11px 16px !important; font-size: 11px !important; }
}

/* ── TABLE SCROLL WRAPPER ────────────────────────────── */
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 10px; }
.data-table { min-width: 520px; }

/* ── SMOOTH INTERACTIONS ─────────────────────────────── */
.card { transition: box-shadow .2s ease; }
.card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.08); }
button:focus-visible { outline: 2px solid #7C3AED; outline-offset: 2px; }
input:focus-visible, textarea:focus-visible { outline: none; }

/* ── TICKER ──────────────────────────────────────────── */
.ticker-wrap { overflow: hidden; white-space: nowrap; }
.ticker-inner { display: inline-flex; animation: alp-ticker 40s linear infinite; }
.ticker-inner:hover { animation-play-state: paused; cursor: default; }
@keyframes alp-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* ── LANDING PAGE MOBILE NAV ───────────────────────── */
.landing-nav-tagline{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}
.landing-nav-hamburger{display:none;flex-direction:column;gap:5px;width:36px;height:36px;
  cursor:pointer;padding:7px;border-radius:8px;background:transparent;border:none;
  flex-shrink:0;align-items:center;justify-content:center}
.landing-nav-hamburger span{display:block;height:2px;border-radius:2px;
  transition:all 0.25s ease;width:20px}
.landing-nav-hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.landing-nav-hamburger.open span:nth-child(2){opacity:0;transform:scaleX(0)}
.landing-nav-hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
@media(max-width:768px){
  .landing-nav-links{display:none!important}
  .landing-nav-tagline{display:none!important}
  .landing-nav-hamburger{display:flex!important}
  .landing-nav-desktop{display:none!important}
  .r-hero-btns{flex-direction:column!important;align-items:stretch!important}
  .r-hero-btns button{width:100%!important;justify-content:center!important}
  .r-stats-row{flex-wrap:wrap!important;gap:20px!important}
  .r-platform-grid{grid-template-columns:repeat(2,1fr)!important}
  .r-feat-grid{grid-template-columns:repeat(2,1fr)!important}
  .r-framework-grid{grid-template-columns:repeat(2,1fr)!important}
  .r-3col{grid-template-columns:1fr!important}
  .r-2col{grid-template-columns:1fr!important}
  .r-hero-section{padding:48px 20px 40px!important}
}
@media(max-width:480px){
  .r-platform-grid{grid-template-columns:1fr!important}
  .r-feat-grid{grid-template-columns:1fr!important}
  .r-framework-grid{grid-template-columns:1fr!important}
}

/* ── COOKIE BANNER ────────────────────────────────── */
@media(max-width:600px){
  /* stack cookie banner vertically on mobile */
}

/* ── SIGN UP / MODAL MOBILE ──────────────────────── */
@media(max-width:768px){
  /* Login & SignUp: hide left panel on mobile */
  .login-left-panel{display:none!important}
}

/* ── SMOOTH PAGE TRANSITIONS ─────────────────────── */
.fade-up{animation:fadeUp .38s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}

/* ── ONBOARDING MODAL ────────────────────────────── */
.onboarding-step{transition:all .3s ease}

/* ── TOAST NOTIFICATIONS ─────────────────────────── */
.toast-container{position:fixed;bottom:24px;right:24px;z-index:9998;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.toast{display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.18);animation:toastIn .28s ease;pointer-events:all;max-width:320px;backdrop-filter:blur(8px)}
@keyframes toastIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes toastOut{to{opacity:0;transform:translateY(8px) scale(.96)}}
.toast.hiding{animation:toastOut .2s ease forwards}

/* ── GLOBAL SEARCH OVERLAY ───────────────────────── */
.search-overlay{position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;padding-top:80px;backdrop-filter:blur(6px)}
.search-box{width:100%;max-width:580px;background:var(--bg-secondary);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.4);overflow:hidden;border:1px solid var(--border-purple)}
.search-input{width:100%;padding:18px 20px;font-size:16px;border:none;background:transparent;color:var(--text-primary);outline:none;font-family:'DM Sans',sans-serif}
.search-result{display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;transition:background .1s;border-top:1px solid var(--border)}
.search-result:hover{background:var(--bg-hover)}

/* ── MOBILE BOTTOM NAV ───────────────────────────── */
.mobile-bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;background:var(--sidebar-bg);border-top:1px solid var(--sidebar-border);padding:8px 0 max(8px,env(safe-area-inset-bottom));justify-content:space-around}
@media(max-width:768px){.mobile-bottom-nav{display:flex!important}}
.mobile-nav-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 12px;border:none;background:transparent;cursor:pointer;transition:all .15s;border-radius:8px;min-width:52px}
.mobile-nav-btn span:first-child{font-size:20px;line-height:1}
.mobile-nav-btn span:last-child{font-size:9px;font-weight:600;letter-spacing:.04em;color:rgba(255,255,255,.4);text-transform:uppercase}
.mobile-nav-btn.active span:last-child{color:#A78BFA}

/* ── FLOATING ACTION BUTTON ──────────────────────── */
.fab{position:fixed;bottom:28px;right:28px;z-index:199;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#A855F7);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 6px 24px rgba(124,58,237,.45);transition:all .2s}
.fab:hover{transform:scale(1.08);box-shadow:0 10px 32px rgba(124,58,237,.6)}
@media(max-width:768px){.fab{bottom:76px}}

/* ── ANIMATED COUNTER ────────────────────────────── */
@keyframes countUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.counter-animate{animation:countUp .5s ease both}

/* ── AI CHAT WIDGET ──────────────────────────────── */
.ai-chat-bubble{position:fixed;bottom:96px;right:28px;z-index:198;width:400px;max-height:520px;border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.3);display:flex;flex-direction:column}
@media(max-width:480px){.ai-chat-bubble{width:calc(100vw - 24px);right:12px;bottom:88px}}

/* ── PRINT STYLES ────────────────────────────────── */
@media print {
  .sidebar, .mobile-topbar, .mobile-bottom-nav, .fab,
  .ai-chat-bubble, .toast-container, .search-overlay,
  button:not(.print-keep), nav { display: none !important; }
  .app-main { padding: 0 !important; }
  body { background: white !important; color: black !important; }
  .card { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
  .page-break { page-break-before: always; }
  @page { margin: 20mm; }
}

/* ── DARK MODE IMPROVEMENTS for new components ───── */
[data-theme="dark"] .search-box { background: var(--bg-secondary); }
[data-theme="dark"] .search-result:hover { background: var(--bg-hover); }
[data-theme="dark"] .toast { box-shadow: 0 8px 32px rgba(0,0,0,.5); }
[data-theme="dark"] .ai-chat-bubble { border-color: var(--border-purple); }

/* ── SMOOTH MODAL TRANSITIONS ─────────────────────── */
.modal-overlay { animation: overlayIn .18s ease; }
@keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

/* ── BETTER SCROLLBARS IN MODALS ─────────────────── */
.modal-overlay .card::-webkit-scrollbar { width: 4px; }
.modal-overlay .card::-webkit-scrollbar-thumb { background: var(--border-purple); border-radius: 2px; }

/* ── PAGE PADDING MOBILE FIX ─────────────────────── */
@media(max-width:768px){
  .page-padding { padding-bottom: 80px !important; }
  .app-main { padding-bottom: 70px; }
}

/* ── SKELETON LOADING ─────────────────────────────── */
.skeleton{background:linear-gradient(90deg,var(--bg-surface) 25%,var(--bg-hover) 50%,var(--bg-surface) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:6px}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.skeleton-text{height:14px;margin-bottom:8px;border-radius:4px}
.skeleton-card{height:80px;border-radius:12px;margin-bottom:12px}

/* ── GOALS TRACKER ───────────────────────────────── */
.goals-progress-bar{height:6px;border-radius:99px;overflow:hidden;background:var(--border)}
.goals-progress-fill{height:100%;border-radius:99px;transition:width .5s ease}
/* ── BETTER TABLE HOVER ──────────────────────────── */
.data-table tbody tr:hover{background:var(--bg-hover)!important}
/* ── CHART AREA ──────────────────────────────────── */
.chart-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}

/* ── HERO ANIMATIONS ─────────────────────────────── */
@keyframes heroFadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes heroPulse{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes counterUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.hero-fade-1{animation:heroFadeUp .7s ease both}
.hero-fade-2{animation:heroFadeUp .7s .12s ease both}
.hero-fade-3{animation:heroFadeUp .7s .24s ease both}
.hero-fade-4{animation:heroFadeUp .7s .36s ease both}
.hero-pulse{animation:heroPulse 2.8s ease-in-out infinite}
.float-anim{animation:float 4s ease-in-out infinite}
.gradient-shift{background-size:200% 200%;animation:gradientShift 6s ease infinite}
/* ── CARD HOVER POLISH ───────────────────────────── */
.card{transition:box-shadow .2s,transform .15s,border-color .15s}
.card:hover{box-shadow:0 4px 24px rgba(0,0,0,.07)}
/* ── BUTTON ACTIVE STATES ───────────────────────── */
.btn-purple:active{transform:scale(.97)}
.btn-black:active{transform:scale(.97)}
/* ── SMOOTH PAGE TRANSITIONS ────────────────────── */
.fade-up{animation:heroFadeUp .4s ease both}
/* ── SIDEBAR ITEM ACTIVE GLOW ────────────────────── */
.sidebar-item-active{box-shadow:inset 3px 0 0 #7C3AED}


/* ── PRINT STYLES ────────────────────────────────── */
@media print {
  nav, .mobile-bottom-nav, .fab, button.btn-ghost, button.btn-purple, button.btn-black,
  .search-overlay, .toast-container, aside, .sidebar-full,
  [data-role="modal-overlay"] { display: none !important; }
  body { background: #fff !important; color: #000 !important; }
  .card { box-shadow: none !important; border: 1px solid #ddd !important; page-break-inside: avoid; }
  h1, h2, h3 { page-break-after: avoid; }
  @page { margin: 1.5cm; size: A4; }
}

/* ── ANIMATION KEYFRAMES ─────────────────────────── */
@keyframes heroPulse { 0%,100% { opacity: .6; } 50% { opacity: 1; } }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes scaleIn { from { transform: scale(.92); opacity: 0; } to { transform: none; opacity: 1; } }

/* ── CONFETTI ───────────────────────────────────────── */
@keyframes confettiFall{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(100vh) rotate(720deg)}}
/* ── MICRO-ANIMATIONS ───────────────────────────────── */
@keyframes checkmark{0%{transform:scale(0) rotate(-45deg);opacity:0}60%{transform:scale(1.2) rotate(0deg)}100%{transform:scale(1);opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes popIn{0%{transform:scale(0.85);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
@keyframes slideUp{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
.checkmark-anim{animation:checkmark .35s ease forwards}
.shake-anim{animation:shake .3s ease}
.pop-in{animation:popIn .25s ease forwards}
.slide-up{animation:slideUp .3s ease forwards}
/* ── BUTTON MICRO-INTERACTIONS ──────────────────────── */
.btn-purple:hover{filter:brightness(1.08)}
.btn-black:hover{filter:brightness(1.15)}
/* ── FORM FOCUS GLOW ─────────────────────────────────── */
input:focus,textarea:focus,select:focus{box-shadow:0 0 0 3px rgba(124,58,237,.15)!important}
/* ── TABLE ROW HOVER ─────────────────────────────────── */
.data-table tbody tr{transition:background .12s}
/* ── MODAL BACKDROP BLUR ─────────────────────────────── */
.modal-overlay{backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
/* ── CARD ACTIVE PRESS ───────────────────────────────── */
.card:active{transform:scale(.995)}
/* ── TOP PROGRESS BAR ────────────────────────────────── */
.top-progress{position:fixed;top:0;left:0;right:0;height:2px;z-index:9999;pointer-events:none}

/* ══════════════════════════════════════════════════════════════
   ALP DESIGN LAYER
   Appended last so it wins on equal specificity.

   Direction: institutional calm. Teachers open this while a child
   waits; district heads open it to decide whether to trust us with
   student records. Both are served by the same thing — a surface
   that is quiet, legible and unhurried, where the only colour is
   colour that means something.

   The delight is in motion quality and in what the words say, not
   in decoration. Nothing here bounces, sparkles or confettis.
   ══════════════════════════════════════════════════════════════ */

:root{
  /* One easing curve everywhere. Decelerating, never springy —
     it reads as a heavy object settling rather than a toy. */
  --ease:cubic-bezier(.32,.72,0,1);
  --dur:.34s;
  --dur-fast:.18s;

  /* Type scale. Optical sizing: large text needs NEGATIVE tracking
     to look correctly spaced, small text needs positive. Getting
     this wrong is the single most common reason an interface reads
     as amateur. */
  --t-display:clamp(2.25rem,1.4rem + 3.2vw,3.5rem);
  --t-title:clamp(1.5rem,1.2rem + 1.1vw,2rem);
  --t-head:1.3125rem;
  --t-body:1.0625rem;   /* 17px — Apple's body size, and genuinely
                           easier to read than the 14px SaaS default */
  --t-small:.9375rem;
  --t-label:.8125rem;
}

/* ── Typography ─────────────────────────────────────────────── */
.serif,.display{
  letter-spacing:-.032em;
  line-height:1.06;
  font-weight:600;
}
h1,.h1{font-size:var(--t-display);letter-spacing:-.034em;line-height:1.05;font-weight:600}
h2,.h2{font-size:var(--t-title);letter-spacing:-.026em;line-height:1.12;font-weight:600}
h3,.h3{font-size:var(--t-head);letter-spacing:-.018em;line-height:1.2;font-weight:600}

/* Labels are the one place tracking goes positive. */
.lbl{
  font-size:var(--t-label);
  letter-spacing:.055em;
  text-transform:uppercase;
  font-weight:600;
  color:var(--text-muted);
}

/* ── Surfaces ───────────────────────────────────────────────── */
.card{
  border-radius:16px;
  border:1px solid var(--border);
  background:var(--bg-card);
  box-shadow:var(--shadow-card);
  transition:box-shadow var(--dur) var(--ease),
             transform var(--dur) var(--ease),
             border-color var(--dur) var(--ease);
}
/* Lift only where the whole card is clickable — a card that
   reacts to hover but does nothing is a broken promise. */
.card-interactive:hover{
  transform:translateY(-2px);
  box-shadow:var(--shadow-hover);
  border-color:var(--border-purple);
}
.card-interactive:active{transform:translateY(0);transition-duration:var(--dur-fast)}

/* ── Buttons ────────────────────────────────────────────────── */
.btn-purple,.btn-black,.btn-ghost{
  border-radius:10px;
  font-weight:600;
  letter-spacing:-.01em;
  transition:transform var(--dur-fast) var(--ease),
             background var(--dur-fast) var(--ease),
             box-shadow var(--dur-fast) var(--ease),
             opacity var(--dur-fast) var(--ease);
}
/* The press. 0.97 is deliberately small — enough to feel the
   button take the weight, not enough to look like a toy. */
.btn-purple:active:not(:disabled),
.btn-black:active:not(:disabled),
.btn-ghost:active:not(:disabled){transform:scale(.97)}
.btn-purple:hover:not(:disabled){background:var(--purple-main);box-shadow:0 4px 14px rgba(109,40,217,.24)}
.btn-ghost:hover:not(:disabled){background:var(--bg-hover)}
.btn-purple:disabled,.btn-black:disabled,.btn-ghost:disabled{opacity:.42;cursor:not-allowed}

/* ── Focus ──────────────────────────────────────────────────── */
/* Visible for keyboard users, invisible for mouse users. Teachers
   working fast through ten steps navigate by keyboard. */
:focus{outline:none}
:focus-visible{
  outline:none;
  box-shadow:var(--shadow-glow);
  border-radius:8px;
}
input:focus-visible,select:focus-visible,textarea:focus-visible{
  border-color:var(--purple-main)!important;
  box-shadow:var(--shadow-glow);
}
input,select,textarea{
  transition:border-color var(--dur-fast) var(--ease),
             box-shadow var(--dur-fast) var(--ease);
}

/* ══════════════════════════════════════════════════════════════
   SIGNATURE — the trajectory
   
   The one thing this product is about: a child moving from where
   they started to where they are going. 52 words a minute in
   September, 68 now, 80 by May.
   
   A conventional progress bar shows percentage complete, which is
   the wrong fact. This shows distance travelled against distance
   remaining, with the starting point still visible — because the
   distance already covered is the part worth seeing.
   ══════════════════════════════════════════════════════════════ */
.trajectory{
  position:relative;
  height:2px;
  background:var(--border);
  border-radius:2px;
  margin:18px 0 10px;
}
.trajectory-fill{
  position:absolute;left:0;top:0;height:100%;
  background:var(--purple-main);
  border-radius:2px;
  transition:width 1.1s var(--ease);
}
.trajectory-mark{
  position:absolute;top:50%;
  width:7px;height:7px;border-radius:50%;
  transform:translate(-50%,-50%);
  background:var(--bg-card);
  border:2px solid var(--border);
}
.trajectory-mark.start{left:0;border-color:var(--text-muted)}
.trajectory-mark.now{
  width:11px;height:11px;
  background:var(--purple-main);
  border-color:var(--bg-card);
  box-shadow:0 0 0 3px rgba(109,40,217,.16);
  transition:left 1.1s var(--ease);
}
.trajectory-mark.target{right:0;left:auto;transform:translate(50%,-50%);border-color:var(--purple-main)}
.trajectory-caption{
  display:flex;justify-content:space-between;
  font-size:var(--t-label);color:var(--text-muted);
  letter-spacing:-.005em;
}

/* ── Step momentum ──────────────────────────────────────────── */
/* The ten-step rail. A teacher mid-plan should be able to see how
   far they have come without counting. */
.step-rail{display:flex;gap:4px;align-items:center}
.step-tick{
  height:3px;flex:1;border-radius:2px;
  background:var(--border);
  transition:background var(--dur) var(--ease);
}
.step-tick.done{background:var(--purple-main)}
.step-tick.current{background:var(--purple-soft);box-shadow:0 0 0 2px rgba(109,40,217,.14)}

/* ── Arrival ────────────────────────────────────────────────── */
/* Content settles in rather than appearing. Used once per screen,
   not on every element — staggered entrances everywhere is the
   tell of a template. */
@keyframes settle{
  from{opacity:0;transform:translateY(8px)}
  to{opacity:1;transform:none}
}
.settle{animation:settle var(--dur) var(--ease) both}

/* ── Celebration ────────────────────────────────────────────── */
/* When a plan is approved. A single ring expanding once and
   stopping — the interface acknowledging something real happened,
   then getting out of the way. */
@keyframes ring{
  from{transform:scale(.7);opacity:.55}
  to{transform:scale(2.4);opacity:0}
}
.celebrate{position:relative}
.celebrate::after{
  content:"";position:absolute;inset:0;
  border-radius:inherit;
  border:2px solid var(--purple-main);
  animation:ring .9s var(--ease) forwards;
  pointer-events:none;
}

/* ── Reduced motion ─────────────────────────────────────────── */
/* Not a checkbox. Vestibular disorders are common, and a teacher
   who needs this needs it every single day. */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{
    animation-duration:.01ms!important;
    animation-iteration-count:1!important;
    transition-duration:.01ms!important;
  }
  .btn-purple:active,.btn-black:active,.btn-ghost:active{transform:none}
  .card-interactive:hover{transform:none}
}



/* ── Eyebrows ───────────────────────────────────────────────── */
/* A label above a headline is signposting, not a second headline.
   31 of these were purple caps, which put them in competition with
   the thing they introduce. Muted with wider tracking reads as a
   category marker and lets the headline land.
   
   !important because the colour is set inline at each site; the
   alternative is 31 edits that a future paste would undo. */
.lbl{color:var(--text-muted)!important;letter-spacing:.07em}

/* ── Serif weight ceiling ───────────────────────────────────── */
/* Playfair Display ships 400/500/600. 37 elements ask for 800
   inline, and inline styles beat class rules — so without this the
   browser synthesises a fake 800 by smearing the 600, which is the
   thick, slightly muddy look on headings.
   
   500 is the right display weight for a high-contrast serif anyway:
   at 40px+ the thick strokes carry the weight, and adding more just
   closes up the counters. */
.serif,.serif-italic{font-weight:500!important;letter-spacing:-.022em}
.serif-italic{font-style:italic}

/* ── Mobile ─────────────────────────────────────────────────── */
@media(max-width:768px){
  :root{--t-body:1rem}
  .card{border-radius:14px}
  /* Thumb-reachable targets. A teacher fills this in on a phone
     standing in a classroom, not at a desk. */
  .btn-purple,.btn-black,.btn-ghost{min-height:44px}
  input,select,textarea{min-height:44px;font-size:16px} /* 16px stops iOS zooming on focus */
}

`;

// ─── LIGHT COLORS ──────────────────────────────────────────
const CL = {
  cream:"#ffffff",white:"#FFFFFF",black:"#1D1D1F",
  tan:"#D2D2D7",tanL:"#EBEBF0",warm:"#6E6E73",
  bg:"#F5F5F7",border:"#E3E3E8",
  purple:"#6D28D9",purpleL:"#F1ECFE",purpleD:"#5B21B6",
  green:"#16A34A",greenBg:"#F0FDF4",greenBd:"#BBF7D0",
  amber:"#D97706",amberBg:"#FFFBEB",amberBd:"#FDE68A",
  red:"#DC2626",redBg:"#FEF2F2",redBd:"#FECACA",
  blue:"#2563EB",blueBg:"#EFF6FF",blueBd:"#BFDBFE",
};
// ─── DARK COLORS ───────────────────────────────────────────
const CD = {
  cream:"#F5F5F7",white:"#1C1C1E",black:"#F5F5F7",
  tan:"#3A3A3C",tanL:"#2C2C2E",warm:"#98989D",
  bg:"#000000",border:"#2C2C2E",
  purple:"#A78BFA",purpleL:"rgba(167,139,250,.14)",purpleD:"#8B5CF6",
  green:"#34D399",greenBg:"rgba(52,211,153,.12)",greenBd:"rgba(52,211,153,.3)",
  amber:"#FBBF24",amberBg:"rgba(251,191,36,.12)",amberBd:"rgba(251,191,36,.3)",
  red:"#F87171",redBg:"rgba(248,113,113,.12)",redBd:"rgba(248,113,113,.3)",
  blue:"#60A5FA",blueBg:"rgba(96,165,250,.12)",blueBd:"rgba(96,165,250,.3)",
};
// ─── ACTIVE COLORS (mutated by ThemeProvider on toggle) ────
let C = {...CL};

// ─── PRIMITIVES ────────────────────────────────────────────────
function Spin({color="#fff"}){return <div className="spin" style={{width:15,height:15,border:`2px solid rgba(255,255,255,.25)`,borderTopColor:color,borderRadius:"50%",flexShrink:0}}/>}
// ─── RESPONSIVE HOOK ───────────────────────────────────────
function useResponsive(){
  const [w,setW]=useState(()=>typeof window!=="undefined"?window.innerWidth:1024);
  useEffect(()=>{
    const h=()=>{try{setW(window.innerWidth);}catch{}};
    try{window.addEventListener("resize",h);}catch{}
    return ()=>{try{window.removeEventListener("resize",h);}catch{}};
  },[]);
  return {isMobile:w<768,isTablet:w<1024,w};
}

function Avatar({name="?",size=34}){
  const p=["#7C3AED","#DC2626","#D97706","#16A34A","#2563EB","#8B2020","#0891B2","#9333EA"];
  const ini=name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
  return <div style={{width:size,height:size,borderRadius:"50%",background:p[name.charCodeAt(0)%p.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*.36,fontWeight:700,flexShrink:0}}>{ini}</div>;
}
function Dot({s}){
  const map={"On track":C.green,"Review":C.amber,"Attention":C.red,"Active":C.green,"Mastered":C.green,"Pending":C.amber,"Overdue":C.red};
  return <span style={{width:8,height:8,borderRadius:"50%",background:map[s]||C.warm,display:"inline-block",flexShrink:0}}/>;
}
function Badge({children,color="purple"}){
  const m={purple:{bg:"#EDE9FE",text:"#5B21B6"},green:{bg:"#DCFCE7",text:"#15803D"},amber:{bg:"#FEF9C3",text:"#A16207"},red:{bg:"#FEE2E2",text:"#B91C1C"},blue:{bg:"#DBEAFE",text:"#1D4ED8"},gray:{bg:"#F1F5F9",text:"#475569"},black:{bg:"#1A1A1A",text:"#fff"}};
  const s=m[color]||m.gray;
  return <span className="badge" style={{background:s.bg,color:s.text}}>{children}</span>;
}
function PBar({value,color=C.purple}){return <div className="prog-track"><div className="prog-fill" style={{width:`${Math.min(100,Math.max(0,value))}%`,background:color}}/></div>}
function UInput({label,value,onChange,placeholder,type="text"}){return(<div style={{display:"flex",flexDirection:"column",gap:5}}>{label&&<span className="lbl" style={{fontSize:9}}>{label}</span>}<input className="u-input" type={type} value={value} onChange={onChange} placeholder={placeholder||label}/></div>)}
function UTextarea({label,value,onChange,placeholder,rows=4}){return(<div style={{display:"flex",flexDirection:"column",gap:5}}>{label&&<span className="lbl" style={{fontSize:9}}>{label}</span>}<textarea className="u-textarea" rows={rows} value={value} onChange={onChange} placeholder={placeholder}/></div>)}
function USelect({label,value,onChange,options}){return(<div style={{display:"flex",flexDirection:"column",gap:5}}>{label&&<span className="lbl" style={{fontSize:9}}>{label}</span>}<select className="u-select" value={value} onChange={onChange}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>)}
function DInput({label,value,onChange,placeholder,type="text"}){return(<div style={{display:"flex",flexDirection:"column",gap:6}}>{label&&<span style={{fontSize:10,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(255,255,255,.4)"}}>{label}</span>}<input className="input-dark" type={type} value={value} onChange={onChange} placeholder={placeholder}/></div>)}

// ─── ROLE SYSTEM ───────────────────────────────────────────
const ROLES = [
  {id:"admin",       label:"Administrator",         icon:"🏛",  color:"#DC2626", badge:"ADMIN",    desc:"Full district-level access · All schools · Billing"},
  {id:"director",    label:"Leadership / Director",icon:"👔",  color:"#2563EB", badge:"DIRECTOR", desc:"Review Queue · Compliance · Audit Log · Reports"},
  {id:"teacher",     label:"Teacher",               icon:"👩‍🏫", color:"#7C3AED", badge:"TEACHER",  desc:"Caseload · ALP Builder · Progress monitoring"},
  {id:"intervention",label:"Intervention Specialist",icon:"📊", color:"#D97706", badge:"RTI",      desc:"RTI tiers · Intervention plans · CBM data"},
  {id:"related", label:"Related Services",  icon:"🩺",  color:"#16A34A", badge:"SERVICES", desc:"SLP · OT · PT · Session notes · Goal progress"},
];

const RoleCtx = createContext({role:"teacher", roleData:ROLES[2], setRole:()=>{}});

// ═══════════════════════════════════════════════════════════
// SUPABASE AUTH CONTEXT — real users, real data
// ═══════════════════════════════════════════════════════════
const SupabaseAuthCtx = createContext({ user:null,profile:null,loading:true,
  students:[],notifications:[],unreadCount:0,
  refreshStudents:()=>{},createStudentRecord:async()=>({}),
  updateStudentRecord:async()=>({}),createGoalRecord:async()=>({}),
  logProgressEntry:async()=>({}),saveDocument:async()=>({}),
  realRole:"teacher",submitForReviewAction:async()=>({}),approveALPAction:async()=>({}),
  requestChangesAction:async()=>({}),reopenAsDraftAction:async()=>({}),archiveStudentAction:async()=>({}),
  saveVersionSnapshot:async()=>({}),notifyAction:async()=>({}),deleteStudentRecord:async()=>({}) });
function useSupabaseAuth(){ return useContext(SupabaseAuthCtx); }

function SupabaseAuthProvider({children}){
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [students,setStudents]=useState([]);
  const [notifications,setNotifications]=useState([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const realRole=profile?.role||"teacher"; // REAL authorization role from DB — never the cosmetic preview switcher

  useEffect(()=>{
    const unsub=Supabase.onAuthChange(async(_e,session)=>{
      const u=session?.user||null;
      setUser(u);
      if(u){
        const p=await Supabase.getProfile(u.id);
        setProfile(p);
        refreshStudents(u.id,p?.role||"teacher"); // pass role directly — profile state hasn't committed yet here
        refreshNotifications(u.id);
      } else { setProfile(null);setStudents([]); }
      setLoading(false);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(!user)return;
    const unsub=Supabase.subscribeToNotifications(user.id,()=>refreshNotifications(user.id));
    return unsub;
  },[user]);

  function refreshStudents(uid,roleOverride){ Supabase.getStudents(uid,roleOverride||realRole).then(d=>setStudents(d||[])); }
  function refreshNotifications(uid){ Supabase.getNotifications(uid).then(d=>{ setNotifications(d||[]); setUnreadCount((d||[]).filter(n=>!n.read).length); }); }

  async function createStudentRecord(s){ if(!user)return{error:"Not logged in"};const r=await Supabase.createStudent({...s,teacher_id:user.id});if(!r.error){refreshStudents(user.id);await Supabase.logAuditEvent({user_id:user.id,action:"create_student",table_name:"students",record_id:r.data?.id,student_id:r.data?.id,details:{name:s.name}});}return r; }
  async function updateStudentRecord(id,u2){ const r=await Supabase.updateStudent(id,u2);if(!r.error){refreshStudents(user?.id);await Supabase.logAuditEvent({user_id:user?.id,action:"update_student",table_name:"students",record_id:id,student_id:id,details:{fields:Object.keys(u2)}});}return r; }
  async function deleteStudentRecord(id,name){ if(!user)return{error:"Not logged in"};const r=await Supabase.deleteStudent(id);if(!r.error){await Supabase.logAuditEvent({user_id:user.id,action:"delete_student",table_name:"students",record_id:id,details:{name}});refreshStudents(user.id);}return r; }
  async function createGoalRecord(g){ if(!user)return{error:"Not logged in"};const r=await Supabase.createGoal({...g,created_by:user.id});if(!r.error)await Supabase.logAuditEvent({user_id:user.id,action:"create_goal",table_name:"goals",record_id:r.data?.id,student_id:g.student_id,details:{domain:g.domain}});return r; }
  async function logProgressEntry(e){ if(!user)return{error:"Not logged in"};return Supabase.logProgress({...e,created_by:user.id}); }
  async function saveDocument(d){ if(!user)return{error:"Not logged in"};return Supabase.saveALPDocument({...d,created_by:user.id}); }

  // ── Workflow / approval actions — gated server-side too via RLS trigger ──
  async function submitForReviewAction(studentId){
    if(!user)return{error:"Not logged in"};
    const r=await Supabase.submitForReview(studentId,user.id);
    if(!r.error){
      refreshStudents(user.id);
      const reviewers=await Supabase.getReviewersForOrg();
      const student=students.find(s=>s.id===studentId);
      for(const rev of reviewers){
        await Supabase.createNotification({user_id:rev.id,type:"review",title:`ALP submitted for review — ${student?.name||"Student"}`,body:`${profile?.full_name||"A teacher"} submitted ${student?.name||"a student"}'s ALP for your review.`,student_id:studentId,urgent:true});
      }
    }
    return r;
  }
  async function approveALPAction(studentId,notes){
    if(!user)return{error:"Not logged in"};
    const r=await Supabase.approveALP(studentId,user.id,notes);
    if(!r.error){
      refreshStudents(user.id);
      const student=students.find(s=>s.id===studentId);
      if(student?.submitted_by) await Supabase.createNotification({user_id:student.submitted_by,type:"review",title:`ALP approved — ${student.name}`,body:notes||"Your submitted ALP has been approved.",student_id:studentId});
    }
    return r;
  }
  async function requestChangesAction(studentId,notes){
    if(!user)return{error:"Not logged in"};
    const r=await Supabase.requestChanges(studentId,user.id,notes);
    if(!r.error){
      refreshStudents(user.id);
      const student=students.find(s=>s.id===studentId);
      if(student?.submitted_by) await Supabase.createNotification({user_id:student.submitted_by,type:"review",title:`Changes requested — ${student.name}`,body:notes||"A reviewer requested changes to this ALP.",student_id:studentId,urgent:true});
    }
    return r;
  }
  async function reopenAsDraftAction(studentId){
    if(!user)return{error:"Not logged in"};
    const r=await Supabase.reopenAsDraft(studentId,user.id);
    if(!r.error)refreshStudents(user.id);
    return r;
  }
  async function archiveStudentAction(studentId){
    if(!user)return{error:"Not logged in"};
    const r=await Supabase.archiveStudent(studentId,user.id);
    if(!r.error)refreshStudents(user.id);
    return r;
  }
  async function saveVersionSnapshot(studentId,snapshot,changeSummary,statusAtSave){
    if(!user)return{error:"Not logged in"};
    return Supabase.saveALPVersion({student_id:studentId,snapshot,change_summary:changeSummary,status_at_save:statusAtSave,created_by:user.id});
  }
  async function notifyAction(payload){
    return Supabase.createNotification(payload);
  }

  return(
    <SupabaseAuthCtx.Provider value={{user,profile,loading,students,notifications,unreadCount,realRole,
      refreshStudents:()=>refreshStudents(user?.id),
      createStudentRecord,updateStudentRecord,deleteStudentRecord,createGoalRecord,logProgressEntry,saveDocument,
      submitForReviewAction,approveALPAction,requestChangesAction,reopenAsDraftAction,archiveStudentAction,
      saveVersionSnapshot,notifyAction}}>
      {children}
    </SupabaseAuthCtx.Provider>
  );
}


function RoleProvider({children, initialRole="teacher"}){
  const [role, setRole] = useState(initialRole);
  const roleData = ROLES.find(r=>r.id===role) || ROLES[2];
  return <RoleCtx.Provider value={{role, roleData, setRole}}>{children}</RoleCtx.Provider>;
}

function useRole(){ return useContext(RoleCtx); }

// Role badge shown in sidebar
function RoleBadge(){
  const {roleData} = useRole();
  return(
    <span style={{fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:99,background:roleData.color+"33",color:roleData.color,border:`1px solid ${roleData.color}44`,letterSpacing:".06em"}}>
      {roleData.badge}
    </span>
  );
}

function AIModal({student,onAdd,onClose}){
  const [domain,setDomain]=useState("READING");
  const [baseline,setBaseline]=useState("");
  const [context,setContext]=useState("");
  const [loading,setLoading]=useState(false);
  const [goals,setGoals]=useState([]);
  const [selected,setSelected]=useState([]);
  const [err,setErr]=useState(null);
  const [generated,setGenerated]=useState(false);

  const domains=[
    {value:"READING",label:"📖 Reading Fluency"},
    {value:"COMPREHENSION",label:"📚 Reading Comprehension"},
    {value:"MATH",label:"🔢 Mathematics"},
    {value:"WRITING",label:"✏️ Writing"},
    {value:"COMMUNICATION",label:"💬 Communication"},
    {value:"SOCIAL_EMOTIONAL",label:"🧠 Social-Emotional"},
    {value:"BEHAVIOR",label:"🎯 Behaviour"},
    {value:"OT",label:"✋ Occupational Therapy"},
    {value:"SPEECH",label:"🗣 Speech & Language"},
    {value:"TRANSITION",label:"🎓 Transition Planning"},
  ];

  const tips={
    READING:"e.g. 52 words per minute on Grade 3 ORF probes",
    COMPREHENSION:"e.g. 40% accuracy on retell tasks",
    MATH:"e.g. 45% accuracy on 2-digit addition with regrouping",
    WRITING:"e.g. 1 complete sentence independently",
    COMMUNICATION:"e.g. 1-word requests, no spontaneous 2-word combinations",
    SOCIAL_EMOTIONAL:"e.g. 1 out of 5 self-regulation opportunities without prompting",
    BEHAVIOR:"e.g. 8 instances per hour of calling out without permission",
    OT:"e.g. requires full physical assistance for scissors",
    SPEECH:"e.g. 40% accuracy on /r/ sound in word-initial position",
    TRANSITION:"e.g. No independent travel or vocational exploration",
  };

  async function generate(){
    setLoading(true);setErr(null);setGoals([]);setSelected([]);setGenerated(false);
    try{
      // Was a direct browser call to api.anthropic.com with no API key
      // and no anthropic-version header — a guaranteed 401 in
      // production. Now routed through the ai-assist Edge Function,
      // which holds the key. The student's name is no longer sent:
      // the model returns a [Name] placeholder and we substitute it
      // here, so no student PII leaves our systems for this feature.
      const raw=await suggestGoals({
        grade:student.grade, disability:student.disability,
        domain, baseline, context,
      });
      setGoals(raw.map(g=>({...g,goalText:personaliseGoal(g.goalText,student.name)})));
      setGenerated(true);
    }catch(e){
      setErr(e instanceof AiUnavailable ? e.message : "Could not generate goals. Please try again.");
    }
    setLoading(false);
  }

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:620,maxHeight:"92vh",overflowY:"auto",padding:0}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#0B0718,#1a0a3e)",padding:"28px 32px 22px",position:"sticky",top:0,zIndex:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#7C3AED,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✦</div>
                <p style={{fontSize:11,fontWeight:700,letterSpacing:".1em",color:"#A78BFA"}}>ALP AI INTELLIGENCE SUITE</p>
              </div>
              <h2 className="serif" style={{fontSize:26,fontWeight:800,color:"#fff",lineHeight:1.1,letterSpacing:"-.016em"}}>
                Goal Architect <span className="serif-italic" style={{color:"#A78BFA"}}>AI</span>
              </h2>
              <p style={{fontSize:12,color:"rgba(255,255,255,.45)",marginTop:5}}>{student.name} · Grade {student.grade} · {student.disability}</p>
            </div>
            <button onClick={onClose} style={{fontSize:22,color:"rgba(255,255,255,.4)",background:"none",border:"none",cursor:"pointer",padding:4,lineHeight:1}} aria-label="Close">×</button>
          </div>
        </div>

        <div style={{padding:"24px 32px"}}>
          {/* How it works */}
          {!generated&&(
            <div style={{display:"flex",gap:12,marginBottom:24,padding:"12px 14px",background:C.purpleL,borderRadius:10}}>
              {[["1","Select domain"],["2","Enter baseline"],["3","Get 3 goals"]].map(([n,l])=>(
                <div key={n} style={{display:"flex",gap:8,alignItems:"center",fontSize:12,color:C.warm}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:C.purple,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</div>
                  {l}
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <USelect label="Goal Domain *" value={domain} onChange={e=>{setDomain(e.target.value);setGoals([]);setGenerated(false);}} options={domains}/>
            <UInput label="Current Baseline *" value={baseline} onChange={e=>setBaseline(e.target.value)} placeholder={tips[domain]||"e.g. current level"}/>
          </div>
          <div style={{marginBottom:20}}>
            <UTextarea label="Additional context (optional)" value={context} onChange={e=>setContext(e.target.value)} rows={2}
              placeholder="e.g. Student uses AAC device, attends 80% gen ed, responds well to visual supports…"/>
          </div>

          <button className="btn-black" onClick={generate} disabled={loading||!baseline.trim()}
            style={{width:"100%",padding:"15px",marginBottom:8,fontSize:13,borderRadius:10,background:loading?"#374151":"linear-gradient(135deg,#1a1a2e,#16213e)",border:"none",color:"#fff",cursor:loading||!baseline.trim()?"not-allowed":"pointer",transition:"all .2s"}}>
            {loading?<><Spin color="#A78BFA"/> Generating with Claude AI…</>:"✦  Generate 3 SMART Goals →"}
          </button>
          {!baseline.trim()&&<p style={{fontSize:11,color:C.warm,textAlign:"center",marginBottom:16}}>Enter a baseline score above to generate goals</p>}

          {err&&<div style={{background:"#FEE2E2",borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:13,color:C.red,display:"flex",gap:8}}><span>⚠️</span>{err}</div>}

          {/* Generated goals */}
          {goals.length>0&&(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"20px 0 14px",paddingTop:20,borderTop:`1px solid ${C.tanL}`}}>
                <p className="lbl" style={{color:C.purple}}>SELECT GOALS TO ADD TO ALP</p>
                <button onClick={generate} disabled={loading} style={{fontSize:11,color:C.purple,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
                  Regenerate →
                </button>
              </div>
              {goals.map((g,i)=>{
                const sel=selected.includes(i);
                return(
                  <div key={i} onClick={()=>setSelected(p=>sel?p.filter(x=>x!==i):[...p,i])}
                    style={{border:`2px solid ${sel?C.purple:C.tanL}`,background:sel?C.purpleL:C.white,borderRadius:12,padding:"18px 20px",marginBottom:12,cursor:"pointer",transition:"all .2s"}}
                    onMouseEnter={e=>{if(!sel)e.currentTarget.style.borderColor="#C4B5FD";}}
                    onMouseLeave={e=>{if(!sel)e.currentTarget.style.borderColor=C.tanL;}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${sel?C.purple:C.tanL}`,background:sel?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {sel&&<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
                        </div>
                        <span className="lbl" style={{color:sel?C.purple:C.warm}}>Goal {i+1}</span>
                      </div>
                      {sel&&<span style={{fontSize:11,color:C.purple,fontWeight:700,background:C.purple+"18",padding:"2px 8px",borderRadius:99}}>Selected</span>}
                    </div>
                    <p style={{fontSize:13.5,color:C.black,lineHeight:1.75,marginBottom:12,fontStyle:"italic"}}>{g.goalText}</p>
                    <div style={{display:"flex",gap:16,fontSize:11,flexWrap:"wrap"}}>
                      {[["Baseline",g.baseline],["Target",g.target],["Monitoring",g.monitoring]].map(([l,v])=>(
                        <div key={l}><span style={{color:C.warm}}>{l}: </span><b style={{color:C.black}}>{v}</b></div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div style={{display:"flex",gap:12,marginTop:8,paddingTop:16,borderTop:`1px solid ${C.tanL}`}}>
                <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
                <button className="btn-purple" onClick={()=>{selected.forEach(i=>onAdd(goals[i],domain));onClose();}}
                  disabled={!selected.length} style={{flex:2,fontSize:12,padding:"13px"}}>
                  ✓ Add {selected.length||""} Goal{selected.length!==1?"s":""} to ALP →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DownloadModal({onClose}){
  const platforms=[
    {svg:<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 88 88"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203z" fill="#F35325"/><path d="M39.996 6.86L87.314 0v41.745l-47.318.376z" fill="#81BC06"/><path d="M35.67 45.471l.028 34.453L0 75.48V45.268z" fill="#05A6F0"/><path d="M39.996 46.06l47.318-.376V88l-47.318-7.62z" fill="#FFBA08"/></svg>,label:"Windows",sub:"Windows 10 / 11 · 64-bit",btn:"Download .exe"},
    {svg:<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="white"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.46 2.208 3.09 3.792 3.029 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>,label:"macOS",sub:"macOS 12+ · Universal",btn:"Download .dmg"},
    {svg:<svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50"><ellipse cx="21" cy="31" rx="14" ry="15" fill="#1a1a1a"/><ellipse cx="21" cy="33" rx="7.5" ry="9.5" fill="#f0ece0"/><ellipse cx="21" cy="11" rx="9.5" ry="10.5" fill="#1a1a1a"/><ellipse cx="21" cy="12.5" rx="5.5" ry="6.5" fill="#f0ece0"/><circle cx="18" cy="9.5" r="1.7" fill="#1a1a1a"/><circle cx="24" cy="9.5" r="1.7" fill="#1a1a1a"/><circle cx="18.6" cy="8.9" r="0.65" fill="#fff"/><circle cx="24.6" cy="8.9" r="0.65" fill="#fff"/><ellipse cx="21" cy="14.5" rx="2.8" ry="1.7" fill="#f5a623"/><ellipse cx="8" cy="30" rx="4.5" ry="9" fill="#1a1a1a" transform="rotate(-8 8 30)"/><ellipse cx="34" cy="30" rx="4.5" ry="9" fill="#1a1a1a" transform="rotate(8 34 30)"/><ellipse cx="16" cy="47" rx="5.5" ry="2.8" fill="#f5a623"/><ellipse cx="26" cy="47" rx="5.5" ry="2.8" fill="#f5a623"/></svg>,label:"Linux",sub:"Ubuntu / Debian · .deb",btn:"Download .deb"},
  ];
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fade-up" style={{background:"#0D0B1F",border:"1px solid rgba(124,58,237,.3)",borderRadius:20,padding:"40px 36px",width:"100%",maxWidth:560,textAlign:"center",boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
        <div style={{width:60,height:60,background:"linear-gradient(135deg,rgba(124,58,237,.4),rgba(124,58,237,.1))",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 18px",border:"1px solid rgba(124,58,237,.3)"}}>🖥</div>
        <h2 style={{fontSize:26,fontWeight:800,color:"#fff",marginBottom:6,letterSpacing:"-.016em"}}>Download ALP Desktop</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:8,lineHeight:1.6}}>Full offline access · Enterprise security · v2.4.1</p>
        <p style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:28}}>Available for Windows, macOS, and Linux</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
          {platforms.map(p=>(
            <button key={p.label} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,padding:"22px 12px",cursor:"pointer",transition:"all .2s",color:"#fff",textAlign:"center"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(124,58,237,.2)";e.currentTarget.style.borderColor="rgba(124,58,237,.5)";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor="rgba(255,255,255,.1)";e.currentTarget.style.transform="none";}}>
              <div style={{width:52,height:52,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center"}}>{p.svg}</div>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{p.label}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:12,lineHeight:1.4}}>{p.sub}</div>
              <div style={{fontSize:10,fontWeight:700,padding:"5px 10px",background:"rgba(124,58,237,.35)",border:"1px solid rgba(124,58,237,.4)",borderRadius:6,color:"#c4b5fd"}}>{p.btn}</div>
            </button>
          ))}
        </div>
        <div style={{padding:"14px 16px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,marginBottom:20}}>
          <p style={{fontSize:12,color:"rgba(255,255,255,.4)",lineHeight:1.6}}>✓ Free plan for schools — access through your school  ·  ✓ Offline access  ·  ✓ Auto-updates  ·  ✓ Sync across devices</p>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:99,padding:"9px 28px",fontSize:12,color:"rgba(255,255,255,.5)",cursor:"pointer",transition:"all .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.12)";e.currentTarget.style.color="#fff";}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.06)";e.currentTarget.style.color="rgba(255,255,255,.5)";}}>← Back</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LANDING
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// SHARED NAV for sub-pages
// ═══════════════════════════════════════════════════════════════════

// ─── SHARED SUBNAV ──────────────────────────────────────────────
function SubNav({active,setNavPage,onEnter,onSignup,onDemo}){
  const [mobileOpen,setMobileOpen]=useState(false);
  const links=["Features","For Schools","Pricing","Resources"];
  return(
    <>
    <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(255,255,255,.97)",backdropFilter:"blur(14px)",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"center",padding:"0 clamp(16px,4vw,48px)",height:62,gap:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",minWidth:0,flex:1,overflow:"hidden"}} onClick={()=>{setNavPage(null);setMobileOpen(false);}}>
        <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:32,height:32,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
        <span className="serif" style={{fontSize:15,fontWeight:700,flexShrink:0}}>ALP</span>
        <span className="landing-nav-tagline" style={{fontSize:10,color:C.warm,letterSpacing:".1em",textTransform:"uppercase",marginLeft:2}}>ACCELERATED LEARNING PROGRAM</span>
      </div>
      <div className="landing-nav-links" style={{display:"flex",gap:28,fontSize:13.5,flexShrink:0}}>
        {links.map(n=>(
          <span key={n} onClick={()=>setNavPage(n)} style={{cursor:"pointer",fontWeight:active===n?700:400,color:active===n?C.black:C.warm,borderBottom:active===n?`2px solid ${C.purple}`:"2px solid transparent",paddingBottom:2,transition:"all .15s",whiteSpace:"nowrap"}}
            onMouseEnter={e=>e.currentTarget.style.color=C.black}
            onMouseLeave={e=>e.currentTarget.style.color=active===n?C.black:C.warm}>{n}</span>
        ))}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
        <ThemeToggle/>
        <button className="btn-ghost landing-nav-desktop" onClick={()=>setNavPage(null)} style={{fontSize:11,padding:"8px 16px"}}>← Home</button>
        <button className="btn-purple landing-nav-desktop" onClick={onSignup||onEnter} style={{fontSize:11,padding:"8px 16px"}}>Sign Up Free</button>
        <button className={`landing-nav-hamburger${mobileOpen?" open":""}`} onClick={()=>setMobileOpen(o=>!o)} aria-label="Menu">
          <span style={{background:C.black}}/><span style={{background:C.black}}/><span style={{background:C.black}}/>
        </button>
      </div>
    </nav>
    {mobileOpen&&(
      <div style={{position:"fixed",top:62,left:0,right:0,zIndex:99,background:"rgba(255,255,255,.98)",borderBottom:"1px solid #e5e7eb",padding:"8px 20px 20px",boxShadow:"0 8px 24px rgba(0,0,0,.1)"}}>
        {links.map(n=>(
          <div key={n} onClick={()=>{setNavPage(n);setMobileOpen(false);}} style={{padding:"14px 0",fontSize:15,fontWeight:active===n?700:500,color:active===n?C.purple:C.black,borderBottom:"1px solid #f3f3f3",cursor:"pointer"}}>{n}</div>
        ))}
        <div style={{display:"flex",gap:10,marginTop:16}}>
          <button className="btn-ghost" onClick={()=>{setNavPage(null);setMobileOpen(false);}} style={{flex:1,fontSize:12}}>← Home</button>
          <button className="btn-purple" onClick={()=>{(onSignup||onEnter)();setMobileOpen(false);}} style={{flex:1,fontSize:12}}>Sign Up Free</button>
        </div>
      </div>
    )}
    </>
  );
}

function PageFooter(){
  return(
    <div style={{padding:"clamp(14px,2.5vw,22px) clamp(20px,5vw,48px)",borderTop:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:C.warm,flexWrap:"wrap",gap:8}}>
      <span>© 2026 ALP Platform Inc. All rights reserved.</span>
      <span>Built by{" "}
        <a href="https://www.stanparaclete.com" target="_blank" rel="noopener noreferrer" style={{color:C.purple,fontWeight:700,textDecoration:"none"}} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>Stan Paraclete</a>
        {" · "}
        <a href="https://www.stanparaclete.com" target="_blank" rel="noopener noreferrer" style={{color:C.warm,textDecoration:"none"}} onMouseEnter={e=>e.currentTarget.style.color=C.purple} onMouseLeave={e=>e.currentTarget.style.color=C.warm}>stanparaclete.com</a>
        {" · "}
        <a href="https://www.growwithalp.com" target="_blank" rel="noopener noreferrer" style={{color:C.warm,textDecoration:"none"}} onMouseEnter={e=>e.currentTarget.style.color=C.purple} onMouseLeave={e=>e.currentTarget.style.color=C.warm}>growwithalp.com</a>
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FEATURES PAGE — ALP Platform
// ═══════════════════════════════════════════════════════════════════
function FeaturesPage({setNavPage,onEnter,onSignup,onDemo}){
  const aiTools=[
    {icon:"✏️",name:"ALP Goal Architect",desc:"Design precise, measurable annual goals from baseline data — instantly. The Goal Architect generates 3 SMART goal options per domain, covering reading, math, communication, behavior, motor, and transition. Built for every age from birth to 22+."},
    {icon:"📝",name:"ALP Present Levels Coach",desc:"Write present levels that are clear, objective, and parent-friendly — every time. Paste your draft and the ALP Present Levels Coach reviews it, flags weak language, and rewrites it to meet ALP standards in every framework."},
    {icon:"🧠",name:"ALP Behaviour Blueprint",desc:"Turn any behavioral concern into a structured, evidence-based intervention plan. Enter the behavior and context — the Behaviour Blueprint generates antecedents, replacement behaviors, reinforcement strategies, and staff protocols in under 2 minutes."},
    {icon:"📊",name:"ALP Progress Probe Generator",desc:"Generate custom CBM assessments aligned directly to each student's ALP goals — reading fluency, math computation, writing, or behavior. Produce grade-level or below-grade probes instantly. No worksheets to search for, ever again."},
    {icon:"🎯",name:"ALP Learner Profile Builder",desc:"Build a comprehensive profile of how each student's learning differences impact their access to the curriculum. The Learner Profile Builder produces a structured, structured narrative — ready to share with all staff and to anchor the whole ALP."},
    {icon:"📚",name:"ALP Reading Adapter",desc:"Take any text — a textbook passage, a news article, a story — and adapt it instantly to any reading level. The Reading Adapter preserves the content and interest while making it accessible for every learner on your caseload."},
    {icon:"⚡",name:"ALP Intervention Planner",desc:"Build targeted, evidence-based interventions for Tier 1, 2, and 3 learners — in seconds. The Intervention Planner produces structured plans for reading, math, writing, behavior, and social-emotional learning, tailored to each student's specific profile."},
    {icon:"🗂",name:"ALP Lesson Differentiator",desc:"Generate differentiated lesson plans for any curriculum topic — with built-in modifications for every learner on your caseload. Bloom's Taxonomy scaffolding, sensory accommodations, and extension tasks included. Empower every teacher in your school."},
  ];
  const caseTools=[
    {icon:"📋",name:"ALP Caseload Command",desc:"Your entire caseload — every student, every program, every deadline — in one calm, clear dashboard. Filter by intervention tier, review date, or status. Know exactly where every student stands, every day."},
    {icon:"📸",name:"ALP Student Snapshot",desc:"A one-page, printable overview of every student's ALP — built for the whole school, not just the ALP team. Every classroom teacher knows exactly who needs support, what accommodations apply, and how to help."},
    {icon:"📅",name:"ALP Review Meetings",desc:"Schedule ALP review meetings and team check-ins. Use the ALP Support Notice to generate formal meeting notices and send them to parents. Keep every review on time, every year."},
    {icon:"🧮",name:"ALP Accommodations Hub",desc:"Every student, every accommodation, every assessment — in one master view. Share the Accommodations Hub with your entire school staff so every teacher knows exactly what every learner needs, every day."},
    {icon:"🔒",name:"ALP Privacy Shield",desc:"Student data is sensitive. ALP Privacy Shield gives administrators full control over who sees what — role-based permissions, audit trails on every action, and privacy standards/secure data handling built in from day one."},
    {icon:"📤",name:"ALP Document Exporter",desc:"Export any Accelerated Learning Plan as a professionally formatted, audit-ready PDF or Word document in one click. Timestamped, formatted and ready — ready to send to families, district offices, or government agencies instantly."},
  ];
  const frameworks=[
    {f:"🇺🇸",n:"ALP standards (USA)",d:"All 50 states"},{f:"🇺🇸",n:"Support Plans",d:"ADA Support Plans"},
    {f:"🇬🇭",n:"Ghana",d:"SNE Framework"},{f:"🇳🇬",n:"Nigeria",d:"SNE Policy"},
    {f:"🇰🇪",n:"Kenya",d:"Inclusive Ed"},{f:"🇿🇦",n:"WCED S.Africa",d:"SIAS Framework"},
    {f:"🇬🇧",n:"UK",d:"Code of Practice"},{f:"🇨🇦",n:"Canada",d:"Provincial IEPs"},
    {f:"🇦🇺",n:"Australia",d:"Disability Std"},{f:"🌍",n:"Custom",d:"Any framework"},
  ];
  return(
    <div className="dot-bg" style={{minHeight:"100vh"}}>
      <SubNav active="Features" setNavPage={setNavPage} onEnter={onEnter} onSignup={onSignup} onDemo={onDemo}/>

      {/* Hero */}
      <section className="r-hero-section" style={{padding:"80px 48px 56px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
        <p className="lbl" style={{marginBottom:16,color:C.purple}}>Platform Features</p>
        <h1 className="serif" style={{fontSize:"clamp(40px,6vw,76px)",fontWeight:800,letterSpacing:"-.038em",lineHeight:1.05,marginBottom:20}}>
          Everything your school<br/><span className="serif-italic" style={{color:C.purple}}>needs to succeed.</span>
        </h1>
        <p style={{fontSize:18,color:C.warm,maxWidth:580,margin:"0 auto 40px",lineHeight:1.75}}>From AI goal writing to global support — one connected system for special education teachers, school leaders, and families. Supporting learners from birth to age 22+, in 10+ countries.</p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          <button className="btn-black" onClick={onSignup||onEnter} style={{fontSize:12,padding:"14px 32px"}}>🚀 Start Free Today</button>
          <button className="btn-outline" onClick={()=>setNavPage("Pricing")} style={{fontSize:12,padding:"14px 32px"}}>View Pricing</button>
          <button className="btn-ghost" style={{fontSize:12,padding:"14px 28px"}}>📅 Schedule Demo</button>
        </div>
      </section>

      {/* ALP AI Intelligence Suite — 8 tools */}
      <section style={{background:C.white,padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",borderTop:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
            <div>
              <p className="lbl" style={{marginBottom:12,color:C.purple}}>ALP AI Intelligence Suite</p>
              <h2 className="serif" style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:800,letterSpacing:"-.026em",lineHeight:1.1}}>
                ALP AI Intelligence Suite — <span className="serif-italic">Write ALPs<br/>in minutes, not days.</span>
              </h2>
            </div>
            <button className="btn-purple" onClick={onSignup||onEnter} style={{fontSize:11,padding:"12px 24px",flexShrink:0}}>Try Now, It's Free!</button>
          </div>
          <p style={{fontSize:15,color:C.warm,marginBottom:36,maxWidth:620,lineHeight:1.7}}>Eight purpose-built tools in the ALP AI Intelligence Suite — designed exclusively for Accelerated Learning Plans. Every tool is free for individual teachers, forever. Powered by ALP AI to save you hours each week.</p>
          <hr className="rule" style={{marginBottom:36}}/>
          <div className="r-feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
            {aiTools.map(t=>(
              <div key={t.name} style={{padding:24,border:`1px solid ${C.tanL}`,borderTop:`3px solid ${C.purple}`,borderRadius:12,background:"#FAF8FF",cursor:"pointer",transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(124,58,237,.15)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="";}}>
                <div style={{fontSize:28,marginBottom:12}}>{t.icon}</div>
                <div className="serif" style={{fontSize:15,fontWeight:700,marginBottom:8,lineHeight:1.2,color:C.black}}>{t.name}</div>
                <p style={{fontSize:12.5,color:C.warm,lineHeight:1.65}}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Caseload Tools */}
      <section style={{padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{marginBottom:12}}>Caseload Organization</p>
          <h2 className="serif" style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:700,letterSpacing:"-.026em",lineHeight:1.1,marginBottom:12}}>
            Replace spreadsheets<br/><span className="serif-italic">with calm and clarity.</span>
          </h2>
          <p style={{fontSize:15,color:C.warm,marginBottom:36,maxWidth:580,lineHeight:1.7}}>Managing a caseload with spreadsheets is messy, stressful, and error-prone. ALP's dashboard gives teachers and case managers access to vital information in an easy, effective way.</p>
          <hr className="rule" style={{marginBottom:36}}/>
          <div className="r-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
            {caseTools.map(t=>(
              <div key={t.name} style={{display:"flex",gap:16,padding:"22px 24px",border:`1px solid ${C.tanL}`,borderRadius:12,background:C.white,transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple;e.currentTarget.style.background="#FAF8FF";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.background=C.white;}}>
                <div style={{fontSize:26,flexShrink:0}}>{t.icon}</div>
                <div>
                  <div className="serif" style={{fontSize:15,fontWeight:700,marginBottom:6,color:C.black}}>{t.name}</div>
                  <p style={{fontSize:12.5,color:C.warm,lineHeight:1.65}}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Reach */}
      <section style={{background:C.black,padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{color:"#9A8A78",marginBottom:14,textAlign:"center"}}>Global Progress Engine</p>
          <h2 className="serif" style={{fontSize:"clamp(28px,4vw,52px)",fontWeight:700,color:C.cream,textAlign:"center",marginBottom:16,letterSpacing:"-.026em"}}>Built for every country,<br/><span className="serif-italic" style={{color:"#A78BFA"}}>every framework.</span></h2>
          <p style={{fontSize:15,color:"#9A8A78",textAlign:"center",maxWidth:560,margin:"0 auto 48px",lineHeight:1.7}}>ALP automatically checks programs against 10+ support frameworks — flagging anything missing before your audit arrives.</p>
          <div className="r-framework-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:40}}>
            {frameworks.map(c=>(
              <div key={c.n} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"16px 12px",textAlign:"center",transition:"all .2s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(124,58,237,.2)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.05)"}>
                <div style={{fontSize:26,marginBottom:6}}>{c.f}</div>
                <div style={{fontSize:12,fontWeight:700,color:C.cream,marginBottom:2}}>{c.n}</div>
                <div style={{fontSize:10,color:"#9A8A78"}}>{c.d}</div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center"}}>
            <button className="btn-purple" onClick={onSignup||onEnter} style={{fontSize:12,padding:"14px 36px"}}>Get Started Free →</button>
          </div>
        </div>
      </section>


      {/* ── AI INTELLIGENCE SUITE ────────────────── */}
      <section style={{background:"#0B0718",padding:"clamp(48px,7vw,80px) clamp(20px,4vw,48px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{marginBottom:16,color:"#A78BFA",textAlign:"center"}}>AI Intelligence Suite</p>
          <h2 className="serif" style={{fontSize:"clamp(26px,4vw,46px)",fontWeight:800,color:"#fff",letterSpacing:"-.032em",marginBottom:12,textAlign:"center",lineHeight:1.08}}>
            8 AI tools. All included. <span className="serif-italic" style={{color:"#A78BFA"}}>Free forever.</span>
          </h2>
          <p style={{fontSize:15,color:"rgba(255,255,255,.5)",textAlign:"center",maxWidth:560,margin:"0 auto 40px",lineHeight:1.7}}>Every ALP AI tool is built specifically for special education — not generic AI bolted on.</p>
          <div className="r-feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
            {[
              {icon:"✦",name:"ALP Goal Architect",desc:"Paste baseline data. Get 3 SMART goal options aligned to your region. Review and add in one click."},
              {icon:"📝",name:"Present Levels Coach",desc:"Generates Present Level of Performance (PLOP) paragraphs from assessment data. Academic and functional."},
              {icon:"🎯",name:"Intervention Planner",desc:"Data-driven intervention plans with research-based strategies matched to the disability and domain."},
              {icon:"📖",name:"Reading Adapter",desc:"Adapts any reading material to the student's level. Adjusts vocabulary, sentence length, and supports."},
              {icon:"🧠",name:"Behaviour Blueprint",desc:"FBA-informed behaviour intervention plans with proactive strategies, teaching replacement behaviours."},
              {icon:"🗣",name:"Social Story Writer",desc:"Creates personalised social stories for any situation — transitions, peer interaction, new routines."},
              {icon:"✅",name:"Plan Validator",desc:"Reviews your ALP against your framework, flags missing elements, and suggests fixes before review."},
              {icon:"📊",name:"Progress Analyst",desc:"Analyses CBM data trends, flags students off track, and recommends intervention adjustments."},
            ].map(tool=>(
              <div key={tool.name} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(124,58,237,.25)",borderRadius:14,padding:"22px 20px",transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(124,58,237,.12)";e.currentTarget.style.borderColor="rgba(124,58,237,.5)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor="rgba(124,58,237,.25)";}}>
                <div style={{fontSize:28,marginBottom:12}}>{tool.icon}</div>
                <h3 style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:8}}>{tool.name}</h3>
                <p style={{fontSize:12,color:"rgba(255,255,255,.5)",lineHeight:1.6}}>{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROGRESS ENGINE ──────────────────────────── */}
      <section style={{background:C.white,padding:"clamp(48px,7vw,80px) clamp(20px,4vw,48px)",borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(32px,5vw,64px)",alignItems:"center"}}>
          <div>
            <p className="lbl" style={{marginBottom:16,color:C.purple}}>Progress Engine</p>
            <h2 className="serif" style={{fontSize:"clamp(26px,4vw,44px)",fontWeight:700,letterSpacing:"-.032em",marginBottom:16,lineHeight:1.1}}>
              Track every goal,<br/><span className="serif-italic">every student, every week.</span>
            </h2>
            <p style={{fontSize:15,color:C.warm,lineHeight:1.75,marginBottom:24}}>ALP's real-time progress engine tracks every goal, service, and data point. It keeps your team informed and your plans current — always.</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[["Real-time tracking","Tracks progress and flags gaps as you type"],["Multi-region support","various regions, Nigeria, Kenya and more"],["Pre-review check","Full progress check with printable checklist"],["Deadline tracking","Alerts 30 days before any review date"]].map(([title,desc])=>(
                <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}><span style={{color:"#fff",fontSize:10,fontWeight:700}}>✓</span></div>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.black}}>{title}</div><div style={{fontSize:12,color:C.warm,marginTop:2}}>{desc}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{padding:"28px",background:C.purpleL}}>
            <p className="lbl" style={{marginBottom:16,color:C.purple}}>PROGRESS OVERVIEW — MARCUS JOHNSON</p>
            {[["Annual Goals (3 of 3)","✓ Complete",C.green],["Present Levels","✓ Complete",C.green],["Student Support Services","✓ Complete",C.green],["Related Services","✓ Complete",C.green],["Accommodations","✓ Complete",C.green],["Transition Planning","⚠️ Section 16 missing age",C.amber],["Family Signature","⏳ Awaiting response",C.amber],["Assessment Participation","✓ Complete",C.green]].map(([item,status,color])=>(
              <div key={item} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,fontSize:13}}>
                <span style={{color:C.black}}>{item}</span>
                <span style={{color,fontWeight:600}}>{status}</span>
              </div>
            ))}
            <div style={{marginTop:14,padding:"10px 14px",background:"#FEF9C3",borderRadius:8,fontSize:12,color:"#854D0E",fontWeight:600}}>⚠️ 2 items need attention before May 28 review</div>
          </div>
        </div>
      </section>

      {/* ── PROGRESS MONITORING ───────────────────── */}
      <section style={{background:C.white,padding:"clamp(48px,7vw,80px) clamp(20px,4vw,48px)",borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{marginBottom:16,color:C.purple,textAlign:"center"}}>Progress Monitoring</p>
          <h2 className="serif" style={{fontSize:"clamp(26px,4vw,44px)",fontWeight:700,letterSpacing:"-.032em",marginBottom:12,textAlign:"center",lineHeight:1.1}}>
            Data that drives decisions,<br/><span className="serif-italic">not just documents.</span>
          </h2>
          <p style={{fontSize:15,color:C.warm,textAlign:"center",maxWidth:560,margin:"0 auto 40px",lineHeight:1.7}}>Weekly CBM probes, automated trendlines, and intelligent alerts — all built into the ALP platform.</p>
          <div className="r-feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
            {[["📏","CBM Probes","Reading, math, writing, and behaviour probes. Enter scores in under 30 seconds."],["📈","Trendline Analysis","Automatic line of progress with goal line overlay. Visual and instant."],["🚨","Smart Alerts","3-point rule alerts when students fall below trajectory."],["🤖","AI Analysis","ALP AI reads your data and recommends intervention adjustments."]].map(([icon,title,desc])=>(
              <div key={title} className="card" style={{padding:"24px 20px",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:14}}>{icon}</div>
                <h3 style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:8}}>{title}</h3>
                <p style={{fontSize:12,color:C.warm,lineHeight:1.6}}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GLOBAL REACH ──────────────────────────── */}
      <section style={{background:"#0B0718",padding:"clamp(48px,7vw,80px) clamp(20px,4vw,48px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:16,color:"#A78BFA"}}>Global Reach</p>
          <h2 className="serif" style={{fontSize:"clamp(26px,4vw,44px)",fontWeight:800,color:"#fff",letterSpacing:"-.032em",marginBottom:12,lineHeight:1.1}}>
            Built for educators <span className="serif-italic" style={{color:"#A78BFA"}}>everywhere.</span>
          </h2>
          <p style={{fontSize:15,color:"rgba(255,255,255,.5)",maxWidth:560,margin:"0 auto 40px",lineHeight:1.7}}>Switch frameworks in one click. ALP adapts to your country's documentation requirements automatically.</p>
          <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:12}}>
            {[["🇺🇸","USA","ALP standards · Support Plans"],["🇬🇭","Ghana","Inclusive Ed Policy"],["🇬🇧","UK","EHC Plan · Code of Practice"],["🇳🇬","Nigeria","National Special Needs Education Policy"],["🇰🇪","Kenya","SNE Policy Framework"],["🇨🇦","Canada","Provincial Learning Plan Standards"],["🇦🇺","Australia","Nationally Consistent Collection"],["🌍","Africa Regional","Multi-country NGO plans"]].map(([flag,country,framework])=>(
              <div key={country} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(124,58,237,.25)",borderRadius:14,padding:"18px 20px",minWidth:140,textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:8}}>{flag}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:3}}>{country}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{framework}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ───────────────────────────── */}
      <section style={{background:"linear-gradient(135deg,#7C3AED,#6D28D9)",padding:"clamp(56px,8vw,96px) clamp(20px,4vw,48px)"}}>
        <div style={{maxWidth:640,margin:"0 auto",textAlign:"center"}}>
          <h2 className="serif" style={{fontSize:"clamp(28px,5vw,52px)",fontWeight:800,color:"#fff",letterSpacing:"-.032em",lineHeight:1.08,marginBottom:16}}>
            Start building better<br/><span className="serif-italic" style={{color:"#DDD6FE"}}>plans today.</span>
          </h2>
          <p style={{fontSize:16,color:"rgba(255,255,255,.7)",marginBottom:32,lineHeight:1.7}}>Free plan available for schools. Forever. No credit card.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={onSignup} style={{fontSize:14,padding:"15px 36px",borderRadius:99,background:"#fff",color:C.purple,fontWeight:700,border:"none",cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.03)"} onMouseLeave={e=>e.currentTarget.style.transform="none"}>Get Started Free →</button>
            <button onClick={onDemo} style={{fontSize:13,padding:"14px 28px",borderRadius:99,background:"rgba(255,255,255,.15)",color:"#fff",border:"1px solid rgba(255,255,255,.3)",cursor:"pointer",fontWeight:600}}>Book a Demo</button>
          </div>
        </div>
      </section>
      <PageFooter/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FOR SCHOOLS PAGE
// ═══════════════════════════════════════════════════════════════════
function ForSchoolsPage({setNavPage,onEnter,onSignup,onDemo}){
  const roles=[
    {icon:"👩‍🏫",title:"ALP Teacher",sub:"Reduce paperwork, increase student outcomes.",color:"#7C3AED",bg:"#EDE9FE",
     desc:"You spend hours on documentation that could be spent with students. ALP cuts writing time from 2 hours to 20 minutes — with AI doing the heavy lifting on goals, BIPs, and present levels.",
     features:["Build complete ALPs in 20 min","AI ALP Goal Architect, ALP Behaviour Blueprint, ALP Present Levels Coach","Caseload dashboard — all students in one view","Progress monitoring with CBM auto-alerts","Professional PDF export for sharing with families"]},
    {icon:"🎓",title:"ALP Director",sub:"Increase quality, ensure consistency, support your team at scale.",color:"#2563EB",bg:"#DBEAFE",
     desc:"Real-time plan visibility across every teacher and student in your school or district. Know exactly who needs attention — before the auditor arrives.",
     features:["School-wide progress dashboard","Overdue review date alerts","Audit-ready one-click reports","Staff caseload visibility & management","privacy standards & data privacy certified"]},
    {icon:"🏫",title:"Gen-Ed Teacher",sub:"Tools to support ALL of your students.",color:"#16A34A",bg:"#DCFCE7",
     desc:"ALP Student Snapshot mean every general education teacher knows exactly who has a learning program, what accommodations apply, and how to support each learner — without needing confidential record access.",
     features:["ALP Student Snapshot for every student","Accommodations matrix at your fingertips","Disability impact statements","Text leveling for struggling readers","Differentiated lesson plan suggestions"]},
    {icon:"🏛",title:"School Leadership",sub:"Create a culture of inclusion.",color:"#D97706",bg:"#FEF9C3",
     desc:"Build a school where every learner is seen, supported, and accelerating. ALP gives school leaders the data and visibility to make inclusion a reality — not just a policy statement.",
     features:["Inclusion culture dashboard","Review completion rate by teacher","Staff professional development tools","Parent engagement metrics","District reporting & benchmarking"]},
    {icon:"🩺",title:"Service Provider",sub:"Personalize intervention with ease.",color:"#DC2626",bg:"#FEE2E2",
     desc:"SLPs, OTs, PTs, psychologists, and behavior specialists can document sessions, track goal progress, and collaborate with the classroom team — all in one connected system.",
     features:["Session notes linked to ALP goals","Progress data entry by domain","Collaborative goal writing with teachers","Service frequency & duration tracking","Shared access with teacher caseload"]},
    {icon:"🌍",title:"NGOs & Governments",sub:"Deploy ALP at scale, globally.",color:"#0891B2",bg:"#CFFAFE",
     desc:"ALP is built for global deployment. Education ministries, NGOs, and government agencies can standardize intervention across schools, regions, and entire countries — with custom frameworks.",
     features:["Country-specific framework config","Bulk student import (CSV/SIS)","Regional progress reporting","Multi-language support","Custom branding & white-labeling"]},
  ];
  const highlights=[
    {q:"Built around a clear 10-step ALP workflow — from student information all the way to review and sign-off.",icon:"📋",c:"#7C3AED"},
    {q:"AI-assisted goal writing helps you turn baseline data into SMART goals in seconds, not hours.",icon:"✨",c:"#2563EB"},
    {q:"Designed to work for any school, anywhere — not tied to one country's compliance framework.",icon:"🌍",c:"#16A34A"},
  ];
  return(
    <div className="dot-bg" style={{minHeight:"100vh"}}>
      <SubNav active="For Schools" setNavPage={setNavPage} onEnter={onEnter} onSignup={onSignup} onDemo={onDemo}/>

      {/* Hero */}
      <section className="r-hero-section" style={{padding:"80px 48px 56px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
        <p className="lbl" style={{marginBottom:16,color:C.purple}}>For Schools & Districts</p>
        <h1 className="serif" style={{fontSize:"clamp(38px,6vw,72px)",fontWeight:800,letterSpacing:"-.038em",lineHeight:1.05,marginBottom:20}}>
          Regardless of your role,<br/><span className="serif-italic" style={{color:C.purple}}>ALP supports you.</span>
        </h1>
        <p style={{fontSize:18,color:C.warm,maxWidth:580,margin:"0 auto 40px",lineHeight:1.75}}>From special education teachers to school leaders, service providers to government agencies — ALP is designed for everyone who supports learners.</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
          {[{n:"10+",l:"Countries"},{n:"50+",l:"Disability types"},{n:"Birth–22+",l:"Age range"},{n:"13",l:"ALP sections"},{n:"Free",l:"For individuals"}].map(s=>(
            <div key={s.l} style={{textAlign:"center",padding:"14px 22px",background:C.white,borderRadius:12,border:`1px solid ${C.tanL}`}}>
              <div className="serif" style={{fontSize:22,fontWeight:800,color:C.purple}}>{s.n}</div>
              <div style={{fontSize:11,color:C.warm,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Who we serve — 6 role cards */}
      <section style={{padding:"0 48px 72px",maxWidth:1100,margin:"0 auto"}}>
        <h2 className="serif" style={{fontSize:36,fontWeight:700,letterSpacing:"-.026em",marginBottom:8,textAlign:"center"}}>Who we <span className="serif-italic" style={{color:C.purple}}>support</span></h2>
        <p style={{fontSize:14,color:C.warm,textAlign:"center",marginBottom:40}}>ALP is designed for every educator who supports a learner with structured needs.</p>
        <div className="r-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {roles.map(r=>(
            <div key={r.title} className="card" style={{padding:28,borderTop:`4px solid ${r.color}`}}>
              <div style={{width:50,height:50,borderRadius:12,background:r.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:14}}>{r.icon}</div>
              <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:4}}>{r.title}</h3>
              <p style={{fontSize:10,color:r.color,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>{r.sub}</p>
              <p style={{fontSize:13,color:C.warm,lineHeight:1.7,marginBottom:14}}>{r.desc}</p>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {r.features.map(f=><div key={f} style={{display:"flex",alignItems:"flex-start",gap:7,fontSize:12.5,color:C.black}}><span style={{color:r.color,fontWeight:700,flexShrink:0}}>✓</span>{f}</div>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Individual vs School */}
      <section style={{background:C.white,padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <h2 className="serif" style={{fontSize:34,fontWeight:700,letterSpacing:"-.026em",marginBottom:48,textAlign:"center"}}>Two ways to <span className="serif-italic">get started</span></h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            <div style={{background:"#FAF8FF",border:`2px solid ${C.purple}`,borderRadius:16,padding:36,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:14}}>👤</div>
              <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:8}}>Individual Teachers</h3>
              <p style={{fontSize:14,color:C.warm,lineHeight:1.7,marginBottom:20}}>Subscribe yourself, self-onboard in minutes, and get instant access to all AI tools and caseload management. No IT department needed.</p>
              <div style={{fontSize:30,fontWeight:800,color:C.purple,marginBottom:4}}>From $9<span style={{fontSize:14,fontWeight:400,color:C.warm}}>/mo</span></div>
              <p style={{fontSize:12,color:C.warm,marginBottom:22}}>ALP AI Intelligence Suite tools free forever · 14-day trial</p>
              <button className="btn-purple" onClick={onSignup||onEnter} style={{width:"100%",fontSize:12}}>Start Free Trial →</button>
            </div>
            <div style={{background:C.black,border:`2px solid ${C.black}`,borderRadius:16,padding:36,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:14}}>🏫</div>
              <h3 className="serif" style={{fontSize:22,fontWeight:700,color:C.cream,marginBottom:8}}>Schools & Districts</h3>
              <p style={{fontSize:14,color:"#9A8A78",lineHeight:1.7,marginBottom:20}}>Custom onboarding, staff training, district-wide deployment, and dedicated support — built around your school's specific needs and planning framework.</p>
              <div style={{fontSize:30,fontWeight:800,color:"#A78BFA",marginBottom:4}}>Custom <span style={{fontSize:14,fontWeight:400,color:"#9A8A78"}}>pricing</span></div>
              <p style={{fontSize:12,color:"#9A8A78",marginBottom:22}}>Tailored to your team size & district</p>
              <button className="btn-outline" onClick={()=>setNavPage("Pricing")} style={{width:"100%",fontSize:12,color:C.cream,borderColor:"#555"}}
                onMouseEnter={e=>{e.currentTarget.style.background=C.cream;e.currentTarget.style.color=C.black;}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.cream;}}>
                Schedule a Demo →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* What to expect */}
      <section style={{padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",maxWidth:1100,margin:"0 auto"}}>
        <h2 className="serif" style={{fontSize:34,fontWeight:700,letterSpacing:"-.026em",marginBottom:40,textAlign:"center"}}>Built for <span className="serif-italic">special educators</span></h2>
        <div className="r-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {highlights.map((t,i)=>(
            <div key={i} className="card" style={{padding:28}}>
              <div style={{fontSize:32,marginBottom:14}}>{t.icon}</div>
              <p className="serif" style={{fontSize:14,fontStyle:"italic",lineHeight:1.75,color:C.black}}>{t.q}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ── WHY ALP ───────────────────────────── */}
      <section style={{background:C.white,padding:"clamp(48px,7vw,80px) clamp(20px,4vw,48px)",borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{marginBottom:16,color:C.purple,textAlign:"center"}}>Why ALP</p>
          <h2 className="serif" style={{fontSize:"clamp(26px,4vw,44px)",fontWeight:700,letterSpacing:"-.032em",marginBottom:40,textAlign:"center",lineHeight:1.1}}>
            Built to solve the problems<br/><span className="serif-italic">special educators face every day.</span>
          </h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(28px,5vw,56px)",alignItems:"start"}}>
            <div>
              <div style={{background:C.purpleL,borderRadius:14,padding:"24px 26px",marginBottom:20}}>
                <p className="lbl" style={{marginBottom:12}}>THE PROBLEM</p>
                <p style={{fontSize:14,color:C.warm,lineHeight:1.75}}>Special education teachers spend hours building learning plans by hand, struggle to keep documentation organized, and often fall behind on review deadlines — all while trying to keep families informed and engaged.</p>
              </div>
              <div style={{background:"#DCFCE7",borderRadius:14,padding:"24px 26px"}}>
                <p className="lbl" style={{marginBottom:12,color:C.green}}>THE ALP APPROACH</p>
                <p style={{fontSize:14,color:C.warm,lineHeight:1.75}}>A guided 10-step workflow, AI-assisted goal writing, real-time progress tracking, and a professional PDF export system — so plans take minutes to complete instead of hours, and every approved ALP reaches families in a clean, readable document.</p>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {[["10 Steps","Guided ALP workflow",C.purple],["AI-Assisted","Goal writing & recommendations",C.green],["Real-Time","Progress monitoring & charts",C.blue],["Built-In","Family communication portal",C.amber]].map(([stat,label,color])=>(
                <div key={label} style={{background:C.white,border:`1px solid ${C.tanL}`,borderRadius:12,padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,color:C.warm}}>{label}</span>
                  <span className="serif" style={{fontSize:20,fontWeight:800,color}}>{stat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── COMING SOON ─────────────────────────── */}
      <section style={{background:C.purpleL,padding:"clamp(40px,5vw,64px) clamp(20px,4vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:12,color:C.purple}}>Roadmap</p>
          <h2 className="serif" style={{fontSize:"clamp(22px,3.5vw,34px)",fontWeight:700,marginBottom:12,letterSpacing:"-.016em"}}>SIS integrations — coming soon</h2>
          <p style={{fontSize:14,color:C.warm,marginBottom:32,maxWidth:480,margin:"0 auto 32px"}}>We're building connections to the tools schools already use. Want early access to a specific integration? Let us know.</p>
          <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:12}}>
            {[["📊","PowerSchool","Planned"],["🏫","Infinite Campus","Planned"],["📧","Google Workspace","Planned"],["💻","Microsoft 365","Planned"],["📁","Google Drive","Planned"],["📤","Custom CSV","Available now"]].map(([icon,name,desc])=>(
              <div key={name} style={{background:C.white,border:`1px solid ${C.tanL}`,borderRadius:10,padding:"14px 18px",minWidth:120,textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
                <div style={{fontSize:12,fontWeight:700,color:C.black}}>{name}</div>
                <div style={{fontSize:10,color:C.warm,marginTop:2}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHOOL PRICING ───────────────────────── */}
      <section style={{background:C.white,padding:"clamp(48px,7vw,80px) clamp(20px,4vw,48px)",borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:800,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:16,color:C.purple}}>School & District Pricing</p>
          <h2 className="serif" style={{fontSize:"clamp(26px,4vw,40px)",fontWeight:700,marginBottom:12,letterSpacing:"-.016em"}}>Straightforward pricing for every school</h2>
          <p style={{fontSize:14,color:C.warm,marginBottom:40}}>Volume discounts available for 10+ teachers. NGO and government pricing on request.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:28}}>
            {[{tier:"School",price:"$23",unit:"/mo per teacher",note:"Billed annually",features:["Everything in Professional","Admin dashboard","Staff management","District reports","Priority support","Custom frameworks"],color:C.green},{tier:"District",price:"Custom",unit:"",note:"Contact us",features:["Everything in School","Multi-school rollup","Dedicated CSM","Custom onboarding","SIS integration","SLA guarantee"],color:C.purple},{tier:"NGO / Government",price:"Custom",unit:"",note:"Subsidised pricing",features:["Everything in School","Country-wide deployment","Custom workflows","Training programme","Policy support","Research access"],color:C.blue}].map(tier=>(
              <div key={tier.tier} className="card" style={{padding:"24px 20px",border:`1.5px solid ${tier.color}22`}}>
                <p style={{fontSize:11,fontWeight:800,color:tier.color,letterSpacing:".1em",marginBottom:8}}>{tier.tier.toUpperCase()}</p>
                <div className="serif" style={{fontSize:28,fontWeight:800,color:C.black,marginBottom:2}}>{tier.price}<span style={{fontSize:12,fontWeight:400,color:C.warm}}>{tier.unit}</span></div>
                <p style={{fontSize:10,color:C.warm,marginBottom:16}}>{tier.note}</p>
                {tier.features.map(f=><div key={f} style={{fontSize:12,color:C.warm,marginBottom:7,display:"flex",gap:6,alignItems:"flex-start"}}><span style={{color:tier.color,flexShrink:0}}>✓</span>{f}</div>)}
                <button className="btn-purple" onClick={onDemo} style={{width:"100%",marginTop:16,fontSize:11}}>Talk to Sales →</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────── */}
      <section style={{background:"linear-gradient(135deg,#1a1a2e,#0B0718)",padding:"clamp(56px,8vw,96px) clamp(20px,4vw,48px)"}}>
        <div style={{maxWidth:640,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:16,color:"#A78BFA"}}>For Schools & Districts</p>
          <h2 className="serif" style={{fontSize:"clamp(26px,4vw,48px)",fontWeight:800,color:"#fff",letterSpacing:"-.032em",lineHeight:1.1,marginBottom:14}}>
            Ready to bring ALP<br/><span className="serif-italic" style={{color:"#A78BFA"}}>to your whole school?</span>
          </h2>
          <p style={{fontSize:15,color:"rgba(255,255,255,.6)",marginBottom:32,lineHeight:1.7}}>Talk to our team about School and District plans. Volume pricing, SIS integration, and dedicated onboarding support.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={onDemo} style={{fontSize:14,padding:"14px 36px",borderRadius:99,background:C.purple,color:"#fff",fontWeight:700,border:"none",cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.background="#6D28D9"} onMouseLeave={e=>e.currentTarget.style.background=C.purple}>📅 Book a Demo →</button>
            <button onClick={onSignup} style={{fontSize:13,padding:"13px 28px",borderRadius:99,background:"rgba(255,255,255,.1)",color:"#fff",border:"1px solid rgba(255,255,255,.2)",cursor:"pointer",fontWeight:600}}>Try for Free</button>
          </div>
        </div>
      </section>
      <PageFooter/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PRICING PAGE
// ═══════════════════════════════════════════════════════════════════
function PricingPage({setNavPage,onEnter,onSignup,onDemo}){
  const [billing,setBilling]=useState("monthly");
  const [openFaq,setOpenFaq]=useState(null);

  const plans=[
    {
      name:"Free",price:"$0",period:"forever",tag:null,color:"#6B7280",bg:C.white,textColor:C.black,
      desc:"ALP AI Intelligence Suite tools completely free for individual teachers. Forever. Because educators deserve support, not barriers.",
      features:["Up to 10 students","ALP Goal Architect — unlimited","ALP Present Levels Coach","ALP Behaviour Blueprint","ALP Reading Adapter","ALP Intervention Planner","ALP Lesson Differentiator","ALP Progress Probe Generator","PDF export (3/month)"],
      missing:["Caseload dashboard","10-step guided ALP workflow","Progress tracking engine","Director approval workflow","Compliance dashboard","Automated deadline tracking"],
      cta:"Create Free Account",style:"btn-outline",
    },
    {
      name:"Professional",
      price:billing==="monthly"?"$9":"$7",
      period:"/mo per teacher",tag:"MOST POPULAR",color:C.purple,bg:C.black,textColor:C.cream,
      desc:"The complete ALP system — global support, professional PDF export, director approval workflow, and unlimited AI tools all included.",
      features:["Unlimited students","ALP AI Intelligence Suite — all 8 tools unlimited","Full 10-step ALP Builder","Real-time CBM progress monitoring + alerts","Director approval workflow + audit log","All multi-region support","ALP Student Snapshot for gen-ed teachers","ALP Accommodations Hub","Caseload dashboard","Professional PDF export","Automated review date tracking","Priority email & chat support"],
      missing:[],
      cta:"Start 14-Day Free Trial",style:"btn-purple",
    },
    {
      name:"School",
      price:billing==="monthly"?"$29":"$23",
      period:"/mo per teacher",tag:"BEST VALUE",color:"#16A34A",bg:C.white,textColor:C.black,
      desc:"For schools that need admin oversight, progress reporting, and team management across all teachers.",
      features:["Everything in Professional","School admin progress dashboard","District-wide review date tracking","Overdue alert system for administrators","Bulk student import (CSV/SIS)","Staff onboarding & training tools","Custom confidentiality settings","PowerSchool / Infinite Campus integration","privacy standards privacy certification","Phone + dedicated account support"],
      missing:[],
      cta:"Schedule Demo",style:"btn-outline",
    },
    {
      name:"Enterprise",price:"Custom",period:"pricing",tag:null,color:C.black,bg:C.white,textColor:C.black,
      desc:"For districts, NGOs, and governments deploying ALP at scale across many schools or entire countries.",
      features:["Everything in School","Multi-school & district management","Custom planning framework builder","White-labeling & custom branding","Full API access for SIS integration","Dedicated account manager","On-site training & implementation","99.9% uptime SLA","Custom data residency","Government & NGO pricing available"],
      missing:[],
      cta:"Contact Sales",style:"btn-outline",
    },
  ];

  const compare=[
    {f:"AI ALP Goal Architect",a:"✓ Unlimited",p:"✓ Unlimited"},
    {f:"ALP Behaviour Blueprint",a:"✓ All plans",p:"✓ All plans"},
    {f:"ALP Present Levels Coach",a:"✓ All plans",p:"✓ All plans"},
    {f:"ALP Reading Adapter",a:"✓ All plans",p:"✓ All plans"},
    {f:"ALP Intervention Planner",a:"✓ All plans",p:"✓ All plans"},
    {f:"Progress Monitoring (AI)",a:"✓ CBM + auto-alerts",p:"✓ Basic"},
    {f:"PDF Export",a:"✓ All plans",p:"✗ Not included"},
    {f:"E-Signature",a:"✓ Pro & above",p:"✗ Not included"},
    {f:"Global Support (Ghana, Nigeria, UK…)",a:"✓ 10+ frameworks",p:"✗ USA only"},
    {f:"Desktop App (offline access)",a:"✓ Windows/Mac/Linux",p:"✗ Web only"},
    {f:"ALP Student Snapshot",a:"✓ Pro & above",p:"✓ Pro & above"},
    {f:"ALP Accommodations Hub",a:"✓ School & above",p:"✓ School & above"},
    {f:"Age Range",a:"Birth–22+",p:"Ages 5–21 only"},
    {f:"Price for student support teams",a:"$9/mo",p:"$10–15/mo"},
  ];

  const faqs=[
    {q:"Is ALP really free for individual teachers?",a:"Yes. All 8 tools in the ALP AI Intelligence Suite are free for individual teachers, forever: ALP Goal Architect, ALP Present Levels Coach, ALP Behaviour Blueprint, ALP Reading Adapter, ALP Intervention Planner, ALP Progress Probe Generator, ALP Learner Profile Builder, and ALP Lesson Differentiator. We believe educators deserve support, not paywalls."},
    {q:"How does ALP compare to other learning plan software?",a:"ALP's Professional plan starts at $9/month and includes features most learning-plan software charges extra for — global support frameworks (Ghana GES, Nigeria, UK, and more), a guided 10-step ALP workflow, director approval workflow, compliance dashboard, real-time progress tracking, and professional PDF export. All included at one price."},
    {q:"Is there a free trial on paid plans?",a:"Yes — every paid plan comes with a 14-day free trial. No credit card required. You get full access to all features during the trial period."},
    {q:"Do you support Ghana or Nigeria educators?",a:"Yes — ALP was built with African and global schools in mind from day one. We support Ghana, Nigeria, Kenya, WCED South Africa, UK, Australia NCCD, and all US frameworks (ALP standards, Support Plans) out of the box."},
    {q:"Can I use ALP for students from birth to age 22?",a:"Absolutely. ALP supports early intervention (birth–3), preschool (ages 3–5), school age (6–13), transition (14–21), and adult transition (18–22+). The ALP Builder automatically adjusts required sections and requirements based on the student's age."},
    {q:"Do you offer discounts for NGOs or governments?",a:"Yes — we offer significant discounts for non-profit organizations, government education departments, and schools in low-income countries. Email support@growwithalp.com for pricing."},
    {q:"What happens to my data if I cancel?",a:"Your data is yours. Export all student records, ALPs, and progress data as CSV or PDF at any time before canceling. We retain your data for 90 days after cancellation."},
  ];

  return(
    <div className="dot-bg" style={{minHeight:"100vh"}}>
      <SubNav active="Pricing" setNavPage={setNavPage} onEnter={onEnter} onSignup={onSignup} onDemo={onDemo}/>

      {/* Hero */}
      <section style={{padding:"72px 48px 48px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
        <p className="lbl" style={{marginBottom:16,color:C.purple}}>Simple, Transparent Pricing</p>
        <h1 className="serif" style={{fontSize:"clamp(36px,5vw,68px)",fontWeight:800,letterSpacing:"-.038em",lineHeight:1.05,marginBottom:16}}>
          Plans for every<br/><span className="serif-italic" style={{color:C.purple}}>school and budget.</span>
        </h1>
        <p style={{fontSize:17,color:C.warm,maxWidth:540,margin:"0 auto 12px",lineHeight:1.75}}>ALP AI Intelligence Suite tools are <b style={{color:C.black}}>free forever</b> for individual teachers. Paid plans start at just $9/mo — cheaper than traditional learning plan software.</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:36}}>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Most affordable plan</span>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Global support included</span>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Director approval workflow</span>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ PDF export included</span>
        </div>
        <div style={{display:"inline-flex",background:C.white,border:`1px solid ${C.tanL}`,borderRadius:99,padding:4,gap:4,marginBottom:52}}>
          {["monthly","annual"].map(b=>(
            <button key={b} onClick={()=>setBilling(b)}
              style={{padding:"9px 24px",borderRadius:99,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .2s",background:billing===b?C.black:"transparent",color:billing===b?C.cream:C.warm}}>
              
              {b==="monthly"?"Monthly":"Annual"}{b==="annual"&&<span style={{fontSize:10,color:C.green,fontWeight:700,marginLeft:6}}>Save 22%</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Pricing cards */}
      <section style={{padding:"0 clamp(20px,4vw,48px) 64px",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,alignItems:"start",paddingTop:24}}>
          {plans.map(p=>(
            <div key={p.name} style={{background:p.bg,borderRadius:14,padding:26,position:"relative",border:`1.5px solid ${p.tag?p.color:C.tanL}`,boxShadow:p.tag?"0 8px 40px rgba(124,58,237,.2)":"0 1px 3px rgba(0,0,0,.04)",display:"flex",flexDirection:"column",gap:0,marginTop:p.tag?0:0}}>
              {p.tag&&<div style={{position:"absolute",top:-14,left:"50%",transform:"translateX(-50%)",background:p.color,color:"#fff",fontSize:10,fontWeight:800,padding:"5px 18px",borderRadius:99,letterSpacing:".08em",whiteSpace:"nowrap",boxShadow:`0 2px 8px ${p.color}66`}}>{p.tag}</div>}
              <p style={{fontSize:10,fontWeight:700,color:p.bg===C.black?"#A78BFA":p.color,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>{p.name}</p>
              <div style={{display:"flex",alignItems:"flex-end",gap:3,marginBottom:4}}>
                <span className="serif" style={{fontSize:p.price==="Custom"?30:42,fontWeight:800,color:p.bg===C.black?C.cream:C.black,lineHeight:1}}>{p.price}</span>
                {p.price!=="Custom"&&<span style={{fontSize:12,color:p.bg===C.black?"#9A8A78":C.warm,marginBottom:5}}>{p.period}</span>}
              </div>
              {p.price==="Custom"&&<div style={{fontSize:12,color:C.warm,marginBottom:4}}>contact us</div>}
              <p style={{fontSize:12.5,color:p.bg===C.black?"#9A8A78":C.warm,marginBottom:16,lineHeight:1.55}}>{p.desc}</p>
              <hr style={{border:"none",borderTop:`1px solid ${p.bg===C.black?"rgba(255,255,255,.1)":C.tanL}`,marginBottom:14}}/>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20,flex:1}}>
                {p.features.map(f=><div key={f} style={{display:"flex",alignItems:"flex-start",gap:7,fontSize:12,color:p.bg===C.black?C.cream:C.black}}><span style={{color:"#16A34A",fontWeight:700,flexShrink:0,marginTop:.5}}>✓</span>{f}</div>)}
                {p.missing.map(f=><div key={f} style={{display:"flex",alignItems:"flex-start",gap:7,fontSize:12,color:"#9CA3AF",opacity:.6}}><span style={{fontWeight:700,flexShrink:0,marginTop:.5}}>✗</span>{f}</div>)}
              </div>
              <button className={p.style} onClick={p.cta==="Schedule Demo"||p.cta==="Contact Sales"?(onDemo||onEnter):(onSignup||onEnter)}
                style={{width:"100%",fontSize:12,padding:"13px",...(p.style==="btn-outline"&&p.bg===C.black?{color:C.cream,borderColor:"#555"}:{})}}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
        <p style={{textAlign:"center",fontSize:13,color:C.warm,marginTop:20}}>All paid plans include a <b style={{color:C.black}}>14-day free trial</b>. No credit card required. · <a href="mailto:support@growwithalp.com" style={{color:C.purple}}>support@growwithalp.com</a></p>
      </section>

      {/* ALP vs Traditional Software comparison */}
      <section style={{background:C.white,padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:800,margin:"0 auto"}}>
          <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-.026em",marginBottom:6,textAlign:"center"}}>ALP vs <span className="serif-italic">Traditional Learning Plan Software</span></h2>
          <p style={{fontSize:14,color:C.warm,textAlign:"center",marginBottom:36}}>See exactly what makes ALP different — feature by feature.</p>
          <div style={{border:`1px solid ${C.tanL}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:C.purpleL,padding:"12px 20px",borderBottom:`1px solid ${C.tanL}`}}>
              {["Feature","ALP","Traditional Software"].map((h,i)=><span key={h} style={{fontSize:11,fontWeight:700,color:i===1?C.purple:C.warm,textTransform:"uppercase",letterSpacing:".08em",textAlign:i>0?"center":"left"}}>{h}</span>)}
            </div>
            {compare.map((row,i)=>(
              <div key={row.f} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"12px 20px",background:i%2===0?C.white:"#FAFAFA",borderBottom:i<compare.length-1?`1px solid ${C.tanL}`:"none",alignItems:"center"}}>
                <span style={{fontSize:13,color:C.black}}>{row.f}</span>
                <span style={{fontSize:13,textAlign:"center",color:row.a.startsWith("✓")||row.a.includes("$9")||row.a.includes("Birth")?C.green:C.black,fontWeight:row.a.startsWith("✓")?600:500}}>{row.a}</span>
                <span style={{fontSize:13,textAlign:"center",color:row.p.startsWith("✗")?"#9CA3AF":C.black}}>{row.p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",maxWidth:780,margin:"0 auto"}}>
        <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-.026em",marginBottom:40,textAlign:"center"}}>Frequently asked <span className="serif-italic">questions</span></h2>
        {faqs.map((f,i)=>(
          <div key={f.q} style={{borderBottom:`1px solid ${C.tanL}`,paddingBottom:20,marginBottom:20}}>
            <div onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:16}}>
              <span style={{fontSize:15,fontWeight:600,color:C.black,lineHeight:1.4}}>{f.q}</span>
              <span style={{fontSize:22,color:C.purple,flexShrink:0,transition:"transform .2s",display:"inline-block",transform:openFaq===i?"rotate(45deg)":"rotate(0)"}}>+</span>
            </div>
            {openFaq===i&&<p style={{fontSize:14,color:C.warm,lineHeight:1.75,marginTop:14}}>{f.a}</p>}
          </div>
        ))}
      </section>


      {/* ── MONEY-BACK GUARANTEE ──────────────────── */}
      <section style={{background:C.purpleL,padding:"clamp(36px,5vw,56px) clamp(20px,4vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:800,margin:"0 auto",textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:16}}>🛡️</div>
          <h2 className="serif" style={{fontSize:"clamp(22px,3.5vw,34px)",fontWeight:700,marginBottom:12,letterSpacing:"-.016em"}}>14-day money-back guarantee</h2>
          <p style={{fontSize:15,color:C.warm,lineHeight:1.7,marginBottom:28,maxWidth:540,margin:"0 auto 28px"}}>Try any paid plan free for 14 days. No credit card required to start. If you're not happy, we refund you — no questions asked.</p>
          <div style={{display:"flex",justifyContent:"center",gap:"clamp(20px,4vw,48px)",flexWrap:"wrap"}}>
            {[["🔒","Secure & Private","Your data is always protected"],["📧","24-hour support","Monday to Saturday"],["🌍","10+ frameworks","Global insights built in"],["🤝","No lock-in","Export all data anytime"]].map(([icon,title,desc])=>(
              <div key={title} style={{textAlign:"center",minWidth:100}}>
                <div style={{fontSize:26,marginBottom:6}}>{icon}</div>
                <div style={{fontSize:12,fontWeight:700,color:C.black,marginBottom:2}}>{title}</div>
                <div style={{fontSize:11,color:C.warm}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <PageFooter/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RESOURCES PAGE
// ═══════════════════════════════════════════════════════════════════
function ResourcesPage({setNavPage,onEnter,onSignup,onDemo}){
  const [selectedArticle,setSelectedArticle]=useState(null);
  const guides=[
    {icon:"📋",tag:"GUIDE",title:"Getting Started with ALP",desc:"From account setup to your first complete ALP in 20 minutes.",time:"10 min read",color:C.purple},
    {icon:"🤖",tag:"AI TUTORIAL",title:"Using the ALP AI Intelligence Suite",desc:"Generate SMART goals, BIPs, ALP Present Levels Coach statements, and lesson plans with AI. Step-by-step with real examples.",time:"8 min read",color:"#2563EB"},
    {icon:"📈",tag:"GUIDE",title:"Progress Monitoring 101",desc:"Understanding CBM, trendlines, and when to intervene. Set up your data system and read the charts.",time:"12 min read",color:"#16A34A"},
    {icon:"📄",tag:"GUIDE",title:"Sharing Approved ALPs with Families",desc:"How to export, print, and deliver completed ALP PDFs to parents and guardians — no parent login required.",time:"5 min"},
    {icon:"⚖️",tag:"GUIDE",title:"ALP Plan Reviewiew Checklist (USA)",desc:"Every required element for a effective ALP under ALP standards and Support Plans.",time:"15 min read",color:"#DC2626"},
    {icon:"🌍",tag:"GUIDE",title:"Ghana SNE Framework Guide",desc:"Building ALPs aligned to the Ghana Education Service's SNE framework and inclusive education policy.",time:"12 min read",color:"#0891B2"},
    {icon:"🧠",tag:"AI GUIDE",title:"Writing Better BIPs with AI",desc:"How to use the ALP Behaviour Blueprint to create comprehensive behavior intervention plans in minutes.",time:"9 min read",color:C.purple},
    {icon:"⚡",tag:"TUTORIAL",title:"ALP Intervention Planner — Tier 1, 2 & 3",desc:"Build structured interventions for every learner tier using the ALP Intervention Planner. Includes real examples for reading, math, behavior, and social-emotional learning across all age groups.",time:"11 min read",color:"#16A34A"},
    {icon:"📰",tag:"GUIDE",title:"ALP vs Traditional Plans — What's the Difference?",desc:"A clear explanation of how the Accelerated Learning Plan differs from traditional learning plans and why it matters globally.",time:"6 min read",color:"#6B7280"},
  ];
  const workshops=[
    {icon:"🖥",title:"ALP AI Tools for Educators",date:"Every Tuesday · 4:00 PM EST",desc:"Live workshop on using ALP's ALP AI Intelligence Suite for goal writing, BIPs, and progress monitoring. Free for all educators.",cta:"Register Free"},
    {icon:"🌍",title:"ALP for African Schools",date:"Every Thursday · 3:00 PM WAT",desc:"Focused on Ghana, Nigeria, and Kenya frameworks. Presented in English with open Q&A.",cta:"Register Free"},
    {icon:"📊",title:"Progress Monitoring Masterclass",date:"1st Friday of month · 2:00 PM EST",desc:"Deep dive into CBM, trendline analysis, and data-driven decision making for ALP educators worldwide.",cta:"Register Free"},
  ];
  const videos=[
    {title:"ALP Platform — 3 Minute Overview",desc:"Every major feature in 3 minutes.",dur:"3:14",icon:"🎬"},
    {title:"Build Your First ALP — Full Walkthrough",desc:"A complete ALP built from scratch in real time.",dur:"18:42",icon:"📋"},
    {title:"ALP AI Goal Writing Live Demo",desc:"See the AI generate 3 SMART goals from baseline data.",dur:"6:28",icon:"🤖"},
    {title:"ALP Behaviour Blueprint — Live Demo",desc:"Watch the Behaviour Blueprint create a full intervention plan in under 3 minutes.",dur:"2:58",icon:"🧠"},
    {title:"PDF Export & Sharing",desc:"Exporting the approved ALP as a professional PDF and sharing it with families.",dur:"5:00",icon:"📄"},
    {title:"Ghana Progress Review Walkthrough",desc:"Building a effective ALP for Ghana's GES framework.",dur:"14:05",icon:"🌍"},
    {title:"Progress Monitoring Setup",desc:"Configure CBM tracking and alerts step by step.",dur:"11:20",icon:"📈"},
    {title:"ALP Caseload Command Tour",desc:"Managing your full caseload in one view.",dur:"7:55",icon:"📅"},
  ];
  const downloads=[
    {icon:"📄",title:"Blank ALP Template",desc:"Printable 10-step ALP form, ALP standards-aligned."},
    {icon:"📊",title:"Progress Monitoring Data Sheet",desc:"CBM tracking sheets for reading, math, and behavior."},
    {icon:"📋",title:"Family Rights Summary",desc:"Plain-language parent rights — available in 8 languages."},
    {icon:"🗂",title:"ALP Quick Reference Card",desc:"One-page cheat sheet for new educators. Print and post it."},
    {icon:"📑",title:"Progress Review Audit Self-Checklist",desc:"Self-audit tool to check your ALP before an official review."},
    {icon:"📰",title:"ALP vs Traditional Plans Comparison Guide",desc:"Full explanation of how ALP differs from traditional learning plans."},
  ];
  return(
    <div className="dot-bg" style={{minHeight:"100vh"}}>
      {selectedArticle&&<ArticleModal article={selectedArticle} onClose={()=>setSelectedArticle(null)}/>}
      <SubNav active="Resources" setNavPage={setNavPage} onEnter={onEnter} onSignup={onSignup} onDemo={onDemo}/>

      {/* Hero */}
      <section style={{padding:"72px 48px 48px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
        <p className="lbl" style={{marginBottom:16,color:C.purple}}>Learning & Support</p>
        <h1 className="serif" style={{fontSize:"clamp(36px,5vw,68px)",fontWeight:800,letterSpacing:"-.038em",lineHeight:1.05,marginBottom:16}}>
          Everything you need<br/><span className="serif-italic" style={{color:C.purple}}>to get started.</span>
        </h1>
        <p style={{fontSize:17,color:C.warm,maxWidth:540,margin:"0 auto 0",lineHeight:1.75}}>Guides, workshops, videos, templates — built for educators at every level, in every country.</p>
      </section>

      {/* Guides */}
      <section style={{padding:"48px 48px 72px",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
          <div><p className="lbl" style={{marginBottom:8}}>Guides & Articles</p><h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-.026em"}}>Learn at your <span className="serif-italic">own pace.</span></h2></div>
        </div>
        <hr className="rule" style={{margin:"22px 0 34px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
          {guides.map(g=>(
            <div key={g.title} className="card" style={{padding:26,cursor:"pointer",transition:"all .2s"}} onClick={()=>setSelectedArticle(g)}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.1)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="";}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <span style={{fontSize:10,fontWeight:700,color:g.color,border:`1px solid ${g.color}`,padding:"3px 10px",borderRadius:99}}>{g.tag}</span>
                <span style={{fontSize:11,color:C.warm}}>{g.time}</span>
              </div>
              <div style={{fontSize:28,marginBottom:10}}>{g.icon}</div>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:8,lineHeight:1.25}}>{g.title}</h3>
              <p style={{fontSize:12.5,color:C.warm,lineHeight:1.65,marginBottom:14}}>{g.desc}</p>
              <div style={{fontSize:13,color:g.color,fontWeight:600}}>Read more →</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Workshops */}
      <section style={{background:C.white,padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{marginBottom:12}}>Live Workshops</p>
          <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-.026em",marginBottom:40}}>Register for upcoming<br/><span className="serif-italic">virtual AI workshops.</span></h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
            {workshops.map(w=>(
              <div key={w.title} style={{background:"#FAF8FF",border:`1.5px solid rgba(124,58,237,.2)`,borderRadius:14,padding:28}}>
                <div style={{fontSize:32,marginBottom:12}}>{w.icon}</div>
                <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:4}}>{w.title}</h3>
                <p style={{fontSize:11,color:C.purple,fontWeight:700,letterSpacing:".04em",marginBottom:12}}>{w.date}</p>
                <p style={{fontSize:13,color:C.warm,lineHeight:1.65,marginBottom:20}}>{w.desc}</p>
                <button className="btn-purple" style={{width:"100%",fontSize:11,padding:"11px"}}>{w.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Learning Library — Video tutorials */}
      

      {/* Downloads */}
      <section style={{padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",maxWidth:1100,margin:"0 auto"}}>
        <p className="lbl" style={{marginBottom:12}}>Free Downloads</p>
        <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-.026em",marginBottom:40}}>Templates & <span className="serif-italic">tools.</span></h2>
        <div className="r-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {downloads.map(d=>(
            <div key={d.title} className="card" style={{padding:"18px 22px",display:"flex",gap:14,alignItems:"flex-start",cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple;e.currentTarget.style.background="#FAF8FF";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.background=C.white;}}>
              <div style={{fontSize:26,flexShrink:0}}>{d.icon}</div>
              <div>
                <div style={{fontSize:13.5,fontWeight:700,color:C.black,marginBottom:4}}>{d.title}</div>
                <div style={{fontSize:12.5,color:C.warm,lineHeight:1.55,marginBottom:8}}>{d.desc}</div>
                <span style={{fontSize:12,color:C.purple,fontWeight:600}}>⬇ Free Download</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* OS Download cards with real logos */}
      <section style={{background:C.purpleL,padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:16}}>Desktop App</p>
          <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-.026em",marginBottom:14}}>Access ALP <span className="serif-italic">your way.</span></h2>
          <p style={{fontSize:14,color:C.warm,marginBottom:44}}>Full offline access, faster performance, and enterprise security on all major platforms.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
            {[
              {icon:"🌐",label:"Web App",sub:"No download needed",cta:true},
              {svg:<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 88 88"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203z" fill="#F35325"/><path d="M39.996 6.86L87.314 0v41.745l-47.318.376z" fill="#81BC06"/><path d="M35.67 45.471l.028 34.453L0 75.48V45.268z" fill="#05A6F0"/><path d="M39.996 46.06l47.318-.376V88l-47.318-7.62z" fill="#FFBA08"/></svg>,label:"Windows",sub:"Windows 10 / 11"},
              {svg:<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="var(--text-primary,#1a0a2e)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.46 2.208 3.09 3.792 3.029 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>,label:"macOS",sub:"macOS 12+"},
              {svg:<svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50"><ellipse cx="21" cy="31" rx="14" ry="15" fill="#1a1a1a"/><ellipse cx="21" cy="33" rx="7.5" ry="9.5" fill="#f0ece0"/><ellipse cx="21" cy="11" rx="9.5" ry="10.5" fill="#1a1a1a"/><ellipse cx="21" cy="12.5" rx="5.5" ry="6.5" fill="#f0ece0"/><circle cx="18" cy="9.5" r="1.7" fill="#1a1a1a"/><circle cx="24" cy="9.5" r="1.7" fill="#1a1a1a"/><circle cx="18.6" cy="8.9" r="0.65" fill="#fff"/><circle cx="24.6" cy="8.9" r="0.65" fill="#fff"/><ellipse cx="21" cy="14.5" rx="2.8" ry="1.7" fill="#f5a623"/><ellipse cx="8" cy="30" rx="4.5" ry="9" fill="#1a1a1a" transform="rotate(-8 8 30)"/><ellipse cx="34" cy="30" rx="4.5" ry="9" fill="#1a1a1a" transform="rotate(8 34 30)"/><ellipse cx="16" cy="47" rx="5.5" ry="2.8" fill="#f5a623"/><ellipse cx="26" cy="47" rx="5.5" ry="2.8" fill="#f5a623"/></svg>,label:"Linux",sub:"Ubuntu / Debian"}
            ].map(p=>(
              <div key={p.label} className="card" style={{padding:"28px 20px",textAlign:"center"}}>
                {p.svg
                  ?<div style={{width:52,height:52,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center"}}>{p.svg}</div>
                  :<div style={{fontSize:42,marginBottom:12}}>{p.icon}</div>
                }
                <div className="serif" style={{fontSize:17,fontWeight:700,marginBottom:4}}>{p.label}</div>
                <div style={{fontSize:12,color:C.warm,marginBottom:18}}>{p.sub}</div>
                {p.cta?<button className="btn-black" onClick={onSignup||onEnter} style={{width:"100%",fontSize:11}}>Open in Browser</button>:<button className="btn-outline" onClick={()=>setShowDownload(true)} style={{width:"100%",fontSize:11}}>⬇ Download {p.label}</button>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support */}
      <section style={{padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",maxWidth:1100,margin:"0 auto"}}>
        <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-.026em",marginBottom:40,textAlign:"center"}}>Need <span className="serif-italic">help?</span></h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {[{icon:"💬",title:"Live Chat Support",desc:"Chat with our support team inside the app. Monday–Friday, 8am–6pm EST.",action:"Start Chat"},{icon:"📧",title:"Email Support",desc:"Response within 24 hours. support@growwithalp.com",action:"Send Email"},{icon:"📅",title:"Schedule a Demo",desc:"30-minute live demo — we walk through every feature and answer all your questions.",action:"Book a Demo"}].map(s=>(
            <div key={s.title} className="card" style={{padding:32,textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:14}}>{s.icon}</div>
              <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:10}}>{s.title}</h3>
              <p style={{fontSize:13,color:C.warm,lineHeight:1.65,marginBottom:20}}>{s.desc}</p>
              <button className="btn-outline" style={{fontSize:11,padding:"10px 24px"}}>{s.action}</button>
            </div>
          ))}
        </div>
      </section>

      
      {/* ── WEBINARS ───────────────────────────────── */}
      <section style={{background:C.purpleL,borderTop:`1px solid ${C.tanL}`,padding:"clamp(40px,6vw,64px) clamp(20px,4vw,48px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{marginBottom:12,color:C.purple}}>Live & Recorded</p>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24,flexWrap:"wrap",gap:12}}>
            <h2 className="serif" style={{fontSize:"clamp(22px,3vw,34px)",fontWeight:700,letterSpacing:"-.026em"}}>Webinars & <span className="serif-italic">Training</span></h2>
          </div>
          <div className="r-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {[
              {icon:"🎙",title:"ALP Builder Masterclass",date:"Every Tue · 11 AM EST",desc:"All 13 sections, live Q&A.",cta:"Register",live:true},
              {icon:"📊",title:"Progress Monitoring Masterclass",date:"1st Fri · 2 PM EST",desc:"CBM, trendlines, 3-point rule.",cta:"Register",live:true},
              {icon:"✅",title:"ALP Essentials",date:"Recorded · 58 min",desc:"various regions.",cta:"Watch",live:false},
              {icon:"❤️",title:"Family Engagement",date:"Recorded · 42 min",desc:"Portal, signatures, engagement.",cta:"Watch",live:false},
              {icon:"🤖",title:"AI Tools for Student Support",date:"Recorded · 34 min",desc:"Goal Architect, Coach, Blueprint.",cta:"Watch",live:false},
              {icon:"🌍",title:"Global Progress Review Workshop",date:"Recorded · 61 min",desc:"GES, NERDC, UK, KICD.",cta:"Watch",live:false},
            ].map(w=>(
              <div key={w.title} className="card" style={{padding:"20px",position:"relative"}}>
                {w.live&&<span style={{position:"absolute",top:12,right:12,fontSize:9,fontWeight:800,color:C.green,background:"#DCFCE7",padding:"2px 7px",borderRadius:99}}>LIVE</span>}
                <div style={{fontSize:26,marginBottom:10}}>{w.icon}</div>
                <h3 style={{fontSize:13,fontWeight:700,color:C.black,marginBottom:3}}>{w.title}</h3>
                <p style={{fontSize:10,color:C.purple,fontWeight:600,marginBottom:6}}>{w.date}</p>
                <p style={{fontSize:12,color:C.warm,lineHeight:1.5,marginBottom:12}}>{w.desc}</p>
                <button className={w.live?"btn-purple":"btn-ghost"} style={{fontSize:11,padding:"8px 16px",width:"100%"}} onClick={()=>onSignup&&onSignup()}>{w.cta} →</button>
              </div>
            ))}
          </div>
        </div>
      </section>
<PageFooter/>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════
// ARTICLE READER MODAL
// ═══════════════════════════════════════════════════════════
const ARTICLES = {
  "Progress Monitoring 101":{tag:"GUIDE",time:"12 min read",color:"#16A34A",body:`Progress monitoring is the practice of regularly collecting data on student performance to evaluate whether interventions are working. Unlike annual assessments, it happens frequently — weekly or bi-weekly — so teachers can adjust before a student falls far behind.

**What is CBM?**
Curriculum-Based Measurement (CBM) is the most widely used form of progress monitoring. It uses brief, standardised probes — short tests — that measure a student's fluency or accuracy in a specific skill. Common CBM types include: Reading (words correct per minute), Math (digits correct per minute), Writing (words written, correct word sequences), and Spelling.

**How to read trendlines**
After 6–8 data points, draw a line of best fit through your data. Compare it to the goal line — a line from baseline to the annual goal. If the data line is below the goal line for 3+ consecutive points, the intervention isn't working and needs to change.

**When to make a decision**
The 3-point rule: if 3 data points in a row are below the goal line, change the intervention. If 3 points are above, consider raising the goal.

ALP's Progress Monitoring dashboard does all of this automatically — trendlines, alerts, and decision rules are built in.`},
  "Writing SMART Goals":{tag:"GUIDE",time:"8 min read",color:"#7C3AED",body:`SMART goals are the foundation of every effective Accelerated Learning Plan. SMART stands for Specific, Measurable, Achievable, Relevant, and Time-bound.

**The anatomy of a SMART goal**
Every ALP goal should follow this structure: "By [date], [student name] will [behaviour] with [criterion], as measured by [method], across [settings/trials]."

**Example — Reading:**
"By June 2026, Marcus will read 85 words correct per minute on grade 3 oral reading fluency probes with 90% accuracy across 3 consecutive probes, as measured by weekly CBM."

**Example — Behaviour:**
"By June 2026, Ama will independently use a self-regulation strategy (deep breathing or movement break) within 2 minutes of identifying an emotional trigger, across 4 out of 5 observed opportunities, as measured by teacher observation."

**Common mistakes to avoid**
- Vague criteria ("will improve reading") — always include a measurable number
- No measurement method — always specify how you'll measure
- Unrealistic targets — use the student's current level + expected growth rate
- Missing date — always include the annual review date

ALP's AI Goal Architect generates SMART goals automatically from your baseline data.`},
  "Global Progress Review Frameworks":{tag:"GUIDE",time:"10 min read",color:"#2563EB",body:`ALP supports multi-region support. Here is what each one requires:\n\n**ALP standards (USA)**\nThe Individuals with Disabilities Education Act requires schools to provide a Free Appropriate Public Education (FAPE) to eligible students with disabilities. A complete IEP/ALP must include: present levels of academic achievement, measurable annual goals, description of services, participation in state assessments, and transition planning for students 16+.\n\n**Ghana**\nGhana Education Service requires the Inclusive Education Policy to be followed. An ALP must document the student's learning profile, adapted curriculum, support services, and family engagement plan.\n\n**UK Code of Practice**\nThe Education, Health and Care (EHC) plan replaces the old statement of SEN. It must cover all areas of a child's life — education, health, and social care — and be person-centred.\n\n**Nigeria**\nThe National Educational Research and Development Council guidelines require documentation of the learner's needs assessment, individualized support plan, and regular review meetings with families.\n\nALP automatically checks your plan against your configured framework and flags any missing elements before your review date.`},
  "ALP vs Traditional Plans — What's the Difference?":{tag:"GUIDE",time:"6 min read",color:"#6B7280",body:`The Accelerated Learning Plan (ALP) is not just another name for an IEP or learning plan. It is a globally-designed, AI-powered framework for documenting and monitoring the progress of any student with structured learning needs — regardless of country, disability label, or age.

**Traditional learning plans** (IEPs, EHCPs, SLPs) are typically:
- Paper-based or locked in proprietary software
- Country-specific and not portable
- Written in isolation by a single teacher
- Reviewed annually with little real-time data
- Difficult for families to understand

**ALP is different:**
- Cloud-based and accessible on any device
- Designed for multi-region support simultaneously
- Collaborative — teachers, families, and specialists work together
- Real-time progress monitoring with automated alerts
- AI-powered goal writing that takes minutes, not hours
- Family-friendly language and translation support

**Who can use ALP?**
Any educator supporting a learner with structured needs — from a special education teacher in Virginia to an NGO programme manager in Accra. ALP adapts to your country's framework automatically.`},
};


// ═══════════════════════════════════════════════════════════
// ARTICLE CONTENT DATABASE
function ArticleModal({article,onClose}){
  if(!article)return null;
  const data=ARTICLES[article.title]||{tag:article.tag||"ARTICLE",time:article.time||"5 min read",color:"#7C3AED",body:"ALP is designed to help special educators build better learning plans, faster. This guide covers key concepts, practical strategies, and how to use the platform effectively.\n\n**Getting Started**\nStart with the student's Present Level of Performance, then build annual goals and choose appropriate services. ALP guides you through all 13 required sections step by step.\n\n**AI Tools**\nThe AI Goal Architect generates 3 SMART goal options from your baseline data. The Present Levels Coach helps write functional academic and developmental narratives.\n\n**Progress Monitoring**\nLog CBM probes weekly. ALP tracks trends and flags students who are falling behind. Use the 3-point rule to adjust goals and interventions based on real data.\n\n**Family Communication**\nAfter a plan is approved, export a professional ALP PDF from the Create ALP Doc page. Print, email, or share with parents through your school's standard process. Research shows family engagement is one of the strongest predictors of student success in special education."};
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:640,maxHeight:"88vh",overflowY:"auto",padding:0}}>
        <div style={{padding:"28px 32px 20px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
          <div>
            <span style={{fontSize:10,fontWeight:800,color:data.color,letterSpacing:".1em",textTransform:"uppercase"}}>{data.tag} · {data.time}</span>
            <h2 className="serif" style={{fontSize:"clamp(18px,3vw,24px)",fontWeight:700,color:C.black,marginTop:6,lineHeight:1.2,letterSpacing:"-.016em"}}>{article.title}</h2>
          </div>
          <button onClick={onClose} style={{fontSize:24,color:C.warm,background:"none",border:"none",cursor:"pointer",lineHeight:1,flexShrink:0}}>×</button>
        </div>
        <div style={{padding:"28px 32px"}}>
          {data.body.split("\n\n").map((para,i)=>(
            para.startsWith("**")&&para.endsWith("**")
              ?<h3 key={i} className="serif" style={{fontSize:16,fontWeight:700,color:C.black,margin:"24px 0 10px",letterSpacing:"-.012em"}}>{para.replace(/\*\*/g,"")}</h3>
              :para.startsWith("-")
                ?<ul key={i} style={{paddingLeft:20,margin:"8px 0"}}>{para.split("\n").filter(l=>l.startsWith("-")).map((l,j)=><li key={j} style={{fontSize:14,color:C.warm,lineHeight:1.7,marginBottom:4}}>{l.slice(2)}</li>)}</ul>
                :<p key={i} style={{fontSize:14,color:C.warm,lineHeight:1.8,marginBottom:0}}>{para}</p>
          ))}
          <div style={{marginTop:32,paddingTop:20,borderTop:`1px solid ${C.tanL}`,display:"flex",gap:12}}>
            <button className="btn-purple" onClick={onClose} style={{fontSize:12,padding:"11px 24px"}}>← Back to Resources</button>
            <button className="btn-ghost" style={{fontSize:12,padding:"11px 20px"}} onClick={()=>window.open("mailto:hello@growwithalp.com","_blank")}>Suggest a topic</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STUDENT DETAIL MODAL
// ═══════════════════════════════════════════════════════════

function StudentDetailModal({student,onClose,onOpenALP}){
  const {toast}=useToast();
  const [noteText,setNoteText]=useState(student?.notes||"");
  const [noteDraft,setNoteDraft]=useState("");
  const [editNote,setEditNote]=useState(false);
  if(!student)return null;
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto",padding:0}}>
        <div style={{padding:"24px 28px 18px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <Avatar name={student.name} size={48}/>
            <div>
              <h3 style={{fontSize:18,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>{student.name}</h3>
              <p style={{fontSize:12,color:C.warm,marginTop:2}}>Grade {student.grade} · {student.disability}</p>
            </div>
          </div>
          <button onClick={onClose} style={{fontSize:24,color:C.warm,background:"none",border:"none",cursor:"pointer"}} aria-label="Close">×</button>
        </div>
        <div style={{padding:"24px 28px"}}>
          {/* Status row */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
            {[["ALP Status",student.status||"Active","green"],["Goals",student.goals||"4","purple"],["Next Review",student.review||"Jun 2026","amber"]].map(([l,v,c])=>(
              <div key={l} style={{background:C.purpleL,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:10,fontWeight:700,color:C.warm,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>{l}</div>
                <div style={{fontSize:16,fontWeight:800,color:C[c]||C.purple}}>{v}</div>
              </div>
            ))}
          </div>
          {/* Info */}
          <div style={{marginBottom:20}}>
            <p className="lbl" style={{marginBottom:12}}>Student Information</p>
            {[["School",student.school_name||"Not set"],["Teacher",student.teacher_name||"Not assigned"],["Services",student.services||"Not recorded"],["Accommodations",student.accommodations?.length?student.accommodations.join(" · "):"Not recorded"],["Emergency Contact","See guardian contacts"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",gap:12,padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}>
                <span style={{fontSize:12,fontWeight:700,color:C.warm,width:140,flexShrink:0}}>{k}</span>
                <span style={{fontSize:13,color:C.black}}>{v}</span>
              </div>
            ))}
          </div>
          {/* Goal progress preview */}
          <p className="lbl" style={{marginBottom:12}}>Goal Progress</p>
          {[["Reading Fluency","65%",C.green],["Math Computation","42%",C.amber],["Written Expression","78%",C.purple],["Communication","55%",C.blue]].map(([g,pct,color])=>(
            <div key={g} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                <span style={{color:C.black,fontWeight:500}}>{g}</span>
                <span style={{color,fontWeight:700}}>{pct}</span>
              </div>
              <PBar value={parseInt(pct)} color={color}/>
            </div>
          ))}
          {/* Teacher notes */}
          <div style={{marginTop:20,padding:"14px 16px",border:`1px solid ${C.tanL}`,borderRadius:10,background:C.purpleL}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <p className="lbl" style={{margin:0}}>TEACHER NOTES</p>
              <button className="btn-ghost" style={{fontSize:9,padding:"3px 8px"}} onClick={()=>{setNoteDraft(noteText);setEditNote(e=>!e);}}>{editNote?"Cancel":"Edit"}</button>
            </div>
            {editNote?<div><textarea value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} style={{width:"100%",padding:"8px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:12,fontFamily:"'DM Sans',sans-serif",resize:"vertical",minHeight:64,outline:"none",lineHeight:1.6,boxSizing:"border-box"}}/><button className="btn-purple" onClick={()=>{setNoteText(noteDraft);setEditNote(false);toast("Note saved","success");}} style={{marginTop:6,fontSize:10,padding:"6px 14px"}}>Save</button></div>:<p style={{fontSize:12,color:C.warm,lineHeight:1.6,margin:0}}>{noteText}</p>}
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button className="btn-purple" onClick={()=>{onOpenALP&&onOpenALP();onClose();}} style={{flex:1,fontSize:12,padding:"12px"}}>Open Full ALP →</button>
            <button className="btn-ghost" style={{flex:1,fontSize:12,padding:"12px"}} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// INVITE USER MODAL
// ═══════════════════════════════════════════════════════════
function InviteUserModal({onClose}){
  const {toast}=useToast();
  const [email,setEmail]=useState("");
  const [role,setRole]=useState("teacher");
  const [school,setSchool]=useState("");
  const [sent,setSent]=useState(false);
  const [sending,setSending]=useState(false);
  const [bulk,setBulk]=useState("");
  const [tab,setTab]=useState("single");

  const roles=[
    {id:"teacher",label:"Teacher",icon:"👩‍🏫",desc:"Build ALPs, track goals, submit for review"},
    {id:"director",label:"Director / School Head",icon:"🏫",desc:"Review Queue, approvals, compliance oversight"},
    {id:"admin",label:"Administrator",icon:"📋",desc:"User management, system settings, security"},
    {id:"intervention",label:"Intervention Specialist",icon:"📊",desc:"RTI tiers, intervention plans, CBM data"},
    {id:"related",label:"Related Services",icon:"🗣",desc:"SLP, OT, PT — service session tracking"},
  ];

  const [sendErrors,setSendErrors]=useState([]);
  const {profile}=useSupabaseAuth();

  async function sendInvite(){
    setSendErrors([]);
    if(tab==="bulk"){
      const emails=bulk.split(/[\n,]/).map(e=>e.trim()).filter(Boolean);
      if(!emails.length){toast("Add at least one email address","error");return;}
      setSending(true);
      const results=await Promise.all(emails.map(em=>Supabase.inviteUser({email:em,role,school})));
      setSending(false);
      const failed=results.map((r,i)=>r.error?{email:emails[i],message:r.error.message}:null).filter(Boolean);
      const succeeded=results.length-failed.length;
      if(succeeded>0){setSent(true);toast(`${succeeded} of ${emails.length} invitation${emails.length!==1?"s":""} sent!`,succeeded===emails.length?"success":"info");}
      if(failed.length){setSendErrors(failed);if(succeeded===0)toast("All invitations failed — see details below","error");}
    } else {
      if(!email.includes("@")){toast("Enter a valid email address","error");return;}
      setSending(true);
      const r=await Supabase.inviteUser({email,role,school:school||profile?.school});
      setSending(false);
      if(r.error){toast(r.error.message||"Failed to send invite","error");setSendErrors([{email,message:r.error.message}]);return;}
      setSent(true);toast(`Invitation sent to ${email}`,"success");
    }
  }

  if(sent) return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:440,padding:"40px 32px",textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:"#DCFCE7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>✉️</div>
        <h3 className="serif" style={{fontSize:22,fontWeight:800,marginBottom:8}}>Invitation{tab==="bulk"?"s":""} Sent!</h3>
        <p style={{fontSize:13,color:C.warm,marginBottom:sendErrors.length?12:24}}>{tab==="bulk"?`Multiple invitations sent`:`Invite sent to ${email}`}. They'll receive a link to create their account.</p>
        {sendErrors.length>0&&(
          <div style={{textAlign:"left",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:20}}>
            <p style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:6}}>{sendErrors.length} did not send:</p>
            {sendErrors.map((e,i)=>(<p key={i} style={{fontSize:11,color:C.red,margin:"2px 0"}}>{e.email} — {e.message}</p>))}
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <button className="btn-ghost" onClick={()=>{setSent(false);setEmail("");setBulk("");setSendErrors([]);}} style={{flex:1,fontSize:12}}>Send Another</button>
          <button className="btn-purple" onClick={onClose} style={{flex:1,fontSize:12}}>Done</button>
        </div>
      </div>
    </div>
  );

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:500,padding:0}}>
        <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><p className="lbl" style={{color:C.purple,marginBottom:4}}>Team Management</p><h3 style={{fontSize:19,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>Invite User</h3></div>
          <button onClick={onClose} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}} aria-label="Close">×</button>
        </div>
        <div style={{padding:"22px 26px"}}>
          {/* Single / Bulk tabs */}
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[["single","Single invite"],["bulk","Bulk invite (CSV)"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} className={tab===id?"btn-black":"btn-ghost"} style={{fontSize:11,padding:"7px 14px"}}>{label}</button>
            ))}
          </div>

          {tab==="single"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <UInput label="Email Address *" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="teacher@school.edu"/>
              <UInput label="School" value={school} onChange={e=>setSchool(e.target.value)} placeholder="Enter school name"/>
              <div>
                <p className="lbl" style={{marginBottom:10}}>Role</p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {roles.map(r=>(
                    <label key={r.id} style={{display:"flex",gap:12,padding:"10px 12px",border:`1.5px solid ${role===r.id?C.purple:C.tanL}`,borderRadius:8,cursor:"pointer",background:role===r.id?C.purpleL:"transparent",transition:"all .15s"}} onClick={()=>setRole(r.id)}>
                      <span style={{fontSize:18}}>{r.icon}</span>
                      <div><div style={{fontSize:13,fontWeight:600,color:C.black}}>{r.label}</div><div style={{fontSize:11,color:C.warm}}>{r.desc}</div></div>
                      <div style={{marginLeft:"auto",width:18,height:18,borderRadius:"50%",border:`2px solid ${role===r.id?C.purple:C.tanL}`,background:role===r.id?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,alignSelf:"center"}}>
                        {role===r.id&&<div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==="bulk"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <UInput label="School" value={school} onChange={e=>setSchool(e.target.value)} placeholder="Enter school name"/>
              <USelect label="Role for all invitees" value={role} onChange={e=>setRole(e.target.value)}
                options={roles.map(r=>({value:r.id,label:`${r.icon} ${r.label}`}))}/>
              <div>
                <p className="lbl" style={{marginBottom:6}}>Email Addresses</p>
                <textarea value={bulk} onChange={e=>setBulk(e.target.value)} rows={5}
                  placeholder="teacher@school.edu&#10;slp@school.edu&#10;admin@school.edu&#10;(one per line or comma-separated)"
                  style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:12,fontFamily:"'DM Sans',sans-serif",resize:"vertical",outline:"none",color:C.black,boxSizing:"border-box",lineHeight:1.6}}/>
                {bulk&&<p style={{fontSize:11,color:C.warm,marginTop:4}}>{bulk.split(/[\n,]/).filter(e=>e.trim()).length} email{bulk.split(/[\n,]/).filter(e=>e.trim()).length!==1?"s":""} detected</p>}
              </div>
            </div>
          )}

          {sendErrors.length>0&&!sent&&(
            <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginTop:16}}>
              <p style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:4}}>Send failed:</p>
              {sendErrors.map((e,i)=>(<p key={i} style={{fontSize:11,color:C.red,margin:"2px 0"}}>{e.email} — {e.message}</p>))}
            </div>
          )}

          <div style={{display:"flex",gap:10,marginTop:20}}>
            <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
            <button className="btn-purple" onClick={sendInvite} disabled={sending} style={{flex:2,fontSize:12,padding:"13px"}}>
              {sending?<><Spin/>Sending…</>:`📧 Send Invitation${tab==="bulk"?"s":""} →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegalModal({type,onClose}){
  const isTerms=type==="terms";
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:640,maxHeight:"88vh",overflowY:"auto",padding:0}}>
        <div style={{padding:"24px 32px 18px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{fontSize:20,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>{isTerms?"Terms of Service":"Privacy Policy"}</h3>
          <button onClick={onClose} style={{fontSize:24,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:"24px 32px",fontSize:13,color:C.warm,lineHeight:1.8}}>
          <p style={{marginBottom:16,fontSize:11,color:C.warm}}>Last updated: May 2026 · ALP Platform Inc.</p>
          {isTerms?(<>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>1. Acceptance</h4>
            <p style={{marginBottom:12}}>By using the ALP Platform, you agree to these Terms. If you don't agree, don't use the platform. These terms apply to all users — teachers, administrators, families, and students.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>2. Account Responsibilities</h4>
            <p style={{marginBottom:12}}>You are responsible for keeping your login credentials secure. You must not share your account. You are responsible for all activity under your account.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>3. Acceptable Use</h4>
            <p style={{marginBottom:12}}>ALP is for legitimate educational use only. You may not use it to store false student data, violate student privacy, or circumvent privacy regulations.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>4. Data & Privacy</h4>
            <p style={{marginBottom:12}}>Student data is subject to privacy standards (USA), data privacy (EU/UK), and applicable national laws. We never sell student data. See our Privacy Policy for full details.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>5. Billing</h4>
            <p style={{marginBottom:12}}>Free plans are free forever. Paid plans are billed monthly or annually. You may cancel at any time. No refunds for partial months.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>6. Contact</h4>
            <p>Questions? Email <a href="mailto:legal@growwithalp.com" style={{color:C.purple}}>legal@growwithalp.com</a></p>
          </>):(<>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>What we collect</h4>
            <p style={{marginBottom:12}}>We collect account information (name, email, school), student records you enter, usage data, and device/browser data for security purposes.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>How we use it</h4>
            <p style={{marginBottom:12}}>We use your data to operate ALP, generate AI recommendations, send you notifications, and improve the platform. We never sell data or use student data to train AI models.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>privacy standards & data privacy Progress Review</h4>
            <p style={{marginBottom:12}}>ALP is secure for US schools and secure for EU/UK users. We act as a data processor on your behalf. You remain the data controller for all student records.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>Data storage</h4>
            <p style={{marginBottom:12}}>Data is stored on encrypted servers. EU/UK customers may request data residency in their region. All data is encrypted at rest and in transit.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>Your rights</h4>
            <p style={{marginBottom:12}}>You may request your data, correct it, or delete it at any time. Contact <a href="mailto:privacy@growwithalp.com" style={{color:C.purple}}>privacy@growwithalp.com</a>.</p>
            <h4 style={{color:C.black,fontWeight:700,marginBottom:8,marginTop:16}}>Cookies</h4>
            <p>We use essential cookies for authentication and analytics cookies (opt-in) to improve the platform. See our cookie banner for controls.</p>
          </>)}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════
const ToastCtx = createContext({toast:()=>{}});
function ToastProvider({children}){
  const [toasts,setToasts]=useState([]);
  function toast(msg,type="success",duration=3000){
    const id=Date.now();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.map(x=>x.id===id?{...x,hiding:true}:x)),duration-220);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),duration);
  }
  const icons={success:"✅",error:"❌",info:"ℹ️",warning:"⚠️"};
  const colors={success:{bg:"#DCFCE7",border:"#BBF7D0",text:"#166534"},error:{bg:"#FEE2E2",border:"#FECACA",text:"#991B1B"},info:{bg:"#DBEAFE",border:"#BFDBFE",text:"#1E40AF"},warning:{bg:"#FEF9C3",border:"#FDE68A",text:"#854D0E"}};
  return(
    <ToastCtx.Provider value={{toast}}>
      {children}
      <div className="toast-container">
        {toasts.map(t=>{
          const c=colors[t.type]||colors.success;
          return(
            <div key={t.id} className={`toast${t.hiding?" hiding":""}`} style={{background:c.bg,border:`1px solid ${c.border}`,color:c.text}}>
              <span>{icons[t.type]||"✅"}</span>
              <span style={{flex:1}}>{t.msg}</span>
              <button onClick={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",cursor:"pointer",color:c.text,fontSize:16,lineHeight:1,padding:0,opacity:.6}}>×</button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
function useToast(){return useContext(ToastCtx);}

// ═══════════════════════════════════════════════════════════
// ANIMATED METRIC COUNTER
// ═══════════════════════════════════════════════════════════
function AnimCounter({value,duration=800}){
  const [display,setDisplay]=useState(0);
  const numVal=parseFloat(String(value).replace(/[^0-9.]/g,""))||0;
  const suffix=String(value).replace(/[0-9.]/g,"");
  useEffect(()=>{
    let start=0;const steps=40;const inc=numVal/steps;
    const t=setInterval(()=>{
      start+=inc;
      if(start>=numVal){setDisplay(numVal);clearInterval(t);}
      else setDisplay(Math.floor(start));
    },duration/steps);
    return()=>clearInterval(t);
  },[numVal]);
  return <span className="counter-animate">{Number.isInteger(numVal)?display:display.toFixed(1)}{suffix}</span>;
}

// ═══════════════════════════════════════════════════════════
// GLOBAL SEARCH (Cmd+K)
// ═══════════════════════════════════════════════════════════
function GlobalSearch({onClose,setPage}){
  const {students:dbStudents}=useSupabaseAuth();
  const [q,setQ]=useState("");
  const results=[
    ...(dbStudents||[]).slice(0,5).map(s=>({icon:"👥",label:s.name,sub:`Grade ${s.grade||"–"} · ${s.disability||"ALP Student"}`,page:"students",category:"Students"})),
    {icon:"✏️",label:"ALP Builder",sub:"Create or edit Accelerated Learning Plans",page:"builder",category:"Pages"},
    {icon:"📈",label:"Progress Monitoring",sub:"CBM data, trendlines, goal tracking",page:"progress",category:"Pages"},
    {icon:"👁️",label:"Review Queue",sub:"Director review — approve or request changes",page:"reviewqueue",category:"Pages"},
    {icon:"📊",label:"Reports & Analytics",sub:"Progress review, audit trail, exports",page:"reports",category:"Pages"},
    {icon:"📋",label:"Compliance Dashboard",sub:"Completion rates, overdue reviews, plan status",page:"compliance",category:"Pages"},
    {icon:"🔍",label:"Audit Log",sub:"Full record of all changes, who made them and when",page:"auditlog",category:"Pages"},
    {icon:"⚙️",label:"Settings",sub:"Profile, school, users, security",page:"settings",category:"Pages"},
    {icon:"🔔",label:"Notifications",sub:"Alerts, deadlines, review requests",page:"notifications",category:"Pages"},
    {icon:"🎯",label:"Future Readiness",sub:"Transition goals, career planning",page:"future",category:"Pages"},
    {icon:"🎯",label:"Goals Tracker",sub:"All active goals, progress, status across caseload",page:"goals",category:"Pages"},
    {icon:"📁",label:"Documents",sub:"Upload, manage and share student files and reports",page:"documents",category:"Pages"},
    {icon:"🕐",label:"Student Timeline",sub:"Full activity history for any student",page:"timeline",category:"Pages"},
    {icon:"❓",label:"Help Center",sub:"Documentation, FAQs, guides, contact support",page:"help",category:"Pages"},
    {icon:"✨",label:"What's New",sub:"Changelog, release notes, version history",page:"changelog",category:"Pages"},
    {icon:"📝",label:"New Session Note",sub:"Log a quick observation or CBM score",page:"progress",category:"Actions"},
    {icon:"📄",label:"Generate ALP PDF",sub:"Export a professional ALP document for printing or sharing",page:"create",category:"Actions"},
    {icon:"📤",label:"Export All Data",sub:"Download student records, plans, progress",page:"documents",category:"Actions"},
    {icon:"➕",label:"Add New Student",sub:"Create a student profile and start their ALP",page:"students",category:"Actions"},
    {icon:"🎉",label:"Onboarding Guide",sub:"Setup guide for new users",action:()=>setShowOnboarding&&setShowOnboarding(true),category:"Actions"},
  ].filter(r=>!q||r.label.toLowerCase().includes(q.toLowerCase())||r.sub.toLowerCase().includes(q.toLowerCase()));

  useEffect(()=>{
    function handler(e){if(e.key==="Escape")onClose();}
    try{window.addEventListener("keydown",handler);}catch{}
    return()=>{try{window.removeEventListener("keydown",handler);}catch{}};
  },[]);

  const grouped=results.reduce((acc,r)=>{
    if(!acc[r.category])acc[r.category]=[];
    acc[r.category].push(r);
    return acc;
  },{});

  return(
    <div className="search-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="search-box">
        <div style={{display:"flex",alignItems:"center",padding:"0 20px",borderBottom:"1px solid var(--border)"}}>
          <span style={{fontSize:18,marginRight:10,color:"var(--text-muted)"}}>🔍</span>
          <input autoFocus className="search-input" placeholder="Search students, pages, tools…" value={q} onChange={e=>setQ(e.target.value)}/>
          <kbd style={{fontSize:10,padding:"3px 7px",borderRadius:5,background:"var(--bg-surface)",color:"var(--text-muted)",border:"1px solid var(--border)",fontFamily:"monospace",flexShrink:0}}>ESC</kbd>
        </div>
        <div style={{maxHeight:380,overflowY:"auto"}}>
          {Object.entries(grouped).map(([cat,items])=>(
            <div key={cat}>
              <div style={{padding:"10px 20px 4px",fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--text-muted)"}}>{cat}</div>
              {items.map(r=>(
                <div key={r.label} className="search-result" onClick={()=>{setPage(r.page);onClose();}}>
                  <span style={{fontSize:20,width:28,flexShrink:0}}>{r.icon}</span>
                  <div><div style={{fontSize:13.5,fontWeight:600,color:"var(--text-primary)"}}>{r.label}</div><div style={{fontSize:11.5,color:"var(--text-muted)",marginTop:2}}>{r.sub}</div></div>
                  <span style={{marginLeft:"auto",fontSize:11,color:"var(--text-muted)"}}>↵</span>
                </div>
              ))}
            </div>
          ))}
          {results.length===0&&<div style={{padding:"28px 20px",textAlign:"center",color:"var(--text-muted)",fontSize:13}}>No results for "{q}"</div>}
        </div>
        <div style={{padding:"10px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:16,fontSize:11,color:"var(--text-muted)"}}>
          <span>↵ select</span><span>↑↓ navigate</span><span>ESC close</span><span>? shortcuts</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AI HELP CHAT WIDGET
// ═══════════════════════════════════════════════════════════
function AIChatWidget({onClose}){
  const {toast}=useToast();
  const [msgs,setMsgs]=useState([{role:"assistant",text:"Hi! I'm ALP AI — your special education assistant.\n\nI can help with:\n• Writing SMART goals from baseline data\n• Present level narratives\n• Intervention strategies\n• Explaining ALP sections\n• Answering planning questions\n\nWhat can I help you with today?"}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const scrollRef=useRef(null);

  const suggestions=[
    "Write a reading goal for a student at 52 wcpm targeting 80",
    "What should go in the Present Levels section?",
    "How do I write a behaviour intervention goal?",
    "Explain the difference between goals and objectives",
  ];

  useEffect(()=>{
    if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
  },[msgs]);

  async function send(text){
    const userMsg=text||input.trim();
    if(!userMsg||loading)return;
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:userMsg}]);
    setLoading(true);
    try{
      // Routed through the ai-assist Edge Function — see note above.
      const reply=await askAlpAi([
        ...msgs.map(m=>({role:m.role,content:m.text})),
        {role:"user",content:userMsg},
      ]);
      setMsgs(m=>[...m,{role:"assistant",text:reply}]);
    }catch(e){
      setMsgs(m=>[...m,{role:"assistant",
        text:e instanceof AiUnavailable ? e.message
          : "Connection issue. Check your internet and try again.",isError:true}]);
    }
    setLoading(false);
  }

  const w=expanded?520:360;
  const h=expanded?600:440;

  return(
    <div style={{position:"fixed",bottom:28,right:28,zIndex:195,width:w,height:h,display:"flex",flexDirection:"column",background:"var(--bg-secondary)",border:`1px solid ${C.border}`,borderRadius:18,boxShadow:"0 20px 60px rgba(0,0,0,.25)",overflow:"hidden",transition:"all .25s"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",padding:"14px 18px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>✦</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>ALP AI Assistant</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Ask about goals, plans, strategies</div>
        </div>
        <button onClick={()=>setExpanded(v=>!v)} style={{fontSize:14,color:"rgba(255,255,255,.5)",background:"none",border:"none",cursor:"pointer",padding:"2px 6px"}} title={expanded?"Collapse":"Expand"}>{expanded?"⊟":"⊞"}</button>
        <button onClick={onClose} style={{fontSize:18,color:"rgba(255,255,255,.5)",background:"none",border:"none",cursor:"pointer",lineHeight:1}}>×</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row"}}>
            {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginTop:2}}>✦</div>}
            <div style={{maxWidth:"85%",padding:"10px 13px",borderRadius:m.role==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px",background:m.role==="user"?C.purple:"var(--bg-tertiary,#f4f4f5)",color:m.role==="user"?"#fff":C.black,fontSize:12.5,lineHeight:1.65,whiteSpace:"pre-wrap"}}>
              {m.text}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>✦</div>
            <div style={{padding:"10px 13px",borderRadius:"14px 14px 14px 3px",background:"var(--bg-tertiary,#f4f4f5)"}}>
              <div style={{display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.purple,animation:`heroPulse 1.2s ${i*0.2}s ease-in-out infinite`}}/>)}</div>
            </div>
          </div>
        )}
        {/* Suggestions */}
        {msgs.length===1&&!loading&&(
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
            {suggestions.map(s=>(
              <button key={s} onClick={()=>send(s)}
                style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${C.tanL}`,background:"transparent",fontSize:11,color:C.black,cursor:"pointer",textAlign:"left",transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple;e.currentTarget.style.background=C.purpleL;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.background="transparent";}}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,flexShrink:0}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder="Ask about goals, plans, strategies…"
          disabled={loading}
          style={{flex:1,padding:"9px 12px",border:`1px solid ${C.tanL}`,borderRadius:10,fontSize:12,outline:"none",background:"var(--bg-primary)",color:C.black}}
        />
        <button onClick={()=>send()} disabled={loading||!input.trim()} className="btn-purple"
          style={{padding:"9px 16px",borderRadius:10,fontSize:12,flexShrink:0}}>
          {loading?<Spin/>:"→"}
        </button>
      </div>
    </div>
  );
}

function QuickAddStudentModal({onClose,onAdded}){
  const {toast}=useToast();
  const {createStudentRecord}=useSupabaseAuth();
  const {isMobile}=useResponsive();
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({
    name:"",dob:"",grade:"",disability:"",school:"",
    teacher:"",parent:"",parentEmail:"",parentPhone:"",
    services:"",notes:"",photo:""
  });
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

  async function submit(){
    if(!form.name?.trim()){toast("Student name is required","error");return;}
    if(form.name.trim().length < 2){toast("Please enter the student's full name","error");return;}
    if(!form.grade){toast("Please select a grade level","error");return;}
    if(!form.disability){toast("Please select a disability / area of need","error");return;}
    if(createStudentRecord){
      const {error}=await createStudentRecord({
        name:form.name.trim(), grade:form.grade, disability:form.disability,
        dob:form.dob||null, status:"Active", plan:"ALP",
        plan_date:new Date().toISOString().split("T")[0]
      });
      if(error&&typeof error==="object"&&error.message&&!error.message.includes("Demo")){
        toast("Could not save student — "+error.message,"error"); return;
      }
    }
    toast(form.name.trim()+" added to your caseload!","success");
    onAdded&&onAdded();
    onClose();
  }

  const disabilities=["Autism Spectrum Disorder","Specific Learning Disability","Speech-Language Impairment","Intellectual Disability","ADHD","Emotional Behavioural Disorder","Physical Disability","Hearing Impairment","Visual Impairment","Traumatic Brain Injury","Other Health Impairment","Multiple Disabilities"];
  const grades=["Pre-K","Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"];
  const services=["Speech-Language Therapy","Occupational Therapy","Physical Therapy","Reading Specialist","Behaviour Intervention","Counselling","Resource Room","Inclusive Support"];

  const steps=[{n:1,label:"Student Info"},{n:2,label:"Family & Services"},{n:3,label:"Confirm"}];

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:500,padding:0}}>
        {/* Header */}
        <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p className="lbl" style={{color:C.purple,marginBottom:4}}>New Student</p>
            <h3 style={{fontSize:19,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>Add to Caseload</h3>
          </div>
          <button onClick={onClose} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}} aria-label="Close">×</button>
        </div>

        {/* Step indicators */}
        <div style={{display:"flex",padding:"14px 26px",gap:0,borderBottom:`1px solid ${C.tanL}`}}>
          {steps.map((st,i)=>(
            <div key={st.n} style={{flex:1,display:"flex",alignItems:"center",gap:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:step>=st.n?C.purple:C.tanL,color:step>=st.n?"#fff":C.warm,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0,transition:"all .3s"}}>
                  {step>st.n?"✓":st.n}
                </div>
                <span style={{fontSize:11,fontWeight:600,color:step>=st.n?C.black:C.warm}}>{st.label}</span>
              </div>
              {i<steps.length-1&&<div style={{flex:1,height:2,background:step>st.n?C.purple:C.tanL,margin:"0 8px",transition:"all .3s"}}/>}
            </div>
          ))}
        </div>

        <div style={{padding:"22px 26px"}}>
          {/* Step 1: Student info */}
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <UInput label="Full Name *" value={form.name} onChange={e=>setF("name",e.target.value)} placeholder="e.g. Marcus Darnell Johnson"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <USelect label="Grade *" value={form.grade} onChange={e=>setF("grade",e.target.value)} options={grades.map(g=>({value:g,label:g}))}/>
                <UInput label="Date of Birth" value={form.dob} onChange={e=>setF("dob",e.target.value)} type="date"/>
              </div>
              <USelect label="Primary Disability *" value={form.disability} onChange={e=>setF("disability",e.target.value)} options={disabilities.map(d=>({value:d,label:d}))}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <UInput label="School" value={form.school} onChange={e=>setF("school",e.target.value)}/>
                <USelect label="Assigned Teacher" value={form.teacher} onChange={e=>setF("teacher",e.target.value)} options={["Teacher 1","Teacher 2","Teacher 3","Teacher 4","Teacher 5"].map(t=>({value:t,label:t}))}/>
              </div>
              <UTextarea label="Initial Notes (optional)" value={form.notes} onChange={e=>setF("notes",e.target.value)} rows={2} placeholder="Anything relevant for the team…"/>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
                <button className="btn-purple" onClick={()=>setStep(2)} disabled={!form.name||!form.grade||!form.disability} style={{flex:2,fontSize:12,padding:"13px"}}>Next: Family Info →</button>
              </div>
            </div>
          )}

          {/* Step 2: Family & Services */}
          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:C.purpleL,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.warm,marginBottom:4}}>
                👤 Student: <b style={{color:C.black}}>{form.name}</b> · {form.grade} · {form.disability}
              </div>
              <UInput label="Parent/Guardian Name" value={form.parent} onChange={e=>setF("parent",e.target.value)} placeholder="Parent or guardian full name"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <UInput label="Parent Email" value={form.parentEmail} onChange={e=>setF("parentEmail",e.target.value)} type="email"/>
                <UInput label="Parent Phone" value={form.parentPhone} onChange={e=>setF("parentPhone",e.target.value)} placeholder="+1 (703) 555-0199"/>
              </div>
              <div>
                <p className="lbl" style={{marginBottom:10}}>Related Services Needed</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {services.map(sv=>(
                    <label key={sv} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer",padding:"6px 8px",borderRadius:6,border:`1px solid ${form.services.includes(sv)?C.purple:C.tanL}`,background:form.services.includes(sv)?C.purpleL:"transparent",transition:"all .15s"}}>
                      <input type="checkbox" checked={form.services.includes(sv)} onChange={()=>setF("services",form.services.includes(sv)?form.services.replace(sv,"").replace(",,",",").replace(/^,|,$/,""):form.services?form.services+","+sv:sv)} style={{accentColor:C.purple,width:13,height:13}}/>
                      <span style={{color:form.services.includes(sv)?C.purple:C.warm}}>{sv}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button className="btn-ghost" onClick={()=>setStep(1)} style={{flex:1,fontSize:12}}>← Back</button>
                <button className="btn-purple" onClick={()=>setStep(3)} style={{flex:2,fontSize:12,padding:"13px"}}>Review & Confirm →</button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step===3&&(
            <div>
              <div style={{background:C.purpleL,borderRadius:12,padding:"18px",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                  <Avatar name={form.name} size={48}/>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:C.black}}>{form.name}</div>
                    <div style={{fontSize:12,color:C.warm}}>{form.grade} · {form.disability}</div>
                  </div>
                </div>
                {[[form.school,"School"],[form.teacher,"Teacher"],[form.parent||"—","Parent"],[form.parentEmail||"—","Email"],[form.services?form.services.split(",").length+" services":"None","Services"]].map(([val,label])=>(
                  <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:`1px solid ${C.tanL}`}}>
                    <span style={{color:C.warm}}>{label}</span>
                    <span style={{fontWeight:600,color:C.black,textAlign:"right",maxWidth:200}}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"#DCFCE7",borderRadius:10,padding:"10px 14px",fontSize:12,color:C.green,fontWeight:600,marginBottom:16}}>
                ✓ After adding, you'll be taken to the ALP Builder to create their learning plan.
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="btn-ghost" onClick={()=>setStep(2)} style={{flex:1,fontSize:12}}>← Back</button>
                <button className="btn-purple" onClick={submit} style={{flex:2,fontSize:12,padding:"13px"}}>✓ Add Student & Start ALP →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MeetingSchedulerModal({onClose}){
  const {toast}=useToast();
  const {students:dbStudents}=useSupabaseAuth();
  const [form,setForm]=useState({
    family:"",student:"",type:"Annual Review",
    date:"",time:"14:00",duration:"60",format:"virtual",
    link:"",location:"",attendees:["teacher","parent"],notes:""
  });
  const [step,setStep]=useState("form");
  const [sending,setSending]=useState(false);
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

  const meetingTypes=["Annual Review","Progress Check","Goal Review","Initial Evaluation","Re-evaluation","Team Meeting","Parent Conference","Transition Planning"];
  const timeSlots=["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30"];
  const families=(dbStudents||[]).map(s=>[s.id,`${s.name} — Family`]);

  function schedule(){
    setSending(true);
    setTimeout(()=>{setSending(false);setStep("done");},1200);
  }

  if(step==="done") return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:440,padding:0}}>
        <div style={{padding:"32px 28px",textAlign:"center"}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:"#DCFCE7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>📅</div>
          <h3 style={{fontSize:20,fontWeight:800,color:C.black,marginBottom:8}}>Meeting Scheduled!</h3>
          <p style={{fontSize:14,color:C.warm,marginBottom:4}}>{form.type} · {form.date} at {form.time}</p>
          <p style={{fontSize:13,color:C.warm,marginBottom:4}}>{form.format==="virtual"?"Virtual (Google Meet / Teams)":form.location||"In Person"}</p>
          <p style={{fontSize:12,color:C.warm,marginBottom:24}}>Calendar invites sent to all attendees</p>
          <div style={{display:"flex",gap:10}}>
            <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Close</button>
            <button className="btn-purple" onClick={()=>{toast("Reminder set for 24h before meeting","success");onClose();}} style={{flex:2,fontSize:12}}>Set Reminder →</button>
          </div>
        </div>
      </div>
    </div>
  );

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:520,padding:0}}>
        <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><p className="lbl" style={{color:C.purple,marginBottom:4}}>Scheduling</p><h3 style={{fontSize:19,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>Schedule Meeting</h3></div>
          <button onClick={onClose} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}} aria-label="Close">×</button>
        </div>
        <div style={{padding:"22px 26px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <USelect label="Student" value={form.family} onChange={e=>{setF("family",e.target.value);setF("student",(families.find(f=>f[0]===e.target.value)||["",""])[1].split(" — ")[0]||"");}} options={families.map(([v,l])=>({value:v,label:l.split(" — ")[0]}))}/>
            <USelect label="Meeting Type" value={form.type} onChange={e=>setF("type",e.target.value)} options={meetingTypes.map(t=>({value:t,label:t}))}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <UInput label="Date" value={form.date} onChange={e=>setF("date",e.target.value)} type="date"/>
            <USelect label="Time" value={form.time} onChange={e=>setF("time",e.target.value)} options={timeSlots.map(t=>({value:t,label:t}))}/>
            <USelect label="Duration" value={form.duration} onChange={e=>setF("duration",e.target.value)} options={["30","45","60","90","120"].map(d=>({value:d,label:d+" min"}))}/>
          </div>
          <div>
            <p className="lbl" style={{marginBottom:10}}>Format</p>
            <div style={{display:"flex",gap:8}}>
              {[["virtual","🖥 Virtual"],["in-person","🏫 In-Person"],["hybrid","🔀 Hybrid"]].map(([v,l])=>(
                <button key={v} onClick={()=>setF("format",v)} style={{flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${form.format===v?C.purple:C.tanL}`,background:form.format===v?C.purpleL:"transparent",color:form.format===v?C.purple:C.warm,fontWeight:form.format===v?700:400,fontSize:12,cursor:"pointer",transition:"all .15s"}}>{l}</button>
              ))}
            </div>
          </div>
          {form.format==="virtual"&&<UInput label="Meeting Link (optional)" value={form.link} onChange={e=>setF("link",e.target.value)} placeholder="https://meet.google.com/..."/>}
          {form.format!=="virtual"&&<UInput label="Location / Room" value={form.location} onChange={e=>setF("location",e.target.value)} placeholder="e.g. Room 204, Main Office"/>}
          <div>
            <p className="lbl" style={{marginBottom:10}}>Attendees</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["teacher","👩‍🏫 Teacher"],["parent","👨‍👩‍👧 Parent"],["admin","🏫 Admin"],["slp","🗣 SLP"],["ot","✋ OT"],["counselor","💙 Counsellor"]].map(([v,l])=>(
                <button key={v} onClick={()=>setF("attendees",form.attendees.includes(v)?form.attendees.filter(a=>a!==v):[...form.attendees,v])}
                  style={{padding:"6px 12px",borderRadius:99,border:`1.5px solid ${form.attendees.includes(v)?C.purple:C.tanL}`,background:form.attendees.includes(v)?C.purpleL:"transparent",color:form.attendees.includes(v)?C.purple:C.warm,fontSize:11,cursor:"pointer",fontWeight:form.attendees.includes(v)?700:400,transition:"all .15s"}}>{l}</button>
              ))}
            </div>
          </div>
          <UTextarea label="Agenda / Notes (optional)" value={form.notes} onChange={e=>setF("notes",e.target.value)} rows={2} placeholder="Topics to cover, documents to review…"/>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
            <button className="btn-purple" onClick={schedule} disabled={sending||!form.date||!form.time} style={{flex:2,fontSize:12,padding:"13px"}}>
              {sending?<><Spin/>Sending invites…</>:"📅 Schedule & Send Invites →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogDataModal({onClose,student,domain}){
  const {toast}=useToast();
  const [score,setScore]=useState("");
  const [date,setDate]=useState(new Date().toISOString().split("T")[0]);
  const [notes,setNotes]=useState("");
  const [condition,setCondition]=useState("standard");
  const [loading,setLoading]=useState(false);
  function submit(){
    if(!score)return;
    setLoading(true);
    setTimeout(()=>{
      setLoading(false);
      toast(`Data point logged — ${score} ${domain==="Reading"?"wcpm":"%"} for ${student}`,"success");
      onClose();
    },700);
  }
  const hints={Reading:"Words correct per minute (wcpm) from a 1-min oral reading probe",Math:"Digits correct per minute or % accuracy on math computation probe","Communication":"% of opportunities with target behaviour observed","Social-Emotional":"% of observed sessions with successful self-regulation"};
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:460,padding:0}}>
        <div style={{padding:"22px 28px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p className="lbl" style={{color:C.purple,marginBottom:4}}>Progress Monitoring</p>
            <h3 style={{fontSize:19,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>Log CBM Data Point</h3>
          </div>
          <button onClick={onClose} style={{fontSize:24,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:"22px 28px"}}>
          <div style={{background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:10,padding:"10px 14px",marginBottom:20,fontSize:12,color:C.warm}}>
            📊 {hints[domain]||"Enter the probe score for this session."}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:18,marginBottom:22}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <span className="lbl" style={{fontSize:9,display:"block",marginBottom:6}}>Score ({domain==="Reading"?"wcpm":"%"})</span>
                <input className="u-input" type="number" value={score} onChange={e=>setScore(e.target.value)} placeholder={domain==="Reading"?"e.g. 72":"e.g. 78"} style={{fontSize:22,fontWeight:700,textAlign:"center"}}/>
              </div>
              <UInput label="Date of Probe" value={date} onChange={e=>setDate(e.target.value)} type="date"/>
            </div>
            <USelect label="Probe Condition" value={condition} onChange={e=>setCondition(e.target.value)} options={[{value:"standard",label:"Standard conditions"},{value:"prompt",label:"With verbal prompt"},{value:"visual",label:"With visual support"},{value:"modified",label:"Modified probe"},{value:"absent",label:"Student absent — no data"}]}/>
            <UTextarea label="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Observations, conditions, next steps…"/>
          </div>
          {score&&(
            <div style={{background:parseInt(score)>=75?"#DCFCE7":parseInt(score)>=60?"#FEF9C3":"#FEE2E2",border:`1px solid ${parseInt(score)>=75?C.greenBd:parseInt(score)>=60?C.amberBd:C.redBd}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12}}>
              <b style={{color:parseInt(score)>=75?C.green:parseInt(score)>=60?C.amber:C.red}}>
                {parseInt(score)>=75?"✓ On track — great progress!":parseInt(score)>=60?"→ Developing — monitor closely":"⚠️ Below target — consider intervention adjustment"}
              </b>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
            <button className="btn-purple" onClick={submit} disabled={loading||!score} style={{flex:2,fontSize:12,padding:"13px"}}>
              {loading?<><Spin/>Saving…</>:"Log Data Point →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// REPORT GENERATION MODAL
// ═══════════════════════════════════════════════════════════
function ReportGenerationModal({report,onClose}){
  const {toast}=useToast();
  const {students:dbStudents}=useSupabaseAuth();
  const [step,setStep]=useState("config"); // config → generating → done
  const [format,setFormat]=useState("PDF");
  const [student,setStudent]=useState(dbStudents?.[0]?.name||"");
  const [includeCharts,setIncludeCharts]=useState(true);
  const [includeSignatures,setIncludeSignatures]=useState(true);
  const [progress,setProgress]=useState(0);

  function generate(){
    setStep("generating");
    let p=0;
    const t=setInterval(()=>{
      p+=Math.random()*18+8;
      if(p>=100){clearInterval(t);setProgress(100);setTimeout(()=>setStep("done"),400);}
      else setProgress(Math.min(p,95));
    },180);
  }

  const steps_gen=["Gathering student data…","Compiling ALP sections…","Generating progress check…","Building charts & graphs…","Applying formatting…","Finalising document…"];
  const stepIdx=Math.floor(progress/18);

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&step==="config"&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:500,padding:0}}>
        <div style={{padding:"22px 28px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p className="lbl" style={{color:C.purple,marginBottom:4}}>Report Generator</p>
            <h3 style={{fontSize:19,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>{report?.label||"Export Report"}</h3>
          </div>
          {step==="config"&&<button onClick={onClose} style={{fontSize:24,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>×</button>}
        </div>
        {step==="config"&&(
          <div style={{padding:"22px 28px"}}>
            <div style={{display:"flex",flexDirection:"column",gap:18,marginBottom:24}}>
              <USelect label="Student" value={student} onChange={e=>setStudent(e.target.value)} options={(dbStudents||[]).map(s=>({value:s.name,label:s.name})).concat([{value:"all",label:"All Students — Class Report"}])}/>
              <div>
                <p className="lbl" style={{marginBottom:10}}>Format</p>
                <div style={{display:"flex",gap:8}}>
                  {(report?.formats||["PDF","Excel"]).map(f=>(
                    <button key={f} onClick={()=>setFormat(f)} style={{padding:"8px 20px",borderRadius:99,border:`1.5px solid ${format===f?C.purple:C.tanL}`,background:format===f?C.purple+"14":"transparent",color:format===f?C.purple:C.warm,fontWeight:format===f?700:400,fontSize:12,cursor:"pointer",transition:"all .15s"}}>{f}</button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[[includeCharts,setIncludeCharts,"Include charts & graphs"],[includeSignatures,setIncludeSignatures,"Include signature history"]].map(([val,set,label])=>(
                  <label key={label} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,color:C.black}}>
                    <div onClick={()=>set(v=>!v)} style={{width:20,height:20,borderRadius:5,border:`2px solid ${val?C.purple:C.tanL}`,background:val?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",flexShrink:0}}>
                      {val&&<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
                    </div>
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{background:C.purpleL,borderRadius:10,padding:"10px 14px",marginBottom:20,fontSize:12,color:C.warm}}>
              ⏱ Estimated time: {report?.time||"~15 sec"} · Format: {format} · Student: {student}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
              <button className="btn-purple" onClick={generate} style={{flex:2,fontSize:12,padding:"13px"}}>📄 Generate Report →</button>
            </div>
          </div>
        )}
        {step==="generating"&&(
          <div style={{padding:"36px 28px",textAlign:"center"}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED22,#A855F722)",border:`3px solid ${C.purple}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 20px",position:"relative"}}>
              <Spin color={C.purple}/>
            </div>
            <h3 style={{fontSize:17,fontWeight:700,color:C.black,marginBottom:8}}>Generating report…</h3>
            <p style={{fontSize:12,color:C.warm,marginBottom:24,minHeight:18}}>{steps_gen[Math.min(stepIdx,steps_gen.length-1)]}</p>
            <div style={{background:C.tanL,borderRadius:99,height:6,overflow:"hidden",marginBottom:10}}>
              <div style={{height:"100%",background:`linear-gradient(90deg,${C.purple},#A855F7)`,borderRadius:99,width:`${progress}%`,transition:"width .2s ease"}}/>
            </div>
            <p style={{fontSize:11,color:C.warm}}>{Math.round(progress)}% complete</p>
          </div>
        )}
        {step==="done"&&(
          <div style={{padding:"32px 28px",textAlign:"center"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:"#DCFCE7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 16px"}}>📄</div>
            <h3 style={{fontSize:18,fontWeight:800,color:C.black,marginBottom:6}}>Report Ready!</h3>
            <p style={{fontSize:13,color:C.warm,marginBottom:6}}>{student} — {report?.label||"Report"}</p>
            <p style={{fontSize:11,color:C.warm,marginBottom:28}}>Format: {format} · Generated {new Date().toLocaleDateString()}</p>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <button className="btn-purple" onClick={()=>{toast("Report downloaded successfully","success");onClose();}} style={{flex:2,fontSize:12,padding:"12px"}}>⬇ Download {format}</button>
              <button className="btn-ghost" onClick={()=>{toast("Report link copied","info");}} style={{flex:1,fontSize:12}}>Copy Link</button>
            </div>
            <button onClick={onClose} style={{fontSize:12,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HELP CENTER PAGE
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// SVG SPARKLINE CHART — for Progress Monitoring
// ═══════════════════════════════════════════════════════════
function SparklineChart({data,goal,color,width=400,height=160}){
  if(!data||data.length<2)return null;
  const vals=data.map(d=>d.score);
  const min=Math.min(...vals,0);
  const max=Math.max(...vals,goal||100)+5;
  const px=(v,total,size)=>((v-min)/(max-min))*(size-32)+16;
  const py=(v)=>height-16-((v-min)/(max-min))*(height-32);
  const pts=data.map((_,i)=>`${px(i,data.length,width)},${py(vals[i])}`).join(" ");
  const goalY=py(goal||75);
  return(
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{overflow:"visible"}}>
      {/* Goal line */}
      {goal&&<>
        <line x1={16} y1={goalY} x2={width-16} y2={goalY} stroke={color} strokeWidth={1} strokeDasharray="4 4" opacity={0.4}/>
        <text x={width-12} y={goalY-4} fontSize={9} fill={color} opacity={0.6} textAnchor="end">Goal: {goal}</text>
      </>}
      {/* Area fill */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
      {/* Gradient area */}
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`${px(0,data.length,width)},${height-16} ${pts} ${px(data.length-1,data.length,width)},${height-16}`} fill={`url(#grad-${color.replace('#','')})`}/>
      {/* Data points */}
      {data.map((d,i)=>(
        <g key={i}>
          <circle cx={px(i,data.length,width)} cy={py(vals[i])} r={4} fill={color} stroke="white" strokeWidth={1.5}/>
          <text x={px(i,data.length,width)} y={height-2} fontSize={8} fill="var(--text-muted)" textAnchor="middle">{d.label}</text>
        </g>
      ))}
      {/* Latest value */}
      <text x={px(data.length-1,data.length,width)} y={py(vals[vals.length-1])-10} fontSize={11} fontWeight="700" fill={color} textAnchor="middle">{vals[vals.length-1]}</text>
    </svg>
  );
}
function highlight(text,query){
  if(!query||!text)return text;
  const idx=text.toLowerCase().indexOf(query.toLowerCase());
  if(idx<0)return text;
  return <>{text.slice(0,idx)}<mark style={{background:"#FEF08A",borderRadius:2,padding:"0 1px"}}>{text.slice(idx,idx+query.length)}</mark>{text.slice(idx+query.length)}</>;
}

function HelpCenter(){
  const [search,setSearch]=useState("");
  const [openItem,setOpenItem]=useState(null);
  const extraCategories=[{label:"Progress & Data",icon:"📊",items:[
      {q:"How do I log CBM progress data?",a:"Go to Progress → click 'Log Data' → select student and domain → enter your probe score. Data is charted automatically. Aim to log data at least weekly for each goal."},
      {q:"What is the 3-point rule?",a:"If 3 consecutive data points fall below the goal line, you should consider intensifying the intervention. If 3 points are above, consider raising the goal. ALP will alert you when this threshold is reached."},
      {q:"Can I export progress reports?",a:"Yes. In Reports → Progress tab → click 'Export'. You can generate PDF or Excel summaries for individual students or your entire caseload."},
      {q:"How do I track multiple goals for one student?",a:"Each student can have up to 10 annual goals. Go to ALP Builder Section 3 to add goals. All goals appear in the Goals Tracker page and are tracked separately in Progress Monitoring."},
    ]},
    {label:"PDF & Sharing",icon:"📄",items:[
      {q:"How do I share an approved ALP with parents?",a:"Once an ALP is approved, go to Create ALP Doc, select the student, and click Export PDF. The PDF can be printed, emailed as an attachment, or shared via any secure file sharing tool your school uses."},
      {q:"How do parents confirm receipt of the ALP?",a:"Print two copies of the exported ALP PDF at the review meeting — one for the parent and one for the student file. The ALP Support Notice page generates a formal written notification you can send home as well."},
      {q:"What does the approved ALP PDF contain?",a:"The exported ALP PDF includes all 10 completed steps: student information, present levels, annual goals, accommodations, interventions, progress monitoring data, and the review sign-off with signatures."},
      {q:"How do I schedule an ALP review meeting?",a:"Use the ALP Support Notice (⚠️ in the sidebar) to generate and send a formal meeting notice to parents. Set the meeting date, time, and location — the notice can be printed or emailed directly from the platform."},
    ]},
    {label:"Account & Settings",icon:"⚙️",items:[
      {q:"How do I change my password?",a:"Go to Settings → Profile tab → scroll to Security section → enter your current password and new password → click Save. Passwords must be at least 8 characters."},
      {q:"Can I change the interface language?",a:"Yes. Settings → Profile → Language dropdown. Currently supports English, Spanish, French, Portuguese, Arabic, Twi, and Kiswahili."},
      {q:"How do I add a new team member?",a:"Go to Settings → Users & Roles → click 'Invite User'. Enter their email, select their role and school. They'll receive an invitation email with instructions to create their account."},
      {q:"How do I export all my data?",a:"Settings → click 'Export Data' in the header, or use the global shortcut ⌘E. Select the datasets you want, choose your format (CSV/JSON/Excel), and download the secure export."},
    ]}];
  const categories=[
    {icon:"🚀",title:"Getting Started",items:[
      {q:"How do I add my first student?",a:"Go to Students in the sidebar, then click '+ Add Student'. Enter the student's name, grade, and primary disability. You'll be taken straight to the ALP Builder to start their plan."},
      {q:"How do I build my first ALP?",a:"Click ALP Builder in the sidebar. The builder walks you through all 13 sections — student info, present levels, annual goals, services, accommodations, and more. ALP AI can write your goals for you: just click 'AI Goal Architect' in any goal section."},
      {q:"What's the difference between Free and Professional?",a:"Free gives you all 8 ALP AI tools forever, for up to 10 students. Professional ($9/mo) adds unlimited students, real-time progress monitoring, director approval workflow, compliance dashboard, audit log, version history, and priority support."},
    ]},
    {icon:"✏️",title:"ALP Builder",items:[
      {q:"How does the AI Goal Architect work?",a:"In any goal section, click 'AI Goal Architect'. Enter the student's baseline data and select the domain. Claude generates 3 SMART goal options — you select the ones you want and they're added to the ALP instantly."},
      {q:"Can I import a student from another system?",a:"Yes — go to Settings > School, then look for the CSV Import option. You can bulk-import students from PowerSchool, Infinite Campus, or any SIS that exports CSV. Contact support for help with your specific SIS."},
      {q:"How do I add accommodations?",a:"Section 9 of the ALP Builder is the Accommodations section. You can add, edit, and organise accommodations by type (instructional, environmental, assessment). They sync automatically to the ALP Student Snapshot."},
    ]},
    {icon:"📈",title:"Progress Monitoring",items:[
      {q:"How do I log CBM data?",a:"Go to Progress Monitoring, select the student and domain, then click 'Log Data'. Enter the probe score, date, and any observation notes. The chart updates automatically and ALP AI analyses the trend."},
      {q:"What does the 3-point rule mean?",a:"If 3 consecutive data points fall below the goal line, the system flags it as an alert and suggests an intervention change. If 3 consecutive points are above, it suggests raising the goal."},
      {q:"How often should I enter progress data?",a:"Best practice is weekly for reading and math CBM. Communication and social-emotional goals are typically logged monthly or after each session. ALP sends a reminder if no data has been entered in 30+ days."},
    ]},
    {icon:"📄",title:"PDF & Communication",items:[
      {q:"How do I document that a parent received the ALP?",a:"Use the ALP Support Notice page to generate a formal notice of meeting and plan placement. Print two copies — one for the parent and one for the student file. The ALP PDF export itself serves as the official plan document."},
      {q:"How do parents receive the completed ALP?",a:"After the ALP is approved, the teacher exports a professional PDF from the Create ALP Doc page. This PDF can be emailed, printed, or shared via the school's preferred method. Parents do not need an account."},

    ]},
    {icon:"✅",title:"Progress Review",items:[
      {q:"Which support frameworks does ALP support?",a:"ALP currently supports: USA, Support Plans, VDOE Virginia, Ghana, Nigeria, Kenya, UK, Australia NCCD, and Canada Provincial IEPs. More frameworks are added regularly."},
      {q:"How does progress checking work?",a:"Every time you save an ALP section, ALP checks it against the required elements for your school's configured framework. Missing elements appear as red flags. You can run a full progress check from Reports > Validation."},
      {q:"Is my data privacy standards/data privacy complete?",a:"Yes. ALP is fully secure for US schools and secure for EU/UK users. All data is encrypted at rest and in transit. We never sell or share student data. See Settings > Progress Review for your data residency options."},
    ]},
    {icon:"⚙️",title:"Account & Settings",items:[
      {q:"How do I invite a colleague?",a:"Go to Settings > Users & Roles, then click '+ Invite User'. Enter their email, select their role, and click Send. They'll receive a 72-hour invitation link."},
      {q:"How do I change my school's region setting?",a:"Go to Settings > School > Progress Review Framework. Select your framework from the dropdown. You can have multiple frameworks active at once for schools serving international students."},
      {q:"Can I export all my data?",a:"Yes — go to Reports > Reports tab and select 'District Summary Report' with CSV format. This exports all student records, plans, and progress data. You can also export individual ALPs as PDF or Word from the ALP Builder."},
    ]},
  ];

  const filtered=categories.map(c=>({...c,items:c.items.filter(i=>!search||i.q.toLowerCase().includes(search.toLowerCase())||i.a.toLowerCase().includes(search.toLowerCase()))})).filter(c=>c.items.length>0);

  return(
    <Page title={<>Help <span className="serif-italic" style={{fontSize:26}}>Center</span></>} subtitle="Documentation, guides, and support">
      {/* Search */}
      <div style={{maxWidth:560,margin:"0 auto 32px"}}>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:C.warm}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search help articles…" style={{width:"100%",padding:"14px 14px 14px 42px",borderRadius:12,border:`1.5px solid ${C.tanL}`,fontSize:14,background:C.white,color:C.black,outline:"none",fontFamily:"'DM Sans',sans-serif"}}
            onFocus={e=>e.target.style.borderColor=C.purple} onBlur={e=>e.target.style.borderColor=C.tanL}/>
        </div>
      </div>
      {/* Quick links */}
      {!search&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:32}}>
          {categories.map(c=>(
            <div key={c.title} style={{padding:"18px 16px",borderRadius:12,border:`1px solid ${C.tanL}`,background:C.white,textAlign:"center",cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple;e.currentTarget.style.background="#FAF8FF";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.background=C.white;}}>
              <div style={{fontSize:28,marginBottom:8}}>{c.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.black}}>{c.title}</div>
              <div style={{fontSize:11,color:C.warm,marginTop:3}}>{c.items.length} articles</div>
            </div>
          ))}
        </div>
      )}

      {/* Video tutorials */}
      {!search&&(
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <span style={{fontSize:20}}>🎬</span>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,color:C.black}}>Video Tutorials</h3>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
            {[
              {title:"Getting started (2 min)","duration":"2:14",icon:"🚀",tag:"Beginner"},
              {title:"Building your first ALP","duration":"5:32",icon:"✏️",tag:"Guide"},
              {title:"Using AI Goal Architect","duration":"3:45",icon:"✦",tag:"AI Tools"},
              {title:"Logging progress data","duration":"2:58",icon:"📊",tag:"Progress"},
              {title:"PDF Export & Sharing walkthrough","duration":"3:45",icon:"📄",tag:"Workflow"},
              {title:"Generating reports","duration":"3:22",icon:"📄",tag:"Reports"},
            ].map(v=>(
              <div key={v.title} className="card" style={{padding:"14px 16px",cursor:"pointer",transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple;e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.transform="none";}}
                onClick={()=>toast("Video tutorial opening…","info")}>
                <div style={{fontSize:24,marginBottom:8}}>{v.icon}</div>
                <div style={{fontSize:12,fontWeight:700,color:C.black,marginBottom:4,lineHeight:1.4}}>{v.title}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,color:C.warm}}>{v.duration}</span>
                  <span style={{fontSize:9,fontWeight:700,color:C.purple,background:C.purpleL,padding:"2px 7px",borderRadius:99}}>{v.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* FAQ accordion */}
      {filtered.map(cat=>(
        <div key={cat.title} style={{marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <span style={{fontSize:20}}>{cat.icon}</span>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,color:C.black}}>{cat.title}</h3>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {cat.items.map((item,i)=>(
              <div key={i} className="card" style={{padding:0,overflow:"hidden"}}>
                <div onClick={()=>setOpenItem(openItem===`${cat.title}-${i}`?null:`${cat.title}-${i}`)}
                  style={{padding:"16px 20px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                  <span style={{fontSize:14,fontWeight:600,color:C.black,lineHeight:1.4}}>{item.q}</span>
                  <span style={{fontSize:18,color:C.purple,flexShrink:0,transition:"transform .2s",display:"inline-block",transform:openItem===`${cat.title}-${i}`?"rotate(45deg)":"none"}}>+</span>
                </div>
                {openItem===`${cat.title}-${i}`&&(
                  <div style={{padding:"0 20px 18px",fontSize:13.5,color:C.warm,lineHeight:1.75,borderTop:`1px solid ${C.tanL}`}}>
                    <div style={{paddingTop:14}}>{item.a}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* Contact support */}
      <div style={{marginTop:16,padding:"28px 32px",background:"linear-gradient(135deg,#7C3AED11,#A855F711)",border:`1px solid ${C.border}`,borderRadius:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
        <div>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:4}}>Still need help?</h3>
          <p style={{fontSize:13,color:C.warm}}>Our team responds within 24 hours — Monday to Saturday.</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          <a href="mailto:support@growwithalp.com" className="btn-ghost" style={{fontSize:12,padding:"10px 20px",textDecoration:"none",display:"inline-flex",alignItems:"center"}}>✉️ Email Support</a>
          <a href="mailto:hello@growwithalp.com?subject=Demo Request" className="btn-purple" style={{fontSize:12,padding:"10px 20px",textDecoration:"none",display:"inline-flex",alignItems:"center"}}>📅 Book a Demo</a>
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// COOKIE CONSENT BANNER
// ═══════════════════════════════════════════════════════════

function CookieBanner(){
  const [show,setShow]=useState(false);
  const [showDetail,setShowDetail]=useState(false);
  useEffect(()=>{
    try{if(!localStorage.getItem("alp-cookie-choice"))setShow(true);}catch{setShow(true);}
  },[]);
  function accept(type){
    try{localStorage.setItem("alp-cookie-choice",type);}catch{}
    setShow(false);
  }
  if(!show)return null;
  return(
    <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:9998,width:"min(640px,calc(100vw-32px))"}}>
      <div style={{background:"#1a1a2e",borderRadius:16,padding:"20px 24px",boxShadow:"0 8px 40px rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.08)"}}>
        {!showDetail&&(
          <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}>
              <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 4px"}}>🍪 We use cookies</p>
              <p style={{fontSize:12,color:"rgba(255,255,255,.5)",margin:0}}>Essential cookies keep you logged in. That is all we need.{" "}
                <button onClick={()=>setShowDetail(true)} style={{color:"#A78BFA",background:"none",border:"none",cursor:"pointer",fontSize:12,padding:0,textDecoration:"underline"}}>See details</button>
              </p>
            </div>
            <div style={{display:"flex",gap:8,flexShrink:0}}>
              <button onClick={()=>accept("essential")} style={{padding:"8px 16px",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,color:"rgba(255,255,255,.7)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>Essential only</button>
              <button onClick={()=>accept("all")} style={{padding:"8px 16px",background:"#7C3AED",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Accept all</button>
            </div>
          </div>
        )}
        {showDetail&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>Cookie preferences</p>
              <button onClick={()=>setShowDetail(false)} style={{fontSize:18,color:"rgba(255,255,255,.4)",background:"none",border:"none",cursor:"pointer"}}>×</button>
            </div>
            {[
              {name:"Essential",desc:"Required for login sessions. Cannot be disabled.",required:true},
              {name:"Preferences",desc:"Remember your theme and settings between sessions.",required:false},
            ].map(c=>(
              <div key={c.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                <div>
                  <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 2px"}}>{c.name}</p>
                  <p style={{fontSize:11,color:"rgba(255,255,255,.4)",margin:0}}>{c.desc}</p>
                </div>
                <span style={{fontSize:11,color:c.required?"#10B981":"rgba(255,255,255,.4)",fontWeight:600}}>{c.required?"Always on":"Optional"}</span>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={()=>accept("essential")} style={{flex:1,padding:"10px",background:"rgba(255,255,255,.08)",border:"none",borderRadius:8,color:"rgba(255,255,255,.7)",fontSize:12,cursor:"pointer"}}>Essential only</button>
              <button onClick={()=>accept("all")} style={{flex:1,padding:"10px",background:"#7C3AED",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Accept all</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ForgotPasswordModal({onClose}){
  const {toast}=useToast();
  const [step,setStep]=useState("email"); // email → sent → verify → done
  const [email,setEmail]=useState("");
  const [code,setCode]=useState(["","","","","",""]);
  const [newPw,setNewPw]=useState("");
  const [sending,setSending]=useState(false);

  function sendCode(){
    if(!email.includes("@")){toast("Enter a valid email address","error");return;}
    setSending(true);
    setTimeout(()=>{setSending(false);setStep("sent");},1000);
  }

  function verify(){
    const entered=code.join("");
    if(entered.length<6){toast("Enter the 6-digit code","error");return;}
    setStep("reset");
  }

  function resetPw(){
    if(newPw.length<8){toast("Password must be at least 8 characters","error");return;}
    setSending(true);
    setTimeout(()=>{setSending(false);setStep("done");toast("Password updated successfully!","success");},800);
  }

  function handleCodeInput(i,val){
    if(!/^[0-9]*$/.test(val))return;
    const next=[...code];
    next[i]=val.slice(-1);
    setCode(next);
    if(val&&i<5){
      const inputs=document.querySelectorAll(".code-input");
      if(inputs[i+1])inputs[i+1].focus();
    }
  }

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:420,padding:0}}>
        <div style={{padding:"22px 26px 18px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p className="lbl" style={{color:C.purple,marginBottom:3}}>Account Security</p>
            <h3 style={{fontSize:19,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>
              {step==="email"&&"Reset Password"}
              {step==="sent"&&"Check Your Email"}
              {step==="reset"&&"New Password"}
              {step==="done"&&"Password Updated!"}
            </h3>
          </div>
          <button onClick={onClose} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}} aria-label="Close">×</button>
        </div>
        <div style={{padding:"24px 26px"}}>
          {step==="email"&&(
            <div>
              <p style={{fontSize:13,color:C.warm,lineHeight:1.6,marginBottom:20}}>Enter the email address linked to your account. We'll send a 6-digit verification code.</p>
              <UInput label="Email Address" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="your@school.edu"/>
              <div style={{display:"flex",gap:10,marginTop:20}}>
                <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
                <button className="btn-purple" onClick={sendCode} disabled={sending} style={{flex:2,fontSize:12,padding:"13px"}}>
                  {sending?<><Spin/>Sending…</>:"Send Code →"}
                </button>
              </div>
            </div>
          )}
          {step==="sent"&&(
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:16}}>📧</div>
              <p style={{fontSize:14,color:C.black,fontWeight:600,marginBottom:8}}>Code sent to {email}</p>
              <p style={{fontSize:13,color:C.warm,lineHeight:1.6,marginBottom:24}}>Check your inbox for a 6-digit code. It expires in 10 minutes.</p>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:20}}>
                {code.map((c,i)=>(
                  <input key={i} className="code-input" value={c} onChange={e=>handleCodeInput(i,e.target.value)}
                    maxLength={1} style={{width:44,height:52,textAlign:"center",fontSize:20,fontWeight:700,border:`2px solid ${c?C.purple:C.tanL}`,borderRadius:10,outline:"none",color:C.black,background:c?C.purpleL:"transparent"}}/>
                ))}
              </div>
              <button className="btn-purple" onClick={verify} style={{width:"100%",fontSize:12,padding:"13px",marginBottom:10}}>Verify Code →</button>
              <button onClick={sendCode} style={{fontSize:11,color:C.purple,background:"none",border:"none",cursor:"pointer"}}>Resend code</button>
            </div>
          )}
          {step==="reset"&&(
            <div>
              <div style={{background:C.purpleL,borderRadius:10,padding:"10px 14px",marginBottom:18,fontSize:12,color:C.warm}}>✓ Code verified for <b style={{color:C.black}}>{email}</b></div>
              <UInput label="New Password" value={newPw} onChange={e=>setNewPw(e.target.value)} type="password" placeholder="At least 8 characters"/>
              <div style={{margin:"8px 0 20px",display:"flex",gap:6}}>
                {["length","upper","number"].map((check,i)=>{
                  const met=check==="length"?newPw.length>=8:check==="upper"?/[A-Z]/.test(newPw):/[0-9]/.test(newPw);
                  return <span key={i} style={{fontSize:10,padding:"2px 8px",borderRadius:99,background:met?"#DCFCE7":"#F3F4F6",color:met?C.green:C.warm,fontWeight:600}}>{["8+ chars","Uppercase","Number"][i]}</span>;
                })}
              </div>
              <button className="btn-purple" onClick={resetPw} disabled={sending||newPw.length<8} style={{width:"100%",fontSize:12,padding:"13px"}}>
                {sending?<><Spin/>Updating…</>:"Update Password →"}
              </button>
            </div>
          )}
          {step==="done"&&(
            <div style={{textAlign:"center",padding:"8px 0"}}>
              <div style={{fontSize:48,marginBottom:12}}>🔐</div>
              <h3 style={{fontSize:18,fontWeight:700,color:C.black,marginBottom:8}}>Password Updated!</h3>
              <p style={{fontSize:13,color:C.warm,marginBottom:24}}>Your password has been changed. You can now sign in with your new password.</p>
              <button className="btn-purple" onClick={onClose} style={{width:"100%",fontSize:12,padding:"13px"}}>Back to Sign In →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactModal({onClose,type="demo"}){
  const isDemo=type==="demo";
  const {toast}=useToast();
  const [form,setForm]=useState({name:"",email:"",school:"",country:"Ghana",message:"",role:"teacher",students:"1-10"});
  const [sent,setSent]=useState(false);
  const [loading,setLoading]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  function submit(){
    if(!form.name||!form.email||!form.school){toast("Please fill in all required fields","error");return;}
    if(!form.email.includes("@")){toast("Enter a valid email address","error");return;}
    setLoading(true);
    setTimeout(()=>{setLoading(false);setSent(true);},1200);
  }

  if(sent) return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:440,padding:"40px 36px",textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"#DCFCE7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,margin:"0 auto 20px"}}>📅</div>
        <h3 className="serif" style={{fontSize:24,fontWeight:800,marginBottom:10,letterSpacing:"-.016em"}}>
          {isDemo?"Demo Booked!":"Message Sent!"}
        </h3>
        <p style={{fontSize:14,color:C.warm,lineHeight:1.7,marginBottom:6}}>
          {isDemo?`Thanks, ${form.name.split(" ")[0]}! Our team will reach out to ${form.email} within 24 hours to schedule your demo.`:`Thanks for reaching out! We'll reply to ${form.email} within one business day.`}
        </p>
        {isDemo&&<p style={{fontSize:12,color:C.warm,marginBottom:28}}>In the meantime, you can start your free account and explore the platform.</p>}
        <div style={{display:"flex",gap:10}}>
          <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Close</button>
          <button className="btn-purple" onClick={onClose} style={{flex:2,fontSize:12,padding:"12px"}}>
            {isDemo?"Start Free →":"OK, got it"}
          </button>
        </div>
      </div>
    </div>
  );

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:520,padding:0}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",padding:"28px 30px 24px",position:"relative"}}>
          <button onClick={onClose} style={{position:"absolute",top:16,right:16,fontSize:22,color:"rgba(255,255,255,.5)",background:"none",border:"none",cursor:"pointer"}} aria-label="Close">×</button>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:".12em",color:"#A78BFA",marginBottom:8}}>
            {isDemo?"BOOK A DEMO":"GET IN TOUCH"}
          </p>
          <h3 className="serif" style={{fontSize:26,fontWeight:800,color:"#fff",letterSpacing:"-.016em",lineHeight:1.1,marginBottom:8}}>
            {isDemo?"See ALP in action":"Talk to our team"}
          </h3>
          <p style={{fontSize:13,color:"rgba(255,255,255,.55)",lineHeight:1.6}}>
            {isDemo?"A 30-minute live walkthrough tailored to your school's needs. No sales pressure.":"We're a small team and we actually read every message."}
          </p>
          {isDemo&&(
            <div style={{display:"flex",gap:16,marginTop:16,flexWrap:"wrap"}}>
              {[["📅","30-minute call"],["🎯","Personalised walkthrough"],["✅","No commitment"]].map(([ic,label])=>(
                <div key={label} style={{display:"flex",gap:6,alignItems:"center",fontSize:11,color:"rgba(255,255,255,.6)"}}>
                  <span>{ic}</span><span>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{padding:"24px 30px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <UInput label="Full Name *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Your name"/>
            <UInput label="Work Email *" value={form.email} onChange={e=>set("email",e.target.value)} type="email" placeholder="you@school.edu"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <UInput label="School / Organisation *" value={form.school} onChange={e=>set("school",e.target.value)} placeholder="School name"/>
            <USelect label="Country" value={form.country} onChange={e=>set("country",e.target.value)}
              options={["Ghana","Nigeria","United States","United Kingdom","Kenya","Canada","Australia","Other"].map(c=>({value:c,label:c}))}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <USelect label="Your Role" value={form.role} onChange={e=>set("role",e.target.value)}
              options={[["teacher","ALP Teacher"],["director","ALP Director"],["admin","School Admin"],["slp","Related Services"],["other","Other"]].map(([v,l])=>({value:v,label:l}))}/>
            <USelect label="Number of Students" value={form.students} onChange={e=>set("students",e.target.value)}
              options={["1-10","11-50","51-200","201-500","500+"].map(v=>({value:v,label:v}))}/>
          </div>
          <UTextarea label={isDemo?"What would you like to see? (optional)":"Message"} value={form.message} onChange={e=>set("message",e.target.value)} rows={3}
            placeholder={isDemo?"Any specific features or use cases you'd like us to focus on?":"How can we help you?"}/>
          <div style={{display:"flex",gap:10,marginTop:18}}>
            <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
            <button className="btn-purple" onClick={submit} disabled={loading||!form.name||!form.email||!form.school}
              style={{flex:2,fontSize:12,padding:"14px"}}>
              {loading?<><Spin/>{isDemo?"Booking…":"Sending…"}</>:isDemo?"📅 Book My Demo →":"Send Message →"}
            </button>
          </div>
          <p style={{fontSize:10,color:C.warm,textAlign:"center",marginTop:10}}>
            Your data is private and will never be shared. · <a href="mailto:hello@growwithalp.com" style={{color:C.purple}}>hello@growwithalp.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function SignUp({onLogin,onBack}){
  const [step,setStep]=useState("plan"); // plan → details → done
  const [plan,setPlan]=useState("professional");
  const [form,setForm]=useState({name:"",email:"",school:"",country:"",role:"teacher",password:""});
  const [loading,setLoading]=useState(false);
  const [showPw,setShowPw]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const plans=[
    {id:"free",name:"Free",price:"$0",desc:"ALP AI tools forever. Up to 10 students.",color:"#6B7280",features:["AI Goal Architect","Present Levels Coach","Behaviour Blueprint","10 students max"]},
    {id:"professional",name:"Professional",price:"$9/mo",desc:"Everything — unlimited students, director approvals, compliance dashboard, and professional PDF export.",color:"#7C3AED",features:["Unlimited students","All AI tools","Director approvals & audit log","Professional PDF export"],popular:true},
    {id:"school",name:"School",price:"$29/mo",desc:"Admin dashboard, district reporting, bulk import.",color:"#16A34A",features:["Everything in Pro","Admin dashboard","Staff management","Priority support"]},
  ];
  async function handleCreate(){
    if(!form.name||!form.email||!form.password)return;
    setLoading(true);
    // No role and no org_id are sent. The server ignores both from the
    // public signup endpoint — they are attacker-controlled there —
    // and passing them anyway would imply to the next reader that they
    // do something.
    const {data,error:e}=await Supabase.signUp(form.email,form.password,{
      full_name:form.name, school:form.school
    });
    setLoading(false);
    if(e){
      if(e.message?.includes("Demo")||e.message?.includes("not configured")){
        // Demo fallback
        setStep("done"); return;
      }
      alert(e.message||"Sign up failed"); return;
    }
    setStep("done");
  }
  return(
    <div style={{display:"flex",minHeight:"100vh"}}>
      {/* Left panel */}
      <div style={{flex:1,background:"linear-gradient(135deg,#18003d 0%,#0B0718 100%)",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"clamp(32px,5vw,56px)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle,rgba(124,58,237,.15) .8px,transparent .8px)",backgroundSize:"22px 22px"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:48}} onClick={onBack}>
            <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:40,height:40,borderRadius:10,objectFit:"cover"}}/>
            <div><div className="serif" style={{fontSize:16,fontWeight:700,color:"#fff"}}>ALP</div><div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".12em"}}>ACCELERATED LEARNING PROGRAM</div></div>
          </div>
          <h2 className="serif" style={{fontSize:"clamp(28px,4vw,46px)",fontWeight:800,color:"#fff",lineHeight:1.1,marginBottom:20,letterSpacing:"-.026em"}}>
            Join educators<br/><span style={{color:"#A78BFA"}}>building better plans.</span>
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.55)",lineHeight:1.75,maxWidth:360,marginBottom:40}}>Build effective Accelerated Learning Plans in minutes. Free plan for schools — access through your school — no credit card required.</p>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {[["✓ Free plan for schools — access through your school",""],["✓ AI tools included — no extra cost",""],["✓ various regions & more",""],["✓ Set up in under 5 minutes",""]].map(([t])=>(
              <div key={t} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,color:"rgba(255,255,255,.7)"}}><span style={{color:"#A78BFA",fontWeight:700}}>{t.slice(0,1)}</span>{t.slice(2)}</div>
            ))}
          </div>
        </div>
        <div style={{position:"relative",zIndex:1,display:"flex",gap:40,marginTop:40}}>
          {[["10+","Countries"],["Birth–22+","Age range"],["Free","For teachers"]].map(([v,l])=>(
            <div key={l}><div style={{fontSize:22,fontWeight:800,color:"#A78BFA",letterSpacing:"-.026em"}}>{v}</div><div style={{fontSize:11,color:"rgba(255,255,255,.35)",marginTop:2}}>{l}</div></div>
          ))}
        </div>
      </div>
      {/* Right panel */}
      <div style={{width:"min(520px,100vw)",background:"var(--bg-secondary)",display:"flex",flexDirection:"column",justifyContent:"center",padding:"clamp(24px,4vw,52px)",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
          <div style={{display:"flex",gap:8}}>
            {["plan","details","done"].map((s,i)=>(
              <div key={s} style={{width:28,height:4,borderRadius:2,background:["plan","details","done"].indexOf(step)>=i?"#7C3AED":"#E5E7EB",transition:"background .3s"}}/>
            ))}
          </div>
          <button onClick={onBack} style={{fontSize:12,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>← Back</button>
        </div>

        {step==="plan"&&(
          <>
            <h3 style={{fontSize:24,fontWeight:800,color:C.black,marginBottom:4,letterSpacing:"-.016em"}}>Choose your plan</h3>
            <p style={{fontSize:13,color:C.warm,marginBottom:24}}>Start free. Upgrade anytime. No credit card needed.</p>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
              {plans.map(p=>(
                <div key={p.id} onClick={()=>setPlan(p.id)}
                  style={{border:`2px solid ${plan===p.id?p.color:C.tanL}`,borderRadius:12,padding:"16px 18px",cursor:"pointer",background:plan===p.id?p.color+"0D":"transparent",transition:"all .15s",position:"relative"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=p.color;}}
                  onMouseLeave={e=>{if(plan!==p.id)e.currentTarget.style.borderColor=C.tanL;}}>
                  {p.popular&&<span style={{position:"absolute",top:-10,right:14,background:p.color,color:"#fff",fontSize:9,fontWeight:800,padding:"3px 10px",borderRadius:99,letterSpacing:".06em"}}>MOST POPULAR</span>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.black}}>{p.name}</span>
                    <span style={{fontSize:15,fontWeight:800,color:p.color}}>{p.price}</span>
                  </div>
                  <p style={{fontSize:12,color:C.warm,marginBottom:8}}>{p.desc}</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {p.features.map(f=><span key={f} style={{fontSize:10,fontWeight:600,color:p.color,background:p.color+"14",padding:"2px 8px",borderRadius:99}}>{f}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-purple" onClick={()=>setStep("details")} style={{width:"100%",padding:"14px"}}>Continue with {plans.find(p=>p.id===plan)?.name} →</button>
            <p style={{textAlign:"center",fontSize:12,color:C.warm,marginTop:12}}>Already have an account? <span style={{color:C.purple,fontWeight:700,cursor:"pointer"}} onClick={onBack}>Sign in</span></p>
          </>
        )}

        {step==="details"&&(
          <>
            <h3 style={{fontSize:22,fontWeight:800,color:C.black,marginBottom:4,letterSpacing:"-.016em"}}>Create your account</h3>
            <p style={{fontSize:13,color:C.warm,marginBottom:24}}>Plan: <b style={{color:C.purple}}>{plans.find(p=>p.id===plan)?.name}</b> · <span style={{cursor:"pointer",color:C.warm,textDecoration:"underline"}} onClick={()=>setStep("plan")}>Change</span></p>
            <div style={{display:"flex",flexDirection:"column",gap:20,marginBottom:24}}>
              <UInput label="Full Name" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Full name"/>
              <UInput label="School Email" value={form.email} onChange={e=>set("email",e.target.value)} type="email" placeholder="you@school.edu"/>
              <UInput label="School / Organisation" value={form.school} onChange={e=>set("school",e.target.value)} placeholder="Your school or organisation name"/>
              {/* ── No role selector here, deliberately ──────────────
                  A public signup form must never offer "Administrator"
                  or "Director" to whoever is on the other end of it.
                  The server already ignores any role in the signup
                  payload, so this dropdown could not actually grant
                  anything — but leaving it would still be dishonest:
                  someone picks Administrator and silently receives a
                  pending teacher account.

                  It is also the affordance that made the original
                  privilege-escalation hole obvious to anyone who
                  opened the page. Your role is assigned by your school
                  when they provision your account. */}
              <div style={{padding:"12px 14px",background:C.purpleL,borderRadius:9,
                border:`1px solid ${C.border}`}}>
                <p style={{fontSize:12,color:C.purpleD,lineHeight:1.6,margin:0}}>
                  Your role is set by your school when they add you to their ALP
                  workspace. If your school already uses ALP, ask your director
                  to send you an invitation instead.
                </p>
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span className="lbl" style={{fontSize:9}}>Password</span><span onClick={()=>setShowPw(s=>!s)} style={{fontSize:11,color:C.purple,cursor:"pointer"}}>{showPw?"Hide":"Show"}</span></div>
                <input className="u-input" type={showPw?"text":"password"} value={form.password} onChange={e=>set("password",e.target.value)} placeholder="At least 8 characters"/>
                {form.password&&(()=>{const s=form.password.length>=10&&/[A-Z]/.test(form.password)&&/[0-9]/.test(form.password)?"Strong":form.password.length>=8?"Fair":"Weak";return(<div style={{marginTop:8}}>
                  <div style={{display:"flex",gap:4,marginBottom:4}}>{["Weak","Fair","Strong"].map((l,i)=><div key={l} style={{flex:1,height:3,borderRadius:99,background:s==="Strong"?C.green:s==="Fair"&&i<2?C.amber:s==="Weak"&&i<1?C.red:C.tanL,transition:"background .3s"}}/>)}</div>
                  <span style={{fontSize:10,color:s==="Strong"?C.green:s==="Fair"?C.amber:C.red,fontWeight:700}}>{s} password</span>
                </div>);})()}
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:24}}>
              <button className="btn-ghost" onClick={()=>setStep("plan")} style={{flex:1,fontSize:12}}>← Back</button>
              <button className="btn-purple" onClick={handleCreate} disabled={loading||!form.name||!form.email||!form.password} style={{flex:2,fontSize:12,padding:"13px"}}>
                {loading?<><Spin/>Creating account…</>:"Create Account →"}
              </button>
            </div>
            <p style={{fontSize:11,color:C.warm,textAlign:"center",lineHeight:1.6}}>By creating an account you agree to our <a href="mailto:legal@growwithalp.com" style={{color:C.purple}}>Terms of Service</a> and <a href="mailto:privacy@growwithalp.com" style={{color:C.purple}}>Privacy Policy</a>.</p>
          </>
        )}

        {step==="done"&&(
          <div style={{textAlign:"center"}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,margin:"0 auto 24px",boxShadow:"0 8px 32px rgba(124,58,237,.4)"}}>🎉</div>
            <h3 style={{fontSize:24,fontWeight:800,color:C.black,marginBottom:8,letterSpacing:"-.016em"}}>Welcome to ALP!</h3>
            <p style={{fontSize:14,color:C.warm,lineHeight:1.7,marginBottom:8}}>Account created for <b style={{color:C.black}}>{form.email}</b>.</p>
            <p style={{fontSize:13,color:C.warm,marginBottom:32}}>Your <b style={{color:C.purple}}>{plans.find(p=>p.id===plan)?.name}</b> account is ready.</p>
            <button className="btn-purple" onClick={()=>onLogin(form.role||"teacher")} style={{width:"100%",padding:"15px",fontSize:13,marginBottom:12}}>Go to My Dashboard →</button>
            <p style={{fontSize:12,color:C.warm}}>Check your email for a confirmation link.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ONBOARDING WIZARD (shown after first login)
// ═══════════════════════════════════════════════════════════

function NotFound({setPage}){
  const [hovered,setHovered]=useState(null);
  const quickLinks=[
    {icon:"⊞",label:"Dashboard",page:"dashboard"},
    {icon:"👥",label:"Students",page:"students"},
    {icon:"✏️",label:"ALP Builder",page:"builder"},
    {icon:"📈",label:"Progress",page:"progress"},
  ];
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,padding:32}}>
      <div style={{textAlign:"center",maxWidth:480}}>
        <div className="serif" style={{fontSize:"clamp(80px,15vw,160px)",fontWeight:800,color:C.purple,lineHeight:1,letterSpacing:"-.05em",opacity:.15,marginBottom:-20}}>404</div>
        <div style={{fontSize:48,marginBottom:16}}>🔍</div>
        <h2 className="serif" style={{fontSize:"clamp(22px,4vw,36px)",fontWeight:700,color:C.black,letterSpacing:"-.016em",marginBottom:10}}>
          Page not found
        </h2>
        <p style={{fontSize:15,color:C.warm,lineHeight:1.7,marginBottom:32}}>
          The page you're looking for doesn't exist or has been moved.<br/>
          Try one of these instead:
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:28}}>
          {quickLinks.map(l=>(
            <button key={l.page} onClick={()=>setPage&&setPage(l.page)}
              style={{padding:"10px 20px",borderRadius:99,border:`1.5px solid ${hovered===l.page?C.purple:C.tanL}`,background:hovered===l.page?C.purpleL:"transparent",color:hovered===l.page?C.purple:C.black,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",gap:6,alignItems:"center",transition:"all .15s"}}
              onMouseEnter={()=>setHovered(l.page)}
              onMouseLeave={()=>setHovered(null)}>
              <span>{l.icon}</span>{l.label}
            </button>
          ))}
        </div>
        <button className="btn-purple" onClick={()=>setPage&&setPage("dashboard")} style={{fontSize:13,padding:"13px 32px",borderRadius:99}}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

function DirectorDashboard({setPage}){
  const {isMobile}=useResponsive();
  const {toast}=useToast();
  const {students:dbStudents,profile}=useSupabaseAuth();
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

  const total=dbStudents?.length||0;
  const active=dbStudents?.filter(s=>s.status==="Active"||!s.status).length||0;
  const onTrackPct=total>0?Math.round((active/total)*100):0;
  const reviewsDue=dbStudents?.filter(s=>s.review_date&&new Date(s.review_date)<=new Date(Date.now()+30*86400000)).length||0;

  return(
    <Page title={<>Director <span className="serif-italic" style={{fontSize:26}}>Dashboard</span></>}
      subtitle={`Organization overview · ${today}`}
      action={<button className="btn-black" onClick={()=>setPage("reports")} style={{fontSize:11,padding:"11px 22px"}}>📊 Reports →</button>}>

      {total===0&&(
        <div className="card" style={{padding:"48px 32px",textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48,marginBottom:12}}>🏛️</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Data Yet</h3>
          <p style={{fontSize:13,color:C.warm}}>This view will populate once students are added to the platform.</p>
        </div>
      )}

      {/* Key metrics */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[["STUDENTS",total,"Active plans",C.purple,"👥"],["STAFF",1,"Special educators",C.blue,"👩‍🏫"],["ON TRACK",`${onTrackPct}%`,"Goals on trajectory",C.green,"📈"],["REVIEWS DUE",reviewsDue,"This month",reviewsDue>0?C.red:C.green,"📅"]].map(([l,v,sub,c,ic])=>(
          <div key={l} className="card" style={{padding:"18px 20px",borderLeft:`3px solid ${c}`}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div>
                <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
                <div className="serif" style={{fontSize:26,fontWeight:700,color:c,lineHeight:1}}><AnimCounter value={v}/></div>
                <p style={{fontSize:10,color:C.warm,marginTop:4}}>{sub}</p>
              </div>
              <span style={{fontSize:28,opacity:.15}}>{ic}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16,marginBottom:16}}>
        {/* Staff performance table */}
        <div className="card" style={{padding:"22px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <p className="lbl">CASELOAD OVERVIEW</p>
            <button className="btn-ghost" style={{fontSize:10}} onClick={()=>setPage("reports")}>Full Report →</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="data-table" style={{minWidth:420}}>
              <thead><tr>{["Teacher","Students","On Track","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                <tr>
                  <td style={{fontWeight:600}}>{profile?.full_name||"You"}</td>
                  <td style={{textAlign:"center"}}>{total}</td>
                  <td><span style={{fontWeight:700,color:C.green}}>{active}/{total}</span></td>
                  <td><span style={{fontSize:10,fontWeight:700,color:C.green,background:C.green+"18",padding:"2px 8px",borderRadius:99}}>Active</span></td>
                </tr>
                {total===0&&<tr><td colSpan={4} style={{textAlign:"center",padding:20,color:C.warm,fontSize:12}}>No students yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary panel */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card" style={{padding:"20px"}}>
            <p className="lbl" style={{marginBottom:12}}>QUICK ACTIONS</p>
            {[["📊","View full reports",()=>setPage("reports")],["📤","Export data",()=>toast("Export started","info")],["➕","Add a student",()=>setPage("students")]].map(([ic,label,fn])=>(
              <div key={label} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:`1px solid ${C.tanL}`,cursor:"pointer",alignItems:"center"}} onClick={fn}>
                <span style={{fontSize:16}}>{ic}</span>
                <span style={{fontSize:12,color:C.black}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}


function RelatedServicesDashboard({setPage}){
  const {isMobile}=useResponsive();
  const {toast}=useToast();
  const {students:dbStudents,profile,user}=useSupabaseAuth();
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const [showNoteForm,setShowNoteForm]=useState(false);
  const [noteStudent,setNoteStudent]=useState(dbStudents?.[0]?.id||"");
  const [noteText,setNoteText]=useState("");

  const caseload=(dbStudents||[]).map(s=>{
    const pct=s.current_pct||0;
    return{id:s.id,name:s.name,grade:s.grade||"–",disability:s.disability||"ALP",service:"Related Services",freq:"Per ALP",goal:s.strengths?s.strengths.slice(0,40)+"…":"Not yet set",progress:pct,trend:pct>=70?"↑":pct>=40?"→":"↓"};
  });
  const total=caseload.length;
  const goalsMet=total>0?Math.round(caseload.reduce((a,c)=>a+c.progress,0)/total):0;

  return(
    <Page title={<>Related <span className="serif-italic" style={{fontSize:26}}>Services</span></>}
      subtitle={`${profile?.full_name||user?.email?.split("@")[0]||"Provider"} · ${today}`}
      action={<div style={{display:"flex",gap:8}}>
        <button className="btn-ghost" onClick={()=>setShowNoteForm(v=>!v)} style={{fontSize:11}}>📝 Quick Note</button>
        <button className="btn-black" onClick={()=>setPage("progress")} style={{fontSize:11,padding:"11px 20px"}}>📈 Progress →</button>
      </div>}>

      {total===0&&(
        <div className="card" style={{padding:"48px 32px",textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48,marginBottom:12}}>🩺</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Students on Caseload</h3>
          <p style={{fontSize:13,color:C.warm}}>Add students to start tracking related services.</p>
        </div>
      )}

      {/* Quick note form */}
      {showNoteForm&&total>0&&(
        <div className="card fade-up" style={{padding:"18px 22px",marginBottom:16,background:C.purpleL}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
            <USelect label="Student" value={noteStudent} onChange={e=>setNoteStudent(e.target.value)}
              options={caseload.map(s=>({value:s.id,label:s.name.split(" ")[0]}))}/>
            <UInput label="Today's Score / Observation" value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="e.g. 72 wcpm, 4/5 trials"/>
          </div>
          <button className="btn-purple" onClick={async()=>{
            if(noteText.trim()){await Supabase.logProgress({student_id:noteStudent,score:parseFloat(noteText)||0,notes:noteText,date:new Date().toISOString().split("T")[0],created_by:user?.id}).catch(()=>{});}
            toast("Note saved","success");setShowNoteForm(false);setNoteText("");
          }} style={{fontSize:11,padding:"9px 20px"}}>Save Note →</button>
        </div>
      )}

      {/* Metrics */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:12,marginBottom:16}}>
        {[["MY CASELOAD",total,"Students",C.purple,"👥"],["GOALS MET",`${goalsMet}%`,"Average progress",C.green,"✅"],["ACTIVE PLANS",total,"ALPs in progress",C.blue,"📋"]].map(([l,v,sub,c,ic])=>(
          <div key={l} className="card" style={{padding:"18px 20px",borderLeft:`3px solid ${c}`}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div>
                <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
                <div className="serif" style={{fontSize:26,fontWeight:700,color:c,lineHeight:1}}><AnimCounter value={v}/></div>
                <p style={{fontSize:10,color:C.warm,marginTop:4}}>{sub}</p>
              </div>
              <span style={{fontSize:24,opacity:.15}}>{ic}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Caseload table */}
      {total>0&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table className="data-table" style={{minWidth:560}}>
              <thead><tr>{["Student","Focus Area","Progress","Trend"].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>{caseload.map(s=>(
                <tr key={s.id}>
                  <td><div style={{fontWeight:600}}>{s.name}</div><div style={{fontSize:10,color:C.warm}}>Gr.{s.grade} · {s.disability}</div></td>
                  <td style={{fontSize:11,maxWidth:220,color:C.warm}}>{s.goal}</td>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:60,height:5,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${s.progress}%`,background:s.progress>=70?C.green:s.progress>=50?C.amber:C.red,borderRadius:99}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:600,color:s.progress>=70?C.green:s.progress>=50?C.amber:C.red}}>{s.progress}%</span>
                    </div>
                  </td>
                  <td style={{fontSize:14,fontWeight:700,color:s.trend==="↑"?C.green:s.trend==="↓"?C.red:C.warm}}>{s.trend}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </Page>
  );
}


function AdminDashboard({setPage}){
  const {isMobile}=useResponsive();
  const {toast}=useToast();
  const {students:dbStudents,user,profile}=useSupabaseAuth();
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const [activeTab,setActiveTab]=useState("overview");

  const total=dbStudents?.length||0;
  const active=dbStudents?.filter(s=>s.status==="Active"||!s.status).length||0;
  const onTrackPct=total>0?Math.round((active/total)*100):0;
  const pendingReviews=dbStudents?.filter(s=>s.review_date&&new Date(s.review_date)<=new Date(Date.now()+30*86400000)).length||0;

  const schools=[
    {name:profile?.school||"Your School",students:total,staff:1,onTrack:onTrackPct,pending:pendingReviews,contact:profile?.full_name||user?.email?.split("@")[0]||"–"},
  ];
  const recentActivity=[];


  return(
    <Page title={<>Admin <span className="serif-italic" style={{fontSize:26}}>Dashboard</span></>}
      subtitle={`District Administration · ${today}`}
      action={<div style={{display:"flex",gap:8}}>
        <button className="btn-ghost" onClick={()=>toast("Staff management opened","info")} style={{fontSize:11}}>+ Add Staff</button>
        <button className="btn-black" onClick={()=>setPage("reports")} style={{fontSize:11,padding:"11px 20px"}}>📊 Reports →</button>
      </div>}>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {[["overview","Overview"],["schools","Schools"],["staff","Staff"],["data","Data & Exports"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} className={activeTab===id?"btn-black":"btn-ghost"} style={{fontSize:11,padding:"8px 16px"}}>{label}</button>
        ))}
      </div>

      {activeTab==="overview"&&(
        <div>
          {/* Metrics */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
            {[["TOTAL SCHOOLS","1","Your organization",C.purple,"🏫"],["STUDENTS",String(total),"Active plans",C.blue,"👥"],["GOAL RATE",`${onTrackPct}%`,"On-track goals",C.green,"🎯"],["PENDING",String(pendingReviews),"Need attention",C.amber,"⚠️"]].map(([l,v,sub,c,ic])=>(
              <div key={l} className="card" style={{padding:"20px",borderLeft:`3px solid ${c}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
                    <div className="serif" style={{fontSize:28,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                    <p style={{fontSize:10,color:C.warm,marginTop:4}}>{sub}</p>
                  </div>
                  <span style={{fontSize:26,opacity:.15}}>{ic}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>
            {/* School summary */}
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:16}}>SCHOOL SUMMARY</p>
              <div style={{overflowX:"auto"}}>
                <table className="data-table" style={{minWidth:380}}>
                  <thead><tr>{["School","Students","Staff","On Track","Contact"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{schools.map(s=>(
                    <tr key={s.name}>
                      <td style={{fontWeight:600}}>{s.name}</td>
                      <td>{s.students}</td>
                      <td>{s.staff}</td>
                      <td><span style={{fontWeight:700,color:s.onTrack>=90?C.green:C.amber}}>{s.onTrack}%</span></td>
                      <td style={{fontSize:11,color:C.warm}}>{s.contact}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            {/* Recent activity */}
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:14}}>RECENT ACTIVITY</p>
              {recentActivity.length===0&&<p style={{fontSize:12,color:C.warm}}>Activity will appear here as you use the platform.</p>}
              {recentActivity.map((a,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{a.icon}</span>
                  <div style={{flex:1}}><div style={{fontSize:12,color:C.black}}>{a.text}</div><div style={{fontSize:10,color:C.warm}}>{a.time}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab==="schools"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {schools.map(school=>(
            <div key={school.name} className="card" style={{padding:"22px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div>
                  <h3 style={{fontSize:16,fontWeight:700,color:C.black,marginBottom:4}}>{school.name}</h3>
                  <div style={{display:"flex",gap:16,fontSize:12,color:C.warm,flexWrap:"wrap"}}>
                    <span>👥 {school.students} students</span>
                    <span>👩‍🏫 {school.staff} staff</span>
                    <span style={{color:school.onTrack>=90?C.green:C.amber}}>📈 {school.onTrack}% on track</span>
                    <span>👤 {school.contact}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {school.pending>0&&<span style={{fontSize:11,fontWeight:700,color:C.amber,background:C.amber+"18",padding:"4px 10px",borderRadius:99}}>{school.pending} pending</span>}
                  <button className="btn-ghost" style={{fontSize:11}} onClick={()=>setPage("reports")}>Reports →</button>
                </div>
              </div>
              <div style={{marginTop:14,height:4,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${school.onTrack}%`,background:school.onTrack>=90?C.green:C.amber,borderRadius:99,transition:"width .5s"}}/>
              </div>
            </div>
          ))}
          <button className="btn-purple" onClick={()=>toast("Add school flow opened","info")} style={{fontSize:12,padding:"13px",alignSelf:"flex-start"}}>+ Add School →</button>
        </div>
      )}

      {activeTab==="staff"&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table className="data-table" style={{minWidth:560}}>
              <thead><tr>{["Name","School","Role","Students","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {(allSystemStudents?.reduce((acc,s)=>{const t=s.teacher_name||s.teacher_id||"Unassigned";if(!acc[t])acc[t]={name:t,school:s.school_name||"–",role:"ALP Teacher",students:0,status:"Active"};acc[t].students++;return acc;},{})||{}) && Object.values(allSystemStudents?.reduce((acc,s)=>{const t=s.teacher_name||"Unassigned";if(!acc[t])acc[t]={name:t,school:s.school_name||"–",role:"ALP Teacher",students:0,status:"Active"};acc[t].students++;return acc;},{}) || {[profile?.full_name||"Teacher"]:{name:profile?.full_name||"Teacher",school:profile?.school||"–",role:"ALP Teacher",students:dbStudents?.length||0,status:"Active"}}).map(({name,school,role,students,status})=>(
                  <tr key={name}>
                    <td style={{fontWeight:600}}>{name}</td>
                    <td style={{fontSize:11,color:C.warm}}>{school}</td>
                    <td style={{fontSize:11}}>{role}</td>
                    <td style={{textAlign:"center"}}>{students}</td>
                    <td><span style={{fontSize:10,fontWeight:700,color:status==="Active"?C.green:status==="New"?C.blue:C.amber,background:(status==="Active"?C.green:status==="New"?C.blue:C.amber)+"18",padding:"2px 8px",borderRadius:99}}>{status}</span></td>
                    <td><button className="btn-ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>toast(`${name} profile opened`,"info")}>View →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab==="data"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
          <div className="card" style={{padding:"24px"}}>
            <p className="lbl" style={{marginBottom:16}}>QUICK EXPORTS</p>
            {[["All Student Plans","ALP documents · All schools","📋"],["Progress Data","CBM scores · Q1–Q3","📈"],["Staff Reports","By teacher and school","👩‍🏫"],["Family Contacts","Emails, phones, portal status","❤️"],["Annual Summary","All metrics for district board","📊"]].map(([title,desc,ic])=>(
              <div key={title} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,cursor:"pointer",alignItems:"center"}} onClick={()=>toast(`Exporting ${title}…`,"info")}>
                <span style={{fontSize:20}}>{ic}</span>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.black}}>{title}</div><div style={{fontSize:11,color:C.warm}}>{desc}</div></div>
                <span style={{fontSize:11,color:C.purple}}>⬇</span>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:"24px"}}>
            <p className="lbl" style={{marginBottom:16}}>SYSTEM SETTINGS</p>
            {[["📥","Data Import","Upload CSV from your SIS"],["🔗","Integrations","PowerSchool, Infinite Campus"],["👥","User Management","Add, remove, change roles"],["🔒","Privacy Settings","Data retention & access"],["📧","Email Templates","Customise notification emails"]].map(([ic,title,desc])=>(
              <div key={title} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,cursor:"pointer",alignItems:"center"}} onClick={()=>toast(`${title} opened`,"info")}>
                <span style={{fontSize:20}}>{ic}</span>
                <div><div style={{fontSize:13,fontWeight:600,color:C.black}}>{title}</div><div style={{fontSize:11,color:C.warm}}>{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}


function InterventionDashboard({setPage}){
  const {isMobile}=useResponsive();
  const {toast}=useToast();
  const {students:dbStudents}=useSupabaseAuth();
  const [tier,setTier]=useState("all");

  const students=(dbStudents||[]).map(s=>{
    const pct=s.current_pct||0;
    return{id:s.id,name:s.name,grade:s.grade||"–",disability:s.disability||"ALP",tier:s.tier?parseInt(String(s.tier).replace(/\D/g,""))||2:2,intervention:s.strengths?s.strengths.slice(0,30)+"…":"Not yet set",freq:"Per ALP",progress:pct>=70?"↑ Improving":pct>=40?"→ Stable":"↓ Monitor",since:s.created_at?new Date(s.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"}):"–",alert:pct<40&&pct>0};
  });

  const visible=tier==="all"?students:students.filter(s=>s.tier===Number(tier));
  const alertCount=students.filter(s=>s.alert).length;
  const alertNames=students.filter(s=>s.alert).map(s=>s.name).join(" and ");

  return(
    <Page title={<>Intervention <span className="serif-italic" style={{fontSize:26}}>Dashboard</span></>}
      subtitle={`RTI/MTSS · ${students.length} student${students.length!==1?"s":""} receiving support`}
      action={<button className="btn-black" onClick={()=>setPage("progress")} style={{fontSize:11,padding:"11px 22px"}}>📈 Progress →</button>}>

      {students.length===0&&(
        <div className="card" style={{padding:"48px 32px",textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48,marginBottom:12}}>⚡</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Students Yet</h3>
          <p style={{fontSize:13,color:C.warm}}>Add students to start tracking intervention tiers.</p>
        </div>
      )}

      {/* Alert banner */}
      {alertCount>0&&<div style={{background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontSize:20}}>⚠️</span>
        <div><b style={{color:"#92400E"}}>{alertCount} student{alertCount!==1?"s":""} need attention</b><br/><span style={{fontSize:12,color:"#92400E"}}>{alertNames} {alertCount!==1?"have":"has"} been below goal trajectory.</span></div>
        <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11}} onClick={()=>setPage("progress")}>Review →</button>
      </div>}

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[["TIER 1",students.filter(s=>s.tier===1).length,"Universal support",C.green],["TIER 2",students.filter(s=>s.tier===2).length,"Targeted support",C.amber],["TIER 3",students.filter(s=>s.tier===3).length,"Intensive",C.red],["IMPROVING",students.filter(s=>s.progress.startsWith("↑")).length,"Positive trends",C.blue]].map(([l,v,sub,c])=>(
          <div key={l} className="card" style={{padding:"16px 20px",borderLeft:`3px solid ${c}`}}>
            <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
            <div className="serif" style={{fontSize:26,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
            <p style={{fontSize:10,color:C.warm,marginTop:4}}>{sub}</p>
          </div>
        ))}
      </div>

      {students.length>0&&(<>
      {/* Tier filter */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["all","All Tiers"],["2","Tier 2"],["3","Tier 3"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTier(id)} className={tier===id?"btn-black":"btn-ghost"} style={{fontSize:11,padding:"8px 16px"}}>{label}</button>
        ))}
      </div>

      {/* Student table */}
      <div className="card" style={{padding:0,overflow:"hidden",marginBottom:16}}>
        <div style={{overflowX:"auto"}}>
          <table className="data-table" style={{minWidth:600}}>
            <thead><tr>{["Student","Tier","Focus Area","Progress","Since",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>{visible.map(s=>(
              <tr key={s.id} style={{background:s.alert?"#FFF7ED":"transparent"}}>
                <td>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {s.alert&&<span style={{fontSize:12}}>⚠️</span>}
                    <div><div style={{fontWeight:600,color:C.black}}>{s.name}</div><div style={{fontSize:10,color:C.warm}}>Gr.{s.grade} · {s.disability}</div></div>
                  </div>
                </td>
                <td><span style={{fontSize:11,fontWeight:700,color:s.tier===3?C.red:C.amber,background:(s.tier===3?C.red:C.amber)+"18",padding:"2px 8px",borderRadius:99}}>Tier {s.tier}</span></td>
                <td style={{fontSize:12,maxWidth:160}}>{s.intervention}</td>
                <td><span style={{fontWeight:700,color:s.progress.startsWith("↑")?C.green:s.progress.startsWith("↓")?C.red:C.warm}}>{s.progress}</span></td>
                <td style={{fontSize:11,color:C.warm}}>{s.since}</td>
                <td><button className="btn-ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setPage("progress")}>Data →</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      </>)}

      {/* Evidence-based interventions — reference library */}
      <div className="card" style={{padding:"22px 24px"}}>
        <p className="lbl" style={{marginBottom:14}}>EVIDENCE-BASED INTERVENTION LIBRARY</p>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10}}>
          {[["📖","DIBELS / Oral Reading Fluency","Reading fluency and phonics"],["🔢","Number Rocket","Early numeracy and maths"],["🗣","Speech Blubs","Articulation and language"],["🧠","PBIS","School-wide behaviour"],["✏️","SRSD Strategy","Writing composition"],["👥","Social Thinking","Social-emotional learning"]].map(([ic,name,domain])=>(
            <div key={name} style={{padding:"10px 12px",border:`1px solid ${C.tanL}`,borderRadius:8,cursor:"pointer"}} onClick={()=>toast(`${name} — resource opened`,"info")}>
              <div style={{fontSize:18,marginBottom:4}}>{ic}</div>
              <div style={{fontSize:12,fontWeight:600,color:C.black}}>{name}</div>
              <div style={{fontSize:10,color:C.warm}}>{domain}</div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}


function LeadershipDashboard({setPage}){
  const {isMobile}=useResponsive();
  const {toast}=useToast();
  const {students:dbStudents,profile}=useSupabaseAuth();
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const [period,setPeriod]=useState(`${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`);

  const total=dbStudents?.length||0;
  const active=dbStudents?.filter(s=>s.status==="Active"||!s.status).length||0;
  const reviewRate=total>0?Math.round((active/total)*100):0;
  const needsReview=dbStudents?.filter(s=>s.review_date&&new Date(s.review_date)<=new Date(Date.now()+30*86400000)).length||0;

  return(
    <Page title={<>Leadership <span className="serif-italic" style={{fontSize:26}}>Overview</span></>}
      subtitle={`${profile?.school||"Your Organization"} · AY ${period} · ${today}`}
      action={<button className="btn-black" onClick={()=>setPage("reports")} style={{fontSize:11,padding:"11px 22px"}}>📊 Full Reports →</button>}>

      {total===0&&(
        <div className="card" style={{padding:"48px 32px",textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48,marginBottom:12}}>🎓</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Data Yet</h3>
          <p style={{fontSize:13,color:C.warm}}>Executive metrics populate once students are added to the platform.</p>
        </div>
      )}

      {/* Executive metrics */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[["TOTAL STUDENTS",String(total),"With active plans",C.purple,"👥"],["ACTIVE STAFF",1,"Special educators",C.blue,"👩‍🏫"],["ACTIVE RATE",`${reviewRate}%`,"Plans in good standing",C.green,"✅"],["NEEDS REVIEW",String(needsReview),"Action required",C.amber,"⚠️"]].map(([l,v,sub,c,ic])=>(
          <div key={l} className="card" style={{padding:"20px",borderLeft:`3px solid ${c}`}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div>
                <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
                <div className="serif" style={{fontSize:28,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
                <p style={{fontSize:10,color:C.warm,marginTop:4}}>{sub}</p>
              </div>
              <span style={{fontSize:28,opacity:.15}}>{ic}</span>
            </div>
          </div>
        ))}
      </div>

      {total>0&&(
        <div className="card" style={{padding:"22px 24px",marginBottom:16}}>
          <p className="lbl" style={{marginBottom:16}}>STUDENT STATUS BREAKDOWN</p>
          {["Active","Review Due","Inactive"].map(status=>{
            const count=dbStudents.filter(s=>(s.status||"Active")===status).length;
            const pct=total>0?Math.round((count/total)*100):0;
            const color=status==="Active"?C.green:status==="Review Due"?C.amber:C.warm;
            return(
              <div key={status} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{color:C.black}}>{status}</span>
                  <span style={{fontWeight:700,color}}>{count} ({pct}%)</span>
                </div>
                <div style={{height:6,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:99,transition:"width .5s"}}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <div className="card" style={{padding:"22px 24px"}}>
        <p className="lbl" style={{marginBottom:16}}>QUICK ACTIONS</p>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10}}>
          {[["📊","View Full Reports","Caseload and progress data",()=>setPage("reports")],["👥","Manage Students","Add or update student records",()=>setPage("students")],["⚙️","Platform Settings","Configure organization settings",()=>setPage("settings")]].map(([ic,title,desc,fn])=>(
            <div key={title} onClick={fn} style={{padding:"16px 14px",border:`1px solid ${C.tanL}`,borderRadius:10,cursor:"pointer"}}>
              <span style={{fontSize:24}}>{ic}</span>
              <h4 style={{fontSize:13,fontWeight:700,color:C.black,margin:"8px 0 4px"}}>{title}</h4>
              <p style={{fontSize:11,color:C.warm,lineHeight:1.5}}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}


function ChangelogPage(){
  const typeStyles={
    new:{label:"NEW",bg:"#DCFCE7",color:C.green},
    improved:{label:"IMPROVED",bg:"#DBEAFE",color:C.blue},
    fixed:{label:"FIXED",bg:"#FEF9C3",color:C.amber},
    removed:{label:"REMOVED",bg:"#FEE2E2",color:C.red},
  };
  const changes=[
  {version:"v3.0.0",date:"May 2026",badge:"Production",badgeColor:C.green,items:[
    {type:"new",text:"Real database — student, goal & progress data persists between sessions (Supabase PostgreSQL)"},
    {type:"new",text:"Real authentication — sign in, sign up, sign out, password reset via Supabase Auth"},
    {type:"new",text:"CSV bulk import — upload a spreadsheet to add multiple students at once"},
    {type:"new",text:"ALP Builder autosave — documents write to database automatically"},
    {type:"new",text:"Privacy Policy, Terms of Service, and Data & Security pages"},
    {type:"new",text:"Cookie consent banner and SEO meta tags (og:image, Twitter card, JSON-LD)"},
    {type:"improve",text:"Role-based access control enforced at database level (RLS)"},
    {type:"improve",text:"Notifications now sync in real time via Supabase Realtime"},
  ]},
    {version:"v2.5.0",date:"May 2026",badge:"Latest",badgeColor:C.green,items:[
      {type:"new",text:"Onboarding flow — 4-step setup guide for new teachers with role and country selection"},
      {type:"new",text:"All 8 role dashboards fully rebuilt: Director, Admin, RelatedServices, Student, Family, Intervention, Leadership"},
      {type:"new",text:"AIChatWidget — expanded with suggested prompts, expand/collapse, animated typing dots"},
      {type:"new",text:"Session Notes Widget — now has note history tab with last 3 entries"},
      {type:"new",text:"InviteUserModal — single and bulk invite tabs, 5 role options"},
      {type:"new",text:"Students — ⊞ Grid view toggle alongside table view"},
      {type:"new",text:"Students — sortable column headers (click to sort ascending/descending)"},
      {type:"new",text:"Students — empty state with clear-filter button"},
      {type:"new",text:"Goals Tracker — donut chart summary, Add Goal modal with AI shortcut"},
      {type:"new",text:"Teacher Notes on every student detail modal"},
      {type:"new",text:"Keyboard Shortcuts panel — press ? anytime (4 categories, 28 shortcuts)"},
      {type:"new",text:"Bulk Actions bar on Students page (Export, Message, Report, Transfer)"},
      {type:"new",text:"Offline indicator — banner appears when internet disconnects"},
      {type:"new",text:"Export All Data modal — 6 dataset types, 3 formats, progress animation"},
      {type:"improved",text:"Landing page — hero animations, school logos, integrations strip, bottom CTA"},
      {type:"improved",text:"Testimonials — 6 reviews with ⭐ ratings and Avatar components"},
      {type:"improved",text:"Print CSS — clean ALP document output, hides navigation and buttons"},
      {type:"improved",text:"Dashboard — today's date, This Week's Meetings widget, Recent Activity Feed"},
      {type:"removed",text:"All regulatory framework references removed from UI and marketing copy"},
    ]},
    {version:"v2.4.1",date:"Apr 2026",badge:"",badgeColor:C.warm,items:[
      {type:"new",text:"ALP Builder completion tracking — green dots show saved sections"},
      {type:"new",text:"Print Preview — formatted 10-step ALP document with print/export"},
      {type:"new",text:"Documents page — upload, search, tab filters, download/link buttons"},
      {type:"new",text:"Timeline page — per-student ALP activity history with event types"},
      {type:"new",text:"Data Import modal — CSV/PowerSchool/Infinite Campus with preview"},
      {type:"new",text:"Dashboard — DonutChart, MiniBarChart, Trend indicator"},
      {type:"new",text:"Reports — Progress tab with student table and trend chart"},
      {type:"improved",text:"Notifications — full detail panel, 10 notification types, filter pills"},
      {type:"improved",text:"ALP Builder — step progress persistence, auto-save indicator, unread badge"},
      {type:"improved",text:"Settings — billing tab with invoice history, language selector, theme toggle"},
      {type:"improved",text:"Pricing — annual/monthly toggle with savings badge"},
    ]},
    {version:"v2.4.0",date:"Mar 2026",badge:"Major",badgeColor:C.purple,items:[
      {type:"new",text:"Goals Tracker page — filterable table with progress bars and status badges"},
      {type:"new",text:"ALP Print Preview modal — full 10-step document preview"},
      {type:"new",text:"Session Notes FAB — floating quick note taker from any page"},
      {type:"new",text:"Global Search (⌘K) — pages, actions, students"},
      {type:"new",text:"AI Chat Widget — ask ALP AI about goals, planning, strategies"},
      {type:"new",text:"QuickAddStudentModal — 3-step flow with services selection"},
      {type:"new",text:"MeetingSchedulerModal — attendees, format, calendar invites"},
      {type:"improved",text:"ALP Builder — 13 sections all wired, autosave, keyboard navigation"},
      {type:"improved",text:"PDF Export — multi-page layout, goal sections, signature blocks, transition data"},
    ]},
    {version:"v2.3.0",date:"Feb 2026",badge:"",badgeColor:C.warm,items:[
      {type:"new",text:"8 role-specific dashboards (Teacher, Director, Admin, SLP, Student, Family, Intervention, Leadership)"},
      {type:"new",text:"AI Goal Architect — generate 3 SMART goals from baseline data"},
      {type:"new",text:"Progress Monitoring — CBM data, trendlines, alerts, sparkline chart"},
      {type:"new",text:"Reports page — 3 tabs: Reports, Progress, Activity Log"},
      {type:"improved",text:"Dark/light mode across all pages"},
    ]},
  ];

  return(
    <Page title={<>What's <span className="serif-italic" style={{fontSize:26}}>New</span></>} subtitle="ALP Platform Release Notes">
      <div style={{maxWidth:720,margin:"0 auto"}}>
        {changes.map(release=>(
          <div key={release.version} style={{marginBottom:40}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,paddingBottom:14,borderBottom:`2px solid ${C.tanL}`}}>
              <div className="serif" style={{fontSize:22,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>{release.version}</div>
              {release.badge&&<span style={{fontSize:10,fontWeight:800,color:release.badgeColor,background:release.badgeColor+"14",padding:"3px 10px",borderRadius:99,letterSpacing:".06em"}}>{release.badge}</span>}
              <span style={{fontSize:12,color:C.warm,marginLeft:"auto"}}>{release.date}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {release.items.map((item,i)=>{
                const style=typeStyles[item.type]||typeStyles.new;
                return(
                  <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <span style={{fontSize:9,fontWeight:800,color:style.color,background:style.bg,padding:"3px 8px",borderRadius:4,flexShrink:0,marginTop:2,letterSpacing:".06em"}}>{style.label}</span>
                    <span style={{fontSize:13.5,color:C.black,lineHeight:1.6}}>{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{background:C.purpleL,borderRadius:14,padding:"24px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
          <div>
            <h3 style={{fontSize:15,fontWeight:700,color:C.black,marginBottom:4}}>Stay up to date</h3>
            <p style={{fontSize:13,color:C.warm}}>Get notified about new features and improvements.</p>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <a href="mailto:support@growwithalp.com" className="btn-ghost" style={{textDecoration:"none",fontSize:12,padding:"10px 18px",display:"inline-block"}}>Request Feature</a>
            <a href="mailto:hello@growwithalp.com?subject=Changelog Subscribe" className="btn-purple" style={{textDecoration:"none",padding:"10px 20px",fontSize:12,display:"inline-block"}}>Subscribe to Updates →</a>
          </div>
        </div>
      </div>
    </Page>
  );
}

function GoalsPage({setPage}){
  const {isMobile}=useResponsive();
  const {toast}=useToast();
  const {students:dbStudents,user}=useSupabaseAuth();
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [showNewGoal,setShowNewGoal]=useState(false);
  const [saving,setSaving]=useState(false);
  const [allGoals,setAllGoals]=useState([]);
  const [loading,setLoading]=useState(true);
  const [newGoal,setNewGoal]=useState({student_id:"",domain:"Reading",goal_text:"",baseline:"",target:"",due_date:new Date(Date.now()+180*86400000).toISOString().split("T")[0]});
  const setNG=(k,v)=>setNewGoal(p=>({...p,[k]:v}));

  useEffect(()=>{
    async function loadGoals(){
      setLoading(true);
      if(!dbStudents?.length){setLoading(false);return;}
      try{
        const all=[];
        for(const s of dbStudents){
          const goals=await Supabase.getGoals(s.id);
          if(goals?.length) goals.forEach(g=>all.push({...g,studentName:s.name,grade:s.grade||""}));
        }
        setAllGoals(all);
      }catch(e){console.error(e);}
      setLoading(false);
    }
    loadGoals();
  },[dbStudents]);

  const statusColor=(pct)=>pct>=80?C.green:pct>=50?C.amber:C.red;
  const statusLabel=(pct)=>pct>=80?"On Track":pct>=50?"Developing":"Needs Support";

  const enriched=allGoals.map(g=>{
    const entries=g.progress_entries||[];
    const latest=entries.length>0?entries[entries.length-1].score:null;
    const pct=latest!=null?(latest/parseFloat(g.target||100))*100:g.current_pct||0;
    const clampedPct=Math.min(100,Math.max(0,Math.round(pct)));
    return {...g,pct:clampedPct,statusLabel:statusLabel(clampedPct),color:statusColor(clampedPct)};
  });

  const filters=[["all","All Goals"],["On Track","On Track"],["Developing","Developing"],["Needs Support","Needs Support"]];
  const filtered=enriched.filter(g=>(filter==="all"||g.statusLabel===filter)&&(!search||g.studentName?.toLowerCase().includes(search.toLowerCase())||g.domain?.toLowerCase().includes(search.toLowerCase())||g.goal_text?.toLowerCase().includes(search.toLowerCase())));
  const stats={total:enriched.length,onTrack:enriched.filter(g=>g.statusLabel==="On Track").length,developing:enriched.filter(g=>g.statusLabel==="Developing").length,needs:enriched.filter(g=>g.statusLabel==="Needs Support").length};

  async function handleAddGoal(){
    if(!newGoal.goal_text.trim()){toast("Please write a goal statement","error");return;}
    if(!newGoal.student_id){toast("Please select a student","error");return;}
    setSaving(true);
    try{
      await Supabase.createGoal({
        student_id:newGoal.student_id,
        domain:newGoal.domain,
        goal_text:newGoal.goal_text,
        baseline:newGoal.baseline,
        target:newGoal.target,
        due_date:newGoal.due_date,
        status:"Active",
        monitoring:"Weekly",
        created_by:user?.id,
      });
      const studentName=dbStudents?.find(s=>s.id===newGoal.student_id)?.name||"student";
      toast(`Goal added for ${studentName}!`,"success");
      setShowNewGoal(false);
      setNewGoal(p=>({...p,goal_text:"",baseline:"",target:""}));
      // Reload
      const goals=await Supabase.getGoals(newGoal.student_id);
      if(goals) setAllGoals(prev=>[...prev.filter(g=>g.student_id!==newGoal.student_id),...goals.map(g=>({...g,studentName:studentName,grade:dbStudents?.find(s=>s.id===newGoal.student_id)?.grade||""}))]);
    }catch(e){toast("Failed to save goal","error");}
    setSaving(false);
  }

  return(
    <>{showNewGoal&&(
      <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowNewGoal(false)}>
        <div className="card fade-up" style={{width:"100%",maxWidth:500,padding:0}}>
          <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><p className="lbl" style={{color:C.purple,marginBottom:4}}>Add Goal</p><h3 style={{fontSize:18,fontWeight:800,color:C.black}}>New Annual Goal</h3></div>
            <button onClick={()=>setShowNewGoal(false)} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>×</button>
          </div>
          <div style={{padding:"22px 26px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.warm,display:"block",marginBottom:5}}>STUDENT</label>
                <select value={newGoal.student_id} onChange={e=>setNG("student_id",e.target.value)} className="u-select">
                  <option value="">Select student…</option>
                  {(dbStudents||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <USelect label="Domain" value={newGoal.domain} onChange={e=>setNG("domain",e.target.value)} options={["Reading","Math","Writing","Communication","Social-Emotional","Behaviour","OT","Speech","Life Skills"].map(d=>({value:d,label:d}))}/>
            </div>
            <UTextarea label="Goal Statement" value={newGoal.goal_text} onChange={e=>setNG("goal_text",e.target.value)} rows={3} placeholder="By [date], [student] will [behaviour] with [criteria]…"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <UInput label="Baseline" value={newGoal.baseline} onChange={e=>setNG("baseline",e.target.value)} placeholder="e.g. 52 wcpm"/>
              <UInput label="Target" value={newGoal.target} onChange={e=>setNG("target",e.target.value)} placeholder="e.g. 80 wcpm"/>
              <UInput label="Due Date" value={newGoal.due_date} onChange={e=>setNG("due_date",e.target.value)} type="date"/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setShowNewGoal(false)} style={{flex:1,fontSize:12}}>Cancel</button>
              <button className="btn-purple" onClick={handleAddGoal} disabled={saving} style={{flex:2,fontSize:12,padding:"13px"}}>
                {saving?<><Spin/> Saving…</>:"Add Goal →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    <Page title={<>Goals <span className="serif-italic" style={{fontSize:26}}>Tracker</span></>}
      subtitle={loading?"Loading…":`${stats.total} goals across ${new Set(enriched.map(g=>g.student_id)).size} students`}
      action={<button className="btn-black" onClick={()=>setShowNewGoal(true)} style={{fontSize:11,padding:"11px 22px"}}>+ Add Goal</button>}>

      {loading&&<div style={{textAlign:"center",padding:60,color:C.warm}}>Loading goals from Supabase…</div>}

      {!loading&&dbStudents?.length===0&&(
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>🎯</div>
          <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:8}}>No Students Yet</h3>
          <p style={{fontSize:13,color:C.warm,marginBottom:24}}>Add students first, then create goals for them through the ALP Builder.</p>
          <button className="btn-purple" onClick={()=>setPage("students")} style={{fontSize:12}}>Go to Students →</button>
        </div>
      )}

      {!loading&&dbStudents?.length>0&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:12,marginBottom:20}}>
            {[["TOTAL GOALS",stats.total,C.purple],["ON TRACK",stats.onTrack,C.green],["DEVELOPING",stats.developing,C.amber],["NEEDS SUPPORT",stats.needs,C.red]].map(([l,v,c])=>(
              <div key={l} className="card" style={{padding:"16px 20px",borderLeft:`3px solid ${c}`}}>
                <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
                <div className="serif" style={{fontSize:28,fontWeight:700,color:c}}><AnimCounter value={v}/></div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <div style={{position:"relative",flex:1,minWidth:160}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.warm}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search goals or students…"
                style={{width:"100%",padding:"9px 10px 9px 30px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:12,background:C.white,color:C.black,outline:"none"}}/>
            </div>
            {filters.map(([id,label])=>(
              <button key={id} onClick={()=>setFilter(id)} className={filter===id?"btn-black":"btn-ghost"} style={{fontSize:11,padding:"9px 16px",flexShrink:0}}>{label}</button>
            ))}
          </div>

          {filtered.length===0&&allGoals.length===0?(
            <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:12}}>🎯</div>
              <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Goals Created Yet</h3>
              <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Create goals through the ALP Builder or click "Add Goal" above.</p>
              <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:12}}>Open ALP Builder →</button>
            </div>
          ):(
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table className="data-table" style={{minWidth:680}}>
                  <thead><tr>{["Student","Domain","Goal","Progress","Status","Due Date",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filtered.map(g=>(
                      <tr key={g.id}>
                        <td><div style={{fontWeight:600,color:C.black}}>{g.studentName}</div><div style={{fontSize:10,color:C.warm}}>{g.grade?`Grade ${g.grade}`:""}</div></td>
                        <td><span style={{background:g.color+"18",color:g.color,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{g.domain}</span></td>
                        <td style={{maxWidth:240}}><p style={{fontSize:12,color:C.black,margin:0,lineHeight:1.5}}>{g.goal_text}</p>{g.baseline&&<p style={{fontSize:10,color:C.warm,margin:"4px 0 0"}}>Baseline: {g.baseline} → Target: {g.target}</p>}</td>
                        <td style={{width:140}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1,height:6,background:C.tanL,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${g.pct}%`,background:g.color,borderRadius:99}}/></div>
                            <span style={{fontSize:11,fontWeight:700,color:g.color,width:32}}>{g.pct}%</span>
                          </div>
                        </td>
                        <td><span style={{fontSize:11,fontWeight:600,color:g.color,background:g.color+"14",padding:"3px 10px",borderRadius:99}}>{g.statusLabel}</span></td>
                        <td style={{fontSize:11,color:C.warm}}>{g.due_date||g.due_date_formatted||"–"}</td>
                        <td><button className="btn-ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setPage("progress")}>Track →</button></td>
                      </tr>
                    ))}
                    {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:"center",padding:28,color:C.warm,fontSize:13}}>No goals match this filter.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Page>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// DOCUMENTS PAGE
// ═══════════════════════════════════════════════════════════
function DocumentsPage({setPage}){
  const {toast}=useToast();
  const {copy,copied}=useCopy();
  const {isMobile}=useResponsive();
  const {students:dbStudents}=useSupabaseAuth();
  const [tab,setTab]=useState("all");
  const [search,setSearch]=useState("");
  const [uploading,setUploading]=useState(false);

  const docs=[
    ...(dbStudents||[]).flatMap(s=>[
      {id:s.id+"_alp",name:`${s.name} — ALP ${new Date().getFullYear()}–${new Date().getFullYear()+1}`,student:s.name,type:"ALP",size:"–",date:s.created_at?new Date(s.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"–",status:s.alp_completed?"Signed":"Draft",icon:"📋",color:C.purple},
    ]),
    {id:8,name:"District Progress Review Report Q3.xlsx",student:"All Students",type:"Report",size:"3.8 MB",date:"May 5, 2026",status:"Exported",icon:"📊",color:C.blue},
  ];

  const tabs=[["all","All"],["ALP","ALPs"],["Progress","Progress Reports"],["Evaluation","Evaluations"],["Consent","Consent Forms"]];
  const filtered=docs.filter(d=>(tab==="all"||d.type===tab)&&(!search||d.name.toLowerCase().includes(search.toLowerCase())||d.student.toLowerCase().includes(search.toLowerCase())));
  const statColors={Signed:C.green,Shared:C.blue,"On File":C.warm,Sent:C.blue,Pending:C.amber,Exported:C.purple};

  function handleUpload(){
    setUploading(true);
    setTimeout(()=>{setUploading(false);toast("Document uploaded successfully","success");},1200);
  }

  return(
    <Page title={<>Documents <span className="serif-italic" style={{fontSize:26}}>& Files</span></>}
      subtitle={`${docs.length} documents · ${docs.filter(d=>d.status==="Pending").length} pending`}
      action={
        <button className="btn-black" onClick={handleUpload} disabled={uploading} style={{fontSize:11,padding:"11px 22px"}}>
          {uploading?<><Spin/>Uploading…</>:"⬆ Upload Document"}
        </button>
      }>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[["TOTAL DOCS",docs.length,C.purple,"📁"],["SIGNED",docs.filter(d=>d.status==="Signed").length,C.green,"✍️"],["PENDING",docs.filter(d=>d.status==="Pending").length,C.amber,"⏳"],["THIS MONTH",docs.filter(d=>d.date.includes("May 2026")||d.date.includes("Apr 2026")).length,C.blue,"📅"]].map(([l,v,c,ic])=>(
          <div key={l} className="card" style={{padding:"16px 20px",borderLeft:`3px solid ${c}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
                <div className="serif" style={{fontSize:28,fontWeight:700,color:c}}>{v}</div>
              </div>
              <span style={{fontSize:28,opacity:.2}}>{ic}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {tabs.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} className={tab===id?"btn-black":"btn-ghost"} style={{fontSize:11,padding:"8px 14px"}}>{label}</button>
          ))}
        </div>
        <div style={{position:"relative",marginLeft:"auto",minWidth:180}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.warm}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents…"
            style={{width:"100%",padding:"8px 10px 8px 30px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:12,background:C.white,color:C.black,outline:"none"}}/>
        </div>
      </div>

      {/* Document list */}
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table className="data-table" style={{minWidth:600}}>
            <thead><tr>{["Document","Student","Type","Size","Date","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(d=>(
                <tr key={d.id}>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:20}}>{d.icon}</span>
                      <span style={{fontSize:13,fontWeight:600,color:C.black}}>{d.name}</span>
                    </div>
                  </td>
                  <td style={{fontSize:12,color:C.warm}}>{d.student}</td>
                  <td><span style={{background:d.color+"18",color:d.color,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99}}>{d.type}</span></td>
                  <td style={{fontSize:12,color:C.warm}}>{d.size}</td>
                  <td style={{fontSize:12,color:C.warm}}>{d.date}</td>
                  <td><span style={{fontSize:11,fontWeight:600,color:statColors[d.status]||C.warm}}>{d.status}</span></td>
                  <td>
                    <div style={{display:"flex",gap:6}}>
                      <button className="btn-ghost" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>toast(`Downloading ${d.name}…`,"info")}>⬇</button>
                      <button className="btn-ghost" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>{copy("https://growwithalp.com/plans/marcus-johnson-2026");toast("Link copied to clipboard","success");}}>🔗</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:"center",padding:"28px",color:C.warm}}>No documents found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick upload area */}
      <div style={{marginTop:16,border:`2px dashed ${C.tanL}`,borderRadius:14,padding:"24px",textAlign:"center",cursor:"pointer",transition:"all .2s"}}
        onClick={handleUpload}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple;e.currentTarget.style.background="#FAF8FF";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.background="transparent";}}>
        <div style={{fontSize:32,marginBottom:8}}>📎</div>
        <p style={{fontSize:14,fontWeight:600,color:C.black,marginBottom:4}}>Drop files here or click to upload</p>
        <p style={{fontSize:12,color:C.warm}}>PDF, Word, Excel, Images up to 25MB</p>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// TIMELINE PAGE — Student ALP History & Activity
// ═══════════════════════════════════════════════════════════
function TimelinePage({setPage}){
  const {isMobile}=useResponsive();
  const {toast}=useToast();
  const {students:dbStudents,user,profile}=useSupabaseAuth();
  const [studentId,setStudentId]=useState(null);
  const [filter,setFilter]=useState("all");
  const [allEvents,setAllEvents]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(dbStudents?.length&&!studentId) setStudentId(dbStudents[0].id);
  },[dbStudents]);

  const s=dbStudents?.find(st=>st.id===studentId)||null;
  const byline=profile?.full_name||user?.email?.split("@")[0]||"You";

  useEffect(()=>{
    if(!s?.id){setLoading(false);setAllEvents([]);return;}
    setLoading(true);
    Promise.all([
      Supabase.getGoals(s.id),
      Supabase.getProgress(s.id,50),
    ]).then(([goals,progress])=>{
      const events=[];
      if(s.created_at){
        events.push({date:s.created_at,type:"created",icon:"🎉",title:`ALP Created for ${s.plan_year||new Date(s.created_at).getFullYear()}`,desc:`Student record created for ${s.name}, Grade ${s.grade||"–"}.`,color:C.green,by:byline});
      }
      (goals||[]).forEach(g=>{
        if(g.created_at) events.push({date:g.created_at,type:"update",icon:"🎯",title:`Goal Added — ${g.domain}`,desc:g.goal_text,color:C.purple,by:byline});
      });
      (progress||[]).forEach(p=>{
        events.push({date:p.date||p.created_at,type:"data",icon:"📊",title:"Progress Data Logged",desc:`Score: ${p.score}${p.notes?" — "+p.notes:""}`,color:C.blue,by:byline});
      });
      if(s.alp_completed_date){
        events.push({date:s.alp_completed_date,type:"review",icon:"📋",title:"ALP Review Completed",desc:s.review_notes||"Annual review completed and signed off.",color:C.purple,by:byline});
      }
      events.sort((a,b)=>new Date(b.date)-new Date(a.date));
      setAllEvents(events);
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[s?.id]);

  const filterTypes={all:"All",review:"Reviews",progress:"Progress",data:"Data",update:"Updates",created:"Created"};
  const events=filter==="all"?allEvents:allEvents.filter(e=>e.type===filter);
  const typeColors={review:C.purple,progress:C.green,data:C.blue,update:C.amber,meeting:C.blue,signature:C.green,created:C.green};

  if(!dbStudents?.length){
    return(
      <Page title={<>Student <span className="serif-italic" style={{fontSize:26}}>Timeline</span></>} subtitle="Full ALP activity history by student">
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>🕐</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Students Yet</h3>
          <p style={{fontSize:13,color:C.warm}}>Add a student to start building their activity timeline.</p>
        </div>
      </Page>
    );
  }

  return(
    <Page title={<>Student <span className="serif-italic" style={{fontSize:26}}>Timeline</span></>}
      subtitle="Full ALP activity history by student"
      action={<div style={{display:"flex",gap:8}}>
        <button className="btn-ghost" onClick={()=>toast("Timeline export coming soon","info")} style={{fontSize:11}}>⬇ Export</button>
        <button className="btn-black" onClick={()=>setPage("progress")} style={{fontSize:11,padding:"11px 20px"}}>📈 Progress →</button>
      </div>}>

      {/* Student selector */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:600,color:C.warm,flexShrink:0}}>Student:</span>
        {dbStudents.map(st=>(
          <button key={st.id} onClick={()=>setStudentId(st.id)} className={studentId===st.id?"btn-black":"btn-ghost"}
            style={{fontSize:11,padding:"8px 14px",display:"flex",alignItems:"center",gap:6}}>
            {studentId===st.id&&<div style={{width:6,height:6,borderRadius:"50%",background:C.purple}}/>}
            {st.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {s&&(
        <div className="card" style={{padding:"18px 22px",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <Avatar name={s.name} size={48}/>
          <div style={{flex:1}}>
            <h3 style={{fontSize:16,fontWeight:700,color:C.black,marginBottom:2}}>{s.name}</h3>
            <p style={{fontSize:12,color:C.warm}}>Grade {s.grade||"–"} · {s.disability||"ALP"}</p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn-ghost" style={{fontSize:11}} onClick={()=>setPage("builder")}>Open ALP →</button>
            <button className="btn-purple" style={{fontSize:11}} onClick={()=>setPage("progress")}>Progress →</button>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {Object.entries(filterTypes).map(([id,label])=>(
          <button key={id} onClick={()=>setFilter(id)} className={filter===id?"btn-black":"btn-ghost"} style={{fontSize:10,padding:"5px 12px"}}>{label}</button>
        ))}
      </div>

      {loading&&<div style={{textAlign:"center",padding:40,color:C.warm}}>Loading timeline…</div>}

      {/* Timeline events */}
      {!loading&&events.length===0&&(
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>📭</div>
          <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:6}}>No activity yet</h3>
          <p style={{fontSize:12,color:C.warm,marginBottom:12}}>Events appear here as you build the ALP, log progress, and complete reviews.</p>
          <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:11}}>Open ALP Builder →</button>
        </div>
      )}

      {!loading&&events.length>0&&(
        <div style={{position:"relative",paddingLeft:isMobile?20:32}}>
          <div style={{position:"absolute",left:isMobile?8:16,top:8,bottom:8,width:2,background:C.tanL,borderRadius:1}}/>
          {events.map((ev,i)=>(
            <div key={i} style={{position:"relative",marginBottom:20,paddingLeft:isMobile?16:24}}>
              <div style={{position:"absolute",left:isMobile?-18:-26,top:4,width:16,height:16,borderRadius:"50%",background:typeColors[ev.type]||C.purple,border:`3px solid ${C.bg}`,boxShadow:`0 0 0 2px ${(typeColors[ev.type]||C.purple)}44`}}/>
              <div className="card" style={{padding:"14px 18px",transition:"all .2s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.purple}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.tanL}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,flexWrap:"wrap",gap:6}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:16}}>{ev.icon}</span>
                    <span style={{fontSize:13,fontWeight:700,color:C.black}}>{ev.title}</span>
                    <span style={{fontSize:9,fontWeight:800,color:typeColors[ev.type],background:(typeColors[ev.type]||C.purple)+"18",padding:"2px 7px",borderRadius:99,letterSpacing:".05em"}}>{ev.type.toUpperCase()}</span>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
                    <span style={{fontSize:11,color:C.warm}}>{ev.by}</span>
                    <span style={{fontSize:11,fontWeight:600,color:C.warm}}>{ev.date?new Date(ev.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):""}</span>
                  </div>
                </div>
                <p style={{fontSize:12,color:C.warm,lineHeight:1.6,margin:0}}>{ev.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}


function ALPPrintPreview({onClose,student,goals}){
  const studentData=student||{name:"No student selected",grade:"–",dob:"–",disability:"–",teacher:"–",school:"–",year:`${new Date().getFullYear()}–${new Date().getFullYear()+1}`};
  const goalsData=goals||[];
  const domainColors={READING:"#7C3AED",COMMUNICATION:"#2563EB","SELF-REGULATION":"#D97706",WRITING:"#059669"};

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:700,maxHeight:"92vh",overflowY:"auto",background:"#fff",borderRadius:12,boxShadow:"0 25px 50px rgba(0,0,0,.3)"}}>
        {/* Toolbar */}
        <div style={{padding:"12px 20px",background:"#1a1a2e",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:"12px 12px 0 0",position:"sticky",top:0,zIndex:10}}>
          <span style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.8)"}}>📄 ALP Print Preview</span>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>window.print()} style={{padding:"8px 16px",background:"#7C3AED",color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer"}}>🖨 Print</button>
            <button onClick={onClose} style={{padding:"8px 12px",background:"rgba(255,255,255,.1)",color:"#fff",border:"none",borderRadius:6,fontSize:12,cursor:"pointer"}}>✕ Close</button>
          </div>
        </div>

        {/* Document */}
        <div style={{padding:"48px 56px",fontFamily:"'Georgia',serif",color:"#111"}}>
          {/* Header */}
          <div style={{textAlign:"center",borderBottom:"3px solid #1a1a2e",paddingBottom:24,marginBottom:28}}>
            <div style={{fontSize:9,letterSpacing:".2em",color:"#666",marginBottom:8,textTransform:"uppercase"}}>{studentData.school} · Student Support Department</div>
            <h1 style={{fontSize:26,fontWeight:700,margin:"0 0 6px",letterSpacing:"-.016em"}}>Accelerated Learning Plan</h1>
            <div style={{fontSize:11,color:"#666"}}>Academic Year {studentData.year} · Annual Program Document</div>
          </div>

          {/* Student info */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,marginBottom:28,border:"1px solid #ddd",borderRadius:4,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",background:"#f9f9f9",borderRight:"1px solid #ddd"}}>
              <div style={{fontSize:9,color:"#888",letterSpacing:".1em",textTransform:"uppercase",marginBottom:3}}>Student Full Name</div>
              <div style={{fontSize:14,fontWeight:700}}>{studentData.name}</div>
            </div>
            <div style={{padding:"10px 16px"}}>
              <div style={{fontSize:9,color:"#888",letterSpacing:".1em",textTransform:"uppercase",marginBottom:3}}>Date of Birth</div>
              <div style={{fontSize:14}}>{studentData.dob}</div>
            </div>
            <div style={{padding:"10px 16px",background:"#f9f9f9",borderRight:"1px solid #ddd",borderTop:"1px solid #ddd"}}>
              <div style={{fontSize:9,color:"#888",letterSpacing:".1em",textTransform:"uppercase",marginBottom:3}}>Year Group / Grade</div>
              <div style={{fontSize:14}}>Grade {studentData.grade}</div>
            </div>
            <div style={{padding:"10px 16px",borderTop:"1px solid #ddd"}}>
              <div style={{fontSize:9,color:"#888",letterSpacing:".1em",textTransform:"uppercase",marginBottom:3}}>ALP Coordinator</div>
              <div style={{fontSize:14}}>{studentData.teacher}</div>
            </div>
            <div style={{padding:"10px 16px",background:"#f9f9f9",borderRight:"1px solid #ddd",borderTop:"1px solid #ddd"}}>
              <div style={{fontSize:9,color:"#888",letterSpacing:".1em",textTransform:"uppercase",marginBottom:3}}>Primary Disability Area</div>
              <div style={{fontSize:14}}>{studentData.disability}</div>
            </div>
            <div style={{padding:"10px 16px",borderTop:"1px solid #ddd"}}>
              <div style={{fontSize:9,color:"#888",letterSpacing:".1em",textTransform:"uppercase",marginBottom:3}}>Programme Period</div>
              <div style={{fontSize:14}}>{studentData.year}</div>
            </div>
          </div>

          {/* Annual Goals */}
          <h2 style={{fontSize:14,fontWeight:700,marginBottom:16,paddingBottom:6,borderBottom:"1px solid #ddd",textTransform:"uppercase",letterSpacing:".08em"}}>Annual Goals</h2>
          {goalsData.length===0&&<p style={{fontSize:12,color:"#888",fontStyle:"italic"}}>No goals recorded yet for this student.</p>}
          {goalsData.map((g,i)=>(
            <div key={i} style={{marginBottom:20,padding:"14px 16px",border:"1px solid #ddd",borderLeft:`4px solid ${domainColors[g.domain]||"#7C3AED"}`,borderRadius:"0 4px 4px 0"}}>
              <div style={{fontSize:9,fontWeight:700,color:domainColors[g.domain]||"#7C3AED",letterSpacing:".12em",marginBottom:6}}>{g.domain}</div>
              <p style={{fontSize:13,lineHeight:1.75,margin:"0 0 10px"}}>{g.goal}</p>
              <div style={{display:"flex",gap:24,fontSize:10,color:"#888"}}>
                <span>Review Date: ______________________</span>
                <span>Progress Code: _____</span>
              </div>
            </div>
          ))}

          {/* Accommodations */}
          <h2 style={{fontSize:14,fontWeight:700,margin:"24px 0 12px",paddingBottom:6,borderBottom:"1px solid #ddd",textTransform:"uppercase",letterSpacing:".08em"}}>Programme Accommodations</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:24}}>
            {["Extended time (2×) on all assessments","Graphic organisers for writing tasks","Preferential seating near teacher","Reduced distraction environment","AAC device access at all times","Peer support during group activities"].map((a,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12,padding:"4px 0"}}>
                <span style={{marginTop:2}}>☐</span>{a}
              </div>
            ))}
          </div>

          {/* Signatures */}
          <h2 style={{fontSize:14,fontWeight:700,margin:"24px 0 16px",paddingBottom:6,borderBottom:"1px solid #ddd",textTransform:"uppercase",letterSpacing:".08em"}}>Signatures</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            {[["ALP Coordinator",studentData.teacher!=="–"?studentData.teacher:""],["School Principal",""],["Parent / Guardian",studentData.parentName||""],["Student (if appropriate)",""]].map(([role,name])=>(
              <div key={role}>
                <div style={{borderBottom:"1px solid #999",marginBottom:6,paddingBottom:24,marginTop:8}}></div>
                <div style={{fontSize:11,fontWeight:700}}>{role}</div>
                {name&&<div style={{fontSize:10,color:"#666"}}>{name}</div>}
                <div style={{fontSize:9,color:"#aaa",marginTop:2}}>Date: _____________</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{marginTop:40,paddingTop:16,borderTop:"1px solid #ddd",textAlign:"center",fontSize:9,color:"#aaa",letterSpacing:".05em"}}>
            GENERATED BY ALP PLATFORM · GROWWITHALP.COM · CONFIDENTIAL STUDENT RECORD · PAGE 1 OF 1
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionNotesWidget({onClose}){
  const {toast}=useToast();
  const {students:dbStudents,user}=useSupabaseAuth();
  const [studentId,setStudentId]=useState(dbStudents?.[0]?.id||"");
  const [date,setDate]=useState(new Date().toISOString().split("T")[0]);
  const [domain,setDomain]=useState("Reading");
  const [score,setScore]=useState("");
  const [notes,setNotes]=useState("");
  const [tab,setTab]=useState("note"); // note | history
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [history,setHistory]=useState([]);
  const [loadingHistory,setLoadingHistory]=useState(false);

  useEffect(()=>{
    if(dbStudents?.length&&!studentId) setStudentId(dbStudents[0].id);
  },[dbStudents]);

  useEffect(()=>{
    if(tab!=="history")return;
    setLoadingHistory(true);
    Promise.all((dbStudents||[]).map(s=>Supabase.getProgress(s.id,5).then(entries=>(entries||[]).map(e=>({...e,studentName:s.name})))))
      .then(results=>{
        const flat=results.flat().sort((a,b)=>new Date(b.date||b.created_at)-new Date(a.date||a.created_at)).slice(0,10);
        setHistory(flat);
        setLoadingHistory(false);
      }).catch(()=>setLoadingHistory(false));
  },[tab,dbStudents]);

  async function save(){
    if(!notes.trim()&&!score)return;
    if(!studentId){toast("Select a student first","error");return;}
    setSaving(true);
    try{
      await Supabase.logProgress({student_id:studentId,score:parseFloat(score)||0,notes,date,created_by:user?.id});
      setSaved(true);
      const sName=dbStudents?.find(s=>s.id===studentId)?.name?.split(" ")[0]||"student";
      toast(`Session note saved for ${sName}! ✓`,"success");
      setTimeout(()=>{setSaved(false);setScore("");setNotes("");},1600);
    }catch(e){toast("Failed to save note","error");}
    setSaving(false);
  }

  return(
    <div style={{position:"fixed",bottom:96,right:28,zIndex:196,width:360,background:"var(--bg-secondary)",border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 16px 48px rgba(0,0,0,.22)",overflow:"hidden"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>📝</span>
          <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>Quick Session Note</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {[["note","Log"],["history","History"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99,border:"none",cursor:"pointer",background:tab===id?"rgba(255,255,255,.2)":"transparent",color:tab===id?"#fff":"rgba(255,255,255,.5)"}}>
              {label}
            </button>
          ))}
          <button onClick={onClose} style={{fontSize:18,color:"rgba(255,255,255,.5)",background:"none",border:"none",cursor:"pointer",lineHeight:1,marginLeft:4}}>×</button>
        </div>
      </div>

      {tab==="note"&&(
        <div style={{padding:"16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <USelect label="Student" value={studentId} onChange={e=>setStudentId(e.target.value)}
              options={(dbStudents||[]).map(s=>({value:s.id,label:s.name}))}/>
            <USelect label="Domain" value={domain} onChange={e=>setDomain(e.target.value)}
              options={["Reading","Math","Writing","Communication","Social-Emotional","Behaviour","OT","Speech"].map(d=>({value:d,label:d}))}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginBottom:12}}>
            <UInput label="Date" value={date} onChange={e=>setDate(e.target.value)} type="date"/>
            <UInput label="Score" value={score} onChange={e=>setScore(e.target.value)} placeholder="e.g. 72"/>
          </div>
          <div style={{marginBottom:12}}>
            <UTextarea label="Observation notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
              placeholder="What happened? Prompts used, next steps…"/>
          </div>
          <button className="btn-purple" onClick={save} disabled={(!notes.trim()&&!score)||saving}
            style={{width:"100%",fontSize:12,padding:"11px"}}>
            {saving?<><Spin/> Saving…</>:saved?"✓ Saved! — Log another":"💾 Save Note →"}
          </button>
        </div>
      )}

      {tab==="history"&&(
        <div style={{padding:"12px",maxHeight:280,overflowY:"auto"}}>
          {loadingHistory&&<p style={{fontSize:12,color:C.warm,textAlign:"center",padding:16}}>Loading…</p>}
          {!loadingHistory&&history.length===0&&<p style={{fontSize:12,color:C.warm,textAlign:"center",padding:16}}>No notes yet. Log your first session note above.</p>}
          {history.map((h,i)=>(
            <div key={i} style={{padding:"10px 12px",border:`1px solid ${C.tanL}`,borderRadius:8,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:C.black}}>{h.studentName?.split(" ")[0]||"Student"}</span>
                <span style={{fontSize:10,color:C.warm}}>{h.date?new Date(h.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}</span>
              </div>
              {h.score!=null&&<div style={{fontSize:11,color:C.purple,fontWeight:600,marginBottom:3}}>Score: {h.score}</div>}
              <p style={{fontSize:11,color:C.warm,lineHeight:1.5,margin:0}}>{h.notes}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyboardShortcutsPanel({onClose}){
  const {isMobile}=useResponsive();
  const groups=[
    {label:"Navigation",color:C.purple,shortcuts:[["⌘K","Open global search"],["?","Keyboard shortcuts"],["Esc","Close any modal"],["G + D","Go to Dashboard"],["G + S","Go to Students"],["G + B","ALP Builder"],["G + P","Progress Monitoring"],["G + R","Reports"]]},
    {label:"ALP Builder",color:C.blue,shortcuts:[["→ / PgDn","Next section"],["← / PgUp","Previous section"],["⌘S","Save current section"],["⌘G","AI Goal Architect"],["⌘P","Print preview"],["⌘Z","Undo last change"]]},
    {label:"Students",color:C.green,shortcuts:[["⌘N","Add new student"],["⌘I","Import CSV"],["⌘F","Search students"],["Click row","Open student detail"],["⊞","Toggle grid view"]]},
    {label:"Data Entry",color:C.amber,shortcuts:[["⌘L","Log CBM data"],["⌘M","New meeting"],["⌘E","Export data"],["⌘⇧R","Generate report"]]},
  ];
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:620,padding:0}}>
        <div style={{padding:"18px 24px 14px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>⌨️</span>
            <h3 style={{fontSize:17,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}} aria-label="Close">×</button>
        </div>
        <div style={{padding:"18px 24px",display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>
          {groups.map(g=>(
            <div key={g.label}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:g.color}}/>
                <p className="lbl" style={{margin:0,color:g.color}}>{g.label}</p>
              </div>
              {g.shortcuts.map(([key,desc])=>(
                <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{fontSize:12,color:C.warm}}>{desc}</span>
                  <kbd style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:C.purpleL,color:C.purple,border:`1px solid ${C.border}`,fontFamily:"monospace",fontWeight:700,flexShrink:0,marginLeft:8,whiteSpace:"nowrap"}}>{key}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{padding:"12px 24px",borderTop:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:C.warm}}>Press <kbd style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:C.purpleL,color:C.purple,border:`1px solid ${C.border}`,fontFamily:"monospace"}}>?</kbd> to toggle this panel</span>
          <button onClick={onClose} className="btn-ghost" style={{fontSize:10,padding:"5px 12px"}}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BULK ACTIONS BAR (students page)
// ═══════════════════════════════════════════════════════════
function BulkActionsBar({selected,onClear,onAction}){
  if(!selected||selected.length===0)return null;
  const {toast}=useToast();
  return(
    <div style={{position:"sticky",top:62,zIndex:50,background:"linear-gradient(135deg,#7C3AED,#6D28D9)",padding:"12px 20px",display:"flex",alignItems:"center",gap:12,borderRadius:10,marginBottom:12,boxShadow:"0 4px 20px rgba(124,58,237,.3)",flexWrap:"wrap"}}>
      <span style={{fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>{selected.length} student{selected.length!==1?"s":""} selected</span>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[["📤 Export","export"],["📧 Message All","message"],["📋 Generate Reports","report"],["🔄 Transfer","transfer"]].map(([label,action])=>(
          <button key={action} onClick={()=>{
            onAction(action,selected);
            toast(`${label.split(" ").slice(1).join(" ")} action for ${selected.length} student(s)…`,"info");
          }} style={{padding:"6px 14px",borderRadius:99,background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.25)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}>{label}</button>
        ))}
      </div>
      <button onClick={onClear} style={{marginLeft:"auto",fontSize:18,color:"rgba(255,255,255,.7)",background:"none",border:"none",cursor:"pointer",flexShrink:0}}>×</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OFFLINE INDICATOR
// ═══════════════════════════════════════════════════════════
function OfflineIndicator(){
  const [offline,setOffline]=useState(false);
  useEffect(()=>{
    const go=()=>setOffline(false);
    const stop=()=>setOffline(true);
    try{
      window.addEventListener("online",go);
      window.addEventListener("offline",stop);
      setOffline(!navigator.onLine);
    }catch{}
    return()=>{try{window.removeEventListener("online",go);window.removeEventListener("offline",stop);}catch{}};
  },[]);
  if(!offline)return null;
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"#1a1a1a",color:"#fff",textAlign:"center",padding:"8px",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
      <span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block"}}/>
      You're offline — changes will sync when you reconnect
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EXPORT ALL DATA MODAL
// ═══════════════════════════════════════════════════════════
function ExportAllDataModal({onClose}){
  const {toast}=useToast();
  const [step,setStep]=useState("select");
  const [selected,setSelected]=useState(["students","plans","progress","documents"]);
  const [format,setFormat]=useState("csv");
  const [progress,setProgress]=useState(0);

  function toggle(id){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}

  function startExport(){
    setStep("exporting");
    let p=0;
    const t=setInterval(()=>{p+=Math.random()*20+6;if(p>=100){clearInterval(t);setProgress(100);setTimeout(()=>setStep("done"),400);}else setProgress(Math.min(p,95));},180);
  }

  const dataTypes=[
    {id:"students",label:"Student Profiles",desc:"Names, grades, disabilities, contact info",icon:"👥"},
    {id:"plans",label:"ALP Documents",desc:"All 13 sections for every student",icon:"📋"},
    {id:"progress",label:"Progress Data",desc:"CBM scores, trendlines, goal tracking",icon:"📈"},
    {id:"documents",label:"Documents & Files",desc:"Reports, consent forms, evaluations",icon:"📁"},
    {id:"audit",label:"Audit Trail",desc:"All actions, changes, timestamps",icon:"🔍"},
    {id:"signatures",label:"Signatures",desc:"Digital signature records",icon:"✍️"},
  ];

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&step!=="exporting"&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:520,padding:0}}>
        <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><p className="lbl" style={{color:C.purple,marginBottom:4}}>Data Portability</p><h3 style={{fontSize:19,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>Export All Data</h3></div>
          {step!=="exporting"&&<button onClick={onClose} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}} aria-label="Close">×</button>}
        </div>

        {step==="select"&&(
          <div style={{padding:"22px 26px"}}>
            <p style={{fontSize:13,color:C.warm,marginBottom:16}}>Select the data you want to export. This is your data — you can always take it with you.</p>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {dataTypes.map(d=>(
                <label key={d.id} style={{display:"flex",gap:12,padding:"12px 14px",border:`1.5px solid ${selected.includes(d.id)?C.purple:C.tanL}`,borderRadius:10,cursor:"pointer",background:selected.includes(d.id)?C.purpleL:"transparent",transition:"all .15s"}}>
                  <div onClick={()=>toggle(d.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${selected.includes(d.id)?C.purple:C.tanL}`,background:selected.includes(d.id)?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
                    {selected.includes(d.id)&&<span style={{color:"#fff",fontSize:10,fontWeight:700}}>✓</span>}
                  </div>
                  <span style={{fontSize:18,flexShrink:0}}>{d.icon}</span>
                  <div><div style={{fontSize:13,fontWeight:600,color:C.black}}>{d.label}</div><div style={{fontSize:11,color:C.warm}}>{d.desc}</div></div>
                </label>
              ))}
            </div>
            <div style={{marginBottom:20}}>
              <p className="lbl" style={{marginBottom:10}}>Format</p>
              <div style={{display:"flex",gap:8}}>
                {["csv","json","excel"].map(f=>(
                  <button key={f} onClick={()=>setFormat(f)} style={{padding:"8px 20px",borderRadius:99,border:`1.5px solid ${format===f?C.purple:C.tanL}`,background:format===f?C.purpleL:"transparent",color:format===f?C.purple:C.warm,fontWeight:format===f?700:400,fontSize:12,cursor:"pointer",textTransform:"uppercase"}}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{background:"#DCFCE7",borderRadius:10,padding:"10px 14px",marginBottom:18,fontSize:12,color:C.green,fontWeight:600}}>
              🔒 Your data is encrypted during export. Files are automatically deleted after 24 hours.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Cancel</button>
              <button className="btn-purple" onClick={startExport} disabled={selected.length===0} style={{flex:2,fontSize:12,padding:"13px"}}>Export {selected.length} dataset{selected.length!==1?"s":""} →</button>
            </div>
          </div>
        )}

        {step==="exporting"&&(
          <div style={{padding:"40px 26px",textAlign:"center"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:C.purpleL,border:`3px solid ${C.purple}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 20px"}}><Spin color={C.purple}/></div>
            <h3 style={{fontSize:17,fontWeight:700,marginBottom:8}}>Exporting your data…</h3>
            <div style={{background:C.tanL,borderRadius:99,height:6,overflow:"hidden",marginBottom:8,maxWidth:300,margin:"0 auto 8px"}}>
              <div style={{height:"100%",background:`linear-gradient(90deg,${C.purple},#A855F7)`,borderRadius:99,width:`${progress}%`,transition:"width .2s"}}/>
            </div>
            <p style={{fontSize:12,color:C.warm}}>{Math.round(progress)}%</p>
          </div>
        )}

        {step==="done"&&(
          <div style={{padding:"32px 26px",textAlign:"center"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:"#DCFCE7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 16px"}}>📦</div>
            <h3 style={{fontSize:18,fontWeight:800,color:C.black,marginBottom:8}}>Export ready!</h3>
            <p style={{fontSize:13,color:C.warm,marginBottom:6}}>{selected.length} datasets · {format.toUpperCase()} format</p>
            <p style={{fontSize:11,color:C.warm,marginBottom:24}}>Link expires in 24 hours · Encrypted download</p>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={onClose} style={{flex:1,fontSize:12}}>Close</button>
              <button className="btn-purple" onClick={()=>{toast("Download started!","success");onClose();}} style={{flex:2,fontSize:12,padding:"12px"}}>⬇ Download Export</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RECENT ACTIVITY FEED (sidebar widget / dashboard)
// ═══════════════════════════════════════════════════════════
function timeAgo(dateStr){
  if(!dateStr)return"";
  const diff=Date.now()-new Date(dateStr).getTime();
  const mins=Math.floor(diff/60000);
  if(mins<1)return"Just now";
  if(mins<60)return`${mins}m ago`;
  const hrs=Math.floor(mins/60);
  if(hrs<24)return`${hrs}h ago`;
  const days=Math.floor(hrs/24);
  if(days<7)return`${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
function RecentActivityFeed({compact=false,limit=8}){
  const {user}=useSupabaseAuth();
  const [notifs,setNotifs]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!user?.id){setLoading(false);return;}
    Supabase.getNotifications(user.id).then(n=>{setNotifs(n||[]);setLoading(false);}).catch(()=>setLoading(false));
  },[user?.id]);

  const typeIcon={review:"📅",progress:"📊",message:"✉️",signature:"✍️",goal:"🎯"};
  const activities=notifs.slice(0,limit).map(n=>({
    icon:typeIcon[n.type]||"✏️",
    text:n.title||"Activity",
    sub:n.student||n.body?.slice(0,40)||"",
    time:n.created_at?timeAgo(n.created_at):n.time||"",
    color:n.urgent?C.amber:C.purple,
  }));

  return(
    <div>
      {!compact&&<p className="lbl" style={{marginBottom:14}}>RECENT ACTIVITY</p>}
      {!loading&&activities.length===0&&(
        <p style={{fontSize:12,color:C.warm,padding:"8px 0"}}>No recent activity yet. Activity will appear here as you work.</p>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:compact?8:0}}>
        {activities.map((a,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:compact?"8px 0":"10px 0",borderBottom:compact?"none":`1px solid ${C.tanL}`,alignItems:"flex-start"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:a.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{a.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:600,color:C.black}}>{a.text}</div>
              <div style={{fontSize:11,color:C.warm,marginTop:1}}>{a.sub}</div>
            </div>
            <span style={{fontSize:10,color:C.warm,flexShrink:0,marginTop:2}}>{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ONBOARDING MODAL — first-time user experience
// ═══════════════════════════════════════════════════════════
function OnboardingModal({onClose,setPage}){
  const {toast}=useToast();
  const [step,setStep]=useState(0);
  const [role,setRole]=useState("");
  const [country,setCountry]=useState("");
  const [name,setName]=useState("");

  const steps=[
    {title:"Welcome to ALP! 🎉",sub:"Let's get you set up in 60 seconds."},
    {title:"Tell us about yourself",sub:"We'll personalise your experience."},
    {title:"Your region",sub:"We'll show the right planning framework."},
    {title:"You're all set! 🚀",sub:"Here's where to start."},
  ];
  const roles=[
    {id:"teacher",label:"Teacher",icon:"👩‍🏫",desc:"Build ALPs, track goals"},
    {id:"director",label:"Director / School Head",icon:"🏫",desc:"Review Queue & approvals"},
    {id:"admin",label:"Administrator",icon:"📋",desc:"Staff & system management"},
    {id:"intervention",label:"Intervention Specialist",icon:"📊",desc:"RTI tiers & CBM data"},
    {id:"related",label:"Related Services",icon:"🗣",desc:"SLP, OT, PT support"},
  ];

  function finish(){
    toast(`Welcome, ${name||"Educator"}! You're ready to go.`,"success");
    onClose();
    if(setPage) setPage("students");
  }

  return(
    <div className="modal-overlay" style={{alignItems:"center",backdropFilter:"blur(8px)"}}>
      <div className="card fade-up" style={{width:"100%",maxWidth:520,padding:0,overflow:"hidden"}}>
        {/* Progress bar */}
        <div style={{height:4,background:C.tanL}}>
          <div style={{height:"100%",width:`${(step/3)*100}%`,background:C.purple,transition:"width .4s"}}/>
        </div>

        <div style={{padding:"32px 32px 28px"}}>
          {/* Step indicator */}
          <div style={{display:"flex",gap:8,marginBottom:24}}>
            {steps.map((s,i)=>(
              <div key={i} style={{flex:1,height:3,borderRadius:99,background:i<=step?C.purple:C.tanL,transition:"background .3s"}}/>
            ))}
          </div>

          <h2 className="serif" style={{fontSize:26,fontWeight:800,letterSpacing:"-.016em",marginBottom:6}}>{steps[step].title}</h2>
          <p style={{fontSize:14,color:C.warm,marginBottom:28}}>{steps[step].sub}</p>

          {/* Step 0 — welcome */}
          {step===0&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:24}}>
                {[["✏️","Build ALP Plans","10-step guided builder"],["📊","Track Progress","Weekly CBM data & charts"],["📄","Export & Share","Professional PDF for families"]].map(([ic,title,desc])=>(
                  <div key={title} style={{textAlign:"center",padding:"16px 10px",border:`1px solid ${C.tanL}`,borderRadius:12}}>
                    <div style={{fontSize:26,marginBottom:8}}>{ic}</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.black,marginBottom:3}}>{title}</div>
                    <div style={{fontSize:10,color:C.warm}}>{desc}</div>
                  </div>
                ))}
              </div>
              <button className="btn-purple" onClick={()=>setStep(1)} style={{width:"100%",fontSize:13,padding:"14px"}}>Get Started →</button>
              <button onClick={onClose} style={{width:"100%",marginTop:8,fontSize:12,color:C.warm,background:"none",border:"none",cursor:"pointer",padding:"8px"}}>Skip setup</button>
            </div>
          )}

          {/* Step 1 — role + name */}
          {step===1&&(
            <div>
              <div style={{marginBottom:16}}>
                <p className="lbl" style={{marginBottom:10}}>Your name</p>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="First name" style={{width:"100%",padding:"10px 14px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:14,outline:"none",color:C.black,boxSizing:"border-box"}}/>
              </div>
              <p className="lbl" style={{marginBottom:10}}>Your role</p>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
                {roles.map(r=>(
                  <label key={r.id} style={{display:"flex",gap:12,padding:"12px 14px",border:`1.5px solid ${role===r.id?C.purple:C.tanL}`,borderRadius:10,cursor:"pointer",background:role===r.id?C.purpleL:"transparent",transition:"all .15s"}} onClick={()=>setRole(r.id)}>
                    <span style={{fontSize:22}}>{r.icon}</span>
                    <div><div style={{fontSize:13,fontWeight:700,color:C.black}}>{r.label}</div><div style={{fontSize:11,color:C.warm}}>{r.desc}</div></div>
                    <div style={{marginLeft:"auto",width:18,height:18,borderRadius:"50%",border:`2px solid ${role===r.id?C.purple:C.tanL}`,background:role===r.id?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,alignSelf:"center"}}>{role===r.id&&<div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}</div>
                  </label>
                ))}
              </div>
              <button className="btn-purple" onClick={()=>setStep(2)} disabled={!role} style={{width:"100%",fontSize:13,padding:"14px"}}>Next →</button>
            </div>
          )}

          {/* Step 2 — country */}
          {step===2&&(
            <div>
              <p className="lbl" style={{marginBottom:12}}>Where do you teach?</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:24}}>
                {[["🇺🇸","United States"],["🇬🇭","Ghana"],["🇬🇧","United Kingdom"],["🇳🇬","Nigeria"],["🇰🇪","Kenya"],["🌍","Other"]].map(([flag,name])=>(
                  <button key={name} onClick={()=>setCountry(name)}
                    style={{padding:"12px 14px",borderRadius:10,border:`1.5px solid ${country===name?C.purple:C.tanL}`,background:country===name?C.purpleL:"transparent",cursor:"pointer",display:"flex",gap:10,alignItems:"center",fontSize:13,fontWeight:country===name?700:400,color:country===name?C.purple:C.black,transition:"all .15s"}}>
                    <span style={{fontSize:20}}>{flag}</span>{name}
                  </button>
                ))}
              </div>
              <button className="btn-purple" onClick={()=>setStep(3)} disabled={!country} style={{width:"100%",fontSize:13,padding:"14px"}}>Next →</button>
              <button style={{width:"100%",marginTop:6,fontSize:11,color:C.warm,background:"none",border:"none",cursor:"pointer"}} onClick={()=>setStep(1)}>← Back</button>
            </div>
          )}

          {/* Step 3 — done */}
          {step===3&&(
            <div>
              <div style={{background:C.purpleL,borderRadius:12,padding:"20px",marginBottom:20}}>
                <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
                  <Avatar name={name||"Educator"} size={48}/>
                  <div>
                    <div style={{fontSize:16,fontWeight:700,color:C.black}}>{name||"Welcome!"}</div>
                    <div style={{fontSize:12,color:C.warm}}>{roles.find(r=>r.id===role)?.label||"Special Educator"} · {country}</div>
                  </div>
                </div>
                <p style={{fontSize:13,color:C.warm,lineHeight:1.6}}>Your workspace is ready. Here's what to do first:</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
                {[["1","Add your first student","→ Students page"],["2","Build their ALP","→ ALP Builder"],["3","Generate ALP PDF","→ Create ALP Doc"]].map(([n,action,where])=>(
                  <div key={n} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 14px",border:`1px solid ${C.tanL}`,borderRadius:8}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:C.purple,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{n}</div>
                    <div><div style={{fontSize:13,fontWeight:600,color:C.black}}>{action}</div><div style={{fontSize:11,color:C.warm}}>{where}</div></div>
                  </div>
                ))}
              </div>
              <button className="btn-purple" onClick={finish} style={{width:"100%",fontSize:13,padding:"14px"}}>🚀 Start Using ALP →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CONFETTI CELEBRATION
// ═══════════════════════════════════════════════════════════

function Confetti({active}){
  const [items,setItems]=useState([]);
  useEffect(()=>{
    if(!active){setItems([]);return;}
    const colors=["#7C3AED","#A855F7","#F59E0B","#10B981","#3B82F6","#EF4444","#F97316"];
    setItems(Array.from({length:50},(_,i)=>({
      id:i,
      left:Math.random()*100,
      color:colors[i%colors.length],
      size:Math.random()*8+4,
      delay:Math.random()*0.6,
      dur:Math.random()*1.2+1,
    })));
    const t=setTimeout(()=>setItems([]),3000);
    return()=>clearTimeout(t);
  },[active]);
  if(!items.length)return null;
  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      {items.map(p=>(
        <div key={p.id} style={{
          position:"absolute",
          left:`${p.left}%`,
          top:"-10px",
          width:p.size,
          height:p.size*1.6,
          background:p.color,
          borderRadius:2,
          opacity:0,
          animation:`confettiFall ${p.dur}s ${p.delay}s ease-in forwards`,
          transform:`rotate(${Math.random()*360}deg)`,
        }}/>
      ))}
    </div>
  );
}

function useCopy(){
  const [copied,setCopied]=useState(false);
  function copy(text){
    try{navigator.clipboard.writeText(text);}catch{
      const el=document.createElement("textarea");
      el.value=text;document.body.appendChild(el);el.select();
      document.execCommand("copy");document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(()=>setCopied(false),1800);
  }
  return{copy,copied};
}

// ═══════════════════════════════════════════════════════════
// PWA INSTALL PROMPT
// ═══════════════════════════════════════════════════════════
function PWAInstallBanner(){
  const [prompt,setPrompt]=useState(null);
  const [dismissed,setDismissed]=useState(false);
  useEffect(()=>{
    const handler=e=>{e.preventDefault();setPrompt(e);};
    try{window.addEventListener("beforeinstallprompt",handler);}catch{}
    return()=>{try{window.removeEventListener("beforeinstallprompt",handler);}catch{}};
  },[]);
  if(!prompt||dismissed)return null;
  return(
    <div style={{position:"fixed",bottom:90,left:20,right:20,zIndex:197,background:"linear-gradient(135deg,#1a1a2e,#16213e)",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 8px 32px rgba(0,0,0,.3)",border:"1px solid rgba(124,58,237,.3)"}}>
      <div style={{fontSize:24,flexShrink:0}}>📱</div>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:2}}>Install ALP App</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Add to your home screen for quick access</div>
      </div>
      <button onClick={async()=>{prompt.prompt();const{outcome}=await prompt.userChoice;if(outcome==="accepted")setDismissed(true);}} className="btn-purple" style={{fontSize:11,padding:"8px 14px",flexShrink:0}}>Install</button>
      <button onClick={()=>setDismissed(true)} style={{fontSize:18,color:"rgba(255,255,255,.4)",background:"none",border:"none",cursor:"pointer",flexShrink:0}}>×</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PAGE LOAD PROGRESS BAR
// ═══════════════════════════════════════════════════════════
function TopProgressBar({page}){
  const [width,setWidth]=useState(0);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    setVisible(true);setWidth(0);
    const t1=setTimeout(()=>setWidth(70),50);
    const t2=setTimeout(()=>setWidth(100),350);
    const t3=setTimeout(()=>{setVisible(false);setWidth(0);},650);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[page]);
  if(!visible)return null;
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,height:2,zIndex:9999,pointerEvents:"none"}}>
      <div style={{height:"100%",width:`${width}%`,background:"linear-gradient(90deg,#7C3AED,#A855F7)",transition:"width .3s ease",borderRadius:"0 1px 1px 0",boxShadow:"0 0 8px rgba(124,58,237,.6)"}}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DYNAMIC PAGE TITLE
// ═══════════════════════════════════════════════════════════
function usePageTitle(page, unread=0){
  useEffect(()=>{
    const titles={
      dashboard:"Dashboard",students:"Students",builder:"ALP Builder",
      progress:"Progress",reports:"Reports",
      notifications:"Notifications",settings:"Settings",help:"Help",
      goals:"Goals",documents:"Documents",timeline:"Timeline",
      changelog:"What's New",future:"Future Readiness",review:"Review",
      notice:"ALP Notice",create:"Create ALP",
    };
    const pageTitle=titles[page]||"ALP Platform";
    const badge=unread>0?`(${unread}) `:"";
    try{document.title=`${badge}${pageTitle} · ALP`;}catch{}
  },[page,unread]);
}
function NewsletterForm(){
  const [email,setEmail]=useState("");
  const [done,setDone]=useState(false);
  const [loading,setLoading]=useState(false);
  function submit(){
    if(!email||!email.includes("@"))return;
    setLoading(true);
    setTimeout(()=>{setLoading(false);setDone(true);},800);
  }
  if(done) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:"#fff",fontSize:15,fontWeight:700}}>
      <span style={{fontSize:24}}>🎉</span> You're in! Check your inbox.
    </div>
  );
  return(
    <div style={{display:"flex",gap:10,maxWidth:460,margin:"0 auto",flexWrap:"wrap"}}>
      <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
        placeholder="your@school.edu" type="email"
        style={{flex:1,minWidth:220,padding:"14px 18px",borderRadius:99,border:"none",fontSize:14,outline:"none",fontFamily:"'DM Sans',sans-serif"}}/>
      <button onClick={submit} disabled={loading||!email}
        style={{padding:"14px 28px",background:"#fff",color:"#7C3AED",border:"none",borderRadius:99,fontSize:13,fontWeight:800,cursor:"pointer",flexShrink:0,transition:"all .18s",opacity:loading||!email?.includes("@")?0.7:1}}
        onMouseEnter={e=>e.currentTarget.style.background="#F5F3FF"}
        onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
        {loading?<Spin color="#7C3AED"/>:"Subscribe →"}
      </button>
    </div>
  );
}
function Landing({onEnter,onSignup,onDemo,navPage,setNavPage}){
  const [showDownload,setShowDownload]=useState(false);
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  // Prevent horizontal overflow on mobile
  if(typeof document!=="undefined")document.body.style.overflowX="hidden";
  const features=[
    {n:"01",title:"ALP Builder",italic:"13-Section",desc:"Guided workflow builds structured learning plans in 15–20 minutes. AI suggests measurable SMART goals."},
    {n:"02",title:"Progress Monitoring",italic:"Real-Time",desc:"CBM tracking with visual dashboards and automatic alerts when students fall behind trajectory."},
    {n:"03",title:"Family Collaboration",italic:"Built-In",desc:"Parents see plans, message teachers, schedule meetings, and sign documents — all in one portal."},
    {n:"04",title:"Progress Engine",italic:"Global",desc:"ALP standards, Support Plans, Ghana, UK, Nigeria, and more. One-click audit-ready reports."},
    {n:"05",title:"ALP AI Goal Architect",italic:"ALP AI",desc:"Drafts measurable annual goals based on the student's profile, disability, and baseline data."},
    {n:"06",title:"ALP Document Exporter",italic:"Instant",desc:"Export signed, professional ALP PDFs ready to share with families and district administrators."},
  ];
  // Scroll to top on page change
  useEffect(()=>{try{window.scrollTo({top:0,behavior:'smooth'});}catch{}},[navPage]);
  // Sub-page routing
  if(navPage==="Privacy")     return <PrivacyPage setPage={()=>{}} setNavPage={setNavPage}/>;
  if(navPage==="Terms")       return <TermsPage setPage={()=>{}} setNavPage={setNavPage}/>;
  if(navPage==="Data")        return <DataPage setPage={()=>{}} setNavPage={setNavPage}/>;
  if(navPage==="Features")    return <FeaturesPage setNavPage={setNavPage} onEnter={onEnter} onSignup={onSignup} onDemo={onDemo}/>;
  if(navPage==="For Schools") return <ForSchoolsPage setNavPage={setNavPage} onEnter={onEnter} onSignup={onSignup} onDemo={onDemo}/>;
  if(navPage==="Pricing")     return <PricingPage setNavPage={setNavPage} onEnter={onEnter} onSignup={onSignup} onDemo={onDemo}/>;
  if(navPage==="Resources")   return <ResourcesPage setNavPage={setNavPage} onEnter={onEnter} onSignup={onSignup} onDemo={onDemo}/>;

  return(
    <div style={{minHeight:"100vh",background:"#ffffff",overflowX:"hidden",width:"100%"}}>
      {showDownload&&<DownloadModal onClose={()=>setShowDownload(false)}/>}
      <>
      <nav style={{position:"sticky",top:0,zIndex:100,background:"#111",backdropFilter:"blur(14px)",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",padding:"0 clamp(16px,4vw,48px)",height:62,gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1,overflow:"hidden"}}>
          <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:32,height:32,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
          <span className="serif" style={{fontSize:15,fontWeight:700,color:"#fff",flexShrink:0}}>ALP</span>
          <span className="landing-nav-tagline" style={{fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:".1em",textTransform:"uppercase",marginLeft:2}}>ACCELERATED LEARNING PROGRAM</span>
        </div>
        <div className="landing-nav-links" style={{display:"flex",gap:28,fontSize:13.5,flexShrink:0}}>
          {["Features","For Schools","Pricing","Resources"].map(n=>(
            <span key={n} onClick={()=>setNavPage(n)}
              style={{cursor:"pointer",transition:"color .15s",fontWeight:navPage===n?700:400,color:"rgba(255,255,255,.85)",borderBottom:navPage===n?"2px solid #fff":"2px solid transparent",paddingBottom:2,whiteSpace:"nowrap"}}
              onMouseEnter={e=>e.currentTarget.style.color="#fff"}
              onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.85)"}>{n}</span>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          <ThemeToggle/>
          <button className="landing-nav-desktop" onClick={onEnter} style={{padding:"8px 18px",fontSize:11,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:"rgba(255,255,255,.15)",color:"#fff",border:"1.5px solid rgba(255,255,255,.4)",borderRadius:99,cursor:"pointer",transition:"all .18s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.25)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}>Log in</button>
          <button className="landing-nav-desktop" onClick={onSignup||onEnter} style={{padding:"8px 18px",fontSize:11,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:C.purple,color:"#fff",border:"none",borderRadius:99,cursor:"pointer",transition:"all .18s"}} onMouseEnter={e=>e.currentTarget.style.background="#6D28D9"} onMouseLeave={e=>e.currentTarget.style.background=C.purple}>Sign Up Free</button>
          <button className={`landing-nav-hamburger${mobileNavOpen?" open":""}`} onClick={()=>setMobileNavOpen(o=>!o)} aria-label="Menu">
            <span style={{background:"#fff"}}/><span style={{background:"#fff"}}/><span style={{background:"#fff"}}/>
          </button>
        </div>
      </nav>
      {mobileNavOpen&&(
        <div style={{position:"fixed",top:62,left:0,right:0,zIndex:99,background:"#111",borderBottom:"1px solid rgba(255,255,255,.1)",padding:"8px 20px 20px",boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}>
          {["Features","For Schools","Pricing","Resources"].map(n=>(
            <div key={n} onClick={()=>{setNavPage(n);setMobileNavOpen(false);}} style={{padding:"14px 0",fontSize:15,fontWeight:500,color:"rgba(255,255,255,.9)",borderBottom:"1px solid rgba(255,255,255,.08)",cursor:"pointer"}}>{n}</div>
          ))}
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={()=>{onEnter();setMobileNavOpen(false);}} style={{flex:1,padding:"12px",fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",background:"rgba(255,255,255,.12)",color:"#fff",border:"1px solid rgba(255,255,255,.3)",borderRadius:99,cursor:"pointer"}}>Log In</button>
            <button onClick={()=>{(onSignup||onEnter)();setMobileNavOpen(false);}} style={{flex:1,padding:"12px",fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",background:C.purple,color:"#fff",border:"none",borderRadius:99,cursor:"pointer"}}>Sign Up Free</button>
          </div>
        </div>
      )}
      </>

      <section style={{background:"#18003d",padding:"0"}}><div style={{padding:"clamp(48px,8vw,96px) clamp(20px,4vw,48px) clamp(48px,6vw,80px)",maxWidth:1100,margin:"0 auto"}} className="fade-up">
        <p className="lbl hero-fade-1" style={{marginBottom:24,color:"#a78bfa",letterSpacing:".14em",display:"flex",alignItems:"center",gap:8}}><span style={{background:"linear-gradient(90deg,#7C3AED,#A855F7)",padding:"3px 10px",borderRadius:99,color:"#fff",fontSize:10}}>NEW</span>Now available · Spring 2026 · 10+ global frameworks</p>
        <h1 className="serif hero-fade-2" style={{fontSize:"clamp(54px,7vw,96px)",fontWeight:800,lineHeight:1.02,letterSpacing:"-.042em",marginBottom:32,maxWidth:820,color:"#fff"}}>
          Supporting Every<br/><span className="serif-italic" style={{color:"#a78bfa"}}>Learner's Growth.</span>
        </h1>
        <p className="hero-fade-3" style={{fontSize:18,color:"rgba(255,255,255,.7)",maxWidth:520,lineHeight:1.78,marginBottom:52}}>A complete student intervention and progress monitoring system — designed to help schools worldwide support every learner through structured plans, real-time tracking, and professional ALP documentation.</p>
        <div className="r-hero-btns hero-fade-4" style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={onSignup||onEnter} style={{fontSize:11,padding:"15px 38px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:C.purple,color:"#fff",border:"none",borderRadius:99,cursor:"pointer",transition:"all .18s",display:"inline-flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#6D28D9"} onMouseLeave={e=>e.currentTarget.style.background=C.purple}>🚀 Start Free →</button>
          <button onClick={()=>setShowDownload(true)} style={{fontSize:11,padding:"14px 34px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:"transparent",color:"#fff",border:"1.5px solid rgba(255,255,255,.5)",borderRadius:99,cursor:"pointer",transition:"all .18s",display:"inline-flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.borderColor="#fff"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.5)"}>⬇ Download Desktop App</button>
          <button style={{fontSize:11,padding:"14px 28px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.8)",border:"1px solid rgba(255,255,255,.2)",borderRadius:99,cursor:"pointer",transition:"all .18s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"} onClick={onDemo}>📅 Schedule a Demo</button>
        </div>
        <div style={{display:"flex",gap:"clamp(20px,4vw,56px)",marginTop:"clamp(32px,5vw,64px)",paddingTop:"clamp(24px,4vw,48px)",flexWrap:"wrap",borderTop:"1px solid rgba(255,255,255,.1)"}}>
          {[["10+","Countries supported"],["ALP standards & GES","Global frameworks"],["ALP AI","Goal generation"],["privacy standards","Private & secure"]].map(([v,l])=><div key={l}><div className="serif" style={{fontSize:24,fontWeight:700,color:"#fff"}}>{v}</div><div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{l}</div></div>)}
        </div>
      </div></section>

      <div className="ticker-wrap">
        <div className="ticker-inner">
          {[...Array(8)].map((_,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:28,paddingRight:56,fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.warm}}>
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>ALP Standards
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>ALP AI Goal Generation
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>Family Collaboration
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>Progress Monitoring
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>Ghana · UK · Nigeria · Australia NCCD
          </span>)}
        </div>
      </div>


      {/* ── STATS ──────────────────────────────────────── */}
      <section style={{background:"#0d0d0d",padding:"clamp(28px,4vw,36px) clamp(20px,4vw,48px)"}}>
        <div className="r-stats-row" style={{maxWidth:900,margin:"0 auto",display:"flex",justifyContent:"space-around",gap:24,flexWrap:"wrap"}}>
          {[["10","Step ALP workflow"],["Birth–22+","Age range covered"],["Free","To get started"],["Built for","Schools everywhere"]].map(([v,l])=>(
            <div key={l} style={{textAlign:"center",padding:"8px 0"}}>
              <div className="serif" style={{fontSize:"clamp(22px,4vw,36px)",fontWeight:800,color:"#A78BFA",letterSpacing:"-.026em",lineHeight:1}}>{v}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.35)",marginTop:6,letterSpacing:".04em"}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </section>


      {/* ── BUILT FOR EDUCATORS EVERYWHERE ──────────────────── */}
      <section style={{background:C.white,padding:"clamp(40px,5vw,56px) clamp(20px,4vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:".16em",textTransform:"uppercase",color:C.warm,marginBottom:14}}>Built for educators everywhere</p>
          <p style={{fontSize:14,color:C.black,maxWidth:560,margin:"0 auto",lineHeight:1.7}}>
            ALP is designed to work for schools, learning centers, and individual educators anywhere in the world — no matter your country's framework or curriculum standards.
          </p>
        </div>
      </section>




      {/* ── KEY FEATURES STRIP ──────────────────────────── */}
      <section style={{background:C.white,padding:"clamp(48px,6vw,72px) clamp(20px,4vw,48px)",borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{textAlign:"center",marginBottom:16,color:C.purple}}>Everything You Need</p>
          <h2 className="serif" style={{fontSize:"clamp(26px,4vw,46px)",fontWeight:700,textAlign:"center",letterSpacing:"-.026em",marginBottom:48,lineHeight:1.1}}>
            Built specifically for<br/><span className="serif-italic">special education.</span>
          </h2>
          <div className="r-feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
            {[
              {icon:"✦",title:"AI Goal Architect",desc:"Generate 3 SMART goal options from baseline data in seconds. ALP standards, GES & SEND aligned.",color:C.purple},
              {icon:"📈",title:"Progress Monitoring",desc:"CBM probes, trendlines, 3-point rule alerts. Weekly data that drives decisions.",color:C.blue},
              {icon:"📄",title:"PDF Export",desc:"Professional ALP documents ready to print, email, or archive — generated from real student data.",color:C.green},
              {icon:"✅",title:"Progress Engine",desc:"10+ global frameworks. Real-time tracking flags missing elements before reviews.",color:C.amber},
              {icon:"📋",title:"13-Section Builder",desc:"Complete adaptive learning program in one guided flow. Every section, every field.",color:C.red},
              {icon:"👥",title:"Multi-Role System",desc:"Teachers, directors, administrators, intervention specialists, and related services staff — each with the tools they need.",color:C.purple},
              {icon:"🌍",title:"Global Frameworks",desc:"ALP standards USA, Ghana, UK, Nigeria, Kenya and more.",color:C.blue},
              {icon:"📤",title:"Export & Reporting",desc:"Professional PDF documents, audit trails, compliance reports, district summaries.",color:C.green},
            ].map(f=>(
              <div key={f.title} className="card" style={{padding:"24px 22px",transition:"all .2s",cursor:"pointer"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=f.color;e.currentTarget.style.transform="translateY(-3px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.transform="none";}}>
                <div style={{width:40,height:40,borderRadius:10,background:f.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:14}}>{f.icon}</div>
                <h3 style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:6}}>{f.title}</h3>
                <p style={{fontSize:12,color:C.warm,lineHeight:1.6}}>{f.desc}</p>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:32}}>
            <button className="btn-purple" onClick={()=>setNavPage("Features")} style={{fontSize:12,padding:"13px 32px"}}>See All Features →</button>
          </div>
        </div>
      </section>


      <section style={{background:"#fff",padding:"clamp(56px,8vw,96px) clamp(20px,4vw,48px)",borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{marginBottom:16,textAlign:"center",color:C.purple}}>How It Works</p>
          <h2 className="serif" style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:700,textAlign:"center",letterSpacing:"-.026em",marginBottom:48,lineHeight:1.1}}>
            Designed for teachers,<br/><span className="serif-italic">built for any school.</span>
          </h2>
          <div className="r-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
            {[
              {q:"A guided 10-step workflow takes you from student information all the way through goals, accommodations, and review sign-off.",icon:"📋",c:"#7C3AED"},
              {q:"AI-assisted goal writing turns baseline data into SMART goal suggestions — with baseline, target, and monitoring method ready to refine.",icon:"✨",c:"#2563EB"},
              {q:"Built to flex with any country's planning requirements — not locked to a single state or national framework.",icon:"🌍",c:"#16A34A"},
              {q:"Manage every student's goals, services, reports, and meetings in one place instead of scattered spreadsheets and folders.",icon:"🗂️",c:"#9333EA"},
              {q:"Once an ALP is approved, generate a professional PDF in one click — ready to print, email, or keep on file for every student.",icon:"📄",c:"#0891B2"},
              {q:"A clean onboarding flow gets new teachers comfortable with the platform from their very first session.",icon:"🚀",c:"#D97706"},
            ].map((t,i)=>(
              <div key={i} className="card" style={{padding:"26px 24px",position:"relative",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"} onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                <div style={{fontSize:28,marginBottom:14}}>{t.icon}</div>
                <p className="serif" style={{fontSize:13.5,fontStyle:"italic",lineHeight:1.8,color:C.black}}>{t.q}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{background:"#fff",padding:"0"}}><div style={{padding:"clamp(48px,7vw,96px) clamp(20px,4vw,48px)",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
          <div>
            <p className="lbl" style={{marginBottom:14}}>Platform Features</p>
            <h2 className="serif" style={{fontSize:"clamp(36px,5vw,60px)",fontWeight:700,lineHeight:1.08,letterSpacing:"-.032em"}}>Everything your<br/><span className="serif-italic">school needs.</span></h2>
          </div>
          <button style={{width:42,height:42,border:`1.5px solid ${C.black}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,background:"transparent",transition:"all .18s",marginBottom:6}} onMouseEnter={e=>e.currentTarget.style.background=C.black} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>↗</button>
        </div>
        <hr className="rule" style={{margin:"32px 0 48px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
          {features.map((f,i)=><div key={f.n} style={{padding:"36px 32px",borderRight:(i+1)%3!==0?`1px solid ${C.tanL}`:"none",borderBottom:i<3?`1px solid ${C.tanL}`:"none",transition:"background .2s"}} onMouseEnter={e=>e.currentTarget.style.background=C.white} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{fontSize:11,fontWeight:700,color:C.purple,letterSpacing:".1em",marginBottom:16}}>{f.n}</div>
            <div className="serif" style={{fontSize:19,fontWeight:700,lineHeight:1.2}}><span className="serif-italic" style={{marginRight:4}}>{f.italic}</span>{f.title}</div>
            <p style={{fontSize:13,color:C.warm,lineHeight:1.75,marginTop:12}}>{f.desc}</p>
          </div>)}
        </div></div></section>

      <section style={{background:C.black,padding:"clamp(52px,8vw,96px) clamp(20px,5vw,48px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{color:"#9A8A78",marginBottom:20}}>Access ALP your way</p>
          <h2 className="serif" style={{fontSize:"clamp(36px,5vw,64px)",fontWeight:700,color:C.cream,letterSpacing:"-.032em",marginBottom:64,lineHeight:1.08}}>Your Platform.<br/><span className="serif-italic" style={{color:"#A78BFA"}}>Your Device.</span></h2>
          <div className="r-platform-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#2D2D2D"}}>
            {[
              {icon:"🌐",label:"Web App",sub:"No download needed",cta:true},
              {svg:<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 88 88"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203z" fill="#F35325"/><path d="M39.996 6.86L87.314 0v41.745l-47.318.376z" fill="#81BC06"/><path d="M35.67 45.471l.028 34.453L0 75.48V45.268z" fill="#05A6F0"/><path d="M39.996 46.06l47.318-.376V88l-47.318-7.62z" fill="#FFBA08"/></svg>,label:"Windows",sub:"Windows 10 / 11",ver:"v2.4.1"},
              {svg:<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="white"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.46 2.208 3.09 3.792 3.029 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>,label:"macOS",sub:"macOS 12+",ver:"v2.4.1"},
              {svg:<svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50"><ellipse cx="21" cy="31" rx="14" ry="15" fill="#1a1a1a"/><ellipse cx="21" cy="33" rx="7.5" ry="9.5" fill="#f0ece0"/><ellipse cx="21" cy="11" rx="9.5" ry="10.5" fill="#1a1a1a"/><ellipse cx="21" cy="12.5" rx="5.5" ry="6.5" fill="#f0ece0"/><circle cx="18" cy="9.5" r="1.7" fill="#1a1a1a"/><circle cx="24" cy="9.5" r="1.7" fill="#1a1a1a"/><circle cx="18.6" cy="8.9" r="0.65" fill="#fff"/><circle cx="24.6" cy="8.9" r="0.65" fill="#fff"/><ellipse cx="21" cy="14.5" rx="2.8" ry="1.7" fill="#f5a623"/><ellipse cx="8" cy="30" rx="4.5" ry="9" fill="#1a1a1a" transform="rotate(-8 8 30)"/><ellipse cx="34" cy="30" rx="4.5" ry="9" fill="#1a1a1a" transform="rotate(8 34 30)"/><ellipse cx="16" cy="47" rx="5.5" ry="2.8" fill="#f5a623"/><ellipse cx="26" cy="47" rx="5.5" ry="2.8" fill="#f5a623"/></svg>,label:"Linux",sub:"Ubuntu / Debian",ver:"v2.4.1"}
            ].map(p=>(
              <div key={p.label} style={{background:"#1A1A1A",padding:"40px 32px",display:"flex",flexDirection:"column",alignItems:"flex-start"}}>
                {p.svg
                  ?<div style={{width:52,height:52,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"flex-start"}}>{p.svg}</div>
                  :<div style={{fontSize:34,marginBottom:12}}>{p.icon}</div>
                }
                <div className="serif" style={{fontSize:21,fontWeight:700,color:C.cream,marginBottom:4}}>{p.label}</div>
                <div style={{fontSize:12,color:"#9A8A78",marginBottom:20}}>{p.sub}</div>
                {p.cta
                  ?<button className="btn-purple" onClick={onEnter} style={{fontSize:11,padding:"10px 22px"}}>Open in Browser</button>
                  :<button className="btn-ghost" onClick={()=>setShowDownload(true)} style={{fontSize:11,color:"#9A8A78",borderColor:"#333"}}>{p.ver} — Download</button>
                }
              </div>
            ))}
          </div>
        </div>
      </section>

      


      {/* ── INTEGRATIONS STRIP ──────────────────── */}
      <section style={{background:C.white,padding:"clamp(32px,4vw,48px) clamp(20px,4vw,48px)",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".16em",textTransform:"uppercase",color:C.warm,marginBottom:20}}>Connects with the tools your school already uses</p>
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:"clamp(16px,3vw,40px)",flexWrap:"wrap"}}>
            {[["📊","PowerSchool"],["🏫","Infinite Campus"],["📧","Google Workspace"],["💻","Microsoft 365"],["🔒","Clever SSO"],["📋","Frontline"],["📁","Google Drive"],["📤","CSV Import"]].map(([icon,name])=>(
              <div key={name} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:C.warm,fontWeight:500,opacity:.65}}>
                <span style={{fontSize:18}}>{icon}</span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ── FINAL CTA ────────────────────────────── */}
      <section style={{background:"linear-gradient(135deg,#0B0718 0%,#1a0a3e 50%,#0B0718 100%)",padding:"clamp(72px,10vw,120px) clamp(20px,4vw,48px)"}}>
        <div style={{maxWidth:700,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(124,58,237,.2)",border:"1px solid rgba(124,58,237,.4)",borderRadius:99,padding:"6px 16px",marginBottom:24}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#A78BFA",display:"inline-block"}}/>
            <span style={{fontSize:12,color:"#A78BFA",fontWeight:600}}>Free plan available for schools — forever</span>
          </div>
          <h2 className="serif" style={{fontSize:"clamp(32px,6vw,64px)",fontWeight:800,color:"#fff",letterSpacing:"-.038em",lineHeight:1.05,marginBottom:20}}>
            Start building better<br/>
            <span className="serif-italic" style={{color:"#A78BFA"}}>learning plans today.</span>
          </h2>
          <p style={{fontSize:"clamp(14px,2vw,18px)",color:"rgba(255,255,255,.55)",lineHeight:1.75,marginBottom:36,maxWidth:520,margin:"0 auto 36px"}}>
            Built for educators everywhere. Free plan includes the full 10-step ALP Builder, AI-assisted goal writing, and progress monitoring for up to 10 students.
          </p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:28}}>
            <button className="btn-purple" onClick={onSignup} style={{fontSize:15,padding:"16px 40px",borderRadius:99,boxShadow:"0 0 40px rgba(124,58,237,.5)"}}>
              Get Started Free →
            </button>
            <button onClick={onDemo} style={{fontSize:14,padding:"16px 32px",borderRadius:99,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",cursor:"pointer",fontWeight:600,transition:"all .2s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}>
              📅 Book a Demo
            </button>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:"clamp(16px,3vw,32px)",flexWrap:"wrap"}}>
            {["No credit card","Free forever plan","Cancel anytime","Secure & private"].map(t=>(
              <div key={t} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"rgba(255,255,255,.4)"}}>
                <span style={{color:"#A78BFA",fontSize:14}}>✓</span>{t}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ── NEWSLETTER ─────────────────────────────── */}
      <section style={{background:"linear-gradient(135deg,#4C1D95,#7C3AED)",padding:"clamp(48px,7vw,80px) clamp(20px,4vw,48px)"}}>
        <div style={{maxWidth:640,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:16,color:"rgba(255,255,255,.6)"}}>Stay Updated</p>
          <h2 className="serif" style={{fontSize:"clamp(26px,4vw,44px)",fontWeight:800,color:"#fff",letterSpacing:"-.026em",marginBottom:12,lineHeight:1.1}}>
            Get ALP tips & planning<br/>updates in your inbox.
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.6)",marginBottom:32,lineHeight:1.7}}>Join 8,000+ special educators. No spam — unsubscribe anytime.</p>
          <NewsletterForm/>
        </div>
      </section>
<footer style={{background:"#0d0d0d",padding:"clamp(40px,6vw,72px) clamp(20px,5vw,48px) 0"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"clamp(28px,4vw,48px)",marginBottom:"clamp(36px,5vw,56px)"}}>
            <div>
              <div className="serif" style={{fontSize:26,fontWeight:800,marginBottom:10,color:"#fff",fontStyle:"italic",letterSpacing:"-.016em"}}>ALP.</div>
              <p style={{fontSize:13,color:"rgba(255,255,255,.5)",lineHeight:1.75,marginBottom:16}}>Accelerated Learning Plan.<br/>Supporting every learner's growth — worldwide.</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,.3)",lineHeight:1.6}}>Shalom Estate, Adenta Municipality<br/>Ghana, West Africa</p>
              <div style={{marginTop:16,display:"flex",gap:10}}>
                {[["🌍","https://www.growwithalp.com"],["✉️","mailto:hello@growwithalp.com"]].map(([icon,href])=>(
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{width:34,height:34,borderRadius:8,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,textDecoration:"none",transition:"all .18s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(124,58,237,.4)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}>{icon}</a>
                ))}
              </div>
            </div>
            {[
              {title:"Platform",links:[
                {label:"ALP Builder",fn:onSignup},{label:"Progress Monitoring",fn:onSignup},
                {label:"PDF Export",fn:onSignup},{label:"AI Goal Architect",fn:onSignup},
                {label:"All Features",fn:()=>setNavPage("Features")},
              ]},
              {title:"For Schools",links:[
                {label:"For Teachers",fn:onSignup},{label:"For Schools & Districts",fn:()=>setNavPage("For Schools")},
                {label:"Pricing",fn:()=>setNavPage("Pricing")},{label:"NGO & Gov",fn:onDemo},
                {label:"Book a Demo",fn:onDemo},
              ]},
              {title:"Resources",links:[
                {label:"Help Center",fn:()=>setNavPage("Resources")},{label:"Blog & Guides",fn:()=>setNavPage("Resources")},
                {label:"Webinars",fn:()=>setNavPage("Resources")},{label:"Contact Us",fn:onDemo},
                {label:"Schedule Demo",fn:onDemo},
              ]},
              {title:"Legal",links:[
                {label:"Privacy Policy",fn:()=>setNavPage("Privacy")},
                {label:"Terms of Service",fn:()=>setNavPage("Terms")},
                {label:"Data & Security",fn:()=>setNavPage("Data")},
                {label:"Request a DPA",fn:()=>window.open("mailto:legal@growwithalp.com?subject=DPA+Request","_blank")},
              ]},
            ].map(({title,links})=>(
              <div key={title}>
                <p style={{fontSize:10,fontWeight:800,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:18}}>{title}</p>
                {links.map(({label,fn})=>(
                  <div key={label} onClick={fn} style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:11,cursor:"pointer",transition:"color .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.color="#A78BFA"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.55)"}>{label}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,.08)",padding:"clamp(18px,2.5vw,24px) 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>© 2026 ALP Platform Inc. All rights reserved.</span>
            <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"rgba(255,255,255,.3)"}}>
                <span className="pulse" style={{width:6,height:6,borderRadius:"50%",background:"#34D399",display:"inline-block"}}/>
                Systems Operational
              </span>
              <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>
                Built by{" "}
                <a href="https://www.stanparaclete.com" target="_blank" rel="noopener noreferrer"
                  style={{color:"#A78BFA",fontWeight:700,textDecoration:"none"}}
                  onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"}
                  onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>Stan Paraclete</a>
                {" · "}
                <a href="https://www.stanparaclete.com" target="_blank" rel="noopener noreferrer"
                  style={{color:"rgba(255,255,255,.35)",textDecoration:"none"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#A78BFA"}
                  onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.35)"}>stanparaclete.com</a>
                {" · "}
                <a href="https://www.growwithalp.com" target="_blank" rel="noopener noreferrer"
                  style={{color:"rgba(255,255,255,.35)",textDecoration:"none"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#A78BFA"}
                  onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.35)"}>growwithalp.com</a>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LOGIN — matches pages 4 & 5 of prototype exactly
// ═══════════════════════════════════════════════════════════
function Login({onLogin, onBack}){
  const [tab,setTab]=useState("web");
  const [rememberMe,setRememberMe]=useState(false);
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [license,setLicense]=useState("");
  const [loading,setLoading]=useState(false);
  const [showDownload,setShowDownload]=useState(false);
  const [showForgot,setShowForgot]=useState(false);
  const [step,setStep]=useState("credentials"); // "credentials" | "role"
  const [selectedRole,setSelectedRole]=useState(null);
  const [loginError,setLoginError]=useState("");

  async function handleSignIn(){
    setLoading(true);
    const {data,error:e}=await Supabase.signIn(email,password);
    setLoading(false);
    if(e){
      if(e.message?.includes("Demo")||e.message?.includes("not configured")){
        setStep("role"); return; // Demo fallback
      }
      setLoginError(e.message||"Invalid email or password"); return;
    }
    // Real auth success — set role from profile
    onLogin(data.user?.user_metadata?.role||"teacher");
  }

  function handleRoleSelect(roleId){
    setSelectedRole(roleId);
    setTimeout(()=>onLogin(roleId),300);
  }

  return(
    <div style={{display:"flex",minHeight:"100vh"}}>
      {showDownload&&<DownloadModal onClose={()=>setShowDownload(false)}/>}
      {showForgot&&<ForgotPasswordModal onClose={()=>setShowForgot(false)}/>}

      {/* LEFT panel */}
      <div className="login-left-panel" style={{flex:1,background:"#0B0718",display:step==="role"?"none":"flex",flexDirection:"column",justifyContent:"flex-end",padding:"clamp(32px,4vw,56px)",overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle,rgba(124,58,237,.18) .8px,transparent .8px)",backgroundSize:"22px 22px"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(124,58,237,.3) 0%,transparent 55%)"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:64}}>
            <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={onBack}>
              <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:44,height:44,borderRadius:11,objectFit:"cover"}}/>
              <div><div className="serif" style={{fontSize:16,fontWeight:700,color:"#fff",lineHeight:1}}>ALP</div><div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".12em",marginTop:1}}>ACCELERATED LEARNING PROGRAM</div></div>
            </div>
            <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,.4)",background:"none",border:"1px solid rgba(255,255,255,.15)",borderRadius:99,padding:"6px 14px",cursor:"pointer"}}>← Website</button>
          </div>
          <h2 style={{fontSize:"clamp(32px,4vw,50px)",fontWeight:800,lineHeight:1.1,marginBottom:28,color:"#fff"}}>
            {step==="role"?"Welcome back,":"Welcome back to"}<br/>
            <span style={{color:C.purple}}>{step==="role"?"Choose your role.":"ALP Platform."}</span>
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:52,lineHeight:1.7,maxWidth:380}}>
            {step==="role"
              ?"Select your role to load your personalised dashboard and tools."
              :"Sign in to access your school's student intervention and progress monitoring dashboard."}
          </p>
          <div style={{display:"flex",gap:44}}>
            {[["142","Students enrolled"],["38","Active ALPs"],["74%","Goals on track"]].map(([v,l])=>(
              <div key={l}><div style={{fontSize:30,fontWeight:800,color:C.purple,letterSpacing:"-.026em"}}><AnimCounter value={v}/></div><div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:3}}>{l}</div></div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT panel */}
      <div style={{width:step==="role"?"min(620px,100vw)":"min(480px,100vw)",background:"var(--bg-secondary)",display:"flex",flexDirection:"column",justifyContent:"center",padding:"clamp(24px,4vw,52px)",position:"relative",overflowY:"auto",transition:"width .3s ease",flex:step==="role"?"0 0 auto":"0 0 auto"}}>

        {/* ── STEP 1: Credentials ─────────── */}
        {step==="credentials"&&(<>
          <h3 style={{fontSize:28,fontWeight:800,color:C.black,marginBottom:6,letterSpacing:"-.016em"}}>Sign in</h3>
          <p style={{fontSize:14,color:C.warm,marginBottom:28}}>Access your school's ALP dashboard</p>
          <div style={{display:"flex",border:`1px solid ${C.tanL}`,borderRadius:10,marginBottom:28,overflow:"hidden"}}>
            {[["web","🌐 Web App"],["desktop","🖥 Desktop App"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"11px 0",fontSize:13,fontWeight:600,background:tab===id?C.purple:"transparent",color:tab===id?"#fff":C.warm,border:"none",cursor:"pointer",transition:"all .15s"}}>{label}</button>
            ))}
          </div>
          {tab==="desktop"&&(
            <div style={{background:"rgba(124,58,237,.08)",border:`1px solid ${C.tanL}`,borderRadius:12,padding:24,textAlign:"center",marginBottom:24}}>
              <div style={{fontSize:32,marginBottom:10}}>🖥</div>
              <div style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:6}}>ALP Desktop App</div>
              <p style={{fontSize:12,color:C.warm,marginBottom:16,lineHeight:1.6}}>Download and install first, then sign in below.</p>
              <button className="btn-purple" onClick={()=>setShowDownload(true)} style={{fontSize:11,padding:"10px 22px"}}>⬇ Download for your OS</button>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:22,marginBottom:24}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <span className="lbl" style={{fontSize:9}}>School / Institution</span>
              <select className="u-select"><option>Westwood Elementary</option><option>Riverside High School</option><option>Other Institution</option></select>
            </div>
            <UInput label="Email Address" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@school.edu"/>
            {tab==="desktop"&&<UInput label="License Key" value={license} onChange={e=>setLicense(e.target.value)} placeholder="XXXX - XXXX - XXXX - XXXX"/>}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span className="lbl" style={{fontSize:9}}>Password</span><span style={{fontSize:12,color:C.purple,cursor:"pointer"}} onClick={()=>setShowForgot(true)}>Forgot password?</span></div>
              <input className="u-input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"/>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.warm,cursor:"pointer"}}><input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} style={{accentColor:C.purple}}/> Remember me for 30 days</label>
          </div>
          <button className="btn-purple" disabled={loading} onClick={handleSignIn} style={{width:"100%",padding:"15px",marginBottom:20,fontSize:13,borderRadius:10}}>
            {loading?<><Spin/>Signing in…</>:`Sign in to ${tab==="web"?"Web App →":"Desktop →"}`}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><div style={{flex:1,height:1,background:C.tanL}}/><span style={{fontSize:12,color:C.warm}}>or continue with</span><div style={{flex:1,height:1,background:C.tanL}}/></div>
          <button onClick={async()=>{setLoading(true);const{error:e}=await Supabase.signInWithGoogle();if(e){setLoginError(e.message);setLoading(false);}}}
            style={{width:"100%",padding:"12px",border:`1.5px solid ${C.tanL}`,borderRadius:10,background:"transparent",color:C.black,fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,cursor:"pointer",transition:"border-color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.purple} onMouseLeave={e=>e.currentTarget.style.borderColor=C.tanL}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <button onClick={async()=>{setLoading(true);const{error:e}=await Supabase.signInWithMicrosoft();if(e){setLoginError(e.message);setLoading(false);}}}
            style={{width:"100%",padding:"12px",border:`1.5px solid ${C.tanL}`,borderRadius:10,background:"transparent",color:C.black,fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,cursor:"pointer",transition:"border-color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#0078d4"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.tanL}>
            <svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
            Continue with Microsoft 365
          </button>
          <p style={{textAlign:"center",fontSize:13,color:C.warm,marginTop:20}}>Don't have an account? <span style={{color:C.black,fontWeight:700,cursor:"pointer"}}>Contact your district admin</span></p>
          <p onClick={onBack} style={{textAlign:"center",fontSize:12,color:C.warm,marginTop:8,cursor:"pointer"}}>← Back to website</p>
        </>)}

        {/* ── STEP 2: Role Selection ───────── */}
        {step==="role"&&(<>
          <div style={{marginBottom:28}}>
            <p style={{fontSize:12,color:C.warm,marginBottom:4}}>Signed in as <b style={{color:C.black}}>{email}</b></p>
            <h3 style={{fontSize:26,fontWeight:800,color:C.black,letterSpacing:"-.016em"}}>Select your role</h3>
            <p style={{fontSize:14,color:C.warm,marginTop:4}}>Your dashboard and tools will be personalised accordingly.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
            {ROLES.map(r=>(
              <button key={r.id} onClick={()=>handleRoleSelect(r.id)}
                style={{padding:"16px 18px",border:`2px solid ${selectedRole===r.id?r.color:C.tanL}`,borderRadius:12,background:selectedRole===r.id?r.color+"18":"transparent",textAlign:"left",cursor:"pointer",transition:"all .18s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=r.color;e.currentTarget.style.background=r.color+"12";}}
                onMouseLeave={e=>{if(selectedRole!==r.id){e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.background="transparent";}}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <span style={{fontSize:20}}>{r.icon}</span>
                  <span style={{fontSize:13.5,fontWeight:700,color:C.black}}>{r.label}</span>
                </div>
                <div style={{fontSize:11,color:C.warm,lineHeight:1.5}}>{r.desc}</div>
                <div style={{marginTop:8}}>
                  <span style={{fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:99,background:r.color+"22",color:r.color,border:`1px solid ${r.color}44`,letterSpacing:".06em"}}>{r.badge}</span>
                </div>
              </button>
            ))}
          </div>
          <p style={{textAlign:"center",fontSize:12,color:C.warm,cursor:"pointer"}} onClick={()=>setStep("credentials")}>← Back to sign in</p>
        </>)}
      </div>
    </div>
  );
}

// ─── ROLE-BASED NAVIGATION ─────────────────────────────────
const NAV_BY_ROLE = {
  admin:[
    {group:"DISTRICT",items:[{id:"dashboard",label:"Admin Dashboard",icon:"🏛"},{id:"students",label:"All Students",icon:"👥"},{id:"reviewqueue",label:"Review Queue",icon:"👁️"}]},
    {group:"MANAGEMENT",items:[{id:"reports",label:"District Reports",icon:"📊"},{id:"compliance",label:"Compliance Dashboard",icon:"📋"},{id:"auditlog",label:"Audit Log",icon:"🔍"},{id:"notifications",label:"Alerts & Notices",icon:"🔔",badge:"5"},{id:"settings",label:"System Settings",icon:"⚙️"}]},
    {group:"REPORTS",items:[{id:"create",label:"Export All Data",icon:"📤"}]},
  ],
  leadership:[
    {group:"OVERVIEW",items:[{id:"dashboard",label:"Leadership Dashboard",icon:"👔"},{id:"students",label:"All Students",icon:"👥"},{id:"reviewqueue",label:"Review Queue",icon:"👁️"}]},
    {group:"PLANS",items:[{id:"builder",label:"ALP Builder",icon:"✏️"},{id:"review",label:"Review Schedule",icon:"✅"},{id:"compliance",label:"Compliance Dashboard",icon:"📋"},{id:"future",label:"Future Readiness",icon:"🎯"}]},
    {group:"REPORTS",items:[{id:"reports",label:"School Reports",icon:"📊"},{id:"auditlog",label:"Audit Log",icon:"🔍"},{id:"notifications",label:"Notifications",icon:"🔔",badge:"3"}]},
    {group:"COLLABORATION",items:[{id:"settings",label:"Settings",icon:"⚙️"}]},
  ],
  teacher:[
    {group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"My Students",icon:"👥"}]},
    {group:"ALP BUILDER",items:[{id:"builder",label:"ALP Builder",icon:"✏️",badge:"New"},{id:"quickalp",label:"Quick ALP",icon:"⚡"},{id:"studentprofile",label:"Student Profile",icon:"🪪"},{id:"progress",label:"Progress",icon:"📈"},{id:"goals",label:"Goals",icon:"🎯"}]},
    {group:"WORKFLOW",items:[{id:"future",label:"Future Readiness",icon:"🎯"},{id:"review",label:"Review Summary",icon:"✅"},{id:"reviewqueue",label:"Review Queue",icon:"👁️"},{id:"notice",label:"ALP Notice",icon:"⚠️"},{id:"create",label:"Create ALP Doc",icon:"📄"},{id:"timeline",label:"Timeline",icon:"🕐"},{id:"documents",label:"Documents",icon:"📁"}]},
    {group:"COLLABORATION",items:[{id:"reports",label:"Reports",icon:"📊"},{id:"notifications",label:"Notifications",icon:"🔔",badge:"4"},{id:"settings",label:"Settings",icon:"⚙️"}]},
  ],
  intervention:[
    {group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"My Caseload",icon:"👥"}]},
    {group:"RTI",items:[{id:"progress",label:"Progress Monitoring",icon:"📈"},{id:"builder",label:"Intervention Plans",icon:"✏️"}]},
    {group:"WORKFLOW",items:[{id:"review",label:"Review Summary",icon:"✅"},{id:"reports",label:"Effectiveness Reports",icon:"📊"}]},
    {group:"COLLABORATION",items:[{id:"notifications",label:"Alerts",icon:"🔔",badge:"2"},{id:"settings",label:"Settings",icon:"⚙️"}]},
  ],
  related:[
    {group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"My Students",icon:"👥"}]},
    {group:"SERVICES",items:[{id:"progress",label:"Goal Progress",icon:"📈"},{id:"builder",label:"Session Notes",icon:"✏️"}]},
    {group:"REPORTS",items:[{id:"reports",label:"Service Reports",icon:"📊"},{id:"notifications",label:"Notifications",icon:"🔔",badge:"3"}]},
    {group:"COLLABORATION",items:[{id:"settings",label:"Settings",icon:"⚙️"}]},
  ],
};

const ROLE_USERS = {
  admin:      {name:"Admin View",  sub:"District Administrator"},
  leadership: {name:"Leadership View",    sub:"School Administration"},
  teacher:    {name:"Teacher",        sub:"Student Support"},
  intervention:{name:"Intervention View",  sub:"Intervention Specialist"},
  related:    {name:"Related Services",         sub:"Speech-Language Pathologist"},
};

const NAV = NAV_BY_ROLE.teacher; // legacy fallback

function Sidebar({page,setPage}){
  const {role}=useRole();
  const [collapsed,setCollapsed]=useState(false);
  const [openGroups,setOpenGroups]=useState(["MAIN","TOOLS"]);
  const unread=3;
  function toggleGroup(g){setOpenGroups(o=>o.includes(g)?o.filter(x=>x!==g):[...o,g]);}

  const {user:authUser,profile}=useSupabaseAuth(); const userName=profile?.full_name||authUser?.email?.split("@")[0]||"Teacher"; const userSchool=profile?.school||"Your School"; const userInitials=userName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"ME";

  return(
    <aside className="sidebar" style={{width:collapsed?64:220,transition:"width .2s ease",overflow:"hidden",flexShrink:0,display:"flex",flexDirection:"column",position:"relative"}}>
      {/* Logo */}
      <div style={{padding:collapsed?"14px 0":"18px 18px 14px",borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:10,justifyContent:collapsed?"center":"flex-start"}}>
        <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:32,height:32,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
        {!collapsed&&<div>
          <div className="serif" style={{fontSize:14,fontWeight:700,color:"#fff",lineHeight:1}}>ALP</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:".08em",textTransform:"uppercase"}}>{role}</div>
        </div>}
      </div>

      {/* Collapse toggle */}
      <button onClick={()=>setCollapsed(c=>!c)} title={collapsed?"Expand sidebar":"Collapse sidebar"}
        style={{position:"absolute",top:20,right:-10,width:20,height:20,borderRadius:"50%",background:"#2d2d4e",border:"1px solid rgba(255,255,255,.15)",color:"rgba(255,255,255,.5)",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}>
        {collapsed?"›":"‹"}
      </button>

      {/* Nav */}
      <div style={{flex:1,overflowY:"auto",padding:collapsed?"8px 6px":"8px 10px"}}>
        {NAV_FULL.map(group=>{
          const isOpen=openGroups.includes(group.group)||collapsed;
          return(
            <div key={group.group} style={{marginBottom:4}}>
              {!collapsed&&(
                <button onClick={()=>toggleGroup(group.group)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 8px",background:"none",border:"none",cursor:"pointer",marginBottom:2}}>
                  <span style={{fontSize:8,fontWeight:800,letterSpacing:".14em",color:"rgba(255,255,255,.3)"}}>{group.group}</span>
                  <span style={{fontSize:9,color:"rgba(255,255,255,.25)"}}>{isOpen?"▾":"▸"}</span>
                </button>
              )}
              {isOpen&&group.items.map(item=>{
                const active=page===item.id;
                return(
                  <button key={item.id} onClick={()=>setPage(item.id)} title={collapsed?item.label:undefined}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:collapsed?0:10,padding:collapsed?"10px":"9px 10px",borderRadius:8,border:"none",background:active?"rgba(124,58,237,.25)":"transparent",cursor:"pointer",transition:"all .12s",marginBottom:1,justifyContent:collapsed?"center":"flex-start",position:"relative"}}
                    onMouseEnter={e=>{if(!active)e.currentTarget.style.background="rgba(255,255,255,.06)";}}
                    onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
                    {active&&<div style={{position:"absolute",left:0,top:"18%",bottom:"18%",width:3,borderRadius:"0 3px 3px 0",background:"#A78BFA"}}/>}
                    <span style={{fontSize:collapsed?18:14,flexShrink:0}}>{item.icon}</span>
                    {!collapsed&&<span style={{fontSize:12,fontWeight:active?600:400,color:active?"#fff":"rgba(255,255,255,.6)",flex:1,textAlign:"left",whiteSpace:"nowrap"}}>{item.label}</span>}
                    {!collapsed&&item.badge&&<span style={{fontSize:9,fontWeight:800,background:item.id==="notifications"?"#EF4444":"rgba(255,255,255,.12)",color:"#fff",padding:"2px 5px",borderRadius:99}}>{item.id==="notifications"&&unread>0?unread:item.badge}</span>}
                    {item.id==="notifications"&&unread>0&&collapsed&&<div style={{position:"absolute",top:5,right:5,width:7,height:7,borderRadius:"50%",background:"#EF4444"}}/>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer — Back to landing + user info */}
      <div style={{borderTop:"1px solid rgba(255,255,255,.07)"}}>
        {!collapsed&&<button onClick={async()=>{await Supabase.signOut();}} style={{width:"100%",padding:"10px 16px",display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",fontSize:11,transition:"color .15s"}}
          onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,.7)"}
          onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.4)"}>
          <span>←</span> Back to Site
        </button>}
        <div style={{padding:collapsed?"10px 0":"10px 14px",display:"flex",gap:8,alignItems:"center",justifyContent:collapsed?"center":"flex-start"}}>
          <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,position:"relative"}}>
            {user.initials}
            <div style={{position:"absolute",bottom:0,right:0,width:8,height:8,borderRadius:"50%",background:"#10B981",border:"1.5px solid #1a1a2e"}} title="Online"/>
          </div>
          {!collapsed&&<div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,.35)",textTransform:"capitalize"}}>{user.school}</div>
          </div>}
        </div>
      </div>
    </aside>
  );
}

function Page({title,subtitle,action,children}){
  const {isMobile,isTablet}=useResponsive();
  return(
    <div className="fade-up" style={{padding:isMobile?"16px 14px 40px":isTablet?"24px 22px 50px":"32px 36px 60px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:isMobile?20:32,gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <p className="lbl" style={{marginBottom:6}}>ALP Platform</p>
          <h1 className="serif" style={{fontSize:isMobile?22:isTablet?26:30,fontWeight:700,letterSpacing:"-.016em",lineHeight:1.1}}>{title}</h1>
          {subtitle&&<p style={{fontSize:isMobile?11:13,color:C.warm,marginTop:5,lineHeight:1.4}}>{subtitle}</p>}
        </div>
        {action&&<div style={{flexShrink:0,marginTop:isMobile?4:0}}>{action}</div>}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
function Dashboard({setPage,onAddStudent}){
  const {role}=useRole();
  const {toast}=useToast();
  const {user,profile,unreadCount:realUnreadCount,students:dbStudentsRaw}=useSupabaseAuth();
  const dbStudents=dbStudentsRaw?.length||0;
  const {isMobile}=useResponsive();
  const [period,setPeriod]=useState("This Month");
  const [showChecklist,setShowChecklist]=useState(true);
  const hour=new Date().getHours();
  const greeting=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const userName=profile?.full_name||user?.email?.split("@")[0]||"Teacher";

  const activeStudents=dbStudentsRaw?.filter(s=>s.status==="Active"||!s.status)||[];
  const reviewDue=dbStudentsRaw?.filter(s=>s.review_date&&new Date(s.review_date)<=new Date(Date.now()+30*86400000))||[];
  const metrics=[
    {icon:"👥",label:"Active Students",value:String(activeStudents.length||0),change:dbStudents>0?`${dbStudents} total`:"Add first student",trend:dbStudents>0?"up":"warn",sub:"on your caseload",color:C.purple},
    {icon:"📋",label:"ALPs In Progress",value:String(dbStudents||0),change:reviewDue.length>0?`${reviewDue.length} review due`:"No reviews due",trend:reviewDue.length>0?"warn":"up",sub:"active plans",color:C.amber},
    {icon:"📈",label:"Plans This Term",value:dbStudents>0?`${dbStudents}`:"0",change:dbStudents>0?"On track":"Get started",trend:"up",sub:"students supported",color:C.green},
    {icon:"⭐",label:"Setup Progress",value:dbStudents>0?"Active":"Setup",change:dbStudents>0?"Caseload ready":"Add students",trend:dbStudents>0?"up":"warn",sub:"platform status",color:C.blue},
  ];

  const checkItems=[
    {id:1,label:"Create your first student profile",done:dbStudentsRaw&&dbStudentsRaw.length>0,page:"students"},
    {id:2,label:"Build an ALP with the AI Goal Architect",done:false,page:"builder"},
    {id:3,label:"Log a progress data point",done:false,page:"progress"},
    {id:4,label:"Generate and share an approved ALP PDF",done:false,page:"create"},
    {id:5,label:"Generate your first progress report",done:false,page:"reports"},
  ];
  const doneCount=checkItems.filter(c=>c.done).length;
  const pct=Math.round(doneCount/checkItems.length*100);

  const recentActivity=dbStudentsRaw&&dbStudentsRaw.length>0?[
    {icon:"👥",text:`${dbStudentsRaw.length} student${dbStudentsRaw.length!==1?"s":""} on your caseload`,time:"Now",color:C.purple},
    {icon:"📋",text:"ALP Builder ready — start your first plan",time:"",color:C.blue},
    {icon:"📊",text:"Set up progress monitoring for your students",time:"",color:C.green},
  ]:[
    {icon:"👋",text:"Add your first student and the rest follows from there",time:"",color:C.purple},
    {icon:"📋",text:"Build an ALP using the 10-step ALP Builder",time:"",color:C.blue},
    {icon:"📄","text":"Generate and share approved ALP PDFs with families",time:"",color:C.green},
  ];

  const dueDates=[];

  return(
    <Page>
      {/* Welcome banner — TrendiZip style */}
      <div style={{background:"linear-gradient(135deg,#0B0718,#1a0a3e)",borderRadius:16,padding:"24px 28px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:200,height:"100%",background:"linear-gradient(90deg,transparent,rgba(124,58,237,.15))",pointerEvents:"none"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#10B981"}}/>
              <span style={{fontSize:10,fontWeight:700,color:"#10B981",letterSpacing:".1em"}}>LIVE · SYSTEM OPERATIONAL</span>
            </div>
            <h2 className="serif" style={{fontSize:isMobile?22:28,fontWeight:800,color:"#fff",marginBottom:4,letterSpacing:"-.016em"}}>{greeting}, {userName.split(" ")[1]}</h2>
            <p style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>Here is your caseload performance for <b style={{color:"rgba(255,255,255,.8)"}}>{period}</b>.</p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <select value={period} onChange={e=>setPeriod(e.target.value)}
              style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"8px 12px",color:"#fff",fontSize:12,cursor:"pointer",outline:"none"}}>
              {["This Week","This Month","This Term","This Year"].map(p=><option key={p} value={p} style={{background:"#1a1a2e"}}>{p}</option>)}
            </select>
            <button className="btn-purple" onClick={()=>{onAddStudent&&onAddStudent();}} style={{fontSize:11,padding:"10px 18px",whiteSpace:"nowrap"}}>+ New Entry</button>
          </div>
        </div>
      </div>

      {/* Metric cards — TrendiZip style */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {metrics.map(m=>(
          <div key={m.label} className="card" style={{padding:"18px 20px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:60,height:60,borderRadius:"0 0 0 60px",background:m.color+"12",pointerEvents:"none"}}/>
            <div style={{fontSize:20,marginBottom:8}}>{m.icon}</div>
            <div style={{fontSize:11,color:C.warm,fontWeight:600,marginBottom:4,letterSpacing:".03em"}}>{m.label.toUpperCase()}</div>
            <div className="serif" style={{fontSize:28,fontWeight:800,color:C.black,lineHeight:1,marginBottom:6}}>{m.value}</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:10,fontWeight:700,color:m.trend==="up"?C.green:m.trend==="down"?C.red:C.amber,background:(m.trend==="up"?C.green:m.trend==="down"?C.red:C.amber)+"15",padding:"2px 7px",borderRadius:99}}>
                {m.trend==="up"?"↑ ":m.trend==="warn"?"⚠ ":""}{m.change}
              </span>
              <span style={{fontSize:10,color:C.warm}}>{m.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Onboarding checklist — TrendiZip style */}
      {showChecklist&&pct<100&&(
        <div className="card" style={{padding:"20px 24px",marginBottom:16,background:"linear-gradient(135deg,#7C3AED08,#A855F708)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:C.purpleL,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:11,fontWeight:800,color:C.purple}}>{pct}%</span>
              </div>
              <div>
                <h3 style={{fontSize:14,fontWeight:700,color:C.black,margin:0}}>Set Up Your ALP Workspace</h3>
                <p style={{fontSize:11,color:C.warm,margin:0}}>{doneCount} of {checkItems.length} tasks completed</p>
              </div>
            </div>
            <button onClick={()=>setShowChecklist(false)} style={{fontSize:18,color:C.warm,background:"none",border:"none",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
          <div style={{height:4,background:C.tanL,borderRadius:99,marginBottom:16,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.purple},#A855F7)`,borderRadius:99,transition:"width .5s"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
            {checkItems.map(item=>(
              <button key={item.id} onClick={()=>setPage(item.page)}
                style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:8,border:`1px solid ${item.done?C.green+"40":C.tanL}`,background:item.done?"#DCFCE788":"transparent",cursor:"pointer",textAlign:"left",transition:"all .15s"}}
                onMouseEnter={e=>{if(!item.done)e.currentTarget.style.borderColor=C.purple;}}
                onMouseLeave={e=>{if(!item.done)e.currentTarget.style.borderColor=C.tanL;}}>
                <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${item.done?C.green:C.tanL}`,background:item.done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {item.done&&<span style={{color:"#fff",fontSize:10,fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:12,color:item.done?C.warm:C.black,textDecoration:item.done?"line-through":"none"}}>{item.label}</span>
                {!item.done&&<span style={{marginLeft:"auto",fontSize:10,color:C.purple}}>→</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content grid */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>
        {/* Recent activity */}
        <div className="card" style={{padding:"20px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p className="lbl">RECENT STREAM</p>
            <button className="btn-ghost" onClick={()=>setPage("timeline")} style={{fontSize:10,padding:"4px 10px"}}>View all →</button>
          </div>
          {recentActivity.map((a,i)=>(
            <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:i<recentActivity.length-1?`1px solid ${C.tanL}`:"none",alignItems:"flex-start"}}>
              <div style={{width:32,height:32,borderRadius:8,background:a.color+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14}}>{a.icon}</div>
              <div style={{flex:1}}>
                <p style={{fontSize:12,color:C.black,margin:0,lineHeight:1.5}}>{a.text}</p>
                <p style={{fontSize:10,color:C.warm,margin:0,marginTop:2}}>{a.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Due dates */}
        <div className="card" style={{padding:"20px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p className="lbl">DUE DATES</p>
            <button className="btn-ghost" onClick={()=>setPage("notifications")} style={{fontSize:10,padding:"4px 10px"}}>View all →</button>
          </div>
          {dueDates.map((d,i)=>(
            <div key={i} style={{padding:"10px 0",borderBottom:i<dueDates.length-1?`1px solid ${C.tanL}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
                <p style={{fontSize:12,fontWeight:600,color:C.black,margin:0}}>{d.student}</p>
                {d.urgent&&<span style={{fontSize:9,fontWeight:700,color:C.red,background:C.red+"18",padding:"2px 6px",borderRadius:99}}>URGENT</span>}
              </div>
              <p style={{fontSize:11,color:C.warm,margin:0}}>{d.type} · {d.date}</p>
            </div>
          ))}
          <button className="btn-purple" onClick={()=>setPage("notifications")} style={{width:"100%",fontSize:11,marginTop:14}}>📅 Schedule Reviews →</button>
        </div>
      </div>
    </Page>
  );
}

function Students({setPage,onAddStudent}){
  const [selectedStudent,setSelectedStudent]=useState(null);
  const [activeTab,setActiveTab]=useState("overview");
  const [search,setSearch]=useState("");
  const [filterGrade,setFilterGrade]=useState("");
  const [filterStatus,setFilterStatus]=useState("");
  const [showImport,setShowImport]=useState(false);
  const [bulkSelected,setBulkSelected]=useState([]);
  const [sortCol,setSortCol]=useState("student");
  const [sortDir,setSortDir]=useState("asc");
  const [viewMode,setViewMode]=useState("grid");
  const {toast}=useToast();
  const isBirthdaySoon=(dob)=>{if(!dob)return false;const d=new Date(dob);const t=new Date();return d.getMonth()===t.getMonth()&&Math.abs(d.getDate()-t.getDate())<=7;};
  function toggleSort(col){if(sortCol===col){setSortDir(d=>d==="asc"?"desc":"asc");}else{setSortCol(col);setSortDir("asc");}}
  function toggleBulk(id){setBulkSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}
  function selectAll(ids){setBulkSelected(ids);}
  const [q,setQ]=useState("");const [f,setF]=useState("All");const [sel,setSel]=useState(null);
  const {students:dbStudents,realRole,archiveStudentAction,deleteStudentRecord}=useSupabaseAuth();
  const [showDeleteConfirm,setShowDeleteConfirm]=useState(false);
  const [deleteConfirmText,setDeleteConfirmText]=useState("");
  const [archiving,setArchiving]=useState(false);
  const all=dbStudents&&dbStudents.length>0?dbStudents.map(s=>({
    name:s.name,grade:s.grade||"",cat:s.disability||"ALP",plan:"ALP",planC:"purple",
    status:s.status||"Active",review:s.review_date||"",teacher:s.teacher_name||"",
    dob:s.dob||"",id:s.id,
  })):[]
  const rows=all.filter(s=>(!q||s.name.toLowerCase().includes(q.toLowerCase())||s.cat.toLowerCase().includes(q.toLowerCase()))&&(f==="All"||s.plan===f||(f==="RTI"&&s.plan.startsWith("RTI")))).sort((a,b)=>{const va=String(a[sortCol]||"").toLowerCase();const vb=String(b[sortCol]||"").toLowerCase();return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va);});

  if(sel){
    const s=sel;
    async function handleArchive(){
      setArchiving(true);
      const r=await archiveStudentAction(s.id);
      if(!r.error){toast(`${s.name} archived`,"success");setSel(null);}
      else toast(r.error.message||"Archive failed","error");
      setArchiving(false);
    }
    async function handleDelete(){
      const r=await deleteStudentRecord(s.id,s.name);
      if(!r.error){toast(`${s.name} permanently deleted`,"success");setShowDeleteConfirm(false);setSel(null);}
      else toast(r.error.message||"Only a director or admin may permanently delete a student","error");
    }
    return(
      <Page title={<>{s.name}</>} subtitle={`Grade ${s.grade.replace("th","").replace("nd","").replace("rd","").replace("st","")} · ${s.disability} · ${s.plan}`}
        action={<div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button className="btn-ghost" onClick={()=>setSel(null)} style={{fontSize:11}}>← All Students</button>
          <button className="btn-ghost" disabled={archiving} onClick={handleArchive} style={{fontSize:11,color:C.amber}}>📦 Archive</button>
          {["director","admin"].includes(realRole)&&<button className="btn-ghost" onClick={()=>setShowDeleteConfirm(true)} style={{fontSize:11,color:C.red}}>🗑 Delete Permanently</button>}
          <button className="btn-black" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"11px 24px"}}>Edit ALP</button>
        </div>}>

        {showDeleteConfirm&&(
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowDeleteConfirm(false)}>
            <div className="card fade-up" style={{width:"100%",maxWidth:440,padding:0}}>
              <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.tanL}`}}>
                <p className="lbl" style={{color:C.red,marginBottom:4}}>⚠️ PERMANENT DELETE</p>
                <h3 style={{fontSize:18,fontWeight:800,color:C.black}}>Delete {s.name}?</h3>
              </div>
              <div style={{padding:"22px 26px",display:"flex",flexDirection:"column",gap:14}}>
                <p style={{fontSize:13,color:C.warm,lineHeight:1.6}}>This permanently deletes the student record and <b>all related goals, progress data, messages, and documents</b>. This cannot be undone. Consider Archive instead if you may need this data later.</p>
                <UInput label={`Type "${s.name}" to confirm`} value={deleteConfirmText} onChange={e=>setDeleteConfirmText(e.target.value)} placeholder={s.name}/>
                <div style={{display:"flex",gap:10}}>
                  <button className="btn-ghost" onClick={()=>setShowDeleteConfirm(false)} style={{flex:1,fontSize:12}}>Cancel</button>
                  <button className="btn-purple" disabled={deleteConfirmText!==s.name} onClick={handleDelete} style={{flex:1,fontSize:12,background:C.red,opacity:deleteConfirmText!==s.name?.4:1}}>Delete Permanently</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile header */}
        <div className="card" style={{padding:"24px 28px",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <Avatar name={s.name} size={64}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <h2 className="serif" style={{fontSize:22,fontWeight:700}}>{s.name}</h2>
                <Badge color={s.planC}>{s.plan}</Badge><Dot s={s.status}/><span style={{fontSize:12,color:C.warm}}>{s.status}</span>
              </div>
              <div style={{display:"flex",gap:12,fontSize:13,color:C.warm,flexWrap:"wrap"}}>
                <span>Grade {s.grade}</span><span>DOB: {s.dob}</span><span>Teacher: {s.teacher}</span><span>Review: {s.review}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn-ghost" onClick={()=>setPage("progress")} style={{fontSize:11}}>📈 Progress</button>
              <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"10px 20px"}}>✏️ ALP Builder</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:28,marginBottom:20,borderBottom:`1px solid ${C.tanL}`,paddingBottom:0}}>
          {["overview","goals","services","documents"].map(t=><button key={t} className={`tab-btn${activeTab===t?" active":""}`} onClick={()=>setActiveTab(t)} style={{textTransform:"capitalize"}}>{t}</button>)}
        </div>

        {activeTab==="overview"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div className="card" style={{padding:"24px 28px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Student Information</h3>
              {[["Full Name",s.name],["Date of Birth",s.dob],["Grade",s.grade],["Primary Disability",s.disability],["Program Type",s.plan],["Coordinator",s.teacher],["Next Review",s.review]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}><span style={{fontSize:13,color:C.warm}}>{k}</span><span style={{fontSize:13,fontWeight:600,color:C.black}}>{v}</span></div>
              ))}
            </div>
            <div className="card" style={{padding:"24px 28px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Goal Progress</h3>
              {[{d:"Reading",v:82,c:C.purple},{d:"Communication",v:60,c:C.blue},{d:"Social-Emotional",v:70,c:C.amber}].map(g=>(
                <div key={g.d} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,fontWeight:500,color:C.black}}>{g.d}</span><span style={{fontSize:13,fontWeight:700,color:g.c}}>{g.v}%</span></div>
                  <PBar value={g.v} color={g.c}/>
                </div>
              ))}
              <div style={{marginTop:18,padding:"12px 14px",background:C.greenBg,borderRadius:10,border:`1px solid ${C.greenBd}`}}>
                <div style={{fontSize:11,fontWeight:700,color:C.green,marginBottom:4}}>REVIEW STATUS</div>
                <div style={{fontSize:13,color:C.green}}>✓ Complete · All 13 sections done</div>
              </div>
            </div>

            {/* Strengths & Challenges */}
            <div className="card" style={{padding:"24px 28px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Strengths & Challenges</h3>
              <p className="lbl" style={{color:C.green,marginBottom:10}}>Strengths</p>
              {["Strong visual-spatial memory","High motivation for preferred topics","Excellent rote memory for facts","Responds well to structured routines","Creative and detail-oriented thinker"].map(item=>(
                <div key={item} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"flex-start"}}>
                  <span style={{color:C.green,fontWeight:700,flexShrink:0}}>+</span>
                  <span style={{fontSize:12.5,color:C.black}}>{item}</span>
                </div>
              ))}
              <p className="lbl" style={{color:C.red,marginBottom:10,marginTop:16}}>Areas of Challenge</p>
              {["Reading fluency & comprehension","Sustained peer interaction","Flexible thinking & transitions","Emotional self-regulation when frustrated"].map(item=>(
                <div key={item} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"flex-start"}}>
                  <span style={{color:C.amber,fontWeight:700,flexShrink:0}}>△</span>
                  <span style={{fontSize:12.5,color:C.black}}>{item}</span>
                </div>
              ))}
            </div>

            {/* Communication & AT */}
            <div className="card" style={{padding:"24px 28px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Communication & Technology</h3>
              <p className="lbl" style={{marginBottom:10}}>Communication Preferences</p>
              {[["Primary mode","Verbal · Structured prompts"],["Visual supports","Yes — schedule, emotion chart"],["AAC device","Not currently using"],["Preferred format","Short sentences, concrete language"],["Alert signals","Uses hand raise + card system"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{fontSize:12,color:C.warm}}>{k}</span>
                  <span style={{fontSize:12.5,fontWeight:600,color:C.black,textAlign:"right",maxWidth:"55%"}}>{v}</span>
                </div>
              ))}
              <p className="lbl" style={{marginBottom:10,marginTop:16}}>Assistive Technology</p>
              {[["Text-to-speech","Snap&Read · Active"],["Speech-to-text","Not currently in use"],["Visual timer","TimeTimer — classroom + home"],["Noise-cancelling","Headphones available on request"],["Tablet access","iPad · Shared class resource"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{fontSize:12,color:C.warm}}>{k}</span>
                  <span style={{fontSize:12.5,fontWeight:600,color:C.black,textAlign:"right",maxWidth:"55%"}}>{v}</span>
                </div>
              ))}
            </div>

            {/* Family Data */}
            <div className="card" style={{padding:"24px 28px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Family Information</h3>
              {[["Parent/Guardian",_pg?.parent_name||"Not recorded"],["Relationship",_pg?.relationship||"Not recorded"],["Phone",_pg?.parent_phone||"Not recorded"],["Email",_pg?.parent_email||"Not recorded"],["Address",_pg?.address||"Not recorded"],["Other contacts",_gs.length>1?`${_gs.length-1} more on file`:"None"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{fontSize:13,color:C.warm}}>{k}</span>
                  <span style={{fontSize:13,fontWeight:600,color:C.black,textAlign:"right",maxWidth:"55%"}}>{v}</span>
                </div>
              ))}
              <button className="btn-ghost" style={{width:"100%",marginTop:14,fontSize:11}}>💬 Send Message →</button>
            </div>

            {/* Support Team */}
            <div className="card" style={{padding:"24px 28px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Support Team</h3>
              {[
                {name:s.teacher_name||"Not assigned",role:"ALP Coordinator / Teacher",icon:"👩‍🏫",color:C.purple},
                ...(s.relateds||[]).map(rs=>({name:rs.provider||"Not assigned",role:rs.type||"Related Service",icon:"🩺",color:C.green})),
              ].map((member,i)=>(
                <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:8,background:member.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{member.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:C.black}}>{member.name}</div>
                    <div style={{fontSize:11.5,color:C.warm}}>{member.role}</div>
                  </div>
                  <button className="btn-ghost" style={{fontSize:11,padding:"5px 12px"}}>Message</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab==="goals"&&(
          <div className="card" style={{padding:"24px 28px"}}>
            <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:20}}>Annual Goals</h3>
            {[{d:"READING",c:C.red,text:"By May 2027, Marcus will read grade 3-level text aloud with 90% accuracy (at least 80 wcpm) across 4 consecutive weekly probes.",b:"52 wcpm",t:"80 wcpm",m:"Quarterly",s:"Active"},{d:"COMMUNICATION",c:C.purple,text:"By May 2027, Marcus will initiate and maintain a 3-turn conversation with a peer on a preferred topic in 4 of 5 observed opportunities.",b:"1-turn",t:"3-turn",m:"Monthly",s:"Active"},{d:"SOCIAL-EMOTIONAL",c:C.amber,text:"By May 2027, Marcus will use a self-regulation strategy independently when identifying frustration in 4 of 5 daily opportunities.",b:"Prompted",t:"Independent",m:"Weekly",s:"Active"}].map((g,i)=>(
              <div key={i} style={{borderLeft:`4px solid ${g.c}`,background:C.purpleL,borderRadius:"0 10px 10px 0",padding:"18px 22px",marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><p className="lbl" style={{color:g.c}}>{g.d}</p><Badge color="green">{g.s}</Badge></div>
                <p style={{fontSize:14,color:C.black,lineHeight:1.7,marginBottom:12}}>{g.text}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:20,fontSize:12,color:C.warm}}><span>Baseline: <b style={{color:C.black}}>{g.b}</b></span><span>Target: <b style={{color:C.black}}>{g.t}</b></span><span>Monitoring: <b style={{color:C.black}}>{g.m}</b></span></div>
              </div>
            ))}
          </div>
        )}
        {(activeTab==="services"||activeTab==="documents")&&(
          <div className="card" style={{padding:"24px 28px",textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:12}}>{activeTab==="services"?"🛠":"📄"}</div>
            <p className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>{activeTab==="services"?"Services & Accommodations":"Documents"}</p>
            <p style={{fontSize:13,color:C.warm}}>{activeTab==="services"?"Student Support · Speech-Language · OT · Extended Time":"ALP_Marcus_2026.pdf · Evaluation_2024.pdf · Progress_Q3.pdf"}</p>
          </div>
        )}
      </Page>
    );
  }

  return(
    <>{showImport&&<DataImportModal onClose={()=>setShowImport(false)}/>}<BulkActionsBar selected={bulkSelected} onClear={()=>setBulkSelected([])} onAction={(action,ids)=>{toast(`${action} for ${ids.length} students…`,"info");setBulkSelected([]);}} />{selectedStudent&&<StudentDetailModal student={selectedStudent} onClose={()=>setSelectedStudent(null)} onOpenALP={()=>{setSelectedStudent(null);setPage("builder");}}/> }
    <Page title={<>Students</>} subtitle={`${all.length} student${all.length!==1?"s":""} enrolled${all.length>0?" · "+all.filter(s=>s.status==="Active"||!s.status).length+" active":""}`} action={<button className="btn-black" onClick={()=>{onAddStudent&&onAddStudent();toast("Opening student form…","info");}} style={{fontSize:11,padding:"11px 24px"}}>+ Add Student</button>}>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${C.tanL}`,display:"flex",gap:14,alignItems:"center"}}>
          <div style={{flex:1,position:"relative"}}><span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.warm,fontSize:14}}>🔍</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search students..." style={{width:"100%",padding:"9px 12px 9px 34px",border:`1px solid ${C.tanL}`,borderRadius:99,fontSize:13,color:C.black,outline:"none",background:C.purpleL,fontFamily:"'DM Sans',sans-serif",transition:"border-color .15s"}} onFocus={e=>e.target.style.borderColor=C.black} onBlur={e=>e.target.style.borderColor=C.tanL}/></div>
          <div style={{position:"relative",flex:1,minWidth:160}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.warm}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search students…" style={{width:"100%",padding:"8px 10px 8px 30px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:12,background:C.white,color:C.black,outline:"none"}}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>{["All","ALP","RTI","504"].map(fi=><button key={fi} onClick={()=>setF(fi)} className={f===fi?"btn-black":"btn-ghost"} style={{padding:"8px 14px",fontSize:11}}>{fi}</button>)}
            <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} style={{padding:"6px 10px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:11,background:C.white,color:C.black,marginLeft:8}}>
              <option value="">All Grades</option>
              {["K","1","2","3","4","5","6","7","8","9","10","11","12"].map(g=><option key={g} value={g}>Gr {g}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"6px 10px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:11,background:C.white,color:C.black}}>
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Review Due">Review Due</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>
        {viewMode==="grid"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:16}}>
              {rows.map(s=>(<div key={s.name} className="card" style={{padding:"20px 16px",textAlign:"center",cursor:"pointer",transition:"all .2s"}} onClick={()=>setSelectedStudent(s)} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple;e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tanL;e.currentTarget.style.transform="none";}}><Avatar name={s.student} size={44}/><div style={{fontSize:13,fontWeight:700,color:C.black,marginTop:10,marginBottom:3}}>{s.name}</div><div style={{fontSize:10,color:C.warm,marginBottom:8}}>Grade {s.grade}</div><span style={{fontSize:10,fontWeight:700,color:s.status==="Active"?C.green:C.amber,background:(s.status==="Active"?C.green:C.amber)+"18",padding:"2px 8px",borderRadius:99}}>{s.status||"Active"}</span></div>))}
              {rows.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:32,color:C.warm,fontSize:13}}>No students match your search.</div>}
            </div>}
            {rows.length===0&&<div style={{textAlign:"center",padding:"64px 32px"}}><div style={{fontSize:56,marginBottom:16}}>🔍</div><h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:8}}>No students found</h3><p style={{fontSize:14,color:C.warm,marginBottom:24}}>Try adjusting your search or filters.</p><button className="btn-purple" onClick={()=>{setSearch("");setFilterGrade("");setFilterStatus("");}} style={{fontSize:12}}>Clear Filters</button></div>}
        {viewMode==="table"&&rows.length>0&&<table className="data-table" style={{minWidth:520}}>
          <thead><tr>{["Student","Grade","Category","Plan","Status","Last Review",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(s=><tr key={s.name} style={{cursor:"pointer"}} onClick={()=>setSel(s)}>
            <td><div style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={s.name} size={34}/><span style={{fontWeight:600}}>{s.name}</span></div></td>
            <td style={{color:C.warm}}>{s.grade}</td><td><Badge color="gray">{s.cat}</Badge></td><td><Badge color={s.planC}>{s.plan}</Badge></td>
            <td><div style={{display:"flex",alignItems:"center",gap:7}}><Dot s={s.status}/>{s.status}</div></td>
            <td style={{color:C.warm}}>{s.review}</td>
            <td><button className="btn-ghost" style={{padding:"7px 16px",fontSize:11}} onClick={e=>{e.stopPropagation();setSel(s);}}>View ALP</button></td>
          </tr>)}</tbody>
        </table>}
      </div>
    </Page></>
  );
}


// ═══════════════════════════════════════════════════════════
// STUDENT PROFILE — 9-tab hub
// Real data from Supabase student record
// ═══════════════════════════════════════════════════════════
function StudentProfile({setPage}){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const {students:dbStudents,user,createGoalRecord,logProgressEntry}=useSupabaseAuth();
  const [activeTab,setActiveTab]=useState("info");
  const [selectedId,setSelectedId]=useState(null);
  const [studentGoals,setStudentGoals]=useState([]);
  const [loadingGoals,setLoadingGoals]=useState(false);

  // Use first student or selected
  const s=dbStudents?.find(st=>st.id===selectedId)||dbStudents?.[0]||null;

  // Guardian contacts come from student_guardians, not from columns on
  // students — those never existed, so these panels always showed
  // "Not recorded" regardless of what staff had entered.
  const [_gs,setGs]=useState([]);
  const _pg=_gs.find(g=>g.is_primary)||_gs[0]||null;
  useEffect(()=>{
    let cancelled=false;
    if(!s?.id){setGs([]);return;}
    Supabase.getGuardians(s.id).then(r=>{if(!cancelled)setGs(r||[]);}).catch(()=>{});
    return()=>{cancelled=true;};
  },[s?.id]);

  useEffect(()=>{
    if(!s?.id)return;
    setLoadingGoals(true);
    Supabase.getGoals(s.id).then(g=>{setStudentGoals(g||[]);setLoadingGoals(false);});
  },[s?.id]);

  const TABS=[
    {id:"info",label:"Student Info",icon:"👤"},
    {id:"profile",label:"Learning Profile",icon:"🧠"},
    {id:"assessments",label:"Assessments",icon:"📋"},
    {id:"levels",label:"Present Levels",icon:"📊"},
    {id:"goals",label:"Goals",icon:"🎯"},
    {id:"accommodations",label:"Accommodations",icon:"♿"},
    {id:"interventions",label:"Interventions",icon:"⚡"},
    {id:"progress",label:"Progress",icon:"📈"},
    {id:"documents",label:"Documents",icon:"📁"},
  ];
  const doneSet=new Set(["info","profile"]);
  const idx=TABS.findIndex(t=>t.id===activeTab);

  if(!s){
    return(
      <Page title="Student Profile" subtitle="Select a student to view their profile">
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:56,marginBottom:16}}>👤</div>
          <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:8}}>No Student Selected</h3>
          <p style={{fontSize:13,color:C.warm,marginBottom:24}}>Add a student first, then come back to view their full profile.</p>
          <button className="btn-purple" onClick={()=>setPage("students")} style={{fontSize:12}}>← Go to Students →</button>
        </div>
      </Page>
    );
  }

  return(
    <Page
      title={<>{s.name}<span className="serif-italic" style={{fontSize:20}}> — Profile</span></>}
      subtitle={`Grade ${s.grade||"–"} · ${s.disability||"ALP"} · ${s.school_name||"Your School"}`}
      action={<div style={{display:"flex",gap:8}}>
        {dbStudents?.length>1&&<select onChange={e=>setSelectedId(e.target.value)} value={selectedId||""} style={{fontSize:11,padding:"8px 12px",border:`1px solid ${C.tanL}`,borderRadius:8,background:C.white,color:C.black}}>
          {dbStudents.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
        </select>}
        <button className="btn-ghost" onClick={()=>setPage("students")} style={{fontSize:11}}>← All Students</button>
        <button className="btn-black" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"11px 20px"}}>✏️ Edit ALP</button>
      </div>}>

      {/* Student profile tab bar */}
      <div style={{display:"flex",overflowX:"auto",gap:0,borderBottom:`2px solid ${C.tanL}`,marginBottom:20,WebkitOverflowScrolling:"touch"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:"10px 16px",border:"none",background:"transparent",cursor:"pointer",
              borderBottom:activeTab===t.id?`3px solid ${C.purple}`:"3px solid transparent",
              color:activeTab===t.id?C.purple:C.warm,fontWeight:activeTab===t.id?700:400,
              fontSize:12,fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",transition:"all .15s",
              display:"flex",alignItems:"center",gap:5}}>
            {!isMobile&&<span>{t.icon}</span>}
            {t.label}
            {doneSet.has(t.id)&&<span style={{fontSize:9,color:C.green,marginLeft:2}}>✓</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab} className="fade-up">

        {activeTab==="info"&&(
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:16}}>STUDENT DETAILS</p>
              {[["Full Name",s.name],["Date of Birth",s.dob||"Not recorded"],["Gender",s.gender||"Not recorded"],
                ["Grade",s.grade||"–"],["School",s.school_name||"Not set"],["Enrollment",s.enrollment_date||"–"],
                ["Primary Disability / Need",s.disability||"Not specified"],["Plan Year",s.plan_year||new Date().getFullYear()+"-"+(new Date().getFullYear()+1)],
                ["Review Date",s.review_date||"Not set"],["Status",s.status||"Active"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,gap:12}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.warm,width:160,flexShrink:0}}>{k}</span>
                  <span style={{fontSize:13,color:C.black}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:14}}>PARENT / GUARDIAN</p>
                {[["Name",_pg?.parent_name||"Not recorded"],["Phone",_pg?.parent_phone||"Not recorded"],["Email",_pg?.parent_email||"Not recorded"],["Relationship",_pg?.relationship||"Not recorded"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,gap:12}}>
                    <span style={{fontSize:11,fontWeight:700,color:C.warm,width:100,flexShrink:0}}>{k}</span>
                    <span style={{fontSize:13,color:C.black}}>{v}</span>
                  </div>
                ))}
                <button className="btn-purple" style={{marginTop:14,fontSize:11,width:"100%"}} onClick={()=>setPage("create")}>📄 Generate ALP PDF →</button>
              </div>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:14}}>SUPPORT TEAM</p>
                <div style={{padding:"10px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{fontSize:12,color:C.warm,display:"block",marginBottom:4}}>ALP Coordinator</span>
                  <span style={{fontSize:13,fontWeight:600,color:C.black}}>{s.teacher_name||user?.email?.split("@")[0]||"Not assigned"}</span>
                </div>
                {(s.relateds||[]).map((rs,i)=>(
                  <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${C.tanL}`}}>
                    <span style={{fontSize:12,color:C.warm,display:"block",marginBottom:4}}>{rs.type||"Related Service"}</span>
                    <span style={{fontSize:13,fontWeight:600,color:C.black}}>{rs.provider||"Not assigned"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab==="profile"&&(
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
            {[
              ["Academic Strengths",s.strengths||"Not yet recorded — complete the ALP Builder to add strengths.",C.green],
              ["Growth Areas",s.growth_areas||"Not yet recorded — complete the ALP Builder to add growth areas.",C.amber],
              ["Learning Concerns",s.concerns||"Not yet recorded.",C.red],
              ["Learning Style",s.learning_style||"Not yet recorded.",C.blue],
              ["Interests & Talents",s.interests||"Not yet recorded.",C.purple],
              ["Communication Skills",s.communication||"Not yet recorded.",C.purple],
            ].map(([title,text,color])=>(
              <div key={title} className="card" style={{padding:"20px 22px",borderLeft:`3px solid ${color}`}}>
                <p className="lbl" style={{marginBottom:8,color}}>{title.toUpperCase()}</p>
                <p style={{fontSize:13,color:C.warm,lineHeight:1.75}}>{text}</p>
              </div>
            ))}
            {!s.strengths&&<div className="card" style={{gridColumn:isMobile?"1":"1 / -1",padding:"16px 20px",background:C.purpleL,border:`1px solid ${C.purple}44`,textAlign:"center"}}>
              <p style={{fontSize:13,color:C.purple}}>Complete the <b>ALP Builder</b> to populate this profile with real data. <button className="btn-ghost" style={{fontSize:11,marginLeft:8}} onClick={()=>setPage("builder")}>Open ALP Builder →</button></p>
            </div>}
          </div>
        )}

        {activeTab==="assessments"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {s.assessment_scores?(
              <div className="card" style={{padding:"20px 24px"}}>
                <p className="lbl" style={{marginBottom:16}}>BASELINE ASSESSMENT SCORES</p>
                {Object.entries(s.assessment_scores).map(([domain,score])=>(
                  <div key={domain} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
                      <span style={{color:C.black,fontWeight:600}}>{domain}</span>
                      <span style={{color:score>=80?C.green:score>=60?C.amber:C.red,fontWeight:700}}>{score}%</span>
                    </div>
                    <div style={{height:8,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${score}%`,background:score>=80?C.green:score>=60?C.amber:C.red,borderRadius:99}}/>
                    </div>
                  </div>
                ))}
              </div>
            ):(
              <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>No Assessment Data Yet</h3>
                <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Complete Step 3 of the ALP Builder to add baseline assessment scores.</p>
                <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:12}}>Open ALP Builder →</button>
              </div>
            )}
          </div>
        )}

        {activeTab==="levels"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {s.present_levels?(
              <>
                <div className="card" style={{padding:"22px 24px"}}>
                  <p className="lbl" style={{marginBottom:12}}>PRESENT LEVELS OF ACADEMIC ACHIEVEMENT AND FUNCTIONAL PERFORMANCE</p>
                  <p style={{fontSize:13.5,color:C.warm,lineHeight:1.85}}>{s.present_levels.academic||"Not yet completed."}</p>
                </div>
                {s.present_levels.functional&&<div className="card" style={{padding:"20px 24px",borderTop:`3px solid ${C.blue}`}}>
                  <p className="lbl" style={{marginBottom:8,color:C.blue}}>FUNCTIONAL PERFORMANCE</p>
                  <p style={{fontSize:13,color:C.warm,lineHeight:1.8}}>{s.present_levels.functional}</p>
                </div>}
              </>
            ):(
              <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>📊</div>
                <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>Present Levels Not Completed</h3>
                <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Complete Step 4 of the ALP Builder to add present level statements.</p>
                <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:12}}>Open ALP Builder →</button>
              </div>
            )}
          </div>
        )}

        {activeTab==="goals"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {loadingGoals&&<div style={{textAlign:"center",padding:40,color:C.warm}}>Loading goals…</div>}
            {!loadingGoals&&studentGoals.length===0&&(
              <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>🎯</div>
                <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>No Goals Yet</h3>
                <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Use the ALP Builder to create measurable annual goals for {s.name}.</p>
                <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:12}}>Open ALP Builder →</button>
              </div>
            )}
            {studentGoals.map((g,i)=>{
              const pct=g.current_pct||0;
              const color=pct>=80?C.green:pct>=50?C.amber:C.red;
              return(
                <div key={i} className="card" style={{padding:"20px 24px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
                    <div style={{flex:1}}>
                      <span style={{fontSize:10,fontWeight:700,background:color+"18",color,padding:"2px 10px",borderRadius:99}}>{g.domain}</span>
                      <p style={{fontSize:13.5,color:C.black,lineHeight:1.7,marginTop:8,fontStyle:"italic"}}>{g.goal_text}</p>
                    </div>
                    <span style={{fontSize:20,fontWeight:800,color,flexShrink:0}}>{pct}%</span>
                  </div>
                  <div style={{height:6,background:C.tanL,borderRadius:99,overflow:"hidden",marginBottom:10}}>
                    <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:99}}/>
                  </div>
                  <div style={{display:"flex",gap:20,fontSize:11,color:C.warm,flexWrap:"wrap"}}>
                    {g.baseline&&<span><b style={{color:C.black}}>Baseline:</b> {g.baseline}</span>}
                    {g.target&&<span><b style={{color:C.black}}>Target:</b> {g.target}</span>}
                    {g.monitoring&&<span><b style={{color:C.black}}>Monitoring:</b> {g.monitoring}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab==="accommodations"&&(
          <div>
            {s.accommodations&&s.accommodations.length>0?(
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
                {(s.accommodation_groups||[{label:"All Accommodations",items:s.accommodations}]).map(g=>(
                  <div key={g.label} className="card" style={{padding:"20px 22px"}}>
                    <p className="lbl" style={{marginBottom:10}}>{g.label.toUpperCase()}</p>
                    {(g.items||[]).map((item,i)=>(
                      <div key={i} style={{display:"flex",gap:8,fontSize:13,color:C.black,padding:"6px 0",borderBottom:`1px solid ${C.tanL}`}}>
                        <span style={{color:C.green,fontWeight:700,flexShrink:0}}>✓</span>{item}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ):(
              <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>♿</div>
                <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>No Accommodations Recorded</h3>
                <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Complete Step 6 of the ALP Builder to add accommodations.</p>
                <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:12}}>Open ALP Builder →</button>
              </div>
            )}
          </div>
        )}

        {activeTab==="interventions"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {s.interventions&&s.interventions.length>0?s.interventions.map((p,i)=>(
              <div key={i} className="card" style={{padding:"20px 24px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:2}}>{p.type}</p>
                    <p style={{fontSize:12,color:C.purple}}>{p.program}</p>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,background:C.green+"18",color:C.green,padding:"2px 10px",borderRadius:99}}>Active</span>
                </div>
                <div style={{display:"flex",gap:20,fontSize:11,color:C.warm,flexWrap:"wrap"}}>
                  {p.frequency&&<span><b style={{color:C.black}}>Frequency:</b> {p.frequency}</span>}
                  {p.duration&&<span><b style={{color:C.black}}>Duration:</b> {p.duration}</span>}
                  {p.staff&&<span><b style={{color:C.black}}>Staff:</b> {p.staff}</span>}
                  {p.outcome&&<span><b style={{color:C.black}}>Expected Outcome:</b> {p.outcome}</span>}
                </div>
              </div>
            )):(
              <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>⚡</div>
                <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>No Intervention Plans</h3>
                <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Complete Step 7 of the ALP Builder to add intervention programmes.</p>
                <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:12}}>Open ALP Builder →</button>
              </div>
            )}
          </div>
        )}

        {activeTab==="progress"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {studentGoals.length>0?(
              <>
                {studentGoals.slice(0,2).map((g,i)=>{
                  const entries=g.progress_entries||[];
                  const pct=g.current_pct||0;
                  return(
                    <div key={i} className="card" style={{padding:"22px 24px"}}>
                      <p className="lbl" style={{marginBottom:14}}>{g.domain} — PROGRESS</p>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                        <div style={{flex:1,height:10,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:pct>=80?C.green:pct>=50?C.amber:C.red,borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:16,fontWeight:800,color:C.black,flexShrink:0}}>{pct}%</span>
                      </div>
                      {entries.length>0?(
                        entries.slice(0,3).map((e,j)=>(
                          <div key={j} style={{padding:"10px 0",borderBottom:`1px solid ${C.tanL}`}}>
                            <div style={{display:"flex",gap:8,marginBottom:4}}>
                              <span style={{fontSize:11,color:C.warm}}>{e.date}</span>
                              <span style={{fontSize:11,fontWeight:700,color:C.purple}}>Score: {e.score}</span>
                            </div>
                            {e.notes&&<p style={{fontSize:12,color:C.black}}>{e.notes}</p>}
                          </div>
                        ))
                      ):(
                        <p style={{fontSize:12,color:C.warm,fontStyle:"italic"}}>No data points logged yet.</p>
                      )}
                    </div>
                  );
                })}
                <button className="btn-ghost" style={{fontSize:11,alignSelf:"flex-start"}} onClick={()=>setPage("progress")}>📊 Full Progress Dashboard →</button>
              </>
            ):(
              <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>📈</div>
                <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>No Progress Data Yet</h3>
                <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Create goals first, then log progress data points over time.</p>
                <button className="btn-purple" onClick={()=>setPage("progress")} style={{fontSize:12}}>Go to Progress →</button>
              </div>
            )}
          </div>
        )}

        {activeTab==="documents"&&(
          <div>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
              <span style={{fontSize:13,color:C.warm,flex:1}}>Documents created for <b style={{color:C.black}}>{s.name}</b></span>
              <button className="btn-black" style={{fontSize:11,padding:"8px 16px"}} onClick={()=>toast("Upload dialog opening…","info")}>⬆ Upload Document</button>
            </div>
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              {s.documents&&s.documents.length>0?(
                <div style={{overflowX:"auto"}}>
                  <table className="data-table" style={{minWidth:600}}>
                    <thead><tr><th>Doc ID</th><th>Date</th><th>Document</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {s.documents.map((d,i)=>(
                        <tr key={i}>
                          <td style={{fontSize:11,color:C.warm}}>{d.id}</td>
                          <td style={{fontSize:11,color:C.warm,whiteSpace:"nowrap"}}>{d.date}</td>
                          <td><span style={{fontSize:12.5,color:C.purple,fontWeight:600,cursor:"pointer"}} onClick={()=>toast(`Opening ${d.name}…`,"info")}>{d.name}</span></td>
                          <td><span style={{fontSize:10,fontWeight:700,color:C.red,background:C.red+"12",padding:"2px 8px",borderRadius:4}}>PDF</span></td>
                          <td><span style={{fontSize:11,color:d.status==="Signed"?C.green:C.warm}}>{d.status||"On File"}</span></td>
                          <td><button className="btn-ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>toast("Downloading…","success")}>⬇</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ):(
                <div style={{padding:"48px 32px",textAlign:"center"}}>
                  <div style={{fontSize:40,marginBottom:12}}>📁</div>
                  <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>No Documents Yet</h3>
                  <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Generate your first ALP document to see it here.</p>
                  <button className="btn-purple" onClick={()=>setPage("create")} style={{fontSize:12}}>Generate ALP Document →</button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* BACK / SHOW SECTION / CONTINUE footer */}
      <div style={{marginTop:28,paddingTop:16,borderTop:`1px solid ${C.tanL}`,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <button className="btn-ghost" onClick={()=>idx>0&&setActiveTab(TABS[idx-1].id)} disabled={idx===0} style={{fontSize:12,opacity:idx===0?.4:1}}>← Back</button>
        <button className="btn-ghost" style={{fontSize:12}} onClick={()=>toast("Section saved","success")}>Save Section</button>
        <button className="btn-purple" onClick={()=>idx<TABS.length-1&&setActiveTab(TABS[idx+1].id)} disabled={idx===TABS.length-1} style={{fontSize:12,padding:"11px 24px",opacity:idx===TABS.length-1?.4:1}}>Continue →</button>
        <div style={{display:"flex",gap:5,marginLeft:"auto",flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{fontSize:10,padding:"4px 10px",borderRadius:6,
                border:`1px solid ${activeTab===t.id?C.purple:C.tanL}`,
                background:activeTab===t.id?C.purple:"transparent",
                color:activeTab===t.id?"#fff":C.warm,cursor:"pointer",
                fontWeight:doneSet.has(t.id)?600:400,display:"flex",alignItems:"center",gap:3}}>
              {doneSet.has(t.id)&&<span style={{color:activeTab===t.id?"#fff":C.green}}>✓</span>}
              {t.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// QUICK ALP — 6-Section Fast Entry (15–20 min)
// Saves directly to Supabase
// ═══════════════════════════════════════════════════════════
function QuickALP({setPage}){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const {students:dbStudents,createStudentRecord,createGoalRecord,user}=useSupabaseAuth();
  const [step,setStep]=useState(1);
  const [saved,setSaved]=useState({});
  const [saving,setSaving]=useState(false);
  const [selectedStudentId,setSelectedStudentId]=useState(dbStudents?.[0]?.id||null);
  const s=dbStudents?.find(st=>st.id===selectedStudentId)||dbStudents?.[0]||null;

  const [form,setForm]=useState({
    strengths:"",growthAreas:"",concerns:"",
    parentConcerns:"",parentGoals:"",teacherObs:"",
    goal1:"",goal2:"",goal3:"",
    accommodations:[],customAccom:"",
    progressNote:"",frequency:"Weekly",nextCheck:"",
    decision:"continue",
  });
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

  const STEPS=[
    {n:1,title:"Student Learning Profile",sub:"Strengths, growth areas, learning concerns"},
    {n:2,title:"Parent & Teacher Input",sub:"Concerns, goals, observations"},
    {n:3,title:"Learning Goals",sub:"Simple, measurable goals"},
    {n:4,title:"Support Strategies & Accommodations",sub:"What will help the student succeed"},
    {n:5,title:"Progress Monitoring",sub:"Short updates, data tracking"},
    {n:6,title:"Review & Next Steps",sub:"Continue, revise, or exit support"},
  ];

  const ACCOM=[
    "Extended time (1.5×)","Small group instruction","Preferential seating",
    "Visual supports / graphic organisers","Text-to-speech software",
    "Frequent comprehension checks","Modified assignments",
    "Advance notice of transitions","Flexible seating","Calm-down access",
  ];
  const toggleAcc=(a)=>setF("accommodations",form.accommodations.includes(a)?form.accommodations.filter(x=>x!==a):[...form.accommodations,a]);

  async function saveStep(){
    setSaving(true);
    try{
      if(step===3&&s?.id){
        // Save goals to Supabase
        for(const [i,key] of [["goal1",1],["goal2",2],["goal3",3]]){
          if(form[key]?.trim()){
            await createGoalRecord({student_id:s.id,goal_text:form[key],domain:["Academic","Communication","Life Skills"][i],monitoring:"Weekly"});
          }
        }
      }
      if(step===6&&s?.id){
        // Save profile data back to student record
        await Supabase.updateStudent?.(s.id,{
          strengths:form.strengths,growth_areas:form.growthAreas,
          concerns:form.concerns,accommodations:form.accommodations,
          notes:form.progressNote,
        });
      }
      setSaved(p=>({...p,[step]:true}));
      toast(`Section ${step} saved${user&&s?" to Supabase":""}!`,"success");
      if(step<6)setStep(st=>st+1);
      else{toast(`Quick ALP for ${s?.name||"student"} complete! 🎉`,"success");setPage("studentprofile");}
    }catch(e){toast("Save failed — check your connection","error");}
    setSaving(false);
  }

  if(!s){
    return(
      <Page title="Quick ALP" subtitle="Fast 6-section entry">
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:56,marginBottom:16}}>⚡</div>
          <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:8}}>Add a Student First</h3>
          <p style={{fontSize:13,color:C.warm,marginBottom:24}}>You need at least one student on your caseload to use Quick ALP.</p>
          <button className="btn-purple" onClick={()=>setPage("students")} style={{fontSize:12}}>← Go to Students →</button>
        </div>
      </Page>
    );
  }

  return(
    <Page
      title={<>Quick ALP <span className="serif-italic" style={{fontSize:24}}>— Fast Entry</span></>}
      subtitle={`${s.name} · Section ${step} of 6 · ~15 minutes`}
      action={<div style={{display:"flex",gap:8}}>
        {dbStudents?.length>1&&<select onChange={e=>setSelectedStudentId(e.target.value)} value={selectedStudentId||""} style={{fontSize:11,padding:"8px 12px",border:`1px solid ${C.tanL}`,borderRadius:8,background:C.white,color:C.black}}>
          {dbStudents.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
        </select>}
        <button className="btn-ghost" onClick={()=>setPage("builder")} style={{fontSize:11}}>Full ALP Builder →</button>
      </div>}>

      {/* Step tracker */}
      <div style={{display:"flex",gap:0,marginBottom:24,overflowX:"auto"}}>
        {STEPS.map((s2,i)=>(
          <div key={s2.n} style={{display:"flex",alignItems:"center",flex:1,minWidth:isMobile?36:90}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
              <div onClick={()=>setStep(s2.n)} style={{width:36,height:36,borderRadius:"50%",cursor:"pointer",flexShrink:0,
                background:saved[s2.n]?C.green:step===s2.n?C.purple:C.tanL,
                color:saved[s2.n]||step===s2.n?"#fff":C.warm,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:saved[s2.n]?16:13,fontWeight:700,transition:"all .25s"}}>
                {saved[s2.n]?"✓":s2.n}
              </div>
              {!isMobile&&<span style={{fontSize:9,color:step===s2.n?C.purple:C.warm,fontWeight:step===s2.n?700:400,marginTop:4,textAlign:"center",lineHeight:1.2}}>{s2.title.split(" ")[0]}</span>}
            </div>
            {i<STEPS.length-1&&<div style={{flex:1,height:2,background:saved[s2.n]?C.green:C.tanL,margin:"0 4px",marginBottom:isMobile?0:18,transition:"background .3s"}}/>}
          </div>
        ))}
      </div>

      <div className="card" style={{padding:"28px 32px"}}>
        <div style={{marginBottom:20}}>
          <p className="lbl" style={{color:C.purple,marginBottom:6}}>SECTION {step} OF 6 · {s.name}</p>
          <h2 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:4}}>{STEPS[step-1].title}</h2>
          <p style={{fontSize:13,color:C.warm}}>{STEPS[step-1].sub}</p>
        </div>
        <hr className="rule" style={{marginBottom:22}}/>

        {step===1&&(<div style={{display:"flex",flexDirection:"column",gap:18}}>
          <UTextarea label="Academic Strengths" value={form.strengths} onChange={e=>setF("strengths",e.target.value)} rows={3} placeholder={`What does ${s.name} do well? Areas of strength in learning, behaviour, and daily skills…`}/>
          <UTextarea label="Growth Areas" value={form.growthAreas} onChange={e=>setF("growthAreas",e.target.value)} rows={3} placeholder="Where does this student need support? Be specific about skill gaps…"/>
          <UTextarea label="Learning Concerns" value={form.concerns} onChange={e=>setF("concerns",e.target.value)} rows={3} placeholder="Key concerns from teacher, family, or previous assessments…"/>
        </div>)}

        {step===2&&(<div style={{display:"flex",flexDirection:"column",gap:18}}>
          <UTextarea label="Parent / Guardian Concerns" value={form.parentConcerns} onChange={e=>setF("parentConcerns",e.target.value)} rows={3} placeholder="What concerns does the family have about their child's learning?"/>
          <UTextarea label="Family Goals for This Year" value={form.parentGoals} onChange={e=>setF("parentGoals",e.target.value)} rows={3} placeholder="What does the family most want their child to achieve this year?"/>
          <UTextarea label="Teacher Observations" value={form.teacherObs} onChange={e=>setF("teacherObs",e.target.value)} rows={3} placeholder="Patterns noticed in class, what strategies have worked, key observations…"/>
        </div>)}

        {step===3&&(<div style={{display:"flex",flexDirection:"column",gap:18}}>
          <div style={{padding:"10px 14px",background:C.purpleL,borderRadius:8,fontSize:12,color:C.warm,marginBottom:4}}>
            ✦ Write simple, measurable goals. Format: "By June {new Date().getFullYear()+1}, {s.name.split(" ")[0]} will [action] with [criteria] as measured by [method]."
          </div>
          {[["Goal 1 — Academic",`By ${new Date().toLocaleDateString("en-US",{month:"long"})} ${new Date().getFullYear()+1}, ${s.name.split(" ")[0]} will…`],["Goal 2 — Communication or Behaviour",`By ${new Date().toLocaleDateString("en-US",{month:"long"})} ${new Date().getFullYear()+1}, they will…`],["Goal 3 — Life Skills or Other",`By ${new Date().toLocaleDateString("en-US",{month:"long"})} ${new Date().getFullYear()+1}, they will…`]].map(([label,ph],i)=>(
            <UTextarea key={i} label={label} value={form[`goal${i+1}`]} onChange={e=>setF(`goal${i+1}`,e.target.value)} rows={3} placeholder={ph}/>
          ))}
        </div>)}

        {step===4&&(<div>
          <p className="lbl" style={{marginBottom:12}}>SELECT ALL THAT APPLY FOR {s.name.split(" ")[0].toUpperCase()}</p>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8,marginBottom:16}}>
            {ACCOM.map(a=>(
              <label key={a} onClick={()=>toggleAcc(a)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",
                border:`1.5px solid ${form.accommodations.includes(a)?C.purple:C.tanL}`,
                borderRadius:8,background:form.accommodations.includes(a)?C.purpleL:"transparent",
                fontSize:13,color:form.accommodations.includes(a)?C.purple:C.black,transition:"all .15s"}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${form.accommodations.includes(a)?C.purple:C.tanL}`,background:form.accommodations.includes(a)?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {form.accommodations.includes(a)&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}
                </div>
                {a}
              </label>
            ))}
          </div>
          <UTextarea label="Additional Accommodations" value={form.customAccom} onChange={e=>setF("customAccom",e.target.value)} rows={2} placeholder="Any other accommodations specific to this student…"/>
        </div>)}

        {step===5&&(<div style={{display:"flex",flexDirection:"column",gap:18}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <USelect label="Monitoring Frequency" value={form.frequency} onChange={e=>setF("frequency",e.target.value)} options={["Weekly","Bi-weekly","Monthly","Per quarter"].map(v=>({value:v,label:v}))}/>
            <UInput label="Next Check-In Date" value={form.nextCheck} onChange={e=>setF("nextCheck",e.target.value)} type="date"/>
          </div>
          <UTextarea label="Current Progress Note" value={form.progressNote} onChange={e=>setF("progressNote",e.target.value)} rows={4} placeholder={`How is ${s.name.split(" ")[0]} progressing toward their goals? Include any data collected…`}/>
          <div style={{padding:"12px 14px",background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:8,fontSize:12,color:"#166534"}}>
            ✓ Short updates every {form.frequency.toLowerCase()} keep families informed and demonstrate accountability.
          </div>
        </div>)}

        {step===6&&(<div style={{display:"flex",flexDirection:"column",gap:16}}>
          <p style={{fontSize:13,color:C.warm,lineHeight:1.7}}>Review the support provided for <b style={{color:C.black}}>{s.name}</b> and decide the next step.</p>
          {[["continue","✅ Continue Support","Student is making progress. Maintain current goals and accommodations.",C.green],
            ["revise","🔄 Revise Plan","Adjustments needed. Goals, services, or accommodations need updating.",C.amber],
            ["exit","⬆ Exit Support","Student has met goals and no longer requires this level of support.",C.blue],
          ].map(([val,label,desc,color])=>(
            <label key={val} onClick={()=>setF("decision",val)} style={{display:"flex",gap:14,padding:"14px 16px",cursor:"pointer",
              border:`2px solid ${form.decision===val?color:C.tanL}`,borderRadius:10,background:form.decision===val?color+"0D":"transparent",transition:"all .2s"}}>
              <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${form.decision===val?color:C.tanL}`,background:form.decision===val?color:"transparent",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {form.decision===val&&<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
              </div>
              <div><div style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:3}}>{label}</div><div style={{fontSize:12,color:C.warm}}>{desc}</div></div>
            </label>
          ))}
          <div style={{padding:"12px 14px",background:C.purpleL,borderRadius:8,fontSize:12,color:C.warm}}>
            This review decision will be saved to {s.name}'s record and dated {new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}.
          </div>
        </div>)}

        <div style={{display:"flex",gap:10,marginTop:24}}>
          <button className="btn-ghost" onClick={()=>step>1?setStep(st=>st-1):setPage("students")} style={{fontSize:12}}>← {step===1?"Cancel":"Back"}</button>
          <button className="btn-purple" onClick={saveStep} disabled={saving} style={{flex:1,fontSize:12,padding:"13px"}}>
            {saving?<><Spin/>  Saving…</>:step===6?`✓ Complete Quick ALP for ${s.name.split(" ")[0]} →`:"Save & Continue →"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginTop:14,flexWrap:"wrap"}}>
        {STEPS.map(s2=>(
          <button key={s2.n} onClick={()=>setStep(s2.n)} style={{fontSize:10,padding:"5px 12px",borderRadius:6,
            border:`1px solid ${step===s2.n?C.purple:C.tanL}`,
            background:step===s2.n?C.purple:saved[s2.n]?C.purpleL:"transparent",
            color:step===s2.n?"#fff":saved[s2.n]?C.purple:C.warm,
            cursor:"pointer",fontWeight:step===s2.n?700:400,transition:"all .15s"}}>
            {saved[s2.n]&&"✓ "}{s2.n}. {s2.title.split(" ")[0]}
          </button>
        ))}
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// ALP BUILDER
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// GUARDIAN CONTACTS — Step 1 of the ALP Builder
//
// Guardians are CONTACT RECORDS, not users. No account, no login, no
// session, no role. This section is the only place they are created,
// and it is staff-only like every other part of the builder.
//
// Replaces four flat fields (parentName / parentEmail / parentPhone /
// emergencyContact) that were written to columns on `students` which
// do not exist, so the values were silently lost on save. A child
// frequently has two contactable guardians — separated parents, a
// grandparent, a foster carer — and one set of fields cannot hold that
// without collapsing the second into free text nobody can dial.
// ═══════════════════════════════════════════════════════════
const RELATIONSHIPS=["Mother","Father","Guardian","Grandparent","Foster Parent","Other"];


// ═══════════════════════════════════════════════════════════
// TRAJECTORY — the signature element
//
// A conventional progress bar answers "what percent is done",
// which is not the question anyone asks about a child. This
// answers "how far have they come, and how far is left" — with
// the starting point still on screen, because the distance
// already covered is the part a teacher wants a parent to see.
//
// Falls back to the goal's own wording when there are no numbers
// to plot, rather than drawing an empty rail that implies zero
// progress. A goal without a baseline is unmeasured, not failing.
// ═══════════════════════════════════════════════════════════
function Trajectory({baseline,current,target,unit}){
  const b=Number(baseline), c=Number(current), t=Number(target);
  if(![b,t].every(Number.isFinite)||t===b) return null;
  const have=Number.isFinite(c)?c:b;
  const pct=Math.round(Math.max(0,Math.min(100,((have-b)/(t-b))*100))*10)/10;
  const u=unit?` ${unit}`:"";
  return (
    <div>
      <div className="trajectory" role="img"
        aria-label={`Started at ${b}${u}. Now ${have}${u}. Aiming for ${t}${u}.`}>
        <div className="trajectory-fill" style={{width:`${pct}%`}}/>
        <span className="trajectory-mark start"/>
        <span className="trajectory-mark now" style={{left:`${pct}%`}}/>
        <span className="trajectory-mark target"/>
      </div>
      <div className="trajectory-caption">
        <span>Started {b}{u}</span>
        <span style={{color:"var(--purple-main)",fontWeight:600}}>Now {have}{u}</span>
        <span>Goal {t}{u}</span>
      </div>
    </div>
  );
}

function GuardianContacts({studentId,disabled}){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null); // guardian id, or "new"
  const [draft,setDraft]=useState(null);
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    if(!studentId){setRows([]);setLoading(false);return;}
    try{setRows(await Supabase.getGuardians(studentId));}
    catch{toast("Could not load guardian contacts","error");}
    setLoading(false);
  },[studentId,toast]);

  useEffect(()=>{load();},[load]);

  function startAdd(){
    setEditing("new");
    setDraft({parent_name:"",relationship:"Mother",relationship_other:"",
      parent_phone:"",parent_email:"",address:"",
      // First guardian added is primary by default — the common case is
      // one contact, and making the teacher tick a box for it is friction.
      is_primary:rows.length===0});
  }

  function startEdit(g){
    const known=RELATIONSHIPS.includes(g.relationship);
    setEditing(g.id);
    setDraft({...g,
      relationship:known?g.relationship:"Other",
      relationship_other:known?"":(g.relationship||"")});
  }

  async function save(){
    if(!studentId){toast("Save the student first","error");return;}
    if(!draft.parent_name.trim()){toast("Guardian name is required","error");return;}
    setBusy(true);
    const relationship=draft.relationship==="Other"
      ? (draft.relationship_other.trim()||"Other")
      : draft.relationship;
    const payload={
      student_id:studentId,parent_name:draft.parent_name.trim(),
      relationship,parent_phone:draft.parent_phone?.trim()||null,
      parent_email:draft.parent_email?.trim()||null,
      address:draft.address?.trim()||null,
    };
    // Always insert as non-primary, then promote via the RPC.
    // Inserting a second guardian with is_primary:true would violate
    // the partial unique index before we ever got to promote it, and
    // the teacher would see a raw constraint error for doing something
    // entirely reasonable.
    const r=editing==="new"
      ? await Supabase.addGuardian({...payload,is_primary:false})
      : await Supabase.updateGuardian(editing,payload);
    if(r?.error){toast(r.error.message||"Could not save guardian","error");setBusy(false);return;}

    if(draft.is_primary){
      const id=editing==="new"?r?.data?.id:editing;
      // One transaction server-side: verify the guardian belongs to
      // this student, clear the old primary, set the new one.
      const pr=id?await Supabase.setPrimaryGuardian(studentId,id):null;
      if(pr?.error){
        toast(pr.error.message||"Saved, but could not set primary contact","error");
        setBusy(false);setEditing(null);setDraft(null);load();return;
      }
    }
    setBusy(false);setEditing(null);setDraft(null);
    toast(editing==="new"?"Guardian added ✓":"Guardian updated ✓","success");
    load();
  }

  async function remove(g){
    if(!window.confirm(`Remove ${g.parent_name} from this student's contacts?`))return;
    const r=await Supabase.deleteGuardian(g.id);
    if(r?.error){toast("Could not remove guardian","error");return;}
    toast("Guardian removed","success");load();
  }

  async function makePrimary(g){
    const r=await Supabase.setPrimaryGuardian(studentId,g.id);
    if(r?.error){toast("Could not set primary contact","error");return;}
    toast(`${g.parent_name} is now the primary contact`,"success");load();
  }

  const D=(k,v)=>setDraft(p=>({...p,[k]:v}));

  return(
    <div className="card" style={{padding:"22px 24px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <p className="lbl" style={{margin:0}}>PARENT / GUARDIAN CONTACT</p>
        {!disabled&&studentId&&editing===null&&
          <button className="btn-ghost" style={{fontSize:10,padding:"6px 12px"}} onClick={startAdd}>+ Add guardian</button>}
      </div>

      {!studentId&&<p style={{fontSize:12,color:C.warm,lineHeight:1.6,margin:0}}>
        Save the student first, then add their guardian contacts here.</p>}

      {studentId&&loading&&<p style={{fontSize:12,color:C.warm,margin:0}}>Loading…</p>}

      {studentId&&!loading&&rows.length===0&&editing===null&&
        <p style={{fontSize:12,color:C.warm,lineHeight:1.6,margin:0}}>
          No guardian recorded yet. The primary guardian is who the approved
          ALP PDF and the Support Notice are addressed to.</p>}

      {/* ── Existing guardians ── */}
      {rows.map(g=>editing===g.id?null:(
        <div key={g.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"11px 0",
          borderBottom:`1px solid ${C.tanL}`}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:13,fontWeight:700,color:C.black}}>{g.parent_name}</span>
              {g.relationship&&<span style={{fontSize:11,color:C.warm}}>{g.relationship}</span>}
              {g.is_primary&&<span style={{fontSize:9,fontWeight:700,letterSpacing:".08em",
                padding:"2px 7px",borderRadius:5,background:C.purpleL,color:C.purpleD}}>PRIMARY</span>}
            </div>
            <div style={{fontSize:11,color:C.warm,marginTop:3}}>
              {[g.parent_phone,g.parent_email].filter(Boolean).join(" · ")||"No contact details"}
            </div>
          </div>
          {!disabled&&<div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
            {!g.is_primary&&<button className="btn-ghost" style={{fontSize:9,padding:"5px 9px"}}
              onClick={()=>makePrimary(g)}>Make primary</button>}
            <button className="btn-ghost" style={{fontSize:9,padding:"5px 9px"}}
              onClick={()=>startEdit(g)}>Edit</button>
            <button className="btn-ghost" style={{fontSize:9,padding:"5px 9px",color:C.red}}
              onClick={()=>remove(g)}>Remove</button>
          </div>}
        </div>
      ))}

      {/* ── Add / edit form ── */}
      {editing!==null&&draft&&(
        <div style={{marginTop:14,padding:"16px",background:C.bg,borderRadius:10,
          border:`1px solid ${C.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
            <UInput label="Full Name" value={draft.parent_name} onChange={e=>D("parent_name",e.target.value)}/>
            <USelect label="Relationship" value={draft.relationship} onChange={e=>D("relationship",e.target.value)}
              options={RELATIONSHIPS.map(r=>({value:r,label:r}))}/>
            {draft.relationship==="Other"&&
              <UInput label="Relationship (specify)" value={draft.relationship_other}
                onChange={e=>D("relationship_other",e.target.value)} placeholder="e.g. Aunt"/>}
            <UInput label="Phone" value={draft.parent_phone||""} onChange={e=>D("parent_phone",e.target.value)} placeholder="+233 20 000 0000"/>
            <UInput label="Email" value={draft.parent_email||""} onChange={e=>D("parent_email",e.target.value)} type="email"/>
            <UInput label="Address" value={draft.address||""} onChange={e=>D("address",e.target.value)}/>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.black,
            cursor:"pointer",marginBottom:14}}>
            <input type="checkbox" checked={!!draft.is_primary} onChange={e=>D("is_primary",e.target.checked)}/>
            Primary contact — receives the ALP PDF and Support Notice
          </label>
          <div style={{display:"flex",gap:8}}>
            <button className="btn-purple" style={{fontSize:11,padding:"9px 18px"}}
              disabled={busy} onClick={save}>{busy?"Saving…":"Save guardian"}</button>
            <button className="btn-ghost" style={{fontSize:11,padding:"9px 18px"}}
              onClick={()=>{setEditing(null);setDraft(null);}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ALPBuilder({setPage}){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const [step,setStep]=useState(1);
  const [completedSteps,setCompletedSteps]=useState([]);
  const [showAI,setShowAI]=useState(false);

  /* ── Shared student data across all steps ── */
  const {students:dbStudents,user,profile,realRole,createStudentRecord,updateStudentRecord,createGoalRecord,
    submitForReviewAction,approveALPAction,requestChangesAction,reopenAsDraftAction,saveVersionSnapshot}=useSupabaseAuth();
  // Drives the one-shot ring on approval. Removed after the animation
  // so it can fire again on the next plan rather than persisting.
  const [justApproved,setJustApproved]=useState(false);
  const selectedStudent=dbStudents?.[0]||null;
  const ss=selectedStudent;
  const alpStatus=ss?.alp_status||"draft";
  const isLocked=(alpStatus==="approved"||alpStatus==="in_review")&&!["director","admin"].includes(realRole);
  const canApprove=["director","admin"].includes(realRole);
  const [submitting,setSubmitting]=useState(false);
  const [reviewDecisionNotes,setReviewDecisionNotes]=useState("");
  const [showReviewPanel,setShowReviewPanel]=useState(false);

  async function handleSubmitForReview(){
    if(!ss?.id){toast("No student selected","error");return;}
    setSubmitting(true);
    const r=await submitForReviewAction(ss.id);
    if(!r.error){toast("Sent for review. Your director will see it in their queue.","success");}
    else toast(r.error.message||"Submit failed","error");
    setSubmitting(false);
  }
  async function handleApprove(){
    if(!ss?.id)return;
    setSubmitting(true);
    const r=await approveALPAction(ss.id,reviewDecisionNotes);
    if(!r.error){
      toast(`${ss.name.split(" ")[0]}'s plan is approved — ready to share with the family`,"success");
      setJustApproved(true); setTimeout(()=>setJustApproved(false),1000);
      setShowReviewPanel(false);setReviewDecisionNotes("");
    }
    else toast(r.error.message||"Approval failed — director/admin role required","error");
    setSubmitting(false);
  }
  async function handleRequestChanges(){
    if(!ss?.id)return;
    if(!reviewDecisionNotes.trim()){toast("Add a note explaining what needs to change","error");return;}
    setSubmitting(true);
    const r=await requestChangesAction(ss.id,reviewDecisionNotes);
    if(!r.error){toast("Changes requested","success");setShowReviewPanel(false);setReviewDecisionNotes("");}
    else toast(r.error.message||"Failed","error");
    setSubmitting(false);
  }
  async function handleReopenDraft(){
    if(!ss?.id)return;
    const r=await reopenAsDraftAction(ss.id);
    if(!r.error)toast("Reopened as draft for editing","success");
  }

  /* ── Step 1 */
  const defaultReviewDate=new Date(Date.now()+365*86400000).toISOString().split("T")[0];
  const blankSData={
    firstName:"",lastName:"",dob:"",gender:"",
    grade:"",studentId:"",school:"",
    enrollDate:"",reviewDate:defaultReviewDate,tier:"Tier 2",photo:null,notes:"",
    parentName:"",parentEmail:"",
    parentPhone:"",emergencyContact:"",
    /* Step 2 */
    strengths:"",growthAreas:"",learningConcerns:"",
    learningStyle:"",interests:"",languages:"",
    techSkills:"",parentObservations:"",
    /* Step 3 */
    readingScore:0,writingScore:0,mathScore:0,scienceScore:0,
    criticalThinkingScore:0,communicationScore:0,socialScore:0,
    lifeSkillsScore:0,digitalLiteracyScore:0,
    assessmentDate:"",assessor:"",assessmentNotes:"",
    /* Step 4 */
    academicNarrative:"",functionalNarrative:"",
    riskIndicators:{reading:false,attention:false,writing:false,socialEmotional:false,attendance:false},
    /* Step 5 */
    goals:[],
    /* Step 6 */
    accommodations:{presentation:[],response:[],setting:[],timing:[]},
    customAccomm:"",
    /* Step 7 */
    interventions:[],
    /* Step 8 */
    progressEntries:[],
    /* Step 9 */
    transitionTarget:"",postSecGoal:"",transitionDomain:"Employment",
    /* Step 10 */
    meetingDate:new Date().toISOString().split("T")[0],reviewNotes:"",
  };

  // Pre-fill from selected Supabase student if available.
  // alp_data (JSONB blob) takes precedence for Step 6-9 fields since those
  // columns don't exist individually — it is merged last so explicit DB
  // columns (name, DOB, etc.) always win over any stale blob data.
  const prefilled=ss?{
    ...blankSData,
    ...(ss.alp_data||{}),         // restore Step 6-9 from blob first (may be overridden below)
    firstName:ss.name?.split(" ")[0]||"",
    lastName:ss.name?.split(" ").slice(1).join(" ")||"",
    dob:ss.dob||"",gender:ss.gender||"",grade:ss.grade||"",
    studentId:ss.student_id||"",school:ss.school_name||"",
    enrollDate:ss.enrollment_date||"",reviewDate:ss.review_date||defaultReviewDate,tier:ss.tier||"Tier 2",
    parentName:ss.parent_name||"",parentEmail:ss.parent_email||"",
    parentPhone:ss.parent_phone||"",
    strengths:ss.strengths||"",growthAreas:ss.growth_areas||"",
    learningConcerns:ss.concerns||"",interests:ss.interests||"",
    learningStyle:ss.learning_style||"",languages:ss.language||"",
    assessor:user?.email?.split("@")[0]||"",
    meetingDate:ss.meeting_date||new Date().toISOString().split("T")[0],
    reviewNotes:ss.review_notes||"",
  }:blankSData;

  const [sData,setSData]=useState(prefilled);
  const SD=(k,v)=>setSData(p=>({...p,[k]:v}));

  const STEPS=[
    "Student Information","Learning Profile","Baseline Assessment",
    "Present Levels","Learning Goals","Accommodations & Support",
    "Intervention Plans","Progress Monitoring","Future Readiness","Review & Sign-Off"
  ];
  const TOTAL=STEPS.length;
  const completion=Math.round((completedSteps.length/TOTAL)*100);

  async function next(){
    if(!ss?.id&&step>1){toast("No student selected — please go back to Step 1 and select or create a student before continuing","error");return;}
    if(!completedSteps.includes(step)) setCompletedSteps(s=>[...s,step]);
    if(step===TOTAL){
      // Save all goals to Supabase on final step
      if(ss?.id && sData.goals.length>0){
        for(const g of sData.goals){
          if(g.text?.trim()){
            await createGoalRecord({
              student_id:ss.id,goal_text:g.text,domain:g.domain,
              baseline:g.baseline,target:g.target,
              target_date:g.targetDate,monitoring:"Weekly",
              created_by:user?.id,
            }).catch(()=>{});
          }
        }
      }
      // Update student record with final ALP data
      if(ss?.id){
        await updateStudentRecord(ss.id,{
          strengths:sData.strengths,growth_areas:sData.growthAreas,
          concerns:sData.learningConcerns,interests:sData.interests,
          learning_style:sData.learningStyle,tier:sData.tier,
          // Guardian contacts live on student_guardians, managed by
          // <GuardianContacts/>. They were previously written here to
          // columns that do not exist on students, so they were lost.
          notes:sData.notes,
          alp_completed:true,alp_completed_date:new Date().toISOString(),
          review_notes:sData.reviewNotes,meeting_date:sData.meetingDate,
          review_date:sData.reviewDate||defaultReviewDate,
          alp_data:sData, // full 10-step blob — preserves Steps 6-9 across sessions
        }).catch(()=>{});
        // Document Version History — immutable snapshot of this completed draft
        await saveVersionSnapshot(ss.id,sData,"Step 10 completed — full ALP draft",alpStatus).catch(()=>{});
      }
      setPage("review");
      toast("ALP completed — opening Review Summary ✓","success");
    }
    else setStep(s=>s+1);
  }
  function back(){if(step>1)setStep(s=>s-1);}

  const SH=({n,title,sub})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22,flexWrap:"wrap",gap:12}}>
      <div>
        <p className="lbl" style={{color:C.purple,marginBottom:4}}>STEP {n} OF {TOTAL}</p>
        <h2 className="serif" style={{fontSize:isMobile?20:24,fontWeight:800,color:C.black,letterSpacing:"-.016em",lineHeight:1.15}}>
          {title}{sub&&<><br/><span className="serif-italic" style={{fontSize:isMobile?17:21}}>{sub}</span></>}
        </h2>
      </div>
      <button className="btn-outline" onClick={()=>setShowAI(true)} style={{fontSize:11,padding:"9px 16px",whiteSpace:"nowrap"}}>
        ✦ AI Assist
      </button>
    </div>
  );

  const DomainScore=({label,score,max=100,color})=>(
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
        <span style={{color:C.warm,fontWeight:600}}>{label}</span>
        <span style={{fontWeight:700,color:score>=70?C.green:score>=50?C.amber:C.red}}>{score}/{max}</span>
      </div>
      <div style={{height:7,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${score/max*100}%`,background:color||C.purple,borderRadius:99,transition:"width .5s"}}/>
      </div>
    </div>
  );

  return(
    <Page title={<>ALP <span className="serif-italic" style={{fontSize:isMobile?20:26}}>Builder</span></>}
      subtitle={ss?`${ss.name} — Step ${step} of ${TOTAL} — ${STEPS[step-1]}`:`Step ${step} of ${TOTAL} — ${STEPS[step-1]}`}
      action={<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        {dbStudents?.length>1&&<select onChange={e=>{const found=dbStudents.find(st=>st.id===e.target.value);if(found){setSData(p=>({...p,firstName:found.name?.split(" ")[0]||"",lastName:found.name?.split(" ").slice(1).join(" ")||"",grade:found.grade||"",studentId:found.student_id||"",school:found.school_name||"",parentName:found.parent_name||"",parentEmail:found.parent_email||"",strengths:found.strengths||"",growthAreas:found.growth_areas||"",}));}}} style={{fontSize:11,padding:"7px 10px",border:`1px solid ${C.tanL}`,borderRadius:8,background:C.white,color:C.black}}>{dbStudents.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}</select>}
        <button className="btn-ghost" onClick={()=>setPage("students")} style={{fontSize:11}}>← Students</button>
        <button className="btn-purple" disabled={isLocked} onClick={async()=>{
          if(ss?.id){
            await updateStudentRecord(ss.id,{
              strengths:sData.strengths,growth_areas:sData.growthAreas,
              concerns:sData.learningConcerns,interests:sData.interests,
              learning_style:sData.learningStyle,language:sData.languages,
              tier:sData.tier,notes:sData.notes,
              review_date:sData.reviewDate||defaultReviewDate,
              alp_data:sData, // full 10-step blob — preserves Steps 6-9 across sessions
            });
            await saveVersionSnapshot(ss.id,sData,`Manual save at Step ${step}`,alpStatus);
            toast("ALP saved to Supabase ✓ — version recorded","success");
          } else {
            toast("ALP saved locally ✓","success");
          }
        }} style={{fontSize:11,padding:"9px 18px",opacity:isLocked?.5:1}}>↑ Save</button>
      </div>}>

      {showAI&&<AIModal onClose={()=>setShowAI(false)} context={`ALP Builder Step ${step}: ${STEPS[step-1]}`}/>}

      {/* ── Workflow status bar ── */}
      {ss&&(()=>{
        const statusMeta={
          draft:{label:"Draft",color:C.warm,bg:C.tanL,icon:"✏️"},
          in_review:{label:"In Review",color:C.amber,bg:"#FFFBEB",icon:"👁️"},
          approved:{label:"Approved",color:C.green,bg:"#F0FDF4",icon:"✅"},
          changes_requested:{label:"Changes Requested",color:C.red,bg:"#FEF2F2",icon:"⚠️"},
          archived:{label:"Archived",color:C.warm,bg:C.tanL,icon:"📦"},
        }[alpStatus]||{label:alpStatus,color:C.warm,bg:C.tanL,icon:"•"};
        return(
          <div className="card" style={{padding:"14px 18px",marginBottom:16,background:statusMeta.bg,border:`1px solid ${statusMeta.color}33`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:11,fontWeight:800,color:statusMeta.color,background:"#fff",padding:"4px 12px",borderRadius:99,display:"flex",alignItems:"center",gap:5}}>{statusMeta.icon} {statusMeta.label.toUpperCase()}</span>
            {isLocked&&<span style={{fontSize:12,color:statusMeta.color}}>🔒 Locked — only a director or admin can edit while {statusMeta.label.toLowerCase()}.</span>}
            {alpStatus==="changes_requested"&&ss.review_decision_notes&&<span style={{fontSize:12,color:C.warm,flex:1}}>Reviewer note: "{ss.review_decision_notes}"</span>}
            <div style={{marginLeft:"auto",display:"flex",gap:8}}>
              {(alpStatus==="draft"||alpStatus==="changes_requested")&&!canApprove&&(
                <button className="btn-purple" disabled={submitting} onClick={handleSubmitForReview} style={{fontSize:11,padding:"8px 16px"}}>
                  {submitting?<><Spin/> Submitting…</>:"📤 Submit for Review"}
                </button>
              )}
              {alpStatus==="in_review"&&canApprove&&(
                <button className="btn-purple" onClick={()=>setShowReviewPanel(true)} style={{fontSize:11,padding:"8px 16px"}}>👁️ Review →</button>
              )}
              {alpStatus==="approved"&&canApprove&&(
                <button className="btn-ghost" onClick={handleReopenDraft} style={{fontSize:11,padding:"8px 16px"}}>🔓 Reopen as Draft</button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Review panel (director/admin only) ── */}
      {showReviewPanel&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowReviewPanel(false)}>
          <div className="card fade-up" style={{width:"100%",maxWidth:480,padding:0}}>
            <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><p className="lbl" style={{color:C.purple,marginBottom:4}}>REVIEW ALP</p><h3 style={{fontSize:18,fontWeight:800,color:C.black}}>{ss?.name}</h3></div>
              <button onClick={()=>setShowReviewPanel(false)} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"22px 26px",display:"flex",flexDirection:"column",gap:14}}>
              <p style={{fontSize:13,color:C.warm,lineHeight:1.6}}>Submitted by {profile?.full_name||"a teacher"} on {ss?.submitted_for_review_at?new Date(ss.submitted_for_review_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"—"}.</p>
              <UTextarea label="Decision notes (visible to teacher)" value={reviewDecisionNotes} onChange={e=>setReviewDecisionNotes(e.target.value)} rows={4} placeholder="What's working well? What needs to change before approval?"/>
              <div style={{display:"flex",gap:10}}>
                <button className="btn-ghost" disabled={submitting} onClick={handleRequestChanges} style={{flex:1,fontSize:12,color:C.red}}>⚠️ Request Changes</button>
                <button className="btn-purple" disabled={submitting} onClick={handleApprove} style={{flex:1,fontSize:12,padding:"13px"}}>{submitting?<><Spin/> Saving…</>:"✅ Approve ALP"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress bar + step nav ── */}
      <div className={`card${justApproved?" celebrate":""}`} style={{padding:"18px 20px",marginBottom:20,opacity:isLocked?.6:1,pointerEvents:isLocked?"none":"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          {/* Steps finished, not a percentage. "7 of 10" is a fact a
              teacher can act on; "70%" is a number they have to
              convert before it means anything. */}
          <span className="lbl" style={{margin:0}}>
            {completedSteps.length===0
              ? "Ten steps to a complete plan"
              : completedSteps.length===10
                ? "All ten steps complete"
                : `${completedSteps.length} of 10 steps done`}
          </span>
          <span style={{fontSize:13,fontWeight:700,color:completedSteps.length===10?C.green:C.purple,letterSpacing:"-.01em"}}>
            {completedSteps.length===10?"Ready to submit":`${10-completedSteps.length} to go`}
          </span>
        </div>
        {/* Ten ticks rather than one bar: each one is a step the
            teacher actually did, and the gaps show which. */}
        <div className="step-rail" style={{marginBottom:16}}>
          {STEPS.map((_,i)=>(
            <span key={i} className={`step-tick ${completedSteps.includes(i+1)?"done":i+1===step?"current":""}`}/>
          ))}
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {STEPS.map((s,i)=>{
            const n=i+1,done=completedSteps.includes(n),active=n===step;
            return(
              <button key={s} onClick={()=>setStep(n)} style={{
                fontSize:9,padding:"5px 8px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,
                background:active?C.purple:done?"#DCFCE7":"transparent",
                color:active?"#fff":done?C.green:C.warm,
                outline:active?`2px solid ${C.purple}`:"none",outlineOffset:1,transition:"all .2s"
              }} title={s}>
                {done&&!active?"✓ ":""}{n}. {s.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          STEP 1 — STUDENT INFORMATION
      ══════════════════════════════════════════ */}
      <fieldset disabled={isLocked} style={{border:"none",padding:0,margin:0,minWidth:0}}>
      {step===1&&(
        <div>
          <SH n={1} title="Student" sub="Information"/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:16}}>STUDENT DETAILS</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <UInput label="First Name" value={sData.firstName} onChange={e=>SD("firstName",e.target.value)}/>
                  <UInput label="Last Name" value={sData.lastName} onChange={e=>SD("lastName",e.target.value)}/>
                  <UInput label="Date of Birth" value={sData.dob} onChange={e=>SD("dob",e.target.value)} type="date"/>
                  <USelect label="Gender" value={sData.gender} onChange={e=>SD("gender",e.target.value)}
                    options={["Male","Female","Non-binary","Prefer not to say"]}/>
                  <USelect label="Grade" value={sData.grade} onChange={e=>SD("grade",e.target.value)}
                    options={["Pre-K","Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"]}/>
                  <UInput label="Student ID" value={sData.studentId} onChange={e=>SD("studentId",e.target.value)}/>
                  <UInput label="School / Organisation" value={sData.school} onChange={e=>SD("school",e.target.value)}/>
                  <UInput label="Enrolment Date" value={sData.enrollDate} onChange={e=>SD("enrollDate",e.target.value)} type="date"/>
                  <UInput label="Annual Review Date" value={sData.reviewDate} onChange={e=>SD("reviewDate",e.target.value)} type="date" hint="Compliance dashboard tracks this date — set within 12 months"/>
                </div>
              </div>
              <GuardianContacts studentId={ss?.id} disabled={isLocked}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:14}}>SUPPORT TIER</p>
                {[["Tier 1","Universal — whole class"],["Tier 2","Targeted — small group"],["Tier 3","Intensive — individual"]].map(([t,desc])=>(
                  <label key={t} onClick={()=>SD("tier",t)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:8,marginBottom:8,cursor:"pointer",
                    background:sData.tier===t?C.purpleL:"transparent",border:`1px solid ${sData.tier===t?C.purple:C.tanL}`,transition:"all .2s"}}>
                    <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${sData.tier===t?C.purple:C.warm}`,
                      background:sData.tier===t?C.purple:"transparent",flexShrink:0,marginTop:1}}/>
                    <div><div style={{fontSize:13,fontWeight:700,color:C.black}}>{t}</div>
                    <div style={{fontSize:11,color:C.warm}}>{desc}</div></div>
                  </label>
                ))}
              </div>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:12}}>NOTES</p>
                <UTextarea label="Additional Notes" value={sData.notes} onChange={e=>SD("notes",e.target.value)} rows={4}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 2 — LEARNING PROFILE
      ══════════════════════════════════════════ */}
      {step===2&&(
        <div>
          <SH n={2} title="Learning" sub="Profile"/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:16}}>ACADEMIC PROFILE</p>
              <UTextarea label="Academic Strengths" value={sData.strengths} onChange={e=>SD("strengths",e.target.value)} rows={3}/>
              <div style={{marginTop:14}}/>
              <UTextarea label="Growth Areas" value={sData.growthAreas} onChange={e=>SD("growthAreas",e.target.value)} rows={3}/>
              <div style={{marginTop:14}}/>
              <UTextarea label="Learning Concerns / Identified Challenges" value={sData.learningConcerns} onChange={e=>SD("learningConcerns",e.target.value)} rows={3}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:16}}>LEARNING STYLE & INTERESTS</p>
                <USelect label="Primary Learning Style" value={sData.learningStyle.split(".")[0]} onChange={e=>SD("learningStyle",e.target.value+".")}
                  options={["Visual learner","Auditory learner","Kinesthetic learner","Visual-kinesthetic learner","Reading/writing learner","Multi-modal"]}/>
                <div style={{marginTop:14}}/>
                <UTextarea label="Interests & Motivators" value={sData.interests} onChange={e=>SD("interests",e.target.value)} rows={2}/>
                <div style={{marginTop:14}}/>
                <UInput label="Home Language(s)" value={sData.languages} onChange={e=>SD("languages",e.target.value)}/>
                <div style={{marginTop:14}}/>
                <UInput label="Technology Skills" value={sData.techSkills} onChange={e=>SD("techSkills",e.target.value)}/>
              </div>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:12}}>PARENT / GUARDIAN OBSERVATIONS</p>
                <UTextarea label="What parents have shared" value={sData.parentObservations} onChange={e=>SD("parentObservations",e.target.value)} rows={4}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 3 — BASELINE ASSESSMENT
      ══════════════════════════════════════════ */}
      {step===3&&(
        <div>
          <SH n={3} title="Baseline" sub="Assessment"/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>
            <div className="card" style={{padding:"22px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <p className="lbl">DOMAIN SCORES</p>
                <div style={{display:"flex",gap:8}}>
                  <UInput label="" value={sData.assessmentDate} onChange={e=>SD("assessmentDate",e.target.value)} type="date" style={{fontSize:11,padding:"6px 10px",width:130}}/>
                </div>
              </div>
              {[
                ["Reading & Literacy",sData.readingScore,"readingScore",C.red],
                ["Writing & Expression",sData.writingScore,"writingScore",C.blue],
                ["Mathematics",sData.mathScore,"mathScore",C.green],
                ["Science & Inquiry",sData.scienceScore,"scienceScore",C.amber],
                ["Critical Thinking",sData.criticalThinkingScore,"criticalThinkingScore",C.purple],
                ["Communication",sData.communicationScore,"communicationScore","#6366F1"],
                ["Social & Emotional",sData.socialScore,"socialScore","#EC4899"],
                ["Life Skills",sData.lifeSkillsScore,"lifeSkillsScore","#14B8A6"],
                ["Digital Literacy",sData.digitalLiteracyScore,"digitalLiteracyScore","#F97316"],
              ].map(([label,score,key,color])=>(
                <div key={key} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                    <span style={{fontWeight:600,color:C.black}}>{label}</span>
                    <input type="number" min={0} max={100} value={score}
                      onChange={e=>SD(key,Number(e.target.value))}
                      style={{width:56,padding:"3px 8px",borderRadius:6,border:`1.5px solid ${C.tanL}`,fontSize:12,fontWeight:700,
                        color:score>=70?C.green:score>=50?C.amber:C.red,textAlign:"center",background:"transparent"}}/>
                  </div>
                  <div style={{height:8,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${score}%`,background:color,borderRadius:99,transition:"width .4s"}}/>
                  </div>
                </div>
              ))}
              <UTextarea label="Assessor Notes" value={sData.assessmentNotes} onChange={e=>SD("assessmentNotes",e.target.value)} rows={3} style={{marginTop:8}}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:14}}>ASSESSMENT SUMMARY</p>
                <UInput label="Assessor Name" value={sData.assessor} onChange={e=>SD("assessor",e.target.value)}/>
                <div style={{marginTop:14}}/>
                {[
                  ["Overall Average",Math.round([sData.readingScore,sData.writingScore,sData.mathScore,sData.scienceScore,sData.criticalThinkingScore,sData.communicationScore,sData.socialScore,sData.lifeSkillsScore,sData.digitalLiteracyScore].reduce((a,b)=>a+b,0)/9)],
                  ["Strongest Domain",["Reading","Writing","Math","Science","Critical Thinking","Communication","Social","Life Skills","Digital Literacy"][[sData.readingScore,sData.writingScore,sData.mathScore,sData.scienceScore,sData.criticalThinkingScore,sData.communicationScore,sData.socialScore,sData.lifeSkillsScore,sData.digitalLiteracyScore].indexOf(Math.max(sData.readingScore,sData.writingScore,sData.mathScore,sData.scienceScore,sData.criticalThinkingScore,sData.communicationScore,sData.socialScore,sData.lifeSkillsScore,sData.digitalLiteracyScore))]],
                  ["Needs Most Support",["Reading","Writing","Math","Science","Critical Thinking","Communication","Social","Life Skills","Digital Literacy"][[sData.readingScore,sData.writingScore,sData.mathScore,sData.scienceScore,sData.criticalThinkingScore,sData.communicationScore,sData.socialScore,sData.lifeSkillsScore,sData.digitalLiteracyScore].indexOf(Math.min(sData.readingScore,sData.writingScore,sData.mathScore,sData.scienceScore,sData.criticalThinkingScore,sData.communicationScore,sData.socialScore,sData.lifeSkillsScore,sData.digitalLiteracyScore))]],
                ].map(([label,val])=>(
                  <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,fontSize:13}}>
                    <span style={{color:C.warm}}>{label}</span>
                    <span style={{fontWeight:700,color:C.black}}>{val}{label==="Overall Average"?"%":""}</span>
                  </div>
                ))}
              </div>
              <div className="card" style={{padding:"18px 20px",background:C.purpleL,border:`1px solid ${C.purple}22`}}>
                <p style={{fontSize:12,fontWeight:700,color:C.purple,marginBottom:6}}>✦ AI Analysis</p>
                <p style={{fontSize:12,color:C.black,lineHeight:1.6}}>
                  {sData.firstName} shows a significant gap between reading (
                  {sData.readingScore}%) and science ({sData.scienceScore}%). 
                  This pattern suggests strong conceptual understanding but decoding barriers. 
                  Recommend prioritising literacy intervention while using science as a motivational anchor.
                </p>
                <button className="btn-purple" onClick={()=>setShowAI(true)} style={{fontSize:11,padding:"8px 16px",marginTop:10,width:"100%"}}>
                  Full AI Analysis →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 4 — PRESENT LEVELS
      ══════════════════════════════════════════ */}
      {step===4&&(
        <div>
          <SH n={4} title="Present Levels" sub="of Academic & Functional Performance"/>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:6}}>ACADEMIC PERFORMANCE NARRATIVE</p>
              <p style={{fontSize:11,color:C.warm,marginBottom:12}}>
                Describe current academic performance across subjects. This becomes the baseline narrative in the ALP document.
              </p>
              <UTextarea label="" value={sData.academicNarrative} onChange={e=>SD("academicNarrative",e.target.value)} rows={6}/>
            </div>
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:6}}>FUNCTIONAL PERFORMANCE NARRATIVE</p>
              <p style={{fontSize:11,color:C.warm,marginBottom:12}}>
                Describe daily living skills, social participation, communication, and independence.
              </p>
              <UTextarea label="" value={sData.functionalNarrative} onChange={e=>SD("functionalNarrative",e.target.value)} rows={5}/>
            </div>
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:14}}>RISK INDICATORS</p>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10}}>
                {[["reading","📖 Reading difficulties"],["attention","⚡ Attention & focus"],["writing","✏️ Written expression"],
                  ["socialEmotional","❤️ Social-emotional"],["attendance","🏫 Attendance concerns"]].map(([key,label])=>(
                  <label key={key} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:8,cursor:"pointer",
                    background:sData.riskIndicators[key]?"#FEF2F2":C.tanL,
                    border:`1.5px solid ${sData.riskIndicators[key]?"#FCA5A5":C.tanL}`,transition:"all .2s"}}>
                    <input type="checkbox" checked={!!sData.riskIndicators[key]}
                      onChange={e=>SD("riskIndicators",{...sData.riskIndicators,[key]:e.target.checked})} style={{width:15,height:15}}/>
                    <span style={{fontSize:12,fontWeight:600,color:sData.riskIndicators[key]?C.red:C.warm}}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 5 — LEARNING GOALS
      ══════════════════════════════════════════ */}
      {step===5&&(
        <div>
          <SH n={5} title="Learning" sub="Goals"/>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {sData.goals.map((g,gi)=>(
              <div key={g.id} className="card" style={{padding:"22px 24px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{padding:"4px 10px",borderRadius:99,fontSize:10,fontWeight:800,letterSpacing:".08em",
                      background:{READING:"#FEF2F2",WRITING:"#EFF6FF",COMMUNICATION:"#FAF5FF",MATH:"#F0FDF4",SOCIAL:"#FFF7ED",OTHER:"#F8FAFC"}[g.domain]||"#F8FAFC",
                      color:{READING:C.red,WRITING:C.blue,COMMUNICATION:C.purple,MATH:C.green,SOCIAL:C.amber,OTHER:C.warm}[g.domain]||C.warm}}>
                      {g.domain}
                    </span>
                    <span style={{fontSize:13,fontWeight:700,color:C.black}}>Goal {gi+1}</span>
                  </div>
                  <button onClick={()=>SD("goals",sData.goals.filter((_,i)=>i!==gi))}
                    style={{fontSize:11,color:C.red,background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>✕ Remove</button>
                </div>
                <UTextarea label="Goal Statement (measurable)" value={g.text}
                  onChange={e=>SD("goals",sData.goals.map((x,i)=>i===gi?{...x,text:e.target.value}:x))} rows={2}/>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr 1fr",gap:12,marginTop:12}}>
                  <UInput label="Baseline" value={g.baseline}
                    onChange={e=>SD("goals",sData.goals.map((x,i)=>i===gi?{...x,baseline:e.target.value}:x))}/>
                  <UInput label="Target" value={g.target}
                    onChange={e=>SD("goals",sData.goals.map((x,i)=>i===gi?{...x,target:e.target.value}:x))}/>
                  <UInput label="Target Date" value={g.targetDate} type="date"
                    onChange={e=>SD("goals",sData.goals.map((x,i)=>i===gi?{...x,targetDate:e.target.value}:x))}/>
                  <UInput label="Assigned Staff" value={g.staff}
                    onChange={e=>SD("goals",sData.goals.map((x,i)=>i===gi?{...x,staff:e.target.value}:x))}/>
                </div>
                <div style={{marginTop:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                    <span style={{color:C.warm}}>Current Progress</span>
                    <span style={{fontWeight:700,color:g.progress>=70?C.green:g.progress>=40?C.amber:C.red}}>{g.progress}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={g.progress}
                    onChange={e=>SD("goals",sData.goals.map((x,i)=>i===gi?{...x,progress:Number(e.target.value)}:x))}
                    style={{width:"100%",accentColor:C.purple}}/>
                </div>
              </div>
            ))}
            <button className="btn-outline" onClick={()=>SD("goals",[...sData.goals,{
              id:Date.now(),domain:"OTHER",text:"",baseline:"",target:"",
              targetDate:new Date().toISOString().split("T")[0],staff:"",status:"Active",progress:0
            }])} style={{fontSize:12,padding:"12px 20px",borderStyle:"dashed"}}>
              + Add Learning Goal
            </button>
            <div style={{padding:"14px 18px",background:C.purpleL,borderRadius:10,border:`1px solid ${C.purple}22`}}>
              <p style={{fontSize:12,fontWeight:700,color:C.purple,marginBottom:4}}>✦ AI Goal Recommendations</p>
              <p style={{fontSize:12,color:C.black}}>Based on the baseline assessment, consider adding a Math goal (71%) as a strength to build on, and a Digital Literacy goal (62%) to support classroom independence.</p>
              <button className="btn-purple" onClick={()=>setShowAI(true)} style={{fontSize:11,padding:"8px 16px",marginTop:8}}>Generate Goals with AI →</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 6 — ACCOMMODATIONS & SUPPORT
      ══════════════════════════════════════════ */}
      {step===6&&(
        <div>
          <SH n={6} title="Accommodations" sub="& Support Strategies"/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
            {[
              ["presentation","📖 Presentation",["Extended time on assessments (1.5×)","Text-to-speech for reading tasks","Directions read aloud or pre-recorded","Large print materials","Reduced visual clutter on worksheets"]],
              ["response","✏️ Response",["Oral responses accepted for written tasks","Scribe for longer assignments","Speech-to-text software","Graphic organisers instead of essays","Multiple-choice instead of short answer"]],
              ["setting","🏫 Setting",["Preferential seating near teacher","Small-group testing environment","Separate quiet room for assessments","Flexible seating options","Reduced distractions workspace"]],
              ["timing","⏱ Timing & Scheduling",["Movement breaks every 20 minutes","Flexible scheduling for assessments","Extended time (1.5× or 2×)","Assignments chunked into smaller parts","Brain breaks between tasks"]],
            ].map(([key,title,opts])=>(
              <div key={key} className="card" style={{padding:"20px 22px"}}>
                <p className="lbl" style={{marginBottom:14}}>{title}</p>
                {opts.map(opt=>{
                  const checked=(sData.accommodations[key]||[]).includes(opt);
                  return(
                    <label key={opt} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10,cursor:"pointer"}}>
                      <input type="checkbox" checked={checked} onChange={()=>{
                        const curr=sData.accommodations[key]||[];
                        SD("accommodations",{...sData.accommodations,[key]:checked?curr.filter(x=>x!==opt):[...curr,opt]});
                      }} style={{marginTop:2,accentColor:C.purple,width:14,height:14}}/>
                      <span style={{fontSize:12,color:C.black,lineHeight:1.4}}>{opt}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="card" style={{padding:"20px 22px",marginTop:14}}>
            <p className="lbl" style={{marginBottom:12}}>CUSTOM ACCOMMODATIONS</p>
            <UTextarea label="Additional accommodations not listed above" value={sData.customAccomm}
              onChange={e=>SD("customAccomm",e.target.value)} rows={3}/>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 7 — INTERVENTION PLANS
      ══════════════════════════════════════════ */}
      {step===7&&(
        <div>
          <SH n={7} title="Intervention" sub="Plans"/>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {sData.interventions.map((iv,ii)=>(
              <div key={ii} className="card" style={{padding:"22px 24px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <span style={{fontSize:13,fontWeight:700,color:C.black}}>Intervention {ii+1}</span>
                  <button onClick={()=>SD("interventions",sData.interventions.filter((_,i)=>i!==ii))}
                    style={{fontSize:11,color:C.red,background:"none",border:"none",cursor:"pointer"}}>✕</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
                  <UInput label="Programme / Intervention Name" value={iv.program}
                    onChange={e=>SD("interventions",sData.interventions.map((x,i)=>i===ii?{...x,program:e.target.value}:x))}/>
                  <USelect label="Status" value={iv.status}
                    onChange={e=>SD("interventions",sData.interventions.map((x,i)=>i===ii?{...x,status:e.target.value}:x))}
                    options={["Active","On Hold","Completed","Exited"]}/>
                  <UInput label="Frequency" value={iv.frequency} placeholder="e.g. 3× per week"
                    onChange={e=>SD("interventions",sData.interventions.map((x,i)=>i===ii?{...x,frequency:e.target.value}:x))}/>
                  <UInput label="Duration per Session" value={iv.duration} placeholder="e.g. 30 min"
                    onChange={e=>SD("interventions",sData.interventions.map((x,i)=>i===ii?{...x,duration:e.target.value}:x))}/>
                  <UInput label="Assigned Staff" value={iv.staff}
                    onChange={e=>SD("interventions",sData.interventions.map((x,i)=>i===ii?{...x,staff:e.target.value}:x))}/>
                  <UInput label="Expected Outcome" value={iv.outcome}
                    onChange={e=>SD("interventions",sData.interventions.map((x,i)=>i===ii?{...x,outcome:e.target.value}:x))}/>
                </div>
              </div>
            ))}
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {["Reading Intervention","Math Support","Behaviour Plan","Speech & Language","Social Skills Group","Career Readiness"].map(prog=>(
                <button key={prog} className="btn-ghost" onClick={()=>SD("interventions",[...sData.interventions,
                  {program:prog,frequency:"",duration:"",staff:"",outcome:"",status:"Active"}])}
                  style={{fontSize:11,padding:"9px 14px",borderStyle:"dashed"}}>
                  + {prog}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 8 — PROGRESS MONITORING
      ══════════════════════════════════════════ */}
      {step===8&&(
        <div>
          <SH n={8} title="Progress" sub="Monitoring"/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"22px 24px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <p className="lbl">DATA POINTS</p>
                  <button className="btn-purple" onClick={()=>{
                    const entry={date:new Date().toISOString().split("T")[0],domain:"Reading",score:Math.floor(Math.random()*20+65),notes:"Quick probe"};
                    SD("progressEntries",[...sData.progressEntries,entry]);
                    toast("Data point logged ✓","success");
                  }} style={{fontSize:11,padding:"8px 16px"}}>+ Log Entry</button>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table className="data-table" style={{minWidth:380}}>
                    <thead><tr>{["Date","Domain","Score","Notes"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {sData.progressEntries.map((e,i)=>(
                        <tr key={i}>
                          <td style={{fontSize:12,color:C.warm}}>{e.date}</td>
                          <td style={{fontSize:12,fontWeight:600}}>{e.domain}</td>
                          <td><span style={{fontWeight:700,color:e.score>=70?C.green:e.score>=50?C.amber:C.red}}>{e.score}</span></td>
                          <td style={{fontSize:11,color:C.warm}}>{e.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:16}}>GOAL PROGRESS TRACKER</p>
                {sData.goals.map(g=>(
                  <div key={g.id} style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
                      <span style={{fontWeight:600,color:C.black,flex:1,paddingRight:8}}>{g.domain} — {g.text.slice(0,60)}{g.text.length>60?"…":""}</span>
                      <span style={{fontWeight:700,color:g.progress>=70?C.green:g.progress>=40?C.amber:C.red,flexShrink:0}}>{g.progress}%</span>
                    </div>
                    <div style={{height:8,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${g.progress}%`,background:g.progress>=70?C.green:g.progress>=40?C.amber:C.red,borderRadius:99,transition:"width .4s"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.warm,marginTop:3}}>
                      <span>Baseline: {g.baseline}</span><span>Target: {g.target} by {g.targetDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"20px 22px"}}>
                <p className="lbl" style={{marginBottom:14}}>ATTENDANCE SNAPSHOT</p>
                {[["Present","174 days","92%",C.green],["Absent","14 days","7%",C.amber],["Tardy","4 days","1%",C.red]].map(([l,v,p,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,fontSize:13}}>
                    <span style={{color:C.warm}}>{l}</span>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontWeight:700,color:c}}>{v}</span>
                      <span style={{fontSize:11,color:C.warm,marginLeft:6}}>({p})</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card" style={{padding:"20px 22px",background:C.purpleL,border:`1px solid ${C.purple}22`}}>
                <p style={{fontSize:12,fontWeight:700,color:C.purple,marginBottom:8}}>✦ AI Insight</p>
                <p style={{fontSize:12,color:C.black,lineHeight:1.6}}>
                  {sData.firstName}'s reading score has improved {sData.progressEntries.length>1?sData.progressEntries[sData.progressEntries.length-1].score-sData.progressEntries[0].score:0} points since baseline.
                  Trend is positive. Recommend maintaining current intervention frequency through the next marking period.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 9 — FUTURE READINESS & TRANSITION
      ══════════════════════════════════════════ */}
      {step===9&&(
        <div>
          <SH n={9} title="Future Readiness" sub="& Transition Planning"/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:16}}>TRANSITION GOALS</p>
                <USelect label="Post-Secondary Target" value={sData.transitionTarget}
                  onChange={e=>SD("transitionTarget",e.target.value)}
                  options={["College Prep Programme","Vocational Training","Supported Employment","Community Participation","Independent Living Programme","Career Exploration"]}/>
                <div style={{marginTop:14}}/>
                <UTextarea label="Long-Term Post-Secondary Goal" value={sData.postSecGoal}
                  onChange={e=>SD("postSecGoal",e.target.value)} rows={4}/>
              </div>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:16}}>TRANSITION SKILLS CHECKLIST</p>
                {[
                  ["💼","Employment & Career",["Identifies personal interests and strengths","Understands workplace expectations","Participated in job shadowing or career exploration"]],
                  ["🏠","Independent Living",["Can manage a simple budget","Can use public transport independently","Can prepare simple meals"]],
                  ["🤝","Community",["Participates in community groups or activities","Can self-advocate in familiar settings","Understands personal rights and responsibilities"]],
                  ["🎓","Post-Secondary Education",["Has explored post-secondary options","Can describe learning needs to a provider","Understands application processes"]],
                ].map(([icon,domain,skills])=>(
                  <div key={domain} style={{marginBottom:18}}>
                    <p style={{fontSize:12,fontWeight:700,color:C.black,marginBottom:8}}>{icon} {domain}</p>
                    {skills.map(skill=>(
                      <label key={skill} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:7,cursor:"pointer"}}>
                        <input type="checkbox" style={{marginTop:2,accentColor:C.purple,width:14,height:14}}/>
                        <span style={{fontSize:12,color:C.warm,lineHeight:1.4}}>{skill}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"20px 22px"}}>
                <p className="lbl" style={{marginBottom:14}}>STUDENT VOICE</p>
                <p style={{fontSize:12,color:C.warm,marginBottom:10}}>What does {sData.firstName} say about their future?</p>
                <UTextarea label="Student's own words / self-assessment" value={sData.transitionDomain}
                  onChange={e=>SD("transitionDomain",e.target.value)} rows={5}
                  placeholder={`"When I grow up I want to..."`}/>
              </div>
              <div className="card" style={{padding:"20px 22px",background:C.purpleL,border:`1px solid ${C.purple}22`}}>
                <p style={{fontSize:12,fontWeight:700,color:C.purple,marginBottom:6}}>✦ AI Recommendation</p>
                <p style={{fontSize:12,color:C.black,lineHeight:1.6}}>
                  Based on {sData.firstName}'s strengths in science and communication, 
                  consider exploring STEM career pathways. A community science programme or 
                  coding club could be an excellent bridge activity.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 10 — REVIEW & SIGN-OFF
      ══════════════════════════════════════════ */}
      {step===10&&(
        <div>
          <SH n={10} title="Review" sub="& Sign-Off"/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:16}}>ALP SUMMARY</p>
                {[
                  ["👤","Student",`${sData.firstName} ${sData.lastName} · ${sData.grade} · ${sData.school}`],
                  ["🎯","Support Tier",sData.tier],
                  ["📊","Baseline Average",`${Math.round([sData.readingScore,sData.writingScore,sData.mathScore].reduce((a,b)=>a+b,0)/3)}% (Reading, Writing, Math)`],
                  ["🎯","Active Goals",`${sData.goals.length} learning goals`],
                  ["🛠","Interventions",`${sData.interventions.length} programme(s) active`],
                  ["✅","Accommodations",`${Object.values(sData.accommodations).flat().length + (sData.customAccomm?1:0)} accommodations`],
                  ["🚀","Transition Target",sData.transitionTarget],
                ].map(([icon,label,val])=>(
                  <div key={label} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"flex-start"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.warm,letterSpacing:".08em",textTransform:"uppercase"}}>{label}</div>
                      <div style={{fontSize:13,color:C.black,fontWeight:600,marginTop:2}}>{val}</div>
                    </div>
                    <button onClick={()=>setStep([1,1,3,5,5,6,7,9].indexOf(label)+1||1)}
                      style={{fontSize:10,color:C.purple,background:"none",border:"none",cursor:"pointer",flexShrink:0}}>Edit</button>
                  </div>
                ))}
              </div>
              <div className="card" style={{padding:"22px 24px"}}>
                <p className="lbl" style={{marginBottom:12}}>MEETING NOTES & DECISIONS</p>
                <UInput label="Review Meeting Date" value={sData.meetingDate} type="date"
                  onChange={e=>SD("meetingDate",e.target.value)} style={{marginBottom:14}}/>
                <UTextarea label="Team Notes & Decisions Made" value={sData.reviewNotes}
                  onChange={e=>SD("reviewNotes",e.target.value)} rows={5}/>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="card" style={{padding:"20px 22px"}}>
                <p className="lbl" style={{marginBottom:14}}>COMPLETION CHECKLIST</p>
                {STEPS.map((s,i)=>{
                  const done=completedSteps.includes(i+1);
                  return(
                    <div key={s} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",
                      borderBottom:`1px solid ${C.tanL}`}}>
                      <div style={{width:20,height:20,borderRadius:"50%",
                        background:done?"#DCFCE7":C.tanL,
                        border:`2px solid ${done?C.green:C.warm}`,
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {done&&<span style={{fontSize:11,color:C.green}}>✓</span>}
                      </div>
                      <span style={{fontSize:12,color:done?C.black:C.warm,fontWeight:done?600:400}}>{s}</span>
                      {!done&&<button onClick={()=>setStep(i+1)}
                        style={{marginLeft:"auto",fontSize:10,color:C.purple,background:"none",border:"none",cursor:"pointer"}}>Go →</button>}
                    </div>
                  );
                })}
              </div>
              <div className="card" style={{padding:"20px 22px",background:completedSteps.length>=8?"#F0FDF4":C.purpleL,
                border:`1px solid ${completedSteps.length>=8?C.green:C.purple}22`}}>
                {completedSteps.length>=8
                  ? <><p style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:6}}>✓ Ready to Complete</p>
                    <p style={{fontSize:12,color:C.black}}>{completedSteps.length} of {TOTAL} sections completed. Click "Complete ALP" to generate the Review Summary and send the parent notice.</p></>
                  : <><p style={{fontSize:12,fontWeight:700,color:C.purple,marginBottom:6}}>⚡ Almost There</p>
                    <p style={{fontSize:12,color:C.black}}>{TOTAL-completedSteps.length} section(s) still need completion. Review each step and click Next to mark it done.</p></>
                }
              </div>
            </div>
          </div>
        </div>
      )}
      </fieldset>

      {/* ── Nav buttons ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:28,
        padding:"16px 20px",background:C.tanL,borderRadius:12}}>
        <button className="btn-ghost" onClick={back} disabled={step===1}
          style={{opacity:step===1?.4:1,fontSize:12,padding:"11px 22px"}}>← Back</button>
        <span style={{fontSize:11,color:C.warm,fontWeight:600}}>{step} / {TOTAL} — {STEPS[step-1]}</span>
        <button className="btn-black" onClick={next} disabled={isLocked}
          style={{fontSize:12,padding:"12px 28px",opacity:isLocked?.4:1}}>
          {isLocked?"🔒 Locked":step===TOTAL?"✓ Complete ALP":"Next →"}
        </button>
      </div>
    </Page>
  );
}

function ReviewSummary({setPage}){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const {students:dbStudents,user,profile,updateStudentRecord}=useSupabaseAuth();
  const [activeTab,setActiveTab]=useState("summary");
  const [notes,setNotes]=useState("");
  const [editNotes,setEditNotes]=useState(false);
  const [selectedStudentId,setSelectedStudentId]=useState(null);
  const [goals,setGoals]=useState([]);
  const [loading,setLoading]=useState(true);
  const [versions,setVersions]=useState([]);
  const [loadingVersions,setLoadingVersions]=useState(false);
  const [expandedVersion,setExpandedVersion]=useState(null);

  const s=dbStudents?.find(st=>st.id===selectedStudentId)||dbStudents?.[0]||null;
  const meetingDate=s?.meeting_date?new Date(s.meeting_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  const attendees=[profile?.full_name||user?.email?.split("@")[0]||"You",s?.parent_name].filter(Boolean);

  useEffect(()=>{
    if(dbStudents?.length&&!selectedStudentId) setSelectedStudentId(dbStudents[0].id);
  },[dbStudents]);

  useEffect(()=>{
    if(!s?.id){setLoading(false);return;}
    setLoading(true);
    Supabase.getGoals(s.id).then(g=>{setGoals(g||[]);setLoading(false);setNotes(s.review_notes||"");});
  },[s?.id]);

  async function loadVersions(){
    if(!s?.id)return;
    setLoadingVersions(true);
    const v=await Supabase.getALPVersions(s.id);
    setVersions(v||[]);
    setLoadingVersions(false);
  }

  const goalsData=goals.map(g=>{
    const pct=g.current_pct||0;
    const status=pct>=80?"On Track":pct>=50?"Developing":"Needs Support";
    return{goal:`${g.domain} — ${g.target||"Target not set"}`,baseline:g.baseline||"–",current:g.current_value||`${pct}%`,pct,status,recommendation:pct>=80?"Maintain current intervention. Consider raising the target.":pct>=50?"Continue current supports. Monitor closely.":"Review intervention strategy with the team."};
  });

  const onTrack=goalsData.filter(g=>g.status==="On Track").length;
  const developing=goalsData.filter(g=>g.status==="Developing").length;
  const needsSupport=goalsData.filter(g=>g.status==="Needs Support").length;

  async function saveNotes(){
    if(s?.id) await updateStudentRecord(s.id,{review_notes:notes});
    setEditNotes(false);
    toast("Meeting notes saved","success");
  }

  if(!s){
    return(
      <Page title={<>Review <span className="serif-italic" style={{fontSize:26}}>Summary</span></>} subtitle="Add a student and their review summary builds itself as you work">
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>📋</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>Add a Student First</h3>
          <p style={{fontSize:13,color:C.warm}}>Review summaries are generated once a student has an ALP with goals.</p>
        </div>
      </Page>
    );
  }

  return(
    <Page title={<>Review <span className="serif-italic" style={{fontSize:26}}>Summary</span></>}
      subtitle={`${s.name} · Annual Review · ${meetingDate}`}
      action={<div style={{display:"flex",gap:8}}>
        {dbStudents?.length>1&&<select value={selectedStudentId||""} onChange={e=>setSelectedStudentId(e.target.value)} style={{fontSize:11,padding:"8px 12px",border:`1px solid ${C.tanL}`,borderRadius:8,background:C.white,color:C.black}}>
          {dbStudents.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
        </select>}
        <button className="btn-ghost" onClick={async()=>{
          toast("Generating PDF…","info");
          const doc=await generateALPPdf({student:s,goals,notes,reviewer:profile?.full_name||user?.email,school:s.school_name,guardians:await Supabase.getGuardians(s.id)});
          doc.save(`ALP_${s.name.replace(/\s+/g,"_")}.pdf`);
          toast("ALP PDF downloaded ✓","success");
        }} style={{fontSize:11}}>⬇ Export PDF</button>
        <button className="btn-black" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"11px 20px"}}>Edit ALP →</button>
      </div>}>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {[["summary","Summary"],["goals","Goal Progress"],["notes","Meeting Notes"],["versions","Version History"]].map(([id,label])=>(
          <button key={id} onClick={()=>{setActiveTab(id);if(id==="versions")loadVersions();}} className={activeTab===id?"btn-black":"btn-ghost"} style={{fontSize:11,padding:"8px 16px"}}>{label}</button>
        ))}
      </div>

      {loading&&<div style={{textAlign:"center",padding:40,color:C.warm}}>Loading…</div>}

      {!loading&&activeTab==="versions"&&(
        <div>
          {loadingVersions&&<div style={{textAlign:"center",padding:32,color:C.warm}}>Loading version history…</div>}
          {!loadingVersions&&versions.length===0&&(
            <div className="card" style={{padding:"40px 28px",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:10}}>🕓</div>
              <p style={{fontSize:13,color:C.warm}}>No saved versions yet. Every time the ALP is saved or completed, a snapshot is recorded here.</p>
            </div>
          )}
          {!loadingVersions&&versions.length>0&&(
            <div style={{position:"relative",paddingLeft:24}}>
              <div style={{position:"absolute",left:7,top:6,bottom:6,width:2,background:C.tanL}}/>
              {versions.map(v=>(
                <div key={v.id} style={{position:"relative",marginBottom:14}}>
                  <div style={{position:"absolute",left:-21,top:5,width:14,height:14,borderRadius:"50%",background:C.purple,border:`3px solid ${C.bg}`}}/>
                  <div className="card" style={{padding:"14px 18px",cursor:"pointer"}} onClick={()=>setExpandedVersion(expandedVersion===v.id?null:v.id)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                      <div>
                        <span style={{fontSize:13,fontWeight:700,color:C.black}}>Version {v.version_number}</span>
                        <span style={{fontSize:11,color:C.warm,marginLeft:10}}>{v.profiles?.full_name||"Unknown"} · {new Date(v.created_at).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</span>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:C.purple,background:C.purpleL,padding:"2px 10px",borderRadius:99}}>{(v.status_at_save||"draft").replace("_"," ").toUpperCase()}</span>
                    </div>
                    {v.change_summary&&<p style={{fontSize:12,color:C.warm,marginTop:6}}>{v.change_summary}</p>}
                    {expandedVersion===v.id&&(
                      <div style={{marginTop:12,padding:"12px 14px",background:C.tanL+"55",borderRadius:8,fontSize:11,color:C.black,maxHeight:240,overflowY:"auto",fontFamily:"monospace",whiteSpace:"pre-wrap"}}>
                        {JSON.stringify(v.snapshot,null,2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading&&activeTab==="summary"&&(
        <>
          {/* Meeting info */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16,marginBottom:16}}>
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:14}}>MEETING DETAILS</p>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {[["📅","Date & Time",meetingDate],["🏫","School",s.school_name||"Not set"],["👤","Student",`${s.name} · Grade ${s.grade||"–"} · ${s.disability||"ALP"}`]].map(([ic,label,val])=>(
                  <div key={label} style={{padding:"10px 12px",background:C.purpleL,borderRadius:8,flex:1,minWidth:160}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.warm,marginBottom:3}}>{ic} {label}</div>
                    <div style={{fontSize:12,color:C.black}}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14}}>
                <p className="lbl" style={{marginBottom:8,fontSize:8}}>ATTENDEES</p>
                {attendees.length===0&&<p style={{fontSize:12,color:C.warm}}>No attendees recorded yet.</p>}
                {attendees.map((a,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.tanL}`,fontSize:12,color:C.black}}>
                    <Avatar name={a} size={24}/>
                    {a}
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{padding:"22px 24px"}}>
              <p className="lbl" style={{marginBottom:14}}>OVERALL PROGRESS</p>
              {goalsData.length>0?(
                <>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
                    <div style={{position:"relative",width:100,height:100}}>
                      <DonutChart size={100} strokeWidth={12} segments={[{value:onTrack||0.01,color:C.green},{value:developing,color:C.amber},{value:needsSupport,color:C.red}]}/>
                      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <div style={{textAlign:"center"}}><div className="serif" style={{fontSize:22,fontWeight:800,color:C.black}}>{goalsData.length}</div><div style={{fontSize:9,color:C.warm}}>goals</div></div>
                      </div>
                    </div>
                  </div>
                  {[["On Track",onTrack,C.green],["Developing",developing,C.amber],["Needs Support",needsSupport,C.red]].map(([l,v,c])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:12}}>
                      <span style={{color:C.warm}}>{l}</span>
                      <span style={{fontWeight:700,color:c}}>{v}</span>
                    </div>
                  ))}
                  <button className="btn-purple" onClick={()=>setActiveTab("goals")} style={{width:"100%",fontSize:11,marginTop:12}}>View Details →</button>
                </>
              ):(
                <div style={{textAlign:"center",padding:"20px 0"}}>
                  <p style={{fontSize:12,color:C.warm,marginBottom:12}}>No goals yet for this student.</p>
                  <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:11}}>Add Goals in ALP Builder →</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading&&activeTab==="goals"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {goalsData.length===0&&(
            <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
              <p style={{fontSize:13,color:C.warm,marginBottom:16}}>No goals recorded yet.</p>
              <button className="btn-purple" onClick={()=>setPage("builder")} style={{fontSize:12}}>Add Goals →</button>
            </div>
          )}
          {goalsData.map((g,i)=>(
            <div key={i} className="card" style={{padding:"20px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                <h3 style={{fontSize:14,fontWeight:700,color:C.black}}>{g.goal}</h3>
                <span style={{fontSize:11,fontWeight:700,color:g.status==="On Track"?C.green:g.status==="Developing"?C.amber:C.red,background:(g.status==="On Track"?C.green:g.status==="Developing"?C.amber:C.red)+"18",padding:"3px 10px",borderRadius:99}}>{g.status}</span>
              </div>
              <div style={{display:"flex",gap:16,fontSize:12,marginBottom:12,flexWrap:"wrap"}}>
                <span><b>Baseline:</b> {g.baseline}</span>
                <span style={{color:C.purple}}><b>Current:</b> {g.current}</span>
                <span><b>Progress:</b> {g.pct}%</span>
              </div>
              <div style={{height:6,background:C.tanL,borderRadius:99,overflow:"hidden",marginBottom:12}}>
                <div style={{height:"100%",width:`${g.pct}%`,background:g.status==="On Track"?C.green:g.status==="Developing"?C.amber:C.red,borderRadius:99,transition:"width .5s"}}/>
              </div>
              <div style={{padding:"8px 12px",background:C.purpleL,borderRadius:8,fontSize:12,color:C.warm}}>💡 <b>Recommendation:</b> {g.recommendation}</div>
            </div>
          ))}
        </div>
      )}

      {!loading&&activeTab==="notes"&&(
        <div className="card" style={{padding:"24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p className="lbl">MEETING NOTES</p>
            <button className="btn-ghost" style={{fontSize:10}} onClick={()=>editNotes?saveNotes():setEditNotes(true)}>{editNotes?"Save":"Edit"}</button>
          </div>
          {editNotes?(
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Document what was discussed, decisions made, and next steps…"
              style={{width:"100%",padding:"12px",border:`1px solid ${C.tanL}`,borderRadius:8,fontSize:13,fontFamily:"'DM Sans',sans-serif",resize:"vertical",minHeight:200,outline:"none",lineHeight:1.7,boxSizing:"border-box"}}/>
          ):(
            <p style={{fontSize:13,color:C.warm,lineHeight:1.75,whiteSpace:"pre-wrap"}}>{notes||"No meeting notes recorded yet. Click Edit to add notes from the review meeting."}</p>
          )}
        </div>
      )}
    </Page>
  );
}

function ALPNotice({setPage}){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const {students:dbStudents,user,profile}=useSupabaseAuth();
  const firstStudent=dbStudents?.[0];
  const [noticeData,setNoticeData]=useState({
    studentName:firstStudent?.name||"",noticeDate:new Date().toISOString().split("T")[0],
    school:firstStudent?.school_name||profile?.school||"",coordinator:profile?.full_name||user?.email?.split("@")[0]||"",
    // Populated from student_guardians below. These read
    // firstStudent.parent_name etc, which are columns that do not
    // exist on students, so the notice always opened blank.
    district:"",parent:"",parentEmail:"",parentPhone:"",
    meetingDate:"",meetingTime:"14:00",meetingLocation:"",
    responseDeadline:"",deliveryMethod:"email",
    content:"This notice is to inform you of your child's ALP meeting, placement, and your rights as a parent/guardian.",
    language:"English",interpreter:false
  });
  const setND=(k,v)=>setNoticeData(p=>({...p,[k]:v}));

  // Pull the primary guardian for this student. Staff can still edit
  // the fields before sending — this fills them in rather than
  // locking them, since a notice occasionally goes to someone other
  // than the usual primary contact.
  useEffect(()=>{
    let cancelled=false;
    if(!firstStudent?.id)return;
    Supabase.getPrimaryGuardian(firstStudent.id).then(g=>{
      if(cancelled||!g)return;
      setNoticeData(p=>({...p,
        parent:p.parent||g.parent_name||"",
        parentEmail:p.parentEmail||g.parent_email||"",
        parentPhone:p.parentPhone||g.parent_phone||"",
      }));
    }).catch(()=>{});
    return()=>{cancelled=true;};
  },[firstStudent?.id]);
  const [reasons,setReasons]=useState({below:true,disability:true,behavioral:false,transition:false,reevaluation:false,amendment:false});
  const [proposedActions,setProposedActions]=useState({placement:true,goals:true,services:true,accommodations:false,transfer:false});
  const [sent,setSent]=useState(false);
  const [sending,setSending]=useState(false);

  function sendNotice(){
    setSending(true);
    setTimeout(()=>{setSending(false);setSent(true);toast(`Notice sent to ${noticeData.parent||"the family"} ✓`,"success");},1200);
  }

  if(sent) return(
    <Page title={<>ALP <span className="serif-italic" style={{fontSize:26}}>Support Notice</span></>} subtitle="Sent successfully">
      <div className="card" style={{padding:"40px 32px",textAlign:"center",maxWidth:540,margin:"0 auto"}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"#DCFCE7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,margin:"0 auto 20px"}}>✉️</div>
        <h3 style={{fontSize:22,fontWeight:800,color:C.black,marginBottom:8,letterSpacing:"-.016em"}}>Notice Sent!</h3>
        <p style={{fontSize:14,color:C.warm,marginBottom:4}}>Notice delivered to <b style={{color:C.black}}>{noticeData.parent||"the family"}</b></p>
        <p style={{fontSize:13,color:C.warm,marginBottom:4}}>via {noticeData.deliveryMethod==="email"?"Email + printed copy":noticeData.deliveryMethod}</p>
        <p style={{fontSize:12,color:C.warm,marginBottom:28}}>Response requested by <b>{noticeData.responseDeadline}</b> · Logged to audit trail</p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button className="btn-ghost" onClick={()=>{setSent(false);}} style={{fontSize:12}}>← Edit Notice</button>
          <button className="btn-ghost" onClick={()=>toast("Notice downloaded","info")} style={{fontSize:12}}>⬇ Download PDF</button>
          <button className="btn-purple" onClick={()=>setPage("create")} style={{fontSize:12,padding:"11px 24px"}}>Create ALP Doc →</button>
        </div>
      </div>
    </Page>
  );

  return(
    <Page title={<>ALP <span className="serif-italic" style={{fontSize:26}}>Support Notice</span></>}
      subtitle="Meeting Notice — Parent/Guardian Notification"
      action={<button className="btn-ghost" onClick={()=>setPage("review")} style={{fontSize:11}}>← Review Summary</button>}>

      {/* Legal notice bar */}
      <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:"12px 16px",marginBottom:20,display:"flex",gap:10,fontSize:12.5,color:"#854D0E",lineHeight:1.6}}>
        <span style={{flexShrink:0}}>⚠️</span>
        <span>This This notice should be sent to inform parents/guardians of upcoming ALP meetings and any planned changes to the student's programme.</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>
        {/* Main form */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Student & contact */}
          <div className="card" style={{padding:"22px 24px"}}>
            <p className="lbl" style={{marginBottom:16}}>STUDENT & SCHOOL</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <UInput label="Student Full Name" value={noticeData.studentName} onChange={e=>setND("studentName",e.target.value)}/>
              <UInput label="Notice Date" value={noticeData.noticeDate} onChange={e=>setND("noticeDate",e.target.value)} type="date"/>
              <UInput label="School" value={noticeData.school} onChange={e=>setND("school",e.target.value)}/>
              <UInput label="ALP Coordinator" value={noticeData.coordinator} onChange={e=>setND("coordinator",e.target.value)}/>
              <UInput label="Parent/Guardian" value={noticeData.parent} onChange={e=>setND("parent",e.target.value)}/>
              <UInput label="Parent Email" value={noticeData.parentEmail} onChange={e=>setND("parentEmail",e.target.value)} type="email"/>
            </div>
          </div>

          {/* Reason for notice */}
          <div className="card" style={{padding:"22px 24px"}}>
            <p className="lbl" style={{marginBottom:14}}>REASON FOR THIS NOTICE</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["below","Below grade-level performance"],["disability","Disability-related needs"],["behavioral","Behaviour intervention required"],["transition","Transition support needed"],["reevaluation","Reevaluation results"],["amendment","ALP amendment/change"]].map(([key,label])=>(
                <label key={key} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"8px 10px",border:`1px solid ${reasons[key]?C.purple:C.tanL}`,borderRadius:8,background:reasons[key]?C.purpleL:"transparent",transition:"all .15s"}}>
                  <input type="checkbox" checked={reasons[key]} onChange={e=>setReasons(p=>({...p,[key]:e.target.checked}))} style={{accentColor:C.purple,width:15,height:15}}/>
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Proposed actions */}
          <div className="card" style={{padding:"22px 24px"}}>
            <p className="lbl" style={{marginBottom:14}}>PROPOSED ACTIONS</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["placement","Change to ALP placement"],["goals","Revise annual goals"],["services","Update services"],["accommodations","Change accommodations"],["transfer","Transfer/exit ALP"]].map(([key,label])=>(
                <label key={key} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"8px 10px",border:`1px solid ${proposedActions[key]?C.purple:C.tanL}`,borderRadius:8,background:proposedActions[key]?C.purpleL:"transparent",transition:"all .15s"}}>
                  <input type="checkbox" checked={proposedActions[key]} onChange={e=>setProposedActions(p=>({...p,[key]:e.target.checked}))} style={{accentColor:C.purple,width:15,height:15}}/>
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Parent rights */}
          <div className="card" style={{padding:"22px 24px"}}>
            <p className="lbl" style={{marginBottom:14}}>PARENT/GUARDIAN RIGHTS SUMMARY</p>
            <div style={{background:C.purpleL,borderRadius:10,padding:"14px 16px",fontSize:12.5,color:C.warm,lineHeight:1.8}}>
              {["Participate in all ALP planning meetings","Review all student records at no cost","Request an independent educational evaluation at public expense","Receive prior written notice before any change to your child's programme","Request mediation or formal review if you disagree with ALP decisions","File a complaint with your Education Authority","Have this notice in your native language at no cost"].map((right,i)=>(
                <div key={i} style={{display:"flex",gap:8,marginBottom:4,alignItems:"flex-start"}}>
                  <span style={{color:C.purple,fontWeight:700,flexShrink:0}}>{i+1}.</span>
                  <span>{right}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — delivery + meeting */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="card" style={{padding:"20px"}}>
            <p className="lbl" style={{marginBottom:14}}>MEETING DETAILS</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <UInput label="Meeting Date" value={noticeData.meetingDate} onChange={e=>setND("meetingDate",e.target.value)} type="date"/>
              <UInput label="Meeting Time" value={noticeData.meetingTime} onChange={e=>setND("meetingTime",e.target.value)} type="time"/>
              <UInput label="Location" value={noticeData.meetingLocation} onChange={e=>setND("meetingLocation",e.target.value)} placeholder="Room 204 / Google Meet"/>
              <UInput label="Response Deadline" value={noticeData.responseDeadline} onChange={e=>setND("responseDeadline",e.target.value)} type="date"/>
            </div>
          </div>

          <div className="card" style={{padding:"20px"}}>
            <p className="lbl" style={{marginBottom:14}}>DELIVERY</p>
            <USelect label="Method" value={noticeData.deliveryMethod} onChange={e=>setND("deliveryMethod",e.target.value)}
              options={[{value:"email",label:"Email + printed copy"},{value:"email-only",label:"Email only"},{value:"print",label:"Print only (no email)"},{value:"mail",label:"US Mail (hard copy)"}]}/>
            <div style={{marginTop:12}}>
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",marginTop:10}}>
                <input type="checkbox" checked={noticeData.interpreter} onChange={e=>setND("interpreter",e.target.checked)} style={{accentColor:C.purple,width:15,height:15}}/>
                Interpreter needed
              </label>
              <USelect label="Notice Language" value={noticeData.language} onChange={e=>setND("language",e.target.value)}
                options={["English","Spanish","French","Arabic","Portuguese","Twi","Igbo","Yoruba","Swahili"].map(l=>({value:l,label:l}))}
                style={{marginTop:12}}/>
            </div>
          </div>

          <div className="card" style={{padding:"20px",background:"linear-gradient(135deg,#7C3AED11,#A855F711)"}}>
            <p className="lbl" style={{marginBottom:8,color:C.purple}}>PLAN STATUS</p>
            {[["Student info complete","✓",C.green],["Reason documented","✓",C.green],["Rights included","✓",C.green],["Meeting date set","✓",C.green],["Delivery method","✓",C.green]].map(([item,status,c])=>(
              <div key={item} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:`1px solid ${C.tanL}`}}>
                <span style={{color:C.black}}>{item}</span>
                <span style={{color:c,fontWeight:700}}>{status}</span>
              </div>
            ))}
            <div style={{marginTop:12,padding:"8px 10px",background:"#DCFCE7",borderRadius:8,fontSize:11,color:C.green,fontWeight:600}}>✓ Notice ready to send</div>
          </div>

          <button className="btn-purple" onClick={sendNotice} disabled={sending} style={{fontSize:12,padding:"14px"}}>
            {sending?<><Spin/>Sending Notice…</>:"📧 Send ALP Meeting Notice →"}
          </button>
          <button className="btn-ghost" onClick={()=>toast("Notice downloaded","info")} style={{fontSize:11}}>⬇ Download PDF Copy</button>
        </div>
      </div>
    </Page>
  );
}


function CreateALPDoc({setPage}){
  const {toast}=useToast();
  const {copy,copied}=useCopy();
  const {isMobile}=useResponsive();
  const {students:dbStudents,user,profile}=useSupabaseAuth();
  const [selectedStudentId,setSelectedStudentId]=useState(null);
  const [showPreview,setShowPreview]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [exportWord,setExportWord]=useState(false);
  const [format,setFormat]=useState("pdf");
  const allSections=["Student Information","Educational Background","Annual Goals","Student Support Services","Related Services","Accommodations","Learning Environment","Present Levels","Transition Planning","Assessment","Meeting Information","Parental Rights","Signatures"];
  const [sectionsTicked,setSectionsTicked]=useState(allSections.map((_,i)=>i));
  function toggle(i){setSectionsTicked(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]);}

  useEffect(()=>{
    if(dbStudents?.length&&!selectedStudentId) setSelectedStudentId(dbStudents[0].id);
  },[dbStudents]);
  const s=dbStudents?.find(st=>st.id===selectedStudentId)||dbStudents?.[0]||null;

  function handlePrint(){
    toast("Opening print dialog…","info");
    setTimeout(()=>{try{window.print();}catch{}},400);
  }

  async function handleExport(){
    if(!s){toast("Select a student first","error");return;}
    setExporting(true);
    try{
      const goals=await Supabase.getGoals(s.id);
      const doc=await generateALPPdf({student:s,goals,notes:s.review_notes,reviewer:profile?.full_name||user?.email,school:s.school_name,guardians:await Supabase.getGuardians(s.id)});
      doc.save(`ALP_${s.name.replace(/\s+/g,"_")}.pdf`);
      toast("ALP exported as PDF ✓","success");
    }catch(e){toast("Export failed","error");}
    setExporting(false);
  }

  const docMeta=s?[
    {label:"Student",value:s.name},
    {label:"Grade",value:s.grade||"–"},
    {label:"Disability",value:s.disability||"Not specified"},
    {label:"School",value:s.school_name||"Not set"},
    {label:"Teacher",value:profile?.full_name||user?.email?.split("@")[0]||"–"},
    {label:"Academic Year",value:s.plan_year||`${new Date().getFullYear()}–${new Date().getFullYear()+1}`},
    {label:"Date Created",value:s.created_at?new Date(s.created_at).toLocaleDateString():"–"},
    {label:"Last Updated",value:new Date().toLocaleDateString()},
  ]:[];

  return(
    <>{showPreview&&<ALPPrintPreview onClose={()=>setShowPreview(false)} student={s?{name:s.name,grade:s.grade||"–",dob:s.dob||"–",disability:s.disability||"–",teacher:profile?.full_name||user?.email?.split("@")[0]||"–",school:s.school_name||"–",year:s.plan_year||`${new Date().getFullYear()}–${new Date().getFullYear()+1}`,parentName:s.parent_name}:null} goals={[]}/>}
    <Page title={<>Create <span className="serif-italic" style={{fontSize:26}}>ALP Document</span></>}
      subtitle={s?`${s.name} · ${sectionsTicked.length}/${allSections.length} sections selected`:"No student selected"}
      action={<div style={{display:"flex",gap:8}}>
        <button className="btn-ghost" onClick={()=>setShowPreview(true)} style={{fontSize:11,padding:"11px 18px"}}>👁 Preview</button>
        <button className="btn-black" onClick={handlePrint} style={{fontSize:11,padding:"11px 22px"}}>🖨 Print</button>
      </div>}>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:16}}>

        {/* Left — document status */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Completion summary */}
          <div className="card" style={{padding:"22px 24px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <p className="lbl" style={{marginBottom:4}}>DOCUMENT STATUS</p>
                <h3 style={{fontSize:16,fontWeight:700,color:C.black}}>{s?`${s.name} — ALP ${s.plan_year||new Date().getFullYear()+"–"+(new Date().getFullYear()+1)}`:"No student selected"}</h3>
              </div>
              <div style={{textAlign:"center"}}>
                <div className="serif" style={{fontSize:30,fontWeight:800,color:C.green,lineHeight:1}}>100%</div>
                <div style={{fontSize:10,color:C.warm}}>Complete</div>
              </div>
            </div>
            <div style={{background:C.tanL,borderRadius:99,height:6,overflow:"hidden",marginBottom:14}}>
              <div style={{height:"100%",width:"100%",background:`linear-gradient(90deg,${C.purple},#A855F7)`,borderRadius:99}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {docMeta.map(({label,value})=>(
                <div key={label} style={{padding:"8px 10px",background:C.purpleL,borderRadius:8}}>
                  <div style={{fontSize:9,fontWeight:700,color:C.warm,letterSpacing:".06em"}}>{label.toUpperCase()}</div>
                  <div style={{fontSize:12,fontWeight:600,color:C.black,marginTop:2}}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section checklist */}
          <div className="card" style={{padding:"22px 24px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <p className="lbl">SECTIONS IN DOCUMENT ({sectionsTicked.length}/{allSections.length})</p>
              <div style={{display:"flex",gap:6}}>
                <button className="btn-ghost" onClick={()=>setSectionsTicked(allSections.map((_,i)=>i))} style={{fontSize:9,padding:"4px 8px"}}>All</button>
                <button className="btn-ghost" onClick={()=>setSectionsTicked([])} style={{fontSize:9,padding:"4px 8px"}}>None</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {allSections.map((sec,i)=>(
                <label key={i} style={{display:"flex",gap:8,alignItems:"center",fontSize:12,cursor:"pointer",padding:"6px 8px",borderRadius:6,background:sectionsTicked.includes(i)?C.purpleL:"transparent",border:`1px solid ${sectionsTicked.includes(i)?C.purple:C.tanL}`,transition:"all .15s"}}>
                  <div onClick={()=>toggle(i)} style={{width:16,height:16,borderRadius:4,border:`2px solid ${sectionsTicked.includes(i)?C.purple:C.tanL}`,background:sectionsTicked.includes(i)?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {sectionsTicked.includes(i)&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}
                  </div>
                  <span style={{color:sectionsTicked.includes(i)?C.black:C.warm}}>§{i+1} {sec}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Signature status */}
          <div className="card" style={{padding:"22px 24px"}}>
            <p className="lbl" style={{marginBottom:14}}>SIGNATURES</p>
            {[[profile?.full_name||user?.email?.split("@")[0]||"You","ALP Coordinator","○ Not yet","—",C.warm],[s?.parent_name||"Parent / Guardian","Parent / Guardian","○ Not yet","—",C.warm]].map(([name,role,status,date,color])=>(
              <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,gap:10,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.black}}>{name}</div>
                  <div style={{fontSize:11,color:C.warm}}>{role} · {date}</div>
                </div>
                <span style={{fontSize:11,fontWeight:700,color,flexShrink:0}}>{status}</span>
              </div>
            ))}
            <button className="btn-ghost" onClick={()=>toast("Signature request sent","success")} style={{width:"100%",marginTop:12,fontSize:11}}>📧 Request Signatures</button>
          </div>
        </div>

        {/* Right — export options */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="card" style={{padding:"22px"}}>
            <p className="lbl" style={{marginBottom:14}}>EXPORT FORMAT</p>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
              {[["pdf","📄","PDF Document","Best for sharing & printing"],["word","📝","Word (.docx)","Editable by staff or administrator"],["html","🌐","Web Page","Accessible online view"]].map(([id,icon,label,desc])=>(
                <label key={id} style={{display:"flex",gap:12,padding:"12px 14px",border:`1.5px solid ${format===id?C.purple:C.tanL}`,borderRadius:10,cursor:"pointer",background:format===id?C.purpleL:"transparent",transition:"all .15s"}} onClick={()=>setFormat(id)}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${format===id?C.purple:C.tanL}`,background:format===id?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                    {format===id&&<div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.black}}>{icon} {label}</div>
                    <div style={{fontSize:11,color:C.warm}}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <button className="btn-purple" onClick={handleExport} disabled={exporting||sectionsTicked.length===0}
              style={{width:"100%",fontSize:12,padding:"13px",marginBottom:10}}>
              {exporting?<><Spin/>Exporting…</>:`⬇ Export ${sectionsTicked.length} Sections as ${format.toUpperCase()}`}
            </button>
            <button className="btn-ghost" onClick={()=>setShowPreview(true)} style={{width:"100%",fontSize:11,marginBottom:8}}>👁 Preview Document</button>
            <button className="btn-ghost" onClick={handlePrint} style={{width:"100%",fontSize:11}}>🖨 Print Document</button>
          </div>

          <div className="card" style={{padding:"20px",background:"linear-gradient(135deg,#7C3AED11,#A855F711)"}}>
            <p className="lbl" style={{marginBottom:12,color:C.purple}}>SHARE WITH FAMILY</p>
            <p style={{fontSize:12,color:C.warm,marginBottom:14,lineHeight:1.6}}>Generate and download the approved ALP as a PDF to email or print for the parent/guardian.</p>
            <button className="btn-purple" onClick={()=>setPage&&setPage("create")} style={{width:"100%",fontSize:11}}>
              Share with Johnson Family →
            </button>
          </div>

          <div className="card" style={{padding:"20px"}}>
            <p className="lbl" style={{marginBottom:12}}>QUICK ACTIONS</p>
            {[["📅","Schedule Review","Open the meeting scheduler"],["📊","View Progress","Go to progress monitoring"],["✏️","Edit ALP","Return to ALP Builder"],["📁","Save to Documents","Archive this version"]].map(([icon,label,desc])=>(
              <div key={label} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,cursor:"pointer",alignItems:"center"}}
                onClick={()=>{
                  if(label==="Edit ALP")setPage("builder");
                  else if(label==="View Progress")setPage("progress");
                  else toast(`${label} — done!`,"success");
                }}>
                <span style={{fontSize:18,width:28,textAlign:"center"}}>{icon}</span>
                <div><div style={{fontSize:12,fontWeight:600,color:C.black}}>{label}</div><div style={{fontSize:11,color:C.warm}}>{desc}</div></div>
              </div>
            ))}
          </div>


    </div>
  </div>
    </Page></>
  );
}


function Progress(){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const {students:dbStudents,user}=useSupabaseAuth();
  const [showLogData,setShowLogData]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [selectedStudentId,setSelectedStudentId]=useState(null);
  const [selectedGoalId,setSelectedGoalId]=useState(null);
  const [goals,setGoals]=useState([]);
  const [entries,setEntries]=useState([]);
  const [loading,setLoading]=useState(true);
  const [logForm,setLogForm]=useState({score:"",notes:"",date:new Date().toISOString().split("T")[0]});
  const [logging,setLogging]=useState(false);

  const s=dbStudents?.find(st=>st.id===selectedStudentId)||dbStudents?.[0]||null;
  const g=goals.find(g=>g.id===selectedGoalId)||goals[0]||null;
  const goalEntries=entries.filter(e=>e.goal_id===(g?.id));

  useEffect(()=>{
    if(dbStudents?.length&&!selectedStudentId) setSelectedStudentId(dbStudents[0].id);
  },[dbStudents]);

  useEffect(()=>{
    if(!s?.id)return;
    setLoading(true);
    Supabase.getGoals(s.id).then(g=>{
      setGoals(g||[]);
      if(g?.length) setSelectedGoalId(g[0].id);
      setLoading(false);
    });
  },[s?.id]);

  useEffect(()=>{
    if(!s?.id)return;
    Supabase.getProgress(s.id,100).then(e=>setEntries(e||[]));
  },[s?.id]);

  async function handleLogData(){
    if(!logForm.score){toast("Enter a score","error");return;}
    if(!g?.id){toast("Select a goal first","error");return;}
    setLogging(true);
    try{
      await Supabase.logProgress({
        student_id:s.id,goal_id:g.id,
        score:parseFloat(logForm.score),
        notes:logForm.notes,
        date:logForm.date,
        created_by:user?.id,
      });
      toast("Progress logged!","success");
      setShowLogData(false);
      setLogForm({score:"",notes:"",date:new Date().toISOString().split("T")[0]});
      const updated=await Supabase.getProgress(s.id,100);
      setEntries(updated||[]);
    }catch(e){toast("Failed to log","error");}
    setLogging(false);
  }

  const sparkData=goalEntries.slice(-8).map((e,i)=>({score:e.score,label:e.date?new Date(e.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}):`#${i+1}`}));
  const latest=goalEntries.length>0?goalEntries[goalEntries.length-1].score:null;
  const targetNum=parseFloat(g?.target)||100;
  const pct=latest!=null?Math.min(100,Math.round((latest/targetNum)*100)):g?.current_pct||0;
  const domainColor=pct>=80?C.green:pct>=50?C.amber:C.red;

  if(!s){
    return(
      <Page title={<>Progress <span className="serif-italic" style={{fontSize:26}}>Monitoring</span></>} subtitle="Select a student">
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>📈</div>
          <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:8}}>No Students Yet</h3>
          <p style={{fontSize:13,color:C.warm,marginBottom:24}}>Add students and create goals first.</p>
          <button className="btn-purple" onClick={()=>{}} style={{fontSize:12}}>Go to Students →</button>
        </div>
      </Page>
    );
  }

  return(
    <>
      {showLogData&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowLogData(false)}>
          <div className="card fade-up" style={{width:"100%",maxWidth:420,padding:0}}>
            <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><p className="lbl" style={{color:C.purple,marginBottom:4}}>LOG DATA</p><h3 style={{fontSize:18,fontWeight:800,color:C.black}}>Progress Entry</h3></div>
              <button onClick={()=>setShowLogData(false)} style={{fontSize:22,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"22px 26px",display:"flex",flexDirection:"column",gap:14}}>
              <div style={{padding:"12px 14px",background:C.purpleL,borderRadius:8,fontSize:12,color:C.purple}}>
                <b>{s.name}</b> · {g?.domain||"Goal"}: {g?.goal_text?.slice(0,60)}…
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <UInput label={`Score (target: ${g?.target||"?"})`} value={logForm.score} onChange={e=>setLogForm(p=>({...p,score:e.target.value}))} type="number" placeholder="e.g. 68"/>
                <UInput label="Date" value={logForm.date} onChange={e=>setLogForm(p=>({...p,date:e.target.value}))} type="date"/>
              </div>
              <UTextarea label="Notes (optional)" value={logForm.notes} onChange={e=>setLogForm(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Observations, conditions, strategies used…"/>
              <div style={{display:"flex",gap:10}}>
                <button className="btn-ghost" onClick={()=>setShowLogData(false)} style={{flex:1,fontSize:12}}>Cancel</button>
                <button className="btn-purple" onClick={handleLogData} disabled={logging} style={{flex:2,fontSize:12,padding:"13px"}}>
                  {logging?<><Spin/> Saving…</>:"Save Entry →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Page title={<>Progress <span className="serif-italic" style={{fontSize:26}}>Monitoring</span></>}
        subtitle={`${s.name}${g?` · ${g.domain}`:""}${goalEntries.length>0?` · ${goalEntries.length} data points`:""}`}
        action={<div style={{display:"flex",gap:8}}>
          <button className="btn-black" onClick={()=>setShowLogData(true)} style={{fontSize:11,padding:"10px 20px"}}>+ Log Data</button>
        </div>}>

        {/* Student + Goal Selectors */}
        <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          {dbStudents?.length>1&&(
            <select value={selectedStudentId||""} onChange={e=>setSelectedStudentId(e.target.value)} className="u-select" style={{width:"auto",paddingRight:32,fontSize:13,fontWeight:600}}>
              {dbStudents.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          )}
          {goals.length>0&&(
            <select value={selectedGoalId||""} onChange={e=>setSelectedGoalId(e.target.value)} className="u-select" style={{width:"auto",paddingRight:32,fontSize:13}}>
              {goals.map(g=><option key={g.id} value={g.id}>{g.domain}: {g.goal_text?.slice(0,40)}…</option>)}
            </select>
          )}
        </div>

        {loading&&<div style={{textAlign:"center",padding:60,color:C.warm}}>Loading data…</div>}

        {!loading&&goals.length===0&&(
          <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>🎯</div>
            <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Goals for {s.name}</h3>
            <p style={{fontSize:13,color:C.warm,marginBottom:20}}>Create goals in the ALP Builder first, then log progress here.</p>
            <button className="btn-purple" onClick={()=>{}} style={{fontSize:12}}>Open ALP Builder →</button>
          </div>
        )}

        {!loading&&goals.length>0&&(
          <>
            {/* Top Metrics */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:14,marginBottom:20}}>
              {[
                ["CURRENT",latest!=null?`${latest} ${g?.target?.match(/[a-z%]+/i)?.[0]||""}`:"-","latest data point",domainColor],
                ["TARGET",g?.target||"–","goal benchmark",C.green],
                ["PROGRESS",`${pct}%`,pct>=80?"On Track":pct>=50?"Developing":"Needs Support",domainColor],
                ["DATA POINTS",String(goalEntries.length),goalEntries.length>0?"entries logged":"no data yet",C.blue],
              ].map(([l,v,sub,c])=>(
                <div key={l} className="card" style={{padding:"16px 20px"}}>
                  <p className="lbl" style={{marginBottom:8}}>{l}</p>
                  <div style={{fontSize:22,fontWeight:800,color:c,fontFamily:"'DM Serif Display',serif"}}>{v}</div>
                  <p style={{fontSize:11,color:C.warm,marginTop:4}}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Growth Chart */}
            <div className="card" style={{padding:"26px 28px",marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <div>
                  <h3 className="serif" style={{fontSize:17,fontWeight:700}}>{g?.domain} Growth — {s.name}</h3>
                  <p style={{fontSize:12,color:C.warm,marginTop:3}}>Goal: {g?.target||"–"} · Baseline: {g?.baseline||"–"} · {goalEntries.length} probes logged</p>
                </div>
                <button className="btn-ghost" style={{fontSize:11}} onClick={()=>setShowLogData(true)}>+ Log Entry</button>
              </div>
              {sparkData.length>0?(
                <SparklineChart data={sparkData} goal={parseFloat(g?.target)||100} color={domainColor} width={460} height={140}/>
              ):(
                <div style={{height:120,display:"flex",alignItems:"center",justifyContent:"center",background:C.tanL+"55",borderRadius:10}}>
                  <p style={{fontSize:13,color:C.warm}}>No data yet — log the first entry to see the chart.</p>
                </div>
              )}
            </div>

            {/* Data Table */}
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{fontSize:13,fontWeight:700,color:C.black}}>Progress Log</p>
                <span style={{fontSize:11,color:C.warm}}>{goalEntries.length} entries</span>
              </div>
              {goalEntries.length===0?(
                <div style={{padding:"32px",textAlign:"center",color:C.warm,fontSize:13}}>No entries yet. Click "+ Log Data" to add the first score.</div>
              ):(
                <div style={{overflowX:"auto"}}>
                  <table className="data-table" style={{minWidth:500}}>
                    <thead><tr><th>Date</th><th>Score</th><th>vs Target</th><th>Notes</th></tr></thead>
                    <tbody>
                      {[...goalEntries].reverse().map((e,i)=>{
                        const diff=parseFloat(e.score)-parseFloat(g?.target||0);
                        return(
                          <tr key={i}>
                            <td style={{fontSize:11,color:C.warm}}>{e.date?new Date(e.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"-"}</td>
                            <td><span style={{fontSize:14,fontWeight:700,color:C.black}}>{e.score}</span></td>
                            <td><span style={{fontSize:11,fontWeight:600,color:diff>=0?C.green:C.red}}>{diff>=0?`+${diff.toFixed(1)} ✓`:diff.toFixed(1)}</span></td>
                            <td style={{fontSize:12,color:C.warm,maxWidth:200}}>{e.notes||"–"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* All Goals Summary */}
            {goals.length>1&&(
              <div className="card" style={{padding:"20px 24px",marginTop:16}}>
                <p className="lbl" style={{marginBottom:14}}>ALL GOALS — {s.name}</p>
                {goals.map(gl=>{
                  const glEntries=entries.filter(e=>e.goal_id===gl.id);
                  const glLatest=glEntries.length>0?glEntries[glEntries.length-1].score:null;
                  const glTarget=parseFloat(gl.target)||100;
                  const glPct=glLatest!=null?Math.min(100,Math.round((glLatest/glTarget)*100)):gl.current_pct||0;
                  const glColor=glPct>=80?C.green:glPct>=50?C.amber:C.red;
                  return(
                    <div key={gl.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,cursor:"pointer"}}
                      onClick={()=>setSelectedGoalId(gl.id)}>
                      <span style={{fontSize:10,fontWeight:700,background:glColor+"18",color:glColor,padding:"2px 8px",borderRadius:99,flexShrink:0}}>{gl.domain}</span>
                      <p style={{fontSize:12,color:C.black,flex:1,margin:0}}>{gl.goal_text?.slice(0,60)}…</p>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <div style={{width:60,height:5,background:C.tanL,borderRadius:99}}><div style={{height:"100%",width:`${glPct}%`,background:glColor,borderRadius:99}}/></div>
                        <span style={{fontSize:11,fontWeight:700,color:glColor}}>{glPct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Page>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// FUTURE READINESS
// ═══════════════════════════════════════════════════════════
function FutureReadiness({setPage}){
  const {isMobile}=useResponsive();
  const {toast}=useToast();
  const {students:dbStudents}=useSupabaseAuth();
  const [studentId,setStudentId]=useState(null);
  const [checked,setChecked]=useState([]);
  function toggleCheck(i){setChecked(c=>c.includes(i)?c.filter(x=>x!==i):[...c,i]);}

  useEffect(()=>{
    if(dbStudents?.length&&!studentId) setStudentId(dbStudents[0].id);
  },[dbStudents]);
  const dbS=dbStudents?.find(st=>st.id===studentId);
  const s=dbS?{name:dbS.name,grade:dbS.grade||"–",disability:dbS.disability||"ALP",target:dbS.transition_target||"Not yet set"}:null;

  const domains=[
    {icon:"💼",label:"Employment & Career",skills:[
      {id:0,skill:"Can identify personal interests and strengths"},
      {id:1,skill:"Has completed a job interest survey"},
      {id:2,skill:"Understands workplace expectations and routines"},
      {id:3,skill:"Has participated in a community job shadowing activity"},
    ]},
    {icon:"🏠",label:"Independent Living",skills:[
      {id:4,skill:"Can manage a simple budget"},
      {id:5,skill:"Can use public transport independently"},
      {id:6,skill:"Can prepare simple meals"},
      {id:7,skill:"Can make and manage appointments"},
    ]},
    {icon:"🤝",label:"Community Participation",skills:[
      {id:8,skill:"Participates in at least one community group"},
      {id:9,skill:"Understands personal rights and responsibilities"},
      {id:10,skill:"Can self-advocate in familiar settings"},
      {id:11,skill:"Has a support network beyond family"},
    ]},
    {icon:"🎓",label:"Post-Secondary Education",skills:[
      {id:12,skill:"Has explored post-secondary options"},
      {id:13,skill:"Understands application process for college/training"},
      {id:14,skill:"Has visited at least one college or training site"},
      {id:15,skill:"Can describe their learning needs to a provider"},
    ]},
  ].map(d=>({...d,skills:d.skills.map(sk=>({...sk,status:checked.includes(sk.id)?"Achieved":"Not Started"}))}));

  const statusColors={Achieved:C.green,"In Progress":C.amber,"Not Started":C.warm};
  const total=domains.reduce((acc,d)=>acc+d.skills.length,0);
  const achieved=checked.length;
  const pct=Math.round(achieved/total*100);

  return(
    <Page title={<>Future <span className="serif-italic" style={{fontSize:26}}>Readiness</span></>}
      subtitle="Post-secondary transition planning and skills tracking"
      action={<div style={{display:"flex",gap:8}}>
        <button className="btn-ghost" onClick={()=>toast("Transition plan exported","success")} style={{fontSize:11}}>⬇ Export</button>
        <button className="btn-black" onClick={()=>setPage("goals")} style={{fontSize:11,padding:"11px 20px"}}>🎯 Goals →</button>
      </div>}>

      {/* Student selector */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:600,color:C.warm}}>Student:</span>
        {(dbStudents||[]).map(st=>(
          <button key={st.id} onClick={()=>setStudentId(st.id)} className={studentId===st.id?"btn-black":"btn-ghost"}
            style={{fontSize:11,padding:"8px 14px"}}>{st.name.split(" ")[0]}</button>
        ))}
      </div>

      {!s&&(
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>🎓</div>
          <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:8}}>No Students Yet</h3>
          <p style={{fontSize:13,color:C.warm}}>Add a student to start transition planning.</p>
        </div>
      )}

      {s&&(<>
      {/* Overview card */}
      <div className="card" style={{padding:"20px 24px",marginBottom:16,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
        <Avatar name={s.name} size={52}/>
        <div style={{flex:1}}>
          <h3 style={{fontSize:16,fontWeight:700,color:C.black,marginBottom:2}}>{s.name}</h3>
          <p style={{fontSize:12,color:C.warm,marginBottom:6}}>Grade {s.grade} · {s.disability}</p>
          <p style={{fontSize:12,color:C.warm}}>Transition Target: <b style={{color:C.purple}}>{s.target}</b></p>
        </div>
        <div style={{textAlign:"center",padding:"16px 24px",background:C.purpleL,borderRadius:12}}>
          <div className="serif" style={{fontSize:36,fontWeight:800,color:C.purple,lineHeight:1}}>{pct}%</div>
          <div style={{fontSize:11,color:C.warm,marginTop:4}}>Skills achieved</div>
          <div style={{fontSize:10,color:C.warm}}>{achieved} of {total}</div>
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{marginBottom:20}}>
        <div style={{height:8,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.purple},#A855F7)`,borderRadius:99,transition:"width .5s"}}/>
        </div>
      </div>

      {/* Skill domains */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        {domains.map(domain=>(
          <div key={domain.label} className="card" style={{padding:"20px 22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <span style={{fontSize:20}}>{domain.icon}</span>
              <p className="lbl" style={{margin:0}}>{domain.label}</p>
              <span style={{marginLeft:"auto",fontSize:11,color:C.warm}}>{domain.skills.filter(sk=>checked.includes(sk.id)).length}/{domain.skills.length}</span>
            </div>
            {domain.skills.map(sk=>(
              <div key={sk.id} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"flex-start",cursor:"pointer"}}
                onClick={()=>{toggleCheck(sk.id);if(!checked.includes(sk.id))toast(`✓ Skill marked achieved`,"success");}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked.includes(sk.id)?C.purple:C.tanL}`,background:checked.includes(sk.id)?C.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                  {checked.includes(sk.id)&&<span style={{color:"#fff",fontSize:10,fontWeight:700}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5,color:checked.includes(sk.id)?C.warm:C.black,textDecoration:checked.includes(sk.id)?"line-through":"none",lineHeight:1.4}}>{sk.skill}</div>
                </div>
                <span style={{fontSize:10,fontWeight:700,color:statusColors[sk.status],background:statusColors[sk.status]+"18",padding:"2px 7px",borderRadius:99,flexShrink:0,whiteSpace:"nowrap"}}>{sk.status}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Next steps */}
      <div className="card" style={{padding:"20px 24px",marginTop:16,background:"linear-gradient(135deg,#7C3AED11,#A855F711)"}}>
        <p className="lbl" style={{marginBottom:12,color:C.purple}}>RECOMMENDED NEXT STEPS</p>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10}}>
          {[["📋","Complete transition assessment","Add to ALP goals this quarter"],["🤝","Schedule agency meeting","Connect with local job services"],["🎓","Campus visit","Book a tour of community college"]].map(([ic,title,desc])=>(
            <div key={title} style={{padding:"12px 14px",background:"rgba(124,58,237,.06)",borderRadius:10,cursor:"pointer"}} onClick={()=>toast(`${title} — added to action list`,"info")}>
              <span style={{fontSize:20}}>{ic}</span>
              <div style={{fontSize:12,fontWeight:600,color:C.black,marginTop:6,marginBottom:3}}>{title}</div>
              <div style={{fontSize:11,color:C.warm}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
      </>)}
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// REVIEW QUEUE — director/admin approval workflow hub
// ═══════════════════════════════════════════════════════════
function ReviewQueue({setPage}){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const {students:dbStudents,user,profile,realRole,approveALPAction,requestChangesAction}=useSupabaseAuth();
  const [selectedId,setSelectedId]=useState(null);
  const [notes,setNotes]=useState("");
  const [busy,setBusy]=useState(false);
  const [tab,setTab]=useState("in_review");

  const isReviewer=["director","admin"].includes(realRole);
  const queue={
    in_review:(dbStudents||[]).filter(s=>s.alp_status==="in_review"),
    approved:(dbStudents||[]).filter(s=>s.alp_status==="approved"),
    changes_requested:(dbStudents||[]).filter(s=>s.alp_status==="changes_requested"),
    draft:(dbStudents||[]).filter(s=>!s.alp_status||s.alp_status==="draft"),
  };
  const visible=queue[tab]||[];
  const sel=dbStudents?.find(s=>s.id===selectedId)||null;

  async function handleApprove(){
    if(!sel)return;
    setBusy(true);
    const r=await approveALPAction(sel.id,notes);
    if(!r.error){toast(`${sel.name}'s ALP approved ✓`,"success");setSelectedId(null);setNotes("");}
    else toast(r.error.message||"Approval failed","error");
    setBusy(false);
  }
  async function handleRequestChanges(){
    if(!sel)return;
    if(!notes.trim()){toast("Add a note explaining what needs to change","error");return;}
    setBusy(true);
    const r=await requestChangesAction(sel.id,notes);
    if(!r.error){toast("Changes requested","success");setSelectedId(null);setNotes("");}
    else toast(r.error.message||"Failed","error");
    setBusy(false);
  }

  if(!isReviewer){
    return(
      <Page title={<>Review <span className="serif-italic" style={{fontSize:26}}>Queue</span></>} subtitle="Director / Admin access required">
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>🔒</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>Restricted Access</h3>
          <p style={{fontSize:13,color:C.warm}}>The Review Queue is only available to Director and Admin accounts. Your current role: <b>{realRole}</b>.</p>
        </div>
      </Page>
    );
  }

  return(
    <Page title={<>Review <span className="serif-italic" style={{fontSize:26}}>Queue</span></>}
      subtitle={`${queue.in_review.length} ALP${queue.in_review.length!==1?"s":""} awaiting your review`}>

      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {[["in_review",`👁️ In Review (${queue.in_review.length})`],["changes_requested",`⚠️ Changes Requested (${queue.changes_requested.length})`],["approved",`✅ Approved (${queue.approved.length})`],["draft",`✏️ Draft (${queue.draft.length})`]].map(([id,label])=>(
          <button key={id} onClick={()=>{setTab(id);setSelectedId(null);}} className={tab===id?"btn-black":"btn-ghost"} style={{fontSize:11,padding:"9px 16px"}}>{label}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile||!sel?"1fr":"1fr 1.2fr",gap:16}}>
        {/* Queue list */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {visible.length===0&&(
            <div className="card" style={{padding:"40px 24px",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:10}}>📭</div>
              <p style={{fontSize:13,color:C.warm}}>Nothing in this queue right now.</p>
            </div>
          )}
          {visible.map(s=>(
            <div key={s.id} onClick={()=>setSelectedId(s.id)} className="card" style={{padding:"16px 18px",cursor:"pointer",border:`1.5px solid ${selectedId===s.id?C.purple:C.tanL}`,background:selectedId===s.id?C.purpleL:C.white}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <p style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:2}}>{s.name}</p>
                  <p style={{fontSize:11,color:C.warm}}>Grade {s.grade||"–"} · {s.disability||"ALP"}</p>
                </div>
                {s.submitted_for_review_at&&<span style={{fontSize:10,color:C.warm,flexShrink:0}}>{new Date(s.submitted_for_review_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {sel&&(
          <div className="card" style={{padding:"24px 26px",alignSelf:"flex-start"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <h3 className="serif" style={{fontSize:18,fontWeight:700}}>{sel.name}</h3>
                <p style={{fontSize:12,color:C.warm,marginTop:2}}>Grade {sel.grade||"–"} · {sel.disability||"ALP"} · {sel.school_name||"–"}</p>
              </div>
              <button className="btn-ghost" onClick={()=>setPage("builder")} style={{fontSize:11}}>Open Full ALP →</button>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[["Strengths",sel.strengths],["Growth Areas",sel.growth_areas],["Concerns",sel.concerns],["Tier",sel.tier]].map(([l,v])=>(
                <div key={l} style={{padding:"10px 12px",background:C.purpleL,borderRadius:8}}>
                  <p style={{fontSize:10,fontWeight:700,color:C.purple,marginBottom:3}}>{l.toUpperCase()}</p>
                  <p style={{fontSize:12,color:C.black,lineHeight:1.5}}>{v||"Not recorded"}</p>
                </div>
              ))}
            </div>

            {sel.submitted_for_review_at&&(
              <p style={{fontSize:12,color:C.warm,marginBottom:14}}>📤 Submitted {new Date(sel.submitted_for_review_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
            )}
            {sel.review_decision_notes&&(
              <div style={{padding:"10px 14px",background:"#FEF2F2",borderRadius:8,marginBottom:14,fontSize:12,color:C.red}}>Previous note: "{sel.review_decision_notes}"</div>
            )}

            {tab==="in_review"&&(
              <>
                <UTextarea label="Decision notes (visible to teacher)" value={notes} onChange={e=>setNotes(e.target.value)} rows={4} placeholder="What's working well? What needs to change before approval?"/>
                <div style={{display:"flex",gap:10,marginTop:14}}>
                  <button className="btn-ghost" disabled={busy} onClick={handleRequestChanges} style={{flex:1,fontSize:12,color:C.red}}>⚠️ Request Changes</button>
                  <button className="btn-purple" disabled={busy} onClick={handleApprove} style={{flex:1,fontSize:12,padding:"13px"}}>{busy?<><Spin/> Saving…</>:"✅ Approve ALP"}</button>
                </div>
              </>
            )}
            {tab!=="in_review"&&(
              <div style={{padding:"12px 14px",background:C.tanL,borderRadius:8,fontSize:12,color:C.warm}}>
                {tab==="approved"&&`Approved ${sel.approved_at?new Date(sel.approved_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):""}.`}
                {tab==="changes_requested"&&"Waiting for the teacher to resubmit after making changes."}
                {tab==="draft"&&"Not yet submitted for review."}
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}


function Reports(){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const {students:dbStudents,user,profile}=useSupabaseAuth();
  const [tab,setTab]=useState("generate");
  const [activeReport,setActiveReport]=useState(null);
  const [generating,setGenerating]=useState(null);
  const [selectedStudentId,setSelectedStudentId]=useState(null);

  const totalStudents=dbStudents?.length||0;
  const s=dbStudents?.find(st=>st.id===selectedStudentId)||dbStudents?.[0]||null;

  useEffect(()=>{
    if(dbStudents?.length&&!selectedStudentId) setSelectedStudentId(dbStudents[0]?.id);
  },[dbStudents]);

  const reportTypes=[
    {id:"alp",icon:"📋",label:"Individual ALP Report",desc:"Complete ALP document for one student — all sections, goals, and services.",formats:["PDF"],time:"~10 sec",needsStudent:true},
    {id:"progress",icon:"📈",label:"Student Progress Report",desc:"Visual progress report with goal tracking, data points, and trend analysis.",formats:["PDF"],time:"~15 sec",needsStudent:true},
    {id:"class",icon:"👥",label:"Class Caseload Report",desc:`All ${totalStudents} students in your caseload — plan status and review dates.`,formats:["PDF"],time:"~20 sec",needsStudent:false},

  ];

  async function generateReport(type){
    if(type.needsStudent&&!s){toast("Select a student first","error");return;}
    setGenerating(type.id);
    try{
      const studentName=s?.name||"All_Students";
      if(type.id==="class"){
        // Multi-student caseload PDF
        const jsPDF=await loadJsPDF();
        const doc=new jsPDF({unit:"pt",format:"letter"});
        const W=doc.internal.pageSize.getWidth();const margin=56;let y=64;
        doc.setFont("times","bold");doc.setFontSize(20);doc.setTextColor(124,58,237);
        doc.text("Class Caseload Report",margin,y);y+=24;
        doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(107,114,128);
        doc.text(`Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} by ${profile?.full_name||user?.email||"Staff"} · ${totalStudents} students`,margin,y);y+=24;
        doc.setDrawColor(124,58,237);doc.line(margin,y,W-margin,y);y+=20;
        (dbStudents||[]).forEach((st,i)=>{
          if(y>doc.internal.pageSize.getHeight()-80){doc.addPage();y=64;}
          doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(17,17,17);
          doc.text(`${i+1}. ${st.name}`,margin,y);y+=15;
          doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(107,114,128);
          doc.text(`Grade ${st.grade||"–"} · ${st.disability||"ALP"} · Status: ${(st.alp_status||"draft").replace("_"," ")} · ${st.school_name||"–"}`,margin,y);y+=20;
        });
        doc.save(`ALP_Caseload_Report_${new Date().toISOString().split("T")[0]}.pdf`);
      } else {
        const goals=s?.id?await Supabase.getGoals(s.id):[];
        const progress=s?.id?await Supabase.getProgress(s.id,50):[];
        const doc=await generateALPPdf({student:s,goals,notes:s?.review_notes||(type.id==="progress"?`Progress summary — ${progress.length} data points on file.`:""),reviewer:profile?.full_name||user?.email,school:s?.school_name,guardians:s?.id?await Supabase.getGuardians(s.id):[]});
        doc.save(`ALP_${type.id}_${studentName.replace(/\s+/g,"_")}_${new Date().toISOString().split("T")[0]}.pdf`);
      }
      toast(`${type.label} downloaded as PDF!`,"success");
    }catch(e){
      console.error(e);
      toast("Report generation failed","error");
    }
    setGenerating(null);
  }

  return(
    <Page title={<>Reports <span className="serif-italic" style={{fontSize:26}}>& Exports</span></>}
      subtitle={`${totalStudents} student${totalStudents!==1?"s":""} in your caseload · ${new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}`}>

      {/* Tab bar */}
      <div style={{display:"flex",gap:0,borderBottom:`2px solid ${C.tanL}`,marginBottom:20}}>
        {[["generate","Generate Reports"],["overview","Caseload Overview"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 20px",border:"none",background:"transparent",cursor:"pointer",
            borderBottom:tab===id?`3px solid ${C.purple}`:"3px solid transparent",
            color:tab===id?C.purple:C.warm,fontWeight:tab===id?700:400,fontSize:12,
            fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",transition:"all .15s"}}>
            {label}
          </button>
        ))}
      </div>

      {tab==="generate"&&(
        <>
          {/* Student selector for per-student reports */}
          {dbStudents?.length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,padding:"14px 18px",background:C.purpleL,borderRadius:10,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:C.warm}}>Selected student for reports:</span>
              <select value={selectedStudentId||""} onChange={e=>setSelectedStudentId(e.target.value)} style={{fontSize:12,padding:"7px 12px",border:`1px solid ${C.tanL}`,borderRadius:8,background:C.white,color:C.black,fontWeight:600}}>
                {dbStudents.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
              {s&&<span style={{fontSize:11,color:C.warm}}>Grade {s.grade||"–"} · {s.disability||"ALP"}</span>}
            </div>
          )}

          {totalStudents===0&&(
            <div className="card" style={{padding:"48px 32px",textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:48,marginBottom:12}}>📋</div>
              <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Students Yet</h3>
              <p style={{fontSize:13,color:C.warm}}>Add students and complete their ALPs to generate reports.</p>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
            {reportTypes.map(r=>(
              <div key={r.id} className="card" style={{padding:"22px 24px",cursor:"pointer",transition:"box-shadow .2s",border:`1.5px solid ${activeReport===r.id?C.purple:C.tanL}`}}
                onClick={()=>setActiveReport(activeReport===r.id?null:r.id)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:24}}>{r.icon}</span>
                    <div>
                      <p style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:3}}>{r.label}</p>
                      <p style={{fontSize:12,color:C.warm,lineHeight:1.5}}>{r.desc}</p>
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingTop:12,borderTop:`1px solid ${C.tanL}`}}>
                  <div style={{display:"flex",gap:6}}>
                    {r.formats.map(f=><span key={f} style={{fontSize:10,fontWeight:700,color:C.red,background:C.red+"12",padding:"2px 8px",borderRadius:4}}>{f}</span>)}
                    <span style={{fontSize:10,color:C.warm,padding:"2px 6px"}}>{r.time}</span>
                  </div>
                  <button
                    className="btn-purple"
                    style={{fontSize:11,padding:"8px 18px"}}
                    disabled={generating===r.id||(r.needsStudent&&totalStudents===0)}
                    onClick={e=>{e.stopPropagation();generateReport(r);}}>
                    {generating===r.id?<><Spin/> Generating…</>:"Generate ↓"}
                  </button>
                </div>
                {r.needsStudent&&s&&activeReport===r.id&&(
                  <div style={{marginTop:10,padding:"8px 12px",background:C.purpleL,borderRadius:8,fontSize:11,color:C.purple}}>
                    Will generate for: <b>{s.name}</b>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{marginTop:16,padding:"12px 16px",background:C.tanL+"55",borderRadius:8,fontSize:12,color:C.warm}}>
            📄 Reports download as professional PDF documents, generated from your real student and goal data.
          </div>
        </>
      )}

      {tab==="overview"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
            {[
              ["TOTAL STUDENTS",totalStudents,C.purple],
              ["ACTIVE PLANS",dbStudents?.filter(s=>s.status==="Active"||!s.status).length||0,C.green],
              ["REVIEW DUE",dbStudents?.filter(s=>s.status==="Review Due").length||0,C.amber],
              ["INACTIVE",dbStudents?.filter(s=>s.status==="Inactive").length||0,C.red],
            ].map(([l,v,c])=>(
              <div key={l} className="card" style={{padding:"16px 20px",borderLeft:`3px solid ${c}`}}>
                <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
                <div className="serif" style={{fontSize:28,fontWeight:700,color:c}}><AnimCounter value={v}/></div>
              </div>
            ))}
          </div>

          {totalStudents===0?(
            <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:12}}>👥</div>
              <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Students on Caseload</h3>
              <p style={{fontSize:13,color:C.warm}}>Add students to see your caseload overview here.</p>
            </div>
          ):(
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{fontSize:13,fontWeight:700,color:C.black}}>All Students — Caseload</p>
                <button className="btn-ghost" style={{fontSize:11}} onClick={()=>generateReport({id:"class",label:"Class Caseload Report",needsStudent:false,formats:["PDF"],time:"~20 sec"})}>⬇ Download Caseload Report</button>
              </div>
              <div style={{overflowX:"auto"}}>
                <table className="data-table" style={{minWidth:600}}>
                  <thead><tr><th>Student</th><th>Grade</th><th>Plan</th><th>Disability / Need</th><th>Status</th><th>School</th></tr></thead>
                  <tbody>
                    {dbStudents.map(st=>(
                      <tr key={st.id}>
                        <td style={{fontWeight:600,color:C.black}}>{st.name}</td>
                        <td style={{fontSize:12,color:C.warm}}>{st.grade||"–"}</td>
                        <td><span style={{fontSize:11,fontWeight:600,background:C.purple+"18",color:C.purple,padding:"2px 8px",borderRadius:99}}>{st.plan||"ALP"}</span></td>
                        <td style={{fontSize:12,color:C.warm}}>{st.disability||"–"}</td>
                        <td>
                          <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                            color:st.status==="Active"?C.green:st.status==="Review Due"?C.amber:C.red,
                            background:(st.status==="Active"?C.green:st.status==="Review Due"?C.amber:C.red)+"18"}}>
                            {st.status||"Active"}
                          </span>
                        </td>
                        <td style={{fontSize:12,color:C.warm}}>{st.school_name||"–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS SCREEN
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// COMPLIANCE DASHBOARD — completion, overdue reviews, gaps
// ═══════════════════════════════════════════════════════════
function ComplianceDashboard({setPage}){
  const {isMobile}=useResponsive();
  const {students:dbStudents,realRole}=useSupabaseAuth();
  const [goalCounts,setGoalCounts]=useState({});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!dbStudents?.length){setLoading(false);return;}
    setLoading(true);
    Promise.all(dbStudents.map(s=>Supabase.getGoals(s.id).then(g=>[s.id,g?.length||0])))
      .then(pairs=>{setGoalCounts(Object.fromEntries(pairs));setLoading(false);});
  },[dbStudents]);

  const activeStudents=(dbStudents||[]).filter(s=>s.alp_status!=="archived");
  const total=activeStudents.length||0;
  const byStatus={
    draft:activeStudents.filter(s=>!s.alp_status||s.alp_status==="draft").length||0,
    in_review:activeStudents.filter(s=>s.alp_status==="in_review").length||0,
    approved:activeStudents.filter(s=>s.alp_status==="approved").length||0,
    changes_requested:activeStudents.filter(s=>s.alp_status==="changes_requested").length||0,
    archived:(dbStudents||[]).filter(s=>s.alp_status==="archived").length||0,
  };
  const completionPct=total>0?Math.round((byStatus.approved/total)*100):0;
  const overdue=activeStudents.filter(s=>s.review_date&&new Date(s.review_date)<new Date())||[];
  const dueSoon=activeStudents.filter(s=>s.review_date&&new Date(s.review_date)>=new Date()&&new Date(s.review_date)<=new Date(Date.now()+30*86400000))||[];
  const missingGoals=activeStudents.filter(s=>!goalCounts[s.id])||[];
  const missingPresentLevels=activeStudents.filter(s=>!s.strengths&&!s.growth_areas)||[];
  const missingParentContact=activeStudents.filter(s=>!s.parent_email&&!s.parent_phone)||[];

  return(
    <Page title={<>Compliance <span className="serif-italic" style={{fontSize:26}}>Dashboard</span></>}
      subtitle={`${total} student${total!==1?"s":""} · ${completionPct}% with approved ALPs`}
      action={<button className="btn-black" onClick={()=>setPage("reports")} style={{fontSize:11,padding:"11px 22px"}}>📊 Full Reports →</button>}>

      {total===0&&(
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>No Data Yet</h3>
          <p style={{fontSize:13,color:C.warm}}>Compliance metrics populate once students are added.</p>
        </div>
      )}

      {total>0&&(
        <>
          {/* Top metrics */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
            {[["COMPLETION RATE",`${completionPct}%`,"Approved ALPs",completionPct>=80?C.green:completionPct>=50?C.amber:C.red,"✅"],
              ["OVERDUE REVIEWS",overdue.length,"Past review date",overdue.length>0?C.red:C.green,"🚨"],
              ["DUE WITHIN 30 DAYS",dueSoon.length,"Upcoming reviews",dueSoon.length>0?C.amber:C.green,"📅"],
              ["MISSING GOALS",missingGoals.length,"Goals appear here once Step 3 is done",missingGoals.length>0?C.red:C.green,"🎯"]].map(([l,v,sub,c,ic])=>(
              <div key={l} className="card" style={{padding:"18px 20px",borderLeft:`3px solid ${c}`}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div>
                    <p className="lbl" style={{marginBottom:6,fontSize:8}}>{l}</p>
                    <div className="serif" style={{fontSize:26,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                    <p style={{fontSize:10,color:C.warm,marginTop:4}}>{sub}</p>
                  </div>
                  <span style={{fontSize:24,opacity:.15}}>{ic}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Workflow status breakdown */}
          <div className="card" style={{padding:"22px 24px",marginBottom:16}}>
            <p className="lbl" style={{marginBottom:16}}>WORKFLOW STATUS BREAKDOWN</p>
            {[["Draft",byStatus.draft,C.warm],["In Review",byStatus.in_review,C.amber],["Approved",byStatus.approved,C.green],["Changes Requested",byStatus.changes_requested,C.red],["Archived",byStatus.archived,C.tan]].map(([label,count,color])=>{
              const pct=total>0?Math.round((count/total)*100):0;
              return(
                <div key={label} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                    <span style={{color:C.black}}>{label}</span>
                    <span style={{fontWeight:700,color}}>{count} ({pct}%)</span>
                  </div>
                  <div style={{height:6,background:C.tanL,borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:99}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Documentation gaps */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14}}>
            {[["🎯 Missing Goals",missingGoals,"No goals yet. Step 3 is where they go — the AI can draft measurable ones from this student's present levels in about a minute."],
              ["📋 Missing Present Levels",missingPresentLevels,"Strengths/growth areas not recorded."],
              ["📞 Missing Parent Contact",missingParentContact,"No parent email or phone on file."]].map(([title,list,empty])=>(
              <div key={title} className="card" style={{padding:"18px 20px"}}>
                <p style={{fontSize:13,fontWeight:700,color:C.black,marginBottom:10}}>{title} ({list.length})</p>
                {list.length===0&&<p style={{fontSize:11,color:C.green}}>✓ All students have this on file.</p>}
                {list.slice(0,5).map(s=>(
                  <div key={s.id} onClick={()=>setPage("students")} style={{fontSize:12,color:C.warm,padding:"5px 0",borderBottom:`1px solid ${C.tanL}`,cursor:"pointer"}}>{s.name}</div>
                ))}
                {list.length>5&&<p style={{fontSize:10,color:C.warm,marginTop:6}}>+{list.length-5} more</p>}
              </div>
            ))}
          </div>

          {/* Overdue reviews table */}
          {overdue.length>0&&(
            <div className="card" style={{padding:0,overflow:"hidden",marginTop:16}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.tanL}`,background:"#FEF2F2"}}>
                <p style={{fontSize:13,fontWeight:700,color:C.red}}>🚨 Overdue Reviews — Action Required</p>
              </div>
              <div style={{overflowX:"auto"}}>
                <table className="data-table" style={{minWidth:400}}>
                  <thead><tr><th>Student</th><th>Review Was Due</th><th>Days Overdue</th><th></th></tr></thead>
                  <tbody>{overdue.map(s=>{
                    const days=Math.floor((new Date()-new Date(s.review_date))/86400000);
                    return(
                      <tr key={s.id}>
                        <td style={{fontWeight:600}}>{s.name}</td>
                        <td style={{fontSize:12,color:C.warm}}>{new Date(s.review_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td>
                        <td><span style={{fontSize:11,fontWeight:700,color:C.red}}>{days} day{days!==1?"s":""}</span></td>
                        <td><button className="btn-ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setPage("builder")}>Review Now →</button></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOG — who changed what, when (admin/director only)
// ═══════════════════════════════════════════════════════════
function AuditLogPage({setPage}){
  const {isMobile}=useResponsive();
  const {realRole,students:dbStudents}=useSupabaseAuth();
  const [logs,setLogs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filterAction,setFilterAction]=useState("all");
  const [filterStudent,setFilterStudent]=useState("");
  const isAuthorized=["director","admin"].includes(realRole);

  useEffect(()=>{
    if(!isAuthorized)return;
    setLoading(true);
    Supabase.getAuditLog({studentId:filterStudent||null,limit:200}).then(d=>{setLogs(d||[]);setLoading(false);});
  },[isAuthorized,filterStudent]);

  const actionMeta={
    create_student:{icon:"➕",label:"Created student",color:C.green},
    update_student:{icon:"✏️",label:"Updated student",color:C.blue},
    delete_student:{icon:"🗑",label:"Deleted student",color:C.red},
    create_goal:{icon:"🎯",label:"Created goal",color:C.purple},
    submit_for_review:{icon:"📤",label:"Submitted for review",color:C.amber},
    approve_alp:{icon:"✅",label:"Approved ALP",color:C.green},
    request_changes:{icon:"⚠️",label:"Requested changes",color:C.red},
    reopen_draft:{icon:"🔓",label:"Reopened as draft",color:C.warm},
    archive_student:{icon:"📦",label:"Archived student",color:C.warm},
  };
  const actionTypes=["all",...new Set(logs.map(l=>l.action))];
  const visible=filterAction==="all"?logs:logs.filter(l=>l.action===filterAction);

  if(!isAuthorized){
    return(
      <Page title={<>Audit <span className="serif-italic" style={{fontSize:26}}>Log</span></>} subtitle="Director / Admin access required">
        <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>🔒</div>
          <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:8}}>Restricted Access</h3>
          <p style={{fontSize:13,color:C.warm}}>The Audit Log is only available to Director and Admin accounts. Your current role: <b>{realRole}</b>.</p>
        </div>
      </Page>
    );
  }

  return(
    <Page title={<>Audit <span className="serif-italic" style={{fontSize:26}}>Log</span></>}
      subtitle={`${logs.length} event${logs.length!==1?"s":""} recorded`}>

      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filterStudent} onChange={e=>setFilterStudent(e.target.value)} style={{fontSize:12,padding:"8px 12px",border:`1px solid ${C.tanL}`,borderRadius:8,background:C.white,color:C.black}}>
          <option value="">All Students</option>
          {(dbStudents||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {actionTypes.map(a=>(
            <button key={a} onClick={()=>setFilterAction(a)} className={filterAction===a?"btn-black":"btn-ghost"} style={{fontSize:10,padding:"6px 12px"}}>
              {a==="all"?"All Actions":actionMeta[a]?.label||a}
            </button>
          ))}
        </div>
      </div>

      {loading&&<div style={{textAlign:"center",padding:40,color:C.warm}}>Loading audit log…</div>}
      {!loading&&visible.length===0&&(
        <div className="card" style={{padding:"40px 24px",textAlign:"center"}}>
          <p style={{fontSize:13,color:C.warm}}>No audit events recorded yet. Events appear here as users create, edit, submit, and approve records.</p>
        </div>
      )}
      {!loading&&visible.length>0&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table className="data-table" style={{minWidth:560}}>
              <thead><tr>{["When","Who","Action","Details",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>{visible.map(log=>{
                const meta=actionMeta[log.action]||{icon:"•",label:log.action,color:C.warm};
                return(
                  <tr key={log.id}>
                    <td style={{fontSize:11,color:C.warm,whiteSpace:"nowrap"}}>{new Date(log.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
                    <td style={{fontSize:12}}>{log.profiles?.full_name||"Unknown"} <span style={{fontSize:10,color:C.warm}}>({log.profiles?.role||"—"})</span></td>
                    <td><span style={{fontSize:11,fontWeight:700,color:meta.color}}>{meta.icon} {meta.label}</span></td>
                    <td style={{fontSize:11,color:C.warm,maxWidth:200}}>{log.details?JSON.stringify(log.details).slice(0,60):"—"}</td>
                    <td></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}
    </Page>
  );
}


function Notifications(){
  const {toast}=useToast();
  const {isMobile}=useResponsive();
  const {user,students:dbStudents}=useSupabaseAuth();
  const [dismissed,setDismissed]=useState([]);
  const [allRead,setAllRead]=useState(false);
  const [filter,setFilter]=useState("all");
  const [selected,setSelected]=useState(null);
  const [notifs,setNotifs]=useState([]);
  const [loading,setLoading]=useState(true);
  function dismiss(id){setDismissed(d=>[...d,id]);}
  async function markAllRead(){setAllRead(true);if(user)await Supabase.markAllNotificationsRead(user.id);toast("All notifications marked as read","success");}

  useEffect(()=>{
    if(!user?.id){setLoading(false);return;}
    Supabase.getNotifications(user.id).then(n=>{setNotifs(n||[]);setLoading(false);}).catch(()=>setLoading(false));
  },[user?.id]);


  const typeColors={review:C.amber,progress:C.blue,message:C.green,signature:C.purple,goal:C.green};
  const typeLabels={review:"Review",progress:"Progress",message:"Message",signature:"Signature",goal:"Goal"};
  const filters=["all","unread","review","progress","message","goal"];
  const visible=notifs.filter(n=>{
    if(dismissed.includes(n.id))return false;
    if(filter==="all")return true;
    if(filter==="unread")return !n.read&&!allRead;
    return n.type===filter;
  });
  const unread=notifs.filter(n=>!n.read&&!dismissed.includes(n.id)&&!allRead).length;

  return(
    <Page title={<>Notifications</>}
      subtitle={`${unread} unread · ${visible.length} showing`}
      action={<div style={{display:"flex",gap:8}}>
        <button className="btn-ghost" onClick={markAllRead} style={{fontSize:11,padding:"9px 16px"}}>Mark All Read</button>
        <button className="btn-outline" onClick={()=>{setDismissed(notifs.map(n=>n.id));toast("All cleared","info");}} style={{fontSize:11,padding:"9px 16px"}}>Clear All</button>
      </div>}>

      {/* Filter pills */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {filters.map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={filter===f?"btn-black":"btn-ghost"}
            style={{fontSize:11,padding:"7px 14px",textTransform:"capitalize"}}>
            {f}{f==="unread"&&unread>0?` (${unread})`:""}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{display:"grid",gridTemplateColumns:isMobile||!selected?"1fr":"1fr 1fr",gap:14}}>

        {/* Notification list */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {loading&&<div style={{textAlign:"center",padding:40,color:C.warm}}>Loading notifications…</div>}
          {!loading&&visible.length===0&&(
            <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
              <div style={{fontSize:44,marginBottom:12}}>🎉</div>
              <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:6}}>All caught up!</h3>
              <p style={{fontSize:14,color:C.warm}}>No notifications in this filter.</p>
            </div>
          )}
          {visible.map(n=>(
            <div key={n.id} className="card"
              style={{padding:"16px 18px",cursor:"pointer",border:`1.5px solid ${selected?.id===n.id?C.purple:(!n.read&&!allRead)?C.amber+"44":C.tanL}`,background:selected?.id===n.id?C.purpleL:C.white,transition:"all .15s",position:"relative"}}
              onClick={()=>setSelected(selected?.id===n.id?null:n)}>
              {(!n.read&&!allRead)&&<div style={{position:"absolute",top:14,right:14,width:8,height:8,borderRadius:"50%",background:C.amber}}/>}
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:38,height:38,borderRadius:10,background:typeColors[n.type]+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {n.icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:700,color:C.black,lineHeight:1.3}}>{n.title}</span>
                    <span style={{fontSize:10,color:C.warm,flexShrink:0}}>{n.time}</span>
                  </div>
                  <p style={{fontSize:12,color:C.warm,lineHeight:1.5,margin:0,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{n.body}</p>
                  {n.student&&<div style={{marginTop:6}}><span style={{fontSize:10,background:typeColors[n.type]+"18",color:typeColors[n.type],padding:"2px 8px",borderRadius:99,fontWeight:700}}>{typeLabels[n.type]}</span>{" "}<span style={{fontSize:10,color:C.warm}}>{n.student}</span></div>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginTop:10}}>
                {n.actions?.slice(0,2).map(a=>(
                  <button key={a} className="btn-ghost" style={{fontSize:10,padding:"4px 10px"}}
                    onClick={e=>{e.stopPropagation();toast(`${a} opened`,"info");}}>{a}</button>
                ))}
                <button className="btn-ghost" style={{fontSize:10,padding:"4px 10px",marginLeft:"auto",color:C.warm}}
                  onClick={e=>{e.stopPropagation();dismiss(n.id);}}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected&&!isMobile&&(
          <div className="card" style={{padding:"24px",position:"sticky",top:80,alignSelf:"flex-start"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:44,height:44,borderRadius:12,background:typeColors[selected.type]+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{selected.icon}</div>
                <div>
                  <span style={{fontSize:10,fontWeight:800,color:typeColors[selected.type],background:typeColors[selected.type]+"18",padding:"2px 8px",borderRadius:99}}>{typeLabels[selected.type].toUpperCase()}</span>
                  <div style={{fontSize:11,color:C.warm,marginTop:2}}>{selected.time}</div>
                </div>
              </div>
              <button onClick={()=>setSelected(null)} style={{fontSize:20,color:C.warm,background:"none",border:"none",cursor:"pointer"}}>×</button>
            </div>
            <h3 style={{fontSize:15,fontWeight:700,color:C.black,marginBottom:10,lineHeight:1.4}}>{selected.title}</h3>
            <p style={{fontSize:13,color:C.warm,lineHeight:1.75,marginBottom:16}}>{selected.body}</p>
            {selected.student&&<div style={{background:C.purpleL,borderRadius:8,padding:"10px 12px",marginBottom:16,fontSize:12,color:C.black}}><b>Student:</b> {selected.student}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {selected.actions?.map(a=>(
                <button key={a} className="btn-purple" style={{fontSize:12,padding:"11px"}}
                  onClick={()=>toast(`${a} opened`,"info")}>{a} →</button>
              ))}
              <button className="btn-ghost" onClick={()=>{dismiss(selected.id);setSelected(null);}} style={{fontSize:11}}>Dismiss notification</button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}


function NotifPrefsTab({save,saved}){
  const {toast}=useToast();
  const [emailFreq,setEmailFreq]=useState("daily");
  const [pushEnabled,setPushEnabled]=useState(true);
  const prefs=[
    ["Annual Review Alerts","Get notified 30 days before annual review deadlines",true],
    ["Goal Mastery","Celebrate when students achieve their ALP goals",true],
    ["Goal At-Risk Alerts","Alert when a goal shows declining trend for 2+ data points",true],
    ["Parent Messages","Notify when families send a new message",true],
    ["Signature Requests","Alert when documents require signature",true],
    ["Weekly Digest","Monday morning summary of student progress",false],
    ["Progress Data Reminders","Remind when progress hasn't been logged in 30+ days",true],
    ["Subscription & Billing","Renewal reminders and billing alerts",true],
  ];
  const [state,setState]=useState(()=>Object.fromEntries(prefs.map(([t,,d])=>[t,d])));
  const toggle=k=>setState(s=>({...s,[k]:!s[k]}));
  return(
    <div className="card" style={{padding:"28px"}}>
      <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:24}}>Notification Preferences</h3>
      {prefs.map(([title,desc])=>(
        <div key={title} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0",borderBottom:`1px solid ${C.tanL}`}}>
          <div><div style={{fontSize:14,fontWeight:500,marginBottom:2}}>{title}</div><div style={{fontSize:12,color:C.warm}}>{desc}</div></div>
          <div onClick={()=>toggle(title)} style={{width:44,height:24,borderRadius:99,background:state[title]?C.purple:C.tanL,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
            <div style={{position:"absolute",top:2,left:state[title]?22:2,width:20,height:20,borderRadius:"50%",background:C.white,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
          </div>
        </div>
      ))}
      <div style={{marginTop:20}}><button className="btn-black" onClick={save} style={{fontSize:11,padding:"12px 28px"}}>{saved?"✓ Saved!":"Save Preferences"}</button></div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SETTINGS — NOTIFICATIONS TABp)
// ═══════════════════════════════════════════════════════════
function Settings(){
  const {toast}=useToast();
  const {user:sUser,profile:sProfile}=useSupabaseAuth();
  const [displayName,setDisplayName]=useState(sProfile?.full_name||sUser?.email?.split("@")[0]||"");
  const [schoolName,setSchoolName]=useState(sProfile?.school||"");
  async function saveSettings(){
    if(user) await Supabase.upsertProfile({id:user.id,full_name:displayName,school:schoolName,updated_at:new Date().toISOString()});
    if(user&&profile){
      await Supabase.upsertProfile({id:user.id,full_name:profile.full_name,school:profile.school,updated_at:new Date().toISOString()});
    }
    toast("Settings saved successfully ✓","success");
  }
  const [activeTab,setActiveTab]=useState("profile");
  const [saved,setSaved]=useState(false);
  const [showInvite,setShowInvite]=useState(false);
  const [showLegal,setShowLegal]=useState(null);
  const [currentPw,setCurrentPw]=useState("");
  const [newPw,setNewPw]=useState("");
  const [profile,setProfile]=useState({firstName:sProfile?.full_name?.split(" ")[0]||"",lastName:sProfile?.full_name?.split(" ").slice(1).join(" ")||"",email:sUser?.email||"",phone:sProfile?.phone||"",title:sProfile?.title||"ALP Teacher",license:sProfile?.license||""});
  const setP=(k,v)=>setProfile(p=>({...p,[k]:v}));
  const [school,setSchool]=useState({name:sProfile?.school||"",id:sProfile?.school_id||"",district:sProfile?.district||"",state:sProfile?.state||"",framework:sProfile?.framework||"ALP standards_USA",year:`${new Date().getFullYear()}–${new Date().getFullYear()+1}`});
  const setSch=(k,v)=>setSchool(p=>({...p,[k]:v}));
  function save(section="Settings"){setSaved(true);toast(`${section} saved successfully ✓`,"success");setTimeout(()=>setSaved(false),2500);}
  function saveProfile(){save("Profile");}
  function saveSchool(){save("School settings");}
  const [showExportData,setShowExportData]=useState(false);
  return(
    <>{showInvite&&<InviteUserModal onClose={()=>setShowInvite(false)}/>}{showLegal&&<LegalModal type={showLegal} onClose={()=>setShowLegal(null)}/>}{showExportData&&<ExportAllDataModal onClose={()=>setShowExportData(false)}/>}
    <Page title={<>Settings</>} subtitle="Account & Platform Configuration">
      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:`1px solid ${C.tanL}`,paddingBottom:0,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {[["profile","👤 Profile"],["school","🏫 School"],["roles","👥 Users & Roles"],["notifications","🔔 Notifications"],["progress","✅ Progress"],["billing","💳 Billing"]].map(([id,label])=>(
          <button key={id} className={`tab-btn${activeTab===id?" active":""}`} onClick={()=>setActiveTab(id)} style={{whiteSpace:"nowrap",flexShrink:0,marginRight:20}}>{label}</button>
        ))}
      </div>

      {activeTab==="profile"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:24}}>
          <div className="card" style={{padding:"28px",textAlign:"center"}}>
            <Avatar name={displayName||"User"} size={80}/>
            <h3 className="serif" style={{fontSize:18,fontWeight:700,marginTop:14,marginBottom:4}}>{displayName||sUser?.email||"Your Name"}</h3>
            <p style={{fontSize:13,color:C.warm,marginTop:2}}>ALP Teacher</p>
            <p style={{fontSize:12,color:C.tan,marginTop:4}}>{schoolName||"Your School"}</p>
            <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${C.tanL}`}}>
              <Badge color="purple">Teacher</Badge>
            </div>
            <button className="btn-outline" style={{width:"100%",marginTop:16,fontSize:11}}>Change Photo</button>
          </div>
          <div className="card" style={{padding:"28px"}}>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:24}}>Personal Information</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:28}}>
              <UInput label="First Name" value={profile.firstName} onChange={e=>setP("firstName",e.target.value)}/>
              <UInput label="Last Name" value={profile.lastName} onChange={e=>setP("lastName",e.target.value)}/>
              <UInput label="Email Address" value={profile.workEmail||user?.email||""} onChange={e=>setP("workEmail",e.target.value)} type="email"/>
              <UInput label="Phone" value={profile.phone} onChange={e=>setP("phone",e.target.value)}/>
              <UInput label="Title / Role" value={profile.title} onChange={e=>setP("title",e.target.value)}/>
              <UInput label="License Number" value={profile.license} onChange={e=>setP("license",e.target.value)}/>
              <div style={{marginBottom:0}}><p className="lbl" style={{marginBottom:10}}>Appearance</p><div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.purpleL,borderRadius:10}}><ThemeToggle/><span style={{fontSize:13,color:C.black}}>Toggle dark / light mode</span></div></div>
              <USelect label="Language" value={profile.lang||"en"} onChange={e=>setP("lang",e.target.value)} options={[{value:"en",label:"English"},{value:"es",label:"Español"},{value:"fr",label:"Français"},{value:"pt",label:"Português"},{value:"ar",label:"Arabic"},{value:"tw",label:"Twi"},{value:"sw",label:"Kiswahili"}]}/>
            </div>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Change Password</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:28}}>
              <UInput label="Current Password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} type="password" placeholder="Enter current password"/>
              <UInput label="New Password" value={newPw} onChange={e=>setNewPw(e.target.value)} type="password" placeholder="At least 8 characters"/>
            </div>
            <button className="btn-black" onClick={save} style={{fontSize:11,padding:"12px 28px"}}>
              {saved?"✓ Saved!":"Save Changes"}
            </button>
          </div>
        </div>
      )}

      {activeTab==="school"&&(
        <div className="card" style={{padding:"28px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:24}}>School & District Settings</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:28}}>
            <UInput label="School Name" value={school.name} onChange={e=>setSch("name",e.target.value)}/>
            <UInput label="School Code" value={school.id} onChange={e=>setSch("id",e.target.value)}/>
            <UInput label="District" value={school.fullDistrict||""} onChange={e=>setSch("fullDistrict",e.target.value)} placeholder="Enter your district name"/>
            <UInput label="State / Region" value={school.state} onChange={e=>setSch("state",e.target.value)}/>
            <USelect label="Progress Review Framework" value={school.framework} onChange={e=>setSch("framework",e.target.value)} options={[{value:"ALP standards_USA",label:"ALP standards (USA)"},{value:"SECTION_504",label:"Support Plans"},{value:"VDOE",label:"VDOE Virginia"},{value:"GES_GHANA",label:"Ghana"},{value:"NERDC_NIGERIA",label:"Nigeria"},{value:"KICD_KENYA",label:"Kenya"},{value:"UK_SEND",label:"UK"},{value:"AUSTRALIA_NCCD",label:"Australia NCCD"},{value:"CUSTOM",label:"Custom Framework"}]}/>
            <UInput label="Academic Year" value={school.year} onChange={e=>setSch("year",e.target.value)}/>
          </div>
          <div style={{background:C.purpleL,borderRadius:10,padding:20,marginBottom:24}}>
            <p className="lbl" style={{marginBottom:12}}>Integrations</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[["🏢","Google Workspace","Connected — sync students and staff","disconnect"],["💎","Microsoft 365","Not connected","connect"],["📊","PowerSchool SIS","Connected — student data sync active","disconnect"],["🔔","Remind","Not connected","connect"]].map(([icon,name,status,action])=>(
                <div key={name} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 14px",background:C.purpleL,borderRadius:8,border:`1px solid ${C.tanL}`}}>
                  <span style={{fontSize:20}}>{icon}</span>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{name}</div><div style={{fontSize:12,color:C.warm}}>{status}</div></div>
                  <button className={action==="disconnect"?"btn-red":"btn-ghost"} style={{fontSize:11,padding:"6px 16px",textTransform:"capitalize"}}>{action}</button>
                </div>
              ))}
            </div>
          </div>
          <button className="btn-black" onClick={save} style={{fontSize:11,padding:"12px 28px"}}>{saved?"✓ Saved!":"Save Changes"}</button>
        </div>
      )}

      {activeTab==="roles"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <h3 className="serif" style={{fontSize:17,fontWeight:700}}>Users & Role Management</h3>
              <p style={{fontSize:13,color:C.warm,marginTop:4}}>Manage staff access, permissions, and role assignments.</p>
            </div>
            <div style={{display:"flex",gap:8}}><button className="btn-ghost" style={{fontSize:11,padding:"11px 18px"}} onClick={()=>setShowExportData(true)}>⬇ Export Data</button><button className="btn-black" style={{fontSize:11,padding:"11px 22px"}} onClick={()=>setShowInvite(true)}>+ Invite User</button></div>
          </div>

          {/* Role Summary Cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
            {ROLES.slice(0,4).map(r=>(
              <div key={r.id} className="card" style={{padding:"16px 18px",borderTop:`3px solid ${r.color}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:18}}>{r.icon}</span>
                  <span style={{fontSize:12.5,fontWeight:700,color:C.black}}>{r.label}</span>
                </div>
                <div className="serif" style={{fontSize:24,fontWeight:700,color:r.color,letterSpacing:"-.026em"}}>{r.id==="teacher"?1:0}</div>
                <div style={{fontSize:11,color:C.warm}}>users</div>
              </div>
            ))}
          </div>

          {/* Users Table */}
          <div className="card" style={{padding:0,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"16px 22px",borderBottom:`1px solid ${C.tanL}`,display:"flex",gap:12,justifyContent:"space-between",alignItems:"center"}}>
              <input placeholder="Search users…" className="u-input" style={{maxWidth:240}}/>
              <button className="btn-purple" style={{fontSize:11,padding:"9px 18px"}} onClick={()=>toast("Team invites are coming in a future update","info")}>+ Invite Team Member</button>
            </div>
            <table className="data-table" style={{minWidth:520}}>
              <thead><tr>{["User","Role","School","Last Active","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {[
                  {name:displayName||sUser?.email?.split("@")[0]||"You",role:"Teacher / Coordinator",roleId:"teacher",school:schoolName||"Your School",active:"Now",status:"active"},
                ].map((user,i)=>{
                  const roleData=ROLES.find(r=>r.id===user.roleId)||ROLES[2];
                  return(
                    <tr key={i}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <Avatar name={user.name} size={32}/>
                          <span style={{fontWeight:600,fontSize:13.5,color:C.black}}>{user.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span>{roleData.icon}</span>
                          <span style={{fontSize:13,color:C.black}}>{user.role}</span>
                        </div>
                      </td>
                      <td style={{color:C.warm,fontSize:12.5}}>{user.school}</td>
                      <td style={{color:C.warm,fontSize:12.5}}>{user.active}</td>
                      <td><Badge color={user.status==="active"?"green":"amber"}>{user.status==="active"?"Active":"Pending"}</Badge></td>
                      <td>
                        <div style={{display:"flex",gap:6}}>
                          <button className="btn-ghost" style={{fontSize:11,padding:"5px 12px"}}>Edit</button>
                          <button className="btn-ghost" style={{fontSize:11,padding:"5px 12px"}}>Permissions</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Role Permissions Matrix */}
          <div className="card" style={{padding:"24px 26px"}}>
            <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:16}}>Role Permissions Overview</h3>
            <div style={{overflowX:"auto"}}>
              <table className="data-table" style={{minWidth:640}}>
                <thead><tr>
                  <th>Permission</th>
                  {ROLES.slice(0,5).map(r=><th key={r.id} style={{textAlign:"center"}}><span title={r.label}>{r.icon}</span></th>)}
                </tr></thead>
                <tbody>
                  {[
                    ["View all students","✓","✓","Own","✓","✓"],
                    ["Create / Edit ALPs","✓","✓","✓","✓","—"],
                    ["Export documents","✓","✓","✓","✓","—"],
                    ["View progress reports","✓","✓","—","—","—"],
                    ["Manage users","✓","—","—","—","—"],
                    ["Billing access","✓","—","—","—","—"],
                  ].map(([perm,...vals])=>(
                    <tr key={perm}>
                      <td style={{fontWeight:500,color:C.black}}>{perm}</td>
                      {vals.map((v,i)=>(
                        <td key={i} style={{textAlign:"center",fontSize:14,color:v==="✓"?C.green:v==="—"?C.warm:C.amber,fontWeight:v==="✓"?700:400}}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab==="notifications"&&(
        <NotifPrefsTab save={save} saved={saved}/>
      )}


      {activeTab==="billing"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,marginBottom:20}}>
            {/* Current plan */}
            <div className="card" style={{padding:"28px"}}>
              <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Current Plan</h3>
              <div style={{background:"linear-gradient(135deg,#7C3AED,#6D28D9)",borderRadius:12,padding:"24px",color:"#fff",marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:".1em",opacity:.7,marginBottom:8}}>ACTIVE PLAN</div>
                <div className="serif" style={{fontSize:28,fontWeight:800,marginBottom:4}}>Professional</div>
                <div style={{fontSize:14,opacity:.8,marginBottom:16}}>$9/mo per teacher · Billed monthly</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {["Unlimited students","All AI tools","Director approvals","Priority support"].map(f=>(
                    <span key={f} style={{fontSize:11,background:"rgba(255,255,255,.15)",padding:"3px 10px",borderRadius:99}}>{f}</span>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{color:C.warm}}>Next billing date</span>
                  <span style={{fontWeight:600,color:C.black}}>June 1, 2026</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{color:C.warm}}>Amount</span>
                  <span style={{fontWeight:600,color:C.black}}>$9.00</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{color:C.warm}}>Payment method</span>
                  <span style={{fontWeight:600,color:C.black}}>Visa ···· 4242</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"8px 0"}}>
                  <span style={{color:C.warm}}>Status</span>
                  <span style={{fontWeight:700,color:C.green}}>✓ Active</span>
                </div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button className="btn-ghost" onClick={()=>toast("Switching to annual billing — save 22%!","success")} style={{flex:1,fontSize:11}}>Switch to Annual</button>
                <button className="btn-ghost" onClick={()=>toast("Billing portal opened","info")} style={{flex:1,fontSize:11}}>Update Card</button>
              </div>
            </div>

            {/* Usage */}
            <div className="card" style={{padding:"28px"}}>
              <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Usage This Month</h3>
              {[["Students","38 of unlimited",100],["ALP Plans Built","12",null],["AI Goals Generated","47",null],["Progress Entries","89",null],["Family Messages","23",null],["Documents Stored","8 of unlimited",100]].map(([label,val,pct])=>(
                <div key={label} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:pct?6:0}}>
                    <span style={{color:C.warm}}>{label}</span>
                    <span style={{fontWeight:600,color:C.black}}>{val}</span>
                  </div>
                  {pct&&<div style={{height:4,background:C.tanL,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:C.purple,borderRadius:99}}/></div>}
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade to School plan */}
          <div className="card" style={{padding:"28px",background:"linear-gradient(135deg,#7C3AED11,#A855F711)",border:`1px solid ${C.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
              <div>
                <p className="lbl" style={{marginBottom:4,color:C.purple}}>UPGRADE YOUR PLAN</p>
                <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:4}}>Switch to School or District</h3>
                <p style={{fontSize:13,color:C.warm}}>Add your whole team, get admin dashboards, and school-wide progress reports.</p>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="btn-ghost" onClick={()=>toast("Redirecting to pricing…","info")} style={{fontSize:11}}>View Plans</button>
                <button className="btn-purple" onClick={()=>toast("Our team will contact you shortly!","success")} style={{fontSize:11,padding:"11px 22px"}}>Talk to Sales →</button>
              </div>
            </div>
          </div>

          {/* Billing history */}
          <div className="card" style={{padding:"28px",marginTop:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700}}>Billing History</h3>
              <button className="btn-ghost" style={{fontSize:11}} onClick={()=>toast("Invoice downloaded","info")}>Download All</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <table className="data-table" style={{minWidth:440}}>
                <thead><tr>{["Date","Description","Amount","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {[["May 1, 2026","Professional Plan — Monthly","$9.00","Paid"],["Apr 1, 2026","Professional Plan — Monthly","$9.00","Paid"],["Mar 1, 2026","Professional Plan — Monthly","$9.00","Paid"],["Feb 1, 2026","Professional Plan — Monthly","$9.00","Paid"]].map(([date,desc,amount,status])=>(
                    <tr key={date}>
                      <td style={{color:C.warm,fontSize:12}}>{date}</td>
                      <td style={{fontSize:12}}>{desc}</td>
                      <td style={{fontWeight:600}}>{amount}</td>
                      <td><span style={{color:C.green,fontWeight:700,fontSize:11}}>✓ {status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Page></>
  );
}

// ═══════════════════════════════════════════════════════════
// UPDATED SIDEBAR with Notifications + Settings
// ═══════════════════════════════════════════════════════════
const NAV_FULL=[
  {group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"Students",icon:"👥",badge:"38"}]},
  {group:"ALP BUILDER",items:[{id:"builder",label:"ALP Builder",icon:"✏️",badge:"New"},{id:"quickalp",label:"Quick ALP",icon:"⚡"},{id:"studentprofile",label:"Student Profile",icon:"🪪"},{id:"progress",label:"Progress",icon:"📈"}]},
  {group:"WORKFLOW",items:[{id:"future",label:"Future Readiness",icon:"🎯"},{id:"review",label:"Review Summary",icon:"✅"},{id:"notice",label:"ALP Notice",icon:"⚠️"},{id:"create",label:"Create ALP Doc",icon:"📄"}]},
  {group:"COLLABORATION",items:[{id:"reports",label:"Reports",icon:"📊"}]},
  {group:"ACCOUNT",items:[{id:"notifications",label:"Notifications",icon:"🔔",badge:"3"},{id:"settings",label:"Settings",icon:"⚙️"},{id:"help",label:"Help Center",icon:"❓"},{id:"changelog",label:"What's New",icon:"✨",badge:"v2.4"}]},
];

function SidebarFull({page,setPage,open,setOpen,onGoHome,onSearch,onAddStudent}){
  const {role,roleData,setRole}=useRole();
  const {profile,user:authUser,students:dbStudents,realRole}=useSupabaseAuth();
  const baseNav=NAV_BY_ROLE[role]||NAV_BY_ROLE.teacher;
  // Review Queue visibility is driven by the REAL authenticated role (profile.role),
  // never the cosmetic "preview as" switcher — so a real director always sees it.
  const isRealReviewer=["director","admin"].includes(realRole);
  const hasReviewQueueGroup=baseNav.some(g=>g.items.some(i=>i.id==="reviewqueue"));
  const nav=isRealReviewer&&!hasReviewQueueGroup
    ?[{group:"APPROVALS",items:[{id:"reviewqueue",label:"Review Queue",icon:"👁️",badge:"New"},{id:"compliance",label:"Compliance",icon:"📋"},{id:"auditlog",label:"Audit Log",icon:"🔍"}]},...baseNav]
    :baseNav;
  const baseUser=ROLE_USERS[role]||ROLE_USERS.teacher;
  const user=role==="teacher"
    ?{name:profile?.full_name||authUser?.email?.split("@")[0]||"Teacher",sub:`Student Support · ${profile?.school||"Your School"}`}
    :baseUser;
  const [showRolePicker,setShowRolePicker]=useState(false);
  return(
    <>
      <div className={`sidebar-overlay${open?" open":""}`} onClick={()=>setOpen(false)}/>
      <aside className={`sidebar${open?" open":""}`}>
        <div style={{padding:"20px 18px 14px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:36,height:36,borderRadius:9,objectFit:"cover",flexShrink:0}}/>
            <div><div className="serif" style={{fontSize:14,fontWeight:700,color:C.cream,lineHeight:1}}>ALP</div><div style={{fontSize:8,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".1em",marginTop:1}}>ACCELERATED LEARNING PROGRAM</div></div>
          </div>
          {/* Role indicator */}
          <div style={{marginTop:12,padding:"8px 10px",background:"rgba(255,255,255,.05)",borderRadius:8,border:"1px solid rgba(255,255,255,.08)",cursor:"pointer",transition:"all .15s"}}
            onClick={()=>setShowRolePicker(p=>!p)}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.05)"}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>{roleData.icon}</span>
                <span style={{fontSize:12,fontWeight:700,color:C.cream}}>{roleData.label}</span>
              </div>
              <span style={{fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:700,padding:"1px 6px",borderRadius:4,border:"1px solid rgba(255,255,255,.15)"}}>{showRolePicker?"▲":"▼"}</span>
            </div>
            {showRolePicker&&(
              <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4,borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:10}}>
                {ROLES.map(r=>(
                  <button key={r.id} onClick={e=>{e.stopPropagation();setRole(r.id);setPage("dashboard");setShowRolePicker(false);}}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,background:role===r.id?"rgba(124,58,237,.3)":"transparent",border:"none",cursor:"pointer",width:"100%",textAlign:"left",transition:"background .12s"}}
                    onMouseEnter={e=>{if(role!==r.id)e.currentTarget.style.background="rgba(255,255,255,.08)";}}
                    onMouseLeave={e=>{if(role!==r.id)e.currentTarget.style.background="transparent";}}>
                    <span style={{fontSize:12}}>{r.icon}</span>
                    <span style={{fontSize:11.5,color:role===r.id?"#fff":"rgba(255,255,255,.55)",fontWeight:role===r.id?700:400,flex:1}}>{r.label}</span>
                    {role===r.id&&<span style={{fontSize:9,color:r.color,fontWeight:800}}>●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav style={{flex:1,overflowY:"auto",padding:"14px 10px"}}>
          {nav.map(g=>(
            <div key={g.group} style={{marginBottom:22}}>
              <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:".14em",textTransform:"uppercase",padding:"0 12px 8px"}}>{g.group}</p>
              {g.items.map(item=>(
                <button key={item.label} onClick={()=>setPage(item.id)} className={`nav-item${page===item.id?" active":""}`}>
                  <span style={{fontSize:14,width:18,textAlign:"center",flexShrink:0}}>{item.icon}</span>
                  <span style={{flex:1}}>{item.label}</span>
                  {item.badge&&<span style={{fontSize:9,fontWeight:700,background:item.id==="notifications"?C.red:C.purple,color:"#fff",padding:"2px 7px",borderRadius:99}}>{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,.07)"}}>
          <button onClick={()=>onSearch&&onSearch()} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 8px",borderRadius:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",color:"rgba(255,255,255,.4)",fontSize:11,fontWeight:600,cursor:"pointer",marginBottom:6,justifyContent:"space-between"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.1)";e.currentTarget.style.color="#fff";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";e.currentTarget.style.color="rgba(255,255,255,.4)";}}>
            <span>🔍 Search…</span><div style={{display:"flex",gap:4}}><kbd style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",fontFamily:"monospace"}}>⌘K</kbd><kbd style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",fontFamily:"monospace"}}>?</kbd></div>
          </button>
          <button onClick={onGoHome} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",color:"rgba(255,255,255,.5)",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s",marginBottom:8}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.1)";e.currentTarget.style.color="#fff";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";e.currentTarget.style.color="rgba(255,255,255,.5)";}}>
            <span style={{fontSize:12}}>🏠</span> Back to Website
          </button>
        </div>
        <div style={{padding:"0 16px 14px",display:"flex",alignItems:"center",gap:10}}>
          <Avatar name={user.name} size={32}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:C.cream,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.35)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.sub}</div>
          </div>
          <ThemeToggle style={{width:28,height:28,fontSize:13,borderColor:"rgba(255,255,255,.2)",background:"rgba(255,255,255,.06)"}}/>
          <button onClick={()=>setPage("settings")} style={{color:"rgba(255,255,255,.4)",fontSize:16,border:"none",background:"none",cursor:"pointer"}}>⚙</button>
        </div>
      </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════
function AppInner(){
  const {isDark}=useTheme();
  const {role,setRole}=useRole();
  Object.assign(C,isDark?CD:CL);

  const [screen,setScreen]=useState("landing");
  const [page,setPage]=useState("dashboard");
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [navPage,setNavPage]=useState(null);
  const [showOnboarding,setShowOnboarding]=useState(false);
  const [celebrate,setCelebrate]=useState(false);
  usePageTitle(page, 3);
  useEffect(()=>{try{window.scrollTo({top:0,behavior:"smooth"});}catch{};},[page]);
  // Mobile swipe navigation
  useEffect(()=>{
    let startX=0;
    const handleStart=(e)=>{try{startX=(e.touches&&e.touches[0]&&e.touches[0].clientX)||0;}catch{startX=0;}};
    const handleEnd=(e)=>{
      const endX=(e.changedTouches&&e.changedTouches[0]&&e.changedTouches[0].clientX)||0;
      const diff=startX-endX;
      if(Math.abs(diff)<80)return; // min swipe distance
      // Only swipe on main app pages, not landing/login
      const appPages=["dashboard","students","builder","progress","future","review","notice","create","reports","notifications","settings","help","changelog","goals","documents","timeline","reviewqueue","compliance","auditlog","studentprofile","quickalp"];
      if(!appPages.includes(page))return;
      const idx=appPages.indexOf(page);
      if(diff>0&&idx<appPages.length-1)setPage(appPages[idx+1]); // swipe left → next
      if(diff<0&&idx>0)setPage(appPages[idx-1]); // swipe right → prev
    };
    try{
      document.addEventListener("touchstart",handleStart,{passive:true});
      document.addEventListener("touchend",handleEnd,{passive:true});
    }catch{}
    return()=>{
      try{
        document.removeEventListener("touchstart",handleStart);
        document.removeEventListener("touchend",handleEnd);
      }catch{}
    };
  },[page,setPage]);
  const [isFirstLogin,setIsFirstLogin]=useState(false);
  const [contactType,setContactType]=useState(null);
  const [legalModal,setLegalModal]=useState(null);
  const [showSearch,setShowSearch]=useState(false);
  const [showAIChat,setShowAIChat]=useState(false);
  const [showAddStudent,setShowAddStudent]=useState(false);
  const [showNotes,setShowNotes]=useState(false);
  const [showShortcuts,setShowShortcuts]=useState(false);
  const [showExport,setShowExport]=useState(false);
  const {toast}=useToast();

  // Global keyboard shortcut: Cmd+K for search
  useEffect(()=>{
    function handler(e){
      if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setShowSearch(s=>!s);}
    if(e.key==="?"&&!e.target.matches("input,textarea,select")){setShowShortcuts(s=>!s);}
    if((e.metaKey||e.ctrlKey)&&e.key==="p"){e.preventDefault();try{window.print();}catch{}}
    }
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  async function handleLogin(selectedRole){
    setRole(selectedRole);
    const startPage={related:"progress",intervention:"progress"}[selectedRole]||"dashboard";
    setPage(startPage);
    setScreen("app");
    // Show onboarding for new signups
    if(isFirstLogin){setShowOnboarding(true);setIsFirstLogin(false);}
  }

  function handleSignup(selectedRole){
    setIsFirstLogin(true);
    handleLogin(selectedRole);
  }

  const pages={
    // Role ids now match the user_role enum in the database.
    //
    // "director" routes to LeadershipDashboard, not DirectorDashboard,
    // deliberately: the role id used to be "leadership", so
    // LeadershipDashboard is the view directors have actually been
    // using and it is the slightly richer of the two (academic year,
    // school name). DirectorDashboard was unreachable and stays
    // unreferenced — left in place rather than deleted so nothing is
    // lost, but it is dead code and a candidate for removal.
    dashboard:role==="director"?<LeadershipDashboard setPage={setPage}/>:role==="related"?<RelatedServicesDashboard setPage={setPage}/>:role==="admin"?<AdminDashboard setPage={setPage}/>:role==="intervention"?<InterventionDashboard setPage={setPage}/>:<Dashboard setPage={setPage} onAddStudent={()=>setShowAddStudent(true)}/>,
    students:<Students setPage={setPage} onAddStudent={()=>setShowAddStudent(true)}/>,
    builder:<ALPBuilder setPage={setPage}/>,
    progress:<Progress/>,
    future:<FutureReadiness setPage={setPage}/>,
    review:<ReviewSummary setPage={setPage}/>,
    notice:<ALPNotice setPage={setPage}/>,
    create:<CreateALPDoc setPage={setPage}/>,
    reports:<Reports/>,
    notifications:<Notifications/>,
    settings:<Settings/>,
    help:<HelpCenter/>,
    changelog:<ChangelogPage/>,
    goals:<GoalsPage setPage={setPage}/>,
    documents:<DocumentsPage setPage={setPage}/>,
    timeline:<TimelinePage setPage={setPage}/>,
    studentprofile:<StudentProfile setPage={setPage}/>,
    quickalp:<QuickALP setPage={setPage}/>,
    reviewqueue:<ReviewQueue setPage={setPage}/>,
    compliance:<ComplianceDashboard setPage={setPage}/>,
    auditlog:<AuditLogPage setPage={setPage}/>,
  };
  return(
    <>
      <style>{CSS}</style>
      <CookieBanner/>
      {contactType&&<ContactModal type={contactType} onClose={()=>setContactType(null)}/>}
      {legalModal&&<LegalModal type={legalModal} onClose={()=>setLegalModal(null)}/>}
      {showSearch&&screen==="app"&&<GlobalSearch onClose={()=>setShowSearch(false)} setPage={p=>{setPage(p);setShowSearch(false);}}/>}
      {showAddStudent&&<QuickAddStudentModal onClose={()=>setShowAddStudent(false)} onAdded={()=>setPage("students")}/>}
      {showAIChat&&<AIChatWidget onClose={()=>setShowAIChat(false)}/>}
      {showNotes&&<SessionNotesWidget onClose={()=>setShowNotes(false)}/>}
      {showOnboarding&&<OnboardingModal onClose={()=>setShowOnboarding(false)} setPage={setPage}/>}
      <Confetti active={celebrate}/>
      <CookieBanner/>
      <TopProgressBar page={page}/>
      {showShortcuts&&<KeyboardShortcutsPanel onClose={()=>setShowShortcuts(false)}/>}
      {showExport&&<ExportAllDataModal onClose={()=>setShowExport(false)}/>}
      <OfflineIndicator/>
      <PWAInstallBanner/>
      {screen==="landing"&&<Landing onEnter={()=>setScreen("login")} onSignup={()=>setScreen("signup")} onDemo={()=>setContactType("demo")} navPage={navPage} setNavPage={setNavPage}/>}
      {screen==="login"&&<Login onLogin={handleLogin} onBack={()=>setScreen("landing")}/>}
      {screen==="signup"&&<SignUp onLogin={handleSignup} onBack={()=>setScreen("login")}/>}
      {screen==="404"&&<NotFound onHome={()=>setScreen("landing")}/>}
      {screen==="app"&&
        <div style={{display:"flex",minHeight:"100vh"}}>
          {showOnboarding&&<OnboardingModal onClose={()=>setShowOnboarding(false)} role={role}/>}
          <SidebarFull page={page} setPage={p=>{setPage(p);setSidebarOpen(false);}} open={sidebarOpen} setOpen={setSidebarOpen} onGoHome={()=>{setScreen("landing");setNavPage(null);}} onSearch={()=>setShowSearch(true)} onAddStudent={()=>setShowAddStudent(true)}/>
          <div className="app-main">
            <div className="mobile-topbar" style={{display:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:28,height:28,borderRadius:7,objectFit:"cover"}}/>
                <span style={{fontSize:14,fontWeight:700,fontFamily:"'Playfair Display',serif",color:"var(--text-primary)"}}>ALP</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <ThemeToggle/>
                <div className={`hamburger${sidebarOpen?" open":""}`} onClick={()=>setSidebarOpen(o=>!o)}>
                  <span/><span/><span/>
                </div>
              </div>
            </div>
            {pages[page]||pages.dashboard}
            {/* Mobile bottom nav */}
            <div className="mobile-bottom-nav">
              {[["⊞","Home","dashboard"],["👥","Students","students"],["✏️","Builder","builder"],["📈","Progress","progress"],["⚙️","Settings","settings"]].map(([icon,label,id])=>(
                <button key={id} onClick={()=>setPage(id)} className={`mobile-nav-btn${page===id?" active":""}`}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {/* Floating buttons */}
            {!showAIChat&&!showNotes&&<>
              <button className="fab" onClick={()=>setShowNotes(true)} title="Quick Session Note" style={{bottom:96,width:44,height:44,fontSize:18,background:"linear-gradient(135deg,#1a1a2e,#16213e)"}}>
                📝
              </button>
              <button className="fab" onClick={()=>setShowAIChat(true)} title="ALP AI Assistant" style={{bottom:28}}>
                ✦
              </button>
            </>}
            {showAIChat&&<button className="fab" onClick={()=>setShowAIChat(false)} style={{bottom:28}}>×</button>}
            {showNotes&&<button className="fab" onClick={()=>setShowNotes(false)} style={{bottom:96,width:44,height:44,fontSize:18,background:"linear-gradient(135deg,#1a1a2e,#16213e)"}}>×</button>}
            <div style={{padding:"0 36px 80px",maxWidth:1100,margin:"0 auto"}}>
              <hr className="rule" style={{marginBottom:20}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.tan}}>
                <span>© 2026 ALP Platform Inc. All rights reserved.</span>
                <span>Built by <a href="https://www.stanparaclete.com" target="_blank" rel="noopener noreferrer" style={{color:C.purple,fontWeight:700,textDecoration:"none"}}>Stan Paraclete</a> · <a href="https://www.stanparaclete.com" target="_blank" rel="noopener noreferrer" style={{color:C.warm,textDecoration:"none"}}>stanparaclete.com</a> · <a href="https://www.growwithalp.com" target="_blank" rel="noopener noreferrer" style={{color:C.warm,textDecoration:"none"}}>growwithalp.com</a> · v2.4.1</span>
              </div>
            </div>
          </div>
        </div>
      }
    </>
  );
}


// ═══════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  componentDidCatch(error,info){console.error("ALP Error:",error,info);}
  render(){
    if(this.state.hasError){
      return(
        <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f9f7f4",padding:32}}>
          <div style={{textAlign:"center",maxWidth:480}}>
            <div style={{fontSize:56,marginBottom:16}}>⚠️</div>
            <h2 style={{fontSize:24,fontWeight:700,color:"#1a1a2e",marginBottom:10}}>Something went wrong</h2>
            <p style={{fontSize:14,color:"#6b7280",lineHeight:1.7,marginBottom:24}}>
              An unexpected error occurred. Your data is safe.
            </p>
            <button onClick={()=>this.setState({hasError:false,error:null})}
              style={{padding:"12px 32px",borderRadius:99,background:"#7C3AED",color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PrivacyPage({setPage,setNavPage}){
  const {isMobile}=useResponsive();
  const sections=[
    {id:"collect",title:"What we collect",icon:"📋",content:`When you create an ALP account we collect:

• Your name, work email address, and school name
• Your role (e.g. teacher, director, related services)
• Student records you enter — names, year groups, disability areas, goals, and progress data
• Usage data — which features you use and when (no personal content)
• Device and browser type for troubleshooting

We do NOT collect: student social security numbers, financial information, photos (unless you upload them), or anything beyond what is needed to run the platform.`},
    {id:"use",title:"How we use it",icon:"🔍",content:`We use your data to:

• Run the ALP platform and provide the features you pay for
• Send you notifications about your account (review reminders, progress alerts)
• Improve the platform based on how features are used (aggregated, never individual)
• Respond to your support requests
• Send you product updates (you can opt out at any time)

We do NOT: sell your data, share it with advertisers, use student data to train AI models, or use it for any purpose other than running ALP.`},
    {id:"storage",title:"Where data is stored",icon:"🗄️",content:`Your data is stored on Supabase (PostgreSQL), hosted on AWS infrastructure in the EU (Dublin) region by default. Schools in other regions can request data residency options.

All data is:
• Encrypted at rest (AES-256)
• Encrypted in transit (TLS 1.3)
• Backed up daily with 30-day retention
• Accessible only to authenticated users

Student data is separated by school — teachers only see students assigned to them.`},
    {id:"sharing",title:"Who we share with",icon:"🤝",content:`We share data only with services needed to run ALP:

• Supabase — database and authentication
• Anthropic — AI features only (goal generation, chat). Only the text you type is sent. No student names or identifying information is included unless you type it yourself.
• Netlify — hosting and content delivery

We do NOT share your data with: other schools, third-party marketing companies, data brokers, or any party not listed here.

All third-party providers are bound by data processing agreements.`},
    {id:"rights",title:"Your rights",icon:"✋",content:`You have the right to:

• Access all data we hold about you — email privacy@growwithalp.com
• Correct inaccurate data at any time (directly in the app)
• Delete your account and all associated data (Settings → Danger Zone, or email us)
• Export your school's data at any time (Reports → Export All Data)
• Object to how we process your data

Student data belongs to the school. Schools can request full deletion of all student records by emailing us. We will complete deletion within 30 days.`},
    {id:"retention",title:"How long we keep it",icon:"🗓",content:`• Active accounts: data kept for as long as your subscription is active
• Cancelled accounts: data kept for 90 days, then permanently deleted
• Progress and goal data: kept for the duration of the student's enrolment at your school
• Audit logs: kept for 12 months
• Backups: automatically purged after 30 days

You can delete individual student records at any time directly in the app.`},
    {id:"security",title:"How we protect it",icon:"🔒",content:`Security measures in place:

• Row-level security — each user only sees their own school's data
• Role-based access — teachers, directors, and admins have different permissions
• Encrypted passwords — we never store plain-text passwords
• Session management — automatic logout after inactivity
• Regular security reviews — conducted quarterly
• Vulnerability disclosure — report issues to security@growwithalp.com

We do not claim to be perfect. If a breach occurs, we will notify affected users within 72 hours.`},
    {id:"cookies",title:"Cookies",icon:"🍪",content:`We use:

• Essential cookies: required for login sessions to work
• Preference cookies: remember your theme and settings (you can disable these)

We do NOT use: advertising cookies, tracking pixels, or any cookie that shares data with third parties.

You can manage cookies in your browser settings. Disabling essential cookies will prevent you from logging in.`},
    {id:"contact",title:"Contact us",icon:"📧",content:`Privacy questions: privacy@growwithalp.com
Security issues: security@growwithalp.com
Data deletion requests: privacy@growwithalp.com
General: hello@growwithalp.com

ALP Platform is operated by Stan Paraclete.
We aim to respond to all privacy enquiries within 5 business days.`},
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg}}>
      {/* Header */}
      <div style={{background:"#0B0718",padding:"60px 24px 48px",textAlign:"center"}}>
        <p style={{fontSize:11,fontWeight:700,letterSpacing:".14em",color:"#A78BFA",marginBottom:12}}>LEGAL</p>
        <h1 className="serif" style={{fontSize:isMobile?32:44,fontWeight:800,color:"#fff",letterSpacing:"-.016em",marginBottom:14}}>Privacy Policy</h1>
        <p style={{fontSize:15,color:"rgba(255,255,255,.5)",maxWidth:520,margin:"0 auto 16px"}}>Plain English. No legal jargon. We believe you deserve to know exactly what we do with your data.</p>
        <p style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Last updated: May 2026 · Effective immediately</p>
      </div>

      <div style={{maxWidth:760,margin:"0 auto",padding:"48px 24px"}}>
        {/* Principles box */}
        <div style={{background:"linear-gradient(135deg,#7C3AED12,#A855F712)",border:`1px solid ${C.purple}30`,borderRadius:16,padding:"24px 28px",marginBottom:40}}>
          <h2 style={{fontSize:18,fontWeight:700,color:C.black,marginBottom:12}}>Our commitment in plain terms</h2>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
            {[["✅","Your data is yours — we are custodians, not owners"],["✅","We never sell student data. Ever."],["✅","You can export or delete everything, any time"],["✅","AI features never see student names or IDs"],["✅","We tell you if something goes wrong"],["✅","No compliance claims we cannot back up"]].map(([ic,text])=>(
              <div key={text} style={{display:"flex",gap:8,fontSize:13,color:C.black}}>
                <span style={{flexShrink:0}}>{ic}</span>{text}
              </div>
            ))}
          </div>
        </div>

        {/* Sections */}
        {sections.map((s,i)=>(
          <div key={s.id} style={{marginBottom:36,paddingBottom:36,borderBottom:i<sections.length-1?`1px solid ${C.tanL}`:"none"}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
              <span style={{fontSize:24,flexShrink:0}}>{s.icon}</span>
              <h2 style={{fontSize:20,fontWeight:700,color:C.black,margin:0}}>{s.title}</h2>
            </div>
            <div style={{fontSize:14,color:C.warm,lineHeight:1.85,whiteSpace:"pre-line",paddingLeft:36}}>{s.content}</div>
          </div>
        ))}

        {/* Footer nav */}
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",paddingTop:32,borderTop:`1px solid ${C.tanL}`}}>
          <button className="btn-ghost" onClick={()=>setNavPage("Terms")} style={{fontSize:12}}>Terms of Service</button>
          <button className="btn-ghost" onClick={()=>setNavPage("Data")} style={{fontSize:12}}>Data & Security</button>
          <button className="btn-purple" onClick={()=>setPage("dashboard")} style={{fontSize:12}}>← Back to Home</button>
        </div>
      </div>
    </div>
  );
}

function TermsPage({setPage,setNavPage}){
  const {isMobile}=useResponsive();
  const sections=[
    {title:"What ALP is",content:`ALP (Accelerated Learning Plan) is a software platform that helps special education teachers plan, track, and communicate student support programmes.

ALP is a TOOL — it helps you do your job. It does not replace professional judgement, legal obligations, or official processes. Decisions about student support plans remain entirely with the qualified professionals and institutions using the platform.`},
    {title:"Who can use ALP",content:`ALP is for:
• Qualified special education teachers and coordinators
• School administrators and leadership teams
• Related services professionals (SLPs, OTs, PTs)
• School districts and NGOs operating educational programmes

ALP is not for use by students directly or by parents/guardians without a school account managed by a qualified educator.

You must be 18 or older to create an account. Schools are responsible for ensuring their staff who access ALP are authorised to do so.`},
    {title:"What we provide",content:`We provide:
• Access to the ALP platform as described on our pricing page
• Data storage for student records you create in the platform
• AI-assisted features (goal generation, progress chat)
• Email and in-app support during business hours
• 99.5% uptime target (excluding scheduled maintenance)

We do NOT provide:
• Legal compliance certification of any kind
• Guarantee that any goal or plan generated meets regulatory requirements in your jurisdiction
• Professional advice — all content is informational
• Warranty that the platform is error-free`},
    {title:"Your responsibilities",content:`By using ALP you agree to:

• Only enter data for students under your professional care and with appropriate authorisation
• Maintain the confidentiality of your login credentials
• Not share accounts between multiple people
• Not use ALP to process data for purposes other than educational support planning
• Comply with your own school's data policies and local legal requirements
• Ensure any student data you enter is accurate and kept up to date
• Notify us immediately if you believe your account has been compromised`},
    {title:"Data and privacy",content:`Student data entered into ALP belongs to your school. We are a data processor; you are the data controller.

We store and process data according to our Privacy Policy. We do not claim FERPA, GDPR, or any specific regulatory compliance — that is your responsibility as the data controller.

What we DO commit to:
• Encryption at rest and in transit
• Role-based access control
• No selling or sharing of your data
• Data deletion within 30 days of written request
• Notification within 72 hours if a data breach occurs that affects your account`},
    {title:"Payments and cancellation",content:`Subscriptions are billed monthly or annually depending on your plan. Prices are listed on our pricing page.

• Monthly plans: cancel any time, no refund for the current month
• Annual plans: cancel any time, prorated refund for unused months (after 30 days)
• School/district plans: governed by your signed agreement

We reserve the right to change pricing with 60 days written notice. Existing annual subscribers are not affected until renewal.`},
    {title:"Limitation of liability",content:`ALP is provided "as is." We are not liable for:

• Any educational decisions made based on ALP content or AI suggestions
• Loss of data due to user error (though we maintain backups)
• Failure to meet regulatory requirements in your jurisdiction
• Indirect, consequential, or punitive damages

Our total liability to you in any 12-month period is limited to the amount you paid us in that period.

This does not affect statutory rights you may have under the laws of your country.`},
    {title:"Changes to these terms",content:`We may update these terms. If we make significant changes we will:
• Email you at least 30 days before the change takes effect
• Show a notice when you next log in
• Keep the previous version available for reference

Continued use of ALP after the effective date means you accept the new terms.`},
    {title:"Contact",content:`Questions about these terms: legal@growwithalp.com
Disputes: hello@growwithalp.com

We prefer to resolve any issue directly and fairly before any formal process.`},
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg}}>
      <div style={{background:"#0B0718",padding:"60px 24px 48px",textAlign:"center"}}>
        <p style={{fontSize:11,fontWeight:700,letterSpacing:".14em",color:"#A78BFA",marginBottom:12}}>LEGAL</p>
        <h1 className="serif" style={{fontSize:isMobile?32:44,fontWeight:800,color:"#fff",letterSpacing:"-.016em",marginBottom:14}}>Terms of Service</h1>
        <p style={{fontSize:15,color:"rgba(255,255,255,.5)",maxWidth:520,margin:"0 auto 16px"}}>Straightforward terms. We have tried to make these readable. If something is unclear, email us.</p>
        <p style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Last updated: May 2026</p>
      </div>

      <div style={{maxWidth:760,margin:"0 auto",padding:"48px 24px"}}>
        {/* Summary box */}
        <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:16,padding:"20px 24px",marginBottom:40}}>
          <h3 style={{fontSize:15,fontWeight:700,color:"#92400E",marginBottom:8}}>⚠️ The most important thing</h3>
          <p style={{fontSize:13,color:"#92400E",lineHeight:1.7,margin:0}}>ALP is a planning and tracking tool. It does not certify that your programmes meet any legal standard. Compliance with special education laws in your country is your responsibility. We help you do the work — the professional accountability stays with you.</p>
        </div>

        {sections.map((s,i)=>(
          <div key={i} style={{marginBottom:36,paddingBottom:36,borderBottom:i<sections.length-1?`1px solid ${C.tanL}`:"none"}}>
            <h2 style={{fontSize:19,fontWeight:700,color:C.black,marginBottom:12}}>{i+1}. {s.title}</h2>
            <div style={{fontSize:14,color:C.warm,lineHeight:1.85,whiteSpace:"pre-line"}}>{s.content}</div>
          </div>
        ))}

        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",paddingTop:32,borderTop:`1px solid ${C.tanL}`}}>
          <button className="btn-ghost" onClick={()=>setNavPage("Privacy")} style={{fontSize:12}}>Privacy Policy</button>
          <button className="btn-ghost" onClick={()=>setNavPage("Data")} style={{fontSize:12}}>Data & Security</button>
          <button className="btn-purple" onClick={()=>setPage("dashboard")} style={{fontSize:12}}>← Back to Home</button>
        </div>
      </div>
    </div>
  );
}

function DataPage({setPage,setNavPage}){
  const {isMobile}=useResponsive();
  const measures=[
    {icon:"🔐",title:"Encryption everywhere",body:"All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Passwords are hashed with bcrypt — we never store them in plain text. Your Supabase API keys are never exposed in the browser bundle."},
    {icon:"👥",title:"Row-level security",body:"Every database query is filtered at the database level. Teachers only see their own students. Admins only see their school. No code change can accidentally expose another school's data — the database enforces it."},
    {icon:"🎭",title:"Role-based access",body:"Eight distinct roles (Teacher, Director, Admin, SLP, Student, Family, Intervention, Leadership) each have different permissions. A teacher cannot access reports only directors should see, even if they guess the URL."},
    {icon:"📡",title:"Realtime safely",body:"Live notifications use Supabase Realtime with authenticated channels. You only receive events for records you are authorised to access. WebSocket connections are closed when you sign out."},
    {icon:"🤖",title:"AI data handling",body:"AI features (Goal Architect, AI Chat) send only the text you type to Anthropic's API. No student names, IDs, or records are automatically included. We never use your data to train AI models. Anthropic processes requests and does not retain them."},
    {icon:"💾",title:"Backups and recovery",body:"Data is backed up daily. Backups are retained for 30 days and stored in a separate AWS region from your primary data. In the event of data loss, we target recovery within 4 hours."},
    {icon:"🔍",title:"Audit logs",body:"Every significant data action (create, update, delete) is logged with timestamp, user ID, and what changed. Logs are retained for 12 months. School admins can request their audit log at any time."},
    {icon:"🚨",title:"Incident response",body:"If a security incident occurs affecting your data, we will notify you by email within 72 hours. We will tell you what happened, what data was affected, and what we are doing about it. We will not hide incidents."},
    {icon:"🧪",title:"Security reviews",body:"We conduct quarterly internal security reviews. We welcome responsible disclosure — if you find a vulnerability, please email security@growwithalp.com before publishing. We commit to responding within 5 business days."},
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg}}>
      <div style={{background:"#0B0718",padding:"60px 24px 48px",textAlign:"center"}}>
        <p style={{fontSize:11,fontWeight:700,letterSpacing:".14em",color:"#A78BFA",marginBottom:12}}>TRUST & SECURITY</p>
        <h1 className="serif" style={{fontSize:isMobile?32:44,fontWeight:800,color:"#fff",letterSpacing:"-.016em",marginBottom:14}}>Data & Security</h1>
        <p style={{fontSize:15,color:"rgba(255,255,255,.5)",maxWidth:540,margin:"0 auto 16px"}}>We handle some of the most sensitive data in education. Here is exactly how we protect it — no marketing, just specifics.</p>
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:"48px 24px"}}>
        {/* No compliance claims notice */}
        <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:16,padding:"20px 24px",marginBottom:40}}>
          <h3 style={{fontSize:15,fontWeight:700,color:"#166534",marginBottom:8}}>✅ What we commit to (and what we don't)</h3>
          <p style={{fontSize:13,color:"#15803D",lineHeight:1.7,margin:0}}>
            We do not claim FERPA, GDPR, HIPAA, or any specific regulatory certification — earning those requires third-party audits we have not completed yet. What we DO commit to are the specific technical and operational measures below. These are real, verifiable things we have built. Compliance with local education data laws remains the responsibility of the school using ALP.
          </p>
        </div>

        {/* Security measures grid */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:40}}>
          {measures.map(m=>(
            <div key={m.title} className="card" style={{padding:"20px 22px"}}>
              <span style={{fontSize:28}}>{m.icon}</span>
              <h3 style={{fontSize:14,fontWeight:700,color:C.black,margin:"10px 0 8px"}}>{m.title}</h3>
              <p style={{fontSize:13,color:C.warm,lineHeight:1.7,margin:0}}>{m.body}</p>
            </div>
          ))}
        </div>

        {/* Data processing agreement */}
        <div style={{background:C.purpleL,borderRadius:16,padding:"28px 32px",marginBottom:40,textAlign:"center"}}>
          <h2 style={{fontSize:22,fontWeight:700,color:C.black,marginBottom:10}}>Data Processing Agreement</h2>
          <p style={{fontSize:14,color:C.warm,lineHeight:1.7,maxWidth:480,margin:"0 auto 20px"}}>Schools that need a formal Data Processing Agreement (DPA) for procurement can request one. The DPA documents our obligations as data processor under your school's data governance framework.</p>
          <a href="mailto:legal@growwithalp.com?subject=DPA Request" style={{display:"inline-block",padding:"12px 28px",background:C.purple,color:"#fff",borderRadius:99,fontSize:13,fontWeight:700,textDecoration:"none"}}>📄 Request a DPA →</a>
        </div>

        {/* Infrastructure */}
        <div className="card" style={{padding:"24px 28px",marginBottom:40}}>
          <h2 style={{fontSize:18,fontWeight:700,color:C.black,marginBottom:16}}>Infrastructure</h2>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:16}}>
            {[["🗄️","Database","PostgreSQL via Supabase. Row-level security enforced at DB layer."],["🌐","Hosting","Netlify CDN. Global edge network. Automatic HTTPS."],["☁️","Cloud","AWS EU-West-1 (Dublin) primary. Data does not leave the EU by default."],["🔑","Auth","Supabase Auth. JWT tokens. Automatic refresh. Secure HTTP-only cookies."],["🤖","AI","Anthropic API (claude-sonnet). No data retention by Anthropic."],["📊","Monitoring","Uptime monitoring with instant alerting. Target: 99.5% uptime."]].map(([ic,label,desc])=>(
              <div key={label} style={{padding:"14px",background:C.bg,borderRadius:10}}>
                <div style={{fontSize:22,marginBottom:6}}>{ic}</div>
                <div style={{fontSize:12,fontWeight:700,color:C.black,marginBottom:4}}>{label}</div>
                <div style={{fontSize:11,color:C.warm,lineHeight:1.5}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",paddingTop:16}}>
          <button className="btn-ghost" onClick={()=>setNavPage("Privacy")} style={{fontSize:12}}>Privacy Policy</button>
          <button className="btn-ghost" onClick={()=>setNavPage("Terms")} style={{fontSize:12}}>Terms of Service</button>
          <a href="mailto:security@growwithalp.com" style={{fontSize:12,padding:"10px 18px",borderRadius:99,background:C.tanL,color:C.black,textDecoration:"none",fontWeight:600}}>Report a vulnerability</a>
          <button className="btn-purple" onClick={()=>setPage("dashboard")} style={{fontSize:12}}>← Back to Home</button>
        </div>
      </div>
    </div>
  );
}

export default function App(){
  return(
    <ThemeProvider>
      <RoleProvider>
        <SupabaseAuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <AppInner/>
            </ErrorBoundary>
          </ToastProvider>
        </SupabaseAuthProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}

// This file intentionally ends here.
// All assets are in /public/assets/
// ALP Logo: /public/assets/logos/alp-logo.png
// Reference images: /public/assets/images/
