/**
 * API Client with HttpOnly cookie support and CSRF Token header injection.
 */
const API_BASE = '/api';

export async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = document.cookie.split('; ').find((value) => value.startsWith('csrf_token='))?.split('=')[1];
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'same-origin' });
  if (res.status === 401) {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'خطأ في الاتصال' }));
    const detail = Array.isArray(err.detail) ? err.detail[0]?.msg : err.detail;
    throw new Error(detail || 'خطأ في الخادم');
  }
  return res.json();
}

export const API = {
  login: (email, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => api('/auth/logout', { method: 'POST' }),
  me: () => api('/auth/me'),
  users: () => api('/users'),

  // Dashboard
  adminStats: () => api('/dashboard/admin'),
  hrStats: () => api('/dashboard/hr'),
  employeeStats: () => api('/dashboard/employee'),

  // Employees & Departments
  employees: () => api('/employees'),
  employee: (id) => api(`/employees/${id}`),
  createEmployee: (data) => api('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => api(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  myProfile: () => api('/employees/me/profile'),
  teamMembers: () => api('/employees/team/members'),
  teamOverview: () => api('/employees/team/overview'),
  departments: () => api('/departments'),
  createDepartment: (data) => api('/departments', { method: 'POST', body: JSON.stringify(data) }),

  // Skills
  skills: () => api('/skills'),
  createSkill: (data) => api('/skills', { method: 'POST', body: JSON.stringify(data) }),
  employeeSkills: (empId) => api(`/employees/${empId}/skills`),

  // Assessments
  assessments: (empId) => api(`/assessments${empId ? '?employee_id=' + empId : ''}`),
  createAssessment: (data) => api('/assessments', { method: 'POST', body: JSON.stringify(data) }),
  compareAssessments: (empId) => api(`/assessments/compare/${empId}`),

  // Courses
  courses: () => api('/courses'),
  createCourse: (data) => api('/courses', { method: 'POST', body: JSON.stringify(data) }),
  course: (id) => api(`/courses/${id}`),
  favorites: () => api('/courses/favorites/me'),
  toggleFavorite: (id) => api(`/courses/${id}/favorite`, { method: 'POST' }),
  courseReviews: (id) => api(`/courses/${id}/reviews`),
  createCourseReview: (id, data) => api(`/courses/${id}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  enrollCourse: (id) => api(`/courses/${id}/enroll`, { method: 'POST' }),

  // Plans & Approvals
  trainingPlans: (status) => api(`/training-plans${status ? '?status=' + status : ''}`),
  createTrainingPlan: (data) => api('/training-plans', { method: 'POST', body: JSON.stringify(data) }),
  myTrainingPlans: () => api('/training-plans/my'),
  managerApprovePlan: (id, notes) => api(`/training-plans/${id}/manager-approve`, { method: 'PUT', body: JSON.stringify({ notes: notes || null }) }),
  approvePlan: (id) => api(`/training-plans/${id}/approve`, { method: 'PUT' }),
  rejectPlan: (id, reason) => api(`/training-plans/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason: reason || 'مرفوض للتعديل' }) }),
  resubmitPlan: (id) => api(`/training-plans/${id}/resubmit`, { method: 'PUT' }),
  startEnrollment: (id) => api(`/enrollments/${id}/start`, { method: 'PUT' }),
  completeEnrollment: (id, score) => api(`/enrollments/${id}/complete`, { method: 'PUT', body: JSON.stringify({ score: score ?? null }) }),

  // Skill Upgrades Workflow
  pendingSkillUpgrades: () => api('/skill-upgrades/pending'),
  decideSkillUpgrade: (impactId, approved, notes) => api(`/skill-upgrades/${impactId}/decision`, { method: 'PUT', body: JSON.stringify({ approved, notes: notes || null }) }),

  // Notifications
  notifications: () => api('/notifications'),
  markNotificationRead: (id) => api(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => api('/notifications/read-all', { method: 'PUT' }),

  // AI & ML
  recommend: (empId) => api(`/ai/recommend/${empId}`, { method: 'POST' }),
  skillGaps: (empId) => api(`/ai/skill-gaps/${empId}`),
  recommendations: () => api('/ai/recommendations'),
  impact: (empId) => api(`/ai/impact/${empId}`),
  myImpact: () => api('/ai/impact/me'),
  actualImpact: (empId) => api(`/ai/actual-impact/${empId}`),
  myActualImpact: () => api('/ai/actual-impact/me'),
  modelMetrics: () => api('/ai/model-metrics'),

  // Reports
  deptSkills: () => api('/reports/department-skills'),
  trainingNeeds: () => api('/reports/training-needs'),
  performance: () => api('/reports/performance-tracking'),
  deptDistribution: () => api('/reports/department-distribution'),
  trainingImpact: () => api('/reports/training-impact'),
  trainingProgress: () => api('/reports/training-progress'),
  decisionSummary: () => api('/reports/decision-summary'),
  reportOverview: () => api('/reports/overview'),
  auditLogs: () => api('/audit-logs'),
};
