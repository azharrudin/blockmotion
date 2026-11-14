import { memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Camera, Copy, Plus, Trash2 } from 'lucide-react';
import { useEditor } from '../editor/store';
import type { CameraCutView } from '../editor/types';
import { CAMERA_CUT_LABELS } from '../editor/cameraCuts';
import { studioRef } from './Viewport';

export const CameraCuts = memo(function CameraCuts() {
  const state=useEditor(useShallow(editor => ({
    project: editor.project, selectedCut: editor.selectedCut, cameraPreview: editor.cameraPreview,
    addCameraCut: editor.addCameraCut, setCameraPreview: editor.setCameraPreview, clearCameraCuts: editor.clearCameraCuts,
    moveCameraCut: editor.moveCameraCut, selectCameraCut: editor.selectCameraCut, recaptureCameraCut: editor.recaptureCameraCut,
    deleteCameraCut: editor.deleteCameraCut,
  })));
  const [view,setView]=useState<CameraCutView>('current');
  const cuts=state.project.cameraCuts??[];
  const selected=cuts.find(c=>c.id===state.selectedCut);
  return <div className="camera-cut-controls">
    <div className="camera-cut-bar">
      <span className="camera-cut-heading"><Camera size={13}/><span>CAMERA CUTS</span></span>
      <select aria-label="New camera cut view" value={view} onChange={e=>setView(e.target.value as CameraCutView)}>{Object.entries(CAMERA_CUT_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
      <button title="Add or replace a camera cut at the playhead" onClick={()=>state.addCameraCut(view,studioRef.current?.captureCutView(view))}><Plus size={12}/> Cut here</button>
      <button className={state.cameraPreview&&cuts.length?'active':''} title="Preview automatic camera cuts during playback" disabled={!cuts.length} aria-pressed={!!cuts.length&&state.cameraPreview} onClick={()=>state.setCameraPreview(!state.cameraPreview)}>Preview cuts</button>
      <button title="Clear all camera cuts" disabled={!cuts.length} onClick={state.clearCameraCuts}><Trash2 size={12}/></button>
    </div>
    {selected&&<div className="camera-cut-editor">
      <span className="camera-cut-selected" title={CAMERA_CUT_LABELS[selected.view]}>{CAMERA_CUT_LABELS[selected.view]}</span>
      <label>Time <input aria-label="Camera cut time" type="number" step={1/state.project.fps} min={0} max={state.project.duration} value={selected.time} onChange={e=>{if(e.target.value!=='')state.moveCameraCut(selected.id,Number(e.target.value));}}/> s</label>
      <button title="Replace selected cut with the currently displayed camera view" onClick={()=>{const capture=studioRef.current?.captureCutView('current');if(capture)state.recaptureCameraCut(selected.id,capture);}}><Copy size={12}/> Capture view</button>
      <button title="Delete selected camera cut" onClick={()=>state.deleteCameraCut(selected.id)}><Trash2 size={12}/></button>
    </div>}
  </div>;
});
