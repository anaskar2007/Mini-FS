"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLanguageId } from "@/lib/file-type";
import { FilenameDisplay } from "@/components/fs/filename-display";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CodeEditorProps {
  filename: string;
  initialContent: string;
  isSaving?: boolean;
  onSave: (content: string) => void | Promise<void>;
  onCancel?: () => void;
}

function getExtension(langId: string) {
  switch (langId) {
    case "javascript":
    case "typescript": return javascript({ typescript: langId === "typescript", jsx: true });
    case "python": return python();
    case "java": return java();
    case "css": return css();
    case "html": return html();
    case "json": return json();
    case "sql": return sql();
    case "xml": return xml();
    case "markdown": return markdown();
    default: return [];
  }
}

const baseTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    height: "100%",
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    fontSize: "13px",
  },
  ".cm-content": { padding: "12px 0" },
  ".cm-line": { padding: "0 16px" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid #303030",
    color: "#555",
    minWidth: "44px",
  },
  ".cm-activeLineGutter": { backgroundColor: "rgba(113,102,238,0.08)" },
  ".cm-activeLine": { backgroundColor: "rgba(113,102,238,0.06)" },
  ".cm-cursor": { borderLeftColor: "#7166ee" },
  ".cm-selectionBackground": { backgroundColor: "rgba(113,102,238,0.2) !important" },
  ".cm-focused .cm-selectionBackground": { backgroundColor: "rgba(113,102,238,0.25) !important" },
  ".cm-scroller": { overflow: "auto" },
});

export function CodeEditor({
  filename,
  initialContent,
  isSaving = false,
  onSave,
  onCancel,
}: CodeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const langId = getLanguageId(filename);
  const extensions = [baseTheme, getExtension(langId)].flat();

  // Reset when a different file is opened
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContent(initialContent);
    setDirty(false);
  }, [initialContent, filename]);

  const handleChange = useCallback((value: string) => {
    setContent(value);
    setDirty(value !== initialContent);
  }, [initialContent]);

  // Ctrl/Cmd+S shortcut
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && !isSaving) void onSave(content);
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [content, dirty, isSaving, onSave]);

  function handleCancel() {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    discardChanges();
  }

  function discardChanges() {
    setContent(initialContent);
    setDirty(false);
    onCancel?.();
  }

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <ConfirmDialog open={confirmDiscard} title="Discard unsaved changes?" description="Your edits to this file will be lost." confirmLabel="Discard changes" destructive onCancel={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); discardChanges(); }} />
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <FilenameDisplay name={filename} className="font-mono text-xs text-muted-foreground" />
          <Badge
            variant="secondary"
            className={
              dirty
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]"
                : "text-[10px]"
            }
          >
            {dirty ? "Unsaved" : "Saved"}
          </Badge>
          {langId !== "text" && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {langId}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            disabled={!dirty || isSaving}
            onClick={() => void onSave(content)}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {/* Editor */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          onChange={handleChange}
          theme={oneDark}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: true,
            tabSize: 2,
          }}
          style={{ height: "100%" }}
        />
      </div>
      {/* Footer hint */}
      <div className="border-t border-border px-4 py-1.5 text-[10px] text-muted-foreground/60">
        {dirty ? "Ctrl+S / ⌘S to save" : "No changes"}
      </div>
    </div>
  );
}
