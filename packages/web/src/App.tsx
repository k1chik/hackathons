import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import HomePage from "./pages/HomePage";
import InspectPage from "./pages/InspectPage";
import ResultsPage from "./pages/ResultsPage";
import ReportPage from "./pages/ReportPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import Layout from "./components/Layout";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no auth required */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected routes — redirect to /login if no token */}
          <Route element={<ProtectedRoute />}>
            {/* Report gets full-page white layout — no app chrome */}
            <Route path="/report" element={<ReportPage />} />

            {/* Main app with bottom nav */}
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/inspect" element={<InspectPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/history/:equipmentId" element={<HistoryPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
