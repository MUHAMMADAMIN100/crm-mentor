import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store';

import { LoginPage } from './pages/auth/Login';
import { CompleteProfilePage } from './pages/auth/CompleteProfile';
import { ChangePasswordPage } from './pages/auth/ChangePassword';

import { ProfilePage } from './pages/common/Profile';
import { SettingsPage } from './pages/common/Settings';
import { AIAssistantPage } from './pages/common/AIAssistant';
import { NotesPage } from './pages/common/Notes';
import { Loading } from './components/Loading';

import { AdminHome } from './pages/admin/AdminHome';
import { AdminTeachers } from './pages/admin/AdminTeachers';
import { AdminTeacherCard } from './pages/admin/AdminTeacherCard';
import { AdminStudents } from './pages/admin/AdminStudents';
import { AdminStudentCard } from './pages/admin/AdminStudentCard';
import { AdminCourses } from './pages/admin/AdminCourses';
import { AdminCourseCard } from './pages/admin/AdminCourseCard';
import { AdminFinance } from './pages/admin/AdminFinance';
import { AdminSubscriptions } from './pages/admin/AdminSubscriptions';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminSystem } from './pages/admin/AdminSystem';
import { AdminManagers } from './pages/admin/AdminManagers';
import { AdminAudit } from './pages/admin/AdminAudit';

import { TeacherHome } from './pages/teacher/TeacherHome';
import { TeacherCalendar } from './pages/teacher/TeacherCalendar';
import { TeacherStudents } from './pages/teacher/TeacherStudents';
import { TeacherStudentDetails } from './pages/teacher/TeacherStudentDetails';
import { TeacherCourses } from './pages/teacher/TeacherCourses';
import { TeacherCourseEditor } from './pages/teacher/TeacherCourseEditor';
import { TeacherGroups } from './pages/teacher/TeacherGroups';
import { TeacherFinance } from './pages/teacher/TeacherFinance';
import { TeacherMessages } from './pages/teacher/TeacherMessages';

import { StudentHome } from './pages/student/StudentHome';
import { StudentCalendar } from './pages/student/StudentCalendar';
import { StudentCourses } from './pages/student/StudentCourses';
import { StudentCourseView } from './pages/student/StudentCourseView';
import { StudentMessages } from './pages/student/StudentMessages';

import { PublicSlots } from './pages/public/PublicSlots';

function FullLoading() {
  return <Loading full label="Загрузка…" />;
}

function Protected({ roles, children }: { roles?: string[]; children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // Priority order: mustChangePassword > profileCompleted > role check.
  // Returning children early prevents the secondary checks from issuing a
  // redirect to a page that the primary check would immediately bounce back —
  // which previously produced an infinite redirect loop and a blank screen.
  if (user.mustChangePassword) {
    if (loc.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
    return children;
  }
  if (!user.profileCompleted) {
    if (loc.pathname !== '/complete-profile') return <Navigate to="/complete-profile" replace />;
    return children;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!user.profileCompleted) return <Navigate to="/complete-profile" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'TEACHER') return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />;
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => { bootstrap(); }, [bootstrap]);

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<Protected><ChangePasswordPage /></Protected>} />
      <Route path="/complete-profile" element={<Protected><CompleteProfilePage /></Protected>} />
      <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="/ai" element={<Protected><AIAssistantPage /></Protected>} />
      <Route path="/notes" element={<Protected><NotesPage /></Protected>} />

      {/* Admin */}
      <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminHome /></Protected>} />
      <Route path="/admin/managers" element={<Protected roles={['ADMIN']}><AdminManagers /></Protected>} />
      <Route path="/admin/teachers" element={<Protected roles={['ADMIN']}><AdminTeachers /></Protected>} />
      <Route path="/admin/teachers/:id" element={<Protected roles={['ADMIN']}><AdminTeacherCard /></Protected>} />
      <Route path="/admin/students" element={<Protected roles={['ADMIN']}><AdminStudents /></Protected>} />
      <Route path="/admin/students/:id" element={<Protected roles={['ADMIN']}><AdminStudentCard /></Protected>} />
      <Route path="/admin/courses" element={<Protected roles={['ADMIN']}><AdminCourses /></Protected>} />
      <Route path="/admin/courses/:id" element={<Protected roles={['ADMIN']}><AdminCourseCard /></Protected>} />
      <Route path="/admin/finance" element={<Protected roles={['ADMIN']}><AdminFinance /></Protected>} />
      <Route path="/admin/subscriptions" element={<Protected roles={['ADMIN']}><AdminSubscriptions /></Protected>} />
      <Route path="/admin/analytics" element={<Protected roles={['ADMIN']}><AdminAnalytics /></Protected>} />
      <Route path="/admin/audit" element={<Protected roles={['ADMIN']}><AdminAudit /></Protected>} />
      <Route path="/admin/system" element={<Protected roles={['ADMIN']}><AdminSystem /></Protected>} />

      {/* Teacher */}
      <Route path="/teacher" element={<Protected roles={['TEACHER']}><TeacherHome /></Protected>} />
      <Route path="/teacher/calendar" element={<Protected roles={['TEACHER']}><TeacherCalendar /></Protected>} />
      <Route path="/teacher/students" element={<Protected roles={['TEACHER']}><TeacherStudents /></Protected>} />
      <Route path="/teacher/students/:id" element={<Protected roles={['TEACHER']}><TeacherStudentDetails /></Protected>} />
      <Route path="/teacher/courses" element={<Protected roles={['TEACHER']}><TeacherCourses /></Protected>} />
      <Route path="/teacher/courses/:id" element={<Protected roles={['TEACHER']}><TeacherCourseEditor /></Protected>} />
      <Route path="/teacher/groups" element={<Protected roles={['TEACHER']}><TeacherGroups /></Protected>} />
      <Route path="/teacher/messages" element={<Protected roles={['TEACHER']}><TeacherMessages /></Protected>} />
      <Route path="/teacher/finance" element={<Protected roles={['TEACHER']}><TeacherFinance /></Protected>} />

      {/* Student */}
      <Route path="/student" element={<Protected roles={['STUDENT']}><StudentHome /></Protected>} />
      <Route path="/student/calendar" element={<Protected roles={['STUDENT']}><StudentCalendar /></Protected>} />
      <Route path="/student/courses" element={<Protected roles={['STUDENT']}><StudentCourses /></Protected>} />
      <Route path="/student/courses/:id" element={<Protected roles={['STUDENT']}><StudentCourseView /></Protected>} />
      <Route path="/student/messages" element={<Protected roles={['STUDENT']}><StudentMessages /></Protected>} />

      {/* Public */}
      <Route path="/book/:teacherId" element={<PublicSlots />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
