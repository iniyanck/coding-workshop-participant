import { useState } from 'react';
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, Chip, CircularProgress,
  Tooltip, Divider, Checkbox, FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
  CloudSync as SyncIcon, CloudDone as CloudDoneIcon,
  Storage as StorageIcon, PlayArrow as PlayIcon,
} from '@mui/icons-material';
import axios from 'axios';

const INITIAL_HRIS_DATA = [
  { employee_id: 'EMP-001', email: 'admin@acme.com', first_name: 'Admin', last_name: 'User', is_direct_staff: true, designation: 'admin' },
  { employee_id: 'EMP-002', email: 'jdoe@acme.com', first_name: 'John', last_name: 'Doe', is_direct_staff: true, designation: 'manager' },
  { employee_id: 'EMP-003', email: 'jsmith@acme.com', first_name: 'Jane', last_name: 'Smith', is_direct_staff: true, designation: 'hr' },
  { employee_id: 'EMP-004', email: 'mbrown@acme.com', first_name: 'Michael', last_name: 'Brown', is_direct_staff: false, designation: 'employee' },
  { employee_id: 'EMP-005', email: 'swilson@acme.com', first_name: 'Sarah', last_name: 'Wilson', is_direct_staff: true, designation: 'employee' },
  { employee_id: 'EMP-006', email: 'dlee@acme.com', first_name: 'David', last_name: 'Lee', is_direct_staff: false, designation: 'employee' },
  { employee_id: 'EMP-007', email: 'egarcia@acme.com', first_name: 'Emily', last_name: 'Garcia', is_direct_staff: true, designation: 'employee' },
  { employee_id: 'EMP-008', email: 'rjohnson@acme.com', first_name: 'Robert', last_name: 'Johnson', is_direct_staff: true, designation: 'employee' },
];

const EMPTY_FORM = { employee_id: '', email: '', first_name: '', last_name: '', is_direct_staff: true, designation: 'employee' };

export default function HRISConsolePage() {
  const [hrisData, setHrisData] = useState(INITIAL_HRIS_DATA);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const handleOpen = (index = null) => {
    if (index !== null) {
      setEditingIndex(index);
      setForm({ ...hrisData[index] });
    } else {
      setEditingIndex(null);
      const nextId = `EMP-${String(hrisData.length + 1).padStart(3, '0')}`;
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
    // Check for duplicate employee_id
    const dupIndex = hrisData.findIndex(d => d.employee_id === form.employee_id);
    if (dupIndex !== -1 && dupIndex !== editingIndex) e.employee_id = 'Duplicate ID';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editingIndex !== null) {
      const updated = [...hrisData];
      updated[editingIndex] = { ...form };
      setHrisData(updated);
      showSnack('Record updated');
    } else {
      setHrisData([...hrisData, { ...form }]);
      showSnack('Record added');
    }
    setDialogOpen(false);
  };

  const handleDelete = (index) => {
    setHrisData(hrisData.filter((_, i) => i !== index));
    showSnack('Record removed');
  };

  const handleSync = async () => {
    if (hrisData.length === 0) {
      showSnack('No records to sync', 'warning');
      return;
    }

    setSyncing(true);
    setSyncResult(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.post(
        `${apiUrl}/api/individuals-service/import`,
        { individuals: hrisData },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setSyncResult({
        success: true,
        message: response.data.message || `Successfully synced ${hrisData.length} records`,
        timestamp: new Date().toLocaleTimeString(),
      });
      showSnack('Sync completed successfully!');
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Sync failed';
      setSyncResult({
        success: false,
        message: errorMsg,
        timestamp: new Date().toLocaleTimeString(),
      });
      showSnack(errorMsg, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon sx={{ color: '#10b981' }} /> HRIS Simulation Console
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Simulate the external HRIS database and test employee sync operations
          </Typography>
        </Box>
      </Box>

      {/* Control Panel */}
      <Paper sx={{
        borderRadius: 3, p: 3, mb: 3,
        background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(5,150,105,0.06) 100%)',
        border: '1px solid rgba(16,185,129,0.15)',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <SyncIcon sx={{ color: '#10b981' }} /> Sync Control
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Push {hrisData.length} records to the Individuals Service via <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: '0.8em' }}>/api/individuals-service/import</code>
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <PlayIcon />}
            onClick={handleSync}
            disabled={syncing}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 4, py: 1.2,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
              fontSize: '0.95rem',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                boxShadow: '0 6px 20px rgba(16,185,129,0.5)',
              },
            }}
          >
            {syncing ? 'Syncing...' : 'Trigger Sync'}
          </Button>
        </Box>

        {syncResult && (
          <Alert
            severity={syncResult.success ? 'success' : 'error'}
            icon={syncResult.success ? <CloudDoneIcon /> : undefined}
            sx={{ mt: 2, borderRadius: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {syncResult.message}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {syncResult.timestamp}
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* HRIS Data Table */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Simulated HRIS Records
            </Typography>
            <Chip label={hrisData.length} size="small"
              sx={{ fontWeight: 700, bgcolor: '#dcfce7', color: '#16a34a', minWidth: 28 }}
            />
          </Box>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpen()}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600,
              borderColor: '#10b981', color: '#10b981',
              '&:hover': { borderColor: '#059669', bgcolor: 'rgba(16,185,129,0.04)' },
            }}
          >
            Add Employee
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc', color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
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
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                    <Typography color="text.secondary">No HRIS records. Add some employees to test sync.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                hrisData.map((record, index) => (
                  <TableRow key={`${record.employee_id}-${index}`} hover sx={{ '&:hover': { bgcolor: '#f8fafc' }, transition: 'background 0.2s' }}>
                    <TableCell>
                      <Chip label={record.employee_id} size="small"
                        sx={{ borderRadius: 1.5, fontWeight: 600, fontFamily: 'monospace', bgcolor: '#dcfce7', color: '#16a34a' }}
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
                        {record.designation === 'hr' ? 'HR' : (record.designation || 'employee').charAt(0).toUpperCase() + (record.designation || 'employee').slice(1)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={record.is_direct_staff ? 'Direct' : 'Non-Direct'}
                        sx={{
                          borderRadius: 1.5, fontWeight: 500, fontSize: '0.7rem',
                          bgcolor: record.is_direct_staff ? '#dbeafe' : '#fef3c7',
                          color: record.is_direct_staff ? '#2563eb' : '#d97706',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpen(index)} sx={{ color: '#667eea', mr: 0.5 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton size="small" onClick={() => handleDelete(index)} sx={{ color: '#ef4444' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* How it works */}
      <Paper sx={{ borderRadius: 3, p: 3, mt: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          How This Works
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[
            { step: '1', text: 'Add, edit, or remove employee records in the simulated HRIS database above.' },
            { step: '2', text: 'Click "Trigger Sync" to push all records to the Individuals Service via the /import endpoint.' },
            { step: '3', text: 'The service performs an upsert — new records are created, existing ones (by employee_id) are updated.' },
            { step: '4', text: 'Navigate to the Individuals page to verify the synced data.' },
          ].map(item => (
            <Box key={item.step} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Chip label={item.step} size="small"
                sx={{ fontWeight: 700, minWidth: 28, bgcolor: '#10b981', color: '#fff', fontSize: '0.7rem' }}
              />
              <Typography variant="body2" color="text.secondary">{item.text}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingIndex !== null ? 'Edit HRIS Record' : 'Add HRIS Record'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="Employee ID" value={form.employee_id} required
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            error={!!errors.employee_id} helperText={errors.employee_id}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            placeholder="e.g. EMP-009"
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
            placeholder="e.g. name@acme.com"
          />
          <TextField fullWidth select label="Role / Designation" value={form.designation || 'employee'}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            SelectProps={{ native: true }}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="hr">HR</option>
            <option value="admin">System Administrator</option>
          </TextField>
          <FormControlLabel
            control={<Checkbox checked={!form.is_direct_staff} onChange={(e) => setForm({ ...form, is_direct_staff: !e.target.checked })} />}
            label="Indirect Staff"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}
            sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          >
            {editingIndex !== null ? 'Update' : 'Add'}
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
