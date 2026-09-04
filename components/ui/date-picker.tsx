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
import { ScrollArea } from "@/components/ui/scroll-area";

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

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0")
);

const MINUTES = Array.from({ length: 60 }, (_, i) =>
  i.toString().padStart(2, "0")
);

const QUICK_TIME_PRESETS = [
  { label: "23:59", hours: 23, minutes: 59 },
  { label: "18:00", hours: 18, minutes: 0 },
  { label: "12:00", hours: 12, minutes: 0 },
];

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
  const [currentHours, currentMinutes] = currentTime.split(":");

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      if (!isControlled) setUncontrolledDate(undefined);
      onChange?.(undefined, undefined);
      return;
    }

    if (includeTime) {
      const hours = parseInt(currentHours, 10);
      const minutes = parseInt(currentMinutes, 10);
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

  const handleTimeUpdate = (newHours: string, newMinutes: string) => {
    const formattedTime = `${newHours}:${newMinutes}`;
    setInternalTime(formattedTime);

    const baseDate = selectedDate ?? new Date();
    const h = parseInt(newHours, 10);
    const m = parseInt(newMinutes, 10);
    const combined = new Date(baseDate);
    combined.setHours(isNaN(h) ? 23 : h, isNaN(m) ? 59 : m, 0, 0);

    if (!isControlled) setUncontrolledDate(combined);
    onChange?.(combined, toLocalDatetimeString(combined));
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
        className="w-auto p-0 gap-0 overflow-hidden shadow-lg border-border"
        align="start"
      >
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={disabledMatcher}
            defaultMonth={selectedDate || minDate || new Date()}
          />

          {includeTime && (
            <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-border p-3 w-full sm:w-48 bg-card justify-between gap-2.5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ClockIcon className="size-3.5 text-primary shrink-0" />
                    <span>Giờ nộp bài</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {currentTime}
                  </span>
                </div>

                {/* Quick time preset buttons */}
                <div className="flex items-center gap-1">
                  {QUICK_TIME_PRESETS.map((preset) => {
                    const pad = (n: number) => n.toString().padStart(2, "0");
                    const isSelected =
                      currentHours === pad(preset.hours) &&
                      currentMinutes === pad(preset.minutes);
                    return (
                      <Button
                        key={preset.label}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="xs"
                        className="h-6 flex-1 text-[11px] px-1 font-normal"
                        onClick={() =>
                          handleTimeUpdate(
                            pad(preset.hours),
                            pad(preset.minutes)
                          )
                        }
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>

                {/* Two scrollable columns: Hours & Minutes */}
                <div className="flex h-44 divide-x divide-border border border-border/70 rounded-md bg-muted/10 overflow-hidden text-center">
                  {/* Hours column */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-muted-foreground border-b border-border/70 py-1 bg-muted/30">
                      Giờ
                    </div>
                    <ScrollArea className="h-full">
                      <div className="flex flex-col p-1 gap-0.5">
                        {HOURS.map((h) => (
                          <Button
                            key={h}
                            type="button"
                            variant={currentHours === h ? "default" : "ghost"}
                            size="xs"
                            className="h-6 w-full text-xs font-normal"
                            data-testid={`time-hour-${h}`}
                            onClick={() => handleTimeUpdate(h, currentMinutes)}
                          >
                            {h}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Minutes column */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-muted-foreground border-b border-border/70 py-1 bg-muted/30">
                      Phút
                    </div>
                    <ScrollArea className="h-full">
                      <div className="flex flex-col p-1 gap-0.5">
                        {MINUTES.map((m) => (
                          <Button
                            key={m}
                            type="button"
                            variant={currentMinutes === m ? "default" : "ghost"}
                            size="xs"
                            className="h-6 w-full text-xs font-normal"
                            data-testid={`time-minute-${m}`}
                            onClick={() => handleTimeUpdate(currentHours, m)}
                          >
                            {m}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>

              {/* Confirm / Close Button */}
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => setOpen(false)}
                className="h-7 text-xs w-full mt-1"
                data-testid="date-picker-confirm-button"
              >
                Xác nhận
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
