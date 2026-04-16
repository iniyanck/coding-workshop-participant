import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, Tabs, Tab, CircularProgress, useTheme,
  Checkbox, FormControlLabel, Tooltip
} from '@mui/material';
import {
  Visibility, VisibilityOff,
  Email as EmailIcon, Person as PersonIcon, Lock as LockIcon,
  LightMode as LightIcon, DarkMode as DarkIcon,
} from '@mui/icons-material';
import authService from '../services/authService';
import logo from '../assets/logo.png';
import { useColorMode } from '../contexts/ColorModeContext';

const MAX_RETRIES = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export default function LoginPage() {
  const [tab, setTab] = useState(0);
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberMe') === 'true');
  const [form, setForm] = useState({ 
    username: localStorage.getItem('rememberedUsername') || '', 
    email: '', 
    password: '' 
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState(parseInt(localStorage.getItem('lockoutUntil')) || 0);
  
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();

  const isLockedOut = lockoutUntil > Date.now();

  useEffect(() => {
    let interval;
    if (isLockedOut) {
      const updateMessage = () => {
        const timeLeft = lockoutUntil - Date.now();
        if (timeLeft <= 0) {
          localStorage.removeItem('lockoutUntil');
          localStorage.removeItem('loginAttempts');
          setLockoutUntil(0);
          setError('');
          clearInterval(interval);
        } else {
          const minutesLeft = Math.ceil(timeLeft / 60000);
          setError(`Maximum retries exceeded. Please try again in ${minutesLeft} minute(s).`);
        }
      };
      
      updateMessage();
      interval = setInterval(updateMessage, 10000); // Update every 10 seconds
    } else if (lockoutUntil) {
      // Clear lockout if time has passed
      localStorage.removeItem('lockoutUntil');
      localStorage.removeItem('loginAttempts');
      setLockoutUntil(0);
      setError('');
    }
    return () => clearInterval(interval);
  }, [lockoutUntil, isLockedOut]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (!isLockedOut) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isLockedOut) {
      const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
      setError(`Maximum retries exceeded. Please try again in ${minutesLeft} minute(s).`);
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      if (tab === 0) {
        await authService.login(form.username, form.password);
        
        // On success, clear any failed attempts
        localStorage.removeItem('loginAttempts');
        localStorage.removeItem('lockoutUntil');

        // Handle Remember Me
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', form.username);
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberedUsername');
          localStorage.setItem('rememberMe', 'false');
        }

        navigate('/');
      } else {
        if (!form.email) { setError('Email is required'); setLoading(false); return; }
        // Official email validation
        if (!form.email.toLowerCase().endsWith('@acme.com')) {
          setError('You must use your official @acme.com email to register.');
          setLoading(false);
          return;
        }
        await authService.register(form.username, form.email, form.password);
        navigate('/?new=1');
      }
    } catch (err) {
      if (tab === 0) {
        const currentAttempts = parseInt(localStorage.getItem('loginAttempts')) || 0;
        const newAttempts = currentAttempts + 1;

        if (newAttempts >= MAX_RETRIES) {
          const lockoutTime = Date.now() + LOCKOUT_DURATION;
          localStorage.setItem('lockoutUntil', lockoutTime.toString());
          setLockoutUntil(lockoutTime);
          setError(`Maximum retries exceeded. Please try again in 5 minutes.`);
        } else {
          localStorage.setItem('loginAttempts', newAttempts.toString());
          const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Something went wrong';
          setError(`${msg} (Attempt ${newAttempts} of ${MAX_RETRIES})`);
        }
      } else {
        if (err.response?.data?.details) {
          setError(err.response.data.details.join(', '));
        } else {
          const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Something went wrong';
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: mode === 'light' 
        ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
        : 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
      p: 2,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Theme Toggle Button */}
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
          <IconButton onClick={toggleColorMode} sx={{ 
            bgcolor: mode === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: 'divider',
            color: 'text.primary',
            '&:hover': { 
              bgcolor: mode === 'light' ? '#fff' : 'rgba(51,65,85,0.9)',
              transform: 'translateY(-2px)',
            },
            transition: 'all 0.2s',
          }}>
            {mode === 'light' ? <DarkIcon /> : <LightIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', width: 500, height: 500,
          borderRadius: '50%', 
          background: mode === 'light' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(129, 140, 248, 0.1)',
          top: '-10%', right: '-5%', filter: 'blur(60px)',
        },
        '&::after': {
          content: '""', position: 'absolute', width: 400, height: 400,
          borderRadius: '50%', 
          background: mode === 'light' ? 'rgba(118, 75, 162, 0.1)' : 'rgba(167, 139, 250, 0.1)',
          bottom: '-10%', left: '-5%', filter: 'blur(60px)',
        },
      }} />

      <Card sx={{
        width: '100%', maxWidth: 420, borderRadius: 4, position: 'relative',
        bgcolor: mode === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(30,41,59,0.9)',
        backdropFilter: 'blur(20px)',
        boxShadow: mode === 'light' ? '0 25px 60px rgba(0,0,0,0.1)' : '0 25px 60px rgba(0,0,0,0.4)',
        border: '1px solid',
        borderColor: 'divider',
      }}>
        <Box sx={{
          p: 4, pb: 2, textAlign: 'center',
          background: mode === 'light' 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)',
          borderRadius: '16px 16px 0 0',
        }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: 3, mx: 'auto', mb: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
          }}>
            <Box
              component="img"
              src={logo}
              alt="ACME Logo"
              sx={{ width: 44, height: 44, borderRadius: 2, objectFit: 'contain' }}
            />
          </Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 0.5 }}>
            ACME TeamHub
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Team Management Platform
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); if (!isLockedOut) setError(''); }}
            variant="fullWidth" sx={{
              mb: 3, '& .MuiTab-root': { borderRadius: 2, fontWeight: 600, textTransform: 'none' },
              '& .Mui-selected': { color: 'primary.main' },
              '& .MuiTabs-indicator': { bgcolor: 'primary.main', borderRadius: 2 },
            }}
          >
            <Tab label="Sign In" />
            <Tab label="Register" />
          </Tabs>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth name="username" label="Username" value={form.username}
              onChange={handleChange} required margin="dense" size="medium"
              disabled={isLockedOut && tab === 0}
              InputProps={{
                startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: 'text.disabled' }} /></InputAdornment>,
              }}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            {tab === 1 && (
              <TextField
                fullWidth name="email" label="Email" type="email" value={form.email}
                onChange={handleChange} required margin="dense"
                InputProps={{
                  startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: 'text.disabled' }} /></InputAdornment>,
                }}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            )}

            <TextField
              fullWidth name="password" label="Password" value={form.password}
              onChange={handleChange} required margin="dense"
              disabled={isLockedOut && tab === 0}
              type={showPassword ? 'text' : 'password'}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'text.disabled' }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" disabled={isLockedOut && tab === 0}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: tab === 0 ? 1 : 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            {tab === 0 && (
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)} 
                    size="small"
                    disabled={isLockedOut}
                    sx={{
                      color: 'text.secondary',
                      '&.Mui-checked': { color: 'primary.main' }
                    }}
                  />
                }
                label={<Typography variant="body2" color="text.secondary">Remember me</Typography>}
                sx={{ mb: 2, display: 'flex', ml: 0.5 }}
              />
            )}

            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={loading || (isLockedOut && tab === 0)}
              sx={{
                py: 1.5, borderRadius: 2, fontWeight: 700, fontSize: '0.95rem',
                textTransform: 'none',
                background: mode === 'light'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)',
                boxShadow: mode === 'light' ? '0 4px 15px rgba(102, 126, 234, 0.4)' : '0 4px 15px rgba(0, 0, 0, 0.4)',
                '&:hover': {
                  background: mode === 'light'
                    ? 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)'
                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                },
                '&.Mui-disabled': {
                  background: 'action.disabledBackground',
                  boxShadow: 'none',
                }
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : (tab === 0 ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

        </CardContent>
      </Card>
    </Box>
  );
}
