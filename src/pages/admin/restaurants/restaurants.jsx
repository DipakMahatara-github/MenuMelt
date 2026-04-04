import "./restaurants.css";

export default function Restaurants() {

  const restaurants = [
    { name: "Pizza Hub", status: "active" },
    { name: "Burger King", status: "inactive" },
  ];

  return (
    <div className="restaurants-page">

      <h2>Restaurants</h2>

      <div className="grid">
        {restaurants.map((r, i) => (
          <div className="restaurant-card" key={i}>

            <h3>{r.name}</h3>

            <span className={`status ${r.status}`}>
              {r.status}
            </span>

            <div className="actions">
              <button>View</button>
              <button className="danger">Disable</button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}