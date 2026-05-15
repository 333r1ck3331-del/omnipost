import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import IdeaDetail from "./pages/IdeaDetail";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-semibold tracking-tight">
              Omni<span className="text-gray-400">Post</span>
            </a>
            <span className="text-xs text-gray-400">v0.1</span>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ideas/:id" element={<IdeaDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
