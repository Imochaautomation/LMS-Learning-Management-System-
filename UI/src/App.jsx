import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Auth/LoginPage';
import LandingPage from './pages/LandingPage';
import TrainingDashboard from './pages/Training/TrainingDashboard';
import SmeKit from './pages/Training/SmeKit';
import TrainingAssessments from './pages/Training/TrainingAssessments';
import TrainingCourses from './pages/Training/TrainingCourses';
import UpskillDashboard from './pages/Upskilling/UpskillDashboard';
import UpskillCourses from './pages/Upskilling/UpskillCourses';
import ProfileSetup from './pages/Upskilling/ProfileSetup';
import ChatbotInterview from './pages/Upskilling/ChatbotInterview';
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import LearnerDetail from './pages/Manager/LearnerDetail';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#F05A28', borderTopColor: 'transparent' }} />
    </div>
  );
  if (!user) return <LandingPage />;
  const routes = { admin: '/admin', manager: '/manager', new_joiner: '/training', employee: '/upskilling' };
  return <Navigate to={routes[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={
            <ProtectedRoute roles={['new_joiner', 'manager']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/training" element={<TrainingDashboard />} />
            <Route path="/training/sme-kit" element={<SmeKit />} />
            <Route path="/training/assessments" element={<TrainingAssessments />} />
            <Route path="/training/courses" element={<TrainingCourses />} />
          </Route>

          <Route element={
            <ProtectedRoute roles={['employee']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/upskilling" element={<UpskillDashboard />} />
            <Route path="/upskilling/courses" element={<UpskillCourses />} />
            <Route path="/upskilling/profile" element={<ProfileSetup />} />
            <Route path="/upskilling/interview" element={<ChatbotInterview />} />
          </Route>

          <Route element={
            <ProtectedRoute roles={['manager']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/learner/:id" element={<LearnerDetail />} />
          </Route>

          <Route element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}