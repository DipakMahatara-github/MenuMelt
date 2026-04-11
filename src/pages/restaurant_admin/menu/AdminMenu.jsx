import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Package, Plus, Search, Tag, Trash2, UtensilsCrossed } from "lucide-react";
import "./AdminMenu.css";
import { authFetch, API_BASE } from "../../../lib/api";

const MENU_API = `${API_BASE}/api/menu/`;
const CATEGORIES_API = `${API_BASE}/api/categories/`;

function mediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

function parseErrorPayload(data) {
  if (!data || typeof data !== "object") return "Something went wrong.";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) return data.detail.map((d) => d?.msg || String(d)).join(" ");
  if (Array.isArray(data.non_field_errors)) return data.non_field_errors.join(" ");
  const parts = [];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
    else if (typeof v === "object") parts.push(`${k}: ${JSON.stringify(v)}`);
    else parts.push(`${k}: ${v}`);
  }
  return parts.length ? parts.join(" ") : "Request failed.";
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function itemDisplayName(item) {
  if (item?.display_name) return item.display_name;
  const v = (item?.variant_label || "").trim();
  return v ? `${item.name} · ${v}` : item.name;
}

export default function AdminMenu() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });

  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [search, setSearch] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editItem, setEditItem] = useState(null);

  const [addForm, setAddForm] = useState({
    name: "",
    variant_label: "",
    description: "",
    price: "",
    category: "",
    image: null,
    available: true,
  });
  const [addImagePreview, setAddImagePreview] = useState("");

  const [editForm, setEditForm] = useState({
    name: "",
    variant_label: "",
    description: "",
    price: "",
    category: "",
    image: null,
    available: true,
  });
  const [editImagePreview, setEditImagePreview] = useState("");

  const addFileRef = useRef(null);
  const editFileRef = useRef(null);
  /** Blob URLs must not be revoked in an effect keyed on preview state — React Strict Mode double-mount breaks the preview. */
  const addPhotoBlobRef = useRef(null);
  const editPhotoBlobRef = useRef(null);
  const bannerTimeoutRef = useRef(null);
  const showBanner = useCallback((type, text) => {
    setBanner({ type, text });
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    if (text) {
      bannerTimeoutRef.current = window.setTimeout(
        () => setBanner({ type: "", text: "" }),
        5000
      );
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await authFetch(CATEGORIES_API);
    const data = await parseResponse(res);
    if (!res.ok) {
      setCategories([]);
      return [];
    }
    const list = Array.isArray(data) ? data : data?.results ?? [];
    setCategories(list);
    return list;
  }, []);

  const fetchMenu = useCallback(async () => {
    const res = await authFetch(MENU_API);
    const data = await parseResponse(res);
    if (!res.ok) {
      setItems([]);
      return;
    }
    const raw = Array.isArray(data) ? data : data?.results ?? [];
    const byId = new Map();
    for (const row of raw) {
      if (row && row.id != null) byId.set(row.id, row);
    }
    setItems([...byId.values()]);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await fetchCategories();
      await fetchMenu();
    } finally {
      setLoading(false);
    }
  }, [fetchCategories, fetchMenu]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setAddForm((f) => {
      if (f.category || !categories.length) return f;
      return { ...f, category: String(categories[0].id) };
    });
  }, [categories]);

  useEffect(() => {
    return () => {
      if (addPhotoBlobRef.current) URL.revokeObjectURL(addPhotoBlobRef.current);
      if (editPhotoBlobRef.current) URL.revokeObjectURL(editPhotoBlobRef.current);
    };
  }, []);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeCategoryId !== "all") {
      const id = Number(activeCategoryId);
      list = list.filter((i) => i.category === id);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.name || "").toLowerCase().includes(q) ||
          (i.variant_label || "").toLowerCase().includes(q) ||
          (i.display_name || "").toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q) ||
          (i.category_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeCategoryId, search]);

  const resetAddForm = () => {
    const first = categories[0]?.id;
    setAddForm({
      name: "",
      variant_label: "",
      description: "",
      price: "",
      category: first != null ? String(first) : "",
      image: null,
      available: true,
    });
    if (addPhotoBlobRef.current) {
      URL.revokeObjectURL(addPhotoBlobRef.current);
      addPhotoBlobRef.current = null;
    }
    setAddImagePreview("");
  };

  const handleAddImageChange = (e) => {
    const file = e.target.files?.[0];
    if (addPhotoBlobRef.current) {
      URL.revokeObjectURL(addPhotoBlobRef.current);
      addPhotoBlobRef.current = null;
    }
    if (file) {
      addPhotoBlobRef.current = URL.createObjectURL(file);
      setAddForm((f) => ({ ...f, image: file }));
      setAddImagePreview(addPhotoBlobRef.current);
    } else {
      setAddForm((f) => ({ ...f, image: null }));
      setAddImagePreview("");
    }
    e.target.value = "";
  };

  const handleAddChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAddForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.category) {
      showBanner("error", "Create or select a category first.");
      return;
    }
    setSubmitting(true);
    showBanner("", "");
    const formData = new FormData();
    formData.append("name", addForm.name.trim());
    formData.append("description", addForm.description);
    formData.append("price", String(addForm.price));
    formData.append("category", addForm.category);
    formData.append("available", addForm.available ? "true" : "false");
    formData.append("variant_label", (addForm.variant_label || "").trim());
    if (addForm.image instanceof File) formData.append("image", addForm.image);

    try {
      const res = await authFetch(MENU_API, { method: "POST", body: formData });
      const data = await parseResponse(res);
      if (res.status === 201) {
        showBanner("success", "Item added.");
        resetAddForm();
        await fetchMenu();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (err) {
      console.error(err);
      showBanner("error", "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    setCategorySubmitting(true);
    showBanner("", "");
    try {
      const res = await authFetch(CATEGORIES_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sort_order: categories.length }),
      });
      const data = await parseResponse(res);
      if (res.status === 201) {
        setNewCategoryName("");
        showBanner("success", "Category created.");
        if (data?.id != null) {
          setAddForm((f) => ({ ...f, category: String(data.id) }));
        }
        await fetchCategories();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (err) {
      console.error(err);
      showBanner("error", "Network error.");
    } finally {
      setCategorySubmitting(false);
    }
  };

  const openEdit = (item) => {
    if (editPhotoBlobRef.current) {
      URL.revokeObjectURL(editPhotoBlobRef.current);
      editPhotoBlobRef.current = null;
    }
    setEditItem(item);
    setEditForm({
      name: item.name,
      variant_label: item.variant_label || "",
      description: item.description || "",
      price: String(item.price),
      category: String(item.category),
      image: null,
      available: !!item.available,
    });
    setEditImagePreview(item.image ? mediaUrl(item.image) : "");
  };

  const closeEdit = () => {
    setEditItem(null);
    if (editPhotoBlobRef.current) {
      URL.revokeObjectURL(editPhotoBlobRef.current);
      editPhotoBlobRef.current = null;
    }
    setEditImagePreview("");
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files?.[0];
    if (editPhotoBlobRef.current) {
      URL.revokeObjectURL(editPhotoBlobRef.current);
      editPhotoBlobRef.current = null;
    }
    if (file) {
      editPhotoBlobRef.current = URL.createObjectURL(file);
      setEditForm((f) => ({ ...f, image: file }));
      setEditImagePreview(editPhotoBlobRef.current);
    } else {
      setEditForm((f) => ({ ...f, image: null }));
      setEditImagePreview(editItem?.image ? mediaUrl(editItem.image) : "");
    }
    e.target.value = "";
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editItem) return;
    setSubmitting(true);
    showBanner("", "");
    const formData = new FormData();
    formData.append("name", editForm.name.trim());
    formData.append("description", editForm.description);
    formData.append("price", String(editForm.price));
    formData.append("category", editForm.category);
    formData.append("available", editForm.available ? "true" : "false");
    formData.append("variant_label", (editForm.variant_label || "").trim());
    if (editForm.image instanceof File) formData.append("image", editForm.image);

    try {
      const res = await authFetch(`${MENU_API}${editItem.id}/`, {
        method: "PUT",
        body: formData,
      });
      const data = await parseResponse(res);
      if (res.ok) {
        showBanner("success", "Item updated.");
        closeEdit();
        await fetchMenu();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (err) {
      console.error(err);
      showBanner("error", "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    showBanner("", "");
    try {
      const res = await authFetch(`${MENU_API}${deleteTarget.id}/`, { method: "DELETE" });
      if (res.status === 204 || res.ok) {
        showBanner("success", "Item deleted.");
        setDeleteTarget(null);
        await fetchMenu();
      } else {
        const data = await parseResponse(res);
        showBanner("error", parseErrorPayload(data));
      }
    } catch (err) {
      console.error(err);
      showBanner("error", "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (
      !window.confirm(
        `Delete category "${cat.name}"? This only works if no menu items use it.`
      )
    ) {
      return;
    }
    setCategorySubmitting(true);
    try {
      const res = await authFetch(`${CATEGORIES_API}${cat.id}/`, { method: "DELETE" });
      const data = await parseResponse(res);
      if (res.status === 204 || res.ok) {
        showBanner("success", "Category deleted.");
        if (String(activeCategoryId) === String(cat.id)) setActiveCategoryId("all");
        await fetchCategories();
        await fetchMenu();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (err) {
      console.error(err);
      showBanner("error", "Network error.");
    } finally {
      setCategorySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-menu-page admin-menu-page--loading">
        <span className="admin-menu-spinner-el admin-menu-spinner-el--page" aria-hidden />
        <p>Loading your menu…</p>
      </div>
    );
  }

  return (
    <div className="admin-menu-page">
      <header className="admin-menu-hero">
        <div className="admin-menu-hero-text">
          <h1 className="admin-menu-title">Menu management</h1>
          <p className="admin-menu-lead">
            Each row in your grid is one sellable item. Use size/variant to add Small, Medium, Large as separate
            cards with the same dish name.
          </p>
        </div>
        <div className="admin-menu-hero-stats">
          <div className="admin-menu-stat">
            <UtensilsCrossed size={18} strokeWidth={2} aria-hidden />
            <div>
              <span className="admin-menu-stat-value">{items.length}</span>
              <span className="admin-menu-stat-label">Items</span>
            </div>
          </div>
          <div className="admin-menu-stat">
            <Tag size={18} strokeWidth={2} aria-hidden />
            <div>
              <span className="admin-menu-stat-value">{categories.length}</span>
              <span className="admin-menu-stat-label">Categories</span>
            </div>
          </div>
        </div>
      </header>

      {banner.text ? (
        <div className={`admin-menu-banner admin-menu-banner--${banner.type}`} role="status">
          {banner.text}
        </div>
      ) : null}

      <div className="admin-menu-split">
        <div className="admin-menu-aside">
          <section className="admin-menu-surface admin-menu-surface--form">
            <div className="admin-menu-surface-head">
              <Package size={20} className="admin-menu-surface-icon" aria-hidden />
              <div>
                <h2 className="admin-menu-surface-title">New menu item</h2>
                <p className="admin-menu-surface-desc">Same name + category can repeat with different size labels.</p>
              </div>
            </div>

            <form className="admin-menu-form" onSubmit={handleAddSubmit}>
              <div className="admin-menu-form-main">
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Item name</span>
                  <input
                    name="name"
                    className="admin-menu-input"
                    value={addForm.name}
                    onChange={handleAddChange}
                    placeholder="e.g. Margherita pizza"
                    required
                  />
                </label>

                <label className="admin-menu-field">
                  <span className="admin-menu-label">Size / variant (optional)</span>
                  <input
                    name="variant_label"
                    className="admin-menu-input"
                    value={addForm.variant_label}
                    onChange={handleAddChange}
                    placeholder="e.g. Small, Medium, Large — leave empty for a single-price dish"
                  />
                  <span className="admin-menu-hint">
                    Each size is its own menu card. Use the same name and category, different size here.
                  </span>
                </label>

                <div className="admin-menu-field-row">
                  <label className="admin-menu-field admin-menu-field--grow">
                    <span className="admin-menu-label">Price (Rs.)</span>
                    <input
                      type="number"
                      name="price"
                      className="admin-menu-input"
                      min="0"
                      step="0.01"
                      value={addForm.price}
                      onChange={handleAddChange}
                      required
                    />
                    <span className="admin-menu-hint">Price shown on this card only.</span>
                  </label>
                  <label className="admin-menu-field admin-menu-field--switch">
                    <span className="admin-menu-label">Available</span>
                    <label className="admin-menu-switch">
                      <input
                        type="checkbox"
                        name="available"
                        checked={addForm.available}
                        onChange={handleAddChange}
                      />
                      <span className="admin-menu-switch-ui" />
                      <span className="admin-menu-switch-text">{addForm.available ? "Available" : "Hidden"}</span>
                    </label>
                  </label>
                </div>

                <label className="admin-menu-field">
                  <span className="admin-menu-label">Description</span>
                  <textarea
                    name="description"
                    className="admin-menu-input admin-menu-textarea"
                    rows={3}
                    value={addForm.description}
                    onChange={handleAddChange}
                    placeholder="Ingredients, spice level, or what makes it special…"
                  />
                </label>

                <label className="admin-menu-field">
                  <span className="admin-menu-label">Category</span>
                  <select
                    name="category"
                    className="admin-menu-input admin-menu-select"
                    value={addForm.category}
                    onChange={handleAddChange}
                    required
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-menu-upload-block">
                <span className="admin-menu-label">Photo</span>
                <input
                  id="admin-menu-add-photo"
                  ref={addFileRef}
                  type="file"
                  accept="image/*"
                  className="admin-menu-file-native"
                  onChange={handleAddImageChange}
                />
                <button
                  type="button"
                  className="admin-menu-upload-btn"
                  onClick={() => addFileRef.current?.click()}
                >
                  <ImagePlus size={18} aria-hidden />
                  {addForm.image instanceof File ? "Change photo" : "Choose image"}
                </button>
                {addForm.image instanceof File ? (
                  <p className="admin-menu-file-meta" title={addForm.image.name}>
                    Selected: {addForm.image.name}
                  </p>
                ) : null}
                {addImagePreview ? (
                  <div className="admin-menu-preview admin-menu-preview--thumb">
                    <img src={addImagePreview} alt="Selected dish preview" />
                  </div>
                ) : null}
              </div>

              <div className="admin-menu-form-footer">
                <button type="submit" className="admin-menu-btn admin-menu-btn--primary admin-menu-btn--lg" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="admin-menu-btn-spinner-el" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Plus size={18} aria-hidden />
                      Add to menu
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-menu-surface">
            <div className="admin-menu-surface-head admin-menu-surface-head--compact">
              <Tag size={20} className="admin-menu-surface-icon" aria-hidden />
              <div>
                <h2 className="admin-menu-surface-title">Categories</h2>
                <p className="admin-menu-surface-desc">Group items for tabs and the customer menu.</p>
              </div>
            </div>
            <form className="admin-menu-cat-form" onSubmit={handleAddCategory}>
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Mains, Drinks, Desserts"
                className="admin-menu-input"
              />
              <button
                type="submit"
                className="admin-menu-btn admin-menu-btn--secondary"
                disabled={categorySubmitting}
              >
                {categorySubmitting ? <span className="admin-menu-btn-spinner-el" aria-hidden /> : <Plus size={16} />}
                Add
              </button>
            </form>
          </section>
        </div>

        <main className="admin-menu-main">
          <div className="admin-menu-toolbar admin-menu-surface">
            <div className="admin-menu-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeCategoryId === "all"}
                className={activeCategoryId === "all" ? "active" : ""}
                onClick={() => setActiveCategoryId("all")}
              >
                All items
              </button>
              {categories.map((c) => (
                <div key={c.id} className="admin-menu-tab-wrap">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={String(activeCategoryId) === String(c.id)}
                    className={String(activeCategoryId) === String(c.id) ? "active" : ""}
                    onClick={() => setActiveCategoryId(String(c.id))}
                  >
                    {c.name}
                  </button>
                  <button
                    type="button"
                    className="admin-menu-tab-delete"
                    title="Delete category"
                    onClick={() => handleDeleteCategory(c)}
                    disabled={categorySubmitting}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="admin-menu-search-wrap">
              <Search size={16} className="admin-menu-search-icon" aria-hidden />
              <input
                type="search"
                className="admin-menu-search"
                placeholder="Search by name or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <section className="admin-menu-grid">
            {filteredItems.length === 0 ? (
              <div className="admin-menu-empty-state">
                <Package size={40} strokeWidth={1.25} className="admin-menu-empty-icon" aria-hidden />
                <h3 className="admin-menu-empty-title">No items in this view</h3>
                <p className="admin-menu-empty-text">
                  {items.length === 0
                    ? "Add your first dish using the form on the left, or create a category first."
                    : "Try another category tab or clear your search filter."}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <article key={item.id} className="admin-menu-item-card">
                  <div className="admin-menu-item-image">
                    {item.image ? (
                      <img src={mediaUrl(item.image)} alt="" />
                    ) : (
                      <div className="admin-menu-item-placeholder">
                        <ImagePlus size={28} strokeWidth={1.5} />
                        <span>No photo</span>
                      </div>
                    )}
                    <span
                      className={`admin-menu-item-status ${
                        item.available ? "admin-menu-item-status--on" : "admin-menu-item-status--off"
                      }`}
                    >
                      {item.available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  <div className="admin-menu-item-body">
                    <h4 className="admin-menu-item-name">{itemDisplayName(item)}</h4>
                    {item.description?.trim() ? (
                      <p className="admin-menu-item-desc">{item.description.trim()}</p>
                    ) : null}
                    <p className="admin-menu-item-price">Rs. {Number(item.price).toFixed(2)}</p>
                    <span className="admin-menu-badge admin-menu-badge--cat">{item.category_name}</span>
                    <div className="admin-menu-item-actions">
                      <button
                        type="button"
                        className="admin-menu-btn admin-menu-btn--ghost admin-menu-btn--sm"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-menu-btn admin-menu-btn--danger admin-menu-btn--sm"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 size={14} aria-hidden />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </main>
      </div>

      {editItem ? (
        <div className="admin-menu-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-menu-modal admin-menu-modal--wide">
            <div className="admin-menu-modal-head">
              <div>
                <p className="admin-menu-modal-kicker">Editing</p>
                <h3 className="admin-menu-modal-title">{itemDisplayName(editItem)}</h3>
              </div>
              <button type="button" className="admin-menu-modal-close" onClick={closeEdit} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={handleEditSave} className="admin-menu-modal-form">
              <div className="admin-menu-form-main">
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Name</span>
                  <input
                    name="name"
                    className="admin-menu-input"
                    value={editForm.name}
                    onChange={handleEditChange}
                    required
                  />
                </label>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Size / variant</span>
                  <input
                    name="variant_label"
                    className="admin-menu-input"
                    value={editForm.variant_label}
                    onChange={handleEditChange}
                    placeholder="e.g. Small — leave empty if this is the only version"
                  />
                </label>
                <div className="admin-menu-field-row">
                  <label className="admin-menu-field admin-menu-field--grow">
                    <span className="admin-menu-label">Price (Rs.)</span>
                    <input
                      type="number"
                      name="price"
                      className="admin-menu-input"
                      min="0"
                      step="0.01"
                      value={editForm.price}
                      onChange={handleEditChange}
                      required
                    />
                  </label>
                  <label className="admin-menu-field admin-menu-field--switch">
                    <span className="admin-menu-label">Available</span>
                    <label className="admin-menu-switch">
                      <input
                        type="checkbox"
                        name="available"
                        checked={editForm.available}
                        onChange={handleEditChange}
                      />
                      <span className="admin-menu-switch-ui" />
                      <span className="admin-menu-switch-text">{editForm.available ? "Available" : "Hidden"}</span>
                    </label>
                  </label>
                </div>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Description</span>
                  <textarea
                    name="description"
                    className="admin-menu-input admin-menu-textarea"
                    rows={3}
                    value={editForm.description}
                    onChange={handleEditChange}
                  />
                </label>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Category</span>
                  <select
                    name="category"
                    className="admin-menu-input admin-menu-select"
                    value={editForm.category}
                    onChange={handleEditChange}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-menu-upload-block">
                <span className="admin-menu-label">Replace photo</span>
                <input
                  ref={editFileRef}
                  type="file"
                  accept="image/*"
                  className="admin-menu-file-native"
                  onChange={handleEditImageChange}
                />
                <button type="button" className="admin-menu-upload-btn" onClick={() => editFileRef.current?.click()}>
                  <ImagePlus size={18} aria-hidden />
                  {editForm.image instanceof File ? editForm.image.name : "Choose new image"}
                </button>
                {editImagePreview ? (
                  <div className="admin-menu-preview admin-menu-preview--thumb">
                    <img src={editImagePreview} alt="" />
                  </div>
                ) : null}
              </div>

              <div className="admin-menu-modal-actions">
                <button type="button" className="admin-menu-btn admin-menu-btn--ghost" onClick={closeEdit}>
                  Cancel
                </button>
                <button type="submit" className="admin-menu-btn admin-menu-btn--primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="admin-menu-btn-spinner-el" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="admin-menu-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-menu-modal admin-menu-modal--sm admin-menu-modal--confirm">
            <div className="admin-menu-confirm-icon">
              <Trash2 size={22} aria-hidden />
            </div>
            <h3 className="admin-menu-modal-title">Delete this item?</h3>
            <p className="admin-menu-confirm-text">
              <strong>{itemDisplayName(deleteTarget)}</strong> will be removed from your menu. This cannot be undone.
            </p>
            <div className="admin-menu-modal-actions admin-menu-modal-actions--split">
              <button type="button" className="admin-menu-btn admin-menu-btn--ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-menu-btn admin-menu-btn--danger"
                disabled={submitting}
                onClick={confirmDelete}
              >
                {submitting ? <span className="admin-menu-btn-spinner-el" aria-hidden /> : null}
                Delete item
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
