'use client';

import { cloneElement, isValidElement, type ReactElement } from 'react';
import { toast } from '@bemindlabs/unicore-ui';
import { useDemoMode } from '@/hooks/use-demo-mode';

interface DemoActionButtonProps {
  /**
   * A single clickable element (Button, anchor, etc.). In the demo tenant its
   * `onClick` is intercepted and replaced with a "not available in demo" toast,
   * and the control is visually disabled. Outside demo it renders untouched.
   */
  children: ReactElement<{ onClick?: (e: unknown) => void; disabled?: boolean }>;
  /** Toast message shown when the guarded action is attempted in demo. */
  message?: string;
}

/**
 * Wraps a destructive/mutating control and neutralizes it in the demo tenant
 * (Phase 5 / W3). The backend DemoModeGuard is the authoritative block; this is
 * the matching UX so demo users see a friendly message instead of a 403.
 */
export function DemoActionButton({
  children,
  message = 'This action is disabled in the demo. Start a free trial to do this for real.',
}: DemoActionButtonProps) {
  const demoMode = useDemoMode();

  if (!demoMode || !isValidElement(children)) {
    return children;
  }

  return cloneElement(children, {
    disabled: true,
    onClick: (e: unknown) => {
      (e as { preventDefault?: () => void })?.preventDefault?.();
      toast({ title: 'Demo mode', description: message });
    },
  });
}
