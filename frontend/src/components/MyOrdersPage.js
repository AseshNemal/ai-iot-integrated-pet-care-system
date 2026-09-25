import { useCallback, useMemo, useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { ArrowRightIcon, BagIcon, PawIcon } from "./homeIcons";
import "../myOrderPage.css";

const PackageIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m4 7.5 8-4 8 4-8 4-8-4Z" />
    <path d="M4 7.5v9l8 4 8-4v-9M12 11.5v9M8 5.5l8 4" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
    <path d="M8 3v5M16 3v5M3.5 10h17" />
  </svg>
);

const SortIcon = ({ direction }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {direction === "desc" ? <path d="M8 5v14m0 0-3-3m3 3 3-3M15 7h5M15 12h4M15 17h3" /> : <path d="M8 19V5m0 0L5 8m3-3 3 3M15 7h3M15 12h4M15 17h5" />}
  </svg>
);

const formatPrice = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const formatOrderDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return { date: "Date unavailable", time: "" };

  return {
    date: date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    time: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
};

const formatOrderId = (id = "") => id.slice(-6).toUpperCase() || "------";

const MyOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [sortDirection, setSortDirection] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    setSignedOut(false);

    try {
      const sessionResponse = await fetch(`${API_BASE_URL}/get-session`, {
        credentials: "include",
      });

      if (!sessionResponse.ok) throw new Error("Session request failed");
      const session = await sessionResponse.json();

      if (!session.user?._id) {
        setSignedOut(true);
        setOrders([]);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/order/user/${session.user._id}`, {
        withCredentials: true,
      });
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (loadError) {
      console.error("Error fetching orders:", loadError);
      setError("We couldn't load your order history right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortDirection === "desc" ? dateB - dateA : dateA - dateB;
    }),
    [orders, sortDirection]
  );

  const summary = useMemo(() => orders.reduce(
    (totals, order) => ({
      spent: totals.spent + Number(order.totalAmount || 0),
      items: totals.items + (order.items || []).reduce((count, item) => count + Number(item.quantity || 0), 0),
    }),
    { spent: 0, items: 0 }
  ), [orders]);

  return (
    <main className="orders-page">
      <section className="orders-hero">
        <div className="orders-shell orders-hero__inner">
          <div className="orders-hero__copy">
            <p className="orders-kicker">Order history</p>
            <h1>Everything you've picked for your pet.</h1>
            <p>Review past purchases, see what was in each order, and head back to the shop whenever it is time to restock.</p>
          </div>
          <Link to="/product/all" className="orders-shop-link">
            <BagIcon />
            Continue shopping
            <ArrowRightIcon />
          </Link>
        </div>
      </section>

      <section className="orders-content" aria-labelledby="orders-title">
        <div className="orders-shell">
          <div className="orders-section-heading">
            <div>
              <p className="orders-kicker">Your purchases</p>
              <h2 id="orders-title">My orders</h2>
            </div>
            {!loading && !error && !signedOut && orders.length > 1 && (
              <button
                className="orders-sort-button"
                type="button"
                onClick={() => setSortDirection((current) => current === "desc" ? "asc" : "desc")}
                aria-label={`Show ${sortDirection === "desc" ? "oldest" : "newest"} orders first`}
              >
                <SortIcon direction={sortDirection} />
                {sortDirection === "desc" ? "Newest first" : "Oldest first"}
              </button>
            )}
          </div>

          {!loading && !error && !signedOut && orders.length > 0 && (
            <div className="orders-summary" aria-label="Order summary">
              <div>
                <span>Orders placed</span>
                <strong>{orders.length}</strong>
              </div>
              <div>
                <span>Items ordered</span>
                <strong>{summary.items}</strong>
              </div>
              <div>
                <span>Total spent</span>
                <strong>{formatPrice(summary.spent)}</strong>
              </div>
            </div>
          )}

          {loading && (
            <div className="orders-state" role="status">
              <span className="orders-spinner" />
              <h3>Finding your orders…</h3>
              <p>We're gathering your recent purchases.</p>
            </div>
          )}

          {!loading && error && (
            <div className="orders-state orders-state--error" role="alert">
              <PawIcon />
              <h3>Something went off the trail</h3>
              <p>{error}</p>
              <button type="button" onClick={loadOrders}>Try again</button>
            </div>
          )}

          {!loading && !error && signedOut && (
            <div className="orders-state">
              <PackageIcon />
              <h3>Sign in to see your orders</h3>
              <p>Your purchase history is connected to your Pet Wellness Hub account.</p>
              <Link to="/login">Sign in</Link>
            </div>
          )}

          {!loading && !error && !signedOut && orders.length === 0 && (
            <div className="orders-state">
              <PackageIcon />
              <h3>No orders yet</h3>
              <p>When you place an order, its details will appear here for easy reference.</p>
              <Link to="/product/all">Explore the pet store</Link>
            </div>
          )}

          {!loading && !error && !signedOut && orders.length > 0 && (
            <div className="orders-list">
              {sortedOrders.map((order) => {
                const orderDate = formatOrderDate(order.createdAt);
                const items = Array.isArray(order.items) ? order.items : [];

                return (
                  <article key={order._id} className="orders-card">
                    <header className="orders-card__header">
                      <div className="orders-card__identity">
                        <span className="orders-card__icon"><PackageIcon /></span>
                        <div>
                          <p>Order number</p>
                          <h3>#{formatOrderId(order._id)}</h3>
                        </div>
                      </div>
                      <div className="orders-card__meta">
                        <span className="orders-card__status">Order placed</span>
                        <span className="orders-card__date">
                          <CalendarIcon />
                          <span>{orderDate.date}<small>{orderDate.time}</small></span>
                        </span>
                      </div>
                    </header>

                    <div className="orders-card__items">
                      <div className="orders-card__items-heading">
                        <span>Item</span>
                        <span>Line total</span>
                      </div>
                      {items.map((item, index) => (
                        <div key={`${item.productId || item.name}-${index}`} className="orders-item">
                          <span className="orders-item__quantity">{item.quantity || 0}×</span>
                          <div className="orders-item__name">
                            <strong>{item.name || "Pet store item"}</strong>
                            <span>{formatPrice(item.price)} each</span>
                          </div>
                          <strong className="orders-item__total">
                            {formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <footer className="orders-card__footer">
                      <span>{summaryText(items)}</span>
                      <div>
                        <span>Order total</span>
                        <strong>{formatPrice(order.totalAmount)}</strong>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

function summaryText(items) {
  const itemCount = items.reduce((count, item) => count + Number(item.quantity || 0), 0);
  return `${itemCount} item${itemCount === 1 ? "" : "s"} in this order`;
}

export default MyOrdersPage;
