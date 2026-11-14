import { memo, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react';
import { useEditor } from '../editor/store';
import { JOINT_IDS } from '../editor/types';
import { isCharacter, jointNodeId } from '../editor/characters';
import { getTrack, timelineTracks } from '../editor/tracks';

export const KeyframeActions = memo(function KeyframeActions() {
  const state = useEditor(useShallow(editor => ({
    project: editor.project, selectedObject: editor.selectedObject, selection: editor.selection, selectedKey: editor.selectedKey,
    resetKey: editor.resetKey, deleteKey: editor.deleteKey, clearKeyframes: editor.clearKeyframes,
  })));
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const character = state.project.objects?.find(o => o.id === state.selectedObject && isCharacter(o));
  const trackCount = getTrack(state.project, state.selection).length;
  const characterCount = character ? [character.id, ...JOINT_IDS.map(j => jointNodeId(character.id, j))].reduce((n, id) => n + getTrack(state.project, id).length, 0) : 0;
  const projectCount = timelineTracks(state.project).reduce((n, track) => n + track.keys.length, 0) + (state.project.cameraCuts?.length ?? 0);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const action = (run: () => void) => { run(); setOpen(false); trigger.current?.focus(); };
  return <div className="keyframe-actions" ref={root}>
    <button ref={trigger} title="Keyframe reset and clear actions" aria-expanded={open} aria-controls="keyframe-action-menu" onClick={() => setOpen(!open)}>Keyframes <ChevronDown size={12}/></button>
    {open && <div id="keyframe-action-menu" className="keyframe-menu" role="group" aria-label="Keyframe actions">
      <button disabled={!state.selectedKey} onClick={() => action(state.resetKey)}><RotateCcw size={14}/><span>Reset selected keyframe<small>Restore its base transform</small></span></button>
      <button disabled={!state.selectedKey} onClick={() => action(state.deleteKey)}><Trash2 size={14}/><span>Delete selected keyframe<small>Remove the selected diamond</small></span></button>
      <div className="keyframe-menu-divider"/>
      <button disabled={!trackCount} onClick={() => action(() => state.clearKeyframes('node'))}><Trash2 size={14}/><span>Clear node keyframes<small>{trackCount} keys · selected track only</small></span></button>
      <button disabled={!characterCount} onClick={() => action(() => state.clearKeyframes('character'))}><Trash2 size={14}/><span>Clear character keyframes<small>Root and every joint · {characterCount} keys</small></span></button>
      <button disabled={!projectCount} onClick={() => action(() => state.clearKeyframes('project'))}><Trash2 size={14}/><span>Clear all project keyframes<small>Objects, joints, camera, and cuts · {projectCount} keys</small></span></button>
      <p>Cleared tracks return to their base transforms. Objects stay in the scene. Undo with Ctrl/Cmd+Z.</p>
    </div>}
  </div>;
});
