import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip, InputAdornment,
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Search as SearchIcon, Groups as GroupsIcon,
} from '@mui/icons-material';
import teamsService from '../services/teamsService';
import individualsService from '../services/individualsService';
import authService from '../services/authService';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY_FORM = { name: '', description: '', location: '', leader_id: '', org_leader_id: '' };

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, ind] = await Promise.all([
        teamsService.getAll(),
        individualsService.getAll().catch(() => []),
      ]);
      setTeams(t);
      setIndividuals(ind);
    } catch {
      showSnack('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = teams.filter(t =>
    !search || `${t.name} ${t.description} ${t.location}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpen = (team = null) => {
    if (team) {
      setEditingId(team.id);
      setForm({
        name: team.name || '', description: team.description || '', location: team.location || '',
        leader_id: team.leader_id || '', org_leader_id: team.org_leader_id || '',
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
    if (!form.name.trim()) e.name = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        leader_id: form.leader_id || null,
        org_leader_id: form.org_leader_id || null,
      };
      if (editingId) {
        await teamsService.update(editingId, data);
        showSnack('Team updated successfully');
      } else {
        await teamsService.create(data);
        showSnack('Team created successfully');
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await teamsService.delete(deleteTarget);
      showSnack('Team deleted');
      setDeleteTarget(null);
      loadData();
    } catch {
      showSnack('Delete failed', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });
  const getPersonName = (id) => {
    const p = individuals.find(i => i.id === id);
    return p ? `${p.first_name} ${p.last_name}` : '—';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupsIcon sx={{ color: '#f5576c' }} /> Teams
          </Typography>
          <Typography variant="body2" color="text.secondary">Manage teams and their structure</Typography>
        </Box>
        {authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3,
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              boxShadow: '0 4px 14px rgba(245,87,108,0.4)',
            }}
          >
            Add Team
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search teams..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled' }} /></InputAdornment> }}
            sx={{ minWidth: 280, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc', color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                    <TableCell>Team Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Leader</TableCell>
                    <TableCell>Org Leader</TableCell>
                    <TableCell align="center">Members</TableCell>
                    {(authService.canUpdate() || authService.canDelete()) && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">No teams found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((team) => (
                      <TableRow key={team.id} hover sx={{ transition: 'background 0.2s' }}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>{team.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {team.description || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{team.location || '—'}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{getPersonName(team.leader_id)}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{getPersonName(team.org_leader_id)}</Typography></TableCell>
                        <TableCell align="center">
                          <Chip label={team.member_count || 0} size="small"
                            sx={{ fontWeight: 700, bgcolor: '#ede9fe', color: '#7c3aed', minWidth: 36 }} />
                        </TableCell>
                        {(authService.canUpdate() || authService.canDelete()) && (
                          <TableCell align="right">
                            {authService.canUpdate() && (
                              <Tooltip title="Edit"><IconButton size="small" onClick={() => handleOpen(team)} sx={{ color: '#667eea' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            )}
                            {authService.canDelete() && (
                              <Tooltip title="Delete"><IconButton size="small" onClick={() => setDeleteTarget(team.id)} sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingId ? 'Edit Team' : 'Add Team'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="Team Name" value={form.name} required
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={!!errors.name} helperText={errors.name}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField fullWidth label="Description" value={form.description} multiline rows={2}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField fullWidth label="Location" value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Team Leader</InputLabel>
              <Select value={form.leader_id} label="Team Leader"
                onChange={(e) => setForm({ ...form, leader_id: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {individuals.map(i => <MenuItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Org Leader</InputLabel>
              <Select value={form.org_leader_id} label="Org Leader"
                onChange={(e) => setForm({ ...form, org_leader_id: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {individuals.map(i => <MenuItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : (editingId ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Delete Team"
        message="Are you sure you want to delete this team? All member associations will be removed."
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
