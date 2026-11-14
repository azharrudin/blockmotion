import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneObject, Vec3 } from '../editor/types';
import { ROAD_MODULE, ROAD_WIDTH } from '../editor/town';

// Small geometry lettering keeps signs readable without fonts, textures or downloads.
const GLYPHS: Record<string, string[]> = {
  A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['111','100','100','100','111'],
  D:['110','101','101','101','110'],E:['111','100','110','100','111'],F:['111','100','110','100','100'],
  G:['111','100','101','101','111'],H:['101','101','111','101','101'],I:['111','010','010','010','111'],
  J:['001','001','001','101','111'],K:['101','101','110','101','101'],L:['100','100','100','100','111'],
  M:['101','111','111','101','101'],N:['101','111','111','111','101'],O:['111','101','101','101','111'],
  P:['110','101','110','100','100'],Q:['111','101','101','111','001'],R:['110','101','110','101','101'],
  S:['111','100','111','001','111'],T:['111','010','010','010','010'],U:['101','101','101','101','111'],
  V:['101','101','101','101','010'],W:['101','101','111','111','101'],X:['101','101','010','101','101'],
  Y:['101','101','010','010','010'],Z:['111','001','010','100','111'],
};

export function buildTownAsset(object: SceneObject): THREE.Group {
  const root = new THREE.Group(); root.name = object.name;
  const primary = new THREE.MeshStandardMaterial({ color: object.color, roughness: 0.85 });
  primary.userData.tint = true;
  const accents = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color?: string) => {
    if (!color) return primary;
    let mat = accents.get(color);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 }); accents.set(color, mat); }
    return mat;
  };
  const mesh = (geometry: THREE.BufferGeometry, at: Vec3, color?: string) => {
    const item = new THREE.Mesh(geometry, material(color)); item.position.set(...at);
    item.castShadow = true; item.receiveShadow = true; item.userData.objectId = object.id; root.add(item); return item;
  };
  const box = (size: Vec3, at: Vec3, color?: string) => mesh(new THREE.BoxGeometry(...size), at, color);
  const cylinder = (radius: number, height: number, at: Vec3, color?: string, sides = 16) => mesh(new THREE.CylinderGeometry(radius, radius, height, sides), at, color);
  const sphere = (radius: number, at: Vec3, color?: string) => mesh(new THREE.IcosahedronGeometry(radius, 1), at, color);
  const text = (word: string, width: number, height: number, at: Vec3, color = '#fff2d6') => {
    const cellX = width / (word.length * 4 - 1), cellY = height / 5;
    const pixels: THREE.BufferGeometry[] = [];
    [...word].forEach((char, index) => (GLYPHS[char] ?? []).forEach((row, y) => [...row].forEach((pixel, x) => {
      if (pixel !== '1') return;
      const geometry = new THREE.BoxGeometry(cellX * 0.84, cellY * 0.84, 0.025);
      geometry.translate(-width / 2 + (index * 4 + x + 0.5) * cellX, height / 2 - (y + 0.5) * cellY, 0);
      pixels.push(geometry);
    })));
    if (pixels.length) {
      const geometry = mergeGeometries(pixels);
      pixels.forEach(pixel => pixel.dispose());
      mesh(geometry, at, color);
    }
  };
  const arc = (inner: number, outer: number, start: number, end: number, at: Vec3, color?: string) => {
    const segments = Math.max(2, Math.ceil((end - start) * 24));
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = start + (end - start) * i / segments;
      for (const radius of [outer, inner]) positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const item = mesh(geometry, at, color); item.castShadow = false; return item;
  };
  const window = (x: number, y: number, z: number, width = 0.65, height = 0.9) => {
    box([width + 0.12, height + 0.12, 0.06], [x, y, z], '#e8e5d8');
    box([width, height, 0.07], [x, y, z + 0.025], '#83b4cd');
  };
  const door = (x: number, z: number) => {
    box([0.9, 1.9, 0.08], [x, 0.95, z], '#506e7c');
    box([0.06, 0.28, 0.06], [x + 0.28, 1, z + 0.06], '#e8db9d');
  };
  const wheels = (width: number, zPositions: number[], radius: number) => {
    for (const x of [-width / 2, width / 2]) for (const z of zPositions) {
      const tire = cylinder(radius, 0.24, [x, radius, z], '#252c35'); tire.rotation.z = Math.PI / 2;
      const hub = cylinder(radius * 0.48, 0.255, [x, radius, z], '#b8c0c7'); hub.rotation.z = Math.PI / 2;
    }
  };
  const white = '#eeefde', yellow = '#f5d16a';
  switch (object.kind) {
    case 'roadCurve':
      arc(1, 5, Math.PI / 2, Math.PI, [3, 0.08, -3]);
      for (const radius of [1.06, 4.94]) arc(radius - 0.035, radius + 0.035, Math.PI / 2, Math.PI, [3, 0.088, -3], white);
      for (let angle = Math.PI / 2 + 0.12; angle < Math.PI - 0.12; angle += 0.42) arc(2.95, 3.05, angle, Math.min(angle + 0.2, Math.PI), [3, 0.09, -3], yellow);
      break;
    case 'roadT':
      box([ROAD_MODULE, 0.08, ROAD_WIDTH], [0, 0.04, 0]); box([4, 0.08, 1], [0, 0.04, -2.5]);
      box([6, 0.012, 0.07], [0, 0.088, 1.94], white);
      for (const x of [-2.5, 2.5]) { box([0.75, 0.012, 0.1], [x, 0.088, 0], yellow); box([1, 0.012, 0.07], [x, 0.088, -1.94], white); }
      for (const x of [-1.94, 1.94]) box([0.07, 0.012, 1], [x, 0.088, -2.5], white);
      break;
    case 'sidewalk':
      box([1, 0.18, 6], [0, 0.09, 0]);
      box([0.12, 0.05, 6], [-0.44, 0.205, 0], '#dedfd6');
      for (const z of [-2, -1, 0, 1, 2]) box([0.84, 0.008, 0.025], [0.06, 0.184, z], '#939da4');
      break;
    case 'sidewalkCorner':
      arc(0.01, 1, 0, Math.PI / 2, [0, 0.18, 0]);
      arc(0.88, 1, 0, Math.PI / 2, [0, 0.2, 0], '#dedfd6');
      break;
    case 'crosswalk':
      box([4, 0.08, 6], [0, 0.04, 0]);
      for (let x = -1.65; x < 1.7; x += 0.55) box([0.32, 0.012, 2], [x, 0.088, 0], white);
      for (const x of [-1.94, 1.94]) box([0.07, 0.012, 6], [x, 0.088, 0], white);
      break;
    case 'parking':
      box([6, 0.08, 6], [0, 0.04, 0]);
      for (const x of [-2.95, -1, 1, 2.95]) box([0.07, 0.012, 4], [x, 0.088, -0.95], white);
      box([6, 0.012, 0.07], [0, 0.088, 1.05], white);
      cylinder(0.04, 1.9, [2.6, 0.95, 2.6], '#85939c');
      box([0.65, 0.7, 0.08], [2.6, 2, 2.6], '#4977b0'); text('P', 0.35, 0.45, [2.6, 2, 2.66]);
      break;
    case 'trafficLight':
      cylinder(0.16, 0.14, [0, 0.07, 0]); cylinder(0.065, 2.9, [0, 1.5, 0]);
      box([0.55, 1.4, 0.35], [0, 3.1, 0], '#29333b');
      for (const [i, color] of ['#f37266', '#6c5933', '#2d5d49'].entries()) {
        const lens = cylinder(0.15, 0.04, [0, 3.55 - i * 0.43, 0.2], color); lens.rotation.x = Math.PI / 2;
        if (i === 0) { lens.material.emissive.set(color); lens.material.emissiveIntensity = 0.7; }
        box([0.42, 0.04, 0.25], [0, 3.75 - i * 0.43, 0.25], '#29333b');
      }
      break;
    case 'roadSign': {
      cylinder(0.045, 2.1, [0, 1.05, 0], '#89969f');
      const edge = cylinder(0.59, 0.08, [0, 2.2, 0], '#f4eee0', 8); edge.rotation.x = Math.PI / 2;
      const face = cylinder(0.53, 0.09, [0, 2.2, 0.03], undefined, 8); face.rotation.x = Math.PI / 2;
      text('STOP', 0.8, 0.23, [0, 2.2, 0.1]); break;
    }
    case 'barrier':
      for (const x of [-1.15, 1.15]) { box([0.2, 0.9, 0.2], [x, 0.45, 0], '#5b6470'); box([0.55, 0.12, 0.7], [x, 0.06, 0], '#5b6470'); }
      box([2.8, 0.48, 0.18], [0, 0.82, 0]);
      for (let x = -1.05; x < 1.3; x += 0.6) { const stripe = box([0.22, 0.38, 0.025], [x, 0.82, 0.108], '#f5ead5'); stripe.rotation.z = -0.35; }
      break;
    case 'trashBin':
      box([0.65, 0.85, 0.65], [0, 0.45, 0]); box([0.73, 0.12, 0.73], [0, 0.94, 0]);
      box([0.3, 0.1, 0.04], [0, 0.73, 0.35], '#253d3b');
      for (const x of [-0.23, 0.23]) { const tire = cylinder(0.11, 0.06, [x, 0.11, -0.3], '#28313b'); tire.rotation.z = Math.PI / 2; }
      break;
    case 'car':
      box([1.75, 0.55, 3.6], [0, 0.7, 0]); box([1.5, 0.7, 1.9], [0, 1.25, -0.15]);
      box([1.3, 0.47, 0.04], [0, 1.28, 0.82], '#9bc6d7'); box([1.3, 0.4, 0.04], [0, 1.25, -1.12], '#9bc6d7');
      for (const x of [-0.76, 0.76]) for (const z of [-0.65, 0.25]) box([0.035, 0.43, 0.72], [x, 1.28, z], '#92bdd1');
      for (const x of [-0.6, 0.6]) { box([0.36, 0.2, 0.05], [x, 0.82, 1.83], '#fff0b9'); box([0.3, 0.18, 0.05], [x, 0.8, -1.83], '#bf5351'); }
      box([0.8, 0.18, 0.04], [0, 0.55, 1.84], '#33404b'); wheels(1.75, [-1.1, 1.1], 0.36);
      break;
    case 'motorcycle':
      for (const z of [-0.8, 0.8]) { const tire = cylinder(0.4, 0.18, [0, 0.4, z], '#252c35'); tire.rotation.z = Math.PI / 2; const hub = cylinder(0.22, 0.19, [0, 0.4, z], '#aeb9c1'); hub.rotation.z = Math.PI / 2; }
      box([0.35, 0.25, 1.5], [0, 0.7, 0]); box([0.48, 0.45, 0.65], [0, 1, 0.1]);
      box([0.43, 0.13, 0.65], [0, 1.12, -0.5], '#34404a');
      for (const x of [-0.16, 0.16]) cylinder(0.035, 0.85, [x, 0.86, 0.8], '#aeb9c1');
      box([0.8, 0.07, 0.08], [0, 1.34, 0.75], '#34404a');
      const headlight = cylinder(0.14, 0.08, [0, 1.12, 0.87], '#f5e8b5'); headlight.rotation.x = Math.PI / 2;
      break;
    case 'bus':
      box([2.1, 1.8, 5.4], [0, 1.32, 0]); box([2.16, 0.12, 5.5], [0, 2.28, 0], '#ebebe0');
      box([1.8, 0.9, 0.05], [0, 1.55, 2.73], '#83b4c8');
      for (const x of [-1.07, 1.07]) for (let z = -1.85; z < 1.6; z += 0.9) box([0.04, 0.8, 0.7], [x, 1.6, z], '#83b4c8');
      for (const x of [-0.75, 0.75]) box([0.3, 0.2, 0.06], [x, 0.75, 2.74], '#fff0b9');
      text('BUS', 0.9, 0.25, [0, 2.02, 2.76], '#34404a'); wheels(2.1, [-1.65, 1.65], 0.4);
      break;
    case 'busStop':
      box([3.6, 0.16, 1.8], [0, 0.08, 0], '#c2c7c3');
      for (const x of [-1.6, 1.6]) box([0.12, 2.5, 0.12], [x, 1.3, -0.55]);
      box([3.9, 0.18, 2], [0, 2.65, 0]); box([3.2, 1.8, 0.08], [0, 1.4, -0.58], '#a1c0c8');
      box([2.8, 0.12, 0.5], [0, 0.65, 0], '#ae8b65');
      for (const x of [-1, 1]) box([0.12, 0.5, 0.4], [x, 0.4, 0], '#65717e');
      box([0.65, 0.7, 0.08], [-1.4, 2.05, 0.2]); text('BUS', 0.5, 0.25, [-1.4, 2.05, 0.26]);
      break;
    case 'apartment':
    case 'office': {
      const office = object.kind === 'office';
      box([4.5, 7.2, 4], [0, 3.6, 0]); box([4.8, 0.2, 4.3], [0, 7.3, 0], '#5e6e7b');
      for (let floor = 0; floor < 4; floor++) {
        const y = 1.05 + floor * 1.65;
        for (const x of [-1.45, 0, 1.45]) window(x, y, 2.04, office ? 1.05 : 0.7, 1.05);
        if (!office && floor > 0) { box([4.2, 0.12, 0.6], [0, y - 0.65, 2.25], '#e3d8c2'); box([4.2, 0.12, 0.07], [0, y - 0.05, 2.54], '#74858f'); }
      }
      door(0, 2.1); if (office) text('OFFICE', 2.5, 0.36, [0, 6.95, 2.08]);
      break;
    }
    case 'cafe':
    case 'minimarket': {
      const cafe = object.kind === 'cafe';
      box([4, 2.9, 3], [0, 1.45, 0]); box([4.2, 0.18, 3.2], [0, 3, 0], '#63747a');
      window(-0.8, 1.35, 1.55, 1.65, 1.45); door(1.05, 1.56);
      for (let i = 0; i < 8; i++) { const awning = box([0.5, 0.1, 0.85], [-1.75 + i * 0.5, 2.3, 1.8], i % 2 ? '#f7eed7' : cafe ? '#769781' : '#c75a52'); awning.rotation.x = 0.15; }
      box([3.3, 0.48, 0.12], [0, 2.8, 1.6], cafe ? '#577c70' : '#477a8f'); text(cafe ? 'CAFE' : 'MARKET', 2.6, 0.28, [0, 2.8, 1.68]);
      if (cafe) {
        cylinder(0.48, 0.08, [-1.1, 0.9, 2.7], '#9c7555'); cylinder(0.06, 0.9, [-1.1, 0.45, 2.7], '#65717e');
        for (const x of [-1.8, -0.4]) { box([0.4, 0.08, 0.4], [x, 0.5, 2.7], '#9c7555'); box([0.08, 0.5, 0.08], [x, 0.25, 2.7], '#65717e'); }
      }
      break;
    }
    case 'school':
      box([6, 4.5, 3.5], [0, 2.25, 0]); box([6.4, 0.25, 3.9], [0, 4.65, 0], '#9c6658');
      for (const x of [-2, -0.75, 0.75, 2]) { window(x, 3.1, 1.81, 0.8, 1); if (Math.abs(x) > 1) window(x, 1.35, 1.81, 0.8, 1); }
      door(-0.48, 1.83); door(0.48, 1.83); box([3.1, 0.55, 0.1], [0, 4.13, 1.84], '#637e88'); text('SCHOOL', 2.7, 0.3, [0, 4.13, 1.91]);
      break;
    case 'gasStation':
      box([6, 0.1, 6], [0, 0.05, 0], '#b6bdbb');
      for (const x of [-2.5, 2.5]) box([0.2, 2.9, 0.2], [x, 1.5, 0]);
      box([6, 0.35, 4.5], [0, 3.1, 0]); box([6, 0.08, 4.5], [0, 2.9, 0], '#f4e8d1'); text('GAS', 1.2, 0.2, [0, 3.1, 2.29]);
      for (const x of [-1.4, 1.4]) {
        box([0.65, 1.3, 0.6], [x, 0.75, 0]); box([0.44, 0.3, 0.04], [x, 1, 0.33], '#344953');
        const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(x + 0.35, 1.3, 0), new THREE.Vector3(x + 0.65, 0.4, 0), new THREE.Vector3(x + 0.8, 1, 0.2)]);
        mesh(new THREE.TubeGeometry(hose, 10, 0.035, 5, false), [0, 0, 0], '#34404a');
      }
      break;
    case 'grassTile':
      box([6, 0.06, 6], [0, 0.03, 0]);
      for (const [x, z] of [[-1.8,-1.4],[1.7,1.3],[-0.8,1.8],[1.2,-1.8]]) box([0.15, 0.08, 0.15], [x, 0.1, z], '#8eb269');
      break;
    case 'parkPath':
      box([2, 0.1, 6], [0, 0.05, 0]);
      for (const x of [-1.04, 1.04]) box([0.08, 0.14, 6], [x, 0.07, 0], '#8b978b');
      for (const z of [-2,-1,0,1,2]) box([1.9, 0.01, 0.025], [0, 0.105, z], '#a3977d');
      break;
    case 'flowerPot':
      cylinder(0.4, 0.55, [0, 0.275, 0]); cylinder(0.44, 0.09, [0, 0.56, 0]); cylinder(0.36, 0.025, [0, 0.6, 0], '#615540');
      for (const [x, z] of [[-0.18,0],[0.17,0.13],[0,-0.15]]) { cylinder(0.025, 0.5, [x, 0.86, z], '#5b8951'); sphere(0.14, [x, 1.12, z], '#e59b9e'); sphere(0.07, [x, 1.21, z], '#efd384'); }
      break;
    case 'fountain':
      cylinder(1.4, 0.28, [0, 0.14, 0]); cylinder(1.22, 0.035, [0, 0.3, 0], '#72b9cc');
      cylinder(0.19, 1, [0, 0.75, 0]); cylinder(0.65, 0.12, [0, 1.24, 0]); cylinder(0.53, 0.02, [0, 1.32, 0], '#72b9cc');
      cylinder(0.05, 0.55, [0, 1.58, 0], '#a3d7df'); sphere(0.11, [0, 1.88, 0], '#a3d7df');
      for (const x of [-0.48, 0.48]) cylinder(0.035, 0.7, [x, 0.91, 0], '#a3d7df');
      break;
    case 'playground': {
      for (const x of [-0.6, 0.6]) for (const z of [-0.5, 0.5]) box([0.1, 1.7, 0.1], [x, 0.85, z]);
      box([1.35, 0.12, 1.2], [0, 1.7, 0]);
      const roof = mesh(new THREE.ConeGeometry(1.05, 0.8, 4), [0, 2.4, 0], '#5d91ad'); roof.rotation.y = Math.PI / 4;
      const slide = box([0.75, 0.1, 2.8], [0, 0.9, 1.75], '#db7461'); slide.rotation.x = 0.6;
      for (const x of [-0.45, 0.45]) { const rail = box([0.08, 0.18, 2.8], [x, 1.02, 1.75], '#db7461'); rail.rotation.x = 0.6; }
      for (const x of [-0.45, 0.45]) box([0.08, 1.7, 0.08], [x, 0.85, -0.8], '#627d8b');
      for (let y = 0.25; y < 1.7; y += 0.3) box([0.9, 0.06, 0.08], [0, y, -0.8], '#627d8b');
      break;
    }
    case 'shopSign':
      for (const x of [-0.55, 0.55]) box([0.08, 0.8, 0.08], [x, 0.4, 0], '#8a725b');
      box([1.8, 1, 0.16], [0, 1.2, 0]); text('SHOP', 1.4, 0.38, [0, 1.2, 0.1]);
      break;
    case 'billboard':
      for (const x of [-1.6, 1.6]) box([0.16, 3, 0.16], [x, 1.5, 0], '#72808c');
      box([5.2, 2.4, 0.2], [0, 3.6, 0]); box([4.8, 2, 0.05], [0, 3.6, 0.14], '#e6dbc4');
      text('TOWN', 3.8, 0.65, [0, 3.8, 0.19], '#617b91'); box([3.6, 0.14, 0.04], [0, 3.1, 0.19], '#cc8f60');
      break;
    case 'powerPole':
      cylinder(0.12, 5.3, [0, 2.65, 0]); box([2.2, 0.15, 0.2], [0, 4.75, 0]);
      for (const x of [-0.85, 0, 0.85]) { cylinder(0.08, 0.3, [x, 4.96, 0], '#c6d4c6'); cylinder(0.04, 0.12, [x, 5.17, 0], '#778687'); }
      break;
    case 'mailbox':
      box([0.15, 0.9, 0.15], [0, 0.45, 0], '#77828a'); box([0.7, 0.65, 0.85], [0, 1.2, 0]);
      box([0.44, 0.055, 0.03], [0, 1.32, 0.45], '#394750'); text('POST', 0.5, 0.16, [0, 1.12, 0.46]);
      break;
  }
  if (!root.children.some(child => child instanceof THREE.Mesh && child.material === primary)) primary.dispose();
  return root;
}
