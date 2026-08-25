import Navbar from '@/components/Navbar';

// Wraps every /patient route so the navbar is mounted once rather than
// re-declared on each page.
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar section="patient" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
