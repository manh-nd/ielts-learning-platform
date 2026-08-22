"use client";

import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";

export interface TiptapEditorContentChange {
  html: string;
  text: string;
  wordCount: number;
  characterCount: number;
}

export interface TiptapEditorProps {
  content?: string;
  placeholder?: string;
  editable?: boolean;
  isMockTest?: boolean;
  className?: string;
  editorClassName?: string;
  minHeight?: string;
  onChange?: (change: TiptapEditorContentChange) => void;
  onPasteBlocked?: () => void;
  autoFocus?: boolean;
  "data-testid"?: string;
}

export function TiptapEditor({
  content = "",
  placeholder = "Write your content here...",
  editable = true,
  isMockTest = false,
  className,
  editorClassName,
  minHeight = "min-h-[380px]",
  onChange,
  onPasteBlocked,
  autoFocus = false,
  "data-testid": testId = "tiptap-editor",
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus,
    content,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      CharacterCount.configure(),
      Placeholder.configure({
        placeholder,
      }),
    ],
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-neutral dark:prose-invert max-w-none focus:outline-none text-base leading-relaxed p-6 selection:bg-primary/20",
          minHeight,
          editorClassName
        ),
        "data-testid": "tiptap-editor-content",
      },
      handlePaste: (_view, event) => {
        if (isMockTest) {
          event.preventDefault();
          onPasteBlocked?.();
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        if (isMockTest) {
          event.preventDefault();
          onPasteBlocked?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const words = editor.storage.characterCount.words();
      const characters = editor.storage.characterCount.characters();
      const text = editor.getText({ blockSeparator: "\n\n" });
      const html = editor.getHTML();
      onChange?.({ html, text, wordCount: words, characterCount: characters });
    },
  });

  // Sync content updates if changed externally
  useEffect(() => {
    if (editor && content !== undefined && editor.getHTML() !== content) {
      if (editor.isEmpty && content) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  // Sync editable state
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-background text-foreground transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/20",
        !editable && "bg-muted/40 cursor-not-allowed",
        className
      )}
      data-testid={testId}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
