import { Link } from "react-router-dom";

export function Home() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
            <h1 className="text-5xl font-extrabold text-gray-900 mb-12 tracking-tight">
                Jeux
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl w-full">
                {/* Queens Card */}
                <Link to="/queens" className="group">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 h-full flex flex-col items-center text-center gap-4">
                        <div className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-300">👑</div>
                        <h2 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Queens</h2>
                        <p className="text-gray-500">
                            Place queens so no two queens share the same row, column, or color region.
                        </p>
                    </div>
                </Link>

                {/* Zip Card */}
                <Link to="/zip" className="group">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-purple-200 h-full flex flex-col items-center text-center gap-4">
                        <div className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-300">⚡</div>
                        <h2 className="text-2xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">Zip</h2>
                        <p className="text-gray-500">
                            Connect numbers in order to fill the grid without crossing paths.
                        </p>
                    </div>
                </Link>

                {/* Tango Card */}
                <Link to="/tango" className="group">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-orange-200 h-full flex flex-col items-center text-center gap-4">
                        <div className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-300">☀️</div>
                        <h2 className="text-2xl font-bold text-gray-900 group-hover:text-orange-500 transition-colors">Tango</h2>
                        <p className="text-gray-500">
                            Fill the grid with Sun and Moon obeying three simple rules.
                        </p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
