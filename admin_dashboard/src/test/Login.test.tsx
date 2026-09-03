import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import Login from '../pages/Login';

describe('Login', () => {
  it('renders login form', () => {
    render(<Login setAuthToken={vi.fn()} />);
    expect(screen.getByText(/Lexa Admin Portal/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin@lexatech/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});