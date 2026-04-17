import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Skeleton, Chip, Avatar, List,
  ListItem, ListItemAvatar, ListItemText, Divider, Paper, LinearProgress,
  Rating, useTheme,
} from '@mui/material';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import {
  People as PeopleIcon, Groups as GroupsIcon, EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon, LocationOn as LocationIcon,
  MilitaryTech as AwardIcon, Psychology as SkillsIcon,
  Assignment as PlanIcon, Assessment as GapIcon,
  CheckCircle as DoneIcon, School as TrainingIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import teamsService from '../services/teamsService';
import individualsService from '../services/individualsService';
import achievementsService from '../services/achievementsService';
import skillsService from '../services/skillsService';
import devplansService from '../services/devplansService';
import authService from '../services/authService';

const StatCard = ({ title, value, icon, gradient, loading, onClick, subtitle }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 3, cursor: onClick ? 'pointer' : 'default', transition: 'all 0.3s',
        '&:hover': onClick ? { transform: 'translateY(-4px)', boxShadow: isDark ? '0 12px 24px rgba(0,0,0,0.4)' : '0 12px 24px rgba(0,0,0,0.1)' } : {},
        overflow: 'visible', position: 'relative',
        bgcolor: 'background.paper',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={60} height={42} />
            ) : (
              <Typography variant="h3" sx={{ fontWeight: 800, background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {value}
              </Typography>
            )}
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          <Avatar sx={{ width: 48, height: 48, background: gradient, boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.15)' }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

const RiskAnalysisSection = ({ teamRisk, theme }) => {
  return (
    <Grid size={{ xs: 12 }}>
      <Paper sx={{ borderRadius: 3, p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: 'error.main' }} /> Engagement & Development Risk
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Identifies team members who may require attention based on low skill coverage, lack of recent recognition, and stagnant development plans.
        </Typography>
        
        {teamRisk.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No risk data available.
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            {teamRisk.map((member) => (
              <Box key={member.id} sx={{ 
                p: 2, borderRadius: 2, 
                bgcolor: member.risk_level === 'High' ? `${theme.palette.error.main}10` : member.risk_level === 'Medium' ? `${theme.palette.warning.main}10` : 'action.hover', 
                border: '1px solid', 
                borderColor: member.risk_level === 'High' ? `${theme.palette.error.main}30` : member.risk_level === 'Medium' ? `${theme.palette.warning.main}30` : 'divider'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>{member.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{member.designation}</Typography>
                  </Box>
                  <Chip 
                    label={`${member.risk_level} Risk`} 
                    size="small"
                    sx={{ 
                      fontWeight: 700, borderRadius: 1.5,
                      bgcolor: member.risk_level === 'High' ? `${theme.palette.error.main}20` : member.risk_level === 'Medium' ? `${theme.palette.warning.main}20` : `${theme.palette.success.main}20`,
                      color: member.risk_level === 'High' ? 'error.main' : member.risk_level === 'Medium' ? 'warning.main' : 'success.main',
                    }} 
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">Skill Coverage</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={member.skill_coverage}
                      sx={{ height: 6, borderRadius: 3, mt: 0.5, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: member.skill_coverage < 50 ? 'error.main' : 'primary.main' } }} 
                    />
                    <Typography variant="caption" fontWeight={600}>{member.skill_coverage}%</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Dev Plan</Typography>
                    <Typography variant="body2" fontWeight={600}>{member.dev_completed}/{member.dev_total} done</Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </Grid>
  );
};

// ---- Employee Dashboard ----
function EmployeeDashboard({ user, navigate, loading, myIndividual, mySkills, myPlans, myAwards, teamSkills }) {
  const theme = useTheme();
  const skillCount = mySkills?.length || 0;
  const planItems = myPlans?.reduce((acc, p) => acc + (p.total_items || 0), 0) || 0;
  const completedItems = myPlans?.reduce((acc, p) => acc + (p.completed_items || 0), 0) || 0;
  const overallProgress = planItems > 0 ? Math.round((completedItems / planItems) * 100) : 0;

  // Build gap view: compare my skills to my team's required skills
  const gapView = (teamSkills || []).map(ts => {
    const mySkill = (mySkills || []).find(s => s.skill_id === ts.skill_id);
    return {
      ...ts,
      myProficiency: mySkill?.proficiency || 0,
      gap: ts.required_proficiency - (mySkill?.proficiency || 0),
    };
  });

  return (
    <>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="My Skills" value={skillCount} loading={loading}
            icon={<SkillsIcon />} gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            onClick={() => navigate('/skills')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Dev Plan Progress" value={`${overallProgress}%`} loading={loading}
            icon={<PlanIcon />} gradient="linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)"
            subtitle={`${completedItems}/${planItems} items done`}
            onClick={() => navigate('/dev-plans')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="My Awards" value={myAwards?.length || 0} loading={loading}
            icon={<TrophyIcon />} gradient="linear-gradient(135deg, #f59e0b 0%, #f97316 100%)"
            onClick={() => navigate('/achievements')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Skill Gaps" value={gapView.filter(g => g.gap > 0).length} loading={loading}
            icon={<GapIcon />} gradient="linear-gradient(135deg, #ef4444 0%, #f97316 100%)"
            subtitle="vs team requirements" />
        </Grid>
      </Grid>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ borderRadius: 3, p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Peer Comparison: My Skills vs Team Average</Typography>
            <Box sx={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={gapView} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="skill_name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                  <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="myProficiency" name="My Level" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="avg_proficiency" name="Team Avg" fill={theme.palette.text.secondary} radius={[4, 4, 0, 0]} barSize={24} opacity={0.6} />
                  <Bar dataKey="required_proficiency" name="Required" fill={theme.palette.warning.main} radius={[4, 4, 0, 0]} barSize={24} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* My Skills vs Team Requirements */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ borderRadius: 3, p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SkillsIcon sx={{ color: 'primary.main' }} /> My Skills Assessment
            </Typography>
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} height={50} sx={{ mb: 1 }} />)
            ) : gapView.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {gapView.map(skill => (
                  <Box key={skill.skill_id} sx={{ 
                    p: 2, borderRadius: 2, 
                    bgcolor: skill.gap > 0 ? `${theme.palette.error.main}10` : `${theme.palette.success.main}10`, 
                    border: '1px solid', 
                    borderColor: skill.gap > 0 ? `${theme.palette.error.main}30` : `${theme.palette.success.main}30` 
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>{skill.skill_name}</Typography>
                      <Chip label={skill.gap > 0 ? `Gap: ${skill.gap}` : 'Met ✓'} size="small"
                        sx={{ 
                          height: 20, fontSize: '0.65rem', fontWeight: 700, 
                          bgcolor: skill.gap > 0 ? `${theme.palette.warning.main}20` : `${theme.palette.success.main}20`, 
                          color: skill.gap > 0 ? 'warning.main' : 'success.main' 
                        }} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 30 }}>You:</Typography>
                      <Rating value={skill.myProficiency} readOnly size="small" />
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50, ml: 1 }}>Need:</Typography>
                      <Rating value={skill.required_proficiency} readOnly size="small" sx={{ '& .MuiRating-iconFilled': { color: 'warning.main' } }} />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : mySkills?.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {mySkills.map(s => (
                  <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{s.skill_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.category}</Typography>
                    </Box>
                    <Rating value={s.proficiency} readOnly size="small" />
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No skills assessed yet. Visit the Skills page to get started.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* My Development Plans */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ borderRadius: 3, p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrainingIcon sx={{ color: 'secondary.main' }} /> My Development Plans
            </Typography>
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} height={60} sx={{ mb: 1 }} />)
            ) : myPlans?.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {myPlans.slice(0, 5).map(plan => (
                  <Box key={plan.id} sx={{ 
                    p: 2, borderRadius: 2, 
                    bgcolor: 'action.hover', 
                    border: '1px solid',
                    borderColor: 'divider', 
                    cursor: 'pointer', 
                    '&:hover': { bgcolor: 'action.selected' } 
                  }}
                    onClick={() => navigate('/dev-plans')}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>{plan.title}</Typography>
                      <Chip label={plan.status?.replace('_', ' ')} size="small"
                        sx={{ 
                          height: 20, fontSize: '0.6rem', fontWeight: 600, textTransform: 'capitalize',
                          bgcolor: plan.status === 'completed' ? `${theme.palette.success.main}15` : plan.status === 'in_progress' ? `${theme.palette.primary.main}15` : 'action.disabledBackground',
                          color: plan.status === 'completed' ? 'success.main' : plan.status === 'in_progress' ? 'primary.main' : 'text.disabled',
                        }} />
                    </Box>
                    <LinearProgress variant="determinate" value={plan.progress || 0}
                      sx={{ 
                        height: 6, borderRadius: 3, bgcolor: 'divider',
                        '& .MuiLinearProgress-bar': { borderRadius: 3, background: plan.progress === 100 ? theme.palette.success.main : theme.palette.secondary.main },
                      }} />
                    <Typography variant="caption" color="text.secondary">{plan.completed_items}/{plan.total_items} items</Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No development plans yet. Ask your manager to create one!
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </>
  );
}

// ---- Admin Dashboard (original global stats) ----
function AdminDashboard({ user, navigate, loading, teams, individuals, awards }) {
  const theme = useTheme();
  const [teamRisk, setTeamRisk] = useState([]);

  useEffect(() => {
    loadRiskData();
  }, [teams.length]);

  const loadRiskData = async () => {
    if (teams.length === 0) return;
    try {
      // For Admin/HR, provide a cross-section of risk across active teams (limit to 5 for dashboard overview)
      const risks = await Promise.all(
        teams.slice(0, 5).map(t => skillsService.getRiskAnalysis(t.id).catch(() => []))
      );
      setTeamRisk(risks.flat());
    } catch (e) {
      console.error('Failed to load risk analysis', e);
    }
  };
  const remoteLeaderTeams = teams.filter(t => {
    if (!t.leader_id) return false;
    const leader = individuals.find(i => i.id === t.leader_id);
    return leader && leader.location !== t.location;
  });

  const nonDirectLeaderTeams = teams.filter(t => {
    if (!t.leader_id) return false;
    const leader = individuals.find(i => i.id === t.leader_id);
    return leader && !leader.is_direct_staff;
  });

  const highNonDirectRatioTeams = teams.filter(t => {
    const members = individuals.filter(i => i.team_id === t.id);
    if (members.length === 0) return false;
    const nonDirect = members.filter(m => !m.is_direct_staff).length;
    return (nonDirect / members.length) > 0.2;
  });

  const orgLeaderTeams = teams.filter(t => t.org_leader_id);
  const recentAwards = awards.slice(0, 5);

  // --- NEW: Dynamic Location Calculation ---
  const uniqueLocations = new Set();

  // Rule 1: Direct employees' locations are distinct offices
  individuals.forEach(ind => {
    if (ind.is_direct_staff && ind.location) {
      uniqueLocations.add(ind.location);
    }
  });

  // Rule 2: Teams use assigned location OR default to member majority
  teams.forEach(team => {
    if (team.location) {
      uniqueLocations.add(team.location);
    } else {
      const teamMembers = individuals.filter(i => i.team_id === team.id && i.location);
      if (teamMembers.length > 0) {
        const locCounts = teamMembers.reduce((acc, m) => {
          acc[m.location] = (acc[m.location] || 0) + 1;
          return acc;
        }, {});
        const majorityLoc = Object.keys(locCounts).reduce((a, b) => locCounts[a] > locCounts[b] ? a : b);
        uniqueLocations.add(majorityLoc);
      }
    }
  });
  // -----------------------------------------

  return (
    <>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Total People" value={individuals.length} loading={loading}
            icon={<PeopleIcon />} gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            onClick={() => navigate('/people')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Total Teams" value={teams.length} loading={loading}
            icon={<GroupsIcon />} gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            onClick={() => navigate('/teams')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Awards" value={awards.length} loading={loading}
            icon={<TrophyIcon />} gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            onClick={() => navigate('/achievements')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Locations" value={uniqueLocations.size} loading={loading}
            icon={<LocationIcon />} gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ borderRadius: 3, p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingIcon sx={{ color: 'primary.main' }} /> Organizational Insights
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                { label: 'Teams with remote leaders', value: remoteLeaderTeams.length, color: theme.palette.warning.main },
                { label: 'Teams with non-direct staff leaders', value: nonDirectLeaderTeams.length, color: theme.palette.error.main },
                { label: 'Teams with >20% non-direct ratio', value: highNonDirectRatioTeams.length, color: theme.palette.secondary.main },
                { label: 'Teams reporting to org leader', value: orgLeaderTeams.length, color: theme.palette.success.main },
              ].map((item) => (
                <Box key={item.label} sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  p: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider',
                }}>
                  <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                  <Chip label={loading ? '...' : item.value} size="small"
                    sx={{ fontWeight: 700, bgcolor: `${item.color}15`, color: item.color, minWidth: 36 }} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ borderRadius: 3, p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AwardIcon sx={{ color: 'warning.main' }} /> Recent Awards
            </Typography>
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} height={60} sx={{ mb: 1 }} />)
            ) : recentAwards.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No awards granted yet. Start recognizing your team's wins!
              </Typography>
            ) : (
              <List disablePadding>
                {recentAwards.map((award, idx) => (
                  <Box key={award.id}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: `${theme.palette.warning.main}20`, color: 'warning.main' }}>
                          <AwardIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="subtitle2" fontWeight={600}>{award.title}</Typography>}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            {award.recurrence && <Chip label={award.recurrence} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />}
                            <Typography variant="caption" color="text.secondary">{award.awarded_date}</Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {idx < recentAwards.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Engagement & Attrition Risk Section */}
        <RiskAnalysisSection teamRisk={teamRisk} theme={theme} />
      </Grid>
    </>
  );
}

// ---- Manager/HR Dashboard ----
function ManagerDashboard({ user, navigate, loading, teams, individuals, awards, role }) {
  const theme = useTheme();
  const [teamSkillGaps, setTeamSkillGaps] = useState([]);
  const [teamPlans, setTeamPlans] = useState([]);
  const [teamRisk, setTeamRisk] = useState([]);

  // For manager: teams they lead. For HR: all teams in their location scope
  const myTeams = role === 'manager'
    ? teams.filter(t => t.leader_id === user?.id)
    : teams; // HR sees all (already scoped by backend)

  const myMembers = individuals.filter(i => myTeams.some(t => t.id === i.team_id));
  const myAwards = awards.filter(a => myTeams.some(t => t.id === a.team_id) || myMembers.some(m => m.id === a.individual_id));

  useEffect(() => {
    loadManagerData();
  }, [teams.length]);

  const loadManagerData = async () => {
    if (myTeams.length === 0) return;
    try {
      const gaps = await Promise.all(
        myTeams.slice(0, 5).map(t => skillsService.getGapAnalysis(t.id).catch(() => []))
      );
      setTeamSkillGaps(gaps.flat());

      const plans = await Promise.all(
        myTeams.slice(0, 5).map(t => devplansService.getPlans({ team_id: t.id }).catch(() => []))
      );
      setTeamPlans(plans.flat());

      // Fetch Risk Analysis
      const risks = await Promise.all(
        myTeams.slice(0, 5).map(t => skillsService.getRiskAnalysis(t.id).catch(() => []))
      );
      setTeamRisk(risks.flat());
    } catch (e) {
      console.error('Failed to load manager data', e);
    }
  };

  const totalPlanItems = teamPlans.reduce((a, p) => a + (p.total_items || 0), 0);
  const completedPlanItems = teamPlans.reduce((a, p) => a + (p.completed_items || 0), 0);
  const avgProgress = totalPlanItems > 0 ? Math.round((completedPlanItems / totalPlanItems) * 100) : 0;
  const criticalGaps = teamSkillGaps.filter(g => g.gap >= 2);

  // Chart data for Dev Plans
  const planData = [
    { name: 'Completed', value: teamPlans.filter(p => p.status === 'completed').length, color: theme.palette.success.main },
    { name: 'In Progress', value: teamPlans.filter(p => p.status === 'in_progress').length, color: theme.palette.primary.main },
    { name: 'Draft', value: teamPlans.filter(p => p.status === 'draft').length, color: theme.palette.text.disabled },
  ].filter(d => d.value > 0);

  return (
    <>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title={role === 'hr' ? 'Total Employees' : 'Team Members'} value={myMembers.length} loading={loading}
            icon={<PeopleIcon />} gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            onClick={() => navigate('/people')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title={role === 'hr' ? 'All Teams' : 'My Teams'} value={myTeams.length} loading={loading}
            icon={<GroupsIcon />} gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            onClick={() => navigate('/teams')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Dev Plan Progress" value={`${avgProgress}%`} loading={loading}
            icon={<PlanIcon />} gradient="linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)"
            subtitle={`${completedPlanItems}/${totalPlanItems} items`}
            onClick={() => navigate('/dev-plans')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Critical Skill Gaps" value={criticalGaps.length} loading={loading}
            icon={<GapIcon />} gradient="linear-gradient(135deg, #ef4444 0%, #f97316 100%)"
            subtitle="Gap ≥ 2 levels"
            onClick={() => navigate('/skills')} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Skill Gap Summary */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ borderRadius: 3, p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <GapIcon sx={{ color: 'error.main' }} /> Top Skill Gaps
            </Typography>
            {teamSkillGaps.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No skill requirements set yet. Visit Skills to define team requirements.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {teamSkillGaps
                  .filter(g => g.gap > 0)
                  .sort((a, b) => b.gap - a.gap)
                  .slice(0, 6)
                  .map((gap, idx) => (
                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderRadius: 2, bgcolor: `${theme.palette.error.main}10`, border: '1px solid', borderColor: `${theme.palette.error.main}30` }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{gap.skill_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{gap.category} • {gap.members_with_skill}/{gap.total_members} have it</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" fontWeight={700} color="error.main">Gap: {gap.gap}</Typography>
                        <Typography variant="caption" color="text.secondary">{gap.avg_proficiency}/{gap.required_proficiency}</Typography>
                      </Box>
                    </Box>
                  ))}
                {teamSkillGaps.filter(g => g.gap > 0).length === 0 && (
                  <Box sx={{ p: 3, borderRadius: 2, bgcolor: `${theme.palette.success.main}10`, border: '1px solid', borderColor: `${theme.palette.success.main}30`, textAlign: 'center' }}>
                    <DoneIcon sx={{ color: 'success.main', fontSize: 32, mb: 1 }} />
                    <Typography variant="body2" color="success.main" fontWeight={600}>All skill requirements are met!</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Engagement & Attrition Risk Section */}
        <RiskAnalysisSection teamRisk={teamRisk} theme={theme} />

        {/* Team Development Plan Visualization */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ borderRadius: 3, p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlanIcon sx={{ color: 'secondary.main' }} /> Dev Plan Status Distribution
            </Typography>
            {teamPlans.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No active plans to visualize.
              </Typography>
            ) : (
              <Box sx={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {planData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Team Development Plan List */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ borderRadius: 3, p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrainingIcon sx={{ color: 'secondary.main' }} /> Recent Team Development Plans
            </Typography>
            {teamPlans.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No development plans yet for your team(s).
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {teamPlans.slice(0, 6).map(plan => (
                  <Grid key={plan.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Box sx={{ 
                      p: 2, borderRadius: 2, 
                      bgcolor: 'action.hover', 
                      border: '1px solid',
                      borderColor: 'divider', 
                      cursor: 'pointer', 
                      '&:hover': { bgcolor: 'action.selected' } 
                    }}
                      onClick={() => navigate('/dev-plans')}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>{plan.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{plan.individual_name}</Typography>
                        </Box>
                        <Chip label={plan.status?.replace('_', ' ')} size="small"
                          sx={{ 
                            height: 20, fontSize: '0.6rem', fontWeight: 600, textTransform: 'capitalize',
                            bgcolor: plan.status === 'completed' ? `${theme.palette.success.main}15` : plan.status === 'in_progress' ? `${theme.palette.primary.main}15` : 'action.disabledBackground',
                            color: plan.status === 'completed' ? 'success.main' : plan.status === 'in_progress' ? 'primary.main' : 'text.disabled',
                          }} />
                      </Box>
                      <LinearProgress variant="determinate" value={plan.progress || 0}
                        sx={{ height: 4, borderRadius: 2, bgcolor: 'divider', '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: 'secondary.main' } }} />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </>
  );
}

// ---- Main Dashboard ----
export default function DashboardPage() {
  const theme = useTheme();
  const [teams, setTeams] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [awards, setAwards] = useState([]);
  const [mySkills, setMySkills] = useState([]);
  const [myPlans, setMyPlans] = useState([]);
  const [teamSkills, setTeamSkills] = useState([]);
  const [myIndividual, setMyIndividual] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('new') === '1';
  const user = authService.getUser();
  const role = user?.role;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, i, a] = await Promise.all([
        teamsService.getAll().catch(() => []),
        individualsService.getAll().catch(() => []),
        achievementsService.getAwards().catch(() => []),
      ]);
      setTeams(t);
      setIndividuals(i);
      setAwards(a);

      // Employee-specific data
      if (role === 'employee' || role === 'manager') {
        const myInd = i.find(ind => ind.user_id === user?.id);
        setMyIndividual(myInd);
        if (myInd) {
          const [skills, plans] = await Promise.all([
            skillsService.getIndividualSkills(myInd.id).catch(() => []),
            devplansService.getPlans({ individual_id: myInd.id }).catch(() => []),
          ]);
          setMySkills(skills);
          setMyPlans(plans);

          // Get team requirements for gap comparison
          if (myInd.team_id) {
            const ts = await skillsService.getTeamSkills(myInd.team_id).catch(() => []);
            setTeamSkills(ts);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const myAwards = myIndividual
    ? awards.filter(a => a.individual_id === myIndividual.id)
    : [];

  const dashboardTitle = role === 'admin' ? 'Organization Overview' :
    role === 'hr' ? 'HR Overview' :
    role === 'manager' ? 'Team Overview' : 'My Dashboard';

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ 
          fontWeight: 800, mb: 0.5, 
          background: theme.palette.mode === 'light' 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent' 
        }}>
          {isNew ? 'Welcome' : 'Welcome back'}, {user?.username}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {dashboardTitle}
        </Typography>
      </Box>

      {role === 'admin' || role === 'hr' ? (
        <AdminDashboard user={user} navigate={navigate} loading={loading} teams={teams} individuals={individuals} awards={awards} />
      ) : role === 'manager' ? (
        <>
          <ManagerDashboard user={user} navigate={navigate} loading={loading} teams={teams} individuals={individuals} awards={awards} role={role} />
          {/* Manager also gets their own employee stats if they have an individual record */}
          {role === 'manager' && myIndividual && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon sx={{ color: 'primary.main' }} /> My Personal Development
              </Typography>
              <EmployeeDashboard user={user} navigate={navigate} loading={loading} myIndividual={myIndividual}
                mySkills={mySkills} myPlans={myPlans} myAwards={myAwards} teamSkills={teamSkills} />
            </Box>
          )}
        </>
      ) : (
        <EmployeeDashboard user={user} navigate={navigate} loading={loading} myIndividual={myIndividual}
          mySkills={mySkills} myPlans={myPlans} myAwards={myAwards} teamSkills={teamSkills} />
      )}
    </Box>
  );
}

