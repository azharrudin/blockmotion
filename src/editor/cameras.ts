import { clonePose, neutralPose, type CameraSettings, type Project, type SceneObject } from './types';

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = { projection:'perspective',fov:48,orthoSize:8,targetId:null,followOffset:[4.8,2,7.2],lookAtTarget:true };
export function isCamera(object: Pick<SceneObject,'kind'>): boolean { return object.kind==='camera'; }
export function cameraSettings(object: SceneObject): CameraSettings { return {...DEFAULT_CAMERA_SETTINGS,...object.camera}; }
export function sceneCameras(project: Pick<Project,'objects'>): SceneObject[] { return project.objects?.filter(isCamera)??[]; }
export function cameraNodeId(project: Project,id: string): string {
  return id==='camera' ? (sceneCameras(project).find(o=>o.id===project.activeCameraId)?.id??sceneCameras(project)[0]?.id??'scene') : id;
}
export function activeCameraNodeId(project: Project): string | null {
  const cameras=sceneCameras(project);return cameras.find(o=>o.id===project.activeCameraId)?.id??cameras[0]?.id??null;
}
export function isValidCameraSettings(value: unknown): value is CameraSettings {
  if(typeof value!=='object'||value===null)return false;
  const c=value as Record<string,unknown>;
  return ['perspective','orthographic'].includes(String(c.projection)) && typeof c.fov==='number'&&Number.isFinite(c.fov)&&c.fov>=12&&c.fov<=120 &&
    typeof c.orthoSize==='number'&&Number.isFinite(c.orthoSize)&&c.orthoSize>=0.1&&c.orthoSize<=500 &&
    (c.targetId===null||typeof c.targetId==='string'&&/^obj_[a-zA-Z0-9_-]{1,100}$/.test(c.targetId)) &&
    Array.isArray(c.followOffset)&&c.followOffset.length===3&&c.followOffset.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=10000)&&typeof c.lookAtTarget==='boolean';
}
export function cleanCameraReferences(project: Project): Project {
  const valid=new Set(sceneCameras(project).map(o=>o.id));
  const targets=new Set(project.objects?.filter(o=>!isCamera(o)).map(o=>o.id));
  return {...project,activeCameraId:valid.has(project.activeCameraId??'')?project.activeCameraId:[...valid][0]??null,
    cameraCuts:project.cameraCuts?.filter(c=>c.view!=='node'||valid.has(c.cameraId??'')),
    objects:project.objects?.map(o=>isCamera(o)&&cameraSettings(o).targetId&&!targets.has(cameraSettings(o).targetId!)?{...o,camera:{...cameraSettings(o),targetId:null}}:o)};
}
export function cameraBasePose(object?: SceneObject) { return object?clonePose(object.pose):neutralPose('camera'); }
