import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Camera, Eye, Focus, Grid3X3, Maximize2, Move, RotateCw, Scaling, Video, VideoOff } from 'lucide-react';
import { StudioScene } from '../engine/StudioScene';
import { useEditor } from '../editor/store';
import { cameraCutLabel, resolveCameraView } from '../editor/cameraCuts';
import { GRID_SIZES } from '../editor/town';
import { BONE_LABELS } from '../editor/types';
import type { Tool } from '../editor/types';
import type { PreviewMode, PreviewStats } from '../engine/PreviewQuality';

export const studioRef: { current: StudioScene | null } = { current: null };

const tools: { key: Tool; icon: typeof Move; shortcut: string }[] = [
  { key: 'translate', icon: Move, shortcut: 'G' },
  { key: 'rotate', icon: RotateCw, shortcut: 'R' },
  { key: 'scale', icon: Scaling, shortcut: 'S' },
];
export function Viewport() {
  const mount = useRef<HTMLDivElement>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('auto');
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const playing = useEditor(state => state.playing);
  const { tool, setTool, cameraPreview, setCameraPreview, selection, selectedObject, selectedJoint, project, gridSnap, gridSize, setGridSnap, setGridSize } = useEditor(useShallow(state => ({
    tool: state.tool, setTool: state.setTool, cameraPreview: state.cameraPreview, setCameraPreview: state.setCameraPreview,
    selection: state.selection, selectedObject: state.selectedObject, selectedJoint: state.selectedJoint,
    project: state.project, gridSnap: state.gridSnap, gridSize: state.gridSize, setGridSnap: state.setGridSnap, setGridSize: state.setGridSize,
  })));
  const cameraLabel = useEditor(state => {
    if (!state.cameraPreview) return 'PERSPECTIVE';
    const resolved = resolveCameraView(state.project, state.time);
    if (resolved?.kind === 'node') return `CAM / ${resolved.camera.name.toUpperCase()}`;
    if (resolved?.kind === 'cut') return `CUT / ${cameraCutLabel(state.project, resolved.cut).toUpperCase()}`;
    const shot = state.project.objects?.find(object => object.kind === 'camera' && object.id === state.project.activeCameraId);
    return shot ? `SHOT / ${shot.name.toUpperCase()}` : 'SHOT CAMERA';
  });
  useEffect(() => {
    if (!mount.current) return;
    const studio = new StudioScene(mount.current, setPreviewStats);
    studioRef.current = studio;
    return () => { studioRef.current = null; studio.dispose(); };
  }, []);
  return (
    <section className="viewport-panel">
      <div ref={mount} className="viewport-mount" />
      <div className="viewport-top">
        <div className="viewport-tag"><span className="status-dot"/> 3D VIEWPORT <span className="tag-divider"/> {cameraLabel}</div>
        <div className="viewport-mode snap-controls">
          {playing && previewStats && <span className="preview-fps" title="Measured preview frame rate">{previewStats.fps} FPS</span>}
          <select aria-label="Preview quality" title="Auto lowers preview resolution and disables shadows if playback is slow" value={previewMode} onChange={event => {
            const mode = event.target.value as PreviewMode;
            setPreviewMode(mode);
            setPreviewStats(null);
            studioRef.current?.setPreviewMode(mode);
          }}>
            <option value="auto">Auto quality</option><option value="fast">Fast preview</option><option value="quality">Full quality</option>
          </select>
          <button className={gridSnap ? 'active' : ''} aria-pressed={gridSnap} title="Snap object positions to the grid (joint editing stays free)" onClick={() => setGridSnap(!gridSnap)}><Grid3X3 size={13}/> Snap</button>
          <select aria-label="Grid snap size" value={gridSize} onChange={e => setGridSize(Number(e.target.value))}>{GRID_SIZES.map(size => <option key={size} value={size}>{size} u</option>)}</select>
        </div>
      </div>
      <div className="viewport-tools" aria-label="Viewport tools">
        {tools.map(({ key, icon: Icon, shortcut }) => (
          <button key={key} className={`icon-tool ${tool === key ? 'active' : ''}`} title={`${key} (${shortcut})`} onClick={() => setTool(key)}><Icon size={17}/></button>
        ))}
        <span className="vertical-separator"/>
        <button className="icon-tool" title="Focus selected object" onClick={() => studioRef.current?.focusSelected()}><Focus size={17}/></button>
        <button className={`icon-tool ${cameraPreview ? 'active' : ''}`} title="Toggle camera sequence view (C)" onClick={() => setCameraPreview(!cameraPreview)}>{cameraPreview ? <Video size={17}/> : <VideoOff size={17}/>}</button>
        <button className="icon-tool" title="Reset editor view (Home)" onClick={() => studioRef.current?.setView('perspective')}><Focus size={17}/></button>
      </div>
      <div className="viewport-gizmo-label"><span className="axis x">X</span><span className="axis y">Y</span><span className="axis z">Z</span></div>
      <div className="viewport-bottom">
        <div className="viewport-hint"><span className="hint-mouse">◉</span> Orbit: Drag <span className="hint-separator">•</span> Pan: Right drag <span className="hint-separator">•</span> Zoom: Scroll</div>
        <div className="viewport-bottom-right">
          <button className="small-overlay-btn" title="Toggle camera sequence view" onClick={() => setCameraPreview(!cameraPreview)}><Camera size={13}/> {cameraPreview ? 'Perspective view' : 'Camera view'}</button>
          <div className="relative">
            <button className="small-overlay-btn" onClick={() => setViewOpen(!viewOpen)} title="Change viewport angle"><Eye size={13}/> Views ⌄</button>
            {viewOpen && <div className="view-menu">
              {(['perspective', 'front', 'back', 'left', 'right', 'top'] as const).map(view => <button key={view} onClick={() => { studioRef.current?.setView(view); setViewOpen(false); }}>{view}</button>)}
            </div>}
          </div>
          <button className="small-overlay-btn icon-only" title="Reset camera framing" onClick={() => studioRef.current?.setView('perspective')}><Maximize2 size={13}/></button>
        </div>
      </div>
      <div className="scene-watermark"><span className="watermark-subtitle">SCENE / {project.name.toUpperCase()}</span><span>{selectedObject ? `${project.objects?.find(o => o.id === selectedObject)?.name}${selectedJoint ? ` / ${BONE_LABELS[selectedJoint]}` : ''}` : selection === 'camera' ? 'Cinematic camera selected' : 'Nothing selected'}</span></div>
    </section>
  );
}
