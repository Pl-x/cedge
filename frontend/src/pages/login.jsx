import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { initiateGoogleLogin, initiateGithubLogin } from '../utils/api';
import { setAuthToken } from '../utils/auth';
import {API_BASE_URL} from '../config'

const LoginPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('')

        if(!email || !password){
            setError('Email and Password fields are required')
            return
        }
        setLoading(true)

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type':'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            })

            const data = await response.json()

            if(response.ok){
                setAuthToken(data.token, data.user)

                localStorage.setItem('user', JSON.stringify(data.user))

                navigate("/dashboard", {replace: true})
            } else {
                setError(data.error || 'login Failed. Please check your credentials')
            }
        } catch (error) {
            setError('Unable to connect to the server. try again later')
        } finally{
            setLoading(false)
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-card">
                <h2 className="auth-title">Welcome Back</h2>
                <p className="auth-subtitle">Sign in to continue to the ACL Manager</p>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            className="form-input"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'signing in ...': 'Sign In'}
                    </button>
                </form>

                <div className="oauth-divider">
                    <span>OR CONTINUE WITH</span>
                </div>

                <div className="oauth-buttons">
                    {/* Replace text with icons if react-icons is installed: <FcGoogle size={20}/> */}
                    <button onClick={initiateGoogleLogin} className="btn-oauth btn-google">
                        Google
                    </button>
                    {/* Replace text with icons if react-icons is installed: <FaGithub size={20}/> */}
                    <button onClick={initiateGithubLogin} className="btn-oauth btn-github">
                        GitHub
                    </button>
                </div>

                <p className="auth-switch">
                    Don't have an account?
                    <Link to="/signup" className="auth-link">Sign Up</Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
