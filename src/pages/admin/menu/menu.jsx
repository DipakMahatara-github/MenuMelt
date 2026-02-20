import { useState } from "react";
import "./menu.css";

export default function Menu() {

  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "Main",
    image: "",
    available: true,
  });

  /* ================= HANDLE INPUT ================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({
        ...form,
        image: URL.createObjectURL(file),
      });
    }
  };

  /* ================= ADD ITEM ================= */

  const handleAdd = (e) => {
    e.preventDefault();

    if (!form.name || !form.price) return;

    setItems([...items, { ...form, id: Date.now() }]);

    resetForm();
  };

  /* ================= DELETE ================= */

  const handleDelete = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  /* ================= EDIT ================= */

  const handleEdit = (item) => {
    setEditing(item.id);
    setForm(item);
  };

  const handleUpdate = (e) => {
    e.preventDefault();

    setItems(
      items.map((item) =>
        item.id === editing ? { ...form, id: editing } : item
      )
    );

    resetForm();
    setEditing(null);
  };

  /* ================= RESET ================= */

  const resetForm = () => {
    setForm({
      name: "",
      price: "",
      category: "Main",
      image: "",
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
              <img src={item.image} alt={item.name} />
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
