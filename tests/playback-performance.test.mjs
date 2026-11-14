import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({
  stdin: { contents: `
    export { useEditor } from './src/editor/store';
    export { createProject, createGeneratedMotion } from './src/editor/presets';
    export { createSceneObject } from './src/editor/assets';
    export { StudioScene } from './src/engine/StudioScene';
    export { PreviewQuality } from './src/engine/PreviewQuality';
    export { buildCharacterAsset, characterNodes } from './src/engine/CharacterAsset';
    export { disposeSceneAsset } from './src/engine/SceneAssets';
    export { selectTimelineState } from './src/components/Timeline';
    export { shallow } from 'zustand/vanilla/shallow';
    export { Group, Mesh, Raycaster, Vector3 } from 'three';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { useEditor, createProject, createGeneratedMotion, createSceneObject, StudioScene, selectTimelineState, shallow, Group, Mesh, Raycaster, Vector3, PreviewQuality, buildCharacterAsset, characterNodes, disposeSceneAsset } =
  await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

let project = createProject();
for (let i = project.objects.length; i < 500; i++) project.objects.push(createSceneObject('cube', project.objects));
project = createGeneratedMotion(project, project.objects[0].id, { action: 'walk', duration: 2, intensity: 1, repeats: 10 });
useEditor.getState().loadProject(project);
const studio = Object.create(StudioScene.prototype);
studio.draggingGizmo = false;
studio.assetNodes = new Map(project.objects.map(object => [object.id, { root: new Group() }]));
let transformWrites = 0;
for (const { root } of studio.assetNodes.values()) {
  const set = root.position.set;
  root.position.set = function (...args) { transformWrites++; return set.apply(this, args); };
}

useEditor.getState().play(true);
studio.applySceneObjectPoses();
transformWrites = 0;
let timelineUpdates = 0;
const unsubscribe = useEditor.subscribe((state, previous) => {
  if (!shallow(selectTimelineState(state), selectTimelineState(previous))) timelineUpdates++;
});
const start = performance.now();
for (let i = 0; i < 120; i++) {
  useEditor.getState().tick(1 / 60);
  studio.applySceneObjectPoses();
}
const elapsed = performance.now() - start;
const playbackWrites = transformWrites;
assert.equal(transformWrites, 120, 'only the animated root updates each frame in a 500-object scene');
assert.equal(timelineUpdates, 0, 'playback never invalidates the full timeline tree');
useEditor.getState().play(false);
assert.equal(timelineUpdates, 1, 'transport still updates immediately on pause');
unsubscribe();

// Scrubbing static objects remains cached; changing their pose, previewing and
// clearing an override must each invalidate the cached transform.
const cube = useEditor.getState().project.objects.at(-1);
const root = studio.assetNodes.get(cube.id).root;
const writes = transformWrites;
useEditor.getState().seek(3);
studio.applySceneObjectPoses();
assert.equal(transformWrites - writes, 1, 'scrubbing updates the character but skips static roots');
useEditor.getState().selectObject(cube.id);
useEditor.getState().updatePose(cube.id, { position: [12, 3, 4], rotation: [0, 0, 0], scale: [1, 1, 1] });
studio.applySceneObjectPoses();
assert.deepEqual(root.position.toArray(), [12, 3, 4]);
useEditor.getState().seek(2);
studio.applySceneObjectPoses();
assert.deepEqual(root.position.toArray(), cube.pose.position, 'discarding preview restores the cached static pose');
useEditor.getState().updatePose(cube.id, { position: [9, 8, 7], rotation: [0, 0, 0], scale: [1, 1, 1] });
useEditor.getState().commitKey();
useEditor.getState().seek(2);
studio.applySceneObjectPoses();
assert.deepEqual(root.position.toArray(), [9, 8, 7], 'project edits invalidate the cache');
useEditor.getState().undo();
studio.applySceneObjectPoses();
assert.deepEqual(root.position.toArray(), cube.pose.position, 'undo invalidates the cache');

const captures = [];
studio.scene = {};
studio.playbackCamera = () => 'camera';
studio.renderer = {
  render: (...args) => captures.push(args),
  domElement: { toDataURL: type => { assert.equal(captures.length, 1); return type; } },
};
assert.equal(studio.screenshot(), 'image/png', 'screenshots render immediately before reading a discarded buffer');

const quality = new PreviewQuality();
const sampleFrames = (count, frameMs, active = true) => {
  const stats = [];
  for (let i = 0; i < count; i++) {
    const result = quality.observe(frameMs, active);
    if (result) stats.push(result);
  }
  return stats;
};
sampleFrames(130, 1000 / 60);
assert.deepEqual(quality.settings, { scale: 1, shadows: true }, 'healthy playback retains quality');
assert.equal(sampleFrames(30, 50).at(-1).fps, 20, 'actual frame intervals determine FPS');
assert.deepEqual(quality.settings, { scale: 0.75, shadows: false }, 'slow playback disables shadows and reduces resolution');
sampleFrames(30, 50);
assert.deepEqual(quality.settings, { scale: 0.5, shadows: false }, 'persistent slow playback reduces pixel count further');
sampleFrames(200, 1000 / 60);
assert.equal(quality.settings.scale, 0.5, 'auto avoids quality oscillation');
quality.setMode('quality'); sampleFrames(100, 50);
assert.deepEqual(quality.settings, { scale: 1, shadows: true }, 'manual quality stays fixed');
quality.setMode('fast');
assert.deepEqual(quality.settings, { scale: 0.5, shadows: false }, 'fast mode takes effect immediately');
quality.setMode('auto'); sampleFrames(200, 1000, false);
assert.equal(quality.settings.scale, 1, 'idle or hidden tabs never trigger downgrades');

for (const kind of ['r6Male', 'r6Female']) {
  const object = createSceneObject(kind, []);
  const root = buildCharacterAsset(object);
  root.updateMatrixWorld(true);
  let meshes = 0;
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    meshes++;
    assert.equal(node.userData.objectId, object.id);
    assert.ok(characterNodes(root)[node.userData.jointId], 'merged mesh retains the joint used by selection');
    assert.equal(node.castShadow, true);
  });
  assert.equal(meshes, 11, 'parts with identical material inside a joint share a draw call');
  for (const [joint, x, y] of [['head', 0, 3.22], ['torso', 0, 2.15], ['leftArm', -0.88, 2.11], ['rightArm', 0.88, 2.11], ['leftLeg', -0.31, 0.765], ['rightLeg', 0.31, 0.765]]) {
    const ray = new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(root, true)[0]?.object.userData.jointId, joint, `${kind}: merged ${joint} remains selectable`);
  }
  disposeSceneAsset(root);
}
console.log(`PASS: 500 objects / 120 frames: ${playbackWrites} playback root writes (previously 60000), zero timeline invalidations; CPU sampling loop ${elapsed.toFixed(1)}ms. Cache invalidation and screenshots verified.`);
console.log('PASS: measured FPS, adaptive/manual preview quality, character draw-call merging, and picking every joint.');
