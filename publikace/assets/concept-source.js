import { upload } from "@vercel/blob/client";

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
const passwordDialog = document.querySelector("#password-dialog");
const passwordForm = document.querySelector("#password-form");
const passwordInput = document.querySelector("#editor-password");
const passwordError = document.querySelector("#password-error");
const passwordCancel = document.querySelector("#password-cancel");
const editorStatus = document.querySelector("#editor-status");

const editorPasswordHash = "f9eb3caedd5e975fe700b461e63a6cf3d75aa6657d9a6d049252077a2801e0fa";
let basePublications = [];
let publications = [];
const shouldOpenEditor = new URLSearchParams(window.location.search).get("edit") === "1";
let isEditing = false;
let isEditorUnlocked = false;
let pendingUnlock = false;
let editorPassword = "";

const clonePublications = (items) => JSON.parse(JSON.stringify(items));

const hashValue = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

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

const setEditorStatus = (message, tone = "") => {
  if (!editorStatus) return;
  editorStatus.textContent = message;
  editorStatus.dataset.tone = tone;
};

const publicManifest = (items = publications) =>
  sortedPublications(items).map(({ localUrl, ...publication }) => publication);

const saveManifest = async (nextPublications = publications) => {
  setEditorStatus("Ukládám seznam publikací...", "busy");
  const response = await fetch("/api/concept-publications/", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      password: editorPassword,
      publications: publicManifest(nextPublications)
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Seznam publikací se nepodařilo uložit.");
  }

  basePublications = clonePublications(payload.publications);
  publications = clonePublications(payload.publications);
  setEditorStatus("Hotovo. Změny jsou uložené na webu.", "success");
  return publications;
};

const openHref = (publication) => {
  if (publication.localUrl) return publication.localUrl;
  if (publication.url) {
    const params = new URLSearchParams({
      url: publication.url,
      file: publication.file
    });
    return `/publikace/viewer/?${params.toString()}`;
  }

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

const setEditing = async (nextState) => {
  if (nextState && !isEditorUnlocked) {
    pendingUnlock = true;
    passwordError.hidden = true;
    passwordInput.value = "";
    passwordDialog.showModal();
    window.setTimeout(() => passwordInput.focus(), 0);
    return;
  }

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
  if (!window.confirm("Opravdu smazat tuto publikaci ze seznamu? PDF v úložišti zůstane zachované.")) return;
  publications.splice(index, 1);
  saveManifest(publications)
    .then(() => {
      resetForm();
      renderPublications();
    })
    .catch((error) => setEditorStatus(error.message, "error"));
};

const exportManifest = () => {
  const exportable = publicManifest();
  const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "concept-publications.json";
  link.click();
  URL.revokeObjectURL(url);
};

const loadPublications = async () => {
  let response = await fetch("/api/concept-publications/", { cache: "no-store" });

  if (!response.ok) {
    response = await fetch("/publikace/concept-publications.json", { cache: "no-store" });
  }

  if (!response.ok) throw new Error("Manifest publikací se nepodařilo načíst.");
  basePublications = await response.json();
  publications = clonePublications(basePublications);
  renderPublications();
};

editToggle.addEventListener("click", () => setEditing(!isEditing));
passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const hash = await hashValue(passwordInput.value);

  if (hash !== editorPasswordHash) {
    passwordError.hidden = false;
    passwordInput.select();
    return;
  }

  isEditorUnlocked = true;
  editorPassword = passwordInput.value;
  pendingUnlock = false;
  passwordDialog.close();
  setEditing(true);
});
passwordDialog.addEventListener("close", () => {
  if (pendingUnlock) {
    pendingUnlock = false;
    isEditing = false;
    editorEl.hidden = true;
    addButton.hidden = true;
    editToggle.textContent = "Upravit";
    renderPublications();
  }
});
passwordCancel.addEventListener("click", () => passwordDialog.close());
addButton.addEventListener("click", () => {
  resetForm();
  editorEl.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
});
cancelButton.addEventListener("click", resetForm);
exportButton.addEventListener("click", exportManifest);
resetButton.addEventListener("click", () => {
  publications = clonePublications(basePublications);
  resetForm();
  setEditorStatus("Načtená poslední uložená verze seznamu.", "");
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const editIndex = Number(editIndexInput.value);
  const file = fileInput.files[0];
  const existing = Number.isInteger(editIndex) && editIndex >= 0 ? publications[editIndex] : null;

  if (!existing && !file) {
    setEditorStatus("Při přidání nové publikace vyber PDF soubor.", "error");
    return;
  }

  const cleanFileName = file ? normalizePreviewName(file.name) : existing?.file || normalizePreviewName(nameInput.value);
  const nextPublication = {
    ...(existing || {}),
    title: nameInput.value.trim(),
    date: monthInput.value,
    folder: "concept",
    file: cleanFileName,
  };

  try {
    submitButton.disabled = true;

    if (file) {
      setEditorStatus("Nahrávám PDF do Vercel Blob...", "busy");
      const blob = await upload(`concept/${cleanFileName}`, file, {
        access: "public",
        handleUploadUrl: "/api/concept-upload/",
        clientPayload: JSON.stringify({ password: editorPassword })
      });

      nextPublication.url = blob.url;
      nextPublication.pages = undefined;
    }

    if (existing) {
      publications[editIndex] = nextPublication;
    } else {
      publications.push(nextPublication);
    }

    await saveManifest(publications);
    resetForm();
    renderPublications();
  } catch (error) {
    setEditorStatus(error.message || "Publikaci se nepodařilo uložit.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

try {
  await loadPublications();
  await setEditing(shouldOpenEditor);
} catch (error) {
  listEl.replaceChildren();
  const message = document.createElement("p");
  message.className = "status-text error";
  message.textContent = error.message;
  listEl.append(message);
}
