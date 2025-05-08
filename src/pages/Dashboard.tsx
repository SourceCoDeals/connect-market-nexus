
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      // Redirect based on user type
      if (user?.isAdmin) {
        navigate('/admin');
      } else {
        navigate('/marketplace');
      }
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
    </div>
  );
};

export default Dashboard;
