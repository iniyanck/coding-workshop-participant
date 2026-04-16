import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Snackbar, Alert, Chip,
  CircularProgress, FormControl, Select, MenuItem, Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon, AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import authService from '../services/authService';
import ConfirmDialog from '../components/ConfirmDialog';

const roleColors = {
  admin: { bg: '#fef2f2', color: '#ef4444' },
  hr: { bg: '#eff6ff', color: '#3b82f6' },
  manager: { bg: '#fffbeb', color: '#f59e0b' },
  employee: { bg: '#f3f4f6', color: '#6b7280' },
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const currentUser = authService.getUser();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await authService.getUsers();
      setUsers(data);
    } catch {
      showSnack('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await authService.updateUserRole(userId, newRole);
      showSnack('Role updated');
      loadData();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to update role', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await authService.deleteUser(deleteTarget);
      showSnack('User deleted');
      setDeleteTarget(null);
      loadData();
    } catch {
      showSnack('Failed to delete user', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AdminIcon sx={{ color: '#ef4444' }} /> User Management
        </Typography>
        <Typography variant="body2" color="text.secondary">Manage user accounts and role designations</Typography>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc', color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                  <TableCell>Username</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Designation</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight={600}>{user.username}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{user.email}</Typography></TableCell>
                    <TableCell>
                      {user.designation ? (
                        <Chip label={user.designation} size="small"
                          sx={{
                            borderRadius: 1.5, fontWeight: 500,
                            bgcolor: user.color_hex ? `${user.color_hex}18` : '#f3f4f6',
                            color: user.color_hex || '#6b7280',
                            border: user.color_hex ? `1px solid ${user.color_hex}30` : 'none',
                          }}
                        />
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <Select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={user.id === currentUser?.id}
                          sx={{
                            borderRadius: 2, fontWeight: 600, fontSize: '0.8rem',
                            bgcolor: roleColors[user.role]?.bg,
                            color: roleColors[user.role]?.color,
                            '& .MuiSelect-icon': { color: roleColors[user.role]?.color },
                          }}
                        >
                          {['admin', 'hr', 'manager', 'employee'].map(r => (
                            <MenuItem key={r} value={r}>
                              {r === 'hr' ? 'HR' : r.charAt(0).toUpperCase() + r.slice(1)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{user.location || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {user.id !== currentUser?.id && (
                        <Tooltip title="Delete user">
                          <IconButton size="small" onClick={() => setDeleteTarget(user.id)} sx={{ color: '#ef4444' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <ConfirmDialog open={!!deleteTarget} title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
