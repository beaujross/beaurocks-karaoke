export const createDiscoverViewState = ({ isMobile = false } = {}) => ({
  resultsView: "results",
  mobileSurface: isMobile ? "map" : "list",
  mobileFiltersExpanded: !isMobile,
});

export const reduceDiscoverViewState = (state, action) => {
  const current = state || createDiscoverViewState();
  const type = String(action?.type || "").trim().toLowerCase();

  if (type === "viewport_changed") {
    const isMobile = !!action?.isMobile;
    if (!isMobile) {
      return { ...current, mobileSurface: "list", mobileFiltersExpanded: true };
    }
    return { ...current, mobileSurface: "map", mobileFiltersExpanded: false };
  }

  if (type === "show_map") {
    return { ...current, mobileSurface: "map", mobileFiltersExpanded: false };
  }
  if (type === "show_list") {
    return { ...current, mobileSurface: "list" };
  }
  if (type === "toggle_filters") {
    return { ...current, mobileFiltersExpanded: !current.mobileFiltersExpanded };
  }
  if (type === "set_results_view") {
    const value = String(action?.value || "").trim().toLowerCase();
    if (value === "tiles" || value === "results") {
      return { ...current, resultsView: value };
    }
    return current;
  }

  return current;
};
