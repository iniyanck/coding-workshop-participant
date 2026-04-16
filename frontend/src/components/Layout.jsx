import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
  Avatar, Menu, MenuItem, Divider, Chip, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, People as PeopleIcon,
  Groups as GroupsIcon, EmojiEvents as TrophyIcon, Logout as LogoutIcon,
  Person as PersonIcon, AdminPanelSettings as AdminIcon,
  CloudSync as SyncIcon,
} from '@mui/icons-material';
import authService from '../services/authService';

const DRAWER_WIDTH = 260;

const navItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Individuals', icon: <PeopleIcon />, path: '/individuals' },
  { text: 'Teams', icon: <GroupsIcon />, path: '/teams' },
  { text: 'Achievements', icon: <TrophyIcon />, path: '/achievements' },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const user = authService.getUser();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const roleColors = {
    admin: '#ef4444',
    hr: '#3b82f6',
    manager: '#f59e0b',
    employee: '#6b7280',
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{
        p: 3, display: 'flex', alignItems: 'center', gap: 1.5,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <GroupsIcon sx={{ color: '#fff', fontSize: 32 }} />
        <Box>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2, fontSize: '1rem' }}>
            ACME TeamHub
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
            Team Management
          </Typography>
        </Box>
      </Box>
      <List sx={{ flex: 1, px: 1.5, pt: 2 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
                sx={{
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  bgcolor: isActive ? 'rgba(102, 126, 234, 0.12)' : 'transparent',
                  color: isActive ? '#667eea' : 'text.secondary',
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(102, 126, 234, 0.18)' : 'action.hover',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
        {authService.isAdmin() && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate('/users'); if (isMobile) setMobileOpen(false); }}
                sx={{
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  bgcolor: location.pathname === '/users' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                  color: location.pathname === '/users' ? '#ef4444' : 'text.secondary',
                  '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)', transform: 'translateX(4px)' },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}><AdminIcon /></ListItemIcon>
                <ListItemText primary="User Management" primaryTypographyProps={{ fontWeight: location.pathname === '/users' ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate('/hris-console'); if (isMobile) setMobileOpen(false); }}
                sx={{
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  bgcolor: location.pathname === '/hris-console' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  color: location.pathname === '/hris-console' ? '#10b981' : 'text.secondary',
                  '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.08)', transform: 'translateX(4px)' },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}><SyncIcon /></ListItemIcon>
                <ListItemText primary="HRIS Console" primaryTypographyProps={{ fontWeight: location.pathname === '/hris-console' ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          </>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { md: 'none' }, color: 'text.primary' }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Chip
            label={user?.role?.toUpperCase()}
            size="small"
            sx={{
              mr: 2, fontWeight: 700, fontSize: '0.65rem', letterSpacing: 1,
              bgcolor: `${roleColors[user?.role] || '#6b7280'}18`,
              color: roleColors[user?.role] || '#6b7280',
              border: `1px solid ${roleColors[user?.role] || '#6b7280'}30`,
            }}
          />
          <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
            <Avatar sx={{
              width: 36, height: 36, fontSize: '0.875rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}>
              {user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{ sx: { mt: 1, borderRadius: 2, minWidth: 180 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>{user?.username}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main', mt: 0.5 }}>
              <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              Sign Out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, border: 'none' } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, border: 'none', boxShadow: '1px 0 0 0 rgba(0,0,0,0.05)' } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, mt: '64px' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
