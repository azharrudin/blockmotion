import { useState } from 'react';
import { Box, Plus, Search, X } from 'lucide-react';
import { ASSET_CATALOG, MAX_OBJECTS } from '../editor/assets';
import type { AssetKind } from '../editor/types';
import { useEditor } from '../editor/store';
import { studioRef } from './Viewport';

const CATEGORIES = ['All', 'Characters', 'Nature', 'Town', 'Primitives'];
const TOWN_SECTIONS = ['All Town', 'Roads', 'Street props', 'Transport', 'Buildings', 'Park', 'Details'];
export function AssetLibrary() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [section, setSection] = useState('All Town');
  const { project, addObject } = useEditor();
  const count = project.objects?.length ?? 0;
  const entries = (Object.entries(ASSET_CATALOG) as [AssetKind, (typeof ASSET_CATALOG)[AssetKind]][]).filter(([, asset]) =>
    (category === 'All' || asset.category === category) &&
    (category !== 'Town' || section === 'All Town' || asset.section === section) &&
    `${asset.label} ${asset.category} ${asset.section ?? ''} ${asset.keywords ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="asset-library">
    <button className="add-object-button" onClick={() => setOpen(!open)} aria-expanded={open}><Plus size={15}/> Add object / Presets <span>{count}/{MAX_OBJECTS}</span></button>
    {open && <div className="asset-library-content">
      <div className="asset-library-search"><Search size={13}/><input aria-label="Search object presets" placeholder="Search presets…" value={query} onChange={e => setQuery(e.target.value)}/><button title="Close object library" onClick={() => setOpen(false)}><X size={13}/></button></div>
      <div className="asset-library-filters">
        <label>Category<select aria-label="Asset category" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        {category === 'Town' && <label>Town section<select aria-label="Town section" value={section} onChange={e => setSection(e.target.value)}>{TOWN_SECTIONS.map(value => <option key={value}>{value}</option>)}</select></label>}
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
