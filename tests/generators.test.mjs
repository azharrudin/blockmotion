import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export {useEditor,isValidProject,persistProject} from './src/editor/store';
 export {generatorDefaults,createEnvironmentPlan,materializeEnvironment,generatorError} from './src/editor/generators';
 export {terrainHeightAt} from './src/editor/terrain';
 export {buildSceneAsset,disposeSceneAsset} from './src/engine/SceneAssets';
 export {getTrack} from './src/editor/tracks';
 export {StudioScene} from './src/engine/StudioScene';
 export * as THREE from 'three';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {useEditor,isValidProject,persistProject,generatorDefaults,createEnvironmentPlan,materializeEnvironment,generatorError,terrainHeightAt,buildSceneAsset,disposeSceneAsset,getTrack,StudioScene,THREE}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const s=()=>useEditor.getState();
const storage=new Map();globalThis.localStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)??null};
for(const kind of ['town','city','mountains','jungle','desert']){
 const options={...generatorDefaults(kind),mode:'replace'};
 const plan=createEnvironmentPlan(options);
 assert.deepEqual(createEnvironmentPlan(options),plan,`${kind} is deterministic`);
 assert.notDeepEqual(createEnvironmentPlan({...options,seed:43}),plan,`${kind} changes with its seed`);
 const shifted=createEnvironmentPlan({...options,originX:12,originZ:-18});
 shifted.objects.forEach((object,i)=>{assert.ok(Math.abs(object.pose.position[0]-plan.objects[i].pose.position[0]-12)<1e-9);assert.ok(Math.abs(object.pose.position[2]-plan.objects[i].pose.position[2]+18)<1e-9);});
 const history=s().past.length;const ids=s().generateEnvironment(options);
 assert.equal(ids.length,plan.objects.length);assert.equal(s().project.objects.length,ids.length);assert.equal(s().past.length,Math.min(50,history+1));assert.equal(isValidProject(s().project),true);
 for(const object of s().project.objects){assert.equal(getTrack(s().project,object.id).length,1);assert.deepEqual(object.keyframes[0].value,object.pose);}
 if(['mountains','jungle','desert'].includes(kind)){
  const terrain=s().project.objects[0];assert.equal(terrain.terrain.biome,kind);
  const root=buildSceneAsset(terrain);root.updateMatrixWorld(true);const mesh=root.children[0];
  assert.ok(mesh.geometry.attributes.position.count>1000);assert.ok(mesh.material.vertexColors);
  const heightRange=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;assert.ok(heightRange>options.height*0.2,`${kind} has real relief`);
  for(const object of s().project.objects.slice(1)){
   const [x,y,z]=object.pose.position;assert.ok(Math.abs(y-terrainHeightAt(terrain.terrain,x,z))<1e-9,'vegetation uses terrain height');
   const ray=new THREE.Raycaster(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-y)<0.0001,'plants sit on the rendered triangles');
  }
  assert.equal(s().project.objects.filter(o=>!['terrain','rock','bush'].includes(o.kind)).length,options.treeCount);
  disposeSceneAsset(root);
 }else{
  assert.equal(s().project.objects.filter(o=>!['terrain','roadNetwork','tree','flowerPot','streetlight','bench','trashBin'].includes(o.kind)).length,options.columns*options.rows*options.lotsPerBlock);
  const road=s().project.objects.find(o=>o.kind==='roadNetwork');const root=buildSceneAsset(road);assert.equal(root.children.length,3,'road network is batched into three meshes');disposeSceneAsset(root);
 }
 const generated=structuredClone(s().project);s().undo();s().redo();assert.deepEqual(s().project,generated);
 assert.equal(persistProject(s().project),true);s().loadProject(JSON.parse(storage.get('blockmotion-studio-project-v1')));assert.deepEqual(s().project,generated,'descriptor and layout round-trip');
}
const city={...generatorDefaults('city'),columns:8,rows:8,lotsPerBlock:2,treeCount:0,details:false,mode:'replace'};
const grid=createEnvironmentPlan(city);assert.equal(grid.blocks,64);assert.equal(grid.buildings,128);assert.equal(grid.objects.length,130);
assert.ok(s().generateEnvironment(city).length>0);assert.equal(isValidProject(s().project),true);
const noPlants={...generatorDefaults('jungle'),treeCount:0,rockCount:0,mode:'replace'};assert.equal(s().generateEnvironment(noPlants).length,1);
s().newProject();const existing=s().project.objects[0].id;const append={...generatorDefaults('town'),columns:1,rows:1,lotsPerBlock:1,treeCount:0,details:false,mode:'append'};
const before=structuredClone(s().project);const added=s().generateEnvironment(append);assert.equal(added.length,3);assert.ok(s().project.objects.some(o=>o.id===existing));s().undo();assert.deepEqual(s().project,before);
const tooLarge={...generatorDefaults('city'),columns:8,rows:8,lotsPerBlock:3,treeCount:250,mode:'replace'};
const unchanged=s().project;const past=s().past.length;assert.deepEqual(s().generateEnvironment(tooLarge),[]);assert.equal(s().project,unchanged);assert.equal(s().past.length,past,'capacity rejection is atomic');
for(const patch of [{columns:0},{rows:9},{lotsPerBlock:4},{size:NaN},{height:36},{treeCount:-1},{rockCount:61},{seed:1.5},{originX:Infinity},{mode:'invalid'},{kind:'__proto__'}]){
 const invalid={...generatorDefaults('town'),...patch};assert.ok(generatorError(invalid));assert.deepEqual(s().generateEnvironment(invalid),[]);assert.equal(s().project,unchanged);
}
// Frame a large generation with the actual Three.js scene; fit/fog must not hide it.
s().generateEnvironment({...generatorDefaults('mountains'),treeCount:8,rockCount:2,mode:'replace'});
const studio=Object.create(StudioScene.prototype);studio.scene=new THREE.Scene();studio.scene.fog=new THREE.Fog('#141b2b',15,46);studio.assetNodes=new Map();studio.controls={object:null,detach(){this.object=null;}};studio.draggingGizmo=false;
studio.editorCamera=new THREE.PerspectiveCamera(42,1.5,0.1,2000);studio.orbit={maxDistance:45,target:new THREE.Vector3(),update(){studio.editorCamera.lookAt(this.target);}};
studio.syncSceneObjects();assert.ok(studio.scene.fog.far>46);assert.ok(studio.orbit.maxDistance>45);
for(const aspect of [1.5,0.45]){
 studio.editorCamera.aspect=aspect;studio.editorCamera.updateProjectionMatrix();studio.focusObjects();studio.editorCamera.updateMatrixWorld(true);
 const bounds=studio.sceneBounds();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const p=new THREE.Vector3(x,y,z).project(studio.editorCamera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,'framing fits all world bounds');
 }
 assert.ok(studio.editorCamera.position.distanceTo(studio.orbit.target)<studio.scene.fog.far,'framed result remains visible');
}
const terrain=s().project.objects[0];const previous=studio.assetNodes.get(terrain.id).root;let disposed=0;previous.children[0].geometry.addEventListener('dispose',()=>disposed++);
s().loadProject({...s().project,objects:s().project.objects.map(o=>o.id===terrain.id?{...o,terrain:{...o.terrain,seed:99}}:o)});studio.syncSceneObjects();assert.notEqual(studio.assetNodes.get(terrain.id).root,previous);assert.equal(disposed,1,'terrain descriptor changes rebuild and dispose geometry');
for(const patch of [{terrain:{biome:'unknown',size:60,height:3,seed:1}},{terrain:{biome:'desert',size:999,height:3,seed:1}}])assert.equal(isValidProject({...s().project,objects:[{...terrain,...patch}]}),false);
const network=materializeEnvironment(createEnvironmentPlan(generatorDefaults('town')),'town').find(o=>o.kind==='roadNetwork');assert.equal(isValidProject({...s().project,objects:[{...network,roadGrid:{columns:99,rows:1,blockSize:18}}]}),false);
s().deleteAll();studio.syncSceneObjects();assert.equal(studio.assetNodes.size,0);assert.equal(studio.scene.fog.far,46);
console.log('PASS: five deterministic generators, custom city block counts, terrain surface placement, batched roads, append/replace, capacity validation, atomic undo/redo, descriptor persistence, geometry rebuild/disposal, and large-scene framing/fog.');
