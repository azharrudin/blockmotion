import * as THREE from 'three';
import type { SceneObject } from '../editor/types';

/**
 * Script objects execute user-authored Three.js code. They are NOT sandboxed:
 * the code runs in the page with full browser permissions. Only load projects
 * whose scripts you trust.
 */
function runScript(script: string): THREE.Object3D {
  const result = new Function('THREE', `"use strict";\n${script}`)(THREE) as unknown;
  if (!(result instanceof THREE.Object3D)) throw new Error('Script must return a THREE.Object3D (Mesh, Group, …)');
  return result;
}

function placeholder(object: SceneObject, message: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: '#ff8a9a', wireframe: true, transparent: true, opacity: 0.8 }),
  );
  mesh.position.y = 0.5;
  mesh.userData.objectId = object.id;
  mesh.userData.scriptError = message;
  return mesh;
}

export function buildScriptObject(object: SceneObject): THREE.Group {
  const group = new THREE.Group();
  group.name = object.name;
  if (!object.script) { group.add(placeholder(object, 'No script')); return group; }
  try {
    const result = runScript(object.script);
    result.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.objectId = object.id;
    });
    group.add(result);
  } catch (error) {
    group.add(placeholder(object, error instanceof Error ? error.message : 'Script failed'));
  }
  return group;
}

/** Compile and execute a script without keeping the result; returns an error message or null. */
export function validateScript(script: string): string | null {
  try {
    const result = runScript(script);
    result.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material?.dispose();
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Script failed';
  }
}