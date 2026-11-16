import { clonePose, keyId, neutralPose, type AssetKind, type ImportedModel, type SceneObject, type Pose, type WeldKey, JOINT_IDS } from './types';

import { TOWN_ASSETS, snapToGrid, type AssetDefinition } from './town';
import { DEFAULT_CAMERA_SETTINGS, isValidCameraSettings } from './cameras';
import { isValidTerrain } from './terrain';
import { isCharacterKind, isJointId } from './characters';

export const MAX_OBJECTS = 500;
export const MAX_SCRIPT_LENGTH = 20_000;
export const DEFAULT_SCRIPT = `const group = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1.6, 0.8),
  new THREE.MeshStandardMaterial({ color: '#8ea9ff', roughness: 0.7 }),
);
body.position.y = 0.8;
group.add(body);
return group;`;
export const ASSET_CATALOG: Record<AssetKind, AssetDefinition> = {
  camera: { label: 'Camera', category: 'Cameras', color: '#89b7e7', keywords: 'kamera perspective orthographic' },
  r6Male: { label: 'Blocky R6 Male', category: 'Characters', color: '#427fe4' },
  r6Female: { label: 'Blocky R6 Female', category: 'Characters', color: '#ab67c9' },
  tree: { label: 'Tree', category: 'Nature', color: '#4d9952' },
  pine: { label: 'Pine tree', category: 'Nature', color: '#32745a' },
  bush: { label: 'Bush', category: 'Nature', color: '#69a653' },
  rock: { label: 'Rock', category: 'Nature', color: '#89929b' },
  road: { label: 'Road', category: 'Town', color: '#424955', section: 'Roads', keywords: 'jalan lurus' },
  intersection: { label: 'Road intersection', category: 'Town', color: '#424955', section: 'Roads', keywords: 'jalan perempatan' },
  store: { label: 'Store', category: 'Town', color: '#e5caa1', section: 'Buildings', keywords: 'toko' },
  house: { label: 'House', category: 'Town', color: '#c7d6df', section: 'Buildings', keywords: 'rumah' },
  bench: { label: 'Bench', category: 'Town', color: '#b28258', section: 'Street props', keywords: 'bangku' },
  streetlight: { label: 'Street light', category: 'Town', color: '#5b6575', section: 'Street props', keywords: 'lampu jalan' },
  fence: { label: 'Fence', category: 'Town', color: '#d7c8ab', section: 'Street props', keywords: 'pagar' },
  cube: { label: 'Cube', category: 'Primitives', color: '#7fa8df' },
  sphere: { label: 'Sphere', category: 'Primitives', color: '#e7ae69' },
  cylinder: { label: 'Cylinder', category: 'Primitives', color: '#9d88d0' },
  plane: { label: 'Ground tile', category: 'Primitives', color: '#7b9a70' },
  script: { label: 'Script object', category: 'Custom', color: '#8ea9ff', keywords: 'custom threejs script code javascript object' },
  imported: { label: 'Imported model', category: 'Custom', color: '#9aa9c8', keywords: 'import glb gltf model 3d' },
  ...TOWN_ASSETS,
  terrain: { label: 'Terrain', category: 'Nature', color: '#ffffff', keywords: 'gunung pegunungan pasir terrain tanah desert' },
  jungleTree: { label: 'Jungle tree', category: 'Nature', color: '#438958', keywords: 'pohon hutan jungle' },
  palm: { label: 'Palm tree', category: 'Nature', color: '#61985b', keywords: 'pohon palem kelapa' },
  cactus: { label: 'Cactus', category: 'Nature', color: '#6a9366', keywords: 'kaktus gurun desert' },
  roadNetwork: { label: 'Road network', category: 'Town', section: 'Roads', color: '#424955', keywords: 'jalan jaringan kota grid' },
};

export function createSceneObject(kind: AssetKind, existing: SceneObject[], gridSize?: number): SceneObject {
  const asset = ASSET_CATALOG[kind];
  const pose = neutralPose();
  // Find a free spawn slot around the scene center instead of stacking objects.
  let slot = 0;
  do {
    pose.position = [4 + (slot % 5) * 4, 0, -Math.floor(slot / 5) * 5];
    if (gridSize !== undefined) pose.position = pose.position.map(v => snapToGrid(v, gridSize)) as Pose['position'];
    slot++;
  } while (existing.some(o => Math.hypot(o.pose.position[0] - pose.position[0], o.pose.position[2] - pose.position[2]) < 2));
  if (kind === 'camera') Object.assign(pose, neutralPose('camera'));
  let suffix = 1;
  while (existing.some(o => o.name === `${asset.label} ${suffix}`)) suffix++;
  const object: SceneObject = { id: `obj_${keyId()}`, kind, name: `${asset.label} ${suffix}`, color: asset.color, ...(kind === 'camera' && { camera: { ...DEFAULT_CAMERA_SETTINGS, followOffset: [...DEFAULT_CAMERA_SETTINGS.followOffset] } }), pose: clonePose(pose), keyframes: [{ id: keyId(), time: 0, value: clonePose(pose) }], ...(isCharacterKind(kind) && {
    joints: Object.fromEntries(JOINT_IDS.map(joint => [joint, [{ id: keyId(), time: 0, value: neutralPose() }]])),
    skinColor: '#f3c58b', pantsColor: '#343d53',
  }) };
  if (kind === 'script') object.script = DEFAULT_SCRIPT;
  return object;
}

export function isValidSceneObject(value: unknown, duration = 600): value is SceneObject {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== 'string' || !/^obj_[a-zA-Z0-9_-]{1,100}$/.test(o.id)) return false;
  if (typeof o.kind !== 'string' || !Object.hasOwn(ASSET_CATALOG, o.kind)) return false;
  if (typeof o.name !== 'string' || o.name.trim().length === 0 || o.name.length > 60) return false;
  if (typeof o.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(o.color)) return false;
  if (o.camera !== undefined && (o.kind !== 'camera' || !isValidCameraSettings(o.camera))) return false;
  if (o.kind === 'imported') {
    if (!isValidImportedModel(o.model)) return false;
  } else if (o.model !== undefined) return false;
  if (o.kind === 'script') {
    if (typeof o.script !== 'string' || o.script.trim().length === 0 || o.script.length > MAX_SCRIPT_LENGTH) return false;
  } else if (o.script !== undefined) return false;
  if (o.terrain !== undefined && (o.kind !== 'terrain' || !isValidTerrain(o.terrain))) return false;
  if (o.roadGrid !== undefined) {
    if (o.kind !== 'roadNetwork' || typeof o.roadGrid !== 'object' || o.roadGrid === null) return false;
    const grid = o.roadGrid as Record<string, unknown>;
    if (grid.blockSize !== 18 || !['columns', 'rows'].every(k => typeof grid[k] === 'number' && Number.isInteger(grid[k]) && grid[k] >= 1 && grid[k] <= 8)) return false;
  }
  if (!isValidObjectPose(o.pose)) return false;
  if (o.welds !== undefined) {
    if (!isValidWelds(o.welds, duration)) return false;
    if ((o.welds as WeldKey[]).some(weld => weld.targetId === o.id)) return false;
  }
  if (o.keyframes !== undefined && !isValidObjectKeys(o.keyframes, duration)) return false;
  if (o.joints !== undefined) {
    if (!isCharacterKind(o.kind as AssetKind) || typeof o.joints !== 'object' || o.joints === null || Array.isArray(o.joints)) return false;
    if (!Object.entries(o.joints).every(([id, keys]) => isJointId(id) && isValidObjectKeys(keys, duration))) return false;
  }
  for (const color of ['skinColor', 'pantsColor']) {
    if (o[color] !== undefined && (typeof o[color] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(o[color]))) return false;
  }
  return true;
}

export function isValidObjectPose(value: unknown): value is Pose {
  if (typeof value !== 'object' || value === null) return false;
  const pose = value as Record<string, unknown>;
  return ['position', 'rotation', 'scale'].every(key => {
    const values = pose[key];
    return Array.isArray(values) && values.length === 3 && values.every(n =>
      typeof n === 'number' && Number.isFinite(n) && (key === 'scale' ? n >= 0.01 && n <= 100 : Math.abs(n) <= 10000));
  });
}

export const MAX_MODEL_DATA = 4_000_000;

export function isValidImportedModel(value: unknown): value is ImportedModel {
  if (typeof value !== 'object' || value === null) return false;
  const model = value as Record<string, unknown>;
  return typeof model.name === 'string' && model.name.trim().length > 0 && model.name.length <= 60
    && (model.format === 'glb' || model.format === 'gltf')
    && typeof model.data === 'string' && model.data.startsWith('data:') && model.data.length <= MAX_MODEL_DATA;
}

export function isValidWelds(value: unknown, duration: number): value is WeldKey[] {
  if (!Array.isArray(value) || value.length > 200) return false;
  const ids = new Set<string>();
  const times = new Set<number>();
  return value.every(item => {
    if (typeof item !== 'object' || item === null) return false;
    const weld = item as Record<string, unknown>;
    if (typeof weld.id !== 'string' || weld.id.length === 0 || weld.id.length > 100 || ids.has(weld.id)) return false;
    if (typeof weld.time !== 'number' || !Number.isFinite(weld.time) || weld.time < 0 || weld.time > duration + 0.01 || times.has(weld.time)) return false;
    if (weld.targetId === null) {
      if (weld.offset !== undefined || weld.joint !== undefined) return false;
    } else {
      if (typeof weld.targetId !== 'string' || !/^obj_[a-zA-Z0-9_-]{1,100}$/.test(weld.targetId)) return false;
      if (weld.joint !== undefined && weld.joint !== null && !isJointId(String(weld.joint))) return false;
      if (!isValidObjectPose(weld.offset)) return false;
    }
    ids.add(weld.id);
    times.add(weld.time);
    return true;
  });
}

export function isValidObjectKeys(value: unknown, duration: number): boolean {
  if (!Array.isArray(value) || value.length > 5000) return false;
  const ids = new Set<string>();
  const times = new Set<number>();
  for (const key of value) {
    if (key?.interpolation !== undefined && !['linear', 'smooth', 'step'].includes(key.interpolation)) return false;
    if (key?.enabled !== undefined && typeof key.enabled !== 'boolean') return false;
    if (typeof key !== 'object' || key === null || typeof key.id !== 'string' || key.id.length === 0 || key.id.length > 100 || ids.has(key.id)) return false;
    if (typeof key.time !== 'number' || !Number.isFinite(key.time) || key.time < 0 || key.time > duration + 0.01 || times.has(key.time) || !isValidObjectPose(key.value)) return false;
    ids.add(key.id); times.add(key.time);
  }
  return true;
}
