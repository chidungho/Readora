import { Navigate, useLocation } from "react-router-dom";
import { getStoredAuth } from "../utils/authStorage";

const loginMessage = "Please log in to continue.";
const adminMessage = "Please log in with an admin account to continue.";

function ProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation();
  const { token, user } = getStoredAuth();

  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          message: requireAdmin ? adminMessage : loginMessage,
        }}
      />
    );
  }

  if (requireAdmin && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
