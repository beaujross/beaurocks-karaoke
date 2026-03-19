import { buildBrowserSeoRouteRecord } from "./seoModel";

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
  if (!payload || (Array.isArray(payload) && payload.length === 0)) {
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

export const applyMarketingSeo = (route = {}, options = {}) => {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const seo = buildBrowserSeoRouteRecord(route, options);
  document.title = seo.title;
  ensureCanonical(seo.canonicalUrl);
  ensureMetaTag({ name: "description", content: seo.description });
  ensureMetaTag({ name: "robots", content: seo.robots });
  ensureMetaTag({ property: "og:type", content: seo.ogType });
  ensureMetaTag({ property: "og:title", content: seo.title });
  ensureMetaTag({ property: "og:description", content: seo.description });
  ensureMetaTag({ property: "og:url", content: seo.canonicalUrl });
  ensureMetaTag({ property: "og:site_name", content: seo.siteName });
  ensureMetaTag({ property: "og:image", content: seo.image?.url || "" });
  ensureMetaTag({ property: "og:image:width", content: seo.image?.width || "" });
  ensureMetaTag({ property: "og:image:height", content: seo.image?.height || "" });
  ensureMetaTag({ property: "og:image:alt", content: seo.image?.alt || "" });
  ensureMetaTag({ name: "twitter:card", content: "summary_large_image" });
  ensureMetaTag({ name: "twitter:title", content: seo.title });
  ensureMetaTag({ name: "twitter:description", content: seo.description });
  ensureMetaTag({ name: "twitter:image", content: seo.image?.url || "" });
  ensureStructuredData("marketing-seo", seo.jsonLd);
  return seo;
};
