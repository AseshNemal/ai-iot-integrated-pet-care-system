import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import "./userPetList.css";

function UserPets() {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionRes = await fetch(`${API_BASE_URL}/get-session`, {
          credentials: "include"
        });
        const sessionData = await sessionRes.json();

        if (!sessionData.user) {
          throw new Error("User not logged in");
        }

        setUser(sessionData.user);
        const petsRes = await axios.get(`${API_BASE_URL}/pet/find/${sessionData.user._id}`);
        setPets(petsRes.data.pets || []);
      } catch (err) {
        console.error("Error:", err);
        // Check if error is 404 and set friendly message
        if (err.response && err.response.status === 404) {
          setError("No pets added, please add your pet");
        } else {
          setError(err.message || "Error fetching data");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePetClick = (petId) => {
    navigate(`/pets/${petId}`);
  };

  const handleDeletePet = async (petId, e) => {
    e.stopPropagation(); // Prevent triggering the pet click event
    try {
      const confirmDelete = window.confirm("Are you sure you want to delete this pet?");
      if (!confirmDelete) return;

      await axios.delete(`${API_BASE_URL}/pet/delete/${petId}`);
      setPets(pets.filter(pet => pet._id !== petId));
    } catch (err) {
      console.error("Error deleting pet:", err);
      alert("Failed to delete pet. Please try again.");
    }
  };

  return (
    <div className="pwh-pets-page">
      <div className="pwh-pets-header">
        <div>
          <p className="pwh-pets-kicker">My Pets</p>
          <h1>{user?.displayName ? `${user.displayName}'s Pets` : 'My Pets'}</h1>
          <p className="pwh-pets-header__lede">Profiles, medical history and appointments for every pet on your account.</p>
        </div>
        <button
          onClick={() => navigate(`/pet/add`)}
          className="pwh-pets-btn pwh-pets-btn--primary"
        >
          + Add New Pet
        </button>
      </div>

      <div className="pwh-pets-content">
        {loading && <div className="pwh-pets-state">Loading pets...</div>}
        {error && !loading && <div className="pwh-pets-state pwh-pets-state--error">{error}</div>}

        {!loading && !error && (
          pets.length === 0 ? (
            <div className="pwh-pets-empty">
              <p>No pets found for this user.</p>
              <p>Add your first pet to start tracking their care.</p>
            </div>
          ) : (
            <ul className="pwh-pets-grid">
              {pets.map((pet) => (
                <li
                  key={pet._id}
                  onClick={() => handlePetClick(pet._id)}
                  className="pwh-pets-card"
                >
                  <p className="pwh-pets-card__name">{pet.petName}</p>
                  <p className="pwh-pets-card__details">{pet.species} · {pet.breed}</p>
                  <div className="pwh-pets-card__actions">
                    <button
                      className="pwh-pets-card__edit"
                      onClick={(e) => {
                        e.stopPropagation(); // prevent triggering the pet click event
                        navigate(`/pet/edit/${pet._id}`);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="pwh-pets-card__delete"
                      onClick={(e) => handleDeletePet(pet._id, e)}
                    >
                      Delete
                    </button>
                    <span className="pwh-pets-card__arrow">→</span>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}

export default UserPets;
