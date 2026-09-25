import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import PetTracker from './PetTracker';
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
          axios.get(`http://localhost:8090/pet/petDetaile/${petId}`),
          axios.get(`http://localhost:8090/medical/${petId}`)
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
      await axios.delete(`http://localhost:8090/medical/delete/${recordToDelete}`);
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

  if (loading) return <div className="record"><p className="record__state">Loading pet details…</p></div>;
  if (error) return <div className="record"><p className="record__state record__state--error">{error}</p></div>;
  if (!pet) return <div className="record"><p className="record__state">No pet found with this ID.</p></div>;

  const hasBreed = pet.breed && pet.breed.trim().toLowerCase() !== 'none';
  const speciesLine = hasBreed ? `${pet.breed} ${pet.species}` : pet.species;
  const hasColor = pet.color && pet.color.trim().toLowerCase() !== 'unknown';

  return (
    <div className="record">
      <div className="record__shell">
        <button onClick={() => navigate(-1)} className="record__back">
          ← Back to pets
        </button>

        <header className="record__header">
          <div className="record__avatar">
            {pet.image ? (
              <img src={pet.image} alt="" />
            ) : (
              <span aria-hidden="true">{pet.petName ? pet.petName[0].toUpperCase() : '?'}</span>
            )}
          </div>
          <div className="record__identity">
            <h1>{pet.petName}</h1>
            <p className="record__species">
              {speciesLine}{hasColor ? `, ${pet.color}` : ''}
            </p>
          </div>
        </header>

        <dl className="vitals">
          <div className="vitals__item">
            <dt>Gender</dt>
            <dd>{pet.gender || 'Not recorded'}</dd>
          </div>
          <div className="vitals__item">
            <dt>Birth date</dt>
            <dd>{formatDate(pet.bDate)}</dd>
          </div>
          <div className="vitals__item">
            <dt>Weight</dt>
            <dd>{pet.weight ? `${pet.weight} kg` : 'Not recorded'}</dd>
          </div>
          <div className="vitals__item">
            <dt>Last vet visit</dt>
            <dd>{formatDate(pet.lastVetVisit)}</dd>
          </div>
        </dl>

        {pet.medicalNotes && (
          <p className="record__note">
            <strong>Medical notes.</strong> {pet.medicalNotes}
          </p>
        )}

        <PetTracker
          pet={pet}
          onDeviceIdChange={(deviceId) => setPet(prev => ({ ...prev, deviceId }))}
        />

        <section className="history">
          <div className="history__header">
            <h2>Medical history</h2>
            <button onClick={() => navigate(`/pets/${petId}/medical`)} className="history__add">
              Add visit
            </button>
          </div>

          {medicalRecords.length === 0 ? (
            <p className="history__empty">No visits recorded yet for {pet.petName}.</p>
          ) : (
            <ol className="timeline">
              {medicalRecords.map((record) => (
                <li key={record._id} className="timeline__item">
                  <div className="timeline__marker" aria-hidden="true" />
                  <div className="timeline__body">
                    <div className="timeline__row">
                      <h3>{record.visitType || 'Visit'}</h3>
                      <span className="timeline__date">{formatDate(record.visitDate)}</span>
                    </div>
                    <p className="timeline__vet">{record.veterinarian || 'Veterinarian not specified'}</p>
                    <p><span className="timeline__label">Diagnosis</span>{record.diagnosis || 'None recorded'}</p>
                    <p><span className="timeline__label">Treatment</span>{record.treatment || 'None recorded'}</p>
                    {record.notes && <p className="timeline__notes">{record.notes}</p>}
                    <div className="timeline__actions">
                      <button
                        onClick={() => navigate(`/pets/${petId}/medical/edit/${record._id}`)}
                        className="timeline__edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(record._id)}
                        className="timeline__delete"
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

        {showConfirm && (
          <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="confirm-box">
              <h3 id="confirm-title">Delete this visit?</h3>
              <p>This can't be undone.</p>
              <div className="confirm-box__actions">
                <button onClick={() => setShowConfirm(false)} className="btn btn--ghost">
                  Cancel
                </button>
                <button onClick={confirmDelete} className="btn btn--danger">
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
