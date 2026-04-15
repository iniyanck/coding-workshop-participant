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
  Search as SearchIcon, EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import achievementsService from '../services/achievementsService';
import teamsService from '../services/teamsService';
import authService from '../services/authService';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY_FORM = { team_id: '', title: '', description: '', achievement_date: '' };

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState([]);
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
      const [a, t] = await Promise.all([
        achievementsService.getAll(),
        teamsService.getAll().catch(() => []),
      ]);
      setAchievements(a);
      setTeams(t);
    } catch {
      showSnack('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = achievements.filter(a => {
    const matchesSearch = !search || `${a.title} ${a.description} ${a.team_name}`.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = !filterTeam || a.team_id === filterTeam;
    return matchesSearch && matchesTeam;
  });

  const handleOpen = (ach = null) => {
    if (ach) {
      setEditingId(ach.id);
      setForm({
        team_id: ach.team_id || '', title: ach.title || '',
        description: ach.description || '', achievement_date: ach.achievement_date || '',
      });
    } else {
      setEditingId(null);
      setForm({ ...EMPTY_FORM, achievement_date: new Date().toISOString().split('T')[0] });
    }
    setErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Required';
    if (!form.achievement_date) e.achievement_date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = { ...form, team_id: form.team_id || null };
      if (editingId) {
        await achievementsService.update(editingId, data);
        showSnack('Achievement updated successfully');
      } else {
        await achievementsService.create(data);
        showSnack('Achievement created successfully');
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
      await achievementsService.delete(deleteTarget);
      showSnack('Achievement deleted');
      setDeleteTarget(null);
      loadData();
    } catch {
      showSnack('Delete failed', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrophyIcon sx={{ color: '#f59e0b' }} /> Achievements
          </Typography>
          <Typography variant="body2" color="text.secondary">Track team accomplishments and milestones</Typography>
        </Box>
        {authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3,
              background: 'linear-gradient(135deg, #f093fb 0%, #f59e0b 100%)',
              boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
            }}
          >
            Add Achievement
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search achievements..." value={search}
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
                    <TableCell>Title</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Date</TableCell>
                    {(authService.canUpdate() || authService.canDelete()) && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">No achievements found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((ach) => (
                      <TableRow key={ach.id} hover sx={{ transition: 'background 0.2s' }}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>{ach.title}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary"
                            sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {ach.description || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {ach.team_name ? (
                            <Chip label={ach.team_name} size="small" sx={{ borderRadius: 1.5, fontWeight: 500, bgcolor: '#fef3c7', color: '#92400e' }} />
                          ) : '—'}
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{ach.achievement_date}</Typography></TableCell>
                        {(authService.canUpdate() || authService.canDelete()) && (
                          <TableCell align="right">
                            {authService.canUpdate() && (
                              <Tooltip title="Edit"><IconButton size="small" onClick={() => handleOpen(ach)} sx={{ color: '#667eea' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            )}
                            {authService.canDelete() && (
                              <Tooltip title="Delete"><IconButton size="small" onClick={() => setDeleteTarget(ach.id)} sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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
        <DialogTitle sx={{ fontWeight: 700 }}>{editingId ? 'Edit Achievement' : 'Add Achievement'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="Title" value={form.title} required
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={!!errors.title} helperText={errors.title}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField fullWidth label="Description" value={form.description} multiline rows={3}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Team</InputLabel>
              <Select value={form.team_id} label="Team"
                onChange={(e) => setForm({ ...form, team_id: e.target.value })}
              >
                <MenuItem value="">No Team</MenuItem>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Date" type="date" value={form.achievement_date} required
              onChange={(e) => setForm({ ...form, achievement_date: e.target.value })}
              error={!!errors.achievement_date} helperText={errors.achievement_date}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #f093fb 0%, #f59e0b 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : (editingId ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Delete Achievement"
        message="Are you sure you want to delete this achievement?"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
