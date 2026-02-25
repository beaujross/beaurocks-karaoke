import { buildMarketingPath, MARKETING_ROUTE_PAGES } from "./routing";

const toWords = (value = "") =>
  String(value || "")
    .split("_")
    .join(" ")
    .split("-")
    .join(" ")
    .trim();

const titleCase = (value = "") =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

const ensureMetaTag = ({ name = "", property = "", content = "" }) => {
  if (typeof document === "undefined") return;
  const attr = property ? "property" : "name";
  const key = property || name;
  if (!key) return;
  let node = document.querySelector(`meta[${attr}="${key}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute("content", String(content || ""));
};

const ensureCanonical = (href = "") => {
  if (typeof document === "undefined") return;
  let node = document.querySelector("link[rel='canonical']");
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
};

const ensureStructuredData = (id = "marketing-seo", payload = null) => {
  if (typeof document === "undefined") return;
  let node = document.querySelector(`script[data-seo-id="${id}"]`);
  if (!payload) {
    if (node?.parentNode) node.parentNode.removeChild(node);
    return;
  }
  if (!node) {
    node = document.createElement("script");
    node.type = "application/ld+json";
    node.setAttribute("data-seo-id", id);
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(payload);
};

const buildGeoLabel = (params = {}) => {
  const state = String(params?.state || "").trim().toUpperCase();
  const city = titleCase(toWords(params?.city || ""));
  const region = titleCase(toWords(params?.regionToken || ""));
  if (city && state) return `${city}, ${state}`;
  return region || "Regional";
};

const buildRouteSeo = (route = {}) => {
  const page = String(route?.page || MARKETING_ROUTE_PAGES.forFans);
  const id = String(route?.id || "");
  const params = route?.params || {};

  if (page === MARKETING_ROUTE_PAGES.discover) {
    return {
      title: "Setlist Karaoke Finder | BeauRocks Karaoke",
      description: "Use BeauRocks Karaoke Setlist to find public karaoke nights by city, host, venue, and time window.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "CollectionPage", name: "BeauRocks Karaoke Setlist Finder" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.demo) {
    return {
      title: "Live Demo Arena | BeauRocks Karaoke",
      description: "Watch a scripted TV, audience, and host walkthrough with reactions, vibe-sync guitar mode, and trivia.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Live Demo Arena" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.hostAccess) {
    return {
      title: "Host Access | BeauRocks Karaoke",
      description: "Private test host sign in, account setup, and invite code access.",
      robots: "noindex,nofollow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Host Access" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.forHosts) {
    return {
      title: "For Hosts | BeauRocks Karaoke",
      description: "Create private room sessions or public discoverable events and grow repeat attendance.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "For Hosts" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.forVenues) {
    return {
      title: "For Venues | BeauRocks Karaoke",
      description: "Claim your venue listing and publish recurring karaoke cadence updates.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "For Venues" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.forPerformers) {
    return {
      title: "For Performers | BeauRocks Karaoke",
      description: "Find events, RSVP, and track your karaoke performance history in one profile.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "For Performers" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.forFans) {
    return {
      title: "For Fans | BeauRocks Karaoke",
      description: "Browse nearby karaoke events and get reminders before showtime.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "For Fans" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.venue) {
    return {
      title: `Venue Listing ${id ? `| ${id}` : ""} | BeauRocks`,
      description: "View venue details, karaoke cadence, social actions, and ownership claim status.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "Place", identifier: id || undefined },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.event) {
    return {
      title: `Karaoke Event ${id ? `| ${id}` : ""} | BeauRocks`,
      description: "View event timing, RSVP options, and reminder enrollment channels.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "Event", identifier: id || undefined },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.host) {
    return {
      title: `Host Profile ${id ? `| ${id}` : ""} | BeauRocks`,
      description: "Explore host events, public sessions, and follower activity.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "ProfilePage", identifier: id || undefined },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.performer) {
    return {
      title: `Performer Profile ${id ? `| ${id}` : ""} | BeauRocks`,
      description: "Track performer activity, reviews, and karaoke history.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "ProfilePage", identifier: id || undefined },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.session) {
    return {
      title: `Room Session ${id ? `| ${id}` : ""} | BeauRocks`,
      description: "View room session details and social actions for attendees.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "Event", identifier: id || undefined },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.geoCity || page === MARKETING_ROUTE_PAGES.geoRegion) {
    const geoLabel = buildGeoLabel(params);
    return {
      title: `${geoLabel} Karaoke Listings | BeauRocks`,
      description: `Browse karaoke venues and upcoming events in ${geoLabel}.`,
      robots: "index,follow",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${geoLabel} Karaoke Listings`,
        about: geoLabel,
      },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.submit) {
    return {
      title: "Submit Listing | BeauRocks",
      description: "Submit a venue, event, or room session to the karaoke directory moderation queue.",
      robots: "noindex,nofollow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Submit Listing" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.profile) {
    return {
      title: "Profile Dashboard | BeauRocks",
      description: "Manage your karaoke profile, RSVPs, follows, check-ins, and performance history.",
      robots: "noindex,nofollow",
      structuredData: { "@context": "https://schema.org", "@type": "ProfilePage", name: "Profile Dashboard" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.admin) {
    return {
      title: "Marketing Moderation | BeauRocks",
      description: "Directory moderation controls for claims, submissions, and ingestion review.",
      robots: "noindex,nofollow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Moderation Admin" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.join) {
    return {
      title: "Join Private Karaoke Room | BeauRocks",
      description: "Enter a private room code to join a non-indexed karaoke session.",
      robots: "noindex,nofollow",
      structuredData: null,
    };
  }
  return {
    title: "BeauRocks Karaoke",
    description: "Discover karaoke events, venues, hosts, and performers.",
    robots: "index,follow",
    structuredData: { "@context": "https://schema.org", "@type": "WebSite", name: "BeauRocks Karaoke" },
  };
};

export const applyMarketingSeo = (route = {}) => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const seo = buildRouteSeo(route);
  const canonicalPath = buildMarketingPath(route);
  const canonicalUrl = `${window.location.origin}${canonicalPath}`;
  document.title = seo.title;
  ensureCanonical(canonicalUrl);
  ensureMetaTag({ name: "description", content: seo.description });
  ensureMetaTag({ name: "robots", content: seo.robots });
  ensureMetaTag({ property: "og:type", content: "website" });
  ensureMetaTag({ property: "og:title", content: seo.title });
  ensureMetaTag({ property: "og:description", content: seo.description });
  ensureMetaTag({ property: "og:url", content: canonicalUrl });
  ensureMetaTag({ name: "twitter:card", content: "summary_large_image" });
  ensureMetaTag({ name: "twitter:title", content: seo.title });
  ensureMetaTag({ name: "twitter:description", content: seo.description });
  ensureStructuredData("marketing-seo", seo.structuredData);
};
