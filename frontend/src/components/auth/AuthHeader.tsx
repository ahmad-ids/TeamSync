import './auth-header.css';

interface AuthHeaderProps {
  title?: string;
}

export function AuthHeader({ title = 'Focused Flow' }: AuthHeaderProps) {
  return (
    <header className="authHeader">
      <span className="authHeader__title">{title}</span>
    </header>
  );
}
