import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Box, Plus, Search, Upload, X } from 'lucide-react';
import { ASSET_CATALOG, MAX_OBJECTS } from '../editor/assets';
import type { AssetKind } from '../editor/types';
import { useEditor } from '../editor/store';
import { preloadModel } from '../engine/ModelAssets';
import { studioRef } from './Viewport';

const CATEGORIES = ['All', 'Custom', 'Cameras', 'Characters', 'Nature', 'Town', 'Primitives'];
const TOWN_SECTIONS = ['All Town', 'Roads', 'Street props', 'Transport', 'Buildings', 'Park', 'Details'];
export function AssetLibrary() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [section, setSection] = useState('All Town');
  const { project, addObject, addImportedModel } = useEditor(useShallow(state => ({ project: state.project, addObject: state.addObject, addImportedModel: state.addImportedModel })));
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const count = project.objects?.length ?? 0;
  const entries = (Object.entries(ASSET_CATALOG) as [AssetKind, (typeof ASSET_CATALOG)[AssetKind]][]).filter(([kind, asset]) =>
    kind !== 'imported' &&
    (category === 'All' || asset.category === category) &&
    (category !== 'Town' || section === 'All Town' || asset.section === section) &&
    `${asset.label} ${asset.category} ${asset.section ?? ''} ${asset.keywords ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const importModel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const flash = useEditor.getState().flash;
    const lower = file.name.toLowerCase();
    const format = lower.endsWith('.glb') ? 'glb' as const : lower.endsWith('.gltf') ? 'gltf' as const : null;
    if (!format) { flash('Choose a .glb or .gltf file'); return; }
    if (file.size > 2_500_000) { flash('Model file exceeds 2.5 MB'); return; }
    setImporting(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Could not read the model file'));
        reader.readAsDataURL(file);
      });
      const model = { name: file.name.replace(/\.(glb|gltf)$/i, '').slice(0, 60), data, format };
      if (!await preloadModel(model)) throw new Error('Model could not be parsed — try a .glb file');
      addImportedModel(model, model.name);
      studioRef.current?.focusSelected();
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not import model');
    } finally { setImporting(false); }
  };
  return <div className="asset-library">
    <button className="add-object-button" onClick={() => setOpen(!open)} aria-expanded={open}><Plus size={15}/> Add object / Presets <span>{count}/{MAX_OBJECTS}</span></button>
    {open && <div className="asset-library-content">
      <div className="asset-library-search"><Search size={13}/><input aria-label="Search object presets" placeholder="Search presets…" value={query} onChange={e => setQuery(e.target.value)}/><button title="Close object library" onClick={() => setOpen(false)}><X size={13}/></button></div>
      <div className="asset-library-filters">
        <label>Category<select aria-label="Asset category" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        {category === 'Town' && <label>Town section<select aria-label="Town section" value={section} onChange={e => setSection(e.target.value)}>{TOWN_SECTIONS.map(value => <option key={value}>{value}</option>)}</select></label>}
      </div>
      <div className="asset-import">
        <button type="button" className="asset-import-button" disabled={importing || count >= MAX_OBJECTS} onClick={() => fileInput.current?.click()}><Upload size={14}/> {importing ? 'Importing…' : 'Import 3D model (.glb/.gltf)'}</button>
        <input ref={fileInput} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" hidden onChange={importModel}/>
        <p className="preset-note">Models are embedded in the project (max 2.5 MB). Script objects run Three.js code in this page — only use trusted code.</p>
      </div>
      {CATEGORIES.slice(1).map(group => {
        const items = entries.filter(([, asset]) => asset.category === group);
        if (!items.length) return null;
        const sections = group === 'Town' ? TOWN_SECTIONS.slice(1) : [''];
        return <div className="asset-category" key={group}>
          <div className="section-label">{group}<span className="asset-result-count">{items.length}</span></div>
          {sections.map(subgroup => {
            const shown = subgroup ? items.filter(([, asset]) => asset.section === subgroup) : items;
            return shown.length > 0 && <div className="asset-subgroup" key={subgroup}>
              {subgroup && <div className="asset-section-title">{subgroup}</div>}
              <div className="asset-preset-grid">{shown.map(([kind, asset]) => <button key={kind} data-asset-kind={kind} disabled={count >= MAX_OBJECTS} onClick={() => { addObject(kind); studioRef.current?.focusSelected(); }} title={`Add ${asset.label}`}><Box size={16} style={{ color: asset.color }}/><span>{asset.label}</span><Plus size={12}/></button>)}</div>
            </div>;
          })}
        </div>;
      })}
      {entries.length === 0 && <p className="sidebar-copy">No matching presets.</p>}
      {category === 'Town' && <p className="preset-note">Road modules use 6 units. Use Snap 6 u to join road centers, or 0.5 u to align sidewalks at the road edge. Vehicles, water, and traffic lights are editable scene props.</p>}
      <p className="preset-note">Every object has keyframes. Expand characters in Explorer to select individual joints.</p>
    </div>}
  </div>;
}
