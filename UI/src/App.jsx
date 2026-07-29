import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationGuardProvider } from './context/NavigationGuardContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Auth/LoginPage';
import LandingPage from './pages/LandingPage';
import TrainingDashboard from './pages/Training/TrainingDashboard';
import SmeKit from './pages/Training/SmeKit';
import TrainingAssessments from './pages/Training/TrainingAssessments';
import TrainingCourses from './pages/Training/TrainingCourses';
import AIAssessments from './pages/Training/AIAssessments';
import TrainingAssessmentForm from './pages/Training/TrainingAssessmentForm';
import UpskillDashboard from './pages/Upskilling/UpskillDashboard';
import UpskillCourses from './pages/Upskilling/UpskillCourses';
import ProfileSetup from './pages/Upskilling/ProfileSetup';
import ChatbotInterview from './pages/Upskilling/ChatbotInterview';
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import LearnerDetail from './pages/Manager/LearnerDetail';
import SmeKitManager from './pages/Manager/SmeKitManager';
import ManagerQuizzes from './pages/Manager/ManagerQuizzes';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import ManagerAnalytics from './pages/Analytics/ManagerAnalytics';
import AdminAnalytics from './pages/Analytics/AdminAnalytics';
import EmployeeAnalytics from './pages/Analytics/EmployeeAnalytics';
import NewJoinerAnalytics from './pages/Analytics/NewJoinerAnalytics';

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
      <NavigationGuardProvider>
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
            <Route path="/training/ai-assessments" element={<AIAssessments />} />
            <Route path="/training/ai-assessments/:assessmentId" element={<TrainingAssessmentForm />} />
            <Route path="/training/analytics" element={<NewJoinerAnalytics />} />
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
            <Route path="/upskilling/analytics" element={<EmployeeAnalytics />} />
          </Route>

          <Route element={
            <ProtectedRoute roles={['manager']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/learner/:id" element={<LearnerDetail />} />
            <Route path="/manager/sme-kits" element={<SmeKitManager />} />
            <Route path="/manager/quizzes" element={<ManagerQuizzes />} />
            <Route path="/manager/analytics" element={<ManagerAnalytics />} />
          </Route>

          <Route element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </NavigationGuardProvider>
    </AuthProvider>
  );
}