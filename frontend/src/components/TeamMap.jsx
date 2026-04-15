import React, { useState, useMemo } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Typography, Box, Paper, useTheme } from '@mui/material';
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle';
import StarIcon from '@mui/icons-material/Star';

const TeamMap = ({ individuals, teamInfo }) => {
  const theme = useTheme();
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Default to a central view, or calculate bounds based on data
  const initialViewState = {
    longitude: 72.8777, // Default: Mumbai
    latitude: 19.0760,
    zoom: 4
  };

  const getMarkerStyle = (person) => {
    const isLeader = person.id === teamInfo?.leader_id || person.id === teamInfo?.org_leader_id;
    if (isLeader) return { color: '#D32F2F', icon: <StarIcon fontSize="large" sx={{ color: '#D32F2F' }}/>, label: 'Leader' };
    if (!person.is_direct_staff) return { color: '#F57C00', icon: <PersonPinCircleIcon fontSize="large" sx={{ color: '#F57C00' }}/>, label: 'Indirect Staff' };
    return { color: '#1976D2', icon: <PersonPinCircleIcon fontSize="large" sx={{ color: '#1976D2' }}/>, label: 'Direct Staff' };
  };

  const mappableIndividuals = useMemo(() => {
    return individuals.filter(p => p.location_lat && p.location_lng);
  }, [individuals]);

  if (mappableIndividuals.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#f8fafc' }}>
        <Typography color="text.secondary">No location data available for this team yet.</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ height: 450, width: '100%', borderRadius: 3, overflow: 'hidden', position: 'relative', border: `1px solid ${theme.palette.divider}`, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
      <Map
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
      >
        <NavigationControl position="top-right" />

        {mappableIndividuals.map(person => (
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
            <div style={{ cursor: 'pointer', transform: 'translate(0, 5px)', transition: 'transform 0.2s' }}>
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
            <Box sx={{ p: 1, minWidth: 140 }}>
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
