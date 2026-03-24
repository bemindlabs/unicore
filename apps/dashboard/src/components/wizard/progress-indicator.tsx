'use client';

import { cn } from '@bemindlabs/unicore-ui';

import { STEP_LABELS } from '@/types/wizard';

interface ProgressIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function ProgressIndicator({ currentStep, onStepClick }: ProgressIndicatorProps): JSX.Element {
  return (
    <div className="w-full">
      {/* Mobile: simple dots */}
      <div className="flex items-center justify-center gap-2 sm:hidden">
        {STEP_LABELS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onStepClick?.(i)}
            disabled={i > currentStep}
            className={cn(
              'h-2.5 w-2.5 rounded-full transition-all',
              i === currentStep && 'bg-primary scale-125',
              i < currentStep && 'bg-primary/60',
              i > currentStep && 'bg-gray-300',
            )}
            aria-label={`Step ${i + 1}: ${STEP_LABELS[i]}`}
          />
        ))}
      </div>

      {/* Desktop: labeled steps */}
      <div className="hidden sm:flex items-center justify-between">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => onStepClick?.(i)}
              disabled={i > currentStep}
              className={cn(
                'flex items-center gap-2 text-sm font-medium transition-colors',
                i === currentStep && 'text-primary',
                i < currentStep && 'text-primary/70 hover:text-primary',
                i > currentStep && 'text-gray-400 cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
                  i === currentStep && 'bg-primary text-white',
                  i < currentStep && 'bg-primary/20 text-primary',
                  i > currentStep && 'bg-gray-200 text-gray-500',
                )}
              >
                {i < currentStep ? '✓' : i + 1}
              </span>
              <span className="hidden lg:inline">{label}</span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-px w-8 xl:w-12',
                  i < currentStep ? 'bg-primary/40' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
