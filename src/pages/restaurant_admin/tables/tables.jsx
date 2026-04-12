import { useEffect, useState } from "react";
import "./tables.css";
import { authFetch, API_BASE } from "../../../lib/api";

export default function Tables() {

  const API = `${API_BASE}/api/tables/tables/`;

  const [tables, setTables] = useState([]);
  const getQrImageUrl = (qrImagePath) => {
    if (!qrImagePath) return null;
    if (qrImagePath.startsWith("http://") || qrImagePath.startsWith("https://")) {
      return qrImagePath;
    }
    return `${API_BASE}${qrImagePath}`;
  };

  const [number, setNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  // ✅ FETCH TABLES
  const fetchTables = async () => {
    try {
      const res = await authFetch(API);
      const data = await res.json();

      const tableList = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      setTables(tableList);
    } catch (error) {
      console.error("Failed to fetch tables:", error);
      setTables([]);
    }
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
    <div className="mm-tables">
      <header className="mm-tables__hero">
        <p className="mm-tables__eyebrow">Floor</p>
        <h1 className="mm-tables__title">Table management</h1>
        <p className="mm-tables__lead">
          Create numbered tables and share QR codes so guests open your menu instantly.
        </p>
      </header>

      <div className="mm-tables__toolbar">
        <input
          className="mm-tables__input"
          type="number"
          min={1}
          placeholder="Table number…"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <button type="button" className="mm-tables__add" onClick={addTable}>
          Add table
        </button>
      </div>

      <div className="mm-tables__grid">
        {tables.length === 0 ? (
          <p className="mm-tables__empty">No tables yet. Add a number above to get started.</p>
        ) : (
          tables.map((table) => (
            <div key={table.id} className="mm-tables__card">
              <div className="mm-tables__card-label">
                <span className="mm-tables__card-icon" aria-hidden>
                  ◈
                </span>
                Table {table.number}
              </div>
              <div className="mm-tables__actions">
                <button
                  type="button"
                  className="mm-tables__btn mm-tables__btn--qr"
                  onClick={() => setSelectedTable(table)}
                >
                  View QR
                </button>
                <button
                  type="button"
                  className="mm-tables__btn mm-tables__btn--delete"
                  onClick={() => deleteTable(table.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTable && (
        <div
          className="mm-tables__modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mm-tables-qr-title"
          onClick={() => setSelectedTable(null)}
          onKeyDown={(e) => e.key === "Escape" && setSelectedTable(null)}
        >
          <div
            className="mm-tables__modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mm-tables-qr-title">Table {selectedTable.number}</h2>
            <p className="mm-tables__modal-note">Scan to open the menu</p>
            <div>
              {selectedTable.qr_image ? (
                <img
                  src={getQrImageUrl(selectedTable.qr_image)}
                  alt={`QR code for table ${selectedTable.number}`}
                  className="mm-tables__qr"
                />
              ) : (
                <p className="mm-tables__modal-note">
                  QR image is not available for this table.
                </p>
              )}
            </div>
            <p className="mm-tables__modal-note">
              Guests scan this code to browse and order.
            </p>
            <button
              type="button"
              onClick={() => setSelectedTable(null)}
              className="mm-tables__close"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}