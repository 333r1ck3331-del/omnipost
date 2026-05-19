import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopNav from "./components/TopNav";
import Home from "./pages/Home";
import IdeaDetail from "./pages/IdeaDetail";
import ReviewQueue from "./pages/ReviewQueue";
import Settings from "./pages/Settings";
import ContentLibrary from "./pages/ContentLibrary";
import CrawlDashboard from "./pages/CrawlDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <main className="max-w-6xl mx-auto px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<ContentLibrary />} />
            <Route path="/crawl" element={<CrawlDashboard />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ideas/:id" element={<IdeaDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
