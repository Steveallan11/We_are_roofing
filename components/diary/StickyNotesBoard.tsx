"use client";

import { useEffect, useRef, useState } from "react";
import type { StickyNote } from "@/lib/types";

const NOTE_COLORS = [
  { name: "Yellow", value: "#fde68a" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Purple", value: "#ddd6fe" },
  { name: "Orange", value: "#fed7aa" }
];

export function StickyNotesBoard() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/diary/sticky-notes")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.ok) {
          setError(data?.error || "Unable to load notes");
        } else {
          setNotes((data.notes ?? []) as StickyNote[]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load notes");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addNote = async () => {
    const board = boardRef.current;
    const boardWidth = board?.clientWidth ?? 600;
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].value;
    const position_x = Math.floor(Math.random() * Math.max(boardWidth - 240, 20)) + 10;
    const position_y = Math.floor(Math.random() * 200) + 20;

    const response = await fetch("/api/diary/sticky-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "", color, position_x, position_y })
    });
    const data = await response.json();
    if (data?.ok && data.note) {
      setNotes((prev) => [data.note as StickyNote, ...prev]);
    }
  };

  const updateNote = async (id: string, patch: Partial<StickyNote>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    await fetch("/api/diary/sticky-notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });
  };

  const deleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/diary/sticky-notes?id=${id}`, { method: "DELETE" });
  };

  if (isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading board…</p>;
  }
  if (error) {
    return <p className="text-sm text-[#fca5a5]">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          {notes.length === 0 ? "Empty board — add a note to get started." : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
        </p>
        <button
          onClick={addNote}
          className="rounded-full bg-[var(--gold)] px-3 py-1 text-sm font-medium text-black hover:opacity-90"
        >
          + Add note
        </button>
      </div>

      <div
        ref={boardRef}
        className="relative min-h-[480px] rounded-lg border border-dashed border-[var(--border)] bg-[var(--ink)] p-2"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "16px 16px"
        }}
      >
        {notes.length === 0 ? (
          <div className="flex h-[460px] items-center justify-center text-center text-sm text-[var(--text-muted)]">
            <div>
              <p className="text-2xl">📌</p>
              <p className="mt-2">Pin your first sticky note.</p>
            </div>
          </div>
        ) : (
          notes.map((note) => (
            <StickyNoteCard
              key={note.id}
              note={note}
              onUpdate={updateNote}
              onDelete={deleteNote}
              boardRef={boardRef}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StickyNoteCard({
  note,
  onUpdate,
  onDelete,
  boardRef
}: {
  note: StickyNote;
  onUpdate: (id: string, patch: Partial<StickyNote>) => void;
  onDelete: (id: string) => void;
  boardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [dragging, setDragging] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [content, setContent] = useState(note.content);
  const dragStartRef = useRef<{ x: number; y: number; noteX: number; noteY: number } | null>(null);

  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("textarea") || (e.target as HTMLElement).closest("button")) return;
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, noteX: note.position_x, noteY: note.position_y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const boardWidth = boardRef.current?.clientWidth ?? 600;
    const boardHeight = boardRef.current?.clientHeight ?? 480;
    const newX = Math.max(0, Math.min(boardWidth - note.width, dragStartRef.current.noteX + dx));
    const newY = Math.max(0, Math.min(boardHeight - 80, dragStartRef.current.noteY + dy));
    onUpdate(note.id, { position_x: newX, position_y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    dragStartRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleBlur = () => {
    if (content !== note.content) {
      onUpdate(note.id, { content });
    }
  };

  return (
    <div
      className="absolute select-none rounded-md shadow-lg"
      style={{
        left: note.position_x,
        top: note.position_y,
        width: note.width,
        minHeight: 140,
        backgroundColor: note.color,
        cursor: dragging ? "grabbing" : "grab",
        zIndex: dragging ? 100 : note.z_index
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="flex items-center justify-between gap-1 border-b border-black/10 px-2 py-1">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowColors(!showColors);
            }}
            className="h-5 w-5 rounded-full border border-black/20"
            style={{ backgroundColor: note.color }}
            aria-label="Change colour"
          />
          {showColors && (
            <div className="absolute left-0 top-7 z-20 flex gap-1 rounded-md border border-black/10 bg-white p-1 shadow-md">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(note.id, { color: c.value });
                    setShowColors(false);
                  }}
                  className="h-5 w-5 rounded-full border border-black/20 hover:scale-110"
                  style={{ backgroundColor: c.value }}
                  aria-label={c.name}
                />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          className="text-xs text-black/60 hover:text-black"
          aria-label="Delete note"
        >
          ✕
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        placeholder="Type a note…"
        className="block h-[110px] w-full resize-none bg-transparent p-2 text-sm text-black/80 placeholder-black/40 focus:outline-none"
      />
    </div>
  );
}
