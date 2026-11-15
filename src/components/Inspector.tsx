import {useEffect, useState} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {Box, Camera, CircleHelp, Diamond, RotateCcw, Settings2, SlidersHorizontal} from 'lucide-react';
import {useEditor, currentPose} from '../editor/store';
import {BONE_LABELS, clonePose, neutralPose, type Pose, type SkyPreset} from '../editor/types';
import {SKY_LABELS, SKY_PRESETS} from '../editor/sky';
import {ObjectProperties} from './ObjectProperties';
import {snapToGrid} from '../editor/town';
import {ASSET_CATALOG} from '../editor/assets';

const FIELDS: {key: keyof Pose; label: string; unit: string; step: number}[] = [
  {key: "position", label: "Position", unit: "m", step: 0.1},
  {key: "rotation", label: "Rotation", unit: "°", step: 1},
  {key: "scale", label: "Scale", unit: "×", step: 0.1},
];
const AXES = ["X", "Y", "Z"] as const;
const colors = [
  {id: "skin" as const, label: "Skin"},
  {id: "shirt" as const, label: "Shirt"},
  {id: "pants" as const, label: "Pants"},
  {id: "background" as const, label: "Background"},
];

export function Inspector() {
  const [tab, setTab] = useState<'transform' | 'project'>('transform');
  // Transform readouts need fewer updates than the 3D animation; scrubbing stays exact.
  const state = useEditor(useShallow(editor => ({ ...editor,
    time: editor.playing ? Math.floor(editor.time * 10) / 10 : editor.time,
  })));
  const sky = state.project.sky ?? SKY_PRESETS.studio;
  const object = state.project.objects?.find(o => o.id === state.selectedObject);
  const nothingSelected = !state.selectedObject && state.selection !== 'camera';
  useEffect(() => { setTab('transform'); }, [state.selection]);
  const pose = currentPose();
  const uniformScale = pose.scale.every(value => Math.abs(value - pose.scale[0]) < 0.0001)
    ? Number(pose.scale[0].toFixed(2))
    : '';
  const label = state.selectedJoint ? BONE_LABELS[state.selectedJoint] : object?.name ?? 'Shot Camera';
  const updateAxis = (key: keyof Pose, axis: number, value: number) => {
    if (!Number.isFinite(value)) return;
    const next = clonePose(pose); next[key][axis] = key === 'position' && state.gridSnap && !state.selectedJoint ? snapToGrid(value, state.gridSize) : value;
    state.updatePose(state.selection, next);
  };
  const updateUniformScale = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = clonePose(pose);
    next.scale = [value, value, value];
    state.updatePose(state.selection, next);
  };
  const commit = () => { if (state.autoKey && state.overrides[state.selection]) state.commitKey(); };
  const resetPose = () => {
    state.updatePose(state.selection, neutralPose(state.selection === 'camera' ? 'camera' : undefined));
    commit();
  };
  return (
    <aside className="inspector right-panel">
      <div className="panel-heading">
        <span className="panel-heading-title">
          <SlidersHorizontal size={15} /> INSPECTOR
        </span>
        <CircleHelp size={14} className="muted" />
      </div>
      <div className="inspector-tabs">
        <button
          className={tab === "transform" ? "active" : ""}
          onClick={() => setTab("transform")}>
          <Box size={13} /> Object
        </button>
        <button
          className={tab === "project" ? "active" : ""}
          onClick={() => setTab("project")}>
          <Settings2 size={13} /> Project
        </button>
      </div>
      <div className="inspector-scroll">
        {tab === 'transform' ? nothingSelected ? <div className="selection-summary">
          <div className="selected-icon"><Box size={21}/></div>
          <div><div className="selected-name">Nothing selected</div><div className="selected-type">Click an object in the viewport or scene tree</div></div>
        </div> : <>
          <div className="selection-summary">
            <div className="selected-icon">{object ? <Box size={21}/> : <Camera size={21}/>}</div>
            <div><div className="selected-name">{label}</div><div className="selected-type">{state.selectedJoint ? `${object?.name} / Joint` : object ? ASSET_CATALOG[object.kind].label : 'Perspective camera'}</div></div>
            <span className="selected-pill">ACTIVE</span>
          </div>
          <div className="section-label with-action">TRANSFORM <button className="subtle-icon" title="Reset selected transform" onClick={resetPose}><RotateCcw size={13}/></button></div>
          {FIELDS.map(field => <div className="transform-field-group" key={field.key}>
            <div className="transform-field-heading"><span>{field.label}</span><span>{field.unit}</span></div>
            {field.key === 'scale' ? <div className="axis-grid"><label className="axis-input" style={{gridColumn: '1 / -1'}}>
              <span className="axis-letter">XYZ</span>
              <input type="number" min={0.01} max={100} step={field.step} value={uniformScale} placeholder={uniformScale === '' ? 'Mixed' : undefined}
                onChange={e => updateUniformScale(Number(e.target.value))} onBlur={commit} aria-label="Uniform scale X, Y, Z"/>
            </label></div> : <div className="axis-grid">{AXES.map((axis, i) => <label className="axis-input" key={axis}>
              <span className={`axis-letter ${axis.toLowerCase()}`}>{axis}</span>
              <input type="number" step={field.key === 'position' && state.gridSnap && !state.selectedJoint ? state.gridSize : field.step} value={Number(pose[field.key][i].toFixed(2))}
                onChange={e => updateAxis(field.key, i, Number(e.target.value))} onBlur={commit} aria-label={`${field.label} ${axis}`}/>
            </label>)}</div>}
          </div>)}
          <button className="keyframe-big-btn" onClick={() => state.commitKey()}><Diamond size={14} fill="currentColor"/> Insert keyframe <span>K</span></button>
          {object ? <ObjectProperties object={object}/> : <p className="inspector-help">Press K to record the camera transform at the playhead. Auto-key records edits on blur or after dragging.</p>}
        </> : (
          <>
            <div className="section-label">PROJECT SETTINGS</div>
            <label className="settings-field">
              <span>Project name</span>
              <input
                value={state.project.name}
                maxLength={50}
                onChange={(e) => state.updateSetting({name: e.target.value})}
              />
            </label>
            <label className="settings-field">
              <span>Duration (seconds)</span>
              <input
                type="number"
                min={0.5}
                max={600}
                step={0.5}
                value={state.project.duration}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 0.5 && n <= 600) state.updateSetting({duration: n});
                }}
              />
            </label>
            <label className="settings-field">
              <span>Frame rate</span>
              <select
                value={state.project.fps}
                onChange={(e) =>
                  state.updateSetting({fps: Number(e.target.value)})
                }>
                <option value={24}>24 FPS</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Interpolation</span>
              <select
                value={state.project.interpolation}
                onChange={(e) =>
                  state.updateSetting({
                    interpolation: e.target.value as
                      | "linear"
                      | "smooth"
                      | "step",
                  })
                }>
                <option value="smooth">Smooth ease</option>
                <option value="linear">Linear</option>
                <option value="step">Step / hold</option>
              </select>
            </label>
            <div className="inspector-divider" />
            <div className="section-label">STAGE APPEARANCE</div>
            <label className="settings-field">
              <span>Skybox</span>
              <select
                value={sky.preset}
                onChange={(e) =>
                  state.setSkyPreset(e.target.value as SkyPreset)
                }>
                {(Object.keys(SKY_LABELS) as SkyPreset[]).map((id) => (
                  <option key={id} value={id}>
                    {SKY_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            {sky.preset === "studio" &&
              colors
                .filter((c) => c.id === "background")
                .map((color) => (
                  <label key={color.id} className="color-row">
                    <span>Background</span>
                    <span className="color-control">
                      <input
                        type="color"
                        value={state.project.palette[color.id]}
                        onChange={(e) =>
                          state.updatePalette(color.id, e.target.value)
                        }
                      />
                      <span>
                        {state.project.palette[color.id].toUpperCase()}
                      </span>
                    </span>
                  </label>
                ))}
            {sky.preset === "custom" && (
              <>
                <div className="palette-fields">
                  {(
                    [
                      {id: "top", label: "Sky color"},
                      {id: "horizon", label: "Horizon color"},
                      {id: "lightColor", label: "Sun / moon color"},
                    ] as const
                  ).map(({id, label}) => (
                    <label className="color-row" key={id}>
                      <span>{label}</span>
                      <span className="color-control">
                        <input
                          aria-label={label}
                          type="color"
                          value={sky[id]}
                          onChange={(e) =>
                            state.updateSky({[id]: e.target.value})
                          }
                        />
                        <span>{sky[id].toUpperCase()}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {(
                  [
                    {
                      id: "elevation",
                      label: "Sun / moon elevation (°)",
                      min: 0,
                      max: 90,
                      step: 1,
                    },
                    {
                      id: "azimuth",
                      label: "Sun / moon direction (°)",
                      min: -180,
                      max: 180,
                      step: 1,
                    },
                    {
                      id: "intensity",
                      label: "Sun / moon intensity",
                      min: 0,
                      max: 5,
                      step: 0.1,
                    },
                    {
                      id: "ambient",
                      label: "Ambient intensity",
                      min: 0,
                      max: 4,
                      step: 0.1,
                    },
                  ] as const
                ).map(({id, label, min, max, step}) => (
                  <label className="settings-field" key={id}>
                    <span>{label}</span>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={sky[id]}
                      onChange={(e) => {
                        if (e.target.value !== "")
                          state.updateSky({[id]: Number(e.target.value)});
                      }}
                    />
                  </label>
                ))}
                <label className="switch-row">
                  <div>
                    <span>Stars</span>
                    <small>Show stars in the sky</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={sky.stars}
                    onChange={(e) => state.updateSky({stars: e.target.checked})}
                  />
                </label>
              </>
            )}
            <p className="inspector-help">
              <Settings2 size={13} /> Choose Custom to adjust the current sky
              and lighting. Sky settings are saved with your project.
            </p>
            <div className="inspector-divider" />
            <div className="section-label">PLAYBACK OPTIONS</div>
            <label className="switch-row">
              <div>
                <span>Auto keyframe</span>
                <small>Insert key after transform edits</small>
              </div>
              <input
                type="checkbox"
                checked={state.autoKey}
                onChange={(e) => state.setAutoKey(e.target.checked)}
              />
            </label>
            <label className="switch-row">
              <div>
                <span>Loop playback</span>
                <small>Restart animation automatically</small>
              </div>
              <input
                type="checkbox"
                checked={state.looping}
                onChange={(e) => state.setLooping(e.target.checked)}
              />
            </label>
            <p className="inspector-help">
              <Settings2 size={13} /> Project data is automatically stored in
              this browser and can also be exported as JSON.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
