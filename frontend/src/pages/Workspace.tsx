import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Settings, Plus, Video } from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function Workspace() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock fetch or actual API endpoint for workspaces
        // api.get('/workspaces').then(res => setWorkspaces(res.data));
        setTimeout(() => {
            setWorkspaces([
                { _id: '1', name: 'Engineering Team', role: 'Admin', members: 12, meetingsCount: 45 },
                { _id: '2', name: 'Product Marketing', role: 'Editor', members: 8, meetingsCount: 12 },
            ]);
            setLoading(false);
        }, 800);
    }, []);

    const handleCreateWorkspace = () => {
        alert("Create Workspace feature coming soon!");
    };

    return (
        <div className="dashboard-container fade-in">
            <header className="dashboard-header">
                <div>
                    <h1>Your Workspaces</h1>
                    <p className="text-muted">Manage your teams, roles, and meeting summaries.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleCreateWorkspace}>
                        <Plus size={18} /> New Workspace
                    </button>
                </div>
            </header>

            <div className="dashboard-content">
                {loading ? (
                    <div className="empty-state glass-card">
                        <span className="spinner" />
                        <p>Loading workspaces...</p>
                    </div>
                ) : workspaces.length === 0 ? (
                    <div className="empty-state glass-card">
                        <Users size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <h3>No workspaces yet</h3>
                        <p className="text-muted">Create a workspace to start collaborating with your team.</p>
                        <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={handleCreateWorkspace}>
                            Create Workspace
                        </button>
                    </div>
                ) : (
                    <div className="dashboard-grid">
                        {workspaces.map((ws) => (
                            <div key={ws._id} className="meeting-card glass-card">
                                <div className="card-header">
                                    <div className="meeting-icon-wrapper" style={{ background: 'var(--accent-glow)' }}>
                                        <Users size={20} color="var(--accent)" />
                                    </div>
                                    <span className="badge badge-purple">{ws.role}</span>
                                </div>
                                <h3 className="meeting-title">{ws.name}</h3>
                                <div className="meeting-meta">
                                    <span><Users size={14} /> {ws.members} members</span>
                                    <span><Video size={14} /> {ws.meetingsCount} meetings</span>
                                </div>
                                <div className="card-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px', display: 'flex', gap: '10px' }}>
                                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                                        <FileText size={14} /> Summaries
                                    </button>
                                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                                        <Settings size={14} /> Settings
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
