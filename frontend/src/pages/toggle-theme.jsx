import { useState, useEffect } from "react";
import '../css/reviewer.css';

function ToggleTheme() {
    const [theme, setTheme] = useState(
        localStorage.getItem('theme') || 'light'
    );

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };
    return (
        <>
            <div className="theme-toggle-wrapper">
                <button className="theme-toggle" onClick={toggleTheme}>
                    <span className="theme-toggle-icon">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </span>
                </button>
            </div>
        </>
    );
}

export default ToggleTheme;