import React from "react";
import { Link } from "react-router-dom";
import "./footer.css";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__shell">
        <Link to="/" className="site-footer__brand">Pet Wellness Hub</Link>

        <ul className="site-footer__nav">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/pet">My pets</Link></li>
          <li><Link to="/appointments">Appointments</Link></li>
          <li><Link to="/adoption-portal">Adoption</Link></li>
          <li><Link to="/product/all">Shop</Link></li>
          <li><Link to="/AboutUs">About us</Link></li>
          <li><Link to="/feedbackform">Feedback</Link></li>
        </ul>

        <p className="site-footer__copy">
          © {new Date().getFullYear()} Pet Wellness Hub. Made with <span className="site-footer__heart">♥</span> for pets.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
