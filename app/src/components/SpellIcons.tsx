import React from 'react';
import { ArtifactId, SpellId } from '../game/types';

export function WarlockCrestSvg({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      {/* Outer Forged Obsidian & Bronze Ring */}
      <circle cx="40" cy="40" r="36" fill="#18100d" stroke="#c88a42" strokeWidth="2.5" />
      <circle cx="40" cy="40" r="30" fill="none" stroke="#804b1e" strokeWidth="1.2" strokeDasharray="5 3" />
      {/* 8-Point Arcane Rune Star */}
      <path
        d="M40 8L46 28L66 22L52 40L66 58L46 52L40 72L34 52L14 58L28 40L14 22L34 28L40 8Z"
        fill="#2e1810"
        stroke="#e09a46"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Hooded Warlock Silhouette */}
      <path
        d="M40 20C32 25 27 34 27 44C27 51 32 56 40 58C48 56 53 51 53 44C53 34 48 25 40 20Z"
        fill="#120b09"
        stroke="#f5c26b"
        strokeWidth="1.6"
      />
      {/* Burning Eyes */}
      <path d="M33 41L38 43L34 45Z" fill="#fb923c" />
      <path d="M47 41L42 43L46 45Z" fill="#fb923c" />
      {/* Crown Ember */}
      <circle cx="40" cy="27" r="3.2" fill="#fde047" stroke="#ea580c" strokeWidth="1.5" />
    </svg>
  );
}

export function SpellIconSvg({ spellId, className = 'w-7 h-7' }: { spellId: SpellId; className?: string }) {
  switch (spellId) {
    case 'fireball':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12.5 2C12.5 2 18 6.5 18 12.2C18 16.4 15 20.5 11 20.5C7.2 20.5 4.5 17.6 4.5 13.8C4.5 10.6 6.5 8.1 8.4 6.6C8.1 8.8 9.2 10.1 10.2 10.4C9.5 7.4 10.9 4.2 12.5 2Z"
            fill="#f97316"
            stroke="#1c0d07"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M12 10.5C13.8 12 14.5 14 14.5 15.8C14.5 17.6 13.1 19 11.4 19C9.7 19 8.5 17.7 8.5 16C8.5 14.2 10.2 12.1 12 10.5Z"
            fill="#fef08a"
          />
        </svg>
      );
    case 'repel':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#0c2638" stroke="#38bdf8" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="5" fill="none" stroke="#bae6fd" strokeWidth="1.6" strokeDasharray="3 2" />
          <path d="M12 3V7M12 17V21M3 12H7M17 12H21" stroke="#e0f2fe" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="12" r="2.2" fill="#7dd3fc" />
        </svg>
      );
    case 'teleport':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M5 17C8 14 10 10 13 4L15 10H20L11 20L12.5 13.5H7.5L5 17Z"
            fill="#a855f7"
            stroke="#1e0b2e"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="17" cy="6" r="2" fill="#e9d5ff" />
          <circle cx="6" cy="9" r="1.4" fill="#c084fc" />
        </svg>
      );
    case 'meteor':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M19.5 4.5L11.5 12.5" stroke="#fb923c" strokeWidth="4" strokeLinecap="round" />
          <path d="M16 4L10 10M20 8L14 14" stroke="#fde047" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="9.5" cy="14.5" r="5.5" fill="#dc2626" stroke="#1f0907" strokeWidth="1.6" />
          <circle cx="8.5" cy="13.5" r="2.3" fill="#fef08a" />
        </svg>
      );
    case 'gravity':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="#171436" stroke="#818cf8" strokeWidth="1.8" />
          <path
            d="M12 5.5C15.6 5.5 18.5 8.4 18.5 12C18.5 14.3 17.2 16.3 15.2 17.4"
            stroke="#c7d2fe"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M12 18.5C8.4 18.5 5.5 15.6 5.5 12C5.5 9.7 6.8 7.7 8.8 6.6"
            stroke="#a5b4fc"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="3" fill="#09071a" stroke="#e0e7ff" strokeWidth="1.5" />
        </svg>
      );
    case 'swap':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M4 9H17M17 9L13.5 5.5M17 9L13.5 12.5"
            stroke="#10b981"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 15H7M7 15L10.5 11.5M7 15L10.5 18.5"
            stroke="#6ee7b7"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function ArtifactIconSvg({ artifactId, className = 'w-6 h-6' }: { artifactId: ArtifactId; className?: string }) {
  switch (artifactId) {
    case 'boots':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M7 4H13V12L19 15V19H6V13L7 4Z"
            fill="#0284c7"
            stroke="#082f49"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M3 8H6M2 12H5" stroke="#bae6fd" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'lava_charm':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 3L19 10L12 21L5 10L12 3Z"
            fill="#ea580c"
            stroke="#2a0d05"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M12 7L15.2 10.5L12 16.5L8.8 10.5L12 7Z" fill="#fde047" />
        </svg>
      );
    case 'arcane_cloak':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M8 5L12 3L16 5L20 19L12 17L4 19L8 5Z"
            fill="#7e22ce"
            stroke="#1e0733"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M12 4V16" stroke="#e9d5ff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'titan_sigil':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 3L20 6.5V12.5C20 16.8 16.5 19.8 12 21C7.5 19.8 4 16.8 4 12.5V6.5L12 3Z"
            fill="#ca8a04"
            stroke="#271904"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M12 7V16M8.5 11H15.5" stroke="#fef9c3" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'vampiric_tome':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="5" y="3.5" width="14" height="17" rx="2" fill="#991b1b" stroke="#220606" strokeWidth="1.5" />
          <path d="M8.5 4V20" stroke="#fca5a5" strokeWidth="1.3" />
          <circle cx="13.5" cy="11.5" r="2.6" fill="#fecaca" />
        </svg>
      );
    case 'thorns_mail':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M6 7L12 4L18 7V15L12 20L6 15V7Z"
            fill="#047857"
            stroke="#052e16"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M4 9L7 10M20 9L17 10M4 14L7 13M20 14L17 13" stroke="#6ee7b7" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}

export function GoldCoinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#eab308" stroke="#422006" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="#fef08a" strokeWidth="1.5" />
      <path d="M12 8.5V15.5M10 10.5H14" stroke="#713f12" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SoundIcon({ muted, className = 'w-4 h-4' }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M11 5L6 9H3V15H6L11 19V5Z" fill="currentColor" />
      {muted ? (
        <path d="M16 9L21 15M21 9L16 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M18.5 6C21 8.5 21 15.5 18.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function PauseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="4" width="4.5" height="16" rx="1" fill="currentColor" />
      <rect x="13.5" y="4" width="4.5" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

export function RestartIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.5 12A7.5 7.5 0 1 1 6.7 17.3M4.5 12V7M4.5 12H9.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
