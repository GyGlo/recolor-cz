const listEl = document.querySelector("#publication-list");

const formatDate = (value) => {
  if (!value) return "";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
};

const createPublicationCard = (publication) => {
  const article = document.createElement("article");
  article.className = "publication-card";

  const meta = document.createElement("p");
  meta.className = "publication-meta";
  meta.textContent = formatDate(publication.date) || "PDF";

  const title = document.createElement("h2");
  title.textContent = publication.title || publication.file;

  const description = document.createElement("p");
  description.textContent = publication.description || "PDF publikace";

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = `viewer.html?file=${encodeURIComponent(publication.file)}`;
  link.textContent = "Otevřít publikaci";

  article.append(meta, title, description, link);
  return article;
};

try {
  const response = await fetch("publications.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Manifest publikací se nepodařilo načíst.");
  const publications = await response.json();

  listEl.replaceChildren();

  if (!Array.isArray(publications) || publications.length === 0) {
    const empty = document.createElement("p");
    empty.className = "status-text";
    empty.textContent = "Zatím tu nejsou žádné publikace.";
    listEl.append(empty);
  } else {
    publications.forEach((publication) => {
      listEl.append(createPublicationCard(publication));
    });
  }
} catch (error) {
  listEl.innerHTML = "";
  const message = document.createElement("p");
  message.className = "status-text error";
  message.textContent = error.message;
  listEl.append(message);
}
