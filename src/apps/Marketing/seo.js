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
  const page = String(route?.page || MARKETING_ROUTE_PAGES.forHosts);
  const id = String(route?.id || "");
  const params = route?.params || {};

  if (page === MARKETING_ROUTE_PAGES.discover) {
    return {
      title: "Setlist Karaoke Finder | BeauRocks Karaoke",
      description: "Find premium karaoke nights by city, host, venue, and time window using the BeauRocks Setlist Finder.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "CollectionPage", name: "BeauRocks Karaoke Setlist Finder" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.demo) {
    return {
      title: "Abstract Demo | BeauRocks Karaoke",
      description: "See the conceptual system story behind BeauRocks across host, TV, audience, and singer surfaces.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Abstract Demo" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.demoAuto) {
    return {
      title: "Auto Demo | BeauRocks Karaoke",
      description: "Watch a local-only autoplay walkthrough of the BeauRocks host, TV, and audience room experience.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Auto Demo" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.changelog) {
    return {
      title: "Product Changelog | BeauRocks Karaoke",
      description: "Release updates and product changes across host, audience, and public TV experiences.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Product Changelog" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.hostAccess) {
    return {
      title: "Host Access | BeauRocks Karaoke",
      description: "Approved hosts log in here to open Host Dashboard. New host partners can request early access for 2026 invite waves.",
      robots: "noindex,nofollow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Host Access" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.forHosts) {
    return {
      title: "Early Host Access | BeauRocks Karaoke",
      description: "Join the line for BeauRocks early host partner access. We are inviting a limited 2026 cohort of hosts and testers.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Early Host Access" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.forVenues) {
    return {
      title: "For Venues | BeauRocks Karaoke",
      description: "Claim your venue profile, publish recurring cadence updates, and become a destination for premium karaoke nights.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "For Venues" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.forPerformers) {
    return {
      title: "For Performers | BeauRocks Karaoke",
      description: "Find standout rooms, RSVP quickly, and track your performer history in one profile.",
      robots: "index,follow",
      structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "For Performers" },
    };
  }
  if (page === MARKETING_ROUTE_PAGES.forFans) {
    return {
      title: "For Fans | BeauRocks Karaoke",
      description: "Discover premium karaoke nights nearby and join a more social, interactive room experience.",
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
    description: "Premium karaoke technology for hosts who want unforgettable rooms and stronger real-world connection.",
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
