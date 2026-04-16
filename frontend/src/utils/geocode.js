import axios from 'axios';

// Note: Nominatim is free but has strict rate limits (1 request/second).
export const geocodeLocation = async (locationString) => {
  if (!locationString) return { lat: null, lng: null };
  
  const trySearch = async (query) => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: query, format: 'json', limit: 1 },
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (response.data && response.data.length > 0) {
        return {
          lat: parseFloat(response.data[0].lat),
          lng: parseFloat(response.data[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error("Geocoding failed for query:", query, error);
      return null;
    }
  };

  // 1. Try exact match
  let coords = await trySearch(locationString);
  if (coords) return coords;

  // 2. Try cleaning up typos/special characters and searching the macro-location (like state/country)
  // E.g., "Nw Yrok, USA" might fail, but "USA" will drop them on the map.
  const parts = locationString.split(',').map(s => s.trim());
  if (parts.length > 1) {
    coords = await trySearch(parts[parts.length - 1]);
    if (coords) return coords;
  }
  
  // 3. Fallback: Return a default coordinate (0,0) if everything completely fails.
  return { lat: 0, lng: 0 };
};
