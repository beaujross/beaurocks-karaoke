import React from 'react';
import { getMissingCapabilityLabel, hasCapability } from '../billing/capabilities';

export default function FeatureGate({
  capabilities = {},
  capability = '',
  fallback = null,
  children,
}) {
  if (hasCapability(capabilities, capability)) {
    return <>{children}</>;
  }
  if (fallback) return <>{fallback}</>;
  return (
    <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2">
      {getMissingCapabilityLabel(capability)} is not included in this plan.
    </div>
  );
}
