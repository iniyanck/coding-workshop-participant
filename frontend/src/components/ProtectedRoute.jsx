import { Navigate } from 'react-router-dom';
import authService from '../services/authService';

export default function ProtectedRoute({ children, requiredRoles = [] }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !authService.hasRole(requiredRoles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
