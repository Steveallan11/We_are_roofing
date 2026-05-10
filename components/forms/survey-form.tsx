"use client";
import { useState, useCallback } from "react";
import type { SurveyRecord } from "@/lib/types";
import { SURVEY_TYPES } from "@/lib/constants";

type Props = { jobId: string; initialSurvey?: SurveyRecord | null };
type Sec = "core" | "flat" | "pitched" | "fascia" | "chimney";
const COND = ["Good","Fair","Poor","Failed","N/A"] as const;

function Sel({ id, label, opts, val, hint }: { id: string; label: string; opts: readonly string[]; val?: string; hint?: string }) {
  return (<div><label className="label" htmlFor={id}>{label}</label><select className="field" id={id} name={id} defaultValue={val ?? ""}><option value="">Select...</option>{opts.map(o=><option key={o}>{o}</option>)}</select>{hint&&<p className="mt-1 text-xs text-[var(--dim)]">{hint}</p>}</div>);
}
function Txt({ id, label, ph, val, multi, hint }: { id: string; label: string; ph?: string; val?: string; multi?: boolean; hint?: string }) {
  return (<div><label className="label" htmlFor={id}>{label}</label>{multi?<textarea className="field min-h-20" id={id} name={id} placeholder={ph} defaultValue={val??""}/>:<input className="field" id={id} name={id} placeholder={ph} defaultValue={val??""}/>}{hint&&<p className="mt-1 text-xs text-[var(--dim)]">{hint}</p>}</div>);
}
function Tog({ id, label, def, hint }: { id: string; label: string; def?: boolean; hint?: string }) {
  const [on,setOn]=useState(def??false);
  return (<div className="flex items-start gap-3"><button type="button" onClick={()=>setOn(!on)} className={`mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition ${on?"bg-[var(--gold)] border-[var(--gold)]":"bg-[var(--card2)] border-[var(--border2)]"}`}><span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${on?"translate-x-[22px]":"translate-x-[2px]"}`}/></button><input type="hidden" name={id} value={on?"true":"false"}/><div><p className="text-sm font-semibold text-[var(--text)]">{label}</p>{hint&&<p className="text-xs text-[var(--dim)]">{hint}</p>}</div></div>);
}
function Hdr({ title, icon }: { title: string; icon: string }) {
  return (<div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">{icon} {title}</p><div className="gold-divider mt-2"/></div>);
}

function CoreFields({ s }: { s?: SurveyRecord|null }) {
  return (<><Hdr icon="📋" title="Core Survey"/><div className="grid gap-3 sm:grid-cols-2"><Txt id="surveyor_name" label="Surveyor" ph="Name" val={s?.surveyor_name??""}/><Txt id="roof_condition" label="Overall Condition" ph="General assessment" val={s?.roof_condition??""}/><Txt id="problem_observed" label="Problem Observed" ph="What did you find?" val={s?.problem_observed??""} multi hint="Main issue the customer called about"/><Txt id="suspected_cause" label="Suspected Cause" ph="What caused it?" val={s?.suspected_cause??""} multi/><Txt id="recommended_works" label="Recommended Works" ph="What work do you recommend?" val={s?.recommended_works??""} multi hint="Be specific — feeds into AI quote"/><Txt id="measurements" label="Measurements" ph="m², linear m, outlets..." val={s?.measurements??""} multi/><Txt id="access_notes" label="Access Notes" ph="Scaffold, parking, neighbours..." val={s?.access_notes??""} multi/><div className="space-y-3"><Tog id="scaffold_required" label="Scaffold Required" def={s?.scaffold_required} hint="Will scaffolding be needed?"/><Txt id="scaffold_notes" label="Scaffold Notes" ph="Type, height..." val={s?.scaffold_notes??""}/></div><Txt id="weather_notes" label="Weather" ph="Conditions during survey" val={s?.weather_notes??""}/><Txt id="safety_notes" label="Safety Notes" ph="Hazards..." val={s?.safety_notes??""}/><Txt id="customer_concerns" label="Customer Concerns" ph="Their words" val={s?.customer_concerns??""} multi hint="Helps personalise quote"/><Txt id="raw_notes" label="Other Notes" ph="Anything else..." val={s?.raw_notes??""} multi/></div></>);
}

function FlatFields({ d }: { d: Record<string,unknown> }) {
  return (<><Hdr icon="🏠" title="Flat Roof"/><div className="grid gap-3 sm:grid-cols-2"><Sel id="flat_surface" label="Current Surface" opts={["Felt","EPDM Rubber","GRP Fibreglass","Lead","Asphalt","Liquid Applied","Unknown"]} val={d.current_surface_type as string}/><Txt id="flat_age" label="Approx Age" ph="e.g. 15 years" val={d.approximate_age as string}/><Sel id="flat_deck" label="Deck Condition" opts={COND} val={d.deck_condition as string} hint="Soft spots? Bouncy?"/><Sel id="flat_drainage" label="Drainage" opts={COND} val={d.drainage_condition as string}/><Tog id="flat_ponding" label="Standing Water" def={d.standing_water as boolean} hint="Ponding visible?"/><Sel id="flat_upstands" label="Upstands" opts={COND} val={d.upstands_condition as string}/><Sel id="flat_flashings" label="Flashings" opts={COND} val={d.flashings_condition as string}/><Txt id="flat_rooflights" label="Rooflights" ph="Number, type, condition" val={d.rooflights as string}/><div className="sm:col-span-2"><Sel id="flat_system" label="Recommended System" opts={["GRP Fibreglass","EPDM Rubber","Liquid Applied","Lead","Single Ply","Other"]} val={d.recommended_system as string} hint="What would you quote?"/></div></div></>);
}

function PitchedFields({ d }: { d: Record<string,unknown> }) {
  return (<><Hdr icon="🏡" title="Pitched / Tiled"/><div className="grid gap-3 sm:grid-cols-2"><Sel id="p_tile" label="Tile Type" opts={["Concrete Interlocking","Plain Clay","Marley Modern","Redland 49","Slate","Rosemary","Unknown"]} val={d.tile_type as string}/><Sel id="p_ridge" label="Ridge Type" opts={["Mortar Bedded","Dry Ridge","Half Round","Angular","Unknown"]} val={d.ridge_type as string}/><Sel id="p_valley" label="Valley Type" opts={["Lead Lined","GRP Trough","Mortar","Tile Valley","None","Unknown"]} val={d.valley_type as string}/><Txt id="p_missing" label="Missing Tiles" ph="Count" val={d.missing_tiles as string}/><Sel id="p_felt" label="Underfelt" opts={COND} val={d.felt_condition as string} hint="From loft space?"/><Txt id="p_battens" label="Battens" ph="Condition" val={d.batten_condition as string}/><Tog id="p_solar" label="Solar Panels" def={d.solar_panels as boolean} hint="Need removing?"/><Tog id="p_chimney" label="Chimney Present" def={d.chimney_present as boolean}/><Txt id="p_hip" label="Hip Tiles" ph="Condition" val={d.hip_condition as string}/><Txt id="p_verge" label="Verge" ph="Mortar or dry verge" val={d.verge_condition as string}/><Txt id="p_eaves" label="Eaves" ph="Eaves course, ventilation" val={d.eaves_detail as string}/><Txt id="p_loft" label="Loft Inspection" ph="What did you see inside?" val={d.loft_notes as string} multi hint="Daylight? Damp? Insulation?"/></div></>);
}

function FasciaFields({ d }: { d: Record<string,unknown> }) {
  return (<><Hdr icon="🔧" title="Fascias / Soffits / Gutters"/><div className="grid gap-3 sm:grid-cols-2"><Sel id="f_material" label="Material" opts={["uPVC","Wood","Composite","Aluminium","Unknown"]} val={d.current_material as string}/><Sel id="f_fascia" label="Fascia Condition" opts={COND} val={d.fascia_condition as string}/><Sel id="f_soffit" label="Soffit Condition" opts={COND} val={d.soffit_condition as string}/><Sel id="f_gutter" label="Guttering" opts={COND} val={d.guttering_condition as string}/><Sel id="f_downpipe" label="Downpipe" opts={COND} val={d.downpipe_condition as string}/><Txt id="f_colour" label="Colour Preference" ph="White, black, anthracite..." val={d.colour_preference as string}/><Txt id="f_metres" label="Linear Metres" ph="Total run" val={d.linear_metres as string}/><Tog id="f_cladding" label="Cladding Present" def={d.cladding_present as boolean}/></div></>);
}

function ChimneyFields({ d }: { d: Record<string,unknown> }) {
  return (<><Hdr icon="🏭" title="Chimney / Lead"/><div className="grid gap-3 sm:grid-cols-2"><Sel id="c_condition" label="Chimney Condition" opts={COND} val={d.chimney_condition as string}/><Sel id="c_flaunching" label="Flaunching" opts={COND} val={d.flaunching_condition as string} hint="Mortar around pots"/><Sel id="c_lead" label="Lead Flashings" opts={COND} val={d.lead_flashings_condition as string}/><Tog id="c_flue" label="Gas Flue Present" def={d.gas_flue_present as boolean}/><Tog id="c_parapet" label="Parapet / Coping" def={d.parapet_or_coping as boolean}/><Txt id="c_pointing" label="Pointing" ph="Mortar joints..." val={d.pointing_condition as string}/><Txt id="c_pots" label="Chimney Pots" ph="Number, condition, caps..." val={d.chimney_pots as string}/><Txt id="c_height" label="Height / Access" ph="Scaffold needed?" val={d.height_access as string}/><Txt id="c_code" label="Lead Code" ph="Code 4, Code 5..." val={d.lead_code as string}/><Txt id="c_notes" label="Lead Notes" ph="Soakers, back gutters..." val={d.additional_notes as string} multi/></div></>);
}

export function SurveyForm({ jobId, initialSurvey }: Props) {
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [type,setType]=useState(initialSurvey?.survey_type??"");
  const [secs,setSecs]=useState<Set<Sec>>(()=>{
    const s=new Set<Sec>(["core"]);
    const t=initialSurvey?.survey_type;
    if(t==="Flat Roof")s.add("flat");if(t==="Pitched / Tiled")s.add("pitched");
    if(t==="Fascias / Soffits / Gutters")s.add("fascia");if(t==="Chimney / Lead")s.add("chimney");
    return s;
  });

  const pickType=useCallback((t:string)=>{
    setType(t);const s=new Set<Sec>(["core"]);
    if(t==="Flat Roof")s.add("flat");if(t==="Pitched / Tiled")s.add("pitched");
    if(t==="Fascias / Soffits / Gutters")s.add("fascia");if(t==="Chimney / Lead")s.add("chimney");
    setSecs(s);
  },[]);

  const toggle=useCallback((sec:Sec)=>{setSecs(p=>{const n=new Set(p);n.has(sec)?n.delete(sec):n.add(sec);return n});},[]);

  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setSaving(true);setError(null);
    const fd=new FormData(e.currentTarget);
    const body:Record<string,unknown>={};
    fd.forEach((v,k)=>{body[k]=v==="true"?true:v==="false"?false:v});
    body.survey_type=type;
    try{
      const res=await fetch(`/api/jobs/${jobId}/survey`,{method:initialSurvey?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(!res.ok)throw new Error("Failed to save");
      setSaved(true);setTimeout(()=>setSaved(false),4000);
    }catch(err){setError(err instanceof Error?err.message:"Save failed")}
    finally{setSaving(false)}
  };

  const ad=(initialSurvey?.adaptive_sections??{}) as Record<string,Record<string,unknown>>;

  return (
    <form className="space-y-4" onSubmit={submit}>
      {/* Type Selector */}
      <div className="card p-4">
        <Hdr icon="🎯" title="Survey Type"/>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {SURVEY_TYPES.map(t=>(
            <button key={t} type="button" onClick={()=>pickType(t)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left transition ${type===t?"border-[var(--gold)] bg-[rgba(212,175,55,0.15)] text-[var(--gold-l)]":"border-[var(--border)] bg-[var(--card)] text-[var(--text)]"}`}>{t}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {([["flat","Flat"],["pitched","Pitched"],["fascia","Fascias"],["chimney","Chimney"]] as [Sec,string][]).map(([k,l])=>(
            <button key={k} type="button" onClick={()=>toggle(k)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${secs.has(k)?"border-[var(--gold)] bg-[rgba(212,175,55,0.1)] text-[var(--gold-l)]":"border-[var(--border)] text-[var(--dim)]"}`}>{secs.has(k)?"✓ ":""}{l}</button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-[var(--dim)]">Toggle extra sections for mixed jobs</p>
      </div>
      <div className="card p-4"><CoreFields s={initialSurvey}/></div>
      {secs.has("flat")&&<div className="card p-4"><FlatFields d={ad.flat_roof??{}}/></div>}
      {secs.has("pitched")&&<div className="card p-4"><PitchedFields d={ad.pitched_roof??{}}/></div>}
      {secs.has("fascia")&&<div className="card p-4"><FasciaFields d={ad.fascias??{}}/></div>}
      {secs.has("chimney")&&<div className="card p-4"><ChimneyFields d={ad.chimney??{}}/></div>}
      <div className="card p-4 sticky bottom-16 md:bottom-4 z-10">
        <div className="flex items-center gap-3">
          <button className="button-primary text-sm" type="submit" disabled={saving}>{saving?"Saving...":initialSurvey?"Update Survey":"Save Survey"}</button>
          {saved&&<p className="text-sm text-[#7ce3a6]">✓ Saved</p>}
          {error&&<p className="text-sm text-[#ff9a91]">✗ {error}</p>}
        </div>
      </div>
    </form>
  );
}
