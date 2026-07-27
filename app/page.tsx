"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { jsPDF } from "jspdf";
import { Int32, read as readNbt } from "nbtify";
import {
  buildStateAwareCatalog,
  matchCatalogBlock,
  rotateBlockStates,
  rotationFromBlockStates,
  statesEqual,
  textureForFace,
  variantId,
  type BlockStateDefinition,
} from "./bedrock-catalog";
import { encodeMcstructure } from "./mcstructure-codec";

type Block = {
  id: string;
  name: string;
  category: string;
  color?: string;
  texture?: string;
  textureUrl?: string;
  minecraftName?: string;
  minecraftStates?: Record<string, string | number | boolean>;
  stateDefinitions?: BlockStateDefinition[];
  textures?: Partial<Record<"up" | "down" | "north" | "south" | "east" | "west" | "side", string>>;
  textureVariants?: Record<string, string>;
  textureRefs?: Partial<Record<"up" | "down" | "north" | "south" | "east" | "west" | "side", string>>;
  legacyAlias?: boolean;
  officialStates?: string[];
  textureMatch?: "exact" | "material" | "missing";
  sourceRotation?: number;
};

type Blueprint = {
  name: string;
  width: number;
  depth: number;
  layers: Record<string, string>[];
  rotations?: Record<string, number>[];
  customBlocks?: Block[];
};

type Selection = { start: number; end: number };
type Clipboard = { width: number; height: number; cells: Record<string, string>; rotations: Record<string, number> };

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

const EMPTY_BLUEPRINT: Blueprint = { name: "Untitled Blockprint", width: 30, depth: 30, layers: [{}] };

export default function Home() {
  const [baseBlocks, setBaseBlocks] = useState<Block[]>(BLOCKS);
  const [blueprint, setBlueprint] = useState<Blueprint>(EMPTY_BLUEPRINT);
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState("oak");
  const [selectedRotation, setSelectedRotation] = useState(0);
  const [tool, setTool] = useState<"paint" | "erase" | "select" | "line" | "fill" | "replace" | "picker" | "grab">("paint");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showGrid, setShowGrid] = useState(true);
  const [showPreviousLayers, setShowPreviousLayers] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [history, setHistory] = useState<Blueprint[]>([]);
  const [future, setFuture] = useState<Blueprint[]>([]);
  const [linePreview, setLinePreview] = useState<number[]>([]);
  const [canvasWidth, setCanvasWidth] = useState("30");
  const [canvasDepth, setCanvasDepth] = useState("30");
  const [exporting, setExporting] = useState<"pdf" | "png" | "mcstructure" | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<string[]>([]);
  const [zoom, setZoom] = useState(22);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const painting = useRef(false);
  const selecting = useRef(false);
  const lining = useRef(false);
  const lineStart = useRef<number | null>(null);
  const lineEnd = useRef<number | null>(null);
  const canvasViewport = useRef<HTMLDivElement | null>(null);
  const panning = useRef({ active:false, pointerId:-1, startX:0, startY:0, scrollLeft:0, scrollTop:0 });
  const [isPanning, setIsPanning] = useState(false);
  const blocks = useMemo(() => [...baseBlocks, ...(blueprint.customBlocks ?? [])], [baseBlocks, blueprint.customBlocks]);

  useEffect(() => {
    const saved = localStorage.getItem("blockprint-blueprint");
    if (saved) {
      // Restore browser-owned project state after the client mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      try { setBlueprint(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("./bedrock-blocks.json").then(response => response.ok ? response.json() : Promise.reject()),
      fetch("./bedrock-block-states.json").then(response => response.ok ? response.json() : Promise.reject()),
    ])
      .then(([textures, official]) => {
        if (Array.isArray(textures.blocks) && textures.blocks.length && Array.isArray(official.blocks)) {
          const catalog = buildStateAwareCatalog(textures.blocks, official.blocks);
          setBaseBlocks(catalog);
          setSelected(catalog.find(block => !block.legacyAlias)?.id ?? catalog[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("blockprint-blueprint", JSON.stringify(blueprint));
  }, [blueprint]);

  useEffect(() => {
    // Keep editable form drafts synchronized after imports, new projects, and undo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanvasWidth(String(blueprint.width));
    setCanvasDepth(String(blueprint.depth));
  }, [blueprint.width, blueprint.depth]);

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
      if (command && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      } else if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (command && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        setZoom(value => Math.min(40, value + 2));
      } else if (command && event.key === "-") {
        event.preventDefault();
        setZoom(value => Math.max(4, value - 2));
      } else if (command && event.key === "0") {
        event.preventDefault();
        fitZoom();
      } else if (command && event.key.toLowerCase() === "c" && selection) {
        event.preventDefault();
        copySelection();
      } else if (command && event.key.toLowerCase() === "x" && selection) {
        event.preventDefault();
        cutSelection();
      } else if (command && event.key.toLowerCase() === "v" && clipboard) {
        event.preventDefault();
        pasteSelection();
      } else if (event.key === "Delete" && selection) {
        event.preventDefault();
        deleteSelection();
      } else if (!command && event.key.toLowerCase() === "r") {
        event.preventDefault();
        rotateSelected();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const categories = ["All", ...Array.from(new Set(blocks.map(b => b.category)))];
  const visibleBlocks = blocks.filter(b => !b.legacyAlias &&
    (category === "All" || b.category === category) &&
    `${blockLabel(b)} ${b.minecraftName ?? b.id}`.toLowerCase().includes(search.toLowerCase())
  );
  const current = blueprint.layers[layer] ?? {};
  const currentRotations = blueprint.rotations?.[layer] ?? {};
  const selectedBlock = blocks.find(block => block.id === selected);
  const recentBlockOptions = recentBlocks
    .filter(id => id !== selected)
    .map(id => blocks.find(block => block.id === id))
    .filter((block): block is Block => Boolean(block))
    .slice(0, 10);
  const materialCounts = useMemo(() => {
    const counts = new Map<string, number>();
    blueprint.layers.forEach(l => Object.values(l).forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1)));
    return [...counts.entries()].sort((a,b) => b[1] - a[1]);
  }, [blueprint]);

  function blockStateSummary(block: Block) {
    const defaultBlock = baseBlocks.find(candidate =>
      !candidate.legacyAlias &&
      candidate.minecraftName === block.minecraftName
    );
    const defaults = defaultBlock?.minecraftStates ?? {};
    return Object.entries(block.minecraftStates ?? {})
      .filter(([key, value]) => defaults[key] !== value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(", ");
  }

  function blockLabel(block: Block) {
    const summary = blockStateSummary(block);
    return summary ? `${block.name} (${summary})` : block.name;
  }

  function checkpoint() {
    setHistory(previous => [...previous.slice(-49), structuredClone(blueprint)]);
    setFuture([]);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory(items => items.slice(0, -1));
    setFuture(items => [...items.slice(-49), structuredClone(blueprint)]);
    setBlueprint(previous);
    setSelection(null);
    setLayer(currentLayer => Math.min(currentLayer, previous.layers.length - 1));
  }

  function redo() {
    if (!future.length) return;
    const next = future[future.length - 1];
    setFuture(items => items.slice(0, -1));
    setHistory(items => [...items.slice(-49), structuredClone(blueprint)]);
    setBlueprint(next);
    setSelection(null);
    setLayer(currentLayer => Math.min(currentLayer, next.layers.length - 1));
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
    const rotations: Record<string, number> = {};
    for (let y = bounds.top; y <= bounds.bottom; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        const block = current[y * blueprint.width + x];
        if (block) {
          const offset = (y - bounds.top) * (bounds.right - bounds.left + 1) + (x - bounds.left);
          cells[offset] = block;
          const rotation = currentRotations[y * blueprint.width + x];
          if (rotation) rotations[offset] = rotation;
        }
      }
    }
    const next = {
      width: bounds.right - bounds.left + 1,
      height: bounds.bottom - bounds.top + 1,
      cells,
      rotations,
    };
    setClipboard(next);
    return next;
  }

  function cutSelection() {
    const bounds = selectionBounds();
    if (!bounds || !copySelection()) return;
    deleteSelection();
  }

  function deleteSelection() {
    const bounds = selectionBounds();
    if (!bounds) return;
    checkpoint();
    setBlueprint(previous => {
      const layers = previous.layers.map((item, index) => index === layer ? { ...item } : item);
      const rotations = (previous.rotations ?? previous.layers.map<Record<string, number>>(() => ({}))).map((item, index) => index === layer ? { ...item } : item);
      for (let y = bounds.top; y <= bounds.bottom; y++) {
        for (let x = bounds.left; x <= bounds.right; x++) {
          delete layers[layer][y * previous.width + x];
          delete rotations[layer][y * previous.width + x];
        }
      }
      return { ...previous, layers, rotations };
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
      const rotations = (previous.rotations ?? previous.layers.map<Record<string, number>>(() => ({}))).map((item, index) => index === layer ? { ...item } : item);
      for (const [offset, block] of Object.entries(clipboard.cells)) {
        const value = Number(offset);
        const x = anchorX + value % clipboard.width;
        const y = anchorY + Math.floor(value / clipboard.width);
        if (x < previous.width && y < previous.depth) {
          const destination = y * previous.width + x;
          layers[layer][destination] = block;
          const rotation = clipboard.rotations[offset];
          if (rotation) rotations[layer][destination] = rotation;
          else delete rotations[layer][destination];
        }
      }
      return { ...previous, layers, rotations };
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
      const rotations = (previous.rotations ?? previous.layers.map<Record<string, number>>(() => ({}))).map((item, index) => index === layer ? { ...item } : item);
      indices.forEach(index => {
        layers[layer][index] = selected;
        if (selectedRotation) rotations[layer][index] = selectedRotation;
        else delete rotations[layer][index];
      });
      return { ...previous, layers, rotations };
    });
    lining.current = false;
    lineStart.current = null;
    lineEnd.current = null;
    setLinePreview([]);
  }

  function fillArea(start: number) {
    const target = current[start];
    if (target === selected && (currentRotations[start] ?? 0) === selectedRotation) return;
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
      const rotations = (previous.rotations ?? previous.layers.map<Record<string, number>>(() => ({}))).map((item, index) => index === layer ? { ...item } : item);
      visited.forEach(index => {
        layers[layer][index] = selected;
        if (selectedRotation) rotations[layer][index] = selectedRotation;
        else delete rotations[layer][index];
      });
      return { ...previous, layers, rotations };
    });
  }

  function replaceOnLayer(start: number) {
    const target = current[start];
    if (!target) return;
    const indices = Object.entries(current)
      .filter(([, blockId]) => blockId === target)
      .map(([index]) => Number(index));
    const changed = indices.some(index =>
      current[index] !== selected ||
      (currentRotations[index] ?? 0) !== selectedRotation
    );
    if (!changed) return;
    checkpoint();
    setBlueprint(previous => {
      const layers = previous.layers.map((item, index) => index === layer ? { ...item } : item);
      const rotations = (previous.rotations ?? previous.layers.map<Record<string, number>>(() => ({})))
        .map((item, index) => index === layer ? { ...item } : item);
      indices.forEach(index => {
        layers[layer][index] = selected;
        if (selectedRotation) rotations[layer][index] = selectedRotation;
        else delete rotations[layer][index];
      });
      return { ...previous, layers, rotations };
    });
  }

  function paintCell(index: number) {
    setBlueprint(prev => {
      const layers = prev.layers.map((l, i) => i === layer ? { ...l } : l);
      const rotations = (prev.rotations ?? prev.layers.map<Record<string, number>>(() => ({}))).map((item, i) => i === layer ? { ...item } : item);
      if (tool === "erase") {
        delete layers[layer][index];
        delete rotations[layer][index];
      } else {
        layers[layer][index] = selected;
        if (selectedRotation) rotations[layer][index] = selectedRotation;
        else delete rotations[layer][index];
      }
      return { ...prev, layers, rotations };
    });
  }

  function chooseBlock(blockId: string) {
    setRecentBlocks(previous => [blockId, selected, ...previous].filter((id, index, items) => items.indexOf(id) === index).slice(0, 11));
    setSelected(blockId);
    setSelectedRotation(blocks.find(block => block.id === blockId)?.sourceRotation ?? 0);
    if (tool !== "replace") setTool("paint");
  }

  function setSelectedBlockState(stateName: string, value: string | number | boolean) {
    if (!selectedBlock?.minecraftName) return;
    const minecraftStates = { ...(selectedBlock.minecraftStates ?? {}), [stateName]:value };
    const stateRotation = rotationFromStates(minecraftStates);
    const id = variantId(selectedBlock.minecraftName, minecraftStates);
    const configured: Block = {
      ...selectedBlock,
      id,
      category:"Configured",
      minecraftStates,
      textureUrl:textureForFace({ ...selectedBlock, minecraftStates }, "up"),
      sourceRotation:stateRotation,
      legacyAlias:false,
    };
    setBlueprint(previous => ({
      ...previous,
      customBlocks:[
        ...(previous.customBlocks ?? []).filter(block => block.id !== id),
        configured,
      ],
    }));
    chooseBlock(id);
    // The configured block is not in `blocks` until the state update renders,
    // so apply its rotation after chooseBlock's lookup-based default.
    setSelectedRotation(stateRotation);
  }

  function pickBlock(index: number) {
    const blockId = current[index];
    if (!blockId) return;
    chooseBlock(blockId);
    setSelectedRotation(currentRotations[index] ?? 0);
  }

  function rotateSelected() {
    setSelectedRotation(rotation => (rotation + 90) % 360);
    setTool("paint");
  }

  function changeSize(width: number, depth: number) {
    width = Math.min(128, Math.max(1, Math.round(width)));
    depth = Math.min(128, Math.max(1, Math.round(depth)));
    if (width === blueprint.width && depth === blueprint.depth) return;
    checkpoint();
    setBlueprint(prev => ({
      ...prev,
      width,
      depth,
      layers: prev.layers.map(previousLayer => {
        const resized: Record<string, string> = {};
        for (const [key, block] of Object.entries(previousLayer)) {
          const oldIndex = Number(key);
          const x = oldIndex % prev.width;
          const y = Math.floor(oldIndex / prev.width);
          if (x < width && y < depth) resized[y * width + x] = block;
        }
        return resized;
      }),
      rotations:(prev.rotations ?? prev.layers.map<Record<string, number>>(() => ({}))).map(previousRotations => {
        const resized: Record<string, number> = {};
        for (const [key, rotation] of Object.entries(previousRotations)) {
          const oldIndex = Number(key);
          const x = oldIndex % prev.width;
          const y = Math.floor(oldIndex / prev.width);
          if (x < width && y < depth) resized[y * width + x] = rotation;
        }
        return resized;
      }),
    }));
    setSelection(null);
  }

  function applyCanvasSize() {
    const width = Number(canvasWidth);
    const depth = Number(canvasDepth);
    if (!Number.isFinite(width) || !Number.isFinite(depth)) {
      setCanvasWidth(String(blueprint.width));
      setCanvasDepth(String(blueprint.depth));
      return;
    }
    changeSize(width, depth);
  }

  function fitZoom() {
    const viewport = canvasViewport.current;
    if (!viewport) return;
    const availableWidth = Math.max(1, viewport.clientWidth - 56);
    const availableHeight = Math.max(1, viewport.clientHeight - 56);
    const fitted = Math.floor(Math.min(availableWidth / blueprint.width, availableHeight / blueprint.depth));
    setZoom(Math.min(40, Math.max(4, fitted)));
  }

  function addLayer(copy = false) {
    checkpoint();
    setBlueprint(prev => {
      const layers = [...prev.layers];
      layers.splice(layer + 1, 0, copy ? { ...layers[layer] } : {});
      const rotations = [...(prev.rotations ?? prev.layers.map<Record<string, number>>(() => ({})))];
      rotations.splice(layer + 1, 0, copy ? { ...rotations[layer] } : {});
      return { ...prev, layers, rotations };
    });
    setLayer(layer + 1);
  }

  function deleteLayer() {
    if (blueprint.layers.length === 1) return;
    checkpoint();
    setBlueprint(prev => ({
      ...prev,
      layers:prev.layers.filter((_, i) => i !== layer),
      rotations:(prev.rotations ?? prev.layers.map<Record<string, number>>(() => ({}))).filter((_, i) => i !== layer),
    }));
    setLayer(Math.max(0, layer - 1));
  }

  function fileStem() {
    return blueprint.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled-blockprint";
  }

  function downloadBlob(blob: Blob, filename: string) {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function saveProject() {
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${fileStem()}.blockprint.json`);
  }

  function newProject() {
    if (!window.confirm("Start a new project? Save the current project first if you want to keep it.")) return;
    checkpoint();
    setBlueprint(structuredClone(EMPTY_BLUEPRINT));
    setLayer(0);
    setSelection(null);
    setClipboard(null);
    setLinePreview([]);
    setSelected(baseBlocks[0]?.id ?? "oak");
    setSelectedRotation(0);
    setTool("paint");
    painting.current = false;
    selecting.current = false;
    lining.current = false;
    lineStart.current = null;
    lineEnd.current = null;
  }

  function layerMaterials(layerData: Record<string, string>) {
    const counts = new Map<string, number>();
    Object.values(layerData).forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
    return [...counts.entries()]
      .map(([id, count]) => ({ block: blocks.find(item => item.id === id), id, count }))
      .sort((a, b) => b.count - a.count);
  }

  async function textureImages() {
    const usedIds = new Set(blueprint.layers.flatMap(layerData => Object.values(layerData)));
    const entries = await Promise.all(blocks.filter(block => usedIds.has(block.id) && block.textureUrl).map(block =>
      new Promise<[string, HTMLImageElement | null]>(resolve => {
        const image = new Image();
        image.onload = () => resolve([block.id, image]);
        image.onerror = () => resolve([block.id, null]);
        image.src = block.textureUrl!;
      })
    ));
    return new Map(entries.filter((entry): entry is [string, HTMLImageElement] => Boolean(entry[1])));
  }

  function drawLayer(ctx: CanvasRenderingContext2D, layerData: Record<string, string>, rotationData: Record<string, number>, x: number, y: number, width: number, height: number, images: Map<string, HTMLImageElement>) {
    const cell = Math.min(width / blueprint.width, height / blueprint.depth);
    const gridWidth = cell * blueprint.width;
    const gridHeight = cell * blueprint.depth;
    const originX = x + (width - gridWidth) / 2;
    const originY = y + (height - gridHeight) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(originX, originY, gridWidth, gridHeight);
    for (const [key, id] of Object.entries(layerData)) {
      const index = Number(key);
      const block = blocks.find(item => item.id === id);
      const cellX = originX + (index % blueprint.width) * cell;
      const cellY = originY + Math.floor(index / blueprint.width) * cell;
      const image = images.get(id);
      if (image) {
        const rotation = rotationData[index] ?? 0;
        ctx.save();
        ctx.translate(cellX + cell / 2, cellY + cell / 2);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.drawImage(image, -cell / 2, -cell / 2, cell, cell);
        ctx.restore();
      }
      else {
        ctx.fillStyle = block?.color ?? "#8b8f87";
        ctx.fillRect(cellX, cellY, cell, cell);
      }
    }
    ctx.strokeStyle = "#d7d9d2";
    ctx.lineWidth = Math.max(0.5, Math.min(1.5, cell / 8));
    ctx.beginPath();
    for (let column = 0; column <= blueprint.width; column++) {
      const lineX = originX + column * cell;
      ctx.moveTo(lineX, originY);
      ctx.lineTo(lineX, originY + gridHeight);
    }
    for (let row = 0; row <= blueprint.depth; row++) {
      const lineY = originY + row * cell;
      ctx.moveTo(originX, lineY);
      ctx.lineTo(originX + gridWidth, lineY);
    }
    ctx.stroke();
    ctx.strokeStyle = "#4d524c";
    ctx.lineWidth = 3;
    ctx.strokeRect(originX, originY, gridWidth, gridHeight);
  }

  async function exportPng() {
    setExporting("png");
    try {
      const images = await textureImages();
      const columns = blueprint.layers.length === 1 ? 1 : 2;
      const rows = Math.ceil(blueprint.layers.length / columns);
      const panelWidth = 720;
      const panelHeight = 720;
      const margin = 48;
      const canvas = document.createElement("canvas");
      canvas.width = columns * panelWidth + (columns + 1) * margin;
      canvas.height = 110 + rows * panelHeight + (rows + 1) * margin;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#f3f1e9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#20231f";
      ctx.font = "bold 36px Georgia, serif";
      ctx.fillText(blueprint.name, margin, 54);
      ctx.fillStyle = "#6e756b";
      ctx.font = "20px Arial, sans-serif";
      ctx.fillText(`${blueprint.width} x ${blueprint.depth} blocks - layers lowest to highest`, margin, 86);
      blueprint.layers.forEach((layerData, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = margin + column * (panelWidth + margin);
        const y = 110 + margin + row * (panelHeight + margin);
        ctx.fillStyle = "#fffef9";
        ctx.fillRect(x, y, panelWidth, panelHeight);
        ctx.fillStyle = "#315f46";
        ctx.font = "bold 23px Arial, sans-serif";
        ctx.fillText(`Layer ${index + 1}`, x + 22, y + 34);
        ctx.fillStyle = "#6e756b";
        ctx.font = "16px Arial, sans-serif";
        ctx.fillText(`${Object.keys(layerData).length} blocks`, x + 22, y + 58);
        drawLayer(ctx, layerData, blueprint.rotations?.[index] ?? {}, x + 22, y + 78, panelWidth - 44, panelHeight - 100, images);
      });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (blob) downloadBlob(blob, `${fileStem()}-all-layers.png`);
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    setExporting("pdf");
    try {
      const images = await textureImages();
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
      for (let index = 0; index < blueprint.layers.length; index++) {
        if (index > 0) pdf.addPage("a4", "landscape");
        const layerData = blueprint.layers[index];
        const canvas = document.createElement("canvas");
        canvas.width = 1684;
        canvas.height = 1190;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.fillStyle = "#f3f1e9";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#20231f";
        ctx.font = "bold 42px Georgia, serif";
        ctx.fillText(blueprint.name, 70, 72);
        ctx.fillStyle = "#315f46";
        ctx.font = "bold 26px Arial, sans-serif";
        ctx.fillText(`Layer ${index + 1} of ${blueprint.layers.length}`, 70, 112);
        ctx.fillStyle = "#6e756b";
        ctx.font = "20px Arial, sans-serif";
        ctx.fillText(`${blueprint.width} x ${blueprint.depth} blocks`, 70, 144);
        drawLayer(ctx, layerData, blueprint.rotations?.[index] ?? {}, 70, 180, 1050, 920, images);

        const materials = layerMaterials(layerData);
        ctx.fillStyle = "#fffef9";
        ctx.fillRect(1160, 180, 454, 920);
        ctx.fillStyle = "#20231f";
        ctx.font = "bold 28px Georgia, serif";
        ctx.fillText("Layer materials", 1192, 228);
        ctx.fillStyle = "#6e756b";
        ctx.font = "18px Arial, sans-serif";
        ctx.fillText(`${Object.keys(layerData).length} total blocks`, 1192, 260);
        if (!materials.length) {
          ctx.fillText("This layer is empty.", 1192, 310);
        } else {
          const columns = materials.length > 30 ? 2 : 1;
          const rows = Math.ceil(materials.length / columns);
          const rowHeight = Math.min(31, 790 / rows);
          const columnWidth = 207;
          materials.forEach(({ block, id, count }, materialIndex) => {
            const column = Math.floor(materialIndex / rows);
            const row = materialIndex % rows;
            const itemX = 1192 + column * columnWidth;
            const itemY = 300 + row * rowHeight;
            const swatchSize = Math.max(10, Math.min(22, rowHeight - 5));
            const image = images.get(id);
            if (image) ctx.drawImage(image, itemX, itemY, swatchSize, swatchSize);
            else {
              ctx.fillStyle = block?.color ?? "#8b8f87";
              ctx.fillRect(itemX, itemY, swatchSize, swatchSize);
            }
            ctx.fillStyle = "#20231f";
            ctx.font = `${Math.max(10, Math.min(16, rowHeight - 8))}px Arial, sans-serif`;
            const name = block?.name ?? id;
            const maxName = columns === 2 ? 18 : 34;
            ctx.fillText(`${name.length > maxName ? `${name.slice(0, maxName - 1)}…` : name} x${count}`, itemX + swatchSize + 8, itemY + swatchSize - 3);
          });
        }
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 841.89, 595.28, undefined, "FAST");
      }
      pdf.save(`${fileStem()}-layers.pdf`);
    } finally {
      setExporting(null);
    }
  }

  function minecraftNameForBlock(blockId: string) {
    const knownBlock = blocks.find(block => block.id === blockId);
    if (knownBlock?.minecraftName) return knownBlock.minecraftName;
    let localName = blockId.replace(/^[^:]+:/, "");
    const aliases: Record<string, string> = {
      planks: "oak_planks",
      still_water: "water",
      flowing_water: "water",
      still_lava: "lava",
      flowing_lava: "lava",
      log_oak: "oak_log",
    };
    localName = aliases[localName] ?? localName;
    localName = localName.replace(/_(side|top|bottom|front|back|carried)$/, "");
    localName = localName.replace(/[^a-z0-9_]/g, "_");
    return `minecraft:${localName || "stone"}`;
  }

  function rotatedMinecraftStates(blockId: string, rotation: number) {
    const block = blocks.find(item => item.id === blockId);
    const states = { ...(block?.minecraftStates ?? {}) };
    const textureName = blockId.replace(/^[^:]+:/, "");
    const minecraftLocalName = minecraftNameForBlock(blockId).replace(/^minecraft:/, "");
    const isDirectionalPillar = /(?:_log|_wood|_hyphae|(?:crimson|warped)_stem)$/.test(minecraftLocalName);
    if (!("pillar_axis" in states) && !("axis" in states) && isDirectionalPillar) {
      if (textureName.endsWith("_side")) states.pillar_axis = "z";
      if (textureName.endsWith("_top")) states.pillar_axis = "y";
    }
    const sourceRotation = block?.sourceRotation ?? 0;
    const rotated = rotateBlockStates(states, rotation - sourceRotation);
    return Object.fromEntries(Object.entries(rotated).map(([key, value]) => [key, typeof value === "number" ? new Int32(value) : value]));
  }

  async function exportMcstructure() {
    setExporting("mcstructure");
    try {
      const binary = await encodeMcstructure({
        width:blueprint.width,
        height:blueprint.layers.length,
        depth:blueprint.depth,
        blocks:blueprint.layers.map((layerData, layerIndex) =>
          Array.from({ length:blueprint.width * blueprint.depth }, (_, cellIndex) => {
            const blockId = layerData[cellIndex];
            if (!blockId) return null;
            const states = rotatedMinecraftStates(blockId, blueprint.rotations?.[layerIndex]?.[cellIndex] ?? 0);
            return {
              name:minecraftNameForBlock(blockId),
              states:Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value instanceof Number ? value.valueOf() : value])),
            };
          })),
      });
      await readNbt(binary, { endian:"little", compression:null });
      const downloadable = new Uint8Array(binary.byteLength);
      downloadable.set(binary);
      downloadBlob(new Blob([downloadable.buffer], { type:"application/octet-stream" }), `${fileStem()}.mcstructure`);
    } catch (error) {
      window.alert(error instanceof Error ? `Could not export structure: ${error.message}` : "Could not export this structure.");
    } finally {
      setExporting(null);
    }
  }

  function normalizeNbtStates(value: unknown) {
    const states: Record<string, string | number | boolean> = {};
    if (!value || typeof value !== "object") return states;
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const primitive = raw && typeof raw === "object" && "valueOf" in raw ? raw.valueOf() : raw;
      if (typeof primitive === "string" || typeof primitive === "number" || typeof primitive === "boolean") states[key] = primitive;
    }
    return states;
  }

  function rotationFromStates(states: Record<string, string | number | boolean>) {
    return rotationFromBlockStates(states);
  }

  function textureForStructureBlock(localName: string, states: Record<string, string | number | boolean> = {}) {
    const woodType = String(states.wood_type ?? states.old_log_type ?? states.new_log_type ?? "");
    if ((localName === "log" || localName === "log2") && woodType) localName = `${woodType}_log`;
    const axis = String(states.pillar_axis ?? states.axis ?? "").toLowerCase();
    const aliases: Record<string, string[]> = {
      air: [],
      cave_air: [],
      structure_void: [],
      water: ["still_water", "flowing_water"],
      lava: ["still_lava", "flowing_lava"],
      oak_planks: ["planks"],
      oak_log: ["oak_log_side", "log_oak"],
      oak_wood: ["oak_log_side", "log_oak"],
    };
    const directionalCandidates = axis === "y"
      ? [`${localName}_top`, localName.replace(/_log$/, "_log_top")]
      : axis === "x" || axis === "z"
        ? [`${localName}_side`, localName.replace(/_log$/, "_log_side")]
        : [`${localName}_front`, `${localName}_side`, localName];
    const candidates = [...directionalCandidates, ...(aliases[localName] ?? [])];
    for (const candidate of candidates) {
      const exact = baseBlocks.find(block => block.id === `bedrock:${candidate}`);
      if (exact) return exact;
    }
    const tokens = localName.split("_").filter(token => !["block", "wall", "standing"].includes(token));
    let best: Block | undefined;
    let bestScore = 0;
    for (const block of baseBlocks) {
      const textureName = block.id.replace(/^bedrock:/, "");
      let score = tokens.reduce((total, token) => total + (textureName.includes(token) ? token.length : 0), 0);
      if (textureName.startsWith(localName) || localName.startsWith(textureName)) score += 8;
      if (score > bestScore) {
        best = block;
        bestScore = score;
      }
    }
    return bestScore >= Math.max(4, Math.floor(localName.length / 3)) ? best : undefined;
  }

  function fallbackBlockColor(name: string) {
    let hash = 0;
    for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 22% 48%)`;
  }

  async function importMcstructure(file: File) {
    const parsed = await readNbt(await file.arrayBuffer(), { endian:"little", compression:null });
    const root = parsed.data as unknown as Record<string, unknown>;
    const size = root.size as unknown[];
    const structure = root.structure as Record<string, unknown>;
    const palettes = structure?.palette as Record<string, unknown>;
    const defaultPalette = palettes?.default as Record<string, unknown>;
    const palette = defaultPalette?.block_palette as Record<string, unknown>[];
    const blockIndices = structure?.block_indices as unknown[][];
    if (!Array.isArray(size) || size.length !== 3 || !Array.isArray(palette) || !Array.isArray(blockIndices) || blockIndices.length < 1) {
      throw new Error("This file does not contain a supported Bedrock structure.");
    }

    const sizeX = Number(size[0]);
    const sizeY = Number(size[1]);
    const sizeZ = Number(size[2]);
    if (![sizeX, sizeY, sizeZ].every(value => Number.isInteger(value) && value > 0)) throw new Error("The structure dimensions are invalid.");
    const width = Math.min(128, sizeX);
    const depth = Math.min(128, sizeZ);
    const importedVariants = new Map<string, Block>();
    const paletteRotations: number[] = [];
    const paletteIds = palette.map((entry, paletteIndex) => {
      const fullName = String(entry.name ?? "");
      const localName = fullName.replace(/^minecraft:/, "");
      const states = normalizeNbtStates(entry.states);
      if (["air", "cave_air", "void_air", "structure_void"].includes(localName)) return null;
      const sourceRotation = rotationFromStates(states);
      paletteRotations[paletteIndex] = sourceRotation;
      const minecraftName = fullName.startsWith("minecraft:") ? fullName : `minecraft:${localName}`;
      const catalogBlock = matchCatalogBlock(baseBlocks, minecraftName, states);
      if (catalogBlock && catalogBlock.minecraftName === minecraftName && statesEqual(catalogBlock.minecraftStates, states)) {
        return catalogBlock.id;
      }

      const id = variantId(minecraftName, states);
      if (!importedVariants.has(id)) {
        const texture = catalogBlock ?? textureForStructureBlock(localName, states);
        importedVariants.set(id, {
          ...(catalogBlock ?? {}),
          id,
          name:catalogBlock?.name ?? localName.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
          category:catalogBlock ? "Configured" : "Unmatched",
          color:texture?.color ?? fallbackBlockColor(localName),
          texture:texture?.texture,
          textureUrl:texture ? textureForFace({ ...texture, minecraftStates:states }, "up") : undefined,
          minecraftName,
          minecraftStates:states,
          sourceRotation,
          legacyAlias:false,
        });
      }
      return id;
    });

    const primary = Array.from(blockIndices[0] ?? [], value => Number(value));
    const secondary = Array.from(blockIndices[1] ?? [], value => Number(value));
    const expected = sizeX * sizeY * sizeZ;
    if (primary.length < expected) throw new Error("The structure block data is incomplete.");
    const layers: Record<string, string>[] = Array.from({ length:sizeY }, () => ({}));
    const rotations: Record<string, number>[] = Array.from({ length:sizeY }, () => ({}));
    for (let index = 0; index < expected; index++) {
      const x = Math.floor(index / (sizeZ * sizeY));
      const y = Math.floor(index / sizeZ) % sizeY;
      const z = index % sizeZ;
      if (x >= width || z >= depth) continue;
      const paletteIndex = primary[index] >= 0 && paletteIds[primary[index]] ? primary[index] : secondary[index];
      const primaryId = primary[index] >= 0 ? paletteIds[primary[index]] : null;
      const secondaryId = secondary[index] >= 0 ? paletteIds[secondary[index]] : null;
      const blockId = primaryId ?? secondaryId;
      if (blockId) {
        const destination = z * width + x;
        layers[y][destination] = blockId;
        const rotation = paletteRotations[paletteIndex] ?? 0;
        if (rotation) rotations[y][destination] = rotation;
      }
    }

    checkpoint();
    const filename = file.name.replace(/\.mcstructure$/i, "");
    setBlueprint({
      name: filename || "Imported Structure",
      width,
      depth,
      layers,
      rotations,
      customBlocks:[...importedVariants.values()],
    });
    setLayer(0);
    setSelection(null);
    setClipboard(null);
    const firstBlockId = layers.flatMap(layerData => Object.values(layerData))[0];
    const firstBlock = firstBlockId ? [...baseBlocks, ...importedVariants.values()].find(block => block.id === firstBlockId) : undefined;
    if (firstBlock) {
      setSelected(firstBlock.id);
      setSelectedRotation(firstBlock.sourceRotation ?? 0);
      setTool("paint");
    }
    const cropped = sizeX > 128 || sizeZ > 128;
    window.alert(`Imported ${sizeX} × ${sizeY} × ${sizeZ} structure as ${sizeY} layers.${cropped ? " X/Z dimensions were cropped to Blockprint's 128-block limit." : ""}`);
  }

  async function importFile(file?: File) {
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".mcstructure")) {
      try {
        await importMcstructure(file);
      } catch (error) {
        window.alert(error instanceof Error ? `Could not import structure: ${error.message}` : "Could not import this structure.");
      }
      return;
    }
    try {
      const next = JSON.parse(await file.text()) as Blueprint;
      if (!next.width || !next.depth || !Array.isArray(next.layers)) throw new Error("Invalid Blockprint project.");
      checkpoint(); setBlueprint(next); setLayer(0); setSelection(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not import this project.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="mark-top" />
            <span className="mark-left" />
            <span className="mark-right" />
          </span>
          <div><strong>Blockprint</strong><span>Minecraft build planner</span></div>
        </div>
        <input className="project-name" aria-label="Blueprint name" value={blueprint.name}
          onChange={e => setBlueprint({ ...blueprint, name: e.target.value })} />
        <div className="header-actions">
          <button className="button secondary" onClick={newProject}>New project</button>
          <label className="button secondary" title="Import a Blockprint project or Bedrock structure">Import<input type="file" accept=".json,.mcstructure,application/json" hidden onChange={e => { importFile(e.target.files?.[0]); e.currentTarget.value = ""; }}/></label>
          <button className="button primary" onClick={saveProject}>Save project</button>
          <button className="button secondary" disabled={Boolean(exporting)} onClick={exportPdf}>{exporting === "pdf" ? "Making PDF…" : "Export PDF"}</button>
          <button className="button secondary" disabled={Boolean(exporting)} onClick={exportPng}>{exporting === "png" ? "Making PNG…" : "Export PNG"}</button>
          <button className="button secondary" disabled={Boolean(exporting)} onClick={exportMcstructure}>{exporting === "mcstructure" ? "Making structure…" : "Export MCStructure"}</button>
        </div>
      </header>

      <section className={`workspace ${paletteCollapsed ? "left-collapsed" : ""} ${detailsCollapsed ? "right-collapsed" : ""}`}>
        <aside className={`palette-panel ${paletteCollapsed ? "collapsed" : ""}`}>
          <button className="sidebar-toggle palette-toggle" onClick={() => setPaletteCollapsed(value => !value)} aria-label={paletteCollapsed ? "Expand block palette" : "Minimize block palette"} title={paletteCollapsed ? "Expand block palette" : "Minimize block palette"}>{paletteCollapsed ? "›" : "‹"}</button>
          <div className="panel-heading"><div><span className="eyebrow">Bedrock catalog</span><h2>Block palette</h2></div><span className="count">{blocks.filter(block => !block.legacyAlias).length}</span></div>
          {selectedBlock?.minecraftName && <section className="palette-block-state">
            <span className="eyebrow">Bedrock block</span><h2>{blockLabel(selectedBlock)}</h2>
            <code className="block-identifier">{selectedBlock.minecraftName}</code>
            {selectedBlock.stateDefinitions?.length ? <div className="state-controls">
              {selectedBlock.stateDefinitions.map(definition => <label className="field" key={definition.name}>
                <span>{definition.name}</span>
                <select value={String(selectedBlock.minecraftStates?.[definition.name] ?? definition.values[0])}
                  onChange={event => {
                    const chosen = definition.values.find(value => String(value) === event.target.value) ?? definition.values[0];
                    setSelectedBlockState(definition.name, chosen);
                  }}>
                  {definition.values.map(value => <option key={String(value)} value={String(value)}>{String(value)}</option>)}
                </select>
              </label>)}
            </div> : <p className="empty-state">This block has no editable placement states.</p>}
          </section>}
          <input className="search" placeholder="Search blocks…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="category-tabs">
            {categories.map(c => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          <div className="block-list">
            {visibleBlocks.map(block => (
              <button key={block.id} className={`block-option ${selected === block.id && (tool === "paint" || tool === "replace") ? "selected" : ""}`}
                onClick={() => chooseBlock(block.id)}>
                <span className="block-swatch" style={{
                  backgroundColor:block.color,
                  backgroundImage:textureForFace(block, "up") ? `url(${textureForFace(block, "up")})` : block.texture,
                  backgroundSize:textureForFace(block, "up") ? "cover" : undefined,
                  transform:`rotate(${block.sourceRotation ?? rotationFromStates(block.minecraftStates ?? {})}deg)`
                }} />
                <span><strong>{blockLabel(block)}</strong><small>{block.textureMatch === "missing" ? `${block.category} · texture needed` : block.category}</small></span>
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
                <button className={tool === "replace" ? "active" : ""} onClick={() => setTool("replace")} title="Replace every matching block on this layer">Replace</button>
                <button className={tool === "picker" ? "active" : ""} onClick={() => setTool("picker")} title="Pick a block (Alt+click)">Picker</button>
                <button onClick={rotateSelected} title="Rotate selected texture 90° (R)">Rotate {selectedRotation}°</button>
                <button className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}>Select</button>
                <button className={tool === "grab" ? "active" : ""} onClick={() => setTool("grab")} title="Drag the canvas to scroll">Grab</button>
              </div>
              <div className="edit-group" aria-label="Edit selection">
                <button disabled={!history.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
                <button disabled={!future.length} onClick={redo} title="Redo (Ctrl+Y or Ctrl+Shift+Z)">Redo</button>
                <button disabled={!selection} onClick={copySelection} title="Copy (Ctrl+C)">Copy</button>
                <button disabled={!selection} onClick={cutSelection} title="Cut (Ctrl+X)">Cut</button>
                <button disabled={!clipboard} onClick={pasteSelection} title="Paste at selection (Ctrl+V)">Paste</button>
                <button disabled={!selection} onClick={deleteSelection} title="Delete selection (Delete)">Delete</button>
                <button disabled={!selection} onClick={() => { setSelection(null); selecting.current = false; }} title="Cancel selection (Esc)">Cancel</button>
              </div>
            </div>
            <div className="block-history" aria-label="Selected and recently used blocks">
              <span className="block-history-label">Current</span>
              {selectedBlock && <button className="current-block" onClick={() => setTool("paint")} title={`Paint with ${blockLabel(selectedBlock)}`}>
                <span className="history-swatch" style={{
                  backgroundColor:selectedBlock.color,
                  backgroundImage:selectedBlock.textureUrl ? `url(${selectedBlock.textureUrl})` : selectedBlock.texture,
                  backgroundSize:selectedBlock.textureUrl ? "cover" : undefined,
                  transform:`rotate(${selectedRotation}deg)`
                }} />
                <span>{blockLabel(selectedBlock)}</span>
              </button>}
              <span className="block-history-label recent-label">Recent</span>
              <div className="recent-blocks">
                {recentBlockOptions.length ? recentBlockOptions.map(block => <button key={block.id} onClick={() => chooseBlock(block.id)} title={blockLabel(block)} aria-label={`Paint with recently used ${blockLabel(block)}`}>
                  <span className="history-swatch" style={{
                    backgroundColor:block.color,
                    backgroundImage:block.textureUrl ? `url(${block.textureUrl})` : block.texture,
                    backgroundSize:block.textureUrl ? "cover" : undefined,
                    transform:`rotate(${block.sourceRotation ?? rotationFromStates(block.minecraftStates ?? {})}deg)`
                  }} />
                </button>) : <span className="recent-empty">Your recent blocks will appear here.</span>}
              </div>
            </div>
          </div>
          <div className={`canvas-scroll ${tool === "grab" ? "grab-mode" : ""} ${isPanning ? "is-panning" : ""}`} ref={canvasViewport}
            onPointerDown={event => {
              if (tool !== "grab") return;
              event.preventDefault();
              panning.current = {
                active:true,
                pointerId:event.pointerId,
                startX:event.clientX,
                startY:event.clientY,
                scrollLeft:event.currentTarget.scrollLeft,
                scrollTop:event.currentTarget.scrollTop
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              setIsPanning(true);
            }}
            onPointerMove={event => {
              const pan = panning.current;
              if (!pan.active || pan.pointerId !== event.pointerId) return;
              event.currentTarget.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
              event.currentTarget.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
            }}
            onPointerUp={event => {
              if (panning.current.pointerId !== event.pointerId) return;
              panning.current.active = false;
              setIsPanning(false);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              panning.current.active = false;
              setIsPanning(false);
            }}>
            <div className={`blueprint-grid ${showGrid ? "" : "grid-off"}`}
              style={{ "--cell":`${zoom}px`, gridTemplateColumns:`repeat(${blueprint.width}, var(--cell))`, gridTemplateRows:`repeat(${blueprint.depth}, var(--cell))` } as CSSProperties}
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
                const currentBlock = blocks.find(b => b.id === current[index]);
                let lowerLayerIndex = -1;
                if (!currentBlock && showPreviousLayers && layer > 0) {
                  for (let candidate = layer - 1; candidate >= 0; candidate--) {
                    if (blueprint.layers[candidate][index]) { lowerLayerIndex = candidate; break; }
                  }
                }
                const lowerBlockId = lowerLayerIndex >= 0 ? blueprint.layers[lowerLayerIndex][index] : undefined;
                const lowerBlock = lowerBlockId ? blocks.find(b => b.id === lowerBlockId) : undefined;
                const displayBlock = currentBlock ?? lowerBlock;
                const displayRotation = currentBlock
                  ? currentRotations[index] ?? 0
                  : lowerLayerIndex >= 0 ? blueprint.rotations?.[lowerLayerIndex]?.[index] ?? 0 : 0;
                return <button key={index} aria-label={`Column ${index % blueprint.width + 1}, row ${Math.floor(index / blueprint.width) + 1}${currentBlock ? `, ${blockLabel(currentBlock)}` : lowerBlock ? `, ${blockLabel(lowerBlock)} from lower layer` : ", empty"}`}
                  title={currentBlock ? blockLabel(currentBlock) : lowerBlock ? `${blockLabel(lowerBlock)} (lower layer)` : undefined}
                  className={`cell ${currentBlock ? "filled" : ""} ${lowerBlock ? "ghost-block" : ""} ${selectionClass(index)} ${linePreview.includes(index) ? "line-preview" : ""}`}
                  onPointerDown={e => {
                    if (tool === "grab") return;
                    e.preventDefault();
                    if (e.altKey || tool === "picker") {
                      pickBlock(index);
                    } else if (tool === "select") {
                      selecting.current = true;
                      setSelection({ start:index, end:index });
                    } else if (tool === "line") {
                      lining.current = true;
                      lineStart.current = index;
                      lineEnd.current = index;
                      setLinePreview([index]);
                    } else if (tool === "fill") {
                      fillArea(index);
                    } else if (tool === "replace") {
                      replaceOnLayer(index);
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
                  }}>
                  {displayBlock && <span className="cell-surface" style={{
                    backgroundColor:displayBlock.color,
                    backgroundImage:displayBlock.textureUrl ? `url(${displayBlock.textureUrl})` : displayBlock.texture,
                    backgroundSize:displayBlock.textureUrl ? "cover" : undefined,
                    transform:`rotate(${displayRotation}deg)`
                  }} />}
                </button>;
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

        <aside className={`details-panel ${detailsCollapsed ? "collapsed" : ""}`}>
          <button className="sidebar-toggle details-toggle" onClick={() => setDetailsCollapsed(value => !value)} aria-label={detailsCollapsed ? "Expand project sidebar" : "Minimize project sidebar"} title={detailsCollapsed ? "Expand project sidebar" : "Minimize project sidebar"}>{detailsCollapsed ? "‹" : "›"}</button>
          <section className="layer-view-panel">
            <span className="eyebrow">Canvas</span><h2>Layer & view</h2>
            <div className="layer-nav">
              <button disabled={layer === 0} onClick={() => setLayer(layer - 1)}>←</button>
              <span><small>Layer</small><strong>{layer + 1} / {blueprint.layers.length}</strong></span>
              <button disabled={layer === blueprint.layers.length - 1} onClick={() => setLayer(layer + 1)}>→</button>
            </div>
            <div className="view-controls">
              <div className="view-toggles">
                <label className="grid-toggle"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Grid</label>
                <label className="grid-toggle previous-toggle" title={layer === 0 ? "Available from Layer 2 onward" : "Show blocks from lower layers at 50% opacity"}>
                  <input type="checkbox" disabled={layer === 0} checked={showPreviousLayers && layer > 0} onChange={e => setShowPreviousLayers(e.target.checked)} /> Below 50%
                </label>
              </div>
              <div className="zoom-controls" aria-label="Canvas zoom">
                <button onClick={() => setZoom(value => Math.max(4, value - 2))} disabled={zoom <= 4} title="Zoom out (Ctrl+-)">−</button>
                <input type="range" min="4" max="40" step="1" value={zoom} onChange={event => setZoom(Number(event.target.value))} aria-label="Zoom level" />
                <button onClick={() => setZoom(value => Math.min(40, value + 2))} disabled={zoom >= 40} title="Zoom in (Ctrl++)">+</button>
                <span>{Math.round(zoom / 22 * 100)}%</span>
                <button className="fit-button" onClick={fitZoom} title="Fit grid (Ctrl+0)">Fit</button>
              </div>
            </div>
          </section>
          <section>
            <span className="eyebrow">Blueprint</span><h2>Build setup</h2>
            <form className="field" onSubmit={event => { event.preventDefault(); applyCanvasSize(); }}>
              <span>Canvas size</span>
              <div className="size-controls">
                <label><span>X width</span><input type="number" min="1" max="128" step="1" value={canvasWidth} onChange={event => setCanvasWidth(event.target.value)} /></label>
                <span className="size-times">×</span>
                <label><span>Y depth</span><input type="number" min="1" max="128" step="1" value={canvasDepth} onChange={event => setCanvasDepth(event.target.value)} /></label>
                <button type="submit">Resize</button>
              </div>
              <small>1–128 blocks per side. Existing blocks that still fit are preserved.</small>
            </form>
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
                return <li key={id}><button onClick={() => chooseBlock(id)} title={`Paint with ${blockLabel(block)}`}>
                  <span className="mini-swatch" style={{
                    backgroundColor:block.color,
                    backgroundImage:block.textureUrl ? `url(${block.textureUrl})` : block.texture,
                    backgroundSize:block.textureUrl ? "cover" : undefined,
                    transform:`rotate(${block.sourceRotation ?? rotationFromStates(block.minecraftStates ?? {})}deg)`
                  }}/><span>{blockLabel(block)}</span><strong>{amount}</strong>
                </button></li>;
              })}</ol>}
          </section>
          <section className="quick-tips">
            <span className="eyebrow">Drawing tools</span>
            <p>Use Picker or Alt+click a painted cell to sample its block. Material-list rows also select blocks. Drag Line for walls; Fill replaces a connected area.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
