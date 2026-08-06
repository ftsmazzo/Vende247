export function StyleBits() {
  return (
    <style>{`
      .label { display:block; font-size:0.75rem; color:rgba(255,255,255,0.5); margin-bottom:0.35rem; }
      .field { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:0.75rem; padding:0.7rem 1rem; color:white; outline:none; }
      .field:focus { border-color: rgba(232,255,71,0.5); }
      .btn-primary { background:#e8ff47; color:#0a0c0f; font-weight:600; border-radius:0.75rem; padding:0.7rem 1.25rem; display:inline-block; text-align:center; }
      .btn-primary:disabled { opacity:0.6; }
      .btn-ghost { border:1px solid rgba(255,255,255,0.15); border-radius:0.75rem; padding:0.55rem 1rem; color:white; font-size:0.875rem; }
      .btn-ghost:hover { background:rgba(255,255,255,0.05); }
      .btn-ghost:disabled { opacity:0.5; }
      .card { background:rgba(26,31,39,0.85); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem; }
      .text-coral { color:#ff5c4d; }
    `}</style>
  );
}
