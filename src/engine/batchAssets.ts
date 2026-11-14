import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Static prop parts share one draw call per material; character joints stay separate. */
export function batchAssetMeshes(root: THREE.Group): THREE.Group {
  const groups=new Map<string,THREE.Mesh<THREE.BufferGeometry,THREE.Material>[]>();
  for(const child of root.children){
    if(!(child instanceof THREE.Mesh)||Array.isArray(child.material))continue;
    const key=`${child.material.uuid}:${child.castShadow}:${child.receiveShadow}:${child.renderOrder}:${Object.keys(child.geometry.attributes).sort().join(',')}`;
    const meshes=groups.get(key)??[];meshes.push(child);groups.set(key,meshes);
  }
  for(const meshes of groups.values()){
    if(meshes.length<2)continue;
    const geometries=meshes.map(mesh=>{
      mesh.updateMatrix();
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
      if(geometry!==mesh.geometry)mesh.geometry.dispose();
      geometry.applyMatrix4(mesh.matrix);root.remove(mesh);return geometry;
    });
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    const first=meshes[0],mesh=new THREE.Mesh(geometry,first.material);
    mesh.userData={...first.userData};mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;root.add(mesh);
  }
  return root;
}
