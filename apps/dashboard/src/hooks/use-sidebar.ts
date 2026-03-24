'use client';

import { useCallback, useState } from 'react';

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);
  const open = useCallback(() => setCollapsed(false), []);
  const close = useCallback(() => setCollapsed(true), []);

  return { collapsed, toggle, open, close };
}
