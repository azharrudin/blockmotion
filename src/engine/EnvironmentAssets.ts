import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneObject, TerrainConfig, Vec3 } from '../editor/types';
import { TERRAIN_SEGMENTS, terrainVertexHeight } from '../editor/terrain';

export function buildTerrain(object: SceneObject): THREE.Group {
  const config: TerrainConfig=object.terrain??{biome:'mountains',size:36,height:10,seed:1};
  const root=new THREE.Group();root.name=object.name;
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const low=new THREE.Color(config.biome==='desert'?'#d6b57d':config.biome==='jungle'?'#4f7745':'#647b52');
  const rock=new THREE.Color('#92918b'),snow=new THREE.Color('#e9edf0');
  for(let z=0;z<=TERRAIN_SEGMENTS;z++)for(let x=0;x<=TERRAIN_SEGMENTS;x++){
    const px=(x/TERRAIN_SEGMENTS-0.5)*config.size,pz=(z/TERRAIN_SEGMENTS-0.5)*config.size;
    const y=terrainVertexHeight(config,px,pz);positions.push(px,y,pz);
    const elevation=config.height?Math.max(0,Math.min(1,(y-0.04)/config.height)):0;
    const color=low.clone();
    if(config.biome==='mountains'){color.lerp(rock,Math.min(1,elevation*1.7));if(elevation>0.65)color.lerp(snow,(elevation-0.65)/0.35);}
    else color.multiplyScalar(0.85+elevation*0.25);
    colors.push(color.r,color.g,color.b);
    if(x<TERRAIN_SEGMENTS&&z<TERRAIN_SEGMENTS){const a=z*(TERRAIN_SEGMENTS+1)+x,b=a+1,c=a+TERRAIN_SEGMENTS+1,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:object.color,vertexColors:true,flatShading:true,roughness:1});material.userData.tint=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.objectId=object.id;mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);return root;
}
export function buildVegetation(object: SceneObject): THREE.Group {
  const root=new THREE.Group();root.name=object.name;
  const foliage=new THREE.MeshStandardMaterial({color:object.color,roughness:0.9});foliage.userData.tint=true;
  const trunk=new THREE.MeshStandardMaterial({color:object.kind==='cactus'?'#62805a':'#806044',roughness:1});
  const add=(geometry:THREE.BufferGeometry,at:Vec3,material=foliage)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...at);mesh.userData.objectId=object.id;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
  if(object.kind==='cactus'){
    add(new THREE.CylinderGeometry(0.24,0.28,2.6,8),[0,1.3,0]);add(new THREE.SphereGeometry(0.24,8,6),[0,2.6,0]);
    for(const [x,y]of [[-0.55,1.5],[0.6,1.05]]){
      const branch=add(new THREE.CylinderGeometry(0.16,0.18,Math.abs(x),8),[x/2,y,0]);branch.rotation.z=Math.PI/2;
      add(new THREE.CylinderGeometry(0.16,0.17,0.8,8),[x,y+0.4,0]);add(new THREE.SphereGeometry(0.16,8,6),[x,y+0.8,0]);
    }
    trunk.dispose();
  }else if(object.kind==='palm'){
    add(new THREE.CylinderGeometry(0.12,0.23,4.3,9),[0,2.15,0],trunk);
    for(let i=0;i<7;i++){
      const angle=i*Math.PI*2/7;const leaf=add(new THREE.BoxGeometry(0.48,0.09,2.35),[Math.sin(angle)*0.92,4.3,Math.cos(angle)*0.92]);leaf.rotation.set(0.22,angle,0);
    }
    for(const x of [-0.15,0.15])add(new THREE.IcosahedronGeometry(0.18,0),[x,4.02,0],trunk);
  }else{
    add(new THREE.CylinderGeometry(0.14,0.34,4.8,10),[0,2.4,0],trunk);
    for(const [x,y,z,r]of [[0,5,0,1.6],[-1.1,4.4,0.1,1.2],[1.05,4.5,-0.2,1.25],[0.2,4.35,1,1.15]])add(new THREE.IcosahedronGeometry(r,1),[x,y,z]);
    for(const x of [-0.9,0.9])add(new THREE.CylinderGeometry(0.035,0.045,2,5),[x,3.65,0.35]);
  }
  return root;
}
export function buildRoadNetwork(object: SceneObject): THREE.Group {
  const grid=object.roadGrid??{columns:2,rows:2,blockSize:18};
  const root=new THREE.Group();root.name=object.name;
  const buckets={asphalt:[] as THREE.BufferGeometry[],markings:[] as THREE.BufferGeometry[],sidewalk:[] as THREE.BufferGeometry[]};
  const box=(bucket:keyof typeof buckets,size:Vec3,at:Vec3)=>{const g=new THREE.BoxGeometry(...size);g.translate(...at);buckets[bucket].push(g);};
  const halfW=grid.columns*18/2,halfD=grid.rows*18/2;
  for(let row=0;row<=grid.rows;row++){
    const z=-halfD+row*18;box('asphalt',[halfW*2+6,0.08,4],[0,0.04,z]);
    for(let col=0;col<grid.columns;col++)for(const dx of [-5.5,-2.8,0,2.8,5.5])box('markings',[1.2,0.012,0.1],[-halfW+col*18+9+dx,0.088,z]);
  }
  for(let col=0;col<=grid.columns;col++){
    const x=-halfW+col*18;box('asphalt',[4,0.08,halfD*2+6],[x,0.04,0]);
    for(let row=0;row<grid.rows;row++)for(const dz of [-5.5,-2.8,0,2.8,5.5])box('markings',[0.1,0.012,1.2],[x,0.088,-halfD+row*18+9+dz]);
  }
  for(let row=0;row<grid.rows;row++)for(let col=0;col<grid.columns;col++){
    const cx=-halfW+col*18+9,cz=-halfD+row*18+9;
    for(const side of [-1,1]){box('sidewalk',[1,0.16,14],[cx+side*6.5,0.08,cz]);box('sidewalk',[12,0.16,1],[cx,0.08,cz+side*6.5]);}
  }
  for(const [name,geometries]of Object.entries(buckets)){
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    const material=new THREE.MeshStandardMaterial({color:name==='asphalt'?object.color:name==='markings'?'#ead298':'#b6bdbb',roughness:0.95});
    if(name==='asphalt')material.userData.tint=true;
    if(name==='markings'){material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;}
    const mesh=new THREE.Mesh(geometry,material);mesh.userData.objectId=object.id;mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);
  }
  return root;
}
