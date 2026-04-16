import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, Chip, CircularProgress,
  Tooltip, Checkbox, FormControlLabel, useTheme, TablePagination,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import api from '../services/api';
import individualsService from '../services/individualsService';
import { geocodeLocation } from '../utils/geocode';

const EMPTY_FORM = { employee_id: '', email: '', first_name: '', last_name: '', is_direct_staff: true, designation: '', location: '' };

export default function HRISConsolePage() {
  const theme = useTheme();
  const [hrisData, setHrisData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 1. Fetch real data on load for total congruence
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await individualsService.getAll();
      // Ensure we always set an array to prevent .slice() crashes
      setHrisData(Array.isArray(data) ? data : []);
    } catch (err) {
      showSnack('Failed to load HRIS data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (index = null) => {
    if (index !== null) {
      setEditingIndex(index);
      setForm({ ...hrisData[index] });
    } else {
      setEditingIndex(null);
      // Generate a random ID for new hires to avoid collisions
      const nextId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      setForm({ ...EMPTY_FORM, employee_id: nextId });
    }
    setErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.employee_id.trim()) e.employee_id = 'Required';
    if (!form.first_name.trim()) e.first_name = 'Required';
    if (!form.last_name.trim()) e.last_name = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!form.email.includes('@')) e.email = 'Invalid email';
    const dupIndex = hrisData.findIndex(d => d.employee_id === form.employee_id);
    if (dupIndex !== -1 && dupIndex !== editingIndex) e.employee_id = 'Duplicate ID';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // 2. Fire webhook on Save
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    
    try {
      let lat = form.location_lat || null;
      let lng = form.location_lng || null;
      
      // Geocode locally if location string changed
      if (form.location && form.location !== hrisData[editingIndex]?.location) {
        const coords = await geocodeLocation(form.location);
        lat = coords.lat; lng = coords.lng;
      }
      
      const payload = { ...form, location_lat: lat, location_lng: lng };
      
      await api.post('/api/individuals-service/webhook', { action: 'upsert', data: payload });

      showSnack('Record saved and synced to application');
      setDialogOpen(false);
      loadData(); // Refresh to ensure pure congruence
    } catch (error) {
      showSnack(error.response?.data?.error || 'Webhook sync failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 3. Fire webhook on Delete
  const handleDelete = async (index) => {
    try {
      const empId = hrisData[index].employee_id;
      await api.post('/api/individuals-service/webhook', { action: 'delete', employee_id: empId });
      showSnack('Record terminated in application');
      loadData(); // Refresh to clear from active list
    } catch (error) {
      showSnack('Failed to sync deletion', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon sx={{ color: 'success.main' }} /> HRIS Console
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live integration portal. Source of truth for active employee records.
          </Typography>
        </Box>
      </Box>

      {/* HRIS Data Table */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', width: '100%', overflowX: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Live Employee Records
            </Typography>
            <Chip label={hrisData.length} size="small"
              sx={{ fontWeight: 700, bgcolor: `${theme.palette.success.main}20`, color: 'success.main', minWidth: 28 }}
            />
          </Box>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpen()}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600,
              borderColor: 'success.main', color: 'success.main',
              '&:hover': { borderColor: 'success.dark', bgcolor: `${theme.palette.success.main}08` },
            }}
          >
            Add Employee
          </Button>
        </Box>

        <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                <TableCell>Employee ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Staff Type</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hrisData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                    <Typography color="text.secondary">No HRIS records found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                hrisData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((record, index) => {
                  if (!record) return null; // Safe guard against null records
                  const actualIndex = page * rowsPerPage + index; // Use true index
                  
                  return (
                    <TableRow key={`${record.employee_id}-${actualIndex}`} hover sx={{ transition: 'background 0.2s' }}>
                      <TableCell>
                        <Chip label={record.employee_id} size="small"
                          sx={{ borderRadius: 1.5, fontWeight: 600, fontFamily: 'monospace', bgcolor: `${theme.palette.success.main}20`, color: 'success.main' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {record.first_name} {record.last_name}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{record.email}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {record.designation || 'Pending'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={record.is_direct_staff ? 'Direct' : 'Non-Direct'}
                          sx={{
                            borderRadius: 1.5, fontWeight: 500, fontSize: '0.7rem',
                            bgcolor: record.is_direct_staff ? `${theme.palette.primary.main}15` : `${theme.palette.warning.main}15`,
                            color: record.is_direct_staff ? 'primary.main' : 'warning.main',
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpen(actualIndex)} sx={{ color: 'primary.main', mr: 0.5 }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Record">
                          <IconButton size="small" onClick={() => handleDelete(actualIndex)} sx={{ color: 'error.main' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={hrisData.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingIndex !== null ? 'Edit HRIS Record' : 'Add HRIS Record'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="Employee ID" value={form.employee_id} required disabled={editingIndex !== null}
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            error={!!errors.employee_id} helperText={errors.employee_id}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <TextField label="First Name" value={form.first_name} required
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              error={!!errors.first_name} helperText={errors.first_name}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField label="Last Name" value={form.last_name} required
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              error={!!errors.last_name} helperText={errors.last_name}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
          <TextField fullWidth label="Email" value={form.email} required
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={!!errors.email} helperText={errors.email}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField fullWidth label="Designation / Job Title" value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField fullWidth label="Location (City, Country)" value={form.location || ''}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <FormControlLabel
            control={<Checkbox checked={!form.is_direct_staff} onChange={(e) => setForm({ ...form, is_direct_staff: !e.target.checked })} />}
            label="Indirect Staff"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ borderRadius: 2, background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : (editingIndex !== null ? 'Update' : 'Add')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
