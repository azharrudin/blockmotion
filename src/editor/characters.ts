import { JOINT_IDS, type AssetKind, type JointId, type SceneObject, type Vec3 } from './types';

export function isCharacter(object: Pick<SceneObject, 'kind'>): boolean {
  return isCharacterKind(object.kind);
}
export function isCharacterKind(kind: AssetKind): boolean {
  return kind === 'r6Male' || kind === 'r6Female';
}
export function isJointId(id: string): id is JointId {
  return (JOINT_IDS as readonly string[]).includes(id);
}
export const JOINT_POSITIONS: Record<JointId, Vec3> = {
  torso: [0, 2.15, 0], head: [0, 0.63, 0], leftArm: [-0.88, 0.56, 0],
  rightArm: [0.88, 0.56, 0], leftLeg: [-0.31, 1.525, 0], rightLeg: [0.31, 1.525, 0],
};
export function jointNodeId(objectId: string, joint: JointId): string {
  return `${objectId}:${joint}`;
}
export function resolveObjectNode(project: { objects?: SceneObject[] }, id: string) {
  const [objectId, joint, extra] = id.split(':');
  const object = project.objects?.find(o => o.id === objectId);
  if (!object || extra !== undefined) return undefined;
  if (joint === undefined) return { object, joint: null };
  return isCharacter(object) && isJointId(joint) ? { object, joint } : undefined;
}
