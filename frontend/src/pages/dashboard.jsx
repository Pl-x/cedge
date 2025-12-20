import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserRoles } from '../utils/api';
import { getUser } from '../utils/auth';

const DashboardGateway = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => { 
    
        const determineRedirect = async () => {
            try {
                const currentUser = getUser()
                if (!currentUser){
                    console.log('no user found')
                    navigate('/login', {replace: true})
                    return
                }
                
                const data = await fetchUserRoles()
                const userRole = data.role

                switch(userRole){
                    case 'admin':
                        console.log()
                        navigate('/reviewer', {replace: true})
                        break
                    case 'user':
                        console.log()
                        navigate('/requester', {replace: true})
                        break
                    default:
                        console.error('Unknown role:', userRole)
                        setError('Your account has an invalid role. Please contact support')
                        setIsLoading(false)
                }
            } catch (err) {
                console.error("Dashboard redirect error:", err);

                if (err.message.includes('Session expired') || err.message.includes('No authentication token')) {
                    navigate('/login', {replace: true})
                } else if (err.message.includes('No role assigned')) {
                    setError("Your account does not have a role assigned. Please contact an administrator")
                } else {
                    setError("Failed to determine user permissions. Please try logging in again")
                }
                setIsLoading(false);
            }
        };

        determineRedirect();
    }, [navigate]);


    if (isLoading){
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                flexDirection: 'column'
            }}>
                <div className='spinner'>Loading...</div>
                <p>Determining your dashboard...</p>
            </div>
        )
    }
    // View while waiting for API or if an error occurred
    return (
        <div className="dashboard-loading-container">
            <div className="glass-card" style={{ maxWidth: '600px' }}>
                {isLoading ? (
                    <>
                        <div className="spinner" style={{ margin: '0 auto 20px auto' }}></div>
                        <h3 style={{ marginBottom: '10px' }}>Accessing ACL Workflow...</h3>
                        <p className="auth-subtitle">Verifying permissions and redirecting.</p>
                    </>
                ) : error ? (
                    <>
                        <div className="error-banner">
                            {error}
                        </div>
                        <button onClick={() => navigate('/login')} className="btn-oauth" style={{ marginTop: '20px', width: 'auto', padding: '10px 20px' }}>
                            Return to LoginPage
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default DashboardGateway;