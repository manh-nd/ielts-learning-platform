import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./dialog";
import { Button } from "./button";

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Publish Assessment</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Assessment Publication</DialogTitle>
          <DialogDescription>
            Once published, the band scores and feedback will become visible to
            the learner (PUBLICATION-01).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="default">Publish Immediately</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const OpenDialogInteractionTest: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button data-testid="dialog-open-trigger" />}>
        Open Confirmation
      </DialogTrigger>
      <DialogContent data-testid="dialog-popup">
        <DialogHeader>
          <DialogTitle data-testid="dialog-heading">
            Approve Teacher Review
          </DialogTitle>
          <DialogDescription>
            Confirm that you have reviewed all 4 IELTS criteria.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button variant="default">Confirm Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-open-trigger");
    await expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);

    // Dialog portal attaches to document body
    const heading = await within(document.body).findByTestId("dialog-heading");
    await expect(heading).toBeInTheDocument();
    await expect(heading).toHaveTextContent("Approve Teacher Review");
  },
};
