import { getAuthToken, getUser } from "./auth";
import { API_BASE_URL } from '../config';

export const fetchUserRoles = async () => {
  try {
    const token = getAuthToken()
    
    if(!token){
      throw new Error('No Authentication Token found')
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/rbac/role`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
    });

    if (!response.ok) {
      // Handle specific error status codes if needed
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        throw new Error("Unauthorized. Session expired");
      }

      if (response.status === 403) throw new Error("Forbidden");
      if (response.status === 404) throw new Error('No role assigned to user')
      throw new Error(`Error fetching roles: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const initiateGoogleLogin = (ret) => {
  ret = getUser()
  return ret
}

export const initiateGithubLogin = (ret) => {
  ret = getUser()
}
