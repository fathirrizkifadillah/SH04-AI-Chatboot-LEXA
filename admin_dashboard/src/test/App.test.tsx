import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Routes: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Route: () => null,
  Navigate: () => <div>Redirect</div>,
  Outlet: () => <div>Outlet</div>,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
}));

import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container.innerHTML).not.toBe('');
  });
});