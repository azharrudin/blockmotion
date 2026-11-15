import { isValidObjectPose } from './assets';
import { sceneCameras } from './cameras';
import type { CameraCut, CameraCutView, Pose, Project, SceneObject } from './types';

export type CameraSnapshot = { pose: Pose; fov: number };
export const CAMERA_CUT_LABELS: Record<CameraCutView, string> = {
  node: 'Camera node', current: 'Current view', shot: 'Shot Camera', perspective: 'Perspective',
  front: 'Front', back: 'Back', left: 'Left', right: 'Right', top: 'Top',
};
export function isValidCameraCuts(value: unknown, duration: number): value is CameraCut[] {
  if (!Array.isArray(value) || value.length > 500) return false;
  const ids = new Set<string>(), times = new Set<number>();
  return value.every(cut => {
    if (typeof cut !== 'object' || cut === null || typeof cut.id !== 'string' || !/^cut_[a-zA-Z0-9_-]{1,100}$/.test(cut.id) || ids.has(cut.id)) return false;
    if (typeof cut.time !== 'number' || !Number.isFinite(cut.time) || cut.time < 0 || cut.time > duration || times.has(cut.time)) return false;
    if (typeof cut.view !== 'string' || !Object.hasOwn(CAMERA_CUT_LABELS, cut.view)) return false;
    if (cut.view === 'node' && (typeof cut.cameraId !== 'string' || !/^obj_[a-zA-Z0-9_-]{1,100}$/.test(cut.cameraId))) return false;
    if (cut.view !== 'shot' && cut.view !== 'node' && (!isValidObjectPose(cut.pose) || typeof cut.fov !== 'number' || !Number.isFinite(cut.fov) || cut.fov < 12 || cut.fov > 120)) return false;
    ids.add(cut.id); times.add(cut.time); return true;
  });
}
/** A cut takes effect on its exact frame; before the first cut use the animated Shot Camera. */
export function activeCameraCut(cuts: CameraCut[] | undefined, time: number): CameraCut | null {
  if (!cuts?.length || !Number.isFinite(time)) return null;
  let low = 0, high = cuts.length - 1, index = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (cuts[middle].time <= time) { index = middle; low = middle + 1; } else high = middle - 1;
  }
  return index < 0 ? null : cuts[index];
}

export function cameraCutLabel(project: import('./types').Project,cut: CameraCut): string {
  return cut.view==='node' ? project.objects?.find(o=>o.kind==='camera'&&o.id===cut.cameraId)?.name??'Missing camera' : CAMERA_CUT_LABELS[cut.view];
}

export type ResolvedCamera =
  | { kind: 'node'; camera: SceneObject; time: number }
  | { kind: 'cut'; cut: CameraCut; time: number };

/**
 * Resolve the camera that drives the viewport at `time`.
 * Every active keyframe on a camera track is a switch point. Camera nodes and
 * view cuts compete on the same timeline; on the same frame the camera node wins.
 * Camera order breaks ties, so the first camera in the scene owns frame 0.
 */
export function resolveCameraView(project: Project, time: number): ResolvedCamera | null {
  if (!Number.isFinite(time)) return null;
  let best: { camera: SceneObject; time: number; order: number } | null = null;
  sceneCameras(project).forEach((camera, order) => {
    let latest = -Infinity;
    for (const key of camera.keyframes ?? []) if (key.enabled !== false && key.time <= time && key.time > latest) latest = key.time;
    if (latest === -Infinity) return;
    if (!best || latest > best.time || (latest === best.time && order < best.order)) best = { camera, time: latest, order };
  });
  const cut = activeCameraCut(project.cameraCuts, time);
  const node = best as { camera: SceneObject; time: number; order: number } | null;
  if (node && (!cut || node.time >= cut.time)) return { kind: 'node', camera: node.camera, time: node.time };
  return cut ? { kind: 'cut', cut, time: cut.time } : null;
}
