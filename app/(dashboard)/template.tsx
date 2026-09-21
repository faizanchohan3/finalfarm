// Re-mounts on every navigation, so each page gets the fade-in from globals.css.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div data-slot="page">{children}</div>
}
