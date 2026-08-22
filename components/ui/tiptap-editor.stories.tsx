import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "@storybook/test";
import { TiptapEditor } from "./tiptap-editor";

const meta: Meta<typeof TiptapEditor> = {
  title: "UI/TiptapEditor",
  component: TiptapEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof TiptapEditor>;

/**
 * 1. Default Interactive Editor
 */
export const DefaultInteractive: Story = {
  args: {
    placeholder: "Type something to test Tiptap v3 clean text editor...",
    enableBubbleMenu: true,
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editorEl = canvas.getByTestId("tiptap-editor-content");
    await expect(editorEl).toBeInTheDocument();

    // Type text
    await userEvent.click(editorEl);
    await userEvent.type(editorEl, "Hello Tiptap v3 Editor");

    await expect(editorEl).toHaveTextContent("Hello Tiptap v3 Editor");
  },
};

/**
 * 2. Editor with Pre-populated Content
 */
export const WithInitialContent: Story = {
  args: {
    content:
      "<p>It is argued that renewable energy plays a vital role in global sustainable development.</p>",
    enableBubbleMenu: true,
    onChange: fn(),
  },
};

/**
 * 3. Readonly / Disabled Mode
 */
export const ReadonlyDisabled: Story = {
  args: {
    content: "<p>This is a submitted essay locked in read-only mode.</p>",
    editable: false,
  },
};

/**
 * 4. Strict Exam Mode (Paste is disabled)
 */
export const StrictExamModeWithPastePrevention: Story = {
  args: {
    placeholder: "Strict exam mode: paste is disabled...",
    isMockTest: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editorEl = canvas.getByTestId("tiptap-editor-content");

    await userEvent.click(editorEl);
    await userEvent.type(editorEl, "Manual input allowed in exam mode.");
    await expect(editorEl).toHaveTextContent(
      "Manual input allowed in exam mode."
    );
  },
};
