import { useEffect } from "react";

const defaultDescription = "Focused practice, timed exams, and performance insights for SSC, JEE, NEET, and GATE preparation.";

export default function Seo({ title, description = defaultDescription, path = "/", type = "website" }) {
  useEffect(() => {
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const canonicalUrl = new URL(path, siteUrl).toString();
    document.title = title;
    const tags = {
      description,
      "og:title": title,
      "og:description": description,
      "og:type": type,
      "og:url": canonicalUrl,
      "twitter:title": title,
      "twitter:description": description,
    };
    Object.entries(tags).forEach(([name, content]) => {
      const selector = name.startsWith("og:") || name.startsWith("twitter:") ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let tag = document.head.querySelector(selector);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(name.startsWith("og:") || name.startsWith("twitter:") ? "property" : "name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    });
    let canonical = document.head.querySelector("link[rel=canonical]");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
    const schemaId = "site-structured-data";
    let schema = document.getElementById(schemaId);
    if (!schema) {
      schema = document.createElement("script");
      schema.id = schemaId;
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: "All India Test Series",
      url: siteUrl,
      description,
      areaServed: "IN",
      educationalCredentialAwarded: "Exam preparation practice",
      sameAs: [],
    });
  }, [description, path, title, type]);

  return null;
}
