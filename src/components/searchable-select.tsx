"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Option = {
  id: string;
  label: string;
  description?: string | null;
};

type SearchableSelectProps = {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  options?: Option[];
  disabled?: boolean;
  loadOptions?: (query: string) => Promise<Option[]>;
  value?: string;
  selectedLabel?: string;
  query?: string;
  onQueryChange?: (value: string) => void;
  onSelectionChange?: (option: Option | null) => void;
  variant?: "default" | "prominent";
};

export function SearchableSelect({
  id,
  name,
  label,
  placeholder,
  options = [],
  disabled = false,
  loadOptions,
  value,
  selectedLabel,
  query: controlledQuery,
  onQueryChange,
  onSelectionChange,
  variant = "default"
}: SearchableSelectProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const loadOptionsRef = useRef(loadOptions);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [remoteOptions, setRemoteOptions] = useState<Option[]>(options);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const resolvedSelectedId = value ?? selectedId;
  const resolvedQuery = controlledQuery ?? query;
  const hasRemoteLoader = Boolean(loadOptions);

  useEffect(() => {
    loadOptionsRef.current = loadOptions;
  }, [loadOptions]);

  useEffect(() => {
    if (typeof value === "string") {
      setSelectedId(value);
    }
  }, [value]);

  useEffect(() => {
    if (typeof controlledQuery === "string") {
      setQuery(controlledQuery);
    } else if (typeof selectedLabel === "string") {
      setQuery(selectedLabel);
    }
  }, [controlledQuery, selectedLabel]);

  useEffect(() => {
    if (!hasRemoteLoader) {
      setRemoteOptions(options);
    }
  }, [hasRemoteLoader, options]);

  useEffect(() => {
    if (!hasRemoteLoader) {
      return;
    }

    const activeLoader = loadOptionsRef.current;
    let cancelled = false;

    async function run() {
      if (!activeLoader) {
        return;
      }

      setIsLoadingOptions(true);
      setHasLoadError(false);
      setRemoteOptions([]);

      try {
        const nextOptions = await activeLoader(deferredQuery);

        if (!cancelled) {
          setRemoteOptions(nextOptions);
        }
      } catch {
        if (!cancelled) {
          setRemoteOptions([]);
          setHasLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, hasRemoteLoader]);

  const filteredOptions = useMemo(() => {
    if (loadOptions) {
      return remoteOptions;
    }

    const normalized = deferredQuery.trim().toLowerCase();

    if (!normalized) {
      return options.slice(0, 50);
    }

    return options
      .filter((option) => option.label.toLowerCase().includes(normalized))
      .slice(0, 100);
  }, [deferredQuery, loadOptions, options, remoteOptions]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className={`field${variant === "prominent" ? " field-prominent" : ""}`}>
      <label htmlFor={`${id}-search`}>{label}</label>
      <div className={`searchable-select searchable-select-${variant}`} ref={wrapperRef}>
        <input
          id={`${id}-search`}
          type="text"
          value={resolvedQuery}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
            }
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onQueryChange?.(event.target.value);
            setSelectedId("");
            onSelectionChange?.(null);
            if (!disabled) {
              setIsOpen(true);
            }
          }}
        />
        <input id={id} name={name} type="hidden" value={resolvedSelectedId} />

        {isOpen && !disabled ? (
          <div className="searchable-select-menu">
            <div className="searchable-select-meta">
              {isLoadingOptions
                ? "Searching..."
                : hasLoadError
                  ? "Search failed. Keep typing to retry."
                : resolvedQuery.trim()
                  ? `${filteredOptions.length} result(s) shown`
                  : hasRemoteLoader
                    ? "Type to search stores"
                    : `Type to search across ${options.length} store(s)`}
            </div>
            {isLoadingOptions ? (
              <div className="searchable-select-empty">Searching stores...</div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.id === resolvedSelectedId;

                return (
                  <button
                    key={option.id}
                    className={cn("searchable-select-option", isSelected && "searchable-select-option-active")}
                    type="button"
                    onClick={() => {
                      setQuery(option.label);
                      onQueryChange?.(option.label);
                      setSelectedId(option.id);
                      onSelectionChange?.(option);
                      setIsOpen(false);
                    }}
                  >
                    <span className="searchable-select-option-label">{option.label}</span>
                    {option.description ? (
                      <span className="searchable-select-option-meta">{option.description}</span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="searchable-select-empty">No matching stores found.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
