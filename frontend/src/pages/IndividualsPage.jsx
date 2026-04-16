import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem,
  InputAdornment, TablePagination, Alert,
  TextField,
} from '@mui/material';
import {
  Search as SearchIcon, People as PeopleIcon,
  CloudSync as SyncIcon, Edit as EditIcon,
} from '@mui/icons-material';
import individualsService from '../services/individualsService';
import teamsService from '../services/teamsService';
import authService from '../services/authService';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button as MuiButton
} from '@mui/material';

export default function IndividualsPage() {
  const [individuals, setIndividuals] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [editOpen, setEditOpen] = useState(false);
  const [editInd, setEditInd] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const userRole = authService.getUser()?.role;

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
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = individuals.filter(i => {
    const matchesSearch = !search || 
      `${i.employee_id} ${i.first_name} ${i.last_name} ${i.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = !filterTeam || i.team_id === filterTeam;
    return matchesSearch && matchesTeam;
  });

  const handleSaveTeam = async () => {
    if (!editInd) return;
    setSaveLoading(true);
    try {
      await individualsService.update(editInd.id, editInd);
      await loadData();
      setEditOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon sx={{ color: '#667eea' }} /> Individuals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Employee records synced from the HRIS system
          </Typography>
        </Box>
      </Box>

      <Alert
        severity="info"
        icon={<SyncIcon />}
        sx={{
          mb: 3, borderRadius: 2,
          background: 'linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)',
          border: '1px solid rgba(102,126,234,0.2)',
          '& .MuiAlert-icon': { color: '#667eea' },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          This directory is managed by the HRIS system. Records are automatically synced from the external employee database.
          Use the <strong>HRIS Console</strong> (Admin) to simulate sync operations.
        </Typography>
      </Alert>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search by ID, name, email..." value={search}
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
                    <TableCell>Employee ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Staff Type</TableCell>
                    <TableCell>Status</TableCell>
                    {['admin', 'hr', 'manager'].includes(userRole) && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">No individuals found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((ind) => (
                      <TableRow key={ind.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' }, transition: 'background 0.2s' }}>
                        <TableCell>
                          <Chip label={ind.employee_id || '—'} size="small"
                            sx={{ borderRadius: 1.5, fontWeight: 600, fontFamily: 'monospace', bgcolor: '#ede9fe', color: '#7c3aed' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {ind.first_name} {ind.last_name}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{ind.email || '—'}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{ind.team_name || '—'}</Typography></TableCell>
                        <TableCell>
                          <Chip size="small" label={ind.is_direct_staff ? 'Direct' : 'Non-Direct'}
                            sx={{
                              borderRadius: 1.5, fontWeight: 500, fontSize: '0.7rem',
                              bgcolor: ind.is_direct_staff ? '#dcfce7' : '#fef3c7',
                              color: ind.is_direct_staff ? '#16a34a' : '#d97706',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip size="small"
                            label={ind.is_active !== false ? 'Active' : 'Inactive'}
                            sx={{
                              borderRadius: 1.5, fontWeight: 500, fontSize: '0.7rem',
                              bgcolor: ind.is_active !== false ? '#dbeafe' : '#fee2e2',
                              color: ind.is_active !== false ? '#2563eb' : '#dc2626',
                            }}
                          />
                        </TableCell>
                        {['admin', 'hr', 'manager'].includes(userRole) && (
                          <TableCell align="right">
                            <MuiButton size="small" variant="outlined" startIcon={<EditIcon />} 
                              onClick={() => { setEditInd({...ind}); setEditOpen(true); }}
                              sx={{ borderRadius: 2 }}
                            >
                              Team
                            </MuiButton>
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

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Assign Team</DialogTitle>
        <DialogContent dividers>
          {editInd && (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Team</InputLabel>
              <Select value={editInd.team_id || ''} label="Team"
                onChange={(e) => setEditInd({...editInd, team_id: e.target.value})}
              >
                <MenuItem value="">None</MenuItem>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <MuiButton onClick={() => setEditOpen(false)} disabled={saveLoading}>Cancel</MuiButton>
          <MuiButton onClick={handleSaveTeam} variant="contained" disabled={saveLoading} sx={{ borderRadius: 2 }}>
            {saveLoading ? <CircularProgress size={24} /> : 'Save'}
          </MuiButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
