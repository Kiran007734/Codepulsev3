import React from 'react';

export default function CodePulseLogo({ size = 32, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`logo-glow-animation ${className}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur2" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur3" />
          <feMerge>
            <feMergeNode in="blur3" />
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="25%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="75%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>

        <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>

        <linearGradient id="hexGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>

      <style>
        {`
          .pulse-path {
            animation: dashPulse 4s infinite linear;
          }
          .circuit-line {
            animation: neonFlicker 5s infinite alternate;
          }
          .circuit-dot {
            animation: dotBlink 3s infinite alternate;
          }
          .circuit-dot:nth-child(even) {
            animation-delay: 1.5s;
          }
          .circuit-dot:nth-child(3n) {
            animation-delay: 0.7s;
          }
          @keyframes dashPulse {
            0% { stroke-dashoffset: 400; }
            50% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -400; }
          }
          @keyframes dotBlink {
            0%, 20% { opacity: 0.5; transform: scale(0.9); transform-origin: center; }
            50% { opacity: 1; transform: scale(1.2); transform-origin: center; }
            100% { opacity: 0.8; transform: scale(1); transform-origin: center; }
          }
          @keyframes neonFlicker {
            0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; filter: url(#neonGlow); }
            20%, 24%, 55% { opacity: 0.4; filter: none; }
          }
          .hero-pulse {
             animation: heroPulseAnim 2s infinite ease-in-out;
          }
          @keyframes heroPulseAnim {
             0% { transform: scale(1); filter: url(#neonGlow) brightness(1); }
             50% { transform: scale(1.03); filter: url(#neonGlow) brightness(1.3); }
             100% { transform: scale(1); filter: url(#neonGlow) brightness(1); }
          }
        `}
      </style>

      {/* Hexagon Border */}
      <polygon 
        points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5" 
        fill="none" 
        stroke="url(#hexGradient)" 
        strokeWidth="3.5"
        strokeLinejoin="round"
        filter="drop-shadow(0px 0px 8px rgba(34, 211, 238, 0.4))"
      />

      {/* Background glowing glow */}
      <circle cx="50" cy="50" r="30" fill="#22d3ee" opacity="0.1" filter="blur(15px)" />

      {/* Circuit lines with Neon Glow */}
      <g className="circuit-line" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#neonGlow)">
        {/* Left circuits */}
        <path d="M-5,45 L15,45 L20,35 L30,35" />
        <path d="M0,55 L22,55 L28,68 L38,68" />
        <path d="M11,27.5 L20,20" />
        <path d="M11,72.5 L25,80" />
        
        {/* Right circuits */}
        <path d="M105,45 L85,45 L80,35 L70,35" />
        <path d="M100,55 L78,55 L72,68 L62,68" />
        <path d="M89,27.5 L80,20" />
        <path d="M89,72.5 L75,80" />

        {/* Vertical accents */}
        <path d="M35,15 L42,25" />
        <path d="M65,15 L58,25" />
        <path d="M35,85 L42,75" />
        <path d="M65,85 L58,75" />
      </g>

      {/* Circuit Dots */}
      <circle cx="30" cy="35" r="2.5" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="38" cy="68" r="2.5" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="20" cy="20" r="2.5" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="25" cy="80" r="2.5" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      
      <circle cx="70" cy="35" r="2.5" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="62" cy="68" r="2.5" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="80" cy="20" r="2.5" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="75" cy="80" r="2.5" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />

      <circle cx="35" cy="15" r="2" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="65" cy="15" r="2" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="35" cy="85" r="2" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />
      <circle cx="65" cy="85" r="2" fill="#22d3ee" className="circuit-dot" filter="url(#neonGlow)" />

      {/* "CP" Monogram (Silver metallic layer) */}
      {/* C */}
      <path 
        d="M 42 35 L 30 35 L 18 50 L 30 65 L 42 65 L 42 57 L 33 57 L 27 50 L 33 43 L 42 43 Z" 
        fill="url(#silverGradient)" 
        filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.8))"
      />
      {/* P */}
      <path 
        d="M 46 35 L 68 35 L 81 50 L 68 60 L 54 60 L 54 75 L 46 75 Z M 54 43 L 54 52 L 65 52 L 71 50 L 65 43 Z" 
        fill="url(#silverGradient)" 
        fillRule="evenodd"
        filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.8))"
      />

      {/* Main Pulse/EKG Line (The Hero Element) */}
      <path 
        className="hero-pulse"
        d="M-10 50 L 22 50 L 28 25 L 42 80 L 52 20 L 62 70 L 70 50 L 110 50" 
        fill="none" 
        stroke="url(#cyanGradient)" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="bevel" 
        filter="url(#neonGlow)"
      />

      {/* Animated Traveling Energy on the Pulse Line */}
      <path 
        className="pulse-path"
        d="M-10 50 L 22 50 L 28 25 L 42 80 L 52 20 L 62 70 L 70 50 L 110 50" 
        fill="none" 
        stroke="#ffffff" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="bevel" 
        strokeDasharray="40 360"
        filter="url(#neonGlow)"
      />

    </svg>
  );
}
