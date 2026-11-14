import { BONE_IDS, JOINT_IDS, clonePose, keyId, neutralPose, type BoneId, type Palette, type Pose, type Project, type Tracks } from './types';

import { createSceneObject } from './assets';
import { isCharacter } from './characters';
import { sampleObjectPose } from './interpolation';

const COLORS: Palette = { skin: '#f3c58b', shirt: '#427fe4', pants: '#343d53', background: '#141b2b' };
function emptyTracks(): Tracks {
  return Object.fromEntries(BONE_IDS.map(id => [id, [{ id: keyId(), time: 0, value: neutralPose(id) }]])) as Tracks;
}
function key(tracks: Tracks, bone: BoneId, time: number, modify: (pose: Pose) => void) {
  const pose = neutralPose(bone);
  modify(pose);
  tracks[bone].push({ id: keyId(), time, value: clonePose(pose) });
  tracks[bone].sort((a, b) => a.time - b.time);
}
export function createProject(name = 'Untitled animation'): Project {
  const character = createSceneObject('r6Male', []);
  character.pose.position = [0, 0, 0];
  character.keyframes = [{ id: keyId(), time: 0, value: clonePose(character.pose) }];
  const tracks = emptyTracks();
  for (const id of BONE_IDS) if (id !== 'camera') tracks[id] = [];
  return { version: 1, sceneVersion: 2, name, duration: 4, fps: 30, interpolation: 'smooth', tracks, palette: { ...COLORS }, objects: [character] };
}
export type PresetName = 'wave' | 'walk' | 'jump' | 'idle' | 'cinematic';
export function createPreset(name: PresetName, old: Project, targetId?: string): Project {
  const tracks = emptyTracks();
  let duration = 4;
  switch (name) {
    case 'wave': {
      for (const [time, rx, rz] of [[0.35, 0, -160], [0.65, 22, -154], [0.95, -22, -154], [1.25, 22, -154], [1.55, -22, -154], [1.9, 0, -160], [2.3, 0, 0]] as const) {
        key(tracks, 'leftArm', time, p => { p.rotation[0] = rx; p.rotation[2] = rz; });
      }
      key(tracks, 'head', 0.6, p => { p.rotation[2] = -12; });
      key(tracks, 'head', 1.3, p => { p.rotation[2] = 10; });
      key(tracks, 'head', 2.3, () => {});
      break;
    }
    case 'walk': {
      duration = 2;
      for (let i = 1; i <= 8; i++) {
        const t = i * 0.25;
        const swing = Math.sin((t / 1) * Math.PI * 2) * 32;
        key(tracks, 'leftLeg', t, p => { p.rotation[0] = swing; });
        key(tracks, 'rightLeg', t, p => { p.rotation[0] = -swing; });
        key(tracks, 'leftArm', t, p => { p.rotation[0] = -swing * 0.8; });
        key(tracks, 'rightArm', t, p => { p.rotation[0] = swing * 0.8; });
        key(tracks, 'root', t, p => { p.position[1] = Math.abs(Math.sin(t * Math.PI * 4)) * 0.09; });
      }
      break;
    }
    case 'jump': {
      duration = 2.5;
      key(tracks, 'root', 0.3, p => { p.position[1] = -0.12; });
      key(tracks, 'root', 0.9, p => { p.position[1] = 1.35; });
      key(tracks, 'root', 1.4, p => { p.position[1] = 0.72; });
      key(tracks, 'root', 1.8, () => {});
      for (const id of ['leftArm', 'rightArm'] as const) {
        key(tracks, id, 0.3, p => { p.rotation[0] = 20; });
        key(tracks, id, 0.9, p => { p.rotation[0] = -140; });
        key(tracks, id, 1.6, p => { p.rotation[0] = -60; });
        key(tracks, id, 1.8, () => {});
      }
      break;
    }
    case 'idle': {
      duration = 3;
      key(tracks, 'root', 0.75, p => { p.position[1] = 0.035; });
      key(tracks, 'root', 1.5, () => {});
      key(tracks, 'root', 2.25, p => { p.position[1] = 0.035; });
      key(tracks, 'root', 3, () => {});
      key(tracks, 'head', 0.75, p => { p.rotation[1] = -8; });
      key(tracks, 'head', 2.25, p => { p.rotation[1] = 8; });
      key(tracks, 'head', 3, () => {});
      break;
    }
    case 'cinematic': {
      duration = 5;
      key(tracks, 'camera', 1.8, p => { p.position = [2.9, 2.9, 5.1]; p.rotation = [-9, 25, 0]; });
      key(tracks, 'camera', 3.5, p => { p.position = [-3.3, 3.6, 5.3]; p.rotation = [-14, -32, 0]; });
      key(tracks, 'camera', 5, p => { p.position = [-4.9, 3.3, 7]; p.rotation = [-10, -35, 0]; });
      for (const t of [1, 2, 3.5, 5]) key(tracks, 'root', t, p => { p.rotation[1] = t * 18; });
      key(tracks, 'rightArm', 2.5, p => { p.rotation[2] = 110; });
      key(tracks, 'rightArm', 5, () => {});
    }
  }
  const target = old.objects?.find(o => o.id === targetId && isCharacter(o));
  if (name !== 'cinematic' && !target) return old;
  const objects = (old.objects ?? []).map(object => {
    if (!target || object.id !== target.id || name === 'cinematic') return object;
    const base = sampleObjectPose(object, 0, old.interpolation);
    return { ...object, keyframes: tracks.root.map(k => ({ ...k, value: {
      position: base.position.map((v, i) => v + k.value.position[i]) as Pose['position'],
      rotation: base.rotation.map((v, i) => v + k.value.rotation[i]) as Pose['rotation'],
      scale: base.scale.map((v, i) => v * k.value.scale[i]) as Pose['scale'],
    } })), joints: Object.fromEntries(JOINT_IDS.map(joint => [joint, tracks[joint]])) };
  });
  const globalTracks = name === 'cinematic' ? { ...old.tracks, camera: tracks.camera } : old.tracks;
  // Other characters, props, and the camera keep their full animation duration.
  duration = Math.min(600, objects.reduce((end, object) =>
    [...(object.keyframes ?? []), ...Object.values(object.joints ?? {}).flat()].reduce((latest, k) => Math.max(latest, k.time), end), duration));
  duration = globalTracks.camera.reduce((end, k) => Math.max(end, k.time), duration);
  return { ...old, duration, tracks: globalTracks, objects };
}
