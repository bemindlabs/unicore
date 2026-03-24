'use client';

import { Button } from '@bemindlabs/unicore-ui';
import { useState } from 'react';

import { ProgressIndicator } from './progress-indicator';
import { useWizardState } from '@/hooks/use-wizard-state';
import { validateStep } from '@/lib/validation';

import { StepBusiness } from './step-1-business';
import { StepTeam } from './step-2-team';
import { StepAgents } from './step-3-agents';
import { StepErp } from './step-4-erp';
import { StepIntegrations } from './step-5-integrations';
import { StepReview } from './step-6-review';

const STEPS = [StepBusiness, StepTeam, StepAgents, StepErp, StepIntegrations, StepReview];

export function WizardContainer() {
  const { state, nextStep, prevStep, goToStep } = useWizardState();
  const [errors, setErrors] = useState<string[]>([]);

  const CurrentStep = STEPS[state.currentStep];
  const isFirstStep = state.currentStep === 0;
  const isLastStep = state.currentStep === STEPS.length - 1;

  function handleNext() {
    const stepData = getStepData(state.currentStep);
    const result = validateStep(state.currentStep, stepData);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    nextStep();
  }

  function handleBack() {
    setErrors([]);
    prevStep();
  }

  function handleStepClick(step: number) {
    if (step < state.currentStep) {
      setErrors([]);
      goToStep(step);
    }
  }

  function getStepData(step: number) {
    switch (step) {
      case 0: return state.business;
      case 1: return state.team;
      default: return null;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ProgressIndicator currentStep={state.currentStep} onStepClick={handleStepClick} />

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="min-h-[400px]">
        <CurrentStep />
      </div>

      {!isLastStep && (
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isFirstStep}
          >
            Back
          </Button>
          <Button onClick={handleNext}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
