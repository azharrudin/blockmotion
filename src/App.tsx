import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowDownToLine, Camera, Check, ChevronDown, CircleHelp, Clapperboard, Code2, FilePlus2, FolderOpen, Keyboard, Layers3, Menu, MonitorPlay, MoreHorizontal, Redo2, Save, Square, Undo2, Video, X } from 'lucide-react';
import { Explorer } from './components/Explorer';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { Viewport, studioRef } from './components/Viewport';
import { isValidProject, persistProject, useEditor } from './editor/store';
import type { Project } from './editor/types';

function fileDownload(filename: string, blob: Blob) {
  const a = document.createElement('a');
  const uri = URL.createObjectURL(blob);
  a.href = uri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(uri), 2000);
}
function sanitizedName(name: string) { return name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'animation'; }
function saveJson() {
  const project = useEditor.getState().project;
  fileDownload(`${sanitizedName(project.name)}.blockmotion.json`, new Blob([JSON.stringify(project, null, 2)], {type:'application/json'}));
  useEditor.getState().flash('JSON project exported');
}
function screenshot() {
  const studio = studioRef.current;
  if (!studio) return;
  const a = document.createElement('a');
  a.href = studio.screenshot();
  a.download = `${sanitizedName(useEditor.getState().project.name)}.png`;
  a.click();
  useEditor.getState().flash('PNG screenshot exported');
}

export default function App() {
  const { project, past, future, notification, undo, redo, flash } = useEditor(useShallow(state => ({
    project: state.project, past: state.past, future: state.future, notification: state.notification,
    undo: state.undo, redo: state.redo, flash: state.flash,
  })));
  const fileInput = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordTimer = useRef<number | null>(null);
  const [exportMenu, setExportMenu] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'explorer'|'inspector'|null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { if (!persistProject(project)) flash('Browser storage unavailable — export a JSON backup'); }, 600);
    return () => window.clearTimeout(timer);
  }, [project, flash]);
  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => useEditor.getState().flash(''), 3300);
    return () => window.clearTimeout(timer);
  }, [notification]);
  useEffect(() => {
    if (!exportMenu) return;
    const outside = (e: MouseEvent) => { if (!exportRef.current?.contains(e.target as Node)) setExportMenu(false); };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [exportMenu]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement;
      if (el && (['INPUT','TEXTAREA','SELECT'].includes(el.tagName) || el.isContentEditable)) return;
      const mod = event.ctrlKey || event.metaKey;
      const state = useEditor.getState();
      if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); saveJson(); return; }
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) state.redo(); else state.undo(); return; }
      if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); state.redo(); return; }
      if (mod && event.key.toLowerCase() === 'd' && state.selectedObject) { event.preventDefault(); state.duplicateObject(); return; }
      if (mod || event.altKey) return;
      switch (event.key.toLowerCase()) {
        case ' ': event.preventDefault(); state.play(); break;
        case 'k': state.commitKey(); break;
        case 'g': state.setTool('translate'); break;
        case 'r': state.setTool('rotate'); break;
        case 's': state.setTool('scale'); break;
        case 'c': state.setCameraPreview(!state.cameraPreview); break;
        case 'arrowleft': event.preventDefault(); state.seek(state.time - 1 / state.project.fps); break;
        case 'arrowright': event.preventDefault(); state.seek(state.time + 1 / state.project.fps); break;
        case 'escape': state.deselect(); break;
        case 'delete': case 'backspace': if (state.selectedCut) { event.preventDefault(); state.deleteCameraCut(); } else if (state.selectedKey) { event.preventDefault(); state.deleteKey(); } else if (state.selectedObject) { event.preventDefault(); state.deleteObject(); } break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const importProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('File exceeds 5MB');
      const parsed: unknown = JSON.parse(await file.text());
      if (!isValidProject(parsed)) throw new Error('Invalid or incompatible BlockMotion project');
      const tracks = Object.fromEntries(Object.entries(parsed.tracks).map(([id, keys]) => [id, [...keys].sort((a,b) => a.time-b.time)]));
      useEditor.getState().loadProject({ ...parsed, tracks } as Project);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Could not import JSON file');
    } finally { event.target.value = ''; }
  };

  const recordVideo = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      if (recordTimer.current !== null) window.clearTimeout(recordTimer.current);
      mediaRecorder.current.stop();
      useEditor.getState().play(false);
      return;
    }
    const canvas = studioRef.current?.getCanvas();
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      flash('WebM capture is not supported in this browser. Try desktop Chrome or Firefox.');
      return;
    }
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) { flash('WebM recording is not supported in this browser'); return; }
    try {
      const stream = canvas.captureStream(useEditor.getState().project.fps);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onerror = () => flash('The browser could not complete this recording');
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (chunks.length) fileDownload(`${sanitizedName(useEditor.getState().project.name)}.webm`, new Blob(chunks, {type: mimeType}));
        setRecording(false);
        mediaRecorder.current = null;
        if (recordTimer.current !== null) window.clearTimeout(recordTimer.current);
        recordTimer.current = null;
        flash(chunks.length ? 'WebM recording exported' : 'No frames were recorded');
      };
      mediaRecorder.current = recorder;
      useEditor.getState().seek(0);
      useEditor.getState().setCameraPreview(true);
      useEditor.getState().play(true);
      recorder.start(100);
      setRecording(true);
      flash('Recording camera preview · click Stop to finish');
      recordTimer.current = window.setTimeout(() => {
        if (recorder.state !== 'inactive') { recorder.stop(); useEditor.getState().play(false); }
      }, useEditor.getState().project.duration * 1000 + 200);
    } catch { flash('Unable to start recording'); setRecording(false); }
  };

  return <div className="app-shell">
    <header className="app-header">
      <div className="brand-zone">
        <div className="brand-icon"><Clapperboard size={19} strokeWidth={2.2}/></div>
        <div className="brand-text"><strong>BLOCKMOTION</strong><span>STUDIO <span className="brand-beta">BETA</span></span></div>
      </div>
      <div className="header-divider"/>
      <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{project.name || 'Untitled'}</strong><span className="saved-check"><Check size={12}/> Auto saved</span></div>
      <div className="header-grow"/>
      <div className="header-actions">
        <button className="header-btn" title="New project" onClick={() => { useEditor.getState().newProject(); flash('New project created — undo to restore previous project'); }}><FilePlus2 size={15}/><span>New</span></button>
        <button className="header-btn" title="Open JSON project" onClick={() => fileInput.current?.click()}><FolderOpen size={15}/><span>Open</span></button>
        <button className="header-btn" title="Save JSON (Ctrl+S)" onClick={saveJson}><Save size={15}/><span>Save</span></button>
        <span className="header-divider slim"/>
        <button className="header-icon-btn" title="Undo (Ctrl+Z)" disabled={!past.length} onClick={undo}><Undo2 size={17}/></button>
        <button className="header-icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}><Redo2 size={17}/></button>
        <span className="header-divider slim"/>
        <button className={`header-btn ${recording ? 'recording' : ''}`} title="Record cinematic camera to WebM" onClick={recordVideo}>{recording ? <Square size={13} fill="currentColor"/> : <Video size={15}/>}<span>{recording ? 'Stop' : 'Record'}</span></button>
        <div className="relative" ref={exportRef}>
          <button className="export-button" onClick={() => setExportMenu(!exportMenu)}><ArrowDownToLine size={15}/> Export <ChevronDown size={14}/></button>
          {exportMenu && <div className="export-menu">
            <button onClick={() => { saveJson(); setExportMenu(false); }}><Code2 size={16}/><span><strong>Project JSON</strong><small>Editable animation and keyframes</small></span></button>
            <button onClick={() => { screenshot(); setExportMenu(false); }}><Camera size={16}/><span><strong>PNG screenshot</strong><small>Current viewport image</small></span></button>
            <button onClick={() => { recordVideo(); setExportMenu(false); }}><MonitorPlay size={16}/><span><strong>Record WebM</strong><small>Camera view video recording</small></span></button>
          </div>}
        </div>
        <button className="header-icon-btn help-icon" title="Keyboard shortcuts" onClick={() => setHelpOpen(true)}><CircleHelp size={18}/></button>
      </div>
      <input ref={fileInput} className="hidden-input" type="file" accept=".json,application/json" onChange={importProject}/>
    </header>
    <main className="studio-layout">
      <div className={`left-slot ${mobilePanel==='explorer'?'mobile-open':''}`}><Explorer/></div>
      <div className="center-slot"><Viewport/><Timeline/></div>
      <div className={`right-slot ${mobilePanel==='inspector'?'mobile-open':''}`}><Inspector/></div>
    </main>
    <footer className="status-bar"><div><span className="status-dot"/> ENGINE READY <span className="status-divider">|</span> THREE.JS / WEBGL <span className="status-divider">|</span> R6 PROCEDURAL RIG</div><div className="status-right">LOCAL PROJECT <span className="status-divider">|</span> NO EXTERNAL 3D ASSETS <span className="status-divider">|</span><span className="status-strong">v1.0.0</span></div></footer>
    <div className="mobile-toolbar"><button className={mobilePanel==='explorer'?'active':''} onClick={() => setMobilePanel(mobilePanel==='explorer'?null:'explorer')}><Layers3 size={17}/> Explorer</button><button onClick={() => setHelpOpen(true)}><Menu size={17}/> Shortcuts</button><button className={mobilePanel==='inspector'?'active':''} onClick={() => setMobilePanel(mobilePanel==='inspector'?null:'inspector')}><MoreHorizontal size={17}/> Inspector</button></div>
    {notification && <div key={notification} className="toast"><Check size={15}/>{notification}<button title="Dismiss notification" onClick={() => flash('')}><X size={13}/></button></div>}
    {helpOpen && <div className="modal-backdrop" onClick={() => setHelpOpen(false)}><div className="help-modal" onClick={e => e.stopPropagation()}>
      <div className="help-modal-title"><span><Keyboard size={19}/> Keyboard shortcuts</span><button className="header-icon-btn" onClick={() => setHelpOpen(false)}><X size={17}/></button></div>
      <p>Build procedural animations by selecting an object or body joint, adjusting its transform, inserting a keyframe, and scrubbing the timeline.</p>
      {([['Space','Play / pause'], ['G / R / S','Move / rotate / scale gizmo'], ['K','Insert keyframe on selected track'], ['← / →','Previous / next frame'], ['C','Toggle cinematic camera'], ['Delete','Delete selected object or keyframe'], ['Ctrl / Cmd + D','Duplicate selected object'], ['Ctrl / Cmd + Z','Undo'], ['Ctrl / Cmd + Shift + Z','Redo'], ['Ctrl / Cmd + S','Export JSON project']] as const).map(([key, meaning])=><div className="shortcut-row" key={key}><span>{meaning}</span><kbd>{key}</kbd></div>)}
      <div className="help-modal-footer">Tip: select <strong>Shot Camera</strong> in Explorer, add camera keyframes, then click <strong>Camera view</strong> for cinematic playback.</div>
    </div></div>}
  </div>;
}
