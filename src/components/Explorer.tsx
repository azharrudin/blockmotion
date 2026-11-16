import { Fragment, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Box, Camera, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Eye, FolderOpen, Layers3, Lightbulb, PersonStanding, Trash2, Sparkles, Waves, Wind, Footprints, MoveUp, Film, RotateCcw } from 'lucide-react';
import { useEditor } from '../editor/store';
import { BONE_LABELS, JOINT_IDS } from '../editor/types';
import type { MotionAction, MotionOptions, PresetName } from '../editor/presets';
import { EnvironmentGenerator } from './EnvironmentGenerator';
import { AssetLibrary } from './AssetLibrary';

import { isCharacter, jointNodeId } from '../editor/characters';
import { cameraSettings, isCamera } from '../editor/cameras';
const presets: { id: PresetName; label: string; caption: string; Icon: typeof Wind }[] = [
  { id: 'wave', label: 'Wave', caption: 'Greeting', Icon: Waves },
  { id: 'walk', label: 'Walk', caption: 'Looping', Icon: Footprints },
  { id: 'jump', label: 'Jump', caption: 'Action', Icon: MoveUp },
  { id: 'idle', label: 'Idle', caption: 'Breathing', Icon: Wind },
  { id: 'cinematic', label: 'Camera', caption: 'Sequence', Icon: Film },
];

export function Explorer() {
  const [hierarchyOpen, setHierarchyOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [presetOpen, setPresetOpen] = useState(true);
  const [motionOpen, setMotionOpen] = useState(false);
  const [motion, setMotion] = useState<MotionOptions>({ action: 'walk', duration: 2, intensity: 1, repeats: 2, direction: 0, mode: 'replace' });
  const { selection, selectedObject, selectedJoint, selectObject, deleteObject, preset, generateMotion, project, flash, resetCharacterPose, deleteAll } = useEditor(useShallow(state => ({
    selection: state.selection, selectedObject: state.selectedObject, selectedJoint: state.selectedJoint,
    selectObject: state.selectObject, deleteObject: state.deleteObject,
    preset: state.preset, generateMotion: state.generateMotion, project: state.project,
    flash: state.flash, resetCharacterPose: state.resetCharacterPose, deleteAll: state.deleteAll,
  })));
  useEffect(() => {
    if (!selectedObject || !selectedJoint) return;
    setCollapsed(previous => {
      if (!previous.has(selectedObject)) return previous;
      const next = new Set(previous); next.delete(selectedObject); return next;
    });
  }, [selection, selectedObject, selectedJoint]);
  return <aside className="explorer left-panel">
    <div className="panel-heading"><span className="panel-heading-title"><Layers3 size={15}/> EXPLORER</span><button title="About explorer" className="heading-action" onClick={() => flash('Select a joint to manipulate it in the viewport')}><CircleHelp size={14}/></button></div>
    <div className="explorer-scroll">
      <EnvironmentGenerator/>
      <AssetLibrary/>
      <div className="section-label with-action">SCENE HIERARCHY <button className="scene-clear-button" title="Delete all objects, characters, and keyframes" onClick={deleteAll}><Trash2 size={12}/> Delete all</button></div>
      <div className="scene-tree">
        <button className="tree-item tree-root" onClick={() => setHierarchyOpen(!hierarchyOpen)}>
          {hierarchyOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<FolderOpen size={15} className="tree-folder"/><span>Scene</span><span className="tree-meta">{2 + (project.objects?.length ?? 0)}</span>
        </button>
        {hierarchyOpen && <>
          <div className="tree-item tree-indent static-item"><span className="tree-spacer"/><Lightbulb size={15} className="tree-light"/><span>Studio Lights</span><Eye size={12} className="tree-eye"/></div>
          <div className="tree-item tree-indent static-item"><span className="tree-spacer"/><Box size={15} className="tree-muted"/><span>Stage</span><Eye size={12} className="tree-eye"/></div>
          {(project.objects ?? []).map(object => <Fragment key={object.id}>
            <div className={`object-tree-row ${selectedObject === object.id && !selectedJoint ? 'is-selected' : ''}`}>
              {isCharacter(object) && <button className="object-expand" aria-label={`${collapsed.has(object.id) ? 'Expand' : 'Collapse'} ${object.name}`} aria-expanded={!collapsed.has(object.id)} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(object.id)) next.delete(object.id); else next.add(object.id); return next; })}>{collapsed.has(object.id) ? <ChevronRight size={13}/> : <ChevronDown size={13}/>}</button>}
              <button className="tree-item tree-indent" data-node-id={object.id} onClick={() => selectObject(object.id)} title={object.name}>{!isCharacter(object) && <span className="tree-spacer"/>}{isCharacter(object) ? <PersonStanding size={15} style={{ color: object.color }}/> : isCamera(object) ? <Camera size={15} className="tree-camera"/> : <Box size={15} style={{ color: object.color }}/>}<span className="object-tree-name">{object.name}</span>{isCamera(object) && project.activeCameraId === object.id ? <span className="tree-meta">ACTIVE</span> : isCamera(object) && cameraSettings(object).targetId ? <span className="tree-meta">FOLLOW</span> : null}</button>
              <button className="object-tree-delete" title={`Delete ${object.name}`} onClick={() => { selectObject(object.id); deleteObject(); }}><Trash2 size={13}/></button>
            </div>
            {isCharacter(object) && !collapsed.has(object.id) && JOINT_IDS.map(joint => <button key={joint} data-node-id={jointNodeId(object.id, joint)} className={`tree-item tree-bone ${selection === jointNodeId(object.id, joint) ? 'is-selected' : ''}`} onClick={() => selectObject(object.id, joint)}><span className="tree-guideline"/><Box size={13}/><span>{BONE_LABELS[joint]}</span></button>)}
          </Fragment>)}
        </>}
      </div>
      <div className="sidebar-divider"/>
      <div className="section-label with-action" role="button" tabIndex={0} onClick={() => setPresetOpen(!presetOpen)} onKeyDown={e => { if (e.key === 'Enter') setPresetOpen(!presetOpen); }}>
        ANIMATION PRESETS {presetOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
      </div>
      {presetOpen && <>
        <p className="sidebar-copy">Select a character, then apply a motion and customize its joints.</p>
        <div className="environment-generator motion-generator">
          <button className="generator-toggle" aria-expanded={motionOpen} onClick={() => setMotionOpen(!motionOpen)}><Sparkles size={15}/> Procedural Motion {motionOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</button>
          {motionOpen && <form className="generator-content" onSubmit={event => { event.preventDefault(); generateMotion(motion); }}>
            <label className="generator-field"><span>Action</span><select aria-label="Motion action" value={motion.action} onChange={event => setMotion(previous => ({ ...previous, action: event.target.value as MotionAction }))}>
              <option value="walk">Walk</option><option value="run">Run</option><option value="idle">Idle</option><option value="jump">Jump</option><option value="wave">Wave</option>
            </select></label>
            {(motion.action === 'walk' || motion.action === 'run') && <label className="generator-field"><span>Travel direction</span><select aria-label="Motion direction" value={motion.direction ?? 0} onChange={event => setMotion(previous => ({ ...previous, direction: Number(event.target.value) }))}>
              <option value={0}>Forward</option><option value={45}>Forward left</option><option value={90}>Left</option><option value={135}>Back left</option><option value={180}>Backward</option><option value={-135}>Back right</option><option value={-90}>Right</option><option value={-45}>Forward right</option>
            </select></label>}
            <div className="generator-fields">
              <label className="generator-field"><span>Cycle (s)</span><input aria-label="Cycle duration" type="number" min={0.5} max={20} step={0.5} value={motion.duration} onChange={event => setMotion(previous => ({ ...previous, duration: Number(event.target.value) }))}/></label>
              <label className="generator-field"><span>Repeats</span><input aria-label="Motion repeats" type="number" min={1} max={10} step={1} value={motion.repeats} onChange={event => setMotion(previous => ({ ...previous, repeats: Number(event.target.value) }))}/></label>
            </div>
            <label className="generator-field"><span>Intensity ({motion.intensity.toFixed(2)}×)</span><input aria-label="Motion intensity" type="range" min={0.25} max={2} step={0.05} value={motion.intensity} onChange={event => setMotion(previous => ({ ...previous, intensity: Number(event.target.value) }))}/></label>
            <label className="generator-field"><span>Generate mode</span><select aria-label="Motion mode" value={motion.mode ?? 'replace'} onChange={event => setMotion(previous => ({ ...previous, mode: event.target.value as MotionOptions['mode'] }))}>
              <option value="replace">Replace animation</option><option value="add">Add after animation</option>
            </select></label>
            <div className="generator-summary"><span>Clip length: {(motion.duration * motion.repeats).toFixed(1)} s</span><span>{motion.mode === 'add' ? 'Appends after existing keys' : 'Replaces existing keys'}</span></div>
            <button className="generator-submit" disabled={!project.objects?.some(object => object.id === selectedObject && isCharacter(object))} type="submit"><Sparkles size={14}/>{motion.mode === 'add' ? 'Add motion' : 'Generate motion'}</button>
            <p className="preset-note">{motion.mode === 'add' ? 'Adds the clip after the character\'s existing animation.' : 'Replaces animation on the selected character.'} Undo with Ctrl/Cmd+Z.</p>
          </form>}
        </div>
        <div className="presets-grid">
          {presets.map(({ id, label, caption, Icon }) => <button className="preset-card" key={id} title={`Load ${label} preset (Camera uses the selected camera, or the active camera)`} onClick={() => preset(id)}>
            <span className="preset-icon"><Icon size={17}/></span><span className="preset-label">{label}</span><span className="preset-subtitle">{caption}</span>
          </button>)}
          <button className="preset-card reset-card" disabled={!project.objects?.some(o => o.id === selectedObject && isCharacter(o))} title="Reset selected character joints to a neutral pose at the playhead" onClick={resetCharacterPose}><span className="preset-icon"><RotateCcw size={17}/></span><span className="preset-label">Reset pose</span><span className="preset-subtitle">Neutral joints</span></button>
        </div>
        <p className="preset-note"><Sparkles size={12}/> Motion presets apply to the selected character only. Camera sequence applies to the selected camera, or the active camera. Undo with Ctrl+Z.</p>
      </>}
      <div className="sidebar-divider"/>
      <div className="section-label">PROJECT ASSETS</div>
      <div className="asset-entry"><Clapperboard size={14}/><span>{project.name}</span><span className="asset-ext">.anim</span></div>
      <p className="preset-note">Add presets from the object library above. Select an object to edit, duplicate, or delete it.</p>
    </div>
    <div className="explorer-footer"><span className="status-dot"/> Local workspace <span className="footer-version">v1.0</span></div>
  </aside>;
}
