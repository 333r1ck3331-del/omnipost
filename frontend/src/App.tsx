import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopNav from "./components/TopNav";
import Home from "./pages/Home";
import IdeaDetail from "./pages/IdeaDetail";
import ReviewQueue from "./pages/ReviewQueue";
import Settings from "./pages/Settings";
import ContentLibrary from "./pages/ContentLibrary";
import IdeaLibrary from "./pages/IdeaLibrary";
import CrawlDashboard from "./pages/CrawlDashboard";
import Changelog from "./pages/Changelog";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-paper-100">
        <TopNav />
        <main className="max-w-6xl mx-auto px-8 py-10 fade-in">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ideas" element={<IdeaLibrary />} />
            <Route path="/library" element={<ContentLibrary />} />
            <Route path="/crawl" element={<CrawlDashboard />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/ideas/:id" element={<IdeaDetail />} />
          </Routes>
        </main>
        <footer className="max-w-6xl mx-auto px-8 py-8 text-center">
          <p className="text-[11px] text-ink-400 tracking-wider">
            OmniPost · 慢一点，写得更像自己
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
