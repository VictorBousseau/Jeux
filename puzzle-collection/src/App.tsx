import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Grid as QueensGrid } from "./games/queens/Grid";
import { Grid as ZipGrid } from "./games/zip/Grid";

import { Grid as TangoGrid } from "./games/tango/Grid";

function App() {
  return (
    <BrowserRouter basename="/Jeux">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="queens" element={<QueensGrid />} />
          <Route path="zip" element={<ZipGrid />} />
          <Route path="tango" element={<TangoGrid />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
