import "./subscriptions.css";

export default function Subscriptions() {

  const plans = [
    { name: "Basic", price: "$10", users: 10 },
    { name: "Pro", price: "$30", users: 50 },
    { name: "Enterprise", price: "$99", users: "Unlimited" },
  ];

  return (
    <div className="subscriptions-page">

      <h2>Subscriptions</h2>

      <div className="plans">
        {plans.map((plan, i) => (
          <div className="plan-card" key={i}>

            <h3>{plan.name}</h3>
            <h1>{plan.price}</h1>

            <p>{plan.users} users</p>

            <button>Select Plan</button>

          </div>
        ))}
      </div>

    </div>
  );
}