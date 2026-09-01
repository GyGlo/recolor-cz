// publikace/assets/concept-source.js
var listEl = document.querySelector("#concept-list");
var clonePublications = (items) => JSON.parse(JSON.stringify(items));
var formatDate = (date) => {
  const [year, month] = String(date || "").split("-");
  return year && month ? `${month}/${year}` : date || "";
};
var sortedPublications = (items) => [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(a.title || "").localeCompare(String(b.title || "")));
var openHref = (publication) => {
  const params = new URLSearchParams({
    file: publication.file,
    folder: publication.folder || "concept"
  });
  return `/publikace/viewer/?${params.toString()}`;
};
var createPublicationRow = (publication) => {
  const row = document.createElement("article");
  row.className = "concept-publication-row";
  const cover = document.createElement("img");
  cover.className = "concept-cover";
  cover.alt = "";
  cover.loading = "lazy";
  cover.src = publication.cover ? `/publikace/${publication.cover}` : "/publikace/assets/concept/concept-hero.png";
  const body = document.createElement("div");
  body.className = "concept-row-body";
  const date = document.createElement("p");
  date.className = "publication-meta";
  date.textContent = formatDate(publication.date);
  const title = document.createElement("h3");
  title.textContent = publication.title || publication.file;
  const details = document.createElement("p");
  details.textContent = publication.pages ? `${publication.pages} stran` : publication.file;
  body.append(date, title, details);
  const actions = document.createElement("div");
  actions.className = "concept-row-actions";
  const open = document.createElement("a");
  open.className = "card-link";
  open.href = openHref(publication);
  open.textContent = "Otev\u0159\xEDt";
  actions.append(open);
  row.append(cover, body, actions);
  return row;
};
var renderPublications = (publications) => {
  listEl.replaceChildren();
  const sorted = sortedPublications(publications);
  if (sorted.length === 0) {
    const empty = document.createElement("p");
    empty.className = "status-text";
    empty.textContent = "Zat\xEDm tu nejsou \u017E\xE1dn\xE9 publikace.";
    listEl.append(empty);
    return;
  }
  const groups = /* @__PURE__ */ new Map();
  sorted.forEach((publication) => {
    const year = String(publication.date || "").slice(0, 4) || "Bez roku";
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(publication);
  });
  groups.forEach((items, year) => {
    const section = document.createElement("section");
    section.className = "concept-year-group";
    const heading = document.createElement("h2");
    heading.textContent = year;
    section.append(heading);
    items.forEach((publication) => section.append(createPublicationRow(publication)));
    listEl.append(section);
  });
};
var loadPublications = async () => {
  const response = await fetch("/publikace/concept-publications.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Manifest publikac\xED se nepoda\u0159ilo na\u010D\xEDst.");
  return clonePublications(await response.json());
};
try {
  renderPublications(await loadPublications());
} catch (error) {
  listEl.replaceChildren();
  const message = document.createElement("p");
  message.className = "status-text error";
  message.textContent = error.message;
  listEl.append(message);
}
