import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { initiateGoogleLogin, initiateGithubLogin } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';



const SignupPage = () => {
    const [loading, setloading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('')

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (formData.password.length < 9) {
            setError('Password length must be more than 10 characters')
            return
        }
        setloading(true)

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: formData.username,
                    fullname: formData.fullname,
                    email: formData.email,
                    password: formData.password
                })
            })

            const data = await response.json()

            if (response.ok) {
                navigate('/dashboard', {replace: true})
            } else {
                setError(data.error || 'Signup Failed. Please try again')
            }
        } catch (error) {
            console.error("Network error: ", error)
            setError('Unable to connect to the server. Please try again later')
        } finally {
            setloading(false)
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-card">
                <h2 className="auth-title">Create Account</h2>
                <p className="auth-subtitle">Get started with ACL Request Management</p>

                <form onSubmit={handleSignup}>
                    {error && (
                        <div style={{ color: 'red', marginBottom: '10px' }}>
                            {error}
                        </div>
                    )}
                    <div className='form-group'>
                        <input
                        type="text"
                        name="username"
                        className="form-input"
                        placeholder="username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="text"
                            name="fullname"
                            className="form-input"
                            placeholder="Full Name"
                            value={formData.fullname}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="email"
                            name="email"
                            className="form-input"
                            placeholder="Email Address"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="password"
                            name="password"
                            className="form-input"
                            placeholder="Password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="password"
                            name="confirmPassword"
                            className="form-input"
                            placeholder="Confirm Password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        { loading ? 'Creating account ...':'Create Account'}
                    </button>
                </form>

                <div className="oauth-divider">
                    <span>OR SIGN UP WITH</span>
                </div>

                <div className="oauth-buttons">
                    <button onClick={initiateGoogleLogin} className="btn-oauth btn-google">
                        Google
                    </button>
                    <button onClick={initiateGithubLogin} className="btn-oauth btn-github">
                        GitHub
                    </button>
                </div>

                <p className="auth-switch">
                    Already have an account?
                    <Link to="/login" className="auth-link">Log In</Link>
                </p>
            </div>
        </div>
    );
};

export default SignupPage;
