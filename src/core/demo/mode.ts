export function isDemoMode() {
  return process.env.DCS_DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_DCS_DEMO_MODE === 'true';
}

