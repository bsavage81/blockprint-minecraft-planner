"use client";

import { useState } from "react";

type NbtValue = null | string | number | boolean | NbtValue[] | { [key: string]: NbtValue };
type PathPart = string | number;

function isBranch(value: NbtValue): value is NbtValue[] | { [key: string]: NbtValue } {
  return Array.isArray(value) || Boolean(value && typeof value === "object");
}

function entries(value: NbtValue) {
  if (Array.isArray(value)) return value.map((child, index) => [index, child] as const);
  if (value && typeof value === "object") return Object.entries(value);
  return [];
}

function typeInfo(value: NbtValue) {
  if (Array.isArray(value)) return { badge:"L", className:"list", summary:`${value.length} ${value.length === 1 ? "entry" : "entries"}` };
  if (value && typeof value === "object") {
    const count = Object.keys(value).length;
    return { badge:"C", className:"compound", summary:`${count} ${count === 1 ? "entry" : "entries"}` };
  }
  if (typeof value === "string") return { badge:"S", className:"string", summary:value === "" ? '""' : value };
  if (typeof value === "boolean") return { badge:"B", className:"byte", summary:value ? "true" : "false" };
  if (typeof value === "number" && !Number.isInteger(value)) return { badge:"F", className:"float", summary:String(value) };
  if (typeof value === "number") return { badge:"I", className:"int", summary:String(value) };
  return { badge:"?", className:"null", summary:"null" };
}

function replaceAtPath(root: NbtValue, path: PathPart[], replacement: NbtValue) {
  const next = structuredClone(root);
  let parent = next as NbtValue[] | Record<string, NbtValue>;
  path.slice(0, -1).forEach(part => {
    parent = (Array.isArray(parent) ? parent[Number(part)] : parent[String(part)]) as NbtValue[] | Record<string, NbtValue>;
  });
  const finalPart = path[path.length - 1];
  if (Array.isArray(parent)) parent[Number(finalPart)] = replacement;
  else parent[String(finalPart)] = replacement;
  return next;
}

function replaceNameAndValue(root: NbtValue, path: PathPart[], name: string, replacement: NbtValue) {
  const next = structuredClone(root);
  let parent = next as NbtValue[] | Record<string, NbtValue>;
  path.slice(0, -1).forEach(part => {
    parent = (Array.isArray(parent) ? parent[Number(part)] : parent[String(part)]) as NbtValue[] | Record<string, NbtValue>;
  });
  const oldKey = path[path.length - 1];
  if (!Array.isArray(parent) && typeof oldKey === "string" && name && name !== oldKey) {
    const objectParent = parent as Record<string, NbtValue>;
    const rebuilt = Object.entries(objectParent).flatMap(([key, value]) =>
      key === oldKey ? [[name, replacement] as const] : [[key, value] as const]
    );
    Object.keys(objectParent).forEach(key => delete objectParent[key]);
    Object.assign(objectParent, Object.fromEntries(rebuilt));
  } else {
    if (Array.isArray(parent)) parent[Number(oldKey)] = replacement;
    else parent[String(oldKey)] = replacement;
  }
  return next;
}

export default function NbtTree({ value, onChange }: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["root"]));
  const [editing, setEditing] = useState<{ key:string; label:string; path:PathPart[]; current:NbtValue } | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [draft, setDraft] = useState("");

  function toggle(key: string) {
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function beginEdit(key: string, label: string, path: PathPart[], current: NbtValue) {
    if (isBranch(current)) return;
    setEditing({ key, label, path, current });
    setNameDraft(label);
    setDraft(typeof current === "string" ? current : JSON.stringify(current));
  }

  function commit() {
    if (!editing) return;
    const { path, current } = editing;
    let replacement: NbtValue = draft;
    if (typeof current === "number") {
      const parsed = Number(draft);
      if (!Number.isFinite(parsed)) return;
      replacement = parsed;
    } else if (typeof current === "boolean") {
      if (!/^(?:true|false|1|0)$/i.test(draft.trim())) return;
      replacement = /^(?:true|1)$/i.test(draft.trim());
    } else if (current === null) {
      try { replacement = JSON.parse(draft); } catch { return; }
    }
    const next = nameDraft === editing.label
      ? replaceAtPath(value as NbtValue, path, replacement)
      : replaceNameAndValue(value as NbtValue, path, nameDraft.trim(), replacement);
    onChange(next as Record<string, unknown>);
    setEditing(null);
  }

  function renderNode(label: string, current: NbtValue, path: PathPart[], depth: number) {
    const key = path.length ? `root.${path.join(".")}` : "root";
    const info = typeInfo(current);
    const branch = isBranch(current);
    const open = expanded.has(key);
    return <div className="nbt-node" key={key}>
      <div className="nbt-row" style={{ "--nbt-depth":depth } as React.CSSProperties}
        onDoubleClick={() => beginEdit(key, label, path, current)}>
        {branch
          ? <button className="nbt-toggle" onClick={() => toggle(key)} aria-label={open ? `Collapse ${label}` : `Expand ${label}`}>{open ? "−" : "+"}</button>
          : <span className="nbt-toggle-placeholder" />}
        <span className={`nbt-badge ${info.className}`}>{info.badge}</span>
        <strong>{label}</strong>
        <span className="nbt-separator">:</span>
        <span className={`nbt-summary ${branch ? "branch" : ""}`}>{branch ? `[${info.summary}]` : info.summary}</span>
      </div>
      {branch && open && <div className="nbt-children">
        {entries(current).map(([childKey, child]) => renderNode(String(childKey), child, [...path, childKey], depth + 1))}
      </div>}
    </div>;
  }

  const editingInfo = editing ? typeInfo(editing.current) : null;
  return <>
    <div className="nbt-tree" role="tree" aria-label="Entity NBT">
      {renderNode("Entity NBT", value as NbtValue, [], 0)}
      <p className="nbt-help">Expand compounds and lists with +. Double-click a value to edit it.</p>
    </div>
    {editing && editingInfo && <div className="nbt-edit-backdrop" role="presentation" onPointerDown={() => setEditing(null)}>
      <section className="nbt-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="nbt-edit-title" onPointerDown={event => event.stopPropagation()}>
        <header><span className={`nbt-badge ${editingInfo.className}`}>{editingInfo.badge}</span><h3 id="nbt-edit-title">Edit {editingInfo.className} tag</h3><button onClick={() => setEditing(null)} aria-label="Cancel editing">×</button></header>
        <label><span>Name</span><input value={nameDraft} disabled={typeof editing.path.at(-1) === "number"} onChange={event => setNameDraft(event.target.value)} /></label>
        <label><span>Value</span><input autoFocus value={draft} onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setEditing(null);
          }} /></label>
        <footer><button className="button primary" onClick={commit}>OK</button><button className="button secondary" onClick={() => setEditing(null)}>Cancel</button></footer>
      </section>
    </div>}
  </>;
}
