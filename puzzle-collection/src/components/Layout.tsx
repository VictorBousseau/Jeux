import { Link, Outlet, useLocation } from "react-router-dom";

export function Layout() {
    const location = useLocation();
    const isHome = location.pathname === "/";

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {!isHome && (
                <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                    <Link to="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-2">
                        <span>🏠</span> Jeux
                    </Link>
                    <div className="flex gap-4 text-sm font-medium text-gray-500">
                        <Link to="/queens" className={`hover:text-blue-600 transition-colors ${location.pathname === '/queens' ? 'text-blue-600' : ''}`}>Queens</Link>
                        <Link to="/zip" className={`hover:text-purple-600 transition-colors ${location.pathname === '/zip' ? 'text-purple-600' : ''}`}>Zip</Link>
                        <Link to="/tango" className={`hover:text-orange-500 transition-colors ${location.pathname === '/tango' ? 'text-orange-500' : ''}`}>Tango</Link>
                    </div>
                </nav>
            )}
            <main>
                <Outlet />
            </main>
        </div>
    );
}
