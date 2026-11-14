import { isValidObjectPose } from './assets';
import type { CameraCut, CameraCutView, Pose } from './types';

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
