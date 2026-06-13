import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Dashboard from "./pages/Dashboard";
import MeetingRoom from "./pages/MeetingRoom";
import "./App.css";

// ─── Protected Route ──────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
    const { isLoggedIn } = useAuth();
    return isLoggedIn ? children : <Navigate to="/login" replace />;
};

// ─── Public Route (redirect if already logged in) ─────────────────────────────
const PublicRoute = ({ children }) => {
    const { isLoggedIn } = useAuth();
    return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
};

// ─── App Routes ───────────────────────────────────────────────────────────────
const AppRoutes = () => (
    <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route
            path="/login"
            element={
                <PublicRoute>
                    <LoginPage />
                </PublicRoute>
            }
        />

        <Route
            path="/signup"
            element={
                <PublicRoute>
                    <SignupPage />
                </PublicRoute>
            }
        />

        <Route
            path="/dashboard"
            element={
                <ProtectedRoute>
                    <Dashboard />
                </ProtectedRoute>
            }
        />

        <Route
            path="/room/:roomId"
            element={<MeetingRoom />}
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ThemeProvider>
                    <AppRoutes />
                </ThemeProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
