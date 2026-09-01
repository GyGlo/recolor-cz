const listEl = document.querySelector("#concept-list");
const editorEl = document.querySelector("#concept-editor");
const editToggle = document.querySelector("#edit-toggle");
const addButton = document.querySelector("#add-publication");
const form = document.querySelector("#publication-form");
const editIndexInput = document.querySelector("#edit-index");
const monthInput = document.querySelector("#publication-month");
const nameInput = document.querySelector("#publication-name");
const fileInput = document.querySelector("#publication-file");
const fileDrop = document.querySelector("#file-drop");
const cancelButton = document.querySelector("#cancel-edit");
const exportButton = document.querySelector("#export-json");
const resetButton = document.querySelector("#reset-local");

const storageKey = "conceptPublicationsDraft";
const objectUrls = new Map();
let basePublications = [];
let publications = [];
let isEditing = new URLSearchParams(window.location.search).get("edit") === "1";

const clonePublications = (items) => JSON.parse(JSON.stringify(items));

const normalizePreviewName = (name) => {
  const cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/_RGB$/i, "")
    .replace(/[-_]?preview[-_]?s?$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${cleanName || "concept-publikace"}_preview.pdf`;
};

const formatDate = (date) => {
  const [year, month] = String(date || "").split("-");
  return year && month ? `${month}/${year}` : date || "";
};

const sortedPublications = (items) =>
  [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(a.title || "").localeCompare(String(b.title || "")));

const saveLocalDraft = () => {
  const stored = publications.map(({ localUrl, ...publication }) => publication);
  localStorage.setItem(storageKey, JSON.stringify(stored));
};

const openHref = (publication) => {
  if (publication.localUrl) return publication.localUrl;
  const params = new URLSearchParams({
    file: publication.file,
    folder: publication.folder || "concept"
  });
  return `/publikace/viewer/?${params.toString()}`;
};

const createPublicationRow = (publication, index) => {
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
  open.textContent = "Otevřít";
  if (publication.localUrl) open.target = "_blank";
  actions.append(open);

  if (isEditing) {
    const edit = document.createElement("button");
    edit.className = "toolbar-button text-button";
    edit.type = "button";
    edit.textContent = "Upravit";
    edit.addEventListener("click", () => editPublication(index));

    const remove = document.createElement("button");
    remove.className = "toolbar-button text-button danger-button";
    remove.type = "button";
    remove.textContent = "Smazat";
    remove.addEventListener("click", () => removePublication(index));

    actions.append(edit, remove);
  }

  row.append(cover, body, actions);
  return row;
};

const renderPublications = () => {
  listEl.replaceChildren();
  const sorted = sortedPublications(publications);

  if (sorted.length === 0) {
    const empty = document.createElement("p");
    empty.className = "status-text";
    empty.textContent = "Zatím tu nejsou žádné publikace.";
    listEl.append(empty);
    return;
  }

  const groups = new Map();
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

    items.forEach((publication) => {
      const originalIndex = publications.indexOf(publication);
      section.append(createPublicationRow(publication, originalIndex));
    });

    listEl.append(section);
  });
};

const setEditing = (nextState) => {
  isEditing = nextState;
  editorEl.hidden = !isEditing;
  addButton.hidden = !isEditing;
  editToggle.textContent = isEditing ? "Zavřít editaci" : "Upravit";
  renderPublications();
};

const resetForm = () => {
  form.reset();
  editIndexInput.value = "";
  fileDrop.classList.remove("is-dragging");
};

const editPublication = (index) => {
  const publication = publications[index];
  if (!publication) return;
  editIndexInput.value = String(index);
  monthInput.value = publication.date || "";
  nameInput.value = publication.title || "";
  fileInput.value = "";
  editorEl.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
};

const removePublication = (index) => {
  publications.splice(index, 1);
  saveLocalDraft();
  resetForm();
  renderPublications();
};

const exportManifest = () => {
  const exportable = sortedPublications(publications).map(({ localUrl, ...publication }) => publication);
  const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "concept-publications.json";
  link.click();
  URL.revokeObjectURL(url);
};

const loadPublications = async () => {
  const response = await fetch("/publikace/concept-publications.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Manifest publikací se nepodařilo načíst.");
  basePublications = await response.json();
  const localDraft = localStorage.getItem(storageKey);
  publications = localDraft ? JSON.parse(localDraft) : clonePublications(basePublications);
  renderPublications();
};

editToggle.addEventListener("click", () => setEditing(!isEditing));
addButton.addEventListener("click", () => {
  resetForm();
  editorEl.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
});
cancelButton.addEventListener("click", resetForm);
exportButton.addEventListener("click", exportManifest);
resetButton.addEventListener("click", () => {
  publications = clonePublications(basePublications);
  localStorage.removeItem(storageKey);
  resetForm();
  renderPublications();
});

["dragenter", "dragover"].forEach((eventName) => {
  fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    fileDrop.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  fileDrop.addEventListener(eventName, () => fileDrop.classList.remove("is-dragging"));
});

fileDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  const [file] = [...event.dataTransfer.files].filter((item) => item.type === "application/pdf");
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const editIndex = Number(editIndexInput.value);
  const file = fileInput.files[0];
  const existing = Number.isInteger(editIndex) && editIndex >= 0 ? publications[editIndex] : null;
  const nextPublication = {
    ...(existing || {}),
    title: nameInput.value.trim(),
    date: monthInput.value,
    folder: "concept",
    file: file ? normalizePreviewName(file.name) : existing?.file || normalizePreviewName(nameInput.value),
  };

  if (file) {
    if (objectUrls.has(nextPublication.file)) URL.revokeObjectURL(objectUrls.get(nextPublication.file));
    const url = URL.createObjectURL(file);
    objectUrls.set(nextPublication.file, url);
    nextPublication.localUrl = url;
    nextPublication.pages = undefined;
  }

  if (existing) {
    publications[editIndex] = nextPublication;
  } else {
    publications.push(nextPublication);
  }

  saveLocalDraft();
  resetForm();
  renderPublications();
});

try {
  await loadPublications();
  setEditing(isEditing);
} catch (error) {
  listEl.replaceChildren();
  const message = document.createElement("p");
  message.className = "status-text error";
  message.textContent = error.message;
  listEl.append(message);
}
