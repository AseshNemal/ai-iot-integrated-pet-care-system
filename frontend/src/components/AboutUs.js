import React from 'react';
import { Link } from 'react-router-dom';
import './AboutUs.css';
import NemalPic from './pic/Nemal.jpg';
import YasiduPic from './pic/Yasidu.JPG';
import AdrielPic from './pic/Adriel.JPG';
import SurathPic from './pic/Surath.jpeg';
import RandimalPic from './pic/Randimal.JPG';
import {
  ActivityIcon,
  MapPinIcon,
  PulseIcon,
  SparkleIcon,
  ClipboardHeartIcon,
  CalendarIcon,
  HomeHeartIcon,
  BagIcon,
  ArrowRightIcon,
} from './homeIcons';

const teamMembers = [
  { name: 'Asesh Nemal', role: 'Developer / Designer', image: NemalPic, linkedin: 'http://linkedin.com/in/asesh-nemal-a0a520248' },
  { name: 'Yasindu Rasanga', role: 'Developer / Designer', image: YasiduPic, linkedin: 'http://linkedin.com/in/yasindu-rasanga-karawita-481549247' },
  { name: 'Adriel Damian', role: 'Developer / Designer', image: AdrielPic, linkedin: 'http://linkedin.com/in/adriel-perera-5a9730362' },
  { name: 'Surath Gayanatha', role: 'Developer / Designer', image: SurathPic, linkedin: 'http://linkedin.com/in/surath-gayanatha-081362335' },
  { name: 'Randimal Lamahewa', role: 'Developer / Designer', image: RandimalPic, linkedin: 'http://linkedin.com/in/randimal-lamahewa-153483271' },
];

const KEY_FEATURES = [
  { icon: ActivityIcon, label: 'IoT-based pet health and activity monitoring' },
  { icon: MapPinIcon, label: 'GPS/location tracking for pets' },
  { icon: PulseIcon, label: 'Heart rate, body temperature, activity, and environmental monitoring' },
  { icon: SparkleIcon, label: 'AI-assisted pet behavior analysis and training guidance' },
  { icon: ClipboardHeartIcon, label: 'Pet profiles, medical information, and health records' },
  { icon: CalendarIcon, label: 'Veterinary appointment management' },
  { icon: HomeHeartIcon, label: 'Pet adoption portal' },
  { icon: BagIcon, label: 'Integrated pet store' },
];

function AboutUs() {
  return (
    <div className="pwh-about-page">
      {/* Intro */}
      <section className="pwh-about-hero">
        <div className="pwh-about-hero__inner">
          <p className="pwh-about-kicker">About Us</p>
          <h1>About Pet Wellness Hub</h1>
          <p className="pwh-about-hero__lede">
            Pet Wellness Hub is an AI- and IoT-integrated pet care platform
            developed as part of our academic project at SLIIT. The system
            brings pet health monitoring, pet management, veterinary
            services, AI-assisted training, adoption, and pet-related
            services into one platform.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="pwh-about-band pwh-about-band--tint">
        <div className="pwh-about-band__inner">
          <h2>Our Mission</h2>
          <p className="pwh-about-band__lede">
            Our mission is to use IoT, AI, and modern software technologies
            to make pet care easier, more informed, and more connected for
            pet owners.
          </p>
        </div>
      </section>

      {/* How it started */}
      <section className="pwh-about-band">
        <div className="pwh-about-band__inner">
          <h2>How It Started</h2>
          <p className="pwh-about-band__lede">
            Pet Wellness Hub began as a university project focused on
            combining software, IoT devices, and AI into a practical pet
            care system.
          </p>
          <p className="pwh-about-band__lede">
            The project has grown into a platform covering pet monitoring,
            health records, appointments, AI-assisted pet training,
            adoption, and other pet-care services.
          </p>
        </div>
      </section>

      {/* Key features */}
      <section className="pwh-about-features">
        <div className="pwh-about-features__inner">
          <h2>What's Included</h2>
          <ul className="pwh-about-features__grid">
            {KEY_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon className="pwh-about-icon" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Team */}
      <section className="pwh-about-team">
        <div className="pwh-about-team__inner">
          <h2>Meet the Team</h2>
          <div className="pwh-about-team__grid">
            {teamMembers.map((member) => (
              <a
                key={member.name}
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="pwh-about-team__card"
              >
                <img src={member.image} alt={member.name} className="pwh-about-team__avatar" />
                <p className="pwh-about-team__name">{member.name}</p>
                <p className="pwh-about-team__role">{member.role}</p>
                <span className="pwh-about-team__link">
                  LinkedIn
                  <ArrowRightIcon className="pwh-about-icon" style={{ height: 13, width: 13 }} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pwh-about-final">
        <div className="pwh-about-final__inner">
          <h2>Explore what Pet Wellness Hub can do for your pet.</h2>
          <Link to="/pet" className="pwh-about-btn pwh-about-btn--on-dark">
            View My Pets
          </Link>
        </div>
      </section>
    </div>
  );
}

export default AboutUs;
