import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  setAuthToken: (token: string | null) => void;
}

const Layout = ({ setAuthToken }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar setAuthToken={setAuthToken} />
      <div className="ml-64">
        <Header />
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;