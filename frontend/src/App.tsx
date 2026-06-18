import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Dashboard from "./pages/Dashboard";
import MeetingRoom from "./pages/MeetingRoom";
import Workspace from "./pages/Workspace";
import "./App.css";
import type { ReactNode } from "react";
import { Agentation } from "agentation";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const { isLoggedIn } = useAuth();
    return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: ReactNode }) => {
    const { isLoggedIn } = useAuth();
    return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
};

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
            path="/workspaces"
            element={
                <ProtectedRoute>
                    <Workspace />
                </ProtectedRoute>
            }
        />

        <Route path="/room/:roomId" element={<MeetingRoom />} />

        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);

export default function App() {
    return (
        <>
            <BrowserRouter>
            <AuthProvider>
                <ThemeProvider>
                    <NotificationProvider>
                        <AppRoutes />
                    </NotificationProvider>
                </ThemeProvider>
            </AuthProvider>
        </BrowserRouter>
        {import.meta.env.DEV && <Agentation />}
        </>
    );
}
