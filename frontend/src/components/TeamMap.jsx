import React, { useState, useMemo } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Typography, Box, Paper, useTheme } from '@mui/material';
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle';
import StarIcon from '@mui/icons-material/Star';

const TeamMap = ({ individuals, teamInfo }) => {
  const theme = useTheme();
  const [selectedPerson, setSelectedPerson] = useState(null);

  const getMarkerStyle = (person) => {
    const isLeader = person.id === teamInfo?.leader_id || person.id === teamInfo?.org_leader_id;
    if (isLeader) return { color: theme.palette.error.main, icon: <StarIcon fontSize="large" sx={{ color: 'error.main' }}/>, label: 'Leader' };
    if (!person.is_direct_staff) return { color: theme.palette.warning.main, icon: <PersonPinCircleIcon fontSize="large" sx={{ color: 'warning.main' }}/>, label: 'Indirect Staff' };
    return { color: theme.palette.primary.main, icon: <PersonPinCircleIcon fontSize="large" sx={{ color: 'primary.main' }}/>, label: 'Direct Staff' };
  };

  const mappableIndividuals = useMemo(() => {
    return individuals.filter(p => p.location_lat != null && p.location_lng != null);
  }, [individuals]);

  // Apply a tiny random positional offset to spread out markers that land on the exact same city
  const jitteredIndividuals = useMemo(() => {
    const seen = {};
    return mappableIndividuals.map(p => {
        const key = `${p.location_lat},${p.location_lng}`;
        if (seen[key]) {
            const offsetLat = (Math.random() - 0.5) * 0.05;
            const offsetLng = (Math.random() - 0.5) * 0.05;
            seen[key] += 1;
            return { ...p, location_lat: p.location_lat + offsetLat, location_lng: p.location_lng + offsetLng };
        }
        seen[key] = 1;
        return p;
    });
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
      <Map
        initialViewState={viewState}
        mapStyle={mapStyle}
      >
        <NavigationControl position="top-right" />

        {jitteredIndividuals.map(person => (
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

