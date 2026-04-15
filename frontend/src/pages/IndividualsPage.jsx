import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Tooltip, InputAdornment, TablePagination,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Search as SearchIcon, People as PeopleIcon, FilterList as FilterIcon,
} from '@mui/icons-material';
import individualsService from '../services/individualsService';
import teamsService from '../services/teamsService';
import authService from '../services/authService';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', role: '', location: '', team_id: '', is_direct_staff: true,
};

export default function IndividualsPage() {
  const [individuals, setIndividuals] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ind, t] = await Promise.all([
        individualsService.getAll(),
        teamsService.getAll().catch(() => []),
      ]);
      setIndividuals(ind);
      setTeams(t);
    } catch (err) {
      showSnack('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = individuals.filter(i => {
    const matchesSearch = !search || 
      `${i.first_name} ${i.last_name} ${i.email} ${i.role}`.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = !filterTeam || i.team_id === filterTeam;
    return matchesSearch && matchesTeam;
  });

  const handleOpen = (individual = null) => {
    if (individual) {
      setEditingId(individual.id);
      setForm({
        first_name: individual.first_name || '',
        last_name: individual.last_name || '',
        email: individual.email || '',
        role: individual.role || '',
        location: individual.location || '',
        team_id: individual.team_id || '',
        is_direct_staff: individual.is_direct_staff !== false,
      });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = 'Required';
    if (!form.last_name.trim()) e.last_name = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!form.email.includes('@')) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = { ...form, team_id: form.team_id || null };
      if (editingId) {
        await individualsService.update(editingId, data);
        showSnack('Individual updated successfully');
      } else {
        await individualsService.create(data);
        showSnack('Individual created successfully');
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Operation failed';
      showSnack(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await individualsService.delete(deleteTarget);
      showSnack('Individual deleted');
      setDeleteTarget(null);
      loadData();
    } catch {
      showSnack('Delete failed', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });
  const getTeamName = (teamId) => teams.find(t => t.id === teamId)?.name || '—';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon sx={{ color: '#667eea' }} /> Individuals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage team members and their details
          </Typography>
        </Box>
        {authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 4px 14px rgba(102,126,234,0.4)',
            }}
          >
            Add Individual
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search by name, email, role..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled' }} /></InputAdornment> }}
            sx={{ minWidth: 280, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Filter by Team</InputLabel>
            <Select value={filterTeam} label="Filter by Team" onChange={(e) => { setFilterTeam(e.target.value); setPage(0); }}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">All Teams</MenuItem>
              {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc', color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Staff Type</TableCell>
                    {(authService.canUpdate() || authService.canDelete()) && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">No individuals found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((ind) => (
                      <TableRow key={ind.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' }, transition: 'background 0.2s' }}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {ind.first_name} {ind.last_name}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{ind.email}</Typography></TableCell>
                        <TableCell>{ind.role && <Chip label={ind.role} size="small" sx={{ borderRadius: 1.5, fontWeight: 500 }} />}</TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{ind.location || '—'}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{getTeamName(ind.team_id)}</Typography></TableCell>
                        <TableCell>
                          <Chip size="small" label={ind.is_direct_staff ? 'Direct' : 'Non-Direct'}
                            sx={{
                              borderRadius: 1.5, fontWeight: 500, fontSize: '0.7rem',
                              bgcolor: ind.is_direct_staff ? '#dcfce7' : '#fef3c7',
                              color: ind.is_direct_staff ? '#16a34a' : '#d97706',
                            }}
                          />
                        </TableCell>
                        {(authService.canUpdate() || authService.canDelete()) && (
                          <TableCell align="right">
                            {authService.canUpdate() && (
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => handleOpen(ind)} sx={{ color: '#667eea' }}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {authService.canDelete() && (
                              <Tooltip title="Delete">
                                <IconButton size="small" onClick={() => setDeleteTarget(ind.id)} sx={{ color: '#ef4444' }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={filtered.length} page={page} rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[5, 10, 25]} />
          </>
        )}
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{editingId ? 'Edit Individual' : 'Add Individual'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
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
          <TextField fullWidth label="Email" value={form.email} required sx={{ mt: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={!!errors.email} helperText={errors.email}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
            <TextField label="Role" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField label="Location" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
          <FormControl fullWidth sx={{ mt: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Team</InputLabel>
            <Select value={form.team_id} label="Team"
              onChange={(e) => setForm({ ...form, team_id: e.target.value })}
            >
              <MenuItem value="">No Team</MenuItem>
              {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel sx={{ mt: 1 }}
            control={<Switch checked={form.is_direct_staff} onChange={(e) => setForm({ ...form, is_direct_staff: e.target.checked })} />}
            label="Direct Staff"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : (editingId ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Delete Individual"
        message="Are you sure you want to delete this individual? This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
