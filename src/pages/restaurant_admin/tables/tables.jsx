import { useEffect, useState } from "react";
import "./tables.css";

export default function Tables() {

  const API = "http://127.0.0.1:8000/api/tables/tables/";
  const token = localStorage.getItem("token");

  const [tables, setTables] = useState([]);
  const [number, setNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  // ✅ FETCH TABLES
  const fetchTables = async () => {
    const res = await fetch(API, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setTables(data);
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // ✅ ADD TABLE
  const addTable = async () => {
    if (!number) return;

    if (tables.find(t => t.number === Number(number))) {
      alert("Table already exists");
      return;
    }

    await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        number: Number(number),
      }),
    });

    setNumber("");
    fetchTables();
  };

  // ✅ DELETE TABLE
  const deleteTable = async (id) => {
    await fetch(API + id + "/", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    fetchTables();
  };

  return (
    <div className="tables-container">

      <h1 className="tables-header">Table Management</h1>

      {/* FORM */}
      <div className="tables-form">
        <input
          className="tables-input"
          type="number"
          placeholder="Enter table number..."
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />

        <button className="tables-add-btn" onClick={addTable}>
          + Add Table
        </button>
      </div>

      {/* GRID */}
      <div className="tables-grid">

        {tables.length === 0 ? (
          <p>No tables yet. Add one </p>
        ) : (
          tables.map((table) => (
            <div key={table.id} className="table-card">

              <div className="table-number">
                🍽 Table {table.number}
              </div>

              <div className="table-actions">

                <button
                  className="qr-btn"
                  onClick={() => setSelectedTable(table)}
                >
                  View QR
                </button>

                <button
                  className="delete-btn"
                  onClick={() => deleteTable(table.id)}
                >
                  Delete
                </button>

              </div>

            </div>
          ))
        )}

      </div>

      {/* QR MODAL */}
      {selectedTable && (
        <div className="qr-modal">
          <div className="qr-content">

            <h2>Table {selectedTable.number}</h2>

            {/* ⚠️ TEMP FIX */}
            <p>QR Code ID:</p>
            <code>{selectedTable.qr_code}</code>

            <p className="qr-note">
              (Next step: convert this to actual QR image)
            </p>

            <button
              className="close-btn"
              onClick={() => setSelectedTable(null)}
            >
              Close
            </button>

          </div>
        </div>
      )}

    </div>
  );
}