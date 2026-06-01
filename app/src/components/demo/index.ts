/**
 * Demo-mode UI (Phase 5 / W3). Demo is how prospects try the multi-tenant SaaS
 * now that self-host is gone. Import from this barrel rather than the individual
 * files so the surface stays cohesive.
 *
 *  - DemoBanner       — dismissible "you're in the demo" top banner
 *  - DeployButton     — floating "start free trial" CTA
 *  - DemoGuard        — full-section placeholder for demo-blocked pages
 *  - DemoActionButton — wraps a single control to disable it in the demo
 */
export { DemoBanner } from './DemoBanner';
export { DeployButton } from './DeployButton';
export { DemoGuard } from './DemoGuard';
export { DemoActionButton } from './DemoActionButton';
