import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `
  export { useEditor, isValidProject } from './src/editor/store';
  export { isValidImportedModel, MAX_MODEL_DATA } from './src/editor/assets';
  export { buildSceneAsset, disposeSceneAsset } from './src/engine/SceneAssets';
  export { validateScript } from './src/engine/ScriptAssets';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node' });
const { useEditor, isValidProject, isValidImportedModel, MAX_MODEL_DATA, buildSceneAsset, disposeSceneAsset, validateScript } =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

const state = () => useEditor.getState();
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const meshCount = group => { let count = 0; group.traverse(child => { if (child.isMesh) count++; }); return count; };

state().newProject();

const tiny = 'data:model/gltf-binary;base64,AAAA';
state().addImportedModel({ name: 'Test model', data: tiny, format: 'glb' });
const imported = state().project.objects.at(-1);
assert.equal(imported.kind, 'imported');
assert.equal(imported.model.data, tiny);
assert.equal(isValidProject(state().project), true);
const placeholder = buildSceneAsset(imported);
assert.equal(meshCount(placeholder), 1, 'imported models show a placeholder until parsed');
disposeSceneAsset(placeholder);

assert.equal(isValidImportedModel({ name: 'x', data: 'nope', format: 'glb' }), false);
assert.equal(isValidImportedModel({ name: 'x', data: tiny, format: 'obj' }), false);
assert.equal(isValidImportedModel({ name: 'x', data: `data:${'a'.repeat(MAX_MODEL_DATA)}`, format: 'glb' }), false);
assert.equal(MAX_MODEL_DATA, 4_000_000);

// Script objects: user-authored Three.js code returning an Object3D.
state().addObject('script');
const scriptObject = state().project.objects.at(-1);
assert.equal(scriptObject.kind, 'script');
assert.ok(scriptObject.script.length > 0);
assert.equal(isValidProject(state().project), true);
const scriptBuilt = buildSceneAsset(scriptObject);
assert.ok(meshCount(scriptBuilt) >= 1, 'default script builds geometry');
scriptBuilt.traverse(child => { if (child.isMesh) assert.equal(child.userData.objectId, scriptObject.id); });
disposeSceneAsset(scriptBuilt);
const sphereScript = `return new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: '#ff0000' }));`;
state().updateScript(scriptObject.id, sphereScript);
assert.equal(state().project.objects.find(object => object.id === scriptObject.id).script, sphereScript);
const sphereBuilt = buildSceneAsset(state().project.objects.find(object => object.id === scriptObject.id));
assert.equal(meshCount(sphereBuilt), 1);
disposeSceneAsset(sphereBuilt);
assert.equal(validateScript('return 42'), 'Script must return a THREE.Object3D (Mesh, Group, …)');
assert.notEqual(validateScript('this is not js'), null);
state().updateScript(scriptObject.id, 'throw new Error("boom")');
assert.equal(isValidProject(state().project), true);
const broken = buildSceneAsset(state().project.objects.find(object => object.id === scriptObject.id));
assert.equal(meshCount(broken), 1, 'runtime failures fall back to an error placeholder');
disposeSceneAsset(broken);
const invalidScript = structuredClone(state().project);
invalidScript.objects.find(object => object.id === scriptObject.id).script = '';
assert.equal(isValidProject(invalidScript), false, 'script objects require a script');

console.log('PASS: embedded imported model validation/build placeholders and Three.js script objects.');