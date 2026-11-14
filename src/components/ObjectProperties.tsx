import { useEffect, useState } from 'react';
import { Copy, Focus, RotateCcw, Trash2 } from 'lucide-react';
import type { SceneObject } from '../editor/types';
import { useEditor } from '../editor/store';
import { isCharacter } from '../editor/characters';
import { getTrack } from '../editor/tracks';
import { studioRef } from './Viewport';

export function ObjectProperties({ object }: { object: SceneObject }) {
  const state = useEditor();
  const [name, setName] = useState(object.name);
  useEffect(() => setName(object.name), [object.id, object.name]);
  const character = isCharacter(object);
  const commitName = () => {
    const next = name.trim();
    if (next) state.updateObject(object.id, { name: next }); else setName(object.name);
  };
  return <>
    <label className="settings-field"><span>{character ? 'Character name' : 'Object name'}</span><input maxLength={60} value={name} onChange={e => setName(e.target.value)} onBlur={commitName} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></label>
    <div className="palette-fields">{([
      { id: 'color', label: character ? 'Shirt' : 'Primary color', value: object.color },
      ...(character ? [{ id: 'skinColor', label: 'Skin', value: object.skinColor ?? '#f3c58b' }, { id: 'pantsColor', label: 'Pants', value: object.pantsColor ?? '#343d53' }] : []),
    ] as { id: 'color' | 'skinColor' | 'pantsColor'; label: string; value: string }[]).map(color => <label key={color.id} className="color-row"><span>{color.label}</span><span className="color-control"><input aria-label={color.label} type="color" value={color.value} onChange={e => state.updateObject(object.id, { [color.id]: e.target.value })}/><span>{color.value.toUpperCase()}</span></span></label>)}</div>
    <div className="object-actions">
      <button onClick={() => studioRef.current?.focusSelected()}><Focus size={14}/> Focus</button>
      <button onClick={state.duplicateObject}><Copy size={14}/> Duplicate</button>
      <button className="danger" onClick={state.deleteObject}><Trash2 size={14}/> {character ? 'Delete character' : 'Delete'}</button>
    </div>
    <div className="object-actions animation-actions">
      <button disabled={!getTrack(state.project, state.selection).length} onClick={() => state.clearKeyframes('node')}><Trash2 size={13}/> Clear node keys</button>
      {character && <><button onClick={() => state.clearKeyframes('character')}><Trash2 size={13}/> Clear character keys</button><button onClick={state.resetCharacterPose}><RotateCcw size={13}/> Reset pose</button></>}
    </div>
    <div className="meta-list"><div><span>Selected track keyframes</span><strong>{getTrack(state.project, state.selection).length}</strong></div><div><span>Current frame</span><strong>{Math.round(state.time * state.project.fps)}</strong></div></div>
    <p className="inspector-help">{character ? 'Expand this character in Explorer to select its torso, head, arms, or legs. Select the character name to move the whole character. Each node has its own keyframes. Delete character removes the whole character and its animation.' : 'Move, rotate, or scale this object with the gizmo or transform fields.'} Press K to record a keyframe. Auto-key records edits on blur or after a gizmo drag.</p>
  </>;
}
