import { useEffect, useState } from "react";
import "./AdminMenu.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function AdminMenu() {

  const API = `${API_BASE}/api/menu/`;

  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "Main",
    image: null,
    available: true,
  });

  // ================= FETCH MENU =================
  const fetchMenu = async () => {
    try {
      const res = await authFetch(API);

      const data = await res.json();
      console.log("FETCH MENU:", data);

      if (res.ok && Array.isArray(data)) {
        setItems(data);
      } else {
        // Never keep stale items from a previous session/user.
        setItems([]);
      }

    } catch (err) {
      console.error("Fetch error:", err);
      setItems([]);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // ================= FORM HANDLING =================
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleImage = (e) => {
    setForm({ ...form, image: e.target.files[0] });
  };

  // ================= ADD ITEM =================
  const handleAdd = async (e) => {
    e.preventDefault();

    const formData = new FormData();

    formData.append("name", form.name);
    formData.append("description", form.description);
    formData.append("price", parseFloat(form.price));
    formData.append("category", form.category);
    formData.append("available", form.available ? "true" : "false");

    if (form.image instanceof File) {
      formData.append("image", form.image);
    }

    try {
      const res = await authFetch(API, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      console.log("ADD STATUS:", res.status);
      console.log("ADD RESPONSE:", data);

      if (res.status === 201) {
        fetchMenu();
        resetForm();
      } else {
        alert(JSON.stringify(data));
      }

    } catch (err) {
      console.error("Add error:", err);
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    await authFetch(API + id + "/", {
      method: "DELETE",
    });

    fetchMenu();
  };

  // ================= EDIT =================
  const handleEdit = (item) => {
    setEditing(item.id);
    setForm({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image: null,
      available: item.available,
    });
  };

  // ================= UPDATE =================
  const handleUpdate = async (e) => {
    e.preventDefault();

    const formData = new FormData();

    formData.append("name", form.name);
    formData.append("description", form.description);
    formData.append("price", parseFloat(form.price));
    formData.append("category", form.category);
    formData.append("available", form.available ? "true" : "false");

    if (form.image instanceof File) {
      formData.append("image", form.image);
    }

    const res = await authFetch(API + editing + "/", {
      method: "PUT",
      body: formData,
    });

    console.log("UPDATE STATUS:", res.status);

    setEditing(null);
    resetForm();
    fetchMenu();
  };

  // ================= RESET =================
  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      price: "",
      category: "Main",
      image: null,
      available: true,
    });
  };

  // ================= UI =================
  return (
    <div className="menu-container">
      <h2>Menu Management</h2>

      {/* FORM */}
      <form className="menu-form" onSubmit={editing ? handleUpdate : handleAdd}>

        <input
          name="name"
          placeholder="Food Name"
          value={form.name}
          onChange={handleChange}
          required
        />

        <input
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
        />

        <input
          type="number"
          name="price"
          placeholder="Price"
          value={form.price}
          onChange={handleChange}
          required
        />

        <select name="category" value={form.category} onChange={handleChange}>
          <option>Main</option>
          <option>Drinks</option>
          <option>Dessert</option>
          <option>Snacks</option>
        </select>

        <input type="file" onChange={handleImage} />

        <label>
          <input
            type="checkbox"
            name="available"
            checked={form.available}
            onChange={handleChange}
          />
          Available
        </label>

        <button type="submit">
          {editing ? "Update Item" : "Add Item"}
        </button>
      </form>

      {/* MENU GRID */}
      <div className="menu-grid">
        {items.length === 0 ? (
          <p>No menu items yet</p>
        ) : (
          items.map((item) => (
            <div className="menu-card" key={item.id}>

              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                />
              )}

              <h3>{item.name}</h3>
              <p>{item.category}</p>
              <p>Rs. {item.price}</p>

              <span className={`badge ${item.available ? "available" : "unavailable"}`}>
                {item.available ? "Available" : "Unavailable"}
              </span>

              <div className="card-actions">
                <button onClick={() => handleEdit(item)}>Edit</button>
                <button onClick={() => handleDelete(item.id)}>Delete</button>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}