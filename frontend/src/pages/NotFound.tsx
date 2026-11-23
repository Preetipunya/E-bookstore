import EmptyState from '../components/EmptyState';

export default function NotFound() {
  return <EmptyState title="Page not found" text="The page you are looking for doesn't exist." actionLabel="Go home" actionTo="/" />;
}
