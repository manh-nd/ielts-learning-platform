"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  RemoveFormatting,
} from "lucide-react";

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
  enableBubbleMenu?: boolean;
  isMockTest?: boolean;
  className?: string;
  editorClassName?: string;
  minHeight?: string;
  onChange?: (change: TiptapEditorContentChange) => void;
  onPasteBlocked?: () => void;
  autoFocus?: boolean;
  "data-testid"?: string;
}

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function TiptapEditor({
  content = "",
  placeholder = "Write your content here...",
  editable = true,
  enableBubbleMenu = true,
  isMockTest = false,
  className,
  editorClassName,
  minHeight = "min-h-[380px]",
  onChange,
  onPasteBlocked,
  autoFocus = false,
  "data-testid": testId = "tiptap-editor",
}: TiptapEditorProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isMounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

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
          "tiptap prose prose-neutral dark:prose-invert max-w-none focus:outline-none text-base leading-relaxed p-6 selection:bg-primary/20",
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

  // Attach Floating BubbleMenu on text selection (only in practice mode when text is selected)
  useEffect(() => {
    if (
      !editor ||
      !menuRef.current ||
      !enableBubbleMenu ||
      isMockTest ||
      !editable
    ) {
      return;
    }

    const plugin = BubbleMenuPlugin({
      pluginKey: "bubbleMenuPlugin",
      editor,
      element: menuRef.current,
      shouldShow: ({ state, from, to }) => {
        const { doc, selection } = state;
        const { empty } = selection;
        const isEmptyDoc =
          doc.textContent.trim().length === 0 ||
          (doc.firstChild?.isText && doc.firstChild.text?.trim().length === 0);

        if (empty || isEmptyDoc || from === to || !editor.isEditable) {
          return false;
        }
        return true;
      },
      options: {
        placement: "top",
        offset: 8,
      },
    });

    editor.registerPlugin(plugin);

    return () => {
      editor.unregisterPlugin("bubbleMenuPlugin");
    };
  }, [editor, enableBubbleMenu, isMockTest, editable]);

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-background text-foreground transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/20",
        !editable && "bg-muted/40 cursor-not-allowed",
        className
      )}
      data-testid={testId}
    >
      {/* Floating Bubble Menu (Hidden by default, only shown floating above selected text) */}
      {enableBubbleMenu && !isMockTest && editable && isMounted && (
        <div
          ref={menuRef}
          data-testid="tiptap-bubble-menu"
          style={{ visibility: "hidden", position: "absolute" }}
          className="z-50 flex items-center gap-0.5 rounded-lg border bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur-sm"
        >
          <button
            type="button"
            data-testid="bubble-btn-bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={cn(
              "p-1.5 rounded-md text-xs hover:bg-muted transition-colors flex items-center justify-center",
              editor?.isActive("bold")
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="In đậm (Bold - Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="bubble-btn-italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={cn(
              "p-1.5 rounded-md text-xs hover:bg-muted transition-colors flex items-center justify-center",
              editor?.isActive("italic")
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="In nghiêng (Italic - Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="bubble-btn-underline"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={cn(
              "p-1.5 rounded-md text-xs hover:bg-muted transition-colors flex items-center justify-center",
              editor?.isActive("underline")
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Gạch chân (Underline - Ctrl+U)"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="bubble-btn-strike"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={cn(
              "p-1.5 rounded-md text-xs hover:bg-muted transition-colors flex items-center justify-center",
              editor?.isActive("strike")
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Gạch ngang (Strikethrough)"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-border mx-0.5" />

          <button
            type="button"
            data-testid="bubble-btn-bullet-list"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={cn(
              "p-1.5 rounded-md text-xs hover:bg-muted transition-colors flex items-center justify-center",
              editor?.isActive("bulletList")
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Danh sách gạch đầu dòng"
          >
            <List className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="bubble-btn-ordered-list"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={cn(
              "p-1.5 rounded-md text-xs hover:bg-muted transition-colors flex items-center justify-center",
              editor?.isActive("orderedList")
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Danh sách số thứ tự"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="bubble-btn-blockquote"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={cn(
              "p-1.5 rounded-md text-xs hover:bg-muted transition-colors flex items-center justify-center",
              editor?.isActive("blockquote")
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Trích dẫn (Blockquote)"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-border mx-0.5" />

          <button
            type="button"
            data-testid="bubble-btn-clear-format"
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
            className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
            title="Xóa định dạng"
          >
            <RemoveFormatting className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="bubble-btn-undo"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            title="Hoàn tác (Undo - Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="bubble-btn-redo"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            title="Làm lại (Redo - Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
