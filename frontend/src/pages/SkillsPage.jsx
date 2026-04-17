import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip, InputAdornment,
  TablePagination, Tabs, Tab, Rating, LinearProgress, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon,
  Search as SearchIcon, Psychology as SkillsIcon,
  Category as CategoryIcon, Assessment as GapIcon,
} from '@mui/icons-material';
import skillsService from '../services/skillsService';
import teamsService from '../services/teamsService';
import authService from '../services/authService';
import individualsService from '../services/individualsService';
import ConfirmDialog from '../components/ConfirmDialog';

const SKILL_CATEGORIES = ['Technical', 'Leadership', 'Communication', 'Management', 'Creative', 'Analytical', 'General'];

// --- Catalog Tab ---
function CatalogTab() {
  const theme = useTheme();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'General', description: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedSkill, setSelectedSkill] = useState(null);

  useEffect(() => { loadCatalog(); }, []);

  const loadCatalog = async () => {
    try {
      const data = await skillsService.getCatalog();
      setCatalog(data);
    } catch {
      showSnack('Failed to load skills catalog', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = catalog.filter(c =>
    !search || `${c.name} ${c.category} ${c.description}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.name.trim()) { setErrors({ name: 'Required' }); return; }
    setSaving(true);
    try {
      await skillsService.createCatalogItem(form);
      showSnack('Skill created');
      setDialogOpen(false);
      setForm({ name: '', category: 'General', description: '' });
      loadCatalog();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to create', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await skillsService.deleteCatalogItem(deleteTarget);
      showSnack('Skill deleted');
      setDeleteTarget(null);
      loadCatalog();
    } catch {
      showSnack('Delete failed', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Define organizational competencies and skills that can be assessed
        </Typography>
        {authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setErrors({}); }}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3,
              background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)',
              boxShadow: theme.palette.mode === 'light' 
                ? '0 4px 14px rgba(102,126,234,0.4)'
                : '0 4px 14px rgba(0,0,0,0.4)',
            }}
          >
            Add Skill
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden', width: '100%', overflowX: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search skills..." value={search}
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
                    <TableCell>Skill Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Description</TableCell>
                    {authService.canDelete() && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">No skills defined yet. Add your first skill!</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => (
                      <TableRow 
                        key={item.id} 
                        hover 
                        onClick={() => setSelectedSkill(item)}
                        sx={{ transition: 'background 0.2s', cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>{item.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={item.category} size="small"
                            sx={{
                              borderRadius: 1.5, fontWeight: 500,
                              bgcolor: item.category === 'Technical' ? `${theme.palette.primary.main}15` : 
                                       item.category === 'Leadership' ? `${theme.palette.warning.main}15` : 
                                       item.category === 'Communication' ? `${theme.palette.success.main}15` : 
                                       item.category === 'Management' ? `${theme.palette.secondary.main}15` : 
                                       item.category === 'Creative' ? `${theme.palette.info.main}15` : 
                                       item.category === 'Analytical' ? `${theme.palette.info.main}15` : 
                                       'action.hover',
                              color: item.category === 'Technical' ? 'primary.main' : 
                                     item.category === 'Leadership' ? 'warning.main' : 
                                     item.category === 'Communication' ? 'success.main' : 
                                     item.category === 'Management' ? 'secondary.main' : 
                                     item.category === 'Creative' ? 'info.main' : 
                                     item.category === 'Analytical' ? 'info.main' : 
                                     'text.secondary',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary"
                            sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {item.description || '—'}
                          </Typography>
                        </TableCell>
                        {authService.canDelete() && (
                          <TableCell align="right">
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteTarget(item.id); }} sx={{ color: 'error.main' }}>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Skill to Catalog</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="Skill Name" value={form.name} required
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={!!errors.name} helperText={errors.name}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <FormControl fullWidth sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Category</InputLabel>
            <Select value={form.category} label="Category"
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {SKILL_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Description" value={form.description} multiline rows={2}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ borderRadius: 2, background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Skill Detail Popup */}
      <Dialog open={!!selectedSkill} onClose={() => setSelectedSkill(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selectedSkill && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Skill Details</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Skill Name</Typography>
                  <Typography variant="body1" fontWeight={600}>{selectedSkill.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Category</Typography>
                  <Typography variant="body2">{selectedSkill.category}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Description</Typography>
                  <Typography variant="body2">{selectedSkill.description || 'No description provided.'}</Typography>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setSelectedSkill(null)} variant="contained" sx={{ borderRadius: 2 }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Delete Skill"
        message="Deleting this skill will remove all team requirements and personal assessments linked to it. Continue?"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

// --- My Skills Tab ---
function MySkillsTab() {
  const [mySkills, setMySkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = authService.getUser();

  useEffect(() => {
    const fetchMySkills = async () => {
      try {
        // Fetch the individual record mapped to this user
        const individuals = await individualsService.getAll();
        const me = individuals.find(i => i.user_id === user?.id);
        if (me) {
          const skills = await skillsService.getIndividualSkills(me.id);
          setMySkills(skills);
        }
      } catch (err) {
        console.error("Failed to load personal skills", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMySkills();
  }, [user?.id]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;

  return (
    <Paper sx={{ borderRadius: 3, p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>My Assessed Skills</Typography>
      {mySkills.length === 0 ? (
        <Typography color="text.secondary">You have no assessed skills yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mySkills.map(skill => (
            <Box key={skill.id} sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Box>
                <Typography fontWeight={600}>{skill.skill_name}</Typography>
                <Typography variant="caption" color="text.secondary">{skill.category}</Typography>
              </Box>
              <Rating value={skill.proficiency} readOnly />
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

// --- Team Skills & Gap Analysis Tab ---
function TeamSkillsTab() {
  const theme = useTheme();
  const [teams, setTeams] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamSkills, setTeamSkills] = useState([]);
  const [gapAnalysis, setGapAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ skill_id: '', required_proficiency: 3 });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { if (selectedTeam) loadTeamData(); }, [selectedTeam]);

  const loadInitial = async () => {
    try {
      const [t, c] = await Promise.all([
        teamsService.getAll(),
        skillsService.getCatalog(),
      ]);
      setTeams(t);
      setCatalog(c);
      
      // Auto-select team for regular employees
      if (t.length === 1) {
        setSelectedTeam(t[0].id);
      }
    } catch {
      showSnack('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamData = async () => {
    try {
      const [ts, gap] = await Promise.all([
        skillsService.getTeamSkills(selectedTeam),
        skillsService.getGapAnalysis(selectedTeam),
      ]);
      setTeamSkills(ts);
      setGapAnalysis(gap);
    } catch {
      showSnack('Failed to load team skills', 'error');
    }
  };

  const handleSave = async () => {
    if (!form.skill_id) return;
    setSaving(true);
    try {
      await skillsService.setTeamSkill({ team_id: selectedTeam, ...form });
      showSnack('Skill requirement set');
      setDialogOpen(false);
      loadTeamData();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await skillsService.deleteTeamSkill(deleteTarget);
      showSnack('Skill requirement removed');
      setDeleteTarget(null);
      loadTeamData();
    } catch {
      showSnack('Delete failed', 'error');
    }
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });
  const proficiencyLabels = ['', 'Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 280, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
          <InputLabel>Select Team</InputLabel>
          <Select value={selectedTeam} label="Select Team"
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name} ({t.unit_type})</MenuItem>)}
          </Select>
        </FormControl>
        {selectedTeam && authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setForm({ skill_id: '', required_proficiency: 3 }); }}
            sx={{
              borderRadius: 2, fontWeight: 600, px: 3,
              background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)',
            }}
          >
            Add Required Skill
          </Button>
        )}
      </Box>

      {!selectedTeam ? (
        <Paper sx={{ borderRadius: 3, p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Select a team to view and manage its required skills</Typography>
        </Paper>
      ) : (
        <>
          {/* Required Skills List */}
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 3, width: '100%', overflowX: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>Required Project Skills</Typography>
            </Box>
            <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                    <TableCell>Skill</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Required Level</TableCell>
                    {authService.canDelete() && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teamSkills.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">No skills required for this team yet</Typography>
                      </TableCell>
                    </TableRow>
                  ) : teamSkills.map(ts => (
                    <TableRow key={ts.id} hover>
                      <TableCell><Typography variant="subtitle2" fontWeight={600}>{ts.skill_name}</Typography></TableCell>
                      <TableCell><Chip label={ts.category} size="small" sx={{ borderRadius: 1.5 }} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Rating value={ts.required_proficiency} readOnly size="small" />
                          <Typography variant="caption" color="text.secondary">{proficiencyLabels[ts.required_proficiency]}</Typography>
                        </Box>
                      </TableCell>
                      {authService.canDelete() && (
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => setDeleteTarget(ts.id)} sx={{ color: 'error.main' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Gap Analysis */}
          {gapAnalysis.length > 0 && (
            <Paper sx={{ borderRadius: 3, p: 3, width: '100%', overflowX: 'hidden' }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <GapIcon sx={{ color: 'warning.main' }} /> Skill Gap Analysis
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {gapAnalysis.map(gap => {
                  const coverage = gap.total_members > 0 ? (gap.members_with_skill / gap.total_members) * 100 : 0;
                  const profPct = (gap.avg_proficiency / gap.required_proficiency) * 100;
                  const isGap = gap.gap > 0;
                  return (
                    <Box key={gap.skill_id} sx={{ 
                      p: 2, borderRadius: 2, border: '1px solid', 
                      borderColor: isGap ? `${theme.palette.error.main}30` : `${theme.palette.success.main}30`, 
                      bgcolor: isGap ? `${theme.palette.error.main}08` : `${theme.palette.success.main}08` 
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>{gap.skill_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{gap.category}</Typography>
                        </Box>
                        <Chip label={isGap ? `Gap: ${gap.gap}` : 'Met'} size="small"
                          sx={{
                            fontWeight: 700, borderRadius: 1.5,
                            bgcolor: isGap ? `${theme.palette.warning.main}20` : `${theme.palette.success.main}20`,
                            color: isGap ? 'warning.main' : 'success.main',
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Avg vs Required Proficiency</Typography>
                          <LinearProgress variant="determinate" value={Math.min(profPct, 100)}
                            sx={{
                              height: 8, borderRadius: 4, bgcolor: 'divider',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                background: profPct >= 100 
                                  ? `linear-gradient(135deg, ${theme.palette.success.light}, ${theme.palette.success.main})` 
                                  : `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.error.main})`,
                              },
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">{gap.avg_proficiency} / {gap.required_proficiency}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                          <Typography variant="h6" fontWeight={700} color={coverage === 100 ? 'success.main' : 'warning.main'}>
                            {Math.round(coverage)}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Coverage</Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}
        </>
      )}

      {/* Add Required Skill Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Required Skill</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <FormControl fullWidth sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Skill *</InputLabel>
            <Select value={form.skill_id} label="Skill *"
              onChange={(e) => setForm({ ...form, skill_id: e.target.value })}
            >
              {catalog.filter(c => !teamSkills.find(ts => ts.skill_id === c.id)).map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name} ({c.category})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>Required Proficiency Level</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Rating value={form.required_proficiency}
                onChange={(_, v) => setForm({ ...form, required_proficiency: v || 1 })}
              />
              <Typography variant="body2" color="text.secondary">
                {proficiencyLabels[form.required_proficiency]}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.skill_id}
            sx={{ borderRadius: 2, background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Set Requirement'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Remove Requirement"
        message="Remove this skill requirement from the team?"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

// --- Main Skills Page ---
export default function SkillsPage() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const isEmployee = authService.getUser()?.role === 'employee';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SkillsIcon sx={{ color: 'primary.main' }} /> Skills & Competencies
          </Typography>
          <Typography variant="body2" color="text.secondary">Manage organizational skills, team requirements, and gap analysis</Typography>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': { borderRadius: 2, fontWeight: 600, textTransform: 'none', minHeight: 48, gap: 1 },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiTabs-indicator': { bgcolor: 'primary.main', borderRadius: 2 },
          }}
        >
          {isEmployee && <Tab icon={<SkillsIcon />} iconPosition="start" label="My Skills" />}
          <Tab icon={<GapIcon />} iconPosition="start" label="Team Skills & Gaps" />
          {!isEmployee && <Tab icon={<CategoryIcon />} iconPosition="start" label="Skills Catalog" />}
        </Tabs>
      </Paper>

      {isEmployee ? (
        tab === 0 ? <MySkillsTab /> : <TeamSkillsTab />
      ) : (
        tab === 0 ? <TeamSkillsTab /> : <CatalogTab />
      )}
    </Box>
  );
}

