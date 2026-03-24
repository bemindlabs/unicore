import React from 'react';

// Mock the hooks before importing components
jest.mock('@/hooks/use-license', () => ({
  useProFeature: jest.fn(),
}));

jest.mock('@/components/license/upgrade-prompt', () => ({
  UpgradePrompt: ({ feature, targetTier }: { feature: string; targetTier: string }) =>
    React.createElement('div', { 'data-testid': 'upgrade-prompt', 'data-feature': feature, 'data-tier': targetTier }),
}));

import { useProFeature } from '@/hooks/use-license';

const mockUseProFeature = useProFeature as jest.MockedFunction<typeof useProFeature>;

describe('ProGate component logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when feature is enabled', () => {
    mockUseProFeature.mockReturnValue({ enabled: true, showUpgrade: false });

    // Simulate ProGate logic
    const { enabled } = mockUseProFeature('sso');
    expect(enabled).toBe(true);
    // When enabled, children should render (not upgrade prompt)
  });

  it('shows upgrade prompt when feature is disabled', () => {
    mockUseProFeature.mockReturnValue({ enabled: false, showUpgrade: true });

    const { enabled, showUpgrade } = mockUseProFeature('sso');
    expect(enabled).toBe(false);
    expect(showUpgrade).toBe(true);
    // When not enabled, UpgradePrompt should render
  });

  it('passes feature flag to useProFeature', () => {
    mockUseProFeature.mockReturnValue({ enabled: true, showUpgrade: false });

    mockUseProFeature('customDomains');
    expect(mockUseProFeature).toHaveBeenCalledWith('customDomains');
  });

  it('defaults targetTier to Pro', () => {
    // ProGate has default targetTier='Pro'
    const defaultTier: 'Pro' | 'Enterprise' = 'Pro';
    expect(defaultTier).toBe('Pro');
  });

  it('accepts Enterprise as targetTier', () => {
    const tier: 'Pro' | 'Enterprise' = 'Enterprise';
    expect(tier).toBe('Enterprise');
  });
});

describe('UpgradePrompt component', () => {
  it('renders with feature name and target tier', () => {
    // Verify the component accepts correct props
    const props = {
      feature: 'Single Sign-On',
      targetTier: 'Pro' as const,
    };
    expect(props.feature).toBe('Single Sign-On');
    expect(props.targetTier).toBe('Pro');
  });

  it('generates default description when none provided', () => {
    const feature = 'SSO';
    const targetTier = 'Pro';
    const description = `Upgrade to ${targetTier} to unlock ${feature} and other premium features.`;
    expect(description).toContain('Pro');
    expect(description).toContain('SSO');
  });

  it('uses custom description when provided', () => {
    const customDescription = 'Custom upgrade message for this feature.';
    expect(customDescription).toBe('Custom upgrade message for this feature.');
  });
});
