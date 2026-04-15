import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Gift,
  ImagePlus,
  Package,
  Plus,
  Search,
  Settings2,
  Tag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import "./AdminMenu.css";
import { authFetch, API_BASE } from "../../../lib/api";
import ConfirmDialog from "../../../components/ConfirmDialog";

const MENU_API = `${API_BASE}/api/menu/`;
const OFFERS_API = `${API_BASE}/api/menu/offers/`;
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
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) parts.push(`${key}: ${value.join(", ")}`);
    else if (typeof value === "object") parts.push(`${key}: ${JSON.stringify(value)}`);
    else parts.push(`${key}: ${value}`);
  });
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
  const variant = (item?.variant_label || "").trim();
  return variant ? `${item.name} · ${variant}` : item.name;
}

function newOption() {
  return {
    localId: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id: undefined,
    name: "",
    price_delta: "0.00",
    sort_order: 0,
  };
}

function newGroup() {
  return {
    localId: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id: undefined,
    name: "",
    selection_mode: "single",
    is_required: false,
    max_select: 1,
    sort_order: 0,
    options: [newOption()],
  };
}

function buildEmptyItemForm(categoryId = "") {
  return {
    name: "",
    variant_label: "",
    description: "",
    price: "",
    category: categoryId,
    image: null,
    available: true,
    customization_groups: [],
  };
}

function buildEmptyOfferForm(defaultMenuItem = "") {
  return {
    name: "",
    offer_type: "fixed",
    badge_text: "",
    description: "",
    is_active: true,
    starts_at: "",
    ends_at: "",
    fixed_discount_amount: "0.00",
    percentage_discount: "10",
    combo_price: "0.00",
    items: [{ localId: `offer-item-${Date.now()}`, menu_item: defaultMenuItem, quantity: 1 }],
  };
}

function buildOfferFormFromOffer(offer) {
  const mappedItems =
    offer?.items?.map((item, index) => ({
      localId: `offer-item-${offer.id}-${item.id || index}`,
      id: item.id,
      menu_item: String(item.menu_item),
      quantity: Number(item.quantity || 1),
    })) || [];

  return {
    name: offer?.name || "",
    offer_type: offer?.offer_type || "fixed",
    badge_text: offer?.badge_text || "",
    description: offer?.description || "",
    is_active: !!offer?.is_active,
    starts_at: toDateTimeLocal(offer?.starts_at),
    ends_at: toDateTimeLocal(offer?.ends_at),
    fixed_discount_amount: String(offer?.fixed_discount_amount ?? "0.00"),
    percentage_discount: String(offer?.percentage_discount ?? "10"),
    combo_price: String(offer?.combo_price ?? "0.00"),
    items: mappedItems.length
      ? mappedItems
      : [{ localId: `offer-item-${Date.now()}`, menu_item: "", quantity: 1 }],
  };
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function normalizeCustomizationPayload(groups) {
  return groups.map((group, index) => ({
    ...(group.id ? { id: group.id } : {}),
    name: group.name.trim(),
    selection_mode: group.selection_mode,
    is_required: !!group.is_required,
    max_select: Number(group.selection_mode === "single" ? 1 : group.max_select || 1),
    sort_order: index,
    options: (group.options || []).map((option, optionIndex) => ({
      ...(option.id ? { id: option.id } : {}),
      name: option.name.trim(),
      price_delta: String(option.price_delta || "0.00"),
      sort_order: optionIndex,
    })),
  }));
}

function normalizeOfferPayload(form) {
  const toIso = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  return {
    name: form.name.trim(),
    offer_type: form.offer_type,
    badge_text: form.badge_text.trim(),
    description: form.description.trim(),
    is_active: !!form.is_active,
    starts_at: toIso(form.starts_at),
    ends_at: toIso(form.ends_at),
    fixed_discount_amount: form.offer_type === "fixed" ? String(form.fixed_discount_amount || "0.00") : null,
    percentage_discount:
      form.offer_type === "percentage" ? String(form.percentage_discount || "0") : null,
    combo_price: form.offer_type === "combo" ? String(form.combo_price || "0.00") : null,
    items_payload: (form.items || [])
      .filter((item) => item.menu_item)
      .map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        menu_item: Number(item.menu_item),
        quantity: Number(item.quantity || 1),
      })),
  };
}

function customizationSummary(item) {
  const groupCount = item.customization_groups?.length || 0;
  if (!groupCount) return "No customizations";
  return `${groupCount} option group${groupCount === 1 ? "" : "s"}`;
}

function offerSummary(offer) {
  if (offer.offer_type === "fixed") {
    return `Fixed discount · Rs. ${Number(offer.fixed_discount_amount || 0).toFixed(2)} off`;
  }
  if (offer.offer_type === "percentage") {
    return `Percentage discount · ${Number(offer.percentage_discount || 0).toFixed(0)}% off`;
  }
  return `Combo / special meal · Rs. ${Number(offer.combo_price || 0).toFixed(2)}`;
}

export default function AdminMenu() {
  const [items, setItems] = useState([]);
  const [offers, setOffers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [confirmState, setConfirmState] = useState(null);

  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [search, setSearch] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editItem, setEditItem] = useState(null);

  const [addForm, setAddForm] = useState(() => buildEmptyItemForm());
  const [addImagePreview, setAddImagePreview] = useState("");

  const [editForm, setEditForm] = useState(() => buildEmptyItemForm());
  const [editImagePreview, setEditImagePreview] = useState("");

  const [offerForm, setOfferForm] = useState(() => buildEmptyOfferForm());
  const [editingOfferId, setEditingOfferId] = useState(null);

  const addFileRef = useRef(null);
  const editFileRef = useRef(null);
  const addPhotoBlobRef = useRef(null);
  const editPhotoBlobRef = useRef(null);
  const bannerTimeoutRef = useRef(null);
  const offersSectionRef = useRef(null);

  const showBanner = useCallback((type, text) => {
    setBanner({ type, text });
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    if (text) {
      bannerTimeoutRef.current = window.setTimeout(() => {
        setBanner({ type: "", text: "" });
      }, 5000);
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
      return [];
    }
    const raw = Array.isArray(data) ? data : data?.results ?? [];
    const byId = new Map();
    raw.forEach((row) => {
      if (row?.id != null) byId.set(row.id, row);
    });
    const list = [...byId.values()];
    setItems(list);
    return list;
  }, []);

  const fetchOffers = useCallback(async () => {
    const res = await authFetch(OFFERS_API);
    const data = await parseResponse(res);
    if (!res.ok) {
      setOffers([]);
      return [];
    }
    const list = Array.isArray(data) ? data : data?.results ?? [];
    setOffers(list);
    return list;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedCategories, loadedItems] = await Promise.all([
        fetchCategories(),
        fetchMenu(),
        fetchOffers(),
      ]);
      setAddForm((current) => {
        if (current.category || !loadedCategories.length) return current;
        return { ...current, category: String(loadedCategories[0].id) };
      });
      setOfferForm((current) => {
        const defaultMenuItem = loadedItems?.[0]?.id ? String(loadedItems[0].id) : "";
        if (current.items?.[0]?.menu_item || !defaultMenuItem) return current;
        return {
          ...current,
          items: current.items.map((item, index) =>
            index === 0 ? { ...item, menu_item: defaultMenuItem } : item
          ),
        };
      });
    } finally {
      setLoading(false);
    }
  }, [fetchCategories, fetchMenu, fetchOffers]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
      list = list.filter((item) => item.category === id);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(query) ||
          (item.variant_label || "").toLowerCase().includes(query) ||
          (item.display_name || "").toLowerCase().includes(query) ||
          (item.description || "").toLowerCase().includes(query) ||
          (item.category_name || "").toLowerCase().includes(query)
      );
    }
    return list;
  }, [items, activeCategoryId, search]);

  const resetAddForm = () => {
    const firstCategory = categories[0]?.id ? String(categories[0].id) : "";
    setAddForm(buildEmptyItemForm(firstCategory));
    if (addPhotoBlobRef.current) {
      URL.revokeObjectURL(addPhotoBlobRef.current);
      addPhotoBlobRef.current = null;
    }
    setAddImagePreview("");
  };

  const resetOfferForm = () => {
    const defaultMenuItem = items[0]?.id ? String(items[0].id) : "";
    setEditingOfferId(null);
    setOfferForm(buildEmptyOfferForm(defaultMenuItem));
  };

  const handleAddImageChange = (event) => {
    const file = event.target.files?.[0];
    if (addPhotoBlobRef.current) {
      URL.revokeObjectURL(addPhotoBlobRef.current);
      addPhotoBlobRef.current = null;
    }
    if (file) {
      addPhotoBlobRef.current = URL.createObjectURL(file);
      setAddForm((current) => ({ ...current, image: file }));
      setAddImagePreview(addPhotoBlobRef.current);
    } else {
      setAddForm((current) => ({ ...current, image: null }));
      setAddImagePreview("");
    }
    event.target.value = "";
  };

  const handleEditImageChange = (event) => {
    const file = event.target.files?.[0];
    if (editPhotoBlobRef.current) {
      URL.revokeObjectURL(editPhotoBlobRef.current);
      editPhotoBlobRef.current = null;
    }
    if (file) {
      editPhotoBlobRef.current = URL.createObjectURL(file);
      setEditForm((current) => ({ ...current, image: file }));
      setEditImagePreview(editPhotoBlobRef.current);
    } else {
      setEditForm((current) => ({ ...current, image: null }));
      setEditImagePreview(editItem?.image ? mediaUrl(editItem.image) : "");
    }
    event.target.value = "";
  };

  const handleFormChange = (setter) => (event) => {
    const { name, value, type, checked } = event.target;
    setter((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const updateGroups = (setter, updater) => {
    setter((current) => ({
      ...current,
      customization_groups: updater(current.customization_groups || []),
    }));
  };

  const addCustomizationGroup = (setter) => {
    updateGroups(setter, (groups) => [...groups, { ...newGroup(), sort_order: groups.length }]);
  };

  const updateCustomizationGroup = (setter, localId, field, value) => {
    updateGroups(setter, (groups) =>
      groups.map((group) =>
        group.localId === localId
          ? {
              ...group,
              [field]:
                field === "max_select"
                  ? Math.max(1, Number(value) || 1)
                  : value,
              ...(field === "selection_mode" && value === "single" ? { max_select: 1 } : {}),
            }
          : group
      )
    );
  };

  const removeCustomizationGroup = (setter, localId) => {
    updateGroups(setter, (groups) => groups.filter((group) => group.localId !== localId));
  };

  const addCustomizationOption = (setter, groupLocalId) => {
    updateGroups(setter, (groups) =>
      groups.map((group) =>
        group.localId === groupLocalId
          ? {
              ...group,
              options: [...(group.options || []), { ...newOption(), sort_order: group.options.length }],
            }
          : group
      )
    );
  };

  const updateCustomizationOption = (setter, groupLocalId, optionLocalId, field, value) => {
    updateGroups(setter, (groups) =>
      groups.map((group) =>
        group.localId === groupLocalId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.localId === optionLocalId ? { ...option, [field]: value } : option
              ),
            }
          : group
      )
    );
  };

  const removeCustomizationOption = (setter, groupLocalId, optionLocalId) => {
    updateGroups(setter, (groups) =>
      groups.map((group) =>
        group.localId === groupLocalId
          ? {
              ...group,
              options: group.options.filter((option) => option.localId !== optionLocalId),
            }
          : group
      )
    );
  };

  const buildItemFormData = (form) => {
    const formData = new FormData();
    formData.append("name", form.name.trim());
    formData.append("description", form.description);
    formData.append("price", String(form.price));
    formData.append("category", form.category);
    formData.append("available", form.available ? "true" : "false");
    formData.append("variant_label", (form.variant_label || "").trim());
    formData.append(
      "customization_groups_payload",
      JSON.stringify(normalizeCustomizationPayload(form.customization_groups || []))
    );
    if (form.image instanceof File) formData.append("image", form.image);
    return formData;
  };

  const handleAddSubmit = async (event) => {
    event.preventDefault();
    if (!addForm.category) {
      showBanner("error", "Create or select a category first.");
      return;
    }
    setSubmitting(true);
    showBanner("", "");
    try {
      const res = await authFetch(MENU_API, {
        method: "POST",
        body: buildItemFormData(addForm),
      });
      const data = await parseResponse(res);
      if (res.status === 201) {
        showBanner("success", "Item added.");
        resetAddForm();
        await fetchMenu();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (error) {
      console.error(error);
      showBanner("error", "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCategory = async (event) => {
    event.preventDefault();
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
          setAddForm((current) => ({ ...current, category: String(data.id) }));
        }
        await fetchCategories();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (error) {
      console.error(error);
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
      customization_groups: (item.customization_groups || []).map((group, groupIndex) => ({
        localId: `edit-group-${group.id || groupIndex}`,
        id: group.id,
        name: group.name,
        selection_mode: group.selection_mode,
        is_required: !!group.is_required,
        max_select: Number(group.max_select || 1),
        sort_order: Number(group.sort_order || groupIndex),
        options: (group.options || []).map((option, optionIndex) => ({
          localId: `edit-option-${option.id || optionIndex}`,
          id: option.id,
          name: option.name,
          price_delta: String(option.price_delta || "0.00"),
          sort_order: Number(option.sort_order || optionIndex),
        })),
      })),
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

  const handleEditSave = async (event) => {
    event.preventDefault();
    if (!editItem) return;
    setSubmitting(true);
    showBanner("", "");
    try {
      const res = await authFetch(`${MENU_API}${editItem.id}/`, {
        method: "PUT",
        body: buildItemFormData(editForm),
      });
      const data = await parseResponse(res);
      if (res.ok) {
        showBanner("success", "Item updated.");
        closeEdit();
        await fetchMenu();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (error) {
      console.error(error);
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
    } catch (error) {
      console.error(error);
      showBanner("error", "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    setConfirmState({
      title: `Delete category "${category.name}"?`,
      description: "This only works if no menu items use this category.",
      confirmLabel: "Delete category",
      tone: "danger",
      meta: [category.name],
      onConfirm: async () => {
        setCategorySubmitting(true);
        try {
          const res = await authFetch(`${CATEGORIES_API}${category.id}/`, { method: "DELETE" });
          const data = await parseResponse(res);
          if (res.status === 204 || res.ok) {
            showBanner("success", "Category deleted.");
            if (String(activeCategoryId) === String(category.id)) setActiveCategoryId("all");
            await fetchCategories();
            await fetchMenu();
            setConfirmState(null);
          } else {
            showBanner("error", parseErrorPayload(data));
          }
        } catch (error) {
          console.error(error);
          showBanner("error", "Network error.");
        } finally {
          setCategorySubmitting(false);
        }
      },
    });
  };

  const updateOfferField = (event) => {
    const { name, value, type, checked } = event.target;
    setOfferForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addOfferItem = () => {
    setOfferForm((current) => ({
      ...current,
      items: [
        ...(current.items || []),
        {
          localId: `offer-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          menu_item: items[0]?.id ? String(items[0].id) : "",
          quantity: 1,
        },
      ],
    }));
  };

  const updateOfferItem = (localId, field, value) => {
    setOfferForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeOfferItem = (localId) => {
    setOfferForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.localId !== localId),
    }));
  };

  const handleCreateOffer = async (event) => {
    event.preventDefault();
    setOfferSubmitting(true);
    showBanner("", "");
    try {
      const payload = normalizeOfferPayload(offerForm);
      const res = await authFetch(editingOfferId ? `${OFFERS_API}${editingOfferId}/` : OFFERS_API, {
        method: editingOfferId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseResponse(res);
      if (res.ok) {
        showBanner("success", editingOfferId ? "Offer updated." : "Offer created.");
        resetOfferForm();
        await fetchOffers();
        await fetchMenu();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (error) {
      console.error(error);
      showBanner("error", "Network error.");
    } finally {
      setOfferSubmitting(false);
    }
  };

  const openOfferEdit = (offer) => {
    setEditingOfferId(offer.id);
    setOfferForm(buildOfferFormFromOffer(offer));
    window.requestAnimationFrame(() => {
      offersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const toggleOfferStatus = async (offer) => {
    setOfferSubmitting(true);
    showBanner("", "");
    try {
      const res = await authFetch(`${OFFERS_API}${offer.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !offer.is_active }),
      });
      const data = await parseResponse(res);
      if (res.ok) {
        showBanner("success", `Offer ${data?.is_active ? "activated" : "paused"}.`);
        await fetchOffers();
        await fetchMenu();
      } else {
        showBanner("error", parseErrorPayload(data));
      }
    } catch (error) {
      console.error(error);
      showBanner("error", "Network error.");
    } finally {
      setOfferSubmitting(false);
    }
  };

  const deleteOffer = async (offer) => {
    setConfirmState({
      title: `Delete offer "${offer.name}"?`,
      description: "This offer will be removed from the customer menu and pricing rules.",
      confirmLabel: "Delete offer",
      tone: "danger",
      meta: [offer.name, offer.offer_type],
      onConfirm: async () => {
        setOfferSubmitting(true);
        showBanner("", "");
        try {
          const res = await authFetch(`${OFFERS_API}${offer.id}/`, { method: "DELETE" });
          if (res.status === 204 || res.ok) {
            showBanner("success", "Offer deleted.");
            await fetchOffers();
            await fetchMenu();
            setConfirmState(null);
          } else {
            const data = await parseResponse(res);
            showBanner("error", parseErrorPayload(data));
          }
        } catch (error) {
          console.error(error);
          showBanner("error", "Network error.");
        } finally {
          setOfferSubmitting(false);
        }
      },
    });
  };

  const renderCustomizationEditor = (form, setter) => (
    <section className="admin-menu-custom-card">
      <div className="admin-menu-custom-head">
        <div>
          <h3>Item customization</h3>
          <p>Create spice levels, toppings, required choices, and add-on prices.</p>
        </div>
        <button type="button" className="admin-menu-btn admin-menu-btn--secondary admin-menu-btn--sm" onClick={() => addCustomizationGroup(setter)}>
          <Plus size={14} aria-hidden />
          Add group
        </button>
      </div>

      {!form.customization_groups?.length ? (
        <div className="admin-menu-custom-empty">No option groups yet. Add a group to let customers customize this dish.</div>
      ) : (
        <div className="admin-menu-custom-stack">
          {form.customization_groups.map((group) => (
            <article key={group.localId} className="admin-menu-custom-group">
              <div className="admin-menu-custom-group-head">
                <h4>{group.name?.trim() || "New option group"}</h4>
                <button
                  type="button"
                  className="admin-menu-btn admin-menu-btn--danger admin-menu-btn--sm"
                  onClick={() => removeCustomizationGroup(setter, group.localId)}
                >
                  Remove
                </button>
              </div>
              <div className="admin-menu-custom-grid">
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Group name</span>
                  <input
                    className="admin-menu-input"
                    value={group.name}
                    onChange={(event) => updateCustomizationGroup(setter, group.localId, "name", event.target.value)}
                    placeholder="e.g. Spice level"
                  />
                </label>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Selection type</span>
                  <select
                    className="admin-menu-input admin-menu-select"
                    value={group.selection_mode}
                    onChange={(event) =>
                      updateCustomizationGroup(setter, group.localId, "selection_mode", event.target.value)
                    }
                  >
                    <option value="single">Single choice</option>
                    <option value="multiple">Multiple choice</option>
                  </select>
                </label>
                <div className="admin-menu-field admin-menu-field--switch">
                  <span className="admin-menu-label">Required</span>
                  <label className="admin-menu-switch">
                    <input
                      type="checkbox"
                      checked={group.is_required}
                      onChange={(event) =>
                        updateCustomizationGroup(setter, group.localId, "is_required", event.target.checked)
                      }
                    />
                    <span className="admin-menu-switch-ui" />
                    <span className="admin-menu-switch-text">{group.is_required ? "Required" : "Optional"}</span>
                  </label>
                </div>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Max choices</span>
                  <input
                    type="number"
                    min="1"
                    className="admin-menu-input"
                    value={group.selection_mode === "single" ? 1 : group.max_select}
                    onChange={(event) =>
                      updateCustomizationGroup(setter, group.localId, "max_select", event.target.value)
                    }
                    disabled={group.selection_mode === "single"}
                  />
                </label>
              </div>

              <div className="admin-menu-custom-options">
                {group.options.map((option) => (
                  <div key={option.localId} className="admin-menu-custom-option">
                    <input
                      className="admin-menu-input"
                      value={option.name}
                      onChange={(event) =>
                        updateCustomizationOption(
                          setter,
                          group.localId,
                          option.localId,
                          "name",
                          event.target.value
                        )
                      }
                      placeholder="Option name"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="admin-menu-input"
                      value={option.price_delta}
                      onChange={(event) =>
                        updateCustomizationOption(
                          setter,
                          group.localId,
                          option.localId,
                          "price_delta",
                          event.target.value
                        )
                      }
                      placeholder="Extra price"
                    />
                    <button
                      type="button"
                      className="admin-menu-btn admin-menu-btn--ghost admin-menu-btn--sm"
                      onClick={() => removeCustomizationOption(setter, group.localId, option.localId)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="admin-menu-btn admin-menu-btn--ghost admin-menu-btn--sm"
                onClick={() => addCustomizationOption(setter, group.localId)}
              >
                <Plus size={14} aria-hidden />
                Add option
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );

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
            Build sellable dishes, attach real customer customizations, and publish backend-driven offers that the
            ordering system can price correctly.
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
          <div className="admin-menu-stat">
            <Gift size={18} strokeWidth={2} aria-hidden />
            <div>
              <span className="admin-menu-stat-value">{offers.length}</span>
              <span className="admin-menu-stat-label">Offers</span>
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
                <p className="admin-menu-surface-desc">
                  Same name + category can repeat with different variants and customization groups.
                </p>
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
                    onChange={handleFormChange(setAddForm)}
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
                    onChange={handleFormChange(setAddForm)}
                    placeholder="e.g. Small, Medium, Large"
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
                      value={addForm.price}
                      onChange={handleFormChange(setAddForm)}
                      required
                    />
                  </label>
                  <div className="admin-menu-field admin-menu-field--switch">
                    <span className="admin-menu-label">Available</span>
                    <label className="admin-menu-switch">
                      <input
                        type="checkbox"
                        name="available"
                        checked={addForm.available}
                        onChange={handleFormChange(setAddForm)}
                      />
                      <span className="admin-menu-switch-ui" />
                      <span className="admin-menu-switch-text">{addForm.available ? "Available" : "Hidden"}</span>
                    </label>
                  </div>
                </div>

                <label className="admin-menu-field">
                  <span className="admin-menu-label">Description</span>
                  <textarea
                    name="description"
                    className="admin-menu-input admin-menu-textarea"
                    rows={3}
                    value={addForm.description}
                    onChange={handleFormChange(setAddForm)}
                    placeholder="Ingredients, spice level, or what makes it special…"
                  />
                </label>

                <label className="admin-menu-field">
                  <span className="admin-menu-label">Category</span>
                  <select
                    name="category"
                    className="admin-menu-input admin-menu-select"
                    value={addForm.category}
                    onChange={handleFormChange(setAddForm)}
                    required
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {renderCustomizationEditor(addForm, setAddForm)}

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
                <button type="button" className="admin-menu-upload-btn" onClick={() => addFileRef.current?.click()}>
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
                <button
                  type="submit"
                  className="admin-menu-btn admin-menu-btn--primary admin-menu-btn--lg"
                  disabled={submitting}
                >
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

          <section ref={offersSectionRef} className="admin-menu-surface">
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
                onChange={(event) => setNewCategoryName(event.target.value)}
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
              {categories.map((category) => (
                <div key={category.id} className="admin-menu-tab-wrap">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={String(activeCategoryId) === String(category.id)}
                    className={String(activeCategoryId) === String(category.id) ? "active" : ""}
                    onClick={() => setActiveCategoryId(String(category.id))}
                  >
                    {category.name}
                  </button>
                  <button
                    type="button"
                    className="admin-menu-tab-delete"
                    title="Delete category"
                    onClick={() => handleDeleteCategory(category)}
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
                placeholder="Search by name, variant, or description…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
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
                    {item.description?.trim() ? <p className="admin-menu-item-desc">{item.description.trim()}</p> : null}
                    <p className="admin-menu-item-price">Rs. {Number(item.price).toFixed(2)}</p>
                    {Number(item.customer_price ?? item.price) < Number(item.price) ? (
                      <p className="admin-menu-item-price-note">
                        Live offer price: Rs. {Number(item.customer_price).toFixed(2)}
                      </p>
                    ) : null}
                    <div className="admin-menu-card-meta">
                      <span className="admin-menu-badge admin-menu-badge--cat">{item.category_name}</span>
                      <span className="admin-menu-badge admin-menu-badge--soft">{customizationSummary(item)}</span>
                    </div>
                    {item.offer_badges?.length ? (
                      <div className="admin-menu-card-badges">
                        {item.offer_badges.slice(0, 2).map((badge) => (
                          <span key={`${item.id}-${badge.offer_type}-${badge.label}`} className="admin-menu-badge admin-menu-badge--accent">
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
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

          <section className="admin-menu-surface">
            <div className="admin-menu-surface-head">
              <Gift size={20} className="admin-menu-surface-icon" aria-hidden />
              <div>
                <h2 className="admin-menu-surface-title">Special offers & meals</h2>
                <p className="admin-menu-surface-desc">
                  Create fixed discounts, percentage offers, and combo meals that the backend can validate and price.
                </p>
              </div>
            </div>

            <form className="admin-menu-offer-form" onSubmit={handleCreateOffer}>
              {editingOfferId ? (
                <div className="admin-menu-offer-editing">
                  <div>
                    <strong>Editing offer</strong>
                    <p>Update the timing, included dishes, or pricing and save to publish the changes.</p>
                  </div>
                  <button
                    type="button"
                    className="admin-menu-btn admin-menu-btn--ghost admin-menu-btn--sm"
                    onClick={resetOfferForm}
                  >
                    Cancel edit
                  </button>
                </div>
              ) : null}
              <div className="admin-menu-offer-grid">
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Offer name</span>
                  <input
                    name="name"
                    className="admin-menu-input"
                    value={offerForm.name}
                    onChange={updateOfferField}
                    placeholder="e.g. Lunch combo"
                    required
                  />
                </label>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Type</span>
                  <select
                    name="offer_type"
                    className="admin-menu-input admin-menu-select"
                    value={offerForm.offer_type}
                    onChange={updateOfferField}
                  >
                    <option value="fixed">Fixed discount</option>
                    <option value="percentage">Percentage discount</option>
                    <option value="combo">Combo / special meal</option>
                  </select>
                </label>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Badge text</span>
                  <input
                    name="badge_text"
                    className="admin-menu-input"
                    value={offerForm.badge_text}
                    onChange={updateOfferField}
                    placeholder="e.g. Chef special"
                  />
                </label>
                <div className="admin-menu-field admin-menu-field--switch">
                  <span className="admin-menu-label">Active</span>
                  <label className="admin-menu-switch">
                    <input type="checkbox" name="is_active" checked={offerForm.is_active} onChange={updateOfferField} />
                    <span className="admin-menu-switch-ui" />
                    <span className="admin-menu-switch-text">{offerForm.is_active ? "Active" : "Paused"}</span>
                  </label>
                </div>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Start date</span>
                  <input
                    type="datetime-local"
                    name="starts_at"
                    className="admin-menu-input"
                    value={offerForm.starts_at}
                    onChange={updateOfferField}
                  />
                </label>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">End date</span>
                  <input
                    type="datetime-local"
                    name="ends_at"
                    className="admin-menu-input"
                    value={offerForm.ends_at}
                    onChange={updateOfferField}
                  />
                </label>
                {offerForm.offer_type === "fixed" ? (
                  <label className="admin-menu-field">
                    <span className="admin-menu-label">Fixed discount (Rs.)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="fixed_discount_amount"
                      className="admin-menu-input"
                      value={offerForm.fixed_discount_amount}
                      onChange={updateOfferField}
                    />
                  </label>
                ) : null}
                {offerForm.offer_type === "percentage" ? (
                  <label className="admin-menu-field">
                    <span className="admin-menu-label">Percentage discount</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="0.01"
                      name="percentage_discount"
                      className="admin-menu-input"
                      value={offerForm.percentage_discount}
                      onChange={updateOfferField}
                    />
                  </label>
                ) : null}
                {offerForm.offer_type === "combo" ? (
                  <label className="admin-menu-field">
                    <span className="admin-menu-label">Combo price (Rs.)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="combo_price"
                      className="admin-menu-input"
                      value={offerForm.combo_price}
                      onChange={updateOfferField}
                    />
                  </label>
                ) : null}
              </div>

              <label className="admin-menu-field">
                <span className="admin-menu-label">Description</span>
                <textarea
                  name="description"
                  className="admin-menu-input admin-menu-textarea"
                  rows={3}
                  value={offerForm.description}
                  onChange={updateOfferField}
                  placeholder="What should customers know about this offer?"
                />
              </label>

              <div className="admin-menu-offer-items">
                <div className="admin-menu-custom-head">
                  <div>
                    <h3>Applies to</h3>
                    <p>Select dishes for the discount or combo.</p>
                  </div>
                  <button type="button" className="admin-menu-btn admin-menu-btn--secondary admin-menu-btn--sm" onClick={addOfferItem}>
                    <Plus size={14} aria-hidden />
                    Add item
                  </button>
                </div>
                {(offerForm.items || []).map((item) => (
                  <div key={item.localId} className="admin-menu-offer-item-row">
                    <select
                      className="admin-menu-input admin-menu-select"
                      value={item.menu_item}
                      onChange={(event) => updateOfferItem(item.localId, "menu_item", event.target.value)}
                    >
                      <option value="" disabled>
                        Choose a menu item
                      </option>
                      {items.map((menuItem) => (
                        <option key={menuItem.id} value={menuItem.id}>
                          {itemDisplayName(menuItem)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      className="admin-menu-input"
                      value={item.quantity}
                      onChange={(event) => updateOfferItem(item.localId, "quantity", event.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-menu-btn admin-menu-btn--ghost admin-menu-btn--sm"
                      onClick={() => removeOfferItem(item.localId)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="admin-menu-form-footer">
                <button type="submit" className="admin-menu-btn admin-menu-btn--primary" disabled={offerSubmitting}>
                  {offerSubmitting ? (
                    <>
                      <span className="admin-menu-btn-spinner-el" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    editingOfferId ? "Save offer changes" : "Create offer"
                  )}
                </button>
              </div>
            </form>

            <div className="admin-menu-offer-list">
              {offers.length === 0 ? (
                <div className="admin-menu-custom-empty">No offers yet. Create one to highlight specials on the customer menu.</div>
              ) : (
                offers.map((offer) => (
                  <article key={offer.id} className="admin-menu-offer-card">
                    <div className="admin-menu-offer-card-head">
                      <div>
                        <h3>{offer.name}</h3>
                        <p>{offerSummary(offer)}</p>
                      </div>
                      <span className={`admin-menu-badge ${offer.is_currently_valid ? "admin-menu-badge--accent" : "admin-menu-badge--soft"}`}>
                        {offer.is_currently_valid ? "Live" : offer.is_active ? "Scheduled / expired" : "Paused"}
                      </span>
                    </div>
                    {offer.badge_text ? <p className="admin-menu-offer-badge-line">Badge: {offer.badge_text}</p> : null}
                    <div className="admin-menu-offer-card-meta">
                      {offer.starts_at ? <span>Starts {toDateTimeLocal(offer.starts_at).replace("T", " ")}</span> : <span>Starts anytime</span>}
                      {offer.ends_at ? <span>Ends {toDateTimeLocal(offer.ends_at).replace("T", " ")}</span> : <span>No end date</span>}
                    </div>
                    <div className="admin-menu-offer-tags">
                      {(offer.items || []).map((offerItem) => (
                        <span key={`${offer.id}-${offerItem.id || offerItem.menu_item}`} className="admin-menu-badge admin-menu-badge--soft">
                          {offerItem.menu_item_display_name} × {offerItem.quantity}
                        </span>
                      ))}
                    </div>
                    <div className="admin-menu-item-actions">
                      <button
                        type="button"
                        className="admin-menu-btn admin-menu-btn--ghost admin-menu-btn--sm"
                        onClick={() => openOfferEdit(offer)}
                        disabled={offerSubmitting}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-menu-btn admin-menu-btn--ghost admin-menu-btn--sm"
                        onClick={() => toggleOfferStatus(offer)}
                        disabled={offerSubmitting}
                      >
                        {offer.is_active ? "Pause" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="admin-menu-btn admin-menu-btn--danger admin-menu-btn--sm"
                        onClick={() => deleteOffer(offer)}
                        disabled={offerSubmitting}
                      >
                        <Trash2 size={14} aria-hidden />
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
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
                  <input name="name" className="admin-menu-input" value={editForm.name} onChange={handleFormChange(setEditForm)} required />
                </label>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Size / variant</span>
                  <input
                    name="variant_label"
                    className="admin-menu-input"
                    value={editForm.variant_label}
                    onChange={handleFormChange(setEditForm)}
                    placeholder="e.g. Small"
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
                      onChange={handleFormChange(setEditForm)}
                      required
                    />
                  </label>
                  <div className="admin-menu-field admin-menu-field--switch">
                    <span className="admin-menu-label">Available</span>
                    <label className="admin-menu-switch">
                      <input type="checkbox" name="available" checked={editForm.available} onChange={handleFormChange(setEditForm)} />
                      <span className="admin-menu-switch-ui" />
                      <span className="admin-menu-switch-text">{editForm.available ? "Available" : "Hidden"}</span>
                    </label>
                  </div>
                </div>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Description</span>
                  <textarea
                    name="description"
                    className="admin-menu-input admin-menu-textarea"
                    rows={3}
                    value={editForm.description}
                    onChange={handleFormChange(setEditForm)}
                  />
                </label>
                <label className="admin-menu-field">
                  <span className="admin-menu-label">Category</span>
                  <select
                    name="category"
                    className="admin-menu-input admin-menu-select"
                    value={editForm.category}
                    onChange={handleFormChange(setEditForm)}
                    required
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {renderCustomizationEditor(editForm, setEditForm)}

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

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        meta={confirmState?.meta || []}
        busy={categorySubmitting || offerSubmitting}
        onCancel={() => {
          if (categorySubmitting || offerSubmitting) return;
          setConfirmState(null);
        }}
        onConfirm={() => confirmState?.onConfirm?.()}
      />
    </div>
  );
}
