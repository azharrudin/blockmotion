import { clonePose, keyId, roundFrame, type Pose, type Project } from './types';
import { getTrack, nodeDefaultPose, replaceTrack } from './tracks';

/** Return undefined when a track is full. Every call is immutable. */
export function writePoseKey(project: Project, node: string, value: Pose, playhead: number) {
  const time = Math.min(project.duration, roundFrame(playhead, project.fps));
  const keys = [...getTrack(project, node)];
  if (!keys.length && time > 0) keys.push({ id: keyId(), time: 0, value: nodeDefaultPose(project, node) });
  const index = keys.findIndex(k => Math.abs(k.time - time) < 0.5 / project.fps);
  if (index < 0 && keys.length >= 5000) return undefined;
  const frame = { id: index >= 0 ? keys[index].id : keyId(), time, value: clonePose(value) };
  if (index >= 0 && JSON.stringify(keys[index]) === JSON.stringify(frame)) return { project, frame };
  if (index >= 0) keys[index] = frame; else keys.push(frame);
  keys.sort((a, b) => a.time - b.time);
  return { project: replaceTrack(project, node, keys), frame };
}
