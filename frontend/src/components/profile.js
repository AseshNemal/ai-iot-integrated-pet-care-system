import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import "./profile.css";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0][0];
  return initials.toUpperCase();
};

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [petCount, setPetCount] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/get-session`, {
          withCredentials: true
        });
        if (response.data.user) {
          setUser(response.data.user);

          try {
            const petsRes = await axios.get(`${API_BASE_URL}/pet/find/${response.data.user._id}`);
            setPetCount((petsRes.data.pets || []).length);
          } catch (petErr) {
            // 404 just means the user has no pets yet; treat any failure here
            // as "unknown" rather than surfacing it as a profile error.
            setPetCount(petErr.response?.status === 404 ? 0 : null);
          }
        } else {
          setError("No user session found");
        }
      } catch (err) {
        setError(err.response?.data?.message || "Error fetching profile");
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/logout`, {}, {
        withCredentials: true
      });
      // Full reload (not navigate) so Header re-fetches the session and
      // drops its stale logged-in state instead of showing a signed-out
      // page with a signed-in header.
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading) {
    return (
      <div className="pwh-profile-page">
        <div className="pwh-profile-state">
          <div className="pwh-profile-spinner" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pwh-profile-page">
        <div className="pwh-profile-state pwh-profile-state--error">
          <p>{error}</p>
          <button className="pwh-profile-btn pwh-profile-btn--primary" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pwh-profile-page">
        <div className="pwh-profile-state">
          <h2>No user found</h2>
          <button className="pwh-profile-btn pwh-profile-btn--primary" onClick={() => navigate("/login")}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pwh-profile-page">
      <div className="pwh-profile-card">
        <div className="pwh-profile-header">
          {user.image && !imageError ? (
            <img
              src={user.image}
              alt="Profile"
              className="pwh-profile-avatar"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="pwh-profile-avatar pwh-profile-avatar--fallback">
              {getInitials(user.displayName)}
            </div>
          )}
          <h1 className="pwh-profile-name">{user.displayName || "User"}</h1>
          <p className="pwh-profile-email">{user.gmail || "No email provided"}</p>
          {user.role && <span className="pwh-profile-badge">{user.role}</span>}
        </div>

        <div className="pwh-profile-details">
          <div className="pwh-profile-stats">
            <div className="pwh-profile-stat">
              <span className="pwh-profile-stat__value">{petCount === null ? "—" : petCount}</span>
              <span className="pwh-profile-stat__label">{petCount === 1 ? "Pet" : "Pets"}</span>
            </div>
            <div className="pwh-profile-stat">
              <span className="pwh-profile-stat__value">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
              </span>
              <span className="pwh-profile-stat__label">Member Since</span>
            </div>
          </div>

          <div className="pwh-profile-detail-card">
            <h3>Account Information</h3>
            <div className="pwh-profile-detail-item">
              <span className="pwh-profile-detail-label">Full Name</span>
              <span className="pwh-profile-detail-value">
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.displayName || "N/A"}
              </span>
            </div>
            <div className="pwh-profile-detail-item">
              <span className="pwh-profile-detail-label">Email</span>
              <span className="pwh-profile-detail-value">{user.gmail || "N/A"}</span>
            </div>
            <div className="pwh-profile-detail-item">
              <span className="pwh-profile-detail-label">Role</span>
              <span className="pwh-profile-detail-value">{user.role || "User"}</span>
            </div>
            <div className="pwh-profile-detail-item">
              <span className="pwh-profile-detail-label">Account Created</span>
              <span className="pwh-profile-detail-value">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div className="pwh-profile-detail-item">
              <span className="pwh-profile-detail-label">Last Updated</span>
              <span className="pwh-profile-detail-value">
                {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </div>

          <div className="pwh-profile-actions">
            <Link to="/pet" className="pwh-profile-btn pwh-profile-btn--primary">
              View My Pets
            </Link>
            <button className="pwh-profile-btn pwh-profile-btn--ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
