import { clonePose, neutralPose, type BoneId, type Interpolation, type Keyframe, type Pose, type Tracks, type Vec3, type SceneObject } from './types';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const angleMix = (a: number, b: number, t: number) => {
  const shortest = (((b - a) % 360 + 540) % 360) - 180;
  return a + shortest * t;
};

export function sampleTrack(keys: Keyframe[], time: number, interpolation: Interpolation, node: BoneId): Pose {
  if (!keys || keys.length === 0) return neutralPose(node);
  if (keys.length === 1 || time <= keys[0].time) return clonePose(keys[0].value);
  if (time >= keys[keys.length - 1].time) return clonePose(keys[keys.length - 1].value);
  const next = keys.findIndex(k => k.time >= time);
  const a = keys[next - 1];
  const b = keys[next];
  if (time === b.time) return clonePose(b.value);
  const span = Math.max(0.000001, b.time - a.time);
  let t = clamp01((time - a.time) / span);
  if (interpolation === 'step') t = 0;
  if (interpolation === 'smooth') t = t * t * (3 - 2 * t);
  return {
    position: a.value.position.map((v, i) => mix(v, b.value.position[i], t)) as Vec3,
    rotation: a.value.rotation.map((v, i) => angleMix(v, b.value.rotation[i], t)) as Vec3,
    scale: a.value.scale.map((v, i) => mix(v, b.value.scale[i], t)) as Vec3,
  };
}

export function samplePose(tracks: Tracks, node: BoneId, time: number, interpolation: Interpolation): Pose {
  return sampleTrack(tracks[node], time, interpolation, node);
}

export function sampleObjectPose(object: SceneObject, time: number, interpolation: Interpolation): Pose {
  return object.keyframes?.length ? sampleTrack(object.keyframes, time, interpolation, 'root') : clonePose(object.pose);
}
