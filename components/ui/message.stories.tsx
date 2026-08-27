import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
  MessageGroup,
} from "./message";
import { Bubble, BubbleContent } from "./bubble";
import { User, Sparkles, Bot } from "lucide-react";

const meta: Meta<typeof Message> = {
  title: "UI/Chat/Message",
  component: Message,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Primitive Message cung cấp layout cấu trúc cho hội thoại chat giữa thí sinh (User), giám khảo AI (Examiner) và hệ thống chấm điểm.",
      },
    },
  },
  argTypes: {
    align: {
      control: "select",
      options: ["start", "end"],
      description:
        "Căn lề tin nhắn (start = đối phương / examiner, end = user)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Message>;

export const InboundAssistant: Story = {
  render: () => (
    <div className="w-full max-w-md p-4 bg-background border rounded-xl shadow-xs">
      <Message align="start" data-testid="inbound-message">
        <MessageAvatar className="size-8 bg-indigo-600 text-white">
          <Sparkles className="size-4" />
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>
            <span className="font-semibold text-indigo-700 dark:text-indigo-300">
              IELTS Examiner
            </span>
          </MessageHeader>
          <Bubble variant="outline">
            <BubbleContent className="p-3">
              <p className="text-xs">
                Could you tell me a little about your hometown and what you like
                most about it?
              </p>
            </BubbleContent>
          </Bubble>
          <MessageFooter className="text-xs font-mono">10:42 AM</MessageFooter>
        </MessageContent>
      </Message>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const examinerTitle = canvas.getByText("IELTS Examiner");
    await expect(examinerTitle).toBeInTheDocument();
  },
};

export const OutboundUser: Story = {
  render: () => (
    <div className="w-full max-w-md p-4 bg-background border rounded-xl shadow-xs">
      <Message align="end" data-testid="outbound-message">
        <MessageAvatar className="size-8 bg-primary text-primary-foreground">
          <User className="size-4" />
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>
            <span className="font-semibold text-foreground">
              Bạn (Thí sinh)
            </span>
          </MessageHeader>
          <Bubble variant="default" align="end">
            <BubbleContent className="p-3">
              <p className="text-xs">
                I grew up in Da Nang, a coastal city known for its beautiful
                beaches and vibrant food scene.
              </p>
            </BubbleContent>
          </Bubble>
          <MessageFooter className="text-xs font-mono">10:43 AM</MessageFooter>
        </MessageContent>
      </Message>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const userTitle = canvas.getByText("Bạn (Thí sinh)");
    await expect(userTitle).toBeInTheDocument();
  },
};

export const GroupedConversation: Story = {
  render: () => (
    <div className="w-full max-w-md p-4 bg-background border rounded-xl shadow-xs space-y-4">
      <MessageGroup>
        <Message align="start">
          <MessageAvatar className="size-8 bg-indigo-600 text-white">
            <Bot className="size-4" />
          </MessageAvatar>
          <MessageContent>
            <MessageHeader>
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                Dr. Harrison
              </span>
            </MessageHeader>
            <Bubble variant="outline">
              <BubbleContent className="p-3">
                <p className="text-xs">
                  Welcome to Part 1 of the IELTS Speaking test. Let us begin.
                </p>
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
        <Message align="end">
          <MessageAvatar className="size-8 bg-primary text-primary-foreground">
            <User className="size-4" />
          </MessageAvatar>
          <MessageContent>
            <MessageHeader>
              <span className="font-semibold text-foreground">Thí sinh</span>
            </MessageHeader>
            <Bubble variant="default" align="end">
              <BubbleContent className="p-3">
                <p className="text-xs">Thank you, I am ready to start.</p>
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      </MessageGroup>
    </div>
  ),
};
