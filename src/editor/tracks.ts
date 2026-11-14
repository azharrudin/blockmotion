import { BONE_IDS, BONE_LABELS, JOINT_IDS, clonePose, keyId, neutralPose, type Keyframe, type Project, type SceneObject } from './types';
import { isCharacter, jointNodeId, resolveObjectNode } from './characters';
import { createSceneObject } from './assets';
import { sampleObjectPose, sampleTrack } from './interpolation';

export function getTrack(project: Project, id: string): Keyframe[] {
  if (id === 'camera') return project.tracks.camera;
  const node = resolveObjectNode(project, id);
  return node ? (node.joint ? node.object.joints?.[node.joint] : node.object.keyframes) ?? [] : [];
}
export function replaceTrack(project: Project, id: string, keys: Keyframe[]): Project {
  if (id === 'camera') return { ...project, tracks: { ...project.tracks, camera: keys } };
  const node = resolveObjectNode(project, id);
  if (!node) return project;
  return { ...project, objects: project.objects?.map(o => o.id !== node.object.id ? o : node.joint
    ? { ...o, joints: { ...o.joints, [node.joint]: keys } } : { ...o, keyframes: keys }) };
}
export function nodeDefaultPose(project: Project, id: string) {
  const node = resolveObjectNode(project, id);
  return node && !node.joint ? clonePose(node.object.pose) : neutralPose(id === 'camera' ? 'camera' : undefined);
}
export function sampleNodePose(project: Project, id: string, time: number) {
  const node = resolveObjectNode(project, id);
  if (node && !node.joint) return sampleObjectPose(node.object, time, project.interpolation);
  return sampleTrack(getTrack(project, id), time, project.interpolation, id === 'camera' ? 'camera' : 'root');
}
export function timelineTracks(project: Project) {
  return [
    { id: 'camera', label: 'Shot Camera', title: 'Shot Camera', keys: project.tracks.camera, object: false, joint: false },
    ...(project.objects ?? []).flatMap(o => [
      { id: o.id, label: o.name, title: o.name, keys: o.keyframes ?? [], object: true, joint: false },
      ...(isCharacter(o) ? JOINT_IDS.map(joint => ({ id: jointNodeId(o.id, joint), label: BONE_LABELS[joint],
        title: `${o.name} / ${BONE_LABELS[joint]}`, keys: o.joints?.[joint] ?? [], object: true, joint: true })) : []),
    ]),
  ];
}
const sortKeys = (keys: Keyframe[]) => keys.map(k => ({ ...k, value: clonePose(k.value) })).sort((a, b) => a.time - b.time);

/** Upgrade the former fixed rig once. sceneVersion prevents deleted characters reappearing. */
export function sortProjectTracks(project: Project): Project {
  let objects = project.objects ?? [];
  if (project.sceneVersion !== 2) {
    let id = 'obj_legacy_character';
    while (objects.some(o => o.id === id)) id = `obj_legacy_${keyId()}`;
    const legacy: SceneObject = {
      ...createSceneObject('r6Male', objects), id, name: 'Blocky R6 Male',
      color: project.palette.shirt, skinColor: project.palette.skin, pantsColor: project.palette.pants,
      pose: neutralPose(), keyframes: project.tracks.root,
      joints: Object.fromEntries(JOINT_IDS.map(joint => [joint, project.tracks[joint]])),
    };
    objects = [legacy, ...objects];
  }
  return {
    ...project, sceneVersion: 2,
    // Keep the legacy file shape for importing v1 projects; the camera is the only global track.
    tracks: Object.fromEntries(BONE_IDS.map(id => [id, id === 'camera' ? sortKeys(project.tracks.camera) : []])) as Project['tracks'],
    objects: objects.map(o => ({ ...o, pose: clonePose(o.pose), ...(o.keyframes && { keyframes: sortKeys(o.keyframes) }),
      ...(o.joints && { joints: Object.fromEntries(Object.entries(o.joints).map(([joint, keys]) => [joint, sortKeys(keys)])) }) })),
  };
}
