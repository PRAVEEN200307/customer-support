import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import AuthProvider from './context/AuthContext';
import SocketProvider from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import VerifyEmail from './pages/auth/VerifyEmail';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerChat from './pages/customer/Chat';
import AdminDashboard from './pages/admin/Dashboard';
import AdminChat from './pages/admin/Chat';
import AdminRooms from './pages/admin/Rooms';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              
              {/* Customer Routes */}
              <Route path="/customer" element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="chat" />} />
                <Route path="chat" element={<CustomerChat />} />
              </Route>
              
              {/* Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="chat" />} />
                <Route path="chat" element={<AdminChat />} />
              </Route>
              
              {/* Default Route */}
              <Route path="/" element={<Navigate to="/login" />} />
            </Routes>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;