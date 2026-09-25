import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import hrApi from '../utils/hrApi';

const HrAdminGuard = ({ children }) => {
  const [access, setAccess] = useState('checking');

  useEffect(() => {
    let active = true;
    hrApi.get('/employee/me').then(({ data }) => {
      if (active) setAccess(data.user?.role?.toLowerCase() === 'admin' ? 'admin' : 'staff');
    }).catch(() => {
      if (active) setAccess('anonymous');
    });
    return () => { active = false; };
  }, []);

  if (access === 'checking') return <div>Checking HR access...</div>;
  if (access === 'anonymous') return <Navigate to="/employee-login" replace />;
  if (access === 'staff') return <Navigate to="/employee-dashboard" replace />;
  return children;
};

export default HrAdminGuard;
