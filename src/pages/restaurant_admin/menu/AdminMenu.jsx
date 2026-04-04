import { useEffect, useState } from "react";
import "./AdminMenu.css";

export default function AdminMenu() {

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

  const fetchMenu = async () => {
    const res = await fetch(API);
    const data = await res.json();
    setItems(data);
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) setForm({ ...form, image: file });
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    Object.keys(form).forEach((key) => {
      if (form[key] !== null) formData.append(key, form[key]);
    });

    await fetch(API, { method: "POST", body: formData });

    fetchMenu();
    resetForm();
  };

  const handleDelete = async (id) => {
    await fetch(API + id + "/", { method: "DELETE" });
    fetchMenu();
  };

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

  const handleUpdate = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    Object.keys(form).forEach((key) => {
      if (form[key] !== null) formData.append(key, form[key]);
    });

    await fetch(API + editing + "/", {
      method: "PUT",
      body: formData,
    });

    setEditing(null);
    resetForm();
    fetchMenu();
  };

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

  return (
    <div className="menu-container">
      <h2>Menu Management</h2>

      <form
        className="menu-form"
        onSubmit={editing ? handleUpdate : handleAdd}
      >

        <input name="name" placeholder="Food Name" value={form.name} onChange={handleChange} />
        <input name="description" placeholder="Description" value={form.description} onChange={handleChange} />
        <input type="number" name="price" placeholder="Price" value={form.price} onChange={handleChange} />

        <select name="category" value={form.category} onChange={handleChange}>
          <option>Main</option>
          <option>Drinks</option>
          <option>Dessert</option>
          <option>Snacks</option>
        </select>

        <input type="file" onChange={handleImage} />

        <label>
          <input type="checkbox" name="available" checked={form.available} onChange={handleChange} />
          Available
        </label>

        <button type="submit">
          {editing ? "Update Item" : "Add Item"}
        </button>
      </form>

      <div className="menu-grid">
        {items.map((item) => (
          <div className="menu-card" key={item.id}>
            {item.image && <img src={item.image} alt={item.name} />}
            <h3>{item.name}</h3>
            <p>{item.category}</p>
            <p>Rs. {item.price}</p>

            <button onClick={() => handleEdit(item)}>Edit</button>
            <button onClick={() => handleDelete(item.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}