import { HOST_ONBOARDING_STEPS } from './hostAppData';

export const COMPLIMENTARY_HOST_SETUP_STEPS = Object.freeze([
  Object.freeze({ key: 'identity', label: 'Host Profile' }),
  Object.freeze({ key: 'ready', label: 'Ready' }),
]);

export const getHostSetupSteps = ({ complimentaryTestingAccess = false } = {}) => (
  complimentaryTestingAccess
    ? COMPLIMENTARY_HOST_SETUP_STEPS
    : HOST_ONBOARDING_STEPS
);
