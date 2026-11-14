import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: `export { useEditor, isValidProject, persistProject } from './src/editor/store';
 export { TOWN_ASSETS, ROAD_MODULE, ROAD_WIDTH, snapToGrid } from './src/editor/town';
 export { ASSET_CATALOG, createSceneObject } from './src/editor/assets';
 export { buildSceneAsset, disposeSceneAsset } from './src/engine/SceneAssets';
 export { sampleNodePose } from './src/editor/tracks';
 export { StudioScene } from './src/engine/StudioScene';
 export * as THREE from 'three';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node' });
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {useEditor,isValidProject,persistProject,TOWN_ASSETS,ROAD_MODULE,ROAD_WIDTH,snapToGrid,ASSET_CATALOG,createSceneObject,buildSceneAsset,disposeSceneAsset,sampleNodePose,StudioScene,THREE}=api;
const s=()=>useEditor.getState();
const storage=new Map();globalThis.localStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)??null};
assert.equal(Object.keys(TOWN_ASSETS).length,29);assert.equal(Object.keys(ASSET_CATALOG).length,51);
assert.equal(Object.values(ASSET_CATALOG).filter(a=>a.category==='Town').length,37);
assert.equal(ROAD_MODULE,6);assert.equal(ROAD_WIDTH,4);
s().deleteAll();
for(const kind of Object.keys(TOWN_ASSETS)){
 s().seek(0);s().addObject(kind);const id=s().selectedObject;
 s().seek(2);s().updatePose(id,{position:[6,0,-6],rotation:[0,90,0],scale:[1.5,1.5,1.5]});s().commitKey();
 assert.equal(sampleNodePose(s().project,id,1).rotation[1],45,`${kind} animates`);
 assert.equal(isValidProject(s().project),true);
}
assert.equal(persistProject(s().project),true);
const exported=JSON.parse(storage.get('blockmotion-studio-project-v1'));s().loadProject(exported);
assert.deepEqual(s().project.objects,exported.objects,'new presets retain animation across JSON round-trip');
s().selectObject(s().project.objects.find(o=>o.kind==='bus').id);const before=s().project.objects.length;s().duplicateObject();
assert.equal(s().project.objects.length,before+1);s().deleteObject();assert.equal(s().project.objects.length,before);s().undo();assert.equal(s().project.objects.length,before+1);
// The road bend and T junction terminate at the same six-unit module boundaries as existing roads.
for(const kind of ['roadCurve','roadT','crosswalk','parking']){
 const root=buildSceneAsset(createSceneObject(kind,[]));const bounds=new THREE.Box3().setFromObject(root);
 assert.ok(bounds.min.x>=-3.001 && bounds.max.x<=3.001,`${kind} width fits road module`);
 assert.ok(bounds.min.z>=-3.001 && bounds.max.z<=3.001,`${kind} length fits road module`);
 if(kind==='roadCurve'){
  const surface=root.children.find(m=>m.material.userData.tint);const normal=surface.geometry.attributes.normal;
  for(let i=0;i<normal.count;i++)assert.ok(normal.getY(i)>0.99,'road bend faces up');
  assert.ok(Math.abs(bounds.min.z+3)<0.001);assert.ok(Math.abs(bounds.max.x-3)<0.001);
 }
 disposeSceneAsset(root);
}
assert.equal(snapToGrid(6.3,6),6);assert.equal(snapToGrid(-5.8,6),-6);assert.equal(snapToGrid(2.6,0.5),2.5);
s().deleteAll();s().setGridSnap(true);s().setGridSize(6);
for(let i=0;i<12;i++)s().addObject(i%2?'roadCurve':'roadT');
const positions=s().project.objects.map(o=>o.pose.position);
assert.equal(new Set(positions.map(p=>p.join(','))).size,12,'snapped spawns do not stack');
for(const object of s().project.objects){assert.ok(object.pose.position.every(v=>v%6===0));assert.deepEqual(object.keyframes[0].value.position,object.pose.position);}
s().setGridSize(0);assert.equal(s().gridSize,6,'invalid grid steps are ignored');
s().setGridSize(NaN);assert.equal(s().gridSize,6);
// Check integration with the actual scene reconciliation and the transform-control settings.
const studio=Object.create(StudioScene.prototype);studio.scene=new THREE.Scene();studio.assetNodes=new Map();studio.shotCamera=new THREE.PerspectiveCamera();
studio.controls={object:null,attach(object){this.object=object;},detach(){this.object=null;},setMode(mode){this.mode=mode;},setTranslationSnap(snap){this.translationSnap=snap;},setSpace(space){this.space=space;}};
studio.controlsHelper={};studio.orbit={};studio.cameraHelper={};studio.draggingGizmo=false;
s().setTool('translate');studio.syncEditorControls();assert.equal(studio.controls.translationSnap,6);assert.equal(studio.controls.space,'world');
s().addObject('r6Female');const actor=s().selectedObject;s().selectObject(actor,'leftArm');studio.syncEditorControls();
assert.equal(studio.controls.translationSnap,null,'joint movement is never snapped');assert.equal(studio.controls.space,'local');
s().selectObject(actor);s().setGridSnap(false);studio.syncEditorControls();assert.equal(studio.controls.translationSnap,null);
s().deleteAll();studio.syncSceneObjects();assert.equal(studio.assetNodes.size,0);
console.log('PASS: 29 new Town assets, animation/JSON compatibility, modular road boundaries and normals, snapped spawn placement, valid grid steps, gizmo snap integration, free joint editing, and cleanup.');
