import { ASSET_CATALOG } from './assets';
import { seededRandom, terrainHeightAt } from './terrain';
import { clonePose, keyId, type AssetKind, type SceneObject, type TerrainConfig, type Vec3 } from './types';

export type GeneratorKind = 'town' | 'city' | 'mountains' | 'jungle' | 'desert';
export const GENERATOR_LABELS: Record<GeneratorKind, string> = { town: 'Town', city: 'City', mountains: 'Mountains', jungle: 'Jungle', desert: 'Desert' };
export type GeneratorOptions = {
  kind: GeneratorKind; columns: number; rows: number; lotsPerBlock: number;
  size: number; height: number; treeCount: number; rockCount: number; seed: number;
  originX: number; originZ: number; details: boolean; mode: 'append' | 'replace';
};
export function generatorDefaults(kind: GeneratorKind): GeneratorOptions {
  return { kind, columns: kind === 'city' ? 3 : 2, rows: kind === 'city' ? 3 : 2, lotsPerBlock: 2,
    size: 60, height: kind === 'mountains' ? 18 : kind === 'desert' ? 4 : 3,
    treeCount: kind === 'jungle' ? 100 : kind === 'mountains' ? 60 : kind === 'desert' ? 30 : 12,
    rockCount: 12, seed: 42, originX: 0, originZ: 0, details: true, mode: 'append' };
}
export function generatorError(o: GeneratorOptions): string | null {
  if (!Object.hasOwn(GENERATOR_LABELS, o.kind)) return 'Choose a generator.';
  for (const [key, min, max] of [['columns',1,8],['rows',1,8],['lotsPerBlock',1,3],['treeCount',0,250],['rockCount',0,60],['seed',0,2147483647]] as const) {
    if (!Number.isInteger(o[key]) || o[key] < min || o[key] > max) return `${key} must be an integer from ${min} to ${max}.`;
  }
  for (const [key, min, max] of [['size',20,120],['height',0,35],['originX',-500,500],['originZ',-500,500]] as const) {
    if (!Number.isFinite(o[key]) || o[key] < min || o[key] > max) return `${key} must be between ${min} and ${max}.`;
  }
  if (typeof o.details !== 'boolean' || !['append','replace'].includes(o.mode)) return 'Invalid generation options.';
  return null;
}
type PlannedObject = Pick<SceneObject, 'kind' | 'color' | 'pose' | 'terrain' | 'roadGrid'>;
export type EnvironmentPlan = { objects: PlannedObject[]; width: number; depth: number; blocks: number; buildings: number; vegetation: number };

export function createEnvironmentPlan(o: GeneratorOptions): EnvironmentPlan {
  const error = generatorError(o); if (error) throw new Error(error);
  const random = seededRandom(o.seed);
  const objects: PlannedObject[] = [];
  const add = (kind: AssetKind, x: number, y: number, z: number, scale: number | Vec3 = 1, yaw = 0, color?: string) => {
    const item: PlannedObject = { kind, color: color ?? ASSET_CATALOG[kind].color,
      pose: { position: [o.originX + x, y, o.originZ + z], rotation: [0, yaw, 0], scale: typeof scale === 'number' ? [scale,scale,scale] : [...scale] } };
    objects.push(item); return item;
  };
  const urban = o.kind === 'town' || o.kind === 'city';
  if (urban) {
    const width = o.columns * 18 + 6, depth = o.rows * 18 + 6;
    add('terrain', 0, 0, 0).terrain = { biome: 'grass', size: Math.max(width, depth) + 2, height: 0, seed: o.seed };
    add('roadNetwork', 0, 0.05, 0).roadGrid = { columns: o.columns, rows: o.rows, blockSize: 18 };
    const choices: AssetKind[] = o.kind === 'city' ? ['apartment','office','minimarket','cafe','school'] : ['house','store','cafe','minimarket','house'];
    const shades = ['#c9bda8','#bbcbd1','#ddc8a0','#c4b5ae','#b5c6b4'];
    for (let row = 0; row < o.rows; row++) for (let col = 0; col < o.columns; col++) {
      const cx = (col - (o.columns - 1) / 2) * 18, cz = (row - (o.rows - 1) / 2) * 18;
      const lots = o.lotsPerBlock === 1 ? [[0,0]] : o.lotsPerBlock === 2 ? [[-3,0],[3,0]] : [[-3,-3],[3,-3],[0,3]];
      for (const [x,z] of lots) {
        const kind = choices[Math.floor(random() * choices.length)];
        const scale = o.lotsPerBlock === 1 ? 0.95 + random() * 0.15 : 0.75 + random() * 0.1;
        const tall = o.kind === 'city' && (kind === 'office' || kind === 'apartment') ? 1 + random() * 0.8 : 1;
        const yaw = x < 0 ? -90 : x > 0 ? 90 : z < 0 ? 180 : 0;
        add(kind, cx+x, 0.05, cz+z, [scale,scale*tall,scale], yaw, shades[Math.floor(random()*shades.length)]);
      }
      if (o.details) { add('streetlight',cx-6.5,0.21,cz-6.5,0.85); add((row+col)%3 === 0 ? 'bench' : 'trashBin',cx+6.2,0.21,cz+5,0.8,90); }
    }
    // Plant the perimeter instead of dropping foliage into roads or building lots.
    const halfW = width/2, halfD = depth/2, perimeter = 4*(halfW+halfD);
    for (let i=0;i<o.treeCount;i++) {
      const along = (i+0.5)/o.treeCount*perimeter;
      let x: number,z: number;
      if (along<2*halfW) {x=-halfW+along;z=-halfD;}
      else if (along<2*halfW+2*halfD) {x=halfW;z=-halfD+along-2*halfW;}
      else if (along<4*halfW+2*halfD) {x=halfW-(along-2*halfW-2*halfD);z=halfD;}
      else {x=-halfW;z=halfD-(along-4*halfW-2*halfD);}
      add(i%4 === 0 ? 'flowerPot' : 'tree',x,0.05,z,0.65+random()*0.25,random()*360);
    }
    return {objects,width:width+2,depth:depth+2,blocks:o.columns*o.rows,buildings:o.columns*o.rows*o.lotsPerBlock,vegetation:o.treeCount};
  }
  const terrain: TerrainConfig = {biome:o.kind as 'mountains' | 'jungle' | 'desert',size:o.size,height:o.height,seed:o.seed};
  add('terrain',0,0,0).terrain=terrain;
  const count=o.treeCount+o.rockCount+(o.kind === 'jungle' ? Math.floor(o.treeCount*0.35) : 0);
  const side=Math.max(2,Math.ceil(Math.sqrt(Math.max(1,count)*4)));
  const points: {x:number;z:number;y:number;score:number}[]=[];
  for(let iz=0;iz<side;iz++)for(let ix=0;ix<side;ix++){
    const x=((ix+0.2+random()*0.6)/side-0.5)*(o.size-6), z=((iz+0.2+random()*0.6)/side-0.5)*(o.size-6);
    const y=terrainHeightAt(terrain,x,z);
    const slope=Math.abs(terrainHeightAt(terrain,x+0.3,z)-y)+Math.abs(terrainHeightAt(terrain,x,z+0.3)-y);
    points.push({x,z,y,score:random()+(o.kind==='mountains'?y/Math.max(1,o.height)*0.5+slope:0)});
  }
  points.sort((a,b)=>a.score-b.score);
  for(let i=0;i<count;i++){
    const {x,y,z}=points[i];
    let kind: AssetKind;
    if(i>=o.treeCount)kind=i<o.treeCount+o.rockCount?'rock':'bush';
    else if(o.kind==='mountains')kind=random()<0.85?'pine':'tree';
    else if(o.kind==='desert')kind=random()<0.9?'cactus':'palm';
    else kind=random()<0.75?'jungleTree':random()<0.6?'palm':'tree';
    const scale=kind==='rock'?0.5+random()*1.7:0.7+random()*0.65;
    add(kind,x,y,z,scale,random()*360);
  }
  return {objects,width:o.size,depth:o.size,blocks:0,buildings:0,vegetation:o.treeCount};
}
export function materializeEnvironment(plan: EnvironmentPlan, kind: GeneratorKind): SceneObject[] {
  const counts=new Map<AssetKind,number>();
  return plan.objects.map(item=>{
    const n=(counts.get(item.kind)??0)+1;counts.set(item.kind,n);
    return {...item,pose:clonePose(item.pose),id:`obj_${keyId()}`,name:`${GENERATOR_LABELS[kind]} ${ASSET_CATALOG[item.kind].label} ${n}`,
      keyframes:[{id:keyId(),time:0,value:clonePose(item.pose)}]};
  });
}
