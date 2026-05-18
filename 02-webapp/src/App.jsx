import { useState, useEffect, useContext, createContext } from "react";

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
  --bg-primary:#F8F7FF;
  --bg-secondary:#FFFFFF;
  --bg-card:#FFFFFF;
  --bg-surface:rgba(109,40,217,.05);
  --bg-hover:rgba(109,40,217,.08);
  --text-primary:#1A0A2E;
  --text-secondary:#6B5B8A;
  --text-muted:#9B8AB0;
  --border:#e5e7eb;
  --border-purple:rgba(109,40,217,.18);
  --shadow-card:0 1px 2px rgba(0,0,0,.06),0 2px 8px rgba(0,0,0,.04);
  --shadow-hover:0 8px 28px rgba(109,40,217,.15);
  --shadow-glow:0 0 0 3px rgba(109,40,217,.12);
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
  .r-compliance-grid{grid-template-columns:repeat(2,1fr)!important}
  .r-3col{grid-template-columns:1fr!important}
  .r-2col{grid-template-columns:1fr!important}
  .r-hero-section{padding:48px 20px 40px!important}
}
@media(max-width:480px){
  .r-platform-grid{grid-template-columns:1fr!important}
  .r-feat-grid{grid-template-columns:1fr!important}
  .r-compliance-grid{grid-template-columns:1fr!important}
}

`;

// ─── LIGHT COLORS ──────────────────────────────────────────
const CL = {
  cream:"#ffffff",white:"#FFFFFF",black:"#111111",
  tan:"#d1d5db",tanL:"#e5e7eb",warm:"#6b7280",
  purple:"#7C3AED",purpleL:"#EDE9FE",purpleD:"#6D28D9",
  green:"#16A34A",greenBg:"#F0FDF4",greenBd:"#BBF7D0",
  amber:"#D97706",amberBg:"#FFFBEB",amberBd:"#FDE68A",
  red:"#DC2626",redBg:"#FEF2F2",redBd:"#FECACA",
  blue:"#2563EB",blueBg:"#EFF6FF",blueBd:"#BFDBFE",
};
// ─── DARK COLORS ───────────────────────────────────────────
const CD = {
  cream:"#F0EEFF",white:"#1B1333",black:"#F0EEFF",
  tan:"rgba(240,238,255,.2)",tanL:"rgba(139,92,246,.22)",warm:"rgba(240,238,255,.5)",
  purple:"#8B5CF6",purpleL:"rgba(139,92,246,.18)",purpleD:"#7C3AED",
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
    const h=()=>setW(window.innerWidth);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
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
  {id:"leadership",  label:"School Leadership",     icon:"👔",  color:"#2563EB", badge:"LEAD",     desc:"School-wide oversight · Staff · Compliance"},
  {id:"teacher",     label:"Special Ed Teacher",    icon:"👩‍🏫", color:"#7C3AED", badge:"TEACHER",  desc:"Caseload · ALP Builder · Progress monitoring"},
  {id:"intervention",label:"Intervention Specialist",icon:"📊", color:"#D97706", badge:"RTI",      desc:"RTI tiers · Intervention plans · CBM data"},
  {id:"related",     label:"Related Services",      icon:"🩺",  color:"#16A34A", badge:"SERVICES", desc:"SLP · OT · PT · Session notes · Goal progress"},
  {id:"family",      label:"Family / Parent",       icon:"❤️",  color:"#EC4899", badge:"FAMILY",   desc:"Messages · Progress · Signatures · Meetings"},
  {id:"student",     label:"Student",               icon:"🎓",  color:"#0891B2", badge:"STUDENT",  desc:"My ALP · My Goals · My Progress"},
];

const RoleCtx = createContext({role:"teacher", roleData:ROLES[2], setRole:()=>{}});

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
  const [loading,setLoading]=useState(false);
  const [goals,setGoals]=useState([]);
  const [selected,setSelected]=useState([]);
  const [err,setErr]=useState(null);
  async function generate(){
    setLoading(true);setErr(null);setGoals([]);setSelected([]);
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1400,messages:[{role:"user",content:`Write 3 SMART annual goals for ${student.name}, Grade ${student.grade}, with ${student.disability}, for ${domain}. Baseline: ${baseline||"below grade level"}. Return ONLY JSON:\n[{"goalText":"By [Month Year], [Name] will [behavior] with [criterion], as measured by [method].","baseline":"level","target":"endpoint","monitoring":"Weekly|Monthly|Quarterly"}]`}]})});
      const d=await r.json();
      const m=(d.content?.[0]?.text||"[]").match(/\[[\s\S]*\]/);
      setGoals(m?JSON.parse(m[0]):[]);
    }catch{setErr("Connection error. Check your network and try again.");}
    setLoading(false);
  }
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:"100%",maxWidth:560,maxHeight:"88vh",overflowY:"auto",padding:0}}>
        <div style={{padding:"28px 32px 24px",borderBottom:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <p className="lbl" style={{marginBottom:10,color:C.purple}}>ALP AI Intelligence Suite</p>
            <h2 className="serif" style={{fontSize:28,fontWeight:700,lineHeight:1.1}}>ALP Goal <span className="serif-italic" style={{color:C.warm}}>Architect.</span></h2>
            <p style={{fontSize:13,color:C.warm,marginTop:5}}>{student.name} · Grade {student.grade} · {student.disability}</p>
          </div>
          <button onClick={onClose} style={{fontSize:22,color:C.warm,padding:4,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:32}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:28}}>
            <USelect label="Goal Domain" value={domain} onChange={e=>setDomain(e.target.value)} options={[{value:"READING",label:"Reading"},{value:"MATH",label:"Math"},{value:"WRITING",label:"Writing"},{value:"COMMUNICATION",label:"Communication"},{value:"SOCIAL_EMOTIONAL",label:"Social-Emotional"},{value:"BEHAVIOR",label:"Behavior"}]}/>
            <UInput label="Current Baseline" value={baseline} onChange={e=>setBaseline(e.target.value)} placeholder="e.g. 52 wcpm"/>
          </div>
          <button className="btn-black" onClick={generate} disabled={loading} style={{width:"100%",padding:"15px",marginBottom:24}}>{loading?<><Spin/>Generating with Claude…</>:"✦  Generate 3 SMART Goals"}</button>
          {err&&<div style={{background:C.redBg,borderRadius:10,padding:14,marginBottom:20,fontSize:13,color:C.red}}>{err}</div>}
          {goals.length>0&&<>
            <hr className="rule" style={{marginBottom:20}}/>
            <p className="lbl" style={{marginBottom:16}}>Select goals to add to ALP</p>
            {goals.map((g,i)=>{
              const sel=selected.includes(i);
              return(<div key={i} onClick={()=>setSelected(p=>sel?p.filter(x=>x!==i):[...p,i])} style={{border:`1.5px solid ${sel?C.purple:C.tanL}`,background:sel?"#FAF8FF":C.white,borderRadius:12,padding:20,marginBottom:12,cursor:"pointer",transition:"all .15s"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span className="lbl" style={{color:sel?C.purple:C.warm}}>Goal {i+1}</span>{sel&&<span style={{fontSize:12,color:C.purple,fontWeight:700}}>✓ Selected</span>}</div>
                <p style={{fontSize:14,color:C.black,lineHeight:1.7,marginBottom:12}}>{g.goalText}</p>
                <div style={{display:"flex",gap:20,fontSize:12,color:C.warm,flexWrap:"wrap"}}><span>Baseline: <b style={{color:C.black}}>{g.baseline}</b></span><span>Target: <b style={{color:C.black}}>{g.target}</b></span><span>Monitor: <b style={{color:C.black}}>{g.monitoring}</b></span></div>
              </div>);
            })}
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <button className="btn-outline" onClick={onClose} style={{flex:1}}>Cancel</button>
              <button className="btn-purple" onClick={()=>{selected.forEach(i=>onAdd(goals[i],domain));onClose();}} disabled={!selected.length} style={{flex:1}}>Add {selected.length||""} Goal{selected.length!==1?"s":""}</button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─── DOWNLOAD MODAL (from page 6 of prototype) ─────────────────
function DownloadModal({onClose}){
  const platforms=[
    {svg:<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 88 88"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203z" fill="#F35325"/><path d="M39.996 6.86L87.314 0v41.745l-47.318.376z" fill="#81BC06"/><path d="M35.67 45.471l.028 34.453L0 75.48V45.268z" fill="#05A6F0"/><path d="M39.996 46.06l47.318-.376V88l-47.318-7.62z" fill="#FFBA08"/></svg>,label:"Windows",sub:"Windows 10 / 11 · 64-bit",btn:"Download .exe"},
    {svg:<img src="/assets/images/apple-logo.png" alt="macOS" style={{width:48,height:48,objectFit:"contain"}}/>,label:"macOS",sub:"macOS 12+ · Universal",btn:"Download .dmg"},
    {svg:<img src="/assets/images/linux-logo.png" alt="Linux" style={{width:48,height:48,objectFit:"contain"}}/>,label:"Linux",sub:"Ubuntu / Debian · .deb",btn:"Download .deb"},
  ];
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fade-up" style={{background:"#0D0B1F",border:"1px solid rgba(124,58,237,.3)",borderRadius:20,padding:"40px 36px",width:"100%",maxWidth:560,textAlign:"center",boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
        <div style={{width:60,height:60,background:"linear-gradient(135deg,rgba(124,58,237,.4),rgba(124,58,237,.1))",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 18px",border:"1px solid rgba(124,58,237,.3)"}}>🖥</div>
        <h2 style={{fontSize:26,fontWeight:800,color:"#fff",marginBottom:6,letterSpacing:"-.5px"}}>Download ALP Desktop</h2>
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
          <p style={{fontSize:12,color:"rgba(255,255,255,.4)",lineHeight:1.6}}>✓ Free forever for individual teachers &nbsp;·&nbsp; ✓ Offline access &nbsp;·&nbsp; ✓ Auto-updates &nbsp;·&nbsp; ✓ Sync across devices</p>
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
function SubNav({active,setNavPage,onEnter}){
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
        <button className="btn-purple landing-nav-desktop" onClick={onEnter} style={{fontSize:11,padding:"8px 16px"}}>Sign Up Free</button>
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
          <button className="btn-purple" onClick={()=>{onEnter();setMobileOpen(false);}} style={{flex:1,fontSize:12}}>Sign Up Free</button>
        </div>
      </div>
    )}
    </>
  );
}

function PageFooter(){
  return(
    <div style={{padding:"clamp(16px,3vw,24px) clamp(20px,5vw,48px)",borderTop:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",fontSize:11,color:C.warm}}>
      <span>© 2026 ALP Platform Inc. All rights reserved.</span>
      <span>Built by <b style={{color:C.black}}>Stan Paraclete</b> · www.stanparaclete.com · growwithalp.com</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FEATURES PAGE — ALP Platform
// ═══════════════════════════════════════════════════════════════════
function FeaturesPage({setNavPage,onEnter}){
  const aiTools=[
    {icon:"✏️",name:"ALP Goal Architect",desc:"Design precise, measurable annual goals from baseline data — instantly. The Goal Architect generates 3 SMART goal options per domain, covering reading, math, communication, behavior, motor, and transition. Built for every age from birth to 22+."},
    {icon:"📝",name:"ALP Present Levels Coach",desc:"Write present levels that are clear, objective, and parent-friendly — every time. Paste your draft and the ALP Present Levels Coach reviews it, flags weak language, and rewrites it to meet compliance standards in every framework."},
    {icon:"🧠",name:"ALP Behaviour Blueprint",desc:"Turn any behavioral concern into a structured, evidence-based intervention plan. Enter the behavior and context — the Behaviour Blueprint generates antecedents, replacement behaviors, reinforcement strategies, and staff protocols in under 2 minutes."},
    {icon:"📊",name:"ALP Progress Probe Generator",desc:"Generate custom CBM assessments aligned directly to each student's ALP goals — reading fluency, math computation, writing, or behavior. Produce grade-level or below-grade probes instantly. No worksheets to search for, ever again."},
    {icon:"🎯",name:"ALP Learner Profile Builder",desc:"Build a comprehensive profile of how each student's learning differences impact their access to the curriculum. The Learner Profile Builder produces a structured, compliant narrative — ready to share with all staff and to anchor the whole ALP."},
    {icon:"📚",name:"ALP Reading Adapter",desc:"Take any text — a textbook passage, a news article, a story — and adapt it instantly to any reading level. The Reading Adapter preserves the content and interest while making it accessible for every learner on your caseload."},
    {icon:"⚡",name:"ALP Intervention Planner",desc:"Build targeted, evidence-based interventions for Tier 1, 2, and 3 learners — in seconds. The Intervention Planner produces structured plans for reading, math, writing, behavior, and social-emotional learning, tailored to each student's specific profile."},
    {icon:"🗂",name:"ALP Lesson Differentiator",desc:"Generate differentiated lesson plans for any curriculum topic — with built-in modifications for every learner on your caseload. Bloom's Taxonomy scaffolding, sensory accommodations, and extension tasks included. Empower every teacher in your school."},
  ];
  const caseTools=[
    {icon:"📋",name:"ALP Caseload Command",desc:"Your entire caseload — every student, every program, every deadline — in one calm, clear dashboard. Filter by intervention tier, review date, or status. Know exactly where every student stands, every day."},
    {icon:"📸",name:"ALP Student Snapshot",desc:"A one-page, printable overview of every student's ALP — built for the whole school, not just the SPED team. Every general education teacher knows exactly who needs support, what accommodations apply, and how to help."},
    {icon:"📅",name:"ALP Meeting Scheduler",desc:"Schedule ALP review meetings, family conferences, and team check-ins without the back-and-forth. Automated reminders, calendar sync, and notifications sent to every team member — so no meeting is ever missed."},
    {icon:"🧮",name:"ALP Accommodations Hub",desc:"Every student, every accommodation, every assessment — in one master view. Share the Accommodations Hub with your entire school staff so every teacher knows exactly what every learner needs, every day."},
    {icon:"🔒",name:"ALP Privacy Shield",desc:"Student data is sensitive. ALP Privacy Shield gives administrators full control over who sees what — role-based permissions, audit trails on every action, and FERPA/GDPR-compliant data handling built in from day one."},
    {icon:"📤",name:"ALP Document Exporter",desc:"Export any Adaptive Learning Program as a professionally formatted, audit-ready PDF or Word document in one click. Timestamped, compliant, and formatted — ready to send to families, district offices, or government agencies instantly."},
  ];
  const frameworks=[
    {f:"🇺🇸",n:"IDEA (USA)",d:"All 50 states"},{f:"🇺🇸",n:"Section 504",d:"ADA compliance"},
    {f:"🇬🇭",n:"GES Ghana",d:"SPED Framework"},{f:"🇳🇬",n:"NERDC Nigeria",d:"SPED Policy"},
    {f:"🇰🇪",n:"KICD Kenya",d:"Inclusive Ed"},{f:"🇿🇦",n:"WCED S.Africa",d:"SIAS Framework"},
    {f:"🇬🇧",n:"UK SEND",d:"Code of Practice"},{f:"🇨🇦",n:"Canada",d:"Provincial IEPs"},
    {f:"🇦🇺",n:"NCCD Australia",d:"Disability Std"},{f:"🌍",n:"Custom",d:"Any framework"},
  ];
  return(
    <div className="dot-bg" style={{minHeight:"100vh"}}>
      <SubNav active="Features" setNavPage={setNavPage} onEnter={onEnter}/>

      {/* Hero */}
      <section className="r-hero-section" style={{padding:"80px 48px 56px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
        <p className="lbl" style={{marginBottom:16,color:C.purple}}>Platform Features</p>
        <h1 className="serif" style={{fontSize:"clamp(40px,6vw,76px)",fontWeight:800,letterSpacing:"-2px",lineHeight:1.05,marginBottom:20}}>
          Everything your school<br/><span className="serif-italic" style={{color:C.purple}}>needs to succeed.</span>
        </h1>
        <p style={{fontSize:18,color:C.warm,maxWidth:580,margin:"0 auto 40px",lineHeight:1.75}}>From AI goal writing to global compliance — one connected system for special education teachers, school leaders, and families. Supporting learners from birth to age 22+, in 10+ countries.</p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          <button className="btn-black" onClick={onEnter} style={{fontSize:12,padding:"14px 32px"}}>🚀 Start Free Today</button>
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
              <h2 className="serif" style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:800,letterSpacing:"-1px",lineHeight:1.1}}>
                ALP AI Intelligence Suite — <span className="serif-italic" style={{color:C.warm}}>Write ALPs<br/>in minutes, not days.</span>
              </h2>
            </div>
            <button className="btn-purple" onClick={onEnter} style={{fontSize:11,padding:"12px 24px",flexShrink:0}}>Try Now, It's Free!</button>
          </div>
          <p style={{fontSize:15,color:C.warm,marginBottom:36,maxWidth:620,lineHeight:1.7}}>Eight purpose-built tools in the ALP AI Intelligence Suite — designed exclusively for Adaptive Learning Programs. Every tool is free for individual teachers, forever. Powered by ALP AI to save you hours each week.</p>
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
          <h2 className="serif" style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:700,letterSpacing:"-1px",lineHeight:1.1,marginBottom:12}}>
            Replace spreadsheets<br/><span className="serif-italic" style={{color:C.warm}}>with calm and clarity.</span>
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

      {/* Global Compliance */}
      <section style={{background:C.black,padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{color:"#9A8A78",marginBottom:14,textAlign:"center"}}>Global Compliance Engine</p>
          <h2 className="serif" style={{fontSize:"clamp(28px,4vw,52px)",fontWeight:700,color:C.cream,textAlign:"center",marginBottom:16,letterSpacing:"-1px"}}>Built for every country,<br/><span className="serif-italic" style={{color:"#A78BFA"}}>every framework.</span></h2>
          <p style={{fontSize:15,color:"#9A8A78",textAlign:"center",maxWidth:560,margin:"0 auto 48px",lineHeight:1.7}}>ALP automatically checks programs against 10+ compliance frameworks — flagging anything missing before your audit arrives.</p>
          <div className="r-compliance-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:40}}>
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
            <button className="btn-purple" onClick={onEnter} style={{fontSize:12,padding:"14px 36px"}}>Get Started Free →</button>
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
function ForSchoolsPage({setNavPage,onEnter}){
  const roles=[
    {icon:"👩‍🏫",title:"Special Education Teacher",sub:"Reduce paperwork, increase student outcomes.",color:"#7C3AED",bg:"#EDE9FE",
     desc:"You spend hours on documentation that could be spent with students. ALP cuts writing time from 2 hours to 20 minutes — with AI doing the heavy lifting on goals, BIPs, and present levels.",
     features:["Build complete 13-section ALPs in 20 min","AI ALP Goal Architect, ALP Behaviour Blueprint, ALP Present Levels Coach","Caseload dashboard — all students in one view","Progress monitoring with CBM auto-alerts","Family portal with e-signature"]},
    {icon:"🎓",title:"Special Education Director",sub:"Increase compliance, ensure confidentiality, support your team at scale.",color:"#2563EB",bg:"#DBEAFE",
     desc:"Real-time compliance visibility across every teacher and student in your school or district. Know exactly who needs attention — before the auditor arrives.",
     features:["School-wide compliance dashboard","Overdue review date alerts","Audit-ready one-click reports","Staff caseload visibility & management","FERPA & data privacy certified"]},
    {icon:"🏫",title:"Gen-Ed Teacher",sub:"Tools to support ALL of your students.",color:"#16A34A",bg:"#DCFCE7",
     desc:"ALP Student Snapshot mean every general education teacher knows exactly who has a learning program, what accommodations apply, and how to support each learner — without needing confidential record access.",
     features:["ALP Student Snapshot for every student","Accommodations matrix at your fingertips","Disability impact statements","Text leveling for struggling readers","Differentiated lesson plan suggestions"]},
    {icon:"🏛",title:"School Leadership",sub:"Create a culture of inclusion.",color:"#D97706",bg:"#FEF9C3",
     desc:"Build a school where every learner is seen, supported, and accelerating. ALP gives school leaders the data and visibility to make inclusion a reality — not just a policy statement.",
     features:["Inclusion culture dashboard","Compliance rate tracking by teacher","Staff professional development tools","Parent engagement metrics","District reporting & benchmarking"]},
    {icon:"🩺",title:"Service Provider",sub:"Personalize intervention with ease.",color:"#DC2626",bg:"#FEE2E2",
     desc:"SLPs, OTs, PTs, psychologists, and behavior specialists can document sessions, track goal progress, and collaborate with the classroom team — all in one connected system.",
     features:["Session notes linked to ALP goals","Progress data entry by domain","Collaborative goal writing with teachers","Service frequency & duration tracking","Shared access with teacher caseload"]},
    {icon:"🌍",title:"NGOs & Governments",sub:"Deploy ALP at scale, globally.",color:"#0891B2",bg:"#CFFAFE",
     desc:"ALP is built for global deployment. Education ministries, NGOs, and government agencies can standardize intervention across schools, regions, and entire countries — with custom frameworks.",
     features:["Country-specific framework config","Bulk student import (CSV/SIS)","Regional compliance reporting","Multi-language support","Custom branding & white-labeling"]},
  ];
  const testimonials=[
    {q:"ALP has transformed how we support our students. What used to take 2 hours now takes 20 minutes, and our compliance rate went from 60% to 98%.",n:"Abena Sarpong",r:"Special Education Director · Accra, Ghana",i:"AS",c:"#7C3AED"},
    {q:"The AI goal writer is unbelievable. I paste in my baseline data and it gives me three SMART goal options — with baseline, target, and monitoring method already filled in.",n:"Marcus Williams",r:"Special Ed Teacher · Virginia, USA",i:"MW",c:"#2563EB"},
    {q:"Finally a system that works for Ghana's GES framework. ALP flags anything we're missing before our regional review. It saved us from a compliance issue that would have been serious.",n:"Kwame Asante",r:"Head of Inclusive Education · GES District, Kumasi",i:"KA",c:"#16A34A"},
  ];
  return(
    <div className="dot-bg" style={{minHeight:"100vh"}}>
      <SubNav active="For Schools" setNavPage={setNavPage} onEnter={onEnter}/>

      {/* Hero */}
      <section className="r-hero-section" style={{padding:"80px 48px 56px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
        <p className="lbl" style={{marginBottom:16,color:C.purple}}>For Schools & Districts</p>
        <h1 className="serif" style={{fontSize:"clamp(38px,6vw,72px)",fontWeight:800,letterSpacing:"-2px",lineHeight:1.05,marginBottom:20}}>
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
        <h2 className="serif" style={{fontSize:36,fontWeight:700,letterSpacing:"-1px",marginBottom:8,textAlign:"center"}}>Who we <span className="serif-italic" style={{color:C.purple}}>support</span></h2>
        <p style={{fontSize:14,color:C.warm,textAlign:"center",marginBottom:40}}>ALP is designed for every educator who supports a learner with structured needs.</p>
        <div className="r-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
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
          <h2 className="serif" style={{fontSize:34,fontWeight:700,letterSpacing:"-1px",marginBottom:48,textAlign:"center"}}>Two ways to <span className="serif-italic" style={{color:C.warm}}>get started</span></h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            <div style={{background:"#FAF8FF",border:`2px solid ${C.purple}`,borderRadius:16,padding:36,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:14}}>👤</div>
              <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:8}}>Individual Teachers</h3>
              <p style={{fontSize:14,color:C.warm,lineHeight:1.7,marginBottom:20}}>Subscribe yourself, self-onboard in minutes, and get instant access to all AI tools and caseload management. No IT department needed.</p>
              <div style={{fontSize:30,fontWeight:800,color:C.purple,marginBottom:4}}>From $9<span style={{fontSize:14,fontWeight:400,color:C.warm}}>/mo</span></div>
              <p style={{fontSize:12,color:C.warm,marginBottom:22}}>ALP AI Intelligence Suite tools free forever · 14-day trial</p>
              <button className="btn-purple" onClick={onEnter} style={{width:"100%",fontSize:12}}>Start Free Trial →</button>
            </div>
            <div style={{background:C.black,border:`2px solid ${C.black}`,borderRadius:16,padding:36,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:14}}>🏫</div>
              <h3 className="serif" style={{fontSize:22,fontWeight:700,color:C.cream,marginBottom:8}}>Schools & Districts</h3>
              <p style={{fontSize:14,color:"#9A8A78",lineHeight:1.7,marginBottom:20}}>Custom onboarding, staff training, district-wide deployment, and dedicated support — built around your school's specific needs and compliance framework.</p>
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

      {/* Testimonials */}
      <section style={{padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",maxWidth:1100,margin:"0 auto"}}>
        <h2 className="serif" style={{fontSize:34,fontWeight:700,letterSpacing:"-1px",marginBottom:40,textAlign:"center"}}>Trusted by <span className="serif-italic" style={{color:C.warm}}>educators worldwide</span></h2>
        <div className="r-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {testimonials.map(t=>(
            <div key={t.n} className="card" style={{padding:28}}>
              <div style={{fontSize:36,color:t.c,marginBottom:10,lineHeight:1}}>"</div>
              <p className="serif" style={{fontSize:14,fontStyle:"italic",lineHeight:1.75,color:C.black,marginBottom:20}}>{t.q}</p>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:t.c,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14,flexShrink:0}}>{t.i}</div>
                <div><div style={{fontSize:13,fontWeight:700}}>{t.n}</div><div style={{fontSize:11,color:C.warm}}>{t.r}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PageFooter/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PRICING PAGE
// ═══════════════════════════════════════════════════════════════════
function PricingPage({setNavPage,onEnter}){
  const [billing,setBilling]=useState("monthly");
  const [openFaq,setOpenFaq]=useState(null);

  const plans=[
    {
      name:"Free",price:"$0",period:"forever",tag:null,color:"#6B7280",bg:C.white,textColor:C.black,
      desc:"ALP AI Intelligence Suite tools completely free for individual teachers. Forever. Because educators deserve support, not barriers.",
      features:["Up to 10 students","ALP Goal Architect — unlimited","ALP Present Levels Coach","ALP Behaviour Blueprint","ALP Reading Adapter","ALP Intervention Planner","ALP Lesson Differentiator","ALP Progress Probe Generator","PDF export (3/month)"],
      missing:["Caseload dashboard","Family portal","Global compliance engine","ALP Student Snapshot","E-signature","Automated scheduling"],
      cta:"Create Free Account",style:"btn-outline",
    },
    {
      name:"Professional",
      price:billing==="monthly"?"$9":"$7",
      period:"/mo per teacher",tag:"MOST POPULAR",color:C.purple,bg:C.black,textColor:C.cream,
      desc:"The complete ALP system — global compliance, family portal with e-signature, desktop apps, and unlimited AI tools all included.",
      features:["Unlimited students","ALP AI Intelligence Suite — all 8 tools unlimited","Full 13-section ALP Builder","Real-time CBM progress monitoring + alerts","Family portal with e-signature","All 10+ global compliance frameworks","ALP Student Snapshot for gen-ed teachers","ALP Accommodations Hub","Caseload dashboard","PDF + Word export","Automated ALP scheduling","Priority email & chat support"],
      missing:[],
      cta:"Start 14-Day Free Trial",style:"btn-purple",
    },
    {
      name:"School",
      price:billing==="monthly"?"$29":"$23",
      period:"/mo per teacher",tag:"BEST VALUE",color:"#16A34A",bg:C.white,textColor:C.black,
      desc:"For schools that need admin oversight, compliance reporting, and team management across all teachers.",
      features:["Everything in Professional","School admin compliance dashboard","District-wide review date tracking","Overdue alert system for administrators","Bulk student import (CSV/SIS)","Staff onboarding & training tools","Custom confidentiality settings","PowerSchool / Infinite Campus integration","FERPA compliance certification","Phone + dedicated account support"],
      missing:[],
      cta:"Schedule Demo",style:"btn-outline",
    },
    {
      name:"Enterprise",price:"Custom",period:"pricing",tag:null,color:C.black,bg:C.white,textColor:C.black,
      desc:"For districts, NGOs, and governments deploying ALP at scale across many schools or entire countries.",
      features:["Everything in School","Multi-school & district management","Custom compliance framework builder","White-labeling & custom branding","Full API access for SIS integration","Dedicated account manager","On-site training & implementation","99.9% uptime SLA","Custom data residency","Government & NGO pricing available"],
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
    {f:"Family Portal",a:"✓ Pro & above",p:"✗ Not included"},
    {f:"E-Signature",a:"✓ Pro & above",p:"✗ Not included"},
    {f:"Global Compliance (Ghana, Nigeria, UK…)",a:"✓ 10+ frameworks",p:"✗ USA only"},
    {f:"Desktop App (offline access)",a:"✓ Windows/Mac/Linux",p:"✗ Web only"},
    {f:"ALP Student Snapshot",a:"✓ Pro & above",p:"✓ Pro & above"},
    {f:"ALP Accommodations Hub",a:"✓ School & above",p:"✓ School & above"},
    {f:"Age Range",a:"Birth–22+",p:"Ages 5–21 only"},
    {f:"Price for SPED teams",a:"$9/mo",p:"$10–15/mo"},
  ];

  const faqs=[
    {q:"Is ALP really free for individual teachers?",a:"Yes. All 8 tools in the ALP AI Intelligence Suite are free for individual teachers, forever: ALP Goal Architect, ALP Present Levels Coach, ALP Behaviour Blueprint, ALP Reading Adapter, ALP Intervention Planner, ALP Progress Probe Generator, ALP Learner Profile Builder, and ALP Lesson Differentiator. We believe educators deserve support, not paywalls."},
    {q:"How does ALP compare to other learning plan software?",a:"ALP's Professional plan starts at $9/month and includes features most IEP software charges extra for or doesn't offer at all — global compliance frameworks (Ghana GES, Nigeria NERDC, UK SEND, and more), a full family portal with e-signature, desktop apps for offline access, and support for students from birth to age 22+."},
    {q:"Is there a free trial on paid plans?",a:"Yes — every paid plan comes with a 14-day free trial. No credit card required. You get full access to all features during the trial period."},
    {q:"Do you support Ghana GES or Nigeria NERDC compliance?",a:"Yes — ALP was built with African and global schools in mind from day one. We support GES Ghana, NERDC Nigeria, KICD Kenya, WCED South Africa, UK SEND, Australia NCCD, and all US frameworks (IDEA, Section 504) out of the box."},
    {q:"Can I use ALP for students from birth to age 22?",a:"Absolutely. ALP supports early intervention (birth–3), preschool (ages 3–5), school age (6–13), transition (14–21), and adult transition (18–22+). The ALP Builder automatically adjusts required sections and compliance requirements based on the student's age."},
    {q:"Do you offer discounts for NGOs or governments?",a:"Yes — we offer significant discounts for non-profit organizations, government education departments, and schools in low-income countries. Email support@growwithalp.com for pricing."},
    {q:"What happens to my data if I cancel?",a:"Your data is yours. Export all student records, ALPs, and progress data as CSV or PDF at any time before canceling. We retain your data for 90 days after cancellation."},
  ];

  return(
    <div className="dot-bg" style={{minHeight:"100vh"}}>
      <SubNav active="Pricing" setNavPage={setNavPage} onEnter={onEnter}/>

      {/* Hero */}
      <section style={{padding:"72px 48px 48px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
        <p className="lbl" style={{marginBottom:16,color:C.purple}}>Simple, Transparent Pricing</p>
        <h1 className="serif" style={{fontSize:"clamp(36px,5vw,68px)",fontWeight:800,letterSpacing:"-2px",lineHeight:1.05,marginBottom:16}}>
          Plans for every<br/><span className="serif-italic" style={{color:C.purple}}>school and budget.</span>
        </h1>
        <p style={{fontSize:17,color:C.warm,maxWidth:540,margin:"0 auto 12px",lineHeight:1.75}}>ALP AI Intelligence Suite tools are <b style={{color:C.black}}>free forever</b> for individual teachers. Paid plans start at just $9/mo — cheaper than traditional learning plan software.</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:36}}>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Most affordable plan</span>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Global compliance included</span>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Family portal included</span>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Desktop apps included</span>
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
      <section style={{padding:"0 48px 64px",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,alignItems:"start"}}>
          {plans.map(p=>(
            <div key={p.name} style={{background:p.bg,borderRadius:14,padding:26,position:"relative",border:`1.5px solid ${p.tag?p.color:C.tanL}`,boxShadow:p.tag?"0 8px 40px rgba(124,58,237,.2)":"0 1px 3px rgba(0,0,0,.04)",display:"flex",flexDirection:"column",gap:0}}>
              {p.tag&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:p.color,color:"#fff",fontSize:10,fontWeight:800,padding:"4px 16px",borderRadius:99,letterSpacing:".08em",whiteSpace:"nowrap"}}>{p.tag}</div>}
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
              <button className={p.style} onClick={onEnter}
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
          <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:6,textAlign:"center"}}>ALP vs <span className="serif-italic" style={{color:C.warm}}>Traditional Learning Plan Software</span></h2>
          <p style={{fontSize:14,color:C.warm,textAlign:"center",marginBottom:36}}>See exactly what makes ALP different from traditional learning plan software.</p>
          <div style={{border:`1px solid ${C.tanL}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:C.purpleL,padding:"12px 20px",borderBottom:`1px solid ${C.tanL}`}}>
              {["Feature","ALP Platform","Traditional Learning Plan Software"].map((h,i)=><span key={h} style={{fontSize:11,fontWeight:700,color:i===1?C.purple:C.warm,textTransform:"uppercase",letterSpacing:".08em",textAlign:i>0?"center":"left"}}>{h}</span>)}
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
        <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:40,textAlign:"center"}}>Frequently asked <span className="serif-italic" style={{color:C.warm}}>questions</span></h2>
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

      <PageFooter/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RESOURCES PAGE
// ═══════════════════════════════════════════════════════════════════
function ResourcesPage({setNavPage,onEnter}){
  const guides=[
    {icon:"📋",tag:"GUIDE",title:"Getting Started with ALP",desc:"From account setup to your first complete ALP in 20 minutes.",time:"10 min read",color:C.purple},
    {icon:"🤖",tag:"AI TUTORIAL",title:"Using the ALP AI Intelligence Suite",desc:"Generate SMART goals, BIPs, ALP Present Levels Coach statements, and lesson plans with AI. Step-by-step with real examples.",time:"8 min read",color:"#2563EB"},
    {icon:"📈",tag:"GUIDE",title:"Progress Monitoring 101",desc:"Understanding CBM, trendlines, and when to intervene. Set up your data system and read the charts.",time:"12 min read",color:"#16A34A"},
    {icon:"👨‍👩‍👧",tag:"GUIDE",title:"Family Collaboration Best Practices",desc:"Using the Family Portal — progress updates, meeting scheduling, e-signatures, and home language communication.",time:"7 min read",color:"#D97706"},
    {icon:"⚖️",tag:"COMPLIANCE",title:"IDEA Compliance Checklist (USA)",desc:"Every required element for a legally compliant ALP under IDEA and Section 504.",time:"15 min read",color:"#DC2626"},
    {icon:"🌍",tag:"COMPLIANCE",title:"GES Ghana SPED Framework Guide",desc:"Building ALPs aligned to the Ghana Education Service's SPED framework and inclusive education policy.",time:"12 min read",color:"#0891B2"},
    {icon:"🧠",tag:"AI GUIDE",title:"Writing Better BIPs with AI",desc:"How to use the ALP Behaviour Blueprint to create comprehensive behavior intervention plans in minutes.",time:"9 min read",color:C.purple},
    {icon:"⚡",tag:"TUTORIAL",title:"ALP Intervention Planner — Tier 1, 2 & 3",desc:"Build structured interventions for every learner tier using the ALP Intervention Planner. Includes real examples for reading, math, behavior, and social-emotional learning across all age groups.",time:"11 min read",color:"#16A34A"},
    {icon:"📰",tag:"GUIDE",title:"ALP vs Traditional Plans — What's the Difference?",desc:"A clear explanation of how the Adaptive Learning Program differs from traditional learning plans and why it matters globally.",time:"6 min read",color:"#6B7280"},
  ];
  const workshops=[
    {icon:"🖥",title:"ALP AI Tools for Educators",date:"Every Tuesday · 4:00 PM EST",desc:"Live workshop on using ALP's ALP AI Intelligence Suite for goal writing, BIPs, and progress monitoring. Free for all educators.",cta:"Register Free"},
    {icon:"🌍",title:"ALP for African Schools",date:"Every Thursday · 3:00 PM WAT",desc:"Focused on GES Ghana, NERDC Nigeria, and KICD Kenya frameworks. Presented in English with open Q&A.",cta:"Register Free"},
    {icon:"📊",title:"Progress Monitoring Masterclass",date:"1st Friday of month · 2:00 PM EST",desc:"Deep dive into CBM, trendline analysis, and data-driven decision making for SPED educators worldwide.",cta:"Register Free"},
  ];
  const videos=[
    {title:"ALP Platform — 3 Minute Overview",desc:"Every major feature in 3 minutes.",dur:"3:14",icon:"🎬"},
    {title:"Build Your First ALP — Full Walkthrough",desc:"A complete ALP built from scratch in real time.",dur:"18:42",icon:"📋"},
    {title:"ALP AI Goal Writing Live Demo",desc:"See the AI generate 3 SMART goals from baseline data.",dur:"6:28",icon:"🤖"},
    {title:"ALP Behaviour Blueprint — Live Demo",desc:"Watch the Behaviour Blueprint create a full intervention plan in under 3 minutes.",dur:"2:58",icon:"🧠"},
    {title:"Family Portal — Parent Experience",desc:"What families see and how they interact with teachers.",dur:"9:15",icon:"👨‍👩‍👧"},
    {title:"GES Ghana Compliance Walkthrough",desc:"Building a compliant ALP for Ghana's GES framework.",dur:"14:05",icon:"🌍"},
    {title:"Progress Monitoring Setup",desc:"Configure CBM tracking and alerts step by step.",dur:"11:20",icon:"📈"},
    {title:"ALP Caseload Command Tour",desc:"Managing your full caseload in one view.",dur:"7:55",icon:"📅"},
  ];
  const downloads=[
    {icon:"📄",title:"Blank ALP Template",desc:"Printable 13-section ALP form, IDEA-aligned."},
    {icon:"📊",title:"Progress Monitoring Data Sheet",desc:"CBM tracking sheets for reading, math, and behavior."},
    {icon:"📋",title:"Family Rights Summary",desc:"Plain-language parent rights — available in 8 languages."},
    {icon:"🗂",title:"ALP Quick Reference Card",desc:"One-page cheat sheet for new educators. Print and post it."},
    {icon:"📑",title:"Compliance Audit Self-Checklist",desc:"Self-audit tool to check your ALP before an official review."},
    {icon:"📰",title:"ALP vs Traditional Plans Comparison Guide",desc:"Full explanation of how ALP differs from traditional learning plans."},
  ];
  return(
    <div className="dot-bg" style={{minHeight:"100vh"}}>
      <SubNav active="Resources" setNavPage={setNavPage} onEnter={onEnter}/>

      {/* Hero */}
      <section style={{padding:"72px 48px 48px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
        <p className="lbl" style={{marginBottom:16,color:C.purple}}>Learning & Support</p>
        <h1 className="serif" style={{fontSize:"clamp(36px,5vw,68px)",fontWeight:800,letterSpacing:"-2px",lineHeight:1.05,marginBottom:16}}>
          Everything you need<br/><span className="serif-italic" style={{color:C.purple}}>to get started.</span>
        </h1>
        <p style={{fontSize:17,color:C.warm,maxWidth:540,margin:"0 auto 0",lineHeight:1.75}}>Guides, workshops, videos, templates — built for educators at every level, in every country.</p>
      </section>

      {/* Guides */}
      <section style={{padding:"48px 48px 72px",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
          <div><p className="lbl" style={{marginBottom:8}}>Guides & Articles</p><h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px"}}>Learn at your <span className="serif-italic" style={{color:C.warm}}>own pace.</span></h2></div>
        </div>
        <hr className="rule" style={{margin:"22px 0 34px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
          {guides.map(g=>(
            <div key={g.title} className="card" style={{padding:26,cursor:"pointer",transition:"all .2s"}}
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
          <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:40}}>Register for upcoming<br/><span className="serif-italic" style={{color:C.warm}}>virtual AI workshops.</span></h2>
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
      <section style={{background:C.black,padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{color:"#9A8A78",marginBottom:12}}>Learning Library</p>
          <h2 className="serif" style={{fontSize:32,fontWeight:700,color:C.cream,letterSpacing:"-1px",marginBottom:40}}>Tutorial videos on getting<br/><span className="serif-italic" style={{color:"#A78BFA"}}>the most out of ALP.</span></h2>
          <div className="r-feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
            {videos.map(v=>(
              <div key={v.title} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,overflow:"hidden",cursor:"pointer",transition:"all .2s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(124,58,237,.2)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.05)"}>
                <div style={{height:96,background:"rgba(124,58,237,.18)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:42,height:42,borderRadius:"50%",background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>▶</div>
                </div>
                <div style={{padding:16}}>
                  <div style={{fontSize:18,marginBottom:5}}>{v.icon}</div>
                  <h3 style={{fontSize:12.5,fontWeight:700,color:C.cream,marginBottom:4,lineHeight:1.3}}>{v.title}</h3>
                  <p style={{fontSize:11,color:"#9A8A78",lineHeight:1.5,marginBottom:8}}>{v.desc}</p>
                  <span style={{fontSize:11,color:"#A78BFA",fontWeight:600}}>{v.dur}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Downloads */}
      <section style={{padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",maxWidth:1100,margin:"0 auto"}}>
        <p className="lbl" style={{marginBottom:12}}>Free Downloads</p>
        <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:40}}>Templates & <span className="serif-italic" style={{color:C.warm}}>tools.</span></h2>
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
          <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:14}}>Access ALP <span className="serif-italic" style={{color:C.warm}}>your way.</span></h2>
          <p style={{fontSize:14,color:C.warm,marginBottom:44}}>Full offline access, faster performance, and enterprise security on all major platforms.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
            {[
              {icon:"🌐",label:"Web App",sub:"No download needed",cta:true},
              {svg:<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 88 88"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203z" fill="#F35325"/><path d="M39.996 6.86L87.314 0v41.745l-47.318.376z" fill="#81BC06"/><path d="M35.67 45.471l.028 34.453L0 75.48V45.268z" fill="#05A6F0"/><path d="M39.996 46.06l47.318-.376V88l-47.318-7.62z" fill="#FFBA08"/></svg>,label:"Windows",sub:"Windows 10 / 11"},
              {svg:<img src="/assets/images/apple-logo.png" alt="macOS" style={{width:48,height:48,objectFit:"contain"}}/>,label:"macOS",sub:"macOS 12+"},
              {svg:<img src="/assets/images/linux-logo.png" alt="Linux" style={{width:48,height:48,objectFit:"contain"}}/>,label:"Linux",sub:"Ubuntu / Debian"}
            ].map(p=>(
              <div key={p.label} className="card" style={{padding:"28px 20px",textAlign:"center"}}>
                {p.svg
                  ?<div style={{width:52,height:52,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center"}}>{p.svg}</div>
                  :<div style={{fontSize:42,marginBottom:12}}>{p.icon}</div>
                }
                <div className="serif" style={{fontSize:17,fontWeight:700,marginBottom:4}}>{p.label}</div>
                <div style={{fontSize:12,color:C.warm,marginBottom:18}}>{p.sub}</div>
                {p.cta?<button className="btn-black" onClick={onEnter} style={{width:"100%",fontSize:11}}>Open in Browser</button>:<button className="btn-outline" style={{width:"100%",fontSize:11}}>⬇ Download {p.label}</button>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support */}
      <section style={{padding:"clamp(44px,6vw,72px) clamp(20px,5vw,48px)",maxWidth:1100,margin:"0 auto"}}>
        <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:40,textAlign:"center"}}>Need <span className="serif-italic" style={{color:C.warm}}>help?</span></h2>
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

      <PageFooter/>
    </div>
  );
}

function Landing({onEnter,navPage,setNavPage}){
  const [showDownload,setShowDownload]=useState(false);
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  // Prevent horizontal overflow on mobile
  if(typeof document!=="undefined")document.body.style.overflowX="hidden";
  const features=[
    {n:"01",title:"ALP Builder",italic:"13-Section",desc:"Guided workflow builds compliant learning plans in 15–20 minutes. AI suggests measurable SMART goals."},
    {n:"02",title:"Progress Monitoring",italic:"Real-Time",desc:"CBM tracking with visual dashboards and automatic alerts when students fall behind trajectory."},
    {n:"03",title:"Family Collaboration",italic:"Built-In",desc:"Parents see plans, message teachers, schedule meetings, and sign documents — all in one portal."},
    {n:"04",title:"Compliance Engine",italic:"Global",desc:"IDEA, Section 504, GES Ghana, UK SEND, Nigeria NERDC, and more. One-click audit-ready reports."},
    {n:"05",title:"ALP AI Goal Architect",italic:"ALP AI",desc:"Drafts measurable annual goals based on the student's profile, disability, and baseline data."},
    {n:"06",title:"ALP Document Exporter",italic:"Instant",desc:"Export signed, compliant ALP PDFs ready to share with families and district administrators."},
  ];
  // Sub-page routing
  if(navPage==="Features")    return <FeaturesPage setNavPage={setNavPage} onEnter={onEnter}/>;
  if(navPage==="For Schools") return <ForSchoolsPage setNavPage={setNavPage} onEnter={onEnter}/>;
  if(navPage==="Pricing")     return <PricingPage setNavPage={setNavPage} onEnter={onEnter}/>;
  if(navPage==="Resources")   return <ResourcesPage setNavPage={setNavPage} onEnter={onEnter}/>;

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
          <button className="landing-nav-desktop" onClick={onEnter} style={{padding:"8px 18px",fontSize:11,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:C.purple,color:"#fff",border:"none",borderRadius:99,cursor:"pointer",transition:"all .18s"}} onMouseEnter={e=>e.currentTarget.style.background="#6D28D9"} onMouseLeave={e=>e.currentTarget.style.background=C.purple}>Sign Up</button>
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
            <button onClick={()=>{onEnter();setMobileNavOpen(false);}} style={{flex:1,padding:"12px",fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",background:C.purple,color:"#fff",border:"none",borderRadius:99,cursor:"pointer"}}>Sign Up Free</button>
          </div>
        </div>
      )}
      </>

      <section style={{background:"#18003d",padding:"0"}}><div style={{padding:"clamp(48px,8vw,96px) clamp(20px,4vw,48px) clamp(48px,6vw,80px)",maxWidth:1100,margin:"0 auto"}} className="fade-up">
        <p className="lbl" style={{marginBottom:24,color:"#a78bfa",letterSpacing:".14em"}}>Now available · Spring 2026 · 10+ global frameworks</p>
        <h1 className="serif" style={{fontSize:"clamp(54px,7vw,96px)",fontWeight:800,lineHeight:1.02,letterSpacing:"-2.5px",marginBottom:32,maxWidth:820,color:"#fff"}}>
          Supporting Every<br/><span className="serif-italic" style={{color:"#a78bfa"}}>Learner's Growth.</span>
        </h1>
        <p style={{fontSize:18,color:"rgba(255,255,255,.7)",maxWidth:520,lineHeight:1.78,marginBottom:52}}>A complete student intervention and progress monitoring system — designed to help schools worldwide support every learner through structured plans, real-time tracking, and family collaboration.</p>
        <div className="r-hero-btns" style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={onEnter} style={{fontSize:11,padding:"15px 38px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:C.purple,color:"#fff",border:"none",borderRadius:99,cursor:"pointer",transition:"all .18s",display:"inline-flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#6D28D9"} onMouseLeave={e=>e.currentTarget.style.background=C.purple}>🚀 Start in the Browser →</button>
          <button onClick={()=>setShowDownload(true)} style={{fontSize:11,padding:"14px 34px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:"transparent",color:"#fff",border:"1.5px solid rgba(255,255,255,.5)",borderRadius:99,cursor:"pointer",transition:"all .18s",display:"inline-flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.borderColor="#fff"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.5)"}>⬇ Download Desktop App</button>
          <button style={{fontSize:11,padding:"14px 28px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.8)",border:"1px solid rgba(255,255,255,.2)",borderRadius:99,cursor:"pointer",transition:"all .18s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"} onClick={()=>window.open("mailto:hello@growwithalp.com?subject=Demo Request - ALP Platform","_blank")}>📅 Schedule a Demo</button>
        </div>
        <div style={{display:"flex",gap:"clamp(20px,4vw,56px)",marginTop:"clamp(32px,5vw,64px)",paddingTop:"clamp(24px,4vw,48px)",flexWrap:"wrap",borderTop:"1px solid rgba(255,255,255,.1)"}}>
          {[["10+","Countries supported"],["IDEA & GES","Global frameworks"],["ALP AI","Goal generation"],["FERPA","Compliant & secure"]].map(([v,l])=><div key={l}><div className="serif" style={{fontSize:24,fontWeight:700,color:"#fff"}}>{v}</div><div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{l}</div></div>)}
        </div>
      </div></section>

      <div className="ticker-wrap">
        <div className="ticker-inner">
          {[...Array(8)].map((_,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:28,paddingRight:56,fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.warm}}>
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>IDEA Compliance
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>ALP AI Goal Generation
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>Family Collaboration
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>Progress Monitoring
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>GES Ghana · UK SEND · Nigeria NERDC · Australia NCCD
          </span>)}
        </div>
      </div>

      {/* TRUST BAR — educators using ALP globally */}
      <section style={{background:C.white,padding:"clamp(28px,4vw,44px) clamp(20px,4vw,48px)",borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:24}}>Trusted by educators in schools across the globe</p>
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",flexWrap:"wrap",gap:32}}>
            {["Westwood Unified","Accra SPED District","Lagos State Schools","Virginia DOE","Nairobi County Schools","Kumasi GES District","London SEND Borough","Brisbane Inclusive Ed","Rocketship Ed","KIPP Foundation"].map(s=>(
              <span key={s} style={{fontSize:13,fontWeight:700,color:C.black,letterSpacing:".04em",opacity:.5}}>{s}</span>
            ))}
          </div>
        </div>
      </section>


      <section style={{background:"#fff",padding:"0"}}><div style={{padding:"clamp(48px,7vw,96px) clamp(20px,4vw,48px)",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
          <div>
            <p className="lbl" style={{marginBottom:14}}>Platform Features</p>
            <h2 className="serif" style={{fontSize:"clamp(36px,5vw,60px)",fontWeight:700,lineHeight:1.08,letterSpacing:"-1.5px"}}>Everything your<br/><span className="serif-italic" style={{color:C.warm}}>school needs.</span></h2>
          </div>
          <button style={{width:42,height:42,border:`1.5px solid ${C.black}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,background:"transparent",transition:"all .18s",marginBottom:6}} onMouseEnter={e=>e.currentTarget.style.background=C.black} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>↗</button>
        </div>
        <hr className="rule" style={{margin:"32px 0 48px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
          {features.map((f,i)=><div key={f.n} style={{padding:"36px 32px",borderRight:(i+1)%3!==0?`1px solid ${C.tanL}`:"none",borderBottom:i<3?`1px solid ${C.tanL}`:"none",transition:"background .2s"}} onMouseEnter={e=>e.currentTarget.style.background=C.white} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{fontSize:11,fontWeight:700,color:C.purple,letterSpacing:".1em",marginBottom:16}}>{f.n}</div>
            <div className="serif" style={{fontSize:19,fontWeight:700,lineHeight:1.2}}><span className="serif-italic" style={{color:C.warm,marginRight:4}}>{f.italic}</span>{f.title}</div>
            <p style={{fontSize:13,color:C.warm,lineHeight:1.75,marginTop:12}}>{f.desc}</p>
          </div>)}
        </div></div></section>

      <section style={{background:C.black,padding:"clamp(52px,8vw,96px) clamp(20px,5vw,48px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{color:"#9A8A78",marginBottom:20}}>Access ALP your way</p>
          <h2 className="serif" style={{fontSize:"clamp(36px,5vw,64px)",fontWeight:700,color:C.cream,letterSpacing:"-1.5px",marginBottom:64,lineHeight:1.08}}>Your Platform.<br/><span className="serif-italic" style={{color:"#A78BFA"}}>Your Device.</span></h2>
          <div className="r-platform-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#2D2D2D"}}>
            {[
              {icon:"🌐",label:"Web App",sub:"No download needed",cta:true},
              {svg:<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 88 88"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203z" fill="#F35325"/><path d="M39.996 6.86L87.314 0v41.745l-47.318.376z" fill="#81BC06"/><path d="M35.67 45.471l.028 34.453L0 75.48V45.268z" fill="#05A6F0"/><path d="M39.996 46.06l47.318-.376V88l-47.318-7.62z" fill="#FFBA08"/></svg>,label:"Windows",sub:"Windows 10 / 11",ver:"v2.4.1"},
              {svg:<img src="/assets/images/apple-logo.png" alt="macOS" style={{width:48,height:48,objectFit:"contain"}}/>,label:"macOS",sub:"macOS 12+",ver:"v2.4.1"},
              {svg:<img src="/assets/images/linux-logo.png" alt="Linux" style={{width:48,height:48,objectFit:"contain"}}/>,label:"Linux",sub:"Ubuntu / Debian",ver:"v2.4.1"}
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

      <footer style={{padding:"64px 48px 32px",maxWidth:1100,margin:"0 auto",background:"#fff"}}>
        <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr",gap:32,marginBottom:48}}>
          <div>
            <div className="serif" style={{fontSize:22,fontWeight:700,marginBottom:10,color:"#8B2020",fontStyle:"italic"}}>ALP.</div>
            <p style={{fontSize:13,color:C.warm,lineHeight:1.7,marginBottom:14}}>ACCELERATED LEARNING PROGRAM<br/>Supporting Every Learner's Growth</p>
            <p style={{fontSize:11,color:C.tan}}>Shalom Estate, Adenta Municipality, Ghana</p>
            <p style={{fontSize:11,color:C.tan,marginTop:2}}>Built by Stan Paraclete</p>
          </div>
          {[["Platform",["ALP Builder","Progress Monitoring","Family Portal","Reports","Compliance"]],["For Schools",["Special Ed Teachers","School Admins","Districts","NGOs","Governments"]],["Support",["Documentation","Contact Us","Privacy Policy","Terms of Service"]]].map(([title,links])=>(
            <div key={title}><p className="lbl" style={{marginBottom:16}}>{title}</p>{links.map(l=><div key={l} style={{fontSize:13,color:C.warm,marginBottom:9,cursor:"pointer"}}>{l}</div>)}</div>
          ))}
        </div>
        <hr className="rule" style={{marginBottom:24}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:C.tan}}>
          <span>© 2026 ALP Platform Inc. All rights reserved.</span>
          <div style={{display:"flex",gap:24,alignItems:"center"}}>
            <span>PRIVACY</span><span>TERMS</span>
            <span style={{display:"flex",alignItems:"center",gap:6}}><span className="pulse" style={{width:6,height:6,borderRadius:"50%",background:C.green,display:"inline-block"}}/>Systems Operational</span>
            <b style={{color:C.black}}>BUILT BY Stan Paraclete</b>
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
  const [email,setEmail]=useState("ms.simmons@westwood.edu");
  const [pw,setPw]=useState("ALPDemo2026!");
  const [license,setLicense]=useState("");
  const [loading,setLoading]=useState(false);
  const [showDownload,setShowDownload]=useState(false);
  const [step,setStep]=useState("credentials"); // "credentials" | "role"
  const [selectedRole,setSelectedRole]=useState(null);

  function handleSignIn(){
    setLoading(true);
    setTimeout(()=>{setLoading(false);setStep("role");},800);
  }

  function handleRoleSelect(roleId){
    setSelectedRole(roleId);
    setTimeout(()=>onLogin(roleId),300);
  }

  return(
    <div style={{display:"flex",minHeight:"100vh"}}>
      {showDownload&&<DownloadModal onClose={()=>setShowDownload(false)}/>}

      {/* LEFT panel */}
      <div style={{flex:1,background:"#0B0718",display:step==="role"?"none":undefined,position:"relative",display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:56,overflow:"hidden"}}>
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
              <div key={l}><div style={{fontSize:30,fontWeight:800,color:C.purple,letterSpacing:"-1px"}}>{v}</div><div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:3}}>{l}</div></div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT panel */}
      <div style={{width:step==="role"?"min(620px,100vw)":"min(480px,100vw)",background:"var(--bg-secondary)",display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 52px",position:"relative",overflowY:"auto",transition:"width .3s ease"}}>

        {/* ── STEP 1: Credentials ─────────── */}
        {step==="credentials"&&(<>
          <h3 style={{fontSize:28,fontWeight:800,color:C.black,marginBottom:6,letterSpacing:"-.5px"}}>Sign in</h3>
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
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span className="lbl" style={{fontSize:9}}>Password</span><span style={{fontSize:12,color:C.purple,cursor:"pointer"}}>Forgot password?</span></div>
              <input className="u-input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"/>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.warm,cursor:"pointer"}}><input type="checkbox" defaultChecked style={{accentColor:C.purple}}/> Remember me</label>
          </div>
          <button className="btn-purple" disabled={loading} onClick={handleSignIn} style={{width:"100%",padding:"15px",marginBottom:20,fontSize:13,borderRadius:10}}>
            {loading?<><Spin/>Signing in…</>:`Sign in to ${tab==="web"?"Web App →":"Desktop →"}`}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><div style={{flex:1,height:1,background:C.tanL}}/><span style={{fontSize:12,color:C.warm}}>or continue with</span><div style={{flex:1,height:1,background:C.tanL}}/></div>
          {[["🏢","Sign in with Google Workspace"],["💎","Sign in with Microsoft 365"]].map(([icon,label])=>(
            <button key={label} style={{width:"100%",padding:"12px",border:`1.5px solid ${C.tanL}`,borderRadius:10,background:"transparent",color:C.black,fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,cursor:"pointer"}}>{icon} {label}</button>
          ))}
          <p style={{textAlign:"center",fontSize:13,color:C.warm,marginTop:20}}>Don't have an account? <span style={{color:C.black,fontWeight:700,cursor:"pointer"}}>Contact your district admin</span></p>
          <p onClick={onBack} style={{textAlign:"center",fontSize:12,color:C.warm,marginTop:8,cursor:"pointer"}}>← Back to website</p>
        </>)}

        {/* ── STEP 2: Role Selection ───────── */}
        {step==="role"&&(<>
          <div style={{marginBottom:28}}>
            <p style={{fontSize:12,color:C.warm,marginBottom:4}}>Signed in as <b style={{color:C.black}}>{email}</b></p>
            <h3 style={{fontSize:26,fontWeight:800,color:C.black,letterSpacing:"-.5px"}}>Select your role</h3>
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
    {group:"DISTRICT",items:[{id:"dashboard",label:"Admin Dashboard",icon:"🏛"},{id:"students",label:"All Students",icon:"👥"}]},
    {group:"MANAGEMENT",items:[{id:"reports",label:"District Reports",icon:"📊"},{id:"notifications",label:"Alerts & Notices",icon:"🔔",badge:"5"},{id:"settings",label:"System Settings",icon:"⚙️"}]},
    {group:"COMPLIANCE",items:[{id:"reports",label:"Audit Trail",icon:"🔍"},{id:"create",label:"Export All Data",icon:"📤"}]},
  ],
  leadership:[
    {group:"OVERVIEW",items:[{id:"dashboard",label:"Leadership Dashboard",icon:"👔"},{id:"students",label:"All Students",icon:"👥"}]},
    {group:"PLANS",items:[{id:"builder",label:"ALP Builder",icon:"✏️"},{id:"review",label:"Review Schedule",icon:"✅"},{id:"future",label:"Future Readiness",icon:"🎯"}]},
    {group:"REPORTS",items:[{id:"reports",label:"School Reports",icon:"📊"},{id:"notifications",label:"Notifications",icon:"🔔",badge:"3"}]},
    {group:"COLLABORATION",items:[{id:"family",label:"Family Portal",icon:"❤️"},{id:"settings",label:"Settings",icon:"⚙️"}]},
  ],
  teacher:[
    {group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"My Students",icon:"👥"}]},
    {group:"ALP BUILDER",items:[{id:"builder",label:"ALP Builder",icon:"✏️",badge:"New"},{id:"progress",label:"Progress",icon:"📈"}]},
    {group:"WORKFLOW",items:[{id:"future",label:"Future Readiness",icon:"🎯"},{id:"review",label:"Review Summary",icon:"✅"},{id:"notice",label:"ALP Notice",icon:"⚠️"},{id:"create",label:"Create ALP Doc",icon:"📄"}]},
    {group:"COLLABORATION",items:[{id:"family",label:"Family Portal",icon:"❤️"},{id:"reports",label:"Reports",icon:"📊"},{id:"notifications",label:"Notifications",icon:"🔔",badge:"4"},{id:"settings",label:"Settings",icon:"⚙️"}]},
  ],
  intervention:[
    {group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"My Caseload",icon:"👥"}]},
    {group:"RTI",items:[{id:"progress",label:"Progress Monitoring",icon:"📈"},{id:"builder",label:"Intervention Plans",icon:"✏️"}]},
    {group:"WORKFLOW",items:[{id:"review",label:"Review Summary",icon:"✅"},{id:"reports",label:"Effectiveness Reports",icon:"📊"}]},
    {group:"COLLABORATION",items:[{id:"family",label:"Family Portal",icon:"❤️"},{id:"notifications",label:"Alerts",icon:"🔔",badge:"2"},{id:"settings",label:"Settings",icon:"⚙️"}]},
  ],
  related:[
    {group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"My Students",icon:"👥"}]},
    {group:"SERVICES",items:[{id:"progress",label:"Goal Progress",icon:"📈"},{id:"builder",label:"Session Notes",icon:"✏️"}]},
    {group:"REPORTS",items:[{id:"reports",label:"Service Reports",icon:"📊"},{id:"notifications",label:"Notifications",icon:"🔔"}]},
    {group:"COLLABORATION",items:[{id:"family",label:"Family Portal",icon:"❤️"},{id:"settings",label:"Settings",icon:"⚙️"}]},
  ],
  family:[
    {group:"MY CHILD",items:[{id:"family",label:"Messages",icon:"💬"},{id:"progress",label:"Progress",icon:"📈"}]},
    {group:"DOCUMENTS",items:[{id:"create",label:"Documents",icon:"📄"},{id:"notice",label:"My Rights",icon:"📋"}]},
  ],
  student:[
    {group:"MY LEARNING",items:[{id:"dashboard",label:"My ALP",icon:"🎓"},{id:"progress",label:"My Goals",icon:"🎯"}]},
    {group:"SUPPORT",items:[{id:"family",label:"My Team",icon:"❤️"}]},
  ],
};

const ROLE_USERS = {
  admin:      {name:"Dr. Abena Sarpong",  sub:"District Administrator"},
  leadership: {name:"Principal Owusu",    sub:"Westwood Elementary"},
  teacher:    {name:"Ms. Simmons",        sub:"Special Ed · Westwood"},
  intervention:{name:"Mr. Kofi Mensah",  sub:"Intervention Specialist"},
  related:    {name:"Ms. Rivera",         sub:"Speech-Language Pathologist"},
  family:     {name:"Patricia Johnson",   sub:"Parent · Marcus Johnson"},
  student:    {name:"Marcus Johnson",     sub:"Grade 4 · Student"},
};

const NAV = NAV_BY_ROLE.teacher; // legacy fallback

function Sidebar({page,setPage}){
  return(
    <aside className="sidebar">
      <div style={{padding:"20px 18px 16px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:36,height:36,borderRadius:9,objectFit:"cover",flexShrink:0}}/>
          <div><div className="serif" style={{fontSize:14,fontWeight:700,color:C.cream,lineHeight:1}}>ALP</div><div style={{fontSize:8,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".1em",marginTop:1}}>ACCELERATED LEARNING PROGRAM</div></div>
        </div>
      </div>
      <nav style={{flex:1,overflowY:"auto",padding:"14px 10px"}}>
        {NAV.map(g=>(
          <div key={g.group} style={{marginBottom:22}}>
            <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:".14em",textTransform:"uppercase",padding:"0 12px 8px"}}>{g.group}</p>
            {g.items.map(item=>(
              <button key={item.id} onClick={()=>setPage(item.id)} className={`nav-item${page===item.id?" active":""}`}>
                <span style={{fontSize:14,width:18,textAlign:"center",flexShrink:0}}>{item.icon}</span>
                <span style={{flex:1}}>{item.label}</span>
                {item.badge&&<span style={{fontSize:9,fontWeight:700,background:C.purple,color:"#fff",padding:"2px 7px",borderRadius:99}}>{item.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:10}}>
        <Avatar name="Ms Simmons" size={32}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12.5,fontWeight:600,color:C.cream,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Ms. Simmons</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>Special Ed · Westwood</div></div>
        <button style={{color:"rgba(255,255,255,.4)",fontSize:16}}>⚙</button>
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
          <h1 className="serif" style={{fontSize:isMobile?22:isTablet?26:30,fontWeight:700,letterSpacing:"-.5px",lineHeight:1.1}}>{title}</h1>
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
function Dashboard({setPage}){
  const {role,roleData}=useRole();
  const {isMobile,isTablet}=useResponsive();
  const cols4=isMobile?"1fr 1fr":isTablet?"1fr 1fr":"repeat(4,1fr)";
  const cols3=isMobile?"1fr":isTablet?"1fr 1fr":"repeat(3,1fr)";
  const colsStudents=isMobile?"1fr":isTablet?"1fr":"1.4fr 1fr 1fr";

  // ── Admin Dashboard ─────────────────────────────────────
  if(role==="admin") return(
    <Page title={<>Admin <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Dashboard</span></>} subtitle="District Overview · Westwood Unified School District" action={<button className="btn-black" style={{fontSize:11,padding:"11px 24px"}}>+ Add School</button>}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
        {[["TOTAL SCHOOLS","12","3 districts",C.blue,"🏫"],["TOTAL STUDENTS","1,847","↑ 142 this year",C.purple,"👥"],["ACTIVE ALPs","284","18 due for review",C.green,"📋"],["COMPLIANCE RATE","94%","↑ 2% vs last year",C.amber,"✅"]].map(([l,v,s,c,ic])=>(
          <div key={l} className="card" style={{padding:"22px 24px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:16,right:18,fontSize:22,opacity:.15}}>{ic}</div>
            <p className="lbl" style={{marginBottom:12}}>{l}</p>
            <div className="serif" style={{fontSize:34,fontWeight:700,color:c,lineHeight:1,letterSpacing:"-1px"}}>{v}</div>
            <p style={{fontSize:12,color:C.warm,marginTop:5}}>{s}</p>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:20,marginBottom:20}}>
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:18}}>Schools Overview</h3>
          <table className="data-table" style={{minWidth:520}}>
            <thead><tr>{["School","Students","ALPs","Compliance","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {[["Westwood Elementary","142","38","98%","green"],["Riverside High School","389","64","91%","green"],["Oakdale Middle School","276","49","87%","amber"],["Sunrise Academy","198","33","72%","red"],["North Valley K-12","421","71","96%","green"]].map(([school,students,alp,comp,color])=>(
                <tr key={school} style={{cursor:"pointer"}}>
                  <td style={{fontWeight:600}}>{school}</td>
                  <td style={{color:C.warm}}>{students}</td>
                  <td style={{color:C.warm}}>{alp}</td>
                  <td><span style={{fontWeight:700,color:color==="green"?C.green:color==="amber"?C.amber:C.red}}>{comp}</span></td>
                  <td><Badge color={color}>{color==="green"?"Compliant":color==="amber"?"Review":"At Risk"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="card" style={{padding:"22px 24px"}}>
            <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Compliance Alerts</h3>
            {[["Oakdale Middle","87% compliance — 6 plans overdue","amber"],["Sunrise Academy","72% compliance — 9 plans at risk","red"],["Riverside High","2 reevaluations overdue","amber"]].map(([school,msg,color])=>(
              <div key={school} style={{padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}>
                <div style={{fontSize:12.5,fontWeight:700,color:C[color]||C.amber}}>{school}</div>
                <div style={{fontSize:11.5,color:C.warm}}>{msg}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:"22px 24px"}}>
            <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Users & Roles</h3>
            {ROLES.slice(0,5).map(r=>(
              <div key={r.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}><span>{r.icon}</span><span style={{fontSize:12.5,color:C.black}}>{r.label}</span></div>
                <span style={{fontSize:12,fontWeight:700,color:C.purple}}>{[24,8,67,12,18][ROLES.indexOf(r)]}</span>
              </div>
            ))}
            <button className="btn-ghost" style={{width:"100%",marginTop:12,fontSize:11}} onClick={()=>setPage("settings")}>Manage Users →</button>
          </div>
        </div>
      </div>
    </Page>
  );

  // ── School Leadership Dashboard ──────────────────────────
  if(role==="leadership") return(
    <Page title={<>Leadership <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Dashboard</span></>} subtitle="Westwood Elementary · Spring 2026" action={<button className="btn-black" onClick={()=>setPage("reports")} style={{fontSize:11,padding:"11px 24px"}}>School Report</button>}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
        {[["STUDENTS","142","38 with active plans",C.purple,"👥"],["STAFF","14","6 special ed teachers",C.blue,"👔"],["COMPLIANCE","98%","↑ 2% this quarter",C.green,"✅"],["NEEDS REVIEW","4","within 30 days",C.amber,"📅"]].map(([l,v,s,c,ic])=>(
          <div key={l} className="card" style={{padding:"22px 24px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:16,right:18,fontSize:22,opacity:.15}}>{ic}</div>
            <p className="lbl" style={{marginBottom:12}}>{l}</p>
            <div className="serif" style={{fontSize:34,fontWeight:700,color:c,lineHeight:1,letterSpacing:"-1px"}}>{v}</div>
            <p style={{fontSize:12,color:C.warm,marginTop:5}}>{s}</p>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20}}>
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Staff Caseloads</h3>
          {[["Ms. Simmons","14 students","ALP Coordinator"],["Mr. Chen","11 students","Special Ed"],["Ms. Rivera","18 students","Speech-Language"],["Mr. Kofi","9 students","OT Services"]].map(([name,load,role])=>(
            <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:C.black}}>{name}</div><div style={{fontSize:11,color:C.warm}}>{role}</div></div>
              <Badge color={parseInt(load)>15?"amber":"green"}>{load}</Badge>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Compliance Status</h3>
          {[["IDEA Federal","✓ Compliant","green"],["Annual Reviews","4 pending","amber"],["Section 504","✓ All current","green"],["Reevaluation","2 overdue","red"],["Transition Plans","✓ On track","green"]].map(([label,status,color])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}>
              <span style={{fontSize:13,color:C.black}}>{label}</span>
              <Badge color={color}>{status}</Badge>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>School Metrics</h3>
          {[["On-Track Goals","74%",C.green],["Family Engagement","89%",C.purple],["Review Completion","96%",C.blue],["Avg Goal Progress","71%",C.amber]].map(([label,v,c])=>(
            <div key={label} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:12.5,color:C.black}}>{label}</span>
                <span style={{fontSize:13,fontWeight:700,color:c}}>{v}</span>
              </div>
              <PBar value={parseInt(v)} color={c}/>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );

  // ── Default: Teacher / Intervention / Related Dashboard ──
  const students=[
    {name:"Marcus Johnson",grade:"Grade 4 · ASD",plan:"ALP",planC:"purple",status:"On track",velocity:"↑"},
    {name:"Sofia Lee",grade:"Grade 2 · Dyslexia",plan:"RTI-II",planC:"blue",status:"Review",velocity:"↓"},
    {name:"Tyler Parker",grade:"Grade 6 · ADHD",plan:"504",planC:"amber",status:"On track",velocity:"→"},
    {name:"Aisha Adeyemi",grade:"Grade 3 · Speech/Lang",plan:"ALP",planC:"purple",status:"Attention",velocity:"↓"},
  ];
  const domains=[{n:"Reading",v:82},{n:"Math",v:68},{n:"Communication",v:75},{n:"Social-Emotional",v:59},{n:"Future Readiness",v:88}];
  const aiInsights=[
    {icon:"⚠️",color:C.red,tag:"REGRESSION ALERT",title:"Sofia Lee — Reading Declining",body:"3 consecutive weekly probes show declining scores (68→62→58 wcpm). ALP AI recommends increasing intervention frequency to 4x/week and adjusting instructional approach.",action:"View Student"},
    {icon:"🎯",color:C.purple,tag:"ALP AI PREDICTION",title:"Marcus Johnson — Goal on Track",body:"87% probability of achieving 80 wcpm reading goal by May 2027. Current trajectory: +4 wcpm/month. ALP AI recommends maintaining current intervention intensity.",action:"View Progress"},
    {icon:"📅",color:C.amber,tag:"COMPLIANCE ALERT",title:"4 ALPs Due for Review",body:"Annual review deadlines approaching in the next 30 days: Johnson (14 days), Adeyemi (22 days), Williams (26 days), Mensah (29 days). Schedule team meetings now.",action:"View Reports"},
  ];
  const alerts=[
    {icon:"📉",color:C.red,label:"Regression Detected",body:"Sofia Lee · Reading · 3 consecutive declines",urgent:true},
    {icon:"⏰",color:C.red,label:"Review Overdue",body:"Ryan Chen · Annual ALP Review · 3 days past due",urgent:true},
    {icon:"⚠️",color:C.amber,label:"Goal At Risk",body:"Aisha Adeyemi · Communication · Below trajectory",urgent:false},
    {icon:"✍️",color:C.purple,label:"Signature Pending",body:"Marcus Johnson's ALP · Patricia Johnson",urgent:false},
  ];
  return(
    <Page title={<>Dashboard</>} subtitle="Spring 2026 · Westwood Elementary" action={<button className="btn-black" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"11px 24px"}}>+ New ALP</button>}>

      {/* ── Row 1: Key Metrics ─────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:cols4,gap:isMobile?10:16,marginBottom:isMobile?16:24}}>
        {[["TOTAL STUDENTS","142","↑ 8 from last year",C.purple,"👥"],["ACTIVE ALPs","38","4 due for review",C.blue,"📋"],["ON-TRACK GOALS","74%","↓ 3% this quarter",C.green,"🎯"],["NEEDS ATTENTION","11","Immediate review",C.red,"⚠️"]].map(([l,v,s,c,ic])=>(
          <div key={l} className="card" style={{padding:"22px 24px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:16,right:18,fontSize:22,opacity:.15}}>{ic}</div>
            <p className="lbl" style={{marginBottom:12}}>{l}</p>
            <div className="serif" style={{fontSize:36,fontWeight:700,color:c,lineHeight:1,letterSpacing:"-1px"}}>{v}</div>
            <p style={{fontSize:12,color:C.warm,marginTop:5}}>{s}</p>
          </div>
        ))}
      </div>

      {/* ── Row 2: ALP AI Insights ─────────────── */}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <p className="lbl" style={{color:C.purple}}>✦ ALP AI Insights</p>
          <span style={{fontSize:11,color:C.warm}}>Real-time intelligence · Updated 5 min ago</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:cols3,gap:isMobile?10:16}}>
          {aiInsights.map((ins,i)=>(
            <div key={i} className="card" style={{padding:"20px 22px",borderLeft:`4px solid ${ins.color}`}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                <span style={{fontSize:16}}>{ins.icon}</span>
                <span style={{fontSize:10,fontWeight:700,color:ins.color,letterSpacing:".1em"}}>{ins.tag}</span>
              </div>
              <p style={{fontSize:13.5,fontWeight:700,color:C.black,marginBottom:8,lineHeight:1.3}}>{ins.title}</p>
              <p style={{fontSize:12,color:C.warm,lineHeight:1.6,marginBottom:14}}>{ins.body}</p>
              <button className="btn-ghost" style={{fontSize:11,padding:"6px 14px"}} onClick={()=>setPage(i===0?"students":i===1?"progress":"reports")}>{ins.action} →</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 3: Students + Alerts + Family ──── */}
      <div style={{display:"grid",gridTemplateColumns:colsStudents,gap:isMobile?10:16,marginBottom:isMobile?12:20}}>

        {/* Recent Students */}
        <div className="card" style={{padding:"24px 26px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 className="serif" style={{fontSize:16,fontWeight:700}}>Recent Students</h3>
            <span onClick={()=>setPage("students")} style={{fontSize:12,color:C.purple,cursor:"pointer",fontWeight:600}}>See all →</span>
          </div>
          {students.map((s,i)=>(
            <div key={s.name} onClick={()=>setPage("students")} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<students.length-1?`1px solid ${C.tanL}`:"none",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background=C.purpleL}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <Avatar name={s.name} size={34}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13.5,fontWeight:600,color:C.black}}>{s.name}</div>
                <div style={{fontSize:11.5,color:C.warm,marginTop:1}}>{s.grade}</div>
              </div>
              <span style={{fontSize:13,color:s.velocity==="↑"?C.green:s.velocity==="↓"?C.red:C.warm,fontWeight:700}}>{s.velocity}</span>
              <Badge color={s.planC}>{s.plan}</Badge>
              <Dot s={s.status}/>
            </div>
          ))}
        </div>

        {/* Alerts & Regression */}
        <div className="card" style={{padding:"24px 26px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <h3 className="serif" style={{fontSize:16,fontWeight:700}}>Alerts</h3>
            <span style={{fontSize:10,fontWeight:700,background:C.red,color:"#fff",padding:"2px 8px",borderRadius:99}}>4</span>
          </div>
          {alerts.map((a,i)=>(
            <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:i<alerts.length-1?`1px solid ${C.tanL}`:"none",alignItems:"flex-start"}}>
              <div style={{width:32,height:32,borderRadius:8,background:a.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{a.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:700,color:a.urgent?a.color:C.black,marginBottom:2}}>{a.label}</div>
                <div style={{fontSize:11.5,color:C.warm,lineHeight:1.4}}>{a.body}</div>
              </div>
            </div>
          ))}
          <button className="btn-ghost" style={{width:"100%",marginTop:14,fontSize:11}}>View All Alerts</button>
        </div>

        {/* Family Engagement */}
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Family Engagement</h3>
          {[["💬","Messages","2 unread",C.blue],["✍️","Signatures Pending","3 required",C.purple],["📅","Meetings This Week","1 scheduled",C.green],["👁","Portal Views (7d)","8 family logins",C.amber]].map(([icon,label,val,c])=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}>
              <span style={{fontSize:18,width:28,textAlign:"center"}}>{icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12.5,fontWeight:600,color:C.black}}>{label}</div>
                <div style={{fontSize:11.5,color:c,fontWeight:600,marginTop:1}}>{val}</div>
              </div>
            </div>
          ))}
          <button className="btn-purple" style={{width:"100%",marginTop:14,fontSize:11}} onClick={()=>setPage("family")}>Open Family Portal →</button>
        </div>
      </div>

      {/* ── Row 4: Goal Progress + Compliance + Future Readiness ── */}
      <div style={{display:"grid",gridTemplateColumns:cols3,gap:isMobile?10:16}}>

        {/* Goal Progress by Domain */}
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Goal Progress by Domain</h3>
          {domains.map(d=>(
            <div key={d.n} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:500,color:C.black}}>{d.n}</span>
                <span style={{fontSize:13,fontWeight:700,color:d.v>=75?C.green:d.v>=60?C.amber:C.red}}>{d.v}%</span>
              </div>
              <PBar value={d.v} color={d.v>=75?C.purple:d.v>=60?C.amber:C.red}/>
            </div>
          ))}
          <button className="btn-ghost" style={{width:"100%",marginTop:8,fontSize:11}} onClick={()=>setPage("progress")}>View Full Progress →</button>
        </div>

        {/* Compliance Summary */}
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Compliance</h3>
          {[["IDEA Federal","All 38 ALPs compliant","green"],["Annual Reviews","4 pending in 30 days","amber"],["Section 504 / ADA","All 7 plans current","green"],["Reevaluation","2 students overdue","red"],["Ghana GES","3 plans compliant","green"]].map(([label,sub,color])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}>
              <div>
                <div style={{fontSize:12.5,fontWeight:600,color:C.black}}>{label}</div>
                <div style={{fontSize:11,color:C.warm,marginTop:1}}>{sub}</div>
              </div>
              <Badge color={color}>{color==="green"?"✓":color==="amber"?"!":"✗"}</Badge>
            </div>
          ))}
          <button className="btn-ghost" style={{width:"100%",marginTop:8,fontSize:11}} onClick={()=>setPage("reports")}>Full Report →</button>
        </div>

        {/* Future Readiness Widget */}
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:4}}>Future Readiness</h3>
          <p style={{fontSize:12,color:C.warm,marginBottom:18}}>ALP AI · Predictive Transition Analytics</p>
          {[{n:"Marcus Johnson",score:88,color:C.green,label:"On Track"},
            {n:"Aisha Adeyemi",score:61,color:C.amber,label:"Needs Planning"},
            {n:"Ryan Chen",score:74,color:C.purple,label:"Developing"}].map(s=>(
            <div key={s.n} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:12.5,fontWeight:600,color:C.black}}>{s.n}</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.score}%</span>
                  <Badge color={s.color==="green"?s.color:s.color===C.amber?"amber":"purple"}>{s.label}</Badge>
                </div>
              </div>
              <PBar value={s.score} color={s.color}/>
            </div>
          ))}
          <button className="btn-ghost" style={{width:"100%",marginTop:8,fontSize:11}} onClick={()=>setPage("future")}>View Transition Plans →</button>
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// STUDENTS + STUDENT DETAIL
// ═══════════════════════════════════════════════════════════
function Students({setPage}){
  const [q,setQ]=useState("");const [f,setF]=useState("All");const [sel,setSel]=useState(null);
  const all=[{name:"Marcus Johnson",grade:"4th",cat:"ASD",plan:"ALP",planC:"purple",status:"On track",review:"May 2026",disability:"Autism Spectrum Disorder",dob:"March 12, 2016",teacher:"Ms. Simmons"},{name:"Sofia Lee",grade:"2nd",cat:"Dyslexia",plan:"RTI-II",planC:"blue",status:"Review",review:"Apr 2026",disability:"Dyslexia",dob:"July 22, 2018",teacher:"Ms. Simmons"},{name:"Tyler Parker",grade:"6th",cat:"ADHD",plan:"504",planC:"amber",status:"On track",review:"Mar 2026",disability:"ADHD",dob:"Nov 5, 2014",teacher:"Mr. Chen"},{name:"Aisha Adeyemi",grade:"3rd",cat:"Speech/Lang",plan:"ALP",planC:"purple",status:"Attention",review:"Feb 2026",disability:"Speech/Language",dob:"Apr 18, 2017",teacher:"Ms. Simmons"},{name:"Ryan Chen",grade:"5th",cat:"Intellectual",plan:"ALP",planC:"purple",status:"Attention",review:"Apr 2026",disability:"Intellectual Disability",dob:"Sep 30, 2015",teacher:"Ms. Simmons"},{name:"Emma Williams",grade:"1st",cat:"Hearing",plan:"ALP",planC:"purple",status:"On track",review:"May 2026",disability:"Hearing Impairment",dob:"Jan 14, 2019",teacher:"Mr. Chen"},{name:"Kofi Mensah",grade:"3rd",cat:"Dyslexia",plan:"RTI-I",planC:"blue",status:"On track",review:"May 2026",disability:"Dyslexia",dob:"Jun 2, 2017",teacher:"Ms. Simmons"},{name:"Ama Osei",grade:"5th",cat:"ADHD",plan:"504",planC:"amber",status:"Review",review:"Apr 2026",disability:"ADHD",dob:"Feb 28, 2015",teacher:"Mr. Chen"}];
  const rows=all.filter(s=>(!q||s.name.toLowerCase().includes(q.toLowerCase())||s.cat.toLowerCase().includes(q.toLowerCase()))&&(f==="All"||s.plan===f||(f==="RTI"&&s.plan.startsWith("RTI"))));

  if(sel){
    const s=sel;
    const [activeTab,setActiveTab]=useState("overview");
    return(
      <Page title={<>{s.name}</>} subtitle={`Grade ${s.grade.replace("th","").replace("nd","").replace("rd","").replace("st","")} · ${s.disability} · ${s.plan}`}
        action={<div style={{display:"flex",gap:10}}><button className="btn-ghost" onClick={()=>setSel(null)} style={{fontSize:11}}>← All Students</button><button className="btn-black" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"11px 24px"}}>Edit ALP</button></div>}>
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
                <div style={{fontSize:11,fontWeight:700,color:C.green,marginBottom:4}}>COMPLIANCE STATUS</div>
                <div style={{fontSize:13,color:C.green}}>✓ Compliant · All 13 sections complete</div>
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
              {[["Parent/Guardian","Patricia Johnson"],["Relationship","Mother"],["Phone","(703) 555-0189"],["Email","patricia.j@gmail.com"],["Language","English (primary)"],["Portal account","Active · Last login May 6"],["Preferred contact","Portal message · Evenings"]].map(([k,v])=>(
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
              {[{name:"Ms. Simmons",role:"ALP Coordinator & Special Ed",icon:"👩‍🏫",color:C.purple},{name:"Ms. Rivera",role:"Speech-Language Pathologist",icon:"🩺",color:C.green},{name:"Mr. Chen",role:"Occupational Therapist",icon:"🤝",color:C.blue},{name:"Mr. Davis",role:"General Education Teacher",icon:"📚",color:C.amber},{name:"Dr. Kim",role:"School Psychologist",icon:"🧠",color:C.red}].map(member=>(
                <div key={member.name} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}>
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
            <p style={{fontSize:13,color:C.warm}}>{activeTab==="services"?"Special Education · Speech-Language · OT · Extended Time":"ALP_Marcus_2026.pdf · Evaluation_2024.pdf · Progress_Q3.pdf"}</p>
          </div>
        )}
      </Page>
    );
  }

  return(
    <Page title={<>Students</>} subtitle={`${all.length} enrolled · 38 with active plans`} action={<button className="btn-black" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"11px 24px"}}>+ New ALP</button>}>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${C.tanL}`,display:"flex",gap:14,alignItems:"center"}}>
          <div style={{flex:1,position:"relative"}}><span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.warm,fontSize:14}}>🔍</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search students..." style={{width:"100%",padding:"9px 12px 9px 34px",border:`1px solid ${C.tanL}`,borderRadius:99,fontSize:13,color:C.black,outline:"none",background:C.purpleL,fontFamily:"'DM Sans',sans-serif",transition:"border-color .15s"}} onFocus={e=>e.target.style.borderColor=C.black} onBlur={e=>e.target.style.borderColor=C.tanL}/></div>
          <div style={{display:"flex",gap:6}}>{["All","ALP","RTI","504"].map(fi=><button key={fi} onClick={()=>setF(fi)} className={f===fi?"btn-black":"btn-ghost"} style={{padding:"8px 18px",fontSize:11}}>{fi}</button>)}</div>
        </div>
        <table className="data-table" style={{minWidth:520}}>
          <thead><tr>{["Student","Grade","Category","Plan","Status","Last Review",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(s=><tr key={s.name} style={{cursor:"pointer"}} onClick={()=>setSel(s)}>
            <td><div style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={s.name} size={34}/><span style={{fontWeight:600}}>{s.name}</span></div></td>
            <td style={{color:C.warm}}>{s.grade}</td><td><Badge color="gray">{s.cat}</Badge></td><td><Badge color={s.planC}>{s.plan}</Badge></td>
            <td><div style={{display:"flex",alignItems:"center",gap:7}}><Dot s={s.status}/>{s.status}</div></td>
            <td style={{color:C.warm}}>{s.review}</td>
            <td><button className="btn-ghost" style={{padding:"7px 16px",fontSize:11}} onClick={e=>{e.stopPropagation();setSel(s);}}>View ALP</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// ALP BUILDER
// ═══════════════════════════════════════════════════════════
function ALPBuilder({setPage}){
  const [step,setStep]=useState(1);
  const [showAI,setShowAI]=useState(false);
  const [goals,setGoals]=useState([
    {domain:"READING",color:C.red,text:"By May 2027, Marcus will read grade 3-level text aloud with 90% accuracy (at least 80 wcpm) across 4 consecutive weekly probes, measured by CBM assessments.",baseline:"52 wcpm",target:"80 wcpm",monitoring:"Quarterly"},
    {domain:"COMMUNICATION",color:C.purple,text:"By May 2027, Marcus will initiate and maintain a 3-turn conversation with a peer on a preferred topic in 4 of 5 observed opportunities.",baseline:"1-turn",target:"3-turn",monitoring:"Monthly"},
    {domain:"SOCIAL-EMOTIONAL",color:C.amber,text:"By May 2027, Marcus will use a self-regulation strategy independently when identifying frustration in 4 of 5 daily opportunities.",baseline:"Prompted",target:"Independent",monitoring:"Weekly"},
  ]);
  const [relServices,setRelServices]=useState([
    {type:"Speech-Language Pathology",freq:"2x/week",duration:"30 min",location:"Pull-out",provider:"Ms. Rivera"},
    {type:"Occupational Therapy",freq:"1x/week",duration:"30 min",location:"Pull-out",provider:"Mr. Chen"},
  ]);
  const [hasBIP,setHasBIP]=useState(false);
  const [teamMembers,setTeamMembers]=useState([
    {name:"Ms. Simmons",role:"ALP Coordinator",present:true},
    {name:"Patricia Johnson",role:"Parent/Guardian",present:true},
    {name:"Mr. Davis",role:"General Ed Teacher",present:true},
    {name:"Ms. Rivera",role:"Speech-Language Pathologist",present:false},
  ]);
  const steps=["Student Information","Present Levels","Annual Goals","Services","Related Services","Accommodations","Learning Environment","Assessment Participation","Transition Planning","Behavior Support","Early Intervention","Team Collaboration","Family Rights & Safeguards"];
  const student={name:"Marcus Johnson",grade:"4",disability:"Autism Spectrum Disorder"};
  function addGoal(g,domain){const colors={READING:C.red,MATH:C.green,WRITING:C.blue,COMMUNICATION:C.purple,SOCIAL_EMOTIONAL:C.amber,BEHAVIOR:"#F97316"};setGoals(p=>[...p,{domain,color:colors[domain]||C.purple,text:g.goalText,baseline:g.baseline,target:g.target,monitoring:g.monitoring}]);}
  function next(){if(step===13){setPage("review");return;}setStep(s=>s+1);}
  function back(){if(step===1)return;setStep(s=>s-1);}
  const completion=Math.round((step-1)/13*100);
  const SH=({n,title,sub})=>(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><div><p className="lbl" style={{marginBottom:6}}>Section {n} of 13</p><h2 className="serif" style={{fontSize:22,fontWeight:700}}>{title} <span className="serif-italic" style={{color:C.warm}}>{sub}</span></h2></div></div>);
  return(
    <Page title={<>ALP Builder <span className="serif-italic" style={{color:C.warm,fontSize:24}}>— {steps[step-1]}</span></>} subtitle={`Marcus Johnson · Grade 4 · Autism Spectrum Disorder · Section ${step} of 13`} action={<button className="btn-black" onClick={()=>setPage("students")} style={{fontSize:11,padding:"11px 24px"}}>All Students</button>}>
      {showAI&&<AIModal student={student} onAdd={addGoal} onClose={()=>setShowAI(false)}/>}
      <div className="r-stack" style={{display:"flex",gap:20,alignItems:"flex-start"}}>
        <div style={{width:214,flexShrink:0,background:"var(--sidebar-bg)",borderRadius:14,padding:16}}>
          <div style={{marginBottom:12}}>
            <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",letterSpacing:".14em",textTransform:"uppercase",marginBottom:8}}>Progress</p>
            <div style={{height:3,background:"rgba(255,255,255,.1)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${completion}%`,background:C.purple,borderRadius:99,transition:"width .6s ease"}}/></div>
            <p style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:5}}>{step-1} of 13 complete</p>
          </div>
          {steps.map((s,i)=>{const n=i+1,done=n<step,active=n===step;return(<button key={s} onClick={()=>setStep(n)} className={`step-item${active?" active":done?" done":""}`}><div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,background:done?C.green:active?C.purple:"rgba(255,255,255,.08)",color:done||active?"#fff":C.warm}}>{done?"✓":n}</div><span style={{fontSize:11}}>{s}</span></button>);})}
        </div>
        <div className="card" style={{flex:1,padding:"30px 32px",minWidth:0}}>
          {step===1&&<div><SH n={1} title="Student" sub="Information"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:20}}>
              <UInput label="Student Full Name" value="Marcus Darnell Johnson" onChange={()=>{}}/><UInput label="Date of Birth" value="2016-03-12" type="date" onChange={()=>{}}/>
              <UInput label="Student ID" value="WE-2024-0142" onChange={()=>{}}/><USelect label="Grade Level" value="4" onChange={()=>{}} options={[{value:"K",label:"Kindergarten"},...Array.from({length:12},(_,i)=>({value:`${i+1}`,label:`Grade ${i+1}`}))]}/>
              <USelect label="Primary Disability" value="AUTISM" onChange={()=>{}} options={[{value:"AUTISM",label:"Autism Spectrum Disorder"},{value:"ADHD",label:"ADHD"},{value:"DYSLEXIA",label:"Dyslexia"},{value:"SPEECH",label:"Speech/Language Impairment"},{value:"INTELLECTUAL",label:"Intellectual Disability"},{value:"HEARING",label:"Hearing Impairment"},{value:"VISUAL",label:"Visual Impairment"},{value:"PHYSICAL",label:"Physical/Orthopedic"},{value:"TBI",label:"Traumatic Brain Injury"},{value:"EMOTIONAL",label:"Emotional/Behavioral"},{value:"MULTIPLE",label:"Multiple Disabilities"},{value:"DEVELOPMENTAL",label:"Developmental Delay"},{value:"OTHER_HI",label:"Other Health Impairment"}]}/>
              <USelect label="Program Type" value="ALP" onChange={()=>{}} options={[{value:"ALP",label:"ALP (Adaptive Learning Program)"},{value:"RTI_I",label:"RTI Tier I"},{value:"RTI_II",label:"RTI Tier II"},{value:"RTI_III",label:"RTI Tier III"},{value:"504",label:"Section 504"},{value:"IEP",label:"IEP"}]}/>
              <UInput label="Effective Date" value="2026-05-08" type="date" onChange={()=>{}}/><UInput label="Annual Review Date" value="2027-05-08" type="date" onChange={()=>{}}/>
              <UInput label="School" value="Westwood Elementary School" onChange={()=>{}}/><UInput label="ALP Coordinator" value="Ms. Simmons" onChange={()=>{}}/>
              <UInput label="Parent/Guardian" value="Patricia Johnson" onChange={()=>{}}/><UInput label="Primary Language" value="English" onChange={()=>{}}/>
            </div>
            <div style={{background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:10,padding:14}}>
              <p className="lbl" style={{color:C.purple,marginBottom:10}}>Intervention Tier</p>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {["Tier 1 — Universal","Tier 2 — Targeted","Tier 3 — Intensive","ALP (Full Program)"].map(t=>(<label key={t} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}><input type="radio" name="tier" defaultChecked={t.includes("ALP")} style={{accentColor:C.purple}}/>{t}</label>))}
              </div>
            </div>
          </div>}
          {step===2&&<div><SH n={2} title="Present" sub="Levels of Performance"/>
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              {[["Academic — Reading","Marcus reads at a 2nd grade level with 52 wcpm on grade 3 probes. Strong phonemic awareness but struggles with fluency and comprehension."],["Academic — Math","Marcus understands addition and subtraction facts. Struggles with multi-step word problems and place value above 100."],["Academic — Writing","Marcus produces 2-3 sentence paragraphs with support. Difficulty with sentence structure, punctuation, and organizing ideas independently."],["Communication Skills","Marcus initiates 1-turn conversations using 3-4 word sentences. Needs support with sustained peer interaction and topic maintenance."],["Social-Emotional Functioning","Marcus needs adult prompting to identify and regulate emotions, particularly frustration. Benefits from visual supports and structured routines."],["Motor Skills","Age-appropriate gross motor skills. Fine motor challenges affect handwriting legibility and tool use."],["Daily Living / Adaptive Behavior","Independently manages personal hygiene and basic self-care. Needs support with organizational skills and time management."]].map(([label,val])=>(<UTextarea key={label} label={label} value={val} onChange={()=>{}} rows={3}/>))}
            </div>
          </div>}
          {step===3&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <div><p className="lbl" style={{marginBottom:6}}>Section 3 of 13</p><h2 className="serif" style={{fontSize:22,fontWeight:700}}>Measurable Annual <span className="serif-italic" style={{color:C.warm}}>Goals</span></h2></div>
              <button className="btn-outline" onClick={()=>setShowAI(true)} style={{fontSize:11,padding:"10px 22px"}}>✦ ALP AI Suggest Goals</button>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              {["Reading","Math","Writing","Communication","Behavior","Motor","Daily Living","Transition"].map(d=>(<span key={d} style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:99,background:C.purpleL,color:C.purple,border:`1px solid ${C.tanL}`,cursor:"pointer"}}>{d}</span>))}
            </div>
            {goals.map((g,i)=>(<div key={i} style={{borderLeft:`4px solid ${g.color}`,background:C.purpleL,borderRadius:"0 10px 10px 0",padding:"18px 22px",marginBottom:14}}><p className="lbl" style={{color:g.color,marginBottom:10}}>{g.domain}</p><p style={{fontSize:14,color:C.black,lineHeight:1.7,marginBottom:12}}>{g.text}</p><div style={{display:"flex",flexWrap:"wrap",gap:24,fontSize:12,color:C.warm}}><span>Baseline: <b style={{color:C.black}}>{g.baseline}</b></span><span>Target: <b style={{color:C.black}}>{g.target}</b></span><span>Monitoring: <b style={{color:C.black}}>{g.monitoring}</b></span></div></div>))}
            <button style={{width:"100%",padding:"13px",border:`1.5px dashed ${C.tan}`,borderRadius:10,background:"transparent",color:C.warm,fontSize:13,cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.black;e.currentTarget.style.color=C.black;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tan;e.currentTarget.style.color=C.warm;}}>+ Add Goal Manually</button>
          </div>}
          {step===4&&<div><SH n={4} title="Special Education" sub="Services"/>
            {[["Special Education Instruction","5 hrs/week","Resource Room","Ms. Simmons"],["Reading Intervention","3x/week · 45 min","Pull-out","Ms. Thompson"]].map(([name,freq,loc,provider])=>(<div key={name} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:16,padding:"16px 0",borderBottom:`1px solid ${C.tanL}`}}><UInput label="Service Type" value={name} onChange={()=>{}}/><UInput label="Frequency" value={freq} onChange={()=>{}}/><UInput label="Location" value={loc} onChange={()=>{}}/><UInput label="Provider" value={provider} onChange={()=>{}}/></div>))}
            <button style={{width:"100%",padding:"12px",border:`1.5px dashed ${C.tan}`,borderRadius:10,background:"transparent",color:C.warm,fontSize:13,cursor:"pointer",marginTop:16}}>+ Add Service</button>
          </div>}
          {step===5&&<div><SH n={5} title="Related" sub="Services"/>
            <p style={{fontSize:13,color:C.warm,marginBottom:20,lineHeight:1.65}}>Related services support the student in benefiting from special education — includes therapies, counseling, assistive technology, and transportation.</p>
            {relServices.map((s,i)=>(<div key={i} style={{background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:12,padding:"18px 20px",marginBottom:14}}><div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:16}}><USelect label="Service Type" value={s.type} onChange={e=>setRelServices(p=>p.map((x,j)=>j===i?{...x,type:e.target.value}:x))} options={[{value:"Speech-Language Pathology",label:"Speech-Language Pathology"},{value:"Occupational Therapy",label:"Occupational Therapy"},{value:"Physical Therapy",label:"Physical Therapy"},{value:"Counseling",label:"Counseling / Mental Health"},{value:"Assistive Technology",label:"Assistive Technology"},{value:"Transportation",label:"Transportation"},{value:"Behavioral",label:"Behavioral Support"}]}/><UInput label="Frequency" value={s.freq} onChange={e=>setRelServices(p=>p.map((x,j)=>j===i?{...x,freq:e.target.value}:x))}/><UInput label="Duration" value={s.duration} onChange={e=>setRelServices(p=>p.map((x,j)=>j===i?{...x,duration:e.target.value}:x))}/><USelect label="Location" value={s.location} onChange={()=>{}} options={[{value:"Pull-out",label:"Pull-out"},{value:"Push-in",label:"Push-in"},{value:"Clinic",label:"Clinic"},{value:"Community",label:"Community"}]}/><UInput label="Provider" value={s.provider} onChange={e=>setRelServices(p=>p.map((x,j)=>j===i?{...x,provider:e.target.value}:x))}/></div></div>))}
            <button onClick={()=>setRelServices(p=>[...p,{type:"Speech-Language Pathology",freq:"",duration:"",location:"Pull-out",provider:""}])} style={{width:"100%",padding:"12px",border:`1.5px dashed ${C.tan}`,borderRadius:10,background:"transparent",color:C.warm,fontSize:13,cursor:"pointer",marginTop:4}}>+ Add Related Service</button>
          </div>}
          {step===6&&<div><SH n={6} title="Accommodations" sub="& Modifications"/>
            {[["Presentation",["Extended time on assessments (1.5×)","Text-to-speech software for reading tasks","Directions read aloud","Large print materials if needed"]],["Response",["Typed responses accepted","Graphic organizers for writing","Reduced writing requirements"]],["Setting",["Preferential seating (front of classroom)","Small group testing environment","Minimal distractions"]],["Scheduling",["Breaks as needed (max 5 min)","Chunked assignments","Flexible pacing"]]].map(([cat,items])=>(<div key={cat} style={{marginBottom:18}}><p className="lbl" style={{color:C.purple,marginBottom:10}}>{cat} Accommodations</p>{items.map(item=>(<label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:8,cursor:"pointer"}}><input type="checkbox" defaultChecked style={{accentColor:C.purple,width:14,height:14}}/>{item}</label>))}</div>))}
            <UTextarea label="Additional Accommodations" value="" onChange={()=>{}} rows={3} placeholder="Enter any additional accommodations..."/>
          </div>}
          {step===7&&<div><SH n={7} title="Learning" sub="Environment (LRE)"/>
            {[["General Education","Marcus attends 80% of instruction in general education with accommodations and supplemental aids."],["Supplemental Services","20% pull-out for specialized reading instruction and social-emotional learning support."],["Placement Rationale","Placement in least restrictive environment with supports aligns with ALP goals and disability needs."],["Non-Participation Justification","Pull-out services are required due to the nature and intensity of reading and communication needs."]].map(([k,v])=>(<div key={k} style={{marginBottom:20}}><UTextarea label={k} value={v} onChange={()=>{}} rows={2}/></div>))}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:8}}>
              <USelect label="General Ed Percentage" value="80" onChange={()=>{}} options={["100","95","90","80","70","60","50","40"].map(v=>({value:v,label:`${v}% in General Education`}))}/>
              <USelect label="Placement Setting" value="resource" onChange={()=>{}} options={[{value:"full",label:"Full Inclusion"},{value:"resource",label:"Resource Room (Part-time)"},{value:"selfcontained",label:"Self-Contained Classroom"},{value:"special",label:"Special School"},{value:"home",label:"Home/Hospital"}]}/>
            </div>
          </div>}
          {step===8&&<div><SH n={8} title="Assessment" sub="Participation"/>
            <p style={{fontSize:13,color:C.warm,marginBottom:20,lineHeight:1.65}}>Indicate how the student will participate in state, district, and alternate assessments.</p>
            {[{title:"State Standardized Assessment",opts:["Standard participation with accommodations","Alternate assessment (AA-AAAS)","Exempt — document reason"]},{title:"District Benchmark Assessment",opts:["Standard with accommodations","Modified format","Alternate assessment","Not applicable"]},{title:"Classroom / Curriculum Assessment",opts:["Standard with accommodations","Modified assignments","Portfolio assessment","Performance-based"]}].map(a=>(<div key={a.title} style={{background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:10,padding:"16px 20px",marginBottom:14}}><p style={{fontSize:13,fontWeight:700,color:C.black,marginBottom:12}}>{a.title}</p><div style={{display:"flex",flexDirection:"column",gap:8}}>{a.opts.map((o,i)=>(<label key={o} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}><input type="radio" name={a.title} defaultChecked={i===0} style={{accentColor:C.purple}}/>{o}</label>))}</div></div>))}
            <UTextarea label="Assessment Accommodations (for all assessments)" value="Extended time (1.5×) · Text-to-speech for reading passages · Separate testing room · Questions read aloud" onChange={()=>{}} rows={3}/>
          </div>}
          {step===9&&<div><SH n={9} title="Transition" sub="Planning"/>
            <p style={{fontSize:13,color:C.warm,marginBottom:20,lineHeight:1.65}}>Required for students aged 16+ (or younger if appropriate). Describe measurable post-secondary goals in education, career, and independent living.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
              {[["🎓","Post-Secondary Education","Community college with supported learning program; vocational training in technology or art."],["💼","Career & Employment","Supported employment in creative or technical fields. Work experience starting at age 16."],["🏠","Independent Living","Supported independent living skills: budgeting, transportation, daily scheduling."],["🌍","Community Participation","Participation in community groups and recreational activities aligned with student interests."]].map(([icon,title,desc])=>(<div key={title} style={{background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:12,padding:"18px 16px"}}><p style={{fontSize:22,marginBottom:8}}>{icon}</p><p className="lbl" style={{color:C.purple,marginBottom:8}}>{title.toUpperCase()}</p><textarea className="u-textarea" rows={3} defaultValue={desc} style={{fontSize:12}}/></div>))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <UInput label="Vocational Rehabilitation Agency" value="Virginia VR Services" onChange={()=>{}}/><UInput label="Community Agency / Partner" value="Arc of Northern Virginia" onChange={()=>{}}/>
              <USelect label="Age of Majority Notification" value="17" onChange={()=>{}} options={["14","15","16","17","18"].map(v=>({value:v,label:`Notified at age ${v}`}))}/>
              <USelect label="Self-Advocacy Level" value="developing" onChange={()=>{}} options={[{value:"emerging",label:"Emerging"},{value:"developing",label:"Developing"},{value:"proficient",label:"Proficient"},{value:"advanced",label:"Advanced"}]}/>
            </div>
          </div>}
          {step===10&&<div><SH n={10} title="Behavior" sub="Support Plan"/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,padding:"14px 18px",background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:10,flexWrap:"wrap",gap:10}}>
              <span style={{fontSize:14,fontWeight:600,color:C.black,marginRight:4}}>Student has a Behavior Intervention Plan (BIP)?</span>
              {["Yes — Full BIP","Yes — Informal plan","No"].map(o=>(<label key={o} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}><input type="radio" name="bip" onChange={()=>setHasBIP(o.startsWith("Yes"))} style={{accentColor:C.purple}}/>{o}</label>))}
            </div>
            {[["Target Behaviors (to reduce)","Elopement from classroom during unstructured transitions. Self-injurious behavior when presented with non-preferred tasks (avg 2x/day)."],["Replacement / Teaching Behaviors","Using a visual break card to request a break. Identifying and naming emotions using a feelings chart."],["Antecedent / Preventive Strategies","Provide transition warnings (5-min, 2-min, 1-min). Pre-teach expectations. Visual schedule for predictability."],["Consequence Strategies","Differential reinforcement of appropriate behavior. Token economy system. Planned ignoring for minor off-task behavior."],["Crisis Protocol","If student elopes: follow school safety protocol. Notify administrator. Document incident. Debrief after calm."]].map(([label,val])=>(<div key={label} style={{marginBottom:18}}><UTextarea label={label} value={val} onChange={()=>{}} rows={3}/></div>))}
          </div>}
          {step===11&&<div><SH n={11} title="Early" sub="Intervention History"/>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:"14px 18px",background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:10,flexWrap:"wrap"}}>
              <span style={{fontSize:14,fontWeight:600,color:C.black}}>Did this student receive Early Intervention (EI) services (birth – age 3)?</span>
              {["Yes","No","Unknown"].map(o=>(<label key={o} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}><input type="radio" name="ei" style={{accentColor:C.purple}}/>{o}</label>))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
              <UInput label="Age at First Identification" value="18 months" onChange={()=>{}}/><UInput label="EI Service Start Age" value="22 months" onChange={()=>{}}/>
              <UInput label="EI Service Coordinator / Program" value="Sunrise EI Program" onChange={()=>{}}/><UInput label="Transition from EI Date" value="2020-08-15" type="date" onChange={()=>{}}/>
            </div>
            <UTextarea label="Early Intervention Services Received" value="Speech-language therapy (2x/week), Developmental therapy (1x/week), Occupational therapy (1x/week). Home-based setting with family coaching model." onChange={()=>{}} rows={3}/>
            <div style={{marginTop:18}}><UTextarea label="Impact on Current Programming" value="Early identification and consistent EI services contributed to Marcus's current communicative functioning. Family-centered practices established strong parent engagement that continues today." onChange={()=>{}} rows={3}/></div>
            <div style={{marginTop:18}}><p className="lbl" style={{marginBottom:12}}>Transition Supports from EI to School-Age</p>{["IFSP to ALP transition meeting completed","Family provided with procedural safeguards","Records transferred from EI provider","Evaluation conducted before age 3","Transition plan documented"].map(item=>(<label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:8,cursor:"pointer"}}><input type="checkbox" defaultChecked style={{accentColor:C.purple,width:14,height:14}}/>{item}</label>))}</div>
          </div>}
          {step===12&&<div><SH n={12} title="Team" sub="Collaboration"/>
            <p style={{fontSize:13,color:C.warm,marginBottom:20,lineHeight:1.65}}>Document all team members involved in developing this Adaptive Learning Program and their participation status.</p>
            <div style={{marginBottom:24}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr",padding:"10px 16px",background:C.purpleL,borderRadius:"10px 10px 0 0",borderBottom:`1px solid ${C.tanL}`}}><span className="lbl">Team Member</span><span className="lbl">Role</span><span className="lbl">Present</span></div>
              {teamMembers.map((m,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr",padding:"12px 16px",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}><span style={{fontSize:13,fontWeight:600,color:C.black}}>{m.name}</span><span style={{fontSize:13,color:C.warm}}>{m.role}</span><input type="checkbox" checked={m.present} onChange={e=>setTeamMembers(p=>p.map((x,j)=>j===i?{...x,present:e.target.checked}:x))} style={{accentColor:C.purple,width:16,height:16}}/></div>))}
              <button onClick={()=>setTeamMembers(p=>[...p,{name:"",role:"",present:false}])} style={{width:"100%",padding:"11px",border:`1.5px dashed ${C.tan}`,borderRadius:"0 0 10px 10px",background:"transparent",color:C.warm,fontSize:13,cursor:"pointer"}}>+ Add Team Member</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <UInput label="ALP Meeting Date" value="2026-05-08" type="date" onChange={()=>{}}/><UInput label="Next Review Date" value="2027-05-08" type="date" onChange={()=>{}}/>
              <UInput label="Meeting Location" value="Westwood Elementary — Room 14" onChange={()=>{}}/><USelect label="Meeting Type" value="annual" onChange={()=>{}} options={[{value:"annual",label:"Annual Review"},{value:"initial",label:"Initial ALP"},{value:"amendment",label:"Amendment"},{value:"triennial",label:"Triennial Reevaluation"},{value:"transition",label:"Transition Planning"}]}/>
            </div>
            <div style={{marginTop:20}}><UTextarea label="Meeting Notes / Decisions Made" value="Team reviewed all 13 sections. Parent expressed satisfaction with reading goal progress. Team agreed to increase speech services to 3x/week starting September 2026." onChange={()=>{}} rows={4}/></div>
            <div style={{marginTop:18}}><p className="lbl" style={{marginBottom:10}}>Parent/Guardian Participation</p>{["Parent/guardian participated in meeting","Parent/guardian provided input on goals","Parent/guardian received copy of procedural safeguards","Parent/guardian consent obtained for placement"].map(item=>(<label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:8,cursor:"pointer"}}><input type="checkbox" defaultChecked style={{accentColor:C.purple,width:14,height:14}}/>{item}</label>))}</div>
          </div>}
          {step===13&&<div><SH n={13} title="Family Rights" sub="& Procedural Safeguards"/>
            <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:16,marginBottom:20,display:"flex",gap:10,fontSize:13,color:C.amber,lineHeight:1.6}}><span>⚠️</span><span>This section documents that the parent/guardian has been informed of their rights under IDEA and applicable law before the ALP takes effect.</span></div>
            <UTextarea label="Parent/Guardian Rights Summary" rows={7} value={`You have the right to:\n(1) Participate in all ALP planning meetings\n(2) Review all student records at no cost\n(3) Request an independent educational evaluation at public expense\n(4) Receive prior written notice before any change to your child's program\n(5) Request mediation or a due process hearing if you disagree with ALP team decisions\n(6) Have this notice in your native language or other mode of communication\n(7) Revoke consent for special education services at any time in writing`} onChange={()=>{}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:20}}>
              <USelect label="Delivery Method" value="email" onChange={()=>{}} options={[{value:"email",label:"Email + printed copy"},{value:"email-only",label:"Email only"},{value:"portal",label:"Family portal only"},{value:"mail",label:"US Mail (hard copy)"}]}/><UInput label="Response Deadline" value="2026-05-22" type="date" onChange={()=>{}}/>
              <USelect label="Language of Notice" value="en" onChange={()=>{}} options={[{value:"en",label:"English"},{value:"es",label:"Spanish"},{value:"fr",label:"French"},{value:"ar",label:"Arabic"},{value:"zh",label:"Mandarin"},{value:"tw",label:"Twi"},{value:"other",label:"Other"}]}/><USelect label="Signature Status" value="pending" onChange={()=>{}} options={[{value:"pending",label:"Pending — Not yet signed"},{value:"signed",label:"Signed — Consent obtained"},{value:"refused",label:"Refused — Documented"}]}/>
            </div>
            <div style={{marginTop:22,padding:"18px 20px",background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:10}}>
              <p className="lbl" style={{color:C.green,marginBottom:10}}>Safeguard Checklist</p>
              {["Procedural safeguards notice provided","Parent/guardian notified in native language","Parent rights explained verbally at meeting","Copy of ALP provided to family","Signature request sent via family portal"].map(item=>(<label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:8,cursor:"pointer"}}><input type="checkbox" defaultChecked style={{accentColor:C.green,width:14,height:14}}/>{item}</label>))}
            </div>
          </div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:28,paddingTop:20,borderTop:`1px solid ${C.tanL}`}}>
            <button className="btn-ghost" onClick={back} disabled={step===1} style={{opacity:step===1?.4:1}}>← Back</button>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:11,color:C.warm}}>{step} / 13</span>
              <button className="btn-black" onClick={next} style={{fontSize:11,padding:"12px 28px"}}>{step===13?"Complete & Review Document →":`Next: ${steps[step]||"Complete"} →`}</button>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
// ═══════════════════════════════════════════════════════════
// REVIEW SUMMARY
// ═══════════════════════════════════════════════════════════
function ReviewSummary({setPage}){
  const sections13=[
    {n:1,label:"Student Information",status:"green",note:"All required fields complete"},
    {n:2,label:"Present Levels",status:"green",note:"4 domains documented"},
    {n:3,label:"Annual Goals",status:"green",note:"4 measurable goals active"},
    {n:4,label:"Special Ed Services",status:"green",note:"2 services listed"},
    {n:5,label:"Related Services",status:"green",note:"SLP + OT documented"},
    {n:6,label:"Accommodations",status:"green",note:"4 accommodations active"},
    {n:7,label:"Learning Environment",status:"green",note:"80% gen ed · Resource room"},
    {n:8,label:"Assessment Participation",status:"green",note:"Standard with accommodations"},
    {n:9,label:"Transition Planning",status:"green",note:"All 4 domains documented"},
    {n:10,label:"Behavior Support",status:"green",note:"Informal support plan"},
    {n:11,label:"Early Intervention",status:"green",note:"EI history documented"},
    {n:12,label:"Team Collaboration",status:"green",note:"Meeting held May 8, 2026"},
    {n:13,label:"Family Rights & Safeguards",status:"amber",note:"Signature pending"},
  ];
  return(
    <Page title={<>Review <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Summary</span></>} subtitle="Marcus Johnson · All 13 Sections Reviewed">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        {/* Student Info */}
        <div className="card" style={{padding:"28px 30px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Student Information</h3>
          {[["Full name","Marcus Darnell Johnson"],["DOB / Grade","March 12, 2016 · Grade 4"],["Disability","Autism Spectrum Disorder"],["Plan type","ALP (Adaptive Learning Program)"],["Effective date","May 8, 2026"],["Annual review","May 8, 2027"],["Coordinator","Ms. Simmons"],["Intervention tier","ALP — Full Program"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}>
              <span style={{fontSize:13,color:C.warm}}>{k}</span>
              <span style={{fontSize:13,fontWeight:600,color:C.black}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Goals Overview */}
        <div className="card" style={{padding:"28px 30px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Goals & Services Overview</h3>
          {[["Reading fluency — 80 wcpm","Active","green"],["Communication — 3-turn convo","Active","green"],["Social-emotional — self-regulation","Active","green"],["Math — 2-step word problems","Active","green"]].map(([g,s,c])=>(
            <div key={g} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}>
              <span style={{fontSize:13,color:C.black}}>{g}</span>
              <Badge color={c}>{s}</Badge>
            </div>
          ))}
          <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.tanL}`}}>
            <p className="lbl" style={{marginBottom:10}}>Services</p>
            {[["Special education","5 hrs/wk · Resource"],["Speech-language","2x/wk · 30 min"],["OT services","1x/wk · 30 min"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.tanL}`}}>
                <span style={{fontSize:12.5,fontWeight:600,color:C.black}}>{k}</span>
                <span style={{fontSize:12.5,color:C.warm}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 13-Section Completion Checklist */}
      <div className="card" style={{padding:"28px 30px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700}}>13-Section Completion Checklist</h3>
          <div style={{display:"flex",gap:8}}>
            <Badge color="green">12 Complete</Badge>
            <Badge color="amber">1 Pending</Badge>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          {sections13.map((s,i)=>(
            <div key={s.n} style={{display:"flex",gap:12,padding:"10px 12px",borderBottom:`1px solid ${C.tanL}`,borderRight:i%2===0?`1px solid ${C.tanL}`:"none",alignItems:"center"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:s.status==="green"?C.greenBg:C.amberBg,border:`1.5px solid ${s.status==="green"?C.greenBd:C.amberBd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>
                {s.status==="green"?"✓":"⏳"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:600,color:C.black}}>Section {s.n} — {s.label}</div>
                <div style={{fontSize:11,color:C.warm,marginTop:1}}>{s.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
        <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:18}}>
          <p className="lbl" style={{color:C.amber,marginBottom:6}}>Parent Input</p>
          <p style={{fontSize:14,fontWeight:700,color:C.amber}}>Pending Signature</p>
          <p style={{fontSize:12,color:C.warm,marginTop:4}}>Patricia Johnson · Due May 22</p>
        </div>
        <div style={{background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:10,padding:18}}>
          <p className="lbl" style={{color:C.green,marginBottom:6}}>Compliance</p>
          <p style={{fontSize:14,fontWeight:700,color:C.green}}>✓ IDEA Compliant</p>
          <p style={{fontSize:12,color:C.warm,marginTop:4}}>All 13 sections documented</p>
        </div>
        <div style={{background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:10,padding:18}}>
          <p className="lbl" style={{color:C.purple,marginBottom:6}}>ALP AI Validation</p>
          <p style={{fontSize:14,fontWeight:700,color:C.purple}}>96% Score</p>
          <p style={{fontSize:12,color:C.warm,marginTop:4}}>1 recommendation pending</p>
        </div>
      </div>

      <hr className="rule" style={{marginBottom:22}}/>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button className="btn-ghost" onClick={()=>setPage("builder")}>← Back to Builder</button>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-ghost" onClick={()=>setPage("notice")} style={{fontSize:11}}>ALP Notice →</button>
          <button className="btn-black" onClick={()=>setPage("create")} style={{fontSize:11,padding:"12px 28px"}}>Create ALP Document →</button>
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// ALP NOTICE
// ═══════════════════════════════════════════════════════════
function ALPNotice({setPage}){
  const [r,setR]=useState({below:true,disability:true,behavioral:false,transition:false});
  return(
    <Page title={<>ALP <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Support Notice</span></>} subtitle="Marcus Johnson · Parent/Guardian Notification">
      <div className="card" style={{padding:"30px 32px"}}>
        <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:16,marginBottom:24,display:"flex",gap:10,fontSize:13,color:C.amber,lineHeight:1.6}}><span>⚠️</span><span>This notice is sent to the parent/guardian to inform them of the student's ALP placement, rights, and procedural safeguards as required by IDEA and applicable state regulations.</span></div>
        <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:24}}>⚠️ ALP Support Notice — Parent/Guardian Copy</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,marginBottom:28}}>
          <UInput label="Student Name" value="Marcus Darnell Johnson" onChange={()=>{}}/><UInput label="Notice Date" value="2026-05-08" type="date" onChange={()=>{}}/>
          <UInput label="School" value="Westwood Elementary School" onChange={()=>{}}/><UInput label="ALP Coordinator" value="Ms. Simmons" onChange={()=>{}}/>
          <UInput label="District" value="Westwood Unified School District" onChange={()=>{}}/><UInput label="Parent/Guardian Name" value="Patricia Johnson" onChange={()=>{}}/>
        </div>
        <p className="lbl" style={{marginBottom:14}}>Reason for ALP Placement</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:28}}>
          {[["below","Below-grade-level performance"],["disability","Disability-related learning needs"],["behavioral","Behavioral intervention required"],["transition","Transition support needed"]].map(([key,label])=>(
            <label key={key} style={{display:"flex",alignItems:"center",gap:8,fontSize:13.5,cursor:"pointer"}}><input type="checkbox" checked={r[key]} onChange={e=>setR(p=>({...p,[key]:e.target.checked}))} style={{accentColor:C.purple,width:15,height:15}}/>{label}</label>
          ))}
        </div>
        <UTextarea label="Parent/Guardian Rights Summary" rows={6} value="You have the right to: (1) participate in all ALP planning meetings, (2) review all student records at no cost, (3) request an independent educational evaluation at public expense, (4) receive prior written notice before any change to your child's program, (5) request mediation or a due process hearing if you disagree with the ALP team's decisions, (6) have this notice provided in your native language or other mode of communication." onChange={()=>{}} style={{marginBottom:28}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,marginBottom:32}}>
          <USelect label="Delivery Method" value="email" onChange={()=>{}} options={[{value:"email",label:"Email + printed copy"},{value:"email-only",label:"Email only"},{value:"portal",label:"Family portal only"},{value:"mail",label:"US Mail (hard copy)"}]}/>
          <UInput label="Response Deadline" value="2026-05-22" type="date" onChange={()=>{}}/>
        </div>
        <hr className="rule" style={{marginBottom:22}}/><div style={{display:"flex",justifyContent:"space-between"}}><button className="btn-ghost" onClick={()=>setPage("review")}>← Back</button><button className="btn-black" onClick={()=>setPage("create")} style={{fontSize:11,padding:"12px 28px"}}>Create ALP Document →</button></div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// CREATE ALP DOC
// ═══════════════════════════════════════════════════════════
function CreateALPDoc({setPage}){
  const [exporting,setExporting]=useState(false);
  const [exportWord,setExportWord]=useState(false);
  const sections=[
    {t:"1. Student Information",rows:[["Full name","Marcus Darnell Johnson"],["Date of birth","March 12, 2016"],["Disability category","Autism Spectrum Disorder"],["Plan type","ALP (Adaptive Learning Program)"],["Effective — Review date","May 8, 2026 — May 8, 2027"],["ALP Coordinator","Ms. Simmons"],["Intervention tier","ALP (Full Program)"]]},
    {t:"2. Present Levels",rows:[["Reading","52 wcpm baseline · 2nd grade level performance"],["Math","Addition/subtraction fluent · Struggles with multi-step problems"],["Communication","1-turn conversation · 3-4 word sentences in structured settings"],["Social-Emotional","Needs prompting for emotion regulation · Benefits from visual supports"]]},
    {t:"3. Annual Goals Summary",rows:[["Reading","80 wcpm by May 2027 (CBM weekly)"],["Communication","3-turn peer conversation in 4/5 observed opportunities"],["Social-Emotional","Independent self-regulation in 4/5 daily opportunities"],["Math","2-step word problems at 80% accuracy"]]},
    {t:"4. Special Education Services",rows:[["Special education instruction","5 hrs/wk · Resource Room · Ms. Simmons"],["Reading intervention","3x/wk · 45 min · Pull-out · Ms. Thompson"]]},
    {t:"5. Related Services",rows:[["Speech-Language Pathology","2x/wk · 30 min · Pull-out · Ms. Rivera"],["Occupational Therapy","1x/wk · 30 min · Pull-out · Mr. Chen"]]},
    {t:"6. Accommodations",rows:[["Extended time","1.5× on all assessments"],["Preferential seating","Front of classroom"],["Technology","Text-to-speech software for all reading tasks"],["Setting","Small group testing environment"]]},
    {t:"7. Learning Environment (LRE)",rows:[["General education","80% — with accommodations and supplemental aids"],["Pull-out","20% — Resource room for reading and communication"],["Placement rationale","Least restrictive environment with supports"]]},
    {t:"8. Assessment Participation",rows:[["State assessment","Standard participation with accommodations"],["District benchmark","Standard with accommodations"],["Assessment accommodations","Extended time (1.5×) · Text-to-speech · Separate room"]]},
    {t:"9. Transition Planning",rows:[["Post-secondary education","Community college with supported learning program"],["Career & employment","Supported employment in creative or tech fields"],["Independent living","Budgeting, transportation, daily scheduling skills"],["Age of majority","Notification at age 17 · Self-advocacy: Developing"]]},
    {t:"10. Behavior Support",rows:[["BIP status","Informal support plan in place"],["Target behavior","Elopement during transitions · SIB with non-preferred tasks"],["Replacement behavior","Visual break card · Emotion identification chart"]]},
    {t:"11. Early Intervention",rows:[["EI services received","Speech, developmental therapy, OT (ages 22 months–3 years)"],["EI Program","Sunrise EI Program · Transitioned Aug 2020"],["Impact","Strong parent engagement established through family-centered EI model"]]},
    {t:"12. Team Collaboration",rows:[["Meeting date","May 8, 2026 · Annual Review"],["Team members","Ms. Simmons, Patricia Johnson, Mr. Davis, Ms. Rivera"],["Parent participation","Full participation · Provided input on goals"],["Next review","May 8, 2027"]]},
    {t:"13. Family Rights & Safeguards",rows:[["Rights notice","Provided May 8, 2026 · English · Email + printed copy"],["Signature status","Pending — Patricia Johnson"],["Response deadline","May 22, 2026"],["Procedural safeguards","IDEA compliance confirmed"]]},
  ];
  return(
    <Page title={<>Create <span className="serif-italic" style={{color:C.warm,fontSize:26}}>ALP Document</span></>} subtitle="Marcus Johnson · All 13 Sections Complete — Ready to Export">
      <div className="card" style={{padding:"30px 32px"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:C.greenBg,border:`2px solid ${C.greenBd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 14px"}}>✅</div>
          <h2 className="serif" style={{fontSize:24,fontWeight:700,marginBottom:6,letterSpacing:"-.5px"}}>All 13 Sections Complete!</h2>
          <p style={{fontSize:14,color:C.warm}}>Review the full document preview below and export when ready.</p>
        </div>

        {/* Compliance badge */}
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:28}}>
          {[["✓ IDEA Compliant","green"],["✓ FERPA Secure","blue"],["✓ 13 / 13 Sections","purple"],["⏳ Signature Pending","amber"]].map(([label,color])=>(
            <Badge key={label} color={color}>{label}</Badge>
          ))}
        </div>

        {/* Document Preview */}
        <div style={{border:`1px solid ${C.tanL}`,borderRadius:12,padding:"36px 40px",background:C.purpleL,marginBottom:28}}>
          <div style={{textAlign:"center",marginBottom:24,paddingBottom:20,borderBottom:`2px solid ${C.tanL}`}}>
            <h2 className="serif" style={{fontSize:20,fontWeight:800,letterSpacing:".04em",marginBottom:4,color:C.black}}>ADAPTIVE LEARNING PROGRAM</h2>
            <p className="serif" style={{fontWeight:700,marginBottom:3,color:C.black}}>Marcus Darnell Johnson</p>
            <p style={{fontSize:12,color:C.warm}}>Grade 4 · Autism Spectrum Disorder · Westwood Elementary · May 8, 2026 — May 8, 2027</p>
          </div>
          <div style={{columns:2,columnGap:32}}>
            {sections.map(s=>(
              <div key={s.t} style={{breakInside:"avoid",marginBottom:18}}>
                <div className="serif" style={{fontSize:12,fontWeight:700,color:C.purple,paddingBottom:6,borderBottom:`1px solid ${C.tanL}`,marginBottom:8,letterSpacing:".02em"}}>{s.t}</div>
                {s.rows.map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"3px 0",borderBottom:`1px solid ${C.tanL}22`}}>
                    <span style={{fontSize:11,color:C.warm,flexShrink:0,maxWidth:"45%"}}>{k}</span>
                    <span style={{fontSize:11,fontWeight:500,color:C.black,textAlign:"right"}}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${C.tanL}`,display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div>
              <p style={{fontSize:10,fontWeight:700,color:C.warm,marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"}}>ALP Coordinator Signature</p>
              <div style={{borderBottom:`1px solid ${C.tanL}`,height:28,marginBottom:4}}/>
              <p style={{fontSize:10,color:C.warm}}>Ms. Simmons · May 8, 2026</p>
            </div>
            <div>
              <p style={{fontSize:10,fontWeight:700,color:C.warm,marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"}}>Parent/Guardian Signature</p>
              <div style={{borderBottom:`1px dashed ${C.amber}`,height:28,marginBottom:4}}/>
              <p style={{fontSize:10,color:C.amber}}>Patricia Johnson · PENDING</p>
            </div>
          </div>
          <div style={{marginTop:16,textAlign:"center",fontSize:10,color:C.warm}}>Built by Stan Paraclete · www.stanparaclete.com · ALP Platform v2.4.1 · growwithalp.com · Generated {new Date().toLocaleDateString()}</div>
        </div>

        {/* Export Actions */}
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
          <button className="btn-black" onClick={()=>{setExporting(true);setTimeout(()=>setExporting(false),2500);}} disabled={exporting} style={{fontSize:11,padding:"13px 28px"}}>
            {exporting?<><Spin/>Generating PDF…</>:"📄 Export PDF"}
          </button>
          <button className="btn-outline" onClick={()=>{setExportWord(true);setTimeout(()=>setExportWord(false),2500);}} disabled={exportWord} style={{fontSize:11,padding:"12px 24px"}}>
            {exportWord?<><Spin/>Generating…</>:"📝 Export Word"}
          </button>
          <button className="btn-ghost" style={{fontSize:11}}>🖨 Print</button>
          <button className="btn-ghost" onClick={()=>setPage("family")} style={{fontSize:11}}>📤 Send to Family</button>
          <button className="btn-ghost" onClick={()=>setPage("reports")} style={{fontSize:11}}>📊 View in Reports</button>
        </div>
        <div style={{padding:"14px 20px",background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:10,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>✅</span>
          <p style={{fontSize:13,color:C.green}}>This document is IDEA-compliant and audit-ready. Once signed by the parent/guardian, it will be automatically archived and the family portal updated.</p>
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// PROGRESS MONITORING
// ═══════════════════════════════════════════════════════════
function Progress(){
  const [student,setStudent]=useState("Marcus Johnson");
  const [domain,setDomain]=useState("Reading");
  const students=["Marcus Johnson","Sofia Lee","Tyler Parker","Aisha Adeyemi","Ryan Chen"];
  const domainData={
    "Reading":  {scores:[52,56,59,62,65,68],goal:80,label:"wcpm",color:C.purple,trend:"improving",velocity:"+4/mo"},
    "Math":     {scores:[60,58,62,64,60,63],goal:85,label:"%",color:C.green,trend:"stable",velocity:"+0.5/mo"},
    "Communication":{scores:[40,45,48,52,50,54],goal:80,label:"%",color:C.blue,trend:"improving",velocity:"+2.8/mo"},
    "Social-Emotional":{scores:[55,52,50,55,58,56],goal:80,label:"%",color:C.amber,trend:"stable",velocity:"+0.2/mo"},
  };
  const months=["Sep","Oct","Nov","Jan","Mar","May"];
  const dd=domainData[domain];
  const maxVal=Math.max(dd.goal,...dd.scores)+10;
  const chartH=160,chartW=460;
  const barW=42,gap=32;
  const toY=v=>chartH-(v/maxVal*chartH);
  const goalY=toY(dd.goal);

  const masteryGoals=[
    {goal:"Reading Fluency — 80 wcpm",current:68,target:80,pct:85,status:"On Track",trend:"↑"},
    {goal:"Communication — 3-turn conversation",current:54,target:80,pct:67,status:"Developing",trend:"↑"},
    {goal:"Social-Emotional — Self-regulation",current:56,target:80,pct:70,status:"Developing",trend:"→"},
    {goal:"Math — 2-step word problems",current:63,target:85,pct:74,status:"On Track",trend:"↑"},
  ];

  return(
    <Page title={<>Progress <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Monitoring</span></>}
      subtitle={`${student} · Q3 2026`}
      action={<button className="btn-outline" style={{fontSize:11,padding:"10px 22px"}}>Export Report ↗</button>}>

      {/* Student & Domain Selector */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <select value={student} onChange={e=>setStudent(e.target.value)} className="u-select" style={{width:"auto",paddingRight:32,fontSize:13,fontWeight:600}}>
          {students.map(s=><option key={s}>{s}</option>)}
        </select>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {Object.keys(domainData).map(d=>(
            <button key={d} onClick={()=>setDomain(d)}
              style={{padding:"8px 16px",fontSize:11,fontWeight:700,borderRadius:99,border:`1.5px solid ${domain===d?domainData[d].color:C.tanL}`,background:domain===d?domainData[d].color+"22":"transparent",color:domain===d?domainData[d].color:C.warm,cursor:"pointer",transition:"all .15s"}}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Top Metrics */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[["CURRENT","68 wcpm","vs 52 wcpm baseline",C.purple],["GOAL","80 wcpm","by May 2027",C.green],["TREND",dd.trend==="improving"?"Improving ↑":"Stable →","3-month trajectory",dd.trend==="improving"?C.green:C.amber],["VELOCITY",dd.velocity,"learning rate",C.blue]].map(([l,v,s,c])=>(
          <div key={l} className="metric-card">
            <p className="lbl" style={{marginBottom:8}}>{l}</p>
            <div style={{fontSize:22,fontWeight:800,color:c,fontFamily:"'Playfair Display',serif",letterSpacing:"-.5px"}}>{v}</div>
            <p style={{fontSize:11,color:C.warm,marginTop:4}}>{s}</p>
          </div>
        ))}
      </div>

      {/* Growth Chart */}
      <div className="card" style={{padding:"26px 28px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <h3 className="serif" style={{fontSize:17,fontWeight:700}}>{domain} Growth — {student}</h3>
            <p style={{fontSize:12,color:C.warm,marginTop:3}}>Goal: {dd.goal} {dd.label} · Current: {dd.scores[dd.scores.length-1]} {dd.label} · Trend: {dd.trend==="improving"?"↑ Improving":"→ Stable"}</p>
          </div>
          <span style={{fontSize:11,color:C.warm}}>CBM Weekly Probes</span>
        </div>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <svg width={chartW} height={chartH+40} style={{display:"block",minWidth:chartW}}>
            {/* Goal line */}
            <line x1={0} y1={goalY} x2={chartW} y2={goalY} stroke={C.red} strokeWidth={1.5} strokeDasharray="6,4" opacity={0.7}/>
            <text x={chartW-4} y={goalY-5} fontSize={9} fill={C.red} textAnchor="end" fontWeight="700">Goal: {dd.goal}</text>
            {/* Bars */}
            {dd.scores.map((score,i)=>{
              const x=i*(barW+gap)+16;
              const barH=score/maxVal*chartH;
              const y=chartH-barH;
              const isLast=i===dd.scores.length-1;
              return(
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={barH} rx={5} fill={isLast?dd.color:dd.color+"88"}/>
                  <text x={x+barW/2} y={y-5} textAnchor="middle" fontSize={10} fontWeight={isLast?"700":"400"} fill={isLast?dd.color:C.warm}>{score}</text>
                  <text x={x+barW/2} y={chartH+16} textAnchor="middle" fontSize={10} fill={C.warm}>{months[i]}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ALP AI Recommendation */}
      <div className="card" style={{padding:"20px 24px",marginBottom:20,borderLeft:`4px solid ${C.purple}`}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontSize:20}}>✦</span>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:C.purple,letterSpacing:".1em",marginBottom:6}}>ALP AI RECOMMENDATION</p>
            <p style={{fontSize:13.5,fontWeight:600,color:C.black,marginBottom:6}}>Increase reading intervention frequency to 4x/week</p>
            <p style={{fontSize:13,color:C.warm,lineHeight:1.65}}>Marcus is improving at +4 wcpm/month but needs to reach 80 wcpm by May 2027. At the current rate, he will reach ~76 wcpm. ALP AI recommends increasing intervention frequency and introducing repeated reading with performance feedback to accelerate growth. Consider adding a fluency-building component to existing sessions.</p>
            <div style={{display:"flex",gap:10,marginTop:12}}>
              <button className="btn-purple" style={{fontSize:11,padding:"7px 16px"}}>Apply Recommendation</button>
              <button className="btn-ghost" style={{fontSize:11,padding:"7px 16px"}}>Dismiss</button>
            </div>
          </div>
        </div>
      </div>

      {/* Mastery Tracking */}
      <div className="card" style={{padding:"26px 28px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700}}>Mastery Tracking — All Goals</h3>
          <Badge color="purple">4 Active Goals</Badge>
        </div>
        <table className="data-table" style={{minWidth:520}}>
          <thead><tr>{["Goal","Current","Target","Progress","Status","Trend"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {masteryGoals.map((g,i)=>(
              <tr key={i}>
                <td style={{fontWeight:600,maxWidth:220}}>{g.goal}</td>
                <td style={{fontWeight:700,color:C.purple}}>{g.current}</td>
                <td style={{color:C.warm}}>{g.target}</td>
                <td style={{minWidth:120}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}><PBar value={g.pct} color={g.pct>=80?C.green:g.pct>=60?C.purple:C.amber}/></div>
                    <span style={{fontSize:12,fontWeight:700,color:C.warm,width:32}}>{g.pct}%</span>
                  </div>
                </td>
                <td><Badge color={g.status==="On Track"?"green":"amber"}>{g.status}</Badge></td>
                <td style={{fontSize:16,fontWeight:700,color:g.trend==="↑"?C.green:g.trend==="↓"?C.red:C.warm}}>{g.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Benchmark + Intervention Effectiveness */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Benchmark Comparison</h3>
          {[["District Average (Grade 4)","72 wcpm",null],["State Grade-Level Benchmark","85 wcpm",null],["Marcus Current","68 wcpm",C.purple],["Marcus Goal (May 2027)","80 wcpm",C.green]].map(([label,val,c])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}>
              <span style={{fontSize:13,color:C.warm}}>{label}</span>
              <span style={{fontSize:13,fontWeight:700,color:c||C.black}}>{val}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Intervention Effectiveness</h3>
          {[["Orton-Gillingham (Reading)","High","↑↑ Significant gains"],["Social Stories (Communication)","Moderate","↑ Consistent progress"],["CBT Strategies (Social-Emotional)","Moderate","→ Stable, slow gains"],["Token Economy (Behavior)","High","↑↑ Rapid improvement"]].map(([intervention,rating,note])=>(
            <div key={intervention} style={{padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:12.5,fontWeight:600,color:C.black}}>{intervention}</span>
                <Badge color={rating==="High"?"green":"amber"}>{rating}</Badge>
              </div>
              <span style={{fontSize:11.5,color:C.warm}}>{note}</span>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// FUTURE READINESS
// ═══════════════════════════════════════════════════════════
function FutureReadiness({setPage}){
  const students=[
    {name:"Marcus Johnson",age:10,grade:4,score:88,color:C.green,status:"On Track",disability:"ASD"},
    {name:"Aisha Adeyemi",age:9,grade:3,score:61,color:C.amber,status:"Needs Planning",disability:"Speech/Lang"},
    {name:"Ryan Chen",age:11,grade:5,score:74,color:C.purple,status:"Developing",disability:"Intellectual"},
  ];
  const [sel,setSel]=useState(students[0]);
  const goals=[
    {icon:"🎓",title:"Post-Secondary Education",desc:"Community college with supported learning program; vocational training in technology or art.",status:"Documented",color:C.purple},
    {icon:"💼",title:"Career & Employment",desc:"Supported employment in creative or technical fields. Work experience starting at age 16.",status:"Documented",color:C.blue},
    {icon:"🏠",title:"Independent Living",desc:"Supported independent living skills: budgeting, transportation, daily scheduling.",status:"In Progress",color:C.green},
    {icon:"🌍",title:"Community Participation",desc:"Participation in community groups and recreational activities aligned with student interests.",status:"Planned",color:C.amber},
  ];
  return(
    <Page title={<>Future <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Readiness</span></>}
      subtitle="ALP AI Transition Analytics · Predictive Planning"
      action={<button className="btn-black" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"11px 24px"}}>Edit ALP Builder</button>}>

      {/* Student Selector */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
        {students.map(s=>(
          <div key={s.name} className="card" style={{padding:"18px 20px",cursor:"pointer",borderColor:sel.name===s.name?s.color:undefined,boxShadow:sel.name===s.name?`0 0 0 2px ${s.color}`:undefined}}
            onClick={()=>setSel(s)}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <Avatar name={s.name} size={38}/>
              <div><div style={{fontSize:13.5,fontWeight:700,color:C.black}}>{s.name}</div><div style={{fontSize:11.5,color:C.warm}}>Grade {s.grade} · {s.disability}</div></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:24,fontWeight:800,color:s.color,fontFamily:"'Playfair Display',serif"}}>{s.score}%</div>
              <Badge color={s.color===C.green?"green":s.color===C.amber?"amber":"purple"}>{s.status}</Badge>
            </div>
            <PBar value={s.score} color={s.color}/>
          </div>
        ))}
      </div>

      {/* ALP AI Future Readiness Score */}
      <div className="card" style={{padding:"24px 28px",marginBottom:20,borderLeft:`4px solid ${sel.color}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:C.purple,letterSpacing:".1em",marginBottom:8}}>✦ ALP AI FUTURE READINESS SCORE</p>
            <h2 className="serif" style={{fontSize:28,fontWeight:800,color:sel.color,marginBottom:4}}>{sel.score}% Future Readiness</h2>
            <p style={{fontSize:13,color:C.warm,maxWidth:540,lineHeight:1.65}}>Based on current goal trajectory, academic performance, social-emotional growth, communication skills, and transition planning completeness. ALP AI projects {sel.name.split(" ")[0]} is <b style={{color:sel.color}}>{sel.status.toLowerCase()}</b> for post-secondary transition by age 22.</p>
          </div>
          <div style={{textAlign:"center",flexShrink:0}}>
            <div style={{fontSize:48,fontWeight:900,color:sel.color,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{sel.score}</div>
            <div style={{fontSize:10,color:C.warm,letterSpacing:".1em"}}>/ 100</div>
          </div>
        </div>
      </div>

      {/* Post-Secondary Goals */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
        {goals.map(g=>(
          <div key={g.title} className="card" style={{padding:"20px 22px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:24}}>{g.icon}</span>
                <p className="lbl" style={{color:g.color}}>{g.title.toUpperCase()}</p>
              </div>
              <Badge color={g.status==="Documented"?"green":g.status==="In Progress"?"purple":"amber"}>{g.status}</Badge>
            </div>
            <p style={{fontSize:13,color:C.warm,lineHeight:1.6}}>{g.desc}</p>
          </div>
        ))}
      </div>

      {/* Transition Timeline + Agency Partners */}
      <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:20}}>
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Transition Timeline</h3>
          {[["Age 14","Transition planning begins","Completed","green"],["Age 16","Vocational exploration","In Progress","purple"],["Age 18","Age of majority notification","Planned","amber"],["Age 19–21","Supported employment trial","Planned","amber"],["Age 22","Exit from special education services","Future","gray"]].map(([age,label,status,color])=>(
            <div key={age} style={{display:"flex",gap:14,padding:"10px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}>
              <div style={{width:48,flexShrink:0,textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.purple}}>{age}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:C.black}}>{label}</div>
              </div>
              <Badge color={color}>{status}</Badge>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:"24px 26px"}}>
          <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Agency Partners</h3>
          {[["Vocational Rehab","Virginia VR Services","Active"],["Community Agency","Arc of Northern Virginia","Active"],["Employment Support","Supported Works Inc.","Planned"],["Housing Agency","Independence Plus","Planned"]].map(([type,name,status])=>(
            <div key={type} style={{padding:"10px 0",borderBottom:`1px solid ${C.tanL}`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.warm,marginBottom:2}}>{type.toUpperCase()}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:600,color:C.black}}>{name}</span>
                <Badge color={status==="Active"?"green":"amber"}>{status}</Badge>
              </div>
            </div>
          ))}
          <div style={{marginTop:18,padding:"14px 16px",background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:10}}>
            <p style={{fontSize:10,fontWeight:700,color:C.purple,marginBottom:4}}>SELF-ADVOCACY LEVEL</p>
            <p style={{fontSize:13,fontWeight:600,color:C.black}}>Developing</p>
            <PBar value={45} color={C.purple}/>
          </div>
        </div>
      </div>
    </Page>
  );
}


function FamilyPortal(){
  const [tab,setTab]=useState("messages");
  const [compose,setCompose]=useState(false);
  const [signing,setSigning]=useState(null);
  const [signed,setSigned]=useState([]);

  const msgs=[
    {id:1,name:"Johnson Family",student:"Marcus",sub:"ALP Update — Reading Goals",preview:'"Can we discuss the reading goals before the review meeting?"',date:"May 6",unread:true,thread:["Can we discuss the reading goals before the review meeting? Marcus mentioned he got a new book and really enjoyed it.","Thank you for reaching out! Marcus has been making great progress. His reading rate is now 68 wcpm, up from 52 in September. I'd love to discuss strategies to keep this momentum going. Would Tuesday at 3PM work for a quick call?"]},
    {id:2,name:"Lee Family",student:"Sofia",sub:"Sofia Progress — Document Signed",preview:"Document signed ✓ · Thank you for the progress report",date:"May 3",unread:false,thread:["Thank you for sharing Sofia's progress report. We've signed the ALP document. She's been doing the reading exercises at home every night!","That's wonderful to hear! Sofia's consistency at home is making a real difference. Her next CBM probe is Friday — I'll share results right away."]},
    {id:3,name:"Adeyemi Family",student:"Aisha",sub:"Meeting Request",preview:'"Is Thursday at 4PM available for a quick progress check?"',date:"May 1",unread:true,thread:['"Is Thursday at 4PM available for a quick progress check? We\'re a bit concerned about Aisha\'s communication goals."',"I understand your concern and I'm happy to meet. Thursday at 4PM works perfectly — I'll send a Google Meet link. Aisha is making progress, and I have some new strategies I'd love to share with you."]},
    {id:4,name:"Parker Family",student:"Tyler",sub:"Question re: 504 Plan",preview:'"Tyler mentioned getting extra time on state tests?"',date:"Apr 28",unread:false,thread:['"Tyler mentioned he gets extra time on tests. Can you explain exactly what accommodations he has?"',"Great question! Tyler has a 504 Plan with 1.5× extended time on all assessments, preferential seating, and the option to take tests in a small group setting. I'll send you a copy of the full accommodations list today."]},
  ];
  const [activeMsg,setActiveMsg]=useState(null);
  const [reply,setReply]=useState("");

  const signatures=[
    {id:1,title:"Marcus Johnson — Annual ALP 2026–2027",student:"Marcus Johnson",type:"ALP",date:"May 8, 2026",deadline:"May 22, 2026",pages:14,status:"pending",desc:"Annual Adaptive Learning Program requiring parent/guardian signature before May 22, 2026."},
    {id:2,title:"Aisha Adeyemi — ALP Amendment",student:"Aisha Adeyemi",type:"Amendment",date:"May 2, 2026",deadline:"May 16, 2026",pages:3,status:"pending",desc:"Amendment to communication goals section. Changes approved by team on May 2, 2026."},
    {id:3,title:"Sofia Lee — RTI-II Consent",student:"Sofia Lee",type:"Consent",date:"Apr 15, 2026",deadline:"Apr 29, 2026",pages:2,status:"signed",signedDate:"Apr 22, 2026",desc:"Consent for RTI Tier II reading intervention program."},
    {id:4,title:"Tyler Parker — 504 Annual Review",student:"Tyler Parker",type:"504",date:"Mar 10, 2026",deadline:"Mar 24, 2026",pages:5,status:"signed",signedDate:"Mar 18, 2026",desc:"Annual review of Section 504 accommodation plan."},
  ];

  const documents=[
    {id:1,icon:"📋",title:"Marcus Johnson — ALP 2026–2027",type:"Adaptive Learning Program",date:"May 8, 2026",size:"2.4 MB",status:"pending-signature"},
    {id:2,icon:"📈",title:"Marcus Johnson — Q3 Progress Report",type:"Progress Report",date:"May 5, 2026",size:"1.1 MB",status:"available"},
    {id:3,icon:"📋",title:"Aisha Adeyemi — ALP Amendment",type:"ALP Amendment",date:"May 2, 2026",size:"0.8 MB",status:"pending-signature"},
    {id:4,icon:"📊",title:"Sofia Lee — Evaluation Report",type:"Psychoeducational Evaluation",date:"Apr 20, 2026",size:"3.2 MB",status:"available"},
    {id:5,icon:"📋",title:"Tyler Parker — 504 Plan",type:"Section 504 Plan",date:"Mar 10, 2026",size:"1.4 MB",status:"available"},
    {id:6,icon:"📝",title:"Ryan Chen — ALP 2025–2026",type:"Adaptive Learning Program",date:"May 15, 2025",size:"2.1 MB",status:"available"},
    {id:7,icon:"📈",title:"Class Progress Summary — Q2 2026",type:"Class Report",date:"Feb 28, 2026",size:"0.9 MB",status:"available"},
  ];

  const meetings=[
    {day:"14",month:"MAY",title:"Johnson Family — Annual ALP Review",time:"3:30 PM · Virtual · Google Meet",action:"Join",urgent:true,type:"Annual Review"},
    {day:"20",month:"MAY",title:"Adeyemi Family — Progress Check",time:"4:00 PM · Room 14, Westwood Elem",action:"View",urgent:false,type:"Progress Check"},
    {day:"28",month:"MAY",title:"Lee Family — Goal Discussion",time:"2:00 PM · Virtual",action:"View",urgent:false,type:"Goal Discussion"},
    {day:"3",month:"JUN",title:"Parker Family — 504 Annual Review",time:"11:00 AM · Room 7",action:"Schedule",urgent:false,type:"504 Review"},
  ];

  const commLog=[
    {date:"May 6, 2026",type:"Message",direction:"←",family:"Johnson Family",subject:"ALP Update — Reading Goals",method:"Portal Message",staff:"Ms. Simmons"},
    {date:"May 3, 2026",type:"Signature",direction:"✓",family:"Lee Family",subject:"RTI-II Consent Signed",method:"Digital Signature",staff:"System"},
    {date:"May 2, 2026",type:"Document",direction:"→",family:"Adeyemi Family",subject:"ALP Amendment Shared",method:"Portal",staff:"Ms. Simmons"},
    {date:"Apr 28, 2026",type:"Meeting",direction:"📅",family:"Johnson Family",subject:"Annual Review Meeting Held",method:"Google Meet",staff:"Ms. Simmons, Ms. Rivera"},
    {date:"Apr 22, 2026",type:"Signature",direction:"✓",family:"Lee Family",subject:"RTI-II Consent Received",method:"Digital Signature",staff:"System"},
    {date:"Apr 15, 2026",type:"Notice",direction:"→",family:"Lee Family",subject:"ALP Support Notice Sent",method:"Email + Portal",staff:"Ms. Simmons"},
    {date:"Apr 10, 2026",type:"Message",direction:"←",family:"Parker Family",subject:"504 Question — Extended Time",method:"Portal Message",staff:"Ms. Simmons"},
    {date:"Mar 18, 2026",type:"Signature",direction:"✓",family:"Parker Family",subject:"504 Annual Review Signed",method:"Digital Signature",staff:"System"},
  ];

  const typeColor={Message:C.blue,Signature:C.green,Document:C.purple,Meeting:C.amber,Notice:C.red};
  const pending=signatures.filter(s=>s.status==="pending");

  return(
    <Page
      title={<>Family <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Collaboration Portal</span></>}
      subtitle={`${pending.length} signatures pending · ${msgs.filter(m=>m.unread).length} unread messages`}
      action={<button className="btn-black" onClick={()=>setCompose(true)} style={{fontSize:11,padding:"11px 24px"}}>+ Draft Message</button>}>

      {/* Compose Modal */}
      {compose&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setCompose(false)}>
          <div className="card fade-up" style={{width:"100%",maxWidth:540,padding:32}}>
            <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:20}}>New <span className="serif-italic" style={{color:C.warm}}>Message</span></h3>
            <div style={{display:"flex",flexDirection:"column",gap:20,marginBottom:24}}>
              <USelect label="Recipient Family" value="johnson" onChange={()=>{}} options={[{value:"johnson",label:"Johnson Family (Marcus)"},{value:"lee",label:"Lee Family (Sofia)"},{value:"adeyemi",label:"Adeyemi Family (Aisha)"},{value:"parker",label:"Parker Family (Tyler)"},{value:"chen",label:"Chen Family (Ryan)"}]}/>
              <USelect label="Message Type" value="update" onChange={()=>{}} options={[{value:"update",label:"Progress Update"},{value:"meeting",label:"Meeting Request"},{value:"document",label:"Document Share"},{value:"alert",label:"Concern / Alert"},{value:"general",label:"General Communication"}]}/>
              <UInput label="Subject" value="" onChange={()=>{}} placeholder="Message subject"/>
              <UTextarea label="Message" rows={5} value="" onChange={()=>{}} placeholder="Write your message here…"/>
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
                <input type="checkbox" style={{accentColor:C.purple,width:14,height:14}}/> Send copy via email to family
              </label>
            </div>
            <div style={{display:"flex",gap:12}}>
              <button className="btn-ghost" onClick={()=>setCompose(false)} style={{flex:1}}>Cancel</button>
              <button className="btn-black" onClick={()=>setCompose(false)} style={{flex:1,fontSize:11}}>Send Message →</button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {signing&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSigning(null)}>
          <div className="card fade-up" style={{width:"100%",maxWidth:580,padding:36}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{fontSize:40,marginBottom:12}}>✍️</div>
              <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:6}}>{signing.title}</h3>
              <p style={{fontSize:13,color:C.warm}}>{signing.desc}</p>
            </div>
            <div style={{background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:10,padding:16,marginBottom:20}}>
              {[["Document Type",signing.type],["Date Issued",signing.date],["Signature Deadline",signing.deadline],["Total Pages",`${signing.pages} pages`]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{fontSize:13,color:C.warm}}>{k}</span><span style={{fontSize:13,fontWeight:600,color:C.black}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{border:`2px dashed ${C.tanL}`,borderRadius:10,padding:"32px 20px",textAlign:"center",marginBottom:20,background:C.purpleL}}>
              <p style={{fontSize:13,color:C.warm,marginBottom:8}}>Sign below by clicking the button. Your digital signature will be timestamped and legally recorded.</p>
              <p style={{fontSize:11,color:C.warm,fontStyle:"italic"}}>By signing, you confirm you have read and understood this document.</p>
            </div>
            <div style={{display:"flex",gap:12}}>
              <button className="btn-ghost" onClick={()=>setSigning(null)} style={{flex:1}}>Review Document First</button>
              <button className="btn-black" onClick={()=>{setSigned(p=>[...p,signing.id]);setSigning(null);}} style={{flex:1.5,fontSize:11}}>✍️ Sign Document →</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{display:"flex",gap:0,marginBottom:22,borderBottom:`1px solid ${C.tanL}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {[["messages","💬 Messages",msgs.filter(m=>m.unread).length],["signatures","✍️ Signatures",pending.length],["documents","📄 Documents",0],["meetings","📅 Meetings",0],["progress","📈 Student Progress",0],["log","📒 Communication Log",0]].map(([id,label,badge])=>(
          <button key={id} onClick={()=>{setTab(id);setActiveMsg(null);}} className={`tab-btn${tab===id?" active":""}`}
            style={{marginRight:24,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
            {label}
            {badge>0&&<span style={{fontSize:10,fontWeight:700,background:C.purple,color:"#fff",padding:"1px 7px",borderRadius:99,lineHeight:"18px"}}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── MESSAGES ───────────────────────────── */}
      {tab==="messages"&&(
        <div style={{display:"grid",gridTemplateColumns:activeMsg?"1fr 1.4fr":"1fr",gap:20}}>
          <div className="card" style={{padding:"20px 0",overflow:"hidden"}}>
            <div style={{padding:"0 22px 14px",borderBottom:`1px solid ${C.tanL}`,marginBottom:4}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700}}>Parent Messages</h3>
            </div>
            {msgs.map((m,i)=>(
              <div key={m.id} onClick={()=>setActiveMsg(m)} style={{display:"flex",gap:10,padding:"14px 22px",borderBottom:i<msgs.length-1?`1px solid ${C.tanL}`:"none",cursor:"pointer",background:activeMsg?.id===m.id?C.purpleL:"transparent",transition:"background .1s"}}
                onMouseEnter={e=>{if(activeMsg?.id!==m.id)e.currentTarget.style.background=C.purpleL;}}
                onMouseLeave={e=>{if(activeMsg?.id!==m.id)e.currentTarget.style.background="transparent";}}>
                <div style={{flexShrink:0,marginTop:4}}>
                  {m.unread?<div style={{width:8,height:8,borderRadius:"50%",background:C.purple}}/>:<div style={{width:8}}/>}
                </div>
                <Avatar name={m.name} size={34}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:13,fontWeight:m.unread?700:500,color:C.black}}>{m.name}</span>
                    <span style={{fontSize:11,color:C.warm,flexShrink:0}}>{m.date}</span>
                  </div>
                  <div style={{fontSize:12,color:C.warm,fontWeight:m.unread?600:400,marginBottom:2}}>{m.sub}</div>
                  <p style={{fontSize:11.5,color:C.warm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.preview}</p>
                </div>
              </div>
            ))}
          </div>
          {activeMsg&&(
            <div className="card" style={{padding:"24px 26px",display:"flex",flexDirection:"column"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${C.tanL}`}}>
                <Avatar name={activeMsg.name} size={40}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.black}}>{activeMsg.name}</div>
                  <div style={{fontSize:12,color:C.warm}}>{activeMsg.sub}</div>
                </div>
                <button onClick={()=>setActiveMsg(null)} style={{color:C.warm,fontSize:18,background:"none",border:"none",cursor:"pointer"}}>✕</button>
              </div>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
                {activeMsg.thread.map((msg,i)=>(
                  <div key={i} style={{display:"flex",flexDirection:i%2===0?"row":"row-reverse",gap:10}}>
                    <Avatar name={i%2===0?activeMsg.name:"Ms. Simmons"} size={28}/>
                    <div style={{maxWidth:"78%",background:i%2===0?C.purpleL:`${C.purple}22`,borderRadius:12,padding:"10px 14px"}}>
                      <p style={{fontSize:13,color:C.black,lineHeight:1.6}}>{msg}</p>
                      <p style={{fontSize:10,color:C.warm,marginTop:4,textAlign:i%2===0?"left":"right"}}>{activeMsg.date} · {i%2===0?activeMsg.name:"Ms. Simmons"}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:`1px solid ${C.tanL}`,paddingTop:14,display:"flex",gap:10}}>
                <textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Type your reply…" rows={2} className="u-textarea" style={{flex:1,resize:"none"}}/>
                <button className="btn-purple" onClick={()=>setReply("")} style={{fontSize:11,padding:"10px 18px",alignSelf:"flex-end"}}>Send →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SIGNATURES & APPROVALS ─────────────── */}
      {tab==="signatures"&&(
        <div>
          {pending.length>0&&(
            <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:"14px 18px",marginBottom:20,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:18}}>⚠️</span>
              <p style={{fontSize:13,color:C.amber,fontWeight:600}}>{pending.length} document{pending.length>1?"s":""} awaiting parent signature — please review and sign before the deadlines.</p>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:28}}>
            <h3 className="serif" style={{fontSize:17,fontWeight:700}}>Pending Signatures</h3>
            {signatures.filter(s=>s.status==="pending"&&!signed.includes(s.id)).map(sig=>(
              <div key={sig.id} className="card" style={{padding:"22px 24px",borderLeft:`4px solid ${C.amber}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                      <Badge color="amber">{sig.type}</Badge>
                      <span style={{fontSize:11,color:C.red,fontWeight:700}}>Due {sig.deadline}</span>
                    </div>
                    <h4 style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:4}}>{sig.title}</h4>
                    <p style={{fontSize:12.5,color:C.warm,lineHeight:1.55,marginBottom:12}}>{sig.desc}</p>
                    <div style={{display:"flex",gap:20,fontSize:12,color:C.warm}}>
                      <span>📄 {sig.pages} pages</span><span>📅 Issued {sig.date}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
                    <button className="btn-ghost" style={{fontSize:11,padding:"8px 16px"}}>📖 Review</button>
                    <button className="btn-black" onClick={()=>setSigning(sig)} style={{fontSize:11,padding:"9px 16px"}}>✍️ Sign Now</button>
                  </div>
                </div>
              </div>
            ))}
            {signed.length>0&&signatures.filter(s=>signed.includes(s.id)).map(sig=>(
              <div key={sig.id} className="card" style={{padding:"18px 22px",borderLeft:`4px solid ${C.green}`,opacity:.85}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <Badge color="green">✓ Signed</Badge>
                    <h4 style={{fontSize:13.5,fontWeight:700,color:C.black,marginTop:6}}>{sig.title}</h4>
                    <p style={{fontSize:12,color:C.warm,marginTop:2}}>Signed just now · Digital signature recorded</p>
                  </div>
                  <button className="btn-ghost" style={{fontSize:11}}>📥 Download</button>
                </div>
              </div>
            ))}
            {pending.length===0&&signed.length===0&&<p style={{fontSize:13,color:C.warm,padding:"20px 0"}}>No pending signatures.</p>}
          </div>
          <div>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:16}}>Previously Signed</h3>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {signatures.filter(s=>s.status==="signed").map(sig=>(
                <div key={sig.id} className="card" style={{padding:"16px 22px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                      <Badge color="green">✓ Signed</Badge>
                      <Badge color="gray">{sig.type}</Badge>
                    </div>
                    <div style={{fontSize:13.5,fontWeight:600,color:C.black}}>{sig.title}</div>
                    <div style={{fontSize:12,color:C.warm,marginTop:2}}>Signed {sig.signedDate} · {sig.pages} pages</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn-ghost" style={{fontSize:11}}>📖 View</button>
                    <button className="btn-ghost" style={{fontSize:11}}>📥 Download</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS ──────────────────────────── */}
      {tab==="documents"&&(
        <div>
          <div style={{display:"flex",gap:12,marginBottom:18,alignItems:"center"}}>
            <input placeholder="Search documents…" className="u-input" style={{maxWidth:280}}/>
            <select className="u-select" style={{width:"auto",paddingRight:32}}>
              {["All Documents","ALP Plans","Progress Reports","Evaluations","Consent Forms","504 Plans"].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <table className="data-table" style={{minWidth:520}}>
              <thead><tr>{["Document","Type","Date","Size","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {documents.map((doc,i)=>(
                  <tr key={doc.id}>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:20}}>{doc.icon}</span>
                        <span style={{fontSize:13.5,fontWeight:600,color:C.black}}>{doc.title}</span>
                      </div>
                    </td>
                    <td><Badge color="gray">{doc.type}</Badge></td>
                    <td style={{color:C.warm}}>{doc.date}</td>
                    <td style={{color:C.warm}}>{doc.size}</td>
                    <td>
                      {doc.status==="pending-signature"
                        ?<Badge color="amber">⚠ Needs Signature</Badge>
                        :<Badge color="green">✓ Available</Badge>}
                    </td>
                    <td>
                      <div style={{display:"flex",gap:8}}>
                        <button className="btn-ghost" style={{fontSize:11,padding:"6px 14px"}}>📖 View</button>
                        <button className="btn-ghost" style={{fontSize:11,padding:"6px 14px"}}>📥 Download</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MEETINGS ───────────────────────────── */}
      {tab==="meetings"&&(
        <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:20}}>
          <div>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:18}}>Upcoming Meetings</h3>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {meetings.map((m,i)=>(
                <div key={i} className="card" style={{padding:"18px 22px",display:"flex",alignItems:"center",gap:16,borderLeft:m.urgent?`4px solid ${C.purple}`:""}}>
                  <div style={{width:56,background:m.urgent?C.purple:"#1A1A1A",borderRadius:10,padding:"8px 0",textAlign:"center",flexShrink:0,color:"#fff"}}>
                    <div className="serif" style={{fontSize:24,fontWeight:700,lineHeight:1}}>{m.day}</div>
                    <div style={{fontSize:9,fontWeight:700,opacity:.7,letterSpacing:".07em",marginTop:1}}>{m.month}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:3}}>{m.title}</div>
                    <div style={{fontSize:12,color:C.warm,marginBottom:4}}>{m.time}</div>
                    <Badge color={m.urgent?"purple":"gray"}>{m.type}</Badge>
                  </div>
                  <button className={m.urgent?"btn-purple":"btn-ghost"} style={{fontSize:11,padding:"8px 18px",flexShrink:0}}>{m.action}</button>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{padding:"24px 26px"}}>
            <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Schedule a Meeting</h3>
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <USelect label="Family" value="johnson" onChange={()=>{}} options={[{value:"johnson",label:"Johnson Family (Marcus)"},{value:"lee",label:"Lee Family (Sofia)"},{value:"adeyemi",label:"Adeyemi Family (Aisha)"},{value:"parker",label:"Parker Family (Tyler)"}]}/>
              <USelect label="Meeting Type" value="review" onChange={()=>{}} options={[{value:"review",label:"Annual ALP Review"},{value:"progress",label:"Progress Check"},{value:"goals",label:"Goal Discussion"},{value:"amendment",label:"ALP Amendment"},{value:"triennial",label:"Triennial Reevaluation"},{value:"transition",label:"Transition Planning"}]}/>
              <UInput label="Preferred Date" type="date" value="2026-06-03" onChange={()=>{}}/>
              <UInput label="Preferred Time" type="time" value="14:00" onChange={()=>{}}/>
              <USelect label="Meeting Format" value="virtual" onChange={()=>{}} options={[{value:"virtual",label:"Virtual — Google Meet"},{value:"inperson",label:"In-Person — School"},{value:"phone",label:"Phone Call"},{value:"teams",label:"Virtual — Microsoft Teams"}]}/>
              <UTextarea label="Notes for Family" rows={3} value="" onChange={()=>{}} placeholder="Any specific topics to cover?"/>
              <button className="btn-black" style={{fontSize:11,padding:"13px"}}>📅 Send Meeting Invitation →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STUDENT PROGRESS (Family View) ─────── */}
      {tab==="progress"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
            {[["Reading","82%",C.purple,"↑ Improving"],["Math","68%",C.green,"→ Stable"],["Communication","75%",C.blue,"↑ Improving"],["Social-Emotional","59%",C.amber,"→ Stable"]].map(([d,v,c,t])=>(
              <div key={d} className="metric-card">
                <p className="lbl" style={{marginBottom:8}}>{d}</p>
                <div style={{fontSize:28,fontWeight:800,color:c,fontFamily:"'Playfair Display',serif"}}>{v}</div>
                <p style={{fontSize:11,color:c,fontWeight:600,marginTop:4}}>{t}</p>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <div className="card" style={{padding:"24px 26px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Goal Progress Summary</h3>
              {[{g:"Reading Fluency — 80 wcpm by May 2027",p:85,c:C.purple,s:"On Track"},
                {g:"Communication — 3-turn conversation",p:67,c:C.blue,s:"Developing"},
                {g:"Social-Emotional — Self-regulation",p:70,c:C.amber,s:"Developing"}].map(item=>(
                <div key={item.g} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:12.5,color:C.black,fontWeight:500,flex:1,marginRight:8}}>{item.g}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                      <span style={{fontSize:12,fontWeight:700,color:item.c}}>{item.p}%</span>
                      <Badge color={item.s==="On Track"?"green":"amber"}>{item.s}</Badge>
                    </div>
                  </div>
                  <PBar value={item.p} color={item.c}/>
                </div>
              ))}
            </div>
            <div className="card" style={{padding:"24px 26px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Recent Updates</h3>
              {[["May 6","Reading probe: 68 wcpm ↑ (was 65)","positive"],["May 3","Communication goal: 3-turn conv. practiced in class","positive"],["Apr 30","Behavior: Used break card independently ✓","positive"],["Apr 25","Math assessment: 63% (below 70% target)","concern"],["Apr 20","Self-regulation: Needed adult prompt 3/5 obs.","neutral"]].map(([date,update,type])=>(
                <div key={date} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>{type==="positive"?"🟢":type==="concern"?"🟡":"⚪"}</span>
                  <div>
                    <div style={{fontSize:11,color:C.warm,marginBottom:2}}>{date}</div>
                    <div style={{fontSize:12.5,color:C.black,lineHeight:1.5}}>{update}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{padding:"20px 22px",borderLeft:`4px solid ${C.purple}`}}>
            <p style={{fontSize:10,fontWeight:700,color:C.purple,letterSpacing:".1em",marginBottom:6}}>✦ ALP AI FAMILY INSIGHT</p>
            <p style={{fontSize:13.5,fontWeight:600,color:C.black,marginBottom:6}}>Marcus is making steady progress — here's what you can do at home</p>
            <p style={{fontSize:13,color:C.warm,lineHeight:1.65}}>Marcus's reading rate improved by 16 wcpm since September. To support his goal at home: read together for 10 minutes daily, ask him to retell what he read (helps comprehension), and praise effort over accuracy. For communication, encourage 3-turn conversations at dinner using open-ended questions about his day.</p>
          </div>
        </div>
      )}

      {/* ── COMMUNICATION LOG ──────────────────── */}
      {tab==="log"&&(
        <div>
          <div style={{display:"flex",gap:12,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
            <input placeholder="Search log…" className="u-input" style={{maxWidth:260}}/>
            <select className="u-select" style={{width:"auto",paddingRight:32}}>
              {["All Families","Johnson Family","Lee Family","Adeyemi Family","Parker Family"].map(o=><option key={o}>{o}</option>)}
            </select>
            <select className="u-select" style={{width:"auto",paddingRight:32}}>
              {["All Types","Message","Signature","Document","Meeting","Notice"].map(o=><option key={o}>{o}</option>)}
            </select>
            <button className="btn-ghost" style={{fontSize:11,marginLeft:"auto"}}>📥 Export Log</button>
          </div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <table className="data-table" style={{minWidth:520}}>
              <thead><tr>{["Date","Type","Direction","Family","Subject","Method","Staff"].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {commLog.map((entry,i)=>(
                  <tr key={i}>
                    <td style={{color:C.warm,whiteSpace:"nowrap"}}>{entry.date}</td>
                    <td><Badge color={typeColor[entry.type]===C.blue?"blue":typeColor[entry.type]===C.green?"green":typeColor[entry.type]===C.purple?"purple":typeColor[entry.type]===C.amber?"amber":"red"}>{entry.type}</Badge></td>
                    <td style={{fontSize:18,textAlign:"center"}}>{entry.direction}</td>
                    <td style={{fontWeight:600,color:C.black}}>{entry.family}</td>
                    <td style={{maxWidth:220,color:C.black}}>{entry.subject}</td>
                    <td style={{color:C.warm,fontSize:12}}>{entry.method}</td>
                    <td style={{color:C.warm,fontSize:12}}>{entry.staff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:"14px 20px",fontSize:12,color:C.warm,display:"flex",justifyContent:"space-between"}}>
            <span>Showing {commLog.length} of {commLog.length} entries</span>
            <span>FERPA compliant · All records encrypted · Audit trail active</span>
          </div>
        </div>
      )}
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════
function Reports(){
  const [tab,setTab]=useState("compliance");
  const [exporting,setExporting]=useState(null);
  const [validating,setValidating]=useState(false);
  const [validated,setValidated]=useState(false);

  const frameworks=[
    {icon:"🏛",label:"IDEA Federal Compliance",sub:"All 38 ALPs compliant · Last audit: March 2026",status:"Compliant",color:"green",score:98,students:38},
    {icon:"📅",label:"Annual Review Schedule",sub:"4 plans pending annual review within 30 days",status:"Review Due",color:"amber",score:89,students:4},
    {icon:"♿",label:"Section 504 / ADA",sub:"All 7 accommodation plans current and signed",status:"Compliant",color:"green",score:100,students:7},
    {icon:"⏰",label:"Reevaluation Schedule",sub:"2 students past 3-year reevaluation due date",status:"Overdue",color:"red",score:72,students:2},
    {icon:"🌍",label:"Ghana GES Framework",sub:"3 international students · All plans current",status:"Compliant",color:"green",score:100,students:3},
    {icon:"🇬🇧",label:"UK SEND Code of Practice",sub:"2 students · EHC Plans active and reviewed",status:"Compliant",color:"green",score:96,students:2},
    {icon:"🇨🇦",label:"Canada Provincial IEPs",sub:"1 student · Ontario framework compliant",status:"Compliant",color:"green",score:100,students:1},
    {icon:"🇦🇺",label:"NCCD Australia",sub:"2 students · Disability standards met",status:"Compliant",color:"green",score:94,students:2},
  ];

  const reportTypes=[
    {id:"alp",icon:"📋",label:"Individual ALP Report",desc:"Complete ALP document for one student — all 13 sections, goals, services, signatures.",formats:["PDF","Word"],time:"~10 sec"},
    {id:"progress",icon:"📈",label:"Student Progress Report",desc:"Visual progress report with charts, goal tracking, CBM data, and trend analysis.",formats:["PDF","Excel"],time:"~15 sec"},
    {id:"class",icon:"👥",label:"Class Caseload Report",desc:"All students in your caseload — summary of plans, goals, and compliance status.",formats:["PDF","Excel"],time:"~20 sec"},
    {id:"growth",icon:"📊",label:"Student Growth Report",desc:"Learning velocity, benchmark comparisons, intervention effectiveness ratings.",formats:["PDF"],time:"~12 sec"},
    {id:"family",icon:"❤️",label:"Family Progress Report",desc:"Parent-friendly progress summary — no jargon, visual graphs, plain language.",formats:["PDF"],time:"~8 sec"},
    {id:"compliance",icon:"✅",label:"School Compliance Report",desc:"Full compliance snapshot — overdue reviews, missing signatures, framework status.",formats:["PDF","Excel"],time:"~25 sec"},
    {id:"district",icon:"🏫",label:"District Summary Report",desc:"District-wide ALP metrics, compliance rates, and aggregate student data.",formats:["PDF","Excel","CSV"],time:"~30 sec"},
    {id:"audit",icon:"🔍",label:"Audit Trail Report",desc:"Complete activity log — who created, edited, signed, and exported every document.",formats:["PDF","CSV"],time:"~18 sec"},
    {id:"intervention",icon:"🎯",label:"Intervention Effectiveness",desc:"RTI outcomes, goal attainment rates, and intervention strategy analysis.",formats:["PDF","Excel"],time:"~22 sec"},
  ];

  const recentExports=[
    {icon:"📋",label:"Marcus Johnson — ALP Report",by:"Ms. Simmons",date:"May 6, 2026",format:"PDF",size:"2.4 MB"},
    {icon:"📈",label:"Q3 Progress Report — Class",by:"Ms. Simmons",date:"May 5, 2026",format:"Excel",size:"1.1 MB"},
    {icon:"✅",label:"School Compliance Report — May",by:"Principal Owusu",date:"May 3, 2026",format:"PDF",size:"3.2 MB"},
    {icon:"📋",label:"Aisha Adeyemi — ALP Report",by:"Ms. Simmons",date:"Apr 30, 2026",format:"PDF",size:"2.1 MB"},
  ];

  const auditLog=[
    {time:"May 6, 2026 · 2:14 PM",user:"Ms. Simmons",action:"Exported ALP Report",target:"Marcus Johnson",type:"export",ip:"192.168.1.45"},
    {time:"May 6, 2026 · 11:03 AM",user:"Ms. Simmons",action:"Updated Goal — Reading",target:"Marcus Johnson",type:"edit",ip:"192.168.1.45"},
    {time:"May 5, 2026 · 4:22 PM",user:"Ms. Simmons",action:"Sent Signature Request",target:"Johnson Family",type:"signature",ip:"192.168.1.45"},
    {time:"May 5, 2026 · 9:15 AM",user:"Patricia Johnson",action:"Signed ALP Document",target:"Marcus Johnson — ALP 2026",type:"signature",ip:"74.125.224.102"},
    {time:"May 4, 2026 · 3:08 PM",user:"Ms. Rivera",action:"Added Session Note",target:"Marcus Johnson — SLP",type:"create",ip:"192.168.1.62"},
    {time:"May 3, 2026 · 10:44 AM",user:"Ms. Simmons",action:"Created ALP Amendment",target:"Aisha Adeyemi",type:"create",ip:"192.168.1.45"},
    {time:"May 2, 2026 · 2:30 PM",user:"Principal Owusu",action:"Viewed Compliance Report",target:"School Dashboard",type:"view",ip:"192.168.1.10"},
    {time:"May 1, 2026 · 9:00 AM",user:"System",action:"Auto-generated Review Reminder",target:"4 students due",type:"system",ip:"—"},
    {time:"Apr 30, 2026 · 4:15 PM",user:"Ms. Simmons",action:"Entered CBM Data",target:"Sofia Lee — Reading Probe",type:"edit",ip:"192.168.1.45"},
    {time:"Apr 28, 2026 · 11:20 AM",user:"Ms. Simmons",action:"Completed ALP Meeting",target:"Johnson Family",type:"meeting",ip:"192.168.1.45"},
  ];

  const actionColor={export:C.blue,edit:C.amber,signature:C.purple,create:C.green,view:C.warm,system:C.red,meeting:C.blue};
  const actionIcon={export:"📤",edit:"✏️",signature:"✍️",create:"➕",view:"👁",system:"🤖",meeting:"📅"};

  const sigRequests=[
    {id:1,student:"Marcus Johnson",doc:"ALP 2026–2027",family:"Patricia Johnson",sent:"May 5, 2026",deadline:"May 22, 2026",status:"pending"},
    {id:2,student:"Aisha Adeyemi",doc:"ALP Amendment",family:"Mr. & Mrs. Adeyemi",sent:"May 2, 2026",deadline:"May 16, 2026",status:"pending"},
    {id:3,student:"Sofia Lee",doc:"RTI-II Consent",family:"Lee Family",sent:"Apr 15, 2026",deadline:"Apr 29, 2026",status:"signed",signedDate:"Apr 22"},
    {id:4,student:"Tyler Parker",doc:"504 Annual Review",family:"Parker Family",sent:"Mar 10, 2026",deadline:"Mar 24, 2026",status:"signed",signedDate:"Mar 18"},
    {id:5,student:"Ryan Chen",doc:"ALP 2026–2027",family:"Chen Family",sent:"May 8, 2026",deadline:"May 22, 2026",status:"pending"},
  ];

  const timeline=[
    {date:"May 14, 2026",days:3,label:"Marcus Johnson — Annual ALP Review Meeting",type:"meeting",urgent:true},
    {date:"May 16, 2026",days:5,label:"Aisha Adeyemi — ALP Amendment Signature Deadline",type:"signature",urgent:true},
    {date:"May 22, 2026",days:11,label:"Marcus Johnson — Signature Deadline",type:"signature",urgent:false},
    {date:"May 22, 2026",days:11,label:"Ryan Chen — Signature Deadline",type:"signature",urgent:false},
    {date:"May 28, 2026",days:17,label:"Sofia Lee — Annual Review Due",type:"review",urgent:false},
    {date:"Jun 3, 2026",days:23,label:"Tyler Parker — 504 Annual Review",type:"review",urgent:false},
    {date:"Jun 15, 2026",days:35,label:"Ryan Chen — Reevaluation Due (3-year)",type:"reeval",urgent:false},
    {date:"Aug 1, 2026",days:82,label:"Kofi Mensah — Annual Review",type:"review",urgent:false},
  ];

  const validationResults=[
    {student:"Marcus Johnson",plan:"ALP",score:96,issues:[],warnings:["Transition planning section recommended for age 10+"]},
    {student:"Sofia Lee",plan:"RTI-II",score:100,issues:[],warnings:[]},
    {student:"Aisha Adeyemi",plan:"ALP",score:84,issues:["Parent signature missing","Amendment not yet delivered to family"],warnings:["Communication goal baseline not documented"]},
    {student:"Ryan Chen",plan:"ALP",score:71,issues:["Annual review overdue by 3 days","Reevaluation consent pending"],warnings:["Transition section incomplete for age 11"]},
    {student:"Tyler Parker",plan:"504",score:98,issues:[],warnings:["Accommodation review recommended"]},
  ];

  function doExport(reportId){
    setExporting(reportId);
    setTimeout(()=>setExporting(null),2000);
  }

  return(
    <Page
      title={<>Reports & <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Compliance</span></>}
      subtitle="Multi-Framework Compliance · Audit Trail · Digital Signatures"
      action={<button className="btn-outline" onClick={()=>doExport("all")} style={{fontSize:11,padding:"10px 22px"}}>{exporting==="all"?<><Spin color={C.purple}/> Exporting…</>:"Export All ↗"}</button>}>

      {/* Summary row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
        {[["COMPLIANT PLANS","36","of 38 active ALPs",C.green],["REVIEW DUE","4","within 30 days",C.amber],["OVERDUE","2","past due date",C.red],["FRAMEWORKS","8","all monitored",C.purple]].map(([l,v,s,c])=>(
          <div key={l} className="metric-card">
            <p className="lbl" style={{marginBottom:8}}>{l}</p>
            <div className="serif" style={{fontSize:28,fontWeight:700,color:c,letterSpacing:"-1px"}}>{v}</div>
            <p style={{fontSize:11,color:C.warm,marginTop:4}}>{s}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:22,borderBottom:`1px solid ${C.tanL}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {[["compliance","✅ Compliance"],["reports","📄 Reports"],["signatures","✍️ Signatures"],["audit","🔍 Audit Log"],["validation","🔬 Validation"],["timeline","📅 Timeline"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} className={`tab-btn${tab===id?" active":""}`} style={{marginRight:22,whiteSpace:"nowrap"}}>{label}</button>
        ))}
      </div>

      {/* ── COMPLIANCE DASHBOARD ──────────────── */}
      {tab==="compliance"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            {frameworks.map((f,i)=>(
              <div key={f.label} className="card" style={{padding:"18px 22px",display:"flex",gap:14,alignItems:"flex-start"}}>
                <div style={{width:46,height:46,borderRadius:11,background:C.purpleL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:`1px solid ${C.tanL}`}}>{f.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:C.black,lineHeight:1.3,flex:1,marginRight:8}}>{f.label}</div>
                    <Badge color={f.color}>{f.status}</Badge>
                  </div>
                  <div style={{fontSize:12,color:C.warm,marginBottom:8}}>{f.sub}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}><PBar value={f.score} color={f.score>=90?C.green:f.score>=75?C.amber:C.red}/></div>
                    <span style={{fontSize:11,fontWeight:700,color:f.score>=90?C.green:f.score>=75?C.amber:C.red,flexShrink:0}}>{f.score}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div className="card" style={{padding:"22px 24px"}}>
              <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Overdue Actions</h3>
              {[["Ryan Chen","Reevaluation 3-day overdue","red"],["Ryan Chen","Annual review overdue","red"],["Aisha Adeyemi","Amendment signature pending","amber"],["Marcus Johnson","Signature deadline in 11 days","amber"]].map(([student,action,color])=>(
                <div key={action} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"flex-start"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C[color]||C.amber,flexShrink:0,marginTop:5}}/>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.black}}>{student}</div><div style={{fontSize:12,color:C.warm}}>{action}</div></div>
                </div>
              ))}
            </div>
            <div className="card" style={{padding:"22px 24px"}}>
              <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Compliance Score</h3>
              <div style={{textAlign:"center",marginBottom:16}}>
                <div className="serif" style={{fontSize:52,fontWeight:800,color:C.green,letterSpacing:"-2px"}}>94%</div>
                <p style={{fontSize:12,color:C.warm}}>Overall school compliance</p>
              </div>
              {[["IDEA Federal","98%",C.green],["Annual Reviews","89%",C.amber],["Reevaluation","72%",C.red],["Signatures","85%",C.amber]].map(([label,v,c])=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.tanL}`}}>
                  <span style={{fontSize:12.5,color:C.black}}>{label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── REPORTS GENERATOR ─────────────────── */}
      {tab==="reports"&&(
        <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:20}}>
          <div>
            <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
              <select className="u-select" style={{width:"auto",paddingRight:32}}>
                {["All Students","Marcus Johnson","Sofia Lee","Aisha Adeyemi","Tyler Parker","Ryan Chen"].map(o=><option key={o}>{o}</option>)}
              </select>
              <UInput label="" value="2026-01-01" type="date" onChange={()=>{}}/>
              <span style={{fontSize:12,color:C.warm}}>to</span>
              <UInput label="" value="2026-05-31" type="date" onChange={()=>{}}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {reportTypes.map(r=>(
                <div key={r.id} className="card" style={{padding:"18px 20px",display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:44,height:44,borderRadius:10,background:C.purpleL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:`1px solid ${C.tanL}`}}>{r.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:C.black,marginBottom:3}}>{r.label}</div>
                    <div style={{fontSize:12,color:C.warm,marginBottom:6}}>{r.desc}</div>
                    <div style={{display:"flex",gap:6}}>
                      {r.formats.map(f=><span key={f} style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:C.purpleL,color:C.purple,border:`1px solid ${C.tanL}`}}>{f}</span>)}
                      <span style={{fontSize:10,color:C.warm,marginLeft:4}}>⏱ {r.time}</span>
                    </div>
                  </div>
                  <button className="btn-black" onClick={()=>doExport(r.id)} disabled={exporting===r.id} style={{fontSize:11,padding:"9px 18px",flexShrink:0}}>
                    {exporting===r.id?<><Spin/>…</>:"📥 Export"}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="card" style={{padding:"22px 24px",marginBottom:16}}>
              <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Recent Exports</h3>
              {recentExports.map((e,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:i<recentExports.length-1?`1px solid ${C.tanL}`:"none",alignItems:"center"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{e.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:600,color:C.black,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.label}</div>
                    <div style={{fontSize:11,color:C.warm,marginTop:1}}>{e.by} · {e.date} · {e.size}</div>
                  </div>
                  <Badge color="gray">{e.format}</Badge>
                </div>
              ))}
            </div>
            <div className="card" style={{padding:"20px 22px"}}>
              <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:12}}>Quick Export</h3>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {["All ALPs (PDF)","Compliance Summary","Overdue List","Signature Status","District Data (CSV)"].map(r=>(
                  <button key={r} className="btn-ghost" onClick={()=>doExport(r)} disabled={exporting===r} style={{fontSize:11,padding:"7px 14px"}}>
                    {exporting===r?"⏳":""} {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SIGNATURES ────────────────────────── */}
      {tab==="signatures"&&(
        <div>
          <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center"}}>
            <select className="u-select" style={{width:"auto",paddingRight:32}}>
              {["All Families","Johnson Family","Adeyemi Family","Chen Family"].map(o=><option key={o}>{o}</option>)}
            </select>
            <select className="u-select" style={{width:"auto",paddingRight:32}}>
              {["All Status","Pending","Signed","Overdue"].map(o=><option key={o}>{o}</option>)}
            </select>
            <button className="btn-black" style={{fontSize:11,padding:"9px 18px",marginLeft:"auto"}}>+ Send New Signature Request</button>
          </div>
          <div className="card" style={{padding:0,overflow:"hidden",marginBottom:20}}>
            <table className="data-table" style={{minWidth:520}}>
              <thead><tr>{["Student","Document","Family","Sent","Deadline","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {sigRequests.map(s=>(
                  <tr key={s.id}>
                    <td style={{fontWeight:600}}>{s.student}</td>
                    <td style={{color:C.warm,fontSize:12}}>{s.doc}</td>
                    <td>{s.family}</td>
                    <td style={{color:C.warm,fontSize:12}}>{s.sent}</td>
                    <td style={{color:s.status==="pending"?C.amber:C.warm,fontWeight:s.status==="pending"?700:400,fontSize:12}}>{s.deadline}</td>
                    <td>
                      {s.status==="signed"
                        ?<Badge color="green">✓ Signed {s.signedDate}</Badge>
                        :<Badge color="amber">⏳ Pending</Badge>}
                    </td>
                    <td>
                      <div style={{display:"flex",gap:6}}>
                        <button className="btn-ghost" style={{fontSize:11,padding:"5px 12px"}}>📖 View</button>
                        {s.status==="pending"&&<button className="btn-ghost" style={{fontSize:11,padding:"5px 12px"}}>🔁 Resend</button>}
                        {s.status==="signed"&&<button className="btn-ghost" style={{fontSize:11,padding:"5px 12px"}}>📥 Download</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
            {[["Total Requests","5","this year",C.purple],["Signed","2","avg 6 days",C.green],["Pending","3","action required",C.amber]].map(([l,v,s,c])=>(
              <div key={l} className="metric-card">
                <p className="lbl" style={{marginBottom:8}}>{l}</p>
                <div className="serif" style={{fontSize:28,fontWeight:700,color:c}}>{v}</div>
                <p style={{fontSize:11,color:C.warm,marginTop:4}}>{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUDIT LOG ─────────────────────────── */}
      {tab==="audit"&&(
        <div>
          <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <input placeholder="Search audit log…" className="u-input" style={{maxWidth:240}}/>
            <select className="u-select" style={{width:"auto",paddingRight:32}}>
              {["All Users","Ms. Simmons","Principal Owusu","Ms. Rivera","System","Families"].map(o=><option key={o}>{o}</option>)}
            </select>
            <select className="u-select" style={{width:"auto",paddingRight:32}}>
              {["All Actions","Export","Edit","Create","Signature","View","Meeting","System"].map(o=><option key={o}>{o}</option>)}
            </select>
            <button className="btn-ghost" style={{fontSize:11,marginLeft:"auto"}}>📥 Export Log (CSV)</button>
          </div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <table className="data-table" style={{minWidth:520}}>
              <thead><tr>{["Timestamp","User","Action","Target","Type","IP Address"].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {auditLog.map((entry,i)=>(
                  <tr key={i}>
                    <td style={{color:C.warm,fontSize:11,whiteSpace:"nowrap"}}>{entry.time}</td>
                    <td style={{fontWeight:600,color:C.black}}>{entry.user}</td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:14}}>{actionIcon[entry.type]}</span>
                        <span style={{fontSize:13,color:C.black}}>{entry.action}</span>
                      </div>
                    </td>
                    <td style={{fontSize:12.5,color:C.warm}}>{entry.target}</td>
                    <td><Badge color={entry.type==="signature"?"purple":entry.type==="create"?"green":entry.type==="export"?"blue":entry.type==="system"?"red":"gray"}>{entry.type}</Badge></td>
                    <td style={{fontSize:11,color:C.warm,fontFamily:"monospace"}}>{entry.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:"12px 20px",fontSize:12,color:C.warm,display:"flex",justifyContent:"space-between",borderTop:`1px solid ${C.tanL}`}}>
            <span>Showing {auditLog.length} most recent entries</span>
            <span>🔒 FERPA Compliant · All entries encrypted · Immutable log · Retained 7 years</span>
          </div>
        </div>
      )}

      {/* ── FRAMEWORK VALIDATION ──────────────── */}
      {tab==="validation"&&(
        <div>
          <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:20,padding:"18px 22px",background:C.purpleL,border:`1px solid ${C.tanL}`,borderRadius:12}}>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:4}}>✦ ALP AI Framework Validator</p>
              <p style={{fontSize:13,color:C.warm}}>Automatically checks all student plans against IDEA, Section 504, GES, and other active compliance frameworks. Identifies missing sections, incomplete fields, and required signatures.</p>
            </div>
            <button className="btn-black" onClick={()=>{setValidating(true);setTimeout(()=>{setValidating(false);setValidated(true);},2000);}} disabled={validating} style={{fontSize:11,padding:"11px 22px",flexShrink:0}}>
              {validating?<><Spin/>Validating…</>:"🔬 Validate All Plans"}
            </button>
          </div>
          {validated&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {validationResults.map(r=>(
                <div key={r.student} className="card" style={{padding:"18px 22px",borderLeft:`4px solid ${r.score>=90?C.green:r.score>=75?C.amber:C.red}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <Avatar name={r.student} size={36}/>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:C.black}}>{r.student}</div>
                        <div style={{fontSize:12,color:C.warm}}>{r.plan} Plan</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div className="serif" style={{fontSize:24,fontWeight:700,color:r.score>=90?C.green:r.score>=75?C.amber:C.red}}>{r.score}%</div>
                      <Badge color={r.score>=90?"green":r.score>=75?"amber":"red"}>{r.score>=90?"Valid":r.score>=75?"Review":"Issues Found"}</Badge>
                    </div>
                  </div>
                  {r.issues.length>0&&(
                    <div style={{marginBottom:8}}>
                      <p style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:4}}>⚠ COMPLIANCE ISSUES:</p>
                      {r.issues.map(issue=><div key={issue} style={{fontSize:12.5,color:C.red,padding:"3px 0"}}>• {issue}</div>)}
                    </div>
                  )}
                  {r.warnings.length>0&&(
                    <div>
                      <p style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:4}}>⚡ RECOMMENDATIONS:</p>
                      {r.warnings.map(w=><div key={w} style={{fontSize:12.5,color:C.amber,padding:"3px 0"}}>• {w}</div>)}
                    </div>
                  )}
                  {r.issues.length===0&&r.warnings.length===0&&(
                    <div style={{fontSize:13,color:C.green}}>✓ All sections complete and compliant. No issues found.</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!validated&&!validating&&(
            <div style={{textAlign:"center",padding:"60px 20px",color:C.warm}}>
              <div style={{fontSize:48,marginBottom:16}}>🔬</div>
              <p style={{fontSize:14,fontWeight:600,marginBottom:8}}>Run Validation to Check All Plans</p>
              <p style={{fontSize:13}}>ALP AI will check every student plan against all active compliance frameworks and identify any issues or missing elements.</p>
            </div>
          )}
        </div>
      )}

      {/* ── TIMELINE & SCHEDULE ───────────────── */}
      {tab==="timeline"&&(
        <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:20}}>
          <div>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:18}}>Upcoming Deadlines</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {timeline.map((t,i)=>(
                <div key={i} className="card" style={{padding:"14px 18px",display:"flex",gap:14,alignItems:"center",borderLeft:`4px solid ${t.urgent?C.red:t.days<=14?C.amber:C.green}`}}>
                  <div style={{flexShrink:0,textAlign:"center",minWidth:52}}>
                    <div className="serif" style={{fontSize:20,fontWeight:700,color:t.urgent?C.red:C.black}}>{t.days}</div>
                    <div style={{fontSize:9,color:C.warm,textTransform:"uppercase",letterSpacing:".08em"}}>days</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.black,lineHeight:1.3}}>{t.label}</div>
                    <div style={{fontSize:11,color:C.warm,marginTop:2}}>{t.date}</div>
                  </div>
                  <Badge color={t.type==="meeting"?"blue":t.type==="signature"?"purple":t.type==="reeval"?"red":"amber"}>
                    {t.type==="meeting"?"Meeting":t.type==="signature"?"Signature":t.type==="reeval"?"Reevaluation":"Review"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div className="card" style={{padding:"22px 24px"}}>
              <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Schedule Summary</h3>
              {[["Reviews this month","4","amber"],["Signatures pending","3","red"],["Meetings scheduled","3","blue"],["Reevaluations due","1","red"],["Reviews next month","2","green"]].map(([label,count,color])=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}>
                  <span style={{fontSize:13,color:C.black}}>{label}</span>
                  <span style={{fontSize:14,fontWeight:700,color:C[color]||C.warm}}>{count}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{padding:"22px 24px"}}>
              <h3 className="serif" style={{fontSize:15,fontWeight:700,marginBottom:14}}>Auto-Scheduling</h3>
              <p style={{fontSize:13,color:C.warm,marginBottom:14,lineHeight:1.6}}>ALP AI can automatically schedule review meetings, send reminders, and manage signature deadlines.</p>
              {["Auto-send review reminders","Calendar integration","Email family notifications","Deadline alerts"].map(item=>(
                <label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:8,cursor:"pointer"}}>
                  <input type="checkbox" defaultChecked style={{accentColor:C.purple,width:14,height:14}}/>{item}
                </label>
              ))}
              <button className="btn-black" style={{width:"100%",marginTop:14,fontSize:11,padding:"12px"}}>Enable Auto-Scheduling →</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS SCREEN
// ═══════════════════════════════════════════════════════════
function Notifications(){
  const [filter,setFilter]=useState("all");
  const notifs=[
    {id:1,type:"review",icon:"📅",title:"Annual Review Due Soon",body:"Marcus Johnson's ALP annual review is due in 14 days — May 8, 2027.",time:"2 hours ago",read:false,urgent:true},
    {id:2,type:"goal",icon:"🎉",title:"Goal Mastered!",body:"Sofia Lee has mastered her Reading goal: 80 wcpm achieved across 4 consecutive probes.",time:"Yesterday",read:false,urgent:false},
    {id:3,type:"message",icon:"💬",title:"New Message from Johnson Family",body:"\"Can we discuss the reading goals before the review meeting?\"",time:"Yesterday",read:false,urgent:false},
    {id:4,type:"signature",icon:"✍️",title:"Signature Pending",body:"Marcus Johnson's ALP requires parent signature from Patricia Johnson.",time:"2 days ago",read:true,urgent:true},
    {id:5,type:"progress",icon:"⚠️",title:"Goal At Risk",body:"Aisha Adeyemi's Communication goal shows declining trend. Intervention may be needed.",time:"3 days ago",read:true,urgent:true},
    {id:6,type:"goal",icon:"🎉",title:"Goal Mastered!",body:"Tyler Parker has mastered his Math goal: 2-step word problems at 85% accuracy.",time:"4 days ago",read:true,urgent:false},
    {id:7,type:"review",icon:"📅",title:"Annual Review Overdue",body:"Ryan Chen's ALP annual review is overdue by 3 days. Please schedule immediately.",time:"5 days ago",read:true,urgent:true},
    {id:8,type:"message",icon:"💬",title:"New Message from Adeyemi Family",body:"\"Is Thursday at 4PM available for a quick progress check?\"",time:"1 week ago",read:true,urgent:false},
  ];
  const typeColors={review:C.amber,goal:C.green,message:C.blue,signature:C.purple,progress:C.red};
  const filtered=notifs.filter(n=>filter==="all"||filter==="unread"&&!n.read||n.type===filter);
  const unread=notifs.filter(n=>!n.read).length;
  return(
    <Page title={<>Notifications</>} subtitle={`${unread} unread · ALP Platform`}
      action={<div style={{display:"flex",gap:10}}><button className="btn-ghost" style={{fontSize:11}}>Mark all read</button><button className="btn-black" style={{fontSize:11,padding:"11px 24px"}}>⚙ Preferences</button></div>}>
      <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
        {/* Filter sidebar */}
        <div className="card" style={{width:180,flexShrink:0,padding:16}}>
          <p className="lbl" style={{marginBottom:14}}>Filter</p>
          {[["all","All",""],["unread","Unread",`${unread}`],["review","Reviews",""],["goal","Goals",""],["message","Messages",""],["signature","Signatures",""],["progress","At Risk",""]].map(([id,label,count])=>(
            <button key={id} onClick={()=>setFilter(id)}
              style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:8,marginBottom:2,background:filter===id?C.purpleL:"transparent",color:filter===id?C.purple:C.warm,fontSize:13,fontWeight:filter===id?600:400,border:"none",cursor:"pointer",transition:"all .12s",textAlign:"left"}}
              onMouseEnter={e=>{if(filter!==id)e.currentTarget.style.background="#F5F0EB";}}
              onMouseLeave={e=>{if(filter!==id)e.currentTarget.style.background="transparent";}}>
              <span style={{textTransform:"capitalize"}}>{label}</span>
              {count&&<span style={{fontSize:10,fontWeight:700,background:C.purple,color:"#fff",padding:"1px 7px",borderRadius:99}}>{count}</span>}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        <div style={{flex:1}}>
          {filtered.length===0&&(
            <div className="card" style={{padding:"48px 32px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>🎉</div>
              <h3 className="serif" style={{fontSize:20,fontWeight:700,marginBottom:6}}>All caught up!</h3>
              <p style={{fontSize:14,color:C.warm}}>No notifications match this filter.</p>
            </div>
          )}
          {filtered.map((n,i)=>(
            <div key={n.id} className="card" style={{padding:"18px 22px",marginBottom:10,borderLeft:`4px solid ${n.read?"transparent":typeColors[n.type]||C.purple}`,opacity:n.read?.75:1,transition:"all .15s",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.1)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,.05),0 4px 16px rgba(0,0,0,.04)"}>
              <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:n.read?"#F5F0EB":`${typeColors[n.type]}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {n.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:14,fontWeight:n.read?500:700,color:C.black}}>{n.title}</span>
                      {n.urgent&&!n.read&&<Badge color="red">Urgent</Badge>}
                    </div>
                    <span style={{fontSize:11,color:C.warm,flexShrink:0,marginLeft:12}}>{n.time}</span>
                  </div>
                  <p style={{fontSize:13,color:C.warm,lineHeight:1.55}}>{n.body}</p>
                </div>
                {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:typeColors[n.type]||C.purple,flexShrink:0,marginTop:6}}/>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════
function Settings(){
  const [activeTab,setActiveTab]=useState("profile");
  const [saved,setSaved]=useState(false);
  function save(){setSaved(true);setTimeout(()=>setSaved(false),2500);}
  return(
    <Page title={<>Settings</>} subtitle="Account & Platform Configuration">
      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:`1px solid ${C.tanL}`,paddingBottom:0,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {[["profile","👤 Profile"],["school","🏫 School"],["roles","👥 Users & Roles"],["notifications","🔔 Notifications"],["compliance","✅ Compliance"],["billing","💳 Billing"]].map(([id,label])=>(
          <button key={id} className={`tab-btn${activeTab===id?" active":""}`} onClick={()=>setActiveTab(id)} style={{whiteSpace:"nowrap",flexShrink:0,marginRight:20}}>{label}</button>
        ))}
      </div>

      {activeTab==="profile"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:24}}>
          <div className="card" style={{padding:"28px",textAlign:"center"}}>
            <Avatar name="Ms Simmons" size={80}/>
            <h3 className="serif" style={{fontSize:18,fontWeight:700,marginTop:14,marginBottom:4}}>Ms. Simmons</h3>
            <p style={{fontSize:13,color:C.warm,marginTop:2}}>Special Education Teacher</p>
            <p style={{fontSize:12,color:C.tan,marginTop:4}}>Westwood Elementary · Grade 2–6</p>
            <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${C.tanL}`}}>
              <Badge color="purple">Teacher</Badge>
            </div>
            <button className="btn-outline" style={{width:"100%",marginTop:16,fontSize:11}}>Change Photo</button>
          </div>
          <div className="card" style={{padding:"28px"}}>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:24}}>Personal Information</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:28}}>
              <UInput label="First Name" value="Sarah" onChange={()=>{}}/>
              <UInput label="Last Name" value="Simmons" onChange={()=>{}}/>
              <UInput label="Email Address" value="ms.simmons@westwood.edu" onChange={()=>{}} type="email"/>
              <UInput label="Phone" value="+1 (703) 555-0142" onChange={()=>{}}/>
              <UInput label="Title / Role" value="Special Education Teacher" onChange={()=>{}}/>
              <UInput label="License Number" value="VA-SPED-2024-8821" onChange={()=>{}}/>
            </div>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Change Password</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:28}}>
              <UInput label="Current Password" value="" onChange={()=>{}} type="password" placeholder="••••••••"/>
              <UInput label="New Password" value="" onChange={()=>{}} type="password" placeholder="••••••••"/>
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
            <UInput label="School Name" value="Westwood Elementary School" onChange={()=>{}}/>
            <UInput label="School Code" value="WES-2024" onChange={()=>{}}/>
            <UInput label="District" value="Westwood Unified School District" onChange={()=>{}}/>
            <UInput label="State / Region" value="Virginia, USA" onChange={()=>{}}/>
            <USelect label="Compliance Framework" value="IDEA_USA" onChange={()=>{}} options={[{value:"IDEA_USA",label:"IDEA (USA)"},{value:"SECTION_504",label:"Section 504"},{value:"VDOE",label:"VDOE Virginia"},{value:"GES_GHANA",label:"GES Ghana"},{value:"NERDC_NIGERIA",label:"NERDC Nigeria"},{value:"KICD_KENYA",label:"KICD Kenya"},{value:"UK_SEND",label:"UK SEND"},{value:"AUSTRALIA_NCCD",label:"Australia NCCD"},{value:"CUSTOM",label:"Custom Framework"}]}/>
            <UInput label="Academic Year" value="2025–2026" onChange={()=>{}}/>
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
            <button className="btn-black" style={{fontSize:11,padding:"11px 22px"}}>+ Invite User</button>
          </div>

          {/* Role Summary Cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
            {ROLES.slice(0,4).map(r=>(
              <div key={r.id} className="card" style={{padding:"16px 18px",borderTop:`3px solid ${r.color}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:18}}>{r.icon}</span>
                  <span style={{fontSize:12.5,fontWeight:700,color:C.black}}>{r.label}</span>
                </div>
                <div className="serif" style={{fontSize:24,fontWeight:700,color:r.color,letterSpacing:"-1px"}}>{[1,8,14,3][ROLES.indexOf(r)]}</div>
                <div style={{fontSize:11,color:C.warm}}>users</div>
              </div>
            ))}
          </div>

          {/* Users Table */}
          <div className="card" style={{padding:0,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"16px 22px",borderBottom:`1px solid ${C.tanL}`,display:"flex",gap:12}}>
              <input placeholder="Search users…" className="u-input" style={{maxWidth:240}}/>
              <select className="u-select" style={{width:"auto",paddingRight:32}}>
                {["All Roles",...ROLES.map(r=>r.label)].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <table className="data-table" style={{minWidth:520}}>
              <thead><tr>{["User","Role","School","Last Active","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {[
                  {name:"Dr. Abena Sarpong",role:"Administrator",roleId:"admin",school:"District Office",active:"Today",status:"active"},
                  {name:"Principal Owusu",role:"School Leadership",roleId:"leadership",school:"Westwood Elementary",active:"Today",status:"active"},
                  {name:"Ms. Simmons",role:"Special Ed Teacher",roleId:"teacher",school:"Westwood Elementary",active:"2 hours ago",status:"active"},
                  {name:"Mr. Kofi Mensah",role:"Intervention Specialist",roleId:"intervention",school:"Westwood Elementary",active:"Yesterday",status:"active"},
                  {name:"Ms. Rivera",role:"Related Services",roleId:"related",school:"Westwood Elementary",active:"Today",status:"active"},
                  {name:"Mr. Davis",role:"General Ed Teacher",roleId:"teacher",school:"Westwood Elementary",active:"3 days ago",status:"active"},
                  {name:"Patricia Johnson",role:"Family / Parent",roleId:"family",school:"External",active:"May 3",status:"active"},
                  {name:"Pending Invite",role:"Special Ed Teacher",roleId:"teacher",school:"Riverside High",active:"—",status:"pending"},
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
                    ["View all students","✓","✓","Own","Own","Own"],
                    ["Create / Edit ALPs","✓","✓","✓","✓","—"],
                    ["Export documents","✓","✓","✓","✓","—"],
                    ["View compliance reports","✓","✓","—","—","—"],
                    ["Manage users","✓","—","—","—","—"],
                    ["Billing access","✓","—","—","—","—"],
                    ["Family portal access","✓","✓","✓","✓","✓"],
                    ["Send signature requests","✓","✓","✓","—","—"],
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
        <div className="card" style={{padding:"28px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:24}}>Notification Preferences</h3>
          {[["Annual Review Alerts","Get notified 30 days before annual review deadlines",true],["Goal Mastery",  "Celebrate when students achieve their ALP goals",true],["Goal At-Risk Alerts","Alert when a goal shows declining trend for 2+ data points",true],["Parent Messages","Notify when families send a new message",true],["Signature Requests","Alert when documents require signature",true],["Weekly Digest","Monday morning summary of student progress",false],["Progress Data Reminders","Remind when progress hasn't been logged in 30+ days",true],["Subscription & Billing","Renewal reminders and billing alerts",true]].map(([title,desc,def])=>{
            const [on,setOn]=useState(def);
            return(
              <div key={title} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0",borderBottom:`1px solid ${C.tanL}`}}>
                <div><div style={{fontSize:14,fontWeight:500,marginBottom:2}}>{title}</div><div style={{fontSize:12,color:C.warm}}>{desc}</div></div>
                <div onClick={()=>setOn(p=>!p)} style={{width:44,height:24,borderRadius:99,background:on?C.purple:C.tanL,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                  <div style={{position:"absolute",top:2,left:on?22:2,width:20,height:20,borderRadius:"50%",background:C.white,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
                </div>
              </div>
            );
          })}
          <div style={{marginTop:20}}><button className="btn-black" onClick={save} style={{fontSize:11,padding:"12px 28px"}}>{saved?"✓ Saved!":"Save Preferences"}</button></div>
        </div>
      )}

      {activeTab==="compliance"&&(
        <div className="card" style={{padding:"28px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:8}}>Compliance Configuration</h3>
          <p style={{fontSize:13,color:C.warm,marginBottom:24}}>Configure which compliance frameworks ALP enforces for your school or district.</p>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
            {[{id:"IDEA",name:"IDEA Federal Compliance (USA)",active:true,req:["goals","services","accommodations","parentSignature","reviewDate"]},{id:"504",name:"Section 504 / ADA",active:true,req:["accommodations","reviewDate"]},{id:"VDOE",name:"VDOE Virginia",active:true,req:["goals","services","accommodations","parentSignature","reviewDate","presentLevels"]},{id:"GES",name:"GES Ghana SPED",active:false,req:["goals","presentLevels","familyInput"]},{id:"UK",name:"UK SEND Code of Practice",active:false,req:["goals","services","parentSignature","reviewDate","outcomes"]}].map(f=>{
              const [on,setOn]=useState(f.active);
              return(
                <div key={f.id} style={{border:`1px solid ${on?C.purple:C.tanL}`,background:on?"#FAF8FF":C.white,borderRadius:10,padding:"16px 18px",transition:"all .15s"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:14,fontWeight:600}}>{f.name}</div>
                    <div onClick={()=>setOn(p=>!p)} style={{width:44,height:24,borderRadius:99,background:on?C.purple:C.tanL,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                      <div style={{position:"absolute",top:2,left:on?22:2,width:20,height:20,borderRadius:"50%",background:C.white,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
                    </div>
                  </div>
                  {on&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{f.req.map(r=><Badge key={r} color="purple">{r}</Badge>)}</div>}
                </div>
              );
            })}
          </div>
          <button className="btn-black" onClick={save} style={{fontSize:11,padding:"12px 28px"}}>{saved?"✓ Saved!":"Save Configuration"}</button>
        </div>
      )}

      {activeTab==="billing"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div className="card" style={{padding:"28px"}}>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Current Plan</h3>
            <div style={{background:"linear-gradient(135deg,#7C3AED,#6D28D9)",borderRadius:12,padding:"24px",color:"#fff",marginBottom:20}}>
              <p style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",opacity:.7,marginBottom:8}}>Professional Plan</p>
              <div className="serif" style={{fontSize:36,fontWeight:800,marginBottom:4}}>$29<span style={{fontSize:16,fontWeight:400,opacity:.7}}>/mo</span></div>
              <p style={{fontSize:13,opacity:.8}}>Per teacher · billed monthly</p>
              <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.2)"}}>
                <p style={{fontSize:12,opacity:.7}}>Next billing: June 8, 2026</p>
              </div>
            </div>
            {[["Caseload","Unlimited students"],["ALP AI Goals","Unlimited ALP AI generation"],["Storage","10 GB documents"],["Support","Priority email support"],["Compliance","All global frameworks"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}>
                <span style={{fontSize:13,color:C.warm}}>{k}</span><span style={{fontSize:13,fontWeight:600}}>✓ {v}</span>
              </div>
            ))}
            <button className="btn-outline" style={{width:"100%",marginTop:20,fontSize:11}}>Upgrade to Enterprise</button>
          </div>
          <div className="card" style={{padding:"28px"}}>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Payment & Invoices</h3>
            <div style={{background:C.purpleL,borderRadius:10,padding:16,marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:40,height:28,background:C.blue,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:700}}>VISA</div>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>Visa ending in 4242</div><div style={{fontSize:12,color:C.warm}}>Expires 04/28</div></div>
              <button className="btn-ghost" style={{fontSize:11,padding:"6px 14px"}}>Update</button>
            </div>
            <p className="lbl" style={{marginBottom:12}}>Recent Invoices</p>
            {[["May 2026","$29.00","Paid"],["Apr 2026","$29.00","Paid"],["Mar 2026","$29.00","Paid"],["Feb 2026","$29.00","Paid"]].map(([month,amount,status])=>(
              <div key={month} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.tanL}`}}>
                <span style={{fontSize:13}}>{month}</span>
                <span style={{fontSize:13,fontWeight:600}}>{amount}</span>
                <Badge color="green">{status}</Badge>
                <button className="btn-ghost" style={{fontSize:10,padding:"4px 12px"}}>PDF</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// UPDATED SIDEBAR with Notifications + Settings
// ═══════════════════════════════════════════════════════════
const NAV_FULL=[
  {group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"Students",icon:"👥"}]},
  {group:"ALP BUILDER",items:[{id:"builder",label:"ALP Builder",icon:"✏️",badge:"New"},{id:"progress",label:"Progress",icon:"📈"}]},
  {group:"WORKFLOW",items:[{id:"future",label:"Future Readiness",icon:"🎯"},{id:"review",label:"Review Summary",icon:"✅"},{id:"notice",label:"ALP Notice",icon:"⚠️"},{id:"create",label:"Create ALP Doc",icon:"📄"}]},
  {group:"COLLABORATION",items:[{id:"family",label:"Family Portal",icon:"❤️"},{id:"reports",label:"Reports",icon:"📊"}]},
  {group:"ACCOUNT",items:[{id:"notifications",label:"Notifications",icon:"🔔",badge:"3"},{id:"settings",label:"Settings",icon:"⚙️"}]},
];

function SidebarFull({page,setPage,open,setOpen}){
  const {role,roleData,setRole}=useRole();
  const nav=NAV_BY_ROLE[role]||NAV_BY_ROLE.teacher;
  const user=ROLE_USERS[role]||ROLE_USERS.teacher;
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
                  <button key={r.id} onClick={e=>{e.stopPropagation();setRole(r.id);setPage(r.id==="family"?"family":r.id==="student"?"dashboard":"dashboard");setShowRolePicker(false);}}
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
          <button onClick={()=>window.location.href="/"} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",color:"rgba(255,255,255,.5)",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s",marginBottom:8}}
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

  function handleLogin(selectedRole){
    setRole(selectedRole);
    // Set initial page by role
    const startPage={family:"family",student:"dashboard",related:"progress",intervention:"progress"}[selectedRole]||"dashboard";
    setPage(startPage);
    setScreen("app");
  }

  const pages={
    dashboard:<Dashboard setPage={setPage}/>,
    students:<Students setPage={setPage}/>,
    builder:<ALPBuilder setPage={setPage}/>,
    progress:<Progress/>,
    future:<FutureReadiness setPage={setPage}/>,
    review:<ReviewSummary setPage={setPage}/>,
    notice:<ALPNotice setPage={setPage}/>,
    create:<CreateALPDoc setPage={setPage}/>,
    family:<FamilyPortal/>,
    reports:<Reports/>,
    notifications:<Notifications/>,
    settings:<Settings/>,
  };
  return(
    <>
      <style>{CSS}</style>
      {screen==="landing"&&<Landing onEnter={()=>setScreen("login")} navPage={navPage} setNavPage={setNavPage}/>}
      {screen==="login"&&<Login onLogin={handleLogin} onBack={()=>setScreen("landing")}/>}
      {screen==="app"&&
        <div style={{display:"flex",minHeight:"100vh"}}>
          <SidebarFull page={page} setPage={p=>{setPage(p);setSidebarOpen(false);}} open={sidebarOpen} setOpen={setSidebarOpen}/>
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
            <div style={{padding:"0 36px 32px",maxWidth:1100,margin:"0 auto"}}>
              <hr className="rule" style={{marginBottom:20}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.tan}}>
                <span>© 2026 ALP Platform Inc. All rights reserved.</span>
                <span>Built by <b style={{color:C.warm}}>Stan Paraclete</b> · www.stanparaclete.com · growwithalp.com · ALP Platform v2.4.1</span>
              </div>
            </div>
          </div>
        </div>
      }
    </>
  );
}

export default function App(){
  return(
    <ThemeProvider>
      <RoleProvider>
        <AppInner/>
      </RoleProvider>
    </ThemeProvider>
  );
}

// This file intentionally ends here.
// All assets are in /public/assets/
// ALP Logo: /public/assets/logos/alp-logo.png
// Reference images: /public/assets/images/
