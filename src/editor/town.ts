import type { TownAssetKind } from './types';

export type AssetDefinition = { label: string; category: string; color: string; section?: string; keywords?: string };
export const TOWN_ASSETS: Record<TownAssetKind, AssetDefinition> = {
  roadCurve: { label: 'Road bend', category: 'Town', section: 'Roads', color: '#424955', keywords: 'jalan belok corner curve' },
  roadT: { label: 'T junction', category: 'Town', section: 'Roads', color: '#424955', keywords: 'jalan pertigaan intersection' },
  sidewalk: { label: 'Sidewalk', category: 'Town', section: 'Roads', color: '#b8bdc4', keywords: 'trotoar pavement curb' },
  sidewalkCorner: { label: 'Sidewalk corner', category: 'Town', section: 'Roads', color: '#b8bdc4', keywords: 'trotoar belok sudut curb' },
  crosswalk: { label: 'Zebra crossing', category: 'Town', section: 'Roads', color: '#424955', keywords: 'zebra cross penyeberangan jalan' },
  parking: { label: 'Parking lot', category: 'Town', section: 'Roads', color: '#424955', keywords: 'parkir mobil' },
  trafficLight: { label: 'Traffic light', category: 'Town', section: 'Street props', color: '#505b65', keywords: 'lampu lalu lintas merah' },
  roadSign: { label: 'Stop sign', category: 'Town', section: 'Street props', color: '#c7524d', keywords: 'rambu jalan stop' },
  barrier: { label: 'Road barrier', category: 'Town', section: 'Street props', color: '#e39845', keywords: 'pembatas jalan barricade' },
  trashBin: { label: 'Trash bin', category: 'Town', section: 'Street props', color: '#458c77', keywords: 'tempat sampah' },
  car: { label: 'Car', category: 'Town', section: 'Transport', color: '#538bd4', keywords: 'mobil kendaraan' },
  motorcycle: { label: 'Motorcycle', category: 'Town', section: 'Transport', color: '#cb6354', keywords: 'motor kendaraan' },
  bus: { label: 'Bus', category: 'Town', section: 'Transport', color: '#e3b750', keywords: 'bis kendaraan' },
  busStop: { label: 'Bus stop', category: 'Town', section: 'Transport', color: '#517e95', keywords: 'halte shelter' },
  apartment: { label: 'Apartment', category: 'Town', section: 'Buildings', color: '#cbbda8', keywords: 'apartemen gedung' },
  office: { label: 'Office', category: 'Town', section: 'Buildings', color: '#8ba4b4', keywords: 'kantor gedung' },
  cafe: { label: 'Cafe', category: 'Town', section: 'Buildings', color: '#d7ad8c', keywords: 'kafe kopi coffee' },
  school: { label: 'School', category: 'Town', section: 'Buildings', color: '#dfc99c', keywords: 'sekolah' },
  minimarket: { label: 'Minimarket', category: 'Town', section: 'Buildings', color: '#e8e0ce', keywords: 'toko supermarket convenience store' },
  gasStation: { label: 'Gas station', category: 'Town', section: 'Buildings', color: '#d86155', keywords: 'spbu pom bensin fuel' },
  grassTile: { label: 'Grass tile', category: 'Town', section: 'Park', color: '#709957', keywords: 'rumput taman lawn' },
  parkPath: { label: 'Park path', category: 'Town', section: 'Park', color: '#c6b896', keywords: 'jalur pejalan kaki taman path' },
  flowerPot: { label: 'Flower pot', category: 'Town', section: 'Park', color: '#b77859', keywords: 'pot bunga taman' },
  fountain: { label: 'Fountain', category: 'Town', section: 'Park', color: '#a3acb6', keywords: 'air mancur taman' },
  playground: { label: 'Playground', category: 'Town', section: 'Park', color: '#dca44d', keywords: 'taman bermain perosotan' },
  shopSign: { label: 'Shop sign', category: 'Town', section: 'Details', color: '#4b7c82', keywords: 'papan nama toko' },
  billboard: { label: 'Billboard', category: 'Town', section: 'Details', color: '#526a8b', keywords: 'papan iklan reklame' },
  powerPole: { label: 'Power pole', category: 'Town', section: 'Details', color: '#9d815f', keywords: 'tiang listrik utility' },
  mailbox: { label: 'Mailbox', category: 'Town', section: 'Details', color: '#bb554c', keywords: 'kotak pos surat' },
};
export function isTownAssetKind(kind: string): kind is TownAssetKind {
  return Object.hasOwn(TOWN_ASSETS, kind);
}
export const ROAD_MODULE = 6;
export const ROAD_WIDTH = 4;
export const GRID_SIZES = [0.5, 1, 2, 6] as const;
export function snapToGrid(value: number, size: number): number {
  return Math.round(value / size) * size;
}
