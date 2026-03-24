'use client';

import { useState } from 'react';
import { Building2, CheckCircle2, Crown, ShieldCheck, Zap } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@bemindlabs/unicore-ui';
import { useLicense } from '@/hooks/use-license';
import { useRouter } from 'next/navigation';

function FeatureRow({
  label,
  community,
  pro,
  enterprise,
}: {
  label: string;
  community: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}) {
  const renderValue = (v: boolean | string) => {
    if (typeof v === 'string') return <span className="text-xs font-medium">{v}</span>;
    return v ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
    ) : (
      <span className="text-muted-foreground text-xs">--</span>
    );
  };
  return (
    <div className="grid grid-cols-4 items-center gap-2 py-1.5 text-sm border-b last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="flex justify-center">{renderValue(community)}</span>
      <span className="flex justify-center">{renderValue(pro)}</span>
      <span className="flex justify-center">{renderValue(enterprise)}</span>
    </div>
  );
}

const BADGE_CONFIG = {
  community: {
    label: 'Community',
    icon: ShieldCheck,
    className: 'bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer',
  },
  pro: {
    label: 'Pro',
    icon: Crown,
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 cursor-pointer',
  },
  enterprise: {
    label: 'Enterprise',
    icon: Building2,
    className: 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/60 cursor-pointer',
  },
} as const;

const FEATURES: [string, boolean | string, boolean | string, boolean | string][] = [
  ['Max Agents', '2', '50', 'Unlimited'],
  ['Custom Agent Builder', false, true, true],
  ['Advanced Workflows', false, true, true],
  ['All Channels', false, true, true],
  ['Unlimited RAG', false, true, true],
  ['Full RBAC', false, true, true],
  ['SSO', false, true, true],
  ['White Label', false, false, true],
  ['Audit Logs', true, true, true],
  ['Multi-tenancy', false, false, true],
  ['HA Cluster', false, false, true],
  ['Priority Support', false, true, true],
];

export function LicenseBadge() {
  const { edition } = useLicense();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const config = BADGE_CONFIG[edition as keyof typeof BADGE_CONFIG] ?? BADGE_CONFIG.community;
  const Icon = config.icon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center"
        aria-label="License details"
      >
        <Badge className={`gap-1 text-xs font-medium border-0 ${config.className}`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Edition Comparison
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            <div className="grid grid-cols-4 gap-2 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              <span>Feature</span>
              <span className="text-center">Community</span>
              <span className="text-center">Pro</span>
              <span className="text-center">Enterprise</span>
            </div>
            {FEATURES.map(([label, community, pro, enterprise]) => (
              <FeatureRow
                key={label}
                label={label}
                community={community}
                pro={pro}
                enterprise={enterprise}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {edition === 'community' && (
              <Button
                className="w-full gap-2"
                onClick={() => { setOpen(false); router.push('/settings/license'); }}
              >
                <Crown className="h-4 w-4" />
                Upgrade to Pro
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setOpen(false); router.push('/settings/license'); }}
            >
              Manage License
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
