import * as THREE from 'three';
import type { SceneObject, Vec3 } from '../editor/types';
import { isCharacter } from '../editor/characters';
import { buildTownAsset } from './TownAssets';
import { isTownAssetKind } from '../editor/town';
import { buildCharacterAsset } from './CharacterAsset';

/** Every preset is one selectable group, with its own disposable geometry/materials. */
export function buildSceneAsset(object: SceneObject): THREE.Group {
  if (isCharacter(object)) return buildCharacterAsset(object);
  if (isTownAssetKind(object.kind)) return buildTownAsset(object);
  const group = new THREE.Group();
  group.name = object.name;
  const main = new THREE.MeshStandardMaterial({ color: object.color, roughness: 0.8 });
  main.userData.tint = true;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color?: string) => {
    if (!color) return main;
    let m = materials.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 }); materials.set(color, m); }
    return m;
  };
  const mesh = (geometry: THREE.BufferGeometry, position: Vec3, color?: string) => {
    const m = new THREE.Mesh(geometry, material(color));
    m.position.set(...position);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.objectId = object.id;
    group.add(m);
    return m;
  };
  const box = (size: Vec3, position: Vec3, color?: string) => mesh(new THREE.BoxGeometry(...size), position, color);
  const cylinder = (top: number, bottom: number, height: number, position: Vec3, color?: string, sides = 12) =>
    mesh(new THREE.CylinderGeometry(top, bottom, height, sides), position, color);
  const sphere = (radius: number, position: Vec3, color?: string) => mesh(new THREE.IcosahedronGeometry(radius, 1), position, color);

  switch (object.kind) {
    case 'cube': box([1, 1, 1], [0, 0.5, 0]); break;
    case 'sphere': sphere(0.65, [0, 0.65, 0]); break;
    case 'cylinder': cylinder(0.55, 0.55, 1.3, [0, 0.65, 0]); break;
    case 'plane': box([4, 0.06, 4], [0, 0.03, 0]); break;
    case 'tree':
      cylinder(0.18, 0.28, 2.4, [0, 1.2, 0], '#80583c');
      sphere(1.15, [0, 2.9, 0]); sphere(0.85, [-0.65, 2.45, 0]); sphere(0.85, [0.65, 2.5, 0.1]);
      break;
    case 'pine':
      cylinder(0.14, 0.24, 1.5, [0, 0.75, 0], '#80583c');
      for (let i = 0; i < 3; i++) cylinder(0, 1.15 - i * 0.25, 1.8, [0, 1.7 + i * 0.75, 0], undefined, 8);
      break;
    case 'bush':
      sphere(0.65, [-0.45, 0.6, 0]); sphere(0.8, [0.2, 0.7, 0]); sphere(0.55, [0.65, 0.5, 0.1]);
      break;
    case 'rock': {
      const rock = mesh(new THREE.DodecahedronGeometry(0.85, 0), [0, 0.5, 0]);
      rock.scale.set(1.3, 0.8, 1); rock.rotation.set(0.2, 0.3, 0.1);
      break;
    }
    case 'road':
      box([4, 0.08, 6], [0, 0.04, 0]);
      for (const x of [-1.94, 1.94]) box([0.07, 0.012, 6], [x, 0.086, 0], '#edf0df');
      for (const z of [-2, 0, 2]) box([0.1, 0.012, 1], [0, 0.086, z], '#f7d269');
      break;
    case 'intersection':
      box([6, 0.08, 6], [0, 0.04, 0]);
      for (const axis of [-1, 1]) {
        box([0.1, 0.012, 0.75], [0, 0.086, axis * 2.5], '#f7d269');
        box([0.75, 0.012, 0.1], [axis * 2.5, 0.086, 0], '#f7d269');
        for (let i = -1.5; i <= 1.5; i += 0.6) {
          box([0.32, 0.012, 0.6], [i, 0.086, axis * 1.8], '#edf0df');
          box([0.6, 0.012, 0.32], [axis * 1.8, 0.086, i], '#edf0df');
        }
      }
      break;
    case 'store':
      box([4, 2.9, 3], [0, 1.45, 0]);
      box([4.3, 0.2, 3.3], [0, 3, 0], '#566477');
      box([0.85, 2, 0.08], [0.9, 1.05, 1.54], '#74b9cf');
      box([1.65, 1.4, 0.08], [-0.8, 1.4, 1.54], '#74b9cf');
      box([0.06, 1.4, 0.1], [-0.8, 1.4, 1.59], '#f5ecd9');
      box([0.07, 0.25, 0.08], [1.16, 1.1, 1.61], '#f3db91');
      for (let i = 0; i < 8; i++) {
        const awning = box([0.5, 0.13, 0.9], [-1.75 + i * 0.5, 2.45, 1.8], i % 2 ? '#f4eee2' : '#d96560');
        awning.rotation.x = 0.18;
      }
      box([2, 0.5, 0.1], [0, 2.9, 1.66], '#426d75');
      // A shopping bag emblem on the shop sign.
      box([0.32, 0.25, 0.03], [0, 2.87, 1.73], '#fff0ce');
      box([0.2, 0.06, 0.03], [0, 3.05, 1.73], '#fff0ce');
      break;
    case 'house': {
      box([3.5, 2.7, 3], [0, 1.35, 0]);
      const roof = cylinder(0, 2.65, 1.3, [0, 3.3, 0], '#a2584d', 4);
      roof.rotation.y = Math.PI / 4;
      box([0.8, 1.85, 0.1], [0, 0.925, 1.55], '#825c46');
      for (const x of [-1.1, 1.1]) {
        box([0.7, 0.8, 0.1], [x, 1.75, 1.55], '#82b8d1');
        box([0.06, 0.8, 0.12], [x, 1.75, 1.58], '#f3e7d0');
      }
      break;
    }
    case 'bench':
      for (const z of [-0.25, 0, 0.25]) box([2, 0.1, 0.2], [0, 0.65, z]);
      for (const y of [1.05, 1.3]) box([2, 0.18, 0.1], [0, y, -0.32]);
      for (const x of [-0.75, 0.75]) {
        box([0.12, 0.65, 0.6], [x, 0.325, 0], '#424955');
        box([0.1, 0.8, 0.1], [x, 1, -0.35], '#424955');
      }
      break;
    case 'streetlight': {
      cylinder(0.12, 0.22, 0.3, [0, 0.15, 0]);
      cylinder(0.06, 0.09, 3.8, [0, 1.9, 0]);
      box([1, 0.1, 0.12], [0.45, 3.8, 0]);
      const lamp = box([0.5, 0.16, 0.3], [0.9, 3.72, 0], '#ffe5a4');
      lamp.material.emissive.set('#ffe5a4'); lamp.material.emissiveIntensity = 0.7;
      break;
    }
    case 'fence':
      for (const x of [-1.4, 1.4]) box([0.17, 1.35, 0.17], [x, 0.675, 0]);
      for (const y of [0.45, 1]) box([3, 0.13, 0.12], [0, y, 0]);
      for (let x = -1.1; x < 1.2; x += 0.44) box([0.16, 1.15, 0.15], [x, 0.575, 0]);
      break;
  }
  // Main material might be unused in a future preset; dispose it if so.
  if (!group.children.some(child => child instanceof THREE.Mesh && child.material === main)) main.dispose();
  return group;
}

export function disposeSceneAsset(group: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
    }
  });
  materials.forEach(material => material.dispose());
}
