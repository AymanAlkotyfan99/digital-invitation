/* ================================================================
   THE SECRET GARDEN INVITATION
   All editable event content is kept in this object.
   Set rsvpEndpoint to a URL that accepts JSON when the final endpoint exists.
   ================================================================ */

const INVITATION_CONFIG = Object.freeze({
  groomName: "آدم", // [GROOM_NAME_AR]
  brideName: "ليان", // [BRIDE_NAME_AR]
  groomNameEn: "Adam", // [GROOM_NAME_EN]
  brideNameEn: "Layan", // [BRIDE_NAME_EN]
  eventTitle: "حكاية آدم وليان", // [EVENT_TITLE]
  eventDate: "2026-09-20T16:00:00+03:00", // [EVENT_DATE]
  eventDayNumber: "20",
  eventMonth: "أيلول",
  eventYear: "2026",
  eventDayName: "الأحد", // [EVENT_DAY]
  eventTime: "الرابعة مساءً", // [EVENT_TIME]
  finalDate: "20 · 09 · 2026",
  venueName: "حديقة الياسمين", // [VENUE_NAME]
  venueAddress: "دمشق، سوريا", // [VENUE_ADDRESS]
  googleMapsUrl: "https://maps.google.com/?q=Damascus%2C%20Syria", // [GOOGLE_MAPS_URL]
  invitationMessage: "بكل الحب، ندعوكم لتكونوا جزءاً من لحظةٍ سنحملها معنا إلى الأبد.", // [INVITATION_MESSAGE]
  rsvpEndpoint: "", // [RSVP_ENDPOINT] · empty uses a device-local graceful fallback
});

const appState = {
  gateOpened: false,
  enteredGarden: false,
  scratchCompleted: false,
  celebrationPlayed: false,
  rsvpSubmitting: false,
  reducedMotion: false,
};

const scratchState = {
  active: false,
  pointerId: null,
  lastPoint: null,
  currentStroke: null,
  strokes: [],
  moveCount: 0,
  lastProgressCheck: 0,
  lastAnnouncedProgress: 0,
  initialSamplePixels: 0,
  visual: null,
  sample: document.createElement("canvas"),
};

const gateTimers = new Set();
let countdownTimer = null;
let scrollFrame = 0;
let scratchResizeFrame = 0;
let confettiFrame = 0;

document.addEventListener("DOMContentLoaded", () => {
  initApp().catch(handleInitFailure);
}, { once: true });

async function initApp() {
  const loaderWasSeen = document.documentElement.classList.contains("loader-seen");
  const loader = document.getElementById("loader");

  if (loaderWasSeen) {
    document.body.classList.remove("is-loading");
    loader?.remove();
  } else {
    try {
      localStorage.setItem("secretGardenLoaderSeen:v1", "1");
    } catch (_) {}
  }

  document.body.classList.add("is-locked");
  document.documentElement.classList.add("is-locked");
  initReducedMotion();
  applyInvitationContent();
  initGate();
  initScrollAnimations();
  initInvitationReveal();
  initScratchHeart();
  initScrollEffects();
  initCountdown();
  initRSVP();

  document.body.classList.add("app-ready");
  await preloadCriticalAssets();

  if (!loaderWasSeen) {
    window.setTimeout(() => {
      document.body.classList.remove("is-loading");
      loader?.setAttribute("aria-hidden", "true");
      window.setTimeout(() => loader?.remove(), appState.reducedMotion ? 20 : 720);
    }, appState.reducedMotion ? 80 : 260);
  }
}

/* ----------------------------------------------------------------
   Content and core loading
   ---------------------------------------------------------------- */

function applyInvitationContent() {
  document.querySelectorAll("[data-content]").forEach((element) => {
    const key = element.dataset.content;
    if (Object.prototype.hasOwnProperty.call(INVITATION_CONFIG, key)) {
      element.textContent = INVITATION_CONFIG[key];
    }
  });

  document.title = INVITATION_CONFIG.eventTitle;
  const description = document.querySelector("meta[name='description']");
  if (description) {
    description.content = `دعوة رقمية تفاعلية إلى ${INVITATION_CONFIG.eventTitle} في الحديقة السرية.`;
  }

  const initials = `${firstCharacter(INVITATION_CONFIG.groomName)} · ${firstCharacter(INVITATION_CONFIG.brideName)}`;
  const envelopeSeal = document.querySelector(".envelope__emboss");
  if (envelopeSeal) envelopeSeal.dataset.initials = initials;

  const mapLink = document.getElementById("mapLink");
  if (mapLink && isHttpUrl(INVITATION_CONFIG.googleMapsUrl)) {
    mapLink.href = INVITATION_CONFIG.googleMapsUrl;
  }

  const eventDate = new Date(INVITATION_CONFIG.eventDate);
  if (!Number.isNaN(eventDate.getTime())) {
    document.querySelector(".date-flower")?.setAttribute(
      "aria-label",
      `${INVITATION_CONFIG.eventDayNumber} ${INVITATION_CONFIG.eventMonth} ${INVITATION_CONFIG.eventYear}`,
    );
    const dateParts = INVITATION_CONFIG.eventDate.match(/^(\d{4}-\d{2}-\d{2})T.*?(Z|[+-]\d{2}:\d{2})?$/);
    const calendarDate = dateParts?.[1] || INVITATION_CONFIG.eventDate.slice(0, 10);
    const timezone = dateParts?.[2] || "";
    const timelineTimes = ["16:00", "16:30", "17:00", "18:00"];

    document.querySelectorAll(".timeline-moment time").forEach((element, index) => {
      element.dateTime = `${calendarDate}T${timelineTimes[index] || "16:00"}:00${timezone}`;
    });

    const finalTime = document.querySelector(".ending-copy time");
    if (finalTime) finalTime.dateTime = calendarDate;
  }
}

function handleInitFailure() {
  document.body.classList.remove("is-loading", "is-locked");
  document.documentElement.classList.remove("is-locked");
  document.getElementById("loader")?.remove();
  setStoryInteractivity(true);
  revealSpiritualIntro();
}

async function preloadCriticalAssets() {
  const minimumDisplay = wait(360);
  const criticalImages = [
    "assets/images/secret-garden-hero.webp",
    "assets/images/real-garden-door.webp",
    "assets/images/floral-door-canopy.webp",
  ].map((source) => new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve; // CSS color layers keep the site usable if an asset is unavailable.
    image.src = source;
  }));

  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  const safetyTimeout = wait(1800);

  await Promise.all([
    minimumDisplay,
    Promise.race([Promise.allSettled([...criticalImages, fontsReady]), safetyTimeout]),
  ]);
}

/* ----------------------------------------------------------------
   Scene 01 · Gate opening and camera entry
   ---------------------------------------------------------------- */

function initGate() {
  const trigger = document.getElementById("gateTrigger");
  const skipLink = document.querySelector(".skip-link");

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  setStoryInteractivity(false);
  trigger?.addEventListener("click", openGate, { once: true });

  skipLink?.addEventListener("click", (event) => {
    if (appState.enteredGarden) return;

    event.preventDefault();
    document.body.classList.remove("is-loading");
    document.getElementById("loader")?.remove();
    appState.gateOpened = true;
    document.getElementById("gateScene")?.classList.add("is-opening", "is-camera-push");
    finishGateEntry({ focusGarden: false });

    const target = document.getElementById("invitationMessage");
    target?.scrollIntoView({ behavior: "auto", block: "start" });
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  });
}

function openGate() {
  if (appState.gateOpened) return;

  appState.gateOpened = true;
  const scene = document.getElementById("gateScene");
  const trigger = document.getElementById("gateTrigger");
  const status = document.getElementById("gateStatus");

  trigger?.setAttribute("disabled", "");
  trigger?.setAttribute("aria-disabled", "true");
  scene?.classList.add("is-opening");
  if (status) status.textContent = "تُفتح بوابة الحديقة الآن.";

  if (!appState.reducedMotion) {
    scheduleGateTask(() => scene?.classList.add("is-camera-push"), 560);
  }

  const entryDelay = appState.reducedMotion ? 620 : 1450;
  scheduleGateTask(() => finishGateEntry({ focusGarden: true }), entryDelay);
}

function finishGateEntry({ focusGarden }) {
  if (appState.enteredGarden) return;

  appState.enteredGarden = true;
  clearGateTimers();

  const scene = document.getElementById("gateScene");
  const status = document.getElementById("gateStatus");
  scene?.classList.add("is-entered");
  document.body.classList.remove("is-locked");
  document.documentElement.classList.remove("is-locked");
  setStoryInteractivity(true);
  revealSpiritualIntro();
  if (status) status.textContent = "فُتحت البوابة. أنتم الآن داخل الحديقة.";

  if (focusGarden) window.setTimeout(focusGardenArrival, 40);
}

function revealSpiritualIntro() {
  document.querySelector("[data-spiritual-intro]")?.classList.add("is-reading");
}

function focusGardenArrival() {
  const title = document.getElementById("gardenTitle");
  if (!title) return;
  title.setAttribute("tabindex", "-1");
  title.focus({ preventScroll: true });
}

function setStoryInteractivity(enabled) {
  document.querySelectorAll("main > .scene:not(#gateScene)").forEach((scene) => {
    scene.inert = !enabled;
    if (enabled) {
      scene.removeAttribute("aria-hidden");
    } else {
      scene.setAttribute("aria-hidden", "true");
    }
  });
}

function scheduleGateTask(callback, delay) {
  const timer = window.setTimeout(() => {
    gateTimers.delete(timer);
    callback();
  }, delay);
  gateTimers.add(timer);
}

function clearGateTimers() {
  gateTimers.forEach((timer) => window.clearTimeout(timer));
  gateTimers.clear();
}

/* ----------------------------------------------------------------
   Scroll-triggered scenes
   ---------------------------------------------------------------- */

function initScrollAnimations() {
  const revealElements = document.querySelectorAll("[data-reveal]");
  const momentElements = document.querySelectorAll(".timeline-moment");

  if (!("IntersectionObserver" in window)) {
    revealElements.forEach(showRevealElement);
    momentElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        showRevealElement(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
  );

  const momentObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.45, rootMargin: "0px 0px -12% 0px" },
  );

  revealElements.forEach((element) => revealObserver.observe(element));
  momentElements.forEach((element) => momentObserver.observe(element));
}

function showRevealElement(element) {
  element.classList.add("is-visible");
  element.closest(".scene")?.classList.add("has-visible-content");
}

function initInvitationReveal() {
  const letterStage = document.getElementById("letterStage");
  if (!letterStage) return;

  if (!("IntersectionObserver" in window)) {
    openInvitationLetter(letterStage);
    return;
  }

  const letterObserver = new IntersectionObserver(
    (entries, observer) => {
      const letterEntry = entries.find((entry) => entry.target === letterStage);
      if (!letterEntry?.isIntersecting) return;
      openInvitationLetter(letterStage);
      observer.disconnect();
    },
    { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
  );

  letterObserver.observe(letterStage);
}

function openInvitationLetter(letterStage) {
  if (letterStage.classList.contains("is-open")) return;
  letterStage.classList.add("is-open");

  const makeInteractive = () => {
    letterStage.classList.add("is-interactive");
    queueScratchResize();
  };

  const paper = letterStage.querySelector(".invitation-paper");
  paper?.addEventListener("transitionend", (event) => {
    if (event.propertyName === "transform") makeInteractive();
  }, { once: true });

  window.setTimeout(makeInteractive, appState.reducedMotion ? 80 : 2050);
}

function initScrollEffects() {
  const gardenStart = document.getElementById("gardenWalk");
  const parallaxLayers = [...document.querySelectorAll("[data-parallax]")];
  const timeline = document.getElementById("botanicalTimeline");
  const lowPowerDevice = Number(navigator.deviceMemory || 8) <= 3;

  const update = () => {
    scrollFrame = 0;

    if (!appState.reducedMotion && !lowPowerDevice && gardenStart) {
      const gardenRect = gardenStart.getBoundingClientRect();
      const travel = clamp(-gardenRect.top, -window.innerHeight, gardenRect.height);
      const approachProgress = clamp(
        -gardenRect.top / Math.max(window.innerHeight * 1.18, 1),
        0,
        1,
      );

      gardenStart.style.setProperty("--journey-scale", (1.34 + approachProgress * 0.1).toFixed(3));
      gardenStart.style.setProperty("--journey-y", `${(-2 - approachProgress * 2.4).toFixed(2)}%`);

      parallaxLayers.forEach((layer) => {
        const factor = Number(layer.dataset.parallax) || 0;
        layer.style.setProperty("--parallax-y", `${travel * factor}px`);
      });
    }

    if (timeline) {
      const rect = timeline.getBoundingClientRect();
      const start = window.innerHeight * 0.72;
      const progress = clamp((start - rect.top) / Math.max(rect.height * 0.9, 1), 0, 1);
      timeline.style.setProperty("--stem-progress", progress.toFixed(3));
    }
  };

  const requestUpdate = () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  requestUpdate();
}

/* ----------------------------------------------------------------
   Scene 04 · Canvas scratch heart
   ---------------------------------------------------------------- */

function initScratchHeart() {
  const canvas = document.getElementById("scratchCanvas");
  const accessReveal = document.getElementById("accessReveal");
  if (!canvas) return;

  scratchState.visual = canvas;
  resizeScratchSurface();

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(queueScratchResize);
    resizeObserver.observe(canvas);
  }
  window.addEventListener("resize", queueScratchResize, { passive: true });
  window.addEventListener("blur", cancelActiveScratch);

  if ("PointerEvent" in window) {
    canvas.addEventListener("pointerdown", handlePointerStart);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerEnd);
    canvas.addEventListener("pointercancel", handlePointerEnd);
    canvas.addEventListener("lostpointercapture", handleLostPointerCapture);
  } else {
    // iOS/legacy fallback kept explicit for touch and mouse input.
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
    canvas.addEventListener("mousedown", handleMouseStart);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseEnd);
  }

  accessReveal?.addEventListener("click", () => completeScratchReveal("accessible-button"));
}

function queueScratchResize() {
  if (scratchState.active) cancelActiveScratch();
  if (scratchResizeFrame) return;

  scratchResizeFrame = window.requestAnimationFrame(() => {
    scratchResizeFrame = 0;
    resizeScratchSurface();
  });
}

function resizeScratchSurface() {
  const canvas = scratchState.visual;
  if (!canvas || appState.scratchCompleted) return;

  const layoutWidth = canvas.clientWidth;
  const layoutHeight = canvas.clientHeight;
  if (layoutWidth < 2 || layoutHeight < 2) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(layoutWidth * dpr);
  canvas.height = Math.round(layoutHeight * dpr);

  const context = canvas.getContext("2d", { willReadFrequently: false });
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScratchCoating(context, layoutWidth, layoutHeight);

  const sampleWidth = 128;
  const sampleHeight = Math.round(sampleWidth * (layoutHeight / layoutWidth));
  scratchState.sample.width = sampleWidth;
  scratchState.sample.height = sampleHeight;
  const sampleContext = scratchState.sample.getContext("2d", { willReadFrequently: true });
  drawSampleHeart(sampleContext, sampleWidth, sampleHeight);
  scratchState.initialSamplePixels = countOpaqueSamplePixels(sampleContext, sampleWidth, sampleHeight);

  replayScratchStrokes(context, sampleContext, layoutWidth, layoutHeight, sampleWidth, sampleHeight);
  calculateScratchProgress(false);
}

function drawScratchCoating(context, width, height) {
  context.save();
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, width, height);
  traceHeartPath(context, width, height);
  context.clip();

  const coating = context.createLinearGradient(0, 0, width, height);
  coating.addColorStop(0, "#1c3426");
  coating.addColorStop(0.34, "#506b55");
  coating.addColorStop(0.68, "#a58a66");
  coating.addColorStop(1, "#203a2b");
  context.fillStyle = coating;
  context.fillRect(0, 0, width, height);

  const sheen = context.createRadialGradient(width * 0.34, height * 0.2, 1, width * 0.4, height * 0.3, width * 0.68);
  sheen.addColorStop(0, "rgba(255,239,205,0.46)");
  sheen.addColorStop(0.44, "rgba(221,198,153,0.08)");
  sheen.addColorStop(1, "rgba(4,18,10,0.28)");
  context.fillStyle = sheen;
  context.fillRect(0, 0, width, height);

  // Fine deterministic forest shimmer; it is redrawn only on resize.
  context.globalAlpha = 0.2;
  for (let index = 0; index < 90; index += 1) {
    const x = ((index * 47) % 97) / 97 * width;
    const y = ((index * 71) % 101) / 101 * height;
    const radius = 0.4 + (index % 3) * 0.35;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = index % 2 ? "#f1d9ad" : "#10271a";
    context.fill();
  }

  context.globalAlpha = 0.68;
  context.strokeStyle = "rgba(223,194,145,0.58)";
  context.lineWidth = 1.2;
  traceHeartPath(context, width * 0.88, height * 0.88, width * 0.06, height * 0.055);
  context.stroke();
  context.restore();
}

function drawSampleHeart(context, width, height) {
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  traceHeartPath(context, width, height);
  context.fill();
}

function traceHeartPath(context, width, height, offsetX = 0, offsetY = 0) {
  const w = width;
  const h = height;
  context.beginPath();
  context.moveTo(offsetX + w * 0.5, offsetY + h * 0.95);
  context.bezierCurveTo(offsetX + w * 0.42, offsetY + h * 0.87, offsetX + w * 0.055, offsetY + h * 0.65, offsetX + w * 0.055, offsetY + h * 0.35);
  context.bezierCurveTo(offsetX + w * 0.055, offsetY + h * 0.13, offsetX + w * 0.22, offsetY + h * 0.025, offsetX + w * 0.39, offsetY + h * 0.085);
  context.bezierCurveTo(offsetX + w * 0.445, offsetY + h * 0.105, offsetX + w * 0.48, offsetY + h * 0.15, offsetX + w * 0.5, offsetY + h * 0.205);
  context.bezierCurveTo(offsetX + w * 0.52, offsetY + h * 0.15, offsetX + w * 0.555, offsetY + h * 0.105, offsetX + w * 0.61, offsetY + h * 0.085);
  context.bezierCurveTo(offsetX + w * 0.78, offsetY + h * 0.025, offsetX + w * 0.945, offsetY + h * 0.13, offsetX + w * 0.945, offsetY + h * 0.35);
  context.bezierCurveTo(offsetX + w * 0.945, offsetY + h * 0.65, offsetX + w * 0.58, offsetY + h * 0.87, offsetX + w * 0.5, offsetY + h * 0.95);
  context.closePath();
}

function replayScratchStrokes(visualContext, sampleContext, visualWidth, visualHeight, sampleWidth, sampleHeight) {
  scratchState.strokes.forEach((stroke) => {
    if (stroke.length) {
      const firstPoint = stroke[0];
      const visualRadius = getBrushRadius(visualWidth);
      const sampleRadius = visualRadius * (sampleWidth / visualWidth);
      eraseInterpolated(
        visualContext,
        { x: firstPoint.x * visualWidth, y: firstPoint.y * visualHeight },
        { x: firstPoint.x * visualWidth, y: firstPoint.y * visualHeight },
        visualRadius,
      );
      eraseInterpolated(
        sampleContext,
        { x: firstPoint.x * sampleWidth, y: firstPoint.y * sampleHeight },
        { x: firstPoint.x * sampleWidth, y: firstPoint.y * sampleHeight },
        sampleRadius,
      );
    }

    for (let index = 1; index < stroke.length; index += 1) {
      const from = stroke[index - 1];
      const to = stroke[index];
      const visualRadius = getBrushRadius(visualWidth);
      const sampleRadius = visualRadius * (sampleWidth / visualWidth);

      eraseInterpolated(
        visualContext,
        { x: from.x * visualWidth, y: from.y * visualHeight },
        { x: to.x * visualWidth, y: to.y * visualHeight },
        visualRadius,
      );
      eraseInterpolated(
        sampleContext,
        { x: from.x * sampleWidth, y: from.y * sampleHeight },
        { x: to.x * sampleWidth, y: to.y * sampleHeight },
        sampleRadius,
      );
    }
  });
}

function handlePointerStart(event) {
  if (appState.scratchCompleted || scratchState.active || event.button > 0 || event.isPrimary === false) return;
  event.preventDefault();
  scratchState.visual?.setPointerCapture?.(event.pointerId);
  beginScratch(getCanvasPoint(event.clientX, event.clientY), event.pointerId);
}

function handlePointerMove(event) {
  if (!scratchState.active || scratchState.pointerId !== event.pointerId) return;
  if (event.pointerType === "mouse" && !(event.buttons & 1)) {
    endScratch();
    return;
  }
  event.preventDefault();
  continueScratch(getCanvasPoint(event.clientX, event.clientY), event.clientX, event.clientY);
}

function handlePointerEnd(event) {
  if (scratchState.pointerId !== event.pointerId) return;
  event.preventDefault();
  if (scratchState.visual?.hasPointerCapture?.(event.pointerId)) {
    scratchState.visual.releasePointerCapture(event.pointerId);
  }
  endScratch();
}

function handleLostPointerCapture(event) {
  if (scratchState.active && scratchState.pointerId === event.pointerId) endScratch();
}

function handleTouchStart(event) {
  if (appState.scratchCompleted || scratchState.active || !event.touches[0]) return;
  event.preventDefault();
  const touch = event.touches[0];
  beginScratch(getCanvasPoint(touch.clientX, touch.clientY), "touch");
}

function handleTouchMove(event) {
  if (!scratchState.active || !event.touches[0]) return;
  event.preventDefault();
  const touch = event.touches[0];
  continueScratch(getCanvasPoint(touch.clientX, touch.clientY), touch.clientX, touch.clientY);
}

function handleTouchEnd(event) {
  if (!scratchState.active) return;
  event.preventDefault();
  endScratch();
}

function handleMouseStart(event) {
  if (event.button !== 0 || appState.scratchCompleted || scratchState.active) return;
  event.preventDefault();
  beginScratch(getCanvasPoint(event.clientX, event.clientY), "mouse");
}

function handleMouseMove(event) {
  if (!scratchState.active || scratchState.pointerId !== "mouse") return;
  if (!(event.buttons & 1)) {
    endScratch();
    return;
  }
  event.preventDefault();
  continueScratch(getCanvasPoint(event.clientX, event.clientY), event.clientX, event.clientY);
}

function handleMouseEnd() {
  if (scratchState.pointerId === "mouse") endScratch();
}

function cancelActiveScratch() {
  if (!scratchState.active) return;
  scratchState.active = false;
  scratchState.pointerId = null;
  scratchState.lastPoint = null;
  scratchState.currentStroke = null;
  calculateScratchProgress(true);
}

function beginScratch(point, pointerId) {
  if (!point || appState.scratchCompleted) return;
  scratchState.active = true;
  scratchState.pointerId = pointerId;
  scratchState.lastPoint = point;
  scratchState.currentStroke = [normalisePoint(point)];
  scratchState.strokes.push(scratchState.currentStroke);

  drawScratchSegment(point, point);
}

function continueScratch(point, clientX, clientY) {
  if (!point || !scratchState.lastPoint || appState.scratchCompleted) return;

  drawScratchSegment(scratchState.lastPoint, point);
  scratchState.currentStroke?.push(normalisePoint(point));
  scratchState.lastPoint = point;
  scratchState.moveCount += 1;

  if (!appState.reducedMotion && scratchState.moveCount % 5 === 0) {
    createScratchSpeck(clientX, clientY);
  }

  const now = performance.now();
  if (scratchState.moveCount % 6 === 0 && now - scratchState.lastProgressCheck > 70) {
    scratchState.lastProgressCheck = now;
    calculateScratchProgress(true);
  }
}

function endScratch() {
  scratchState.active = false;
  scratchState.pointerId = null;
  scratchState.lastPoint = null;
  scratchState.currentStroke = null;
  calculateScratchProgress(true);
}

function drawScratchSegment(from, to) {
  const canvas = scratchState.visual;
  if (!canvas) return;

  const layoutWidth = canvas.clientWidth;
  const layoutHeight = canvas.clientHeight;
  const visualContext = canvas.getContext("2d");
  const sampleContext = scratchState.sample.getContext("2d", { willReadFrequently: true });
  if (!visualContext || !sampleContext || !layoutWidth || !layoutHeight) return;
  const visualRadius = getBrushRadius(layoutWidth);
  const sampleRadius = visualRadius * (scratchState.sample.width / layoutWidth);

  eraseInterpolated(visualContext, from, to, visualRadius);
  eraseInterpolated(
    sampleContext,
    { x: from.x * (scratchState.sample.width / layoutWidth), y: from.y * (scratchState.sample.height / layoutHeight) },
    { x: to.x * (scratchState.sample.width / layoutWidth), y: to.y * (scratchState.sample.height / layoutHeight) },
    sampleRadius,
  );
}

function eraseInterpolated(context, from, to, radius) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const stepSize = Math.max(radius * 0.42, 1);
  const steps = Math.max(1, Math.ceil(distance / stepSize));

  context.save();
  context.globalCompositeOperation = "destination-out";
  context.fillStyle = "rgba(0,0,0,1)";

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function calculateScratchProgress(allowCompletion = true) {
  if (appState.scratchCompleted || !scratchState.initialSamplePixels) return 1;

  const context = scratchState.sample.getContext("2d", { willReadFrequently: true });
  const remaining = countOpaqueSamplePixels(context, scratchState.sample.width, scratchState.sample.height);
  const removedRatio = clamp(1 - remaining / scratchState.initialSamplePixels, 0, 1);
  const percentage = Math.round(removedRatio * 100);

  if (percentage >= scratchState.lastAnnouncedProgress + 15) {
    scratchState.lastAnnouncedProgress = percentage;
    const progressNode = document.getElementById("scratchProgress");
    if (progressNode) progressNode.textContent = `كُشف ${percentage}٪ من القلب.`;
  }

  if (allowCompletion && removedRatio >= 0.6) {
    completeScratchReveal("scratch");
  }

  return removedRatio;
}

function countOpaqueSamplePixels(context, width, height) {
  const pixels = context.getImageData(0, 0, width, height).data;
  let opaquePixels = 0;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 20) opaquePixels += 1;
  }

  return opaquePixels;
}

function completeScratchReveal(source) {
  if (appState.scratchCompleted) return;

  appState.scratchCompleted = true;
  scratchState.active = false;
  scratchState.pointerId = null;

  const heart = document.getElementById("heartStage");
  const wrap = document.getElementById("scratchWrap");
  const names = document.getElementById("hiddenNames");
  const progress = document.getElementById("scratchProgress");
  const accessReveal = document.getElementById("accessReveal");

  heart?.classList.add("is-complete");
  wrap?.classList.add("is-complete");
  names?.setAttribute("aria-hidden", "false");
  accessReveal?.setAttribute("disabled", "");
  if (progress) progress.textContent = `اكتمل الكشف: ${INVITATION_CONFIG.groomName} و${INVITATION_CONFIG.brideName}.`;

  if (source === "scratch" && navigator.vibrate) {
    navigator.vibrate(8);
  }

  window.setTimeout(
    launchBouquetCelebration,
    appState.reducedMotion ? 80 : 430,
  );
}

function launchBouquetCelebration() {
  if (appState.celebrationPlayed) return;
  appState.celebrationPlayed = true;

  const celebration = document.getElementById("celebration");
  const screenCelebration = document.getElementById("screenCelebration");
  const finale = document.getElementById("namesFinale");
  const cue = document.getElementById("chapterCue");

  celebration?.classList.add("is-playing");

  if (appState.reducedMotion) {
    window.setTimeout(() => {
      finale?.setAttribute("aria-hidden", "false");
      finale?.classList.add("is-visible");
      cue?.setAttribute("tabindex", "0");
    }, 80);
    return;
  }

  screenCelebration?.classList.add("is-playing");

  window.setTimeout(() => {
    if (appState.reducedMotion) return;
    screenCelebration?.classList.add("is-popped");
    launchConfettiRain();
    navigator.vibrate?.([10, 34, 12]);
  }, 1000);

  window.setTimeout(() => {
    finale?.setAttribute("aria-hidden", "false");
    finale?.classList.add("is-visible");
    cue?.setAttribute("tabindex", "0");
  }, 1480);

  window.setTimeout(() => screenCelebration?.classList.remove("is-popped"), 3250);
  window.setTimeout(() => {
    screenCelebration?.classList.remove("is-playing");
    stopConfetti();
  }, 5700);
}

function createScratchSpeck(clientX, clientY) {
  if (document.querySelectorAll(".scratch-speck").length > 8) return;

  const speck = document.createElement("i");
  speck.className = "scratch-speck";
  speck.style.left = `${clientX}px`;
  speck.style.top = `${clientY}px`;
  speck.style.setProperty("--dx", `${randomBetween(-13, 13)}px`);
  speck.style.setProperty("--dy", `${randomBetween(-22, -7)}px`);
  document.body.appendChild(speck);
  speck.addEventListener("animationend", () => speck.remove(), { once: true });
}

function launchConfettiRain() {
  const canvas = document.getElementById("confettiCanvas");
  const layer = document.getElementById("screenCelebration");
  if (!canvas || !layer || appState.reducedMotion) return;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  if (confettiFrame) window.cancelAnimationFrame(confettiFrame);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const colors = ["#c9aa7c", "#b9797f", "#d6a8a5", "#516655", "#f8f2e8", "#7d93a1"];
  const compact = width < 640;
  const particles = [];
  const flashes = [...layer.querySelectorAll("[data-burst-origin]")];

  flashes.forEach((flash, originIndex) => {
    const rect = flash.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const amount = compact ? 25 : 36;

    for (let index = 0; index < amount; index += 1) {
      const angle = originIndex === 0
        ? randomBetween(-1.46, -0.3)
        : randomBetween(-2.84, -1.68);
      const speed = randomBetween(6.2, compact ? 11.5 : 14);
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: randomBetween(0.14, 0.22),
        drag: randomBetween(0.982, 0.993),
        width: randomBetween(4, 8),
        height: randomBetween(8, 15),
        rotation: randomBetween(0, Math.PI * 2),
        spin: randomBetween(-0.22, 0.22),
        phase: randomBetween(0, Math.PI * 2),
        delay: randomBetween(0, 9),
        age: 0,
        ttl: randomBetween(175, 245),
        color: colors[index % colors.length],
      });
    }
  });

  const rainAmount = compact ? 58 : 92;
  for (let index = 0; index < rainAmount; index += 1) {
    particles.push({
      x: randomBetween(-12, width + 12),
      y: randomBetween(-height * 0.72, -12),
      vx: randomBetween(-1.15, 1.15),
      vy: randomBetween(1.5, 3.2),
      gravity: randomBetween(0.025, 0.055),
      drag: randomBetween(0.992, 0.998),
      width: randomBetween(4, 8.5),
      height: randomBetween(8, 16),
      rotation: randomBetween(0, Math.PI * 2),
      spin: randomBetween(-0.17, 0.17),
      phase: randomBetween(0, Math.PI * 2),
      delay: randomBetween(0, 48),
      age: 0,
      ttl: randomBetween(250, 355),
      color: colors[index % colors.length],
    });
  }

  let previousTime = performance.now();
  const startTime = previousTime;

  const render = (time) => {
    const step = clamp((time - previousTime) / 16.67, 0.45, 2.2);
    previousTime = time;
    context.clearRect(0, 0, width, height);
    let activeParticles = 0;

    particles.forEach((particle) => {
      if (particle.delay > 0) {
        particle.delay -= step;
        activeParticles += 1;
        return;
      }

      particle.age += step;
      particle.vx *= Math.pow(particle.drag, step);
      particle.vy += particle.gravity * step;
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.rotation += particle.spin * step;

      if (particle.age >= particle.ttl || particle.y > height + 24) return;
      activeParticles += 1;

      const life = particle.age / particle.ttl;
      const opacity = life < 0.08 ? life / 0.08 : Math.min(1, (1 - life) / 0.16);
      const flutter = Math.max(0.18, Math.abs(Math.cos(particle.age * 0.12 + particle.phase)));
      context.save();
      context.globalAlpha = opacity * 0.94;
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.scale(flutter, 1);
      context.fillStyle = particle.color;
      context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
      context.restore();
    });

    if (activeParticles > 0 && time - startTime < 4700) {
      confettiFrame = window.requestAnimationFrame(render);
    } else {
      stopConfetti();
    }
  };

  confettiFrame = window.requestAnimationFrame(render);
}

function stopConfetti() {
  if (confettiFrame) window.cancelAnimationFrame(confettiFrame);
  confettiFrame = 0;
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;
  canvas.width = 1;
  canvas.height = 1;
}

function getCanvasPoint(clientX, clientY) {
  const canvas = scratchState.visual;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.clientWidth / Math.max(rect.width, 1);
  const scaleY = canvas.clientHeight / Math.max(rect.height, 1);
  return {
    x: clamp((clientX - rect.left) * scaleX, 0, canvas.clientWidth),
    y: clamp((clientY - rect.top) * scaleY, 0, canvas.clientHeight),
  };
}

function normalisePoint(point) {
  const width = scratchState.visual.clientWidth;
  const height = scratchState.visual.clientHeight;
  return {
    x: clamp(point.x / width, 0, 1),
    y: clamp(point.y / height, 0, 1),
  };
}

function getBrushRadius(width) {
  return clamp(width * 0.085, 22, 35);
}

/* ----------------------------------------------------------------
   Scene 08 · Date countdown
   ---------------------------------------------------------------- */

function initCountdown() {
  updateCountdown();
  countdownTimer = window.setInterval(updateCountdown, 60_000);
}

function updateCountdown() {
  const countdown = document.getElementById("countdown");
  if (!countdown) return;

  const eventTime = new Date(INVITATION_CONFIG.eventDate).getTime();
  if (Number.isNaN(eventTime)) {
    countdown.textContent = "سيُعلن موعد الحكاية قريباً.";
    if (countdownTimer) window.clearInterval(countdownTimer);
    return;
  }

  const difference = eventTime - Date.now();
  if (difference <= 0) {
    countdown.innerHTML = "<span>بدأ فصلنا الجميل</span><strong>والحديقة تضيء بوجودكم</strong>";
    if (countdownTimer) window.clearInterval(countdownTimer);
    return;
  }

  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;
  const days = Math.floor(difference / day);
  const hours = Math.floor((difference % day) / hour);
  const minutes = Math.floor((difference % hour) / minute);
  const number = new Intl.NumberFormat("ar", { minimumIntegerDigits: 2, useGrouping: false });

  countdown.innerHTML = `
    <span>بقي على حكايتنا</span>
    <strong>${number.format(days)} يوم · ${number.format(hours)} ساعة · ${number.format(minutes)} دقيقة</strong>
  `;
}

/* ----------------------------------------------------------------
   Scene 13 · RSVP
   ---------------------------------------------------------------- */

function initRSVP() {
  const form = document.getElementById("rsvpForm");
  const deliveryNote = document.getElementById("rsvpDeliveryNote");
  if (deliveryNote && !isHttpUrl(INVITATION_CONFIG.rsvpEndpoint)) {
    deliveryNote.hidden = false;
  }

  form?.addEventListener("submit", handleRSVPSubmission);

  form?.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => clearFieldError(field));
    field.addEventListener("change", () => clearFieldError(field));
  });
}

async function handleRSVPSubmission(event) {
  event.preventDefault();
  if (appState.rsvpSubmitting) return;

  const form = event.currentTarget;
  const validation = validateRSVP(form);
  if (!validation.valid) {
    validation.firstInvalid?.focus();
    return;
  }

  appState.rsvpSubmitting = true;
  form.setAttribute("aria-busy", "true");
  const submitButton = form.querySelector("button[type='submit']");
  const status = document.getElementById("formStatus");
  submitButton?.setAttribute("disabled", "");
  if (status) status.textContent = "نحفظ ردّكم بين صفحات الحكاية...";

  try {
    let localOnly = false;
    if (isHttpUrl(INVITATION_CONFIG.rsvpEndpoint)) {
      await sendRSVPToEndpoint(validation.payload);
    } else {
      await wait(appState.reducedMotion ? 80 : 620);
      if (!saveRSVPLocally(validation.payload)) {
        throw new Error("Local RSVP storage is unavailable");
      }
      localOnly = true;
    }

    showRSVPConfirmation(validation.payload.attendance, localOnly);
  } catch (error) {
    if (status) status.textContent = "تعذّر حفظ الرد الآن. بقي ما كتبتم في الحقول، حاولوا مرة أخرى بعد قليل.";
    submitButton?.removeAttribute("disabled");
  } finally {
    appState.rsvpSubmitting = false;
    form.removeAttribute("aria-busy");
  }
}

function validateRSVP(form) {
  clearAllFormErrors(form);

  const formData = new FormData(form);
  const nameField = form.elements.name;
  const countField = form.elements.guests;
  const attendanceField = form.querySelector("input[name='attendance']:checked");
  let firstInvalid = null;

  if (String(formData.get("name") || "").trim().length < 2) {
    setFieldError(nameField, "nameError", "اكتبوا الاسم الكامل من فضلكم.");
    firstInvalid = firstInvalid || nameField;
  }

  if (!formData.get("guests")) {
    setFieldError(countField, "countError", "اختاروا عدد الحضور.");
    firstInvalid = firstInvalid || countField;
  }

  if (!attendanceField) {
    const errorNode = document.getElementById("attendanceError");
    if (errorNode) errorNode.textContent = "اختاروا أحد الخيارين.";
    form.querySelectorAll("input[name='attendance']").forEach((radio) => {
      radio.setAttribute("aria-invalid", "true");
      radio.setAttribute("aria-describedby", "attendanceError");
    });
    firstInvalid = firstInvalid || form.querySelector("input[name='attendance']");
  }

  return {
    valid: !firstInvalid,
    firstInvalid,
    payload: {
      name: String(formData.get("name") || "").trim(),
      guests: Number(formData.get("guests")),
      attendance: String(formData.get("attendance") || ""),
      message: String(formData.get("message") || "").trim(),
      submittedAt: new Date().toISOString(),
      event: INVITATION_CONFIG.eventTitle,
    },
  };
}

async function sendRSVPToEndpoint(payload) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(INVITATION_CONFIG.rsvpEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`RSVP request failed with ${response.status}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

function saveRSVPLocally(payload) {
  try {
    localStorage.setItem("secretGardenRSVP", JSON.stringify(payload));
    return localStorage.getItem("secretGardenRSVP") !== null;
  } catch {
    return false;
  }
}

function showRSVPConfirmation(attendance, localOnly = false) {
  const form = document.getElementById("rsvpForm");
  const confirmation = document.getElementById("rsvpConfirmation");
  const heading = confirmation?.querySelector("h3");
  const copy = confirmation?.querySelector("p");

  if (localOnly) {
    if (heading) heading.textContent = "تم حفظ اختياركم على هذا الجهاز";
    if (copy) copy.textContent = "سيصبح الإرسال مباشراً عند ربط وسيلة استقبال الردود.";
  } else if (attendance === "no") {
    if (heading) heading.textContent = "وصلنا حبكم من بعيد";
    if (copy) copy.textContent = "وسيظل اسمكم جزءاً جميلاً من الحكاية.";
  }

  if (form) form.hidden = true;
  if (confirmation) confirmation.hidden = false;
}

function setFieldError(field, errorId, message) {
  field?.setAttribute("aria-invalid", "true");
  field?.setAttribute("aria-describedby", errorId);
  const errorNode = document.getElementById(errorId);
  if (errorNode) errorNode.textContent = message;
}

function clearFieldError(field) {
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");

  if (field.name === "name") document.getElementById("nameError").textContent = "";
  if (field.name === "guests") document.getElementById("countError").textContent = "";
  if (field.name === "attendance") {
    document.getElementById("attendanceError").textContent = "";
    field.form?.querySelectorAll("input[name='attendance']").forEach((radio) => {
      radio.removeAttribute("aria-invalid");
      radio.removeAttribute("aria-describedby");
    });
  }
}

function clearAllFormErrors(form) {
  form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  });
  form.querySelectorAll(".field-error").forEach((node) => { node.textContent = ""; });
}

/* ----------------------------------------------------------------
   Motion preferences and utilities
   ---------------------------------------------------------------- */

function initReducedMotion() {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const applyPreference = (matches) => {
    appState.reducedMotion = matches;
    document.body.classList.toggle("reduced-motion", matches);

    if (matches) {
      document.getElementById("screenCelebration")?.classList.remove("is-playing", "is-popped");
      stopConfetti();
    }

    if (matches && appState.gateOpened && !appState.enteredGarden) {
      finishGateEntry({ focusGarden: true });
    }
  };

  applyPreference(mediaQuery.matches);
  const onPreferenceChange = (event) => applyPreference(event.matches);
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onPreferenceChange);
  } else {
    mediaQuery.addListener?.(onPreferenceChange);
  }
}

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function randomBetween(minimum, maximum) {
  return Math.random() * (maximum - minimum) + minimum;
}

function firstCharacter(value) {
  return Array.from(String(value || "").trim())[0] || "•";
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
