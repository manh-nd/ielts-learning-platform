import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Calendar } from "./calendar";

const meta: Meta<typeof Calendar> = {
  title: "UI/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thành phần Calendar chuẩn của shadcn/ui dựa trên react-day-picker, hỗ trợ chọn ngày đơn, khoảng ngày, và tích hợp với Popover/Dialog.",
      },
    },
    a11y: { test: "error" },
  },
};

export default meta;
type Story = StoryObj<typeof Calendar>;

function CalendarDefaultDemo() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 8, 4)
  );
  return (
    <div className="p-4 border rounded-md w-fit bg-card">
      <Calendar mode="single" selected={selected} onSelect={setSelected} />
    </div>
  );
}

export const Default: Story = {
  render: () => <CalendarDefaultDemo />,
};

export const WithDisabledDates: Story = {
  render: () => {
    const today = new Date(2026, 8, 4);
    return (
      <div className="p-4 border rounded-md w-fit bg-card">
        <Calendar
          mode="single"
          disabled={{ before: today }}
          defaultMonth={today}
        />
      </div>
    );
  },
};
