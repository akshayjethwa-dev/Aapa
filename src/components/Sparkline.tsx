import React from 'react';

const Sparkline = ({ color = '#10b981' }: { color?: string }) => (
  <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 23L10 15L20 18L30 8L40 12L50 2L59 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default Sparkline;