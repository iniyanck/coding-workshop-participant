import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, Tabs, Tab, CircularProgress,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Groups as GroupsIcon,
  Email as EmailIcon, Person as PersonIcon, Lock as LockIcon,
} from '@mui/icons-material';
import authService from '../services/authService';

export default function LoginPage() {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 0) {
        await authService.login(form.username, form.password);
      } else {
        if (!form.email) { setError('Email is required'); setLoading(false); return; }
        await authService.register(form.username, form.email, form.password);
      }
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      p: 2,
    }}>
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', width: 500, height: 500,
          borderRadius: '50%', background: 'rgba(102, 126, 234, 0.15)',
          top: '-10%', right: '-5%', filter: 'blur(60px)',
        },
        '&::after': {
          content: '""', position: 'absolute', width: 400, height: 400,
          borderRadius: '50%', background: 'rgba(118, 75, 162, 0.15)',
          bottom: '-10%', left: '-5%', filter: 'blur(60px)',
        },
      }} />

      <Card sx={{
        width: '100%', maxWidth: 420, borderRadius: 4, position: 'relative',
        bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
      }}>
        <Box sx={{
          p: 4, pb: 2, textAlign: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px 16px 0 0',
        }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: 3, mx: 'auto', mb: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
          }}>
            <GroupsIcon sx={{ fontSize: 36, color: '#fff' }} />
          </Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 0.5 }}>
            ACME TeamHub
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Team Management Platform
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(''); }}
            variant="fullWidth" sx={{
              mb: 3, '& .MuiTab-root': { borderRadius: 2, fontWeight: 600, textTransform: 'none' },
              '& .Mui-selected': { color: '#667eea' },
              '& .MuiTabs-indicator': { bgcolor: '#667eea', borderRadius: 2 },
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
              type={showPassword ? 'text' : 'password'}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'text.disabled' }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={loading}
              sx={{
                py: 1.5, borderRadius: 2, fontWeight: 700, fontSize: '0.95rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : (tab === 0 ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          {tab === 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                Demo Credentials
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ fontFamily: 'monospace' }}>
                Username: admin &nbsp;|&nbsp; Password: admin123
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
