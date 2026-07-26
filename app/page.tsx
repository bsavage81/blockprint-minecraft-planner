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

type Selection = { start: number; end: number };
type Clipboard = { width: number; height: number; cells: Record<string, string> };

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
  const [tool, setTool] = useState<"paint" | "erase" | "select" | "line" | "fill">("paint");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showGrid, setShowGrid] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [history, setHistory] = useState<Blueprint[]>([]);
  const [linePreview, setLinePreview] = useState<number[]>([]);
  const painting = useRef(false);
  const selecting = useRef(false);
  const lining = useRef(false);
  const lineStart = useRef<number | null>(null);
  const lineEnd = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("blockprint-blueprint");
    if (saved) {
      try { setBlueprint(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    fetch("./bedrock-blocks.json")
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelection(null);
        selecting.current = false;
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      } else if (command && event.key.toLowerCase() === "c" && selection) {
        event.preventDefault();
        copySelection();
      } else if (command && event.key.toLowerCase() === "x" && selection) {
        event.preventDefault();
        cutSelection();
      } else if (command && event.key.toLowerCase() === "v" && clipboard) {
        event.preventDefault();
        pasteSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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

  function checkpoint() {
    setHistory(previous => [...previous.slice(-49), structuredClone(blueprint)]);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory(items => items.slice(0, -1));
    setBlueprint(previous);
    setSelection(null);
    setLayer(currentLayer => Math.min(currentLayer, previous.layers.length - 1));
  }

  function selectionBounds(value = selection) {
    if (!value) return null;
    const startX = value.start % blueprint.width;
    const startY = Math.floor(value.start / blueprint.width);
    const endX = value.end % blueprint.width;
    const endY = Math.floor(value.end / blueprint.width);
    return {
      left: Math.min(startX, endX),
      right: Math.max(startX, endX),
      top: Math.min(startY, endY),
      bottom: Math.max(startY, endY),
    };
  }

  function selectionClass(index: number) {
    const bounds = selectionBounds();
    if (!bounds) return "";
    const x = index % blueprint.width;
    const y = Math.floor(index / blueprint.width);
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return "";
    return [
      "selection-cell",
      y === bounds.top ? "selection-top" : "",
      y === bounds.bottom ? "selection-bottom" : "",
      x === bounds.left ? "selection-left" : "",
      x === bounds.right ? "selection-right" : "",
    ].filter(Boolean).join(" ");
  }

  function copySelection() {
    const bounds = selectionBounds();
    if (!bounds) return null;
    const cells: Record<string, string> = {};
    for (let y = bounds.top; y <= bounds.bottom; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        const block = current[y * blueprint.width + x];
        if (block) cells[(y - bounds.top) * (bounds.right - bounds.left + 1) + (x - bounds.left)] = block;
      }
    }
    const next = {
      width: bounds.right - bounds.left + 1,
      height: bounds.bottom - bounds.top + 1,
      cells,
    };
    setClipboard(next);
    return next;
  }

  function cutSelection() {
    const bounds = selectionBounds();
    if (!bounds || !copySelection()) return;
    checkpoint();
    setBlueprint(previous => {
      const layers = previous.layers.map((item, index) => index === layer ? { ...item } : item);
      for (let y = bounds.top; y <= bounds.bottom; y++) {
        for (let x = bounds.left; x <= bounds.right; x++) delete layers[layer][y * previous.width + x];
      }
      return { ...previous, layers };
    });
  }

  function pasteSelection() {
    if (!clipboard) return;
    const bounds = selectionBounds();
    const anchorX = bounds?.left ?? 0;
    const anchorY = bounds?.top ?? 0;
    checkpoint();
    setBlueprint(previous => {
      const layers = previous.layers.map((item, index) => index === layer ? { ...item } : item);
      for (const [offset, block] of Object.entries(clipboard.cells)) {
        const value = Number(offset);
        const x = anchorX + value % clipboard.width;
        const y = anchorY + Math.floor(value / clipboard.width);
        if (x < previous.width && y < previous.depth) layers[layer][y * previous.width + x] = block;
      }
      return { ...previous, layers };
    });
    const endX = Math.min(blueprint.width - 1, anchorX + clipboard.width - 1);
    const endY = Math.min(blueprint.depth - 1, anchorY + clipboard.height - 1);
    setSelection({ start: anchorY * blueprint.width + anchorX, end: endY * blueprint.width + endX });
  }

  function lineIndices(start: number, end: number) {
    let x0 = start % blueprint.width;
    let y0 = Math.floor(start / blueprint.width);
    const x1 = end % blueprint.width;
    const y1 = Math.floor(end / blueprint.width);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    const result: number[] = [];
    while (true) {
      result.push(y0 * blueprint.width + x0);
      if (x0 === x1 && y0 === y1) break;
      const doubled = 2 * error;
      if (doubled >= dy) { error += dy; x0 += sx; }
      if (doubled <= dx) { error += dx; y0 += sy; }
    }
    return result;
  }

  function commitLine() {
    if (!lining.current || lineStart.current === null || lineEnd.current === null) return;
    const indices = lineIndices(lineStart.current, lineEnd.current);
    checkpoint();
    setBlueprint(previous => {
      const layers = previous.layers.map((item, index) => index === layer ? { ...item } : item);
      indices.forEach(index => { layers[layer][index] = selected; });
      return { ...previous, layers };
    });
    lining.current = false;
    lineStart.current = null;
    lineEnd.current = null;
    setLinePreview([]);
  }

  function fillArea(start: number) {
    const target = current[start];
    if (target === selected) return;
    const visited = new Set<number>();
    const queue = [start];
    const matches = (index: number) => current[index] === target;
    while (queue.length) {
      const index = queue.pop()!;
      if (visited.has(index) || !matches(index)) continue;
      visited.add(index);
      const x = index % blueprint.width;
      const y = Math.floor(index / blueprint.width);
      if (x > 0) queue.push(index - 1);
      if (x < blueprint.width - 1) queue.push(index + 1);
      if (y > 0) queue.push(index - blueprint.width);
      if (y < blueprint.depth - 1) queue.push(index + blueprint.width);
    }
    if (!visited.size) return;
    checkpoint();
    setBlueprint(previous => {
      const layers = previous.layers.map((item, index) => index === layer ? { ...item } : item);
      visited.forEach(index => { layers[layer][index] = selected; });
      return { ...previous, layers };
    });
  }

  function paintCell(index: number) {
    setBlueprint(prev => {
      const layers = prev.layers.map((l, i) => i === layer ? { ...l } : l);
      if (tool === "erase") delete layers[layer][index];
      else layers[layer][index] = selected;
      return { ...prev, layers };
    });
  }

  function changeSize(width: number, depth: number) {
    checkpoint();
    setBlueprint(prev => ({ ...prev, width, depth, layers: prev.layers.map(() => ({})) }));
    setLayer(0);
    setSelection(null);
  }

  function addLayer(copy = false) {
    checkpoint();
    setBlueprint(prev => {
      const layers = [...prev.layers];
      layers.splice(layer + 1, 0, copy ? { ...layers[layer] } : {});
      return { ...prev, layers };
    });
    setLayer(layer + 1);
  }

  function deleteLayer() {
    if (blueprint.layers.length === 1) return;
    checkpoint();
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
        checkpoint(); setBlueprint(next); setLayer(0); setSelection(null);
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
            <div className="toolbar-left">
              <div className="tool-group">
                <button className={tool === "paint" ? "active" : ""} onClick={() => setTool("paint")}>Paint</button>
                <button className={tool === "erase" ? "active" : ""} onClick={() => setTool("erase")}>Erase</button>
                <button className={tool === "line" ? "active" : ""} onClick={() => setTool("line")}>Line</button>
                <button className={tool === "fill" ? "active" : ""} onClick={() => setTool("fill")}>Fill</button>
                <button className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}>Select</button>
              </div>
              <div className="edit-group" aria-label="Edit selection">
                <button disabled={!history.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
                <button disabled={!selection} onClick={copySelection} title="Copy (Ctrl+C)">Copy</button>
                <button disabled={!selection} onClick={cutSelection} title="Cut (Ctrl+X)">Cut</button>
                <button disabled={!clipboard} onClick={pasteSelection} title="Paste at selection (Ctrl+V)">Paste</button>
                <button disabled={!selection} onClick={() => { setSelection(null); selecting.current = false; }} title="Cancel selection (Esc)">Cancel</button>
              </div>
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
              onPointerLeave={() => {
                painting.current = false;
                if (lining.current) {
                  lining.current = false;
                  lineStart.current = null;
                  lineEnd.current = null;
                  setLinePreview([]);
                }
              }}
              onPointerUp={() => {
                if (lining.current) commitLine();
                painting.current = false;
                selecting.current = false;
              }}>
              {Array.from({ length: blueprint.width * blueprint.depth }, (_, index) => {
                const block = blocks.find(b => b.id === current[index]);
                return <button key={index} aria-label={`Column ${index % blueprint.width + 1}, row ${Math.floor(index / blueprint.width) + 1}${block ? `, ${block.name}` : ", empty"}`}
                  className={`cell ${block ? "filled" : ""} ${selectionClass(index)} ${linePreview.includes(index) ? "line-preview" : ""}`}
                  style={block ? {
                    backgroundColor:block.color,
                    backgroundImage:block.textureUrl ? `url(${block.textureUrl})` : block.texture,
                    backgroundSize:block.textureUrl ? "cover" : undefined
                  } : undefined}
                  onPointerDown={e => {
                    e.preventDefault();
                    if (tool === "select") {
                      selecting.current = true;
                      setSelection({ start:index, end:index });
                    } else if (tool === "line") {
                      lining.current = true;
                      lineStart.current = index;
                      lineEnd.current = index;
                      setLinePreview([index]);
                    } else if (tool === "fill") {
                      fillArea(index);
                    } else {
                      checkpoint();
                      painting.current = true;
                      paintCell(index);
                    }
                  }}
                  onPointerEnter={() => {
                    if (tool === "select" && selecting.current) {
                      setSelection(previous => ({ start: previous?.start ?? index, end:index }));
                    } else if (tool === "line" && lining.current && lineStart.current !== null) {
                      lineEnd.current = index;
                      setLinePreview(lineIndices(lineStart.current, index));
                    } else if (painting.current) paintCell(index);
                  }} />;
              })}
            </div>
          </div>
          <div className="canvas-footer">
            <span>{blueprint.width} × {blueprint.depth} blocks</span>
            <span>{Object.keys(current).length} blocks on this layer</span>
            <span>{selection ? "Selection active" : "No selection"}</span>
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
            <span className="eyebrow">Drawing tools</span>
            <p>Drag Line between two cells for straight walls. Fill replaces a connected area. Select supports Ctrl/Cmd+C, X, and V.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
