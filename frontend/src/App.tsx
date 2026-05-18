import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import IdeaDetail from "./pages/IdeaDetail";
import ReviewQueue from "./pages/ReviewQueue";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <main className="max-w-2xl mx-auto px-8 py-12">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ideas/:id" element={<IdeaDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
