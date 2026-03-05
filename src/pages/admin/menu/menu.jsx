import { useEffect, useState } from "react";
import "./menu.css";

export default function Menu() {

  const API = "http://127.0.0.1:8000/api/menu/";

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

  /* ================= FETCH MENU ================= */

  const fetchMenu = async () => {
    const res = await fetch(API);
    const data = await res.json();
    setItems(data);
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  /* ================= HANDLE INPUT ================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  /* ================= HANDLE IMAGE ================= */

  const handleImage = (e) => {
    const file = e.target.files[0];

    if (file) {
      setForm({
        ...form,
        image: file,
      });
    }
  };

  /* ================= ADD ITEM ================= */

  const handleAdd = async (e) => {
    e.preventDefault();

    const formData = new FormData();

    Object.keys(form).forEach((key) => {
      formData.append(key, form[key]);
    });

    await fetch(API + "create/", {
      method: "POST",
      body: formData,
    });

    fetchMenu();
    resetForm();
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {
    await fetch(API + id + "/edit/", {
      method: "DELETE",
    });

    fetchMenu();
  };

  /* ================= EDIT ================= */

  const handleEdit = (item) => {
    setEditing(item.id);
    setForm({
      ...item,
      image: null, // reset image so new file can be uploaded
    });
  };

  /* ================= UPDATE ================= */

  const handleUpdate = async (e) => {
    e.preventDefault();

    const formData = new FormData();

    Object.keys(form).forEach((key) => {
      if (form[key] !== null) {
        formData.append(key, form[key]);
      }
    });

    await fetch(API + editing + "/edit/", {
      method: "PUT",
      body: formData,
    });

    setEditing(null);
    resetForm();
    fetchMenu();
  };

  /* ================= RESET ================= */

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

  /* ================= UI ================= */

  return (
    <div className="menu-container">

      <h2>Menu Management</h2>

      {/* ===== FORM ===== */}
      <form
        className="menu-form"
        onSubmit={editing ? handleUpdate : handleAdd}
      >

        <input
          type="text"
          name="name"
          placeholder="Food Name"
          value={form.name}
          onChange={handleChange}
        />

        <input
          type="text"
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
        />

        <select
          name="category"
          value={form.category}
          onChange={handleChange}
        >
          <option>Main</option>
          <option>Drinks</option>
          <option>Dessert</option>
          <option>Snacks</option>
        </select>

        {/* IMAGE UPLOAD */}
        <label className="file-upload">
          Upload Image
          <input type="file" onChange={handleImage} hidden />
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            name="available"
            checked={form.available}
            onChange={handleChange}
          />
          Available
        </label>

        <button type="submit" className="add-btn">
          {editing ? "Update Item" : "Add Item"}
        </button>

      </form>

      {/* ===== GRID ===== */}
      <div className="menu-grid">

        {items.map((item) => (
          <div className="menu-card" key={item.id}>

            {item.image && (
              <img
                src={`http://127.0.0.1:8000${item.image}`}
                alt={item.name}
              />
            )}

            <h3>{item.name}</h3>
            <p className="category">{item.category}</p>
            <p className="price">Rs. {item.price}</p>

            <span
              className={
                item.available
                  ? "badge available"
                  : "badge unavailable"
              }
            >
              {item.available ? "Available" : "Unavailable"}
            </span>

            <div className="card-actions">

              <button
                className="edit-btn"
                onClick={() => handleEdit(item)}
              >
                Edit
              </button>

              <button
                className="delete-btn"
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>

            </div>

          </div>
        ))}

      </div>
    </div>
  );
}
