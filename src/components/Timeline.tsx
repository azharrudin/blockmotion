import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, CircleHelp, Diamond, FastForward, KeyRound, Pause, Play, Plus, Repeat2, Rewind, SkipBack, SkipForward, Trash2 } from 'lucide-react';
import { useEditor } from '../editor/store';
import { JOINT_IDS } from '../editor/types';
import { isCharacter, jointNodeId } from '../editor/characters';
import { timelineTracks } from '../editor/tracks';
import { KeyframeActions } from './KeyframeActions';

const clock = (time: number) => {
  const min = Math.floor(time / 60).toString().padStart(2, '0');
  const sec = Math.floor(time % 60).toString().padStart(2, '0');
  const cs = Math.floor((time % 1) * 100).toString().padStart(2, '0');
  return `${min}:${sec}.${cs}`;
};
const TICKS = 10;
export function Timeline() {
  const s = useEditor();
  const moving = useRef<{ node: string; id: string } | null>(null);
  const tracks = timelineTracks(s.project);
  const contents = useRef<HTMLDivElement>(null);
  const selectedTrack = s.selection;
  useEffect(() => {
    contents.current?.querySelector('.track-label.active')?.scrollIntoView({ block: 'nearest' });
  }, [selectedTrack, tracks.length]);
  const selectTrack = (id: string) => s.select(id);
  const active = (id: string) => (s.selection) === id;
  const duration = s.project.duration;
  const percent = (time: number) => `${(time / duration) * 100}%`;
  const toTime = (element: HTMLElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    const time = Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
    return Math.round(time * s.project.fps) / s.project.fps;
  };
  const onRulerPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    s.seek(toTime(e.currentTarget, e.clientX));
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onRulerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 1) s.seek(toTime(e.currentTarget, e.clientX));
  };
  const step = (direction: number) => s.seek(s.time + direction / s.project.fps);
  const character = s.project.objects?.find(o => o.id === s.selectedObject && isCharacter(o));
  const allPose = () => {
    if (!character) return;
    for (const id of [character.id, ...JOINT_IDS.map(joint => jointNodeId(character.id, joint))]) useEditor.getState().commitKey(id);
    s.flash(`Keyframes added to ${character.name}`);
  };
  return <section className="timeline-panel">
    <div className="timeline-heading">
      <div className="timeline-heading-title"><Diamond size={15} className="blue-icon"/> ANIMATION TIMELINE <span className="timeline-clip">Action / Main</span></div>
      <div className="timeline-title-right"><span className="fps-pill">{s.project.fps} FPS</span><CircleHelp size={14}/></div>
    </div>
    <div className="transport-bar">
      <div className="transport-left"><span className="timecode"><span className="timecode-indicator"/>{clock(s.time)}</span><span className="transport-divider"/><span className="frame-count">FRAME {Math.round(s.time * s.project.fps).toString().padStart(3,'0')}</span></div>
      <div className="transport-center">
        <button className="transport-btn" title="Go to beginning" onClick={() => s.seek(0)}><SkipBack size={15}/></button>
        <button className="transport-btn" title="Previous frame (←)" onClick={() => step(-1)}><Rewind size={15}/></button>
        <button className="play-btn" title="Play / pause (Space)" onClick={() => s.play()}>{s.playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button>
        <button className="transport-btn" title="Next frame (→)" onClick={() => step(1)}><FastForward size={15}/></button>
        <button className="transport-btn" title="Go to end" onClick={() => s.seek(duration)}><SkipForward size={15}/></button>
      </div>
      <div className="transport-right">
        <button className={`loop-button ${s.looping ? 'active' : ''}`} title="Loop playback" onClick={() => s.setLooping(!s.looping)}><Repeat2 size={14}/> Loop</button>
        <button className={`loop-button ${s.autoKey ? 'active' : ''}`} title="Auto insert keyframes when transforms are edited" onClick={() => s.setAutoKey(!s.autoKey)}><span className="autokey-dot"/> Auto key</button>
      </div>
    </div>
    <div className="track-actions">
      <span className="track-list-heading">TRACKS <span>({tracks.length})</span></span>
      <button title="Insert keyframe on selected track (K)" onClick={() => s.commitKey()}><Plus size={13}/> Keyframe</button>
      <button title="Insert keyframes for the selected character and its joints" disabled={!character} onClick={allPose}><KeyRound size={13}/> Key pose</button>
      <button title="Delete selected keyframe" disabled={!s.selectedKey} onClick={() => s.deleteKey()}><Trash2 size={13}/></button>
      <KeyframeActions/>
      <span className="track-actions-spacer"/>
      <span className="timeline-instruction">Click ruler to scrub · click diamond to select</span>
      <ChevronUp size={14} className="muted"/>
    </div>
    <div className="timeline-contents" ref={contents}>
      <div className="timeline-labels">
        <div className="ruler-stub"><span>Object / Joint</span></div>
        {tracks.map(track => <button className={`track-label ${track.joint ? 'joint-track-label' : ''} ${active(track.id) ? 'active' : ''}`} key={track.id} data-track-id={track.id} title={track.title} onClick={() => selectTrack(track.id)}><span className="track-collapse">{track.object && !track.joint ? <ChevronDown size={12}/> : null}</span><span className={`track-color ${track.object ? 'object-track' : track.id === 'camera' ? 'camera-track' : ''}`}/><span className="track-name">{track.label}</span><span className="track-key-count">{track.keys.length}</span></button>)}
      </div>
      <div className="timeline-canvas">
        <div className="ruler" onPointerDown={onRulerPointer} onPointerMove={onRulerMove}>
          {Array.from({length:TICKS+1}, (_, i) => <div className="tick-label" key={i} style={{left: `${i*100/TICKS}%`}}>{(duration*i/TICKS).toFixed(1)}s</div>)}
          <div className="ruler-playhead" style={{left: percent(s.time)}}/>
        </div>
        <div className="timeline-grid">
          {tracks.map(({ id, title, keys }) => <div key={id} data-track-id={id} className={`track-row ${active(id) ? 'active' : ''}`} onClick={e => { selectTrack(id); s.setSelectedKey(null); s.seek(toTime(e.currentTarget, e.clientX)); }}>
            <div className="track-grid-lines">{Array.from({length:TICKS+1}, (_, i) => <span key={i} style={{left:`${i*100/TICKS}%`}}/>)}</div>
            {keys.map(k => <button key={k.id} className={`keyframe-diamond ${s.selectedKey?.node === id && s.selectedKey.id === k.id ? 'selected' : ''}`} style={{left: percent(k.time)}} title={`${title} @ ${k.time.toFixed(2)}s — drag to move`} onPointerDown={e => { e.stopPropagation(); moving.current = {node:id,id:k.id}; e.currentTarget.setPointerCapture(e.pointerId); }} onClick={e => e.stopPropagation()} onPointerUp={e => {
              e.stopPropagation();
              const start = moving.current;
              moving.current = null;
              if (!start) return;
              const row = e.currentTarget.parentElement;
              if (!row) return;
              const t = toTime(row, e.clientX);
              if (Math.abs(t-k.time) > 0.5 / s.project.fps) s.moveKey(id, k.id, t);
              else { s.seek(k.time); useEditor.getState().setSelectedKey({node:id,id:k.id}); }
            }}><Diamond size={13} fill="currentColor" strokeWidth={1.5}/></button>)}
          </div>)}
          <div className="timeline-playhead-line" style={{left:percent(s.time)}}/>
        </div>
      </div>
    </div>
    <div className="timeline-footer"><span>START <strong>0.00s</strong></span><span>END <strong>{duration.toFixed(2)}s</strong></span><span className="footer-spacer"/><span>INTERPOLATION <strong>{s.project.interpolation.toUpperCase()}</strong></span><span> <ChevronDown size={12}/></span></div>
  </section>;
}
