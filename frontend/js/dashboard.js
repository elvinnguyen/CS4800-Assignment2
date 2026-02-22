(function () {
  "use strict";

  const API_BASE = "/api/items";
  const messageEl = document.getElementById("message");
  const loadingEl = document.getElementById("loading");
  const itemsContainer = document.getElementById("items-container");
  const emptyState = document.getElementById("empty-state");
  const itemModal = document.getElementById("item-modal");
  const itemForm = document.getElementById("item-form");
  const modalTitle = document.getElementById("modal-title");
  const itemIdInput = document.getElementById("item-id");

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "message " + (type === "error" ? "error" : "success");
    messageEl.hidden = false;
    messageEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(function () {
      messageEl.hidden = true;
    }, 5000);
  }

  function setLoading(show) {
    loadingEl.hidden = !show;
    if (show) {
      itemsContainer.innerHTML = "";
      emptyState.hidden = true;
    }
  }

  function clearFieldErrors() {
    document.querySelectorAll(".field-error").forEach(function (el) {
      el.textContent = "";
    });
    document.querySelectorAll(".form-group input, .form-group select, .form-group textarea").forEach(function (el) {
      el.classList.remove("invalid");
    });
  }

  function showFieldError(fieldId, msg) {
    var el = document.getElementById(fieldId);
    var errEl = document.getElementById("error-" + fieldId);
    if (el) el.classList.add("invalid");
    if (errEl) errEl.textContent = msg || "";
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
    } catch (_) {
      return iso;
    }
  }

  function renderItem(item) {
    var statusClass = (item.status || "").toLowerCase().replace(/\s/g, "-");
    var card = document.createElement("div");
    card.className = "item-card";
    card.setAttribute("data-id", item.id);

    var meta = [];
    if (item.type) meta.push('<span class="badge badge-type">' + escapeHtml(item.type) + "</span>");
    if (item.status) meta.push('<span class="badge badge-status ' + statusClass + '">' + escapeHtml(item.status) + "</span>");

    var ratingHtml = "";
    if (item.rating != null && item.rating !== "") ratingHtml = '<div class="rating">★ ' + escapeHtml(String(item.rating)) + "/10</div>";

    var progressHtml = "";
    if (item.type === "TV Show" && (item.current_episode != null || item.total_episodes != null)) {
      var cur = item.current_episode != null ? item.current_episode : "?";
      var tot = item.total_episodes != null ? item.total_episodes : "?";
      progressHtml = '<div class="progress">Episode ' + cur + " / " + tot + "</div>";
    }

    var notesHtml = "";
    if (item.notes && item.notes.trim()) notesHtml = '<div class="notes" title="' + escapeAttr(item.notes) + '">' + escapeHtml(item.notes) + "</div>";

    card.innerHTML =
      '<h3>' +
      escapeHtml(item.title) +
      "</h3>" +
      '<div class="meta">' +
      meta.join("") +
      "</div>" +
      ratingHtml +
      progressHtml +
      notesHtml +
      '<div class="actions">' +
      '<button type="button" class="btn btn-secondary btn-sm btn-edit">Edit</button>' +
      '<button type="button" class="btn btn-danger btn-sm btn-delete">Delete</button>' +
      "</div>";

    card.querySelector(".btn-edit").addEventListener("click", function () {
      openModalForEdit(item);
    });
    card.querySelector(".btn-delete").addEventListener("click", function () {
      deleteItem(item.id);
    });
    return card;
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderItems(items) {
    itemsContainer.innerHTML = "";
    if (!items || items.length === 0) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;
    items.forEach(function (item) {
      itemsContainer.appendChild(renderItem(item));
    });
  }

  function loadItems() {
    setLoading(true);
    fetch(API_BASE, { method: "GET" })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Failed to load items");
          return data;
        });
      })
      .then(function (data) {
        renderItems(data);
      })
      .catch(function (err) {
        showMessage(err.message || "Failed to load items", "error");
        renderItems([]);
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function openModalForAdd() {
    modalTitle.textContent = "Add Item";
    itemIdInput.value = "";
    itemForm.reset();
    document.getElementById("type").value = "Movie";
    document.getElementById("status").value = "Planned";
    toggleTvFields(document.getElementById("type").value);
    clearFieldErrors();
    itemModal.hidden = false;
    document.getElementById("title").focus();
  }

  function openModalForEdit(item) {
    modalTitle.textContent = "Edit Item";
    itemIdInput.value = item.id || "";
    document.getElementById("title").value = item.title || "";
    document.getElementById("type").value = item.type || "Movie";
    document.getElementById("status").value = item.status || "Planned";
    document.getElementById("rating").value = item.rating != null && item.rating !== "" ? item.rating : "";
    document.getElementById("current_episode").value = item.current_episode != null && item.current_episode !== "" ? item.current_episode : "";
    document.getElementById("total_episodes").value = item.total_episodes != null && item.total_episodes !== "" ? item.total_episodes : "";
    document.getElementById("notes").value = item.notes || "";
    toggleTvFields(item.type || "Movie");
    clearFieldErrors();
    itemModal.hidden = false;
    document.getElementById("title").focus();
  }

  function closeModal() {
    itemModal.hidden = true;
  }

  function toggleTvFields(type) {
    var isTv = type === "TV Show";
    document.getElementById("group-current-episode").style.display = isTv ? "block" : "none";
    document.getElementById("group-total-episodes").style.display = isTv ? "block" : "none";
  }

  function validateForm() {
    clearFieldErrors();
    var title = document.getElementById("title").value;
    var rating = document.getElementById("rating").value;
    var valid = true;
    if (!title || !title.trim()) {
      showFieldError("title", "Title is required.");
      valid = false;
    }
    if (rating !== "") {
      var r = parseInt(rating, 10);
      if (isNaN(r) || r < 1 || r > 10) {
        showFieldError("rating", "Rating must be between 1 and 10.");
        valid = false;
      }
    }
    return valid;
  }

  function getFormPayload() {
    var type = document.getElementById("type").value;
    var payload = {
      title: document.getElementById("title").value.trim(),
      type: type,
      status: document.getElementById("status").value,
      notes: document.getElementById("notes").value.trim() || null
    };
    var rating = document.getElementById("rating").value.trim();
    if (rating !== "") payload.rating = parseInt(rating, 10);
    if (type === "TV Show") {
      var cur = document.getElementById("current_episode").value.trim();
      var tot = document.getElementById("total_episodes").value.trim();
      if (cur !== "") payload.current_episode = parseInt(cur, 10);
      if (tot !== "") payload.total_episodes = parseInt(tot, 10);
    }
    return payload;
  }

  function submitForm(e) {
    e.preventDefault();
    if (!validateForm()) return;

    var id = itemIdInput.value.trim();
    var payload = getFormPayload();
    var isEdit = !!id;

    var url = isEdit ? API_BASE + "/" + encodeURIComponent(id) : API_BASE;
    var method = isEdit ? "PUT" : "POST";

    fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Request failed");
          return data;
        });
      })
      .then(function () {
        closeModal();
        showMessage(isEdit ? "Item updated." : "Item added.", "success");
        loadItems();
      })
      .catch(function (err) {
        showMessage(err.message || "Something went wrong.", "error");
      });
  }

  function deleteItem(id) {
    if (!confirm("Delete this item?")) return;
    fetch(API_BASE + "/" + encodeURIComponent(id), { method: "DELETE" })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Delete failed");
          return data;
        });
      })
      .then(function () {
        showMessage("Item deleted.", "success");
        loadItems();
      })
      .catch(function (err) {
        showMessage(err.message || "Delete failed.", "error");
      });
  }

  // Event listeners
  itemForm.addEventListener("submit", submitForm);

  document.getElementById("type").addEventListener("change", function () {
    toggleTvFields(this.value);
  });

  document.getElementById("btn-add-item").addEventListener("click", openModalForAdd);
  document.getElementById("btn-add-first").addEventListener("click", openModalForAdd);

  function setupModalClose() {
    function handleClose(e) {
      if (e) e.preventDefault();
      closeModal();
    }
    var closeBtn = document.getElementById("modal-close-btn");
    var cancelBtn = document.getElementById("modal-cancel-btn");
    var backdrop = document.getElementById("modal-backdrop");
    if (closeBtn) closeBtn.addEventListener("click", handleClose);
    if (cancelBtn) cancelBtn.addEventListener("click", handleClose);
    if (backdrop) backdrop.addEventListener("click", handleClose);
  }
  setupModalClose();

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !itemModal.hidden) closeModal();
  });

  // Initial load
  loadItems();
})();
