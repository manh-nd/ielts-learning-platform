import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { AppShell } from "./app-shell";
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

    const desktopSidebar = canvasElement.querySelector(
      'div[data-slot="sidebar"][data-state]'
    );
    expect(desktopSidebar).toHaveAttribute("data-state", "expanded");
    expect(desktopSidebar).toHaveAttribute("data-collapsible", "");

    const brandText = canvas.getByText("Chilly IELTS");
    expect(brandText).toBeVisible();

    // Click trigger to collapse
    await userEvent.click(trigger);
    expect(desktopSidebar).toHaveAttribute("data-state", "collapsed");
    expect(desktopSidebar).toHaveAttribute("data-collapsible", "icon");

    // Click trigger to expand again
    await userEvent.click(trigger);
    expect(desktopSidebar).toHaveAttribute("data-state", "expanded");
    expect(desktopSidebar).toHaveAttribute("data-collapsible", "");
    expect(brandText).toBeVisible();
  },
};

export const MobileOffCanvas: Story = {
  args: {
    user: mockLearner,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobileSmall",
    },
    nextjs: {
      navigation: {
        pathname: "/learner/dashboard",
      },
    },
    a11y: {
      config: {
        rules: [{ id: "aria-hidden-focus", enabled: false }],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {
      name: /đóng\/mở thanh điều hướng/i,
    });
    expect(trigger).toBeInTheDocument();

    const body = within(canvasElement.ownerDocument.body);

    // Verify sheet is not initially in DOM / not visible
    expect(
      canvasElement.ownerDocument.body.querySelector(
        '[data-slot="sheet-content"]'
      )
    ).toBeNull();

    // Click trigger to open off-canvas drawer
    await userEvent.click(trigger);

    // Verify off-canvas drawer is visible with learner details and navigation after animation completes
    await waitFor(() => {
      const el = body.getByText("Nguyễn Minh Anh");
      expect(el).toBeVisible();
      expect(body.getByText("Học viên")).toBeVisible();
      expect(
        body.getByRole("link", { name: /Tổng quan Dashboard/i })
      ).toBeVisible();
    });

    // Close off-canvas drawer via Escape
    await userEvent.keyboard("{Escape}");

    // Verify off-canvas drawer is closed
    await waitFor(() => {
      expect(
        canvasElement.ownerDocument.body.querySelector(
          '[data-slot="sheet-content"]'
        )
      ).toBeNull();
    });
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

    // Verify desktop sidebar is forced collapsed offcanvas (no icon rail)
    const desktopSidebar = canvasElement.querySelector(
      'div[data-slot="sidebar"][data-state]'
    );
    expect(desktopSidebar).toHaveAttribute("data-state", "collapsed");
    expect(desktopSidebar).toHaveAttribute("data-collapsible", "offcanvas");

    // Footer is strictly omitted on immersive routes
    expect(
      canvas.queryByText(/Nền tảng Luyện thi IELTS Thông minh/i)
    ).toBeNull();
  },
};

export const DesktopCollapsed: Story = {
  args: {
    user: mockTeacher,
    defaultOpen: false,
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
    expect(trigger).toBeInTheDocument();

    const desktopSidebar = canvasElement.querySelector(
      'div[data-slot="sidebar"][data-state]'
    );
    expect(desktopSidebar).toHaveAttribute("data-state", "collapsed");
    expect(desktopSidebar).toHaveAttribute("data-collapsible", "icon");
  },
};

export const MobileOffCanvasOpen: Story = {
  args: {
    user: mockLearner,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobileSmall",
    },
    nextjs: {
      navigation: {
        pathname: "/learner/dashboard",
      },
    },
    a11y: {
      config: {
        rules: [{ id: "aria-hidden-focus", enabled: false }],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {
      name: /đóng\/mở thanh điều hướng/i,
    });
    // Open via userEvent trigger click
    await userEvent.click(trigger);

    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => {
      expect(body.getByText("Nguyễn Minh Anh")).toBeVisible();
      expect(body.getByText("Học viên")).toBeVisible();
      expect(
        body.getByRole("link", { name: /Tổng quan Dashboard/i })
      ).toBeVisible();
    });
  },
};
