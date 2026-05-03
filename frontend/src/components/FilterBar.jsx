import { useState } from 'react';

// Zone options
const ZONES = ['all', 'A', 'B', 'C'];

// Vehicle type options
const VEHICLE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'truck', label: 'Truck' },
];

export default function FilterBar({ zone, setZone, vehicleType, setVehicleType, search, setSearch }) {
  const [searchInput, setSearchInput] = useState(search || '');

  // Debounce search to avoid excessive re-renders
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        {/* Zone Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone</label>
          <div className="flex gap-1.5 flex-wrap">
            {ZONES.map((z) => (
              <button
                key={z}
                onClick={() => setZone(z)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  zone === z
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {z === 'all' ? 'All' : `Zone ${z}`}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px h-10 bg-gray-200" />

        {/* Vehicle Type Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle</label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
          >
            {VEHICLE_TYPES.map((vt) => (
              <option key={vt.value} value={vt.value}>
                {vt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px h-10 bg-gray-200" />

        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 w-full lg:w-auto">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Search</label>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Slot (A1), plate (B 1234)..."
              className="flex-1 px-3 py-1.5 rounded-lg text-sm border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-gray-900 placeholder-gray-400"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
            {(search || searchInput) && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                }}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm rounded-lg transition-colors"
              >
                ✕
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
