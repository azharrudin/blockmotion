import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { currentPose, useEditor } from '../editor/store';
import { JOINT_IDS, type CameraCutView, type Tool, type Vec3 } from '../editor/types';
import { JOINT_POSITIONS, jointNodeId, resolveObjectNode } from '../editor/characters';
import { characterNodes } from './CharacterAsset';
import { sampleNodePose } from '../editor/tracks';
import { sampleObjectPose, sampleTrack } from '../editor/interpolation';
import { activeCameraCut, type CameraSnapshot } from '../editor/cameraCuts';
import { SKY_PRESETS } from '../editor/sky';
import type { SkySettings } from '../editor/types';
import type { SceneObject } from '../editor/types';
import { buildSceneAsset, disposeSceneAsset } from './SceneAssets';
import { PreviewQuality, type PreviewMode, type PreviewStats } from './PreviewQuality';

const deg = THREE.MathUtils.degToRad;
const rad = THREE.MathUtils.radToDeg;
const VECTOR = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);

export function subscribeEditorControls(sync: () => void) {
  return useEditor.subscribe((state, previous) => {
    if (state.selection !== previous.selection
      || state.selectedObject !== previous.selectedObject
      || state.selectedJoint !== previous.selectedJoint
      || state.tool !== previous.tool
      || state.cameraPreview !== previous.cameraPreview
      || state.gridSnap !== previous.gridSnap
      || state.gridSize !== previous.gridSize
      || state.project.objects !== previous.project.objects) sync();
  });
}

export class StudioScene {
  private container: HTMLElement;
  readonly scene = new THREE.Scene();
  readonly editorCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  readonly shotCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
  readonly cutCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  readonly renderer: THREE.WebGLRenderer;
  private orbit: OrbitControls;
  private controls: TransformControls;
  private controlsHelper: THREE.Object3D;
  private cameraHelper: THREE.CameraHelper;
  private raycaster = new THREE.Raycaster();
  private cursor = new THREE.Vector2();
  private assetNodes = new Map<string, { root: THREE.Group; kind: SceneObject['kind']; color: string; geometryKey: string }>();
  private objectList: SceneObject[] | undefined;
  private highlight = new THREE.BoxHelper(new THREE.Object3D(), 0x8ac4ff);
  private skyCache = '';
  private skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color() }, horizonColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() }, sunDirection: { value: new THREE.Vector3() },
      stars: { value: 0 },
    },
    vertexShader: `varying vec3 direction;
      void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 direction;
      uniform vec3 topColor, horizonColor, sunColor, sunDirection;
      uniform float stars;
      void main() {
        vec3 d = normalize(direction);
        vec3 color = mix(horizonColor, topColor, pow(max(d.y, 0.0), 0.45));
        float alignment = dot(d, sunDirection);
        color += sunColor * (smoothstep(0.9995, 0.9998, alignment) * 2.0
          + pow(max(alignment, 0.0), 64.0) * 0.18);
        vec2 uv = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 180.0;
        vec2 cell = floor(uv);
        float seed = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
        float star = (1.0 - smoothstep(0.04, 0.17, length(fract(uv) - 0.5)))
          * step(0.975, seed) * smoothstep(0.02, 0.25, d.y) * stars;
        gl_FragColor = vec4(color + vec3(star), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  private skyDome = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), this.skyMaterial);
  private ambientLight = new THREE.HemisphereLight(0xf0f5ff, 0x3b4059, 2.1);
  private keyLight = new THREE.DirectionalLight(0xfff5e8, 3.1);
  private fillLight = new THREE.DirectionalLight(0x648fff, 1.7);
  private resizeObserver: ResizeObserver;
  private raf = 0;
  private lastTime = performance.now();
  private renderRequested = true;
  private renderedState: ReturnType<typeof useEditor.getState> | undefined;
  private previewQuality = new PreviewQuality();
  private onPreviewStats?: (stats: PreviewStats) => void;
  private pointerDown = { x: 0, y: 0 };
  private draggingGizmo = false;
  private gizmoObject: string | null = null;
  private disposers: (() => void)[] = [];
  private poseCache = new Map<string, { object: SceneObject; overrides: ReturnType<typeof useEditor.getState>['overrides']; interpolation: string; time: number }>();

  constructor(container: HTMLElement, onPreviewStats?: (stats: PreviewStats) => void) {
    this.container = container;
    this.onPreviewStats = onPreviewStats;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    this.renderer.domElement.className = 'three-canvas';
    container.appendChild(this.renderer.domElement);

    this.editorCamera.position.set(6.1, 4.4, 8.9);
    this.editorCamera.lookAt(0, 1.75, 0);
    this.orbit = new OrbitControls(this.editorCamera, this.renderer.domElement);
    this.orbit.addEventListener('change', () => { this.renderRequested = true; });
    this.orbit.target.set(0, 1.65, 0);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.075;
    this.orbit.minDistance = 2.5;
    this.orbit.maxDistance = 45;
    this.orbit.maxPolarAngle = Math.PI * 0.49;

    this.createEnvironment();
    this.shotCamera.name = 'Shot Camera';
    this.shotCamera.updateProjectionMatrix();
    this.scene.add(this.shotCamera);
    this.cameraHelper = new THREE.CameraHelper(this.shotCamera);
    for (const material of Array.isArray(this.cameraHelper.material) ? this.cameraHelper.material : [this.cameraHelper.material]) material.depthTest = false;
    this.scene.add(this.cameraHelper);

    this.controls = new TransformControls(this.editorCamera, this.renderer.domElement);
    this.controls.size = 0.85;
    this.controls.setSpace('local');
    this.controlsHelper = this.controls.getHelper();
    this.scene.add(this.controlsHelper);
    this.controls.addEventListener('change', () => { this.renderRequested = true; });
    this.controls.addEventListener('dragging-changed', event => {
      const dragging = Boolean(event.value);
      if (dragging) this.gizmoObject = useEditor.getState().selection;
      this.draggingGizmo = dragging;
      this.orbit.enabled = !dragging && !useEditor.getState().cameraPreview;
      if (!dragging) {
        const state = useEditor.getState();
        if (state.selection === this.gizmoObject && state.autoKey && state.overrides[state.selection]) state.commitKey();
        this.syncSceneObjects(true);
        this.gizmoObject = null;
      }
    });
    this.controls.addEventListener('objectChange', () => {
      const state = useEditor.getState();
      const object = this.selectedNode();
      if (!object) return;
      object.scale.clampScalar(0.01, 100);
      const position = object.position.clone();
      if (state.selectedJoint) position.sub(VECTOR(JOINT_POSITIONS[state.selectedJoint]));
      position.clampScalar(-10000, 10000);
      state.updatePose(state.selection, {
        position: position.toArray() as Vec3,
        rotation: [rad(object.rotation.x), rad(object.rotation.y), rad(object.rotation.z)],
        scale: object.scale.toArray() as Vec3,
      });
    });

    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('visibilitychange', this.resetFrameClock);
    this.disposers.push(subscribeEditorControls(() => this.syncEditorControls()));
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
    this.syncEditorControls();
    this.raf = requestAnimationFrame(this.frame);
  }

  private createEnvironment() {
    this.scene.background = new THREE.Color('#141b2b');
    this.scene.fog = new THREE.Fog('#141b2b', 15, 46);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -1;
    this.scene.add(this.skyDome);
    const ambient = this.ambientLight;
    this.scene.add(ambient);
    const key = this.keyLight;
    key.position.set(-3.5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    key.shadow.normalBias = 0.03;
    this.scene.add(key);
    const fill = this.fillLight;
    fill.position.set(5, 4, -5);
    this.scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x1a2538, roughness: 0.98, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.036;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(60, 60, 0x496482, 0x33435b);
    grid.position.y = -0.029;
    const materials = grid.material as THREE.Material | THREE.Material[];
    for (const m of Array.isArray(materials) ? materials : [materials]) {
      m.transparent = true;
      m.opacity = 0.3;
      m.depthWrite = false;
    }
    this.scene.add(grid);
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(2.35, 2.42, 0.14, 64),
      new THREE.MeshStandardMaterial({ color: 0x25344d, roughness: 0.75, metalness: 0.2 }),
    );
    platform.position.y = -0.1;
    platform.receiveShadow = true;
    this.scene.add(platform);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.33, 0.01, 4, 128),
      new THREE.MeshBasicMaterial({ color: 0x4e729a, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.025;
    this.scene.add(ring);
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.draggingGizmo || useEditor.getState().cameraPreview || event.button !== 0) return;
    if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 5) return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.cursor.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.cursor, this.editorCamera);
    const hits = this.raycaster.intersectObjects([
      ...Array.from(this.assetNodes.values(), node => node.root),
    ], true);
    const hit = hits[0];
    if (hit?.object.userData.objectId) useEditor.getState().selectObject(hit.object.userData.objectId, hit.object.userData.jointId);
  };

  private resize = () => {
    this.renderRequested = true;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.editorCamera.aspect = width / height;
    this.editorCamera.updateProjectionMatrix();
    this.shotCamera.aspect = width / height;
    this.shotCamera.updateProjectionMatrix();
    this.cutCamera.aspect = width / height;
    this.cutCamera.updateProjectionMatrix();
  };

  private selectedNode(): THREE.Object3D | undefined {
    const state = useEditor.getState();
    if (state.selection === 'camera') return this.shotCamera;
    const node = resolveObjectNode(state.project, state.selection);
    const root = node && this.assetNodes.get(node.object.id)?.root;
    return node?.joint && root ? characterNodes(root)?.[node.joint] : root;
  }

  private applySky(sky: SkySettings | undefined, background: string) {
    const settings = sky ?? SKY_PRESETS.studio;
    const signature = JSON.stringify([settings, background]);
    if (signature === this.skyCache) return;
    this.skyCache = signature;
    const studio = settings.preset === 'studio';
    this.skyDome.visible = !studio;
    this.scene.background = new THREE.Color(studio ? background : settings.horizon);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(studio ? background : settings.horizon);
    this.ambientLight.color.set(studio ? '#f0f5ff' : settings.top);
    this.ambientLight.intensity = settings.ambient;
    this.keyLight.color.set(settings.lightColor);
    this.keyLight.intensity = settings.intensity;
    if (studio) this.keyLight.position.set(-3.5, 8, 5);
    else this.keyLight.position.setFromSphericalCoords(10, deg(90 - settings.elevation), deg(settings.azimuth));
    this.fillLight.intensity = studio ? 1.7 : settings.ambient * 0.35;
    this.skyMaterial.uniforms.topColor.value.set(settings.top);
    this.skyMaterial.uniforms.horizonColor.value.set(settings.horizon);
    this.skyMaterial.uniforms.sunColor.value.set(settings.lightColor);
    this.skyMaterial.uniforms.sunDirection.value.copy(this.keyLight.position).normalize();
    this.skyMaterial.uniforms.stars.value = settings.stars ? 1 : 0;
  }

  private syncEditorControls() {
    const { tool, cameraPreview, gridSnap, gridSize, selectedJoint } = useEditor.getState();
    this.syncSceneObjects();
    const object = this.selectedNode();
    if (!object) { this.controls.detach(); this.controlsHelper.visible = false; return; }
    if (this.controls.object !== object) this.controls.attach(object);
    this.controls.setMode(tool as Tool);
    this.controls.setTranslationSnap(gridSnap && !selectedJoint ? gridSize : null);
    this.controls.setSpace(gridSnap && tool === 'translate' && !selectedJoint ? 'world' : 'local');
    this.controlsHelper.visible = !cameraPreview;
    this.orbit.enabled = !cameraPreview && !this.draggingGizmo;
    this.cameraHelper.visible = !cameraPreview;
    if (!useEditor.getState().selectedObject) this.highlight.visible = false;
  }

  private syncSceneObjects(force = false) {
    const state = useEditor.getState();
    const objects = state.project.objects;
    if (!force && this.objectList === objects) { this.applySceneObjectPoses(); return; }
    this.objectList = objects;
    const ids = new Set(objects?.map(o => o.id));
    for (const [id, node] of this.assetNodes) {
      if (ids.has(id)) continue;
      if (this.controls.object === node.root || this.controls.object?.userData.objectId === id) this.controls.detach();
      this.scene.remove(node.root);
      disposeSceneAsset(node.root);
      this.assetNodes.delete(id);
      this.poseCache?.delete(id);
    }
    for (const object of objects ?? []) {
      let node = this.assetNodes.get(object.id);
      const geometryKey = JSON.stringify([object.kind, object.terrain, object.roadGrid]);
      if (node && node.geometryKey !== geometryKey) {
        if (this.controls.object === node.root || this.controls.object?.userData.objectId === object.id) this.controls.detach();
        this.scene.remove(node.root);
        disposeSceneAsset(node.root);
        node = undefined;
      }
      if (!node) {
        node = { root: buildSceneAsset(object), kind: object.kind, color: object.color, geometryKey };
        this.assetNodes.set(object.id, node);
        this.scene.add(node.root);
      }
      node.root.name = object.name;
      node.root.traverse(child => {
        if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial)) return;
        if (child.material.userData.tint) child.material.color.set(object.color);
        if (child.material.userData.colorKey === 'skinColor') child.material.color.set(object.skinColor ?? '#f3c58b');
        if (child.material.userData.colorKey === 'pantsColor') child.material.color.set(object.pantsColor ?? '#343d53');
      });
      node.color = object.color;
    }
    this.applySceneObjectPoses();
    this.updateSceneDistances();
  }

  private sceneBounds(ids?: string[]) {
    const bounds = new THREE.Box3();
    const selected = ids && new Set(ids);
    for (const [id, node] of this.assetNodes) {
      if (selected && !selected.has(id)) continue;
      node.root.updateWorldMatrix(true, true);
      bounds.union(new THREE.Box3().setFromObject(node.root));
    }
    return bounds;
  }

  private updateSceneDistances() {
    const bounds = this.sceneBounds();
    const span = bounds.isEmpty() ? 0 : bounds.getSize(new THREE.Vector3()).length();
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = Math.max(15, span * 0.9);
      this.scene.fog.far = Math.max(46, span * 4);
    }
    if (this.orbit) this.orbit.maxDistance = Math.max(45, span * 4);
  }

  focusObjects(ids?: string[]) {
    const bounds = this.sceneBounds(ids);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(2, bounds.getSize(new THREE.Vector3()).length() / 2);
    const vertical = deg(this.editorCamera.fov) / 2;
    const halfFov = Math.min(vertical, Math.atan(Math.tan(vertical) * this.editorCamera.aspect));
    const distance = radius / Math.sin(halfFov) * 1.12;
    this.orbit.maxDistance = Math.max(this.orbit.maxDistance, distance * 1.2);
    this.orbit.target.copy(center);
    this.editorCamera.position.copy(center).add(new THREE.Vector3(0.65, 0.7, 1).normalize().multiplyScalar(distance));
    this.orbit.update();
    if (useEditor.getState().cameraPreview) useEditor.getState().setCameraPreview(false);
  }

  private applySceneObjectPoses() {
    const state = useEditor.getState();
    const cache = this.poseCache ??= new Map();
    for (const object of state.project.objects ?? []) {
      const root = this.assetNodes.get(object.id)?.root;
      if (!root) continue;
      const previous = cache.get(object.id);
      const animated = (object.keyframes?.length ?? 0) > 1
        || JOINT_IDS.some(joint => (object.joints?.[joint]?.length ?? 0) > 1);
      const dragging = this.draggingGizmo && state.selectedObject === object.id;
      if (!dragging && previous?.object === object && previous.overrides === state.overrides
        && previous.interpolation === state.project.interpolation && (!animated || previous.time === state.time)) continue;
      const apply = (target: THREE.Object3D, pose: ReturnType<typeof sampleObjectPose>, base?: Vec3) => {
        target.position.set(...pose.position);
        if (base) {
          target.position.x += base[0]; target.position.y += base[1]; target.position.z += base[2];
        }
        target.rotation.set(deg(pose.rotation[0]), deg(pose.rotation[1]), deg(pose.rotation[2]));
        target.scale.set(...pose.scale);
      };
      if (!(this.draggingGizmo && state.selection === object.id)) {
        apply(root, state.overrides[object.id] ?? sampleObjectPose(object, state.time, state.project.interpolation));
      }
      const joints = characterNodes(root);
      if (joints) for (const joint of JOINT_IDS) {
        const id = jointNodeId(object.id, joint);
        if (this.draggingGizmo && state.selection === id) continue;
        apply(joints[joint], state.overrides[id] ?? sampleTrack(object.joints?.[joint] ?? [], state.time, state.project.interpolation, joint), JOINT_POSITIONS[joint]);
      }
      if (dragging) cache.delete(object.id);
      else cache.set(object.id, { object, overrides: state.overrides, interpolation: state.project.interpolation, time: state.time });
    }
  }

  private resetFrameClock = () => { this.lastTime = performance.now(); };

  setPreviewMode(mode: PreviewMode) {
    this.previewQuality.setMode(mode);
    this.applyPreviewQuality();
  }

  private applyPreviewQuality() {
    const { scale, shadows } = this.previewQuality.settings;
    const ratio = Math.min(window.devicePixelRatio || 1, 1) * scale;
    if (this.renderer.getPixelRatio() !== ratio) this.renderer.setPixelRatio(ratio);
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.scene.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) material.needsUpdate = true;
      });
    }
    this.renderRequested = true;
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    // Keep playback at real speed even when a frame takes longer than 50 ms.
    const dt = document.hidden ? 0 : Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const store = useEditor.getState();
    if (store.playing) store.tick(dt);
    const state = useEditor.getState();
    const cameraMoved = this.orbit.update();
    if (!state.playing && !this.draggingGizmo && !cameraMoved
      && !this.renderRequested && this.renderedState === state) {
      this.previewQuality.observe(0, false);
      return;
    }
    this.renderRequested = false;
    this.renderedState = state;
    this.applySky(state.project.sky, state.project.palette.background);
    if (!(this.draggingGizmo && state.selection === 'camera')) {
      const pose = state.overrides.camera ?? sampleNodePose(state.project, 'camera', state.time);
      this.shotCamera.position.set(...pose.position);
      this.shotCamera.rotation.set(...pose.rotation.map(deg) as Vec3);
      this.shotCamera.scale.set(...pose.scale);
    }
    this.applySceneObjectPoses();
    this.shotCamera.updateMatrixWorld();
    this.cameraHelper.visible = !state.cameraPreview && !state.playing;
    this.controlsHelper.visible = !!this.controls.object && !state.cameraPreview && !state.playing;
    if (this.cameraHelper.visible) this.cameraHelper.update();
    const selected = state.playing ? undefined : this.selectedNode();
    this.highlight.visible = !!selected && !!state.selectedObject && !state.cameraPreview && !state.playing;
    if (this.highlight.visible && selected) {
      this.highlight.setFromObject(selected);
    }
    const camera = this.playbackCamera();
    this.skyDome.position.copy(camera.position);
    this.renderer.render(this.scene, camera);
    const stats = this.previewQuality.observe(dt * 1000, !document.hidden && (state.playing || this.draggingGizmo || cameraMoved));
    if (stats) {
      this.applyPreviewQuality();
      this.onPreviewStats?.(stats);
    }
  };

  playbackCamera(): THREE.PerspectiveCamera {
    const state = useEditor.getState();
    if (!state.cameraPreview) return this.editorCamera;
    const cut = activeCameraCut(state.project.cameraCuts, state.time);
    if (!cut || cut.view === 'shot' || !cut.pose) return this.shotCamera;
    this.cutCamera.position.set(...cut.pose.position);
    this.cutCamera.rotation.set(...cut.pose.rotation.map(deg) as Vec3);
    this.cutCamera.scale.set(...cut.pose.scale);
    if (this.cutCamera.fov !== cut.fov) { this.cutCamera.fov = cut.fov!; this.cutCamera.updateProjectionMatrix(); }
    this.cutCamera.updateMatrixWorld();
    return this.cutCamera;
  }

  captureCutView(view: CameraCutView): CameraSnapshot | undefined {
    if (view === 'shot' || view === 'node') return undefined;
    let camera = this.playbackCamera();
    if (view !== 'current') {
      this.applySceneObjectPoses();
      const state = useEditor.getState();
      const root = state.selectedObject && this.assetNodes.get(state.selectedObject)?.root;
      root && root.updateWorldMatrix(true, true);
      const bounds = root ? new THREE.Box3().setFromObject(root) : this.sceneBounds();
      const center = bounds.isEmpty() ? new THREE.Vector3(0,1.65,0) : bounds.getCenter(new THREE.Vector3());
      const radius = bounds.isEmpty() ? 3 : Math.max(1.5, bounds.getSize(new THREE.Vector3()).length()/2);
      const half = deg(this.editorCamera.fov)/2;
      const distance = radius / Math.sin(Math.min(half,Math.atan(Math.tan(half)*this.editorCamera.aspect))) * 1.12;
      const directions = {front:[0,0.12,1],back:[0,0.12,-1],left:[-1,0.12,0],right:[1,0.12,0],top:[0,1,0.001],perspective:[0.65,0.4,1]} as const;
      camera = new THREE.PerspectiveCamera(this.editorCamera.fov,this.editorCamera.aspect,0.1,2000);
      const direction = directions[view];
      camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));
      camera.lookAt(center);
    }
    return { pose: { position: camera.position.toArray() as Vec3,
      rotation:[rad(camera.rotation.x),rad(camera.rotation.y),rad(camera.rotation.z)],scale:[1,1,1] }, fov:camera.fov };
  }

  setView(view: 'front' | 'back' | 'left' | 'right' | 'top' | 'perspective') {
    const target = new THREE.Vector3(0, 1.65, 0);
    const positions = {
      front: new THREE.Vector3(0, 1.75, 10),
      back: new THREE.Vector3(0, 1.75, -10),
      left: new THREE.Vector3(-10, 1.75, 0),
      right: new THREE.Vector3(10, 1.75, 0),
      top: new THREE.Vector3(0, 11, 0.01),
      perspective: new THREE.Vector3(6.1, 4.4, 8.9),
    };
    this.orbit.target.copy(target);
    this.editorCamera.position.copy(positions[view]);
    this.editorCamera.lookAt(target);
    this.orbit.update();
    if (useEditor.getState().cameraPreview) useEditor.getState().setCameraPreview(false);
  }

  focusSelected() {
    const state = useEditor.getState();
    const object = this.selectedNode();
    if (!object) return;
    object.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const distance = Math.min(40, Math.max(4, Math.max(size.x, size.y, size.z) * 2.2));
    this.orbit.target.copy(center);
    this.editorCamera.position.copy(center).add(new THREE.Vector3(0.65, 0.4, 1).normalize().multiplyScalar(distance));
    this.orbit.update();
    if (state.cameraPreview) state.setCameraPreview(false);
  }

  screenshot(): string {
    // Read synchronously after rendering so the GPU can discard buffers normally.
    this.renderer.render(this.scene, this.playbackCamera());
    return this.renderer.domElement.toDataURL('image/png');
  }
  getCanvas(): HTMLCanvasElement { return this.renderer.domElement; }
  resetSelectedToNeutral() {
    const state = useEditor.getState();
    const neutral = state.selection === 'camera' ? currentPose('camera') : { position: [0, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3, scale: [1, 1, 1] as Vec3 };
    state.updatePose(state.selection, neutral);
    if (state.autoKey) state.commitKey();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.resetFrameClock);
    this.disposers.forEach(dispose => dispose());
    this.controls.detach();
    this.controls.dispose();
    this.orbit.dispose();
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
        obj.geometry?.dispose();
        const material = obj.material as THREE.Material | THREE.Material[];
        for (const m of Array.isArray(material) ? material : [material]) m?.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
