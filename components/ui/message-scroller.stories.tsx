import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "./message-scroller";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "./message";
import { Bubble, BubbleContent } from "./bubble";
import { Sparkles, User } from "lucide-react";

const meta: Meta<typeof MessageScroller> = {
  title: "Patterns/Chat/MessageScroller",
  component: MessageScroller,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "MessageScroller primitive tự động quản lý cuộn theo tin nhắn streaming, bám đáy (anchoring), và nút chuyển nhanh tới tin nhắn mới nhất (Jump to bottom).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MessageScroller>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-lg h-80 bg-background border rounded-xl shadow-xs overflow-hidden">
      <MessageScrollerProvider autoScroll={true}>
        <MessageScroller data-testid="storybook-scroller">
          <MessageScrollerViewport className="p-4">
            <MessageScrollerContent className="gap-4">
              <MessageScrollerItem messageId="msg-1">
                <Message align="start">
                  <MessageAvatar className="size-8 bg-indigo-600 text-white">
                    <Sparkles className="size-4" />
                  </MessageAvatar>
                  <MessageContent>
                    <MessageHeader>
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                        Giám khảo
                      </span>
                    </MessageHeader>
                    <Bubble variant="outline">
                      <BubbleContent className="p-3">
                        <p className="text-xs">
                          Xin chào, hôm nay chúng ta sẽ thực hiện bài thi nói
                          IELTS.
                        </p>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>

              <MessageScrollerItem messageId="msg-2" scrollAnchor={true}>
                <Message align="end">
                  <MessageAvatar className="size-8 bg-primary text-primary-foreground">
                    <User className="size-4" />
                  </MessageAvatar>
                  <MessageContent>
                    <MessageHeader>
                      <span className="font-semibold text-foreground">Bạn</span>
                    </MessageHeader>
                    <Bubble variant="default" align="end">
                      <BubbleContent className="p-3">
                        <p className="text-xs">Vâng, em đã sẵn sàng.</p>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const examinerMessage = canvas.getByText(
      /Xin chào, hôm nay chúng ta sẽ thực hiện/i
    );
    await expect(examinerMessage).toBeInTheDocument();
  },
};
