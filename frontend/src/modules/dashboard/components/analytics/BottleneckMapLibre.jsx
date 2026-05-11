import { useState, useMemo, useCallback } from 'react';
import Map, { Marker, Popup, Source, Layer, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  HiVideoCamera, HiCollection, HiX, HiPlus, HiSave, HiTrash, 
  HiReply, HiTag, HiPencilAlt, HiCheck, HiExclamation 
} from 'react-icons/hi';

// -- Mock Data -----------------------------------------------------------------
const MAP_CENTER = {
  latitude: -6.9175,
  longitude: 107.6191,
  zoom: 14,
  pitch: 45, // Tilt for 3D effect
  bearing: -17.6
};

// Carto Voyager GL Style - High quality, light, and vibrant (Waze-like)
const MAP_STYLE = 'https://tiles.basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const INITIAL_AREAS = [
  {
    id: 'area-1',
    name: 'Downtown Area',
    color: '#3b82f6',
    polygon: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [107.6100, -6.9120],
          [107.6200, -6.9120],
          [107.6200, -6.9200],
          [107.6100, -6.9200],
          [107.6100, -6.9120]
        ]]
      }
    }
  },
  {
    id: 'area-2',
    name: 'Mall & Retail',
    color: '#ec4899',
    polygon: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [107.6150, -6.9050],
          [107.6250, -6.9050],
          [107.6250, -6.9100],
          [107.6150, -6.9100],
          [107.6150, -6.9050]
        ]]
      }
    }
  }
];

const CCTV_DATA = [
  { id: 'CAM-01', name: 'Main Gate Downtown', coords: [107.6150, -6.9150], area: 'Downtown' },
  { id: 'CAM-02', name: 'Mall Entrance North', coords: [107.6200, -6.9070], area: 'Mall' },
  { id: 'CAM-03', name: 'Office South Aisle', coords: [107.6300, -6.9220], area: 'Office' },
  { id: 'CAM-04', name: 'Downtown Central', coords: [107.6180, -6.9170], area: 'Downtown' },
];

export default function BottleneckMapLibre({ bottlenecks: initialBottlenecks, title }) {
  const [viewState, setViewState] = useState(MAP_CENTER);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCctv, setShowCctv] = useState(true);
  const [showAreas, setShowAreas] = useState(true);
  const [showBottlenecks, setShowBottlenecks] = useState(true);
  
  const [popupInfo, setPopupInfo] = useState(null);
  
  // Merge prop bottlenecks with manual ones (simplified for MapLibre demo)
  const allBottlenecks = useMemo(() => {
    return (initialBottlenecks || []).map((b, i) => ({
      ...b,
      // MapLibre uses [lng, lat]
      longitude: b.coords ? b.coords[1] : MAP_CENTER.longitude + (Math.random() - 0.5) * 0.02,
      latitude: b.coords ? b.coords[0] : MAP_CENTER.latitude + (Math.random() - 0.5) * 0.02,
    }));
  }, [initialBottlenecks]);

  // Layer Styles
  const areaLayerStyle = {
    id: 'area-fill',
    type: 'fill',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.2
    }
  };

  const areaOutlineStyle = {
    id: 'area-outline',
    type: 'line',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 2
    }
  };

  // Convert areas to GeoJSON
  const areasGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: INITIAL_AREAS.map(a => ({
      ...a.polygon,
      properties: { name: a.name, color: a.color, id: a.id }
    }))
  }), []);

  return (
    <div className="w-full relative group">
      <div className="flex items-center justify-between mb-3">
        {title && <h3 className="text-lg font-semibold text-gray-700">{title}</h3>}
        
        {/* Quick Legend / Info */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-bold text-blue-600">
             <span className="w-2 h-2 rounded-full bg-blue-500" />
             AI PREDICTION ACTIVE
          </div>
        </div>
      </div>

      <div className="h-[500px] rounded-2xl border-2 border-gray-200 overflow-hidden shadow-2xl relative z-0">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle={MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
        >
          {/* 3D Buildings Layer (Automatic if style supports it, but we can add fill-extrusion if needed) */}
          <Layer
            id="3d-buildings"
            type="fill-extrusion"
            source="openmaptiles"
            source-layer="building"
            minzoom={14}
            paint={{
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': ['get', 'render_height'],
              'fill-extrusion-base': ['get', 'render_min_height'],
              'fill-extrusion-opacity': 0.6
            }}
          />

          <NavigationControl position="top-left" />
          <FullscreenControl position="top-left" />

          {/* Areas Source & Layers */}
          {showAreas && (
            <Source type="geojson" data={areasGeoJSON}>
              <Layer {...areaLayerStyle} />
              <Layer {...areaOutlineStyle} />
            </Source>
          )}

          {/* CCTV Markers */}
          {showCctv && CCTV_DATA.map(cam => (
            <Marker
              key={cam.id}
              longitude={cam.coords[0]}
              latitude={cam.coords[1]}
              anchor="bottom"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setPopupInfo({ type: 'cctv', ...cam });
              }}
            >
              <div className="cursor-pointer group">
                <div className="bg-indigo-600 p-2 rounded-full border-2 border-white shadow-lg text-white transform group-hover:scale-110 transition-transform">
                  <HiVideoCamera className="w-4 h-4" />
                </div>
              </div>
            </Marker>
          ))}

          {/* Bottleneck Markers */}
          {showBottlenecks && allBottlenecks.map(b => (
            <Marker
              key={b.id}
              longitude={b.longitude}
              latitude={b.latitude}
              anchor="center"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setPopupInfo({ type: 'bottleneck', ...b });
              }}
            >
              <div className="relative flex items-center justify-center cursor-pointer group">
                 <div className="absolute w-8 h-8 rounded-full bg-red-500 opacity-20 animate-ping" />
                 <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-md transform group-hover:scale-125 transition-transform" />
              </div>
            </Marker>
          ))}

          {/* Popups */}
          {popupInfo && (
            <Popup
              longitude={popupInfo.type === 'cctv' ? popupInfo.coords[0] : popupInfo.longitude}
              latitude={popupInfo.type === 'cctv' ? popupInfo.coords[1] : popupInfo.latitude}
              anchor="top"
              onClose={() => setPopupInfo(null)}
              closeButton={false}
              className="premium-popup"
            >
              <div className="w-56 overflow-hidden rounded-xl bg-white shadow-2xl border border-gray-100">
                <div className={`p-3 text-white flex items-center justify-between ${popupInfo.type === 'cctv' ? 'bg-indigo-600' : 'bg-red-600'}`}>
                   <div className="flex items-center gap-2">
                     {popupInfo.type === 'cctv' ? <HiVideoCamera /> : <HiExclamation />}
                     <span className="text-xs font-bold truncate">{popupInfo.name}</span>
                   </div>
                   <button onClick={() => setPopupInfo(null)}><HiX /></button>
                </div>
                <div className="p-4">
                   {popupInfo.type === 'cctv' ? (
                     <div className="space-y-2">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status</p>
                        <div className="flex items-center gap-2 text-[11px] font-black text-green-600">
                           <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                           LIVE STREAMING
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-3">
                        <div className="bg-red-50 p-2 rounded-lg border border-red-100 flex justify-between items-center">
                           <span className="text-[10px] font-bold text-red-700 uppercase">Severity</span>
                           <span className="text-sm font-black text-red-600">{Math.round(popupInfo.severity * 100)}%</span>
                        </div>
                        <p className="text-[10px] text-gray-500 italic">"High traffic bottleneck detected near intersection."</p>
                     </div>
                   )}
                </div>
              </div>
            </Popup>
          )}
        </Map>

        {/* Custom Overlay Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-3 rounded-2xl border shadow-xl transition-all ${
              isExpanded ? 'bg-indigo-600 text-white' : 'bg-white/80 backdrop-blur-md text-gray-600 hover:bg-white'
            }`}
          >
            {isExpanded ? <HiX className="text-xl" /> : <HiCollection className="text-xl" />}
          </button>

          <div className={`bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl min-w-[200px] transition-all duration-300 origin-top-right ${
            isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
          }`}>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Map Layers</h4>
            <div className="space-y-3">
              <Toggle label="CCTV Nodes" checked={showCctv} onChange={setShowCctv} color="bg-indigo-600" />
              <Toggle label="Zones (3D)" checked={showAreas} onChange={setShowAreas} color="bg-blue-500" />
              <Toggle label="Bottlenecks" checked={showBottlenecks} onChange={setShowBottlenecks} color="bg-red-500" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
               <p className="text-[9px] text-gray-400 font-medium">Map Engine: MapLibre GL</p>
               <p className="text-[9px] text-gray-400 font-medium">Style: Carto Voyager (Free)</p>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-popup-content {
          padding: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .maplibregl-popup-tip {
          border-bottom-color: white !important;
        }
      `}} />
    </div>
  );
}

function Toggle({ label, checked, onChange, color }) {
  return (
    <label className="flex items-center justify-between group cursor-pointer p-1 rounded-lg hover:bg-white transition-colors">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded ${color} opacity-80`} />
        <span className="text-[11px] font-semibold text-gray-700">{label}</span>
      </div>
      <div className="relative inline-flex items-center">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
      </div>
    </label>
  );
}
