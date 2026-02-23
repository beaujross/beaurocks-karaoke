export const EMPTY_STATE_CONTEXT = {
  DISCOVER_NO_RESULTS: "discover_no_results",
  DISCOVER_PERMISSION: "discover_permission",
  GEO_NO_RESULTS: "geo_no_results",
  VENUE_MISSING: "venue_missing",
  EVENT_MISSING: "event_missing",
  HOST_MISSING: "host_missing",
  SESSION_MISSING: "session_missing",
  PERFORMER_MISSING: "performer_missing",
};

export const getEmptyStateConfig = ({ context = "", hasFilters = false, session = null } = {}) => {
  const canUseRestrictedActions = !!session?.isAuthed && !session?.isAnonymous;
  if (context === EMPTY_STATE_CONTEXT.DISCOVER_PERMISSION) {
    return {
      title: "Some discovery data is private right now.",
      description: "Create an account and continue your path, or retry with broad public filters.",
      actions: [
        { id: "auth", label: canUseRestrictedActions ? "Open Dashboard" : "Create account to continue", intent: "auth" },
        { id: "discover_reset", label: "Retry with public scope", intent: "discover_reset" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.DISCOVER_NO_RESULTS) {
    return {
      title: "No listings match yet.",
      description: hasFilters
        ? "Try broader filters, then continue to submit or claim flow."
        : "No approved listings yet in this scope. Start with submit or claim paths.",
      actions: [
        { id: "discover_reset", label: "Show all listings", intent: "discover_reset" },
        canUseRestrictedActions
          ? { id: "submit_listing", label: "Submit listing", intent: "submit_listing" }
          : { id: "auth", label: "Create account to submit", intent: "auth" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.GEO_NO_RESULTS) {
    return {
      title: "No public listings in this geo route yet.",
      description: "Switch to discover, or start supply-side flow by submitting/claiming listings.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        canUseRestrictedActions
          ? { id: "submit_listing", label: "Submit listing", intent: "submit_listing" }
          : { id: "auth", label: "Create account to submit", intent: "auth" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.VENUE_MISSING) {
    return {
      title: "Venue not found.",
      description: "Open discover to find another listing or submit a new venue.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        canUseRestrictedActions
          ? { id: "submit_listing", label: "Submit venue", intent: "submit_listing" }
          : { id: "auth", label: "Create account to submit", intent: "auth" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.EVENT_MISSING) {
    return {
      title: "Event not found.",
      description: "Browse discover or create a new public/private event path.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        { id: "for_hosts", label: "Host quick start", intent: "for_hosts" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.HOST_MISSING) {
    return {
      title: "Host profile not found.",
      description: "Use discover to follow active hosts or create your host profile.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        canUseRestrictedActions
          ? { id: "profile", label: "Open dashboard", intent: "profile" }
          : { id: "auth", label: "Create account", intent: "auth" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.SESSION_MISSING) {
    return {
      title: "Session not found.",
      description: "Use join by room code or discover public sessions.",
      actions: [
        { id: "join", label: "Join by code", intent: "join" },
        { id: "discover", label: "Open discover", intent: "discover" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.PERFORMER_MISSING) {
    return {
      title: "Performer profile not found.",
      description: "Use discover to find performers, or complete your own profile path.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        canUseRestrictedActions
          ? { id: "profile", label: "Open dashboard", intent: "profile" }
          : { id: "auth", label: "Create account", intent: "auth" },
      ],
    };
  }
  return {
    title: "Nothing here yet.",
    description: "Start from discover or one of the persona entry paths.",
    actions: [
      { id: "discover", label: "Open discover", intent: "discover" },
      { id: "for_fans", label: "For fans", intent: "for_fans" },
    ],
  };
};
