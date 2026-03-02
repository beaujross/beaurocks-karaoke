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
      title: "Some listings are private right now.",
      description: "Sign in to keep going, or switch to broad public filters.",
      actions: [
        { id: "auth", label: canUseRestrictedActions ? "Open Dashboard" : "Create BeauRocks account to continue", intent: "auth" },
        { id: "discover_reset", label: "Retry with public scope", intent: "discover_reset" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.DISCOVER_NO_RESULTS) {
    return {
      title: "No listings match this filter set.",
      description: hasFilters
        ? "Try wider filters, then take the next step."
        : "Nothing public here yet. You can submit or claim a listing.",
      actions: [
        { id: "discover_reset", label: "Show all listings", intent: "discover_reset" },
        canUseRestrictedActions
          ? { id: "submit_listing", label: "Submit listing", intent: "submit_listing" }
          : { id: "auth", label: "Create BeauRocks account to submit", intent: "auth" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.GEO_NO_RESULTS) {
    return {
      title: "No public listings in this area yet.",
      description: "Open Discover or submit a listing to get this area moving.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        canUseRestrictedActions
          ? { id: "submit_listing", label: "Submit listing", intent: "submit_listing" }
          : { id: "auth", label: "Create BeauRocks account to submit", intent: "auth" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.VENUE_MISSING) {
    return {
      title: "Venue not found.",
      description: "Open Discover to find another listing or add a new venue.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        canUseRestrictedActions
          ? { id: "submit_listing", label: "Submit venue", intent: "submit_listing" }
          : { id: "auth", label: "Create BeauRocks account to submit", intent: "auth" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.EVENT_MISSING) {
    return {
      title: "Event not found.",
      description: "Browse Discover or create a new event.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        { id: "for_hosts", label: "Host quick start", intent: "for_hosts" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.HOST_MISSING) {
    return {
      title: "Host profile not found.",
      description: "Use Discover to follow active hosts, or set up your own host profile.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        canUseRestrictedActions
          ? { id: "profile", label: "Open dashboard", intent: "profile" }
          : { id: "auth", label: "Create BeauRocks account", intent: "auth" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.SESSION_MISSING) {
    return {
      title: "Session not found.",
      description: "Try Join By Code, or browse public sessions in Discover.",
      actions: [
        { id: "join", label: "Join by code", intent: "join" },
        { id: "discover", label: "Open discover", intent: "discover" },
      ],
    };
  }
  if (context === EMPTY_STATE_CONTEXT.PERFORMER_MISSING) {
    return {
      title: "Performer profile not found.",
      description: "Use Discover to find performers, or complete your own profile.",
      actions: [
        { id: "discover", label: "Open discover", intent: "discover" },
        canUseRestrictedActions
          ? { id: "profile", label: "Open dashboard", intent: "profile" }
          : { id: "auth", label: "Create BeauRocks account", intent: "auth" },
      ],
    };
  }
  return {
    title: "Nothing here yet.",
    description: "Start from Discover or one of the persona paths.",
    actions: [
      { id: "discover", label: "Open discover", intent: "discover" },
      { id: "for_fans", label: "For fans", intent: "for_fans" },
    ],
  };
};
