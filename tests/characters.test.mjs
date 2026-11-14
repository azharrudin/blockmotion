import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({ stdin: { contents: `
  export { useEditor, isValidProject, persistProject } from './src/editor/store';
  export { createProject } from './src/editor/presets';
  export { getTrack, sampleNodePose, sortProjectTracks, timelineTracks } from './src/editor/tracks';
  export { JOINT_IDS, BONE_IDS, neutralPose, keyId } from './src/editor/types';
  export { jointNodeId, JOINT_POSITIONS } from './src/editor/characters';
  export { buildSceneAsset, disposeSceneAsset } from './src/engine/SceneAssets';
  export { characterNodes } from './src/engine/CharacterAsset';
  export { StudioScene } from './src/engine/StudioScene';
  export * as THREE from 'three';`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node' });
const api = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const { useEditor, isValidProject, persistProject, createProject, getTrack, sampleNodePose, sortProjectTracks, timelineTracks, JOINT_IDS, BONE_IDS, neutralPose, keyId, jointNodeId, JOINT_POSITIONS, buildSceneAsset, disposeSceneAsset, characterNodes, StudioScene, THREE } = api;
const s = () => useEditor.getState();
const obj = id => s().project.objects.find(o => o.id === id);
const pose = (rotation = [0, 0, 0], position = [0, 0, 0], scale = [1, 1, 1]) => ({ position, rotation, scale });
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
s().newProject();
const defaultId = s().selectedObject;
assert.equal(s().project.objects.length, 1);
s().deleteObject();
assert.equal(s().project.objects.length, 0, 'the default character is deletable');
assert.equal(timelineTracks(s().project).length, 1, 'only the camera remains');
assert.equal(persistProject(s().project), true);
s().loadProject(JSON.parse(storage.get('blockmotion-studio-project-v1')));
assert.equal(s().project.objects.length, 0, 'no fixed rig reappears after reload');
s().undo(); s().undo();
assert.equal(s().project.objects[0].id, defaultId, 'undo restores the ordinary default character');
s().loadProject({ ...createProject(), objects: [] });
s().addObject('r6Male'); const male = s().selectedObject;
s().addObject('r6Female'); const female = s().selectedObject;
assert.equal(timelineTracks(s().project).length, 15, 'camera plus two independent seven-node characters');
for (const id of [male, female]) {
  const root = buildSceneAsset(obj(id));
  const joints = characterNodes(root);
  assert.deepEqual(Object.keys(joints), JOINT_IDS);
  for (const joint of JOINT_IDS) {
    const node = joints[joint];
    assert.equal(node.parent, ['head', 'leftArm', 'rightArm'].includes(joint) ? joints.torso : root);
    assert.deepEqual(node.position.toArray(), JOINT_POSITIONS[joint]);
    assert.ok(getTrack(s().project, jointNodeId(id, joint)).length > 0);
    node.traverse(mesh => { if (mesh instanceof THREE.Mesh) { assert.equal(mesh.userData.objectId, id); assert.ok(JOINT_IDS.includes(mesh.userData.jointId)); } });
  }
  disposeSceneAsset(root);
}
const untouchedFemale = structuredClone(obj(female));
for (const [index, joint] of JOINT_IDS.entries()) {
  s().selectObject(male, joint); s().seek(2);
  assert.equal(s().selection, jointNodeId(male, joint));
  assert.equal(s().selectedJoint, joint);
  s().previewObjectPose(pose([20 + index, 30, -40], [0.1, 0.2, 0.3], [1.1, 1.1, 1.1])); s().commitObjectPose();
  const keys = getTrack(s().project, s().selection);
  assert.equal(keys.length, 2);
  assert.equal(keys.at(-1).value.rotation[0], 20 + index);
  assert.deepEqual(obj(female), untouchedFemale, 'male edits never affect female');
}
const untouchedMale = structuredClone(obj(male));
s().selectObject(female, 'leftArm'); s().seek(2);
s().setAutoKey(false); s().previewObjectPose(pose([0, 0, 140])); s().commitObjectPose();
assert.equal(getTrack(s().project, s().selection).length, 1);
s().commitKey(); assert.equal(getTrack(s().project, s().selection).length, 2);
assert.deepEqual(obj(male), untouchedMale, 'female edits never affect male');
const key = getTrack(s().project, s().selection).at(-1);
s().moveKey(s().selection, key.id, 3);
s().setSelectedKey({ node: jointNodeId(female, 'leftArm'), id: key.id });
assert.equal(s().selectedJoint, 'leftArm'); assert.equal(s().selectedObject, female);
s().deleteKey(); assert.equal(obj(female).joints.leftArm.length, 1);
s().undo(); assert.equal(obj(female).joints.leftArm.length, 2);
s().selectObject(female); s().duplicateObject(); const copy = obj(s().selectedObject);
assert.notEqual(copy.joints, obj(female).joints);
for (const joint of JOINT_IDS) copy.joints[joint].forEach((k, i) => {
  assert.notEqual(k.id, obj(female).joints[joint][i].id);
  assert.notEqual(k.value, obj(female).joints[joint][i].value);
  assert.deepEqual(k.value, obj(female).joints[joint][i].value);
});
s().selectObject(male, 'head'); const otherBeforePreset = structuredClone(obj(female));
s().preset('wave');
assert.ok(obj(male).joints.leftArm.length > 2);
assert.deepEqual(obj(female), otherBeforePreset, 'motion presets affect only selected character');
assert.ok(obj(male).keyframes[0].value.position.every((v, i) => v === untouchedMale.keyframes[0].value.position[i]), 'presets preserve character placement');
s().select('camera'); const charsBeforeCamera = structuredClone(s().project.objects); s().preset('cinematic');
assert.deepEqual(s().project.objects, charsBeforeCamera, 'camera preset leaves all characters unchanged');
assert.ok(s().project.tracks.camera.length > 1);
s().selectObject(female, 'head'); s().seek(4); s().previewObjectPose(pose([0, 80, 0])); s().commitKey();
s().updateSetting({ duration: 2 }); assert.ok(obj(female).joints.head.every(k => k.time <= 2)); s().undo();
assert.ok(obj(female).joints.head.some(k => k.time === 4));
assert.equal(isValidProject(s().project), true);
assert.equal(persistProject(s().project), true);
const exported = JSON.parse(storage.get('blockmotion-studio-project-v1'));
exported.objects.forEach(o => { for (const keys of Object.values(o.joints ?? {})) keys.reverse(); });
s().loadProject(exported);
assert.ok(obj(male).joints.leftArm[0].time === 0);

const studio = Object.create(StudioScene.prototype);
studio.scene = new THREE.Scene(); studio.assetNodes = new Map(); studio.shotCamera = new THREE.PerspectiveCamera();
studio.controls = { object: null, detach() { this.object = null; } }; studio.draggingGizmo = false;
s().selectObject(female, 'leftArm'); s().seek(1); studio.syncSceneObjects();
const root = studio.assetNodes.get(female).root;
const joints = characterNodes(root);
assert.equal(studio.selectedNode(), joints.leftArm);
const sampled = sampleNodePose(s().project, jointNodeId(female, 'leftArm'), 1);
assert.equal(joints.leftArm.rotation.z, THREE.MathUtils.degToRad(sampled.rotation[2]));
s().previewObjectPose(pose([0, 0, 90], [0, 0.4, 0])); studio.syncSceneObjects();
assert.equal(joints.leftArm.rotation.z, Math.PI / 2);
assert.equal(joints.leftArm.position.y, JOINT_POSITIONS.leftArm[1] + 0.4);
s().selectObject(female, 'head'); s().previewObjectPose(pose([0, 45, 0])); studio.syncSceneObjects();
assert.equal(joints.head.rotation.y, Math.PI / 4);
s().updateObject(female, { color: '#ff0000', skinColor: '#aabbcc', pantsColor: '#112233' }); studio.syncSceneObjects();
root.traverse(mesh => { if (mesh instanceof THREE.Mesh && mesh.material.userData.colorKey === 'skinColor') assert.equal(mesh.material.color.getHexString(), 'aabbcc'); });
studio.controls.object = joints.head;
let disposed = 0;
root.traverse(mesh => { if (mesh instanceof THREE.Mesh) mesh.geometry.addEventListener('dispose', () => disposed++); });
s().deleteObject(); studio.syncSceneObjects();
assert.equal(studio.controls.object, null, 'deleting a selected joint detaches its gizmo');
assert.equal(studio.assetNodes.has(female), false);
assert.ok(disposed > 0);
assert.ok(!timelineTracks(s().project).some(t => t.id.startsWith(female)));
s().undo(); studio.syncSceneObjects(); assert.ok(studio.assetNodes.has(female));

// Genuine v1 fixture: the formerly permanent rig plus an older grouped female.
const legacy = { ...createProject('Old project') };
delete legacy.sceneVersion;
legacy.palette.skin = '#bbaa99'; legacy.palette.shirt = '#aa3344'; legacy.palette.pants = '#223344';
legacy.tracks = Object.fromEntries(BONE_IDS.map(id => [id, [{ id: keyId(), time: 0, value: neutralPose(id) }]]));
legacy.tracks.leftArm.push({ id: 'old_wave', time: 2, value: pose([0, 0, -120]) });
legacy.tracks.root[0].value.position = [2, 0, -3];
legacy.objects = [{ id: 'obj_old_female', kind: 'r6Female', name: 'Old female', color: '#aabbcc', pose: pose(), keyframes: [{ id: 'old_root', time: 0, value: pose() }] }];
assert.equal(isValidProject(legacy), true);
s().loadProject(legacy);
assert.equal(s().project.objects.length, 2);
const migrated = s().project.objects.find(o => o.id !== 'obj_old_female');
assert.equal(migrated.skinColor, '#bbaa99'); assert.equal(migrated.color, '#aa3344');
assert.deepEqual(migrated.keyframes[0].value.position, [2, 0, -3]);
assert.equal(migrated.joints.leftArm.at(-1).value.rotation[2], -120);
assert.deepEqual(sortProjectTracks(s().project), s().project, 'migration is idempotent');
s().selectObject('obj_old_female', 'rightLeg'); s().seek(2); s().previewObjectPose(pose([45, 0, 0])); s().commitKey();
assert.equal(obj('obj_old_female').joints.rightLeg.length, 2, 'older grouped female gains editable joint tracks');
for (const object of [...s().project.objects]) { s().selectObject(object.id); s().deleteObject(); }
const empty = JSON.parse(JSON.stringify(s().project)); s().loadProject(empty); studio.syncSceneObjects();
assert.equal(studio.assetNodes.size, 0, 'deleting every character leaves no ghost rig');
assert.equal(s().project.objects.length, 0); assert.equal(isValidProject(s().project), true);
for (const patch of [{ joints: { unknown: [] } }, { joints: null }, { joints: { head: [{ id: 'bad', time: 9, value: pose() }] } }, { skinColor: 'invalid' }]) {
  assert.equal(isValidProject({ ...empty, objects: [{ ...migrated, ...patch }] }), false);
}
assert.equal(isValidProject({ ...empty, objects: [{ ...migrated, kind: 'tree', joints: {} }] }), false);
console.log('PASS: deletable default character; independent male/female joints, transforms, keyframes, presets, duplication, undo/redo, hierarchy/picking metadata, joint disposal, local colors, legacy migration, persistence, and no ghost rig.');
