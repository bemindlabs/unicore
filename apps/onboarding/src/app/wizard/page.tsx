'use client';

import { WizardProvider } from '@/hooks/use-wizard-state';
import { WizardContainer } from '@/components/wizard/wizard-container';

export default function WizardPage() {
  return (
    <WizardProvider>
      <WizardContainer />
    </WizardProvider>
  );
}
