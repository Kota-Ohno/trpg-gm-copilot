import { cn } from "../../lib/utils";

type TabOption<T extends string> = {
  value: T;
  label: string;
};

type TabsProps<T extends string> = {
  ariaLabel: string;
  value: T;
  options: Array<TabOption<T>>;
  onChange: (value: T) => void;
};

export function Tabs<T extends string>({ ariaLabel, value, options, onChange }: TabsProps<T>) {
  const moveSelection = (direction: 1 | -1): void => {
    const currentIndex = options.findIndex((option) => option.value === value);
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    const nextOption = options[nextIndex];
    if (nextOption) {
      onChange(nextOption.value);
    }
  };

  return (
    <div aria-label={ariaLabel} className="inline-flex rounded-md bg-muted p-1" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          aria-selected={option.value === value}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
            option.value === value && "bg-background text-foreground shadow-sm",
          )}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              moveSelection(1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              moveSelection(-1);
            }
          }}
          onClick={() => onChange(option.value)}
          role="tab"
          tabIndex={option.value === value ? 0 : -1}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
