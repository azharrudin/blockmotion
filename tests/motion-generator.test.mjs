import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ stdin: { contents: `
  export { useEditor, isValidProject } from './src/editor/store';
  export { sampleObjectPose } from './src/editor/interpolation';
  export { sampleNodePose } from './src/editor/tracks';
  export { JOINT_POSITIONS } from './src/editor/characters';
  export { buildSceneAsset, disposeSceneAsset } from './src/engine/SceneAssets';
  export { characterNodes } from './src/engine/CharacterAsset';
  export { StudioScene, subscribeEditorControls } from './src/engine/StudioScene';`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node' });
const { useEditor, isValidProject, subscribeEditorControls, sampleObjectPose, sampleNodePose, JOINT_POSITIONS, buildSceneAsset, disposeSceneAsset, characterNodes, StudioScene } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const state = () => useEditor.getState();
const object = id => state().project.objects.find(item => item.id === id);
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };

state().newProject();
const characterId = state().selectedObject;
state().addObject('r6Female');
const otherId = state().selectedObject;
state().selectObject(characterId);
const before = structuredClone(state().project);
const otherBefore = structuredClone(object(otherId));

state().generateMotion({ action: 'walk', duration: 2, intensity: 1.5, repeats: 3 });
assert.equal(object(characterId).keyframes.at(-1).time, 6);
assert.equal(object(characterId).keyframes.at(-1).value.position[2], -4.95);
assert.equal(object(characterId).joints.leftLeg.length, 73);
assert.deepEqual(object(otherId), otherBefore);
assert.equal(state().project.duration, 6);
assert.equal(isValidProject(state().project), true);
// Constant forward speed must survive the project's default smooth interpolation,
// including immediately before and after a generated keyframe.
const generated = object(characterId);
const boundary = generated.keyframes[12].time;
const epsilon = 0.001;
const z = time => sampleObjectPose(generated, time, state().project.interpolation).position[2];
assert.ok(Math.abs((z(boundary) - z(boundary - epsilon)) / epsilon + 0.825) < 1e-8);
assert.ok(Math.abs((z(boundary + epsilon) - z(boundary)) / epsilon + 0.825) < 1e-8);
assert.equal(state().project.interpolation, before.interpolation, 'other tracks retain project interpolation');
const exportedMotion = JSON.parse(JSON.stringify(state().project));
assert.equal(isValidProject(exportedMotion), true);
assert.equal(sampleObjectPose(exportedMotion.objects.find(o => o.id === characterId), boundary + epsilon, 'smooth').position[2], z(boundary + epsilon), 'JSON preserves continuous motion');
const invalidMotion = structuredClone(exportedMotion);
invalidMotion.objects.find(o => o.id === characterId).keyframes[0].interpolation = 'invalid';
assert.equal(isValidProject(invalidMotion), false, 'invalid per-key interpolation is rejected');
// The optimized renderer must match editor sampling for roots, every joint,
// manual previews, and the joint currently being dragged.
const studio = Object.create(StudioScene.prototype);
studio.assetNodes = new Map(state().project.objects.map(o => [o.id, { root: buildSceneAsset(o) }]));
studio.draggingGizmo = false;
state().seek(boundary + epsilon);
studio.applySceneObjectPoses();
const root = studio.assetNodes.get(characterId).root;
assert.deepEqual(root.position.toArray(), sampleNodePose(state().project, characterId, state().time).position);
const joints = characterNodes(root);
for (const [joint, node] of Object.entries(joints)) {
  const pose = sampleNodePose(state().project, `${characterId}:${joint}`, state().time);
  assert.deepEqual(node.position.toArray(), pose.position.map((v, i) => v + JOINT_POSITIONS[joint][i]));
  node.rotation.toArray().slice(0, 3).forEach((angle, i) => assert.ok(Math.abs(angle - pose.rotation[i] * Math.PI / 180) < 1e-10));
}
state().selectObject(characterId, 'leftArm');
const preview = { position: [1, 2, 3], rotation: [10, 20, 30], scale: [1.2, 1.2, 1.2] };
state().updatePose(state().selection, preview);
studio.applySceneObjectPoses();
assert.deepEqual(joints.leftArm.position.toArray(), preview.position.map((v, i) => v + JOINT_POSITIONS.leftArm[i]));
studio.draggingGizmo = true;
joints.leftArm.position.set(7, 8, 9);
studio.applySceneObjectPoses();
assert.deepEqual(joints.leftArm.position.toArray(), [7, 8, 9], 'dragged joint is not overwritten');
for (const node of studio.assetNodes.values()) disposeSceneAsset(node.root);
state().selectObject(characterId);
state().seek(0);
const editedPose = structuredClone(generated.keyframes[0].value);
editedPose.position[0] += 1;
state().updatePose(characterId, editedPose);
state().commitKey();
assert.equal(object(characterId).keyframes[0].interpolation, 'linear', 'editing a generated key preserves interpolation');
state().undo();
state().undo();
assert.deepEqual(state().project, before);

for (const action of ['walk', 'run', 'idle', 'jump', 'wave']) {
  state().generateMotion({ action, duration: 1, intensity: 1, repeats: 2 });
  assert.equal(object(characterId).keyframes.at(-1).time, 2, `${action} duration`);
  assert.equal(object(characterId).joints.leftLeg.length, 49, `${action} sampled keys`);
  assert.equal(isValidProject(state().project), true, `${action} project validity`);
  state().undo();
}

// Direction changes the travel path and keeps the character facing that way.
state().generateMotion({ action: 'walk', duration: 1, intensity: 1, repeats: 1, direction: 90 });
const directedEnd = object(characterId).keyframes.at(-1).value;
assert.ok(Math.abs(directedEnd.position[0] + 1.1) < 1e-9, '90° walks toward -X');
assert.ok(Math.abs(directedEnd.position[2]) < 1e-9, '90° has no forward (-Z) travel');
assert.equal(directedEnd.rotation[1], 0, 'direction steers travel without rotating the character');
assert.equal(isValidProject(state().project), true);
state().undo();

// Regenerating must not accumulate the previous clip's yaw.
for (const direction of [0, 180, 0]) state().generateMotion({ action: 'walk', duration: 1, intensity: 1, repeats: 1, direction });
const reforward = object(characterId).keyframes.at(-1).value;
assert.ok(Math.abs(reforward.position[2] + 1.1) < 1e-9, 'forward after backward still walks forward');
assert.equal(reforward.rotation[1], 0, 'forward after backward faces forward');
state().undo();
state().undo();
state().undo();

// Add mode appends a clip and preserves the existing tracks instead of replacing them.
state().generateMotion({ action: 'wave', duration: 1, intensity: 1, repeats: 1 });
const waveObject = object(characterId);
const waveProject = structuredClone(state().project);
const waveEnd = waveObject.keyframes.at(-1).time;
const waveRootIds = waveObject.keyframes.map(key => key.id);
const waveJointCount = waveObject.joints.leftArm.length;
assert.equal(waveEnd, 1);
state().generateMotion({ action: 'idle', duration: 1, intensity: 1, repeats: 1, mode: 'add' });
const added = object(characterId);
assert.deepEqual(waveRootIds.filter(id => added.keyframes.some(key => key.id === id)), waveRootIds, 'existing root keys survive');
assert.ok(added.joints.leftArm.length > waveJointCount, 'new joint keys are appended');
assert.equal(added.keyframes.at(-1).time, 2, 'clip starts at the previous animation end');
assert.equal(new Set(added.keyframes.map(key => key.time)).size, added.keyframes.length, 'no duplicate key times');
assert.equal(isValidProject(state().project), true, 'added motion stays valid');
assert.equal(state().time, waveEnd, 'playhead jumps to the added clip');
assert.deepEqual(sampleObjectPose(added, waveEnd, state().project.interpolation), sampleObjectPose(waveObject, waveEnd, state().project.interpolation), 'pose is continuous at the join');
state().undo();
assert.deepEqual(state().project, waveProject);
state().undo();

state().setTool('rotate');
let controlSyncs = 0;
const unsubscribe = subscribeEditorControls(() => controlSyncs++);
state().play(true);
const playbackOverrides = state().overrides;
const previousTime = state().time;
state().tick(0.05);
assert.notEqual(state().time, previousTime, 'playback advances time');
assert.equal(state().overrides, playbackOverrides, 'playback does not allocate edit state every frame');
assert.equal(controlSyncs, 0, 'time-only playback does not duplicate scene synchronization');
state().setTool('translate');
assert.equal(controlSyncs, 1, 'tool changes still synchronize editor controls');
state().setGridSnap(true);
assert.equal(controlSyncs, 2, 'grid changes still synchronize editor controls');
state().selectObject(otherId);
assert.equal(controlSyncs, 3, 'selection changes still synchronize editor controls');
unsubscribe();

console.log('PASS: procedural motion actions, duration, intensity, repeats, character isolation, project validity, and undo.');
