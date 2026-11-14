import * as THREE from 'three';
import { JOINT_IDS, type JointId, type SceneObject, type Vec3 } from '../editor/types';
import { JOINT_POSITIONS } from '../editor/characters';
import { batchAssetMeshes } from './batchAssets';

export type CharacterNodes = Record<JointId, THREE.Group>;
export function characterNodes(root: THREE.Object3D): CharacterNodes | undefined {
  return root.userData.characterNodes as CharacterNodes | undefined;
}

export function buildCharacterAsset(object: SceneObject): THREE.Group {
  const root = new THREE.Group();
  root.name = object.name;
  const nodes = {} as CharacterNodes;
  for (const joint of JOINT_IDS) {
    const node = new THREE.Group();
    node.name = joint;
    node.position.set(...JOINT_POSITIONS[joint]);
    node.userData.objectId = object.id;
    node.userData.jointId = joint;
    (joint === 'head' || joint === 'leftArm' || joint === 'rightArm' ? nodes.torso : root).add(node);
    nodes[joint] = node;
  }
  root.userData.characterNodes = nodes;
  const female = object.kind === 'r6Female';
  const materials = {
    shirt: new THREE.MeshStandardMaterial({ color: object.color, roughness: 0.8 }),
    skin: new THREE.MeshStandardMaterial({ color: object.skinColor ?? '#f3c58b', roughness: 0.75 }),
    pants: new THREE.MeshStandardMaterial({ color: object.pantsColor ?? '#343d53', roughness: 0.85 }),
    hair: new THREE.MeshStandardMaterial({ color: female ? '#503125' : '#382b26', roughness: 0.9 }),
    eyes: new THREE.MeshStandardMaterial({ color: '#171722', roughness: 0.7 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#9c594b', roughness: 0.8 }),
  };
  materials.shirt.userData.tint = true;
  materials.skin.userData.colorKey = 'skinColor';
  materials.pants.userData.colorKey = 'pantsColor';
  const box = (joint: JointId, size: Vec3, position: Vec3, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.objectId = object.id; mesh.userData.jointId = joint;
    nodes[joint].add(mesh);
    return mesh;
  };
  box('torso', [1.17, 1.25, 0.64], [0, 0, 0], materials.shirt);
  box('head', [0.85, 0.87, 0.85], [0, 0.44, 0], materials.skin);
  for (const joint of ['leftArm', 'rightArm'] as const) {
    box(joint, [0.53, 1.2, 0.59], [0, -0.6, 0], materials.skin);
    box(joint, [0.55, 0.45, 0.61], [0, -0.225, 0], materials.shirt);
  }
  for (const joint of ['leftLeg', 'rightLeg'] as const) box(joint, [0.55, 1.52, 0.62], [0, -0.76, 0], materials.pants);
  box('head', [0.94, 0.2, 0.94], [0, 0.92, 0], materials.hair);
  box('head', [0.94, 0.25, 0.13], [0, 0.72, 0.45], materials.hair);
  if (female) {
    box('head', [0.98, 1, 0.22], [0, 0.42, -0.46], materials.hair);
    for (const x of [-0.46, 0.46]) box('head', [0.17, 0.85, 0.7], [x, 0.39, -0.02], materials.hair);
  }
  for (const x of [-0.175, 0.175]) box('head', [0.075, 0.09, 0.02], [x, 0.52, 0.435], materials.eyes);
  box('head', [0.2, 0.035, 0.02], [0, 0.27, 0.435], materials.mouth);
  // Merge parts only inside each joint, preserving independent joint animation
  // and the object/joint IDs used by picking and the transform gizmo.
  for (const joint of JOINT_IDS) batchAssetMeshes(nodes[joint]);
  return root;
}
