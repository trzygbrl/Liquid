import Navbar from '@/components/Navbar';

// Wraps every /doctor route so the navbar is mounted once rather than
// re-declared on each page.
export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar section="doctor" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
