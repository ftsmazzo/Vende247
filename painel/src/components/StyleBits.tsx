export function StyleBits() {
  return (
    <style>{`
      .label { display:block; font-size:0.75rem; color:rgba(255,255,255,0.5); margin-bottom:0.35rem; }
      .field { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:0.75rem; padding:0.7rem 1rem; color:#f4f6f8; outline:none; color-scheme: dark; }
      .field:focus { border-color: rgba(232,255,71,0.5); }
      select.field { appearance: none; background-color: #1a1f27; background-image: linear-gradient(45deg, transparent 50%, #e8ff47 50%), linear-gradient(135deg, #e8ff47 50%, transparent 50%); background-position: calc(100% - 1.15rem) 1.15rem, calc(100% - 0.85rem) 1.15rem; background-size: 0.35rem 0.35rem, 0.35rem 0.35rem; background-repeat: no-repeat; padding-right: 2.25rem; }
      select.field option, select.field optgroup { background-color: #1a1f27; color: #f4f6f8; }
      .type-chip { border:1px solid rgba(255,255,255,0.16); background:#1a1f27; color:#f4f6f8; border-radius:0.75rem; padding:0.65rem 0.75rem; font-size:0.875rem; font-weight:600; text-align:center; }
      .type-chip:hover { border-color: rgba(232,255,71,0.4); }
      .type-chip-on { border-color:#e8ff47; background:rgba(232,255,71,0.14); color:#e8ff47; }
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
