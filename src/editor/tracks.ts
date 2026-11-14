import { BONE_IDS, BONE_LABELS, JOINT_IDS, clonePose, keyId, neutralPose, type Keyframe, type Project, type SceneObject } from './types';
import { isCharacter, jointNodeId, resolveObjectNode } from './characters';
import { createSceneObject } from './assets';
import { cameraNodeId, cleanCameraReferences } from './cameras';
import { CAMERA_CUT_LABELS } from './cameraCuts';
import { sampleObjectPose, sampleTrack } from './interpolation';

export function getTrack(project: Project, id: string): Keyframe[] {
  id=cameraNodeId(project,id);
  const node = resolveObjectNode(project, cameraNodeId(project,id));
  return node ? (node.joint ? node.object.joints?.[node.joint] : node.object.keyframes) ?? [] : [];
}
export function replaceTrack(project: Project, id: string, keys: Keyframe[]): Project {
  id=cameraNodeId(project,id);
  const node = resolveObjectNode(project, cameraNodeId(project,id));
  if (!node) return project;
  return { ...project, objects: project.objects?.map(o => o.id !== node.object.id ? o : node.joint
    ? { ...o, joints: { ...o.joints, [node.joint]: keys } } : { ...o, keyframes: keys }) };
}
export function nodeDefaultPose(project: Project, id: string) {
  const node = resolveObjectNode(project, cameraNodeId(project,id));
  return node && !node.joint ? clonePose(node.object.pose) : neutralPose(id === 'camera' ? 'camera' : undefined);
}
export function sampleNodePose(project: Project, id: string, time: number) {
  const node = resolveObjectNode(project, cameraNodeId(project,id));
  if (node && !node.joint) return sampleObjectPose(node.object, time, project.interpolation);
  return sampleTrack(getTrack(project, id), time, project.interpolation, id === 'camera' ? 'camera' : 'root');
}
export function timelineTracks(project: Project) {
  return [
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
  let cuts=project.cameraCuts;
  let active=project.activeCameraId;
  if(project.cameraVersion!==1){
    const camera=createSceneObject('camera',objects);
    camera.name='Shot Camera';camera.keyframes=project.tracks.camera;
    objects=[...objects,camera];active=camera.id;
    cuts=cuts?.map(cut=>{
      if(cut.view==='node')return cut;
      if(cut.view==='shot')return {id:cut.id,time:cut.time,view:'node' as const,cameraId:camera.id};
      const node=createSceneObject('camera',objects);node.name=`${CAMERA_CUT_LABELS[cut.view]} Camera`;
      node.pose=clonePose(cut.pose!);node.keyframes=[{id:keyId(),time:0,value:clonePose(node.pose)}];node.camera={...node.camera!,fov:cut.fov!};objects.push(node);
      return {id:cut.id,time:cut.time,view:'node' as const,cameraId:node.id};
    });
  }
  return cleanCameraReferences({
    ...project, sceneVersion: 2, cameraVersion:1,activeCameraId:active,
    ...(cuts && {cameraCuts:[...cuts].sort((a,b)=>a.time-b.time)}),
    // Keep the legacy file shape for importing v1 projects; the camera is the only global track.
    tracks: Object.fromEntries(BONE_IDS.map(id => [id, [] as Keyframe[]])) as Project['tracks'],
    objects: objects.map(o => ({ ...o, pose: clonePose(o.pose), ...(o.keyframes && { keyframes: sortKeys(o.keyframes) }),
      ...(o.joints && { joints: Object.fromEntries(Object.entries(o.joints).map(([joint, keys]) => [joint, sortKeys(keys)])) }) })),
  });
}
