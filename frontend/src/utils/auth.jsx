export const setAuthToken = (token, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
}

export const getAuthToken = () => {
    return localStorage.getItem('token')
}

export const getUser = () => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
}

export const getUserRole = () => {
    const user = getUser()
    return user?.role || null
}

export const clearAuth = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
}

export const isAuthenticated = () => {
    const token = getAuthToken()
    return !!token
}

export const hasRole = (requiredRole) => {
    const userRole = getUserRole()
    return userRole === requiredRole
}

export const hasAnyRole = (roles = []) => {
    const userRole = getUserRole()
    return roles.includes(userRole)
}
export const fetchWithAuth = async (url, options = {}) => {
    const token = getAuthToken()

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    }

    if(token){
        headers['Authorization'] = `Bearer ${token}`
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        })

        if(response.status === 401) {
            clearAuth()
            window.location.href = '../pages/login'
            throw new Error('Session expired. Please login again')
        }
        return response
    } catch (error) {
        throw error
    }
}