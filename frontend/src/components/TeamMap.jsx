import React, { useState, useMemo, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Typography, Box, Paper, useTheme, Button } from '@mui/material';
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle';
import StarIcon from '@mui/icons-material/Star';

const TeamMap = ({ individuals, teamInfo }) => {
  const theme = useTheme();
  const [selectedPerson, setSelectedPerson] = useState(null);
  const mapRef = useRef(null);

  const getMarkerStyle = (person) => {
    // Rank 4 (Top): Org Leader (Secondary color)
    if (person.id === teamInfo?.org_leader_id) return { color: theme.palette.secondary.main, icon: <StarIcon fontSize="large" sx={{ color: 'secondary.main' }}/>, label: 'Org Leader', rank: 4 };
    
    // Rank 3: Team Leader (Error/Red color)
    if (person.id === teamInfo?.leader_id) return { color: theme.palette.error.main, icon: <StarIcon fontSize="large" sx={{ color: 'error.main' }}/>, label: 'Team Leader', rank: 3 };
    
    // Rank 2: Indirect Staff (Warning/Orange color)
    if (!person.is_direct_staff) return { color: theme.palette.warning.main, icon: <PersonPinCircleIcon fontSize="large" sx={{ color: 'warning.main' }}/>, label: 'Indirect Staff', rank: 2 };
    
    // Rank 1: Direct Staff (Primary/Blue color)
    return { color: theme.palette.primary.main, icon: <PersonPinCircleIcon fontSize="large" sx={{ color: 'primary.main' }}/>, label: 'Direct Staff', rank: 1 };
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

  // Sort individuals so that higher-ranked people (leaders) render last, ensuring they appear on top.
  const sortedGriddedIndividuals = useMemo(() => {
    return [...griddedIndividuals].sort((a, b) => {
      return getMarkerStyle(a).rank - getMarkerStyle(b).rank;
    });
  }, [griddedIndividuals, teamInfo]);

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

        {/* Reset View Button Overlay */}
        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => mapRef.current?.flyTo({ 
              center: [viewState.longitude, viewState.latitude], 
              zoom: viewState.zoom, 
              duration: 800 
            })}
            sx={{
              bgcolor: 'background.paper',
              color: 'text.primary',
              boxShadow: 2,
              fontWeight: 600,
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            Reset View
          </Button>
        </Box>

        {sortedGriddedIndividuals.map(person => (
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
              title={person.designation || 'No Designation'}
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
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                {selectedPerson.designation || 'No Designation'}
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

