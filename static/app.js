(function () {
  const API = "";
  const LS = "qna_token";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let state = {
    token: localStorage.getItem(LS),
    user: null,
    documents: [],
    previewDocId: null,
    searchDocIds: [],
    history: [],
  };

  function authHeaders() {
    const h = { Accept: "application/json" };
    if (state.token) h.Authorization = `Bearer ${state.token}`;
    return h;
  }

  async function api(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { ...authHeaders(), ...opts.headers },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text || res.statusText };
    }
    if (!res.ok) {
      const msg = data?.detail;
      const err = typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((e) => e.msg).join(", ") : res.statusText;
      throw new Error(err || "Request failed");
    }
    return data;
  }

  function toast(message, type = "info") {
    const host = $("#toast-host");
    const el = document.createElement("div");
    el.className = `toast-item pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg border backdrop-blur-md animate-toast-in ${
      type === "error"
        ? "bg-rose-950/90 border-rose-500/40 text-rose-100"
        : type === "success"
          ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-100"
          : "bg-slate-900/90 border-slate-600/50 text-slate-100"
    }`;
    el.innerHTML = `<i class="bi ${type === "error" ? "bi-exclamation-circle" : type === "success" ? "bi-check-circle" : "bi-info-circle"} text-lg"></i><span class="text-sm font-medium">${escapeHtml(message)}</span>`;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add("opacity-0", "translate-x-4", "transition-all", "duration-300");
      setTimeout(() => el.remove(), 320);
    }, 4200);
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function setView(name) {
    $$("[data-view]").forEach((v) => v.classList.toggle("hidden", v.dataset.view !== name));
    $("#nav-app")?.classList.toggle("hidden", name === "auth");
  }

  async function loadMe() {
    if (!state.token) return false;
    try {
      state.user = await api("/api/auth/me");
      return true;
    } catch {
      state.token = null;
      localStorage.removeItem(LS);
      return false;
    }
  }

  function ensureSearchNotEmpty() {
    if (state.searchDocIds.length > 0) return;
    if (state.previewDocId != null) state.searchDocIds = [state.previewDocId];
    else if (state.documents[0]) state.searchDocIds = [state.documents[0].id];
  }

  function historyQueryString() {
    const p = new URLSearchParams();
    state.searchDocIds.forEach((id) => p.append("document_ids", String(id)));
    p.set("limit", "50");
    const qs = p.toString();
    return qs ? `?${qs}` : "?limit=50";
  }

  async function refreshDocuments() {
    state.documents = await api("/api/documents");
    state.searchDocIds = state.searchDocIds.filter((id) => state.documents.some((d) => d.id === id));
    state.previewDocId = state.documents.some((d) => d.id === state.previewDocId) ? state.previewDocId : null;
    ensureSearchNotEmpty();
    if (state.previewDocId == null && state.documents[0]) state.previewDocId = state.documents[0].id;
    renderDocs();
  }

  async function refreshHistory() {
    ensureSearchNotEmpty();
    state.history = await api(`/api/qa/history${historyQueryString()}`);
    renderHistory();
  }

  function toggleSearchDoc(id, forceOn) {
    const idx = state.searchDocIds.indexOf(id);
    if (forceOn === true) {
      if (idx < 0) state.searchDocIds.push(id);
      return;
    }
    if (forceOn === false) {
      state.searchDocIds = state.searchDocIds.filter((x) => x !== id);
      return;
    }
    if (idx >= 0) {
      if (state.searchDocIds.length <= 1) {
        toast("Keep at least one document in the search set.", "info");
        return;
      }
      state.searchDocIds.splice(idx, 1);
    } else {
      state.searchDocIds.push(id);
    }
  }

  function setPreviewDoc(id) {
    state.previewDocId = id;
    renderDocs();
    updatePreview();
  }

  function renderDocs() {
    const list = $("#doc-list");
    if (!state.documents.length) {
      list.innerHTML = `<p class="text-slate-500 text-sm px-2 py-6 text-center">No PDFs yet. Upload one to get started.</p>`;
      return;
    }
    list.innerHTML = state.documents
      .map((d) => {
        const inSearch = state.searchDocIds.includes(d.id);
        const isPreview = state.previewDocId === d.id;
        return `
      <div data-doc-id="${d.id}" class="doc-row w-full group flex items-start gap-2 rounded-xl px-2 py-2 transition-all duration-200 hover:bg-white/5 border ${
          isPreview ? "border-cyan-500/35 bg-cyan-500/10" : "border-transparent hover:border-violet-500/20"
        }">
        <div class="pt-2 shrink-0">
          <input type="checkbox" class="form-check-input border-slate-600 bg-slate-900" data-search-cb="${d.id}" ${inSearch ? "checked" : ""} title="Include in search" />
        </div>
        <button type="button" class="doc-preview-btn flex-1 min-w-0 text-left flex items-start gap-2 py-1 rounded-lg">
          <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-violet-200"><i class="bi bi-file-earmark-pdf"></i></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-slate-100">${escapeHtml(d.filename)}</span>
            <span class="text-xs text-slate-500">${d.char_count.toLocaleString()} chars${inSearch ? " · in search" : ""}</span>
          </span>
        </button>
        <button type="button" data-del-doc="${d.id}" class="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0" title="Delete"><i class="bi bi-trash3"></i></button>
      </div>`;
      })
      .join("");

    list.querySelectorAll("[data-search-cb]").forEach((cb) => {
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", (e) => {
        e.stopPropagation();
        const id = Number(cb.dataset.searchCb);
        const checked = cb.checked;
        if (checked) toggleSearchDoc(id, true);
        else {
          if (state.searchDocIds.length <= 1) {
            cb.checked = true;
            toast("Keep at least one document in the search set.", "info");
            return;
          }
          toggleSearchDoc(id, false);
        }
        renderDocs();
        refreshHistory().catch(() => {});
        updateAskEnabled();
      });
    });

    list.querySelectorAll(".doc-preview-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".doc-row");
        setPreviewDoc(Number(row.dataset.docId));
      });
    });

    list.querySelectorAll("[data-del-doc]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.delDoc);
        if (!confirm("Delete this document and its Q&A history?")) return;
        try {
          await api(`/api/documents/${id}`, { method: "DELETE" });
          toast("Document deleted", "success");
          state.searchDocIds = state.searchDocIds.filter((x) => x !== id);
          if (state.previewDocId === id) state.previewDocId = null;
          await refreshDocuments();
          await refreshHistory();
          updatePreview();
          updateAskEnabled();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });

    updateAskEnabled();
  }

  function updateAskEnabled() {
    $("#ask-btn").disabled = state.searchDocIds.length === 0;
  }

  function updatePreview() {
    const doc = state.documents.find((d) => d.id === state.previewDocId);
    const el = $("#preview-text");
    const meta = $("#preview-meta");
    const searchCount = state.searchDocIds.length;
    const searchNames = state.searchDocIds
      .map((id) => state.documents.find((d) => d.id === id))
      .filter(Boolean)
      .map((d) => d.filename);

    if (!doc) {
      el.textContent = "Select a document row to preview its extracted text.";
      meta.textContent =
        searchCount > 0
          ? `Multi-document search: ${searchCount} file(s) checked — ${searchNames.join(", ")}`
          : "";
      updateAskEnabled();
      return;
    }

    meta.textContent = `Preview: ${doc.filename} · ${doc.char_count.toLocaleString()} characters · Search: ${searchCount} file(s) — ${searchNames.join(", ")}`;
    el.textContent = "Loading…";
    api(`/api/documents/${doc.id}`)
      .then((d) => {
        el.textContent = d.extracted_text || "(empty)";
      })
      .catch((err) => {
        el.textContent = err.message;
      });
    updateAskEnabled();
  }

  function historySourceLabel(h) {
    const ids = h.source_document_ids && h.source_document_ids.length ? h.source_document_ids : [h.document_id];
    const names = ids
      .map((id) => state.documents.find((d) => d.id === id))
      .filter(Boolean)
      .map((d) => d.filename);
    const label = names.length ? names.join(" · ") : ids.join(", ");
    return escapeHtml(label);
  }

  function renderHistory() {
    const box = $("#history-list");
    if (!state.history.length) {
      box.innerHTML = `<p class="text-slate-500 text-sm text-center py-8">No questions yet for this view.</p>`;
      return;
    }
    box.innerHTML = state.history
      .map(
        (h) => `
      <article class="rounded-xl border border-white/5 bg-slate-900/40 p-4 animate-fade-up">
        <p class="text-[10px] uppercase tracking-wide text-slate-500 mb-2"><i class="bi bi-files me-1"></i>${historySourceLabel(h)}</p>
        <p class="text-xs text-violet-300/90 font-medium mb-1"><i class="bi bi-chat-quote me-1"></i>Q</p>
        <p class="text-slate-200 text-sm mb-3">${escapeHtml(h.question)}</p>
        <p class="text-xs text-emerald-300/90 font-medium mb-1">A</p>
        <p class="text-slate-300 text-sm whitespace-pre-wrap">${escapeHtml(h.answer)}</p>
        <p class="text-[10px] text-slate-600 mt-3">${new Date(h.created_at).toLocaleString()}</p>
      </article>`
      )
      .join("");
  }

  async function onLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = new URLSearchParams();
    body.set("username", fd.get("email").trim().toLowerCase());
    body.set("password", fd.get("password"));
    try {
      const tok = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      state.token = tok.access_token;
      localStorage.setItem(LS, state.token);
      await loadMe();
      $("#user-email").textContent = state.user.email;
      setView("app");
      await refreshDocuments();
      await refreshHistory();
      updatePreview();
      toast("Signed in", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email").trim().toLowerCase(),
          password: fd.get("password"),
        }),
      });
      toast("Account created — sign in below.", "success");
      e.target.reset();
      $("#tab-login").click();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function onUpload(e) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    $("#upload-spinner").classList.remove("opacity-0");
    $("#upload-spinner").classList.add("opacity-100");
    try {
      const doc = await api("/api/documents", { method: "POST", body: fd });
      toast(`Uploaded ${doc.filename}`, "success");
      await refreshDocuments();
      toggleSearchDoc(doc.id, true);
      setPreviewDoc(doc.id);
      await refreshHistory();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      $("#upload-spinner").classList.remove("opacity-100");
      $("#upload-spinner").classList.add("opacity-0");
    }
  }

  async function onAsk(e) {
    e.preventDefault();
    ensureSearchNotEmpty();
    if (!state.searchDocIds.length) return;
    const q = $("#question-input").value.trim();
    if (!q) return;
    const btn = $("#ask-btn");
    btn.disabled = true;
    $("#ask-spinner").classList.remove("d-none");
    try {
      const res = await api("/api/qa/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: state.searchDocIds, question: q }),
      });
      const scope =
        res.document_ids && res.document_ids.length > 1
          ? `<p class="text-xs text-slate-500 mb-2">${res.document_ids.length} documents</p>`
          : "";
      $("#answer-box").innerHTML = `<div class="animate-fade-up rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">${scope}<p class="text-xs text-emerald-300/90 font-medium mb-2">Answer</p><p class="text-slate-100 whitespace-pre-wrap">${escapeHtml(res.answer)}</p></div>`;
      $("#question-input").value = "";
      await refreshHistory();
      toast("Answer ready", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      $("#ask-spinner").classList.add("d-none");
      updateAskEnabled();
    }
  }

  function bindAuthTabs() {
    const loginTab = $("#tab-login");
    const regTab = $("#tab-register");
    const loginPane = $("#pane-login");
    const regPane = $("#pane-register");
    loginTab.addEventListener("click", () => {
      loginTab.classList.add("tab-active");
      regTab.classList.remove("tab-active");
      loginPane.classList.remove("hidden");
      regPane.classList.add("hidden");
    });
    regTab.addEventListener("click", () => {
      regTab.classList.add("tab-active");
      loginTab.classList.remove("tab-active");
      regPane.classList.remove("hidden");
      loginPane.classList.add("hidden");
    });
  }

  async function boot() {
    bindAuthTabs();
    $("#form-login").addEventListener("submit", onLogin);
    $("#form-register").addEventListener("submit", onRegister);
    $("#file-input").addEventListener("change", onUpload);
    $("#form-ask").addEventListener("submit", onAsk);
    $("#search-select-all").addEventListener("click", () => {
      state.searchDocIds = state.documents.map((d) => d.id);
      renderDocs();
      refreshHistory().catch((e) => toast(e.message, "error"));
    });
    $("#search-only-preview").addEventListener("click", () => {
      ensureSearchNotEmpty();
      if (state.previewDocId != null) state.searchDocIds = [state.previewDocId];
      else if (state.documents[0]) state.searchDocIds = [state.documents[0].id];
      renderDocs();
      refreshHistory().catch((e) => toast(e.message, "error"));
    });
    $("#logout-btn").addEventListener("click", () => {
      state.token = null;
      state.user = null;
      state.documents = [];
      state.previewDocId = null;
      state.searchDocIds = [];
      localStorage.removeItem(LS);
      setView("auth");
      toast("Signed out", "info");
    });
    $("#refresh-history").addEventListener("click", () => refreshHistory().catch((e) => toast(e.message, "error")));

    try {
      const h = await api("/api/health");
      $("#health-dot").classList.toggle("bg-emerald-400", h.status === "ok");
      $("#health-dot").classList.toggle("bg-amber-400", !h.groq_configured);
      $("#health-label").textContent = h.groq_configured ? "API ready" : "API up — set GROQ_API_KEY for answers";
    } catch {
      $("#health-label").textContent = "API unreachable";
    }

    if (state.token && (await loadMe())) {
      $("#user-email").textContent = state.user.email;
      setView("app");
      await refreshDocuments();
      if (state.documents.length) {
        const first = state.documents[0].id;
        state.previewDocId = first;
        state.searchDocIds = [first];
      }
      renderDocs();
      await refreshHistory();
      updatePreview();
    } else {
      setView("auth");
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
