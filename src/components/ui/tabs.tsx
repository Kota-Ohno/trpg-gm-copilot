import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

type TabOption<T extends string> = {
  icon?: LucideIcon;
  value: T;
  label: string;
};

type TabsProps<T extends string> = {
  ariaLabel: string;
  value: T;
  options: Array<TabOption<T>>;
  className?: string;
  onChange: (value: T) => void;
};

export function Tabs<T extends string>({ ariaLabel, className, value, options, onChange }: TabsProps<T>) {
  const selectTabAt = (nextIndex: number, tabList: HTMLElement | null): void => {
    const nextOption = options[nextIndex];
    if (nextOption) {
      onChange(nextOption.value);
      tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
    }
  };

  const moveSelection = (direction: 1 | -1, currentIndex: number, tabList: HTMLElement | null): void => {
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    selectTabAt(nextIndex, tabList);
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(1, index, event.currentTarget.parentElement);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(-1, index, event.currentTarget.parentElement);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectTabAt(0, event.currentTarget.parentElement);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectTabAt(options.length - 1, event.currentTarget.parentElement);
    }
  };

  return (
    <div
      aria-label={ariaLabel}
      className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-md border bg-muted/70 p-1", className)}
      role="tablist"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          aria-selected={option.value === value}
          className={cn(
            "inline-flex min-h-8 min-w-0 items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
            option.value === value && "bg-background text-foreground shadow-sm",
          )}
          onKeyDown={(event) => handleTabKeyDown(event, index)}
          onClick={() => onChange(option.value)}
          role="tab"
          tabIndex={option.value === value ? 0 : -1}
          type="button"
        >
          {option.icon && <option.icon className="h-4 w-4 shrink-0" />}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
