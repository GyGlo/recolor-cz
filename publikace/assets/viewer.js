import * as pdfjsLib from "./vendor/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/publikace/assets/vendor/pdf.worker.mjs";

const bookEl = document.querySelector("#book");
const bookViewportEl = document.querySelector("#book-viewport");
const stageEl = document.querySelector("#book-stage");
const loadingPanel = document.querySelector("#loading-panel");
const loadingStatus = document.querySelector("#loading-status");
const progressBar = document.querySelector("#progress-bar");
const titleEl = document.querySelector("#publication-title");
const counterEl = document.querySelector("#page-counter");
const listLink = document.querySelector("#list-link");
const prevButton = document.querySelector("#prev-button");
const nextButton = document.querySelector("#next-button");
const fullscreenButton = document.querySelector("#fullscreen-button");
const shareButton = document.querySelector("#share-button");
const zoomOutButton = document.querySelector("#zoom-out-button");
const zoomResetButton = document.querySelector("#zoom-reset-button");
const zoomInButton = document.querySelector("#zoom-in-button");
const backgroundButtons = [...document.querySelectorAll("[data-bg-theme]")];

const params = new URLSearchParams(window.location.search);
const fileParam = params.get("file") || "";
const folderParam = params.get("folder") || "";
const urlParam = params.get("url") || "";
const safeFilePattern = /^[a-zA-Z0-9._ -]+\.pdf$/i;
const safeFolderPattern = /^[a-zA-Z0-9_-]+$/;
const safeBlobUrl = (() => {
  if (!urlParam) return "";

  try {
    const url = new URL(urlParam);
    const isBlobHost = /(^|\.)blob\.vercel-storage\.com$/i.test(url.hostname);
    return url.protocol === "https:" && isBlobHost && /\.pdf$/i.test(url.pathname) ? url.href : "";
  } catch {
    return "";
  }
})();
const blobFileName = safeBlobUrl ? decodeURIComponent(new URL(safeBlobUrl).pathname.split("/").pop() || "") : "";
const publicationFile = safeFilePattern.test(fileParam) ? fileParam : safeFilePattern.test(blobFileName) ? blobFileName : "";
const publicationFolder = safeFolderPattern.test(folderParam) ? folderParam : "";
const backgroundStorageKey = "publicationViewerBackground";
const backgroundThemes = new Set(["light", "warm", "dim", "dark"]);
const minZoom = 1;
const maxZoom = 2.8;
const zoomStep = 0.25;
let pageFlip;
let totalPages = 0;
let flipStateTimer;
let audioContext;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let panStart = null;

if (publicationFolder === "concept") {
  listLink.href = "/publikace/concept/";
  listLink.setAttribute("aria-label", "Zpět na seznam CONCEPT publikací");
}

const getAudioContext = () => {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  return audioContext;
};

const playPageTurnSound = () => {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    context.resume();
  }

  const duration = 0.34;
  const sampleCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < sampleCount; i += 1) {
    const progress = i / sampleCount;
    const envelope = Math.sin(progress * Math.PI) * (1 - progress * 0.35);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const source = context.createBufferSource();
  const bandpass = context.createBiquadFilter();
  const highpass = context.createBiquadFilter();
  const gain = context.createGain();
  const snap = context.createOscillator();
  const snapGain = context.createGain();
  const now = context.currentTime;

  source.buffer = buffer;
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1050, now);
  bandpass.frequency.exponentialRampToValueAtTime(2600, now + duration);
  bandpass.Q.value = 0.7;
  highpass.type = "highpass";
  highpass.frequency.value = 420;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.018, now + duration);

  snap.type = "triangle";
  snap.frequency.setValueAtTime(780, now + 0.21);
  snap.frequency.exponentialRampToValueAtTime(180, now + 0.31);
  snapGain.gain.setValueAtTime(0.0001, now + 0.19);
  snapGain.gain.exponentialRampToValueAtTime(0.035, now + 0.22);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

  source.connect(bandpass).connect(highpass).connect(gain).connect(context.destination);
  snap.connect(snapGain).connect(context.destination);
  source.start(now);
  source.stop(now + duration);
  snap.start(now + 0.19);
  snap.stop(now + 0.33);
};

const createBlankPage = (side) => {
  const pageEl = document.createElement("div");
  pageEl.className = `page page-blank page-blank-${side} page-${side}`;
  pageEl.setAttribute("aria-hidden", "true");
  return pageEl;
};

const setStatus = (message, progress = 0) => {
  loadingStatus.textContent = message;
  progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
};

const stripPdfSuffix = (fileName) => fileName.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");

const setBackgroundTheme = (theme) => {
  const nextTheme = backgroundThemes.has(theme) ? theme : "light";
  document.body.dataset.bgTheme = nextTheme;
  backgroundButtons.forEach((button) => {
    const isActive = button.dataset.bgTheme === nextTheme;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  localStorage.setItem(backgroundStorageKey, nextTheme);
};

const updateSpineMetrics = () => {
  window.requestAnimationFrame(() => {
    const pageHeights = [...bookEl.querySelectorAll(".page:not(.page-blank) img")]
      .map((image) => image.getBoundingClientRect().height)
      .filter((height) => height > 0);
    const pageHeight = Math.max(0, ...pageHeights);

    if (pageHeight > 0) {
      bookEl.style.setProperty("--spine-height", `${Math.round(pageHeight / zoomLevel)}px`);
    }
  });
};

const clampPan = () => {
  if (zoomLevel <= 1) {
    panX = 0;
    panY = 0;
    return;
  }

  const stageRect = stageEl.getBoundingClientRect();
  const bookRect = bookViewportEl.getBoundingClientRect();
  const extraX = Math.max(0, (bookRect.width - stageRect.width) / 2);
  const extraY = Math.max(0, (bookRect.height - stageRect.height) / 2);
  panX = Math.max(-extraX, Math.min(extraX, panX));
  panY = Math.max(-extraY, Math.min(extraY, panY));
};

const applyZoom = () => {
  clampPan();
  bookViewportEl.style.setProperty("--zoom", zoomLevel.toFixed(2));
  bookViewportEl.style.setProperty("--pan-x", `${Math.round(panX)}px`);
  bookViewportEl.style.setProperty("--pan-y", `${Math.round(panY)}px`);
  stageEl.classList.toggle("is-zoomed", zoomLevel > 1);
  zoomOutButton.disabled = zoomLevel <= minZoom;
  zoomInButton.disabled = zoomLevel >= maxZoom;
  zoomResetButton.textContent = `${Math.round(zoomLevel * 100)} %`;
  updateSpineMetrics();
};

const setZoom = (nextZoom, origin = null) => {
  const previousZoom = zoomLevel;
  const clampedZoom = Math.max(minZoom, Math.min(maxZoom, Number(nextZoom.toFixed(2))));
  if (clampedZoom === previousZoom) return;

  if (origin && previousZoom > 0) {
    panX = origin.x - ((origin.x - panX) * clampedZoom) / previousZoom;
    panY = origin.y - ((origin.y - panY) * clampedZoom) / previousZoom;
  }

  zoomLevel = clampedZoom;
  applyZoom();
};

const resetZoom = () => {
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  applyZoom();
};

const stagePoint = (event) => {
  const rect = stageEl.getBoundingClientRect();
  return {
    x: event.clientX - rect.left - rect.width / 2,
    y: event.clientY - rect.top - rect.height / 2
  };
};

const waitForPageFlip = async () => {
  for (let i = 0; i < 80; i += 1) {
    if (window.St?.PageFlip) return window.St.PageFlip;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error("Knihovna StPageFlip se nepodařila načíst.");
};

const getPageSize = (page) => {
  const viewport = page.getViewport({ scale: 1 });
  const maxLongSide = Math.min(1600, Math.max(window.innerWidth * 1.3, 900));
  const scale = maxLongSide / Math.max(viewport.width, viewport.height);
  return page.getViewport({ scale });
};

const renderPdfPages = async (pdf) => {
  const pages = [createBlankPage("left")];
  totalPages = pdf.numPages;

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    setStatus(`Vykresluji stránku ${pageNumber} z ${totalPages}...`, (pageNumber / totalPages) * 82);
    const page = await pdf.getPage(pageNumber);
    const viewport = getPageSize(page);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;

    const pageEl = document.createElement("div");
    const edgeClass =
      pageNumber === 2
        ? "page-edge-underlay-front"
        : totalPages > 2 && pageNumber === totalPages - 1
          ? "page-edge-underlay-back"
          : "";
    pageEl.className = `page ${pageNumber % 2 === 0 ? "page-left" : "page-right"} ${edgeClass}`.trim();
    pageEl.dataset.page = pageNumber;

    const image = document.createElement("img");
    image.alt = `Stránka ${pageNumber}`;
    image.decoding = "async";
    image.src = canvas.toDataURL("image/jpeg", 0.9);

    pageEl.append(image);
    pages.push(pageEl);
  }

  pages.push(createBlankPage("right"));

  return pages;
};

const updateCounter = () => {
  if (!pageFlip || totalPages === 0) return;
  const pageIndex = pageFlip.getCurrentPageIndex();
  const isLandscape = pageFlip.getOrientation() === "landscape";
  const firstVisiblePage = Math.max(1, Math.min(totalPages, pageIndex));
  const lastVisiblePage = isLandscape ? Math.max(1, Math.min(totalPages, pageIndex + 1)) : firstVisiblePage;
  const isSpread = isLandscape && firstVisiblePage !== lastVisiblePage;
  counterEl.textContent = isSpread ? `${firstVisiblePage}-${lastVisiblePage} / ${totalPages}` : `${firstVisiblePage} / ${totalPages}`;
  prevButton.disabled = pageIndex <= 0;
  nextButton.disabled = pageIndex >= totalPages;
  bookEl.classList.toggle("book-spread", isSpread);
  updateSpineMetrics();
};

const updateFlipState = ({ data: state } = {}) => {
  if (state === "read") {
    if (!flipStateTimer) {
      bookEl.classList.remove("book-flipping");
    }
  } else if (state) {
    bookEl.classList.add("book-flipping");
  }
  updateCounter();
};

const updateEdgeFlipState = (nextIndex, direction) => {
  const isFrontEdge = direction === "prev" && nextIndex <= 0;
  const isBackEdge = direction === "next" && nextIndex >= totalPages;

  bookEl.classList.toggle("book-edge-flip", isFrontEdge || isBackEdge);
  bookEl.classList.toggle("book-edge-front", isFrontEdge);
  bookEl.classList.toggle("book-edge-back", isBackEdge);
};

const startFlipState = (nextIndex, direction) => {
  window.clearTimeout(flipStateTimer);
  bookEl.classList.add("book-flipping");
  updateEdgeFlipState(nextIndex, direction);
  flipStateTimer = window.setTimeout(() => {
    bookEl.classList.remove("book-flipping");
    bookEl.classList.remove("book-edge-flip");
    bookEl.classList.remove("book-edge-front");
    bookEl.classList.remove("book-edge-back");
    flipStateTimer = null;
    updateCounter();
  }, 900);
};

const flipBy = (direction) => {
  if (!pageFlip) return;
  const currentIndex = pageFlip.getCurrentPageIndex();
  const pageStep = pageFlip.getOrientation() === "landscape" ? 2 : 1;
  const nextIndex = direction === "next" ? currentIndex + pageStep : currentIndex - pageStep;

  if (nextIndex < 0 || currentIndex >= totalPages && direction === "next") return;

  startFlipState(nextIndex, direction);
  playPageTurnSound();

  if (direction === "next") {
    pageFlip.flipNext();
  } else {
    pageFlip.flipPrev();
  }
};

const buildFlipbook = async (pages) => {
  const PageFlip = await waitForPageFlip();
  bookEl.replaceChildren(...pages);

  const firstImage = pages.find((page) => page.querySelector("img"))?.querySelector("img");
  const pageRatio = firstImage ? firstImage.naturalWidth / firstImage.naturalHeight : 0.707;

  pageFlip = new PageFlip(bookEl, {
    width: 520,
    height: Math.round(520 / pageRatio),
    size: "stretch",
    minWidth: 260,
    maxWidth: 760,
    minHeight: 360,
    maxHeight: 1080,
    maxShadowOpacity: 0.58,
    showCover: false,
    mobileScrollSupport: false,
    usePortrait: true,
    flippingTime: 750
  });

  pageFlip.loadFromHTML(pages);
  pageFlip.on("flip", updateCounter);
  pageFlip.on("changeState", updateFlipState);
  updateCounter();
  resetZoom();
};

const loadPublication = async () => {
  if (!publicationFile || (urlParam && !safeBlobUrl)) {
    throw new Error("Chybí nebo není platný parametr ?file=publikace.pdf.");
  }

  const displayTitle = stripPdfSuffix(publicationFile);
  document.title = `${displayTitle} | Publikace`;
  titleEl.textContent = displayTitle;

  const pdfPath = safeBlobUrl || (publicationFolder
    ? `/publikace/publications/${encodeURIComponent(publicationFolder)}/${encodeURIComponent(publicationFile)}`
    : `/publikace/publications/${encodeURIComponent(publicationFile)}`);
  setStatus("Načítám PDF...", 8);

  const loadingTask = pdfjsLib.getDocument({ url: pdfPath });

  loadingTask.onProgress = ({ loaded, total }) => {
    if (total) setStatus("Načítám PDF...", Math.min(22, (loaded / total) * 22));
  };

  const pdf = await loadingTask.promise;
  const pages = await renderPdfPages(pdf);
  setStatus("Skládám flipbook...", 92);
  await buildFlipbook(pages);
  loadingPanel.hidden = true;
  stageEl.classList.add("ready");
};

prevButton.addEventListener("click", () => flipBy("prev"));
nextButton.addEventListener("click", () => flipBy("next"));
zoomOutButton.addEventListener("click", () => setZoom(zoomLevel - zoomStep));
zoomInButton.addEventListener("click", () => setZoom(zoomLevel + zoomStep));
zoomResetButton.addEventListener("click", resetZoom);
backgroundButtons.forEach((button) => {
  button.addEventListener("click", () => setBackgroundTheme(button.dataset.bgTheme));
});

stageEl.addEventListener("wheel", (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const delta = event.deltaY < 0 ? zoomStep : -zoomStep;
  setZoom(zoomLevel + delta, stagePoint(event));
}, { passive: false });

stageEl.addEventListener("pointerdown", (event) => {
  if (zoomLevel <= 1 || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  panStart = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX,
    panY
  };
  stageEl.classList.add("is-panning");
  stageEl.setPointerCapture(event.pointerId);
}, true);

stageEl.addEventListener("pointermove", (event) => {
  if (!panStart || event.pointerId !== panStart.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  panX = panStart.panX + event.clientX - panStart.startX;
  panY = panStart.panY + event.clientY - panStart.startY;
  applyZoom();
}, true);

const stopPan = (event) => {
  if (!panStart || event.pointerId !== panStart.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  panStart = null;
  stageEl.classList.remove("is-panning");
};

stageEl.addEventListener("pointerup", stopPan, true);
stageEl.addEventListener("pointercancel", stopPan, true);

window.addEventListener("mousedown", (event) => {
  if (zoomLevel <= 1 || event.button !== 0 || panStart || !stageEl.contains(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  panStart = {
    pointerId: "mouse",
    startX: event.clientX,
    startY: event.clientY,
    panX,
    panY
  };
  stageEl.classList.add("is-panning");
}, true);

window.addEventListener("mousemove", (event) => {
  if (!panStart || panStart.pointerId !== "mouse") return;
  event.preventDefault();
  panX = panStart.panX + event.clientX - panStart.startX;
  panY = panStart.panY + event.clientY - panStart.startY;
  applyZoom();
});

window.addEventListener("mouseup", () => {
  if (!panStart || panStart.pointerId !== "mouse") return;
  panStart = null;
  stageEl.classList.remove("is-panning");
});

fullscreenButton.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    fullscreenButton.setAttribute("aria-label", "Ukončit celou obrazovku");
  } else {
    await document.exitFullscreen();
    fullscreenButton.setAttribute("aria-label", "Celá obrazovka");
  }
});

shareButton.addEventListener("click", async () => {
  const shareUrl = window.location.href;
  if (navigator.share) {
    await navigator.share({ title: document.title, url: shareUrl });
    return;
  }

  await navigator.clipboard.writeText(shareUrl);
  shareButton.classList.add("copied");
  shareButton.setAttribute("title", "Odkaz zkopírován");
  window.setTimeout(() => {
    shareButton.classList.remove("copied");
    shareButton.setAttribute("title", "Sdílet odkaz");
  }, 1600);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") flipBy("prev");
  if (event.key === "ArrowRight") flipBy("next");
  if ((event.key === "+" || event.key === "=") && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    setZoom(zoomLevel + zoomStep);
  }
  if (event.key === "-" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    setZoom(zoomLevel - zoomStep);
  }
  if (event.key === "0" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    resetZoom();
  }
});

window.addEventListener("resize", () => {
  window.clearTimeout(window.__pageFlipResizeTimer);
  window.__pageFlipResizeTimer = window.setTimeout(() => {
    pageFlip?.update();
    applyZoom();
  }, 150);
});

setBackgroundTheme(localStorage.getItem(backgroundStorageKey) || "light");

loadPublication().catch((error) => {
  titleEl.textContent = "Publikaci se nepodařilo načíst";
  setStatus(error.message, 100);
  loadingPanel.classList.add("error-panel");
  prevButton.disabled = true;
  nextButton.disabled = true;
});
