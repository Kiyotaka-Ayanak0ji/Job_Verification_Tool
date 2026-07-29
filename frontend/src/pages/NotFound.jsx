import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="max-w-md mx-auto text-center py-24 space-y-4">
      <h1 className="text-6xl font-bold text-accent">404</h1>
      <p className="text-muted">This page doesn't exist.</p>
      <Link to="/" className="btn-outline inline-flex">Go home</Link>
    </div>
  );
}