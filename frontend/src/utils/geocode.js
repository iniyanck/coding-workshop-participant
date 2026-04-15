import axios from 'axios';

// Note: Nominatim is free but has strict rate limits (1 request/second).
// For a workshop project, this is perfect.
export const geocodeLocation = async (locationString) => {
  if (!locationString) return { lat: null, lng: null };
  
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: locationString,
        format: 'json',
        limit: 1
      }
    });

    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lng: parseFloat(response.data[0].lon)
      };
    }
    return { lat: null, lng: null };
  } catch (error) {
    console.error("Geocoding failed:", error);
    return { lat: null, lng: null };
  }
};
