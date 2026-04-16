import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip, InputAdornment,
  TablePagination, Tabs, Tab,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon,
  Search as SearchIcon, EmojiEvents as TrophyIcon,
  MenuBook as CatalogIcon, MilitaryTech as AwardIcon,
} from '@mui/icons-material';
import achievementsService from '../services/achievementsService';
import teamsService from '../services/teamsService';
import individualsService from '../services/individualsService';
import authService from '../services/authService';
import ConfirmDialog from '../components/ConfirmDialog';

// --- Catalog Tab ---

function CatalogTab() {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', recurrence: '', scope: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { loadCatalog(); }, []);

  const loadCatalog = async () => {
    try {
      const data = await achievementsService.getCatalog();
      setCatalog(data);
    } catch {
      showSnack('Failed to load catalog', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = catalog.filter(c =>
    !search || `${c.title} ${c.description} ${c.recurrence} ${c.scope}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.title.trim()) { setErrors({ title: 'Required' }); return; }
    setSaving(true);
    try {
      await achievementsService.createCatalogItem(form);
      showSnack('Catalog item created');
      setDialogOpen(false);
      setForm({ title: '', description: '', recurrence: '', scope: '' });
      loadCatalog();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to create', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await achievementsService.deleteCatalogItem(deleteTarget);
      showSnack('Catalog item deleted');
      setDeleteTarget(null);
      loadCatalog();
    } catch {
      showSnack('Delete failed', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const scopeColors = {
    'team': { bg: '#dbeafe', color: '#2563eb' },
    'individual': { bg: '#fce7f3', color: '#db2777' },
    'company': { bg: '#dcfce7', color: '#16a34a' },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Define achievement templates that can be awarded to teams or individuals
        </Typography>
        {authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setErrors({}); }}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3,
              background: 'linear-gradient(135deg, #f093fb 0%, #f59e0b 100%)',
              boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
            }}
          >
            New Definition
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search catalog..." value={search}
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
                    <TableCell>Title</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Recurrence</TableCell>
                    <TableCell>Scope</TableCell>
                    {authService.canDelete() && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">No catalog items. Create your first achievement definition!</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => (
                      <TableRow key={item.id} hover sx={{ transition: 'background 0.2s' }}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>{item.title}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary"
                            sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {item.description || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {item.recurrence ? (
                            <Chip label={item.recurrence} size="small" sx={{ borderRadius: 1.5, fontWeight: 500, bgcolor: '#fef3c7', color: '#92400e' }} />
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {item.scope ? (
                            <Chip label={item.scope} size="small"
                              sx={{
                                borderRadius: 1.5, fontWeight: 500,
                                bgcolor: scopeColors[item.scope]?.bg || '#f3f4f6',
                                color: scopeColors[item.scope]?.color || '#6b7280',
                              }}
                            />
                          ) : '—'}
                        </TableCell>
                        {authService.canDelete() && (
                          <TableCell align="right">
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => setDeleteTarget(item.id)} sx={{ color: '#ef4444' }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
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

      {/* Create Catalog Item Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>New Achievement Definition</DialogTitle>
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
              <InputLabel>Recurrence</InputLabel>
              <Select value={form.recurrence} label="Recurrence"
                onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="one-time">One-Time</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Scope</InputLabel>
              <Select value={form.scope} label="Scope"
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="individual">Individual</MenuItem>
                <MenuItem value="team">Team</MenuItem>
                <MenuItem value="company">Company</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #f093fb 0%, #f59e0b 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Delete Catalog Item"
        message="Deleting this definition will also remove all awards linked to it. Continue?"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

// --- Awards Tab ---

function AwardsTab() {
  const [awards, setAwards] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [teams, setTeams] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ catalog_id: '', team_id: '', individual_id: '', awarded_date: '', location: '' });
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
      const [a, c, t, ind] = await Promise.all([
        achievementsService.getAwards(),
        achievementsService.getCatalog().catch(() => []),
        teamsService.getAll().catch(() => []),
        individualsService.getAll().catch(() => []),
      ]);
      setAwards(a);
      setCatalog(c);
      setTeams(t);
      setIndividuals(ind);
    } catch {
      showSnack('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = awards.filter(a => {
    const matchesSearch = !search || `${a.title} ${a.description}`.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = !filterTeam || a.team_id === filterTeam;
    return matchesSearch && matchesTeam;
  });

  const handleOpen = () => {
    setForm({ catalog_id: '', team_id: '', individual_id: '', awarded_date: new Date().toISOString().split('T')[0], location: '' });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const e = {};
    if (!form.catalog_id) e.catalog_id = 'Required';
    if (!form.awarded_date) e.awarded_date = 'Required';
    if (!form.team_id && !form.individual_id) e.team_id = 'Select a team or individual';
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    try {
      const data = {
        ...form,
        team_id: form.team_id || null,
        individual_id: form.individual_id || null,
      };
      await achievementsService.createAward(data);
      showSnack('Award granted!');
      setDialogOpen(false);
      loadData();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to create award', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await achievementsService.deleteAward(deleteTarget);
      showSnack('Award revoked');
      setDeleteTarget(null);
      loadData();
    } catch {
      showSnack('Delete failed', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const getTeamName = (id) => teams.find(t => t.id === id)?.name || '—';
  const getIndividualName = (id) => {
    const ind = individuals.find(i => i.id === id);
    return ind ? `${ind.first_name} ${ind.last_name}` : '—';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          View and grant awards from the achievement catalog
        </Typography>
        {authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 4px 14px rgba(102,126,234,0.4)',
            }}
          >
            Grant Award
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search awards..." value={search}
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
                    <TableCell>Achievement</TableCell>
                    <TableCell>Recurrence</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Individual</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Location</TableCell>
                    {authService.canDelete() && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">No awards granted yet</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((award) => (
                      <TableRow key={award.id} hover sx={{ transition: 'background 0.2s' }}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>{award.title}</Typography>
                          {award.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {award.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {award.recurrence ? (
                            <Chip label={award.recurrence} size="small" sx={{ borderRadius: 1.5, fontWeight: 500, bgcolor: '#fef3c7', color: '#92400e' }} />
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {award.team_id ? (
                            <Chip label={getTeamName(award.team_id)} size="small" sx={{ borderRadius: 1.5, fontWeight: 500, bgcolor: '#dbeafe', color: '#2563eb' }} />
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {award.individual_id ? (
                            <Chip label={getIndividualName(award.individual_id)} size="small" sx={{ borderRadius: 1.5, fontWeight: 500, bgcolor: '#fce7f3', color: '#db2777' }} />
                          ) : '—'}
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{award.awarded_date}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{award.location || '—'}</Typography></TableCell>
                        {authService.canDelete() && (
                          <TableCell align="right">
                            <Tooltip title="Revoke">
                              <IconButton size="small" onClick={() => setDeleteTarget(award.id)} sx={{ color: '#ef4444' }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
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

      {/* Grant Award Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Grant Achievement Award</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <FormControl fullWidth sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Achievement *</InputLabel>
            <Select value={form.catalog_id} label="Achievement *"
              onChange={(e) => setForm({ ...form, catalog_id: e.target.value })}
              error={!!errors.catalog_id}
            >
              {catalog.map(c => <MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>)}
            </Select>
            {errors.catalog_id && <Typography variant="caption" color="error" sx={{ ml: 1.5, mt: 0.5 }}>{errors.catalog_id}</Typography>}
          </FormControl>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Team</InputLabel>
              <Select value={form.team_id} label="Team"
                onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                error={!!errors.team_id}
              >
                <MenuItem value="">None</MenuItem>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Individual</InputLabel>
              <Select value={form.individual_id} label="Individual"
                onChange={(e) => setForm({ ...form, individual_id: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {individuals.map(i => <MenuItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          {errors.team_id && <Typography variant="caption" color="error" sx={{ ml: 1.5, mt: -1, mb: 1, display: 'block' }}>{errors.team_id}</Typography>}

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Date" type="date" value={form.awarded_date} required
              onChange={(e) => setForm({ ...form, awarded_date: e.target.value })}
              error={!!errors.awarded_date} helperText={errors.awarded_date}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField label="Location" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Grant'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Revoke Award"
        message="Are you sure you want to revoke this award?"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

// --- Main Page ---

export default function AchievementsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrophyIcon sx={{ color: '#f59e0b' }} /> Achievements
          </Typography>
          <Typography variant="body2" color="text.secondary">Manage the achievement catalog and grant awards</Typography>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': { borderRadius: 2, fontWeight: 600, textTransform: 'none', minHeight: 48, gap: 1 },
            '& .Mui-selected': { color: '#f59e0b' },
            '& .MuiTabs-indicator': { bgcolor: '#f59e0b', borderRadius: 2 },
          }}
        >
          <Tab icon={<CatalogIcon />} iconPosition="start" label="Catalog" />
          <Tab icon={<AwardIcon />} iconPosition="start" label="Awards" />
        </Tabs>
      </Paper>

      {tab === 0 ? <CatalogTab /> : <AwardsTab />}
    </Box>
  );
}
