import * as THREE from 'three';
import type { ImportedModel } from '../editor/types';

/**
 * Imported models are embedded in the project as data URLs. Templates are
 * parsed once per payload and cloned for every scene object that uses them.
 * Shared geometry/materials are never disposed by scene object disposal.
 */
const templates = new Map<string, THREE.Group>();
const pending = new Map<string, Promise<THREE.Group | null>>();
const listeners = new Set<() => void>();

export function subscribeModelAssets(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getModelTemplate(model: ImportedModel): THREE.Group | undefined {
  return templates.get(model.data);
}

function decode(model: ImportedModel): ArrayBuffer | string {
  const comma = model.data.indexOf(',');
  if (comma < 0) throw new Error('Invalid model data URL');
  const meta = model.data.slice(0, comma);
  const payload = model.data.slice(comma + 1);
  const bytes = Uint8Array.from(meta.includes(';base64') ? atob(payload) : decodeURIComponent(payload), c => c.charCodeAt(0));
  return model.format === 'gltf' ? new TextDecoder().decode(bytes) : bytes.buffer;
}

function normalize(scene: THREE.Group): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.add(scene);
  const initial = new THREE.Box3().setFromObject(scene);
  if (initial.isEmpty()) return wrapper;
  const size = initial.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z) || 1;
  scene.scale.multiplyScalar(2 / largest);
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  if (bounds.isEmpty()) return wrapper;
  const center = bounds.getCenter(new THREE.Vector3());
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= bounds.min.y;
  wrapper.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.userData.sharedAsset = true;
  });
  return wrapper;
}

/** Parse and cache a model. Resolves null (instead of throwing) for bad files. */
export async function ensureModel(model: ImportedModel): Promise<THREE.Group | null> {
  const cached = templates.get(model.data);
  if (cached) return cached;
  const inFlight = pending.get(model.data);
  if (inFlight) return inFlight;
  const promise = (async () => {
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().parseAsync(decode(model), '');
      const template = normalize(gltf.scene);
      templates.set(model.data, template);
      listeners.forEach(listener => listener());
      return template;
    } catch (error) {
      console.warn('Could not parse imported model', error);
      return null;
    } finally {
      pending.delete(model.data);
    }
  })();
  pending.set(model.data, promise);
  return promise;
}

/** Used by the import dialog to validate a file before adding it to the scene. */
export const preloadModel = ensureModel;