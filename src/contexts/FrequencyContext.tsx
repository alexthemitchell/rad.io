import React, { createContext, useContext, useMemo, useState } from "react";

type FrequencyContextValue = {
  frequencyHz: number;
  setFrequencyHz: (hz: number) => void;
};

const FrequencyContext = createContext<FrequencyContextValue | undefined>(
  undefined,
);

export function FrequencyProvider({
  children,
  initialHz = 100_000_000,
}: {
  children: React.ReactNode;
  initialHz?: number;
}): React.JSX.Element {
  const [frequencyHz, setFrequencyHz] = useState<number>(initialHz);

  const value = useMemo(() => ({ frequencyHz, setFrequencyHz }), [frequencyHz]);

  return (
    <FrequencyContext.Provider value={value}>
      {children}
    </FrequencyContext.Provider>
  );
}

export function useFrequency(): FrequencyContextValue {
  const ctx = useContext(FrequencyContext);
  if (!ctx) {
    throw new Error("useFrequency must be used within a FrequencyProvider");
  }
  return ctx;
}
