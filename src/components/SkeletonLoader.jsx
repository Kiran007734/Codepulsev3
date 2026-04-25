import React from 'react';

export default function SkeletonLoader() {
  return (
    <div className="animate-fade-in space-y-6 p-8">
      {/* Top stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-28 rounded-xl"></div>
        ))}
      </div>
      {/* Chart area */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 skeleton h-72 rounded-xl"></div>
        <div className="skeleton h-72 rounded-xl"></div>
      </div>
      {/* Bottom cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="skeleton h-40 rounded-xl"></div>
        <div className="skeleton h-40 rounded-xl"></div>
      </div>
    </div>
  );
}
