import React, { useState, useMemo, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Typography, Box, Paper, useTheme } from '@mui/material';
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle';
import StarIcon from '@mui/icons-material/Star';

const TeamMap = ({ individuals, teamInfo }) => {
  const theme = useTheme();
  const [selectedPerson, setSelectedPerson] = useState(null);
  const mapRef = useRef(null);

  const getMarkerStyle = (person) => {
    const isLeader = person.id === teamInfo?.leader_id || person.id === teamInfo?.org_leader_id;
    if (isLeader) return { color: theme.palette.error.main, icon: <StarIcon fontSize="large" sx={{ color: 'error.main' }}/>, label: 'Leader' };
    if (!person.is_direct_staff) return { color: theme.palette.warning.main, icon: <PersonPinCircleIcon fontSize="large" sx={{ color: 'warning.main' }}/>, label: 'Indirect Staff' };
    return { color: theme.palette.primary.main, icon: <PersonPinCircleIcon fontSize="large" sx={{ color: 'primary.main' }}/>, label: 'Direct Staff' };
  };

  const mappableIndividuals = useMemo(() => {
    return individuals.filter(p => p.location_lat != null && p.location_lng != null);
  }, [individuals]);

  const griddedIndividuals = useMemo(() => {
    const grouped = {};
    
    // Group people by exact coordinates
    mappableIndividuals.forEach(p => {
      const key = `${p.location_lat},${p.location_lng}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    const result = [];
    const offsetStep = 0.00015; // Roughly 15 meters separation

    Object.values(grouped).forEach(group => {
      const cols = Math.ceil(Math.sqrt(group.length));
      group.forEach((p, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        
        // Center the grid over the original coordinate
        const rowOffset = (row - (cols - 1) / 2) * offsetStep;
        const colOffset = (col - (cols - 1) / 2) * offsetStep;
        
        result.push({ 
          ...p, 
          location_lat: p.location_lat + rowOffset, 
          location_lng: p.location_lng + colOffset 
        });
      });
    });
    
    return result;
  }, [mappableIndividuals]);

  const viewState = useMemo(() => {
    if (mappableIndividuals.length === 0) {
      return { longitude: 72.8777, latitude: 19.0760, zoom: 4 };
    }
    
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    mappableIndividuals.forEach(p => {
       if (p.location_lng < minLng) minLng = p.location_lng;
       if (p.location_lng > maxLng) maxLng = p.location_lng;
       if (p.location_lat < minLat) minLat = p.location_lat;
       if (p.location_lat > maxLat) maxLat = p.location_lat;
    });

    if (minLng === maxLng && minLat === maxLat) {
       return { longitude: minLng, latitude: minLat, zoom: 8 };
    }

    return {
       longitude: (minLng + maxLng) / 2,
       latitude: (minLat + maxLat) / 2,
       zoom: 3
    };
  }, [mappableIndividuals]);

  if (mappableIndividuals.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: 'action.hover' }}>
        <Typography color="text.secondary">No location data available for this team yet. Use HRIS Console to push locations.</Typography>
      </Paper>
    );
  }

  const mapStyle = theme.palette.mode === 'light' 
    ? "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  return (
    <Box sx={{ 
      height: 450, 
      width: '100%', 
      borderRadius: 3, 
      overflow: 'hidden', 
      position: 'relative', 
      border: '1px solid',
      borderColor: 'divider',
      boxShadow: theme.palette.mode === 'light' ? '0 10px 30px rgba(0,0,0,0.1)' : '0 10px 30px rgba(0,0,0,0.4)' 
    }}>
      {/* Global override for MapLibre popups */}
      <style>{`
        .maplibregl-popup-content {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
          border-radius: 8px;
          box-shadow: ${theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.1)'};
          padding: 16px 24px 16px 16px;
        }
        .maplibregl-popup-close-button {
          color: ${theme.palette.text.secondary};
          font-size: 16px;
          right: 6px;
          top: 6px;
          border-radius: 4px;
        }
        .maplibregl-popup-close-button:hover {
          background-color: ${theme.palette.action.hover};
        }
        .maplibregl-popup-tip {
          border-top-color: ${theme.palette.background.paper} !important;
          border-bottom-color: ${theme.palette.background.paper} !important;
        }
      `}</style>

      <Map
        ref={mapRef}
        initialViewState={viewState}
        mapStyle={mapStyle}
      >
        <NavigationControl position="top-right" />

        {griddedIndividuals.map(person => (
          <Marker 
            key={person.id} 
            longitude={person.location_lng} 
            latitude={person.location_lat}
            anchor="bottom"
            onClick={e => {
              e.originalEvent.stopPropagation();
              setSelectedPerson(person);
            }}
          >
            {/* Add double click handler here */}
            <div 
              style={{ cursor: 'pointer', transform: 'translate(0, 5px)', transition: 'transform 0.2s' }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                mapRef.current?.flyTo({ center: [person.location_lng, person.location_lat], zoom: 18, duration: 800 });
              }}
            >
              {getMarkerStyle(person).icon}
            </div>
          </Marker>
        ))}

        {selectedPerson && (
          <Popup
            longitude={selectedPerson.location_lng}
            latitude={selectedPerson.location_lat}
            anchor="top"
            onClose={() => setSelectedPerson(null)}
            closeOnClick={false}
            style={{ zIndex: 1000 }}
          >
            <Box sx={{ p: 1, minWidth: 140, color: 'text.primary' }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {selectedPerson.first_name} {selectedPerson.last_name}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                {getMarkerStyle(selectedPerson).label}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                {selectedPerson.location}
              </Typography>
            </Box>
          </Popup>
        )}
      </Map>
    </Box>
  );
};

export default TeamMap;

