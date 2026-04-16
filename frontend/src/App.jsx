import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import IndividualsPage from './pages/IndividualsPage';
import TeamsPage from './pages/TeamsPage';
import AchievementsPage from './pages/AchievementsPage';
import SkillsPage from './pages/SkillsPage';
import DevPlansPage from './pages/DevPlansPage';
import UsersPage from './pages/UsersPage';
import HRISConsolePage from './pages/HRISConsolePage';
import { ColorModeProvider, useColorMode } from './contexts/ColorModeContext';

function AppContent() {
  const { mode } = useColorMode();

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: mode === 'light' ? '#667eea' : '#818cf8' },
      secondary: { main: mode === 'light' ? '#764ba2' : '#a78bfa' },
      background: {
        default: mode === 'light' ? '#f8fafc' : '#0f172a',
        paper: mode === 'light' ? '#ffffff' : '#1e293b',
      },
      text: {
        primary: mode === 'light' ? '#1e293b' : '#f1f5f9',
        secondary: mode === 'light' ? '#64748b' : '#94a3b8',
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h3: { fontWeight: 800 },
      h4: { fontWeight: 800 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { 
            boxShadow: mode === 'light' 
              ? '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)' 
              : '0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -1px rgba(0,0,0,0.1)',
            backgroundImage: 'none', // Remove MUI dark mode overlay
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: mode === 'light' ? '#f1f5f9' : 'rgba(255,255,255,0.08)' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.8)',
            color: mode === 'light' ? '#1e293b' : '#f1f5f9',
          }
        }
      }
    },
  }), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="individuals" element={<IndividualsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="achievements" element={<AchievementsPage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="dev-plans" element={<DevPlansPage />} />
          <Route path="users" element={
            <ProtectedRoute requiredRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />
          <Route path="hris-console" element={
            <ProtectedRoute requiredRoles={['admin']}>
              <HRISConsolePage />
            </ProtectedRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ColorModeProvider>
      <AppContent />
    </ColorModeProvider>
  );
}

export default App;

