import * as THREE from 'three';
import { JOINT_POSITIONS, isCharacter } from './characters';
import { sampleObjectPose, sampleTrack } from './interpolation';
import type { JointId, Pose, Project, SceneObject, WeldKey } from './types';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function poseMatrix(pose: Pose): THREE.Matrix4 {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rotation[0] * DEG, pose.rotation[1] * DEG, pose.rotation[2] * DEG));
  return new THREE.Matrix4().compose(new THREE.Vector3(...pose.position), quaternion, new THREE.Vector3(...pose.scale));
}

function matrixPose(matrix: THREE.Matrix4): Pose {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const euler = new THREE.Euler().setFromQuaternion(quaternion);
  return {
    position: position.toArray() as Pose['position'],
    rotation: [euler.x * RAD, euler.y * RAD, euler.z * RAD],
    scale: scale.toArray() as Pose['scale'],
  };
}

export function composePose(parent: Pose, child: Pose): Pose {
  return matrixPose(poseMatrix(parent).multiply(poseMatrix(child)));
}

/** Offset that keeps `object` at the same world transform while welded to `target`. */
export function relativeOffset(target: Pose, object: Pose): Pose {
  return matrixPose(poseMatrix(target).invert().multiply(poseMatrix(object)));
}

export function activeWeld(object: SceneObject, time: number): WeldKey | null {
  let active: WeldKey | null = null;
  for (const weld of object.welds ?? []) {
    if (weld.time > time) continue;
    if (!active || weld.time >= active.time) active = weld;
  }
  return active;
}

function jointLocalPose(character: SceneObject, joint: JointId, time: number, project: Project): Pose {
  const pose = sampleTrack(character.joints?.[joint] ?? [], time, project.interpolation, joint);
  return {
    position: [
      pose.position[0] + JOINT_POSITIONS[joint][0],
      pose.position[1] + JOINT_POSITIONS[joint][1],
      pose.position[2] + JOINT_POSITIONS[joint][2],
    ],
    rotation: [...pose.rotation] as Pose['rotation'],
    scale: [...pose.scale] as Pose['scale'],
  };
}

export function objectWorldPose(project: Project, object: SceneObject, time: number, seen = new Set<string>()): Pose {
  return weldedWorldPose(project, object, time, seen) ?? sampleObjectPose(object, time, project.interpolation);
}

/** World pose of an object root or one of its character joints, including nested welds. */
export function targetNodeWorldPose(project: Project, target: SceneObject, joint: JointId | null, time: number, seen = new Set<string>()): Pose {
  let world = objectWorldPose(project, target, time, seen);
  if (!joint || !isCharacter(target)) return world;
  if (joint === 'head' || joint === 'leftArm' || joint === 'rightArm') {
    world = composePose(world, jointLocalPose(target, 'torso', time, project));
  }
  return composePose(world, jointLocalPose(target, joint, time, project));
}

/** Resolve the welded world pose for an object, or null when it is not welded at `time`. */
export function weldedWorldPose(project: Project, object: SceneObject, time: number, seen = new Set<string>()): Pose | null {
  if (seen.has(object.id) || seen.size > 8) return null;
  const weld = activeWeld(object, time);
  if (!weld?.targetId || !weld.offset) return null;
  const target = project.objects?.find(candidate => candidate.id === weld.targetId);
  if (!target) return null;
  const next = new Set(seen);
  next.add(object.id);
  const targetWorld = targetNodeWorldPose(project, target, weld.joint ?? null, time, next);
  return composePose(targetWorld, weld.offset);
}

/** Remove weld keys that point at a missing (or the same) object. */
export function cleanWeldReferences(project: Project): Project {
  const ids = new Set(project.objects?.map(object => object.id));
  return { ...project, objects: project.objects?.map(object => {
    if (!object.welds?.length) return object;
    const welds = object.welds.filter(weld => weld.targetId === null || (weld.targetId !== object.id && ids.has(weld.targetId)));
    return welds.length === object.welds.length ? object : { ...object, welds };
  }) };
}