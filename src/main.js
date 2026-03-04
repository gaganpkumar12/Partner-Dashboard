import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// ─── Convex Client ────────────────────────────────────────────
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL;

if (!CONVEX_URL) {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.innerHTML = '<p style="color:var(--red);font-size:14px;font-weight:500;">Error: VITE_CONVEX_URL not set. Run: npx convex dev</p>';
  throw new Error("VITE_CONVEX_URL is not set");
}

const client = new ConvexClient(CONVEX_URL);

// ─── Image Proxy ──────────────────────────────────────────────
function proxyImageUrl(url) {
  if (!url) return null;
  if (url.includes("creator.zoho") || url.startsWith("/api/")) {
    return `${CONVEX_SITE_URL}/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// ─── Video Player (lazy click-to-play) ────────────────────────
function renderVideoPlayer(container, rawUrl) {
  const proxied = proxyImageUrl(rawUrl);
  container.innerHTML = `
    <div class="video-section">
      <div class="video-player-wrapper" id="videoPlayerWrapper">
        <div class="video-poster" id="videoPoster" style="cursor:pointer">
          <div class="video-play-btn">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
          <div class="video-poster-label">Click to load &amp; play video</div>
        </div>
        <div class="video-loading-spinner" id="videoSpinner" style="display:none">
          <div class="loader" style="width:32px;height:32px;border-width:3px;"></div>
          <span style="font-size:12px;color:var(--text-muted);margin-top:8px;">Loading video...</span>
        </div>
        <video id="videoElement" controls preload="none" style="display:none;max-width:100%;max-height:300px;border-radius:var(--radius-md);background:#000;"></video>
      </div>
      <div style="margin-top:8px;"><a href="${proxied}" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Open in new tab
      </a></div>
    </div>`;

  const poster = container.querySelector("#videoPoster");
  const spinner = container.querySelector("#videoSpinner");
  const videoEl = container.querySelector("#videoElement");

  poster.addEventListener("click", () => {
    poster.style.display = "none";
    spinner.style.display = "flex";
    videoEl.src = proxied;
    videoEl.load();
  });

  videoEl.addEventListener("canplay", () => {
    spinner.style.display = "none";
    videoEl.style.display = "block";
    videoEl.play().catch(() => {});
  });

  videoEl.addEventListener("error", () => {
    spinner.style.display = "none";
    poster.style.display = "none";
    const wrapper = container.querySelector("#videoPlayerWrapper");
    if (wrapper) {
      wrapper.innerHTML = `<div class="gallery-empty" style="padding:24px;">
        <div style="font-size:14px;margin-bottom:8px;">⚠️ Video failed to load</div>
        <div style="font-size:11px;color:var(--text-muted);">Try opening in a new tab instead</div>
      </div>`;
    }
  });
}

// ─── State ────────────────────────────────────────────────────
// ─── POC (Point of Contact) → Partners Mapping ───────────────
const POC_MAP = {
  "Nilesh": ["Abdul Kalam","Alameen","Alameen old FHC","Aslam","ASLAM","Bilal","Hasan Charlie","Jamal","Kudus","Kuddus","Masum","Masum old","Munna","MUNNA","Rahim","Rana Khan","Sojib","Sohag Khan","BK-Riyazul","BK - Riyazul","BK-Rubel","BK - Rubel","Rishu","Quem","Maxwillam Narzary","Farhan Ahmed","Khobirul"],
  "Bishal": ["Dulal Khan","DULAL KHAN","Harun","Hasib","Hirak Mondal","Ibrahim","Maharaj","Mehadi Hasan","Ranjith","Salim 2","Salim","Umesh","Zamal Khan","BK-Babu Reddy","BK - Babu Reddy","Munir Khan BK","BK Rameez","BK - Rameez","Masum Howldar","Mijan New","Hasib Sheikh","Michu Laskar","Michu laskar","Saidul Babu"],
  "Vineet": ["Gouse","GOUSE","Mohammed Alamgir Mondal","ALAMGIR MONDAL","Bilal Mk","Md. Rajib","Mizan","Sahin","Sameer","Kausik Barman","Zakir Hussian","zakir hussain","BK-Beelal","BK - Beelal","BK-Forkan","BK - Forkan","Forkan","BK-Nasir Sheikh","BK - Nasir Sheikh","Vivek Painter","mukesh yadav","Sourav Painter","Pradumn Painter","Kumar Painter","Prem Shankar Painter","Anil","Bikas","Shamim Khan"],
  "Vishal Singh": ["Hasan New","Hirendra","Abir","Melon Rizwan","Nasir","NASIR KHAN","Rajibul","Ridoy","Sagar Khan","Sagar khan","Sujan","Usuf","Yunus Khan","BK-Rafikul","BK - Rafikul","Kohli","KOHLI"],
  "Mohith": ["MD Tuhin","Md Tuhin","Rofikul Islam","Abdur rahim","Abdur Rahim","Zakir","zakir","BK Naeem","BK - Naeem","Alameen New FHC","Alamin new FHC","Md. Raju","BK-Ebadul","BK - Ebadul","Sohel","Suman","Shiva","shiva","Jakir Hussian2","Alameen BK New","Alameen Bk New"]
};
const POC_NAMES = Object.keys(POC_MAP);

// Normalize partner names for robust POC matching (handles dashes, spaces, case, BK spacing)
function normalizeName(name) {
  let n = (name || "").toLowerCase();
  // Normalize unicode dashes to hyphen
  n = n.replace(/[\u2013\u2014\u2010\u2011\u2012]/g, "-");
  // Normalize "bk - ", "bk- ", "bk -" to "bk-" (handles BK spacing variants)
  n = n.replace(/\bbk\s*-\s*/g, "bk-");
  // Collapse spaces and trim
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

let allData = {};
let partners = [];
let currentFilter = "all";
let currentStatusFilter = null;
let currentPOCFilter = null; // null = all POCs
let dateFrom = null;
let dateTo = null;
let selectedPartners = new Set(); // empty = all
let partnerDropdownOpen = false;
let pocDropdownOpen = false;
let partnerStats = {}; // { partnerName: { bookings, reviews, estimates, photos, lunchVideos, eveningVideos, feedbackImages } }
let globalJobsByBookingId = {}; // { bookingZohoId: [job, ...] }

// ─── Lightbox State ───────────────────────────────────────────
let lightboxImages = [];
let lightboxIndex = 0;

// ─── Render Scheduling ───────────────────────────────────────
let renderRAF = null;
function scheduleRender() {
  if (renderRAF) return; // already scheduled
  renderRAF = requestAnimationFrame(() => {
    renderRAF = null;
    renderBoard();
  });
}

// ─── Subscriptions ────────────────────────────────────────────
function initSubscriptions() {
  client.onUpdate(api.bookings.getBookingsGrouped, {}, (data) => {
    if (!data) return;

    allData = data.grouped;
    partners = Object.keys(allData).filter((k) => k !== "_Unassigned");

    partners.sort((a, b) => {
      const aLen = allData[a]?.length || 0;
      const bLen = allData[b]?.length || 0;
      if (aLen === 0 && bLen > 0) return 1;
      if (aLen > 0 && bLen === 0) return -1;
      return a.localeCompare(b);
    });

    document.getElementById("totalBadge").textContent = `${data.total} Bookings`;
    document.getElementById("statusText").textContent =
      `Live | ${new Date().toLocaleTimeString()}`;
    document.getElementById("statusText").className = "status-dot success";
    document.getElementById("loadingOverlay").classList.add("hidden");
    document.getElementById("refreshBtn").disabled = false;

    buildPartnerDropdown();
    buildPOCDropdown();
    scheduleRender();
  });

  // Subscribe to partner stats
  client.onUpdate(api.bookings.getPartnerStats, {}, (data) => {
    if (!data) return;
    partnerStats = data;
    scheduleRender();
  });

  // Subscribe to all jobs for card amount display
  client.onUpdate(api.bookings.getAllJobs, {}, (allJobs) => {
    if (!allJobs) return;
    const map = {};
    for (const job of allJobs) {
      if (!job.bookingId) continue;
      if (!map[job.bookingId]) map[job.bookingId] = [];
      map[job.bookingId].push(job);
    }
    globalJobsByBookingId = map;
    scheduleRender();
  });

  client.onUpdate(api.bookings.getSyncStatus, {}, (status) => {
    if (!status) return;
    const el = document.getElementById("syncStatusText");
    if (!el) return;
    if (status.status === "syncing") {
      el.textContent = "Syncing from Zoho...";
      el.className = "sync-status syncing";
    } else if (status.status === "success") {
      const t = new Date(status.lastSyncTime).toLocaleTimeString();
      el.textContent = `Synced: ${t}`;
      el.className = "sync-status success";
    } else if (status.status === "error") {
      el.textContent = `Error: ${status.errorMessage || "Unknown"}`;
      el.className = "sync-status error";
    }
  });
}

// ─── Trigger Sync ─────────────────────────────────────────────
window.triggerSync = async function () {
  const btn = document.getElementById("refreshBtn");
  btn.disabled = true;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .7s linear infinite"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> Syncing...`;
  try {
    const result = await client.action(api.zohoSync.syncFromZoho, {});
    if (!result.success) alert("Sync failed: " + result.error);
  } catch (err) {
    alert("Sync error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> Sync`;
  }
};

// ─── Render Board ─────────────────────────────────────────────
function renderBoard() {
  const board = document.getElementById("board");
  const searchTerm = document.getElementById("searchBox").value.toLowerCase().trim();

  let filteredPartners = [...partners];

  // Search
  if (searchTerm) {
    filteredPartners = filteredPartners.filter((p) =>
      p.toLowerCase().includes(searchTerm)
    );
  }

  // View filter
  if (currentFilter === "has-records") {
    filteredPartners = filteredPartners.filter((p) => (allData[p]?.length || 0) > 0);
  } else if (currentFilter === "no-records") {
    filteredPartners = filteredPartners.filter((p) => (allData[p]?.length || 0) === 0);
  }

  // Partner multi-select filter
  if (selectedPartners.size > 0) {
    filteredPartners = filteredPartners.filter((p) => selectedPartners.has(p));
  }

  // POC filter
  if (currentPOCFilter) {
    const pocPartners = POC_MAP[currentPOCFilter] || [];
    const pocSet = new Set(pocPartners.map(n => normalizeName(n)));
    filteredPartners = filteredPartners.filter((p) => pocSet.has(normalizeName(p)));
  }

  // Build a map of what we need: partner -> filtered records
  const desiredColumns = new Map();
  filteredPartners.forEach((partner) => {
    let records = allData[partner] || [];

    // Status filter
    if (currentStatusFilter) {
      records = records.filter((r) => getStatusClass(r) === currentStatusFilter);
    }

    // Date filter
    if (dateFrom || dateTo) {
      records = records.filter((r) => {
        if (!r.addedTime) return false;
        const d = new Date(r.addedTime);
        if (isNaN(d.getTime())) return false;
        const dateStr = d.toISOString().split("T")[0];
        if (dateFrom && dateStr < dateFrom) return false;
        if (dateTo && dateStr > dateTo) return false;
        return true;
      });
    }

    desiredColumns.set(partner, records);
  });

  // Diff existing columns against desired
  const existingMap = new Map();
  for (const col of board.children) {
    if (col._partnerName) existingMap.set(col._partnerName, col);
  }

  // Remove columns that are no longer needed
  for (const [name, col] of existingMap) {
    if (!desiredColumns.has(name)) {
      col.remove();
    }
  }

  // Build new columns or update existing, in order
  const fragment = document.createDocumentFragment();
  for (const [partner, records] of desiredColumns) {
    let col = existingMap.get(partner);
    if (col) {
      // Update existing column in-place
      updateColumn(col, partner, records);
    } else {
      // Create new column
      col = createColumn(partner, records);
      col._partnerName = partner;
    }
    fragment.appendChild(col);
  }

  // Replace board content in a single reflow
  board.textContent = "";
  board.appendChild(fragment);
}

// ─── Partner Stats Badges ─────────────────────────────────────
function renderStatsBadges(partnerName) {
  // Case-insensitive lookup in partnerStats
  const s = partnerStats[partnerName] || Object.entries(partnerStats).find(
    ([k]) => k.toLowerCase() === partnerName.toLowerCase()
  )?.[1];
  if (!s) return '';

  const items = [
    { icon: '📋', label: 'Bookings', val: s.bookings },
    { icon: '⭐', label: 'Reviews', val: s.reviews },
    { icon: '💰', label: 'Estimates', val: s.estimates },
    { icon: '📷', label: 'Photos', val: s.photos },
    { icon: '☀️', label: 'Lunch Video', val: s.lunchVideos },
    { icon: '🌙', label: 'Evening Video', val: s.eveningVideos },
    { icon: '📝', label: 'Feedback', val: s.feedbackImages },
  ];

  return `<div class="stats-grid">${items.map(i =>
    `<span class="stat-item" title="${i.label}"><span class="stat-icon">${i.icon}</span><span class="stat-val${i.val === 0 ? ' zero' : ''}">${i.val}</span></span>`
  ).join('')}</div>`;
}

// ─── Create Column ────────────────────────────────────────────
function createColumn(partnerName, records) {
  const col = document.createElement("div");
  col.className = `column ${records.length === 0 ? "empty" : ""}`;
  col._partnerName = partnerName;
  col._recordCount = records.length;

  col.innerHTML = `
    <div class="column-header">
      <div class="column-header-top">
        <span class="partner-name" title="${partnerName}">${partnerName}</span>
        <span class="count-badge ${records.length === 0 ? "zero" : ""}">${records.length}</span>
      </div>
      ${renderStatsBadges(partnerName)}
    </div>
    <div class="column-body">
      ${records.length === 0 ? `<div class="no-records"><svg viewBox="0 0 24 24"><path d="M20 6H12L10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2z"/></svg>No bookings</div>` : ""}
    </div>
  `;

  const body = col.querySelector(".column-body");
  records.forEach((record, idx) => {
    const card = createCard(record);
    body.appendChild(card);
  });
  return col;
}

// ─── Update Column In-Place ───────────────────────────────────
function updateColumn(col, partnerName, records) {
  const prevCount = col._recordCount || 0;
  col._recordCount = records.length;

  // Update empty class
  col.className = `column ${records.length === 0 ? "empty" : ""}`;

  // Update count badge
  const badge = col.querySelector(".count-badge");
  if (badge) {
    badge.textContent = records.length;
    badge.className = `count-badge ${records.length === 0 ? "zero" : ""}`;
  }

  // Update stats badges
  const oldStats = col.querySelector(".stats-grid");
  if (oldStats) oldStats.remove();
  const header = col.querySelector(".column-header");
  if (header) {
    const temp = document.createElement("div");
    temp.innerHTML = renderStatsBadges(partnerName);
    const newStats = temp.firstElementChild;
    if (newStats) header.appendChild(newStats);
  }

  // If records count changed, rebuild body (fast path: skip if identical count)
  if (prevCount !== records.length) {
    const body = col.querySelector(".column-body");
    body.textContent = "";
    if (records.length === 0) {
      body.innerHTML = `<div class="no-records"><svg viewBox="0 0 24 24"><path d="M20 6H12L10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2z"/></svg>No bookings</div>`;
    } else {
      const frag = document.createDocumentFragment();
      records.forEach((record, idx) => {
        const card = createCard(record);
        frag.appendChild(card);
      });
      body.appendChild(frag);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function getStatusText(r) { return r.status || "Unknown"; }

function getStatusClass(r) {
  const s = (r.status || "").toLowerCase();
  if (s.includes("up") && s.includes("com")) return "upcoming";
  if (s.includes("progress") || s.includes("in pro")) return "work-in-progress";
  if (s.includes("finish") || s.includes("complet")) return "work-finished";
  if (s.includes("cancel")) return "work-cancelled";
  if (s.includes("send") && s.includes("before")) return "send-before";
  return "default-status";
}

function getCustomerInfo(r) {
  const note = r.adminNote || "";
  if (note) return note.replace(/\n/g, " ").replace(/\s+/g, " ").trim().substring(0, 120);
  return r.phoneNumber || "No details available";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.substring(0, 12);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  } catch { return ""; }
}

// ─── Create Card ──────────────────────────────────────────────
function createCard(record) {
  // Outer glow wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "card-glow-wrapper";

  const card = document.createElement("div");
  card.className = imgUrl ? "card shimmer-card" : "card";
  card.onclick = () => showModal(record);

  const statusText = getStatusText(record);
  const statusClass = getStatusClass(record);
  const info = getCustomerInfo(record);
  const dateStr = formatDate(record.addedTime);

  // Priority: Reached Selfie > Before Photos > Feedback
  const rawImgUrl =
    record.reachedSelfie?.[0] || record.beforePhotos?.[0] || record.feedbackImages?.[0] || null;
  const imgUrl = proxyImageUrl(rawImgUrl);

  const photoCount =
    (record.reachedSelfie?.length || 0) +
    (record.beforePhotos?.length || 0) +
    (record.feedbackImages?.length || 0);

  // Check if lunch video exists
  let hasLunchVideo = !!record.lunchCheckoutVideo;
  if (!hasLunchVideo && record.rawData) {
    try {
      const raw = JSON.parse(record.rawData);
      const lcv = raw.Lunch_Time_Check_Out_Video;
      if (lcv && typeof lcv === "string" && lcv.length > 0) hasLunchVideo = true;
    } catch {}
  }

  const displayStatus = statusText.length > 20 ? statusText.substring(0, 18) + "..." : statusText;

  const noImgSvg = `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
  const cameraSvg = `<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  const videoSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><polygon points="5,3 19,12 5,21"/></svg>`;

  card.innerHTML = `
    <div class="glass-distortion-layer"></div>
    <div class="glass-tint-layer"></div>
    <div class="glass-specular-layer"></div>
    <div class="card-image-wrapper">
      ${imgUrl
        ? `<img src="${imgUrl}" alt="Booking" loading="lazy" onload="this.closest('.card').classList.remove('shimmer-card')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';this.closest('.card').classList.remove('shimmer-card')">
           <div class="no-img" style="display:none">${noImgSvg}<span>Failed to load</span></div>`
        : `<div class="no-img">${noImgSvg}<span>No image available</span></div>`}
      ${photoCount > 0 ? `<div class="photo-badge">${cameraSvg} ${photoCount}</div>` : ""}
      ${hasLunchVideo ? `<div class="video-badge">${videoSvg} Video</div>` : ""}
    </div>
    <div class="card-body">
      <div class="card-status-row">
        <span class="status-pill ${statusClass}">${displayStatus}</span>
        <span class="card-date">${dateStr}</span>
      </div>
      <div class="card-details">${info}</div>
      ${(() => {
        const jobs = globalJobsByBookingId[record.zohoId] || [];
        let totalAmt = 0;
        const modes = [];
        jobs.forEach(j => {
          const a = parseFloat(j.amount);
          if (!isNaN(a)) totalAmt += a;
          if (j.paymentMode && j.paymentMode.trim()) modes.push(j.paymentMode.trim());
        });
        if (totalAmt > 0) {
          const modeStr = modes.length > 0 ? ` (${[...new Set(modes)].join(", ")})` : "";
          return `<div class="card-amount">₹${totalAmt.toLocaleString("en-IN")}${modeStr}</div>`;
        }
        return "";
      })()}
    </div>
  `;

  wrapper.appendChild(card);
  return wrapper;
}

// ─── Modal with Image Gallery ─────────────────────────────────
let currentModalRecord = null;
let currentGalleryTab = "reached";

function showModal(record) {
  currentModalRecord = record;
  const overlay = document.getElementById("modalOverlay");
  const content = document.getElementById("modalContent");
  const title = document.getElementById("modalTitle");
  const pillEl = document.getElementById("modalStatusPill");

  title.textContent = record.partnerName || "Booking Details";
  pillEl.textContent = record.status || "Unknown";
  pillEl.className = `status-pill ${getStatusClass(record)}`;

  const reachedPhotos = record.reachedSelfie || [];
  const beforePhotos = record.beforePhotos || [];
  const feedbackPhotos = record.feedbackImages || [];

  // Get lunch checkout video - from field or fallback to rawData
  let lunchVideoUrl = record.lunchCheckoutVideo || "";
  if (!lunchVideoUrl && record.rawData) {
    try {
      const raw = JSON.parse(record.rawData);
      const lcv = raw.Lunch_Time_Check_Out_Video;
      if (lcv && typeof lcv === "string" && lcv.length > 0) {
        lunchVideoUrl = lcv.startsWith("/api/") ? `https://creator.zoho.in${lcv}` : lcv;
      }
    } catch {}
  }
  const hasLunchVideo = !!lunchVideoUrl;
  // Store for use in renderGalleryTab
  record._lunchVideoUrl = lunchVideoUrl;
  const totalPhotos = reachedPhotos.length + beforePhotos.length + feedbackPhotos.length;

  // Determine default tab
  if (reachedPhotos.length > 0) currentGalleryTab = "reached";
  else if (beforePhotos.length > 0) currentGalleryTab = "before";
  else if (feedbackPhotos.length > 0) currentGalleryTab = "feedback";
  else if (hasLunchVideo) currentGalleryTab = "lunch-video";
  else currentGalleryTab = "reached";

  let html = "";

  // Gallery section
  if (totalPhotos > 0 || hasLunchVideo) {
    html += `
      <div class="gallery-tabs" id="bookingGalleryTabs">
        <div class="gallery-tab ${currentGalleryTab === "reached" ? "active" : ""}" data-tab="reached" onclick="switchGalleryTab('reached', this)">
          Reached Selfie <span class="tab-count">${reachedPhotos.length}</span>
        </div>
        <div class="gallery-tab ${currentGalleryTab === "before" ? "active" : ""}" data-tab="before" onclick="switchGalleryTab('before', this)">
          Before Photos <span class="tab-count">${beforePhotos.length}</span>
        </div>
        <div class="gallery-tab ${currentGalleryTab === "feedback" ? "active" : ""}" data-tab="feedback" onclick="switchGalleryTab('feedback', this)">
          Feedback <span class="tab-count">${feedbackPhotos.length}</span>
        </div>
        ${hasLunchVideo ? `<div class="gallery-tab ${currentGalleryTab === "lunch-video" ? "active" : ""}" data-tab="lunch-video" onclick="switchGalleryTab('lunch-video', this)">
          Lunch Video <span class="tab-count">1</span>
        </div>` : ""}
      </div>
      <div class="gallery-grid" id="galleryGrid"></div>
    `;
  }

  // Detail fields
  html += `<div class="detail-section">`;
  html += `<div class="detail-section-title">Booking Information</div>`;
  html += `<div class="detail-grid">`;

  const fields = [
    { label: "Status", value: record.status },
    { label: "Partner", value: record.partnerName },
    { label: "Phone", value: record.phoneNumber },
    { label: "Added", value: formatDate(record.addedTime) },
    { label: "Rating", value: record.rating },
  ];

  fields.forEach(({ label, value }) => {
    if (value) {
      html += `
        <div class="detail-item">
          <div class="detail-item-label">${label}</div>
          <div class="detail-item-value">${value}</div>
        </div>`;
    }
  });

  html += `</div>`; // close detail-grid

  if (record.adminNote) {
    html += `
      <div style="margin-top:16px;">
        <div class="detail-section-title">Admin Note</div>
        <div class="admin-note-block">${record.adminNote}</div>
      </div>`;
  }

  // Additional raw data
  if (record.rawData) {
    try {
      const raw = JSON.parse(record.rawData);
      const skipFields = [
        "ID", "Partner_Name", "Phone_Number", "Added_Time", "Rating",
        "Admin_Note", "Before_Photos", "Blueprint.Current_Stage",
        "Modified_User", "Modified_Location", "Reached_Selfie",
        "Feedback_Form_1_Image", "Lunch_Time_Check_Out_Video",
      ];
      const extraHtml = [];
      Object.entries(raw).forEach(([key, value]) => {
        if (skipFields.includes(key) || value === null || value === undefined || value === "") return;
        if (Array.isArray(value) && value.length === 0) return;
        if (typeof value === "object" && Object.keys(value).length === 0) return;
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        const displayValue = typeof value === "object" ? JSON.stringify(value, null, 2) : value;
        extraHtml.push(`
          <div class="detail-item">
            <div class="detail-item-label">${label}</div>
            <div class="detail-item-value">${displayValue}</div>
          </div>`);
      });
      if (extraHtml.length > 0) {
        html += `<div style="margin-top:16px;"><div class="detail-section-title">Additional Details</div><div class="detail-grid">${extraHtml.join("")}</div></div>`;
      }
    } catch {}
  }

  // Job details placeholder
  html += `<div id="jobDetailsSection"><div class="job-loading">Loading job details...</div></div>`;

  html += `</div>`; // close detail-section

  content.innerHTML = html;
  overlay.classList.remove("hidden");

  // Render gallery images
  if (totalPhotos > 0 || hasLunchVideo) renderGalleryTab();

  // Fetch and render job details
  loadJobDetails(record.zohoId);
}

function renderGalleryTab() {
  const record = currentModalRecord;
  if (!record) return;
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  // Handle video tab
  if (currentGalleryTab === "lunch-video") {
    const videoUrl = record._lunchVideoUrl || record.lunchCheckoutVideo;
    if (videoUrl) {
      renderVideoPlayer(grid, videoUrl);
    } else {
      grid.innerHTML = `<div class="gallery-empty">No video available</div>`;
    }
    return;
  }

  let photos = [];
  if (currentGalleryTab === "reached") photos = record.reachedSelfie || [];
  else if (currentGalleryTab === "before") photos = record.beforePhotos || [];
  else if (currentGalleryTab === "feedback") photos = record.feedbackImages || [];

  if (photos.length === 0) {
    grid.innerHTML = `<div class="gallery-empty">No images in this category</div>`;
    return;
  }

  const expandSvg = `<svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
  const brokenSvg = `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;

  grid.innerHTML = photos
    .map((url, i) => {
      const proxied = proxyImageUrl(url);
      return `
        <div class="gallery-thumb shimmer" onclick="openLightbox('${currentGalleryTab}', ${i})">
          <img src="${proxied}" alt="Photo ${i + 1}" loading="lazy" onload="this.closest('.gallery-thumb').classList.remove('shimmer')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';this.closest('.gallery-thumb').classList.remove('shimmer')">
          <div class="img-error-placeholder" style="display:none">${brokenSvg}<span>Load failed</span></div>
          <div class="thumb-overlay">${expandSvg}</div>
        </div>`;
    })
    .join("");
}

window.switchGalleryTab = function (tab, el) {
  currentGalleryTab = tab;
  document.querySelectorAll(".gallery-tab").forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderGalleryTab();
};

// ─── Job Details ──────────────────────────────────────────────
let currentJobData = null;

async function loadJobDetails(bookingZohoId) {
  const section = document.getElementById("jobDetailsSection");
  if (!section) return;

  try {
    const jobs = await client.query(api.bookings.getJobsByBookingId, { bookingId: bookingZohoId });

    if (!jobs || jobs.length === 0) {
      section.innerHTML = `<div class="no-job-data">No job data linked to this booking</div>`;
      currentJobData = null;
      return;
    }

    currentJobData = jobs;

    // Render each job
    let jobHtml = "";
    jobs.forEach((job, idx) => {
      const afterCount = job.afterPhotos?.length || 0;
      const paymentProofCount = job.paymentProofPhotos?.length || 0;
      const feedbackCount = job.feedbackImages?.length || 0;
      const reviewCount = job.googleReviewPhotos?.length || 0;
      const videoExists = !!job.eveningCheckoutVideo;
      const jobPhotoCount = afterCount + paymentProofCount + feedbackCount + reviewCount;

      jobHtml += `<div class="job-section">`;
      jobHtml += `<div class="job-section-header">
        <div class="job-section-icon">🔧</div>
        <div class="detail-section-title" style="margin-bottom:0">Job Details${jobs.length > 1 ? ` #${idx + 1}` : ""}</div>
      </div>`;

      // Job image gallery tabs
      if (jobPhotoCount > 0 || videoExists) {
        const defaultJobTab = afterCount > 0 ? "job-after" : paymentProofCount > 0 ? "job-proof" : "job-feedback2";
        jobHtml += `
          <div class="gallery-tabs">
            <div class="gallery-tab ${defaultJobTab === "job-after" ? "active" : ""}" data-tab="job-after" data-job-idx="${idx}" onclick="switchJobGalleryTab('job-after', ${idx}, this)">
              After Photos <span class="tab-count">${afterCount}</span>
            </div>
            <div class="gallery-tab ${defaultJobTab === "job-proof" ? "active" : ""}" data-tab="job-proof" data-job-idx="${idx}" onclick="switchJobGalleryTab('job-proof', ${idx}, this)">
              Payment Proof <span class="tab-count">${paymentProofCount}</span>
            </div>
            <div class="gallery-tab ${defaultJobTab === "job-feedback2" ? "active" : ""}" data-tab="job-feedback2" data-job-idx="${idx}" onclick="switchJobGalleryTab('job-feedback2', ${idx}, this)">
              Feedback 2 <span class="tab-count">${feedbackCount}</span>
            </div>
            ${reviewCount > 0 ? `<div class="gallery-tab" data-tab="job-review" data-job-idx="${idx}" onclick="switchJobGalleryTab('job-review', ${idx}, this)">
              Google Review <span class="tab-count">${reviewCount}</span>
            </div>` : ""}
            ${videoExists ? `<div class="gallery-tab" data-tab="job-video" data-job-idx="${idx}" onclick="switchJobGalleryTab('job-video', ${idx}, this)">
              Evening Video <span class="tab-count">1</span>
            </div>` : ""}
          </div>
          <div class="gallery-grid" id="jobGalleryGrid_${idx}"></div>
        `;
      }

      // Job detail fields
      jobHtml += `<div class="detail-grid" style="margin-top:12px;">`;

      if (job.amount) {
        jobHtml += `<div class="detail-item">
          <div class="detail-item-label">Amount</div>
          <div class="detail-item-value"><span class="job-amount">₹${parseFloat(job.amount).toLocaleString("en-IN")}</span></div>
        </div>`;
      }

      if (job.paymentMode) {
        jobHtml += `<div class="detail-item">
          <div class="detail-item-label">Payment Mode</div>
          <div class="detail-item-value"><span class="job-payment-mode">${job.paymentMode}</span></div>
        </div>`;
      }

      if (job.portalUsers) {
        jobHtml += `<div class="detail-item">
          <div class="detail-item-label">Portal User</div>
          <div class="detail-item-value">${job.portalUsers}</div>
        </div>`;
      }

      if (job.addedTime) {
        jobHtml += `<div class="detail-item">
          <div class="detail-item-label">Job Added</div>
          <div class="detail-item-value">${formatDate(job.addedTime)}</div>
        </div>`;
      }

      if (job.addedUser) {
        jobHtml += `<div class="detail-item">
          <div class="detail-item-label">Added By</div>
          <div class="detail-item-value">${job.addedUser}</div>
        </div>`;
      }

      jobHtml += `</div>`; // close detail-grid

      // Add-ons
      if (job.addOns) {
        const addons = job.addOns.split(";").map(a => a.trim()).filter(Boolean);
        if (addons.length > 0) {
          jobHtml += `<div style="margin-top:12px;">
            <div class="detail-section-title">Add-ons</div>
            <div class="addon-list">${addons.map(a => `<span class="addon-chip">${a}</span>`).join("")}</div>
          </div>`;
        }
      }

      // Admin Note
      if (job.adminNote) {
        jobHtml += `<div style="margin-top:12px;">
          <div class="detail-section-title">Job Admin Note</div>
          <div class="admin-note-block">${job.adminNote}</div>
        </div>`;
      }

      jobHtml += `</div>`; // close job-section
    });

    section.innerHTML = jobHtml;

    // Render default gallery for each job
    jobs.forEach((job, idx) => {
      const afterCount = job.afterPhotos?.length || 0;
      const paymentProofCount = job.paymentProofPhotos?.length || 0;
      const defaultTab = afterCount > 0 ? "job-after" : paymentProofCount > 0 ? "job-proof" : "job-feedback2";
      renderJobGallery(defaultTab, idx);
    });

  } catch (err) {
    console.error("Error loading job details:", err);
    section.innerHTML = `<div class="no-job-data">Failed to load job details</div>`;
  }
}

function renderJobGallery(tab, jobIdx) {
  if (!currentJobData || !currentJobData[jobIdx]) return;
  const job = currentJobData[jobIdx];
  const grid = document.getElementById(`jobGalleryGrid_${jobIdx}`);
  if (!grid) return;

  let photos = [];
  if (tab === "job-after") photos = job.afterPhotos || [];
  else if (tab === "job-proof") photos = job.paymentProofPhotos || [];
  else if (tab === "job-feedback2") photos = job.feedbackImages || [];
  else if (tab === "job-review") photos = job.googleReviewPhotos || [];
  else if (tab === "job-video") {
    if (job.eveningCheckoutVideo) {
      renderVideoPlayer(grid, job.eveningCheckoutVideo);
    } else {
      grid.innerHTML = `<div class="gallery-empty">No video available</div>`;
    }
    return;
  }

  if (photos.length === 0) {
    grid.innerHTML = `<div class="gallery-empty">No images in this category</div>`;
    return;
  }

  const expandSvg = `<svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
  const brokenSvg = `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;

  grid.innerHTML = photos
    .map((url, i) => {
      const proxied = proxyImageUrl(url);
      return `
        <div class="gallery-thumb shimmer" onclick="openJobLightbox(${jobIdx}, '${tab}', ${i})">
          <img src="${proxied}" alt="Photo ${i + 1}" loading="lazy" onload="this.closest('.gallery-thumb').classList.remove('shimmer')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';this.closest('.gallery-thumb').classList.remove('shimmer')">
          <div class="img-error-placeholder" style="display:none">${brokenSvg}<span>Load failed</span></div>
          <div class="thumb-overlay">${expandSvg}</div>
        </div>`;
    })
    .join("");
}

window.switchJobGalleryTab = function (tab, jobIdx, el) {
  // Deactivate sibling tabs
  const parent = el.parentElement;
  parent.querySelectorAll(".gallery-tab").forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderJobGallery(tab, jobIdx);
};

window.openJobLightbox = function (jobIdx, tab, index) {
  if (!currentJobData || !currentJobData[jobIdx]) return;
  const job = currentJobData[jobIdx];

  let photos = [];
  if (tab === "job-after") photos = job.afterPhotos || [];
  else if (tab === "job-proof") photos = job.paymentProofPhotos || [];
  else if (tab === "job-feedback2") photos = job.feedbackImages || [];
  else if (tab === "job-review") photos = job.googleReviewPhotos || [];

  lightboxImages = photos.map(proxyImageUrl);
  lightboxIndex = index;
  updateLightbox();
  document.getElementById("lightboxOverlay").classList.add("open");
};

// ─── Lightbox ─────────────────────────────────────────────────
window.openLightbox = function (category, index) {
  const record = currentModalRecord;
  if (!record) return;

  if (category === "reached") lightboxImages = (record.reachedSelfie || []).map(proxyImageUrl);
  else if (category === "before") lightboxImages = (record.beforePhotos || []).map(proxyImageUrl);
  else if (category === "feedback") lightboxImages = (record.feedbackImages || []).map(proxyImageUrl);

  lightboxIndex = index;
  updateLightbox();
  document.getElementById("lightboxOverlay").classList.add("open");
};

function updateLightbox() {
  document.getElementById("lightboxImg").src = lightboxImages[lightboxIndex] || "";
  document.getElementById("lightboxCounter").textContent =
    `${lightboxIndex + 1} / ${lightboxImages.length}`;
}

window.prevImage = function (e) {
  e.stopPropagation();
  lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
  updateLightbox();
};

window.nextImage = function (e) {
  e.stopPropagation();
  lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
  updateLightbox();
};

window.closeLightbox = function (e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById("lightboxOverlay").classList.remove("open");
};

// ─── Modal Close ──────────────────────────────────────────────
window.closeModal = function (event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById("modalOverlay").classList.add("hidden");
  currentModalRecord = null;
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const lb = document.getElementById("lightboxOverlay");
    if (lb.classList.contains("open")) {
      lb.classList.remove("open");
    } else {
      window.closeModal();
    }
  }
  if (document.getElementById("lightboxOverlay").classList.contains("open")) {
    if (e.key === "ArrowLeft") window.prevImage(e);
    if (e.key === "ArrowRight") window.nextImage(e);
  }
});

// ─── View Filter ──────────────────────────────────────────────
window.setFilter = function (filter, chip) {
  currentFilter = filter;
  document.querySelectorAll('.chip[data-filter="all"], .chip[data-filter="has-records"], .chip[data-filter="no-records"]')
    .forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  scheduleRender();
};

// ─── Status Filter ────────────────────────────────────────────
window.setStatusFilter = function (filter, chip) {
  if (currentStatusFilter === filter) {
    currentStatusFilter = null;
    chip.classList.remove("active");
  } else {
    document.querySelectorAll('.chip[data-filter="upcoming"], .chip[data-filter="work-in-progress"], .chip[data-filter="work-finished"], .chip[data-filter="send-before"], .chip[data-filter="work-cancelled"]')
      .forEach((c) => c.classList.remove("active"));
    currentStatusFilter = filter;
    chip.classList.add("active");
  }
  scheduleRender();
};

// ─── POC Filter Dropdown ──────────────────────────────────────
function buildPOCDropdown() {
  const list = document.getElementById("pocDropdownList");
  if (!list) return;

  list.innerHTML = `<div class="poc-option ${!currentPOCFilter ? 'active' : ''}" onclick="setPOCFilter(null)">
    <span class="poc-name">All POCs</span>
  </div>` + POC_NAMES.map(name => {
    const count = POC_MAP[name].length;
    return `<div class="poc-option ${currentPOCFilter === name ? 'active' : ''}" onclick="setPOCFilter('${name}')">
      <span class="poc-name">${name}</span>
      <span class="poc-count">${count}</span>
    </div>`;
  }).join("");
}

window.setPOCFilter = function (pocName) {
  currentPOCFilter = pocName;
  const trigger = document.getElementById("pocDropdownTrigger");
  const textEl = trigger.querySelector(".trigger-text");
  textEl.textContent = pocName || "All POCs";

  // Also reset partner filter when changing POC
  selectedPartners.clear();
  buildPartnerDropdown();
  buildPOCDropdown();

  // Close dropdown
  pocDropdownOpen = false;
  document.getElementById("pocDropdownPanel").classList.remove("open");
  trigger.classList.remove("open");

  scheduleRender();
};

window.togglePOCDropdown = function () {
  pocDropdownOpen = !pocDropdownOpen;
  const panel = document.getElementById("pocDropdownPanel");
  const trigger = document.getElementById("pocDropdownTrigger");
  if (pocDropdownOpen) {
    panel.classList.add("open");
    trigger.classList.add("open");
  } else {
    panel.classList.remove("open");
    trigger.classList.remove("open");
  }
};

// Close POC dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (pocDropdownOpen) {
    const wrapper = document.getElementById("pocDropdownWrapper");
    if (!wrapper.contains(e.target)) {
      pocDropdownOpen = false;
      document.getElementById("pocDropdownPanel").classList.remove("open");
      document.getElementById("pocDropdownTrigger").classList.remove("open");
    }
  }
});

// ─── Date Filter ──────────────────────────────────────────────
window.applyDateFilter = function () {
  dateFrom = document.getElementById("dateFrom").value || null;
  dateTo = document.getElementById("dateTo").value || null;
  document.getElementById("clearDatesBtn").style.display =
    dateFrom || dateTo ? "inline-block" : "none";
  scheduleRender();
};

window.clearDateFilter = function () {
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  dateFrom = null;
  dateTo = null;
  document.getElementById("clearDatesBtn").style.display = "none";
  scheduleRender();
};

// ─── Partner Multi-Select Dropdown ────────────────────────────
function buildPartnerDropdown() {
  const list = document.getElementById("partnerDropdownList");
  if (!list) return;

  const searchTerm = (document.getElementById("partnerSearchBox")?.value || "").toLowerCase();

  let filtered = partners.filter((p) =>
    p.toLowerCase().includes(searchTerm)
  );

  list.innerHTML = filtered
    .map((p) => {
      const count = allData[p]?.length || 0;
      const checked = selectedPartners.size === 0 || selectedPartners.has(p) ? "checked" : "";
      const safeName = p.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
      return `
        <label class="partner-option">
          <input type="checkbox" ${checked} data-partner="${safeName}" onchange="togglePartner(this.dataset.partner, this.checked)">
          <span class="p-name">${safeName}</span>
          <span class="p-count">${count}</span>
        </label>`;
    })
    .join("");

  updatePartnerTriggerText();
}

function updatePartnerTriggerText() {
  const trigger = document.getElementById("partnerDropdownTrigger");
  if (!trigger) return;
  const textEl = trigger.querySelector(".trigger-text");
  const countEl = trigger.querySelector(".trigger-count");

  if (selectedPartners.size === 0) {
    textEl.textContent = "All Partners";
    if (countEl) countEl.remove();
  } else {
    textEl.textContent =
      selectedPartners.size === 1
        ? [...selectedPartners][0]
        : `${selectedPartners.size} partners`;
    if (!trigger.querySelector(".trigger-count")) {
      const badge = document.createElement("span");
      badge.className = "trigger-count";
      badge.textContent = selectedPartners.size;
      trigger.insertBefore(badge, trigger.querySelector(".trigger-arrow"));
    } else {
      trigger.querySelector(".trigger-count").textContent = selectedPartners.size;
    }
  }
}

window.togglePartnerDropdown = function () {
  partnerDropdownOpen = !partnerDropdownOpen;
  const panel = document.getElementById("partnerDropdownPanel");
  const trigger = document.getElementById("partnerDropdownTrigger");
  if (partnerDropdownOpen) {
    panel.classList.add("open");
    trigger.classList.add("open");
    document.getElementById("partnerSearchBox").focus();
  } else {
    panel.classList.remove("open");
    trigger.classList.remove("open");
  }
};

window.togglePartner = function (name, checked) {
  if (checked) {
    // If nothing was selected before (= all), start fresh
    if (selectedPartners.size === 0) {
      selectedPartners = new Set([name]);
    } else {
      selectedPartners.add(name);
    }
    // If all are selected, reset to "all" state
    if (selectedPartners.size >= partners.length) {
      selectedPartners.clear();
    }
  } else {
    if (selectedPartners.size === 0) {
      // Going from "all" to "all minus one"
      selectedPartners = new Set(partners.filter((p) => p !== name));
    } else {
      selectedPartners.delete(name);
      if (selectedPartners.size === 0) {
        // If nothing selected, means none — keep at least show empty
      }
    }
  }
  updatePartnerTriggerText();
  scheduleRender();
};

window.selectAllPartners = function () {
  selectedPartners.clear();
  buildPartnerDropdown();
  scheduleRender();
};

window.deselectAllPartners = function () {
  selectedPartners = new Set(["__none__"]); // sentinel to show none
  buildPartnerDropdown();
  scheduleRender();
};

window.filterPartnerOptions = function () {
  buildPartnerDropdown();
};

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (partnerDropdownOpen) {
    const wrapper = document.getElementById("partnerDropdownWrapper");
    if (!wrapper.contains(e.target)) {
      partnerDropdownOpen = false;
      document.getElementById("partnerDropdownPanel").classList.remove("open");
      document.getElementById("partnerDropdownTrigger").classList.remove("open");
    }
  }
});

// ─── Search ───────────────────────────────────────────────────
window.filterPartners = function () {
  scheduleRender();
};

// ─── CSV Export (Partner Summary) ─────────────────────────────
window.exportCSV = async function () {
  const btn = document.getElementById("exportBtn");
  btn.disabled = true;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .7s linear infinite"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> Exporting...`;

  try {
    const searchTerm = document.getElementById("searchBox").value.toLowerCase().trim();

    let filteredPartners = [...partners];
    if (searchTerm) {
      filteredPartners = filteredPartners.filter((p) => p.toLowerCase().includes(searchTerm));
    }
    if (currentFilter === "has-records") {
      filteredPartners = filteredPartners.filter((p) => (allData[p]?.length || 0) > 0);
    } else if (currentFilter === "no-records") {
      filteredPartners = filteredPartners.filter((p) => (allData[p]?.length || 0) === 0);
    }
    if (selectedPartners.size > 0) {
      filteredPartners = filteredPartners.filter((p) => selectedPartners.has(p));
    }
    if (currentPOCFilter) {
      const pocPartners = POC_MAP[currentPOCFilter] || [];
      const pocSet = new Set(pocPartners.map(n => normalizeName(n)));
      filteredPartners = filteredPartners.filter((p) => pocSet.has(normalizeName(p)));
    }

    // Only partners with bookings
    filteredPartners = filteredPartners.filter((p) => (allData[p]?.length || 0) > 0);

    if (filteredPartners.length === 0) {
      alert("No partners to export with current filters.");
      return;
    }

    // Fetch ALL jobs in one query and group by bookingId
    const jobsByBookingId = {};
    try {
      const allJobs = await client.query(api.bookings.getAllJobs, {});
      if (allJobs && allJobs.length > 0) {
        for (const job of allJobs) {
          if (!job.bookingId) continue;
          if (!jobsByBookingId[job.bookingId]) jobsByBookingId[job.bookingId] = [];
          jobsByBookingId[job.bookingId].push(job);
        }
      }
      console.log(`[CSV Export] Fetched ${allJobs?.length || 0} jobs`);
    } catch (err) {
      console.error("[CSV Export] Failed to fetch jobs:", err);
    }

    function escapeCSV(val) {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    // Build partner summary — one row per partner
    const headers = [
      "Partner Name",
      "Count of Bookings",
      "Total Amount (Payment Mode)",
      "Count of Review Photos",
      "Count of Estimate",
      "Count of Reach Selfie",
      "Count of Before Photo",
      "Count of After Photo",
      "Count of Lunch Time Video",
      "Count of Evening Time Video",
      "Count of Feedback Images",
      "Count of Work Finished"
    ];

    let csv = headers.map(escapeCSV).join(",") + "\n";

    let totalBookings = 0, totalReviews = 0, totalEstimates = 0;
    let totalReachSelfie = 0, totalBeforePhoto = 0, totalAfterPhoto = 0;
    let totalLunch = 0, totalEvening = 0, totalFeedback = 0, totalWorkFinished = 0;
    let grandTotalAmount = 0;

    filteredPartners.forEach((partner) => {
      let records = allData[partner] || [];

      if (currentStatusFilter) {
        records = records.filter((r) => getStatusClass(r) === currentStatusFilter);
      }
      if (dateFrom || dateTo) {
        records = records.filter((r) => {
          if (!r.addedTime) return false;
          const d = new Date(r.addedTime);
          if (isNaN(d.getTime())) return false;
          const dateStr = d.toISOString().split("T")[0];
          if (dateFrom && dateStr < dateFrom) return false;
          if (dateTo && dateStr > dateTo) return false;
          return true;
        });
      }
      // Exclude cancelled bookings from the count
      records = records.filter((r) => getStatusClass(r) !== "work-cancelled");
      if (records.length === 0) return;

      let countBookings = records.length;
      let countLunchVideo = 0;
      let countReachSelfie = 0;
      let countBeforePhoto = 0;
      let countWorkFinished = 0;
      const partnerJobs = [];

      records.forEach((r) => {
        let hasLunch = !!r.lunchCheckoutVideo;
        if (!hasLunch && r.rawData) {
          try {
            const raw = JSON.parse(r.rawData);
            const lcv = raw.Lunch_Time_Check_Out_Video;
            if (lcv && typeof lcv === "string" && lcv.length > 0) hasLunch = true;
          } catch {}
        }
        if (hasLunch) countLunchVideo++;
        if (r.reachedSelfie && r.reachedSelfie.length > 0) countReachSelfie++;
        if (r.beforePhotos && r.beforePhotos.length > 0) countBeforePhoto++;
        if (getStatusClass(r) === "work-finished") countWorkFinished++;
        const jobs = jobsByBookingId[r.zohoId] || [];
        partnerJobs.push(...jobs);
      });

      let countReviews = 0, countEstimates = 0, countAfterPhoto = 0;
      let countEvening = 0, countFeedback = 0;
      let partnerAmount = 0;
      const paymentModes = {};
      partnerJobs.forEach((job) => {
        if (job.googleReviewPhotos && job.googleReviewPhotos.length > 0) countReviews++;
        if (job.amount && job.amount.trim() !== "" && job.amount !== "0") countEstimates++;
        if (job.afterPhotos && job.afterPhotos.length > 0) countAfterPhoto++;
        if (job.eveningCheckoutVideo) countEvening++;
        if (job.feedbackImages && job.feedbackImages.length > 0) countFeedback++;
        // Accumulate amount and payment mode
        const amt = parseFloat(job.amount);
        if (!isNaN(amt)) partnerAmount += amt;
        if (job.paymentMode && job.paymentMode.trim() !== "") {
          const mode = job.paymentMode.trim();
          paymentModes[mode] = (paymentModes[mode] || 0) + 1;
        }
      });
      const modesStr = Object.keys(paymentModes).length > 0
        ? " (" + Object.entries(paymentModes).map(([m, c]) => c > 1 ? `${m} x${c}` : m).join(", ") + ")"
        : "";
      const amountDisplay = partnerAmount > 0 ? partnerAmount.toFixed(2) + modesStr : "0";

      totalBookings += countBookings;
      grandTotalAmount += partnerAmount;
      totalReviews += countReviews;
      totalEstimates += countEstimates;
      totalReachSelfie += countReachSelfie;
      totalBeforePhoto += countBeforePhoto;
      totalAfterPhoto += countAfterPhoto;
      totalLunch += countLunchVideo;
      totalEvening += countEvening;
      totalFeedback += countFeedback;
      totalWorkFinished += countWorkFinished;

      csv += [partner, countBookings, amountDisplay, countReviews, countEstimates, countReachSelfie, countBeforePhoto, countAfterPhoto, countLunchVideo, countEvening, countFeedback, countWorkFinished].map(escapeCSV).join(",") + "\n";
    });

    // Grand Total row
    csv += ["Grand Total", totalBookings, grandTotalAmount > 0 ? grandTotalAmount.toFixed(2) : "0", totalReviews, totalEstimates, totalReachSelfie, totalBeforePhoto, totalAfterPhoto, totalLunch, totalEvening, totalFeedback, totalWorkFinished].map(escapeCSV).join(",") + "\n";

    // Download
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    a.download = `partner_summary_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Export error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export CSV`;
  }
};

// ─── Dark Mode (Animated Pill Toggle) ─────────────────────────
function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  // The toggle animates via CSS attribute selectors on [data-theme]
  // Swap which thumb holds moon vs sun
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;
  const thumbs = toggle.querySelectorAll(".theme-toggle-thumb");
  if (thumbs.length < 2) return;
  const [first, second] = thumbs;
  if (dark) {
    // Moon active (left), Sun inactive (right)
    first.innerHTML = `<svg class="theme-toggle-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    second.innerHTML = `<svg class="theme-toggle-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  } else {
    // Moon inactive (left), Sun active (right)
    first.innerHTML = `<svg class="theme-toggle-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    second.innerHTML = `<svg class="theme-toggle-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  }
}

window.toggleDarkMode = function () {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = !isDark;
  localStorage.setItem("theme", next ? "dark" : "light");
  applyTheme(next);
};

// Restore saved theme or respect system preference
(function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) {
    applyTheme(saved === "dark");
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyTheme(true);
  }
})();



// ─── Magnetize Particles (Export Button) ──────────────────────
(function initMagnetizeParticles() {
  const container = document.getElementById("magnetizeParticles");
  if (!container) return;

  const PARTICLE_COUNT = 14;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const dot = document.createElement("div");
    dot.className = "magnetize-particle";
    // Random scatter positions around the button
    const x = (Math.random() - 0.5) * 160;
    const y = (Math.random() - 0.5) * 120;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    dot.dataset.homeX = String(x);
    dot.dataset.homeY = String(y);
    container.appendChild(dot);
    particles.push(dot);
  }

  // On mouseenter, CSS handles attraction via :hover selector
  // On mouseleave, restore scattered positions
  const btn = container.closest(".btn-export");
  if (!btn) return;

  btn.addEventListener("mouseleave", () => {
    particles.forEach((dot) => {
      dot.style.transform = `translate(${dot.dataset.homeX}px, ${dot.dataset.homeY}px)`;
    });
  });
})();

// ─── Init ─────────────────────────────────────────────────────
initSubscriptions();
