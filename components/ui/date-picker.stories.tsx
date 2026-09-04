import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";
import { DatePicker } from "./date-picker";

const meta: Meta<typeof DatePicker> = {
  title: "UI/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thành phần DatePicker chuẩn của shadcn/ui kết hợp giữa Popover, Button và Calendar (react-day-picker), hỗ trợ chọn ngày và thời gian (giờ/phút).",
      },
    },
    a11y: { test: "error" },
  },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

function DatePickerDefaultDemo() {
  const [date, setDate] = React.useState<Date | undefined>(
    new Date(2026, 8, 4)
  );
  return (
    <div className="p-4 w-72">
      <DatePicker value={date} onChange={setDate} />
    </div>
  );
}

export const Default: Story = {
  render: () => <DatePickerDefaultDemo />,
};

function DatePickerWithDateTimeDemo() {
  const [datetime, setDatetime] = React.useState<string>("2026-09-07T23:59");
  return (
    <div className="p-4 w-72">
      <DatePicker
        value={datetime}
        includeTime
        onChange={(_, str) => {
          if (str) setDatetime(str);
        }}
      />
    </div>
  );
}

export const WithDateTime: Story = {
  render: () => <DatePickerWithDateTimeDemo />,
};

export const WithMinDate: Story = {
  render: () => {
    const today = new Date(2026, 8, 4);
    return (
      <div className="p-4 w-72">
        <DatePicker defaultValue={today} minDate={today} includeTime />
      </div>
    );
  },
};

export const InteractiveOpenTest: Story = {
  render: () => (
    <div className="p-4 w-72">
      <DatePicker
        defaultValue={new Date(2026, 8, 10, 14, 30)}
        includeTime
        data-testid="interactive-date-picker"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("interactive-date-picker");
    await expect(trigger).toBeInTheDocument();
    await expect(trigger).toHaveTextContent("14:30, 10/09/2026");

    // Open popover
    await userEvent.click(trigger);
    const hourBtn = await within(document.body).findByTestId("time-hour-14");
    await expect(hourBtn).toBeInTheDocument();

    // Click 18:00 preset
    const preset18Btn = within(document.body).getByRole("button", {
      name: "18:00",
    });
    await userEvent.click(preset18Btn);
    await expect(trigger).toHaveTextContent("18:00, 10/09/2026");
  },
};
