import { useState } from "react";

// ═══════════════════════════════════════════════════════════
// ALP PLATFORM — FINAL PRODUCTION BUILD
// Design: TrendiZip aesthetic (Stan Paraclete's own design system)
// Playfair Display headlines · Cream bg · Black pill buttons
// Underline inputs · Dark sidebar · Editorial layout
// Built by Stan Paraclete · www.stanparaclete.com
// ═══════════════════════════════════════════════════════════

const CSS = `
/* ── HAMBURGER & MOBILE SIDEBAR ─────────────────── */
.hamburger {
  display: none; flex-direction: column; justify-content: center;
  gap: 5px; width: 36px; height: 36px; cursor: pointer;
  padding: 6px; border-radius: 8px; transition: background 0.15s; flex-shrink: 0;
}
.hamburger:hover { background: rgba(124,58,237,0.08); }
.hamburger span { display: block; height: 2px; background: #1A1A1A; border-radius: 2px; transition: all 0.25s ease; }
.hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
.sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(26,26,26,0.5); z-index: 998; backdrop-filter: blur(2px); }
@media (max-width: 768px) {
  .hamburger { display: flex !important; }
  .sidebar-overlay.open { display: block; }
  .sidebar { position: fixed !important; top: 0; left: -240px; z-index: 999; transition: left 0.28s cubic-bezier(0.4,0,0.2,1); box-shadow: 4px 0 24px rgba(0,0,0,0.3); }
  .sidebar.open { left: 0 !important; }
  .mobile-topbar { display: flex !important; position: sticky; top: 0; z-index: 100; background: rgba(245,240,235,0.96); backdrop-filter: blur(12px); border-bottom: 1px solid #E8DDD0; padding: 0 16px; height: 56px; align-items: center; justify-content: space-between; }
  .landing-nav-links { display: none !important; }
}
@media (min-width: 769px) {
  .mobile-topbar { display: none !important; }
  .hamburger { display: none !important; }
}

@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600;1,700;1,800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px}
body{font-family:'DM Sans',sans-serif;background:#fff;color:#111;-webkit-font-smoothing:antialiased}
button,input,select,textarea{font-family:'DM Sans',sans-serif}
button{cursor:pointer;border:none;background:none}
.dot-bg{background-color:#ffffff}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#f9f9f9}::-webkit-scrollbar-thumb{background:#7C3AED;border-radius:2px}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.ticker-wrap{overflow:hidden;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:13px 0;background:#fff}
.ticker-inner{display:flex;animation:ticker 26s linear infinite;white-space:nowrap}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
.fade-up{animation:fadeUp .38s ease both}
.spin{animation:spin .8s linear infinite}
.pulse{animation:pulse 2s ease infinite}
.serif{font-family:'Playfair Display',Georgia,serif}
.serif-italic{font-family:'Playfair Display',Georgia,serif;font-style:italic}
.u-input{width:100%;background:transparent;border:none;border-bottom:1px solid #C8B89A;padding:11px 0;font-size:14px;color:#1A1A1A;outline:none;transition:border-color .2s;font-family:'DM Sans',sans-serif}
.u-input:focus{border-bottom-color:#1A1A1A}
.u-input::placeholder{color:#B0A090;font-size:13px}
.u-select{width:100%;background:transparent;border:none;border-bottom:1px solid #C8B89A;padding:11px 0;font-size:14px;color:#1A1A1A;outline:none;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23C8B89A'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 4px center;padding-right:20px}
.u-textarea{width:100%;background:transparent;border:none;border-bottom:1px solid #C8B89A;padding:10px 0;font-size:13.5px;color:#1A1A1A;outline:none;resize:none;line-height:1.65;font-family:'DM Sans',sans-serif;transition:border-color .2s}
.u-textarea:focus{border-bottom-color:#1A1A1A}
.btn-black{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#1A1A1A;color:#F5F0EB;border:none;border-radius:99px;padding:13px 30px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;cursor:pointer;transition:all .18s}
.btn-black:hover{background:#2D2D2D;transform:translateY(-1px)}
.btn-black:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:transparent;color:#1A1A1A;border:1.5px solid #1A1A1A;border-radius:99px;padding:12px 28px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;cursor:pointer;transition:all .18s}
.btn-outline:hover{background:#1A1A1A;color:#F5F0EB}
.btn-purple{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#7C3AED;color:#fff;border:none;border-radius:99px;padding:12px 28px;font-size:12px;font-weight:700;letter-spacing:.06em;cursor:pointer;transition:all .18s}
.btn-purple:hover{background:#6D28D9;transform:translateY(-1px)}
.btn-purple:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:transparent;color:#9A8A78;border:1px solid #E8DDD0;border-radius:99px;padding:9px 20px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:all .18s}
.btn-ghost:hover{border-color:#C8B89A;color:#1A1A1A}
.btn-red{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#FEE2E2;color:#B91C1C;border:1px solid #FECACA;border-radius:99px;padding:9px 20px;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s}
.btn-red:hover{background:#FEF2F2}
.card{background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 2px 8px rgba(0,0,0,.04);border:1px solid #f0f0f0}
.card-dark{background:#1A1A1A;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.2)}
.lbl{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9A8A78}
.rule{width:100%;height:1px;background:#E8DDD0;border:none}
.sidebar{width:220px;flex-shrink:0;background:#111111;height:100vh;position:sticky;top:0;display:flex;flex-direction:column;overflow:hidden}
.app-main{flex:1;background:#F4F4F6;min-height:100vh;overflow-y:auto}
.badge{display:inline-flex;align-items:center;padding:3px 10px;font-size:11px;font-weight:700;border-radius:99px;letter-spacing:.03em}
.data-table{width:100%;border-collapse:collapse}
.data-table th{padding:11px 20px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9A8A78;border-bottom:1px solid #E8DDD0;background:#FAFAFA}
.data-table td{padding:15px 20px;border-bottom:1px solid #F0EBE3;font-size:13.5px;color:#1A1A1A;transition:background .1s}
.data-table tr:hover td{background:#FAF8F5}
.data-table tr:last-child td{border-bottom:none}
.prog-track{height:4px;background:#E8DDD0;border-radius:99px;overflow:hidden}
.prog-fill{height:100%;border-radius:99px;transition:width 1s ease}
.nav-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 14px;border-radius:8px;font-size:13px;color:#8A7A6A;transition:all .12s;cursor:pointer;border-left:3px solid transparent;text-align:left;border:none;background:none}
.nav-item:hover{background:rgba(255,255,255,.06);color:#D0C4B0}
.nav-item.active{background:rgba(124,58,237,.2);color:#fff;border-left:3px solid #7C3AED;font-weight:600}
.step-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;transition:all .12s;font-size:12.5px;color:#8A7A6A;border-left:3px solid transparent;border:none;background:none;width:100%;text-align:left}
.step-item:hover{background:rgba(255,255,255,.06);color:#D0C4B0}
.step-item.active{background:rgba(124,58,237,.18);color:#fff;border-left:3px solid #7C3AED;font-weight:600}
.step-item.done{color:#6A9A6A}
.modal-overlay{position:fixed;inset:0;background:rgba(26,26,26,.65);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(6px)}
.tab-btn{padding:10px 0;border:none;background:transparent;font-size:13px;font-weight:500;color:#9A8A78;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-family:'DM Sans',sans-serif}
.tab-btn.active{color:#1A1A1A;border-bottom-color:#1A1A1A;font-weight:700}
.metric-card{background:#fff;border-radius:12px;padding:22px 24px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.input-dark{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 16px;font-size:14px;color:#fff;outline:none;transition:border-color .2s;font-family:'DM Sans',sans-serif}
.input-dark:focus{border-color:rgba(124,58,237,.6)}
.input-dark::placeholder{color:rgba(255,255,255,.3)}
`;

const C = {
  cream:"#ffffff",white:"#FFFFFF",black:"#111111",
  tan:"#d1d5db",tanL:"#e5e7eb",warm:"#6b7280",
  purple:"#7C3AED",purpleL:"#EDE9FE",purpleD:"#6D28D9",
  green:"#16A34A",greenBg:"#F0FDF4",greenBd:"#BBF7D0",
  amber:"#D97706",amberBg:"#FFFBEB",amberBd:"#FDE68A",
  red:"#DC2626",redBg:"#FEF2F2",redBd:"#FECACA",
  blue:"#2563EB",blueBg:"#EFF6FF",blueBd:"#BFDBFE",
};

// ─── PRIMITIVES ────────────────────────────────────────────────
function Spin({color="#fff"}){return <div className="spin" style={{width:15,height:15,border:`2px solid rgba(255,255,255,.25)`,borderTopColor:color,borderRadius:"50%",flexShrink:0}}/>}
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

// ─── AI MODAL ──────────────────────────────────────────────────
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
            <p className="lbl" style={{marginBottom:10,color:C.purple}}>ALP Intelligence Suite</p>
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
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fade-up" style={{background:"#1E1B4B",borderRadius:20,padding:"44px 40px",width:"100%",maxWidth:520,textAlign:"center",boxShadow:"0 24px 80px rgba(0,0,0,.5)"}}>
        <div style={{width:56,height:56,borderRadius:14,background:"rgba(124,58,237,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 20px"}}>⬇</div>
        <h2 style={{fontSize:26,fontWeight:800,color:"#fff",marginBottom:8}}>Download ALP Desktop</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,.55)",marginBottom:32,lineHeight:1.65}}>Full offline access, faster performance, and enterprise-grade security. Choose your platform below.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:28}}>
          {[{img:"/assets/images/windows-logo.png",label:"Windows",sub:"v2.4.1 · 64-bit"},{img:"/assets/images/apple-logo.jpg",label:"macOS",sub:"v2.4.1 · Universal"},{img:"/assets/images/linux-logo.jpg",label:"Linux",sub:"v2.4.1 · .deb / .rpm"}].map(p=>(
            <div key={p.label} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"22px 16px",cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(124,58,237,.2)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}>
              <img src={p.img} alt={p.label} style={{width:48,height:48,objectFit:"contain",margin:"0 auto 10px",display:"block"}}/>
              <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:4}}>{p.label}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{p.sub}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{fontSize:13,color:"rgba(255,255,255,.4)",cursor:"pointer",background:"none",border:"none"}}>← Back to website</button>
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
  return(
    <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(255,255,255,.97)",backdropFilter:"blur(14px)",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"center",padding:"0 48px",height:62}}>
      <div style={{flex:1,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setNavPage(null)}>
        <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:32,height:32,borderRadius:8,objectFit:"cover"}}/>
        <span className="serif" style={{fontSize:15,fontWeight:700}}>ALP</span>
        <span style={{fontSize:10,color:C.warm,letterSpacing:".1em",textTransform:"uppercase",marginLeft:2}}>Accelerated Learning Program</span>
      </div>
      <div style={{display:"flex",gap:32,fontSize:13.5}}>
        {["Features","For Schools","Pricing","Resources"].map(n=>(
          <span key={n} onClick={()=>setNavPage(n)} style={{cursor:"pointer",fontWeight:active===n?700:400,color:active===n?C.black:C.warm,borderBottom:active===n?`2px solid ${C.purple}`:"2px solid transparent",paddingBottom:2,transition:"all .15s"}}
            onMouseEnter={e=>e.currentTarget.style.color=C.black}
            onMouseLeave={e=>e.currentTarget.style.color=active===n?C.black:C.warm}>{n}</span>
        ))}
      </div>
      <div style={{flex:1,display:"flex",justifyContent:"flex-end",gap:10}}>
        <button className="btn-outline" onClick={()=>setNavPage(null)} style={{fontSize:11,padding:"8px 20px",borderColor:"#111",color:"#111"}}>← Home</button>
        <button className="btn-purple" onClick={onEnter} style={{fontSize:11,padding:"8px 20px"}}>Sign Up Free</button>
      </div>
    </nav>
  );
}

function PageFooter(){
  return(
    <div style={{padding:"24px 48px",borderTop:`1px solid ${C.tanL}`,display:"flex",justifyContent:"space-between",fontSize:11,color:C.warm}}>
      <span>© 2026 ALP Platform Inc. All rights reserved.</span>
      <span>Built by <b style={{color:C.black}}>Stan Paraclete</b> · www.stanparaclete.com · growwithalp.com</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FEATURES PAGE — drawn from Playground IEP + ALP prototype
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
    {icon:"📤",name:"ALP Document Exporter",desc:"Export any Accelerated Learning Program as a professionally formatted, audit-ready PDF or Word document in one click. Timestamped, compliant, and formatted — ready to send to families, district offices, or government agencies instantly."},
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
      <section style={{padding:"80px 48px 56px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
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

      {/* ALP Intelligence Suite Tools — 8 tools in 4-col grid like Playground IEP */}
      <section style={{background:C.white,padding:"72px 48px",borderTop:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
            <div>
              <p className="lbl" style={{marginBottom:12,color:C.purple}}>ALP Intelligence Suite</p>
              <h2 className="serif" style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:800,letterSpacing:"-1px",lineHeight:1.1}}>
                ALP Intelligence Suite — <span className="serif-italic" style={{color:C.warm}}>Write ALPs<br/>in minutes, not days.</span>
              </h2>
            </div>
            <button className="btn-purple" onClick={onEnter} style={{fontSize:11,padding:"12px 24px",flexShrink:0}}>Try Now, It's Free!</button>
          </div>
          <p style={{fontSize:15,color:C.warm,marginBottom:36,maxWidth:620,lineHeight:1.7}}>Eight purpose-built tools in the ALP Intelligence Suite — designed exclusively for Accelerated Learning Programs. Every tool is free for individual teachers, forever. Powered by Claude AI to save you hours each week.</p>
          <hr className="rule" style={{marginBottom:36}}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
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
      <section style={{padding:"72px 48px",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{marginBottom:12}}>Caseload Organization</p>
          <h2 className="serif" style={{fontSize:"clamp(28px,4vw,48px)",fontWeight:700,letterSpacing:"-1px",lineHeight:1.1,marginBottom:12}}>
            Replace spreadsheets<br/><span className="serif-italic" style={{color:C.warm}}>with calm and clarity.</span>
          </h2>
          <p style={{fontSize:15,color:C.warm,marginBottom:36,maxWidth:580,lineHeight:1.7}}>Managing a caseload with spreadsheets is messy, stressful, and error-prone. ALP's dashboard gives teachers and case managers access to vital information in an easy, effective way.</p>
          <hr className="rule" style={{marginBottom:36}}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
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
      <section style={{background:C.black,padding:"72px 48px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{color:"#9A8A78",marginBottom:14,textAlign:"center"}}>Global Compliance Engine</p>
          <h2 className="serif" style={{fontSize:"clamp(28px,4vw,52px)",fontWeight:700,color:C.cream,textAlign:"center",marginBottom:16,letterSpacing:"-1px"}}>Built for every country,<br/><span className="serif-italic" style={{color:"#A78BFA"}}>every framework.</span></h2>
          <p style={{fontSize:15,color:"#9A8A78",textAlign:"center",maxWidth:560,margin:"0 auto 48px",lineHeight:1.7}}>ALP automatically checks programs against 10+ compliance frameworks — flagging anything missing before your audit arrives. Playground IEP only supports USA.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:40}}>
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
      <section style={{padding:"80px 48px 56px",maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
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
      <section style={{background:C.white,padding:"72px 48px",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <h2 className="serif" style={{fontSize:34,fontWeight:700,letterSpacing:"-1px",marginBottom:48,textAlign:"center"}}>Two ways to <span className="serif-italic" style={{color:C.warm}}>get started</span></h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            <div style={{background:"#FAF8FF",border:`2px solid ${C.purple}`,borderRadius:16,padding:36,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:14}}>👤</div>
              <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:8}}>Individual Teachers</h3>
              <p style={{fontSize:14,color:C.warm,lineHeight:1.7,marginBottom:20}}>Subscribe yourself, self-onboard in minutes, and get instant access to all AI tools and caseload management. No IT department needed.</p>
              <div style={{fontSize:30,fontWeight:800,color:C.purple,marginBottom:4}}>From $9<span style={{fontSize:14,fontWeight:400,color:C.warm}}>/mo</span></div>
              <p style={{fontSize:12,color:C.warm,marginBottom:22}}>ALP Intelligence Suite tools free forever · 14-day trial</p>
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
      <section style={{padding:"72px 48px",maxWidth:1100,margin:"0 auto"}}>
        <h2 className="serif" style={{fontSize:34,fontWeight:700,letterSpacing:"-1px",marginBottom:40,textAlign:"center"}}>Trusted by <span className="serif-italic" style={{color:C.warm}}>educators worldwide</span></h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
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
// PRICING PAGE — strategic pricing vs Playground IEP ($10/mo)
// ═══════════════════════════════════════════════════════════════════
function PricingPage({setNavPage,onEnter}){
  const [billing,setBilling]=useState("monthly");
  const [openFaq,setOpenFaq]=useState(null);

  const plans=[
    {
      name:"Free",price:"$0",period:"forever",tag:null,color:"#6B7280",bg:C.white,textColor:C.black,
      desc:"ALP Intelligence Suite tools completely free for individual teachers. Forever. Because educators deserve support, not barriers.",
      features:["Up to 10 students","ALP Goal Architect — unlimited","ALP Present Levels Coach","ALP Behaviour Blueprint","ALP Reading Adapter","ALP Intervention Planner","ALP Lesson Differentiator","ALP Progress Probe Generator","PDF export (3/month)"],
      missing:["Caseload dashboard","Family portal","Global compliance engine","ALP Student Snapshot","E-signature","Automated scheduling"],
      cta:"Create Free Account",style:"btn-outline",
    },
    {
      name:"Professional",
      price:billing==="monthly"?"$9":"$7",
      period:"/mo per teacher",tag:"MOST POPULAR",color:C.purple,bg:C.black,textColor:C.cream,
      desc:"The full ALP system. Cheaper than Playground IEP's $10/mo — and with global compliance, family portal, and desktop apps they don't offer.",
      features:["Unlimited students","ALP Intelligence Suite — all 8 tools unlimited","Full 13-section ALP Builder","Real-time CBM progress monitoring + alerts","Family portal with e-signature","All 10+ global compliance frameworks","ALP Student Snapshot for gen-ed teachers","ALP Accommodations Hub","Caseload dashboard","PDF + Word export","Automated ALP scheduling","Priority email & chat support"],
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
    {f:"Family Portal",a:"✓ Pro & above",p:"✗ Not available"},
    {f:"E-Signature",a:"✓ Pro & above",p:"✗ Not available"},
    {f:"Global Compliance (Ghana, Nigeria, UK…)",a:"✓ 10+ frameworks",p:"✗ USA only"},
    {f:"Desktop App (offline access)",a:"✓ Windows/Mac/Linux",p:"✗ Web only"},
    {f:"ALP Student Snapshot",a:"✓ Pro & above",p:"✓ Pro & above"},
    {f:"ALP Accommodations Hub",a:"✓ School & above",p:"✓ School & above"},
    {f:"Age Range",a:"Birth–22+",p:"School age only"},
    {f:"Price for SPED teams",a:"$9/mo ✓",p:"$10/mo"},
  ];

  const faqs=[
    {q:"Is ALP really free for individual teachers?",a:"Yes. All 8 tools in the ALP Intelligence Suite are free for individual teachers, forever: ALP Goal Architect, ALP Present Levels Coach, ALP Behaviour Blueprint, ALP Reading Adapter, ALP Intervention Planner, ALP Progress Probe Generator, ALP Learner Profile Builder, and ALP Lesson Differentiator. We believe educators deserve support, not paywalls."},
    {q:"How does ALP compare to Playground IEP in price?",a:"ALP's Professional plan is $9/month — less than Playground IEP's $10/month. But more importantly, ALP includes global compliance frameworks (Ghana GES, Nigeria NERDC, UK SEND, etc.), a family portal with e-signature, desktop apps for offline access, and support for students from birth to age 22+ — features Playground IEP doesn't offer at any price tier."},
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
        <p style={{fontSize:17,color:C.warm,maxWidth:540,margin:"0 auto 12px",lineHeight:1.75}}>ALP Intelligence Suite tools are <b style={{color:C.black}}>free forever</b> for individual teachers. Paid plans start at just $9/mo — cheaper than Playground IEP.</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:36}}>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Less than Playground IEP</span>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,alignItems:"start"}}>
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

      {/* ALP vs Playground IEP comparison */}
      <section style={{background:C.white,padding:"72px 48px",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:800,margin:"0 auto"}}>
          <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:6,textAlign:"center"}}>ALP vs <span className="serif-italic" style={{color:C.warm}}>Playground IEP</span></h2>
          <p style={{fontSize:14,color:C.warm,textAlign:"center",marginBottom:36}}>See exactly what ALP offers that others don't — at a lower price.</p>
          <div style={{border:`1px solid ${C.tanL}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:"#FAF8F5",padding:"12px 20px",borderBottom:`1px solid ${C.tanL}`}}>
              {["Feature","ALP Platform","Playground IEP"].map((h,i)=><span key={h} style={{fontSize:11,fontWeight:700,color:i===1?C.purple:C.warm,textTransform:"uppercase",letterSpacing:".08em",textAlign:i>0?"center":"left"}}>{h}</span>)}
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
      <section style={{padding:"72px 48px",maxWidth:780,margin:"0 auto"}}>
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
    {icon:"🤖",tag:"AI TUTORIAL",title:"Using the ALP Intelligence Suite",desc:"Generate SMART goals, BIPs, ALP Present Levels Coach statements, and lesson plans with AI. Step-by-step with real examples.",time:"8 min read",color:"#2563EB"},
    {icon:"📈",tag:"GUIDE",title:"Progress Monitoring 101",desc:"Understanding CBM, trendlines, and when to intervene. Set up your data system and read the charts.",time:"12 min read",color:"#16A34A"},
    {icon:"👨‍👩‍👧",tag:"GUIDE",title:"Family Collaboration Best Practices",desc:"Using the Family Portal — progress updates, meeting scheduling, e-signatures, and home language communication.",time:"7 min read",color:"#D97706"},
    {icon:"⚖️",tag:"COMPLIANCE",title:"IDEA Compliance Checklist (USA)",desc:"Every required element for a legally compliant ALP under IDEA and Section 504.",time:"15 min read",color:"#DC2626"},
    {icon:"🌍",tag:"COMPLIANCE",title:"GES Ghana SPED Framework Guide",desc:"Building ALPs aligned to the Ghana Education Service's SPED framework and inclusive education policy.",time:"12 min read",color:"#0891B2"},
    {icon:"🧠",tag:"AI GUIDE",title:"Writing Better BIPs with AI",desc:"How to use the ALP Behaviour Blueprint to create comprehensive behavior intervention plans in minutes.",time:"9 min read",color:C.purple},
    {icon:"⚡",tag:"TUTORIAL",title:"ALP Intervention Planner — Tier 1, 2 & 3",desc:"Build structured interventions for every learner tier using the ALP Intervention Planner. Includes real examples for reading, math, behavior, and social-emotional learning across all age groups.",time:"11 min read",color:"#16A34A"},
    {icon:"📰",tag:"GUIDE",title:"ALP vs IEP — What's the Difference?",desc:"A clear explanation of how the Accelerated Learning Program differs from a traditional IEP and why it matters globally.",time:"6 min read",color:"#6B7280"},
  ];
  const workshops=[
    {icon:"🖥",title:"AI Tools for Special Education",date:"Every Tuesday · 4:00 PM EST",desc:"Live workshop on using ALP's ALP Intelligence Suite for goal writing, BIPs, and progress monitoring. Free for all educators.",cta:"Register Free"},
    {icon:"🌍",title:"ALP for African Schools",date:"Every Thursday · 3:00 PM WAT",desc:"Focused on GES Ghana, NERDC Nigeria, and KICD Kenya frameworks. Presented in English with open Q&A.",cta:"Register Free"},
    {icon:"📊",title:"Progress Monitoring Masterclass",date:"1st Friday of month · 2:00 PM EST",desc:"Deep dive into CBM, trendline analysis, and data-driven decision making for SPED educators worldwide.",cta:"Register Free"},
  ];
  const videos=[
    {title:"ALP Platform — 3 Minute Overview",desc:"Every major feature in 3 minutes.",dur:"3:14",icon:"🎬"},
    {title:"Build Your First ALP — Full Walkthrough",desc:"A complete ALP built from scratch in real time.",dur:"18:42",icon:"📋"},
    {title:"AI Goal Writing Live Demo",desc:"See the AI generate 3 SMART goals from baseline data.",dur:"6:28",icon:"🤖"},
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
    {icon:"📰",title:"ALP vs IEP Comparison Guide",desc:"Full explanation of how ALP differs from a traditional IEP."},
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

      {/* Live Workshops — inspired by Playground IEP's Workshops section */}
      <section style={{background:C.white,padding:"72px 48px",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
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
      <section style={{background:C.black,padding:"72px 48px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{color:"#9A8A78",marginBottom:12}}>Learning Library</p>
          <h2 className="serif" style={{fontSize:32,fontWeight:700,color:C.cream,letterSpacing:"-1px",marginBottom:40}}>Tutorial videos on getting<br/><span className="serif-italic" style={{color:"#A78BFA"}}>the most out of ALP.</span></h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
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
      <section style={{padding:"72px 48px",maxWidth:1100,margin:"0 auto"}}>
        <p className="lbl" style={{marginBottom:12}}>Free Downloads</p>
        <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:40}}>Templates & <span className="serif-italic" style={{color:C.warm}}>tools.</span></h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
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
      <section style={{background:"#FAF8F5",padding:"72px 48px",borderTop:`1px solid ${C.tanL}`,borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:16}}>Desktop App</p>
          <h2 className="serif" style={{fontSize:32,fontWeight:700,letterSpacing:"-1px",marginBottom:14}}>Access ALP <span className="serif-italic" style={{color:C.warm}}>your way.</span></h2>
          <p style={{fontSize:14,color:C.warm,marginBottom:44}}>Full offline access, faster performance, and enterprise security on all major platforms.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
            {[{img:null,icon:"🌐",label:"Web App",sub:"No download needed",cta:true},{img:"/assets/images/windows-logo.png",label:"Windows",sub:"Windows 10 / 11"},{img:"/assets/images/apple-logo.jpg",label:"macOS",sub:"macOS 12+"},{img:"/assets/images/linux-logo.jpg",label:"Linux",sub:"Ubuntu / Debian"}].map(p=>(
              <div key={p.label} className="card" style={{padding:"28px 20px",textAlign:"center"}}>
                {p.img?<img src={p.img} alt={p.label} style={{width:52,height:52,objectFit:"contain",margin:"0 auto 12px",display:"block"}}/>:<div style={{fontSize:42,marginBottom:12}}>{p.icon}</div>}
                <div className="serif" style={{fontSize:17,fontWeight:700,marginBottom:4}}>{p.label}</div>
                <div style={{fontSize:12,color:C.warm,marginBottom:18}}>{p.sub}</div>
                {p.cta?<button className="btn-black" onClick={onEnter} style={{width:"100%",fontSize:11}}>Open in Browser</button>:<button className="btn-outline" style={{width:"100%",fontSize:11}}>⬇ Download {p.label}</button>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support */}
      <section style={{padding:"72px 48px",maxWidth:1100,margin:"0 auto"}}>
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
  const features=[
    {n:"01",title:"ALP Builder",italic:"10-Step",desc:"Guided workflow builds compliant learning plans in 15–20 minutes. AI suggests measurable SMART goals."},
    {n:"02",title:"Progress Monitoring",italic:"Real-Time",desc:"CBM tracking with visual dashboards and automatic alerts when students fall behind trajectory."},
    {n:"03",title:"Family Collaboration",italic:"Built-In",desc:"Parents see plans, message teachers, schedule meetings, and sign documents — all in one portal."},
    {n:"04",title:"Compliance Engine",italic:"Global",desc:"IDEA, Section 504, GES Ghana, UK SEND, Nigeria NERDC, and more. One-click audit-ready reports."},
    {n:"05",title:"AI Goal Suggestions",italic:"Claude-Powered",desc:"Drafts measurable annual goals based on the student's profile, disability, and baseline data."},
    {n:"06",title:"ALP Document Exporter",italic:"Instant",desc:"Export signed, compliant ALP PDFs ready to share with families and district administrators."},
  ];
  // Sub-page routing
  if(navPage==="Features")    return <FeaturesPage setNavPage={setNavPage} onEnter={onEnter}/>;
  if(navPage==="For Schools") return <ForSchoolsPage setNavPage={setNavPage} onEnter={onEnter}/>;
  if(navPage==="Pricing")     return <PricingPage setNavPage={setNavPage} onEnter={onEnter}/>;
  if(navPage==="Resources")   return <ResourcesPage setNavPage={setNavPage} onEnter={onEnter}/>;

  return(
    <div style={{minHeight:"100vh",background:"#ffffff"}}>
      {showDownload&&<DownloadModal onClose={()=>setShowDownload(false)}/>}
      <nav style={{position:"sticky",top:0,zIndex:100,background:"#111",backdropFilter:"blur(14px)",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",padding:"0 48px",height:62}}>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:10}}>
          <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:32,height:32,borderRadius:8,objectFit:"cover"}}/>
          <span className="serif" style={{fontSize:15,fontWeight:700,color:"#fff"}}>ALP</span>
          <span style={{fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:".1em",textTransform:"uppercase",marginLeft:2}}>Accelerated Learning Program</span>
        </div>
        <div style={{display:"flex",gap:36,fontSize:13.5}}>
          {["Features","For Schools","Pricing","Resources"].map(n=>(
            <span key={n} onClick={()=>setNavPage(n)}
              style={{cursor:"pointer",transition:"color .15s",fontWeight:navPage===n?700:400,color:"rgba(255,255,255,.85)",borderBottom:navPage===n?"2px solid #fff":"2px solid transparent",paddingBottom:2}}
              onMouseEnter={e=>e.currentTarget.style.color="#fff"}
              onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.85)"}>{n}</span>
          ))}
        </div>
        <div style={{flex:1,display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onEnter} style={{padding:"8px 22px",fontSize:11,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:"rgba(255,255,255,.15)",color:"#fff",border:"1.5px solid rgba(255,255,255,.4)",borderRadius:99,cursor:"pointer",transition:"all .18s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.25)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}>Log in</button>
          <button onClick={onEnter} style={{padding:"8px 22px",fontSize:11,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:C.purple,color:"#fff",border:"none",borderRadius:99,cursor:"pointer",transition:"all .18s"}} onMouseEnter={e=>e.currentTarget.style.background="#6D28D9"} onMouseLeave={e=>e.currentTarget.style.background=C.purple}>Sign Up</button>
        </div>
      </nav>

      <section style={{background:"#18003d",padding:"0"}}><div style={{padding:"96px 48px 80px",maxWidth:1100,margin:"0 auto"}} className="fade-up">
        <p className="lbl" style={{marginBottom:24,color:"#a78bfa",letterSpacing:".14em"}}>Now available · Spring 2026 · 10+ global frameworks</p>
        <h1 className="serif" style={{fontSize:"clamp(54px,7vw,96px)",fontWeight:800,lineHeight:1.02,letterSpacing:"-2.5px",marginBottom:32,maxWidth:820,color:"#fff"}}>
          Supporting Every<br/><span className="serif-italic" style={{color:"#a78bfa"}}>Learner's Growth.</span>
        </h1>
        <p style={{fontSize:18,color:"rgba(255,255,255,.7)",maxWidth:520,lineHeight:1.78,marginBottom:52}}>A complete student intervention and progress monitoring system — designed to help schools worldwide support every learner through structured plans, real-time tracking, and family collaboration.</p>
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={onEnter} style={{fontSize:11,padding:"15px 38px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:C.purple,color:"#fff",border:"none",borderRadius:99,cursor:"pointer",transition:"all .18s",display:"inline-flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#6D28D9"} onMouseLeave={e=>e.currentTarget.style.background=C.purple}>🚀 Start in the Browser →</button>
          <button onClick={()=>setShowDownload(true)} style={{fontSize:11,padding:"14px 34px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:"transparent",color:"#fff",border:"1.5px solid rgba(255,255,255,.5)",borderRadius:99,cursor:"pointer",transition:"all .18s",display:"inline-flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.borderColor="#fff"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.5)"}>⬇ Download Desktop App</button>
          <button style={{fontSize:11,padding:"14px 28px",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.8)",border:"1px solid rgba(255,255,255,.2)",borderRadius:99,cursor:"pointer",transition:"all .18s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"}>📅 Schedule a Demo</button>
        </div>
        <div style={{display:"flex",gap:56,marginTop:64,paddingTop:48,borderTop:"1px solid rgba(255,255,255,.1)"}}>
          {[["10+","Countries supported"],["IDEA & GES","Global frameworks"],["Claude AI","Goal generation"],["FERPA","Compliant & secure"]].map(([v,l])=><div key={l}><div className="serif" style={{fontSize:24,fontWeight:700,color:"#fff"}}>{v}</div><div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{l}</div></div>)}
        </div>
      </div></section>

      <div className="ticker-wrap">
        <div className="ticker-inner">
          {[...Array(8)].map((_,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:28,paddingRight:56,fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.warm}}>
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>IDEA Compliance
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>AI Goal Generation
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>Family Collaboration
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>Progress Monitoring
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:C.purple,display:"inline-block"}}/>GES Ghana · UK SEND · Nigeria NERDC · Australia NCCD
          </span>)}
        </div>
      </div>

      {/* TRUST BAR — educators using ALP globally */}
      <section style={{background:C.white,padding:"44px 48px",borderBottom:`1px solid ${C.tanL}`}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
          <p className="lbl" style={{marginBottom:24}}>Trusted by educators in schools across the globe</p>
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",flexWrap:"wrap",gap:32}}>
            {["Westwood Unified","Accra SPED District","Lagos State Schools","Virginia DOE","Nairobi County Schools","Kumasi GES District","London SEND Borough","Brisbane Inclusive Ed","Rocketship Ed","KIPP Foundation"].map(s=>(
              <span key={s} style={{fontSize:13,fontWeight:700,color:C.black,letterSpacing:".04em",opacity:.5}}>{s}</span>
            ))}
          </div>
        </div>
      </section>


      <section style={{background:"#fff",padding:"0"}}><div style={{padding:"96px 48px",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
          <div>
            <p className="lbl" style={{marginBottom:14}}>Platform Features</p>
            <h2 className="serif" style={{fontSize:"clamp(36px,5vw,60px)",fontWeight:700,lineHeight:1.08,letterSpacing:"-1.5px"}}>Everything your<br/><span className="serif-italic" style={{color:C.warm}}>school needs.</span></h2>
          </div>
          <button style={{width:42,height:42,border:`1.5px solid ${C.black}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,background:"transparent",transition:"all .18s",marginBottom:6}} onMouseEnter={e=>e.currentTarget.style.background=C.black} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>↗</button>
        </div>
        <hr className="rule" style={{margin:"32px 0 48px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)"}}>
          {features.map((f,i)=><div key={f.n} style={{padding:"36px 32px",borderRight:(i+1)%3!==0?`1px solid ${C.tanL}`:"none",borderBottom:i<3?`1px solid ${C.tanL}`:"none",transition:"background .2s"}} onMouseEnter={e=>e.currentTarget.style.background=C.white} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{fontSize:11,fontWeight:700,color:C.purple,letterSpacing:".1em",marginBottom:16}}>{f.n}</div>
            <div className="serif" style={{fontSize:19,fontWeight:700,lineHeight:1.2}}><span className="serif-italic" style={{color:C.warm,marginRight:4}}>{f.italic}</span>{f.title}</div>
            <p style={{fontSize:13,color:C.warm,lineHeight:1.75,marginTop:12}}>{f.desc}</p>
          </div>)}
        </div></div></section>

      <section style={{background:C.black,padding:"96px 48px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <p className="lbl" style={{color:"#9A8A78",marginBottom:20}}>Access ALP your way</p>
          <h2 className="serif" style={{fontSize:"clamp(36px,5vw,64px)",fontWeight:700,color:C.cream,letterSpacing:"-1.5px",marginBottom:64,lineHeight:1.08}}>Your Platform.<br/><span className="serif-italic" style={{color:"#A78BFA"}}>Your Device.</span></h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#2D2D2D"}}>
            {[{img:null,icon:"🌐",label:"Web App",sub:"No download needed",cta:true},{img:"/assets/images/windows-logo.png",label:"Windows",sub:"Windows 10 / 11",ver:"v2.4.1"},{img:"/assets/images/apple-logo.jpg",label:"macOS",sub:"macOS 12+",ver:"v2.4.1"},{img:"/assets/images/linux-logo.jpg",label:"Linux",sub:"Ubuntu / Debian",ver:"v2.4.1"}].map(p=>(
              <div key={p.label} style={{background:"#1A1A1A",padding:"40px 32px",display:"flex",flexDirection:"column",alignItems:"flex-start"}}>
                {p.img
                  ?<img src={p.img} alt={p.label} style={{width:52,height:52,objectFit:"contain",marginBottom:12}}/>
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
            <p style={{fontSize:13,color:C.warm,lineHeight:1.7,marginBottom:14}}>Accelerated Learning Program<br/>Supporting Every Learner's Growth</p>
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

  return(
    <div style={{display:"flex",minHeight:"100vh"}}>
      {showDownload&&<DownloadModal onClose={()=>setShowDownload(false)}/>}
      {/* LEFT — dark panel with dot grid, exactly like prototype */}
      <div style={{flex:1,background:"#120E2A",position:"relative",display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:56,overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle,rgba(124,58,237,.15) .8px,transparent .8px)",backgroundSize:"22px 22px"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(124,58,237,.25) 0%,transparent 55%)"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:64}}>
            <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={onBack}>
              <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:44,height:44,borderRadius:11,objectFit:"cover"}}/>
              <div><div className="serif" style={{fontSize:16,fontWeight:700,color:"#fff",lineHeight:1}}>ALP</div><div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".12em",marginTop:1}}>Accelerated Learning Program</div></div>
            </div>
            <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,.4)",background:"none",border:"1px solid rgba(255,255,255,.15)",borderRadius:99,padding:"6px 14px",cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor="rgba(255,255,255,.4)";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,.4)";e.currentTarget.style.borderColor="rgba(255,255,255,.15)";}}>← Website</button>
          </div>
          <div style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,.5)",marginBottom:16}}>Welcome back to</div>
          <h2 style={{fontSize:"clamp(36px,4vw,52px)",fontWeight:800,lineHeight:1.1,marginBottom:36}}>
            <span style={{color:"#fff"}}>Welcome back to<br/></span>
            <span style={{color:C.purple}}>ALP Platform.</span>
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:52,lineHeight:1.7,maxWidth:380}}>Sign in to access your school's student intervention and progress monitoring dashboard.</p>
          <div style={{display:"flex",gap:44,marginBottom:0}}>
            {[["142","Students enrolled"],["38","Active ALPs"],["74%","Goals on track"]].map(([v,l])=>(
              <div key={l}><div style={{fontSize:30,fontWeight:800,color:C.purple,letterSpacing:"-1px"}}>{v}</div><div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:3}}>{l}</div></div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — white form, matches prototype exactly */}
      <div style={{width:480,background:C.white,display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 52px",position:"relative",overflowY:"auto"}}>
        <h3 style={{fontSize:28,fontWeight:800,color:C.black,marginBottom:6,letterSpacing:"-.5px"}}>Sign in</h3>
        <p style={{fontSize:14,color:C.warm,marginBottom:28}}>Access your school's ALP dashboard</p>

        {/* Tab toggle — exactly from prototype */}
        <div style={{display:"flex",border:`1px solid ${C.tanL}`,borderRadius:10,marginBottom:28,overflow:"hidden"}}>
          {[["web","🌐 Web App"],["desktop","🖥 Desktop App"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"11px 0",fontSize:13,fontWeight:600,background:tab===id?C.purple:"transparent",color:tab===id?"#fff":C.warm,border:"none",cursor:"pointer",transition:"all .15s"}}>
              {label}
            </button>
          ))}
        </div>

        {/* Desktop App — shows download card and license key (prototype page 5) */}
        {tab==="desktop"&&(
          <div style={{background:"#F8F5FF",border:`1px solid ${C.tanL}`,borderRadius:12,padding:24,textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:32,marginBottom:10}}>🖥</div>
            <div style={{fontSize:14,fontWeight:700,color:C.black,marginBottom:6}}>ALP Desktop App</div>
            <p style={{fontSize:12,color:C.warm,marginBottom:16,lineHeight:1.6}}>Download and install first, then sign in with your school credentials below.</p>
            <button className="btn-purple" onClick={()=>setShowDownload(true)} style={{fontSize:11,padding:"10px 22px"}}>⬇ Download for your OS</button>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:22,marginBottom:24}}>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <span className="lbl" style={{fontSize:9}}>School / Institution</span>
            <select className="u-select" style={{borderBottom:`1px solid ${C.tan}`}}>
              <option>Westwood Elementary</option><option>Riverside High School</option><option>Other Institution</option>
            </select>
          </div>
          <UInput label="Email Address" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@school.edu"/>
          {tab==="desktop"&&<UInput label="License Key" value={license} onChange={e=>setLicense(e.target.value)} placeholder="XXXX - XXXX - XXXX - XXXX"/>}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span className="lbl" style={{fontSize:9}}>Password</span><span style={{fontSize:12,color:C.purple,cursor:"pointer"}}>Forgot password?</span></div>
            <input className="u-input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"/>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.warm,cursor:"pointer"}}><input type="checkbox" defaultChecked style={{accentColor:C.purple}}/> Remember me</label>
        </div>

        <button className="btn-purple" disabled={loading} onClick={()=>{setLoading(true);setTimeout(()=>{setLoading(false);onLogin();},900);}} style={{width:"100%",padding:"15px",marginBottom:20,fontSize:13,borderRadius:10}}>
          {loading?<><Spin/>Signing in…</>:`Sign in to ${tab==="web"?"Web App →":"Desktop →"}`}
        </button>

        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><div style={{flex:1,height:1,background:C.tanL}}/><span style={{fontSize:12,color:C.warm}}>or continue with</span><div style={{flex:1,height:1,background:C.tanL}}/></div>

        {[["🏢","Sign in with Google Workspace"],["💎","Sign in with Microsoft 365"]].map(([icon,label])=>(
          <button key={label} style={{width:"100%",padding:"12px",border:`1.5px solid ${C.tanL}`,borderRadius:10,background:C.white,color:C.black,fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,cursor:"pointer",transition:"border-color .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.black} onMouseLeave={e=>e.currentTarget.style.borderColor=C.tanL}>{icon} {label}</button>
        ))}

        <p style={{textAlign:"center",fontSize:13,color:C.warm,marginTop:20}}>Don't have an account? <span style={{color:C.black,fontWeight:700,cursor:"pointer"}}>Contact your district admin</span></p>
        <p onClick={onBack} style={{textAlign:"center",fontSize:12,color:C.warm,marginTop:8,cursor:"pointer",transition:"color .15s"}} onMouseEnter={e=>e.currentTarget.style.color=C.black} onMouseLeave={e=>e.currentTarget.style.color=C.warm}>← Back to website</p>
      </div>
    </div>
  );
}

// ─── SIDEBAR ───────────────────────────────────────────────────
const NAV=[{group:"OVERVIEW",items:[{id:"dashboard",label:"Dashboard",icon:"⊞"},{id:"students",label:"Students",icon:"👥"}]},{group:"ALP BUILDER",items:[{id:"builder",label:"ALP Builder",icon:"✏️",badge:"New"},{id:"progress",label:"Progress",icon:"📈"}]},{group:"WORKFLOW",items:[{id:"future",label:"Future Readiness",icon:"🎯"},{id:"review",label:"Review Summary",icon:"✅"},{id:"notice",label:"ALP Notice",icon:"⚠️"},{id:"create",label:"Create ALP Doc",icon:"📄"}]},{group:"COLLABORATION",items:[{id:"family",label:"Family Portal",icon:"❤️"},{id:"reports",label:"Reports",icon:"📊"}]}];

function Sidebar({page,setPage}){
  return(
    <aside className="sidebar">
      <div style={{padding:"20px 18px 16px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:36,height:36,borderRadius:9,objectFit:"cover",flexShrink:0}}/>
          <div><div className="serif" style={{fontSize:14,fontWeight:700,color:C.cream,lineHeight:1}}>ALP</div><div style={{fontSize:8,color:"#5A4A3A",textTransform:"uppercase",letterSpacing:".1em",marginTop:1}}>Learning Program</div></div>
        </div>
      </div>
      <nav style={{flex:1,overflowY:"auto",padding:"14px 10px"}}>
        {NAV.map(g=>(
          <div key={g.group} style={{marginBottom:22}}>
            <p style={{fontSize:9,fontWeight:700,color:"#4A3A2A",letterSpacing:".14em",textTransform:"uppercase",padding:"0 12px 8px"}}>{g.group}</p>
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
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12.5,fontWeight:600,color:C.cream,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Ms. Simmons</div><div style={{fontSize:10,color:"#5A4A3A"}}>Special Ed · Westwood</div></div>
        <button style={{color:"#5A4A3A",fontSize:16}}>⚙</button>
      </div>
    </aside>
  );
}

function Page({title,subtitle,action,children}){
  return(
    <div className="fade-up" style={{padding:"32px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32}}>
        <div><p className="lbl" style={{marginBottom:8}}>ALP Platform</p><h1 className="serif" style={{fontSize:30,fontWeight:700,letterSpacing:"-.5px",lineHeight:1.1}}>{title}</h1>{subtitle&&<p style={{fontSize:13,color:C.warm,marginTop:5}}>{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
function Dashboard({setPage}){
  const students=[{name:"Marcus Johnson",grade:"Grade 4 · ASD",plan:"ALP",planC:"purple",status:"On track"},{name:"Sofia Lee",grade:"Grade 2 · Dyslexia",plan:"RTI-II",planC:"blue",status:"Review"},{name:"Tyler Parker",grade:"Grade 6 · ADHD",plan:"504",planC:"amber",status:"On track"},{name:"Aisha Adeyemi",grade:"Grade 3 · Speech/Lang",plan:"ALP",planC:"purple",status:"Attention"}];
  const domains=[{n:"Reading",v:82},{n:"Math",v:68},{n:"Communication",v:75},{n:"Social-Emotional",v:59},{n:"Future Readiness",v:88}];
  return(
    <Page title={<>Dashboard</>} subtitle="Spring 2026 · Westwood Elementary" action={<button className="btn-black" onClick={()=>setPage("builder")} style={{fontSize:11,padding:"11px 24px"}}>+ New ALP</button>}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
        {[["TOTAL STUDENTS","142","↑ 8 from last year",C.purple],["ACTIVE ALPs","38","4 due for review",C.blue],["ON-TRACK GOALS","74%","↓ 3% this quarter",C.green],["NEEDS ATTENTION","11","Immediate review",C.red]].map(([l,v,s,c])=>(
          <div key={l} className="card" style={{padding:"22px 24px"}}>
            <p className="lbl" style={{marginBottom:12}}>{l}</p>
            <div className="serif" style={{fontSize:36,fontWeight:700,color:c,lineHeight:1,letterSpacing:"-1px"}}>{v}</div>
            <p style={{fontSize:12,color:C.warm,marginTop:5}}>{s}</p>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div className="card" style={{padding:"26px 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}><h3 className="serif" style={{fontSize:17,fontWeight:700}}>Recent Students</h3><span onClick={()=>setPage("students")} style={{fontSize:12,color:C.purple,cursor:"pointer",fontWeight:600}}>See all →</span></div>
          {students.map((s,i)=>(
            <div key={s.name} onClick={()=>setPage("students")} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<students.length-1?`1px solid ${C.tanL}`:"none",cursor:"pointer",borderRadius:6,transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background="#FAF8F5"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <Avatar name={s.name} size={36}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{s.name}</div><div style={{fontSize:12,color:C.warm,marginTop:1}}>{s.grade}</div></div>
              <Badge color={s.planC}>{s.plan}</Badge><Dot s={s.status}/>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:"26px 28px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:22}}>Goal Progress by Domain</h3>
          {domains.map(d=>(
            <div key={d.n} style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><span style={{fontSize:13,fontWeight:500}}>{d.n}</span><span style={{fontSize:13,fontWeight:700,color:d.v>=75?C.green:d.v>=60?C.amber:C.red}}>{d.v}%</span></div>
              <PBar value={d.v} color={d.v>=75?C.purple:d.v>=60?C.amber:C.red}/>
            </div>
          ))}
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
              <div style={{display:"flex",gap:24,fontSize:13,color:C.warm}}>
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
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}><span style={{fontSize:13,color:C.warm}}>{k}</span><span style={{fontSize:13,fontWeight:600}}>{v}</span></div>
              ))}
            </div>
            <div className="card" style={{padding:"24px 28px"}}>
              <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:18}}>Goal Progress</h3>
              {[{d:"Reading",v:82,c:C.purple},{d:"Communication",v:60,c:C.blue},{d:"Social-Emotional",v:70,c:C.amber}].map(g=>(
                <div key={g.d} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,fontWeight:500}}>{g.d}</span><span style={{fontSize:13,fontWeight:700,color:g.c}}>{g.v}%</span></div>
                  <PBar value={g.v} color={g.c}/>
                </div>
              ))}
              <div style={{marginTop:20,padding:"14px 16px",background:"#FAF8F5",borderRadius:10}}>
                <div style={{fontSize:11,fontWeight:700,color:C.green,marginBottom:4}}>COMPLIANCE STATUS</div>
                <div style={{fontSize:13,color:C.black}}>✓ Compliant · All required sections complete</div>
              </div>
            </div>
          </div>
        )}
        {activeTab==="goals"&&(
          <div className="card" style={{padding:"24px 28px"}}>
            <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:20}}>Annual Goals</h3>
            {[{d:"READING",c:C.red,text:"By May 2027, Marcus will read grade 3-level text aloud with 90% accuracy (at least 80 wcpm) across 4 consecutive weekly probes.",b:"52 wcpm",t:"80 wcpm",m:"Quarterly",s:"Active"},{d:"COMMUNICATION",c:C.purple,text:"By May 2027, Marcus will initiate and maintain a 3-turn conversation with a peer on a preferred topic in 4 of 5 observed opportunities.",b:"1-turn",t:"3-turn",m:"Monthly",s:"Active"},{d:"SOCIAL-EMOTIONAL",c:C.amber,text:"By May 2027, Marcus will use a self-regulation strategy independently when identifying frustration in 4 of 5 daily opportunities.",b:"Prompted",t:"Independent",m:"Weekly",s:"Active"}].map((g,i)=>(
              <div key={i} style={{borderLeft:`4px solid ${g.c}`,background:"#FAF8F5",borderRadius:"0 10px 10px 0",padding:"18px 22px",marginBottom:14}}>
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
          <div style={{flex:1,position:"relative"}}><span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.warm,fontSize:14}}>🔍</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search students..." style={{width:"100%",padding:"9px 12px 9px 34px",border:`1px solid ${C.tanL}`,borderRadius:99,fontSize:13,color:C.black,outline:"none",background:"#FAF8F5",fontFamily:"'DM Sans',sans-serif",transition:"border-color .15s"}} onFocus={e=>e.target.style.borderColor=C.black} onBlur={e=>e.target.style.borderColor=C.tanL}/></div>
          <div style={{display:"flex",gap:6}}>{["All","ALP","RTI","504"].map(fi=><button key={fi} onClick={()=>setF(fi)} className={f===fi?"btn-black":"btn-ghost"} style={{padding:"8px 18px",fontSize:11}}>{fi}</button>)}</div>
        </div>
        <table className="data-table">
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
  const [step,setStep]=useState(3);const [showAI,setShowAI]=useState(false);
  const [goals,setGoals]=useState([
    {domain:"READING",color:C.red,text:"By May 2027, Marcus will read grade 3-level text aloud with 90% accuracy (at least 80 wcpm) across 4 consecutive weekly probes, measured by CBM assessments.",baseline:"52 wcpm",target:"80 wcpm",monitoring:"Quarterly"},
    {domain:"COMMUNICATION",color:C.purple,text:"By May 2027, Marcus will initiate and maintain a 3-turn conversation with a peer on a preferred topic in 4 of 5 observed opportunities.",baseline:"1-turn",target:"3-turn",monitoring:"Monthly"},
    {domain:"SOCIAL-EMOTIONAL",color:C.amber,text:"By May 2027, Marcus will use a self-regulation strategy independently when identifying frustration in 4 of 5 daily opportunities.",baseline:"Prompted",target:"Independent",monitoring:"Weekly"},
  ]);
  const steps=["Student profile","Present levels","Annual goals","Services","Accommodations","LRE","Future readiness","Review summary","ALP notice","Create ALP doc"];
  const student={name:"Marcus Johnson",grade:"4",disability:"Autism Spectrum Disorder"};
  function addGoal(g,domain){const colors={READING:C.red,MATH:C.green,WRITING:C.blue,COMMUNICATION:C.purple,SOCIAL_EMOTIONAL:C.amber,BEHAVIOR:"#F97316"};setGoals(p=>[...p,{domain,color:colors[domain]||C.purple,text:g.goalText,baseline:g.baseline,target:g.target,monitoring:g.monitoring}]);}
  function next(){const n=step+1;setStep(n);const j={7:"future",8:"review",9:"notice",10:"create"};if(j[n])setPage(j[n]);}
  const completion=Math.round((step-1)/10*100);
  return(
    <Page title={<>ALP Builder <span className="serif-italic" style={{color:C.warm,fontSize:26}}>— Step {step} of 10</span></>} subtitle="Marcus Johnson · Grade 4 · Autism Spectrum Disorder" action={<button className="btn-black" onClick={()=>setPage("students")} style={{fontSize:11,padding:"11px 24px"}}>All Students</button>}>
      {showAI&&<AIModal student={student} onAdd={addGoal} onClose={()=>setShowAI(false)}/>}
      <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
        {/* Step panel — dark like TrendiZip register */}
        <div style={{width:210,flexShrink:0,background:C.black,borderRadius:14,padding:16}}>
          {steps.map((s,i)=>{const n=i+1,done=n<step,active=n===step;return(<button key={s} onClick={()=>setStep(n)} className={`step-item${active?" active":done?" done":""}`}><div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:done?C.green:active?C.purple:"rgba(255,255,255,.08)",color:done||active?"#fff":C.warm}}>{done?"✓":n}</div><span>{s}</span></button>);})}
          <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.08)"}}>
            <p style={{fontSize:9,fontWeight:700,color:"#4A3A2A",letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>Completion</p>
            <div style={{height:3,background:"rgba(255,255,255,.1)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${completion}%`,background:C.purple,borderRadius:99,transition:"width 1s ease"}}/></div>
            <p style={{fontSize:10,color:"#4A3A2A",marginTop:6}}>{step-1} of 10 sections</p>
          </div>
        </div>

        <div className="card" style={{flex:1,padding:"30px 32px"}}>
          {step===1&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><div><p className="lbl" style={{marginBottom:8}}>Step 1 of 10</p><h2 className="serif" style={{fontSize:22,fontWeight:700}}>Student <span className="serif-italic" style={{color:C.warm}}>Profile</span></h2></div></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:24}}>
              <UInput label="Student Full Name" value="Marcus Darnell Johnson" onChange={()=>{}}/><UInput label="Date of Birth" value="2016-03-12" type="date" onChange={()=>{}}/>
              <UInput label="Student ID" value="WE-2024-0142" onChange={()=>{}}/><USelect label="Grade Level" value="4" onChange={()=>{}} options={[...Array(13)].map((_,i)=>({value:`${i}`,label:i===0?"Kindergarten":`Grade ${i}`}))}/>
              <USelect label="Primary Disability" value="AUTISM" onChange={()=>{}} options={[{value:"AUTISM",label:"Autism Spectrum Disorder"},{value:"ADHD",label:"ADHD"},{value:"DYSLEXIA",label:"Dyslexia"},{value:"SPEECH",label:"Speech/Language"},{value:"INTELLECTUAL",label:"Intellectual Disability"},{value:"HEARING",label:"Hearing Impairment"},{value:"BEHAVIORAL",label:"Behavioral/Emotional"}]}/>
              <USelect label="Program Type" value="ALP" onChange={()=>{}} options={[{value:"ALP",label:"ALP (Accelerated Learning Program)"},{value:"RTI_I",label:"RTI Tier I"},{value:"RTI_II",label:"RTI Tier II"},{value:"RTI_III",label:"RTI Tier III"},{value:"504",label:"Section 504"},{value:"IEP",label:"IEP"}]}/>
              <UInput label="Effective Date" value="2026-05-08" type="date" onChange={()=>{}}/><UInput label="Annual Review Date" value="2027-05-08" type="date" onChange={()=>{}}/>
            </div>
          </div>}
          {step===2&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><div><p className="lbl" style={{marginBottom:8}}>Step 2 of 10</p><h2 className="serif" style={{fontSize:22,fontWeight:700}}>Present <span className="serif-italic" style={{color:C.warm}}>Levels</span></h2></div></div>
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              <UTextarea label="Academic Performance (Reading)" value="Marcus reads at a 2nd grade level with 52 wcpm on grade 3 probes. He demonstrates strong phonemic awareness but struggles with fluency and reading comprehension." onChange={()=>{}} rows={3}/>
              <UTextarea label="Academic Performance (Math)" value="Marcus demonstrates understanding of addition and subtraction facts. He struggles with multi-step word problems and place value concepts above 100." onChange={()=>{}} rows={3}/>
              <UTextarea label="Communication Skills" value="Marcus initiates 1-turn conversations. He uses 3-4 word sentences in structured settings. He needs support with sustained peer interaction and topic maintenance." onChange={()=>{}} rows={3}/>
              <UTextarea label="Social-Emotional Functioning" value="Marcus needs adult prompting to identify and regulate emotions, particularly frustration. He benefits from visual supports and structured routines." onChange={()=>{}} rows={3}/>
            </div>
          </div>}
          {step===3&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <div><p className="lbl" style={{marginBottom:8}}>Step 3 of 10</p><h2 className="serif" style={{fontSize:22,fontWeight:700}}>Measurable Annual <span className="serif-italic" style={{color:C.warm}}>Goals</span></h2></div>
              <button className="btn-outline" onClick={()=>setShowAI(true)} style={{fontSize:11,padding:"10px 22px"}}>✦ AI-Suggest Goals</button>
            </div>
            {goals.map((g,i)=>(
              <div key={i} style={{borderLeft:`4px solid ${g.color}`,background:"#FAF8F5",borderRadius:"0 10px 10px 0",padding:"18px 22px",marginBottom:14}}>
                <p className="lbl" style={{color:g.color,marginBottom:10}}>{g.domain}</p>
                <p style={{fontSize:14,color:C.black,lineHeight:1.7,marginBottom:12}}>{g.text}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:24,fontSize:12,color:C.warm}}><span>Baseline: <b style={{color:C.black}}>{g.baseline}</b></span><span>Target: <b style={{color:C.black}}>{g.target}</b></span><span>Monitoring: <b style={{color:C.black}}>{g.monitoring}</b></span></div>
              </div>
            ))}
            <button style={{width:"100%",padding:"13px",border:`1.5px dashed ${C.tan}`,borderRadius:10,background:"transparent",color:C.warm,fontSize:13,cursor:"pointer",marginBottom:8,transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.black;e.currentTarget.style.color=C.black;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.tan;e.currentTarget.style.color=C.warm;}}>+ Add Goal Manually</button>
          </div>}
          {step===4&&<div>
            <p className="lbl" style={{marginBottom:8}}>Step 4 of 10</p><h2 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:24}}>Special Education <span className="serif-italic" style={{color:C.warm}}>Services</span></h2>
            {[["Special Education Instruction","5 hrs/week","Resource Room","Ms. Simmons"],["Speech-Language Therapy","2x/week · 30 min","Pull-out","SLP Smith"],["Occupational Therapy","1x/week · 30 min","Pull-out","OT Johnson"]].map(([s,f,l,p])=>(
              <div key={s} style={{display:"flex",gap:20,padding:"16px 0",borderBottom:`1px solid ${C.tanL}`,alignItems:"center"}}>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,marginBottom:2}}>{s}</div><div style={{fontSize:12,color:C.warm}}>{l} · {p}</div></div>
                <div style={{fontSize:13,fontWeight:600,color:C.purple}}>{f}</div>
              </div>
            ))}
          </div>}
          {step>=5&&step<=6&&<div><p className="lbl" style={{marginBottom:8}}>Step {step} of 10</p><h2 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:24}}>{step===5?"Accommodations":"Least Restrictive Environment"} <span className="serif-italic" style={{color:C.warm}}>& {step===5?"Modifications":"(LRE)"}</span></h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {(step===5?[["Testing","Extended time — 1.5x on all assessments"],["Presentation","Preferential seating near front of class"],["Response","Oral responses permitted for written tasks"],["Setting","Small group testing environment"],["Technology","Text-to-speech software for reading passages"],["Scheduling","Breaks every 20 minutes during instruction"]]:
              [["General Education","Marcus attends 80% of instruction in general education"],["Supplemental Services","20% pull-out for specialized instruction"],["Placement","Resource Room — reading and written expression"],["Rationale","Placement in least restrictive environment supports IEP goals"]]).map(([k,v])=>(
                <div key={k} style={{background:"#FAF8F5",borderRadius:10,padding:18}}><p className="lbl" style={{color:C.purple,marginBottom:8}}>{k}</p><p style={{fontSize:13,color:C.warm,lineHeight:1.65}}>{v}</p></div>
              ))}
            </div>
          </div>}
          <hr className="rule" style={{margin:"24px 0 20px"}}/>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <button className="btn-ghost" onClick={()=>setStep(s=>Math.max(1,s-1))}>← Back</button>
            <button className="btn-black" onClick={next} style={{fontSize:11,padding:"12px 28px"}}>Next: {steps[step]||"Complete"} →</button>
          </div>
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// PROGRESS MONITORING
// ═══════════════════════════════════════════════════════════
function Progress(){
  const bars=[{m:"Sep",v:52},{m:"Oct",v:56},{m:"Nov",v:59},{m:"Jan",v:62},{m:"Mar",v:65},{m:"May",v:68}];
  const [selGoal,setSelGoal]=useState("reading");
  const goals=[{id:"reading",label:"Reading Fluency",domain:"READING",v:82,c:C.purple,baseline:"52 wcpm",target:"80 wcpm",current:"68 wcpm",trend:"↑ Improving"},{id:"comm",label:"Communication",domain:"COMMUNICATION",v:60,c:C.blue,baseline:"1-turn",target:"3-turn",current:"2-turn",trend:"↑ Improving"},{id:"se",label:"Social-Emotional",domain:"SOCIAL-EMOTIONAL",v:70,c:C.amber,baseline:"Prompted",target:"Independent",current:"Partial prompt",trend:"→ Stable"}];
  const sel=goals.find(g=>g.id===selGoal);
  return(
    <Page title={<>Progress <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Monitoring</span></>} subtitle="Marcus Johnson · Q3 2026" action={<button className="btn-outline" style={{fontSize:11,padding:"10px 22px"}}>Export Report ↗</button>}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
        {[["Reading","82%",C.purple],["Math","70%",C.blue],["Communication","61%",C.green],["Social-Emotional","55%",C.amber]].map(([l,v,c])=><div key={l} className="card" style={{padding:"22px 24px",textAlign:"center"}}><div className="serif" style={{fontSize:36,fontWeight:700,color:c,letterSpacing:"-1px"}}>{v}</div><p style={{fontSize:12,color:C.warm,marginTop:4}}>{l}</p></div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:20}}>
        <div className="card" style={{padding:"20px"}}>
          <p className="lbl" style={{marginBottom:14}}>Select Goal</p>
          {goals.map(g=><div key={g.id} onClick={()=>setSelGoal(g.id)} style={{padding:"12px 14px",borderRadius:10,marginBottom:6,cursor:"pointer",background:selGoal===g.id?"#FAF8FF":"transparent",border:`1.5px solid ${selGoal===g.id?C.purple:C.tanL}`,transition:"all .15s"}}>
            <div style={{fontSize:11,fontWeight:700,color:g.c,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>{g.domain}</div>
            <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{g.label}</div>
            <PBar value={g.v} color={g.c}/>
            <div style={{fontSize:11,color:C.warm,marginTop:6}}>{g.v}% · {g.trend}</div>
          </div>)}
        </div>
        <div className="card" style={{padding:"28px 32px"}}>
          {sel&&<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
              <div><h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:4}}>{sel.label} — Marcus Johnson</h3><p style={{fontSize:12,color:C.warm}}>Goal: {sel.target} · Current: {sel.current} · Trend: {sel.trend}</p></div>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.red,fontWeight:600}}><div style={{width:20,height:2,background:C.red,borderRadius:1}}/>Goal line</div>
            </div>
            <div style={{height:220,position:"relative"}}>
              <div style={{position:"absolute",top:`${(1-80/95)*100}%`,left:0,right:0,borderTop:`2px dashed ${C.red}`,opacity:.5,zIndex:2}}/>
              <div style={{display:"flex",alignItems:"flex-end",height:"100%",gap:14,paddingTop:22}}>
                {bars.map((d,i)=><div key={d.m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",gap:5}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.purple}}>{d.v}</span>
                  <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end"}}><div style={{width:"100%",background:`linear-gradient(180deg,#A78BFA,${C.purple})`,borderRadius:"6px 6px 0 0",height:`${(d.v/95)*100}%`,transition:`height 1s ease ${i*.1}s`}}/></div>
                  <span style={{fontSize:11,color:C.warm}}>{d.m}</span>
                </div>)}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:20}}>
              {[["Baseline",sel.baseline],["Current",sel.current],["Target",sel.target]].map(([l,v])=><div key={l} style={{background:"#FAF8F5",borderRadius:8,padding:"12px 14px",textAlign:"center"}}><div className="lbl" style={{marginBottom:4}}>{l}</div><div style={{fontSize:15,fontWeight:700,color:C.black}}>{v}</div></div>)}
            </div>
          </>}
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// FUTURE READINESS
// ═══════════════════════════════════════════════════════════
function FutureReadiness({setPage}){
  return(
    <Page title={<>Future <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Readiness</span></>} subtitle="Marcus Johnson · Section 7 — Transition Planning">
      <div className="card" style={{padding:"30px 32px"}}>
        <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:24}}>🎯 Future Readiness & Transition Planning</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:28}}>
          {[{label:"POST-SECONDARY EDUCATION",text:"Community college with supported learning program; vocational training in technology or art. College visits planned for Grade 10."},{label:"CAREER & EMPLOYMENT",text:"Supported employment in creative or tech fields. Work experience and job shadowing starting at age 16 through VR partnership."},{label:"INDEPENDENT LIVING",text:"Supported living skills: budgeting, transportation navigation, meal planning, daily scheduling, and self-advocacy training."},{label:"COMMUNITY PARTICIPATION",text:"Community groups and recreational activities aligned with student interests — art club, coding group, and peer mentoring program."}].map(a=>(
            <div key={a.label} style={{background:"#FAF8F5",borderRadius:10,padding:22}}><p className="lbl" style={{color:C.purple,marginBottom:10}}>{a.label}</p><p style={{fontSize:13.5,color:C.warm,lineHeight:1.7}}>{a.text}</p></div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,marginBottom:32}}>
          <UInput label="Vocational Rehabilitation Agency" value="Virginia VR Services" onChange={()=>{}}/><UInput label="Community Agency / Partner" value="Arc of Northern Virginia" onChange={()=>{}}/>
          <USelect label="Age of Majority Notification" value="17" onChange={()=>{}} options={[{value:"17",label:"Notified at age 17"},{value:"18",label:"Notified at age 18"}]}/>
          <USelect label="Self-Advocacy Level" value="developing" onChange={()=>{}} options={[{value:"emerging",label:"Emerging"},{value:"developing",label:"Developing"},{value:"proficient",label:"Proficient"},{value:"independent",label:"Independent"}]}/>
          <UInput label="Anticipated Post-Secondary Goal" value="Community college + supported employment" onChange={()=>{}}/>
          <UInput label="Transition Assessment Date" value="2026-09-01" type="date" onChange={()=>{}}/>
        </div>
        <hr className="rule" style={{marginBottom:22}}/><div style={{display:"flex",justifyContent:"space-between"}}><button className="btn-ghost" onClick={()=>setPage("builder")}>← Back</button><button className="btn-black" onClick={()=>setPage("review")} style={{fontSize:11,padding:"12px 28px"}}>Next: Review Summary →</button></div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// REVIEW SUMMARY
// ═══════════════════════════════════════════════════════════
function ReviewSummary({setPage}){
  return(
    <Page title={<>Review <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Summary</span></>} subtitle="Marcus Johnson · All sections reviewed">
      <div className="card" style={{padding:"30px 32px"}}>
        <h3 className="serif" style={{fontSize:18,fontWeight:700,marginBottom:28}}>ALP Review Summary — Marcus Johnson</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,marginBottom:28}}>
          <div><p className="lbl" style={{marginBottom:16}}>Student Information</p>{[["Full name","Marcus Darnell Johnson"],["DOB / Grade","March 12, 2016 · Grade 4"],["Disability","Autism Spectrum Disorder"],["Effective date","May 8, 2026"],["Annual review","May 8, 2027"],["Coordinator","Ms. Simmons"]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}><span style={{fontSize:13,color:C.warm}}>{k}</span><span style={{fontSize:13,fontWeight:600}}>{v}</span></div>)}</div>
          <div><p className="lbl" style={{marginBottom:16}}>Goals Overview</p>{[["Reading fluency — 80 wcpm","Active"],["Communication — 3-turn convo","Active"],["Social-emotional — self-regulation","Active"],["Math — 2-step problems","Pending"]].map(([g,s])=><div key={g} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}><span style={{fontSize:13}}>{g}</span><Badge color={s==="Active"?"green":"amber"}>{s}</Badge></div>)}</div>
        </div>
        <p className="lbl" style={{marginBottom:14}}>Services & Accommodations</p>
        {[["Special ed instruction","5 hrs/week · Resource"],["Speech-language therapy","2x/week · 30 min"],["OT services","1x/week · 30 min"],["Extended time","1.5x on all assessments"],["Preferential seating","Front of classroom"],["Text-to-speech","All reading tasks"]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.tanL}`}}><span style={{fontSize:13,fontWeight:600}}>{k}</span><span style={{fontSize:13,color:C.warm}}>{v}</span></div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:22}}>
          <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:16}}><p className="lbl" style={{color:C.amber,marginBottom:4}}>Parent Input</p><p style={{fontSize:13,color:"#92400E"}}>Pending signature</p></div>
          <div style={{background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:10,padding:16}}><p className="lbl" style={{color:C.green,marginBottom:4}}>Compliance</p><p style={{fontSize:13,color:"#166534"}}>✓ Compliant — all sections complete</p></div>
        </div>
        <hr className="rule" style={{margin:"24px 0"}}/><div style={{display:"flex",justifyContent:"space-between"}}><button className="btn-ghost" onClick={()=>setPage("future")}>← Back</button><button className="btn-black" onClick={()=>setPage("notice")} style={{fontSize:11,padding:"12px 28px"}}>Next: ALP Notice →</button></div>
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
        <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:16,marginBottom:24,display:"flex",gap:10,fontSize:13,color:"#92400E",lineHeight:1.6}}><span>⚠️</span><span>This notice is sent to the parent/guardian to inform them of the student's ALP placement, rights, and procedural safeguards as required by IDEA and applicable state regulations.</span></div>
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
  return(
    <Page title={<>Create <span className="serif-italic" style={{color:C.warm,fontSize:26}}>ALP Document</span></>} subtitle="Marcus Johnson · Section 10 of 10 — Ready to Export">
      <div className="card" style={{padding:"30px 32px"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:C.greenBg,border:`2px solid ${C.greenBd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>✅</div>
          <h2 className="serif" style={{fontSize:24,fontWeight:700,marginBottom:6,letterSpacing:"-.5px"}}>All 10 Sections Complete!</h2>
          <p style={{fontSize:14,color:C.warm}}>Review the preview below and export when ready.</p>
        </div>
        <div style={{border:`1px solid ${C.tanL}`,borderRadius:12,padding:36,background:"#FAF8F5",marginBottom:28}}>
          <h2 className="serif" style={{textAlign:"center",fontSize:20,fontWeight:800,letterSpacing:".04em",marginBottom:4}}>ACCELERATED LEARNING PROGRAM</h2>
          <p className="serif" style={{textAlign:"center",fontWeight:700,marginBottom:3}}>Marcus Darnell Johnson</p>
          <p style={{textAlign:"center",fontSize:12,color:C.warm,marginBottom:28}}>Grade 4 · Autism Spectrum Disorder · Westwood Elementary · May 8, 2026</p>
          {[{t:"Student Information",rows:[["Date of birth","March 12, 2016"],["Disability category","Autism Spectrum Disorder"],["Plan type","ALP (Accelerated Learning Program)"],["Effective — Review date","May 8, 2026 — May 8, 2027"],["Coordinator","Ms. Simmons"]]},{t:"Annual Goals Summary",rows:[["Reading","80 wcpm by May 2027 (CBM weekly)"],["Communication","3-turn peer conversation in 4/5 obs."],["Social-emotional","Independent self-regulation in 4/5 opp."]]},{t:"Services",rows:[["Special education","5 hrs/wk · Resource Room"],["Speech-language","2x/wk · 30 min · Pull-out"],["OT services","1x/wk · 30 min · Pull-out"]]},{t:"Accommodations",rows:[["Extended time","1.5x on all assessments"],["Preferential seating","Front of classroom"],["Technology","Text-to-speech software"]]}].map(s=>(
            <div key={s.t} style={{marginBottom:22}}>
              <div className="serif" style={{fontSize:13,fontWeight:700,paddingBottom:8,borderBottom:`1px solid ${C.tanL}`,marginBottom:10}}>{s.t}</div>
              {s.rows.map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}><span style={{fontSize:13,color:C.warm}}>{k}</span><span style={{fontSize:13,fontWeight:500}}>{v}</span></div>)}
            </div>
          ))}
          <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${C.tanL}`,fontSize:11,color:C.tan,textAlign:"center"}}>Built by Stan Paraclete · www.stanparaclete.com · ALP Platform v2.4.1 · growwithalp.com</div>
        </div>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button className="btn-black" onClick={()=>{setExporting(true);setTimeout(()=>setExporting(false),2500);}} disabled={exporting} style={{fontSize:11,padding:"13px 28px"}}>{exporting?<><Spin/>Generating PDF…</>:"📄  Export PDF"}</button>
          <button className="btn-outline" style={{fontSize:11,padding:"12px 24px"}}>📝  Export Word</button>
          <button className="btn-ghost" style={{fontSize:11}}>🖨  Print</button>
          <button className="btn-ghost" onClick={()=>setPage("family")} style={{fontSize:11}}>📤  Send to Family</button>
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// FAMILY PORTAL
// ═══════════════════════════════════════════════════════════
function FamilyPortal(){
  const [compose,setCompose]=useState(false);
  const msgs=[{name:"Johnson Family",sub:"ALP Update",preview:'"Can we discuss the reading goals before the review?"',date:"May 6",unread:true},{name:"Lee Family",sub:"Sofia Progress",preview:"Document signed ✓ · Thank you for sharing the report",date:"May 3",unread:false},{name:"Adeyemi Family",sub:"Meeting Request",preview:'"Is Thursday at 4PM available for a quick chat?"',date:"May 1",unread:true},{name:"Parker Family",sub:"Question re: 504",preview:'"Tyler mentioned getting extra time on state tests?"',date:"Apr 28",unread:false}];
  const meetings=[{day:"14",month:"MAY",title:"Johnson Family — Annual ALP Review",time:"3:30 PM · Virtual · Google Meet",action:"Join",urgent:true},{day:"20",month:"MAY",title:"Adeyemi Family — Progress Check",time:"4:00 PM · Room 14, Westwood Elem",action:"View",urgent:false},{day:"28",month:"MAY",title:"Lee Family — Goal Discussion",time:"2:00 PM · Virtual",action:"View",urgent:false}];
  return(
    <Page title={<>Family <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Collaboration Portal</span></>} subtitle="Messages & Meeting Scheduler" action={<button className="btn-black" onClick={()=>setCompose(true)} style={{fontSize:11,padding:"11px 24px"}}>+ Draft Message</button>}>
      {compose&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setCompose(false)}>
          <div className="card fade-up" style={{width:"100%",maxWidth:520,padding:32}}>
            <h3 className="serif" style={{fontSize:22,fontWeight:700,marginBottom:20}}>New <span className="serif-italic" style={{color:C.warm}}>Message</span></h3>
            <div style={{display:"flex",flexDirection:"column",gap:20,marginBottom:24}}>
              <USelect label="Recipient" value="johnson" onChange={()=>{}} options={[{value:"johnson",label:"Johnson Family (Marcus)"},{value:"lee",label:"Lee Family (Sofia)"},{value:"adeyemi",label:"Adeyemi Family (Aisha)"}]}/>
              <UInput label="Subject" value="" onChange={()=>{}} placeholder="Message subject"/>
              <UTextarea label="Message" rows={5} value="" onChange={()=>{}} placeholder="Write your message here…"/>
            </div>
            <div style={{display:"flex",gap:12}}><button className="btn-ghost" onClick={()=>setCompose(false)} style={{flex:1}}>Cancel</button><button className="btn-black" onClick={()=>setCompose(false)} style={{flex:1,fontSize:11}}>Send Message →</button></div>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div className="card" style={{padding:"26px 28px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:22}}>Parent Messages</h3>
          {msgs.map((m,i)=>(
            <div key={m.name} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:i<msgs.length-1?`1px solid ${C.tanL}`:"none",cursor:"pointer",transition:"background .1s",borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.background="#FAF8F5"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {m.unread&&<div style={{width:8,height:8,borderRadius:"50%",background:C.purple,flexShrink:0,marginTop:6}}/>}
              {!m.unread&&<div style={{width:8,flexShrink:0}}/>}
              <Avatar name={m.name} size={36}/>
              <div style={{flex:1,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13.5,fontWeight:m.unread?700:500}}>{m.name} — {m.sub}</span><span style={{fontSize:11,color:C.warm,flexShrink:0,marginLeft:8}}>{m.date}</span></div><p style={{fontSize:12.5,color:C.warm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.preview}</p></div>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:"26px 28px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:22}}>Upcoming Meetings</h3>
          {meetings.map((m,i)=>(
            <div key={m.title} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:i<meetings.length-1?`1px solid ${C.tanL}`:"none"}}>
              <div style={{width:54,background:m.urgent?C.purple:C.black,borderRadius:10,padding:"7px 0",textAlign:"center",flexShrink:0,color:C.cream}}>
                <div className="serif" style={{fontSize:22,fontWeight:700,lineHeight:1}}>{m.day}</div>
                <div style={{fontSize:9,fontWeight:700,opacity:.7,letterSpacing:".07em",marginTop:1}}>{m.month}</div>
              </div>
              <div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:600,marginBottom:3}}>{m.title}</div><div style={{fontSize:12,color:C.warm}}>{m.time}</div></div>
              <button className={m.urgent?"btn-purple":"btn-ghost"} style={{fontSize:11,padding:"7px 16px"}}>{m.action}</button>
            </div>
          ))}
          <div style={{marginTop:16,padding:"14px 16px",background:"#F8F5FF",borderRadius:10,border:`1px solid #DDD6FE`}}>
            <div style={{fontSize:11,fontWeight:700,color:C.purple,marginBottom:4}}>PENDING SIGNATURES</div>
            <div style={{fontSize:13,color:C.black}}>Marcus Johnson's ALP — Johnson Family signature required</div>
            <button className="btn-purple" style={{fontSize:11,padding:"7px 16px",marginTop:10}}>Send Signature Request</button>
          </div>
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════
function Reports(){
  const items=[{icon:"🏛",label:"IDEA Federal Compliance",sub:"All 38 ALPs compliant · Last audit: March 2026",status:"Compliant",color:"green"},{icon:"📅",label:"Annual Review Schedule",sub:"4 plans pending annual review within 30 days",status:"Review Due",color:"amber"},{icon:"♿",label:"Section 504 / ADA",sub:"All 7 accommodation plans current and signed",status:"Compliant",color:"green"},{icon:"⏰",label:"Reevaluation Schedule",sub:"2 students past 3-year reevaluation due date",status:"Overdue",color:"red"},{icon:"🌍",label:"Ghana GES Framework",sub:"3 international students · All plans current",status:"Compliant",color:"green"},{icon:"🇬🇧",label:"UK SEND Code of Practice",sub:"2 students · EHC Plans active and reviewed",status:"Compliant",color:"green"}];
  return(
    <Page title={<>Reports & <span className="serif-italic" style={{color:C.warm,fontSize:26}}>Compliance</span></>} subtitle="Multi-Framework Compliance Tracking" action={<button className="btn-outline" style={{fontSize:11,padding:"10px 22px"}}>Export All ↗</button>}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
        {[["COMPLIANT PLANS","36","of 38 active ALPs",C.green],["REVIEW DUE","4","within 30 days",C.amber],["OVERDUE","2","past due date",C.red]].map(([l,v,s,c])=>(
          <div key={l} className="card" style={{padding:"20px 22px"}}>
            <p className="lbl" style={{marginBottom:10}}>{l}</p>
            <div className="serif" style={{fontSize:32,fontWeight:700,color:c,lineHeight:1,letterSpacing:"-1px"}}>{v}</div>
            <p style={{fontSize:12,color:C.warm,marginTop:4}}>{s}</p>
          </div>
        ))}
      </div>
      <div className="card" style={{padding:"26px 28px",marginBottom:20}}>
        <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:22}}>Compliance & Reporting</h3>
        {items.map((item,i)=>(
          <div key={item.label} style={{display:"flex",alignItems:"center",gap:16,padding:"16px 0",borderBottom:i<items.length-1?`1px solid ${C.tanL}`:"none",cursor:"pointer",transition:"background .1s",borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.background="#FAF8F5"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{width:46,height:46,borderRadius:11,background:"#FAF8F5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,border:`1px solid ${C.tanL}`}}>{item.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,marginBottom:2}}>{item.label}</div><div style={{fontSize:12.5,color:C.warm}}>{item.sub}</div></div>
            <Badge color={item.color}>✓ {item.status}</Badge>
          </div>
        ))}
      </div>
      <div className="card" style={{padding:"24px 28px"}}>
        <h3 className="serif" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Generate Reports</h3>
        <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
          {["ALP Report","Family Progress Report","Student Growth Report","Intervention Effectiveness","School Compliance Report","District Summary","Audit Trail Report"].map(r=>(
            <button key={r} className="btn-ghost" style={{fontSize:11,padding:"8px 16px"}}>📄 {r}</button>
          ))}
        </div>
      </div>
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
      <div style={{display:"flex",gap:28,marginBottom:24,borderBottom:`1px solid ${C.tanL}`,paddingBottom:0}}>
        {[["profile","Profile"],["school","School"],["notifications","Notifications"],["compliance","Compliance"],["billing","Billing"]].map(([id,label])=>(
          <button key={id} className={`tab-btn${activeTab===id?" active":""}`} onClick={()=>setActiveTab(id)}>{label}</button>
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
          <div style={{background:"#FAF8F5",borderRadius:10,padding:20,marginBottom:24}}>
            <p className="lbl" style={{marginBottom:12}}>Integrations</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[["🏢","Google Workspace","Connected — sync students and staff","disconnect"],["💎","Microsoft 365","Not connected","connect"],["📊","PowerSchool SIS","Connected — student data sync active","disconnect"],["🔔","Remind","Not connected","connect"]].map(([icon,name,status,action])=>(
                <div key={name} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 14px",background:C.white,borderRadius:8,border:`1px solid ${C.tanL}`}}>
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

      {activeTab==="notifications"&&(
        <div className="card" style={{padding:"28px"}}>
          <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:24}}>Notification Preferences</h3>
          {[["Annual Review Alerts","Get notified 30 days before annual review deadlines",true],["Goal Mastery",  "Celebrate when students achieve their IEP goals",true],["Goal At-Risk Alerts","Alert when a goal shows declining trend for 2+ data points",true],["Parent Messages","Notify when families send a new message",true],["Signature Requests","Alert when documents require signature",true],["Weekly Digest","Monday morning summary of student progress",false],["Progress Data Reminders","Remind when progress hasn't been logged in 30+ days",true],["Subscription & Billing","Renewal reminders and billing alerts",true]].map(([title,desc,def])=>{
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
            {[["Caseload","Unlimited students"],["AI Goals","Unlimited AI generation"],["Storage","10 GB documents"],["Support","Priority email support"],["Compliance","All global frameworks"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.tanL}`}}>
                <span style={{fontSize:13,color:C.warm}}>{k}</span><span style={{fontSize:13,fontWeight:600}}>✓ {v}</span>
              </div>
            ))}
            <button className="btn-outline" style={{width:"100%",marginTop:20,fontSize:11}}>Upgrade to Enterprise</button>
          </div>
          <div className="card" style={{padding:"28px"}}>
            <h3 className="serif" style={{fontSize:17,fontWeight:700,marginBottom:20}}>Payment & Invoices</h3>
            <div style={{background:"#FAF8F5",borderRadius:10,padding:16,marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
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
  return(
    <>
      <div className={`sidebar-overlay${open?" open":""}`} onClick={()=>setOpen(false)}/>
      <aside className={`sidebar${open?" open":""}`}>
      <div style={{padding:"20px 18px 16px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:36,height:36,borderRadius:9,objectFit:"cover",flexShrink:0}}/>
          <div><div className="serif" style={{fontSize:14,fontWeight:700,color:C.cream,lineHeight:1}}>ALP</div><div style={{fontSize:8,color:"#5A4A3A",textTransform:"uppercase",letterSpacing:".1em",marginTop:1}}>Learning Program</div></div>
        </div>
      </div>
      <nav style={{flex:1,overflowY:"auto",padding:"14px 10px"}}>
        {NAV_FULL.map(g=>(
          <div key={g.group} style={{marginBottom:22}}>
            <p style={{fontSize:9,fontWeight:700,color:"#4A3A2A",letterSpacing:".14em",textTransform:"uppercase",padding:"0 12px 8px"}}>{g.group}</p>
            {g.items.map(item=>(
              <button key={item.id} onClick={()=>setPage(item.id)} className={`nav-item${page===item.id?" active":""}`}>
                <span style={{fontSize:14,width:18,textAlign:"center",flexShrink:0}}>{item.icon}</span>
                <span style={{flex:1}}>{item.label}</span>
                {item.badge&&<span style={{fontSize:9,fontWeight:700,background:item.id==="notifications"?C.red:C.purple,color:"#fff",padding:"2px 7px",borderRadius:99}}>{item.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:10}}>
        <Avatar name="Ms Simmons" size={32}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12.5,fontWeight:600,color:C.cream,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Ms. Simmons</div><div style={{fontSize:10,color:"#5A4A3A"}}>Special Ed · Westwood</div></div>
        <button onClick={()=>setPage("settings")} style={{color:"#5A4A3A",fontSize:16}}>⚙</button>
      </div>
    </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════
export default function App(){
  const [screen,setScreen]=useState("landing");
  const [page,setPage]=useState("dashboard");
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [navPage,setNavPage]=useState(null);
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
      {screen==="login"&&<Login onLogin={()=>{setScreen("app");setPage("dashboard");}} onBack={()=>setScreen("landing")}/>}
      {screen==="app"&&
        <div style={{display:"flex",minHeight:"100vh"}}>
          <SidebarFull page={page} setPage={p=>{setPage(p);setSidebarOpen(false);}} open={sidebarOpen} setOpen={setSidebarOpen}/>
          <div className="app-main">
            {/* Mobile top bar */}
            <div className="mobile-topbar" style={{display:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <img src="/assets/logos/alp-logo.png" alt="ALP" style={{width:28,height:28,borderRadius:7,objectFit:"cover"}}/>
                <span style={{fontSize:14,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>ALP</span>
              </div>
              <div className={`hamburger${sidebarOpen?" open":""}`} onClick={()=>setSidebarOpen(o=>!o)}>
                <span/><span/><span/>
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

// This file intentionally ends here.
// All assets are in /public/assets/
// ALP Logo: /public/assets/logos/alp-logo.png
// Reference images: /public/assets/images/
