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
          onClick={() => onChange(option.value)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
