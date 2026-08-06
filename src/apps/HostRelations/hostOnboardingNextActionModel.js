const ROOM_SETUP_HREF = '/?mode=host&view=ops&section=ops.room_setup&tab=admin&source=host_hub_getting_started';

const STAGE_ACTIONS = Object.freeze({
  invited: Object.freeze({
    stageLabel: 'Invitation received',
    title: 'Set up your Host identity',
    description: 'Choose the Host and workspace names guests and teammates will see. You can review everything before creating a Room.',
    ctaLabel: 'Set Up Host Profile',
    href: '/?mode=host&onboarding=1&source=host_hub_getting_started',
    icon: 'fa-id-badge',
  }),
  workspace_ready: Object.freeze({
    stageLabel: 'Host identity ready',
    title: 'Create your first Room',
    description: 'Set the Room name, entry options, and points rules before inviting anyone. Nothing goes live until you choose to launch it.',
    ctaLabel: 'Create First Room',
    href: ROOM_SETUP_HREF,
    icon: 'fa-door-open',
  }),
  first_room_complete: Object.freeze({
    stageLabel: 'First Room created',
    title: 'Build your returning-Host rhythm',
    description: 'Create the next Room to confirm your setup is repeatable before a live test night.',
    ctaLabel: 'Create Next Room',
    href: ROOM_SETUP_HREF,
    icon: 'fa-rotate',
  }),
  repeat_room_complete: Object.freeze({
    stageLabel: 'Returning Host',
    title: 'You are ready to host',
    description: 'Your onboarding path is complete. Open the Host Panel whenever you are ready to build or run a Room.',
    ctaLabel: 'Open Host Panel',
    href: '/?mode=host',
    icon: 'fa-microphone-lines',
  }),
});

const FALLBACK_ACTION = Object.freeze({
  stageLabel: 'Host access',
  title: 'Review the Host guide',
  description: 'We could not match your current onboarding stage. The guide will help you continue, or you can message the team for help.',
  ctaLabel: 'Open Host Guide',
  href: '/hub?tab=help',
  icon: 'fa-compass',
});

export const getHostOnboardingNextAction = (onboarding = null) => {
  const currentStage = String(onboarding?.currentStage || '').trim().toLowerCase();
  return {
    currentStage: currentStage || 'unknown',
    ...(STAGE_ACTIONS[currentStage] || FALLBACK_ACTION),
  };
};
