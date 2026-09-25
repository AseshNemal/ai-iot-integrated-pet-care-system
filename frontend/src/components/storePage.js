import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { ArrowRightIcon, BagIcon, PawIcon } from "./homeIcons";
import "../storePage.css";

const SearchIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
  </svg>
);

const formatPrice = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const getImageUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}/${path.replace(/^\//, "")}`;
};

function ProductImage({ product, className = "" }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = getImageUrl(product.image);

  if (!imageUrl || failed) {
    return (
      <div className={`store-product-image store-product-image--placeholder ${className}`} aria-hidden="true">
        <PawIcon />
        <span>Pet Wellness</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={product.name}
      className={`store-product-image ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

const StorePage = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [cart, setCart] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const dialogOpen = Boolean(selectedProduct || showCart);
    if (!dialogOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedProduct(null);
        setShowCart(false);
      }
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedProduct, showCart]);

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_BASE_URL}/product/all`);
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (fetchError) {
      console.error("Error fetching products:", fetchError);
      setError("We couldn't load the shop right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category).filter(Boolean))],
    [products]
  );

  const visibleProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const searchableText = `${product.name || ""} ${product.category || ""} ${product.description || ""}`.toLowerCase();
      return matchesCategory && (!query || searchableText.includes(query));
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "price-low") return Number(a.price) - Number(b.price);
      if (sortBy === "price-high") return Number(b.price) - Number(a.price);
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      return 0;
    });
  }, [activeCategory, products, searchTerm, sortBy]);

  const openProductPopup = (product) => {
    setSelectedProduct(product);
    setQuantity(1);
  };

  const handleQuantityChange = (value) => {
    if (!selectedProduct) return;
    const nextQuantity = Math.max(1, Math.min(Number(value) || 1, selectedProduct.stock));
    setQuantity(nextQuantity);
  };

  const addToCart = () => {
    if (!selectedProduct || selectedProduct.stock === 0 || quantity > selectedProduct.stock) return;

    setCart((currentCart) => {
      const existingProduct = currentCart.find((item) => item._id === selectedProduct._id);
      if (existingProduct) {
        return currentCart.map((item) =>
          item._id === selectedProduct._id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...currentCart, { ...selectedProduct, quantity }];
    });

    setProducts((currentProducts) =>
      currentProducts.map((item) =>
        item._id === selectedProduct._id
          ? { ...item, stock: item.stock - quantity }
          : item
      )
    );
    setSelectedProduct(null);
  };

  const removeFromCart = (productId) => {
    const removedProduct = cart.find((item) => item._id === productId);
    if (!removedProduct) return;

    setCart((currentCart) => currentCart.filter((item) => item._id !== productId));
    setProducts((currentProducts) =>
      currentProducts.map((item) =>
        item._id === productId
          ? { ...item, stock: item.stock + removedProduct.quantity }
          : item
      )
    );
  };

  const totalValue = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <main className="store-page">
      <section className="store-hero">
        <div className="store-shell store-hero__inner">
          <div className="store-hero__copy">
            <p className="store-kicker">Pet Wellness Shop</p>
            <h1>Everyday essentials for happier, healthier pets.</h1>
            <p>
              Thoughtful supplies for play, comfort and care — all in one place,
              right alongside the rest of your pet's wellness routine.
            </p>
          </div>

          <div className="store-hero__actions">
            <button className="store-cart-button" type="button" onClick={() => setShowCart(true)}>
              <span className="store-cart-button__icon">
                <BagIcon />
                {cartItemCount > 0 && <span className="store-cart-button__count">{cartItemCount}</span>}
              </span>
              <span>
                <small>Your cart</small>
                <strong>{cartItemCount ? `${cartItemCount} item${cartItemCount === 1 ? "" : "s"}` : "Ready when you are"}</strong>
              </span>
              <ArrowRightIcon className="store-cart-button__arrow" />
            </button>
            <button className="store-order-link" type="button" onClick={() => navigate("/my-orders")}>
              View my orders
            </button>
          </div>
        </div>
      </section>

      <section className="store-catalog" aria-labelledby="store-catalog-title">
        <div className="store-shell">
          <div className="store-catalog__heading">
            <div>
              <p className="store-kicker">Shop by need</p>
              <h2 id="store-catalog-title">Find their next favorite</h2>
            </div>
            <label className="store-search">
              <SearchIcon />
              <span className="sr-only">Search products</span>
              <input
                type="search"
                placeholder="Search food, toys and care…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search">
                  <CloseIcon />
                </button>
              )}
            </label>
          </div>

          <div className="store-toolbar">
            <div className="store-categories" aria-label="Product categories">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={activeCategory === category ? "is-active" : ""}
                  onClick={() => setActiveCategory(category)}
                  aria-pressed={activeCategory === category}
                >
                  {category}
                </button>
              ))}
            </div>
            <label className="store-sort">
              <span>Sort by</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          {!loading && !error && (
            <p className="store-result-count" aria-live="polite">
              {visibleProducts.length} product{visibleProducts.length === 1 ? "" : "s"}
            </p>
          )}

          {loading && (
            <div className="store-status" role="status">
              <span className="store-spinner" />
              <h3>Stocking the shelves…</h3>
              <p>Gathering the latest products for you.</p>
            </div>
          )}

          {!loading && error && (
            <div className="store-status store-status--error" role="alert">
              <PawIcon />
              <h3>Something went off the trail</h3>
              <p>{error}</p>
              <button type="button" onClick={fetchProducts}>Try again</button>
            </div>
          )}

          {!loading && !error && visibleProducts.length === 0 && (
            <div className="store-status">
              <SearchIcon />
              <h3>No products found</h3>
              <p>Try another search or browse a different category.</p>
              <button type="button" onClick={() => { setSearchTerm(""); setActiveCategory("All"); }}>
                View all products
              </button>
            </div>
          )}

          {!loading && !error && visibleProducts.length > 0 && (
            <div className="store-products-grid">
              {visibleProducts.map((product) => (
                <article key={product._id} className="store-product-card">
                  <button
                    className="store-product-card__visual"
                    type="button"
                    onClick={() => openProductPopup(product)}
                    aria-label={`View ${product.name}`}
                  >
                    <ProductImage product={product} />
                    {product.stock > 0 && product.stock <= 5 && (
                      <span className="store-stock-badge">Only {product.stock} left</span>
                    )}
                    {product.stock === 0 && <span className="store-stock-badge is-out">Out of stock</span>}
                  </button>
                  <div className="store-product-card__body">
                    <p className="store-product-card__category">{product.category}</p>
                    <h3>{product.name}</h3>
                    <p className="store-product-card__description">
                      {product.description || "A practical pick for your pet's everyday routine."}
                    </p>
                    <div className="store-product-card__footer">
                      <strong>{formatPrice(product.price)}</strong>
                      <button
                        type="button"
                        onClick={() => openProductPopup(product)}
                        disabled={product.stock === 0}
                      >
                        {product.stock === 0 ? "Unavailable" : "Add to cart"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedProduct && (
        <div className="store-dialog-backdrop" onMouseDown={() => setSelectedProduct(null)}>
          <div
            className="store-product-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="store-dialog-close" type="button" onClick={() => setSelectedProduct(null)} aria-label="Close product details">
              <CloseIcon />
            </button>
            <div className="store-product-dialog__visual">
              <ProductImage product={selectedProduct} />
            </div>
            <div className="store-product-dialog__content">
              <p className="store-product-card__category">{selectedProduct.category}</p>
              <h2 id="product-dialog-title">{selectedProduct.name}</h2>
              <p className="store-product-dialog__description">
                {selectedProduct.description || "A practical pick for your pet's everyday routine."}
              </p>
              <strong className="store-product-dialog__price">{formatPrice(selectedProduct.price)}</strong>
              <p className={`store-product-dialog__stock ${selectedProduct.stock <= 5 ? "is-low" : ""}`}>
                {selectedProduct.stock > 0 ? `${selectedProduct.stock} in stock` : "Currently out of stock"}
              </p>
              <div className="store-product-dialog__purchase">
                <div className="store-quantity" aria-label="Quantity selector">
                  <button type="button" onClick={() => handleQuantityChange(quantity - 1)} disabled={quantity <= 1} aria-label="Decrease quantity">−</button>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.stock}
                    value={quantity}
                    onChange={(event) => handleQuantityChange(event.target.value)}
                    aria-label="Quantity"
                  />
                  <button type="button" onClick={() => handleQuantityChange(quantity + 1)} disabled={quantity >= selectedProduct.stock} aria-label="Increase quantity">+</button>
                </div>
                <button className="store-primary-button" type="button" onClick={addToCart} disabled={selectedProduct.stock === 0}>
                  <BagIcon />
                  Add to cart · {formatPrice(selectedProduct.price * quantity)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCart && (
        <div className="store-dialog-backdrop store-cart-backdrop" onMouseDown={() => setShowCart(false)}>
          <aside
            className="store-cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="store-cart-drawer__header">
              <div>
                <p className="store-kicker">Your selection</p>
                <h2 id="cart-title">Shopping cart <span>{cartItemCount}</span></h2>
              </div>
              <button className="store-dialog-close" type="button" onClick={() => setShowCart(false)} aria-label="Close cart">
                <CloseIcon />
              </button>
            </header>

            <div className="store-cart-drawer__body">
              {cart.length === 0 ? (
                <div className="store-empty-cart">
                  <span><BagIcon /></span>
                  <h3>Your cart is ready for something good</h3>
                  <p>Browse the shop and add a few essentials for your pet.</p>
                  <button type="button" onClick={() => setShowCart(false)}>Continue shopping</button>
                </div>
              ) : (
                <ul className="store-cart-list">
                  {cart.map((item) => (
                    <li key={item._id}>
                      <div className="store-cart-list__image"><ProductImage product={item} /></div>
                      <div className="store-cart-list__details">
                        <p>{item.category}</p>
                        <h3>{item.name}</h3>
                        <span>Qty {item.quantity} · {formatPrice(item.price)} each</span>
                      </div>
                      <div className="store-cart-list__end">
                        <strong>{formatPrice(item.price * item.quantity)}</strong>
                        <button type="button" onClick={() => removeFromCart(item._id)} aria-label={`Remove ${item.name} from cart`}>
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cart.length > 0 && (
              <footer className="store-cart-drawer__footer">
                <div className="store-cart-summary">
                  <span>Subtotal</span>
                  <strong>{formatPrice(totalValue)}</strong>
                </div>
                <p>Delivery fees are calculated at checkout.</p>
                <button
                  className="store-primary-button"
                  type="button"
                  onClick={() => navigate("/payment", { state: { cart, totalValue } })}
                >
                  Proceed to payment
                  <ArrowRightIcon />
                </button>
                <button className="store-continue-button" type="button" onClick={() => setShowCart(false)}>
                  Continue shopping
                </button>
              </footer>
            )}
          </aside>
        </div>
      )}
    </main>
  );
};

export default StorePage;
