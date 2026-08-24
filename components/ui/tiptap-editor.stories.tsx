import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
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
 * 2. Editor with Pre-populated Content & Lists (Bullet & Numbered)
 */
export const WithListsAndFormatting: Story = {
  args: {
    content: `
      <h2>IELTS Essay Planning & Outline</h2>
      <p>Key arguments supporting green infrastructure:</p>
      <ul>
        <li>Reduction of urban carbon footprint and greenhouse emissions</li>
        <li>Enhancement of public health through cleaner air quality</li>
        <li>Long-term economic sustainability for municipalities</li>
      </ul>
      <p>Execution steps for local government:</p>
      <ol>
        <li>Allocate municipal budget for renewable energy subsidies</li>
        <li>Upgrade public transit fleets to electric propulsion</li>
        <li>Implement mandatory solar panel codes for commercial buildings</li>
      </ol>
      <blockquote>
        "Sustainable development meets the needs of the present without compromising future generations."
      </blockquote>
    `,
    enableBubbleMenu: true,
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editorEl = canvas.getByTestId("tiptap-editor-content");
    await expect(editorEl).toBeInTheDocument();

    // Verify lists exist
    const bulletList = editorEl.querySelector("ul");
    const orderedList = editorEl.querySelector("ol");
    const blockquote = editorEl.querySelector("blockquote");

    await expect(bulletList).not.toBeNull();
    await expect(orderedList).not.toBeNull();
    await expect(blockquote).not.toBeNull();
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
