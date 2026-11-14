export const BONE_IDS = ['root', 'torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'camera'] as const;
export type BoneId = (typeof BONE_IDS)[number];
export const JOINT_IDS = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
export type JointId = (typeof JOINT_IDS)[number];
export type Vec3 = [number, number, number];
export type Tool = 'translate' | 'rotate' | 'scale';
export type Interpolation = 'smooth' | 'linear' | 'step';
export type Pose = { position: Vec3; rotation: Vec3; scale: Vec3 };
export type Keyframe = { id: string; time: number; value: Pose };
export type Tracks = Record<BoneId, Keyframe[]>;
export type Palette = { skin: string; shirt: string; pants: string; background: string };
export type SkyPreset = 'studio' | 'morning' | 'day' | 'evening' | 'night' | 'custom';
export type SkySettings = {
  preset: SkyPreset;
  top: string;
  horizon: string;
  lightColor: string;
  elevation: number;
  azimuth: number;
  intensity: number;
  ambient: number;
  stars: boolean;
};
export type TownAssetKind = 'roadCurve' | 'roadT' | 'sidewalk' | 'sidewalkCorner' | 'crosswalk' | 'parking' | 'trafficLight' | 'roadSign' | 'barrier' | 'trashBin' | 'car' | 'motorcycle' | 'bus' | 'busStop' | 'apartment' | 'office' | 'cafe' | 'school' | 'minimarket' | 'gasStation' | 'grassTile' | 'parkPath' | 'flowerPot' | 'fountain' | 'playground' | 'shopSign' | 'billboard' | 'powerPole' | 'mailbox';
export type AssetKind = TownAssetKind | 'cube' | 'sphere' | 'cylinder' | 'plane' | 'r6Male' | 'r6Female' | 'tree' | 'pine' | 'bush' | 'rock' | 'road' | 'intersection' | 'store' | 'house' | 'bench' | 'streetlight' | 'fence';
export type SceneObject = {
  id: string; kind: AssetKind; name: string; color: string; pose: Pose; keyframes?: Keyframe[];
  joints?: Partial<Record<JointId, Keyframe[]>>;
  skinColor?: string;
  pantsColor?: string;
};
export type Project = {
  version: 1;
  sceneVersion?: 2;
  name: string;
  duration: number;
  fps: number;
  interpolation: Interpolation;
  tracks: Tracks;
  palette: Palette;
  sky?: SkySettings;
  objects?: SceneObject[];
};

export const BONE_LABELS: Record<BoneId, string> = {
  root: 'Character', torso: 'Torso', head: 'Head', leftArm: 'Left Arm',
  rightArm: 'Right Arm', leftLeg: 'Left Leg', rightLeg: 'Right Leg', camera: 'Shot Camera'
};
export function isBoneId(id: string): id is BoneId {
  return (BONE_IDS as readonly string[]).includes(id);
}
export const DEFAULT_CAMERA: Pose = {
  position: [4.8, 3.3, 7.2], rotation: [-10, 34, 0], scale: [1, 1, 1]
};
export function neutralPose(id?: BoneId): Pose {
  return id === 'camera'
    ? clonePose(DEFAULT_CAMERA)
    : { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
}
export function clonePose(pose: Pose): Pose {
  return { position: [...pose.position] as Vec3, rotation: [...pose.rotation] as Vec3, scale: [...pose.scale] as Vec3 };
}
export const keyId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const roundFrame = (time: number, fps: number) => Math.round(time * fps) / fps;
