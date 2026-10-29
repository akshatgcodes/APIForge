import { Route, Routes } from "react-router-dom";
import RequireOwner from "./components/RequireOwner";
import Home from "./pages/Home";
import Workspace from "./pages/Workspace";

export default function App() {
  return (
    <Routes>
      <Route element={<RequireOwner />}>
        <Route path="/" element={<Home />} />
        <Route path="/c/:id" element={<Workspace />} />
      </Route>
    </Routes>
  );
}
