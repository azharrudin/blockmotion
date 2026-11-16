import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `
  export { useEditor, isValidProject } from './src/editor/store';
  export { isValidWelds } from './src/editor/assets';
  export { weldedWorldPose, activeWeld, relativeOffset, targetNodeWorldPose } from './src/editor/attachments';
  export { sampleObjectPose } from './src/editor/interpolation';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node' });
const { useEditor, isValidProject, isValidWelds, weldedWorldPose, activeWeld, relativeOffset, targetNodeWorldPose, sampleObjectPose } =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

const state = () => useEditor.getState();
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const object = id => state().project.objects.find(item => item.id === id);
const close = (a, b, epsilon = 1e-5) => a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) < epsilon);

state().newProject();
const character = state().selectedObject;
state().addObject('cube');
const gun = state().selectedObject;

state().seek(0);
state().weldObject(gun, character, 'rightArm');
const weld = activeWeld(object(gun), 0);
assert.equal(weld.targetId, character);
assert.equal(weld.joint, 'rightArm');
const weldedAtZero = weldedWorldPose(state().project, object(gun), 0);
assert.ok(weldedAtZero, 'gun is welded at frame 0');
assert.ok(close(weldedAtZero.position, sampleObjectPose(object(gun), 0, state().project.interpolation).position), 'welding keeps the current world pose');

// Move the character; the welded gun follows the animated arm.
state().selectObject(character);
state().seek(2);
const moved = structuredClone(object(character).keyframes[0].value);
moved.position = [0, 0, -2];
state().updatePose(character, moved);
state().commitKey(character);
const weldedAtTwo = weldedWorldPose(state().project, object(gun), 2);
assert.ok(weldedAtTwo, 'weld is still active at frame 2');
assert.ok(close(weldedAtTwo.position, [weldedAtZero.position[0], weldedAtZero.position[1], weldedAtZero.position[2] - 2]), 'gun follows the character');
assert.ok(weldedWorldPose(state().project, object(gun), 1.5), 'weld active between keyframes');
assert.equal(isValidProject(state().project), true);

// Detach is a timeline key; the welded pose is baked into the object track.
state().seek(2);
const beforeDetach = weldedWorldPose(state().project, object(gun), 2);
state().detachObject(gun);
assert.equal(activeWeld(object(gun), 2).targetId, null, 'detach key stops the weld');
assert.equal(weldedWorldPose(state().project, object(gun), 2), null);
assert.ok(weldedWorldPose(state().project, object(gun), 1.9), 'weld remains active before the detach frame');
const baked = object(gun).keyframes.find(key => Math.abs(key.time - 2) < 1e-9);
assert.ok(baked, 'detach bakes a keyframe');
assert.ok(close(baked.value.position, beforeDetach.position), 'baked pose matches the welded pose');
assert.ok(close(sampleObjectPose(object(gun), 2, state().project.interpolation).position, beforeDetach.position), 'released object holds its world pose');
assert.equal(isValidProject(state().project), true);

// Deleting the weld target cleans dangling weld references.
state().selectObject(gun);
state().seek(0);
state().weldObject(gun, character, 'leftArm');
assert.ok(object(gun).welds.some(item => item.targetId === character));
state().selectObject(character);
state().deleteObject();
assert.ok(!object(gun).welds.some(item => item.targetId === character), 'deleting a target removes its weld keys');
assert.equal(isValidProject(state().project), true);

assert.equal(isValidWelds([{ id: 'weld_a', time: 0, targetId: null }], 4), true);
assert.equal(isValidWelds([{ id: 'weld_a', time: 0, targetId: 'obj_target' }], 4), false, 'welds need an offset');
assert.equal(isValidWelds([{ id: 'weld_a', time: -1, targetId: null }], 4), false);
assert.equal(isValidWelds([{ id: 'weld_a', time: 0, targetId: null }, { id: 'weld_b', time: 0, targetId: null }], 4), false, 'duplicate weld times are invalid');

console.log('PASS: universal weld keys, animated target following, detach baking, target cleanup, and validation.');