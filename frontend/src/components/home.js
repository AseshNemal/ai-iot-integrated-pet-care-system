import React from 'react';
import { Link } from 'react-router-dom';
import './home.css';
import storeScreenshot from '../assets/home/store-screenshot.png';
import trackerDevicePhoto from '../assets/home/tracker-device.jpg';
import aiTrainingDogPhoto from '../assets/home/ai-training-dog.jpg';
import everydayCarePhoto from '../assets/home/everyday-care-pets.jpg';
import {
  PawIcon,
  ClipboardHeartIcon,
  CalendarIcon,
  HomeHeartIcon,
  BagIcon,
  SparkleIcon,
  PulseIcon,
  ThermometerIcon,
  ActivityIcon,
  MapPinIcon,
  BatteryIcon,
  DropletIcon,
  ArrowRightIcon,
} from './homeIcons';

const OVERVIEW_GROUPS = [
  {
    label: 'Care',
    items: [
      { icon: PawIcon, label: 'Pet profiles', to: '/pet' },
      { icon: ClipboardHeartIcon, label: 'Medical records', to: '/pet' },
      { icon: CalendarIcon, label: 'Appointments', to: '/appointments' },
    ],
  },
  {
    label: 'Services',
    items: [
      { icon: HomeHeartIcon, label: 'Adoption', to: '/adoption-portal' },
      { icon: BagIcon, label: 'Shopping', to: '/product/all' },
    ],
  },
  {
    label: 'Smart features',
    items: [
      { icon: SparkleIcon, label: 'AI training', to: '/petTrainingForm' },
      { icon: PulseIcon, label: 'Health monitoring', to: '/pet' },
    ],
  },
];

const MONITORING_METRICS = [
  { icon: ThermometerIcon, label: 'Body temperature' },
  { icon: PulseIcon, label: 'Heart rate' },
  { icon: ActivityIcon, label: 'Activity & steps' },
  { icon: DropletIcon, label: 'Environment temp & humidity' },
  { icon: MapPinIcon, label: 'GPS location' },
  { icon: BatteryIcon, label: 'Battery status' },
];

const SERVICE_ITEMS = [
  {
    icon: CalendarIcon,
    title: 'Veterinary & grooming appointments',
    text: 'See what a clinic or groomer has open and book directly.',
    to: '/appointments',
    cta: 'Book an appointment',
  },
  {
    icon: ClipboardHeartIcon,
    title: 'Medical records',
    text: "Every visit and treatment stays attached to your pet's profile.",
    to: '/pet',
    cta: 'View pet records',
  },
  {
    icon: HomeHeartIcon,
    title: 'Adoption',
    text: 'Browse adoptable pets, or list one that needs a home.',
    to: '/adoption-portal',
    cta: 'Open the adoption portal',
  },
];

const STEPS = [
  { n: '01', title: 'Add your pet', text: "Create a profile with your pet's basic details." },
  { n: '02', title: 'Organize their care', text: 'Keep medical records and appointments in one place.' },
  { n: '03', title: 'Use the services you need', text: 'Adoption, shopping, and AI training guidance, when you need them.' },
  { n: '04', title: 'Connect monitoring (optional)', text: "Link a compatible tracker to your pet's profile." },
];

function Home() {
  return (
    <div className="pwh-home">
      {/* Hero */}
      <section className="pwh-hero">
        <div className="pwh-hero__inner">
          <div className="pwh-hero__copy">
            <p className="pwh-kicker">Pet Wellness Hub</p>
            <h1>Everything your pet needs, all in one place.</h1>
            <p className="pwh-hero__lede">
              Manage your pet's care, appointments and medical records, use
              adoption and shopping, and connect health monitoring when you
              want it — one account instead of a handful of separate tools.
            </p>
            <div className="pwh-hero__actions">
              <Link to="/pet" className="pwh-btn pwh-btn--primary">
                View My Pets
              </Link>
              <a href="#platform-overview" className="pwh-btn pwh-btn--ghost">
                Explore features
              </a>
            </div>
          </div>

          <div className="pwh-hero__panel" aria-hidden="true">
            <span className="pwh-hero__panel-label">What's included</span>
            <ul className="pwh-hero__panel-list">
              <li>
                <strong>Care</strong>
                <span>Profiles, records, appointments</span>
              </li>
              <li>
                <strong>Services</strong>
                <span>Adoption, shopping</span>
              </li>
              <li>
                <strong>Smart features</strong>
                <span>AI training, health monitoring</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Quick platform overview */}
      <section id="platform-overview" className="pwh-overview">
        <div className="pwh-overview__inner">
          {OVERVIEW_GROUPS.map((group) => (
            <div className="pwh-overview__group" key={group.label}>
              <h2>{group.label}</h2>
              <ul>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
                      <Link to={item.to}>
                        <Icon className="pwh-icon" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Pet management / everyday care */}
      <section className="pwh-split-tint-bg">
        <div className="pwh-split">
          <div className="pwh-split__media">
            <img
              src={everydayCarePhoto}
              alt="A golden retriever and a cat resting together at home"
              loading="lazy"
            />
          </div>
          <div className="pwh-split__copy">
            <p className="pwh-kicker">Everyday care</p>
            <h2>Keep your pet's care organized</h2>
            <p className="pwh-split__lede">
              A pet's profile brings their basic details, medical history and
              upcoming appointments together, so you're not digging through
              old messages before a vet visit.
            </p>
            <ul className="pwh-plain-list">
              <li>Profile &amp; basic details</li>
              <li>Medical history</li>
              <li>Upcoming appointments</li>
            </ul>
            <Link to="/pet" className="pwh-link-cta">
              Manage my pets
              <ArrowRightIcon className="pwh-icon" />
            </Link>
          </div>
        </div>
      </section>

      {/* Connected health monitoring */}
      <section className="pwh-split">
        <div className="pwh-split__media">
          <img
            src={trackerDevicePhoto}
            alt="The Pet Health Tracker device, a collar-mounted sensor unit"
            loading="lazy"
          />
          <p className="pwh-split__caption">The Pet Health Tracker device</p>
        </div>
        <div className="pwh-split__copy">
          <p className="pwh-kicker">Part of the platform, not the whole thing</p>
          <h2>Connected health, when you need it</h2>
          <p className="pwh-split__lede">
            For pets wearing a compatible tracker, readings stream to their
            profile so you can see how they're doing between visits.
          </p>
          <ul className="pwh-metric-list">
            {MONITORING_METRICS.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon className="pwh-icon" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <Link to="/pet" className="pwh-link-cta">
            Explore monitoring
            <ArrowRightIcon className="pwh-icon" />
          </Link>
        </div>
      </section>

      {/* Services */}
      <section className="pwh-services">
        <div className="pwh-services__inner">
          <div className="pwh-services__feature">
            <img src={storeScreenshot} alt="The Pet Wellness Hub store, showing real products and prices" loading="lazy" />
            <p className="pwh-split__caption">The in-app pet store</p>
            <h2>Shopping, without leaving the app</h2>
            <p className="pwh-services__lede">Order food, toys and everyday supplies and reorder when you run out.</p>
            <Link to="/product/all" className="pwh-link-cta">
              Browse the store
              <ArrowRightIcon className="pwh-icon" />
            </Link>
          </div>

          <div className="pwh-services__list">
            {SERVICE_ITEMS.slice(0, 2).map((item) => {
              const Icon = item.icon;
              return (
                <div className="pwh-services__row" key={item.title}>
                  <Icon className="pwh-icon" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <Link to={item.to}>{item.cta}</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI training */}
      <section className="pwh-ai">
        <div className="pwh-ai__inner">
          <p className="pwh-kicker">AI pet training</p>
          <h2>Training guidance from a short questionnaire</h2>
          <p className="pwh-ai__lede">
            Answer a few questions about your pet's behavior and the AI
            trainer generates a plan based on what you described. It's a
            starting point for everyday training, not a replacement for a
            vet or a certified trainer.
          </p>
          <img src={aiTrainingDogPhoto} alt="A golden retriever wearing a Pet Wellness Hub health tracker collar" loading="lazy" />
          <Link to="/petTrainingForm" className="pwh-link-cta">
            Try the AI pet trainer
            <ArrowRightIcon className="pwh-icon" />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="pwh-steps">
        <div className="pwh-steps__inner">
          <h2>How it works</h2>
          <ol>
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="pwh-steps__n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pwh-final">
        <div className="pwh-final__inner">
          <h2>Keep your pet's care in one place.</h2>
          <Link to="/pet" className="pwh-btn pwh-btn--on-dark">
            View My Pets
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Home;
