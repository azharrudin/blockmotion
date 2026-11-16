import { memo, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Copy, Focus, RotateCcw, Trash2, X } from 'lucide-react';
import { clonePose, BONE_LABELS, JOINT_IDS, type JointId, type SceneObject, type WeldKey } from '../editor/types';
import { useEditor } from '../editor/store';
import { isCharacter, isJointId } from '../editor/characters';
import { activeWeld } from '../editor/attachments';
import { cameraSettings, isCamera } from '../editor/cameras';
import { DEFAULT_SCRIPT } from '../editor/assets';
import { validateScript } from '../engine/ScriptAssets';
import { getTrack } from '../editor/tracks';
import { studioRef } from './Viewport';

const WELD_AXES = ['X', 'Y', 'Z'] as const;
const WELD_FIELDS = [
  { key: 'position', label: 'Position', unit: 'm', step: 0.1 },
  { key: 'rotation', label: 'Rotation', unit: '°', step: 1 },
  { key: 'scale', label: 'Scale', unit: '×', step: 0.1 },
] as const;

function WeldEditor({ object }: { object: SceneObject }) {
  const state = useEditor(useShallow(editor => ({
    project: editor.project, time: editor.time,
    weldObject: editor.weldObject, detachObject: editor.detachObject,
    updateWeldOffset: editor.updateWeldOffset, deleteWeld: editor.deleteWeld,
  })));
  const [target, setTarget] = useState('');
  useEffect(() => setTarget(''), [object.id]);
  const targets = (state.project.objects ?? []).filter(item => item.id !== object.id).flatMap(item => [
    { value: item.id, label: item.name },
    ...(isCharacter(item) ? JOINT_IDS.map(joint => ({ value: `${item.id}:${joint}`, label: `${item.name} / ${BONE_LABELS[joint]}` })) : []),
  ]);
  const welds = object.welds ?? [];
  const active = activeWeld(object, state.time);
  const activeOffset = active?.targetId && active.offset ? active.offset : null;
  const activeId = active?.id ?? null;
  const targetLabel = (weld: WeldKey) => weld.targetId
    ? `${state.project.objects?.find(item => item.id === weld.targetId)?.name ?? 'Missing target'}${weld.joint ? ` / ${BONE_LABELS[weld.joint]}` : ''}`
    : 'Detached';
  const weld = () => {
    if (!target) return;
    const [targetId, joint] = target.split(':');
    state.weldObject(object.id, targetId, joint && isJointId(joint) ? joint as JointId : undefined);
  };
  return <>
    <div className="section-label">WELD / ATTACH</div>
    <label className="settings-field"><span>Target</span>
      <select value={target} onChange={event => setTarget(event.target.value)}>
        <option value="">Choose object or joint…</option>
        {targets.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <div className="object-actions animation-actions">
      <button disabled={!target} onClick={weld}>Weld at playhead</button>
      <button onClick={() => state.detachObject(object.id)}>Detach at playhead</button>
    </div>
    {welds.length > 0 && <div className="weld-list">
      {welds.map(weldKey => <div key={weldKey.id} className={`weld-row ${activeId === weldKey.id ? 'active' : ''}`}>
        <span className="weld-time">{weldKey.time.toFixed(2)}s</span>
        <span className="weld-target">{targetLabel(weldKey)}</span>
        <button className="weld-remove" title="Delete weld key" onClick={() => state.deleteWeld(object.id, weldKey.id)}>✕</button>
      </div>)}
    </div>}
    {activeOffset && activeId && <>
      <div className="transform-field-heading"><span>Weld offset</span><span>relative to target</span></div>
      {WELD_FIELDS.map(field => <div className="transform-field-group" key={field.key}>
        <div className="transform-field-heading"><span>{field.label}</span><span>{field.unit}</span></div>
        <div className="axis-grid">{WELD_AXES.map((axis, i) => <label className="axis-input" key={axis}>
          <span className={`axis-letter ${axis.toLowerCase()}`}>{axis}</span>
          <input type="number" min={field.key === 'scale' ? 0.01 : undefined} step={field.step}
            value={Number(activeOffset[field.key][i].toFixed(2))}
            aria-label={`Weld offset ${field.label} ${axis}`}
            onChange={event => { const value = Number(event.target.value); if (!Number.isFinite(value)) return; const offset = clonePose(activeOffset); offset[field.key][i] = value; state.updateWeldOffset(object.id, activeId, offset); }}/>
        </label>)}</div>
      </div>)}
    </>}
    <p className="inspector-help">Weld keyframes make this object follow another object or character joint. While welded, its own transform keys and gizmo edits are ignored; use the Weld offset fields. Detach bakes the current welded pose into a keyframe.</p>
  </>;
}

function ScriptEditor({ object }: { object: SceneObject }) {
  const updateScript = useEditor(useShallow(editor => editor.updateScript));
  const [draft, setDraft] = useState(object.script ?? '');
  const [error, setError] = useState('');
  useEffect(() => { setDraft(object.script ?? ''); setError(''); }, [object.id, object.script]);
  const apply = () => {
    const problem = validateScript(draft);
    if (problem) { setError(problem); return; }
    setError('');
    updateScript(object.id, draft);
  };
  const reset = () => { setDraft(DEFAULT_SCRIPT); setError(''); updateScript(object.id, DEFAULT_SCRIPT); };
  return <>
    <div className="section-label">THREE.JS SCRIPT</div>
    <textarea className="script-editor" aria-label="Three.js script" spellCheck={false} value={draft}
      onChange={event => setDraft(event.target.value)}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        const element = event.currentTarget;
        const start = element.selectionStart, end = element.selectionEnd;
        setDraft(`${draft.slice(0, start)}  ${draft.slice(end)}`);
        requestAnimationFrame(() => { element.selectionStart = element.selectionEnd = start + 2; });
      }}/>
    {error && <p className="script-error" role="alert">{error}</p>}
    <div className="object-actions animation-actions">
      <button onClick={apply} disabled={draft === object.script}>Apply script</button>
      <button onClick={reset}>Reset example</button>
    </div>
    <p className="inspector-help">Use the provided THREE global and return a THREE.Object3D (Mesh, Group, …). ES module import/export is not available. Script runs in this page — only use code you trust.</p>
  </>;
}

export const ObjectProperties = memo(function ObjectProperties({ object }: { object: SceneObject }) {
  const state = useEditor(useShallow(editor => ({ ...editor,
    time: editor.playing ? Math.floor(editor.time * 10) / 10 : editor.time,
  })));
  const [name, setName] = useState(object.name);
  useEffect(() => setName(object.name), [object.id, object.name]);
  const character = isCharacter(object);
  const imported = object.kind === 'imported';
  const camera = isCamera(object);
  const settings = camera ? cameraSettings(object) : null;
  const followTargets = state.project.objects?.filter(target => target.id !== object.id && !isCamera(target)) ?? [];
  const commitName = () => {
    const next = name.trim();
    if (next) state.updateObject(object.id, { name: next }); else setName(object.name);
  };
  return <>
    <label className="settings-field"><span>{character ? 'Character name' : 'Object name'}</span><input maxLength={60} value={name} onChange={e => setName(e.target.value)} onBlur={commitName} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></label>
    <div className="palette-fields">{([
      ...(imported ? [] : [{ id: 'color' as const, label: character ? 'Shirt' : 'Primary color', value: object.color }]),
      ...(character ? [{ id: 'skinColor', label: 'Skin', value: object.skinColor ?? '#f3c58b' }, { id: 'pantsColor', label: 'Pants', value: object.pantsColor ?? '#343d53' }] : []),
    ] as { id: 'color' | 'skinColor' | 'pantsColor'; label: string; value: string }[]).map(color => <label key={color.id} className="color-row"><span>{color.label}</span><span className="color-control"><input aria-label={color.label} type="color" value={color.value} onChange={e => state.updateObject(object.id, { [color.id]: e.target.value })}/><span>{color.value.toUpperCase()}</span></span></label>)}</div>
    {camera && settings && <>
      <div className="section-label">CAMERA FOLLOW</div>
      <label className="settings-field"><span>Follow object</span>
        <select value={settings.targetId ?? ''} onChange={e => state.updateCamera(object.id, { targetId: e.target.value || null })}>
          <option value="">None</option>
          {followTargets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
        </select>
      </label>
      {settings.targetId && <label className="switch-row">
        <div><span>Look at target</span><small>Aim the camera at the subject automatically</small></div>
        <input type="checkbox" checked={settings.lookAtTarget} onChange={e => state.updateCamera(object.id, { lookAtTarget: e.target.checked })}/>
      </label>}
      <p className="inspector-help">Follow keeps the camera's current relative distance and tracks the target's animation. {settings.targetId ? settings.lookAtTarget ? 'Rotation is aimed at the target.' : 'Rotation still uses the camera keyframes.' : 'Choose an object to enable follow.'}</p>
    </>}
    {object.kind === 'script' && <ScriptEditor object={object}/>}
    <WeldEditor object={object}/>
    <div className="object-actions">
      <button onClick={() => studioRef.current?.focusSelected()}><Focus size={14}/> Focus</button>
      <button onClick={state.duplicateObject}><Copy size={14}/> Duplicate</button>
      <button onClick={state.deselect}><X size={14}/> Deselect</button>
      <button className="danger" onClick={state.deleteObject}><Trash2 size={14}/> {character ? 'Delete character' : 'Delete'}</button>
    </div>
    <div className="object-actions animation-actions">
      <button disabled={!getTrack(state.project, state.selection).length} onClick={() => state.clearKeyframes('node')}><Trash2 size={13}/> Clear node keys</button>
      {character && <><button onClick={() => state.clearKeyframes('character')}><Trash2 size={13}/> Clear character keys</button><button onClick={state.resetCharacterPose}><RotateCcw size={13}/> Reset pose</button></>}
    </div>
    <div className="meta-list"><div><span>Selected track keyframes</span><strong>{getTrack(state.project, state.selection).length}</strong></div><div><span>Current frame</span><strong>{Math.round(state.time * state.project.fps)}</strong></div></div>
    <p className="inspector-help">{character ? 'Expand this character in Explorer to select its torso, head, arms, or legs. Select the character name to move the whole character. Each node has its own keyframes. Delete character removes the whole character and its animation.' : 'Move, rotate, or scale this object with the gizmo or transform fields.'} Press K to record a keyframe. Auto-key records edits on blur or after a gizmo drag.</p>
  </>;
});
