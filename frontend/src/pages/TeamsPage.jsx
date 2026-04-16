import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip, InputAdornment,
  TablePagination, useTheme, Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Search as SearchIcon, Groups as GroupsIcon, WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import teamsService from '../services/teamsService';
import individualsService from '../services/individualsService';
import authService from '../services/authService';
import ConfirmDialog from '../components/ConfirmDialog';
import TeamMap from '../components/TeamMap';
import { geocodeLocation } from '../utils/geocode';
import MapIcon from '@mui/icons-material/Map';

const EMPTY_FORM = { name: '', unit_type: 'Team', description: '', location: '', leader_id: '', org_leader_id: '', parent_team_id: '', members: [] };

export default function TeamsPage() {
  const theme = useTheme();
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
  const [selectedTeam, setSelectedTeam] = useState(null);

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
      const currentMembers = individuals.filter(i => i.team_id === team.id).map(i => i.id);
      setEditingId(team.id);
      setForm({
        name: team.name || '', unit_type: team.unit_type || 'Team', description: team.description || '', location: team.location || '',
        leader_id: team.leader_id || '', org_leader_id: team.org_leader_id || '', parent_team_id: team.parent_team_id || '',
        members: currentMembers
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
      // Geocode the location if it provided and has changed/is new
      let lat = null;
      let lng = null;
      if (form.location.trim()) {
        const coords = await geocodeLocation(form.location);
        lat = coords.lat;
        lng = coords.lng;
      }

      const { members, ...teamData } = form;
      const data = {
        ...teamData,
        location_lat: lat,
        location_lng: lng,
        leader_id: teamData.leader_id || null,
        org_leader_id: teamData.org_leader_id || null,
        parent_team_id: teamData.parent_team_id || null,
      };

      let savedTeamId = editingId;
      if (editingId) {
        await teamsService.update(editingId, data);
      } else {
        const newTeam = await teamsService.create(data);
        savedTeamId = newTeam.id;
      }

      // Process Member Additions / Removals
      const oldMembers = editingId ? individuals.filter(i => i.team_id === savedTeamId).map(i => i.id) : [];
      const newMembers = form.members;
      
      const toAdd = newMembers.filter(id => !oldMembers.includes(id));
      const toRemove = oldMembers.filter(id => !newMembers.includes(id));

      await Promise.all([
        ...toAdd.map(id => {
          const person = individuals.find(i => i.id === id);
          return individualsService.update(id, { ...person, team_id: savedTeamId });
        }),
        ...toRemove.map(id => {
          const person = individuals.find(i => i.id === id);
          return individualsService.update(id, { ...person, team_id: null });
        })
      ]);

      showSnack(editingId ? 'Team updated successfully' : 'Team created successfully');
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
            <GroupsIcon sx={{ color: 'secondary.main' }} /> Teams
          </Typography>
          <Typography variant="body2" color="text.secondary">Manage teams and their structure</Typography>
        </Box>
        {authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3,
              background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                : 'linear-gradient(135deg, #4c0519 0%, #9f1239 100%)',
              boxShadow: theme.palette.mode === 'light' 
                ? '0 4px 14px rgba(245,87,108,0.4)'
                : '0 4px 14px rgba(0,0,0,0.4)',
            }}
          >
            Add Team
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden', width: '100%', overflowX: 'hidden' }}>
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
            <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                    <TableCell>Team Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Leader</TableCell>
                    <TableCell>Parent</TableCell>
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
                      <TableRow 
                        key={team.id} 
                        hover 
                        onClick={() => setSelectedTeam(team)}
                        selected={selectedTeam?.id === team.id}
                        sx={{ 
                          transition: 'background 0.2s', 
                          cursor: 'pointer',
                          '&.Mui-selected': { bgcolor: 'action.selected' },
                          '&.Mui-selected:hover': { bgcolor: 'action.focus' }
                        }}
                      >
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>{team.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={team.unit_type || 'Team'} size="small"
                            sx={{ borderRadius: 1.5, fontWeight: 500, fontSize: '0.7rem',
                              bgcolor: team.unit_type === 'Division' ? `${theme.palette.secondary.main}15` : team.unit_type === 'Department' ? `${theme.palette.primary.main}15` : `${theme.palette.success.main}15`,
                              color: team.unit_type === 'Division' ? 'secondary.main' : team.unit_type === 'Department' ? 'primary.main' : 'success.main',
                            }}
                          />
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{team.location || '—'}</Typography></TableCell>
                        <TableCell>
                          {team.leader_id ? (
                            <Typography variant="body2" color="text.secondary">{getPersonName(team.leader_id)}</Typography>
                          ) : (
                            <Chip 
                              icon={<WarningAmberIcon />} 
                              label="No Leader Assigned" 
                              color="warning" 
                              size="small" 
                              variant="outlined" 
                              sx={{ borderRadius: 1.5 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {team.parent_team_id ? (teams.find(t => t.id === team.parent_team_id)?.name || '—') : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={team.member_count || 0} size="small"
                            sx={{ fontWeight: 700, bgcolor: `${theme.palette.secondary.main}15`, color: 'secondary.main', minWidth: 36 }} />
                        </TableCell>
                        {(authService.canUpdate() || authService.canDelete()) && (
                          <TableCell align="right">
                            {authService.canUpdate() && (
                              <Tooltip title="Edit"><IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpen(team); }} sx={{ color: 'primary.main' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            )}
                            {authService.canDelete() && (
                              <Tooltip title="Delete"><IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteTarget(team.id); }} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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

      {/* Replace the Paper block starting with {selectedTeam && ( */}
      <Dialog 
        open={!!selectedTeam} 
        onClose={() => setSelectedTeam(null)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, height: '80vh' } }}
      >
        {selectedTeam && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MapIcon sx={{ color: 'primary.main' }} /> Team Distribution: {selectedTeam.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Visualizing {individuals.filter(i => i.team_id === selectedTeam.id).length} team members
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
              <TeamMap 
                individuals={individuals.filter(i => i.team_id === selectedTeam.id)} 
                teamInfo={selectedTeam} 
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setSelectedTeam(null)} variant="contained" sx={{ borderRadius: 2 }}>
                Close Map
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingId ? 'Edit Team' : 'Add Team'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2, mb: 2 }}>
            <TextField fullWidth label="Team Name" value={form.name} required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={!!errors.name} helperText={errors.name}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Unit Type</InputLabel>
              <Select value={form.unit_type} label="Unit Type"
                onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
              >
                <MenuItem value="Team">Team</MenuItem>
                <MenuItem value="Department">Department</MenuItem>
                <MenuItem value="Division">Division</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField fullWidth label="Description" value={form.description} multiline rows={2}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField fullWidth label="Location" value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <Autocomplete
              options={individuals}
              getOptionLabel={(option) => `${option.first_name} ${option.last_name} (${option.employee_id})`}
              value={individuals.find(i => i.id === form.leader_id) || null}
              onChange={(e, newValue) => setForm({ ...form, leader_id: newValue ? newValue.id : '' })}
              renderInput={(params) => <TextField {...params} label="Team Leader" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />}
            />
            <Autocomplete
              options={individuals}
              getOptionLabel={(option) => `${option.first_name} ${option.last_name} (${option.employee_id})`}
              value={individuals.find(i => i.id === form.org_leader_id) || null}
              onChange={(e, newValue) => setForm({ ...form, org_leader_id: newValue ? newValue.id : '' })}
              renderInput={(params) => <TextField {...params} label="Org Leader" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />}
            />
          </Box>
          <Autocomplete
            options={teams.filter(t => t.id !== editingId)}
            getOptionLabel={(option) => `${option.name} (${option.unit_type || 'Team'})`}
            value={teams.find(t => t.id === form.parent_team_id) || null}
            onChange={(e, newValue) => setForm({ ...form, parent_team_id: newValue ? newValue.id : '' })}
            renderInput={(params) => <TextField {...params} label="Parent Unit" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />}
            sx={{ mb: 2 }}
          />
          <Autocomplete
            multiple
            options={individuals}
            getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
            value={individuals.filter(i => form.members.includes(i.id))}
            onChange={(e, newValue) => {
              const newMembers = newValue.map(v => v.id);
              
              // Calculate majority location
              const locs = newValue.map(v => v.location).filter(Boolean);
              let majorityLoc = '';
              if (locs.length > 0) {
                const counts = locs.reduce((acc, loc) => { 
                  acc[loc] = (acc[loc] || 0) + 1; 
                  return acc; 
                }, {});
                majorityLoc = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
              }

              // Update form state: auto-fill location if it's currently empty
              setForm(prev => ({ 
                ...prev, 
                members: newMembers,
                location: prev.location.trim() === '' ? majorityLoc : prev.location
              }));
            }}
            renderInput={(params) => <TextField {...params} label="Team Members" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ borderRadius: 2, background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                : 'linear-gradient(135deg, #4c0519 0%, #9f1239 100%)'
            }}
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

