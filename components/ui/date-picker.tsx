"use client";

import * as React from "react";
import { format, startOfDay } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, ClockIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export interface DatePickerProps {
  value?: Date | string;
  defaultValue?: Date | string;
  onChange?: (date: Date | undefined, dateString?: string) => void;
  /**
   * Whether to include time selection.
   * Default: false
   */
  includeTime?: boolean;
  defaultTime?: string; // "HH:mm", defaults to "23:59"
  disabled?: boolean;
  minDate?: Date;
  placeholder?: string;
  className?: string;
  id?: string;
  "data-testid"?: string;
}

export function DatePicker({
  value,
  defaultValue,
  onChange,
  includeTime = false,
  defaultTime = "23:59",
  disabled = false,
  minDate,
  placeholder = "Chọn thời hạn...",
  className,
  id,
  "data-testid": dataTestId,
}: DatePickerProps) {
  const parseDate = React.useCallback(
    (val?: Date | string): Date | undefined => {
      if (!val) return undefined;
      const d = typeof val === "string" ? new Date(val) : val;
      return isNaN(d.getTime()) ? undefined : d;
    },
    []
  );

  const isControlled = value !== undefined;
  const controlledDate = React.useMemo(
    () => parseDate(value),
    [value, parseDate]
  );
  const [uncontrolledDate, setUncontrolledDate] = React.useState<
    Date | undefined
  >(() => parseDate(defaultValue));
  const selectedDate = isControlled ? controlledDate : uncontrolledDate;

  const [open, setOpen] = React.useState(false);

  const getTimeString = React.useCallback(
    (d?: Date): string => {
      if (!d) return defaultTime;
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    [defaultTime]
  );

  const [internalTime, setInternalTime] = React.useState(() =>
    getTimeString(selectedDate)
  );

  const currentTime = selectedDate ? getTimeString(selectedDate) : internalTime;

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      if (!isControlled) setUncontrolledDate(undefined);
      onChange?.(undefined, undefined);
      return;
    }

    if (includeTime) {
      const [hours, minutes] = currentTime.split(":").map(Number);
      const combined = new Date(date);
      combined.setHours(
        isNaN(hours) ? 23 : hours,
        isNaN(minutes) ? 59 : minutes,
        0,
        0
      );
      if (!isControlled) setUncontrolledDate(combined);
      onChange?.(combined, toLocalDatetimeString(combined));
    } else {
      if (!isControlled) setUncontrolledDate(date);
      const pad = (n: number) => n.toString().padStart(2, "0");
      const dateString = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      onChange?.(date, dateString);
      setOpen(false);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setInternalTime(newTime);
    if (selectedDate && newTime) {
      const [hours, minutes] = newTime.split(":").map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const combined = new Date(selectedDate);
        combined.setHours(hours, minutes, 0, 0);
        if (!isControlled) setUncontrolledDate(combined);
        onChange?.(combined, toLocalDatetimeString(combined));
      }
    }
  };

  const formattedDisplay = React.useMemo(() => {
    if (!selectedDate) return null;
    if (includeTime) {
      return format(selectedDate, "HH:mm, dd/MM/yyyy", { locale: vi });
    }
    return format(selectedDate, "dd/MM/yyyy", { locale: vi });
  }, [selectedDate, includeTime]);

  const disabledMatcher = React.useMemo(() => {
    if (!minDate) return undefined;
    return { before: startOfDay(minDate) };
  }, [minDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={id}
            data-testid={dataTestId}
            disabled={disabled}
            className={cn(
              "h-8 justify-start text-left text-xs font-normal border-border bg-input/20 hover:bg-input/40 dark:bg-input/30",
              !selectedDate && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon
          data-icon="inline-start"
          className="text-muted-foreground"
        />
        {formattedDisplay ? (
          <span>{formattedDisplay}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent
        aria-label="Chọn ngày và thời gian"
        className="w-auto p-0 gap-0"
        align="start"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={disabledMatcher}
          defaultMonth={selectedDate || minDate || new Date()}
        />
        {includeTime && (
          <div className="border-t border-border p-2.5 flex items-center justify-between gap-2 bg-card">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClockIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span>Giờ:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="time"
                aria-label="Giờ nộp bài"
                value={currentTime}
                onChange={handleTimeChange}
                className="h-7 w-24 text-xs px-2 py-0"
                data-testid="date-picker-time-input"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="h-7 text-xs px-2"
              >
                Xong
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
