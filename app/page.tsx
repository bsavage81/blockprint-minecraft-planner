"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Block = {
  id: string;
  name: string;
  category: string;
  color?: string;
  texture?: string;
  textureUrl?: string;
};

type Blueprint = {
  name: string;
  width: number;
  depth: number;
  layers: Record<string, string>[];
};

const BLOCKS: Block[] = [
  { id: "oak", name: "Oak Planks", category: "Wood", color: "#b88952", texture: "linear-gradient(0deg,#8a613c 1px,transparent 1px)" },
  { id: "spruce", name: "Spruce Planks", category: "Wood", color: "#6f4c2d", texture: "linear-gradient(0deg,#4e341f 1px,transparent 1px)" },
  { id: "dark-oak", name: "Dark Oak", category: "Wood", color: "#3e291c", texture: "linear-gradient(90deg,#24170f 1px,transparent 1px)" },
  { id: "birch", name: "Birch Planks", category: "Wood", color: "#d9c990", texture: "linear-gradient(0deg,#ad9c65 1px,transparent 1px)" },
  { id: "stone-bricks", name: "Stone Bricks", category: "Masonry", color: "#777875", texture: "repeating-linear-gradient(0deg,transparent 0 7px,#565754 7px 8px)" },
  { id: "cobble", name: "Cobblestone", category: "Masonry", color: "#686a67", texture: "radial-gradient(circle at 30% 30%,#8a8b87 0 2px,transparent 3px)" },
  { id: "bricks", name: "Bricks", category: "Masonry", color: "#914c3c", texture: "repeating-linear-gradient(0deg,transparent 0 7px,#673429 7px 8px)" },
  { id: "quartz", name: "Smooth Quartz", category: "Masonry", color: "#e5e0d6", texture: "none" },
  { id: "white-concrete", name: "White Concrete", category: "Color", color: "#d8d9d2", texture: "none" },
  { id: "terracotta", name: "Terracotta", category: "Color", color: "#985d47", texture: "none" },
  { id: "deepslate", name: "Deepslate Tiles", category: "Roof", color: "#34343a", texture: "repeating-linear-gradient(45deg,transparent 0 5px,#24242a 5px 6px)" },
  { id: "dark-oak-stairs", name: "Dark Oak Stairs", category: "Roof", color: "#4b3021", texture: "linear-gradient(135deg,transparent 48%,#22160f 49% 54%,transparent 55%)" },
  { id: "glass", name: "Glass Pane", category: "Details", color: "#9dd8dc", texture: "linear-gradient(135deg,transparent 43%,#d9ffff 44% 54%,transparent 55%)" },
  { id: "oak-door", name: "Oak Door", category: "Details", color: "#8b5b30", texture: "radial-gradient(circle at 75% 50%,#dab45f 0 1px,transparent 2px)" },
  { id: "ladder", name: "Ladder", category: "Details", color: "#bd8a45", texture: "repeating-linear-gradient(0deg,transparent 0 4px,#5d3d1c 4px 5px)" },
  { id: "torch", name: "Torch", category: "Details", color: "#e7ad2f", texture: "radial-gradient(circle,#fff098 0 2px,#e5791b 3px,transparent 4px)" },
  { id: "grass", name: "Grass Block", category: "Terrain", color: "#578a42", texture: "radial-gradient(circle at 25% 30%,#79a85d 0 1px,transparent 2px)" },
  { id: "water", name: "Water", category: "Terrain", color: "#3d72cc", texture: "repeating-linear-gradient(0deg,transparent 0 4px,#77a4ef 4px 5px)" },
];

const SIZE_PRESETS = [[16,16], [24,24], [30,30], [32,32]];
const EMPTY_BLUEPRINT: Blueprint = { name: "Sears No. 144", width: 30, depth: 30, layers: [{}] };

export default function Home() {
  const [blocks, setBlocks] = useState<Block[]>(BLOCKS);
  const [blueprint, setBlueprint] = useState<Blueprint>(EMPTY_BLUEPRINT);
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState("oak");
  const [tool, setTool] = useState<"paint" | "erase">("paint");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showGrid, setShowGrid] = useState(true);
  const painting = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("blockprint-blueprint");
    if (saved) {
      try { setBlueprint(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    fetch("/bedrock-blocks.json")
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data.blocks) && data.blocks.length) {
          setBlocks(data.blocks);
          setSelected(data.blocks[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("blockprint-blueprint", JSON.stringify(blueprint));
  }, [blueprint]);

  const categories = ["All", ...Array.from(new Set(blocks.map(b => b.category)))];
  const visibleBlocks = blocks.filter(b =>
    (category === "All" || b.category === category) &&
    b.name.toLowerCase().includes(search.toLowerCase())
  );
  const current = blueprint.layers[layer] ?? {};
  const materialCounts = useMemo(() => {
    const counts = new Map<string, number>();
    blueprint.layers.forEach(l => Object.values(l).forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1)));
    return [...counts.entries()].sort((a,b) => b[1] - a[1]);
  }, [blueprint]);

  function paintCell(index: number) {
    setBlueprint(prev => {
      const layers = prev.layers.map((l, i) => i === layer ? { ...l } : l);
      if (tool === "erase") delete layers[layer][index];
      else layers[layer][index] = selected;
      return { ...prev, layers };
    });
  }

  function changeSize(width: number, depth: number) {
    setBlueprint(prev => ({ ...prev, width, depth, layers: prev.layers.map(() => ({})) }));
    setLayer(0);
  }

  function addLayer(copy = false) {
    setBlueprint(prev => {
      const layers = [...prev.layers];
      layers.splice(layer + 1, 0, copy ? { ...layers[layer] } : {});
      return { ...prev, layers };
    });
    setLayer(layer + 1);
  }

  function deleteLayer() {
    if (blueprint.layers.length === 1) return;
    setBlueprint(prev => ({ ...prev, layers: prev.layers.filter((_, i) => i !== layer) }));
    setLayer(Math.max(0, layer - 1));
  }

  function download() {
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${blueprint.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.blockprint.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importFile(file?: File) {
    if (!file) return;
    file.text().then(text => {
      try {
        const next = JSON.parse(text) as Blueprint;
        if (!next.width || !next.depth || !Array.isArray(next.layers)) return;
        setBlueprint(next); setLayer(0);
      } catch {}
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-cube" aria-hidden="true" />
          <div><strong>Blockprint</strong><span>Minecraft build planner</span></div>
        </div>
        <input className="project-name" aria-label="Blueprint name" value={blueprint.name}
          onChange={e => setBlueprint({ ...blueprint, name: e.target.value })} />
        <div className="header-actions">
          <label className="button secondary">Import<input type="file" accept=".json" hidden onChange={e => importFile(e.target.files?.[0])}/></label>
          <button className="button primary" onClick={download}>Export blueprint</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="palette-panel">
          <div className="panel-heading"><div><span className="eyebrow">Bedrock samples</span><h2>Block palette</h2></div><span className="count">{blocks.length}</span></div>
          <input className="search" placeholder="Search blocks…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="category-tabs">
            {categories.map(c => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          <div className="block-list">
            {visibleBlocks.map(block => (
              <button key={block.id} className={`block-option ${selected === block.id && tool === "paint" ? "selected" : ""}`}
                onClick={() => { setSelected(block.id); setTool("paint"); }}>
                <span className="block-swatch" style={{
                  backgroundColor:block.color,
                  backgroundImage:block.textureUrl ? `url(${block.textureUrl})` : block.texture,
                  backgroundSize:block.textureUrl ? "cover" : undefined
                }} />
                <span><strong>{block.name}</strong><small>{block.category}</small></span>
              </button>
            ))}
          </div>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="tool-group">
              <button className={tool === "paint" ? "active" : ""} onClick={() => setTool("paint")}>Paint</button>
              <button className={tool === "erase" ? "active" : ""} onClick={() => setTool("erase")}>Erase</button>
            </div>
            <div className="layer-nav">
              <button disabled={layer === 0} onClick={() => setLayer(layer - 1)}>←</button>
              <span><small>Layer</small><strong>{layer + 1} / {blueprint.layers.length}</strong></span>
              <button disabled={layer === blueprint.layers.length - 1} onClick={() => setLayer(layer + 1)}>→</button>
            </div>
            <label className="grid-toggle"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Grid</label>
          </div>
          <div className="canvas-scroll">
            <div className={`blueprint-grid ${showGrid ? "" : "grid-off"}`}
              style={{ gridTemplateColumns:`repeat(${blueprint.width}, var(--cell))`, gridTemplateRows:`repeat(${blueprint.depth}, var(--cell))` }}
              onPointerLeave={() => { painting.current = false; }}
              onPointerUp={() => { painting.current = false; }}>
              {Array.from({ length: blueprint.width * blueprint.depth }, (_, index) => {
                const block = blocks.find(b => b.id === current[index]);
                return <button key={index} aria-label={`Column ${index % blueprint.width + 1}, row ${Math.floor(index / blueprint.width) + 1}${block ? `, ${block.name}` : ", empty"}`}
                  className={`cell ${block ? "filled" : ""}`}
                  style={block ? {
                    backgroundColor:block.color,
                    backgroundImage:block.textureUrl ? `url(${block.textureUrl})` : block.texture,
                    backgroundSize:block.textureUrl ? "cover" : undefined
                  } : undefined}
                  onPointerDown={e => { e.preventDefault(); painting.current = true; paintCell(index); }}
                  onPointerEnter={() => { if (painting.current) paintCell(index); }} />;
              })}
            </div>
          </div>
          <div className="canvas-footer">
            <span>{blueprint.width} × {blueprint.depth} blocks</span>
            <span>{Object.keys(current).length} blocks on this layer</span>
            <span>Auto-saved on this device</span>
          </div>
        </section>

        <aside className="details-panel">
          <section>
            <span className="eyebrow">Blueprint</span><h2>Build setup</h2>
            <label className="field">Canvas size
              <select value={`${blueprint.width}x${blueprint.depth}`} onChange={e => {
                const [w,d] = e.target.value.split("x").map(Number); changeSize(w,d);
              }}>{SIZE_PRESETS.map(([w,d]) => <option key={w} value={`${w}x${d}`}>{w} × {d}</option>)}</select>
            </label>
            <div className="layer-actions">
              <button onClick={() => addLayer(false)}>+ Empty layer</button>
              <button onClick={() => addLayer(true)}>Duplicate</button>
              <button className="danger" disabled={blueprint.layers.length === 1} onClick={deleteLayer}>Delete</button>
            </div>
          </section>
          <section className="materials">
            <div className="panel-heading"><div><span className="eyebrow">Automatic</span><h2>Material list</h2></div><span className="count">{materialCounts.reduce((n,[,v]) => n + v, 0)}</span></div>
            {materialCounts.length === 0 ? <p className="empty-state">Paint blocks on the grid to start a materials list.</p> :
              <ol>{materialCounts.map(([id, amount]) => {
                const block = blocks.find(b => b.id === id);
                if (!block) return null;
                return <li key={id}><span className="mini-swatch" style={{
                  backgroundColor:block.color,
                  backgroundImage:block.textureUrl ? `url(${block.textureUrl})` : block.texture,
                  backgroundSize:block.textureUrl ? "cover" : undefined
                }}/><span>{block.name}</span><strong>{amount}</strong></li>;
              })}</ol>}
          </section>
          <section className="quick-tips">
            <span className="eyebrow">Spreadsheet familiar</span>
            <p>Each cell is one block. Add layers as you build upward, then export the complete plan as a portable file.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
