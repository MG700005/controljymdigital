const STORAGE_KEY = "cliente-registros-v1";

const recordForm = document.getElementById("recordForm");
const whatsappInput = document.getElementById("whatsappInput");
const emprendimientoInput = document.getElementById("emprendimientoInput");
const notesInput = document.getElementById("notesInput");
const formError = document.getElementById("formError");
const formSuccess = document.getElementById("formSuccess");
const recordsContainer = document.getElementById("records");
const emptyState = document.getElementById("emptyState");
const filterInfo = document.getElementById("filterInfo");
const recordTemplate = document.getElementById("recordTemplate");
const portfolioList = document.getElementById("portfolioList");
const portfolioEmpty = document.getElementById("portfolioEmpty");

const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const filterPreview = document.getElementById("filterPreview");
const filterCaducado = document.getElementById("filterCaducado");
const filterPago = document.getElementById("filterPago");
const exportCsv = document.getElementById("exportCsv");
const importCsv = document.getElementById("importCsv");
const resetFilters = document.getElementById("resetFilters");

const statTotal = document.getElementById("statTotal");
const statPreview = document.getElementById("statPreview");
const statCaducado = document.getElementById("statCaducado");
const statPago = document.getElementById("statPago");

const state = {
  records: loadRecords(),
  filters: {
    search: "",
    preview: "all",
    caducado: "all",
    pago: "all",
  },
  sort: "recent",
  editingId: null,
};

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((record) => ({
      ...record,
      emprendimiento: record.emprendimiento || "",
      link: record.link || "",
      notes: record.notes || "",
    }));
  } catch (error) {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sanitizeNumber(value) {
  return value.replace(/[^+\d\s]/g, "").trim();
}

function validateNumber(value) {
  return /^\+?[\d\s]{6,20}$/.test(value);
}

function sanitizeNotes(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

function sanitizeEmprendimiento(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

function sanitizeLink(value) {
  const cleaned = value.trim();
  if (!cleaned) {
    return "";
  }
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  return `https://${cleaned}`;
}

function getId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function setFormError(message) {
  formError.textContent = message;
}

let successTimer = null;

function setFormSuccess(message) {
  if (successTimer) {
    clearTimeout(successTimer);
  }
  formSuccess.textContent = message;
  if (message) {
    successTimer = setTimeout(() => {
      formSuccess.textContent = "";
    }, 2200);
  }
}

function setStats() {
  const total = state.records.length;
  const previewPendiente = state.records.filter((record) => !record.previewEnviado).length;
  const caducados = state.records.filter((record) => record.periodoCaducado).length;
  const pagos = state.records.filter((record) => record.pagoEfectuado).length;

  statTotal.textContent = total;
  statPreview.textContent = previewPendiente;
  statCaducado.textContent = caducados;
  statPago.textContent = pagos;
}

function matchesFilter(value, filter) {
  if (filter === "all") {
    return true;
  }
  return filter === "yes" ? value === true : value === false;
}

function isFilteringActive() {
  return (
    state.filters.search ||
    state.filters.preview !== "all" ||
    state.filters.caducado !== "all" ||
    state.filters.pago !== "all" ||
    state.sort !== "recent"
  );
}

function sortRecords(records) {
  const sorted = [...records];
  const sortKey = state.sort;

  if (sortKey === "oldest") {
    return sorted.sort((a, b) => a.createdAt - b.createdAt);
  }

  if (sortKey === "caducado") {
    return sorted.sort((a, b) => {
      if (a.periodoCaducado !== b.periodoCaducado) {
        return a.periodoCaducado ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });
  }

  if (sortKey === "pago") {
    return sorted.sort((a, b) => {
      if (a.pagoEfectuado !== b.pagoEfectuado) {
        return a.pagoEfectuado ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });
  }

  if (sortKey === "preview") {
    return sorted.sort((a, b) => {
      if (a.previewEnviado !== b.previewEnviado) {
        return a.previewEnviado ? 1 : -1;
      }
      return b.createdAt - a.createdAt;
    });
  }

  return sorted.sort((a, b) => b.createdAt - a.createdAt);
}

function getVisibleRecords() {
  const search = state.filters.search.toLowerCase();
  const filtered = state.records.filter((record) => {
    const matchesSearch =
      !search ||
      record.whatsapp.toLowerCase().includes(search) ||
      (record.emprendimiento || "").toLowerCase().includes(search) ||
      (record.link || "").toLowerCase().includes(search) ||
      (record.notes || "").toLowerCase().includes(search);

    return (
      matchesSearch &&
      matchesFilter(record.previewEnviado, state.filters.preview) &&
      matchesFilter(record.periodoCaducado, state.filters.caducado) &&
      matchesFilter(record.pagoEfectuado, state.filters.pago)
    );
  });

  return sortRecords(filtered);
}

function updateFilterInfo(visibleCount) {
  if (!state.records.length) {
    filterInfo.textContent = "";
    return;
  }

  if (isFilteringActive()) {
    filterInfo.textContent = `Mostrando ${visibleCount} de ${state.records.length}`;
  } else {
    filterInfo.textContent = `Mostrando ${state.records.length} registros`;
  }
}

function renderPortfolio() {
  if (!portfolioList) {
    return;
  }

  const map = new Map();
  state.records.forEach((record) => {
    const name = (record.emprendimiento || "").trim();
    if (!name) {
      return;
    }
    if (!map.has(name)) {
      map.set(name, record.link || "");
    }
  });

  const items = Array.from(map.entries());
  portfolioList.innerHTML = "";

  if (!items.length) {
    portfolioEmpty.textContent = "Sin emprendimientos registrados.";
    return;
  }

  portfolioEmpty.textContent = "";
  items.forEach(([name, link]) => {
    const card = document.createElement("div");
    card.className = "portfolio-card";

    const title = document.createElement("div");
    title.className = "portfolio-name";
    title.textContent = name;

    card.appendChild(title);

    if (link) {
      const anchor = document.createElement("a");
      anchor.className = "portfolio-link";
      anchor.href = link;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.textContent = link;
      card.appendChild(anchor);
    } else {
      const noLink = document.createElement("div");
      noLink.className = "muted";
      noLink.textContent = "Sin link";
      card.appendChild(noLink);
    }

    portfolioList.appendChild(card);
  });
}

function renderRecords() {
  const visibleRecords = getVisibleRecords();
  recordsContainer.innerHTML = "";

  visibleRecords.forEach((record) => {
    const clone = recordTemplate.content.cloneNode(true);
    const card = clone.querySelector(".card");
    const whatsapp = clone.querySelector("[data-field=whatsapp]");
    const emprendimiento = clone.querySelector("[data-field=emprendimiento]");
    const link = clone.querySelector("[data-field=link]");
    const created = clone.querySelector("[data-field=created]");
    const preview = clone.querySelector("[data-toggle=previewEnviado]");
    const caducado = clone.querySelector("[data-toggle=periodoCaducado]");
    const pago = clone.querySelector("[data-toggle=pagoEfectuado]");
    const notes = clone.querySelector("[data-field=notes]");
    const editPanel = clone.querySelector("[data-field=editPanel]");
    const editWhatsapp = clone.querySelector("[data-field=editWhatsapp]");
    const editEmprendimiento = clone.querySelector("[data-field=editEmprendimiento]");
    const editLink = clone.querySelector("[data-field=editLink]");
    const editNotes = clone.querySelector("[data-field=editNotes]");
    const editError = clone.querySelector("[data-field=editError]");

    card.dataset.id = record.id;
    card.classList.toggle("is-caducado", record.periodoCaducado);

    const cleanedHref = record.whatsapp.replace(/\s+/g, "");
    whatsapp.textContent = record.whatsapp;
    whatsapp.href = `https://wa.me/${cleanedHref.replace("+", "")}`;
    created.textContent = formatDate(record.createdAt);
    emprendimiento.textContent = record.emprendimiento || "Sin dato";
    link.textContent = record.link || "Sin link";
    link.href = record.link || "#";

    notes.textContent = record.notes ? record.notes : "Sin observaciones";

    updatePill(preview, record.previewEnviado);
    updatePill(caducado, record.periodoCaducado);
    updatePill(pago, record.pagoEfectuado);

    const isEditing = state.editingId === record.id;
    card.classList.toggle("expanded", isEditing);
    editPanel.classList.toggle("active", isEditing);
    if (isEditing) {
      editWhatsapp.value = record.whatsapp;
      editEmprendimiento.value = record.emprendimiento || "";
      editLink.value = record.link || "";
      editNotes.value = record.notes || "";
      editError.textContent = "";
    }

    recordsContainer.appendChild(card);
  });

  if (!state.records.length) {
    emptyState.textContent = "Todavia no hay registros.";
  } else if (!visibleRecords.length) {
    emptyState.textContent = "No hay registros con esos filtros.";
  } else {
    emptyState.textContent = "";
  }

  updateFilterInfo(visibleRecords.length);
  renderPortfolio();
  setStats();
}

function updatePill(element, value) {
  element.textContent = value ? "Si" : "No";
  element.classList.toggle("active", value);
  element.setAttribute("aria-pressed", value ? "true" : "false");
}

function toggleField(id, field) {
  const record = state.records.find((item) => item.id === id);
  if (!record) {
    return;
  }
  record[field] = !record[field];
  saveRecords();
  renderRecords();
}

function addRecord(whatsapp, emprendimiento, notes) {
  state.records.unshift({
    id: getId(),
    whatsapp,
    emprendimiento,
    link: "",
    notes,
    previewEnviado: false,
    periodoCaducado: false,
    pagoEfectuado: false,
    createdAt: Date.now(),
  });
  saveRecords();
  renderRecords();
}

function resetForm() {
  whatsappInput.value = "";
  emprendimientoInput.value = "";
  notesInput.value = "";
  whatsappInput.focus();
  setFormError("");
}

function escapeCsv(value) {
  const safe = String(value ?? "");
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function buildCsv(records) {
  const header = [
    "whatsapp",
    "emprendimiento",
    "link",
    "previewEnviado",
    "periodoCaducado",
    "pagoEfectuado",
    "createdAt",
    "notes",
  ];
  const rows = records.map((record) => [
    record.whatsapp,
    record.emprendimiento || "",
    record.link || "",
    record.previewEnviado ? "si" : "no",
    record.periodoCaducado ? "si" : "no",
    record.pagoEfectuado ? "si" : "no",
    record.createdAt,
    record.notes || "",
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function parseBoolean(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["si", "yes", "true", "1"].includes(normalized);
}

function importRecordsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    return 0;
  }

  const header = rows[0].map((value) => value.trim().toLowerCase());
  const hasHeader = header.includes("whatsapp");
  const startIndex = hasHeader ? 1 : 0;

  const indexMap = {
    whatsapp: header.indexOf("whatsapp"),
    emprendimiento: header.indexOf("emprendimiento"),
    link: header.indexOf("link"),
    preview: header.indexOf("previewenviado"),
    caducado: header.indexOf("periodocaducado"),
    pago: header.indexOf("pagoefectuado"),
    createdAt: header.indexOf("createdat"),
    notes: header.indexOf("notes"),
  };

  let importedCount = 0;

  for (let i = startIndex; i < rows.length; i += 1) {
    const row = rows[i];
    const hasEmprendimiento = row.length >= 7;
    const hasLink = row.length >= 8;
    const whatsapp = sanitizeNumber(
      hasHeader ? row[indexMap.whatsapp] || "" : row[0] || ""
    );

    if (!validateNumber(whatsapp)) {
      continue;
    }

    const record = {
      id: getId(),
      whatsapp,
      emprendimiento: sanitizeEmprendimiento(
        hasHeader
          ? row[indexMap.emprendimiento] || ""
          : hasEmprendimiento
            ? row[1] || ""
            : ""
      ),
      link: sanitizeLink(
        hasHeader
          ? row[indexMap.link] || ""
          : hasLink
            ? row[2] || ""
            : ""
      ),
      previewEnviado: parseBoolean(
        hasHeader ? row[indexMap.preview] : hasLink ? row[3] : hasEmprendimiento ? row[2] : row[1]
      ),
      periodoCaducado: parseBoolean(
        hasHeader ? row[indexMap.caducado] : hasLink ? row[4] : hasEmprendimiento ? row[3] : row[2]
      ),
      pagoEfectuado: parseBoolean(
        hasHeader ? row[indexMap.pago] : hasLink ? row[5] : hasEmprendimiento ? row[4] : row[3]
      ),
      createdAt: Number(
        hasHeader ? row[indexMap.createdAt] : hasLink ? row[6] : hasEmprendimiento ? row[5] : row[4]
      ) || Date.now(),
      notes: sanitizeNotes(
        hasHeader ? row[indexMap.notes] || "" : hasLink ? row[7] || "" : hasEmprendimiento ? row[6] || "" : row[5] || ""
      ),
    };

    state.records.push(record);
    importedCount += 1;
  }

  if (importedCount) {
    saveRecords();
    renderRecords();
  }

  return importedCount;
}

recordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const rawValue = whatsappInput.value;
  const cleaned = sanitizeNumber(rawValue);
  const emprendimiento = sanitizeEmprendimiento(emprendimientoInput.value);
  const notes = sanitizeNotes(notesInput.value);

  if (!validateNumber(cleaned)) {
    setFormError("Ingresa un numero valido (6 a 20 digitos).");
    whatsappInput.focus();
    whatsappInput.select();
    return;
  }

  addRecord(cleaned, emprendimiento, notes);
  setFormSuccess("Registro guardado.");
  resetForm();
});

whatsappInput.addEventListener("input", () => {
  setFormError("");
  setFormSuccess("");
});

notesInput.addEventListener("input", () => {
  setFormSuccess("");
});

emprendimientoInput.addEventListener("input", () => {
  setFormSuccess("");
});

searchInput.addEventListener("input", (event) => {
  state.filters.search = event.target.value.trim();
  renderRecords();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderRecords();
});

filterPreview.addEventListener("change", (event) => {
  state.filters.preview = event.target.value;
  renderRecords();
});

filterCaducado.addEventListener("change", (event) => {
  state.filters.caducado = event.target.value;
  renderRecords();
});

filterPago.addEventListener("change", (event) => {
  state.filters.pago = event.target.value;
  renderRecords();
});

resetFilters.addEventListener("click", () => {
  state.filters = {
    search: "",
    preview: "all",
    caducado: "all",
    pago: "all",
  };
  state.sort = "recent";
  searchInput.value = "";
  sortSelect.value = "recent";
  filterPreview.value = "all";
  filterCaducado.value = "all";
  filterPago.value = "all";
  renderRecords();
});

exportCsv.addEventListener("click", () => {
  if (!state.records.length) {
    setFormError("No hay registros para exportar.");
    return;
  }

  setFormError("");
  const csvContent = buildCsv(state.records);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `clientes_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setFormSuccess("CSV descargado.");
});

importCsv.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const importedCount = importRecordsFromCsv(text);
    if (importedCount) {
      setFormSuccess(`Importados ${importedCount} registros.`);
      setFormError("");
    } else {
      setFormError("No se importaron registros.");
    }
  } catch (error) {
    setFormError("No se pudo importar el CSV.");
  } finally {
    importCsv.value = "";
  }
});

recordsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const card = button.closest(".card");
  if (!card) {
    return;
  }

  const recordId = card.dataset.id;
  if (!recordId) {
    return;
  }

  const toggle = button.dataset.toggle;
  const action = button.dataset.action;

  if (toggle) {
    toggleField(recordId, toggle);
    return;
  }

  if (action === "edit") {
    state.editingId = recordId;
    renderRecords();
    return;
  }

  if (action === "cancel") {
    state.editingId = null;
    renderRecords();
    return;
  }

  if (action === "save") {
    const record = state.records.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    const editWhatsapp = card.querySelector("[data-field=editWhatsapp]");
    const editEmprendimiento = card.querySelector("[data-field=editEmprendimiento]");
    const editLink = card.querySelector("[data-field=editLink]");
    const editNotes = card.querySelector("[data-field=editNotes]");
    const editError = card.querySelector("[data-field=editError]");
    const cleaned = sanitizeNumber(editWhatsapp.value || "");

    if (!validateNumber(cleaned)) {
      editError.textContent = "Numero invalido (6 a 20 digitos).";
      return;
    }

    record.whatsapp = cleaned;
    record.emprendimiento = sanitizeEmprendimiento(editEmprendimiento.value || "");
    record.link = sanitizeLink(editLink.value || "");
    record.notes = sanitizeNotes(editNotes.value || "");
    saveRecords();
    state.editingId = null;
    setFormSuccess("Registro actualizado.");
    renderRecords();
  }
});

renderRecords();
