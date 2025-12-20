import { Navigate } from "react-router-dom"
import { isAuthenticated } from "./auth"
import { getUserRole } from "./auth"


export const RoleBasedRoute = ({children, allowedRoles = [] }) => {
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />
    }

    const userRole = getUserRole()

    if(!allowedRoles.includes(userRole)) {
        return <Navigate to="/DashboardGateway" replace />
    }

    return children
}
