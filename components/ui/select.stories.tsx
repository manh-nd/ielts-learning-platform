import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "./select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="6.5">
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select Band Score" />
      </SelectTrigger>
      <SelectContent aria-label="IELTS Band Scores">
        <SelectGroup>
          <SelectLabel>IELTS Band Scores</SelectLabel>
          <SelectItem value="9.0">Band 9.0 (Expert)</SelectItem>
          <SelectItem value="8.5">Band 8.5 (Very Good)</SelectItem>
          <SelectItem value="8.0">Band 8.0 (Very Good)</SelectItem>
          <SelectItem value="7.5">Band 7.5 (Good)</SelectItem>
          <SelectItem value="7.0">Band 7.0 (Good)</SelectItem>
          <SelectItem value="6.5">Band 6.5 (Competent)</SelectItem>
          <SelectItem value="6.0">Band 6.0 (Competent)</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const GroupedOptions: Story = {
  render: () => (
    <Select defaultValue="task_2">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Choose prompt type" />
      </SelectTrigger>
      <SelectContent aria-label="Prompt options">
        <SelectGroup>
          <SelectLabel>Writing</SelectLabel>
          <SelectItem value="task_1_academic">Task 1 Academic</SelectItem>
          <SelectItem value="task_1_general">Task 1 General</SelectItem>
          <SelectItem value="task_2">Task 2 Essay</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Speaking</SelectLabel>
          <SelectItem value="speaking_part_1">Speaking Part 1</SelectItem>
          <SelectItem value="speaking_part_2">Speaking Part 2</SelectItem>
          <SelectItem value="speaking_part_3">Speaking Part 3</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const SelectInteractionTest: Story = {
  render: () => (
    <Select defaultValue="7.0">
      <SelectTrigger className="w-48" data-testid="select-band-trigger">
        <SelectValue placeholder="Select Band" />
      </SelectTrigger>
      <SelectContent aria-label="Select Band">
        <SelectGroup>
          <SelectItem value="6.5" data-testid="band-6.5">
            Band 6.5
          </SelectItem>
          <SelectItem value="7.0" data-testid="band-7.0">
            Band 7.0
          </SelectItem>
          <SelectItem value="7.5" data-testid="band-7.5">
            Band 7.5
          </SelectItem>
          <SelectItem value="8.0" data-testid="band-8.0">
            Band 8.0
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("select-band-trigger");
    await expect(trigger).toBeInTheDocument();
    await expect(trigger).toHaveTextContent("7.0");

    await userEvent.click(trigger);
    const option = await within(document.body).findByTestId("band-8.0");
    await expect(option).toBeInTheDocument();
    await userEvent.click(option);

    await expect(trigger).toHaveTextContent("8.0");
  },
};
