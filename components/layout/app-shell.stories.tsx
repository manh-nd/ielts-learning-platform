import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";
import { AppShell } from "./app-shell";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/components/auth/types";

const mockTeacher: UserProfile = {
  id: "usr_teacher_1",
  name: "Thầy Đặng Trần Tùng",
  email: "tung.dang@ielts-prep.vn",
  role: "teacher",
};

const mockLearner: UserProfile = {
  id: "usr_learner_1",
  name: "Nguyễn Minh Anh",
  email: "minhanh.ielts@gmail.com",
  role: "learner",
};

const meta: Meta<typeof AppShell> = {
  title: "Product/Layout/AppShell",
  component: AppShell,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/teacher/review",
      },
    },
  },
  args: {
    user: mockTeacher,
    children: (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Nội dung màn hình</h2>
        <p className="text-sm text-muted-foreground">
          Khu vực hiển thị nội dung chính của màn hình bảo vệ.
        </p>
      </div>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof AppShell>;

export const TeacherDefault: Story = {
  args: {
    user: mockTeacher,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/teacher/review",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText("Chilly IELTS")).toBeInTheDocument();
    expect(
      canvas.getByRole("heading", { name: /Không gian Chấm bài/i })
    ).toBeInTheDocument();
    expect(
      canvas.getByRole("button", { name: /đóng\/mở thanh điều hướng/i })
    ).toBeInTheDocument();
    expect(canvas.getByText("Nội dung màn hình")).toBeInTheDocument();
    expect(
      canvas.getByText(/Nền tảng Luyện thi IELTS Thông minh/i)
    ).toBeInTheDocument();
  },
};

export const DesktopExpandCollapse: Story = {
  args: {
    user: mockTeacher,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/teacher/review",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {
      name: /đóng\/mở thanh điều hướng/i,
    });

    const brandText = canvas.getByText("Chilly IELTS");
    expect(brandText).toBeVisible();

    // Click trigger to collapse
    await userEvent.click(trigger);

    // Click trigger to expand again
    await userEvent.click(trigger);
    expect(brandText).toBeVisible();
  },
};

export const MobileOffCanvas: Story = {
  args: {
    user: mockLearner,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    nextjs: {
      navigation: {
        pathname: "/learner/dashboard",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {
      name: /đóng\/mở thanh điều hướng/i,
    });
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);
  },
};

export const ImmersiveLiveSpeaking: Story = {
  args: {
    user: mockLearner,
    children: (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Phòng Thi Speaking 1-on-1</h2>
        <p className="text-sm text-muted-foreground">
          Giao diện thi trực tiếp toàn màn hình với Giám khảo AI.
        </p>
      </div>
    ),
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/learner/speaking/live",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(
      canvas.getByRole("heading", { name: /Speaking Practice/i })
    ).toBeInTheDocument();
    expect(canvas.getByText("Phòng Thi Speaking 1-on-1")).toBeInTheDocument();

    // Footer is strictly omitted on immersive routes
    expect(
      canvas.queryByText(/Nền tảng Luyện thi IELTS Thông minh/i)
    ).toBeNull();
  },
};

/**
 * Stateful transition simulation: verifies that entering /learner/speaking/live
 * forces the sidebar closed off-canvas reactively.
 */
function TransitionSimulation({ user }: { user: UserProfile }) {
  const [currentPath, setCurrentPath] = React.useState("/learner/dashboard");

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-muted/80 p-2 border-b flex items-center justify-between text-xs px-4">
        <span>
          Current simulated route: <strong>{currentPath}</strong>
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentPath("/learner/dashboard")}
          >
            Go Dashboard
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => setCurrentPath("/learner/speaking/live")}
          >
            Enter Live Speaking
          </Button>
        </div>
      </div>
      <AppShell user={user}>
        <div className="p-6">
          <h2 className="text-lg font-bold">
            {currentPath === "/learner/speaking/live"
              ? "Immersive Examiner Room"
              : "Learner Dashboard Content"}
          </h2>
        </div>
      </AppShell>
    </div>
  );
}

export const ClientSideTransitionToImmersive: Story = {
  render: () => <TransitionSimulation user={mockLearner} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initial state: dashboard
    expect(canvas.getByText("Learner Dashboard Content")).toBeInTheDocument();

    // Click Enter Live Speaking
    const enterButton = canvas.getByRole("button", {
      name: /Enter Live Speaking/i,
    });
    await userEvent.click(enterButton);

    // Target content rendered
    expect(
      await canvas.findByText("Immersive Examiner Room")
    ).toBeInTheDocument();
  },
};
