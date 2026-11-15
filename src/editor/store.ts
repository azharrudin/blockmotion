import { create } from 'zustand';
import { createGeneratedMotion, createProject, createPreset, motionClipLength, motionEndTime, type MotionOptions, type PresetName } from './presets';
import { isValidSky, SKY_PRESETS } from './sky';
import { ASSET_CATALOG, MAX_OBJECTS, createSceneObject, isValidObjectPose, isValidSceneObject } from './assets';
import { BONE_IDS, JOINT_IDS, clonePose, keyId, neutralPose, roundFrame, type AssetKind, type CameraCut, type CameraCutView, type JointId, type Keyframe, type Palette, type Pose, type Project, type SceneObject, type SkyPreset, type SkySettings, type Tool, type Tracks } from './types';
import { isCharacter, jointNodeId, resolveObjectNode } from './characters';
import { getTrack, nodeDefaultPose, replaceTrack, sampleNodePose, sortProjectTracks, timelineTracks } from './tracks';

import { GRID_SIZES } from './town';
import { createEnvironmentPlan, materializeEnvironment, GENERATOR_LABELS, type GeneratorOptions } from './generators';
import { CAMERA_CUT_LABELS, isValidCameraCuts, type CameraSnapshot } from './cameraCuts';
import { activeCameraNodeId, cleanCameraReferences, hasCameraSequence, isCamera, sceneCameras } from './cameras';
import { writePoseKey } from './keyframes';

export type ClearKeyScope = 'node' | 'character' | 'project';

const STORAGE_KEY = 'blockmotion-studio-project-v1';
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
export function isValidProject(v: unknown): v is Project {
  if (!isRecord(v) || v.version !== 1 || typeof v.name !== 'string' || !isRecord(v.tracks) || !isRecord(v.palette)) return false;
  if (v.sceneVersion !== undefined && v.sceneVersion !== 2) return false;
  if (typeof v.duration !== 'number' || !Number.isFinite(v.duration) || v.duration < 0.5 || v.duration > 600) return false;
  if (typeof v.fps !== 'number' || v.fps < 1 || v.fps > 120) return false;
  if (!['smooth','linear','step'].includes(String(v.interpolation))) return false;
  if (v.cameraCuts !== undefined && !isValidCameraCuts(v.cameraCuts, v.duration as number)) return false;
  if (v.sky !== undefined && !isValidSky(v.sky)) return false;
  if (v.objects !== undefined) {
    if (!Array.isArray(v.objects) || v.objects.length > MAX_OBJECTS + (v.sceneVersion === 2 ? 1 : 0) || !v.objects.every(o => isValidSceneObject(o, v.duration as number))) return false;
    if (new Set(v.objects.map(o => o.id)).size !== v.objects.length) return false;
  }
  for (const id of BONE_IDS) {
    const arr = v.tracks[id];
    if (!Array.isArray(arr) || arr.length > 5000) return false;
    for (const k of arr) {
      if (!isRecord(k) || typeof k.id !== 'string' || typeof k.time !== 'number' || !isRecord(k.value)) return false;
      if (!Number.isFinite(k.time) || k.time < 0 || k.time > v.duration + 0.01) return false;
      for (const prop of ['position', 'rotation', 'scale']) {
        const arr = k.value[prop];
        if (!Array.isArray(arr) || arr.length !== 3 || !arr.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 100000)) return false;
      }
    }
  }
  for (const color of ['skin', 'shirt', 'pants', 'background']) {
    if (typeof v.palette[color] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v.palette[color])) return false;
  }
  return true;
}
function initialProject(): Project {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    const data: unknown = json && JSON.parse(json);
    if (isValidProject(data)) return sortProjectTracks(data);
  } catch { /* Private browsing or corrupt storage */ }
  const project = createProject('My first animation');
  return createPreset('wave', project, project.objects![0].id);
}
export function persistProject(project: Project): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); return true; }
  catch { return false; }
}

type SelectedKey = { node: string; id: string } | null;
type State = {
  project: Project;
  selection: string;
  selectedObject: string | null;
  selectedJoint: JointId | null;
  objectPreview: Pose | null;
  selectedKey: SelectedKey;
  selectedCut: string | null;
  time: number;
  playing: boolean;
  looping: boolean;
  autoKey: boolean;
  tool: Tool;
  gridSnap: boolean;
  gridSize: number;
  cameraPreview: boolean;
  overrides: Record<string, Pose | undefined>;
  past: Project[];
  future: Project[];
  notification: string;
  select: (id: string) => void;
  deselect: () => void;
  selectObject: (id: string, joint?: JointId) => void;
  addObject: (kind: AssetKind) => void;
  generateEnvironment: (options: GeneratorOptions) => string[];
  updateObject: (id: string, data: Partial<Pick<SceneObject, 'name' | 'color' | 'skinColor' | 'pantsColor'>>) => void;
  previewObjectPose: (pose: Pose) => void;
  commitObjectPose: () => void;
  duplicateObject: () => void;
  deleteObject: () => void;
  setSelectedKey: (key: SelectedKey) => void;
  seek: (time: number) => void;
  tick: (delta: number) => void;
  play: (value?: boolean) => void;
  setLooping: (value: boolean) => void;
  setAutoKey: (value: boolean) => void;
  setTool: (value: Tool) => void;
  setGridSnap: (value: boolean) => void;
  setGridSize: (value: number) => void;
  setCameraPreview: (value: boolean) => void;
  setKeyEnabled: (node: string, id: string, enabled: boolean) => void;
  addCameraCut: (view: CameraCutView, snapshot?: CameraSnapshot, cameraId?: string) => void;
  selectCameraCut: (id: string) => void;
  moveCameraCut: (id: string, time: number) => void;
  recaptureCameraCut: (id: string, snapshot: CameraSnapshot) => void;
  deleteCameraCut: (id?: string) => void;
  clearCameraCuts: () => void;
  updatePose: (id: string, value: Pose) => void;
  commitKey: (id?: string) => void;
  deleteKey: () => void;
  resetKey: () => void;
  clearKeyframes: (scope: ClearKeyScope) => void;
  resetCharacterPose: () => void;
  deleteAll: () => void;
  moveKey: (node: string, id: string, time: number) => void;
  updateSetting: (data: Partial<Pick<Project, 'name' | 'fps' | 'duration' | 'interpolation'>>) => void;
  updatePalette: (id: keyof Palette, value: string) => void;
  setSkyPreset: (preset: SkyPreset) => void;
  updateSky: (data: Partial<Omit<SkySettings, 'preset'>>) => void;
  preset: (name: PresetName) => void;
  generateMotion: (options: MotionOptions) => void;
  newProject: () => void;
  loadProject: (project: Project) => void;
  undo: () => void;
  redo: () => void;
  flash: (message: string) => void;
};
const clearedEdits = { overrides: {}, objectPreview: null };
function selectionPatch(state: Pick<State, 'project' | 'overrides'>, id: string): Partial<State> {
  const node = resolveObjectNode(state.project, id);
  if (id !== 'camera' && !node) return {};
  return { selection: id, selectedObject: node?.object.id ?? null, selectedJoint: node?.joint ?? null,
    objectPreview: node ? state.overrides[id] ?? null : null, selectedKey: null, selectedCut: null };
}
function snapshot(state: State, project: Project): Partial<State> {
  return { project, past: [...state.past.slice(-49), state.project], future: [], selectedKey: null, selectedCut: null };
}
const initial = initialProject();
export const useEditor = create<State>((set, get) => ({
  project: initial, selection: initial.objects?.[0]?.id ?? 'camera', selectedObject: initial.objects?.[0]?.id ?? null,
  selectedJoint: null, objectPreview: null, selectedKey: null, selectedCut: null, time: 0,
  playing: false, looping: true, autoKey: true, tool: 'rotate', gridSnap: false, gridSize: 1, cameraPreview: false,
  overrides: {}, past: [], future: [], notification: '',
  select: id => set(s => {
    const node = resolveObjectNode(s.project, id);
    const camera = node && !node.joint && isCamera(node.object);
    return { ...selectionPatch(s, id), ...(camera && { project: { ...s.project, activeCameraId: node.object.id } }) };
  }),
  selectObject: (id, joint) => get().select(joint ? jointNodeId(id, joint) : id),
  deselect: () => set({ selection: '', selectedObject: null, selectedJoint: null,
    selectedKey: null, selectedCut: null, playing: false, ...clearedEdits }),
  addObject: kind => set(s => {
    const objects = s.project.objects ?? [];
    if (!Object.hasOwn(ASSET_CATALOG, kind)) return s;
    if (objects.length >= MAX_OBJECTS) return { notification: `Maximum ${MAX_OBJECTS} objects per scene` };
    const object = createSceneObject(kind, objects, s.gridSnap ? s.gridSize : undefined);
    const camera = isCamera(object);
    return { ...snapshot(s, { ...s.project, objects: [...objects, object], ...(camera && { activeCameraId: object.id }) }), selection: object.id,
      selectedObject: object.id, selectedJoint: null, objectPreview: null, tool: 'translate', cameraPreview: false, notification: `${object.name} added` };
  }),
  generateEnvironment: options => {
    const state = get();
    try {
      const plan = createEnvironmentPlan(options);
      const existing = options.mode === 'replace' ? [] : state.project.objects ?? [];
      if (existing.length + plan.objects.length > MAX_OBJECTS) {
        set({ notification: `Generation needs ${plan.objects.length} objects; ${MAX_OBJECTS - existing.length} slots available. Reduce the settings or replace scene objects.` });
        return [];
      }
      const objects = materializeEnvironment(plan, options.kind);
      const project = { ...state.project, objects: [...existing, ...objects] };
      set({ ...snapshot(state, project), ...selectionPatch({ ...state, project }, objects[0].id),
        playing: false, cameraPreview: false, time: 0, ...clearedEdits,
        notification: `${GENERATOR_LABELS[options.kind]} generated: ${objects.length} objects — undo to restore` });
      return objects.map(o => o.id);
    } catch (error) {
      set({ notification: error instanceof Error ? error.message : 'Unable to generate environment' });
      return [];
    }
  },
  updateObject: (id, data) => set(s => {
    const original = s.project.objects?.find(o => o.id === id);
    if (!original) return s;
    const object = { ...original, ...data };
    if (!isValidSceneObject(object, s.project.duration) || JSON.stringify(object) === JSON.stringify(original)) return s;
    return snapshot(s, { ...s.project, objects: s.project.objects!.map(o => o.id === id ? object : o) });
  }),
  updatePose: (id, value) => set(s => {
    if ((id !== 'camera' && !resolveObjectNode(s.project, id)) || !isValidObjectPose(value)) return s;
    return { overrides: { ...s.overrides, [id]: clonePose(value) }, playing: false, selectedCut: null,
      ...(s.selectedObject && s.selection === id ? { objectPreview: clonePose(value) } : {}) };
  }),
  previewObjectPose: pose => { if (get().selectedObject) get().updatePose(get().selection, pose); },
  commitObjectPose: () => {
    const s = get();
    if (s.selectedObject && s.overrides[s.selection] && s.autoKey) s.commitKey();
  },
  duplicateObject: () => set(s => {
    const objects = s.project.objects ?? [];
    const original = objects.find(o => o.id === s.selectedObject);
    if (!original) return s;
    if (objects.length >= MAX_OBJECTS) return { notification: `Maximum ${MAX_OBJECTS} objects per scene` };
    const copyKeys = (keys: Keyframe[]) => keys.map(k => ({ ...k, id: keyId(), value: clonePose(k.value) }));
    const pose = clonePose(original.pose);
    pose.position[0] = Math.min(10000, pose.position[0] + 2);
    const keyframes = original.keyframes && copyKeys(original.keyframes);
    keyframes?.forEach(k => { k.value.position[0] = Math.min(10000, k.value.position[0] + 2); });
    const object: SceneObject = { ...original, id: `obj_${keyId()}`, name: `${original.name.slice(0, 53)} copy`, pose,
      ...(keyframes && { keyframes }), ...(original.joints && { joints: Object.fromEntries(Object.entries(original.joints).map(([id, keys]) => [id, copyKeys(keys)])) }) };
    return { ...snapshot(s, { ...s.project, objects: [...objects, object] }), selection: object.id,
      selectedObject: object.id, selectedJoint: null, objectPreview: null, notification: `${object.name} added` };
  }),
  deleteObject: () => set(s => {
    const object = s.project.objects?.find(o => o.id === s.selectedObject);
    if (!object) return s;
    const overrides = Object.fromEntries(Object.entries(s.overrides).filter(([id]) => id !== object.id && !id.startsWith(`${object.id}:`)));
    // Removes camera cuts whose camera node is gone and clears target references.
    const project = cleanCameraReferences({ ...s.project, objects: s.project.objects!.filter(o => o.id !== object.id) });
    const canPreview = sceneCameras(project).length > 0 || (project.cameraCuts?.length ?? 0) > 0;
    return { ...snapshot(s, project),
      selection: 'camera', selectedObject: null, selectedJoint: null, objectPreview: null, overrides,
      ...(s.cameraPreview && !canPreview && { cameraPreview: false }),
      notification: `${object.name} deleted — undo to restore` };
  }),
  setSelectedKey: selectedKey => set(s => {
    if (!selectedKey) return { selectedKey: null };
    if (!getTrack(s.project, selectedKey.node).some(k => k.id === selectedKey.id)) return s;
    return { ...selectionPatch(s, selectedKey.node), selectedKey };
  }),
  seek: time => set(s => Number.isFinite(time) ? { time: Math.max(0, Math.min(s.project.duration, time)), playing: false, selectedKey: null, selectedCut: null, ...clearedEdits } : s),
  tick: delta => set(s => {
    if (!s.playing || !Number.isFinite(delta)) return s;
    const next = s.time + Math.max(0, delta);
    if (next > s.project.duration) return s.looping
      ? { time: next % s.project.duration }
      : { time: s.project.duration, playing: false };
    return { time: next };
  }),
  play: playing => set(s => {
    const next = playing ?? !s.playing;
    return { playing: next, selectedCut: null, time: s.time >= s.project.duration ? 0 : s.time, ...clearedEdits };
  }),
  setLooping: looping => set({ looping }), setAutoKey: autoKey => set({ autoKey }),
  setGridSnap: gridSnap => set({ gridSnap }),
  setGridSize: gridSize => { if ((GRID_SIZES as readonly number[]).includes(gridSize)) set({ gridSize }); },
  setTool: tool => set({ tool }),
  setCameraPreview: cameraPreview => set(s => !cameraPreview || hasCameraSequence(s.project)
    ? { cameraPreview } : { notification: 'Add a camera or camera cut before using the camera view' }),
  setKeyEnabled: (node, id, enabled) => set(s => {
    const key = getTrack(s.project, node).find(k => k.id === id);
    if (!key || (key.enabled !== false) === enabled) return s;
    const keys = getTrack(s.project, node).map(k => k.id === id ? { ...k, enabled } : k);
    return { ...snapshot(s, replaceTrack(s.project, node, keys)), selectedKey: { node, id },
      notification: `Camera keyframe at ${key.time.toFixed(2)}s ${enabled ? 'activated' : 'deactivated'}` };
  }),
  addCameraCut: (view, captured, cameraId) => set(s => {
    const nodeCamera = view === 'node'
      ? s.project.objects?.find(o => o.id === (cameraId ?? activeCameraNodeId(s.project)) && isCamera(o)) : undefined;
    if (view === 'node' && !nodeCamera) return { notification: 'Add a camera object before making a camera node cut' };
    if (view !== 'shot' && view !== 'node' && (!captured || !isValidObjectPose(captured.pose))) return { notification: 'Capture a valid camera view first' };
    const time = Math.min(s.project.duration, roundFrame(s.time, s.project.fps));
    const cuts = [...s.project.cameraCuts ?? []];
    const index = cuts.findIndex(c => Math.abs(c.time - time) < 0.5 / s.project.fps);
    if (index < 0 && cuts.length >= 500) return { notification: 'Maximum 500 camera cuts' };
    const cut: CameraCut = { id: index >= 0 ? cuts[index].id : `cut_${keyId()}`, time, view,
      ...(nodeCamera && { cameraId: nodeCamera.id }),
      ...(view !== 'shot' && view !== 'node' && captured ? { pose: clonePose(captured.pose), fov: captured.fov } : {}) };
    if (!isValidCameraCuts([cut], s.project.duration)) return { notification: 'Choose a valid camera view before adding a cut' };
    if (index >= 0) cuts[index] = cut; else cuts.push(cut);
    cuts.sort((a,b) => a.time - b.time);
    const changed = JSON.stringify(cuts) !== JSON.stringify(s.project.cameraCuts ?? []);
    const label = nodeCamera?.name ?? CAMERA_CUT_LABELS[view];
    return { ...(changed ? snapshot(s, { ...s.project, cameraCuts: cuts }) : {}), selectedCut: cut.id, selectedKey: null,
      cameraPreview: true, notification: `${label} cut at ${time.toFixed(2)}s` };
  }),
  selectCameraCut: id => set(s => {
    const cut = s.project.cameraCuts?.find(c => c.id === id);
    return cut ? { selectedCut: id, selectedKey: null, time: cut.time, playing: false, cameraPreview: true, ...clearedEdits } : s;
  }),
  moveCameraCut: (id, time) => set(s => {
    if (!Number.isFinite(time)) return s;
    const cut = s.project.cameraCuts?.find(c => c.id === id);
    if (!cut) return s;
    const next = Math.min(s.project.duration, roundFrame(Math.max(0, Math.min(s.project.duration, time)), s.project.fps));
    if (next === cut.time) return s;
    const cuts = s.project.cameraCuts!.filter(c => c.id !== id && Math.abs(c.time - next) >= 0.5 / s.project.fps);
    cuts.push({ ...cut, time: next }); cuts.sort((a,b) => a.time - b.time);
    return { ...snapshot(s, { ...s.project, cameraCuts: cuts }), selectedCut: id, time: next, playing: false, cameraPreview: true, ...clearedEdits };
  }),
  recaptureCameraCut: (id, captured) => set(s => {
    if (!captured || !isValidObjectPose(captured.pose)) return s;
    const cut = s.project.cameraCuts?.find(c => c.id === id);
    if (!cut) return s;
    const next: CameraCut = { ...cut, view: 'current', pose: clonePose(captured.pose), fov: captured.fov };
    if (!isValidCameraCuts([next], s.project.duration)) return s;
    if (JSON.stringify(next) === JSON.stringify(cut)) return s;
    return { ...snapshot(s, { ...s.project, cameraCuts: s.project.cameraCuts!.map(c => c.id === id ? next : c) }), selectedCut: id,
      notification: 'Cut updated from the current view — undo to restore' };
  }),
  deleteCameraCut: id => set(s => {
    const target = id ?? s.selectedCut;
    if (!s.project.cameraCuts?.some(c => c.id === target)) return s;
    return { ...snapshot(s, { ...s.project, cameraCuts: s.project.cameraCuts.filter(c => c.id !== target) }), selectedCut: null,
      notification: 'Camera cut deleted — undo to restore' };
  }),
  clearCameraCuts: () => set(s => s.project.cameraCuts?.length ? {
    ...snapshot(s, { ...s.project, cameraCuts: [] }), selectedCut: null, notification: 'Camera cuts cleared — undo to restore',
  } : s),
  commitKey: id => set(s => {
    const node = id ?? s.selection;
    if (node !== 'camera' && !resolveObjectNode(s.project, node)) return s;
    const value = clonePose(s.overrides[node] ?? sampleNodePose(s.project, node, s.time));
    if (!isValidObjectPose(value)) return s;
    const result = writePoseKey(s.project, node, value, s.time);
    if (!result) return { notification: 'Maximum 5000 keyframes per track' };
    const edits = { overrides: { ...s.overrides, [node]: undefined }, ...(node === s.selection ? { objectPreview: null } : {}) };
    return { ...(result.project !== s.project ? snapshot(s, result.project) : {}), selectedKey: { node, id: result.frame.id }, selectedCut: null, ...edits };
  }),
  deleteKey: () => set(s => {
    if (!s.selectedKey) return s;
    const { node, id } = s.selectedKey;
    if (!getTrack(s.project, node).some(k => k.id === id)) return s;
    return { ...snapshot(s, replaceTrack(s.project, node, getTrack(s.project, node).filter(k => k.id !== id))), ...clearedEdits };
  }),
  resetKey: () => set(s => {
    if (!s.selectedKey) return s;
    const { node, id } = s.selectedKey;
    const original = getTrack(s.project, node).find(k => k.id === id);
    if (!original) return s;
    const value = nodeDefaultPose(s.project, node);
    const changed = JSON.stringify(value) !== JSON.stringify(original.value);
    const keys = getTrack(s.project, node).map(k => k.id === id ? { ...k, value } : k);
    return { ...(changed ? snapshot(s, replaceTrack(s.project, node, keys)) : {}), selectedKey: s.selectedKey,
      time: original.time, playing: false, ...clearedEdits, notification: 'Keyframe reset to base transform — undo to restore' };
  }),
  clearKeyframes: scope => set(s => {
    const owner = s.project.objects?.find(o => o.id === s.selectedObject && isCharacter(o));
    if (scope === 'character' && !owner) return s;
    const ids = scope === 'project' ? timelineTracks(s.project).map(t => t.id)
      : scope === 'character' ? [owner!.id, ...JOINT_IDS.map(j => jointNodeId(owner!.id, j))] : [s.selection];
    const targets = new Set(ids);
    const count = ids.reduce((n, id) => n + getTrack(s.project, id).length, 0) + (scope === 'project' ? s.project.cameraCuts?.length ?? 0 : 0);
    let project = scope === 'project' && s.project.cameraCuts?.length ? { ...s.project, cameraCuts: [] } : s.project;
    for (const id of ids) if (getTrack(project, id).length) project = replaceTrack(project, id, []);
    const overrides = Object.fromEntries(Object.entries(s.overrides).filter(([id]) => !targets.has(id)));
    return { ...(project !== s.project ? snapshot(s, project) : {}), overrides, selectedKey: null,
      objectPreview: targets.has(s.selection) ? null : s.objectPreview, selectedCut: null, playing: false,
      ...(scope === 'project' ? { time: 0 } : {}),
      notification: count ? `Cleared ${count} keyframes (${scope}) — undo to restore` : 'No keyframes to clear' };
  }),
  resetCharacterPose: () => set(s => {
    const character = s.project.objects?.find(o => o.id === s.selectedObject && isCharacter(o));
    if (!character) return s;
    const ids = JOINT_IDS.map(joint => jointNodeId(character.id, joint));
    if (!s.autoKey) {
      const overrides = { ...s.overrides };
      for (const id of ids) overrides[id] = neutralPose();
      return { overrides, selectedKey: null, selectedCut: null, playing: false,
        objectPreview: s.selectedJoint ? overrides[s.selection] : s.objectPreview,
        notification: 'Neutral pose preview — use Key pose to record it' };
    }
    let project = s.project;
    for (const id of ids) {
      const result = writePoseKey(project, id, neutralPose(), s.time);
      if (!result) return { notification: 'Maximum 5000 keyframes per track — pose unchanged' };
      project = result.project;
    }
    const overrides = Object.fromEntries(Object.entries(s.overrides).filter(([id]) => !ids.includes(id)));
    return { ...(project !== s.project ? snapshot(s, project) : {}), overrides, selectedKey: null, selectedCut: null, playing: false,
      objectPreview: s.selectedJoint ? null : s.objectPreview, notification: 'Character pose reset at the playhead — undo to restore' };
  }),
  deleteAll: () => set(s => {
    const hasContent = (s.project.objects?.length ?? 0) > 0 || BONE_IDS.some(id => s.project.tracks[id].length > 0) || !!s.project.cameraCuts?.length;
    const project: Project = { ...s.project, sceneVersion: 2, objects: [], cameraCuts: [],
      tracks: Object.fromEntries(BONE_IDS.map(id => [id, [] as Keyframe[]])) as Tracks };
    return { ...(hasContent ? snapshot(s, project) : {}), selection: 'camera', selectedObject: null, selectedJoint: null,
      selectedKey: null, selectedCut: null, time: 0, playing: false, cameraPreview: false, ...clearedEdits,
      notification: hasContent ? 'All objects and keyframes deleted — undo to restore' : 'Scene is already empty' };
  }),
  moveKey: (node, id, time) => set(s => {
    if (!Number.isFinite(time)) return s;
    const original = getTrack(s.project, node).find(k => k.id === id);
    if (!original) return s;
    const newTime = Math.min(s.project.duration, roundFrame(Math.max(0, Math.min(s.project.duration, time)), s.project.fps));
    if (newTime === original.time) return s;
    const keys = getTrack(s.project, node).filter(k => k.id !== id && Math.abs(k.time - newTime) >= 0.5 / s.project.fps);
    keys.push({ ...original, time: newTime }); keys.sort((a, b) => a.time - b.time);
    return { ...snapshot(s, replaceTrack(s.project, node, keys)), ...selectionPatch(s, node), selectedKey: { node, id }, time: newTime, playing: false, ...clearedEdits };
  }),
  updateSetting: data => set(s => {
    const duration = data.duration ?? s.project.duration;
    const trim = (keys: Keyframe[]) => keys.filter(k => k.time <= duration + 0.00001);
    const tracks = data.duration === undefined ? s.project.tracks : Object.fromEntries(BONE_IDS.map(id => [id, trim(s.project.tracks[id])])) as Tracks;
    const objects = data.duration === undefined ? s.project.objects : s.project.objects?.map(o => ({ ...o,
      ...(o.keyframes && { keyframes: trim(o.keyframes) }), ...(o.joints && { joints: Object.fromEntries(Object.entries(o.joints).map(([id, keys]) => [id, trim(keys)])) }) }));
    const cameraCuts = s.project.cameraCuts?.filter(c => c.time <= duration);
    return { ...snapshot(s, { ...s.project, ...data, tracks, objects, ...(cameraCuts && { cameraCuts }) }), time: Math.min(s.time, duration), ...clearedEdits };
  }),
  updatePalette: (id, color) => set(s => snapshot(s, { ...s.project, palette: { ...s.project.palette, [id]: color } })),
  setSkyPreset: preset => set(s => snapshot(s, { ...s.project, sky: preset === 'custom'
    ? { ...(s.project.sky ?? SKY_PRESETS.custom), preset: 'custom' } : { ...SKY_PRESETS[preset] } })),
  updateSky: data => set(s => {
    const sky: SkySettings = { ...(s.project.sky ?? SKY_PRESETS.custom), ...data, preset: 'custom' };
    return isValidSky(sky) ? snapshot(s, { ...s.project, sky }) : s;
  }),
  preset: name => set(s => {
    if (name === 'cinematic') {
      const camera = s.project.objects?.find(o => o.id === s.selectedObject && isCamera(o))
        ?? s.project.objects?.find(o => o.id === activeCameraNodeId(s.project) && isCamera(o))
        ?? sceneCameras(s.project)[0];
      if (!camera) return { notification: 'Add a camera object before loading the camera sequence preset' };
      const project = { ...createPreset(name, s.project, camera.id), activeCameraId: camera.id };
      return { ...snapshot(s, project), ...selectionPatch({ ...s, project }, camera.id), time: 0, playing: false, ...clearedEdits,
        cameraPreview: true, notification: `Camera sequence preset loaded for ${camera.name}` };
    }
    const target = s.project.objects?.find(o => o.id === s.selectedObject && isCharacter(o));
    if (!target) return { notification: 'Select a male or female character to apply a motion preset' };
    const project = createPreset(name, s.project, target.id);
    return { ...snapshot(s, project), ...selectionPatch({ ...s, project }, target.id), time: 0, playing: false, ...clearedEdits,
      cameraPreview: false, notification: `${name[0].toUpperCase() + name.slice(1)} preset loaded for ${target.name}` };
  }),
  generateMotion: options => set(s => {
    const target = s.project.objects?.find(object => object.id === s.selectedObject && isCharacter(object));
    if (!target) return { notification: 'Select a character before generating motion' };
    const adding = options.mode === 'add';
    const start = adding ? motionEndTime(target) : 0;
    const end = start + motionClipLength(options);
    if (end > 600) return { notification: `Not enough timeline space: this clip would end at ${end.toFixed(1)} s (limit 600 s)` };
    const project = createGeneratedMotion(s.project, target.id, options);
    return { ...snapshot(s, project), ...selectionPatch({ ...s, project }, target.id), time: start, playing: false, ...clearedEdits,
      cameraPreview: false, notification: `${options.action[0].toUpperCase() + options.action.slice(1)} motion ${adding ? 'added after' : 'generated for'} ${target.name}` };
  }),
  newProject: () => set(s => {
    const project = createProject();
    return { ...snapshot(s, project), ...selectionPatch({ ...s, project }, project.objects![0].id), time: 0, playing: false, ...clearedEdits, cameraPreview: false, notification: 'New project created' };
  }),
  loadProject: source => set(s => {
    const project = sortProjectTracks(source);
    return { ...snapshot(s, project), ...selectionPatch({ ...s, project }, project.objects?.[0]?.id ?? 'camera'), time: 0, playing: false, ...clearedEdits, cameraPreview: false, notification: 'Project imported' };
  }),
  undo: () => set(s => {
    if (!s.past.length) return s;
    const project = s.past[s.past.length - 1];
    const id = resolveObjectNode(project, s.selection) ? s.selection : 'camera';
    return { project, ...selectionPatch({ ...s, project }, id), past: s.past.slice(0, -1), future: [s.project, ...s.future].slice(0, 50), ...clearedEdits, time: Math.min(s.time, project.duration), playing: false };
  }),
  redo: () => set(s => {
    if (!s.future.length) return s;
    const project = s.future[0];
    const id = resolveObjectNode(project, s.selection) ? s.selection : 'camera';
    return { project, ...selectionPatch({ ...s, project }, id), past: [...s.past, s.project].slice(-50), future: s.future.slice(1), ...clearedEdits, time: Math.min(s.time, project.duration), playing: false };
  }),
  flash: notification => set({ notification }),
}));

export function currentPose(node?: string): Pose {
  const s = useEditor.getState();
  const id = node ?? s.selection;
  return clonePose(s.overrides[id] ?? sampleNodePose(s.project, id, s.time));
}
