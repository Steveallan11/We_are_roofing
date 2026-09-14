"use client";
import { useState } from "react";
export function EmailPreviewGallery({ previews }: { previews: Array<{name:string; html:string}> }) {
  const [index,setIndex] = useState(0);
  const [mobile,setMobile] = useState(false);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-3">
      <label>Email template <select className="field ml-2" value={index} onChange={event=>setIndex(Number(event.target.value))}>{previews.map((p,i)=><option key={p.name} value={i}>{p.name}</option>)}</select></label>
      <button type="button" className="button-secondary" aria-pressed={!mobile} onClick={()=>setMobile(false)}>Desktop</button>
      <button type="button" className="button-secondary" aria-pressed={mobile} onClick={()=>setMobile(true)}>Mobile (390px)</button>
    </div>
    <p className="text-sm">Sample data only. This gallery never sends an email.</p>
    <iframe title={previews[index].name} srcDoc={previews[index].html} sandbox="" style={{width:mobile ? 390 : 700,maxWidth:"100%",height:1400,display:"block",margin:"0 auto",border:"1px solid #ccc",background:"#fff"}} />
  </div>;
}
