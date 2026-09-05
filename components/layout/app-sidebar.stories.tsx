import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
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

const meta: Meta<typeof AppSidebar> = {
  title: "Product/Layout/AppSidebar",
  component: AppSidebar,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/teacher/review",
      },
    },
  },
  decorators: [
    (Story) => (
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-full bg-background">
          <Story />
        </div>
      </SidebarProvider>
    ),
  ],
  args: {
    user: mockTeacher,
    onSignOut: fn(),
    isSigningOut: false,
  },
};

export default meta;
type Story = StoryObj<typeof AppSidebar>;

export const TeacherNavigation: Story = {
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
      canvas.getByRole("link", { name: /Không gian Chấm bài/i })
    ).toBeInTheDocument();
    expect(
      canvas.getByRole("link", { name: /Quản lý Lớp học/i })
    ).toBeInTheDocument();
    expect(
      canvas.getByRole("link", { name: /Chế độ Xem Học viên/i })
    ).toBeInTheDocument();

    expect(
      canvas.getByRole("button", { name: /Menu tài khoản/i })
    ).toBeInTheDocument();
  },
};

export const LearnerNavigation: Story = {
  args: {
    user: mockLearner,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/learner/dashboard",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText("Chilly IELTS")).toBeInTheDocument();
    expect(
      canvas.getByRole("link", { name: /Tổng quan Dashboard/i })
    ).toBeInTheDocument();
    expect(
      canvas.getByRole("link", { name: /Speaking Practice/i })
    ).toBeInTheDocument();

    expect(
      canvas.queryByRole("link", { name: /Không gian Chấm bài/i })
    ).toBeNull();
  },
};

export const NestedActiveItem: Story = {
  args: {
    user: mockTeacher,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/teacher/submissions/sub-101",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const activeLink = canvas.getByRole("link", {
      name: /Không gian Chấm bài/i,
    });
    expect(activeLink).toBeInTheDocument();
    expect(activeLink).toHaveAttribute("data-active");
  },
};

export const SignOutCallback: Story = {
  args: {
    user: mockLearner,
    onSignOut: fn(),
  },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: "aria-hidden-focus", enabled: false }],
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const menuTrigger = canvas.getByRole("button", { name: /Menu tài khoản/i });
    await userEvent.click(menuTrigger);

    const logoutItem = await within(document.body).findByRole("menuitem", {
      name: /Đăng xuất/i,
    });
    expect(logoutItem).toBeInTheDocument();

    await userEvent.click(logoutItem);
    expect(args.onSignOut).toHaveBeenCalled();
  },
};
