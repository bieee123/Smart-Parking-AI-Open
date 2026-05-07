import { useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HiVideoCamera, HiRefresh, HiExclamation, HiCollection, HiX, HiPlus, HiSave, HiTrash, HiReply, HiTag, HiPencilAlt, HiCheck } from 'react-icons/hi';

// Safe Leaflet icon setup for Vite
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Camera Icon for Leaflet
const cameraIcon = new L.DivIcon({
  html: `<div class="bg-primary-600 p-2 rounded-full border-2 border-white shadow-lg text-white flex items-center justify-center">
           <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 20 20" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path></svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Vertex Icon for Dragging
const vertexIcon = new L.DivIcon({
  html: `<div class="w-3 h-3 bg-white border-2 border-primary-600 rounded-full shadow-md cursor-move"></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MAP_CENTER = [-6.9175, 107.6191]; // Bandung, Indonesia

const INITIAL_AREAS = [
  {
    id: 'area-1',
    name: 'Downtown Area',
    color: '#3b82f6',
    polygon: [
      [-6.9120, 107.6100],
      [-6.9120, 107.6200],
      [-6.9200, 107.6200],
      [-6.9200, 107.6100],
    ]
  },
  {
    id: 'area-2',
    name: 'Mall & Retail',
    color: '#ec4899',
    polygon: [
      [-6.9050, 107.6150],
      [-6.9050, 107.6250],
      [-6.9100, 107.6250],
      [-6.9100, 107.6150],
    ]
  }
];

const CCTV_DATA = [
  { id: 'CAM-01', name: 'Main Gate Downtown', coords: [-6.9150, 107.6150], area: 'Downtown' },
  { id: 'CAM-02', name: 'Mall Entrance North', coords: [-6.9070, 107.6200], area: 'Mall' },
  { id: 'CAM-03', name: 'Office South Aisle', coords: [-6.9220, 107.6300], area: 'Office' },
  { id: 'CAM-04', name: 'Downtown Central', coords: [-6.9170, 107.6180], area: 'Downtown' },
];

// ── Drawing Component ──────────────────────────────────────────────────────────

// ── Custom Popup Wrapper with Dark Header ──────────────────────────────────────
function UnifiedPopup({ id, title, icon: Icon, color = "text-primary-400", children }) {
  const map = useMap();
  
  return (
    <div 
      className="w-64 overflow-hidden rounded-xl shadow-2xl border border-gray-200 bg-white"
      onMouseDown={(e) => L.DomEvent.stopPropagation(e)}
      onClick={(e) => L.DomEvent.stopPropagation(e)}
    >
      {/* Dark Header */}
      <div className="bg-slate-900 p-3 flex items-center justify-between text-white border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-white/10 rounded-md">
            <Icon className={`text-sm ${color}`} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 leading-none mb-0.5">{id}</span>
            <span className="text-[11px] font-bold truncate max-w-[140px] leading-none">{title}</span>
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            map.closePopup();
          }}
          className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
        >
          <HiX className="text-sm" />
        </button>
      </div>
      
      {/* Body Content */}
      <div className="p-4 bg-white">
        {children}
      </div>
    </div>
  );
}

function MapEvents({ activeMode, onMapClick }) {
  useMapEvents({ click(e) { if (activeMode !== 'none') onMapClick(e.latlng); } });
  return null;
}

export default function BottleneckMap({ bottlenecks: initialBottlenecks, title }) {
  // Map State
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCctv, setShowCctv] = useState(true);
  const [showAreas, setShowAreas] = useState(true);
  const [showBottlenecks, setShowBottlenecks] = useState(true);

  // Admin Action State
  const [activeMode, setActiveMode] = useState('none'); // 'none', 'area', 'cctv', 'bottleneck'
  const [currentPolygon, setCurrentPolygon] = useState([]);
  const [userAreas, setUserAreas] = useState(INITIAL_AREAS);
  const [userCctvs, setUserCctvs] = useState(CCTV_DATA);
  const [userBottlenecks, setUserBottlenecks] = useState([]);
  
  const [newAreaName, setNewAreaName] = useState('');
  const [editingAreaId, setEditingAreaId] = useState(null);

  const handleMapClick = useCallback((latlng) => {
    if (activeMode === 'area') {
      setCurrentPolygon(prev => [...prev, [latlng.lat, latlng.lng]]);
    } else if (activeMode === 'cctv') {
      const newCam = {
        id: `CAM-${Math.floor(100 + Math.random() * 900)}`,
        name: `Manual Camera ${userCctvs.length + 1}`,
        coords: [latlng.lat, latlng.lng],
        area: 'Manual Placement',
        isManual: true
      };
      setUserCctvs(prev => [...prev, newCam]);
      setActiveMode('none');
    } else if (activeMode === 'bottleneck') {
      const newB = {
        id: `B-${Date.now()}`,
        name: 'Manual Bottleneck',
        severity: 0.8,
        coords: [latlng.lat, latlng.lng],
        isManual: true
      };
      setUserBottlenecks(prev => [...prev, newB]);
      setActiveMode('none');
    }
  }, [activeMode, userCctvs.length, userBottlenecks.length]);

  const saveNewArea = () => {
    if (currentPolygon.length < 3) return;
    const newArea = {
      id: `user-area-${Date.now()}`,
      name: newAreaName || `Zone ${userAreas.length + 1}`,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      polygon: currentPolygon
    };
    setUserAreas(prev => [...prev, newArea]);
    setCurrentPolygon([]);
    setActiveMode('none');
    setNewAreaName('');
  };

  const deleteArea = (id) => {
    setUserAreas(prev => prev.filter(a => a.id !== id));
    if (editingAreaId === id) setEditingAreaId(null);
  };

  const deleteCctv = (id) => {
    setUserCctvs(prev => prev.filter(c => c.id !== id));
  };

  const deleteManualBottleneck = (id) => {
    setUserBottlenecks(prev => prev.filter(b => b.id !== id));
  };

  const updateVertex = (areaId, vertexIndex, newLatLng) => {
    setUserAreas(prev => prev.map(area => {
      if (area.id === areaId) {
        const newPolygon = [...area.polygon];
        newPolygon[vertexIndex] = [newLatLng.lat, newLatLng.lng];
        return { ...area, polygon: newPolygon };
      }
      return area;
    }));
  };

  // Merge prop bottlenecks with manual ones
  const allBottleneckMarkers = useMemo(() => {
    const apiOnes = (initialBottlenecks || []).map((b, i) => ({
      ...b,
      coords: b.coords || [MAP_CENTER[0] + (Math.random() - 0.5) * 0.02, MAP_CENTER[1] + (Math.random() - 0.5) * 0.02]
    }));
    return [...apiOnes, ...userBottlenecks];
  }, [initialBottlenecks, userBottlenecks]);

  return (
    <div className="w-full relative group">
      <div className="flex items-center justify-between mb-3">
        {title && <h3 className="text-lg font-semibold text-gray-700">{title}</h3>}
        <div className="flex items-center gap-3">
          {editingAreaId && (
            <button 
              onClick={() => setEditingAreaId(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white shadow-lg shadow-green-100 transition-all hover:bg-green-700 animate-pulse"
            >
              <HiCheck /> Finish Editing
            </button>
          )}
          
          <div className="flex bg-gray-100 rounded-xl p-1 border border-gray-200">
            <button 
              onClick={() => setActiveMode(activeMode === 'area' ? 'none' : 'area')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${activeMode === 'area' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-600 hover:bg-white'}`}
            >
              <HiPlus /> Area
            </button>
            <button 
              onClick={() => setActiveMode(activeMode === 'cctv' ? 'none' : 'cctv')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${activeMode === 'cctv' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-white'}`}
            >
              <HiVideoCamera /> CCTV
            </button>
            <button 
              onClick={() => setActiveMode(activeMode === 'bottleneck' ? 'none' : 'bottleneck')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${activeMode === 'bottleneck' ? 'bg-red-600 text-white shadow-md' : 'text-gray-600 hover:bg-white'}`}
            >
              <HiExclamation /> Bottleneck
            </button>
          </div>
        </div>
      </div>

      <div className={`h-[450px] rounded-2xl border-2 overflow-hidden shadow-2xl relative z-0 transition-all ${activeMode !== 'none' || editingAreaId ? 'border-primary-400 ring-4 ring-primary-50' : 'border-gray-200'}`}>
        <MapContainer center={MAP_CENTER} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapEvents isDrawing={activeMode !== 'none'} onMapClick={handleMapClick} />

          {/* Area Polygons */}
          {showAreas && userAreas.map(area => (
            <div key={area.id}>
              <Polygon 
                key={`${area.id}-${activeMode === 'none' ? 'int' : 'static'}`} // Force re-render to update interactive prop
                positions={area.polygon} 
                interactive={activeMode === 'none'} 
                pathOptions={{ 
                  color: area.color, 
                  fillOpacity: editingAreaId === area.id ? 0.3 : 0.15, 
                  weight: editingAreaId === area.id ? 4 : 2,
                  dashArray: editingAreaId === area.id ? '5, 5' : '',
                  // FORCE click-through at CSS level
                  pointerEvents: activeMode === 'none' ? 'auto' : 'none'
                }} 
              >
                <Popup closeButton={false}>
                  <UnifiedPopup id="ZONE-AREA" title={area.name} icon={HiTag} color="text-blue-400">
                    <div className="space-y-2">
                      <button 
                        onClick={() => setEditingAreaId(area.id)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        <HiPencilAlt /> Edit Shape
                      </button>
                      <button 
                        onClick={() => deleteArea(area.id)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors"
                      >
                        <HiTrash /> Delete Area
                      </button>
                    </div>
                  </UnifiedPopup>
                </Popup>
              </Polygon>

              {/* Draggable Vertices when editing */}
              {editingAreaId === area.id && area.polygon.map((p, i) => (
                <Marker 
                  key={`${area.id}-vertex-${i}`} 
                  position={p} 
                  draggable={true}
                  icon={vertexIcon}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const position = marker.getLatLng();
                      updateVertex(area.id, i, position);
                    }
                  }}
                />
              ))}
            </div>
          ))}

          {/* Current Drawing Polygon */}
          {activeMode === 'area' && currentPolygon.length > 0 && (
            <>
              <Polygon 
                positions={currentPolygon} 
                pathOptions={{ color: '#6366f1', dashArray: '5, 10', pointerEvents: 'none' }} 
              />
              {currentPolygon.map((p, i) => (
                <Marker 
                  key={`new-vertex-${i}`} 
                  position={p} 
                  draggable={true}
                  icon={new L.DivIcon({
                    html: `<div class="w-3 h-3 bg-primary-600 rounded-full border-2 border-white shadow-lg cursor-move"></div>`,
                    className: '',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                  eventHandlers={{
                    dragend: (e) => {
                      const newPoly = [...currentPolygon];
                      newPoly[i] = [e.target.getLatLng().lat, e.target.getLatLng().lng];
                      setCurrentPolygon(newPoly);
                    }
                  }}
                />
              ))}
            </>
          )}

          {showCctv && userCctvs.map((cam) => (
            <Marker 
              key={`${cam.id}-${activeMode === 'none' ? 'int' : 'static'}`}
              position={cam.coords} 
              icon={cameraIcon}
              interactive={activeMode === 'none'}
            >
              <Popup className="custom-popup" closeButton={false}>
                <UnifiedPopup id={cam.id} title={cam.name} icon={HiVideoCamera} color="text-primary-400">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-tight">Current Status</p>
                      <p className="text-[11px] text-green-600 font-black flex items-center gap-1.5 leading-tight">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        LIVE COVERAGE ACTIVE
                      </p>
                    </div>
                    <button onClick={() => deleteCctv(cam.id)} className="w-full py-2 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-all flex items-center justify-center gap-1.5 border border-red-100"><HiTrash /> Remove Camera</button>
                  </div>
                </UnifiedPopup>
              </Popup>
            </Marker>
          ))}

          {showBottlenecks && allBottleneckMarkers.map((b) => (
            <Marker 
              key={`${b.id}-${activeMode === 'none' ? 'int' : 'static'}`}
              position={b.coords}
              interactive={activeMode === 'none'}
              icon={new L.DivIcon({
                html: `<div class="relative flex items-center justify-center">
                         <div class="absolute w-6 h-6 rounded-full bg-red-500 opacity-20 animate-ping"></div>
                         <div class="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-md"></div>
                       </div>`,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })}
            >
              <Popup closeButton={false}>
                <UnifiedPopup id="BOTTLENECK-NODE" title={b.name} icon={HiExclamation} color="text-red-500">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-red-50 p-3 rounded-xl border border-red-100">
                      <p className="text-xs font-bold text-red-700">Severity Level</p>
                      <p className="text-sm font-black text-red-600">{(b.severity * 100).toFixed(0)}%</p>
                    </div>
                    {b.isManual && (
                      <button onClick={() => deleteManualBottleneck(b.id)} className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 uppercase tracking-widest">Remove Alert</button>
                    )}
                  </div>
                </UnifiedPopup>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Action Instruction Overlay */}
        {activeMode !== 'none' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-primary-200 shadow-xl flex items-center gap-3">
             <span className="flex h-2 w-2 rounded-full bg-primary-600 animate-pulse" />
             <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">
               {activeMode === 'area' ? 'Click map to place points' : `Click map to place ${activeMode.toUpperCase()}`}
             </span>
             <button onClick={() => { setActiveMode('none'); setCurrentPolygon([]); setEditingAreaId(null); }} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors">
               <HiX />
             </button>
          </div>
        )}

        {/* Drawing Toolbar (Only for Area) */}
        {activeMode === 'area' && currentPolygon.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-primary-200 flex flex-col gap-3 min-w-[300px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest">New Zone Creation</span>
              <span className="text-[10px] text-gray-400">{currentPolygon.length} vertices added</span>
            </div>
            
            <input 
              type="text" 
              placeholder="Area Name (e.g. VIP Parking)"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPolygon(prev => prev.slice(0, -1))}
                disabled={currentPolygon.length === 0}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <HiReply /> Undo
              </button>
              <button 
                onClick={saveNewArea}
                disabled={currentPolygon.length < 3}
                className="flex-[2] py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg shadow-primary-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <HiSave /> Save Area
              </button>
            </div>
          </div>
        )}

        {/* Custom Premium Layer Control - Collapsible */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-3 rounded-2xl border border-white/50 shadow-2xl transition-all duration-300 ${
              isExpanded ? 'bg-primary-600 text-white mb-2' : 'bg-white/80 backdrop-blur-md text-gray-600 hover:bg-white'
            }`}
          >
            {isExpanded ? <HiX className="text-xl" /> : <HiCollection className="text-xl" />}
          </button>

          <div className={`bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-2xl min-w-[200px] transition-all duration-300 origin-top-right ${
            isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
          }`}>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-1">Map Layers</h4>
            <div className="space-y-3">
              <LayerToggle label="CCTV Nodes" icon={<HiVideoCamera className="text-primary-600" />} checked={showCctv} onChange={setShowCctv} />
              <LayerToggle label="Area Polygons" icon={<div className="w-3 h-3 rounded bg-pink-500 opacity-60" />} checked={showAreas} onChange={setShowAreas} />
              <LayerToggle label="Traffic Bottlenecks" icon={<div className="w-3 h-3 rounded-full bg-red-500" />} checked={showBottlenecks} onChange={setShowBottlenecks} />
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-popup-content-wrapper { 
          padding: 0 !important; 
          border-radius: 12px !important; 
          overflow: visible !important; 
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1) !important; 
        }
        .leaflet-popup-content { 
          margin: 0 !important; 
          width: 256px !important; 
        }
        .leaflet-popup-close-button {
          z-index: 1001 !important;
          color: #94a3b8 !important;
          font-size: 16px !important;
          padding: 8px !important;
          top: 4px !important;
          right: 4px !important;
        }
        .leaflet-popup-close-button:hover {
          color: #ef4444 !important;
          background: #fee2e2 !important;
          border-radius: 8px !important;
        }
        .leaflet-container { 
          font-family: inherit !important; 
          cursor: ${activeMode !== 'none' ? 'crosshair' : 'grab'} !important; 
        }
      `}} />
    </div>
  );
}

function LayerToggle({ label, icon, checked, onChange }) {
  return (
    <label className="flex items-center justify-between group cursor-pointer hover:bg-white/40 p-1.5 rounded-xl transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className="text-[11px] font-semibold text-gray-700">{label}</span>
      </div>
      <div className="relative inline-flex items-center">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-600"></div>
      </div>
    </label>
  );
}
