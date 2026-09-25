import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import PetTracker from './PetTracker';
import { API_BASE_URL } from '../config/api';
import './petRecord.css';

const PetRecord = () => {
  const { petId } = useParams();
  const navigate = useNavigate();
  const [pet, setPet] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);


  useEffect(() => {
    const fetchData = async () => {
      try {
        const [petResponse, recordsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/pet/petDetaile/${petId}`),
          axios.get(`${API_BASE_URL}/medical/${petId}`)
        ]);

        if (!petResponse.data.pet) {
          throw new Error('Pet not found');
        }

        setPet(petResponse.data.pet);
        setMedicalRecords(recordsResponse.data || []);



      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [petId]);

  const handleDeleteRecord = (recordId) => {
    setRecordToDelete(recordId);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/medical/delete/${recordToDelete}`);
      setMedicalRecords(medicalRecords.filter(record => record._id !== recordToDelete));
    } catch (err) {
      setError('Failed to delete record');
    } finally {
      setShowConfirm(false);
      setRecordToDelete(null);
    }

  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not recorded';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) return <div className="pwh-record-page"><p className="pwh-record-state">Loading pet details…</p></div>;
  if (error) return <div className="pwh-record-page"><p className="pwh-record-state pwh-record-state--error">{error}</p></div>;
  if (!pet) return <div className="pwh-record-page"><p className="pwh-record-state">No pet found with this ID.</p></div>;

  const hasBreed = pet.breed && pet.breed.trim().toLowerCase() !== 'none';
  const speciesLine = hasBreed ? `${pet.breed} ${pet.species}` : pet.species;
  const hasColor = pet.color && pet.color.trim().toLowerCase() !== 'unknown';

  return (
    <div className="pwh-record-page">
      <div className="pwh-record-shell">
        <button onClick={() => navigate(-1)} className="pwh-record-back">
          ← Back to pets
        </button>

        <div className="pwh-record-card">
          <header className="pwh-record-header">
            <div className="pwh-record-avatar">
              {pet.image ? (
                <img src={pet.image} alt="" />
              ) : (
                <span aria-hidden="true">{pet.petName ? pet.petName[0].toUpperCase() : '?'}</span>
              )}
            </div>
            <div className="pwh-record-identity">
              <h1>{pet.petName}</h1>
              <p className="pwh-record-species">
                {speciesLine}{hasColor ? `, ${pet.color}` : ''}
              </p>
            </div>
          </header>

          <dl className="pwh-record-vitals">
            <div className="pwh-record-vitals__item">
              <dt>Gender</dt>
              <dd>{pet.gender || 'Not recorded'}</dd>
            </div>
            <div className="pwh-record-vitals__item">
              <dt>Birth date</dt>
              <dd>{formatDate(pet.bDate)}</dd>
            </div>
            <div className="pwh-record-vitals__item">
              <dt>Weight</dt>
              <dd>{pet.weight ? `${pet.weight} kg` : 'Not recorded'}</dd>
            </div>
            <div className="pwh-record-vitals__item">
              <dt>Last vet visit</dt>
              <dd>{formatDate(pet.lastVetVisit)}</dd>
            </div>
          </dl>

          {pet.medicalNotes && (
            <p className="pwh-record-note">
              <strong>Medical notes.</strong> {pet.medicalNotes}
            </p>
          )}
        </div>

        <PetTracker
          pet={pet}
          onDeviceIdChange={(deviceId) => setPet(prev => ({ ...prev, deviceId }))}
        />

        <div className="pwh-record-card">
          <section className="pwh-record-history">
            <div className="pwh-record-history__header">
              <h2>Medical history</h2>
              <button onClick={() => navigate(`/pets/${petId}/medical`)} className="pwh-record-history__add">
                Add visit
              </button>
            </div>

            {medicalRecords.length === 0 ? (
              <p className="pwh-record-history__empty">No visits recorded yet for {pet.petName}.</p>
            ) : (
              <ol className="pwh-record-timeline">
                {medicalRecords.map((record) => (
                  <li key={record._id} className="pwh-record-timeline__item">
                    <div className="pwh-record-timeline__marker" aria-hidden="true" />
                    <div className="pwh-record-timeline__body">
                      <div className="pwh-record-timeline__row">
                        <h3>{record.visitType || 'Visit'}</h3>
                        <span className="pwh-record-timeline__date">{formatDate(record.visitDate)}</span>
                      </div>
                      <p className="pwh-record-timeline__vet">{record.veterinarian || 'Veterinarian not specified'}</p>
                      <p><span className="pwh-record-timeline__label">Diagnosis</span>{record.diagnosis || 'None recorded'}</p>
                      <p><span className="pwh-record-timeline__label">Treatment</span>{record.treatment || 'None recorded'}</p>
                      {record.notes && <p className="pwh-record-timeline__notes">{record.notes}</p>}
                      <div className="pwh-record-timeline__actions">
                        <button
                          onClick={() => navigate(`/pets/${petId}/medical/edit/${record._id}`)}
                          className="pwh-record-timeline__edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record._id)}
                          className="pwh-record-timeline__delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {showConfirm && (
          <div className="pwh-record-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="pwh-record-confirm-box">
              <h3 id="confirm-title">Delete this visit?</h3>
              <p>This can't be undone.</p>
              <div className="pwh-record-confirm-box__actions">
                <button onClick={() => setShowConfirm(false)} className="pwh-record-btn pwh-record-btn--ghost">
                  Cancel
                </button>
                <button onClick={confirmDelete} className="pwh-record-btn pwh-record-btn--danger">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetRecord;
