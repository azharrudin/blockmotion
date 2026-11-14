import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronDown, ChevronUp, Dice5, Focus, WandSparkles } from 'lucide-react';
import { MAX_OBJECTS } from '../editor/assets';
import { useEditor } from '../editor/store';
import { createEnvironmentPlan, GENERATOR_LABELS, generatorDefaults, type GeneratorKind, type GeneratorOptions } from '../editor/generators';
import { studioRef } from './Viewport';

export function EnvironmentGenerator() {
  const [open,setOpen]=useState(false);
  const [options,setOptions]=useState(()=>generatorDefaults('town'));
  const [busy,setBusy]=useState(false);
  const [resultIds,setResultIds]=useState<string[]>([]);
  const state=useEditor(useShallow(editor => ({ project: editor.project, generateEnvironment: editor.generateEnvironment })));
  const urban=options.kind==='town'||options.kind==='city';
  const preview=useMemo(()=>{
    try{return {plan:createEnvironmentPlan(options),error:''};}
    catch(error){return {plan:null,error:error instanceof Error?error.message:'Invalid options'};}
  },[options]);
  const existing=options.mode==='replace'?0:state.project.objects?.length??0;
  const count=preview.plan?.objects.length??0;
  const capacityError=existing+count>MAX_OBJECTS?`Needs ${count} objects; ${MAX_OBJECTS-existing} slots available. Reduce counts or replace scene objects.`:'';
  const error=preview.error||capacityError;
  const numberField=(key:keyof GeneratorOptions,label:string,min:number,max:number,step=1)=><label className="generator-field" key={key}><span>{label}</span><input aria-label={label} type="number" min={min} max={max} step={step} required value={options[key] as number} onChange={event=>setOptions(previous=>({...previous,[key]:Number(event.target.value)}))}/></label>;
  const generate=()=>{
    if(error||busy)return;
    setBusy(true);
    window.setTimeout(()=>{
      try{const ids=useEditor.getState().generateEnvironment(options);setResultIds(ids);if(ids.length)studioRef.current?.focusObjects(ids);}
      finally{setBusy(false);}
    },0);
  };
  return <div className="environment-generator">
    <button className="generator-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><WandSparkles size={15}/> Environment generator {open?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
    {open&&<form className="generator-content" onSubmit={event=>{event.preventDefault();generate();}}>
      <label className="generator-field"><span>Environment</span><select aria-label="Environment type" value={options.kind} onChange={event=>setOptions(previous=>({...generatorDefaults(event.target.value as GeneratorKind),mode:previous.mode,originX:previous.originX,originZ:previous.originZ,seed:previous.seed}))}>{Object.entries(GENERATOR_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      {urban?<>
        <div className="generator-fields">{numberField('columns','Blocks X',1,8)}{numberField('rows','Blocks Z',1,8)}</div>
        {numberField('lotsPerBlock','Buildings per block',1,3)}
        <label className="generator-check"><input type="checkbox" checked={options.details} onChange={event=>setOptions(previous=>({...previous,details:event.target.checked}))}/> Street lights and props</label>
      </>:<div className="generator-fields">{numberField('size','Area size (u)',20,120)}{numberField('height',options.kind==='mountains'?'Mountain height (u)':'Terrain height (u)',0,35,0.5)}</div>}
      {numberField('treeCount',options.kind==='desert'?'Cacti / palms':urban?'Trees / greenery':'Trees',0,250)}
      {!urban&&numberField('rockCount','Rocks',0,60)}
      <div className="generator-seed">{numberField('seed','Seed',0,2147483647)}<button type="button" title="New random seed" onClick={()=>setOptions(previous=>({...previous,seed:Math.floor(Math.random()*2147483647)}))}><Dice5 size={16}/></button></div>
      <div className="generator-fields">{numberField('originX','Origin X',-500,500)}{numberField('originZ','Origin Z',-500,500)}</div>
      <label className="generator-field"><span>Generate mode</span><select aria-label="Generate mode" value={options.mode} onChange={event=>setOptions(previous=>({...previous,mode:event.target.value as GeneratorOptions['mode']}))}><option value="append">Add to scene</option><option value="replace">Replace scene objects</option></select></label>
      {preview.plan&&<div className="generator-summary">{urban&&<span>{preview.plan.blocks} blocks · {preview.plan.buildings} buildings</span>}<span>{preview.plan.width} × {preview.plan.depth} u · {count} new objects</span><span>After generation: {existing+count}/{MAX_OBJECTS}</span></div>}
      {error&&<p className="generator-error" role="alert">{error}</p>}
      <button className="generator-submit" disabled={busy||!!error} type="submit"><WandSparkles size={14}/>{busy?'Generating…':options.mode==='replace'?'Generate & replace':'Generate environment'}</button>
      {resultIds.some(id=>state.project.objects?.some(o=>o.id===id))&&<button type="button" className="generator-frame" onClick={()=>studioRef.current?.focusObjects(resultIds)}><Focus size={13}/> Frame result</button>}
      <p className="preset-note">The same seed repeats the layout. Terrain and roads are grouped nodes; buildings and plants are editable objects. Replace mode removes existing scene objects. Undo with Ctrl/Cmd+Z.</p>
    </form>}
  </div>;
}
