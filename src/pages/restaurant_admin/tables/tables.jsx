import { useEffect, useState } from "react";
import "./tables.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function Tables() {

  const API = `${API_BASE}/api/tables/tables/`;

  const [tables, setTables] = useState([]);
  const [number, setNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  // ✅ FETCH TABLES
  const fetchTables = async () => {
    const res = await authFetch(API);

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

    await authFetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    await authFetch(API + id + "/", {
      method: "DELETE",
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