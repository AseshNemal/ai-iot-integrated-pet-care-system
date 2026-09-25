import React from 'react';

// Small, dependency-free line-icon set for the homepage. Kept local instead of
// pulling in an icon package since none is installed in the project.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

export function PawIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="15.5" r="4.5" />
      <circle cx="5" cy="9" r="2.1" />
      <circle cx="10.2" cy="5.3" r="2.1" />
      <circle cx="13.8" cy="5.3" r="2.1" />
      <circle cx="19" cy="9" r="2.1" />
    </svg>
  );
}

export function ClipboardHeartIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M12 16.2s-2.9-1.7-2.9-3.7a1.9 1.9 0 0 1 3.5-1.1 1.9 1.9 0 0 1 3.5 1.1c0 2-3.1 3.7-3.1 3.7Z" />
    </svg>
  );
}

export function CalendarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="M8 14h2M14 14h2M8 17.5h2" />
    </svg>
  );
}

export function HomeHeartIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9.5" />
      <path d="M12 17.2s-2.6-1.5-2.6-3.3a1.7 1.7 0 0 1 3.1-1 1.7 1.7 0 0 1 3.1 1c0 1.8-2.8 3.3-2.8 3.3Z" />
    </svg>
  );
}

export function BagIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 8h11l1 12.2a1.5 1.5 0 0 1-1.5 1.8H7a1.5 1.5 0 0 1-1.5-1.8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

export function SparkleIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 13.4 9l5.1 1.5-5.1 1.5L12 17.5 10.6 12 5.5 10.5 10.6 9Z" />
      <path d="M18.5 15v3M17 16.5h3" />
    </svg>
  );
}

export function PulseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12.5h4l2-6 3 12 2-9 1.5 3H21" />
    </svg>
  );
}

export function ThermometerIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z" />
    </svg>
  );
}

export function ActivityIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 17h3l2.2-6.5L12 20l2.5-11 1.8 8h3.7" />
    </svg>
  );
}

export function MapPinIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}

export function BatteryIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="8" width="16" height="9" rx="2" />
      <path d="M21.5 11v3" />
      <rect x="5" y="10.3" width="9" height="4.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DropletIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5s6 6.8 6 11.2a6 6 0 0 1-12 0c0-4.4 6-11.2 6-11.2Z" />
    </svg>
  );
}

export function ArrowRightIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  );
}
