import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { PawIcon, SparkleIcon } from "./homeIcons";
import "../feedbackform.css";

const MAX_FEEDBACK_LENGTH = 600;

function RatingStars({ value, onChange, hoverValue = 0, onHover, size = "medium" }) {
  const interactive = typeof onChange === "function";
  const displayedValue = hoverValue || value;

  return (
    <div
      className={`pwh-feedback-stars pwh-feedback-stars--${size}`}
      role={interactive ? "group" : "img"}
      aria-label={interactive ? "Choose a rating out of 5" : `${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) =>
        interactive ? (
          <button
            key={star}
            type="button"
            className={star <= displayedValue ? "is-active" : ""}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            aria-pressed={value === star}
            onClick={() => onChange(star)}
            onMouseEnter={() => onHover?.(star)}
            onMouseLeave={() => onHover?.(0)}
            onFocus={() => onHover?.(star)}
            onBlur={() => onHover?.(0)}
          >
            ★
          </button>
        ) : (
          <span key={star} className={star <= value ? "is-active" : ""} aria-hidden="true">
            ★
          </span>
        ),
      )}
    </div>
  );
}

function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [user, setUser] = useState(null);
  const [uid, setUID] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [editingRating, setEditingRating] = useState(0);
  const [editingHoverRating, setEditingHoverRating] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    const loadPage = async () => {
      const [sessionResult, feedbackResult] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/get-session`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/feedback/all`),
      ]);

      if (!isCurrent) return;

      if (sessionResult.status === "fulfilled" && sessionResult.value.data.user) {
        setUser(sessionResult.value.data.user);
        setUID(sessionResult.value.data.user._id);
      }

      if (feedbackResult.status === "fulfilled") {
        setFeedbacks(feedbackResult.value.data);
      } else {
        setLoadError("We couldn't load community feedback right now. Please try again shortly.");
      }

      setIsLoading(false);
    };

    loadPage();
    return () => {
      isCurrent = false;
    };
  }, []);

  const averageRating = useMemo(() => {
    if (!feedbacks.length) return 0;
    const total = feedbacks.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    return total / feedbacks.length;
  }, [feedbacks]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!user || !uid) {
      setFormError("Please sign in before sharing feedback.");
      return;
    }

    if (!feedbackText.trim() || rating === 0) {
      setFormError("Add a short comment and choose a star rating before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/feedback/add`, {
        userId: uid,
        userName: user.displayName || user.name || user.email?.split("@")[0] || "Pet parent",
        feedback: feedbackText.trim(),
        rating,
      });

      setFeedbacks((current) => [response.data, ...current]);
      setFeedbackText("");
      setRating(0);
      setHoverRating(0);
      setSuccessMessage("Thank you—your feedback is now part of the community.");
    } catch (error) {
      setFormError(error.response?.data?.message || "We couldn't submit your feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMenu = (id) => {
    setMenuOpenId((current) => (current === id ? null : id));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this feedback? This action cannot be undone.")) return;

    try {
      await axios.delete(`${API_BASE_URL}/feedback/delete/${id}`);
      setFeedbacks((current) => current.filter((item) => item._id !== id));
      setMenuOpenId(null);
    } catch (error) {
      setLoadError(error.response?.data?.error || "We couldn't delete that feedback. Please try again.");
    }
  };

  const handleEditStart = (feedback) => {
    setEditingId(feedback._id);
    setEditingText(feedback.feedback);
    setEditingRating(feedback.rating);
    setEditingHoverRating(0);
    setMenuOpenId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
    setEditingRating(0);
    setEditingHoverRating(0);
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingText.trim() || editingRating === 0) return;

    setIsSavingEdit(true);

    try {
      const response = await axios.put(`${API_BASE_URL}/feedback/edit/${editingId}`, {
        feedback: editingText.trim(),
        rating: editingRating,
      });

      setFeedbacks((current) =>
        current.map((item) => (item._id === editingId ? response.data : item)),
      );
      cancelEdit();
    } catch (error) {
      setLoadError(error.response?.data?.error || "We couldn't save your changes. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "Community member";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Community member";
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const getInitials = (name) => {
    if (!name) return "PP";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  };

  return (
    <main className="pwh-feedback">
      <section className="pwh-feedback-hero">
        <div className="pwh-feedback-hero__inner">
          <div className="pwh-feedback-hero__copy">
            <p className="pwh-feedback-kicker">Community feedback</p>
            <h1>Help us make pet care feel simpler.</h1>
            <p>
              Tell us what works, what could be clearer, and what would make Pet Wellness Hub
              more useful for you and your pet.
            </p>
          </div>

          <div className="pwh-feedback-score" aria-label="Community rating summary">
            <div className="pwh-feedback-score__icon" aria-hidden="true">
              <PawIcon />
            </div>
            <div>
              <span className="pwh-feedback-score__label">Community rating</span>
              <div className="pwh-feedback-score__value">
                <strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong>
                <span>out of 5</span>
              </div>
              <RatingStars value={Math.round(averageRating)} size="small" />
              <p>
                {feedbacks.length
                  ? `Based on ${feedbacks.length} review${feedbacks.length === 1 ? "" : "s"}`
                  : "Be the first to share your experience"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pwh-feedback-content">
        <aside className="pwh-feedback-compose">
          <div className="pwh-feedback-compose__heading">
            <span className="pwh-feedback-compose__icon" aria-hidden="true">
              <SparkleIcon />
            </span>
            <div>
              <p className="pwh-feedback-kicker">Share your experience</p>
              <h2>Your voice helps shape the hub.</h2>
            </div>
          </div>
          <p className="pwh-feedback-compose__intro">
            A few thoughtful words help us improve—and help other pet parents know what to expect.
          </p>

          {!user && !isLoading && (
            <div className="pwh-feedback-signin">
              <strong>Want to leave a review?</strong>
              <span>Sign in to rate your experience and manage your feedback.</span>
              <Link to="/login">Sign in to continue</Link>
            </div>
          )}

          <form className="pwh-feedback-form" onSubmit={handleSubmit}>
            <fieldset disabled={!user || isSubmitting}>
              <legend>How would you rate your experience?</legend>
              <RatingStars
                value={rating}
                hoverValue={hoverRating}
                onChange={setRating}
                onHover={setHoverRating}
                size="large"
              />
              <span className="pwh-feedback-rating-hint">
                {rating ? `${rating} out of 5 stars` : "Select a rating"}
              </span>

              <div className="pwh-feedback-field">
                <div className="pwh-feedback-field__label-row">
                  <label htmlFor="feedback-message">Your feedback</label>
                  <span>{feedbackText.length}/{MAX_FEEDBACK_LENGTH}</span>
                </div>
                <textarea
                  id="feedback-message"
                  value={feedbackText}
                  onChange={(event) => setFeedbackText(event.target.value)}
                  placeholder="What did you enjoy? What could we make better?"
                  maxLength={MAX_FEEDBACK_LENGTH}
                  rows="6"
                />
              </div>
            </fieldset>

            {formError && <p className="pwh-feedback-message pwh-feedback-message--error">{formError}</p>}
            {successMessage && (
              <p className="pwh-feedback-message pwh-feedback-message--success" role="status">
                {successMessage}
              </p>
            )}

            <button className="pwh-feedback-submit" type="submit" disabled={!user || isSubmitting}>
              {isSubmitting ? "Sharing feedback…" : "Share feedback"}
            </button>
            <p className="pwh-feedback-form__note">Your review will be visible to the community.</p>
          </form>
        </aside>

        <div className="pwh-feedback-community">
          <div className="pwh-feedback-community__header">
            <div>
              <p className="pwh-feedback-kicker">Community voices</p>
              <h2>What pet parents are saying</h2>
            </div>
            <span className="pwh-feedback-count">
              {feedbacks.length} review{feedbacks.length === 1 ? "" : "s"}
            </span>
          </div>

          {loadError && <p className="pwh-feedback-message pwh-feedback-message--error">{loadError}</p>}

          {isLoading ? (
            <div className="pwh-feedback-state" role="status">
              <span className="pwh-feedback-loader" aria-hidden="true" />
              Loading community feedback…
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="pwh-feedback-state pwh-feedback-state--empty">
              <PawIcon aria-hidden="true" />
              <h3>No reviews yet</h3>
              <p>Share the first review and help us build a better experience for every pet parent.</p>
            </div>
          ) : (
            <div className="pwh-feedback-list">
              {feedbacks.map((feedback) => (
                <article className="pwh-feedback-card" key={feedback._id}>
                  <header className="pwh-feedback-card__header">
                    <div className="pwh-feedback-avatar" aria-hidden="true">
                      {getInitials(feedback.userName)}
                    </div>
                    <div className="pwh-feedback-card__author">
                      <h3>{feedback.userName || "Pet parent"}</h3>
                      <span>{formatDate(feedback.createdAt)}</span>
                    </div>
                    {feedback.userId === uid && editingId !== feedback._id && (
                      <div className="pwh-feedback-menu">
                        <button
                          type="button"
                          className="pwh-feedback-menu__trigger"
                          onClick={() => toggleMenu(feedback._id)}
                          aria-label={`Manage feedback from ${feedback.userName || "you"}`}
                          aria-expanded={menuOpenId === feedback._id}
                        >
                          <span aria-hidden="true">•••</span>
                        </button>
                        {menuOpenId === feedback._id && (
                          <div className="pwh-feedback-menu__dropdown">
                            <button type="button" onClick={() => handleEditStart(feedback)}>
                              Edit review
                            </button>
                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => handleDelete(feedback._id)}
                            >
                              Delete review
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </header>

                  {editingId === feedback._id ? (
                    <form className="pwh-feedback-edit" onSubmit={handleEditSubmit}>
                      <RatingStars
                        value={editingRating}
                        hoverValue={editingHoverRating}
                        onChange={setEditingRating}
                        onHover={setEditingHoverRating}
                      />
                      <textarea
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        maxLength={MAX_FEEDBACK_LENGTH}
                        rows="4"
                        aria-label="Edit your feedback"
                      />
                      <div className="pwh-feedback-edit__actions">
                        <button type="button" onClick={cancelEdit} className="pwh-feedback-secondary-button">
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="pwh-feedback-primary-button"
                          disabled={isSavingEdit || !editingText.trim() || editingRating === 0}
                        >
                          {isSavingEdit ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <RatingStars value={Number(feedback.rating || 0)} size="small" />
                      <p className="pwh-feedback-card__text">{feedback.feedback}</p>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default FeedbackPage;
