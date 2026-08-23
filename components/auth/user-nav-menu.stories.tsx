import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "@storybook/test";
import { UserNavMenu } from "./user-nav-menu";
import type { UserProfile } from "./types";

const mockLearner: UserProfile = {
  id: "usr_learner_1",
  name: "Nguyễn Minh Anh",
  email: "minhanh.ielts@gmail.com",
  role: "learner",
};

const mockTeacher: UserProfile = {
  id: "usr_teacher_1",
  name: "Thầy Đặng Trần Tùng",
  email: "tung.dang@ielts-prep.vn",
  role: "teacher",
};

const meta: Meta<typeof UserNavMenu> = {
  title: "IELTS/Auth/UserNavMenu",
  component: UserNavMenu,
  parameters: {
    layout: "centered",
  },
  args: {
    user: mockLearner,
    onSignOut: fn(),
    onNavigate: fn(),
    isSigningOut: false,
  },
};

export default meta;
type Story = StoryObj<typeof UserNavMenu>;

export const LearnerUser: Story = {
  args: {
    user: mockLearner,
  },
};

export const TeacherUser: Story = {
  args: {
    user: mockTeacher,
  },
};

export const SigningOutState: Story = {
  args: {
    user: mockTeacher,
    isSigningOut: true,
  },
};

export const InteractiveDropdownOpenTest: Story = {
  args: {
    user: mockLearner,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const menuTrigger = canvas.getByRole("button", { name: /Menu tài khoản/i });
    expect(menuTrigger).toBeInTheDocument();

    await userEvent.click(menuTrigger);
  },
};
