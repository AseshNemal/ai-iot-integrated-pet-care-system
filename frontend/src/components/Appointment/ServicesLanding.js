import React, { useState } from 'react';
import AppointmentForm from './AppointmentForm.js';
import { PawIcon, ClipboardHeartIcon } from '../homeIcons';
import './ServicesLanding.css';

const SERVICES = [
  {
    type: 'grooming',
    icon: PawIcon,
    title: 'Grooming Services',
    items: ['Bath', 'Bath + Haircut', 'Nail Trimming', 'Haircut'],
  },
  {
    type: 'veterinary',
    icon: ClipboardHeartIcon,
    title: 'Veterinary Services',
    items: ['Regular Check-up', 'Vaccination', 'Dental'],
  },
];

const ServicesLanding = () => {
  const [serviceType, setServiceType] = useState(null);

  return (
    <div className="pwh-services-page">
      <section className="pwh-services-hero">
        <p className="pwh-services-kicker">Appointments</p>
        <h1>Book an Appointment</h1>
        <p>Choose a service and book directly with our grooming and veterinary team.</p>
      </section>

      <div className="pwh-services-grid">
        {SERVICES.map(({ type, icon: Icon, title, items }) => (
          <div className="pwh-services-card" key={type}>
            <div className="pwh-services-card__icon">
              <Icon className="pwh-services-icon" />
            </div>
            <h2>{title}</h2>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className="pwh-services-card__btn"
              onClick={() => setServiceType(type)}
            >
              Book Appointment
            </button>
          </div>
        ))}
      </div>

      {serviceType && (
        <div className="pwh-services-form-wrap">
          <AppointmentForm
            serviceType={serviceType}
            onClose={() => setServiceType(null)}
          />
        </div>
      )}
    </div>
  );
};

export default ServicesLanding;
