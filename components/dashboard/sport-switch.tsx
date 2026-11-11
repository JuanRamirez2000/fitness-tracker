"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Segmented } from "@/components/ui/segmented";
import { SPORT_LABELS, type SportFilter } from "@/lib/sport";

interface SwitchState {
  options: readonly SportFilter[];
  value: SportFilter;
  set: (value: SportFilter) => void;
}

const SwitchContext = createContext<SwitchState | null>(null);

/**
 * One shared card under the All filter, with its own All | Ride | Run switch. The server renders
 * the card once per option (`panels`, each with its sport set) and this shows the picked one, so
 * switching is instant and the charts stay server components. The switch itself is drawn in the
 * card's header by SportSwitchControl (ChartCard renders it), which reads this context.
 */
export function SportSwitch({ panels }: { panels: Partial<Record<SportFilter, ReactNode>> }) {
  const options = (Object.keys(panels) as SportFilter[]).filter((k) => panels[k] !== undefined);
  const [value, setValue] = useState<SportFilter>(options[0] ?? "all");
  return <SwitchContext.Provider value={{ options, value, set: setValue }}>{panels[value]}</SwitchContext.Provider>;
}

/** The switch in a card's header. Renders nothing outside a SportSwitch or with one option. */
export function SportSwitchControl() {
  const state = useContext(SwitchContext);
  if (!state || state.options.length < 2) return null;
  return (
    <Segmented
      aria-label="Sport shown in this card"
      options={state.options.map((value) => ({ value, label: SPORT_LABELS[value] }))}
      value={state.value}
      onChange={state.set}
    />
  );
}
