import React from 'react';
import { useNavigate } from 'react-router-dom';

const LogoutButton = ({ className }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };
    return (
        <button
        onClick={handleLogout}
        className={`btn-logout ${className || ''}`}
        style={{
            backgroundColor: 'hsl(210 100% 50%)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
        onMouseOut={(e) => e.target.style.backgroundColor = 'hsl(210 100% 50%)'}
        >
        Sign Out
        </button>
    );
};

export default LogoutButton;
