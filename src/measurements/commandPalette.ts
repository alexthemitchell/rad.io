export type CommandPaletteEntry = {
  id: string;
  label: string;
  keywords: string[];
};

export const filterCommandPaletteEntries = (
  entries: CommandPaletteEntry[],
  query: string
): CommandPaletteEntry[] => {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return entries;
  }

  return entries.filter((entry) => {
    if (entry.label.toLowerCase().includes(trimmed)) {
      return true;
    }

    return entry.keywords.some((keyword) => keyword.toLowerCase().includes(trimmed));
  });
};
