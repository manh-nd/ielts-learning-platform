import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "./dropdown-menu";
import { Button } from "./button";
import { UserIcon, SettingsIcon, LogOutIcon, BookOpenIcon } from "lucide-react";

const meta: Meta = {
  title: "Design System/Primitives/DropdownMenu",
  parameters: {
    layout: "centered",
  },
};

export default meta;

export const Default: StoryObj = {
  render: () => {
    const onSelectAction = fn();
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              Mở Menu Tùy Chọn
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Tài khoản của tôi</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onSelectAction("profile")}>
              <UserIcon />
              <span>Hồ sơ cá nhân</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelectAction("learning")}>
              <BookOpenIcon />
              <span>Khóa học đang học</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelectAction("settings")}>
              <SettingsIcon />
              <span>Cài đặt</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onSelectAction("logout")}
          >
            <LogOutIcon />
            <span>Đăng xuất</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

export const InteractiveOpenAndSelectTest: StoryObj = {
  render: () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              Menu Thao Tác
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <UserIcon />
            <span>Xem hồ sơ</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Menu Thao Tác/i });
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);
  },
};
